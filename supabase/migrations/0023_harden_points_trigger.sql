-- ============================================================================
-- 0023 — Durcissement : révocation d'EXECUTE sur la fonction-trigger fidélité
-- ============================================================================
-- L'advisor sécurité Supabase (lint 0028/0029) signale que
-- `fn_points_ledger_update_balance()` (trigger de maj du solde de points, 0021)
-- est SECURITY DEFINER et exposée à anon/authenticated via /rest/v1/rpc.
--
-- Non exploitable en pratique (Postgres refuse d'appeler une fonction
-- « returns trigger » hors contexte trigger), mais on aligne cette fonction sur
-- la règle du projet : AUCUNE fonction SECURITY DEFINER n'est exécutable par le
-- client. Le trigger continue de s'exécuter normalement — le déclenchement d'un
-- trigger ne dépend pas du privilège EXECUTE (il tourne au nom du propriétaire).
-- ============================================================================

revoke all on function fn_points_ledger_update_balance()
  from public, anon, authenticated;
