import { HashManager, MemoryGuard } from "@carpentry/auth";
import { describe, expect, it } from "vitest";
import {
  InMemoryPadlockUserRepository,
  MemoryPadlockTokenStore,
  PadlockNotifierFake,
  PadlockService,
} from "../src/index.js";

describe("padlock", () => {
  it("registers and logs in a user with the in-memory collaborators", async () => {
    const hasher = new HashManager();
    const repository = new InMemoryPadlockUserRepository(hasher);
    const guard = new MemoryGuard(repository, hasher);
    const tokens = new MemoryPadlockTokenStore(() => "padlock-token");
    const notifier = new PadlockNotifierFake();

    const service = new PadlockService({
      guard,
      hasher,
      userRepository: repository,
      tokenStore: tokens,
      notifier,
      config: {
        sendEmailVerificationOnRegistration: false,
      },
    });

    const registered = await service.register({
      email: "user@example.com",
      password: "secret123",
      name: "Pad Lock",
    });

    expect(registered.user.email).toBe("user@example.com");

    const login = await service.login({
      email: "user@example.com",
      password: "secret123",
    });

    expect("user" in login).toBe(true);
    if ("user" in login) {
      expect(login.user.email).toBe("user@example.com");
    }
  });
});
