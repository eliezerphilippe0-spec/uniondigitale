import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { PRODUCTS } from "@/lib/sample-data";

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

export default function CataloguePage() {
  return (
    <div className="bg-grain min-h-screen">
      <SiteNav />

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-16">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Catalogue
        </h1>
        <p className="mt-2 text-sm text-mist">
          {PRODUCTS.length} produits et talents disponibles.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c, i) => (
            <button
              key={c}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                i === 0
                  ? "border-transparent bg-cloud text-ink"
                  : "border-line text-mist hover:border-violet/50 hover:text-cloud"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
