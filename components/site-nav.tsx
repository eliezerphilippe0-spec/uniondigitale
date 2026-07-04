import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { LangToggle } from "@/components/lang-toggle";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export async function SiteNav() {
  const [user, lang] = await Promise.all([getCurrentUser(), getLang()]);

  return (
    <header className="sticky top-0 z-50">
      <div className="mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-2xl glass px-5 py-3">
        <BrandLogo />

        <nav className="hidden items-center gap-7 text-sm text-mist md:flex">
          <Link href="/catalogue" className="transition hover:text-cloud">
            {t(lang, "nav.catalog")}
          </Link>
          <Link href="/#talents" className="transition hover:text-cloud">
            {t(lang, "nav.talents")}
          </Link>
          <Link href="/#comment" className="transition hover:text-cloud">
            {t(lang, "nav.how")}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LangToggle current={lang} />
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
                {t(lang, "nav.dashboard")}
              </Link>
              <SignOutButton className="hidden text-sm text-mist transition hover:text-cloud sm:block" />
              <Link
                href="/vendre"
                className="rounded-xl bg-cloud px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
              >
                {t(lang, "nav.sell")}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/connexion"
                className="hidden text-sm text-mist transition hover:text-cloud sm:block"
              >
                {t(lang, "nav.login")}
              </Link>
              <Link
                href="/vendre"
                className="rounded-xl bg-cloud px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
              >
                {t(lang, "nav.sell")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
