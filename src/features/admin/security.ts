import "./server-only";

import {
  createHash,
  createHmac,
  pbkdf2,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies, headers } from "next/headers";
import { promisify } from "node:util";

export const ADMIN_SESSION_COOKIE = "plp_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

const ADMIN_SESSION_VERSION = 1;
const ADMIN_SESSION_SUBJECT = "admin";
const DEFAULT_ADMIN_USERNAME = "admin";
const MAX_CREDENTIAL_BYTES = 4_096;
const MAX_SESSION_TOKEN_BYTES = 2_048;
const MIN_ADMIN_SECRET_BYTES = 16;
const MIN_ADMIN_PASSWORD_BYTES = 9;
const MIN_SESSION_SECRET_BYTES = 32;
const CLOCK_SKEW_SECONDS = 60;
const NONCE_BYTES = 16;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const PASSWORD_HASH_ALGORITHM = "pbkdf2_sha256";
const PASSWORD_HASH_ITERATIONS = 600_000;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;
const pbkdf2Async = promisify(pbkdf2);

export type AdminSecurityErrorCode =
  | "ADMIN_AUTHENTICATION_REQUIRED"
  | "ADMIN_INVALID_ORIGIN"
  | "ADMIN_SECURITY_NOT_CONFIGURED";

export class AdminSecurityError extends Error {
  readonly code: AdminSecurityErrorCode;
  readonly status: 401 | 403 | 500;

  protected constructor(
    code: AdminSecurityErrorCode,
    status: 401 | 403 | 500,
    message: string,
  ) {
    super(message);
    this.name = "AdminSecurityError";
    this.code = code;
    this.status = status;
  }
}

export class AdminAuthenticationRequiredError extends AdminSecurityError {
  constructor() {
    super(
      "ADMIN_AUTHENTICATION_REQUIRED",
      401,
      "Administrator authentication is required.",
    );
    this.name = "AdminAuthenticationRequiredError";
  }
}

export class AdminInvalidOriginError extends AdminSecurityError {
  constructor() {
    super(
      "ADMIN_INVALID_ORIGIN",
      403,
      "This administrator request was not accepted.",
    );
    this.name = "AdminInvalidOriginError";
  }
}

export class AdminSecurityConfigurationError extends AdminSecurityError {
  constructor() {
    super(
      "ADMIN_SECURITY_NOT_CONFIGURED",
      500,
      "Administrator authentication is unavailable.",
    );
    this.name = "AdminSecurityConfigurationError";
  }
}

export type AdminSession = Readonly<{
  subject: "admin";
  issuedAt: number;
  expiresAt: number;
}>;

type AdminSessionPayload = {
  v: typeof ADMIN_SESSION_VERSION;
  sub: typeof ADMIN_SESSION_SUBJECT;
  iat: number;
  exp: number;
  nonce: string;
};

type HeaderReader = Pick<Headers, "get">;

export type AdminAuditMetadata = Readonly<{
  requestId: string | null;
}>;

function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function requireConfiguredSecret(
  value: string | undefined,
  minimumBytes: number,
): string {
  if (
    typeof value !== "string" ||
    utf8ByteLength(value) < minimumBytes ||
    value.trim().length === 0
  ) {
    throw new AdminSecurityConfigurationError();
  }

  return value;
}

function adminCredentialSecret(): string {
  return requireConfiguredSecret(
    process.env.ADMIN_SECRET,
    MIN_ADMIN_SECRET_BYTES,
  );
}

function configuredAdminUsername(): string {
  const username = process.env.ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME;
  if (
    utf8ByteLength(username) < 3 ||
    utf8ByteLength(username) > 64 ||
    !/^[A-Za-z0-9._-]+$/u.test(username)
  ) {
    throw new AdminSecurityConfigurationError();
  }
  return username;
}

