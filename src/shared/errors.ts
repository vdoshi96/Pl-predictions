export type ErrorCode =
  | "BAD_REQUEST"
  | "CONFLICT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "SUBMISSIONS_CLOSED"
  | "UNAUTHORIZED";

export class PublicError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "PublicError";
    this.code = code;
  }
}

export function safeErrorMessage(error: unknown) {
  return error instanceof PublicError
    ? error.message
    : "Something went wrong. No changes were made.";
}
