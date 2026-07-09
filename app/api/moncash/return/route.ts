import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  retrieveTransactionPayment,
  isSuccessful,
  redactPayment,
} from "@/lib/moncash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/moncash/return?transactionId=...
 * Retour navigateur après paiement. On NE fait PAS confiance à ce retour : on
 * vérifie l'état réel côté MonCash (serveur-à-serveur) avant de confirmer.
 * Si le retour est coupé, le réconciliateur rattrapera (cf. /api/reconcile).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const transactionId = url.searchParams.get("transactionId");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;

  if (!transactionId) {
    return NextResponse.redirect(`${site}/paiement/echec?raison=transaction_absente`);
  }

  let payment;
  try {
    payment = await retrieveTransactionPayment(transactionId);
  } catch {
    // Vérification impossible maintenant → le réconciliateur reprendra la main.
    return NextResponse.redirect(`${site}/paiement/en-attente`);
  }

  if (!isSuccessful(payment) || !payment) {
    return NextResponse.redirect(`${site}/paiement/echec?raison=non_confirme`);
  }

  // payment.reference = notre order.id = idempotency_key du paiement.
  const orderId = payment.reference;
  const admin = createAdminClient();

  // Recharge téléphonique (V-11) ? Même vérité serveur-à-serveur, pipeline
  // dédié : confirmation idempotente puis fulfillment immédiat.
  const { data: topupOrder } = await admin
    .from("zabelie_topup_orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();
  if (topupOrder) {
    const { data: confirmed, error: topupErr } = await admin.rpc(
      "zabelie_topup_confirm_payment",
      {
        p_order_id: orderId,
        p_payment_ref: payment.transactionId,
        p_raw: payment as unknown as Record<string, unknown>,
        p_amount: Math.round(payment.cost),
      }
    );
    if (topupErr) {
      return NextResponse.redirect(`${site}/rechaj/${orderId}`);
    }
    if (confirmed?.status === "paid") {
      const { fulfillTopupOrder } = await import("@/lib/zabelie-topup/fulfill");
      await fulfillTopupOrder(admin, orderId).catch(() => undefined);
    }
    return NextResponse.redirect(`${site}/rechaj/${orderId}`);
  }

  const { data, error } = await admin.rpc("confirm_payment", {
    p_idempotency_key: orderId,
    p_provider_ref: payment.transactionId,
    p_raw: redactPayment(payment),
    p_amount: Math.round(payment.cost),
  });

  if (error) {
    // Erreur transitoire → le réconciliateur reprendra la main.
    return NextResponse.redirect(`${site}/paiement/en-attente`);
  }
  if (data?.status === "failed") {
    // Montant incohérent : paiement rejeté, aucune livraison.
    return NextResponse.redirect(`${site}/paiement/echec?raison=montant`);
  }

  // E-mails livraison acheteur + 🎉 vendeur (best-effort, idempotent en base).
  const { notifyOrderPaid } = await import("@/lib/zabelie-notify");
  notifyOrderPaid(admin, orderId).catch(() => undefined);

  return NextResponse.redirect(`${site}/paiement/succes?commande=${orderId}`);
}
