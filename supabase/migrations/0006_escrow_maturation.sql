-- Zabelie Talent — Escrow & maturation J+7 + remboursements (EPIC 5)
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
