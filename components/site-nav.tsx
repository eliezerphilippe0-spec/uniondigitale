import Link from "next/link";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50">
      <div className="mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-2xl glass px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-gold to-violet text-sm font-black text-ink">
            Z
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Zabelie <span className="text-mist">Talent</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-mist md:flex">
          <Link href="/catalogue" className="transition hover:text-cloud">
            Catalogue
          </Link>
          <Link href="/#talents" className="transition hover:text-cloud">
            Talents
          </Link>
          <Link href="/#comment" className="transition hover:text-cloud">
            Comment ça marche
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/connexion"
            className="hidden text-sm text-mist transition hover:text-cloud sm:block"
          >
            Connexion
          </Link>
          <Link
            href="/vendre"
            className="rounded-xl bg-cloud px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Vendre
          </Link>
        </div>
      </div>
    </header>
  );
}
