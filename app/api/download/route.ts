import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "product-files"; // bucket privé Supabase Storage

/**
 * GET /api/download?orderId=...
 * Délivre une URL signée vers le fichier livrable — UNIQUEMENT si la commande
 * appartient au demandeur ET qu'elle est payée. Le fichier n'est jamais public.
 */
export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId requis" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Commande payée, appartenant au demandeur.
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, buyer_id, product_id, status")
    .eq("id", orderId)
    .single();

  if (orderErr || !order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }
  if (order.status !== "paid" && order.status !== "delivered") {
    return NextResponse.json({ error: "Paiement non confirmé" }, { status: 403 });
  }

  // Livrable du produit.
  const { data: asset } = await admin
    .from("product_assets")
    .select("storage_path, file_name")
    .eq("product_id", order.product_id)
    .limit(1)
    .single();

  if (!asset) {
    return NextResponse.json(
      { error: "Aucun fichier livrable (produit de type service ?)" },
      { status: 404 }
    );
  }

  // URL signée 5 min.
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(asset.storage_path, 60 * 5, {
      download: asset.file_name,
    });

  if (signErr || !signed) {
    return NextResponse.json(
      { error: "Génération du lien échouée" },
      { status: 500 }
    );
  }

  // Marque la commande comme livrée (best-effort, idempotent).
  await admin.from("orders").update({ status: "delivered" }).eq("id", order.id);

  return NextResponse.json({ url: signed.signedUrl });
}
