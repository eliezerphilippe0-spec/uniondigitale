-- ============================================================================
-- 0020 — Zabelie Points & Rewards (programme de fidélité NON monétaire)
-- ============================================================================
-- ⚠️ BROUILLON — NE PAS DÉPLOYER sans retour BRH sur le PRINCIPE MÊME d'un
--    programme de fidélité acheteur (docs/02-DECISIONS, décision porteur).
--
-- Principe : JAMAIS de solde en gourdes stocké côté acheteur. Les points n'ont
-- aucune valeur cash directe — ils ne se convertissent qu'en coupons de remise
-- en POURCENTAGE, à usage unique, plafonnés, et dont la valeur vient TOUJOURS
-- d'un catalogue serveur (rewards_catalog), jamais du client.
--
-- Invariants durs respectés (miroir du money-path) :
--   • Aucune valeur/coût fourni par le client — tout vient de rewards_catalog.
--   • Toute écriture passe par une fonction SECURITY DEFINER révoquée du client
--     (service_role uniquement), jamais par un accès table direct.
--   • Ledger append-only (règles no-update/no-delete), lots FIFO immuables.
--   • search_path figé sur toutes les fonctions ET le trigger.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUMS
-- ----------------------------------------------------------------------------

create type points_reason as enum (
  'purchase',
  'review_text',
  'review_photo',
  'review_video',
  'referral_bonus_referrer',
  'referral_bonus_referee',
  'welcome_bonus',
  'challenge_completed',
  'promo_boost',
  'coupon_redemption',   -- valeur négative
  'expiration',          -- valeur négative
  'admin_adjustment'
);

create type coupon_status as enum ('active', 'redeemed', 'expired', 'cancelled');

-- BRH : uniquement 'percentage'. Un montant fixe en HTG serait une valeur
-- monétaire absolue transférable — trop proche d'un quasi-solde / instrument de
-- paiement. Le rabais en % n'a de valeur qu'appliqué à un prix.
create type coupon_type as enum ('percentage');

-- ----------------------------------------------------------------------------
-- 2. REWARDS_CATALOG (source de vérité SERVEUR du couple coût↔valeur)
-- La rédemption ne reçoit qu'un reward_id : impossible pour le client de
-- choisir « 1 point = 90 % ». Le catalogue est administré en service_role.
-- ----------------------------------------------------------------------------

create table rewards_catalog (
  id                  uuid primary key default gen_random_uuid(),
  label               text not null,                       -- ex. « -10 % sur une commande »
  points_cost         integer not null check (points_cost > 0),
  discount_percentage integer not null check (discount_percentage between 1 and 90),
  max_discount_htg    integer check (max_discount_htg is null or max_discount_htg > 0),
  coupon_validity_days integer not null default 30 check (coupon_validity_days > 0),
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

-- Paliers de départ (validés porteur avant activation — placeholder).
insert into rewards_catalog (label, points_cost, discount_percentage, max_discount_htg) values
  ('-5 % sur une commande',  250,  5,  500),
  ('-10 % sur une commande', 500, 10, 1000),
  ('-15 % sur une commande', 900, 15, 1500);

-- ----------------------------------------------------------------------------
-- 3. POINTS_BATCHES — expiration FIFO par lot, sans toucher le ledger
-- ----------------------------------------------------------------------------

create table points_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  points_earned integer not null check (points_earned > 0),
  points_remaining integer not null check (points_remaining >= 0),
  reason points_reason not null,
  order_id uuid references orders(id),
  expires_at timestamptz not null,
  expired boolean not null default false,
  created_at timestamptz not null default now(),
  constraint remaining_lte_earned check (points_remaining <= points_earned)
);

create index idx_points_batches_user_active
  on points_batches (user_id, expires_at)
  where points_remaining > 0 and not expired;

-- ----------------------------------------------------------------------------
-- 4. POINTS_LEDGER (append-only strict — jamais UPDATE ni DELETE)
-- ----------------------------------------------------------------------------

create table points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  batch_id uuid references points_batches(id),
  delta integer not null,               -- + = gain, − = dépense/expiration
  balance_after integer not null check (balance_after >= 0),
  reason points_reason not null,
  order_id uuid references orders(id),
  coupon_id uuid,                       -- coupons.id si reason = coupon_redemption
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_points_ledger_user on points_ledger (user_id, created_at desc);

create rule points_ledger_no_update as on update to points_ledger do instead nothing;
create rule points_ledger_no_delete as on delete to points_ledger do instead nothing;

-- ----------------------------------------------------------------------------
-- 5. POINTS_BALANCES (cache dénormalisé, maintenu par trigger)
-- ----------------------------------------------------------------------------

