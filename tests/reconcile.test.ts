import test from "node:test";
import assert from "node:assert/strict";
import {
  reconcilePayments,
  STALE_PAYMENT_MAX_AGE_MS,
  type ReconcileDeps,
} from "../lib/reconcile";
import type { MonCashPayment } from "../lib/moncash";

function mcPayment(over: Partial<MonCashPayment>): MonCashPayment {
  return {
    reference: "order-1",
    transactionId: "TX-1",
    cost: 2500,
    message: "ok",
    payer: "509",
    status: "successful",
    ...over,
  };
}

const NOW = Date.parse("2026-07-15T12:00:00Z");
const RECENT = new Date(NOW - 60_000).toISOString(); // 1 min
const OLD = new Date(NOW - STALE_PAYMENT_MAX_AGE_MS - 3_600_000).toISOString(); // 49 h

// Construit des deps mockées + un journal des appels confirm()/expire().
function deps(over: Partial<ReconcileDeps> = {}): {
  deps: ReconcileDeps;
  confirmCalls: { idempotencyKey: string; amount: number }[];
  expireCalls: { idempotencyKey: string; reason: string }[];
} {
  const confirmCalls: { idempotencyKey: string; amount: number }[] = [];
  const expireCalls: { idempotencyKey: string; reason: string }[] = [];
  const base: ReconcileDeps = {
    listPending: async () => [
      { idempotency_key: "order-1", order_id: "order-1", created_at: RECENT },
    ],
    retrieve: async () => mcPayment({ reference: "order-1" }),
    confirm: async ({ idempotencyKey, amount }) => {
      confirmCalls.push({ idempotencyKey, amount });
      return { status: "confirmed" };
    },
    expire: async (idempotencyKey, reason) => {
      expireCalls.push({ idempotencyKey, reason });
      return {};
    },
    now: () => NOW,
  };
  return { deps: { ...base, ...over }, confirmCalls, expireCalls };
}

test("redirect coupé : un paiement orphelin réussi est rattrapé et confirmé", async () => {
  const { deps: d, confirmCalls } = deps();
  const res = await reconcilePayments(d);

  assert.equal(res.scanned, 1);
  assert.equal(res.confirmed, 1);
  assert.equal(res.stillPending, 0);
  assert.equal(res.rejected, 0);
  assert.equal(res.expired, 0);
  // Le montant transmis à confirm() vient de l'opérateur (vérité serveur).
  assert.deepEqual(confirmCalls, [{ idempotencyKey: "order-1", amount: 2500 }]);
});

test("paiement récent encore en attente chez l'opérateur : laissé pending", async () => {
  const { deps: d, confirmCalls, expireCalls } = deps({
    retrieve: async () => mcPayment({ status: "pending" }),
  });
  const res = await reconcilePayments(d);

  assert.equal(res.confirmed, 0);
  assert.equal(res.stillPending, 1);
  assert.equal(confirmCalls.length, 0);
  assert.equal(expireCalls.length, 0);
});

test("opérateur inconnu (null) mais RÉCENT : laissé pending, jamais expiré", async () => {
  const { deps: d, expireCalls } = deps({ retrieve: async () => null });
  const res = await reconcilePayments(d);
  assert.equal(res.stillPending, 1);
  assert.equal(res.expired, 0);
  assert.equal(expireCalls.length, 0);
});

test("BL-101 : pending >48 h inconnu de MonCash (checkout abandonné) → expiré", async () => {
  const { deps: d, expireCalls } = deps({
    listPending: async () => [
      { idempotency_key: "order-1", order_id: "order-1", created_at: OLD },
    ],
    retrieve: async () => null, // MonCash 404 : jamais payé
  });
  const res = await reconcilePayments(d);
  assert.equal(res.expired, 1);
  assert.equal(res.stillPending, 0);
  assert.deepEqual(expireCalls, [
    { idempotencyKey: "order-1", reason: "moncash_unknown_48h" },
  ]);
});

