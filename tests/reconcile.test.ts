import test from "node:test";
import assert from "node:assert/strict";
import { reconcilePayments, type ReconcileDeps } from "../lib/reconcile";
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

// Construit des deps mockées + un journal des appels confirm().
function deps(over: Partial<ReconcileDeps> = {}): {
  deps: ReconcileDeps;
  confirmCalls: { idempotencyKey: string; amount: number }[];
} {
  const confirmCalls: { idempotencyKey: string; amount: number }[] = [];
  const base: ReconcileDeps = {
    listPending: async () => [
      { idempotency_key: "order-1", order_id: "order-1" },
    ],
    retrieve: async () => mcPayment({ reference: "order-1" }),
    confirm: async ({ idempotencyKey, amount }) => {
      confirmCalls.push({ idempotencyKey, amount });
      return { status: "confirmed" };
    },
  };
  return { deps: { ...base, ...over }, confirmCalls };
}

test("redirect coupé : un paiement orphelin réussi est rattrapé et confirmé", async () => {
  const { deps: d, confirmCalls } = deps();
  const res = await reconcilePayments(d);

  assert.equal(res.scanned, 1);
  assert.equal(res.confirmed, 1);
  assert.equal(res.stillPending, 0);
  assert.equal(res.rejected, 0);
  // Le montant transmis à confirm() vient de l'opérateur (vérité serveur).
  assert.deepEqual(confirmCalls, [{ idempotencyKey: "order-1", amount: 2500 }]);
});

test("paiement encore en attente chez l'opérateur : laissé pending, pas de confirm", async () => {
  const { deps: d, confirmCalls } = deps({
    retrieve: async () => mcPayment({ status: "pending" }),
  });
  const res = await reconcilePayments(d);

  assert.equal(res.confirmed, 0);
  assert.equal(res.stillPending, 1);
  assert.equal(confirmCalls.length, 0);
});

test("opérateur inconnu (null) : laissé pending", async () => {
  const { deps: d } = deps({ retrieve: async () => null });
  const res = await reconcilePayments(d);
  assert.equal(res.stillPending, 1);
  assert.equal(res.confirmed, 0);
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
      { idempotency_key: "order-1", order_id: "order-1" },
      { idempotency_key: "order-2", order_id: "order-2" },
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
  let confirmedKeys = new Set<string>();
  const d: ReconcileDeps = {
    listPending: async () =>
      confirmedKeys.has("order-1")
        ? []
        : [{ idempotency_key: "order-1", order_id: "order-1" }],
    retrieve: async () => mcPayment({ reference: "order-1" }),
    confirm: async ({ idempotencyKey }) => {
      confirmedKeys.add(idempotencyKey);
      return { status: "confirmed" };
    },
  };

  const first = await reconcilePayments(d);
  const second = await reconcilePayments(d);

  assert.equal(first.confirmed, 1);
  assert.equal(second.scanned, 0);
  assert.equal(second.confirmed, 0);
});
