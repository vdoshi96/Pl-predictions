export function SiteFooter() {
  return (
    <footer className="border-border bg-brand-soft text-muted mt-auto border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-2 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-xs leading-5 sm:px-6 lg:px-8">
        <p className="text-brand font-bold">
          Dranx Prediction League is an independent, private prediction
          competition. It is not affiliated with or endorsed by the Premier
          League or any club.
        </p>
        <p>
          Club names and marks remain the property of their respective owners.
          Local team identifiers are used until authorized crest assets are
          available; table data appears only after the owner validates and saves
          a complete snapshot.
        </p>
      </div>
    </footer>
  );
}
