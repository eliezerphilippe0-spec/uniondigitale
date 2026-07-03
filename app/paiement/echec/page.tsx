import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export const metadata = { title: "Paiement échoué — Zabelie Digi" };

export default async function EchecPage({
  searchParams,
}: {
  searchParams: Promise<{ raison?: string }>;
}) {
  const { raison } = await searchParams;
  return (
    <div className="bg-grain min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-magenta text-2xl text-cloud">
          ✕
        </span>
        <h1 className="mt-6 text-2xl font-black">Paiement non confirmé</h1>
        <p className="mt-3 text-mist">
          Le paiement n'a pas pu être validé. Aucun produit n'a été livré. Vous
          pouvez réessayer en toute sécurité.
        </p>
        {raison && <p className="mt-2 text-xs text-mist">Code : {raison}</p>}
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/catalogue"
            className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink"
          >
            Retour au catalogue
          </Link>
        </div>
      </main>
    </div>
  );
}
