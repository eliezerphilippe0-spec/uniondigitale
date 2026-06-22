import test from "node:test";
import assert from "node:assert/strict";
import {
  commissionHTG,
  netHTG,
  rateBps,
  type CreatorTier,
} from "../lib/commission";

test("taux par tier : 10 % standard, 6 % Elite", () => {
  assert.equal(rateBps("standard"), 1000);
  assert.equal(rateBps("elite"), 600);
  // Tier inconnu → repli standard (jamais 0 % par erreur).
  assert.equal(rateBps("???" as CreatorTier), 1000);
});

test("commission standard 10 %", () => {
  assert.equal(commissionHTG(2500, "standard"), 250);
  assert.equal(netHTG(2500, "standard"), 2250);
});

test("commission Elite 6 %", () => {
  assert.equal(commissionHTG(1000, "elite"), 60);
  assert.equal(netHTG(1000, "elite"), 940);
});

test("arrondis : commission = round(gross * bps / 10000)", () => {
  // 2599 * 10 % = 259.9 → 260
  assert.equal(commissionHTG(2599, "standard"), 260);
  assert.equal(netHTG(2599, "standard"), 2339);
  // 2599 * 6 % = 155.94 → 156
  assert.equal(commissionHTG(2599, "elite"), 156);
  // gross 0 → 0
  assert.equal(commissionHTG(0, "standard"), 0);
});

test("invariant : net + commission = brut", () => {
  for (const gross of [1, 99, 100, 2500, 2599, 999999]) {
    for (const tier of ["standard", "elite"] as CreatorTier[]) {
      assert.equal(
        netHTG(gross, tier) + commissionHTG(gross, tier),
        gross,
        `gross=${gross} tier=${tier}`
      );
    }
  }
});
