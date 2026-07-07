/**
 * Codes promo (V-13) — logique PURE, testée dans tests/zabelie-coupons.test.ts.
 * La vérité du prix reste côté serveur : ces fonctions sont utilisées PAR le
 * serveur (checkout, validation) et par l'UI pour l'affichage seulement.
 */

/** Normalisation d'un code saisi : trim, majuscules, alphanumérique + tirets. */
export function normalizeCouponCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,24}$/.test(code)) return null;
  return code;
}

/**
 * Prix remisé (HTG entier). Arrondi au plus proche, plancher à 10 HTG
 * (jamais 0 : un paiement de 0 casserait les rails). percent borné 1–90
 * par la contrainte en base — revérifié ici par défense en profondeur.
 */
export function discountedPriceHtg(priceHtg: number, percent: number): number {
  if (!Number.isInteger(percent) || percent < 1 || percent > 90) {
    throw new Error("Pourcentage de remise invalide");
  }
  const discounted = priceHtg - Math.round((priceHtg * percent) / 100);
  return Math.max(10, discounted);
}

export type CouponRow = {
  id: string;
  seller_id: string;
  product_id: string | null;
  percent: number;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  active: boolean;
};

/** Le coupon est-il applicable à CE produit de CE vendeur, maintenant ? */
export function couponApplies(
  c: CouponRow,
  productId: string,
  sellerId: string,
  now: Date = new Date()
): boolean {
  if (!c.active) return false;
  if (c.seller_id !== sellerId) return false;
  if (c.product_id !== null && c.product_id !== productId) return false;
  if (c.expires_at !== null && new Date(c.expires_at) <= now) return false;
  if (c.max_uses !== null && c.uses >= c.max_uses) return false;
  return true;
}
