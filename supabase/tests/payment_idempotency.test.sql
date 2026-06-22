-- Tests du chemin de l'argent (EPIC 4) — invariants exécutables.
-- À exécuter sur une base avec les migrations appliquées, dans une transaction
-- annulée à la fin (rollback) pour ne rien laisser.
--
-- Usage : psql "$DATABASE_URL" -f supabase/tests/payment_idempotency.test.sql
--
-- Couvre :
--   A. Idempotence  : confirm_payment rejoué 3× → un seul crédit (« redirect coupé »
--      + webhook + réconciliateur déclenchés ensemble ne doublent rien).
--   B. Montant falsifié : confirm_payment avec un montant ≠ commande → REJET,
--      aucun crédit, aucune livraison.

begin;

-- Vendeur ---------------------------------------------------------------------
insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-000000000001', 'seller@test.local')
  on conflict do nothing;
insert into profiles (id, role, display_name)
  values ('00000000-0000-0000-0000-000000000001', 'creator', 'Vendeur Test');

-- ════════════════════════ Scénario A : idempotence ════════════════════════
insert into products (id, seller_id, slug, title, kind, price_htg, status)
  values ('00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-000000000001',
          'produit-a', 'Produit A', 'fichier', 2500, 'published');
insert into orders (id, buyer_id, product_id, amount_htg, status)
  values ('00000000-0000-0000-0000-0000000000b1',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-0000000000a1', 2500, 'pending');
insert into payments (order_id, rail, idempotency_key, status)
  values ('00000000-0000-0000-0000-0000000000b1', 'moncash',
          '00000000-0000-0000-0000-0000000000b1', 'pending');

-- Confirmation appelée TROIS FOIS, montant correct.
select confirm_payment('00000000-0000-0000-0000-0000000000b1', 'TX1', '{}'::jsonb, 2500);
select confirm_payment('00000000-0000-0000-0000-0000000000b1', 'TX1', '{}'::jsonb, 2500);
select confirm_payment('00000000-0000-0000-0000-0000000000b1', 'TX1', '{}'::jsonb, 2500);

-- ═══════════════════ Scénario B : montant falsifié ═══════════════════
insert into products (id, seller_id, slug, title, kind, price_htg, status)
  values ('00000000-0000-0000-0000-0000000000a2',
          '00000000-0000-0000-0000-000000000001',
          'produit-b', 'Produit B', 'fichier', 4000, 'published');
insert into orders (id, buyer_id, product_id, amount_htg, status)
  values ('00000000-0000-0000-0000-0000000000b2',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-0000000000a2', 4000, 'pending');
insert into payments (order_id, rail, idempotency_key, status)
  values ('00000000-0000-0000-0000-0000000000b2', 'moncash',
          '00000000-0000-0000-0000-0000000000b2', 'pending');

-- Montant rapporté (1000) ≠ commande (4000) → doit être REJETÉ.
select confirm_payment('00000000-0000-0000-0000-0000000000b2', 'TX2', '{}'::jsonb, 1000);

-- ════════════════════════════ Assertions ════════════════════════════
do $$
declare
  v_balance      bigint;
  v_txn_count    int;
  v_order_status order_status;
  v_pay_status   payment_status;
  v_sales        integer;
  -- Scénario B
  v_b_pay_status payment_status;
  v_b_order_st   order_status;
  v_b_credits    int;
begin
  -- A : idempotence
  select balance_htg into v_balance
    from wallets where owner_id = '00000000-0000-0000-0000-000000000001';
  select count(*) into v_txn_count
    from wallet_transactions
   where idempotency_key = 'order_credit:00000000-0000-0000-0000-0000000000b1';
  select status into v_order_status
    from orders where id = '00000000-0000-0000-0000-0000000000b1';
  select status into v_pay_status
    from payments where idempotency_key = '00000000-0000-0000-0000-0000000000b1';
  select sales_count into v_sales
    from products where id = '00000000-0000-0000-0000-0000000000a1';

  assert v_balance = 2500,
    format('A: solde attendu 2500, obtenu %s (double crédit ?)', v_balance);
  assert v_txn_count = 1,
    format('A: une seule transaction attendue, obtenu %s', v_txn_count);
  assert v_sales = 1, format('A: ventes attendues 1, obtenu %s', v_sales);
  assert v_order_status = 'paid', format('A: order attendu paid, obtenu %s', v_order_status);
  assert v_pay_status = 'confirmed', format('A: payment attendu confirmed, obtenu %s', v_pay_status);

  -- B : montant falsifié rejeté
  select status into v_b_pay_status
    from payments where idempotency_key = '00000000-0000-0000-0000-0000000000b2';
  select status into v_b_order_st
    from orders where id = '00000000-0000-0000-0000-0000000000b2';
  select count(*) into v_b_credits
    from wallet_transactions
   where idempotency_key = 'order_credit:00000000-0000-0000-0000-0000000000b2';

  assert v_b_pay_status = 'failed',
    format('B: payment attendu failed, obtenu %s', v_b_pay_status);
  assert v_b_order_st = 'disputed',
    format('B: order attendu disputed, obtenu %s', v_b_order_st);
  assert v_b_credits = 0,
    format('B: aucun crédit attendu, obtenu %s', v_b_credits);
  -- Le solde n'a pas bougé après le rejet B.
  assert v_balance = 2500, 'B: le rejet ne doit pas créditer le wallet';

  raise notice 'OK — A idempotent (solde=%, txns=%, ventes=%) ; B montant falsifié rejeté',
    v_balance, v_txn_count, v_sales;
end $$;

rollback;
