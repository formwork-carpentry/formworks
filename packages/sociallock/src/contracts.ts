/**
 * @module @formwork/sociallock/contracts
 * @description Public contracts for OAuth 2.0 social login.
 */

import type { IAuthGuard, IAuthenticatable } from "@formwork/core/contracts";
import type { HttpTransport } from "@formwork/http-client";

export interface SocialLockStateMetadata {
  provider: string;
}

export interface IStateStore {
  put(state: string, metadata?: SocialLockStateMetadata): Promise<void>;
  consume(state: string): Promise<SocialLockStateMetadata | null>;
}

export interface SocialUserProfile {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  raw: Record<string, unknown>;
}

export interface ISocialUserRepository<TUser extends IAuthenticatable = IAuthenticatable> {
  findByProvider(provider: string, providerId: string): Promise<TUser | null>;
  createFromSocial(provider: string, profile: SocialUserProfile): Promise<TUser>;
}

export type OAuthAuthStyle = "body" | "header";

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  profileUrl?: string;
  scopes?: string[];
  authStyle?: OAuthAuthStyle;
}

export interface SocialRedirectResult {
  redirectUrl: string;
  state: string;
}

export interface SocialAuthResult<TUser extends IAuthenticatable = IAuthenticatable> {
  user: TUser;
  token: string | null;
  isNewUser: boolean;
}

export interface SocialLockServiceDependencies<TUser extends IAuthenticatable = IAuthenticatable> {
  guard: IAuthGuard;
  userRepository: ISocialUserRepository<TUser>;
  stateStore: IStateStore;
  providers: Map<string, OAuthProviderConfig>;
  httpTransport?: HttpTransport;
}
