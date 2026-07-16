/**
 * Réconciliation du service de recharge (V-11) — appelée par /api/reconcile
 * (même cron que le marketplace : plan Vercel Hobby = 2 crons max).
 * Troisième invariant paiement : AUCUNE commande orpheline.
 *   1. payment_pending (moncash) → vérité MonCash → confirm + fulfill.
 *   2. paid / fulfillment_pending → retente le fulfillment (idempotent).
 *   3. delivered ↔ rapport fournisseur → toute divergence est signalée
 *      (réponse cron + à reporter dans OPS_TODO.md).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { retrieveOrderPayment, isSuccessful, redactPayment } from "@/lib/moncash";
import { fulfillTopupOrder, getTopupProvider } from "./fulfill";

export type TopupReconcileResult = {
  scanned: number;
  confirmed: number;
  fulfilled: number;
  refundQueued: number;
  discrepancies: string[];
  errors: string[];
};

export async function reconcileTopups(
  admin: SupabaseClient
): Promise<TopupReconcileResult> {
  const result: TopupReconcileResult = {
    scanned: 0,
    confirmed: 0,
    fulfilled: 0,
    refundQueued: 0,
    discrepancies: [],
    errors: [],
  };

  // 1. Paiements MonCash en attente (Zelle = confirmation admin, pas ici).
  const { data: pendings } = await admin
    .from("zabelie_topup_orders")
    .select("id, amount_htg")
    .eq("status", "payment_pending")
    .eq("rail", "moncash")
    .order("created_at", { ascending: true })
    .limit(50);

  for (const o of pendings ?? []) {
    result.scanned++;
    try {
      const mc = await retrieveOrderPayment(o.id);
      if (mc && isSuccessful(mc)) {
        const { data, error } = await admin.rpc("zabelie_topup_confirm_payment", {
          p_order_id: o.id,
          p_payment_ref: mc.transactionId,
          p_raw: redactPayment(mc), // BL-115 : minimisation identique au marketplace
          p_amount: Math.round(mc.cost),
        });
        if (error) result.errors.push(`${o.id}: ${error.message}`);
        else if (data?.status === "paid") result.confirmed++;
      }
    } catch (e) {
      result.errors.push(`${o.id}: ${e instanceof Error ? e.message : "err"}`);
    }
  }

  // 2. Fulfillments à (re)tenter — idempotent (clé transmise au fournisseur).
  const { data: toFulfill } = await admin
    .from("zabelie_topup_orders")
    .select("id")
    .in("status", ["paid", "fulfillment_pending"])
    .order("created_at", { ascending: true })
    .limit(25);

  for (const o of toFulfill ?? []) {
    result.scanned++;
    try {
      const out = await fulfillTopupOrder(admin, o.id);
      if (out.status === "delivered") result.fulfilled++;
      if (out.status === "refund_pending") result.refundQueued++;
      if (out.error) result.errors.push(`${o.id}: ${out.error}`);
    } catch (e) {
      result.errors.push(`${o.id}: ${e instanceof Error ? e.message : "err"}`);
    }
  }

  // 3. Rapport fournisseur (24 h) ↔ base : divergence = alerte admin.
  const provider = getTopupProvider();
  if (provider) {
    try {
      const report = await provider.reconcile(new Date(Date.now() - 24 * 3600_000));
      const ids = report.entries.map((e) => e.orderId);
      const { data: known } = ids.length
        ? await admin
            .from("zabelie_topup_orders")
            .select("id, status")
            .in("id", ids)
        : { data: [] };
      const byId = new Map((known ?? []).map((o) => [o.id, o.status]));
      for (const entry of report.entries) {
        const local = byId.get(entry.orderId);
        if (!local) {
          result.discrepancies.push(
            `Fournisseur connaît ${entry.orderId} (${entry.status}) — inconnu en base`
          );
        } else if (entry.status === "delivered" && local !== "delivered") {
          result.discrepancies.push(
            `${entry.orderId}: livré chez le fournisseur mais '${local}' en base`
          );
        } else if (entry.status === "failed" && local === "delivered") {
          result.discrepancies.push(
            `${entry.orderId}: échoué chez le fournisseur mais 'delivered' en base`
          );
        }
      }
    } catch (e) {
      result.errors.push(
        `reconcile fournisseur: ${e instanceof Error ? e.message : "err"}`
      );
    }
  }

  return result;
}
