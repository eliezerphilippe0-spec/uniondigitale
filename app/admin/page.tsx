import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { AdminProductRow } from "@/components/admin-product-row";
import { AdminRefundButton } from "@/components/admin-refund-button";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/products";
import { formatHTG } from "@/lib/sample-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration — Zabelie Digi" };

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
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

type ProductRow = {
  id: string;
  title: string;
  status: string;
  seller: { display_name: string } | { display_name: string }[] | null;
};

type PaymentRow = {
  status: string;
  created_at: string;
  provider_ref: string | null;
  order: { amount_htg: number } | { amount_htg: number }[] | null;
};

type OrderRow = {
  id: string;
  status: string;
  amount_htg: number;
  created_at: string;
  product: { title: string } | { title: string }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function AdminPage() {
  if (!isSupabaseConfigured()) {
    return (
      <Shell title="Administration">
        <p className="mt-4 text-sm text-mist">
          Mode démo — connecte Supabase pour accéder au back-office.
        </p>
      </Shell>
    );
  }

  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return (
      <Shell title="Administration">
        <p className="mt-4 text-sm text-mist">
          Accès réservé aux administrateurs.{" "}
          {!user && (
            <Link href="/connexion" className="text-cloud underline">
              Se connecter
            </Link>
          )}
        </p>
        <p className="mt-2 text-xs text-mist">
          Pour devenir admin : passer <code>profiles.role = &apos;admin&apos;</code> en base.
        </p>
      </Shell>
    );
  }

  const admin = createAdminClient();

  const [
    { data: prods },
    { data: pays },
    { data: paidOrders },
    pendingRes,
    { data: recentOrders },
  ] = await Promise.all([
      admin
        .from("products")
        .select("id, title, status, seller:profiles!products_seller_id_fkey(display_name)")
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("payments")
        .select("status, created_at, provider_ref, order:orders(amount_htg)")
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("orders")
        .select("amount_htg")
        .in("status", ["paid", "delivered"])
        .limit(1000),
      admin
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("orders")
        .select("id, status, amount_htg, created_at, product:products(title)")
        .in("status", ["paid", "delivered", "disputed", "refunded"])
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

  const products = (prods ?? []) as ProductRow[];
  const payments = (pays ?? []) as PaymentRow[];
  const orders = (recentOrders ?? []) as unknown as OrderRow[];
  const gmv = (paidOrders ?? []).reduce((s, o) => s + o.amount_htg, 0);
  const pendingPayments = pendingRes.count ?? 0;

  const stats = [
    { label: "Produits", value: String(products.length) },
    {
      label: "Publiés",
      value: String(products.filter((p) => p.status === "published").length),
    },
    { label: "GMV (payé)", value: formatHTG(gmv) },
    { label: "Paiements en attente", value: String(pendingPayments) },
  ];

  return (
    <Shell title="Back-office">
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-line bg-surface-maroon/70 p-5"
          >
            <p className="metric text-xl font-black text-gradient">{s.value}</p>
            <p className="mt-1 text-xs text-mist">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Modération produits */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Modération des produits</h2>
        {products.length === 0 ? (
          <p className="mt-3 text-sm text-mist">Aucun produit.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {products.map((p) => (
              <AdminProductRow
                key={p.id}
                id={p.id}
                title={p.title}
                seller={one(p.seller)?.display_name ?? "—"}
                status={p.status}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Commandes : remboursement + litiges */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Commandes</h2>
        <p className="mt-1 text-xs text-mist">
          Rembourser annule l&apos;escrow (avant maturité : aucun solde fantôme).
          Les commandes <span className="text-danger-text">disputed</span> (écart
          de montant) sont à examiner.
        </p>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-mist">Aucune commande payée.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {orders.map((o) => {
              const product = Array.isArray(o.product) ? o.product[0] : o.product;
              return (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {product?.title ?? "Produit"}
                    </p>
                    <p className="text-xs text-mist">
                      {formatHTG(o.amount_htg)} ·{" "}
                      {new Date(o.created_at).toLocaleDateString("fr-HT")} ·{" "}
                      <span
                        className={
                          o.status === "disputed"
                            ? "text-danger-text"
                            : o.status === "refunded"
                              ? "text-warning-text"
                              : "text-success-text"
                        }
                      >
                        {o.status}
                      </span>
                    </p>
                  </div>
                  {(o.status === "paid" || o.status === "delivered") && (
                    <AdminRefundButton orderId={o.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Réconciliation paiements */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Paiements récents</h2>
        <p className="mt-1 text-xs text-mist">
          La réconciliation automatique tourne via le cron (/api/reconcile).
        </p>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-mist">Aucun paiement.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {payments.map((p, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm"
              >
                <span className="text-mist">
                  {new Date(p.created_at).toLocaleString("fr-HT")}
                </span>
                <span>{one(p.order)?.amount_htg != null ? formatHTG(one(p.order)!.amount_htg) : "—"}</span>
                <span
                  className={
                    p.status === "confirmed"
                      ? "text-success-text"
                      : p.status === "failed"
                        ? "text-danger-text"
                        : "text-warning-text"
                  }
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}
