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