function adminSessionSecret(): string {
  return requireConfiguredSecret(
    process.env.ADMIN_SESSION_SECRET,
    MIN_SESSION_SECRET_BYTES,
  );
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Verifies the owner credential after hashing both values to the same fixed
 * length. Oversized input is replaced with a fixed invalid value before the
 * constant-time comparison to avoid turning login into a hashing DoS vector.
 */
function usableCredential(
  candidate: unknown,
  fallback: string,
): { inputValid: boolean; value: string } {
  if (
    typeof candidate === "string" &&
    utf8ByteLength(candidate) <= MAX_CREDENTIAL_BYTES
  ) {
    return { inputValid: true, value: candidate };
  }
  return { inputValid: false, value: fallback };
}

function parsePasswordHash(value: string): {
  digest: Buffer;
  iterations: number;
  salt: Buffer;
} | null {
  const [algorithm, iterationsValue, saltValue, digestValue, ...extra] =
    value.split("$");
  const iterations = Number(iterationsValue);
  if (
    extra.length > 0 ||
    algorithm !== PASSWORD_HASH_ALGORITHM ||
    !Number.isSafeInteger(iterations) ||
    iterations < PASSWORD_HASH_ITERATIONS ||
    iterations > 1_000_000 ||
    !saltValue ||
    !digestValue ||
    !BASE64URL_PATTERN.test(saltValue) ||
    !BASE64URL_PATTERN.test(digestValue)
  ) {
    return null;
  }

  const salt = Buffer.from(saltValue, "base64url");
  const digest = Buffer.from(digestValue, "base64url");
  if (
    salt.toString("base64url") !== saltValue ||
    digest.toString("base64url") !== digestValue ||
    salt.byteLength < PASSWORD_SALT_BYTES ||
    digest.byteLength !== PASSWORD_HASH_BYTES
  ) {
    return null;
  }

  return { digest, iterations, salt };
}

export function createAdminPasswordHash(
  password: string,
  salt = randomBytes(PASSWORD_SALT_BYTES),
): string {
  if (
    utf8ByteLength(password) < MIN_ADMIN_PASSWORD_BYTES ||
    utf8ByteLength(password) > MAX_CREDENTIAL_BYTES ||
    salt.byteLength < PASSWORD_SALT_BYTES
  ) {
    throw new TypeError("The administrator password cannot be hashed.");
  }

  const digest = pbkdf2Sync(
    password,
    salt,
    PASSWORD_HASH_ITERATIONS,
    PASSWORD_HASH_BYTES,
    "sha256",
  );
  return [
    PASSWORD_HASH_ALGORITHM,
    PASSWORD_HASH_ITERATIONS,
    salt.toString("base64url"),
    digest.toString("base64url"),
  ].join("$");
}

function verifyConfiguredPassword(candidate: string): boolean {
  const configuredHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!configuredHash) {
    return timingSafeEqual(sha256(adminCredentialSecret()), sha256(candidate));
  }

  const parsed = parsePasswordHash(configuredHash);
  if (!parsed) throw new AdminSecurityConfigurationError();
  const supplied = pbkdf2Sync(
    candidate,
    parsed.salt,
    parsed.iterations,
    parsed.digest.byteLength,
    "sha256",
  );
  return timingSafeEqual(parsed.digest, supplied);
}

async function verifyConfiguredPasswordAsync(
  candidate: string,
): Promise<boolean> {
  const configuredHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!configuredHash) {
    return timingSafeEqual(sha256(adminCredentialSecret()), sha256(candidate));
  }

  const parsed = parsePasswordHash(configuredHash);
  if (!parsed) throw new AdminSecurityConfigurationError();
  const supplied = await pbkdf2Async(
    candidate,
    parsed.salt,
    parsed.iterations,
    parsed.digest.byteLength,
    "sha256",
  );
  return timingSafeEqual(parsed.digest, supplied);
}

export function verifyAdminCredentials(
  candidateUsername: unknown,
  candidatePassword: unknown,
): boolean {
  const expectedUsername = configuredAdminUsername();
  const username = usableCredential(
    candidateUsername,
    "invalid-admin-username",
  );
  const password = usableCredential(
    candidatePassword,
    "invalid-admin-password",
  );
  const usernameMatches = timingSafeEqual(
    sha256(expectedUsername),
    sha256(username.value),
  );
  const passwordMatches = verifyConfiguredPassword(password.value);
  return (
    username.inputValid &&
    password.inputValid &&
    usernameMatches &&
    passwordMatches
  );
}

