import { describe, expect, it } from "vitest";
import { createFaker, fake } from "../src/index.js";

describe("@carpentry/faker", () => {
  it("is deterministic for the same seed", () => {
    const a = createFaker("seed-1");
    const b = createFaker("seed-1");

    expect(a.person.fullName()).toBe(b.person.fullName());
    expect(a.internet.email()).toBe(b.internet.email());
    expect(a.company.name()).toBe(b.company.name());
  });

  it("supports unique values and sequences", () => {
    const faker = fake(42);

    const first = faker.unique(() => faker.internet.email());
    const second = faker.unique(() => faker.internet.email());

    expect(first).not.toBe(second);
    expect(faker.sequence()).toBe(1);
    expect(faker.sequence((index) => `user-${index}`)).toBe("user-2");
  });

  it("allows locale selection without changing determinism", () => {
    const faker = createFaker(7).locale("en-US");

    expect(faker.locale()).toBe("en-US");
    expect(faker.lorem.sentence()).toMatch(/\.$/);
  });
});
