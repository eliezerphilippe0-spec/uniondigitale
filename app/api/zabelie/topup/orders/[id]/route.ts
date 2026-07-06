import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/zabelie/topup/orders/:id — statut temps réel (polling léger,
 * 3G-friendly : petite réponse JSON). L'acheteur ne voit que SES commandes.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("zabelie_topup_orders")
    .select(
      "id, buyer_id, status, operator, beneficiary_phone, face_value_htg, amount_htg, rail, expected_usd_cents, created_at"
    )
    .eq("id", id)
    .single();

  if (!order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    id: order.id,
    status: order.status,
    operator: order.operator,
    beneficiaryPhone: order.beneficiary_phone,
    faceValueHtg: order.face_value_htg,
    amountHtg: order.amount_htg,
    rail: order.rail,
    expectedUsdCents: order.expected_usd_cents,
    createdAt: order.created_at,
  });
}
