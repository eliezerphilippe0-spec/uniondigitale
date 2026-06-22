import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { retrieveOrderPayment, isSuccessful } from "@/lib/moncash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Réconciliateur : pour chaque paiement encore 'pending', interroge MonCash
 * (serveur-à-serveur) et applique confirm_payment() si le paiement a réussi.
 * Garantit qu'AUCUN paiement n'est orphelin et rattrape le cas « redirect coupé ».
 *
 * Déclenchement :
 *   - GET  → cron Vercel (en-tête Authorization: Bearer $CRON_SECRET).
 *   - POST → appel manuel (Authorization: Bearer $RECONCILE_SECRET ou
 *            en-tête x-reconcile-secret).
 */

function authorize(req: Request): boolean {
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET;
  const reconcileSecret = process.env.RECONCILE_SECRET;

  if (cronSecret && bearer === cronSecret) return true;
  if (reconcileSecret) {
    if (bearer === reconcileSecret) return true;
    if (req.headers.get("x-reconcile-secret") === reconcileSecret) return true;
  }
  return false;
}

async function runReconcile() {
  const admin = createAdminClient();

  const { data: pendings, error } = await admin
    .from("payments")
    .select("idempotency_key, order_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let confirmed = 0;
  let stillPending = 0;
  const errors: string[] = [];

  for (const p of pendings ?? []) {
    try {
      // idempotency_key === order.id === orderId envoyé à MonCash.
      const mc = await retrieveOrderPayment(p.idempotency_key);
      if (isSuccessful(mc) && mc) {
        const { error: rpcErr } = await admin.rpc("confirm_payment", {
          p_idempotency_key: p.idempotency_key,
          p_provider_ref: mc.transactionId,
          p_raw: mc as unknown as Record<string, unknown>,
        });
        if (rpcErr) errors.push(`${p.order_id}: ${rpcErr.message}`);
        else confirmed++;
      } else {
        stillPending++;
      }
    } catch (e) {
      errors.push(`${p.order_id}: ${e instanceof Error ? e.message : "err"}`);
    }
  }

  return NextResponse.json({
    scanned: pendings?.length ?? 0,
    confirmed,
    stillPending,
    errors,
  });
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return runReconcile();
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return runReconcile();
}
