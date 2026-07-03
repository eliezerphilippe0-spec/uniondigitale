-- Zabelie Digi — schéma complet (concaténation 0001→0007).
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
