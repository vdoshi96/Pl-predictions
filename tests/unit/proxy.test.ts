import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "../../src/proxy";

describe("strict content security policy proxy", () => {
  it("uses a per-request nonce without unsafe inline scripts", () => {
    vi.stubEnv("NODE_ENV", "production");
    const first = proxy(new NextRequest("https://example.com/rules"));
    const second = proxy(new NextRequest("https://example.com/rules"));
    const firstPolicy = first.headers.get("content-security-policy") ?? "";
    const secondPolicy = second.headers.get("content-security-policy") ?? "";

    expect(firstPolicy).toContain("script-src 'self' 'nonce-");
    expect(firstPolicy).toContain("'strict-dynamic'");
    expect(firstPolicy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(firstPolicy).toContain("upgrade-insecure-requests");
    expect(secondPolicy).not.toBe(firstPolicy);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
