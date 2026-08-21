import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nextHeadersMocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("../../src/features/admin/server-only", () => ({}));
vi.mock("next/headers", () => nextHeadersMocks);

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  AdminAuthenticationRequiredError,
  AdminInvalidOriginError,
  AdminSecurityConfigurationError,
  createAdminPasswordHash,
  getAdminAuditMetadata,
  getAdminSession,
  isSameOriginAdminRequest,
  issueAdminSessionToken,
  loginAdmin,
  logoutAdmin,
  requireAdmin,
  requireAdminMutation,
  requireSameOrigin,
  verifyAdminCredentials,
  verifyAdminSessionToken,
} from "../../src/features/admin/security";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "synthetic-test-only-admin-password";
const LEGACY_ADMIN_SECRET = "owner-credential-with-enough-entropy";
const ADMIN_PASSWORD_HASH = createAdminPasswordHash(
  ADMIN_PASSWORD,
  Buffer.from("00112233445566778899aabbccddeeff", "hex"),
);
const SESSION_SECRET = "session-signing-secret-with-at-least-thirty-two-bytes";
const NOW = Date.UTC(2026, 7, 8, 12, 0, 0);

type CookieStoreMock = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

let cookieStore: CookieStoreMock;

function sameOriginHeaders(overrides: HeadersInit = {}): Headers {
  return new Headers({
    host: "pl-predictions.vercel.app",
    origin: "https://pl-predictions.vercel.app",
    "x-forwarded-host": "pl-predictions.vercel.app",
    "x-forwarded-proto": "https",
    ...Object.fromEntries(new Headers(overrides).entries()),
  });
}

beforeEach(() => {
  vi.stubEnv("ADMIN_USERNAME", ADMIN_USERNAME);
  vi.stubEnv("ADMIN_PASSWORD_HASH", ADMIN_PASSWORD_HASH);
  vi.stubEnv("ADMIN_SECRET", LEGACY_ADMIN_SECRET);
  vi.stubEnv("ADMIN_SESSION_SECRET", SESSION_SECRET);
  vi.stubEnv("NODE_ENV", "test");

  cookieStore = {
    get: vi.fn(),
    set: vi.fn(),
  };
  nextHeadersMocks.cookies.mockReset().mockResolvedValue(cookieStore);
  nextHeadersMocks.headers.mockReset().mockResolvedValue(sameOriginHeaders());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("administrator credential verification", () => {
  it("accepts only the exact username and PBKDF2-backed password", () => {
    expect(verifyAdminCredentials(ADMIN_USERNAME, ADMIN_PASSWORD)).toBe(true);
    expect(verifyAdminCredentials("Admin", ADMIN_PASSWORD)).toBe(false);
    expect(verifyAdminCredentials(ADMIN_USERNAME, `${ADMIN_PASSWORD}!`)).toBe(
      false,
    );
    expect(verifyAdminCredentials(null, ADMIN_PASSWORD)).toBe(false);
    expect(verifyAdminCredentials(ADMIN_USERNAME, null)).toBe(false);
    expect(verifyAdminCredentials(ADMIN_USERNAME, "x".repeat(4_097))).toBe(
      false,
    );
  });

  it("creates a salted PBKDF2 hash without embedding the password", () => {
    expect(ADMIN_PASSWORD_HASH).toMatch(
      /^pbkdf2_sha256\$600000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/,
    );
    expect(ADMIN_PASSWORD_HASH).not.toContain(ADMIN_PASSWORD);
  });

  it("never authenticates invalid inputs that collide with sentinel values", () => {
    vi.stubEnv("ADMIN_USERNAME", "invalid-admin-username");
    vi.stubEnv(
      "ADMIN_PASSWORD_HASH",
      createAdminPasswordHash(
        "invalid-admin-password",
        Buffer.from("ffeeddccbbaa99887766554433221100", "hex"),
      ),
    );

    expect(verifyAdminCredentials(null, null)).toBe(false);
    expect(verifyAdminCredentials({}, [])).toBe(false);
    expect(verifyAdminCredentials("x".repeat(4_097), "x".repeat(4_097))).toBe(
      false,
    );
  });

  it("supports the legacy ADMIN_SECRET credential during migration", () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");

    expect(verifyAdminCredentials(ADMIN_USERNAME, LEGACY_ADMIN_SECRET)).toBe(
      true,
    );
    expect(
      verifyAdminCredentials(ADMIN_USERNAME, `${LEGACY_ADMIN_SECRET}-wrong`),
    ).toBe(false);
  });

  it("defaults the legacy username to admin when none is configured", () => {
    vi.stubEnv("ADMIN_USERNAME", "");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");

    expect(verifyAdminCredentials("admin", LEGACY_ADMIN_SECRET)).toBe(true);
  });

  it("fails closed on a malformed password hash without leaking secrets", () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "pbkdf2_sha256$1$bad$bad");

    expect(() =>
      verifyAdminCredentials(ADMIN_USERNAME, ADMIN_PASSWORD),
    ).toThrow(AdminSecurityConfigurationError);

    try {
      verifyAdminCredentials(ADMIN_USERNAME, ADMIN_PASSWORD);
    } catch (error) {
      expect(String(error)).not.toContain(ADMIN_PASSWORD);
      expect(String(error)).not.toContain(LEGACY_ADMIN_SECRET);
      expect(String(error)).not.toContain(SESSION_SECRET);
    }
  });

  it("fails closed when the legacy secret is too weak", () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");
    vi.stubEnv("ADMIN_SECRET", "short");

    expect(() =>
      verifyAdminCredentials(ADMIN_USERNAME, LEGACY_ADMIN_SECRET),
    ).toThrow(AdminSecurityConfigurationError);
  });
});