async function verifyAdminCredentialsAsync(
  candidateUsername: unknown,
  candidatePassword: unknown,
): Promise<boolean> {
  const expectedUsername = configuredAdminUsername();
  const username = usableCredential(
    candidateUsername,
    "invalid-admin-username",
  );
  const password = usableCredential(
    candidatePassword,
    "invalid-admin-password",
  );
  const usernameMatches = timingSafeEqual(
    sha256(expectedUsername),
    sha256(username.value),
  );
  const passwordMatches = await verifyConfiguredPasswordAsync(password.value);
  return (
    username.inputValid &&
    password.inputValid &&
    usernameMatches &&
    passwordMatches
  );
}

function hmac(payloadSegment: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payloadSegment, "ascii").digest();
}

function encodePayload(payload: AdminSessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeBase64Url(segment: string): Buffer | null {
  if (!segment || !BASE64URL_PATTERN.test(segment)) {
    return null;
  }

  try {
    const decoded = Buffer.from(segment, "base64url");
    return decoded.toString("base64url") === segment ? decoded : null;
  } catch {
    return null;
  }
}

function parsePayload(segment: string): AdminSessionPayload | null {
  const decoded = decodeBase64Url(segment);
  if (!decoded) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(decoded.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const payload = value as Record<string, unknown>;
    const keys = Object.keys(payload).sort();
    if (keys.join(",") !== "exp,iat,nonce,sub,v") {
      return null;
    }

    if (
      payload.v !== ADMIN_SESSION_VERSION ||
      payload.sub !== ADMIN_SESSION_SUBJECT ||
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp) ||
      typeof payload.nonce !== "string"
    ) {
      return null;
    }

    const nonce = decodeBase64Url(payload.nonce);
    if (!nonce || nonce.byteLength !== NONCE_BYTES) {
      return null;
    }

    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}

function signatureMatches(
  payloadSegment: string,
  signatureSegment: string,
  secret: string,
): boolean {
  const expected = hmac(payloadSegment, secret);
  const supplied = decodeBase64Url(signatureSegment);
  const hasExpectedLength = supplied?.byteLength === expected.byteLength;
  const comparable = hasExpectedLength
    ? supplied
    : Buffer.alloc(expected.length);

  return timingSafeEqual(expected, comparable) && hasExpectedLength;
}

/** Issues a short-lived, signed token. The token contains no credential. */
export function issueAdminSessionToken(now = Date.now()): string {
  if (!Number.isFinite(now)) {
    throw new TypeError("A valid session clock is required.");
  }

  const issuedAt = Math.floor(now / 1_000);
  const payloadSegment = encodePayload({
    v: ADMIN_SESSION_VERSION,
    sub: ADMIN_SESSION_SUBJECT,
    iat: issuedAt,
    exp: issuedAt + ADMIN_SESSION_TTL_SECONDS,
    nonce: randomBytes(NONCE_BYTES).toString("base64url"),
  });
  const signatureSegment = hmac(payloadSegment, adminSessionSecret()).toString(
    "base64url",
  );

  return `${payloadSegment}.${signatureSegment}`;
}

/** Returns null for every malformed, tampered, future, or expired token. */
export function verifyAdminSessionToken(
  token: unknown,
  now = Date.now(),
): AdminSession | null {
  const secret = adminSessionSecret();
  if (
    typeof token !== "string" ||
    !Number.isFinite(now) ||
    utf8ByteLength(token) > MAX_SESSION_TOKEN_BYTES
  ) {
    return null;
  }

  const segments = token.split(".");
  if (segments.length !== 2) {
    return null;
  }

  const [payloadSegment, signatureSegment] = segments;
  if (!signatureMatches(payloadSegment, signatureSegment, secret)) {
    return null;
  }

  const payload = parsePayload(payloadSegment);
  if (!payload) {
    return null;
  }

  const currentTime = Math.floor(now / 1_000);
  if (
    payload.iat > currentTime + CLOCK_SKEW_SECONDS ||
    payload.exp <= currentTime ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > ADMIN_SESSION_TTL_SECONDS
  ) {
    return null;
  }

  return Object.freeze({
    subject: ADMIN_SESSION_SUBJECT,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  });
}

function adminCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires,
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    priority: "high" as const,
  };
}

