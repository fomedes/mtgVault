import { describe, expect, it } from "vitest";
import {
  normalizePrivateKey,
  serverEnvSchema,
  socketEnvSchema,
} from "@/lib/env";

const validServerEnv = {
  MONGODB_URI: "mongodb://localhost:27017/mtg-vault",
  FIREBASE_ADMIN_PROJECT_ID: "demo-project",
  FIREBASE_ADMIN_CLIENT_EMAIL: "svc@demo-project.iam.gserviceaccount.com",
  FIREBASE_ADMIN_PRIVATE_KEY:
    "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
};

describe("serverEnvSchema", () => {
  it("accepts a complete environment", () => {
    expect(serverEnvSchema.safeParse(validServerEnv).success).toBe(true);
  });

  it.each(Object.keys(validServerEnv))("rejects when %s is missing", (key) => {
    const env = { ...validServerEnv } as Record<string, string>;
    delete env[key];
    expect(serverEnvSchema.safeParse(env).success).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(
      serverEnvSchema.safeParse({ ...validServerEnv, MONGODB_URI: "" }).success,
    ).toBe(false);
  });
});

describe("normalizePrivateKey", () => {
  it("converts escaped newlines into real newlines", () => {
    expect(normalizePrivateKey("a\\nb\\nc")).toBe("a\nb\nc");
  });

  it("leaves real newlines untouched", () => {
    expect(normalizePrivateKey("a\nb")).toBe("a\nb");
  });
});

describe("socketEnvSchema", () => {
  it("applies defaults when vars are absent", () => {
    const parsed = socketEnvSchema.parse({});
    expect(parsed.SOCKET_PORT).toBe(4000);
    expect(parsed.SOCKET_CORS_ORIGIN).toBe("http://localhost:3000");
  });

  it("coerces SOCKET_PORT from string to number", () => {
    expect(socketEnvSchema.parse({ SOCKET_PORT: "5123" }).SOCKET_PORT).toBe(
      5123,
    );
  });

  it("rejects a non-numeric port", () => {
    expect(
      socketEnvSchema.safeParse({ SOCKET_PORT: "not-a-port" }).success,
    ).toBe(false);
  });
});
