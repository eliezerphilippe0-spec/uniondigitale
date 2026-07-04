import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { HeroVisual } from "@/components/hero-visual";
import { getPublishedProducts } from "@/lib/products";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, lang] = await Promise.all([
    getPublishedProducts(),
    getLang(),
  ]);

  const steps = [
    { n: "01", title: t(lang, "home.s1.t"), body: t(lang, "home.s1.b") },
    { n: "02", title: t(lang, "home.s2.t"), body: t(lang, "home.s2.b") },
    { n: "03", title: t(lang, "home.s3.t"), body: t(lang, "home.s3.b") },
  ];

  const stats = [
    { value: "100%", label: t(lang, "home.stat1") },
    { value: "MonCash", label: t(lang, "home.stat2") },
    { value: t(lang, "home.stat3.v"), label: t(lang, "home.stat3") },
  ];

  return (
    <div className="bg-grain">
      <SiteNav />

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-1.5 text-xs text-mist">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {t(lang, "home.badge")}
            </span>

            <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              {t(lang, "home.h1.a")}{" "}
              <span className="text-gradient">{t(lang, "home.h1.b")}</span>{" "}
              {t(lang, "home.h1.c")}{" "}
              <span className="text-gradient">{t(lang, "home.h1.d")}</span>.
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base text-mist sm:text-lg lg:mx-0">
              {t(lang, "home.sub")}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/vendre"
                className="w-full rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90 sm:w-auto"
              >
                {t(lang, "home.cta.sell")}
              </Link>
              <Link
                href="/catalogue"
                className="w-full rounded-xl border border-line bg-surface/60 px-6 py-3 text-sm font-semibold text-cloud transition hover:border-violet/50 sm:w-auto"
              >
                {t(lang, "home.cta.browse")}
              </Link>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <HeroVisual />
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-line bg-surface-maroon/60 p-4"
            >
              <p className="metric text-xl font-bold text-gradient sm:text-2xl">
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
              {t(lang, "home.trends")}
            </h2>
            <p className="mt-2 text-sm text-mist">{t(lang, "home.trends.sub")}</p>
          </div>
          <Link
            href="/catalogue"
            className="hidden text-sm text-mist transition hover:text-cloud sm:block"
          >
            {t(lang, "home.all")}
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
          {t(lang, "home.how")}
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {steps.map((step) => (
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
            {t(lang, "home.final.a")}{" "}
            <span className="text-gradient">{t(lang, "home.final.b")}</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-mist">
            {t(lang, "home.final.sub")}
          </p>
          <Link
            href="/vendre"
            className="mt-8 inline-block rounded-xl bg-cloud px-7 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            {t(lang, "home.final.cta")}
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
