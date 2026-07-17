-- ============================================================================
-- 0029 — BL-137 (C-9, ALERTE BRH) : plafond journalier topup — fuseau Haïti
-- + contrôle atomique
-- ============================================================================
-- Deux écarts signalés par la revue Team Agents (arbitrage porteur : corriger
-- les deux) :
--   (a) le plafond journalier (25 000 HTG/j, engagement Circ. 121) était
--       calculé sur le jour UTC — la journée basculait à 19-20 h heure
--       d'Haïti, pas à minuit local ;
--   (b) le contrôle était lecture-puis-écriture en 2 requêtes séparées
--       (app/api/zabelie/topup/orders/route.ts) : deux requêtes concurrentes
--       du même compte pouvaient toutes les deux lire un cumul sous le
--       plafond avant que l'une des deux n'insère — fenêtre de course bornée
--       seulement par le rate-limit (5 tentatives/min), pas par la base.
--
-- Fonction unique qui vérifie TOUS les plafonds (montant/tx, jour Haïti,
-- vélocité bénéficiaires/heure) et insère la commande dans le MÊME appel,
-- sous un verrou par acheteur (pg_advisory_xact_lock) : zéro fenêtre de
-- course, quel que soit le nombre de requêtes simultanées.

create or replace function zabelie_topup_reserve_order(
  p_buyer_id           uuid,
  p_product_id         uuid,
  p_beneficiary_phone  text,
  p_operator           topup_operator,
  p_face_value_htg     integer,
  p_amount_htg         integer,
  p_cost_htg           integer,
  p_rail               payment_rail,
  p_expected_usd_cents integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_per_tx_htg  integer;
  v_per_day_htg integer;
  v_velocity    integer;
  v_spent_today bigint;
  v_hour_phones integer;
  v_phone_seen  boolean;
  v_day_start   timestamptz;
  v_order       zabelie_topup_orders;
begin
  -- Sérialise PAR ACHETEUR : ferme la fenêtre de course entre la lecture du
  -- cumul et l'insertion — deux requêtes concurrentes du même compte
  -- s'exécutent désormais l'une après l'autre, jamais en parallèle.
  perform pg_advisory_xact_lock(hashtext(p_buyer_id::text));

  select coalesce(max(value) filter (where key = 'per_tx_htg'), 5000),
         coalesce(max(value) filter (where key = 'per_day_htg'), 25000),
         coalesce(max(value) filter (where key = 'distinct_beneficiaries_per_hour'), 5)
    into v_per_tx_htg, v_per_day_htg, v_velocity
    from zabelie_topup_limits;

  if p_amount_htg > v_per_tx_htg then
    return jsonb_build_object('ok', false, 'reason', 'per_tx', 'cap_htg', v_per_tx_htg);
  end if;

  -- (a) Jour HAÏTIEN, pas UTC — minuit heure de Port-au-Prince.
  v_day_start := date_trunc('day', now() at time zone 'America/Port-au-Prince')
                   at time zone 'America/Port-au-Prince';

  select coalesce(sum(amount_htg), 0) into v_spent_today
    from zabelie_topup_orders
   where buyer_id = p_buyer_id
     and created_at >= v_day_start
     -- Mêmes exclusions que l'ancien calcul JS : une commande 'created'
     -- (session paiement jamais établie) ou définitivement 'failed'/
     -- 'refunded' ne compte pas contre le plafond.
     and status not in ('failed', 'refunded', 'created');

  if v_spent_today + p_amount_htg > v_per_day_htg then
    return jsonb_build_object('ok', false, 'reason', 'per_day', 'cap_htg', v_per_day_htg);
  end if;

  select exists(
    select 1 from zabelie_topup_orders
     where buyer_id = p_buyer_id
       and beneficiary_phone = p_beneficiary_phone
       and created_at >= now() - interval '1 hour'
  ) into v_phone_seen;

  select count(distinct beneficiary_phone) into v_hour_phones
    from zabelie_topup_orders
   where buyer_id = p_buyer_id
     and created_at >= now() - interval '1 hour';

  if not v_phone_seen and v_hour_phones + 1 > v_velocity then
    return jsonb_build_object('ok', false, 'reason', 'velocity');
  end if;

  insert into zabelie_topup_orders (
    buyer_id, product_id, operator, beneficiary_phone, face_value_htg,
    amount_htg, cost_htg, rail, expected_usd_cents, status
  ) values (
    p_buyer_id, p_product_id, p_operator, p_beneficiary_phone, p_face_value_htg,
    p_amount_htg, p_cost_htg, p_rail, p_expected_usd_cents, 'created'
  )
  returning * into v_order;

  return jsonb_build_object('ok', true, 'order_id', v_order.id, 'amount_htg', v_order.amount_htg);
end;
$$;
revoke all on function zabelie_topup_reserve_order(
  uuid, uuid, text, topup_operator, integer, integer, integer, payment_rail, integer
) from public, anon, authenticated;
