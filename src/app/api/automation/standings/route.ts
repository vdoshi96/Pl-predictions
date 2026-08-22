import { NextResponse } from "next/server";

import {
  clearSecurityRateLimit,
  reserveSecurityAttempt,
} from "@/features/security/rate-limit";
import { isStandingsIngestAuthorized } from "@/features/standings/ingest-security";
import { importCanonicalStandings } from "@/features/standings/importer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const attempt = await reserveSecurityAttempt({
    blockSeconds: 60,
    limit: 60,
    requestHeaders: request.headers,
    scope: "standings_ingest",
    windowSeconds: 60,
  });
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!isStandingsIngestAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  await clearSecurityRateLimit("standings_ingest", attempt.keyHash);

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