describe("signed administrator session tokens", () => {
  it("round-trips a minimal expiring payload without embedding credentials", () => {
    const token = issueAdminSessionToken(NOW);
    const session = verifyAdminSessionToken(token, NOW);

    expect(session).toEqual({
      subject: "admin",
      issuedAt: Math.floor(NOW / 1_000),
      expiresAt: Math.floor(NOW / 1_000) + ADMIN_SESSION_TTL_SECONDS,
    });
    expect(token).not.toContain(LEGACY_ADMIN_SECRET);
    expect(token).not.toContain(SESSION_SECRET);
    expect(token.split(".")).toHaveLength(2);
  });

  it("uses a nonce so independently issued tokens differ", () => {
    expect(issueAdminSessionToken(NOW)).not.toBe(issueAdminSessionToken(NOW));
  });

  it("invalidates existing tokens when the signing secret rotates", () => {
    const token = issueAdminSessionToken(NOW);
    vi.stubEnv(
      "ADMIN_SESSION_SECRET",
      "a-different-session-signing-secret-with-sufficient-entropy",
    );

    expect(verifyAdminSessionToken(token, NOW)).toBeNull();
  });

  it("rejects tampering, malformed signatures, future tokens, and expiry", () => {
    const token = issueAdminSessionToken(NOW);
    const [payload, signature] = token.split(".");
    const tamperedPayload = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}`;

    expect(
      verifyAdminSessionToken(`${tamperedPayload}.${signature}`, NOW),
    ).toBeNull();
    expect(verifyAdminSessionToken(`${payload}.AA`, NOW)).toBeNull();
    expect(verifyAdminSessionToken("not-a-token", NOW)).toBeNull();
    expect(
      verifyAdminSessionToken(token, NOW + ADMIN_SESSION_TTL_SECONDS * 1_000),
    ).toBeNull();

    const futureToken = issueAdminSessionToken(NOW + 120_000);
    expect(verifyAdminSessionToken(futureToken, NOW)).toBeNull();
  });

  it("fails closed when the signing secret is absent or weak", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "short");

    expect(() => issueAdminSessionToken(NOW)).toThrow(
      AdminSecurityConfigurationError,
    );
    expect(() => verifyAdminSessionToken("bad", NOW)).toThrow(
      AdminSecurityConfigurationError,
    );
  });
});

describe("administrator cookie lifecycle", () => {
  it("sets a strict HttpOnly session cookie after a valid same-origin login", async () => {
    await expect(loginAdmin(ADMIN_USERNAME, ADMIN_PASSWORD)).resolves.toBe(
      true,
    );

    expect(cookieStore.set).toHaveBeenCalledOnce();
    const [name, token, options] = cookieStore.set.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe(ADMIN_SESSION_COOKIE);
    expect(verifyAdminSessionToken(token)).not.toBeNull();
    expect(token).not.toContain(ADMIN_PASSWORD);
    expect(token).not.toContain(LEGACY_ADMIN_SECRET);
    expect(options).toMatchObject({
      httpOnly: true,
      maxAge: ADMIN_SESSION_TTL_SECONDS,
      path: "/",
      priority: "high",
      sameSite: "strict",
      secure: false,
    });
    expect(options.expires).toBeInstanceOf(Date);
  });

  it("marks the cookie Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await loginAdmin(ADMIN_USERNAME, ADMIN_PASSWORD);

    expect(cookieStore.set.mock.calls[0]?.[2]).toMatchObject({ secure: true });
  });

  it("allows the explicit local HTTP E2E harness to use the cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_HTTP_E2E", "1");

    await loginAdmin(ADMIN_USERNAME, ADMIN_PASSWORD);

    expect(cookieStore.set.mock.calls[0]?.[2]).toMatchObject({ secure: false });
  });

  it("does not create a cookie for an invalid credential", async () => {
    await expect(loginAdmin(ADMIN_USERNAME, "wrong-credential")).resolves.toBe(
      false,
    );
    await expect(loginAdmin("not-admin", ADMIN_PASSWORD)).resolves.toBe(false);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("rejects cross-origin login before touching the cookie", async () => {
    nextHeadersMocks.headers.mockResolvedValue(
      sameOriginHeaders({ origin: "https://attacker.example" }),
    );

    await expect(
      loginAdmin(ADMIN_USERNAME, ADMIN_PASSWORD),
    ).rejects.toBeInstanceOf(AdminInvalidOriginError);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("expires the cookie with matching security attributes on logout", async () => {
    await logoutAdmin();

    expect(cookieStore.set).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE,
      "",
      expect.objectContaining({
        expires: new Date(0),
        httpOnly: true,
        maxAge: 0,
        path: "/",
        sameSite: "strict",
      }),
    );
  });
});

describe("administrator authorization", () => {
  it("reads and requires a valid cookie using the async cookie API", async () => {
    const token = issueAdminSessionToken();
    cookieStore.get.mockReturnValue({
      name: ADMIN_SESSION_COOKIE,
      value: token,
    });

    await expect(getAdminSession()).resolves.toMatchObject({
      subject: "admin",
    });
    await expect(requireAdmin()).resolves.toMatchObject({ subject: "admin" });
    expect(nextHeadersMocks.cookies).toHaveBeenCalledTimes(2);
  });

  it("treats a malformed cookie as unauthenticated", async () => {
    cookieStore.get.mockReturnValue({
      name: ADMIN_SESSION_COOKIE,
      value: "malformed.token",
    });

    await expect(getAdminSession()).resolves.toBeNull();
    await expect(requireAdmin()).rejects.toBeInstanceOf(
      AdminAuthenticationRequiredError,
    );
  });
});

describe("same-origin mutation protection", () => {
  it("accepts exact Vercel forwarded origin, host, protocol, and port", () => {
    expect(
      isSameOriginAdminRequest(
        sameOriginHeaders({
          host: "internal.vercel",
          origin: "https://Example.com:8443",
          "x-forwarded-host": "example.com:8443, internal.vercel",
          "x-forwarded-proto": "HTTPS, http",
        }),
      ),
    ).toBe(true);
  });

  it("falls back to local HTTP Host when forwarded headers are absent", () => {
    expect(
      isSameOriginAdminRequest(
        new Headers({
          host: "localhost:3000",
          origin: "http://localhost:3000",
        }),
      ),
    ).toBe(true);
  });

  it.each([
    ["a foreign origin", { origin: "https://attacker.example" }],
    ["a missing origin", { origin: "" }],
    ["an opaque origin", { origin: "null" }],
    ["a protocol mismatch", { "x-forwarded-proto": "http" }],
    ["an empty forwarded host", { "x-forwarded-host": "" }],
    ["an empty forwarded protocol", { "x-forwarded-proto": "" }],
    ["a malformed forwarded host", { "x-forwarded-host": "example.com/path" }],
  ])("rejects %s", (_label, override) => {
    expect(isSameOriginAdminRequest(sameOriginHeaders(override))).toBe(false);
  });

  it("uses async headers and throws a fixed forbidden error", async () => {
    nextHeadersMocks.headers.mockResolvedValue(
      sameOriginHeaders({ origin: "https://attacker.example" }),
    );

    await expect(requireSameOrigin()).rejects.toMatchObject({
      code: "ADMIN_INVALID_ORIGIN",
      status: 403,
    });
  });

  it("requires both same-origin and a valid admin session for mutations", async () => {
    const token = issueAdminSessionToken();
    cookieStore.get.mockReturnValue({
      name: ADMIN_SESSION_COOKIE,
      value: token,
    });

    await expect(requireAdminMutation()).resolves.toMatchObject({
      subject: "admin",
    });
  });
});

describe("audit metadata", () => {
  it("keeps only a bounded sanitized Vercel request id", async () => {
    const requestId = ` sfo1::abc\u0000\u007f${"x".repeat(200)} `;
    nextHeadersMocks.headers.mockResolvedValue({
      get(name: string) {
        if (name === "x-vercel-id") return requestId;
        if (name === "x-forwarded-for") return "203.0.113.1";
        if (name === "cookie") return `credential=${LEGACY_ADMIN_SECRET}`;
        return null;
      },
    });

    const metadata = await getAdminAuditMetadata();

    expect(Object.keys(metadata)).toEqual(["requestId"]);
    expect(metadata.requestId).toHaveLength(128);
    expect(metadata.requestId).not.toContain("\u0000");
    expect(metadata.requestId).not.toContain("\u007f");
    expect(JSON.stringify(metadata)).not.toContain(LEGACY_ADMIN_SECRET);
    expect(JSON.stringify(metadata)).not.toContain("203.0.113.1");
  });
});
