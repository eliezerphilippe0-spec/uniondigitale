import { createClient } from "@/lib/supabase/server";
import { PRODUCTS as SAMPLE, type ProductKind } from "@/lib/sample-data";

/**
 * Vue produit unifiée pour l'UI. Deux sources possibles :
 *   - Supabase (si configuré) — données réelles.
 *   - Données d'exemple (repli) — pour la démo sans base.
 */
export type ProductView = {
  id: string; // uuid (Supabase) ou slug (exemple)
  slug: string;
  title: string;
  creator: string;
  kind: ProductKind;
  category: string;
  priceHTG: number;
  sales: number;
  accent: string;
  blurb: string;
};

const ACCENTS = [
  "from-amber to-magenta",
  "from-violet to-teal",
  "from-gold to-amber",
  "from-magenta to-violet",
  "from-teal to-violet",
  "from-amber to-violet",
];

/** Dégradé déterministe à partir d'une chaîne (produits Supabase sans accent). */
function accentFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return ACCENTS[Math.abs(h) % ACCENTS.length];
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const sampleAsView = (): ProductView[] =>
  SAMPLE.map((p) => ({
    id: p.slug,
    slug: p.slug,
    title: p.title,
    creator: p.creator,
    kind: p.kind,
    category: p.category,
    priceHTG: p.priceHTG,
    sales: p.sales,
    accent: p.accent,
    blurb: p.blurb,
  }));

type Row = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: ProductKind;
  category: string | null;
  price_htg: number;
  sales_count: number;
  seller: { display_name: string } | { display_name: string }[] | null;
};

function rowAsView(r: Row): ProductView {
  const seller = Array.isArray(r.seller) ? r.seller[0] : r.seller;
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    creator: seller?.display_name ?? "Créateur",
    kind: r.kind,
    category: r.category ?? "Divers",
    priceHTG: r.price_htg,
    sales: r.sales_count,
    accent: accentFor(r.slug),
    blurb: r.description ?? "",
  };
}

const SELECT =
  "id, slug, title, description, kind, category, price_htg, sales_count, seller:profiles!products_seller_id_fkey(display_name)";

/** Catalogue des produits publiés. Repli sur les données d'exemple si pas de base. */
export async function getPublishedProducts(): Promise<ProductView[]> {
  if (!isSupabaseConfigured()) return sampleAsView();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(SELECT)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error || !data) return sampleAsView();
  return (data as unknown as Row[]).map(rowAsView);
}

export async function getProductView(
  slug: string
): Promise<ProductView | undefined> {
  if (!isSupabaseConfigured()) {
    return sampleAsView().find((p) => p.slug === slug);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !data) return sampleAsView().find((p) => p.slug === slug);
  return rowAsView(data as unknown as Row);
}
