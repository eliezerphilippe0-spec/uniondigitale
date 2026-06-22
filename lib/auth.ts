import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/products";

export type CurrentUser = {
  id: string;
  email: string | null;
  displayName: string;
  role: string;
};

/**
 * Utilisateur courant (côté serveur), ou null. No-op si Supabase non configuré
 * (mode démo) — ne tente alors aucun accès cookies.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "Compte",
    role: profile?.role ?? "buyer",
  };
}
