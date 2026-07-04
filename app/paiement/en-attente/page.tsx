import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paiement en attente — Zabelie Digi" };

export default async function EnAttentePage() {
  const lang = await getLang();
  return (
    <div className="bg-grain min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-warning text-2xl text-ink">
          ⏳
        </span>
        <h1 className="mt-6 text-2xl font-black">{t(lang, "pay.wait.title")}</h1>
        <p className="mt-3 text-mist">
          {t(lang, "pay.wait.body")}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/mes-achats"
            className="rounded-xl border border-line bg-surface/60 px-6 py-3 text-sm font-semibold text-cloud"
          >
            {t(lang, "pay.wait.cta")}
          </Link>
          <Link href="/catalogue" className="text-sm text-mist hover:text-cloud">
            {t(lang, "pay.back")}
          </Link>
        </div>
      </main>
    </div>
  );
}
