-- Zabelie Talent — Row Level Security (Vague 1)
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
