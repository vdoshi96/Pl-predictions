export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50 text-slate-600">
      <div className="mx-auto grid w-full max-w-6xl gap-2 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-xs leading-5 sm:px-6 lg:px-8">
        <p className="font-semibold text-slate-700">
          An unofficial fan project for a private group of friends. Not
          affiliated with or endorsed by the Premier League or any club.
        </p>
        <p>
          Club names and any permitted marks remain the property of their
          respective owners. This launch uses independent text monograms; table
          data appears only after the owner validates and saves a complete
          snapshot.
        </p>
      </div>
    </footer>
  );
}
