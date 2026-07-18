/**
 * Fulfillment topup — backoff PUR, testé dans tests/zabelie-topup.test.ts.
 *
 * ⚠️ Les plafonds anti-abus (contrainte BRH n°7 : 5 000 HTG/tx,
 * 25 000 HTG/j, 5 bénéficiaires/h) NE vivent PLUS ici : depuis 0029
 * (BL-137), la SEULE source de vérité est la fonction SQL
 * `zabelie_topup_reserve_order` — vérification + création de commande
 * atomiques, jour calculé en heure d'Haïti, valeurs dans
 * `zabelie_topup_limits`. Couverture : supabase/tests/zabelie_topup.test.sql
 * (T6a-d). L'ancien double JS (`checkTopupLimits`) a été supprimé : deux
 * copies des règles avaient déjà divergé une fois (jour UTC vs Haïti).
 */

/** Backoff exponentiel du fulfillment (max 3 tentatives) : 0 s, 2 s, 4 s. */
export function fulfillmentBackoffMs(attempt: number): number | null {
  if (attempt < 0 || attempt >= 3) return null; // plus de tentative
  return attempt === 0 ? 0 : 1000 * 2 ** attempt;
}
