import { describe, expect, it } from "vitest";
import { evaluateAllowlist, normalizeEmail } from "@/lib/auth/allowlist";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo.Bar@GMAIL.com ")).toBe("foo.bar@gmail.com");
  });

  it("keeps an already-normal email unchanged", () => {
    expect(normalizeEmail("a@b.com")).toBe("a@b.com");
  });
});

describe("evaluateAllowlist", () => {
  it("denies when no entry exists", () => {
    expect(evaluateAllowlist(null)).toEqual({ allowed: false, role: "user" });
    expect(evaluateAllowlist(undefined)).toEqual({
      allowed: false,
      role: "user",
    });
  });

  it("allows a user entry with role user", () => {
    expect(evaluateAllowlist({ role: "user" })).toEqual({
      allowed: true,
      role: "user",
    });
  });

  it("allows an admin entry with role admin", () => {
    expect(evaluateAllowlist({ role: "admin" })).toEqual({
      allowed: true,
      role: "admin",
    });
  });

  it("falls back to role user for unknown or missing roles", () => {
    expect(evaluateAllowlist({ role: "superuser" })).toEqual({
      allowed: true,
      role: "user",
    });
    expect(evaluateAllowlist({})).toEqual({ allowed: true, role: "user" });
  });
});
