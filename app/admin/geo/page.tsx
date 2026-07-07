import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { GeoMap, type GeoRow } from "@/components/geo-map";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/products";
import { formatHTG } from "@/lib/sample-data";
import { countryName } from "@/lib/geo/countries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Géo-localisation — Zabelie Talent" };

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

type UserAgg = { country_code: string; role: string; users: number };
type SalesAgg = { country_code: string; orders: number; gmv_htg: number };

export default async function GeoPage() {
  if (!isSupabaseConfigured()) {
    return (
      <Shell title="Géo-localisation">
        <p className="mt-4 text-sm text-mist">
          Mode démo — connecte Supabase pour afficher la carte.
        </p>
      </Shell>
    );
  }

  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return (
      <Shell title="Géo-localisation">
        <p className="mt-4 text-sm text-mist">
          Accès réservé aux administrateurs.{" "}
          {!user && (
            <Link href="/connexion" className="text-cloud underline">
              Se connecter
            </Link>
          )}
        </p>
      </Shell>
    );
  }

  const admin = createAdminClient();
  const [{ data: usersData }, { data: salesData }] = await Promise.all([
    admin.from("analytics_geo_users").select("country_code, role, users"),
    admin.from("analytics_geo_sales").select("country_code, orders, gmv_htg"),
  ]);

  // Fusion par pays (jamais par individu).
  const byIso = new Map<string, GeoRow>();
  const get = (iso: string): GeoRow => {
    let r = byIso.get(iso);
    if (!r) {
      r = { iso, users: 0, creators: 0, gmv: 0, orders: 0 };
      byIso.set(iso, r);
    }
    return r;
  };

  for (const u of (usersData ?? []) as UserAgg[]) {
    const r = get(u.country_code);
    r.users += u.users;
    if (u.role === "creator") r.creators += u.users;
  }
  for (const s of (salesData ?? []) as SalesAgg[]) {
    const r = get(s.country_code);
    r.orders += s.orders;
    r.gmv += s.gmv_htg;
  }

  const rows = [...byIso.values()];
  const totalUsers = rows.reduce((s, r) => s + r.users, 0);
  const totalCreators = rows.reduce((s, r) => s + r.creators, 0);
  const totalGmv = rows.reduce((s, r) => s + r.gmv, 0);
  const countriesCovered = rows.filter(
    (r) => r.iso !== "??" && r.users > 0,
  ).length;
  const unknown = byIso.get("??")?.users ?? 0;

  const top = [...rows]
    .filter((r) => r.iso !== "??")
    .sort((a, b) => b.users - a.users)
    .slice(0, 10);

  const stats = [
    { label: "Utilisateurs", value: String(totalUsers) },
    { label: "Créateurs", value: String(totalCreators) },
    { label: "Pays couverts", value: String(countriesCovered) },
    { label: "GMV (payé)", value: formatHTG(totalGmv) },
  ];

  return (
    <Shell title="Géo-localisation">
      <p className="mt-2 text-sm text-mist">
        D’où viennent nos clients et nos talents.{" "}
        <Link href="/admin" className="text-cloud underline">
          ← Back-office
        </Link>
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-line bg-surface/60 p-5"
          >
            <p className="text-xl font-black text-gradient">{s.value}</p>
            <p className="mt-1 text-xs text-mist">{s.label}</p>
          </div>
        ))}
      </div>

      {totalUsers === 0 ? (
        <p className="mt-10 text-sm text-mist">
          Aucune donnée pour l’instant. La carte se remplira dès que les profils
          renseigneront leur pays.
        </p>
      ) : (
        <>
          <section className="mt-10">
            <GeoMap rows={rows} />
          </section>

          <section className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Top 10 des pays</h2>
              {unknown > 0 && (
                <span className="text-xs text-mist">
                  {unknown} utilisateur{unknown > 1 ? "s" : ""} sans pays
                </span>
              )}
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-surface/60 text-left text-xs text-mist">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pays</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Utilisateurs
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Créateurs
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Commandes
                    </th>
                    <th className="px-4 py-3 text-right font-medium">GMV</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((r) => (
                    <tr key={r.iso} className="border-t border-line">
                      <td className="px-4 py-3 font-medium">
                        {countryName(r.iso)}
                      </td>
                      <td className="px-4 py-3 text-right">{r.users}</td>
                      <td className="px-4 py-3 text-right text-mist">
                        {r.creators}
                      </td>
                      <td className="px-4 py-3 text-right text-mist">
                        {r.orders}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatHTG(r.gmv)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}
