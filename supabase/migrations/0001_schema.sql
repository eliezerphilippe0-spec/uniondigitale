-- Zabelie Talent — Schéma initial (Vague 1)
-- Décision D-3 (V-9) : comptes/wallet PROPRES à Zabelie Talent, fusion future
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
create type order_status     as enum ('pending', 'paid', 'delivered', 'cancelled', 'refunded');
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
