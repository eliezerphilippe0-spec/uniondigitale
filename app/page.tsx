import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { HeroVisual } from "@/components/hero-visual";
import { getPublishedProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "01",
    title: "Publiez",
    body: "Mettez en ligne un produit digital ou une prestation en quelques minutes.",
  },
  {
    n: "02",
    title: "Encaissez",
    body: "L'acheteur paie via MonCash. Le paiement est confirmé serveur-à-serveur.",
  },
  {
    n: "03",
    title: "Livrez & retirez",
    body: "Livraison automatique du fichier, crédit de votre wallet, retrait de vos gains.",
  },
];

const STATS = [
  { value: "100%", label: "digital & talents" },
  { value: "MonCash", label: "paiement mobile" },
  { value: "Instant", label: "livraison après paiement" },
];

export default async function HomePage() {
  const products = await getPublishedProducts();
  return (
    <div className="bg-grain">
      <SiteNav />

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-1.5 text-xs text-mist">
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
              La marketplace digitale africaine
            </span>

            <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              Vendez vos <span className="text-gradient">produits digitaux</span>{" "}
              et vos <span className="text-gradient">talents</span>.
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base text-mist sm:text-lg lg:mx-0">
              Templates, formations, beats, mentorat… Publiez, encaissez via
              mobile money et livrez instantanément. Pensé pour le contexte
              africain.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/vendre"
                className="w-full rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90 sm:w-auto"
              >
                Commencer à vendre
              </Link>
              <Link
                href="/catalogue"
                className="w-full rounded-xl border border-line bg-surface/60 px-6 py-3 text-sm font-semibold text-cloud transition hover:border-violet/50 sm:w-auto"
              >
                Explorer le catalogue
              </Link>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <HeroVisual />
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-line bg-surface/40 p-4"
            >
              <p className="text-xl font-bold text-gradient sm:text-2xl">
                {s.value}
              </p>
              <p className="mt-1 text-xs text-mist">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CATALOGUE PREVIEW */}
      <section id="talents" className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Tendances du moment
            </h2>
            <p className="mt-2 text-sm text-mist">
              Les produits et talents les plus demandés.
            </p>
          </div>
          <Link
            href="/catalogue"
            className="hidden text-sm text-mist transition hover:text-cloud sm:block"
          >
            Tout voir →
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.slice(0, 6).map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section id="comment" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Comment ça marche
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="rounded-2xl border border-line bg-surface/40 p-6"
            >
              <span className="text-3xl font-black text-gradient">{step.n}</span>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-mist">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="glass glow-ring relative overflow-hidden rounded-3xl px-8 py-14 text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
            Votre talent mérite d'être <span className="text-gradient">payé</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-mist">
            Rejoignez les créateurs qui monétisent leur savoir-faire sur Zabelie
            Talent.
          </p>
          <Link
            href="/vendre"
            className="mt-8 inline-block rounded-xl bg-cloud px-7 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Créer ma boutique
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
