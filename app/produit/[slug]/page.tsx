import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { formatHTG } from "@/lib/sample-data";
import { getProductView } from "@/lib/products";
import { getProductReviews } from "@/lib/reviews";
import { BuyButton, type BuyOption } from "@/components/buy-button";
import { isStripeEnabled } from "@/lib/stripe";
import { isZelleEnabled } from "@/lib/zelle";
import { usdCentsFromHtg, formatUsd } from "@/lib/payment-utils";
import { ShareButtons } from "@/components/share-buttons";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * Rails proposés, construits côté serveur : MonCash toujours, puis les rails
 * diaspora USD si configurés (Stripe/Zelle + USD_HTG_RATE). Le prix USD affiché
 * est indicatif — la vérité reste figée au checkout puis vérifiée en base.
 */
function buildBuyOptions(lang: "fr" | "ht", priceHTG: number): BuyOption[] {
  const options: BuyOption[] = [
    { rail: "moncash", label: t(lang, "product.pay", { price: formatHTG(priceHTG) }) },
  ];
  const rate = Number(process.env.USD_HTG_RATE);
  if (Number.isFinite(rate) && rate > 0) {
    const usd = formatUsd(usdCentsFromHtg(priceHTG, rate));
    if (isStripeEnabled()) {
      options.push({ rail: "stripe", label: t(lang, "product.pay.stripe", { usd }) });
    }
    if (isZelleEnabled()) {
      options.push({ rail: "zelle", label: t(lang, "product.pay.zelle", { usd }) });
    }
  }
  return options;
}

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
  const [product, lang] = await Promise.all([getProductView(slug), getLang()]);
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
            {t(lang, "product.back")}
          </Link>

          <div className="mt-4 flex items-center gap-2">
            <span className="rounded-full border border-line px-3 py-1 text-xs text-mist">
              {product.kind === "service" ? t(lang, "product.kind.service") : t(lang, "product.kind.file")}
            </span>
            <span className="rounded-full border border-line px-3 py-1 text-xs text-mist">
              {product.category}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">
            {product.title}
          </h1>
          <p className="mt-3 text-mist">{product.blurb}</p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-mist">
            {product.creatorId ? (
              <Link
                href={`/createur/${product.creatorId}`}
                className="hover:text-cloud"
              >
                {t(lang, "product.by")} {product.creator}
              </Link>
            ) : (
              <span>{t(lang, "product.by")} {product.creator}</span>
            )}
            {product.ratingAvg !== null && (
              <span>
                <Stars value={product.ratingAvg} /> {product.ratingAvg} (
                {product.ratingCount} {t(lang, "product.reviews.badge")})
              </span>
            )}
            {product.sales > 0 && (
              <span>
                {product.sales} {t(lang, "product.sales")}
              </span>
            )}
          </div>

          <div id="acheter" className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-surface/60 p-6">
            <p className="numeric text-3xl font-extrabold text-gradient">
              {formatHTG(product.priceHTG)}
            </p>
            {/* Preuve sociale À CÔTÉ du prix : c'est là que l'hésitation se joue. */}
            {(product.ratingAvg !== null || product.sales > 0) && (
              <p className="mt-1 text-xs text-mist">
                {product.ratingAvg !== null && (
                  <>
                    <span className="text-accent">★</span> {product.ratingAvg} (
                    {product.ratingCount} {t(lang, "product.reviews.badge")})
                  </>
                )}
                {product.ratingAvg !== null && product.sales > 0 && " · "}
                {product.sales > 0 && (
                  <>
                    {product.sales} {t(lang, "product.sales")}
                  </>
                )}
              </p>
            )}
            <div className="mt-5">
              <BuyButton
                productId={product.id}
                options={buildBuyOptions(lang, product.priceHTG)}
                othersLabel={t(lang, "pay.other")}
                loadingLabel={t(lang, "pay.redirect")}
              />
            </div>
            <p className="mt-3 text-center text-xs text-mist">
              {t(lang, "product.delivery")}
            </p>
          </div>

          <ul className="mt-6 space-y-2 text-sm text-mist">
            <li>{t(lang, "product.secure")}</li>
            <li>
              {product.kind === "service"
                ? t(lang, "product.service")
                : t(lang, "product.file")}
            </li>
            <li>{t(lang, "product.verifiedOnly")}</li>
          </ul>

          <div className="mt-6">
            <ShareButtons
              path={`/produit/${product.slug}`}
              text={`${product.title} — ${formatHTG(product.priceHTG)} ${t(lang, "product.share")}`}
              waLabel={t(lang, "share.wa")}
              copyLabel={t(lang, "share.copy")}
              copiedLabel={t(lang, "share.copied")}
            />
          </div>
        </div>
      </section>

      {/* Avis vérifiés */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-16">
          <h2 className="text-lg font-semibold">
            {t(lang, "product.reviews")} ({reviews.length})
          </h2>
          <p className="mt-1 text-xs text-mist">
            {t(lang, "product.reviews.note")}
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
                  {new Date(r.createdAt).toLocaleDateString("fr-HT")} ·{" "}
                  {t(lang, "product.verified")}
                </p>
              </li>
            ))}
          </ul>

          {/* CTA bas de page (règle Gumroad) : le lecteur convaincu par les
              avis ne doit pas remonter chercher le bouton. Ancre, pas un
              second checkout — un seul point d'achat, zéro état dupliqué. */}
          <div className="mt-8 text-center">
            <a
              href="#acheter"
              className="inline-block rounded-xl bg-brand px-8 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
            >
              {t(lang, "product.cta.bottom", { price: formatHTG(product.priceHTG) })}
            </a>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}
