-- ============================================================================
-- 0030 — Audit post-revue : zabelie_topup_reserve_order, un seul scan 1 h
-- ============================================================================
-- Deux constats de l'audit du travail 0024→0029 :
--   • v_phone_seen (exists) et v_hour_phones (count distinct) scannaient DEUX
--     fois la même fenêtre (buyer_id + 1 h) en deux requêtes, toutes deux
--     tenues SOUS le verrou par acheteur → fusionnées en une seule requête ;
--     le verrou est tenu moins longtemps (moins de sérialisation par compte).
--   • Note d'architecture (pourquoi un verrou consultatif ici et pas l'UPDATE
--     conditionnel de 0012/zabelie_coupon_consume) : le quota coupon est un
--     COMPTEUR MONO-LIGNE — l'UPDATE conditionnel verrouille naturellement
--     cette ligne. Le plafond journalier est un AGRÉGAT sur plusieurs lignes
--     de zabelie_topup_orders : il n'existe aucune ligne unique à verrouiller,
--     d'où pg_advisory_xact_lock par acheteur. Règle pour la suite :
--     compteur mono-ligne → UPDATE conditionnel ; agrégat multi-lignes →
--     advisory lock (clé = acheteur).
-- Comportement STRICTEMENT inchangé — les tests T6a-d passent tels quels.

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
  -- Sérialise PAR ACHETEUR (agrégat multi-lignes : pas de ligne unique à
  -- verrouiller, cf. en-tête) : ferme la fenêtre de course entre la lecture
  -- du cumul et l'insertion.
  perform pg_advisory_xact_lock(hashtext(p_buyer_id::text));

  select coalesce(max(value) filter (where key = 'per_tx_htg'), 5000),
         coalesce(max(value) filter (where key = 'per_day_htg'), 25000),
         coalesce(max(value) filter (where key = 'distinct_beneficiaries_per_hour'), 5)
    into v_per_tx_htg, v_per_day_htg, v_velocity
    from zabelie_topup_limits;

  if p_amount_htg > v_per_tx_htg then
    return jsonb_build_object('ok', false, 'reason', 'per_tx', 'cap_htg', v_per_tx_htg);
  end if;

  -- Jour HAÏTIEN, pas UTC — minuit heure de Port-au-Prince (BL-137).
  v_day_start := date_trunc('day', now() at time zone 'America/Port-au-Prince')
                   at time zone 'America/Port-au-Prince';

  select coalesce(sum(amount_htg), 0) into v_spent_today
    from zabelie_topup_orders
   where buyer_id = p_buyer_id
     and created_at >= v_day_start
     -- 'created' (session paiement jamais établie) et les états définitifs
     -- 'failed'/'refunded' ne comptent pas contre le plafond.
     and status not in ('failed', 'refunded', 'created');

  if v_spent_today + p_amount_htg > v_per_day_htg then
    return jsonb_build_object('ok', false, 'reason', 'per_day', 'cap_htg', v_per_day_htg);
  end if;

  -- Vélocité : UN seul scan de la fenêtre 1 h (bool_or sur zéro ligne = NULL
  -- → coalesce false).
  select count(distinct beneficiary_phone),
         coalesce(bool_or(beneficiary_phone = p_beneficiary_phone), false)
    into v_hour_phones, v_phone_seen
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
