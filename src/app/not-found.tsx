import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell flex flex-1 items-center justify-center py-20">
      <section className="panel-shadow border-border bg-surface max-w-lg rounded-3xl border p-8 text-center sm:p-12">
        <p className="text-brand-ink text-sm font-bold tracking-[0.18em] uppercase">
          404
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">
          That page is offside.
        </h1>
        <p className="text-muted mt-4 leading-7">
          The prediction may still be private, or the address is no longer
          available.
        </p>
        <Link
          className="bg-brand hover:bg-brand-strong mt-8 inline-flex min-h-11 items-center justify-center rounded-full px-5 font-bold text-white"
          href="/"
        >
          Back to predictions
        </Link>
      </section>
    </main>
  );
}
