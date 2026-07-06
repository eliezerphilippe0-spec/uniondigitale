import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { retrieveOrderPayment } from "@/lib/moncash";
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
      // MonCash UNIQUEMENT : Stripe se confirme par webhook signé, Zelle par
      // l'admin. Interroger MonCash pour ces rails serait toujours « pending ».
      const { data, error } = await admin
        .from("payments")
        .select("idempotency_key, order_id")
        .eq("status", "pending")
        .eq("rail", "moncash")
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
        p_raw: raw as unknown as Record<string, unknown>,
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
    // Recharges téléphoniques (V-11) — même cron (Hobby = 2 crons max).
    const { reconcileTopups } = await import("@/lib/zabelie-topup/reconcile");
    const topup = await reconcileTopups(createAdminClient()).catch((e) => ({
      error: e instanceof Error ? e.message : "Erreur topup",
    }));
    return NextResponse.json({ ...result, topup });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur" },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
