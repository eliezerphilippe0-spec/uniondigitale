/**
 * Validation des numéros mobiles haïtiens + détection d'opérateur par préfixe.
 * Fonctions pures (testées dans tests/zabelie-topup.test.ts).
 *
 * Format national : 8 chiffres, mobiles en 3X/4X. Répartition usuelle :
 *   Digicel : 34–39, 44–49        Natcom : 32, 33, 40–43
 * ⚠️ La portabilité et de nouveaux blocs peuvent fausser la détection : elle
 * PRÉ-REMPLIT le choix côté UI, l'acheteur confirme toujours l'opérateur.
 */

import type { TopupOperator } from "./provider";

const DIGICEL_PREFIXES = ["34", "35", "36", "37", "38", "39", "44", "45", "46", "47", "48", "49"];
const NATCOM_PREFIXES = ["32", "33", "40", "41", "42", "43"];

/** Normalise vers 509XXXXXXXX. Accepte +509…, 509…, ou 8 chiffres locaux. */
export function normalizeHaitiPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let local: string;
  if (digits.length === 8) local = digits;
  else if (digits.length === 11 && digits.startsWith("509")) local = digits.slice(3);
  else return null;

  if (!/^[34]\d{7}$/.test(local)) return null; // mobiles uniquement (3X/4X)
  return `509${local}`;
}

/** Opérateur probable d'un numéro normalisé (509XXXXXXXX), sinon null. */
export function detectOperator(normalizedPhone: string): TopupOperator | null {
  const prefix = normalizedPhone.slice(3, 5);
  if (DIGICEL_PREFIXES.includes(prefix)) return "digicel";
  if (NATCOM_PREFIXES.includes(prefix)) return "natcom";
  return null;
}

/** Affichage lisible : +509 XX XX XXXX. */
export function formatHaitiPhone(normalizedPhone: string): string {
  const l = normalizedPhone.slice(3);
  return `+509 ${l.slice(0, 2)} ${l.slice(2, 4)} ${l.slice(4, 6)} ${l.slice(6)}`;
}
