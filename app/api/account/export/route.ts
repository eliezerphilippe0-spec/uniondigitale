import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/account/export
 * Portabilité (RGPD Art. 15/20) : renvoie l'ensemble des données de l'utilisateur
 * connecté au format JSON téléchargeable. Lecture via service role, strictement
 * bornée à ses propres données (buyer_id / seller_id / owner_id = user.id).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [profile, products, orders, wallet] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    admin.from("products").select("*").eq("seller_id", user.id),
    admin.from("orders").select("*").eq("buyer_id", user.id),
    admin.from("wallets").select("*").eq("owner_id", user.id).maybeSingle(),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile: profile.data ?? null,
    products_as_seller: products.data ?? [],
    orders_as_buyer: orders.data ?? [],
    wallet: wallet.data ?? null,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mes-donnees-zabelie.json"',
      "Cache-Control": "no-store",
    },
  });
}
