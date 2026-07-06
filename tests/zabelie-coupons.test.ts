import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCouponCode,
  discountedPriceHtg,
  couponApplies,
  type CouponRow,
} from "../lib/zabelie-coupons";

test("normalizeCouponCode : trim, majuscules, format borné", () => {
  assert.equal(normalizeCouponCode("  promo50 "), "PROMO50");
  assert.equal(normalizeCouponCode("noel-2026"), "NOEL-2026");
  assert.equal(normalizeCouponCode("ab"), null); // trop court
  assert.equal(normalizeCouponCode("a".repeat(25)), null); // trop long
  assert.equal(normalizeCouponCode("promo 50"), null); // espace interdit
  assert.equal(normalizeCouponCode("promo_50"), null); // underscore interdit
  assert.equal(normalizeCouponCode(""), null);
});

test("discountedPriceHtg : arrondi entier, plancher 10 HTG, bornes", () => {
  assert.equal(discountedPriceHtg(2500, 20), 2000);
  assert.equal(discountedPriceHtg(2500, 50), 1250);
  // Arrondi au plus proche : 999 × 33 % = 329,67 → 330 ; 999 − 330 = 669.
  assert.equal(discountedPriceHtg(999, 33), 669);
  // Jamais 0 : plancher à 10 HTG même à −90 %.
  assert.equal(discountedPriceHtg(15, 90), 10);
  assert.equal(discountedPriceHtg(100, 90), 10);
  // Bornes du pourcentage revérifiées (défense en profondeur).
  assert.throws(() => discountedPriceHtg(1000, 0));
  assert.throws(() => discountedPriceHtg(1000, 91));
  assert.throws(() => discountedPriceHtg(1000, 12.5));
});

test("couponApplies : vendeur, produit, expiration, plafond, actif", () => {
  const base: CouponRow = {
    id: "c1",
    seller_id: "s1",
    product_id: null,
    percent: 20,
    max_uses: null,
    uses: 0,
    expires_at: null,
    active: true,
  };
  const now = new Date("2026-07-06T12:00:00Z");

  assert.equal(couponApplies(base, "p1", "s1", now), true);
  // Mauvais vendeur → le code d'un autre vendeur ne s'applique jamais.
  assert.equal(couponApplies(base, "p1", "s2", now), false);
  // Restreint à un produit précis.
  assert.equal(couponApplies({ ...base, product_id: "p1" }, "p1", "s1", now), true);
  assert.equal(couponApplies({ ...base, product_id: "p2" }, "p1", "s1", now), false);
  // Expiré / pas encore expiré.
  assert.equal(
    couponApplies({ ...base, expires_at: "2026-07-06T11:00:00Z" }, "p1", "s1", now),
    false
  );
  assert.equal(
    couponApplies({ ...base, expires_at: "2026-07-07T00:00:00Z" }, "p1", "s1", now),
    true
  );
  // Plafond atteint.
  assert.equal(couponApplies({ ...base, max_uses: 5, uses: 5 }, "p1", "s1", now), false);
  assert.equal(couponApplies({ ...base, max_uses: 5, uses: 4 }, "p1", "s1", now), true);
  // Désactivé.
  assert.equal(couponApplies({ ...base, active: false }, "p1", "s1", now), false);
});
