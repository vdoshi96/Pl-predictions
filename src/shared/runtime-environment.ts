export type RuntimeEnvironment = {
  LOCAL_HTTP_E2E?: string;
  NODE_ENV?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
};

/**
 * Returns true only for the local production-server browser harness. Vercel
 * can never satisfy this escape hatch, even if an environment variable is
 * copied into the production project accidentally.
 */
export function isLocalHttpE2EEnvironment(
  environment: RuntimeEnvironment = process.env,
): boolean {
  return (
    environment.LOCAL_HTTP_E2E === "1" &&
    !environment.VERCEL?.trim() &&
    environment.VERCEL_ENV !== "production"
  );
}
