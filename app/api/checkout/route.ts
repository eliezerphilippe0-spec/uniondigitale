import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPayment } from "@/lib/moncash";
import { createStripeCheckout, isStripeEnabled } from "@/lib/stripe";
import { isZelleEnabled } from "@/lib/zelle";
import { withinRailCap, railCap, usdCentsFromHtg } from "@/lib/payment-utils";
import {
  normalizeCouponCode,
  couponApplies,
  discountedPriceHtg,
  type CouponRow,
} from "@/lib/zabelie-coupons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/checkout  { productId, rail? }
 * rail ∈ 'moncash' (défaut) | 'stripe' | 'zelle' (rails diaspora, V-10).
 * Crée une commande + un paiement (pending, clé d'idempotence) puis renvoie
 * l'URL de redirection du rail. Aucune livraison/crédit ici : tout passe par la
 * confirmation serveur-à-serveur (return/webhook/réconciliateur/admin →
 * confirm_payment). Le LEDGER reste en HTG ; pour les rails USD, le montant
 * est figé ici (expected_usd_cents) et vérifié en base à la confirmation.
 */

const RAILS = ["moncash", "stripe", "zelle"] as const;
type Rail = (typeof RAILS)[number];

function railEnabled(rail: Rail): boolean {
  if (rail === "stripe") return isStripeEnabled();
  if (rail === "zelle") return isZelleEnabled();
  return true; // moncash = rail MVP, toujours proposé
}

export async function POST(req: Request) {
  let productId: string | undefined;
  let railInput: unknown;
  let couponInput: unknown;
  try {
    ({ productId, rail: railInput, couponCode: couponInput } = await req.json());
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!productId) {
    return NextResponse.json({ error: "productId requis" }, { status: 400 });
  }

  const rail: Rail = (RAILS as readonly string[]).includes(String(railInput ?? "moncash"))
    ? ((railInput ?? "moncash") as Rail)
    : "moncash";
  if (!railEnabled(rail)) {
    return NextResponse.json(
      { error: "Ce moyen de paiement n'est pas disponible." },
      { status: 422 }
    );
  }

  // Acheteur authentifié.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Produit publié uniquement, prix = source de vérité serveur.
  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("id, title, price_htg, status, seller_id")
    .eq("id", productId)
    .eq("status", "published")
    .single();

  if (prodErr || !product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  // Code promo (optionnel) : validation + consommation ATOMIQUE côté serveur.
  // L'acheteur qui saisit un code attend la remise — un code invalide est un
  // refus clair (422), jamais une facturation au prix plein en silence.
  let finalPriceHtg = product.price_htg;
  let couponCode: string | null = null;
  let discountHtg = 0;
  if (typeof couponInput === "string" && couponInput.trim()) {
    const code = normalizeCouponCode(couponInput);
    const rejected = () =>
      NextResponse.json({ error: "Code promo invalide ou expiré." }, { status: 422 });
    if (!code) return rejected();

    const { data: coupon } = await admin
      .from("zabelie_coupons")
      .select("id, seller_id, product_id, percent, max_uses, uses, expires_at, active")
      .eq("seller_id", product.seller_id)
      .eq("code", code)
      .maybeSingle();
    if (!coupon || !couponApplies(coupon as CouponRow, product.id, product.seller_id)) {
      return rejected();
    }
    // Réserve une utilisation (atomique : plafond revérifié en base).
    const { data: consumed } = await admin.rpc("zabelie_coupon_consume", {
      p_coupon_id: coupon.id,
    });
    if (!consumed) return rejected();

    finalPriceHtg = discountedPriceHtg(product.price_htg, coupon.percent);
    discountHtg = product.price_htg - finalPriceHtg;
    couponCode = code;
  }

  // Plafond du rail : on bloque AVANT de créer la commande (message clair plutôt
  // qu'un échec brutal côté opérateur). Pas de plafond connu pour Stripe/Zelle.
  if (!withinRailCap(finalPriceHtg, rail)) {
    return NextResponse.json(
      {
        error: `Montant supérieur au plafond MonCash (${railCap(rail)} HTG) par transaction.`,
      },
      { status: 422 }
    );
  }

  // Rails USD : montant figé MAINTENANT (garde-fou vérifié en base ensuite).
  let expectedUsdCents: number | null = null;
  if (rail === "stripe" || rail === "zelle") {
    const rate = Number(process.env.USD_HTG_RATE);
    try {
      expectedUsdCents = usdCentsFromHtg(finalPriceHtg, rate);
    } catch {
      return NextResponse.json(
        { error: "Taux USD non configuré (USD_HTG_RATE)." },
        { status: 422 }
      );
    }
  }

  // Commande (pending).
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      buyer_id: user.id,
      product_id: product.id,
      amount_htg: finalPriceHtg, // prix remisé figé — tous les garde-fous s'y appliquent
      coupon_code: couponCode,
      discount_htg: discountHtg,
      status: "pending",
    })
    .select("id, amount_htg")
    .single();

  if (orderErr || !order) {
    return NextResponse.json(
      { error: "Création commande échouée" },
      { status: 500 }
    );
  }

  // Paiement (pending). idempotency_key = order.id (1 paiement/commande).
  const { error: payErr } = await admin.from("payments").insert({
    order_id: order.id,
    rail,
    idempotency_key: order.id,
    status: "pending",
    expected_usd_cents: expectedUsdCents,
  });
  if (payErr) {
    return NextResponse.json(
      { error: "Création paiement échouée" },
      { status: 500 }
    );
  }

  try {
    if (rail === "stripe") {
      // Session Stripe Checkout ; confirmation via webhook signé uniquement.
      const { redirectUrl, sessionId } = await createStripeCheckout({
        orderId: order.id,
        usdCents: expectedUsdCents as number,
        productTitle: product.title,
      });
      await admin
        .from("payments")
        .update({ raw: { stripe_session_id: sessionId } })
        .eq("order_id", order.id);
      return NextResponse.json({ redirectUrl, orderId: order.id });
    }

    if (rail === "zelle") {
      // Pas d'API Zelle : page d'instructions (mémo + montant), confirmation
      // administrative ensuite — même confirm_payment idempotent.
      return NextResponse.json({
        redirectUrl: `/paiement/zelle/${order.id}`,
        orderId: order.id,
      });
    }

    // MonCash. orderId envoyé = notre order.id (clé de rapprochement).
    const { redirectUrl, paymentToken } = await createPayment(
      order.id,
      order.amount_htg
    );
    await admin
      .from("payments")
      .update({ raw: { payment_token: paymentToken } })
      .eq("order_id", order.id);

    return NextResponse.json({ redirectUrl, orderId: order.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur de paiement" },
      { status: 502 }
    );
  }
}
