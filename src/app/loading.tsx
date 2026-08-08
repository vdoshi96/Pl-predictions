export default function Loading() {
  return (
    <main className="page-shell flex flex-1 items-center justify-center py-20">
      <div className="border-border bg-surface w-full max-w-xl animate-pulse rounded-3xl border p-8">
        <div className="bg-surface-subtle h-4 w-24 rounded" />
        <div className="bg-surface-subtle mt-5 h-10 w-3/4 rounded" />
        <div className="bg-surface-subtle mt-4 h-4 w-full rounded" />
        <div className="mt-10 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="bg-surface-subtle h-16 rounded-2xl" key={index} />
          ))}
        </div>
        <span className="sr-only">Loading Dranx Prediction League</span>
      </div>
    </main>
  );
}
