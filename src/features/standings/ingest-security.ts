import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

function fixedDigest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isStandingsIngestAuthorized(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
) {
  const expectedSecrets = [
    environment.STANDINGS_INGEST_SECRET,
    environment.STANDINGS_INGEST_SECRET_PREVIOUS,
  ].filter((value): value is string => Boolean(value && value.length >= 32));
  const authorization = request.headers.get("authorization") ?? "";
  const candidate = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (expectedSecrets.length === 0 || candidate.length > 4096) return false;
  const candidateDigest = fixedDigest(candidate);
  return expectedSecrets.some((expected) =>
    timingSafeEqual(fixedDigest(expected), candidateDigest),
  );
}
