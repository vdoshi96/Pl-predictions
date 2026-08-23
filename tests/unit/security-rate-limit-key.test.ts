import { describe, expect, it } from "vitest";

import { normalizeSecurityRateLimitAddress } from "@/features/security/rate-limit";

describe("security rate-limit source normalization", () => {
  it("groups rotating IPv6 addresses by their network prefix", () => {
    expect(normalizeSecurityRateLimitAddress("2001:db8:1234:5678::1")).toBe(
      "2001:db8:1234:5678::/64",
    );
    expect(
      normalizeSecurityRateLimitAddress("2001:0db8:1234:5678:abcd::99"),
    ).toBe("2001:db8:1234:5678::/64");
    expect(normalizeSecurityRateLimitAddress("2001:db8:1234:5679::1")).toBe(
      "2001:db8:1234:5679::/64",
    );
  });

  it("retains IPv4 and fail-closed unknown source keys", () => {
    expect(normalizeSecurityRateLimitAddress("203.0.113.9")).toBe(
      "203.0.113.9",
    );
    expect(normalizeSecurityRateLimitAddress(" ")).toBe("unknown");
  });
});