create table points_balances (
  user_id uuid primary key references auth.users(id),
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create function fn_points_ledger_update_balance()
returns trigger
language plpgsql
security definer
set search_path = public          -- figé (cohérence 0018 : advisor search_path)
as $$
begin
  -- Le candidat d'INSERT est validé par le CHECK (balance >= 0) AVANT que
  -- ON CONFLICT ne bascule sur l'UPDATE : un delta négatif brut y échouerait.
  -- greatest(delta,0) garde le candidat valide ; un delta négatif n'arrive
  -- jamais sans ligne préexistante (on ne dépense/expire pas des points
  -- jamais gagnés) → la vraie arithmétique se fait dans la branche UPDATE.
  insert into points_balances (user_id, balance, updated_at)
  values (new.user_id, greatest(new.delta, 0), now())
  on conflict (user_id)
  do update set
    balance = points_balances.balance + new.delta,
    updated_at = now();
  return new;
end;
$$;

create trigger trg_points_ledger_update_balance
  after insert on points_ledger
  for each row execute function fn_points_ledger_update_balance();

-- ----------------------------------------------------------------------------
-- 6. COUPONS (seule récompense convertible — % à usage unique, plafonné)
-- La valeur est COPIÉE depuis rewards_catalog à la rédemption (figée), jamais
-- fournie par le client.
-- ----------------------------------------------------------------------------

create table coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  reward_id uuid not null references rewards_catalog(id),
  code text not null unique,
  type coupon_type not null default 'percentage',
  discount_percentage integer not null check (discount_percentage between 1 and 90),
  max_discount_htg integer,              -- plafond absolu figé depuis le catalogue
  points_cost integer not null check (points_cost > 0),
  status coupon_status not null default 'active',
  order_id uuid references orders(id),   -- rempli à l'application au checkout
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);

create index idx_coupons_user_active
  on coupons (user_id, status)
  where status = 'active';

-- ----------------------------------------------------------------------------
-- 7. RLS — lecture seule côté client ; écriture = service_role via RPC
-- ----------------------------------------------------------------------------

alter table rewards_catalog enable row level security;
alter table points_batches  enable row level security;
alter table points_ledger   enable row level security;
alter table points_balances enable row level security;
alter table coupons         enable row level security;

-- Catalogue : lecture publique des paliers actifs (affichage « échange »).
create policy rewards_catalog_read_active on rewards_catalog
  for select using (active);

create policy points_batches_select_own on points_batches
  for select using (auth.uid() = user_id);
create policy points_ledger_select_own on points_ledger
  for select using (auth.uid() = user_id);
create policy points_balances_select_own on points_balances
  for select using (auth.uid() = user_id);
create policy coupons_select_own on coupons
  for select using (auth.uid() = user_id);

-- Défense en profondeur : révocation explicite des écritures directes.
revoke insert, update, delete on rewards_catalog from authenticated, anon;
revoke insert, update, delete on points_batches  from authenticated, anon;
revoke insert, update, delete on points_ledger   from authenticated, anon;
revoke insert, update, delete on points_balances from authenticated, anon;
revoke insert, update, delete on coupons         from authenticated, anon;

-- ----------------------------------------------------------------------------
-- 8. RPC — award_points
-- Attribution de points (achat, avis, parrainage…). service_role uniquement.
-- ----------------------------------------------------------------------------

