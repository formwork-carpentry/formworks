/**
 * @module @carpentry/sociallock/SocialLockService
 * @description OAuth 2.0 social login orchestration.
 */

import type { IAuthGuard, IAuthenticatable } from "@carpentry/core/contracts";
import { HttpClient } from "@carpentry/http-client";
import type {
  OAuthProviderConfig,
  SocialAuthResult,
  SocialLockServiceDependencies,
  SocialRedirectResult,
  SocialUserProfile,
} from "./contracts.js";
import { SocialLockError } from "./errors.js";
import { generateState } from "./state/MemoryStateStore.js";

interface TokenAwareGuard {
  getToken(): string | null;
}

export class SocialLockService<TUser extends IAuthenticatable = IAuthenticatable> {
  private readonly http: HttpClient;

  constructor(private readonly deps: SocialLockServiceDependencies<TUser>) {
    this.http = new HttpClient(deps.httpTransport);
  }

  async redirect(providerName: string): Promise<SocialRedirectResult> {
    const config = this.deps.providers.get(providerName);
    if (!config) {
      throw new SocialLockError("invalid-provider", 400, `Unknown provider: ${providerName}`);
    }

    const state = generateState();
    await this.deps.stateStore.put(state, { provider: providerName });

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      state,
      ...(config.scopes?.length ? { scope: config.scopes.join(" ") } : {}),
    });

    return {
      redirectUrl: `${config.authUrl}?${params.toString()}`,
      state,
    };
  }

  async callback(
    providerName: string,
    code: string,
    state: string,
  ): Promise<SocialAuthResult<TUser>> {
    const metadata = await this.deps.stateStore.consume(state);
    if (!metadata || metadata.provider !== providerName) {
      throw new SocialLockError("invalid-state", 400, "Invalid or expired state parameter.");
    }

    const config = this.deps.providers.get(providerName);
    if (!config) {
      throw new SocialLockError("invalid-provider", 400, `Unknown provider: ${providerName}`);
    }

    const accessToken = await this.exchangeCode(config, code);
    const profile = await this.fetchProfile(config, accessToken, providerName);

    let user = await this.deps.userRepository.findByProvider(providerName, profile.id);
    let isNewUser = false;

    if (!user) {
      user = await this.deps.userRepository.createFromSocial(providerName, profile);
      isNewUser = true;
    }

    if (typeof this.deps.guard.login === "function") {
      await this.deps.guard.login(user);
    }

    return {
      user,
      token: this.extractToken(),
      isNewUser,
    };
  }

  private async exchangeCode(config: OAuthProviderConfig, code: string): Promise<string> {
    const body: Record<string, string> = {
      code,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    };

    if (config.authStyle !== "header") {
      body.client_id = config.clientId;
      body.client_secret = config.clientSecret;
    }

    let request = this.http
      .post(config.tokenUrl, new URLSearchParams(body).toString())
      .header("Content-Type", "application/x-www-form-urlencoded")
      .accept("application/json");

    if (config.authStyle === "header") {
      const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
      request = request.header("Authorization", `Basic ${auth}`);
    }

    const response = await request.send();
    if (response.status >= 400) {
      throw new SocialLockError(
        "provider-error",
        502,
        `Token exchange failed: ${response.status}`,
      );
    }

    const data = (response.body ?? {}) as Record<string, unknown>;
    const token = data["access_token"];
    if (typeof token !== "string") {
      throw new SocialLockError("provider-error", 502, "No access_token in response.");
    }

    return token;
  }

  private async fetchProfile(
    config: OAuthProviderConfig,
    accessToken: string,
    providerName: string,
  ): Promise<SocialUserProfile> {
    if (!config.profileUrl) {
      throw new SocialLockError(
        "provider-error",
        500,
        `Provider ${providerName} has no profile URL configured.`,
      );
    }

    const response = await this.http
      .get(config.profileUrl)
      .header("Authorization", `Bearer ${accessToken}`)
      .accept("application/json")
      .send();

    if (response.status >= 400) {
      throw new SocialLockError(
        "provider-error",
        502,
        `Profile fetch failed: ${response.status}`,
      );
    }

    return this.normalizeProfile(
      providerName,
      (response.body ?? {}) as Record<string, unknown>,
    );
  }

  private normalizeProfile(
    provider: string,
    raw: Record<string, unknown>,
  ): SocialUserProfile {
    if (provider === "google") {
      return {
        id: coerceString(raw["sub"] ?? raw["id"]),
        email: coerceNullableString(raw["email"]),
        name: coerceNullableString(raw["name"]),
        avatar: coerceNullableString(raw["picture"]),
        raw,
      };
    }

    if (provider === "github") {
      return {
        id: coerceString(raw["id"]),
        email: coerceNullableString(raw["email"]),
        name: coerceNullableString(raw["name"] ?? raw["login"]),
        avatar: coerceNullableString(raw["avatar_url"]),
        raw,
      };
    }

    if (provider === "facebook") {
      const picture = raw["picture"] as { data?: { url?: unknown } } | undefined;
      return {
        id: coerceString(raw["id"]),
        email: coerceNullableString(raw["email"]),
        name: coerceNullableString(raw["name"]),
        avatar: coerceNullableString(picture?.data?.url),
        raw,
      };
    }

    if (provider === "microsoft") {
      return {
        id: coerceString(raw["id"]),
        email: coerceNullableString(raw["mail"] ?? raw["userPrincipalName"]),
        name: coerceNullableString(raw["displayName"]),
        avatar: null,
        raw,
      };
    }

    return {
      id: coerceString(raw["id"]),
      email: coerceNullableString(raw["email"]),
      name: coerceNullableString(raw["name"]),
      avatar: coerceNullableString(raw["avatar_url"]),
      raw,
    };
  }

  private extractToken(): string | null {
    const guard = this.deps.guard as IAuthGuard & Partial<TokenAwareGuard>;
    return typeof guard.getToken === "function" ? guard.getToken() : null;
  }
}

function coerceString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function coerceNullableString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}
