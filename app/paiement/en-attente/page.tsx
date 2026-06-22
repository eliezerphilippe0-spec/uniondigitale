import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paiement en attente — Zabelie Talent" };

export default function EnAttentePage() {
  return (
    <div className="bg-grain min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold text-2xl text-ink">
          ⏳
        </span>
        <h1 className="mt-6 text-2xl font-black">Paiement en cours de vérification</h1>
        <p className="mt-3 text-mist">
          Nous confirmons votre paiement auprès de MonCash. Si le montant a été
          débité, votre achat sera validé automatiquement d'ici quelques
          instants — même si cette page a été interrompue.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/mes-achats"
            className="rounded-xl border border-line bg-surface/60 px-6 py-3 text-sm font-semibold text-cloud"
          >
            Vérifier mes achats
          </Link>
          <Link href="/catalogue" className="text-sm text-mist hover:text-cloud">
            Retour au catalogue
          </Link>
        </div>
      </main>
    </div>
  );
}
