import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reviews  { orderId, rating, comment? }
 * Avis VÉRIFIÉ : la commande doit appartenir au demandeur et être payée/livrée.
 * Un seul avis par commande (UNIQUE en base — le rejeu échoue proprement).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  let body: { orderId?: string; rating?: number; comment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!body.orderId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "orderId et note (1–5) requis" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // La commande doit appartenir au demandeur et être payée/livrée.
  const { data: order } = await admin
    .from("orders")
    .select("id, buyer_id, product_id, status")
    .eq("id", body.orderId)
    .single();

  if (!order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }
  if (order.status !== "paid" && order.status !== "delivered") {
    return NextResponse.json(
      { error: "Avis réservé aux achats payés" },
      { status: 403 }
    );
  }

  const { error } = await admin.from("product_reviews").insert({
    product_id: order.product_id,
    buyer_id: user.id,
    order_id: order.id,
    rating,
    comment: body.comment?.trim().slice(0, 1000) || null,
  });

  if (error) {
    // 23505 = unique_violation : déjà un avis pour cette commande.
    const already = error.code === "23505";
    return NextResponse.json(
      { error: already ? "Avis déjà déposé pour cet achat" : error.message },
      { status: already ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
