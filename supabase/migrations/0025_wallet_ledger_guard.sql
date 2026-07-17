-- ============================================================================
-- 0025 — BL-123 (C-14) : wallet_transactions devient APPEND-ONLY par trigger
-- ============================================================================
-- Le ledger topup est protégé contre UPDATE/DELETE depuis 0010, mais le livre
-- unique wallet_transactions (crédits vendeurs marketplace + factures Business)
-- ne l'était pas : le service role pouvait techniquement réécrire l'historique.
-- Même standard partout : l'historique d'argent ne se corrige que par une
-- écriture compensatoire, jamais par modification.

create or replace function zabelie_wallet_ledger_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'wallet_transactions est APPEND-ONLY : % interdit (corriger par écriture compensatoire)', tg_op;
end;
$$;

create trigger zabelie_wallet_ledger_immutable
  before update or delete on wallet_transactions
  for each row execute function zabelie_wallet_ledger_guard();

-- Cohérence 0023 : une fonction-trigger n'est pas appelable hors trigger, mais
-- on la révoque quand même (règle projet : rien d'exécutable côté client).
revoke all on function zabelie_wallet_ledger_guard()
  from public, anon, authenticated;
