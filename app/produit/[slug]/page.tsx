import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { PRODUCTS, getProduct, formatHTG } from "@/lib/sample-data";
import { BuyButton } from "@/components/buy-button";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

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

          <div className="mt-4 flex items-center gap-4 text-sm text-mist">
            <span>par {product.creator}</span>
            <span>★ {product.rating}</span>
            <span>{product.sales} ventes</span>
          </div>

          <div className="mt-8 rounded-2xl border border-line bg-surface/60 p-6">
            <p className="text-3xl font-black text-gradient">
              {formatHTG(product.priceHTG)}
            </p>
            <div className="mt-5">
              <BuyButton
                productId={product.slug}
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
            <li>✓ Support du créateur</li>
          </ul>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
