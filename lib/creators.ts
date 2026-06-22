import { createClient } from "@/lib/supabase/server";
import {
  isSupabaseConfigured,
  getProductsBySeller,
  type ProductView,
} from "@/lib/products";

export type CreatorProfile = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  products: ProductView[];
};

export async function getCreator(id: string): Promise<CreatorProfile | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, bio, avatar_url")
    .eq("id", id)
    .maybeSingle();

  if (!profile) return null;

  const products = await getProductsBySeller(id);

  return {
    id: profile.id,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    products,
  };
}
