/**
 * Abstraction fournisseur de recharge (adapter pattern) — V-11.
 * P1 : Reloadly (sandbox). Fallback prévu : DingConnect. P2 : accès direct
 * Digicel/Natcom si accord distributeur.
 *
 * Invariant : chaque fulfillTopup porte la clé d'idempotence (= order.id),
 * transmise AU FOURNISSEUR (customIdentifier) → zéro double-recharge, même si
 * l'appel est rejoué après un timeout.
 */

export type TopupOperator = "digicel" | "natcom";

export type TopupProduct = {
  operator: TopupOperator;
  providerProductId: string; // operatorId côté fournisseur
  label: string;
  /** Valeur livrée au bénéficiaire (HTG, entier). */
  faceValueHtg: number;
  /** Prix coûtant pour la plateforme (HTG, entier, arrondi sup). */
  costHtg: number;
};

export type TopupFulfillmentRequest = {
  /** Clé d'idempotence = zabelie_topup_orders.id. */
  orderId: string;
  operator: TopupOperator;
  providerProductId: string | null;
  /** Numéro bénéficiaire, format 509XXXXXXXX. */
  beneficiaryPhone: string;
  faceValueHtg: number;
};

export type TopupFulfillmentResult =
  | { ok: true; providerRef: string; raw?: unknown }
  | { ok: false; retryable: boolean; error: string; raw?: unknown };

export type TopupStatus = "delivered" | "pending" | "failed" | "unknown";

export type ReconciliationEntry = {
  orderId: string; // customIdentifier renvoyé par le fournisseur
  providerRef: string;
  status: TopupStatus;
};

export type ReconciliationReport = {
  since: string; // ISO
  entries: ReconciliationEntry[];
};

export interface TopupProvider {
  readonly name: string;
  getProducts(operator: TopupOperator): Promise<TopupProduct[]>;
  fulfillTopup(order: TopupFulfillmentRequest): Promise<TopupFulfillmentResult>;
  checkStatus(orderId: string): Promise<TopupStatus>;
  reconcile(since: Date): Promise<ReconciliationReport>;
}
