import type { ReactNode } from "react";

export function PageHeading({
  title,
  description,
  status,
  children,
}: {
  title: string;
  description?: string;
  status?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="text-muted mt-2 max-w-2xl text-sm leading-6">
              {description}
            </p>
          ) : null}
        </div>
        {status}
      </div>
      {children ? (
        <div className="text-muted mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs leading-5">
          {children}
        </div>
      ) : null}
    </header>
  );
}
