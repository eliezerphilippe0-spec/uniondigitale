import test from "node:test";
import assert from "node:assert/strict";
import { isSuccessful, type MonCashPayment } from "../lib/moncash";
import {
  slugify,
  paymentIdempotencyKey,
  walletCreditKey,
  amountMatches,
  withinRailCap,
  railCap,
} from "../lib/payment-utils";

test("isSuccessful : true uniquement si statut 'successful'", () => {
  const base: Omit<MonCashPayment, "status"> = {
    reference: "o1",
    transactionId: "t1",
    cost: 100,
    message: "ok",
    payer: "509",
  };
  assert.equal(isSuccessful({ ...base, status: "successful" }), true);
  assert.equal(isSuccessful({ ...base, status: "pending" }), false);
  assert.equal(isSuccessful({ ...base, status: "failed" }), false);
  assert.equal(isSuccessful(null), false);
});

test("paymentIdempotencyKey : stable = order.id", () => {
  assert.equal(paymentIdempotencyKey("abc"), "abc");
  // Idempotent : même entrée → même clé (pas de doublon de paiement).
  assert.equal(paymentIdempotencyKey("abc"), paymentIdempotencyKey("abc"));
});

test("walletCreditKey : format aligné sur confirm_payment (SQL)", () => {
  // confirm_payment utilise 'order_credit:' || order_id. Doit correspondre.
  assert.equal(walletCreditKey("xyz"), "order_credit:xyz");
});

test("amountMatches : rejette un montant falsifié (money-path)", () => {
  assert.equal(amountMatches(2500, 2500), true);
  assert.equal(amountMatches(2500, 2500.0), true);
  assert.equal(amountMatches(2500, 2499), false); // montant minoré
  assert.equal(amountMatches(2500, 5000), false); // montant majoré
  assert.equal(amountMatches(2500, Number.NaN), false);
});

test("plafonds : MonCash 25k, NatCash 20k", () => {
  assert.equal(railCap("moncash"), 25000);
  assert.equal(railCap("natcash"), 20000);
  assert.equal(railCap("inconnu"), null);

  assert.equal(withinRailCap(25000, "moncash"), true); // pile au plafond = ok
  assert.equal(withinRailCap(25001, "moncash"), false);
  assert.equal(withinRailCap(20001, "natcash"), false);
  // Rail inconnu → pas de plafond appliqué (true).
  assert.equal(withinRailCap(999999, "inconnu"), true);
});

test("slugify : URL propre, accents retirés, borné", () => {
  assert.equal(slugify("Beat Kompa Moderne"), "beat-kompa-moderne");
  assert.equal(slugify("  Préséts Lightroom!! "), "presets-lightroom");
  assert.equal(slugify("a".repeat(80)).length, 60);
});
