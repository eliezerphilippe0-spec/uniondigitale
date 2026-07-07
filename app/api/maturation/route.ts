import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Job de maturation : fait passer les soldes en attente arrivés à échéance
 * (J+7) vers le solde disponible. À déclencher par cron.
 *   - GET  → cron Vercel (Authorization: Bearer $CRON_SECRET)
 *   - POST → appel manuel (Authorization: Bearer $RECONCILE_SECRET)
 */
function authorize(req: Request): boolean {
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  const cron = process.env.CRON_SECRET;
  const manual = process.env.RECONCILE_SECRET;
  if (cron && bearer === cron) return true;
  if (manual && (bearer === manual || req.headers.get("x-reconcile-secret") === manual))
    return true;
  return false;
}

async function handle(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("mature_wallets");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Purge RGPD des payloads opérateur clôturés & anciens (best-effort : ne doit
    // pas faire échouer la maturation).
    const { data: purged } = await admin.rpc("purge_payment_raw", { p_days: 90 });
    return NextResponse.json({ matured: data ?? 0, purged: purged ?? 0 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur" },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