create function award_points(
  p_user_id uuid,
  p_points integer,
  p_reason points_reason,
  p_order_id uuid default null,
  p_expires_in_days integer default 90,
  p_metadata jsonb default '{}'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_new_balance integer;
begin
  if p_points <= 0 then
    raise exception 'award_points: points must be positive';
  end if;

  -- Verrou du solde AVANT lecture : balance_after cohérent même sous
  -- attributions concurrentes (crée la ligne à 0 si absente).
  insert into points_balances (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  select balance into v_new_balance
  from points_balances
  where user_id = p_user_id
  for update;

  v_new_balance := v_new_balance + p_points;

  insert into points_batches
    (user_id, points_earned, points_remaining, reason, order_id, expires_at)
  values
    (p_user_id, p_points, p_points, p_reason, p_order_id,
     now() + make_interval(days => p_expires_in_days))
  returning id into v_batch_id;

  insert into points_ledger
    (user_id, batch_id, delta, balance_after, reason, order_id, metadata)
  values
    (p_user_id, v_batch_id, p_points, v_new_balance, p_reason, p_order_id, p_metadata);

  return v_batch_id;
end;
$$;
revoke all on function award_points(uuid, integer, points_reason, uuid, integer, jsonb)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. RPC — redeem_points_for_coupon
-- N'accepte qu'un reward_id : coût ET valeur viennent de rewards_catalog.
-- Verrou du solde (anti double-rédemption), consommation FIFO des lots.
-- ----------------------------------------------------------------------------

create function redeem_points_for_coupon(
  p_user_id   uuid,
  p_reward_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward   rewards_catalog;
  v_balance  integer;
  v_to_deduct integer;
  v_batch    record;
  v_deduct   integer;
  v_coupon_id uuid;
  v_new_balance integer;
  v_code     text;
begin
  -- Récompense = source de vérité serveur (coût, %, plafond, validité).
  select * into v_reward from rewards_catalog
   where id = p_reward_id and active;
  if not found then
    raise exception 'redeem_points_for_coupon: récompense inconnue ou inactive';
  end if;

  -- Verrou du solde : sérialise les rédemptions concurrentes.
  select balance into v_balance
    from points_balances where user_id = p_user_id for update;
  if v_balance is null or v_balance < v_reward.points_cost then
    raise exception 'redeem_points_for_coupon: solde de points insuffisant';
  end if;

  -- Consommation FIFO des lots actifs (les plus proches de l'expiration).
  v_to_deduct := v_reward.points_cost;
  for v_batch in
    select id, points_remaining
      from points_batches
     where user_id = p_user_id and points_remaining > 0 and not expired
     order by expires_at asc
     for update
  loop
    exit when v_to_deduct <= 0;
    v_deduct := least(v_batch.points_remaining, v_to_deduct);
    update points_batches
       set points_remaining = points_remaining - v_deduct
     where id = v_batch.id;
    v_to_deduct := v_to_deduct - v_deduct;
  end loop;

  if v_to_deduct > 0 then
    raise exception 'redeem_points_for_coupon: incohérence lots/solde — rédemption annulée';
  end if;

  v_code := 'ZBR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  v_new_balance := v_balance - v_reward.points_cost;

  -- Valeur du coupon FIGÉE depuis le catalogue (jamais du client).
  insert into coupons
    (user_id, reward_id, code, discount_percentage, max_discount_htg,
     points_cost, expires_at)
  values
    (p_user_id, v_reward.id, v_code, v_reward.discount_percentage,
     v_reward.max_discount_htg, v_reward.points_cost,
     now() + make_interval(days => v_reward.coupon_validity_days))
  returning id into v_coupon_id;

  insert into points_ledger
    (user_id, delta, balance_after, reason, coupon_id, metadata)
  values
    (p_user_id, -v_reward.points_cost, v_new_balance, 'coupon_redemption',
     v_coupon_id, jsonb_build_object('coupon_code', v_code, 'reward_id', v_reward.id));

  return v_coupon_id;
end;
$$;
revoke all on function redeem_points_for_coupon(uuid, uuid)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. RPC — apply_coupon_to_order (branchement checkout)
-- Revalide TOUT côté serveur (propriété, statut, expiration), consomme le
-- coupon (usage unique) et renvoie le % + plafond figés. Le checkout calcule
-- le prix remisé à partir de CES valeurs — jamais d'un montant envoyé par le
-- client. Renvoie NULL si le coupon est invalide (le checkout facture plein).
-- ----------------------------------------------------------------------------

create function apply_coupon_to_order(
  p_user_id uuid,
  p_code    text,
  p_order_id uuid
) returns table (discount_percentage integer, max_discount_htg integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon coupons;
begin
  -- Verrou du coupon : un seul checkout peut le consommer.
  select * into v_coupon from coupons
   where code = p_code and user_id = p_user_id
   for update;

  if not found
     or v_coupon.status <> 'active'
     or v_coupon.expires_at < now() then
    return;  -- aucune ligne → coupon invalide, le checkout facture plein tarif
  end if;

  update coupons
     set status = 'redeemed', order_id = p_order_id, redeemed_at = now()
   where id = v_coupon.id;

  discount_percentage := v_coupon.discount_percentage;
  max_discount_htg    := v_coupon.max_discount_htg;
  return next;
end;
$$;
revoke all on function apply_coupon_to_order(uuid, text, uuid)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11. RPC — expire_points_batch_job (cron quotidien)
-- ----------------------------------------------------------------------------

create function expire_points_batch_job() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_new_balance integer;
  v_total integer := 0;
begin
  for v_batch in
    select * from points_batches
     where not expired and expires_at < now() and points_remaining > 0
     for update
  loop
    update points_batches set expired = true where id = v_batch.id;

    select greatest(coalesce(balance, 0) - v_batch.points_remaining, 0)
      into v_new_balance
      from points_balances where user_id = v_batch.user_id;

    insert into points_ledger
      (user_id, batch_id, delta, balance_after, reason, metadata)
    values
      (v_batch.user_id, v_batch.id, -v_batch.points_remaining,
       coalesce(v_new_balance, 0), 'expiration',
       jsonb_build_object('expired_points', v_batch.points_remaining));

    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;
revoke all on function expire_points_batch_job() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 12. RPC — expire_coupons_job (cron, cosmétique — n'affecte pas les points)
-- ----------------------------------------------------------------------------

create function expire_coupons_job() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update coupons set status = 'expired'
   where status = 'active' and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function expire_coupons_job() from public, anon, authenticated;
