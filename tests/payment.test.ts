import test from "node:test";
import assert from "node:assert/strict";
import { isSuccessful, type MonCashPayment } from "../lib/moncash";
import {
  slugify,
  paymentIdempotencyKey,
  walletCreditKey,
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

test("slugify : URL propre, accents retirés, borné", () => {
  assert.equal(slugify("Beat Kompa Moderne"), "beat-kompa-moderne");
  assert.equal(slugify("  Préséts Lightroom!! "), "presets-lightroom");
  assert.equal(slugify("a".repeat(80)).length, 60);
});
