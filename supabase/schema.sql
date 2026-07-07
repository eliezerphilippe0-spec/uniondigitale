-- Zabelie Digi — schéma complet (concaténation 0001→0012).
-- Généré pour un copier-coller unique dans le SQL Editor Supabase.
-- Source de vérité = supabase/migrations/*.sql (ne pas éditer ce fichier à la main).
-- NE PAS exécuter _bootstrap.sql sur Supabase (réservé au Postgres nu en CI).

-- ═══════════════════════════════════════════════════════════════════
-- 0001_schema.sql
-- ═══════════════════════════════════════════════════════════════════
-- Zabelie Digi — Schéma initial (Vague 1)
-- Décision D-3 (V-9) : comptes/wallet PROPRES à Zabelie Digi, fusion future
-- possible via profiles.zabelie1_user_id (nullable + unique).
--
-- Invariants paiement (docs/03-PAIEMENTS.md) garantis EN BASE :
--   1. Idempotence : contrainte UNIQUE sur les clés d'idempotence.
--   2. Confirmation serveur-à-serveur : la table payments est la vérité.
--   3. Réconciliation : statuts traçables, aucun paiement orphelin.

-- ───────────────────────── Extensions ─────────────────────────
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ───────────────────────── Enums ──────────────────────────────
create type user_role       as enum ('buyer', 'creator', 'admin');
create type product_kind    as enum ('fichier', 'service');
create type product_status  as enum ('draft', 'published', 'archived');
create type order_status     as enum ('pending', 'paid', 'delivered', 'cancelled', 'refunded', 'disputed');
create type payment_rail     as enum ('moncash'); -- 'natcash' ajouté en Vague 2 (bloqué)
create type payment_status   as enum ('pending', 'confirmed', 'failed');
create type wallet_txn_type  as enum ('credit', 'debit', 'payout');
create type payout_status    as enum ('requested', 'processing', 'paid', 'rejected');

-- ───────────────────────── profiles ───────────────────────────
-- 1:1 avec auth.users. Identité externe nullable pour fusion future (D-3/V-9).
create table profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  role            user_role   not null default 'buyer',
  display_name    text        not null,
  bio             text,
  avatar_url      text,
  zabelie1_user_id text unique,            -- NULL tant que non lié à Zabelie 1
  created_at      timestamptz not null default now()
);

-- ───────────────────────── products ───────────────────────────
create table products (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references profiles (id) on delete cascade,
  slug         text not null unique,
  title        text not null,
  description  text,
  kind         product_kind   not null,
  category     text,
  price_htg    integer not null check (price_htg >= 0),
  cover_url    text,
  status       product_status not null default 'draft',
  sales_count  integer not null default 0,
  created_at   timestamptz not null default now()
);
create index products_seller_idx   on products (seller_id);
create index products_status_idx   on products (status);

-- Livrables (fichiers) liés à un produit de type 'fichier'.
create table product_assets (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products (id) on delete cascade,
  storage_path text not null,             -- chemin Supabase Storage (accès signé)
  file_name    text not null,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);
create index product_assets_product_idx on product_assets (product_id);

-- ───────────────────────── orders ─────────────────────────────
create table orders (
  id          uuid primary key default gen_random_uuid(),
  buyer_id    uuid not null references profiles (id) on delete restrict,
  product_id  uuid not null references products (id) on delete restrict,
  amount_htg  integer not null check (amount_htg >= 0),
  status      order_status not null default 'pending',
  created_at  timestamptz not null default now()
);
create index orders_buyer_idx   on orders (buyer_id);
create index orders_product_idx on orders (product_id);

-- ───────────────────────── payments ───────────────────────────
-- INVARIANT 1 : idempotency_key UNIQUE → rejeu sans doublon, garanti en base.
-- INVARIANT 2 : cette table est la source de vérité (alimentée par le webhook
--               serveur-à-serveur, jamais par le seul retour navigateur).
create table payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders (id) on delete cascade,
  rail            payment_rail   not null default 'moncash',
  idempotency_key text not null unique,
  provider_ref    text,                    -- référence opérateur (MonCash)
  status          payment_status not null default 'pending',
  raw             jsonb,                   -- payload brut pour réconciliation
  confirmed_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index payments_order_idx    on payments (order_id);
create index payments_status_idx   on payments (status);
create index payments_provider_idx on payments (provider_ref);

-- ───────────────────────── wallets ────────────────────────────
create table wallets (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null unique references profiles (id) on delete cascade,
  balance_htg bigint not null default 0 check (balance_htg >= 0),
  created_at timestamptz not null default now()
);

-- Grand livre du wallet. idempotency_key UNIQUE → pas de double crédit.
create table wallet_transactions (
  id              uuid primary key default gen_random_uuid(),
  wallet_id       uuid not null references wallets (id) on delete cascade,
  type            wallet_txn_type not null,
  amount_htg      bigint not null,
  order_id        uuid references orders (id) on delete set null,
  idempotency_key text unique,            -- ex: 'order_credit:<order_id>'
  reference       text,
  created_at      timestamptz not null default now()
);
create index wallet_txn_wallet_idx on wallet_transactions (wallet_id);

-- ───────────────────────── payouts ────────────────────────────
-- ⛔ Retraits BLOQUÉS en Vague 1 (dépendance BRH — docs §11/§14).
--    Table créée pour figer le modèle ; exécution différée.
create table payouts (
  id         uuid primary key default gen_random_uuid(),
  wallet_id  uuid not null references wallets (id) on delete restrict,
  amount_htg bigint not null check (amount_htg > 0),
  status     payout_status not null default 'requested',
  created_at timestamptz not null default now()
);
create index payouts_wallet_idx on payouts (wallet_id);

-- ═══════════════════════════════════════════════════════════════════
-- 0002_rls.sql
-- ═══════════════════════════════════════════════════════════════════
-- Zabelie Digi — Row Level Security (Vague 1)
-- Principe : lecture publique du catalogue ; chacun gère ses propres données ;
-- les paiements/wallet ne sont JAMAIS écrits côté client (service role + RPC).

alter table profiles            enable row level security;
alter table products            enable row level security;
alter table product_assets      enable row level security;
alter table orders              enable row level security;
alter table payments            enable row level security;
alter table wallets             enable row level security;
alter table wallet_transactions enable row level security;
alter table payouts             enable row level security;

-- ───────────────────────── profiles ───────────────────────────
create policy "profiles_public_read"
  on profiles for select using (true);

create policy "profiles_self_update"
  on profiles for update using (auth.uid() = id);

create policy "profiles_self_insert"
  on profiles for insert with check (auth.uid() = id);

-- ───────────────────────── products ───────────────────────────
create policy "products_public_read_published"
  on products for select using (status = 'published');

create policy "products_seller_read_own"
  on products for select using (auth.uid() = seller_id);

create policy "products_seller_write_own"
  on products for all
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- ─────────────────────── product_assets ───────────────────────
-- Les livrables ne sont PAS lisibles publiquement : l'accès au fichier passe
-- par une URL signée délivrée côté serveur APRÈS paiement confirmé.
create policy "assets_seller_manage"
  on product_assets for all
  using (
    exists (select 1 from products p
            where p.id = product_assets.product_id and p.seller_id = auth.uid())
  )
  with check (
    exists (select 1 from products p
            where p.id = product_assets.product_id and p.seller_id = auth.uid())
  );

-- ───────────────────────── orders ─────────────────────────────
-- L'acheteur lit ses commandes ; le vendeur lit les commandes de ses produits.
create policy "orders_buyer_read"
  on orders for select using (auth.uid() = buyer_id);

create policy "orders_seller_read"
  on orders for select using (
    exists (select 1 from products p
            where p.id = orders.product_id and p.seller_id = auth.uid())
  );

-- Pas de policy INSERT/UPDATE client : commandes & paiements créés/maj côté
-- serveur (service role / RPC) pour garantir les invariants paiement.

-- ───────────────────────── payments ───────────────────────────
create policy "payments_buyer_read"
  on payments for select using (
    exists (select 1 from orders o
            where o.id = payments.order_id and o.buyer_id = auth.uid())
  );

-- ───────────────────────── wallets ────────────────────────────
create policy "wallets_owner_read"
  on wallets for select using (auth.uid() = owner_id);

create policy "wallet_txn_owner_read"
  on wallet_transactions for select using (
    exists (select 1 from wallets w
            where w.id = wallet_transactions.wallet_id and w.owner_id = auth.uid())
  );

-- ───────────────────────── payouts ────────────────────────────
create policy "payouts_owner_read"
  on payouts for select using (
    exists (select 1 from wallets w
            where w.id = payouts.wallet_id and w.owner_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════
-- 0003_payment_functions.sql
-- ═══════════════════════════════════════════════════════════════════
-- Zabelie Digi — Logique de paiement idempotente (EPIC 4)
-- docs/03-PAIEMENTS.md. À appeler UNIQUEMENT côté serveur (webhook MonCash
-- vérifié serveur-à-serveur, ou réconciliateur). Jamais depuis le navigateur.

-- confirm_payment : applique la confirmation d'un paiement de façon idempotente.
--   - Verrouille la ligne payment (FOR UPDATE).
--   - Si déjà 'confirmed' → no-op (rejeu sans effet de bord = INVARIANT 1).
--   - Si p_amount est fourni et ≠ montant de la commande → REJET (payment→failed,
--     aucun crédit). Protège contre un montant falsifié/incohérent.
--   - Sinon : payment→confirmed, order→paid, crédit du wallet vendeur UNE SEULE
--     fois (clé d'idempotence 'order_credit:<order_id>' sur wallet_transactions).
create or replace function confirm_payment(
  p_idempotency_key text,
  p_provider_ref    text default null,
  p_raw             jsonb default null,
  p_amount          integer default null
)
returns payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment   payments;
  v_order     orders;
  v_seller_id uuid;
  v_wallet_id uuid;
  v_credited  integer;
begin
  select * into v_payment
    from payments
   where idempotency_key = p_idempotency_key
   for update;

  if not found then
    raise exception 'confirm_payment: aucun paiement pour idempotency_key %',
      p_idempotency_key;
  end if;

  -- Rejeu : déjà confirmé → on renvoie l'état sans rien refaire.
  if v_payment.status = 'confirmed' then
    return v_payment;
  end if;

  select * into v_order from orders where id = v_payment.order_id;

  -- Garde-fou montant : si l'opérateur rapporte un montant différent de la
  -- commande, on REJETTE. Paiement → failed, commande → disputed (à examiner),
  -- aucun crédit, aucune livraison (la livraison exige une commande 'paid').
  if p_amount is not null and p_amount <> v_order.amount_htg then
    update payments
       set status       = 'failed',
           provider_ref = coalesce(p_provider_ref, provider_ref),
           raw          = coalesce(p_raw, raw)
     where id = v_payment.id
     returning * into v_payment;
    update orders set status = 'disputed' where id = v_payment.order_id;
    return v_payment;
  end if;

  update payments
     set status       = 'confirmed',
         provider_ref = coalesce(p_provider_ref, provider_ref),
         raw          = coalesce(p_raw, raw),
         confirmed_at = now()
   where id = v_payment.id
   returning * into v_payment;

  update orders
     set status = 'paid'
   where id = v_payment.order_id
   returning * into v_order;

  -- Wallet du vendeur (créé à la volée si absent).
  select p.seller_id into v_seller_id
    from products p
    join orders o on o.product_id = p.id
   where o.id = v_order.id;

  insert into wallets (owner_id)
       values (v_seller_id)
  on conflict (owner_id) do nothing;

  select id into v_wallet_id from wallets where owner_id = v_seller_id;

  -- Crédit idempotent : si la transaction existe déjà (rejeu), le solde n'est
  -- PAS incrémenté une seconde fois.
  with ins as (
    insert into wallet_transactions
      (wallet_id, type, amount_htg, order_id, idempotency_key, reference)
    values
      (v_wallet_id, 'credit', v_order.amount_htg, v_order.id,
       'order_credit:' || v_order.id, 'Vente #' || left(v_order.id::text, 8))
    on conflict (idempotency_key) do nothing
    returning amount_htg
  )
  update wallets w
     set balance_htg = w.balance_htg + (select amount_htg from ins)
   where w.id = v_wallet_id
     and exists (select 1 from ins);

  -- Nombre de lignes wallet mises à jour : 1 si crédit neuf, 0 si rejeu.
  get diagnostics v_credited = row_count;

  -- Compteur de ventes incrémenté UNE SEULE fois (même garde d'idempotence).
  if v_credited > 0 then
    update products p
       set sales_count = p.sales_count + 1
     where p.id = v_order.product_id;
  end if;

  return v_payment;
end;
$$;

revoke all on function confirm_payment(text, text, jsonb, integer) from public, anon, authenticated;
-- Exécutable uniquement via service role (webhook / réconciliateur).

-- ═══════════════════════════════════════════════════════════════════
-- 0004_storage.sql
-- ═══════════════════════════════════════════════════════════════════
-- Zabelie Digi — Storage (Vague 1)
-- Bucket PRIVÉ pour les fichiers livrables. L'accès se fait exclusivement par
-- URL signée délivrée côté serveur APRÈS paiement confirmé (app/api/download).
-- Upload : via le service role (app/api/products/asset), donc pas de policy
-- storage.objects côté client nécessaire.

insert into storage.buckets (id, name, public)
values ('product-files', 'product-files', false)
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════════
-- 0005_commission.sql
-- ═══════════════════════════════════════════════════════════════════
-- Zabelie Digi — Commission par tier (EPIC 4 / EPIC 5)
-- Le vendeur est crédité du NET ; la plateforme prélève une commission selon le
-- tier. C'est le modèle économique : sans ça, le ledger est faux à chaque vente.
--
-- ⚠️ Cette fonction SQL est le SEUL calculateur qui écrit de l'argent. Le miroir
-- TS (lib/commission.ts) sert d'oracle de test et d'affichage, jamais de second
-- calculateur. La formule doit rester identique des deux côtés :
--   commission = round(gross * rate_bps / 10000) ; net = gross - commission.
--
-- Supersède la définition de confirm_payment de 0003 (ajoute net + commission).

-- ───────────────────────── Tier vendeur ───────────────────────
create type creator_tier as enum ('standard', 'elite');

alter table profiles
  add column tier creator_tier not null default 'standard';

-- Taux en points de base (1000 = 10 %, 600 = 6 %). Source de vérité du taux.
create or replace function commission_rate_bps(p_tier creator_tier)
returns integer
language sql
immutable
as $$
  select case p_tier when 'elite' then 600 else 1000 end;
$$;

-- Grand livre des revenus de la plateforme (1 ligne par commande, idempotent).
create table platform_earnings (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null unique references orders (id) on delete cascade,
  gross_htg      bigint not null,
  commission_htg bigint not null,
  rate_bps       integer not null,
  created_at     timestamptz not null default now()
);

-- ─────────────────── confirm_payment (avec commission) ───────────────────
create or replace function confirm_payment(
  p_idempotency_key text,
  p_provider_ref    text default null,
  p_raw             jsonb default null,
  p_amount          integer default null
)
returns payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment    payments;
  v_order      orders;
  v_seller_id  uuid;
  v_wallet_id  uuid;
  v_credited   integer;
  v_tier       creator_tier;
  v_rate_bps   integer;
  v_commission bigint;
  v_net        bigint;
begin
  select * into v_payment
    from payments
   where idempotency_key = p_idempotency_key
   for update;

  if not found then
    raise exception 'confirm_payment: aucun paiement pour idempotency_key %',
      p_idempotency_key;
  end if;

  -- Rejeu : déjà confirmé → on renvoie l'état sans rien refaire.
  if v_payment.status = 'confirmed' then
    return v_payment;
  end if;

  select * into v_order from orders where id = v_payment.order_id;

  -- Garde-fou montant : opérateur ≠ commande → REJET (failed + disputed).
  if p_amount is not null and p_amount <> v_order.amount_htg then
    update payments
       set status       = 'failed',
           provider_ref = coalesce(p_provider_ref, provider_ref),
           raw          = coalesce(p_raw, raw)
     where id = v_payment.id
     returning * into v_payment;
    update orders set status = 'disputed' where id = v_payment.order_id;
    return v_payment;
  end if;

  update payments
     set status       = 'confirmed',
         provider_ref = coalesce(p_provider_ref, provider_ref),
         raw          = coalesce(p_raw, raw),
         confirmed_at = now()
   where id = v_payment.id
   returning * into v_payment;

  update orders
     set status = 'paid'
   where id = v_payment.order_id
   returning * into v_order;

  -- Vendeur + tier → commission/net (SQL = seule vérité monétaire).
  select p.seller_id into v_seller_id
    from products p
    join orders o on o.product_id = p.id
   where o.id = v_order.id;

  select tier into v_tier from profiles where id = v_seller_id;
  v_rate_bps   := commission_rate_bps(v_tier);
  v_commission := round(v_order.amount_htg::numeric * v_rate_bps / 10000);
  v_net        := v_order.amount_htg - v_commission;

  insert into wallets (owner_id)
       values (v_seller_id)
  on conflict (owner_id) do nothing;

  select id into v_wallet_id from wallets where owner_id = v_seller_id;

  -- Crédit idempotent du NET : rejeu = pas de second crédit.
  with ins as (
    insert into wallet_transactions
      (wallet_id, type, amount_htg, order_id, idempotency_key, reference)
    values
      (v_wallet_id, 'credit', v_net, v_order.id,
       'order_credit:' || v_order.id, 'Vente nette #' || left(v_order.id::text, 8))
    on conflict (idempotency_key) do nothing
    returning amount_htg
  )
  update wallets w
     set balance_htg = w.balance_htg + (select amount_htg from ins)
   where w.id = v_wallet_id
     and exists (select 1 from ins);

  get diagnostics v_credited = row_count;

  -- Effets « une seule fois » (même garde d'idempotence que le crédit).
  if v_credited > 0 then
    insert into platform_earnings (order_id, gross_htg, commission_htg, rate_bps)
    values (v_order.id, v_order.amount_htg, v_commission, v_rate_bps)
    on conflict (order_id) do nothing;

    update products p
       set sales_count = p.sales_count + 1
     where p.id = v_order.product_id;
  end if;

  return v_payment;
end;
$$;

revoke all on function confirm_payment(text, text, jsonb, integer) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 0006_escrow_maturation.sql
-- ═══════════════════════════════════════════════════════════════════
-- Zabelie Digi — Escrow & maturation J+7 + remboursements (EPIC 5)
-- Fenêtre anti-fraude : le NET du vendeur est d'abord EN ATTENTE (pending), puis
-- DISPONIBLE (available, retirable) après 7 jours. Un remboursement avant
-- maturation annule l'escrow → aucun solde fantôme.
--
-- ⚠️ SQL = seul calculateur d'argent. Supersède confirm_payment de 0005
-- (crédite désormais l'escrow/pending au lieu du solde disponible).

-- ───────────────────────── Schéma escrow ──────────────────────
create type escrow_status as enum ('maturing', 'matured', 'reversed');

-- Solde disponible = wallets.balance_htg (retirable). Ajout du solde en attente.
alter table wallets
  add column pending_htg bigint not null default 0 check (pending_htg >= 0);

-- Une entrée d'escrow par commande payée (= guard d'idempotence du crédit).
create table escrow_entries (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null unique references orders (id) on delete cascade,
  wallet_id  uuid not null references wallets (id) on delete cascade,
  amount_htg bigint not null,                 -- NET vendeur
  matures_at timestamptz not null,
  status     escrow_status not null default 'maturing',
  created_at timestamptz not null default now()
);
create index escrow_due_idx on escrow_entries (status, matures_at);
create index escrow_wallet_idx on escrow_entries (wallet_id);

-- ─────────────────── confirm_payment (crédit en escrow) ───────────────────
create or replace function confirm_payment(
  p_idempotency_key text,
  p_provider_ref    text default null,
  p_raw             jsonb default null,
  p_amount          integer default null
)
returns payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment    payments;
  v_order      orders;
  v_seller_id  uuid;
  v_wallet_id  uuid;
  v_credited   integer;
  v_tier       creator_tier;
  v_rate_bps   integer;
  v_commission bigint;
  v_net        bigint;
begin
  select * into v_payment
    from payments
   where idempotency_key = p_idempotency_key
   for update;

  if not found then
    raise exception 'confirm_payment: aucun paiement pour idempotency_key %',
      p_idempotency_key;
  end if;

  if v_payment.status = 'confirmed' then
    return v_payment; -- rejeu : no-op
  end if;

  select * into v_order from orders where id = v_payment.order_id;

  -- Garde-fou montant : opérateur ≠ commande → REJET (failed + disputed).
  if p_amount is not null and p_amount <> v_order.amount_htg then
    update payments
       set status = 'failed',
           provider_ref = coalesce(p_provider_ref, provider_ref),
           raw = coalesce(p_raw, raw)
     where id = v_payment.id
     returning * into v_payment;
    update orders set status = 'disputed' where id = v_payment.order_id;
    return v_payment;
  end if;

  update payments
     set status = 'confirmed',
         provider_ref = coalesce(p_provider_ref, provider_ref),
         raw = coalesce(p_raw, raw),
         confirmed_at = now()
   where id = v_payment.id
   returning * into v_payment;

  update orders set status = 'paid'
   where id = v_payment.order_id
   returning * into v_order;

  -- Vendeur + tier → commission/net.
  select p.seller_id into v_seller_id
    from products p join orders o on o.product_id = p.id
   where o.id = v_order.id;

  select tier into v_tier from profiles where id = v_seller_id;
  v_rate_bps   := commission_rate_bps(v_tier);
  v_commission := round(v_order.amount_htg::numeric * v_rate_bps / 10000);
  v_net        := v_order.amount_htg - v_commission;

  insert into wallets (owner_id) values (v_seller_id)
  on conflict (owner_id) do nothing;
  select id into v_wallet_id from wallets where owner_id = v_seller_id;

  -- Mise en ESCROW du NET (maturation J+7). Idempotent via escrow_entries.order_id.
  with ins as (
    insert into escrow_entries (order_id, wallet_id, amount_htg, matures_at, status)
    values (v_order.id, v_wallet_id, v_net, now() + interval '7 days', 'maturing')
    on conflict (order_id) do nothing
    returning amount_htg
  )
  update wallets w
     set pending_htg = w.pending_htg + (select amount_htg from ins)
   where w.id = v_wallet_id
     and exists (select 1 from ins);

  get diagnostics v_credited = row_count;

  if v_credited > 0 then
    insert into wallet_transactions
      (wallet_id, type, amount_htg, order_id, idempotency_key, reference)
    values
      (v_wallet_id, 'credit', v_net, v_order.id, 'order_credit:' || v_order.id,
       'Vente nette en attente #' || left(v_order.id::text, 8))
    on conflict (idempotency_key) do nothing;

    insert into platform_earnings (order_id, gross_htg, commission_htg, rate_bps)
    values (v_order.id, v_order.amount_htg, v_commission, v_rate_bps)
    on conflict (order_id) do nothing;

    update products p set sales_count = p.sales_count + 1
     where p.id = v_order.product_id;
  end if;

  return v_payment;
end;
$$;
revoke all on function confirm_payment(text, text, jsonb, integer) from public, anon, authenticated;

-- ─────────────────── mature_wallets : pending → available ───────────────────
-- À déclencher par cron. Fait mûrir tout escrow 'maturing' arrivé à échéance.
create or replace function mature_wallets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with matured as (
    update escrow_entries
       set status = 'matured'
     where status = 'maturing'
       and matures_at <= now()
    returning wallet_id, amount_htg
  ), agg as (
    select wallet_id, sum(amount_htg) as amt, count(*) as n
      from matured group by wallet_id
  ), upd as (
    update wallets w
       set pending_htg = w.pending_htg - a.amt,
           balance_htg = w.balance_htg + a.amt
      from agg a
     where w.id = a.wallet_id
    returning a.n
  )
  select coalesce(sum(n), 0) into v_count from upd;
  return v_count;
end;
$$;
revoke all on function mature_wallets() from public, anon, authenticated;

-- ─────────────────── refund_order : remboursement idempotent ───────────────────
-- Avant maturité  → annule l'escrow (pending réduit) : AUCUN solde fantôme.
-- Après maturité  → débite le solde disponible (peut échouer si déjà retiré).
create or replace function refund_order(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esc escrow_entries;
begin
  select * into v_esc from escrow_entries where order_id = p_order_id for update;
  if not found then
    raise exception 'refund_order: aucun escrow pour order %', p_order_id;
  end if;

  if v_esc.status = 'reversed' then
    return 'already_reversed'; -- idempotent
  end if;

  if v_esc.status = 'maturing' then
    update wallets set pending_htg = pending_htg - v_esc.amount_htg
     where id = v_esc.wallet_id;
  else -- 'matured' : fonds déjà disponibles
    update wallets set balance_htg = balance_htg - v_esc.amount_htg
     where id = v_esc.wallet_id;
  end if;

  update escrow_entries set status = 'reversed' where id = v_esc.id;
  update orders set status = 'refunded' where id = p_order_id;

  insert into wallet_transactions
    (wallet_id, type, amount_htg, order_id, idempotency_key, reference)
  values
    (v_esc.wallet_id, 'debit', -v_esc.amount_htg, p_order_id,
     'order_refund:' || p_order_id, 'Remboursement #' || left(p_order_id::text, 8))
  on conflict (idempotency_key) do nothing;

  return 'reversed';
end;
$$;
revoke all on function refund_order(uuid) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 0007_standalone.sql
-- ═══════════════════════════════════════════════════════════════════
-- Zabelie Digi — projet TOTALEMENT INDÉPENDANT (décision utilisateur, ferme).
-- Aucune fusion prévue avec Zabelie 1 ni aucun autre projet. On retire la
-- passerelle dormante prévue « au cas où » par l'ancienne V-9.
-- (Sur une base déjà déployée : exécuter cette migration ; sur une base neuve,
--  schema.sql inclut créé-puis-supprimé, résultat identique.)

alter table profiles drop column if exists zabelie1_user_id;

-- ═══════════════════════════════════════════════════════════════════
-- 0008_reviews.sql
-- ═══════════════════════════════════════════════════════════════════
-- Zabelie Digi — Avis d'acheteurs VÉRIFIÉS (différenciateur confiance vs Chariow)
-- Règle dure : seul un acheteur ayant une commande PAYÉE peut laisser un avis,
-- et UN SEUL avis par commande (contrainte UNIQUE en base, pas seulement en API).
-- Marché à faible confiance → la preuve sociale doit être invérolable.

create table product_reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  buyer_id   uuid not null references profiles (id) on delete cascade,
  order_id   uuid not null unique references orders (id) on delete cascade,
  rating     integer not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);
create index reviews_product_idx on product_reviews (product_id);

-- Agrégats maintenus par trigger (lecture catalogue sans jointure coûteuse).
alter table products
  add column rating_count integer not null default 0,
  add column rating_sum   integer not null default 0;

create or replace function apply_review_aggregates()
returns trigger
language plpgsql
as $$
begin
  update products
     set rating_count = rating_count + 1,
         rating_sum   = rating_sum + new.rating
   where id = new.product_id;
  return new;
end;
$$;

create trigger product_reviews_aggregate
  after insert on product_reviews
  for each row execute function apply_review_aggregates();

-- RLS : lecture publique (preuve sociale), écriture UNIQUEMENT côté serveur
-- (l'API vérifie que la commande appartient au demandeur et est payée/livrée).
alter table product_reviews enable row level security;
create policy "reviews_public_read"
  on product_reviews for select using (true);

-- ═══════════════════════════════════════════════════════════════════
-- 0009_rails_diaspora.sql
-- ═══════════════════════════════════════════════════════════════════
-- Zabelie Digi — Rails diaspora : Stripe (carte) + Zelle (V-10)
-- Décision produit : ouvrir les achats USD de la diaspora. Le LEDGER RESTE EN
-- HTG (net vendeur, commission, escrow inchangés — calculés sur amount_htg).
-- Le montant USD attendu est FIGÉ au checkout (expected_usd_cents) et vérifié
-- en base à la confirmation : même garde-fou anti-falsification que MonCash.
--
-- Zelle n'ayant pas d'API, sa confirmation est ADMINISTRATIVE (bouton admin)
-- mais passe par le même confirm_payment idempotent — aucune livraison sans
-- confirmation explicite.

alter type payment_rail add value if not exists 'stripe';
alter type payment_rail add value if not exists 'zelle';

alter table payments
  add column expected_usd_cents integer; -- figé au checkout pour rails USD

-- confirm_payment v4 : ajoute le garde-fou USD (p_usd_cents vs expected).
-- On supprime l'ancienne signature pour éviter toute ambiguïté de surcharge.
drop function if exists confirm_payment(text, text, jsonb, integer);

create or replace function confirm_payment(
  p_idempotency_key text,
  p_provider_ref    text default null,
  p_raw             jsonb default null,
  p_amount          integer default null,
  p_usd_cents       integer default null
)
returns payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment    payments;
  v_order      orders;
  v_seller_id  uuid;
  v_wallet_id  uuid;
  v_credited   integer;
  v_tier       creator_tier;
  v_rate_bps   integer;
  v_commission bigint;
  v_net        bigint;
begin
  select * into v_payment
    from payments
   where idempotency_key = p_idempotency_key
   for update;

  if not found then
    raise exception 'confirm_payment: aucun paiement pour idempotency_key %',
      p_idempotency_key;
  end if;

  if v_payment.status = 'confirmed' then
    return v_payment; -- rejeu : no-op
  end if;

  select * into v_order from orders where id = v_payment.order_id;

  -- Garde-fou HTG (MonCash) : opérateur ≠ commande → REJET.
  if p_amount is not null and p_amount <> v_order.amount_htg then
    update payments
       set status = 'failed',
           provider_ref = coalesce(p_provider_ref, provider_ref),
           raw = coalesce(p_raw, raw)
     where id = v_payment.id
     returning * into v_payment;
    update orders set status = 'disputed' where id = v_payment.order_id;
    return v_payment;
  end if;

  -- Garde-fou USD (Stripe/Zelle) : montant reçu ≠ montant figé → REJET.
  if p_usd_cents is not null
     and (v_payment.expected_usd_cents is null
          or p_usd_cents <> v_payment.expected_usd_cents) then
    update payments
       set status = 'failed',
           provider_ref = coalesce(p_provider_ref, provider_ref),
           raw = coalesce(p_raw, raw)
     where id = v_payment.id
     returning * into v_payment;
    update orders set status = 'disputed' where id = v_payment.order_id;
    return v_payment;
  end if;

  update payments
     set status = 'confirmed',
         provider_ref = coalesce(p_provider_ref, provider_ref),
         raw = coalesce(p_raw, raw),
         confirmed_at = now()
   where id = v_payment.id
   returning * into v_payment;

  update orders set status = 'paid'
   where id = v_payment.order_id
   returning * into v_order;

  -- Vendeur + tier → commission/net (LEDGER HTG, identique pour tous les rails).
  select p.seller_id into v_seller_id
    from products p join orders o on o.product_id = p.id
   where o.id = v_order.id;

  select tier into v_tier from profiles where id = v_seller_id;
  v_rate_bps   := commission_rate_bps(v_tier);
  v_commission := round(v_order.amount_htg::numeric * v_rate_bps / 10000);
  v_net        := v_order.amount_htg - v_commission;

  insert into wallets (owner_id) values (v_seller_id)
  on conflict (owner_id) do nothing;
  select id into v_wallet_id from wallets where owner_id = v_seller_id;

  with ins as (
    insert into escrow_entries (order_id, wallet_id, amount_htg, matures_at, status)
    values (v_order.id, v_wallet_id, v_net, now() + interval '7 days', 'maturing')
    on conflict (order_id) do nothing
    returning amount_htg
  )
  update wallets w
     set pending_htg = w.pending_htg + (select amount_htg from ins)
   where w.id = v_wallet_id
     and exists (select 1 from ins);

  get diagnostics v_credited = row_count;

  if v_credited > 0 then
    insert into wallet_transactions
      (wallet_id, type, amount_htg, order_id, idempotency_key, reference)
    values
      (v_wallet_id, 'credit', v_net, v_order.id, 'order_credit:' || v_order.id,
       'Vente nette en attente #' || left(v_order.id::text, 8))
    on conflict (idempotency_key) do nothing;

    insert into platform_earnings (order_id, gross_htg, commission_htg, rate_bps)
    values (v_order.id, v_order.amount_htg, v_commission, v_rate_bps)
    on conflict (order_id) do nothing;

    update products p set sales_count = p.sales_count + 1
     where p.id = v_order.product_id;
  end if;

  return v_payment;
end;
$$;
revoke all on function confirm_payment(text, text, jsonb, integer, integer)
  from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 0010_topup.sql
-- ═══════════════════════════════════════════════════════════════════
-- Zabelie Digi — Service de recharge téléphonique (topup) Digicel/Natcom (V-11)
-- Positionnement BRH (Circulaire 121) : Zabelie Digi est un REVENDEUR de
-- recharge télécom, JAMAIS un émetteur de monnaie électronique.
--   • Aucun solde rechargeable acheteur, aucun P2P, aucun cash-in/cash-out.
--   • Flux strict : paiement (MonCash/Zelle) → livraison immédiate.
--   • Remboursement uniquement vers le moyen de paiement d'origine.
--   • Traçabilité totale : zabelie_topup_ledger APPEND-ONLY (trigger bloquant).
--   • Plafonds anti-abus configurables (zabelie_topup_limits) + velocity checks.
-- Pipeline volontairement SÉPARÉ du money-path marketplace (orders/payments/
-- wallets) : pas de vendeur, pas de commission, pas d'escrow — le wallet
-- vendeur existant n'est pas touché (contrainte BRH n°5).

-- ───────────────────────── Enums ─────────────────────────
create type topup_operator as enum ('digicel', 'natcom');

-- Machine à états (transitions validées par zabelie_topup_transition) :
-- created → payment_pending → paid → fulfillment_pending → delivered
--                                             ↓
--                                          failed → refund_pending → refunded
create type topup_status as enum (
  'created', 'payment_pending', 'paid', 'fulfillment_pending',
  'delivered', 'failed', 'refund_pending', 'refunded'
);

-- ───────────────────────── Catalogue ─────────────────────────
-- Prix TOUJOURS résolus côté serveur depuis cette table (jamais du client).
-- Montants en centimes ? Non : le HTG s'utilise en unités entières partout
-- ailleurs dans le schéma (amount_htg integer) — on garde la même convention.
create table zabelie_topup_products (
  id                  uuid primary key default gen_random_uuid(),
  operator            topup_operator not null,
  label               text not null,              -- ex. « Rechaj 100 HTG »
  face_value_htg      integer not null check (face_value_htg > 0),   -- valeur livrée
  cost_htg            integer not null check (cost_htg > 0),         -- prix coûtant fournisseur
  price_htg           integer not null check (price_htg > 0),        -- prix de vente
  provider            text not null default 'reloadly',
  provider_product_id text,                       -- operatorId Reloadly
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  check (price_htg >= cost_htg)                   -- marge jamais négative
);

-- ───────────────────────── Commandes ─────────────────────────
create table zabelie_topup_orders (
  id                 uuid primary key default gen_random_uuid(),
  buyer_id           uuid not null references auth.users(id),
  product_id         uuid not null references zabelie_topup_products(id),
  operator           topup_operator not null,
  beneficiary_phone  text not null,               -- format 509XXXXXXXX
  face_value_htg     integer not null,
  amount_htg         integer not null,            -- prix payé (figé au checkout)
  cost_htg           integer not null,            -- coûtant (figé au checkout)
  status             topup_status not null default 'created',
  rail               payment_rail not null,       -- moncash | zelle (natcash ⛔)
  expected_usd_cents integer,                     -- figé au checkout si rail USD
  payment_ref        text,                        -- transactionId MonCash / réf Zelle
  provider_ref       text,                        -- transactionId fournisseur topup
  attempts           integer not null default 0,  -- tentatives de fulfillment
  last_error         text,
  raw                jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Index velocity checks + relevés par compte (contrainte BRH n°7).
create index zabelie_topup_orders_buyer_idx
  on zabelie_topup_orders (buyer_id, created_at);
create index zabelie_topup_orders_beneficiary_idx
  on zabelie_topup_orders (beneficiary_phone, created_at);
create index zabelie_topup_orders_status_idx
  on zabelie_topup_orders (status, created_at);

-- ───────────────────────── Ledger append-only ─────────────────────────
-- Audit trail immuable (contrainte BRH n°6) : horodatage, compte acheteur,
-- bénéficiaire, opérateur, montant, référence paiement, référence fournisseur,
-- transition de statut. AUCUN UPDATE/DELETE possible (trigger).
create table zabelie_topup_ledger (
  id                bigint generated always as identity primary key,
  order_id          uuid not null references zabelie_topup_orders(id),
  buyer_id          uuid not null,
  beneficiary_phone text not null,
  operator          topup_operator not null,
  amount_htg        integer not null,
  from_status       topup_status,
  to_status         topup_status not null,
  payment_ref       text,
  provider_ref      text,
  detail            jsonb,
  created_at        timestamptz not null default now()
);

create index zabelie_topup_ledger_order_idx on zabelie_topup_ledger (order_id);

create or replace function zabelie_topup_ledger_guard()
returns trigger language plpgsql as $$
begin
  raise exception 'zabelie_topup_ledger est APPEND-ONLY (audit BRH) : % interdit', tg_op;
end;
$$;
create trigger zabelie_topup_ledger_immutable
  before update or delete on zabelie_topup_ledger
  for each row execute function zabelie_topup_ledger_guard();

-- ───────────────────────── Plafonds configurables ─────────────────────────
create table zabelie_topup_limits (
  key        text primary key,
  value      integer not null,
  comment    text,
  updated_at timestamptz not null default now()
);
insert into zabelie_topup_limits (key, value, comment) values
  ('per_tx_htg', 5000,
   'Plafond par transaction (HTG). Validé porteur 2026-07.'),
  ('per_day_htg', 25000,
   'Plafond par jour et par compte acheteur (HTG).'),
  ('distinct_beneficiaries_per_hour', 5,
   'Au-delà de N numéros bénéficiaires différents en 1 h → flag (velocity).');

-- ───────────────────────── RLS ─────────────────────────
alter table zabelie_topup_products enable row level security;
alter table zabelie_topup_orders   enable row level security;
alter table zabelie_topup_ledger   enable row level security;
alter table zabelie_topup_limits   enable row level security;

-- Catalogue : lecture publique des produits actifs (prix affichés).
create policy topup_products_read on zabelie_topup_products
  for select using (active);

-- Commandes : l'acheteur ne voit que les siennes. Écritures = service role
-- uniquement (aucune policy insert/update → refusé pour anon/authenticated).
create policy topup_orders_own on zabelie_topup_orders
  for select using (auth.uid() = buyer_id);

-- Ledger + limits : admin/service uniquement (aucune policy → service role seul).

-- ───────────────────────── Machine à états ─────────────────────────
-- Transitions autorisées — toute autre transition lève une erreur (et rien
-- n'est écrit). Chaque transition réussie ajoute une ligne au ledger.
create or replace function zabelie_topup_transition(
  p_order_id uuid,
  p_to       topup_status,
  p_detail   jsonb default null
)
returns zabelie_topup_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order zabelie_topup_orders;
  v_from  topup_status;
  v_ok    boolean;
begin
  select * into v_order from zabelie_topup_orders
   where id = p_order_id for update;
  if not found then
    raise exception 'zabelie_topup_transition: commande % introuvable', p_order_id;
  end if;
  v_from := v_order.status;

  -- Rejeu idempotent : déjà dans l'état cible → no-op.
  if v_order.status = p_to then
    return v_order;
  end if;

  v_ok := case
    when v_order.status = 'created'             and p_to in ('payment_pending', 'failed') then true
    when v_order.status = 'payment_pending'     and p_to in ('paid', 'failed') then true
    when v_order.status = 'paid'                and p_to in ('fulfillment_pending') then true
    when v_order.status = 'fulfillment_pending' and p_to in ('delivered', 'failed') then true
    when v_order.status = 'failed'              and p_to in ('refund_pending') then true
    when v_order.status = 'refund_pending'      and p_to in ('refunded') then true
    else false
  end;

  if not v_ok then
    raise exception 'zabelie_topup_transition: transition % → % interdite (commande %)',
      v_order.status, p_to, p_order_id;
  end if;

  update zabelie_topup_orders
     set status = p_to, updated_at = now()
   where id = p_order_id
   returning * into v_order;

  insert into zabelie_topup_ledger
    (order_id, buyer_id, beneficiary_phone, operator, amount_htg,
     from_status, to_status, payment_ref, provider_ref, detail)
  values
    (v_order.id, v_order.buyer_id, v_order.beneficiary_phone, v_order.operator,
     v_order.amount_htg, v_from, p_to,
     v_order.payment_ref, v_order.provider_ref, p_detail);

  return v_order;
end;
$$;
revoke all on function zabelie_topup_transition(uuid, topup_status, jsonb)
  from public, anon, authenticated;

-- ───────────────────────── Confirmation de paiement ─────────────────────────
-- Idempotente + garde-fous montant (HTG et USD), miroir des invariants du
-- marketplace. Rejouable sans double effet ; montant falsifié → failed.
create or replace function zabelie_topup_confirm_payment(
  p_order_id  uuid,
  p_payment_ref text default null,
  p_raw       jsonb default null,
  p_amount    integer default null,   -- HTG rapporté par MonCash
  p_usd_cents integer default null    -- cents USD (Zelle)
)
returns zabelie_topup_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order zabelie_topup_orders;
begin
  select * into v_order from zabelie_topup_orders
   where id = p_order_id for update;
  if not found then
    raise exception 'zabelie_topup_confirm_payment: commande % introuvable', p_order_id;
  end if;

  -- Rejeu (webhook livré deux fois) : déjà payé ou plus loin → no-op.
  if v_order.status in ('paid', 'fulfillment_pending', 'delivered',
                        'refund_pending', 'refunded') then
    return v_order;
  end if;

  update zabelie_topup_orders
     set payment_ref = coalesce(p_payment_ref, payment_ref),
         raw = coalesce(p_raw, raw)
   where id = p_order_id;

  -- Garde-fou HTG : montant opérateur ≠ prix figé → REJET tracé.
  if p_amount is not null and p_amount <> v_order.amount_htg then
    return zabelie_topup_transition(p_order_id, 'failed',
      jsonb_build_object('reason', 'payment_amount_mismatch',
                         'reported_htg', p_amount,
                         'expected_htg', v_order.amount_htg));
  end if;

  -- Garde-fou USD : montant reçu ≠ figé au checkout → REJET tracé.
  if p_usd_cents is not null
     and (v_order.expected_usd_cents is null
          or p_usd_cents <> v_order.expected_usd_cents) then
    return zabelie_topup_transition(p_order_id, 'failed',
      jsonb_build_object('reason', 'payment_usd_mismatch',
                         'reported_usd_cents', p_usd_cents,
                         'expected_usd_cents', v_order.expected_usd_cents));
  end if;

  return zabelie_topup_transition(p_order_id, 'paid',
    jsonb_build_object('payment_ref', p_payment_ref));
end;
$$;
revoke all on function zabelie_topup_confirm_payment(uuid, text, jsonb, integer, integer)
  from public, anon, authenticated;

-- ───────────────────────── Seed catalogue ─────────────────────────
-- Dénominations de départ. cost_htg = estimation à SYNCHRONISER avec les prix
-- réels Reloadly sandbox (voir OPS_TODO.md) ; price_htg = marge cible ~5 %
-- au-dessus du coûtant (validé porteur). provider_product_id à renseigner
-- après le mapping des operatorId Reloadly.
insert into zabelie_topup_products
  (operator, label, face_value_htg, cost_htg, price_htg) values
  ('digicel', 'Rechaj Digicel 25 HTG',    25,   25,   27),
  ('digicel', 'Rechaj Digicel 50 HTG',    50,   50,   53),
  ('digicel', 'Rechaj Digicel 100 HTG',  100,  100,  105),
  ('digicel', 'Rechaj Digicel 250 HTG',  250,  250,  263),
  ('digicel', 'Rechaj Digicel 500 HTG',  500,  500,  525),
  ('digicel', 'Rechaj Digicel 1000 HTG', 1000, 1000, 1050),
  ('natcom',  'Rechaj Natcom 25 HTG',     25,   25,   27),
  ('natcom',  'Rechaj Natcom 50 HTG',     50,   50,   53),
  ('natcom',  'Rechaj Natcom 100 HTG',   100,  100,  105),
  ('natcom',  'Rechaj Natcom 250 HTG',   250,  250,  263),
  ('natcom',  'Rechaj Natcom 500 HTG',   500,  500,  525),
  ('natcom',  'Rechaj Natcom 1000 HTG',  1000, 1000, 1050);

-- ═══════════════════════════════════════════════════════════════════
-- 0011_security_hardening.sql
-- ═══════════════════════════════════════════════════════════════════
-- Zabelie Digi — Durcissement sécurité (advisors Supabase, post-migration prod)
-- 1. RLS manquant sur 2 tables financières (niveau ERROR au linter) : sans RLS,
--    l'API REST Supabase (PostgREST) les expose aux clients authentifiés.
--    Aucune policy = service role uniquement — le bon défaut pour l'argent.
alter table platform_earnings enable row level security;
alter table escrow_entries    enable row level security;

-- Le vendeur peut lire SES entrées d'escrow (transparence du J+7) ; l'écriture
-- reste réservée aux fonctions SECURITY DEFINER / service role.
create policy "escrow_owner_read"
  on escrow_entries for select using (
    exists (select 1 from wallets w
            where w.id = escrow_entries.wallet_id and w.owner_id = auth.uid())
  );

-- 2. search_path mutable (niveau WARN) sur 3 fonctions : on le fige.
alter function commission_rate_bps(creator_tier) set search_path = public;
alter function apply_review_aggregates() set search_path = public;
alter function zabelie_topup_ledger_guard() set search_path = public;

-- ═══════════════════════════════════════════════════════════════════
-- 0012_coupons.sql
-- ═══════════════════════════════════════════════════════════════════
-- Zabelie Digi — Codes promo vendeur (V-13, inspiration Chariow adaptée Haïti)
-- Le vendeur anime ses ventes lui-même (« PROMO50 sur WhatsApp jusqu'à
-- dimanche »). Règles dures respectées : la réduction est calculée CÔTÉ
-- SERVEUR (pourcentage borné 1–90, montants entiers), le prix final est figé
-- sur la commande AVANT paiement — tous les garde-fous montant existants
-- (HTG/USD, commission, escrow) s'appliquent au prix remisé tel quel.

create table zabelie_coupons (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references profiles (id) on delete cascade,
  -- null = valable sur tous les produits du vendeur.
  product_id  uuid references products (id) on delete cascade,
  code        text not null,
  percent     integer not null check (percent between 1 and 90),
  max_uses    integer check (max_uses is null or max_uses > 0),
  uses        integer not null default 0,
  expires_at  timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  -- Un code est unique PAR vendeur (deux vendeurs peuvent avoir « PROMO50 »).
  unique (seller_id, code)
);
create index zabelie_coupons_seller_idx on zabelie_coupons (seller_id);

-- La commande garde la trace du code appliqué (audit + affichage).
alter table orders
  add column coupon_code  text,
  add column discount_htg integer not null default 0 check (discount_htg >= 0);

-- RLS : le vendeur gère SES codes ; validation/consommation côté serveur
-- uniquement (service role) — aucun code n'est lisible publiquement (sinon
-- n'importe qui énumérerait les promos des vendeurs).
alter table zabelie_coupons enable row level security;
create policy "coupons_seller_all"
  on zabelie_coupons for all
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- Consommation ATOMIQUE d'une utilisation (appelée au checkout, service role).
-- Renvoie true si l'usage a été réservé, false si plafond atteint/inactif.
create or replace function zabelie_coupon_consume(p_coupon_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok integer;
begin
  update zabelie_coupons
     set uses = uses + 1
   where id = p_coupon_id
     and active
     and (max_uses is null or uses < max_uses)
     and (expires_at is null or expires_at > now());
  get diagnostics v_ok = row_count;
  return v_ok > 0;
end;
$$;
revoke all on function zabelie_coupon_consume(uuid) from public, anon, authenticated;

-- ─────────── Notifications post-paiement : réservation idempotente ───────────
-- Un paiement rejoué (webhook doublé, réconciliateur) ne doit produire qu'UN
-- envoi d'e-mails : marqueur atomique dans payments.raw, posé une seule fois.
create or replace function zabelie_claim_notification(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok integer;
begin
  update payments
     set raw = coalesce(raw, '{}'::jsonb)
               || jsonb_build_object('notified_at', now())
   where order_id = p_order_id
     and status = 'confirmed'
     and (raw ->> 'notified_at') is null;
  get diagnostics v_ok = row_count;
  return v_ok > 0;
end;
$$;
revoke all on function zabelie_claim_notification(uuid) from public, anon, authenticated;
