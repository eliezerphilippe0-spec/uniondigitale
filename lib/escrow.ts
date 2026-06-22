/**
 * Maturation J+7 — ORACLE (affichage / tests).
 *
 * ⚠️ Comme pour la commission, le SEUL endroit qui déplace l'argent
 * (pending → available, ou remboursement) est le SQL (0006_escrow_maturation).
 * Ce module sert à AFFICHER « disponible le X » et à tester la règle de date.
 */

export const MATURATION_DAYS = 7;

/** Date de maturité = confirmation + 7 jours. */
export function maturesAt(confirmedAt: Date): Date {
  const d = new Date(confirmedAt);
  d.setUTCDate(d.getUTCDate() + MATURATION_DAYS);
  return d;
}

/** Le solde est-il mûr (retirable) à l'instant `now` ? */
export function isMatured(maturesAtDate: Date, now: Date = new Date()): boolean {
  return now.getTime() >= maturesAtDate.getTime();
}

/** Jours restants avant maturité (0 si déjà mûr). */
export function daysUntilMatured(
  maturesAtDate: Date,
  now: Date = new Date()
): number {
  const ms = maturesAtDate.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000));
}
