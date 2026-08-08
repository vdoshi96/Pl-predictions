"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell flex flex-1 items-center justify-center py-20">
      <section className="panel-shadow border-border bg-surface max-w-lg rounded-3xl border p-8 text-center sm:p-12">
        <p className="text-danger text-sm font-bold tracking-[0.18em] uppercase">
          Something went wrong
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">
          We could not load this view.
        </h1>
        <p className="text-muted mt-4 leading-7">
          Your prediction has not been changed. Try the request again.
        </p>
        <button
          className="bg-brand hover:bg-brand-strong mt-8 min-h-11 rounded-full px-5 font-bold text-white"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
