-- Tests du chemin de l'argent (EPIC 4 / EPIC 5) — invariants exécutables.
-- À exécuter sur une base avec les migrations appliquées, dans une transaction
-- annulée à la fin (rollback) pour ne rien laisser.
--
-- Usage : psql "$DATABASE_URL" -f supabase/tests/payment_idempotency.test.sql
--
-- Couvre :
--   A. Idempotence + commission standard (10 %) : confirm_payment rejoué 3× →
--      un seul crédit du NET (2250 sur 2500), une seule ligne platform_earnings.
--   B. Montant falsifié : montant ≠ commande → REJET (payment failed, order
--      disputed, aucun crédit, aucune livraison).
--   C. Commission Elite (6 %) : net 940 sur 1000.

begin;

-- Vendeurs --------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'seller@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'elite@test.local')
  on conflict do nothing;
insert into profiles (id, role, display_name, tier) values
  ('00000000-0000-0000-0000-000000000001', 'creator', 'Vendeur Standard', 'standard'),
  ('00000000-0000-0000-0000-000000000002', 'creator', 'Vendeur Elite', 'elite');

-- ════════════════════ Scénario A : idempotence + commission 10 % ════════════════════
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

-- ═══════════════════ Scénario C : commission Elite 6 % ═══════════════════
insert into products (id, seller_id, slug, title, kind, price_htg, status)
  values ('00000000-0000-0000-0000-0000000000a3',
          '00000000-0000-0000-0000-000000000002',
          'produit-c', 'Produit C', 'fichier', 1000, 'published');
insert into orders (id, buyer_id, product_id, amount_htg, status)
  values ('00000000-0000-0000-0000-0000000000b3',
          '00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-0000000000a3', 1000, 'pending');
insert into payments (order_id, rail, idempotency_key, status)
  values ('00000000-0000-0000-0000-0000000000b3', 'moncash',
          '00000000-0000-0000-0000-0000000000b3', 'pending');

select confirm_payment('00000000-0000-0000-0000-0000000000b3', 'TX3', '{}'::jsonb, 1000);

-- ════════════════════════════ Assertions ════════════════════════════
do $$
declare
  v_balance      bigint;
  v_txn_amount   bigint;
  v_txn_count    int;
  v_order_status order_status;
  v_pay_status   payment_status;
  v_sales        integer;
  v_commission   bigint;
  v_pe_count     int;
  -- Scénario B
  v_b_pay_status payment_status;
  v_b_order_st   order_status;
  v_b_credits    int;
  -- Scénario C
  v_c_balance    bigint;
  v_c_commission bigint;
begin
  -- A : idempotence + commission standard 10 % (net 2250, commission 250)
  select balance_htg into v_balance
    from wallets where owner_id = '00000000-0000-0000-0000-000000000001';
  select amount_htg, count(*) over () into v_txn_amount, v_txn_count
    from wallet_transactions
   where idempotency_key = 'order_credit:00000000-0000-0000-0000-0000000000b1';
  select count(*), max(commission_htg) into v_pe_count, v_commission
    from platform_earnings where order_id = '00000000-0000-0000-0000-0000000000b1';
  select status into v_order_status
    from orders where id = '00000000-0000-0000-0000-0000000000b1';
  select status into v_pay_status
    from payments where idempotency_key = '00000000-0000-0000-0000-0000000000b1';
  select sales_count into v_sales
    from products where id = '00000000-0000-0000-0000-0000000000a1';

  assert v_balance = 2250,
    format('A: net attendu 2250, obtenu %s (commission non prélevée ou double crédit ?)', v_balance);
  assert v_txn_amount = 2250, format('A: crédit net attendu 2250, obtenu %s', v_txn_amount);
  assert v_txn_count = 1, format('A: une seule transaction attendue, obtenu %s', v_txn_count);
  assert v_pe_count = 1, format('A: une seule ligne platform_earnings, obtenu %s', v_pe_count);
  assert v_commission = 250, format('A: commission attendue 250, obtenu %s', v_commission);
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

  assert v_b_pay_status = 'failed', format('B: payment attendu failed, obtenu %s', v_b_pay_status);
  assert v_b_order_st = 'disputed', format('B: order attendu disputed, obtenu %s', v_b_order_st);
  assert v_b_credits = 0, format('B: aucun crédit attendu, obtenu %s', v_b_credits);
  assert v_balance = 2250, 'B: le rejet ne doit pas créditer le wallet';

  -- C : commission Elite 6 % (net 940, commission 60)
  select balance_htg into v_c_balance
    from wallets where owner_id = '00000000-0000-0000-0000-000000000002';
  select max(commission_htg) into v_c_commission
    from platform_earnings where order_id = '00000000-0000-0000-0000-0000000000b3';

  assert v_c_balance = 940, format('C: net Elite attendu 940, obtenu %s', v_c_balance);
  assert v_c_commission = 60, format('C: commission Elite attendue 60, obtenu %s', v_c_commission);

  raise notice 'OK — A (net=%, commission=%, txns=%) ; B rejeté ; C Elite (net=%, commission=%)',
    v_balance, v_commission, v_txn_count, v_c_balance, v_c_commission;
end $$;

rollback;
