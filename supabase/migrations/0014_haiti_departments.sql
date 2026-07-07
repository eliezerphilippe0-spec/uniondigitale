-- Zabelie Digi — Zoom Haïti par département (back-office /admin/geo)
-- Marché ciblé : Haïti. On veut voir OÙ sont les TALENTS (créateurs) à l'échelle
-- des 10 départements, en restant agrégé (jamais une position individuelle).
--
-- Cohérent avec 0007 : region_code n'a de sens que si country_code = 'HT'.

-- ───────────────────────── region_code ───────────────────────
-- Département haïtien au format ISO-3166-2 (ex: 'HT-OU' = Ouest), NULL sinon.
alter table profiles
  add column if not exists region_code text
  check (region_code is null or region_code ~ '^HT-[A-Z]{2}$');

create index if not exists profiles_region_idx on profiles (region_code);

-- ───────────────── vue : talents Haïti par département ────────
-- Une ligne par département avec compteurs. '??' = pays Haïti mais département
-- non renseigné. Seuls les profils localisés en Haïti sont pris en compte.
create or replace view analytics_geo_ht as
  select
    coalesce(region_code, '??') as region_code,
    count(*) filter (where role = 'creator')::int as creators,
    count(*)::int                                  as users
  from profiles
  where country_code = 'HT'
  group by 1;

-- ───────────────────────── verrouillage accès ────────────────
revoke all on analytics_geo_ht from anon, authenticated;
grant  select on analytics_geo_ht to service_role;
