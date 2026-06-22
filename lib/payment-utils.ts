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

/**
 * Le montant rapporté par l'opérateur correspond-il au montant de la commande ?
 * Garde-fou contre un montant falsifié/incohérent (INVARIANT money-path).
 * Le contrôle de vérité est aussi appliqué côté base dans confirm_payment.
 */
export function amountMatches(
  orderAmountHTG: number,
  operatorCost: number
): boolean {
  return Number.isFinite(operatorCost) && orderAmountHTG === Math.round(operatorCost);
}

/**
 * Plafonds par transaction et par rail (HTG). Au-delà, l'opérateur refuse :
 * on bloque AVANT de créer la commande, avec un message clair.
 * NatCash défini pour plus tard (Vague 2, bloqué).
 */
export const RAIL_CAPS: Record<string, number> = {
  moncash: 25000,
  natcash: 20000,
};

export function railCap(rail: string): number | null {
  return RAIL_CAPS[rail] ?? null;
}

/** Le montant respecte-t-il le plafond du rail ? (true si pas de plafond connu) */
export function withinRailCap(amountHTG: number, rail: string): boolean {
  const cap = railCap(rail);
  return cap === null ? true : amountHTG <= cap;
}
