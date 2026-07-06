/**
 * Orchestration du fulfillment de recharge — V-11.
 * Appelée APRÈS confirmation du paiement (retour MonCash, confirmation admin
 * Zelle) et par le réconciliateur (rattrapage). Règles :
 *   - transitions uniquement via zabelie_topup_transition (machine à états) ;
 *   - retry backoff exponentiel, max 3 tentatives, MÊME clé d'idempotence
 *     (order.id → customIdentifier fournisseur) ;
 *   - échec définitif après paiement confirmé → refund_pending + checkpoint
 *     humain (file « Remboursements » du back-office) — JAMAIS de
 *     remboursement automatique (contrainte BRH n°4 : moyen d'origine).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TopupProvider } from "./provider";
import { reloadlyProvider, isReloadlyEnabled } from "./reloadly";
import { fulfillmentBackoffMs } from "./limits";

export function getTopupProvider(): TopupProvider | null {
  return isReloadlyEnabled() ? reloadlyProvider : null;
}

export function isTopupEnabled(): boolean {
  return isReloadlyEnabled();
}

type TopupOrderRow = {
  id: string;
  operator: "digicel" | "natcom";
  beneficiary_phone: string;
  face_value_htg: number;
  status: string;
  attempts: number;
  product_id: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tente de livrer une commande payée. Idempotente : rejouable sans risque
 * (delivered → no-op ; l'idempotence fournisseur couvre les timeouts).
 */
export async function fulfillTopupOrder(
  admin: SupabaseClient,
  orderId: string,
  provider: TopupProvider | null = getTopupProvider()
): Promise<{ status: string; error?: string }> {
  const { data, error } = await admin
    .from("zabelie_topup_orders")
    .select("id, operator, beneficiary_phone, face_value_htg, status, attempts, product_id")
    .eq("id", orderId)
    .single();
  if (error || !data) return { status: "unknown", error: error?.message };
  const order = data as TopupOrderRow;

  if (order.status === "delivered") return { status: "delivered" };
  if (order.status !== "paid" && order.status !== "fulfillment_pending") {
    return { status: order.status };
  }
  if (!provider) {
    return { status: order.status, error: "Fournisseur topup non configuré" };
  }

  if (order.status === "paid") {
    await admin.rpc("zabelie_topup_transition", {
      p_order_id: orderId,
      p_to: "fulfillment_pending",
      p_detail: { provider: provider.name },
    });
  }

  const { data: product } = await admin
    .from("zabelie_topup_products")
    .select("provider_product_id")
    .eq("id", order.product_id)
    .single();

  let attempt = order.attempts;
  let lastError = "";

  while (true) {
    const wait = fulfillmentBackoffMs(attempt);
    if (wait === null) break; // 3 tentatives épuisées
    if (wait > 0) await sleep(wait);

    const result = await provider.fulfillTopup({
      orderId: order.id, // clé d'idempotence transmise au fournisseur
      operator: order.operator,
      providerProductId: product?.provider_product_id ?? null,
      beneficiaryPhone: order.beneficiary_phone,
      faceValueHtg: order.face_value_htg,
    });

    attempt += 1;
    await admin
      .from("zabelie_topup_orders")
      .update({
        attempts: attempt,
        last_error: result.ok ? null : result.error,
        provider_ref: result.ok ? result.providerRef : undefined,
      })
      .eq("id", orderId);

    if (result.ok) {
      await admin.rpc("zabelie_topup_transition", {
        p_order_id: orderId,
        p_to: "delivered",
        p_detail: { provider_ref: result.providerRef, attempts: attempt },
      });
      return { status: "delivered" };
    }

    lastError = result.error;
    if (!result.retryable) break;
  }

  // Échec définitif d'une commande PAYÉE → remboursement à préparer
  // (checkpoint humain, moyen de paiement d'origine uniquement).
  await admin.rpc("zabelie_topup_transition", {
    p_order_id: orderId,
    p_to: "failed",
    p_detail: { reason: "fulfillment_failed", error: lastError, attempts: attempt },
  });
  await admin.rpc("zabelie_topup_transition", {
    p_order_id: orderId,
    p_to: "refund_pending",
    p_detail: { requires_human_checkpoint: true },
  });
  return { status: "refund_pending", error: lastError };
}
