import Link from "next/link";
import { formatHTG, type Product } from "@/lib/sample-data";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/produit/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-1 hover:border-violet/50"
    >
      <div
        className={`relative h-40 bg-gradient-to-br ${product.accent} opacity-90`}
      >
        <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-cloud backdrop-blur">
          {product.kind === "service" ? "Service" : "Fichier"}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-cloud backdrop-blur">
          ★ {product.rating}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs text-mist">{product.category}</p>
        <h3 className="text-sm font-semibold leading-snug text-cloud">
          {product.title}
        </h3>
        <p className="line-clamp-2 text-xs text-mist">{product.blurb}</p>

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-xs text-mist">par {product.creator}</span>
          <span className="text-sm font-bold text-gradient">
            {formatHTG(product.priceHTG)}
          </span>
        </div>
      </div>
    </Link>
  );
}
