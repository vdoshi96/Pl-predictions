import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { isLocalHttpE2EEnvironment } from "@/shared/runtime-environment";

function contentSecurityPolicy(nonce: string): string {
  const developmentScriptPolicy =
    process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
  const upgradePolicy =
    process.env.NODE_ENV === "production" &&
    !isLocalHttpE2EEnvironment(process.env)
      ? "; upgrade-insecure-requests"
      : "";

  return (
    [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "object-src 'none'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentScriptPolicy}`,
      "style-src 'self' 'unsafe-inline'",
    ].join("; ") + upgradePolicy
  );
}

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", policy);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
