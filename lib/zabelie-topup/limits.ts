/**
 * Plafonds anti-abus (contrainte BRH n°7) — logique PURE, testable.
 * Les valeurs vivent en base (zabelie_topup_limits) ; défauts validés porteur :
 * 5 000 HTG/tx, 25 000 HTG/jour/compte, flag > 5 bénéficiaires distincts/h.
 * L'application des plafonds se fait AVANT la création de la commande.
 */

export type TopupLimits = {
  perTxHtg: number;
  perDayHtg: number;
  distinctBeneficiariesPerHour: number;
};

export const DEFAULT_TOPUP_LIMITS: TopupLimits = {
  perTxHtg: 5000,
  perDayHtg: 25000,
  distinctBeneficiariesPerHour: 5,
};

export type TopupUsage = {
  /** HTG déjà engagés par ce compte depuis minuit (commandes non échouées). */
  spentTodayHtg: number;
  /** Numéros bénéficiaires DISTINCTS servis par ce compte sur 60 min. */
  distinctBeneficiariesLastHour: number;
};

export type LimitCheck =
  | { ok: true }
  | { ok: false; reason: "per_tx" | "per_day" | "velocity"; capHtg?: number };

export function checkTopupLimits(
  amountHtg: number,
  usage: TopupUsage,
  limits: TopupLimits,
  /** true si le bénéficiaire a déjà été servi dans l'heure (pas un nouveau). */
  beneficiaryAlreadySeenLastHour: boolean
): LimitCheck {
  if (amountHtg > limits.perTxHtg) {
    return { ok: false, reason: "per_tx", capHtg: limits.perTxHtg };
  }
  if (usage.spentTodayHtg + amountHtg > limits.perDayHtg) {
    return { ok: false, reason: "per_day", capHtg: limits.perDayHtg };
  }
  if (
    !beneficiaryAlreadySeenLastHour &&
    usage.distinctBeneficiariesLastHour + 1 > limits.distinctBeneficiariesPerHour
  ) {
    return { ok: false, reason: "velocity" };
  }
  return { ok: true };
}

/** Backoff exponentiel du fulfillment (max 3 tentatives) : 0 s, 2 s, 4 s. */
export function fulfillmentBackoffMs(attempt: number): number | null {
  if (attempt < 0 || attempt >= 3) return null; // plus de tentative
  return attempt === 0 ? 0 : 1000 * 2 ** attempt;
}