/** Verifies the credential and creates the admin cookie on success. */
export async function loginAdmin(
  candidateUsername: unknown,
  candidatePassword: unknown,
): Promise<boolean> {
  await requireSameOrigin();

  if (
    !(await verifyAdminCredentialsAsync(candidateUsername, candidatePassword))
  ) {
    return false;
  }

  const token = issueAdminSessionToken();
  const session = verifyAdminSessionToken(token);
  if (!session) {
    throw new AdminSecurityConfigurationError();
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ADMIN_SESSION_COOKIE,
    token,
    adminCookieOptions(new Date(session.expiresAt * 1_000)),
  );

  return true;
}

/** Expires the cookie with the same attributes used when it was created. */
export async function logoutAdmin(): Promise<void> {
  await requireSameOrigin();

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    ...adminCookieOptions(new Date(0)),
    maxAge: 0,
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new AdminAuthenticationRequiredError();
  }

  return session;
}

function firstForwardedValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const first = value.split(",", 1)[0]?.trim();
  return first || null;
}

function requestOrigin(requestHeaders: HeaderReader): URL | null {
  const rawOrigin = requestHeaders.get("origin")?.trim();
  if (!rawOrigin || rawOrigin === "null") {
    return null;
  }

  try {
    const origin = new URL(rawOrigin);
    if (
      (origin.protocol !== "https:" && origin.protocol !== "http:") ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) {
      return null;
    }

    return origin;
  } catch {
    return null;
  }
}

function targetOrigin(requestHeaders: HeaderReader): URL | null {
  const rawForwardedHost = requestHeaders.get("x-forwarded-host");
  const host =
    rawForwardedHost === null
      ? (requestHeaders.get("host")?.trim() ?? null)
      : firstForwardedValue(rawForwardedHost);
  const rawForwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    rawForwardedProtocol === null
      ? process.env.NODE_ENV === "production"
        ? "https"
        : "http"
      : firstForwardedValue(rawForwardedProtocol)?.toLowerCase();

  if (
    !host ||
    (protocol !== "https" && protocol !== "http") ||
    /[\s\\/,@?#]/.test(host)
  ) {
    return null;
  }

  try {
    const target = new URL(`${protocol}://${host}`);
    return target.pathname === "/" && !target.search && !target.hash
      ? target
      : null;
  } catch {
    return null;
  }
}

export function isSameOriginAdminRequest(
  requestHeaders: HeaderReader,
): boolean {
  const source = requestOrigin(requestHeaders);
  const target = targetOrigin(requestHeaders);

  return source !== null && target !== null && source.origin === target.origin;
}

/** Fails closed when Origin, host, protocol, or their exact match is missing. */
export async function requireSameOrigin(): Promise<void> {
  if (!isSameOriginAdminRequest(await headers())) {
    throw new AdminInvalidOriginError();
  }
}

/** Use at the start of every cookie-authenticated administrator mutation. */
export async function requireAdminMutation(): Promise<AdminSession> {
  await requireSameOrigin();
  return requireAdmin();
}

function sanitizeRequestId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 128);

  return sanitized || null;
}

/**
 * Provides correlation metadata without retaining IP addresses, cookies,
 * origins, credentials, query strings, or arbitrary client-supplied fields.
 */
export async function getAdminAuditMetadata(): Promise<AdminAuditMetadata> {
  const requestHeaders = await headers();
  return Object.freeze({
    requestId: sanitizeRequestId(requestHeaders.get("x-vercel-id")),
  });
}
