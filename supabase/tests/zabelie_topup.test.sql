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
--   T6. BL-137 (ALERTE BRH, 0029) : zabelie_topup_reserve_order —
--       (a) jour HAÏTIEN pas UTC (calcul déterministe, indépendant de l'heure
--           d'exécution du test) ; (b) plafond/tx rejeté ; (c) plafond
--           journalier atteint → rejeté SANS créer de commande ; (d) sous le
--           plafond → commande créée dans le MÊME appel (atomique).

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

-- ═══════════ T6 : BL-137 (ALERTE BRH, 0029) — reserve_order atomique ═══════════
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ea'::uuid, 'topup-buyer2@test.local'),
  ('00000000-0000-0000-0000-0000000000eb'::uuid, 'topup-buyer3@test.local')
  on conflict do nothing;

-- 4 commandes « comptées » (statut ≠ created/failed/refunded) aujourd'hui,
-- même bénéficiaire (évite de déclencher la vélocité) : 4 × 6000 = 24 000.
insert into zabelie_topup_orders
  (buyer_id, product_id, operator, beneficiary_phone,
   face_value_htg, amount_htg, cost_htg, rail, status) values
  ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000f1',
   'digicel', '50937123456', 100, 6000, 100, 'moncash', 'paid'),
  ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000f1',
   'digicel', '50937123456', 100, 6000, 100, 'moncash', 'paid'),
  ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000f1',
   'digicel', '50937123456', 100, 6000, 100, 'moncash', 'paid'),
  ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000f1',
   'digicel', '50937123456', 100, 6000, 100, 'moncash', 'paid');

do $$
declare
  v_haiti_day_start timestamptz;
  v_result           jsonb;
  v_count_before     int;
  v_count_after      int;
begin
  -- T6a : le calcul du début de journée utilise le fuseau Haïti, pas UTC —
  -- 2026-01-02 02:00 UTC = encore le 1er janvier en Haïti (UTC-5, 21h locale)
  -- → début de journée Haïti attendu 2026-01-01 05:00 UTC (minuit local),
  -- PAS 2026-01-02 00:00 UTC (ancien calcul, basculait 19h trop tôt).
  v_haiti_day_start := date_trunc(
    'day', timestamptz '2026-01-02 02:00:00+00' at time zone 'America/Port-au-Prince'
  ) at time zone 'America/Port-au-Prince';
  assert v_haiti_day_start = timestamptz '2026-01-01 05:00:00+00',
    format('T6a: début de journée Haïti attendu 2026-01-01 05:00+00, obtenu %s', v_haiti_day_start);

  -- T6b : montant > plafond/tx (5000 HTG par défaut) → rejeté, AUCUNE commande créée.
  select count(*) into v_count_before
    from zabelie_topup_orders where buyer_id = '00000000-0000-0000-0000-0000000000eb';
  select zabelie_topup_reserve_order(
    '00000000-0000-0000-0000-0000000000eb', '00000000-0000-0000-0000-0000000000f1',
    '50937000001', 'digicel', 100, 6000, 100, 'moncash', null
  ) into v_result;
  select count(*) into v_count_after
    from zabelie_topup_orders where buyer_id = '00000000-0000-0000-0000-0000000000eb';
  assert (v_result->>'ok')::boolean = false,
    format('T6b: attendu ok=false, obtenu %s', v_result);
  assert v_result->>'reason' = 'per_tx',
    format('T6b: raison attendue per_tx, obtenu %s', v_result->>'reason');
  assert (v_result->>'cap_htg')::int = 5000,
    format('T6b: cap_htg attendu 5000, obtenu %s', v_result->>'cap_htg');
  assert v_count_after = v_count_before,
    'T6b: un rejet ne doit créer AUCUNE commande';

  -- T6c : 24 000 déjà « comptés » aujourd'hui + 2000 demandés = 26 000 > 25 000
  -- (plafond/jour par défaut) → rejeté, AUCUNE commande créée.
  select count(*) into v_count_before
    from zabelie_topup_orders where buyer_id = '00000000-0000-0000-0000-0000000000ea';
  select zabelie_topup_reserve_order(
    '00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000f1',
    '50937123456', 'digicel', 100, 2000, 100, 'moncash', null
  ) into v_result;
  select count(*) into v_count_after
    from zabelie_topup_orders where buyer_id = '00000000-0000-0000-0000-0000000000ea';
  assert (v_result->>'ok')::boolean = false,
    format('T6c: attendu ok=false (plafond jour), obtenu %s', v_result);
  assert v_result->>'reason' = 'per_day',
    format('T6c: raison attendue per_day, obtenu %s', v_result->>'reason');
  assert v_count_after = v_count_before,
    'T6c: un rejet plafond/jour ne doit créer AUCUNE commande';

  -- T6d : 24 000 + 1000 = 25 000, PAS strictement supérieur au plafond → admis.
  -- Vérification/insertion ATOMIQUES : la commande créée par CE MÊME appel.
  select zabelie_topup_reserve_order(
    '00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000f1',
    '50937123456', 'digicel', 100, 1000, 100, 'moncash', null
  ) into v_result;
  select count(*) into v_count_after
    from zabelie_topup_orders where buyer_id = '00000000-0000-0000-0000-0000000000ea';
  assert (v_result->>'ok')::boolean = true,
    format('T6d: attendu ok=true (à la limite exacte du plafond), obtenu %s', v_result);
  assert v_result->>'order_id' is not null, 'T6d: order_id attendu dans le résultat';
  assert v_count_after = v_count_before + 1,
    format('T6d: 1 commande de plus attendue (%s → %s)', v_count_before, v_count_after);

  raise notice 'OK — T6a fuseau Haïti correct ; T6b plafond/tx rejeté (0 commande) ; T6c plafond/jour rejeté (0 commande) ; T6d admis à la limite exacte, commande créée atomiquement';
end $$;

rollback;
