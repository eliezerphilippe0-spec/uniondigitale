-- ============================================================================
-- 0026 — Correctif : search_path figé sur zabelie_wallet_ledger_guard (0025)
-- ============================================================================
-- L'advisor sécurité Supabase (lint 0011, function_search_path_mutable) a
-- signalé que zabelie_wallet_ledger_guard (trigger BL-123, 0025) n'avait pas
-- `set search_path = public` — écart par rapport à la règle du projet
-- (cohérence avec 0018 fix_search_path et 0023 pour le trigger équivalent
-- fn_points_ledger_update_balance). Comportement inchangé : create or replace
-- ne recrée pas le trigger, juste la fonction.

create or replace function zabelie_wallet_ledger_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'wallet_transactions est APPEND-ONLY : % interdit (corriger par écriture compensatoire)', tg_op;
end;
$$;

revoke all on function zabelie_wallet_ledger_guard()
  from public, anon, authenticated;
