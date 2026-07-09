-- Zabelie Digi — Fige search_path sur protect_profile_privileges (advisor WARN)
-- Incohérence avec le reste du codebase (purge_payment_raw, zabelie_coupon_consume…
-- ont tous `set search_path = public`) : cette fonction trigger l'avait omis.
alter function protect_profile_privileges() set search_path = public;
