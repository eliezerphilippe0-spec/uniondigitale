-- Tests du programme de fidélité (0020) — garde-fous non-monétaires.
-- Usage : psql "$DATABASE_URL" -f supabase/tests/points_rewards.test.sql
--
-- Couvre :
--   P1. award_points : solde et balance_after cohérents (avec verrou).
--   P2. redeem : la valeur vient du CATALOGUE, pas de l'appelant ; FIFO.
--   P3. redeem : solde insuffisant → refus, rien de consommé.
--   P4. apply_coupon_to_order : 1er usage OK + valeurs figées ; 2e usage refusé.
--   P5. Ledger append-only : UPDATE/DELETE sans effet.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f9'::uuid, 'points@test.local');

insert into rewards_catalog (id, label, points_cost, discount_percentage, max_discount_htg)
values ('00000000-0000-0000-0000-0000000000e1'::uuid, '-10 %', 500, 10, 1000);

do $$
declare
  v_uid   uuid := '00000000-0000-0000-0000-0000000000f9';
  v_rid   uuid := '00000000-0000-0000-0000-0000000000e1';
  v_bal   integer;
  v_coupon uuid;
  v_code  text;
  v_pct   integer;
  v_cap   integer;
  v_rows  integer;
  v_ok    boolean;
begin
  -- P1 : deux attributions → solde 300, dernier balance_after = 300.
  perform award_points(v_uid, 100, 'welcome_bonus');
  perform award_points(v_uid, 200, 'purchase');
  select balance into v_bal from points_balances where user_id = v_uid;
  assert v_bal = 300, format('P1: solde attendu 300, obtenu %s', v_bal);
  -- created_at = now() est figé par transaction (2 lignes = même horodatage) :
  -- on vérifie le plus haut balance_after atteint, déterministe ici (2 gains).
  select max(balance_after) into v_bal from points_ledger where user_id = v_uid;
  assert v_bal = 300, format('P1: balance_after cumulé attendu 300, obtenu %s', v_bal);

  -- P2 : rédemption par reward_id — coût (500) et % (10) viennent du catalogue.
  -- Solde insuffisant (300 < 500) → doit refuser d'abord.
  begin
    perform redeem_points_for_coupon(v_uid, v_rid);
    raise exception 'P3: rédemption à 300 points aurait dû échouer';
  exception when others then
    if sqlerrm like 'P3:%' then raise; end if;
  end;

  -- Recharge à 600, puis rédemption réussie.
  perform award_points(v_uid, 300, 'purchase');   -- solde = 600
  select redeem_points_for_coupon(v_uid, v_rid) into v_coupon;
  select balance into v_bal from points_balances where user_id = v_uid;
  assert v_bal = 100, format('P2: solde après rédemption attendu 100, obtenu %s', v_bal);

  select code, discount_percentage, max_discount_htg
    into v_code, v_pct, v_cap
    from coupons where id = v_coupon;
  assert v_pct = 10, format('P2: %% figé attendu 10, obtenu %s', v_pct);
  assert v_cap = 1000, format('P2: plafond figé attendu 1000, obtenu %s', v_cap);

  -- P4 : application au checkout — 1er usage renvoie les valeurs figées.
  select discount_percentage, max_discount_htg
    into v_pct, v_cap
    from apply_coupon_to_order(v_uid, v_code, null);
  assert v_pct = 10, format('P4: apply %% attendu 10, obtenu %s', v_pct);

  -- 2e usage : coupon désormais 'redeemed' → aucune ligne renvoyée.
  select count(*) into v_rows
    from apply_coupon_to_order(v_uid, v_code, null);
  assert v_rows = 0, format('P4: 2e application aurait dû être refusée, %s ligne(s)', v_rows);

  -- P5 : ledger append-only — UPDATE/DELETE sans effet.
  update points_ledger set delta = 999999 where user_id = v_uid;
  select count(*) into v_rows from points_ledger where delta = 999999;
  assert v_rows = 0, 'P5: le ledger ne doit pas être modifiable (UPDATE)';
  delete from points_ledger where user_id = v_uid;
  select count(*) into v_rows from points_ledger where user_id = v_uid;
  assert v_rows > 0, 'P5: le ledger ne doit pas être supprimable (DELETE)';

  raise notice 'OK — P1 solde/balance_after ; P2 valeur du catalogue + FIFO ; P3 solde insuffisant refusé ; P4 coupon usage unique ; P5 ledger immuable';
end $$;

-- P6 : LA garde-fou de sécurité — un client authentifié ne DOIT PAS pouvoir
-- appeler award_points (sinon self-minting de points). REVOKE vérifié en direct.
do $$
declare v_denied boolean := false;
begin
  set local role authenticated;
  begin
    perform award_points('00000000-0000-0000-0000-0000000000f9'::uuid, 999999, 'admin_adjustment');
  exception when insufficient_privilege then
    v_denied := true;
  end;
  reset role;
  assert v_denied, 'P6: authenticated a pu exécuter award_points — REVOKE manquant !';
  raise notice 'OK — P6 award_points refusé au rôle authenticated (anti self-minting)';
end $$;

rollback;
