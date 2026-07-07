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
