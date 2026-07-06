import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeHaitiPhone,
  detectOperator,
  formatHaitiPhone,
} from "../lib/zabelie-topup/phone";
import {
  checkTopupLimits,
  fulfillmentBackoffMs,
  DEFAULT_TOPUP_LIMITS,
} from "../lib/zabelie-topup/limits";
import { mapReloadlyStatus } from "../lib/zabelie-topup/reloadly";

test("normalizeHaitiPhone : formats acceptés → 509XXXXXXXX", () => {
  assert.equal(normalizeHaitiPhone("37123456"), "50937123456");
  assert.equal(normalizeHaitiPhone("+509 37 12 34 56"), "50937123456");
  assert.equal(normalizeHaitiPhone("509-3712-3456"), "50937123456");
  assert.equal(normalizeHaitiPhone("43 98 76 54"), "50943987654");
});

test("normalizeHaitiPhone : rejets (fixes, trop court, étranger)", () => {
  assert.equal(normalizeHaitiPhone("22123456"), null); // fixe (2X)
  assert.equal(normalizeHaitiPhone("3712345"), null); // 7 chiffres
  assert.equal(normalizeHaitiPhone("371234567"), null); // 9 chiffres
  assert.equal(normalizeHaitiPhone("+1 305 555 0100"), null); // US
  assert.equal(normalizeHaitiPhone(""), null);
});

test("detectOperator : préfixes Digicel vs Natcom", () => {
  assert.equal(detectOperator("50937123456"), "digicel"); // 37
  assert.equal(detectOperator("50946123456"), "digicel"); // 46
  assert.equal(detectOperator("50932123456"), "natcom"); // 32
  assert.equal(detectOperator("50940123456"), "natcom"); // 40
  assert.equal(detectOperator("50930123456"), null); // 30 : inconnu
});

test("formatHaitiPhone : affichage +509 XX XX XXXX", () => {
  assert.equal(formatHaitiPhone("50937123456"), "+509 37 12 34 56");
});

test("plafonds topup : par transaction, par jour, velocity (BRH n°7)", () => {
  const limits = DEFAULT_TOPUP_LIMITS; // 5000/tx, 25000/j, 5 num/h — validés
  const usage = { spentTodayHtg: 0, distinctBeneficiariesLastHour: 0 };

  assert.deepEqual(checkTopupLimits(5000, usage, limits, false), { ok: true });
  assert.deepEqual(checkTopupLimits(5001, usage, limits, false), {
    ok: false,
    reason: "per_tx",
    capHtg: 5000,
  });

  // Cumul du jour : 24 900 + 200 > 25 000 → refus.
  assert.deepEqual(
    checkTopupLimits(200, { ...usage, spentTodayHtg: 24900 }, limits, false),
    { ok: false, reason: "per_day", capHtg: 25000 }
  );
  assert.equal(
    checkTopupLimits(100, { ...usage, spentTodayHtg: 24900 }, limits, false).ok,
    true // pile au plafond = ok
  );

  // Velocity : 5 numéros distincts déjà servis dans l'heure + 1 NOUVEAU → flag.
  const hot = { spentTodayHtg: 0, distinctBeneficiariesLastHour: 5 };
  assert.deepEqual(checkTopupLimits(100, hot, limits, false), {
    ok: false,
    reason: "velocity",
  });
  // Même bénéficiaire que tout à l'heure → pas un nouveau numéro → ok.
  assert.equal(checkTopupLimits(100, hot, limits, true).ok, true);
});

test("backoff fulfillment : 0s, 2s, 4s puis stop (max 3 tentatives)", () => {
  assert.equal(fulfillmentBackoffMs(0), 0);
  assert.equal(fulfillmentBackoffMs(1), 2000);
  assert.equal(fulfillmentBackoffMs(2), 4000);
  assert.equal(fulfillmentBackoffMs(3), null); // épuisé
  assert.equal(fulfillmentBackoffMs(-1), null);
});

test("mapReloadlyStatus : statuts fournisseur → statuts internes", () => {
  assert.equal(mapReloadlyStatus("SUCCESSFUL"), "delivered");
  assert.equal(mapReloadlyStatus("successful"), "delivered");
  assert.equal(mapReloadlyStatus("PROCESSING"), "pending");
  assert.equal(mapReloadlyStatus("PENDING"), "pending");
  assert.equal(mapReloadlyStatus("FAILED"), "failed");
  assert.equal(mapReloadlyStatus("REFUNDED"), "failed");
  assert.equal(mapReloadlyStatus(undefined), "unknown");
  assert.equal(mapReloadlyStatus("WEIRD"), "unknown");
});
