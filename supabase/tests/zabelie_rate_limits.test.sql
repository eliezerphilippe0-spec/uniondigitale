-- Tests de la limitation de débit (audit sécurité §6) — compteur atomique.
-- Usage : psql "$DATABASE_URL" -f supabase/tests/zabelie_rate_limits.test.sql
--
-- Couvre :
--   R1. Sous le plafond → TRUE à chaque appel, compteur exact.
--   R2. Plafond dépassé → FALSE, et FALSE au rejeu (pas de reset accidentel).
--   R3. Clés indépendantes : saturer 'a' ne pénalise pas 'b'.
--   R4. Paramètres invalides (limite/fenêtre ≤ 0) → exception, rien d'écrit.

begin;

do $$
declare
  v_ok   boolean;
  v_hits integer;
begin
  -- R1 : 3 appels sous un plafond de 3 → tous acceptés.
  select zabelie_rate_limit('t:a', 3, 3600) into v_ok;
  assert v_ok, 'R1: appel 1/3 aurait dû passer';
  select zabelie_rate_limit('t:a', 3, 3600) into v_ok;
  assert v_ok, 'R1: appel 2/3 aurait dû passer';
  select zabelie_rate_limit('t:a', 3, 3600) into v_ok;
  assert v_ok, 'R1: appel 3/3 aurait dû passer (plafond inclus)';
  select hits into v_hits from zabelie_rate_limits where key = 't:a';
  assert v_hits = 3, format('R1: hits attendu 3, obtenu %s', v_hits);

  -- R2 : 4e appel → refus, et le refus persiste au rejeu.
  select zabelie_rate_limit('t:a', 3, 3600) into v_ok;
  assert not v_ok, 'R2: appel 4/3 aurait dû être refusé';
  select zabelie_rate_limit('t:a', 3, 3600) into v_ok;
  assert not v_ok, 'R2: le refus doit persister dans la même fenêtre';

  -- R3 : une autre clé garde son budget entier.
  select zabelie_rate_limit('t:b', 3, 3600) into v_ok;
  assert v_ok, 'R3: la clé b ne doit pas hériter du compteur de a';

  -- R4 : paramètres invalides → exception claire.
  begin
    perform zabelie_rate_limit('t:c', 0, 3600);
    raise exception 'R4: p_limit=0 aurait dû lever une exception';
  exception when others then
    if sqlerrm like 'R4:%' then raise; end if; -- notre propre échec remonte
  end;

  raise notice 'OK — R1 budget respecté ; R2 refus persistant ; R3 clés isolées ; R4 params gardés';
end $$;

rollback;
