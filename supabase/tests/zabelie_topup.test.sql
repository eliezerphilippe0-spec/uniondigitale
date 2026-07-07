-- Tests du service de recharge (V-11) — invariants BRH exécutables.
-- Usage : psql "$DATABASE_URL" -f supabase/tests/zabelie_topup.test.sql
--
-- Couvre :
--   T1. Machine à états : transition valide OK, transition INTERDITE → erreur.
--   T2. Idempotence paiement : notification livrée 2× → un seul passage à paid,
--       une seule ligne de ledger pour cette transition.
--   T3. Garde-fou montant : HTG falsifié → failed (tracé), USD falsifié → failed.
--   T4. Ledger APPEND-ONLY : UPDATE et DELETE lèvent une erreur.
--   T5. Parcours complet : … → delivered, puis refund_pending → refunded tracés.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e9'::uuid, 'topup-buyer@test.local')
  on conflict do nothing;

-- (auth.users du bootstrap n'a pas de contrainte email unique ; profiles non requis)

-- Produit catalogue (seed 0010 déjà présent, on en prend un déterministe).
insert into zabelie_topup_products
  (id, operator, label, face_value_htg, cost_htg, price_htg) values
  ('00000000-0000-0000-0000-0000000000f1', 'digicel', 'Test 100', 100, 100, 105);

-- ═══════════ T1 + T2 + T5 : parcours nominal, notification rejouée ═══════════
insert into zabelie_topup_orders
  (id, buyer_id, product_id, operator, beneficiary_phone,
   face_value_htg, amount_htg, cost_htg, rail, status) values
  ('00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000e9'::uuid,
   '00000000-0000-0000-0000-0000000000f1', 'digicel', '50937123456',
   100, 105, 100, 'moncash', 'created');

select zabelie_topup_transition('00000000-0000-0000-0000-0000000000c1', 'payment_pending');

-- Webhook/retour livré DEUX FOIS (montant correct 105).
select zabelie_topup_confirm_payment('00000000-0000-0000-0000-0000000000c1', 'TXT1', '{}'::jsonb, 105);
select zabelie_topup_confirm_payment('00000000-0000-0000-0000-0000000000c1', 'TXT1', '{}'::jsonb, 105);

select zabelie_topup_transition('00000000-0000-0000-0000-0000000000c1', 'fulfillment_pending');
select zabelie_topup_transition('00000000-0000-0000-0000-0000000000c1', 'delivered',
  '{"provider_ref":"RLD-1"}'::jsonb);

-- ═══════════ T3a : montant HTG falsifié ═══════════
insert into zabelie_topup_orders
  (id, buyer_id, product_id, operator, beneficiary_phone,
   face_value_htg, amount_htg, cost_htg, rail, status) values
  ('00000000-0000-0000-0000-0000000000c2',
   '00000000-0000-0000-0000-0000000000e9'::uuid,
   '00000000-0000-0000-0000-0000000000f1', 'digicel', '50937123456',
   100, 105, 100, 'moncash', 'created');
select zabelie_topup_transition('00000000-0000-0000-0000-0000000000c2', 'payment_pending');
select zabelie_topup_confirm_payment('00000000-0000-0000-0000-0000000000c2', 'TXT2', '{}'::jsonb, 50);

-- ═══════════ T3b : montant USD falsifié (rail zelle) ═══════════
insert into zabelie_topup_orders
  (id, buyer_id, product_id, operator, beneficiary_phone,
   face_value_htg, amount_htg, cost_htg, rail, status, expected_usd_cents) values
  ('00000000-0000-0000-0000-0000000000c3',
   '00000000-0000-0000-0000-0000000000e9'::uuid,
   '00000000-0000-0000-0000-0000000000f1', 'digicel', '50937123456',
   100, 105, 100, 'zelle', 'created', 80);
select zabelie_topup_transition('00000000-0000-0000-0000-0000000000c3', 'payment_pending');
select zabelie_topup_confirm_payment('00000000-0000-0000-0000-0000000000c3', 'ZELLE:x', '{}'::jsonb, null, 79);

-- ═══════════ T5 suite : échec livraison → remboursement tracé ═══════════
insert into zabelie_topup_orders
  (id, buyer_id, product_id, operator, beneficiary_phone,
   face_value_htg, amount_htg, cost_htg, rail, status) values
  ('00000000-0000-0000-0000-0000000000c4',
   '00000000-0000-0000-0000-0000000000e9'::uuid,
   '00000000-0000-0000-0000-0000000000f1', 'digicel', '50937123456',
   100, 105, 100, 'moncash', 'created');
select zabelie_topup_transition('00000000-0000-0000-0000-0000000000c4', 'payment_pending');
select zabelie_topup_confirm_payment('00000000-0000-0000-0000-0000000000c4', 'TXT4', '{}'::jsonb, 105);
select zabelie_topup_transition('00000000-0000-0000-0000-0000000000c4', 'fulfillment_pending');
select zabelie_topup_transition('00000000-0000-0000-0000-0000000000c4', 'failed',
  '{"reason":"fulfillment_failed"}'::jsonb);
select zabelie_topup_transition('00000000-0000-0000-0000-0000000000c4', 'refund_pending');
select zabelie_topup_transition('00000000-0000-0000-0000-0000000000c4', 'refunded',
  '{"refund_reference":"MC-REF-1","refund_rail":"moncash"}'::jsonb);

-- ════════════════════════════ Assertions ════════════════════════════
do $$
declare
  v_status   topup_status;
  v_paid_txn int;
  v_ledger   int;
  v_err      boolean;
begin
  -- T1/T2 : livré ; le rejeu de la notification n'a produit QU'UNE transition paid.
  select status into v_status from zabelie_topup_orders
   where id = '00000000-0000-0000-0000-0000000000c1';
  assert v_status = 'delivered', format('T1: attendu delivered, obtenu %s', v_status);

  select count(*) into v_paid_txn from zabelie_topup_ledger
   where order_id = '00000000-0000-0000-0000-0000000000c1' and to_status = 'paid';
  assert v_paid_txn = 1, format('T2: une seule transition paid attendue, obtenu %s', v_paid_txn);

  -- Audit BRH : le parcours complet est tracé (4 transitions).
  select count(*) into v_ledger from zabelie_topup_ledger
   where order_id = '00000000-0000-0000-0000-0000000000c1';
  assert v_ledger = 4, format('T2: 4 lignes de ledger attendues, obtenu %s', v_ledger);

  -- T1 : transition interdite → erreur (delivered → paid impossible).
  v_err := false;
  begin
    perform zabelie_topup_transition('00000000-0000-0000-0000-0000000000c1', 'paid');
  exception when others then
    v_err := true;
  end;
  assert v_err, 'T1: la transition delivered → paid aurait dû lever une erreur';

  -- T3a : HTG falsifié → failed, tracé.
  select status into v_status from zabelie_topup_orders
   where id = '00000000-0000-0000-0000-0000000000c2';
  assert v_status = 'failed', format('T3a: attendu failed, obtenu %s', v_status);

  -- T3b : USD falsifié → failed.
  select status into v_status from zabelie_topup_orders
   where id = '00000000-0000-0000-0000-0000000000c3';
  assert v_status = 'failed', format('T3b: attendu failed, obtenu %s', v_status);

  -- T4 : ledger APPEND-ONLY.
  v_err := false;
  begin
    update zabelie_topup_ledger set amount_htg = 999
     where order_id = '00000000-0000-0000-0000-0000000000c1';
  exception when others then
    v_err := true;
  end;
  assert v_err, 'T4: UPDATE sur le ledger aurait dû être bloqué';

  v_err := false;
  begin
    delete from zabelie_topup_ledger
     where order_id = '00000000-0000-0000-0000-0000000000c1';
  exception when others then
    v_err := true;
  end;
  assert v_err, 'T4: DELETE sur le ledger aurait dû être bloqué';

  -- T5 : remboursement tracé jusqu'à refunded.
  select status into v_status from zabelie_topup_orders
   where id = '00000000-0000-0000-0000-0000000000c4';
  assert v_status = 'refunded', format('T5: attendu refunded, obtenu %s', v_status);

  select count(*) into v_ledger from zabelie_topup_ledger
   where order_id = '00000000-0000-0000-0000-0000000000c4'
     and to_status in ('refund_pending', 'refunded');
  assert v_ledger = 2, format('T5: refund_pending+refunded tracés attendus, obtenu %s', v_ledger);

  raise notice 'OK — T1 machine à états ; T2 idempotence (paid=%, ledger=4) ; T3 montants falsifiés rejetés ; T4 ledger immuable ; T5 remboursement tracé',
    v_paid_txn;
end $$;

rollback;
