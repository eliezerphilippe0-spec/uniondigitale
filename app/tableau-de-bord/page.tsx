import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/products";
import { formatHTG } from "@/lib/sample-data";
import { ProfileForm } from "@/components/profile-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tableau de bord — Zabelie Digi" };

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-grain min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-5 py-16">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

type Sale = {
  id: string;
  amount_htg: number;
  created_at: string;
  status: string;
  product: { title: string } | { title: string }[] | null;
};

type ProductRow = {
  slug: string;
  title: string;
  status: string;
  sales_count: number;
};

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <Shell title="Tableau de bord">
        <p className="mt-4 text-sm text-mist">
          Mode démo — connecte Supabase pour voir tes revenus et tes ventes.
        </p>
      </Shell>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return (
      <Shell title="Tableau de bord">
        <p className="mt-4 text-sm text-mist">Connecte-toi pour accéder à ton tableau de bord.</p>
        <Link
          href="/connexion"
          className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-ink"
        >
          Se connecter
        </Link>
      </Shell>
    );
  }

  let balance = 0;
  let pending = 0;
  let products: ProductRow[] = [];
  let sales: Sale[] = [];
  let profile = { display_name: user.displayName, bio: "", avatar_url: "" };

  try {
    const admin = createAdminClient();

    const { data: wallet } = await admin
      .from("wallets")
      .select("balance_htg, pending_htg")
      .eq("owner_id", user.id)
      .maybeSingle();
    balance = wallet?.balance_htg ?? 0;
    pending = wallet?.pending_htg ?? 0;

    const { data: prof } = await admin
      .from("profiles")
      .select("display_name, bio, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (prof) {
      profile = {
        display_name: prof.display_name ?? user.displayName,
        bio: prof.bio ?? "",
        avatar_url: prof.avatar_url ?? "",
      };
    }

    const { data: prods } = await admin
      .from("products")
      .select("id, slug, title, status, sales_count")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    products = (prods ?? []) as ProductRow[];

    const productIds = (prods ?? []).map((p) => (p as { id: string }).id);
    if (productIds.length > 0) {
      const { data: orders } = await admin
        .from("orders")
        .select("id, amount_htg, created_at, status, product:products(title)")
        .in("product_id", productIds)
        .in("status", ["paid", "delivered"])
        .order("created_at", { ascending: false })
        .limit(8);
      sales = (orders ?? []) as unknown as Sale[];
    }
  } catch {
    return (
      <Shell title={`Bonjour, ${user.displayName}`}>
        <p className="mt-4 text-sm text-danger-text">
          Données indisponibles (clé service role manquante côté serveur ?).
        </p>
      </Shell>
    );
  }

  const totalSales = products.reduce((s, p) => s + p.sales_count, 0);
  const published = products.filter((p) => p.status === "published").length;

  const stats = [
    { label: "Disponible", value: formatHTG(balance) },
    { label: "En attente (J+7)", value: formatHTG(pending) },
    { label: "Ventes totales", value: String(totalSales) },
    { label: "Produits publiés", value: String(published) },
  ];

  return (
    <Shell title={`Bonjour, ${user.displayName}`}>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-line bg-surface-maroon/70 p-5"
          >
            <p className="metric text-2xl font-extrabold text-gradient">{s.value}</p>
            <p className="mt-1 text-xs text-mist">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface-brown/50 p-5 text-sm text-mist">
        Chaque vente confirmée est créditée <strong>en attente</strong> et devient{" "}
        <strong>disponible 7 jours plus tard</strong> (fenêtre anti-fraude /
        remboursement). Les retraits du solde disponible arriveront avec la
        conformité BRH (Vague 2).
      </div>

      {/* Ventes récentes */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Ventes récentes</h2>
        {sales.length === 0 ? (
          <p className="mt-3 text-sm text-mist">Aucune vente pour l'instant.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {sales.map((o) => {
              const product = Array.isArray(o.product) ? o.product[0] : o.product;
              return (
                <li
                  key={o.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm"
                >
                  <span>{product?.title ?? "Produit"}</span>
                  <span className="text-mist">
                    {formatHTG(o.amount_htg)} ·{" "}
                    {new Date(o.created_at).toLocaleDateString("fr-HT")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Mes produits */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mes produits</h2>
          <Link
            href="/vendre"
            className="text-sm text-mist transition hover:text-cloud"
          >
            + Publier
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="mt-3 text-sm text-mist">
            Aucun produit.{" "}
            <Link href="/vendre" className="text-cloud underline">
              Publier le premier
            </Link>
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {products.map((p) => (
              <li
                key={p.slug}
                className="flex items-center justify-between rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm"
              >
                <Link href={`/produit/${p.slug}`} className="hover:text-cloud">
                  {p.title}
                </Link>
                <span className="text-xs text-mist">
                  {p.sales_count} ventes · {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Profil public */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mon profil public</h2>
          <Link
            href={`/createur/${user.id}`}
            className="text-sm text-mist transition hover:text-cloud"
          >
            Voir mon profil →
          </Link>
        </div>
        <div className="mt-4 max-w-lg rounded-2xl border border-line bg-surface/60 p-5">
          <ProfileForm initial={profile} />
        </div>
      </section>
    </Shell>
  );
}
