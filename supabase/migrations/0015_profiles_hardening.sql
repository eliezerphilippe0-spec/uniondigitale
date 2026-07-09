-- Zabelie Digi — Durcissement RLS de `profiles` (audit sécurité)
-- Corrige trois failles issues d'un même angle mort : les policies de `profiles`
-- s'appliquent PAR LIGNE, jamais PAR COLONNE. Ajouter une colonne sensible à une
-- table dont la policy est `using(true)` / sans `with check` l'expose ou la rend
-- modifiable automatiquement.
--
--   [1] Auto-promotion admin : un utilisateur pouvait PATCH son propre profil
--       (role='admin') via la clé anon publique, en contournant /api/profile.
--   [2] Fraude commission : idem avec tier='elite' (commission 10 % → 6 %).
--   [3] Fuite de localisation : country_code/region_code (0007/0008) étaient
--       lisibles publiquement au niveau individuel via la policy public_read.

-- ─────────────────── [1][2] role & tier non modifiables côté client ───────────
-- Un BEFORE trigger neutralise toute tentative d'escalade : seul le service_role
-- (back-office / RPC) peut fixer role et tier. Les sessions anon/authenticated
-- se voient forcer les valeurs par défaut (INSERT) ou l'ancienne valeur (UPDATE),
-- SANS bloquer la mise à jour légitime des autres colonnes (nom, bio, pays…).
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
  elsif tg_op = 'UPDATE' then
    new.role := old.role;      -- role figé côté client
    new.tier := old.tier;      -- tier figé côté client
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileges on profiles;
create trigger trg_protect_profile_privileges
  before insert or update on profiles
  for each row execute function protect_profile_privileges();

-- Défense en profondeur : la mise à jour reste bornée à sa propre ligne.
drop policy if exists "profiles_self_update" on profiles;
create policy "profiles_self_update"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─────────────────── [3] lecture publique restreinte aux colonnes sûres ───────
-- La RLS ne filtre pas les colonnes : on le fait via des GRANTs colonne. On révoque
-- le SELECT « toutes colonnes » à anon/authenticated et on ne rouvre que le strict
-- nécessaire au catalogue public et à l'app. country_code / region_code restent
-- lisibles UNIQUEMENT par le service_role (dashboard /admin/geo).
revoke select on profiles from anon, authenticated;
grant  select (id, role, display_name, bio, avatar_url, tier, created_at)
  on profiles to anon, authenticated;
-- Les écritures self (nom, bio, avatar, pays, département) restent permises : on
-- ne révoque PAS les privilèges UPDATE/INSERT — seul le SELECT est restreint.
