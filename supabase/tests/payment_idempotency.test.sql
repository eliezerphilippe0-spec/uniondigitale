-- Test d'idempotence de confirm_payment (INVARIANT 1 + scénario « redirect coupé »).
-- À exécuter sur une base avec les migrations appliquées, dans une transaction
-- annulée à la fin (rollback) pour ne rien laisser.
--
-- Usage : psql "$DATABASE_URL" -f supabase/tests/payment_idempotency.test.sql
-- (nécessite un utilisateur auth.users de test ; ici on insère directement.)

begin;

-- Données de test ------------------------------------------------------------
insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-000000000001', 'seller@test.local')
  on conflict do nothing;

insert into profiles (id, role, display_name)
  values ('00000000-0000-0000-0000-000000000001', 'creator', 'Vendeur Test');

insert into products (id, seller_id, slug, title, kind, price_htg, status)
  values ('00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-000000000001',
          'produit-test', 'Produit Test', 'fichier', 2500, 'published');

insert into orders (id, buyer_id, product_id, amount_htg, status)
  values ('00000000-0000-0000-0000-0000000000b1',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-0000000000a1', 2500, 'pending');

insert into payments (order_id, rail, idempotency_key, status)
  values ('00000000-0000-0000-0000-0000000000b1', 'moncash',
          '00000000-0000-0000-0000-0000000000b1', 'pending');

-- Confirmation appelée DEUX FOIS (simule webhook + réconciliateur, ou rejeu) --
select confirm_payment('00000000-0000-0000-0000-0000000000b1', 'TX123', '{}'::jsonb);
select confirm_payment('00000000-0000-0000-0000-0000000000b1', 'TX123', '{}'::jsonb);

-- Assertions -----------------------------------------------------------------
do $$
declare
  v_balance     bigint;
  v_txn_count   int;
  v_order_status order_status;
  v_pay_status  payment_status;
  v_sales       integer;
begin
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

  assert v_sales = 1,
    format('Ventes attendues 1, obtenu %s (double comptage ?)', v_sales);
  assert v_balance = 2500,
    format('Solde attendu 2500, obtenu %s (double crédit ?)', v_balance);
  assert v_txn_count = 1,
    format('Une seule transaction attendue, obtenu %s', v_txn_count);
  assert v_order_status = 'paid',
    format('Commande attendue paid, obtenu %s', v_order_status);
  assert v_pay_status = 'confirmed',
    format('Paiement attendu confirmed, obtenu %s', v_pay_status);

  raise notice 'OK — idempotence confirmée : solde=%, txns=%, ventes=%, order=%, payment=%',
    v_balance, v_txn_count, v_sales, v_order_status, v_pay_status;
end $$;

rollback;
