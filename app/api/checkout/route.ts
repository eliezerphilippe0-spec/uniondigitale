import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPayment } from "@/lib/moncash";
import { withinRailCap, railCap } from "@/lib/payment-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/checkout  { productId }
 * Crée une commande + un paiement (pending, clé d'idempotence) puis renvoie
 * l'URL de redirection MonCash. Aucune livraison/crédit ici : tout passe par la
 * confirmation serveur-à-serveur (return/réconciliateur → confirm_payment).
 */
export async function POST(req: Request) {
  let productId: string | undefined;
  try {
    ({ productId } = await req.json());
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!productId) {
    return NextResponse.json({ error: "productId requis" }, { status: 400 });
  }

  // Acheteur authentifié.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Produit publié uniquement, prix = source de vérité serveur.
  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("id, price_htg, status")
    .eq("id", productId)
    .eq("status", "published")
    .single();

  if (prodErr || !product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  // Plafond du rail : on bloque AVANT de créer la commande (message clair plutôt
  // qu'un échec brutal côté opérateur).
  const rail = "moncash";
  if (!withinRailCap(product.price_htg, rail)) {
    return NextResponse.json(
      {
        error: `Montant supérieur au plafond MonCash (${railCap(rail)} HTG) par transaction.`,
      },
      { status: 422 }
    );
  }

  // Commande (pending).
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      buyer_id: user.id,
      product_id: product.id,
      amount_htg: product.price_htg,
      status: "pending",
    })
    .select("id, amount_htg")
    .single();

  if (orderErr || !order) {
    return NextResponse.json(
      { error: "Création commande échouée" },
      { status: 500 }
    );
  }

  // Paiement (pending). idempotency_key = order.id (1 paiement/commande).
  const { error: payErr } = await admin.from("payments").insert({
    order_id: order.id,
    rail: "moncash",
    idempotency_key: order.id,
    status: "pending",
  });
  if (payErr) {
    return NextResponse.json(
      { error: "Création paiement échouée" },
      { status: 500 }
    );
  }

  // Session MonCash. orderId envoyé = notre order.id (clé de rapprochement).
  try {
    const { redirectUrl, paymentToken } = await createPayment(
      order.id,
      order.amount_htg
    );
    await admin
      .from("payments")
      .update({ raw: { payment_token: paymentToken } })
      .eq("order_id", order.id);

    return NextResponse.json({ redirectUrl, orderId: order.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur MonCash" },
      { status: 502 }
    );
  }
}
