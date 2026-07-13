import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfessional } from "@/lib/business";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/business/invoices/[id]/void
 * Annule une facture NON encaissée (la fonction SQL refuse dès paid_htg > 0).
 */
export async function POST(
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
  const pro = await getProfessional(admin, user.id);
  if (!pro) {
    return NextResponse.json({ error: "Espace pro requis." }, { status: 403 });
  }
  const { data: owned } = await admin
    .from("zabelie_biz_invoices")
    .select("id")
    .eq("id", id)
    .eq("professional_id", pro.id)
    .maybeSingle();
  if (!owned) {
    return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });
  }

  const { error } = await admin.rpc("zabelie_biz_void_invoice", { p_invoice: id });
  if (error) {
    return NextResponse.json(
      { error: "Annulation impossible (facture déjà encaissée)." },
      { status: 422 }
    );
  }

  return NextResponse.json({ ok: true });
}
