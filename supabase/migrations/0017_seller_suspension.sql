-- Zabelie Digi — Suspension réversible de compte (modération admin)
-- Sanction de modération SANS AUCUNE ÉCRITURE MONÉTAIRE (cadre BRH : Zabelie
-- n'est pas dépositaire — on ne gèle, ne débite, ne fige jamais un solde dû ;
-- l'escrow continue de mûrir normalement). La suspension agit sur :
--   • l'accès (ban auth réversible, côté app),
--   • la visibilité catalogue (policy produits ci-dessous),
--   • le décaissement futur (les retraits — déjà bloqués en Vague 1 — devront
--     vérifier suspended_at is null).
-- La remédiation financière d'une fraude passe par refund_order (moyen
-- d'origine + checkpoint humain), commande par commande — jamais par ici.

-- ───────────────────────── colonnes ───────────────────────────
alter table profiles
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by     uuid references profiles (id);

-- NB : ces colonnes ne sont volontairement PAS ajoutées au GRANT SELECT colonne
-- de 0015 → invisibles à anon/authenticated via l'API REST. Seul le service
-- role (back-office, écran « compte suspendu ») les lit.

-- ─────────────── trigger : suspension non modifiable côté client ──────────────
-- Sans ça, profiles_self_update permettrait à un suspendu de se dé-suspendre
-- via PostgREST. Même mécanique que role/tier (0015).
create or replace function protect_profile_privileges()
returns trigger
language plpgsql
as $$
begin
  -- Rôles privilégiés (service_role via PostgREST, migrations) : aucun garde-fou.
  if current_user in (
    'service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin'
  ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'buyer';       -- pas d'auto-attribution admin/creator à l'inscription
    new.tier := 'standard';    -- pas d'auto-attribution elite
    new.suspended_at     := null;
    new.suspended_reason := null;
    new.suspended_by     := null;
  elsif tg_op = 'UPDATE' then
    new.role := old.role;      -- role figé côté client
    new.tier := old.tier;      -- tier figé côté client
    new.suspended_at     := old.suspended_at;     -- suspension figée côté client
    new.suspended_reason := old.suspended_reason;
    new.suspended_by     := old.suspended_by;
  end if;
  return new;
end;
$$;
-- (le trigger trg_protect_profile_privileges de 0015 pointe déjà sur cette fonction)

-- ──────────── catalogue : produits d'un vendeur suspendu masqués ──────────────
-- SECURITY DEFINER : la policy products est évaluée pour anon/authenticated,
-- qui n'ont pas le SELECT sur suspended_at (grants colonne 0015). Le helper
-- contourne proprement, sans réexposer la colonne.
create or replace function seller_is_active(p_seller uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
     where id = p_seller and suspended_at is null
  );
$$;
revoke all on function seller_is_active(uuid) from public;
grant execute on function seller_is_active(uuid) to anon, authenticated, service_role;

-- Réversible par design : à la réactivation (suspended_at → NULL), les produits
-- réapparaissent SANS re-publication. Le vendeur continue de voir ses propres
-- produits (policy products_seller_read_own intacte).
drop policy if exists "products_public_read_published" on products;
create policy "products_public_read_published"
  on products for select
  using (status = 'published' and seller_is_active(seller_id));