test("BL-101 : pending >48 h non confirmé par MonCash → expiré (raison distincte)", async () => {
  const { deps: d, expireCalls } = deps({
    listPending: async () => [
      { idempotency_key: "order-1", order_id: "order-1", created_at: OLD },
    ],
    retrieve: async () => mcPayment({ status: "failed" }),
  });
  const res = await reconcilePayments(d);
  assert.equal(res.expired, 1);
  assert.equal(expireCalls[0].reason, "moncash_not_successful_48h");
});

test("BL-101 : un paiement >48 h mais RÉUSSI chez MonCash est confirmé, jamais expiré", async () => {
  // L'âge ne prime jamais sur la vérité opérateur : encaissé = confirmé.
  const { deps: d, confirmCalls, expireCalls } = deps({
    listPending: async () => [
      { idempotency_key: "order-1", order_id: "order-1", created_at: OLD },
    ],
  });
  const res = await reconcilePayments(d);
  assert.equal(res.confirmed, 1);
  assert.equal(res.expired, 0);
  assert.equal(confirmCalls.length, 1);
  assert.equal(expireCalls.length, 0);
});

test("BL-101 : erreur réseau MonCash (throw) → laissé pending, jamais expiré", async () => {
  // On n'expire que sur réponse FORMELLE de l'opérateur, pas sur un timeout.
  const { deps: d, expireCalls } = deps({
    listPending: async () => [
      { idempotency_key: "order-1", order_id: "order-1", created_at: OLD },
    ],
    retrieve: async () => {
      throw new Error("timeout");
    },
  });
  const res = await reconcilePayments(d);
  assert.equal(res.expired, 0);
  assert.equal(expireCalls.length, 0);
  assert.equal(res.errors.length, 1);
});

test("montant incohérent : confirm renvoie failed → compté rejeté, pas confirmé", async () => {
  const { deps: d } = deps({
    retrieve: async () => mcPayment({ cost: 999 }),
    confirm: async () => ({ status: "failed" }), // garde-fou montant en base
  });
  const res = await reconcilePayments(d);
  assert.equal(res.rejected, 1);
  assert.equal(res.confirmed, 0);
});

test("erreur de confirmation : remontée dans errors, n'interrompt pas le lot", async () => {
  const { deps: d } = deps({
    listPending: async () => [
      { idempotency_key: "order-1", order_id: "order-1", created_at: RECENT },
      { idempotency_key: "order-2", order_id: "order-2", created_at: RECENT },
    ],
    confirm: async ({ idempotencyKey }) =>
      idempotencyKey === "order-1"
        ? { error: "db down" }
        : { status: "confirmed" },
  });
  const res = await reconcilePayments(d);
  assert.equal(res.scanned, 2);
  assert.equal(res.confirmed, 1);
  assert.equal(res.errors.length, 1);
  assert.match(res.errors[0], /order-1/);
});

test("rejeu : deux passes du réconciliateur restent idempotentes côté décision", async () => {
  // 1re passe confirme ; 2e passe : l'orphelin n'est plus pending → rien à faire.
  const confirmedKeys = new Set<string>();
  const d: ReconcileDeps = {
    listPending: async () =>
      confirmedKeys.has("order-1")
        ? []
        : [
            {
              idempotency_key: "order-1",
              order_id: "order-1",
              created_at: RECENT,
            },
          ],
    retrieve: async () => mcPayment({ reference: "order-1" }),
    confirm: async ({ idempotencyKey }) => {
      confirmedKeys.add(idempotencyKey);
      return { status: "confirmed" };
    },
    expire: async () => ({}),
    now: () => NOW,
  };

  const first = await reconcilePayments(d);
  const second = await reconcilePayments(d);

  assert.equal(first.confirmed, 1);
  assert.equal(second.scanned, 0);
  assert.equal(second.confirmed, 0);
});
