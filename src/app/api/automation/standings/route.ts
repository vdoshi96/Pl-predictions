import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { importCanonicalStandings } from "../../../../../scripts/import-standings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;

function fixedDigest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function authorized(request: Request) {
  const expected = process.env.STANDINGS_INGEST_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const candidate = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!expected || expected.length < 32 || candidate.length > 4096)
    return false;
  return timingSafeEqual(fixedDigest(expected), fixedDigest(candidate));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  try {
    const result = await importCanonicalStandings(payload);
    return NextResponse.json(
      { runId: result.runId, status: result.status },
      {
        status: result.status === "failed" ? 202 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Snapshot rejected. The last valid standings table remains active.",
      },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
}
