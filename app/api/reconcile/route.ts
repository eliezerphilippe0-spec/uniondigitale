import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { retrieveOrderPayment, redactPayment } from "@/lib/moncash";
import { reconcilePayments, type ReconcileDeps } from "@/lib/reconcile";

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
 *
 * La logique d'orchestration vit dans lib/reconcile.ts (testée unitairement).
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

function liveDeps(): ReconcileDeps {
  const admin = createAdminClient();
  return {
    listPending: async () => {
      const { data, error } = await admin
        .from("payments")
        .select("idempotency_key, order_id")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    retrieve: (orderId) => retrieveOrderPayment(orderId),
    confirm: async ({ idempotencyKey, providerRef, amount, raw }) => {
      const { data, error } = await admin.rpc("confirm_payment", {
        p_idempotency_key: idempotencyKey,
        p_provider_ref: providerRef,
        p_raw: redactPayment(raw),
        p_amount: amount,
      });
      if (error) return { error: error.message };
      return { status: data?.status };
    },
  };
}

async function handle(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const result = await reconcilePayments(liveDeps());
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur" },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
