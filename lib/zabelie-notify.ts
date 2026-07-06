/**
 * Notifications post-paiement (V-13) : e-mail acheteur (livraison) + e-mail
 * vendeur (🎉 vente). Appelée en fire-and-forget APRÈS confirm_payment aux
 * 4 points de confirmation (retour MonCash, réconciliateur, webhook Stripe,
 * confirmation admin Zelle).
 *
 * Idempotence : un marqueur `notified_at` est posé ATOMIQUEMENT dans
 * payments.raw — un paiement rejoué (webhook doublé, réconciliateur qui
 * repasse) ne déclenche qu'UN envoi. Best-effort intégral : aucune erreur
 * ici ne remonte jamais au flux de paiement.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isEmailEnabled,
  sendEmail,
  buyerPurchaseEmail,
  sellerSaleEmail,
} from "./zabelie-email";

function formatHtg(n: number): string {
  return `${new Intl.NumberFormat("fr-HT").format(n)} HTG`;
}

export async function notifyOrderPaid(
  admin: SupabaseClient,
  orderId: string
): Promise<void> {
  try {
    if (!isEmailEnabled()) return;

    // Réservation atomique : ne notifie que le PREMIER passage.
    const { data: claimed } = await admin.rpc("zabelie_claim_notification", {
      p_order_id: orderId,
    });
    if (!claimed) return;

    const { data: order } = await admin
      .from("orders")
      .select("id, buyer_id, amount_htg, product:products(title, seller_id)")
      .eq("id", orderId)
      .single();
    if (!order) return;
    const product = (Array.isArray(order.product) ? order.product[0] : order.product) as
      | { title: string; seller_id: string }
      | null;
    if (!product) return;

    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    // Net vendeur réel = la ligne de crédit écrite par la fonction SQL
    // (jamais recalculé ici — la SQL reste le seul calculateur).
    const { data: credit } = await admin
      .from("wallet_transactions")
      .select("amount_htg")
      .eq("idempotency_key", `order_credit:${orderId}`)
      .maybeSingle();

    const [buyer, seller] = await Promise.all([
      admin.auth.admin.getUserById(order.buyer_id),
      admin.auth.admin.getUserById(product.seller_id),
    ]);

    const jobs: Promise<boolean>[] = [];
    const buyerEmail = buyer.data.user?.email;
    if (buyerEmail) {
      const m = buyerPurchaseEmail({
        productTitle: product.title,
        amountLabel: formatHtg(order.amount_htg),
        purchasesUrl: `${site}/mes-achats`,
      });
      jobs.push(sendEmail({ to: buyerEmail, ...m }));
    }
    const sellerEmail = seller.data.user?.email;
    if (sellerEmail && credit) {
      const m = sellerSaleEmail({
        productTitle: product.title,
        netLabel: formatHtg(credit.amount_htg),
        dashboardUrl: `${site}/tableau-de-bord`,
      });
      jobs.push(sendEmail({ to: sellerEmail, ...m }));
    }
    await Promise.allSettled(jobs);
  } catch {
    // best-effort : jamais d'impact sur le money-path
  }
}
