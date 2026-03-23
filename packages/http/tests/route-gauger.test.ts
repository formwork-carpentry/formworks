import { describe, expect, it } from "vitest";
import type { IRoute } from "@carpentry/core/contracts";
import { defineRouteGaugerReference, generateRouteGaugerFiles } from "../src/index.js";

describe("@carpentry/http: route gauger", () => {
  it("builds hrefs from named routes with params", () => {
    const route = defineRouteGaugerReference("posts.show", "GET", "/posts/:id", { id: 42 });

    expect(route.href).toBe("/posts/42");
    expect(route.url).toBe("/posts/42");
    expect(route.method).toBe("GET");
  });

  it("appends extra params as query string", () => {
    const route = defineRouteGaugerReference("posts.index", "GET", "/posts", { page: 2, filter: "draft" });

    expect(route.href).toBe("/posts?page=2&filter=draft");
  });

  it("generates per-module route files", () => {
    const routes: IRoute[] = [
      { method: "GET", path: "/posts", handler: async () => null, name: "posts.index", middleware: [] },
      { method: "GET", path: "/posts/:id", handler: async () => null, name: "posts.show", middleware: [] },
      { method: "PUT", path: "/locale/:lang", handler: async () => null, name: "locale.update", middleware: [] },
    ];

    const files = generateRouteGaugerFiles(routes);

    expect(files.find((file) => file.fileName === "posts.ts")?.code).toContain("export const posts");
    expect(files.find((file) => file.fileName === "posts.ts")?.code).toContain("show(params: { id: string | number })");
    expect(files.find((file) => file.fileName === "locale.ts")?.code).toContain("update(params: { lang: string | number })");
    expect(files.find((file) => file.fileName === "index.ts")?.code).toContain("export * from './posts';");
  });

  it("keeps hyphenated auth route actions typed", () => {
    const routes: IRoute[] = [
      {
        method: "POST",
        path: "/auth/register",
        handler: async () => null,
        name: "padlock.register",
        middleware: [],
      },
      {
        method: "POST",
        path: "/auth/two-factor-challenge",
        handler: async () => null,
        name: "padlock.confirm-two-factor-login",
        middleware: [],
      },
      {
        method: "GET",
        path: "/auth/:provider/callback",
        handler: async () => null,
        name: "sociallock.callback",
        middleware: [],
      },
    ];

    const files = generateRouteGaugerFiles(routes);
    const padlock = files.find((file) => file.fileName === "padlock.ts")?.code ?? "";
    const sociallock = files.find((file) => file.fileName === "sociallock.ts")?.code ?? "";

    expect(padlock).toContain("confirmTwoFactorLogin(): RouteGaugerReference");
    expect(sociallock).toContain("callback(params: { provider: string | number }): RouteGaugerReference");
  });
});
