-- Zabelie Talent — Rétention / minimisation (audit RGPD)
-- Le payload opérateur (payments.raw) n'est utile qu'à la réconciliation d'un
-- paiement encore 'pending'. Une fois le paiement clôturé (confirmed/failed) et
-- passé un délai d'audit, on efface raw : minimisation (Art. 5(1)(c)) + limitation
-- de conservation (Art. 5(1)(e)). L'identifiant du payeur n'est déjà plus écrit
-- (redactPayment côté app) ; cette purge nettoie aussi l'historique existant.

create or replace function purge_payment_raw(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update payments
     set raw = null
   where raw is not null
     and status in ('confirmed', 'failed')
     and coalesce(confirmed_at, created_at) < now() - make_interval(days => p_days);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Réservé au service role (cron / back-office), jamais exposé au client.
revoke all on function purge_payment_raw(integer) from public, anon, authenticated;
