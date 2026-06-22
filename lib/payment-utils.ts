/**
 * Fonctions pures liées au paiement et au catalogue. Sans dépendance runtime,
 * donc testables unitairement (voir tests/payment.test.ts).
 */

/** Slug URL à partir d'un titre. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/**
 * Clé d'idempotence du paiement = order.id. Un seul paiement par commande.
 * (Doit correspondre à l'usage dans /api/checkout et confirm_payment.)
 */
export function paymentIdempotencyKey(orderId: string): string {
  return orderId;
}

/**
 * Clé d'idempotence du crédit wallet. DOIT être identique à celle utilisée par
 * la fonction SQL confirm_payment ('order_credit:' || order_id), sinon le crédit
 * pourrait être appliqué deux fois.
 */
export function walletCreditKey(orderId: string): string {
  return `order_credit:${orderId}`;
}
