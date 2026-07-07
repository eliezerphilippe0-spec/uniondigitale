import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/payment-utils";
import {
  backfillCountry,
  countryFromRequest,
} from "@/lib/geo/country-backfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/products  { title, description, kind, category, priceHTG }
 * Crée (et publie) un produit pour le créateur connecté.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  let body: {
    title?: string;
    description?: string;
    kind?: "fichier" | "service";
    category?: string;
    priceHTG?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { title, description, kind, category } = body;
  const price = Number(body.priceHTG);
  if (!title || !kind || !Number.isFinite(price) || price < 0) {
    return NextResponse.json(
      { error: "Champs requis : titre, type, prix valide." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // S'assure que le profil existe et passe en rôle créateur.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) {
    await admin.from("profiles").update({ role: "creator" }).eq("id", user.id);
  } else {
    await admin.from("profiles").insert({
      id: user.id,
      display_name: user.email?.split("@")[0] ?? "Créateur",
      role: "creator",
    });
  }

  // Backfill best-effort du pays VENDEUR (dashboard /admin/geo) via géo-IP, si
  // vide. Non bloquant, ne remplace jamais un pays déjà renseigné au profil.
  await backfillCountry(admin, user.id, countryFromRequest(req));

  const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`;

  const { data: product, error } = await admin
    .from("products")
    .insert({
      seller_id: user.id,
      slug,
      title,
      description: description ?? null,
      kind,
      category: category ?? null,
      price_htg: Math.round(price),
      status: "published",
    })
    .select("slug")
    .single();

  if (error || !product) {
    return NextResponse.json(
      { error: error?.message ?? "Création échouée" },
      { status: 500 }
    );
  }

  return NextResponse.json({ slug: product.slug });
}
