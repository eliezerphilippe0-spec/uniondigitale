import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export const metadata = { title: "Paiement réussi — Zabelie Digi" };

export default async function SuccesPage({
  searchParams,
}: {
  searchParams: Promise<{ commande?: string }>;
}) {
  const { commande } = await searchParams;
  return (
    <div className="bg-grain min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal text-2xl text-ink">
          ✓
        </span>
        <h1 className="mt-6 text-2xl font-black">Paiement confirmé</h1>
        <p className="mt-3 text-mist">
          Merci ! Votre achat est validé. Votre fichier est disponible dans vos
          téléchargements.
        </p>
        {commande && (
          <p className="mt-2 text-xs text-mist">
            Commande #{commande.slice(0, 8)}
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/mes-achats"
            className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink"
          >
            Voir mes achats
          </Link>
          <Link href="/catalogue" className="text-sm text-mist hover:text-cloud">
            Retour au catalogue
          </Link>
        </div>
      </main>
    </div>
  );
}
