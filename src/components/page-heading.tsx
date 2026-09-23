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
    <header className="page-heading min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-8 font-bold tracking-tight break-words sm:text-4xl sm:leading-10">
            {title}
          </h1>
          {description ? (
            <p className="text-muted mt-1.5 max-w-2xl text-sm leading-6 sm:mt-2">
              {description}
            </p>
          ) : null}
        </div>
        {status}
      </div>
      {children ? (
        <div className="text-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-5">
          {children}
        </div>
      ) : null}
    </header>
  );
}
