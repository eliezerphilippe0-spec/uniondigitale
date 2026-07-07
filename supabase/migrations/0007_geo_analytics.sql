-- Zabelie Talent — Géo-analytics back-office (Vague 1)
-- Objectif : dashboard interne « d'où viennent nos clients/talents », AGRÉGÉ
-- PAR PAYS uniquement. Aucune position individuelle, aucune coordonnée en base.
--
-- Choix privacy (cf. décision produit « dashboard interne, granularité pays ») :
--   • On stocke un simple code pays ISO-3166 alpha-2 sur profiles.
--   • Les vues n'exposent QUE des comptes agrégés (jamais un identifiant).
--   • Accès révoqué à anon/authenticated : seul le service role (back-office
--     admin, garde role='admin' en app) peut lire ces agrégats.

-- ───────────────────────── country_code ───────────────────────
-- ISO-3166-1 alpha-2 en MAJUSCULES (ex: 'HT', 'SN'), NULL tant que non renseigné.
alter table profiles
  add column if not exists country_code text
  check (country_code is null or country_code ~ '^[A-Z]{2}$');

create index if not exists profiles_country_idx on profiles (country_code);

-- ───────────────────── vue : talents/clients par pays ─────────
-- Une ligne par (pays, rôle) avec un simple compteur. '??' = non renseigné.
create or replace view analytics_geo_users as
  select
    coalesce(country_code, '??') as country_code,
    role,
    count(*)::int                as users
  from profiles
  group by 1, 2;

-- ───────────────────── vue : ventes par pays (acheteur) ───────
-- GMV et nombre de commandes honorées, ventilés par pays de l'ACHETEUR.
create or replace view analytics_geo_sales as
  select
    coalesce(b.country_code, '??')      as country_code,
    count(*)::int                       as orders,
    coalesce(sum(o.amount_htg), 0)::bigint as gmv_htg
  from orders o
  join profiles b on b.id = o.buyer_id
  where o.status in ('paid', 'delivered')
  group by 1;

-- ───────────────────────── verrouillage accès ────────────────
-- Les vues sont en « definer rights » (contournent la RLS des tables sources) :
-- on ferme donc explicitement l'accès public/API. Lecture réservée au back-office.
revoke all on analytics_geo_users, analytics_geo_sales from anon, authenticated;
grant  select on analytics_geo_users, analytics_geo_sales to service_role;
