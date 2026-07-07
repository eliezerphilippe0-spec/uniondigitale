import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/profile  { display_name, bio, avatar_url }
 * Met à jour le profil public du créateur connecté (RLS : self update).
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
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    country_code?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const displayName = body.display_name?.trim();
  if (!displayName) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }

  // Pays : ISO-3166 alpha-2 en majuscules, ou vide → NULL.
  const rawCountry = body.country_code?.trim().toUpperCase() || "";
  if (rawCountry && !/^[A-Z]{2}$/.test(rawCountry)) {
    return NextResponse.json({ error: "Code pays invalide" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      bio: body.bio?.trim() || null,
      avatar_url: body.avatar_url?.trim() || null,
      country_code: rawCountry || null,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
