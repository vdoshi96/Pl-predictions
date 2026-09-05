import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { getAdminSession } from "@/features/admin";

import { loginAction } from "./actions";
import { LoginSubmitButton } from "./login-submit-button";

export const metadata: Metadata = { title: "Admin sign in" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getAdminSession()) redirect("/admin");

  const params = await searchParams;
  const invalid = params.error === "invalid";

  return (
    <main
      id="main-content"
      className="page-shell flex w-full flex-1 items-center justify-center py-10 sm:py-16"
    >
      <Card className="panel-shadow w-full max-w-md overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <span className="bg-mint text-mint-ink grid size-12 place-items-center rounded-2xl">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </span>
          <h1 className="text-foreground mt-2 text-3xl font-black tracking-tight">
            Admin sign in
          </h1>
          <p
            className="text-muted mt-3 text-sm leading-6"
            id="admin-login-help"
          >
            Use the owner username and password. The password is verified
            against a server-only digest and is never returned or stored by the
            app.
          </p>

          <form action={loginAction} className="mt-7 grid gap-4">
            <div>
              <label
                className="text-foreground text-sm font-bold"
                htmlFor="username"
              >
                Username
              </label>
              <div className="relative mt-2">
                <UserRound
                  aria-hidden="true"
                  className="text-muted pointer-events-none absolute top-3.5 left-3.5 size-5"
                />
                <input
                  aria-describedby={
                    invalid
                      ? "admin-login-help admin-login-error"
                      : "admin-login-help"
                  }
                  aria-invalid={invalid}
                  autoCapitalize="none"
                  autoComplete="username"
                  className="border-border bg-surface text-foreground focus:border-accent focus:ring-accent/30 min-h-12 w-full rounded-xl border pr-3.5 pl-11 text-base outline-none focus:ring-2"
                  id="username"
                  maxLength={64}
                  name="username"
                  required
                  spellCheck={false}
                  type="text"
                />
              </div>
            </div>

            <div>
              <label
                className="text-foreground text-sm font-bold"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative mt-2">
                <KeyRound
                  aria-hidden="true"
                  className="text-muted pointer-events-none absolute top-3.5 left-3.5 size-5"
                />
                <input
                  aria-describedby={
                    invalid
                      ? "admin-login-help admin-login-error"
                      : "admin-login-help"
                  }
                  aria-invalid={invalid}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  className="border-border bg-surface text-foreground focus:border-accent focus:ring-accent/30 min-h-12 w-full rounded-xl border pr-3.5 pl-11 text-base outline-none focus:ring-2"
                  enterKeyHint="go"
                  id="password"
                  maxLength={4096}
                  name="password"
                  required
                  spellCheck={false}
                  type="password"
                />
              </div>
            </div>

            {invalid ? (
              <p
                className="border-danger/35 bg-danger-soft text-danger rounded-xl border p-3 text-sm font-semibold"
                id="admin-login-error"
                role="alert"
              >
                That username or password was not accepted.
              </p>
            ) : null}

            <LoginSubmitButton />
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
