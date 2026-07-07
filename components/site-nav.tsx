import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentUser } from "@/lib/auth";

export async function SiteNav() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50">
      <div className="mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-2xl glass px-5 py-3">
        <BrandLogo />

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
          <Link href="/tableau-de-bord" aria-label="Tableau de bord">
            <img
              src="/images/philippe-avatar.jpg"
              alt="Philippe"
              className="h-9 w-9 rounded-full object-cover"
              style={{ border: "2px solid #FF6B00" }}
            />
          </Link>
          {user ? (
            <>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="hidden text-sm text-mist transition hover:text-cloud sm:block"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/tableau-de-bord"
                className="hidden text-sm text-mist transition hover:text-cloud sm:block"
              >
                Tableau de bord
              </Link>
              <SignOutButton className="hidden text-sm text-mist transition hover:text-cloud sm:block" />
              <Link
                href="/vendre"
                className="rounded-xl bg-cloud px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
              >
                Vendre
              </Link>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </header>
  );
}
