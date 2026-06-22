-- Zabelie Talent — Logique de paiement idempotente (EPIC 4)
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
  -- commande, on REJETTE (pas de crédit, pas de livraison). INVARIANT.
  if p_amount is not null and p_amount <> v_order.amount_htg then
    update payments
       set status       = 'failed',
           provider_ref = coalesce(p_provider_ref, provider_ref),
           raw          = coalesce(p_raw, raw)
     where id = v_payment.id
     returning * into v_payment;
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
