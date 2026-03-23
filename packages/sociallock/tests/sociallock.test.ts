import { describe, expect, it } from "vitest";
import type { IAuthGuard, IAuthenticatable } from "@carpentry/core/contracts";
import { FakeTransport } from "@carpentry/http-client";
import {
  githubProvider,
  googleProvider,
  InMemorySocialUserRepository,
  MemoryStateStore,
  SocialLockService,
} from "../src/index.js";

class TestGuard implements IAuthGuard {
  private currentUser: IAuthenticatable | null = null;
  private token: string | null = "social-token";

  async attempt(): Promise<boolean> {
    return false;
  }

  async check(): Promise<boolean> {
    return this.currentUser !== null;
  }

  async id(): Promise<string | number | null> {
    return this.currentUser?.getAuthIdentifier() ?? null;
  }

  async login(user: IAuthenticatable): Promise<void> {
    this.currentUser = user;
  }

  async logout(): Promise<void> {
    this.currentUser = null;
    this.token = null;
  }

  getToken(): string | null {
    return this.token;
  }
}

describe("@carpentry/sociallock", () => {
  it("builds provider configs", () => {
    expect(googleProvider("id", "secret", "http://localhost/callback").authUrl).toContain(
      "accounts.google.com",
    );
    expect(githubProvider("id", "secret", "http://localhost/callback").tokenUrl).toContain(
      "github.com",
    );
  });

  it("completes a redirect and callback flow", async () => {
    const transport = new FakeTransport()
      .queue({ status: 200, body: { access_token: "provider-token" } })
      .queue({
        status: 200,
        body: {
          sub: "google-user-1",
          email: "person@example.com",
          name: "Example Person",
          picture: "https://example.com/avatar.png",
        },
      });

    const service = new SocialLockService({
      guard: new TestGuard(),
      stateStore: new MemoryStateStore(),
      userRepository: new InMemorySocialUserRepository(),
      providers: new Map([
        ["google", googleProvider("id", "secret", "http://localhost/callback")],
      ]),
      httpTransport: transport,
    });

    const { redirectUrl, state } = await service.redirect("google");
    expect(redirectUrl).toContain("accounts.google.com");

    const result = await service.callback("google", "auth-code", state);
    expect(result.isNewUser).toBe(true);
    expect(result.token).toBe("social-token");
    expect(result.user.email).toBe("person@example.com");
    expect(transport.getRecorded()).toHaveLength(2);
  });
});
