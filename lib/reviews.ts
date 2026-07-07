import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/products";

export type ReviewView = {
  id: string;
  rating: number;
  comment: string | null;
  buyerName: string;
  createdAt: string;
};

/** Avis vérifiés d'un produit (lecture publique via RLS). */
export async function getProductReviews(
  productId: string
): Promise<ReviewView[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("product_reviews")
    .select("id, rating, comment, created_at, buyer:profiles(display_name)")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(20);

  type Row = {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    buyer: { display_name: string } | { display_name: string }[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((r) => {
    const buyer = Array.isArray(r.buyer) ? r.buyer[0] : r.buyer;
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      buyerName: buyer?.display_name ?? "Acheteur",
      createdAt: r.created_at,
    };
  });
}

/** Ids de commandes du lot ayant déjà un avis (pour /mes-achats). */
export async function getReviewedOrderIds(
  orderIds: string[]
): Promise<Set<string>> {
  if (!isSupabaseConfigured() || orderIds.length === 0) return new Set();

  const supabase = await createClient();
  const { data } = await supabase
    .from("product_reviews")
    .select("order_id")
    .in("order_id", orderIds);

  return new Set((data ?? []).map((r) => r.order_id as string));
}
