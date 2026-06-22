import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { getPublishedProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catalogue — Zabelie Talent",
};

const CATEGORIES = [
  "Tout",
  "Photo",
  "Business",
  "Musique",
  "Design",
  "Carrière",
  "Marketing",
];

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { q, cat } = await searchParams;
  const activeCat = cat ?? "Tout";
  const products = await getPublishedProducts({ q, category: activeCat });

  const catHref = (c: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (c !== "Tout") params.set("cat", c);
    const qs = params.toString();
    return qs ? `/catalogue?${qs}` : "/catalogue";
  };

  return (
    <div className="bg-grain min-h-screen">
      <SiteNav />

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-16">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Catalogue
        </h1>
        <p className="mt-2 text-sm text-mist">
          {products.length} résultat{products.length > 1 ? "s" : ""}
          {q ? ` pour « ${q} »` : ""}
          {activeCat !== "Tout" ? ` · ${activeCat}` : ""}.
        </p>

        {/* Recherche (GET, fonctionne sans JS) */}
        <form action="/catalogue" className="mt-6 flex gap-2">
          {activeCat !== "Tout" && (
            <input type="hidden" name="cat" value={activeCat} />
          )}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher un produit, un talent…"
            className="flex-1 rounded-xl border border-line bg-ink/40 px-4 py-3 text-sm outline-none focus:border-violet"
          />
          <button
            type="submit"
            className="rounded-xl bg-cloud px-5 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Rechercher
          </button>
        </form>

        {/* Filtres catégories */}
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={catHref(c)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                c === activeCat
                  ? "border-transparent bg-cloud text-ink"
                  : "border-line text-mist hover:border-violet/50 hover:text-cloud"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface/40 p-10 text-center text-sm text-mist">
            Aucun résultat.{" "}
            <Link href="/catalogue" className="text-cloud underline">
              Réinitialiser
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
