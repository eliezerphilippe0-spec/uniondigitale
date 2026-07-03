import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { PublishForm } from "@/components/publish-form";
import { UploadAsset } from "@/components/upload-asset";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/products";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendre — Zabelie Digi" };

function Shell({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="bg-grain min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-lg px-5 py-16">
        <h1 className="text-3xl font-black tracking-tight">Vendre sur Zabelie Digi</h1>
        {subtitle && <p className="mt-2 text-sm text-mist">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default async function VendrePage() {
  if (!isSupabaseConfigured()) {
    return (
      <Shell subtitle="Mode démo — connecte Supabase pour publier de vrais produits.">
        <div className="glass rounded-2xl p-6 text-sm text-mist">
          La publication nécessite une base Supabase configurée (voir
          <code className="mx-1 text-cloud">supabase/README.md</code>).
        </div>
      </Shell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell subtitle="Connecte-toi pour publier un produit.">
        <Link
          href="/connexion"
          className="inline-block rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink"
        >
          Se connecter
        </Link>
      </Shell>
    );
  }

  const { data: mineRaw } = await supabase
    .from("products")
    .select("id, slug, title, status, kind, product_assets(id)")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  type MineRow = {
    id: string;
    slug: string;
    title: string;
    status: string;
    kind: string;
    product_assets: { id: string }[];
  };
  const mine = (mineRaw ?? []) as unknown as MineRow[];

  return (
    <Shell subtitle="Publie un produit digital ou une prestation.">
      <div className="glass rounded-2xl p-6">
        <PublishForm />
      </div>

      {mine.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-cloud">Mes produits</h2>
          <ul className="mt-3 space-y-2">
            {mine.map((p) => (
              <li
                key={p.slug}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/produit/${p.slug}`}
                    className="block truncate hover:text-cloud"
                  >
                    {p.title}
                  </Link>
                  <span className="text-xs text-mist">{p.status}</span>
                </div>
                {p.kind === "fichier" ? (
                  <UploadAsset
                    productId={p.id}
                    hasAsset={p.product_assets.length > 0}
                  />
                ) : (
                  <span className="shrink-0 text-xs text-mist">Service</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Shell>
  );
}
