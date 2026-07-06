-- Zabelie Digi — Durcissement sécurité (advisors Supabase, post-migration prod)
-- 1. RLS manquant sur 2 tables financières (niveau ERROR au linter) : sans RLS,
--    l'API REST Supabase (PostgREST) les expose aux clients authentifiés.
--    Aucune policy = service role uniquement — le bon défaut pour l'argent.
alter table platform_earnings enable row level security;
alter table escrow_entries    enable row level security;

-- Le vendeur peut lire SES entrées d'escrow (transparence du J+7) ; l'écriture
-- reste réservée aux fonctions SECURITY DEFINER / service role.
create policy "escrow_owner_read"
  on escrow_entries for select using (
    exists (select 1 from wallets w
            where w.id = escrow_entries.wallet_id and w.owner_id = auth.uid())
  );

-- 2. search_path mutable (niveau WARN) sur 3 fonctions : on le fige.
alter function commission_rate_bps(creator_tier) set search_path = public;
alter function apply_review_aggregates() set search_path = public;
alter function zabelie_topup_ledger_guard() set search_path = public;
