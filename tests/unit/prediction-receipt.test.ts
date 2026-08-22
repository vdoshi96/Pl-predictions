import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nextHeadersMocks = vi.hoisted(() => ({
  cookies: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => nextHeadersMocks);

import {
  hashReceiptToken,
  hasPredictionReceipt,
  setReceiptCookie,
} from "../../src/features/predictions/receipt";

const PREDICTION_ID = "123e4567-e89b-12d3-a456-426614174000";
const TOKEN = "synthetic-receipt-token";

let cookieStore: {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  cookieStore = { get: vi.fn(), set: vi.fn() };
  nextHeadersMocks.cookies.mockReset().mockResolvedValue(cookieStore);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("prediction receipt cookie", () => {
  it("uses a strict HttpOnly cookie and verifies its token hash", async () => {
    await setReceiptCookie(PREDICTION_ID, TOKEN);

    expect(cookieStore.set).toHaveBeenCalledWith(
      "pl_prediction_receipt",
      `${PREDICTION_ID}.${TOKEN}`,
      expect.objectContaining({
        httpOnly: true,
        path: "/entries",
        sameSite: "strict",
        secure: false,
      }),
    );

    cookieStore.get.mockReturnValue({ value: `${PREDICTION_ID}.${TOKEN}` });
    await expect(
      hasPredictionReceipt(PREDICTION_ID, hashReceiptToken(TOKEN)),
    ).resolves.toBe(true);
  });

  it("marks the receipt cookie Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await setReceiptCookie(PREDICTION_ID, TOKEN);

    expect(cookieStore.set.mock.calls[0]?.[2]).toMatchObject({ secure: true });
  });

  it("allows the explicit local HTTP E2E harness to use the cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_HTTP_E2E", "1");

    await setReceiptCookie(PREDICTION_ID, TOKEN);

    expect(cookieStore.set.mock.calls[0]?.[2]).toMatchObject({ secure: false });
  });

  it("keeps the cookie Secure when the local harness flag is copied to Vercel", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_HTTP_E2E", "1");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");

    await setReceiptCookie(PREDICTION_ID, TOKEN);

    expect(cookieStore.set.mock.calls[0]?.[2]).toMatchObject({ secure: true });
  });
});
