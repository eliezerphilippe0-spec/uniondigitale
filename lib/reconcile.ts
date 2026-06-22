import { isSuccessful, type MonCashPayment } from "./moncash";

/**
 * Orchestration du réconciliateur, isolée des I/O (Supabase, MonCash) pour être
 * testable. C'est la colonne vertébrale d'EPIC 4 : rattraper un paiement
 * orphelin quand le retour navigateur n'arrive jamais (« redirect coupé »).
 */

export type PendingPayment = { idempotency_key: string; order_id: string };

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
};

export type ReconcileResult = {
  scanned: number;
  confirmed: number;
  stillPending: number;
  rejected: number;
  errors: string[];
};

export async function reconcilePayments(
  deps: ReconcileDeps
): Promise<ReconcileResult> {
  const pendings = await deps.listPending();
  let confirmed = 0;
  let stillPending = 0;
  let rejected = 0;
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
    errors,
  };
}
