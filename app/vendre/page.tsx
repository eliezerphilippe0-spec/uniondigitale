import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { PublishForm } from "@/components/publish-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/products";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendre — Zabelie Talent" };

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
        <h1 className="text-3xl font-black tracking-tight">Vendre sur Zabelie Talent</h1>
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
          className="inline-block rounded-xl bg-gradient-to-r from-gold to-amber px-6 py-3 text-sm font-semibold text-ink"
        >
          Se connecter
        </Link>
      </Shell>
    );
  }

  const { data: mine } = await supabase
    .from("products")
    .select("slug, title, status")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <Shell subtitle="Publie un produit digital ou une prestation.">
      <div className="glass rounded-2xl p-6">
        <PublishForm />
      </div>

      {mine && mine.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-cloud">Mes produits</h2>
          <ul className="mt-3 space-y-2">
            {mine.map((p) => (
              <li
                key={p.slug}
                className="flex items-center justify-between rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm"
              >
                <Link href={`/produit/${p.slug}`} className="hover:text-cloud">
                  {p.title}
                </Link>
                <span className="text-xs text-mist">{p.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Shell>
  );
}
