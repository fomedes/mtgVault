import { describe, expect, it, vi } from "vitest";
import {
  isOriginAllowed,
  makeOriginValidator,
  parseOrigins,
} from "@/server/socket-origin";

const ENV = "https://app.example.com, https://www.example.com";

describe("parseOrigins", () => {
  it("splits, trims, and drops empties", () => {
    expect(parseOrigins("a, b ,, c")).toEqual(["a", "b", "c"]);
    expect(parseOrigins("")).toEqual([]);
  });
});

describe("isOriginAllowed", () => {
  it("allows configured production origins exactly", () => {
    expect(isOriginAllowed("https://app.example.com", ENV)).toBe(true);
    expect(isOriginAllowed("https://www.example.com", ENV)).toBe(true);
  });

  it("allows localhost / loopback on any port", () => {
    expect(isOriginAllowed("http://localhost:3000", ENV)).toBe(true);
    expect(isOriginAllowed("http://localhost:5173", ENV)).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:3000", ENV)).toBe(true);
  });

  it("allows private-LAN hosts (so cross-device testing just works)", () => {
    expect(isOriginAllowed("http://192.168.0.190:3000", ENV)).toBe(true);
    expect(isOriginAllowed("http://10.1.2.3:3000", ENV)).toBe(true);
    expect(isOriginAllowed("http://172.16.5.5:3000", ENV)).toBe(true);
    expect(isOriginAllowed("http://172.31.0.1:3000", ENV)).toBe(true);
  });

  it("rejects public origins not in the allowlist", () => {
    expect(isOriginAllowed("https://evil.com", ENV)).toBe(false);
    expect(isOriginAllowed("http://example.com.attacker.net", ENV)).toBe(false);
  });

  it("rejects non-private IPs and near-miss ranges", () => {
    expect(isOriginAllowed("http://8.8.8.8:3000", ENV)).toBe(false);
    expect(isOriginAllowed("http://172.15.0.1:3000", ENV)).toBe(false); // below 16
    expect(isOriginAllowed("http://172.32.0.1:3000", ENV)).toBe(false); // above 31
    expect(isOriginAllowed("http://192.169.0.1:3000", ENV)).toBe(false);
  });

  it("allows missing origin (non-browser clients) and rejects garbage", () => {
    expect(isOriginAllowed(undefined, ENV)).toBe(true);
    expect(isOriginAllowed("not a url", ENV)).toBe(false);
  });
});

describe("makeOriginValidator", () => {
  it("reflects allowed origins and denies the rest (once-logged)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const validate = makeOriginValidator(ENV);

    const allow = vi.fn();
    validate("http://localhost:3000", allow);
    expect(allow).toHaveBeenCalledWith(null, true);

    const deny = vi.fn();
    validate("https://evil.com", deny);
    expect(deny).toHaveBeenCalledWith(null, false);

    // Same bad origin again — still denied, but only logged the first time.
    validate("https://evil.com", vi.fn());
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });
});
