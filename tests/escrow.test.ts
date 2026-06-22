import test from "node:test";
import assert from "node:assert/strict";
import {
  MATURATION_DAYS,
  maturesAt,
  isMatured,
  daysUntilMatured,
} from "../lib/escrow";

test("maturesAt : confirmation + 7 jours", () => {
  assert.equal(MATURATION_DAYS, 7);
  const confirmed = new Date("2026-06-01T00:00:00.000Z");
  assert.equal(maturesAt(confirmed).toISOString(), "2026-06-08T00:00:00.000Z");
});

test("isMatured : faux avant l'échéance, vrai après", () => {
  const m = new Date("2026-06-08T00:00:00.000Z");
  assert.equal(isMatured(m, new Date("2026-06-07T23:59:59.000Z")), false);
  assert.equal(isMatured(m, new Date("2026-06-08T00:00:00.000Z")), true);
  assert.equal(isMatured(m, new Date("2026-06-10T00:00:00.000Z")), true);
});

test("daysUntilMatured : décompte, 0 si déjà mûr", () => {
  const m = new Date("2026-06-08T00:00:00.000Z");
  assert.equal(daysUntilMatured(m, new Date("2026-06-01T00:00:00.000Z")), 7);
  assert.equal(daysUntilMatured(m, new Date("2026-06-07T00:00:00.000Z")), 1);
  assert.equal(daysUntilMatured(m, new Date("2026-06-09T00:00:00.000Z")), 0);
});
