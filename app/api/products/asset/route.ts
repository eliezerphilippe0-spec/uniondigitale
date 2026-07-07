import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSuspension } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "product-files";
const MAX_BYTES = 50 * 1024 * 1024; // 50 Mo

/**
 * POST /api/products/asset  (multipart : productId, file)
 * Envoie le fichier livrable d'un produit dans le bucket privé et enregistre
 * product_assets. Réservé au vendeur propriétaire du produit. Upload via service
 * role : le fichier n'est jamais public (livraison par URL signée après paiement).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  // Compte suspendu (modération) : action bloquée même si la session est
  // encore active (le ban auth ne coupe la session qu'au refresh du token).
  if (await getSuspension(user.id)) {
    return NextResponse.json(
      { error: "Compte suspendu — action non autorisée." },
      { status: 403 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire invalide" }, { status: 400 });
  }

  const productId = form.get("productId");
  const file = form.get("file");
  if (typeof productId !== "string" || !(file instanceof File)) {
    return NextResponse.json(
      { error: "productId et file requis" },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Fichier vide" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (max 50 Mo)" },
      { status: 413 }
    );
  }

  const admin = createAdminClient();

  // Propriété du produit.
  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("id, seller_id, kind")
    .eq("id", productId)
    .single();
  if (prodErr || !product || product.seller_id !== user.id) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${product.id}/${safeName}`;

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Un seul livrable par produit pour l'instant : on remplace l'éventuel ancien.
  await admin.from("product_assets").delete().eq("product_id", product.id);
  const { error: insErr } = await admin.from("product_assets").insert({
    product_id: product.id,
    storage_path: path,
    file_name: safeName,
    size_bytes: file.size,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, file_name: safeName });
}
