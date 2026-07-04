import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { formatHTG } from "@/lib/sample-data";
import { getProductView } from "@/lib/products";
import { getProductReviews } from "@/lib/reviews";
import { BuyButton } from "@/components/buy-button";
import { ShareButtons } from "@/components/share-buttons";

export const dynamic = "force-dynamic";

function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} sur 5`} className="text-accent">
      {"★".repeat(Math.round(value))}
      <span className="text-mist/40">{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductView(slug);
  if (!product) notFound();

  const reviews = product.creatorId
    ? await getProductReviews(product.id)
    : [];

  return (
    <div className="bg-grain min-h-screen">
      <SiteNav />

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-12 lg:grid-cols-2">
        {/* Visuel */}
        <div>
          <div
            className={`aspect-[4/3] w-full rounded-3xl bg-gradient-to-br ${product.accent}`}
          />
          <div className="mt-4 flex gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-16 flex-1 rounded-xl bg-gradient-to-br ${product.accent} opacity-50`}
              />
            ))}
          </div>
        </div>

        {/* Infos + achat */}
        <div className="flex flex-col">
          <Link
            href="/catalogue"
            className="text-sm text-mist hover:text-cloud"
          >
            ← Retour au catalogue
          </Link>

          <div className="mt-4 flex items-center gap-2">
            <span className="rounded-full border border-line px-3 py-1 text-xs text-mist">
              {product.kind === "service" ? "Service" : "Fichier digital"}
            </span>
            <span className="rounded-full border border-line px-3 py-1 text-xs text-mist">
              {product.category}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight">
            {product.title}
          </h1>
          <p className="mt-3 text-mist">{product.blurb}</p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-mist">
            {product.creatorId ? (
              <Link
                href={`/createur/${product.creatorId}`}
                className="hover:text-cloud"
              >
                par {product.creator}
              </Link>
            ) : (
              <span>par {product.creator}</span>
            )}
            {product.ratingAvg !== null && (
              <span>
                <Stars value={product.ratingAvg} /> {product.ratingAvg} (
                {product.ratingCount} avis vérifié
                {product.ratingCount > 1 ? "s" : ""})
              </span>
            )}
            {product.sales > 0 && <span>{product.sales} ventes</span>}
          </div>

          <div className="mt-8 rounded-2xl border border-line bg-surface/60 p-6">
            <p className="numeric text-3xl font-black text-gradient">
              {formatHTG(product.priceHTG)}
            </p>
            <div className="mt-5">
              <BuyButton
                productId={product.id}
                priceLabel={formatHTG(product.priceHTG)}
              />
            </div>
            <p className="mt-3 text-center text-xs text-mist">
              Livraison instantanée après confirmation du paiement.
            </p>
          </div>

          <ul className="mt-6 space-y-2 text-sm text-mist">
            <li>✓ Paiement sécurisé, confirmé serveur-à-serveur</li>
            <li>
              ✓{" "}
              {product.kind === "service"
                ? "Mise en relation après paiement"
                : "Téléchargement immédiat du fichier"}
            </li>
            <li>✓ Avis réservés aux acheteurs vérifiés</li>
          </ul>

          <div className="mt-6">
            <ShareButtons
              path={`/produit/${product.slug}`}
              text={`${product.title} — ${formatHTG(product.priceHTG)} sur Zabelie Digi :`}
            />
          </div>
        </div>
      </section>

      {/* Avis vérifiés */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-16">
          <h2 className="text-lg font-semibold">
            Avis vérifiés ({reviews.length})
          </h2>
          <p className="mt-1 text-xs text-mist">
            Seuls les acheteurs ayant payé peuvent laisser un avis.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-line bg-surface/60 p-4"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{r.buyerName}</span>
                  <Stars value={r.rating} />
                </div>
                {r.comment && (
                  <p className="mt-2 text-sm text-mist">{r.comment}</p>
                )}
                <p className="mt-2 text-xs text-mist/70">
                  {new Date(r.createdAt).toLocaleDateString("fr-HT")} · Achat
                  vérifié ✓
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}
