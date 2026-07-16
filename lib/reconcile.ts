import { isSuccessful, type MonCashPayment } from "./moncash";

/**
 * Orchestration du réconciliateur, isolée des I/O (Supabase, MonCash) pour être
 * testable. C'est la colonne vertébrale d'EPIC 4 : rattraper un paiement
 * orphelin quand le retour navigateur n'arrive jamais (« redirect coupé »).
 *
 * BL-101 (C-1) : un paiement 'pending' que MonCash ne connaît pas (checkout
 * abandonné) ou ne confirme pas, ET âgé de plus de 48 h, est EXPIRÉ (état
 * terminal 'failed', commande annulée). Sans cela, les cadavres saturaient la
 * fenêtre de scan (ASC limit 50) et un paiement encaissé au-delà n'était plus
 * jamais réconcilié. Pattern : expiration de session façon Stripe. La fonction
 * SQL (zabelie_expire_stale_payment) re-vérifie l'âge et le statut EN BASE.
 */

/** Âge au-delà duquel un pending non confirmé par MonCash est expiré. */
export const STALE_PAYMENT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export type PendingPayment = {
  idempotency_key: string;
  order_id: string;
  created_at: string;
};

export type ConfirmOutcome = { status?: string; error?: string };

export type ReconcileDeps = {
  /** Paiements encore en attente (status = 'pending'). */
  listPending: () => Promise<PendingPayment[]>;
  /** Vérification serveur-à-serveur de l'état réel chez l'opérateur. */
  retrieve: (orderId: string) => Promise<MonCashPayment | null>;
  /** Applique confirm_payment (idempotent, garde-fou montant en base). */
  confirm: (input: {
    idempotencyKey: string;
    providerRef: string;
    amount: number;
    raw: MonCashPayment;
  }) => Promise<ConfirmOutcome>;
  /** Expire un pending abandonné (no-op en base si confirmé/trop récent). */
  expire: (idempotencyKey: string, reason: string) => Promise<ConfirmOutcome>;
  /** Horloge injectable (tests). */
  now?: () => number;
};

export type ReconcileResult = {
  scanned: number;
  confirmed: number;
  stillPending: number;
  rejected: number;
  expired: number;
  errors: string[];
};

export async function reconcilePayments(
  deps: ReconcileDeps
): Promise<ReconcileResult> {
  const pendings = await deps.listPending();
  const now = deps.now ? deps.now() : Date.now();
  let confirmed = 0;
  let stillPending = 0;
  let rejected = 0;
  let expired = 0;
  const errors: string[] = [];

  for (const p of pendings) {
    try {
      // idempotency_key === order.id === orderId envoyé à MonCash.
      const mc = await deps.retrieve(p.idempotency_key);
      if (isSuccessful(mc) && mc) {
        const out = await deps.confirm({
          idempotencyKey: p.idempotency_key,
          providerRef: mc.transactionId,
          amount: Math.round(mc.cost),
          raw: mc,
        });
        if (out.error) errors.push(`${p.order_id}: ${out.error}`);
        else if (out.status === "failed") rejected++; // montant incohérent
        else confirmed++;
      } else if (now - Date.parse(p.created_at) > STALE_PAYMENT_MAX_AGE_MS) {
        // MonCash ne le connaît pas (404 → null) ou ne le confirme pas, ET il
        // est vieux : état terminal. Une erreur réseau, elle, JETTE (catch) et
        // laisse le paiement pending — on n'expire que sur réponse formelle.
        const out = await deps.expire(
          p.idempotency_key,
          mc === null ? "moncash_unknown_48h" : "moncash_not_successful_48h"
        );
        if (out.error) errors.push(`${p.order_id}: ${out.error}`);
        else expired++;
      } else {
        stillPending++;
      }
    } catch (e) {
      errors.push(`${p.order_id}: ${e instanceof Error ? e.message : "err"}`);
    }
  }

  return {
    scanned: pendings.length,
    confirmed,
    stillPending,
    rejected,
    expired,
    errors,
  };
}
