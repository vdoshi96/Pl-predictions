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
    <main className="page-shell flex w-full flex-1 items-center justify-center py-10 sm:py-16">
      <Card className="panel-shadow w-full max-w-md overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-5 text-xs font-black tracking-[0.16em] text-emerald-700 uppercase">
            Owner access
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Admin sign in
          </h1>
          <p
            className="mt-3 text-sm leading-6 text-slate-600"
            id="admin-login-help"
          >
            Use the owner username and password. The password is verified
            against a server-only digest and is never returned or stored by the
            app.
          </p>

          <form action={loginAction} className="mt-7 grid gap-4">
            <div>
              <label
                className="text-sm font-bold text-slate-800"
                htmlFor="username"
              >
                Username
              </label>
              <div className="relative mt-2">
                <UserRound
                  aria-hidden="true"
                  className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-slate-400"
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
                  className="min-h-12 w-full rounded-xl border border-slate-300 bg-white pr-3.5 pl-11 text-base text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                className="text-sm font-bold text-slate-800"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative mt-2">
                <KeyRound
                  aria-hidden="true"
                  className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-slate-400"
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
                  className="min-h-12 w-full rounded-xl border border-slate-300 bg-white pr-3.5 pl-11 text-base text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"
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
