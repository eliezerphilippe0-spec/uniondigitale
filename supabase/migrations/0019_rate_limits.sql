-- Zabelie Digi — Limitation de débit en base (audit sécurité §6)
-- Compteur à FENÊTRE FIXE dans Postgres : fiable en serverless (pas de mémoire
-- process qui se vide à chaque déploiement Vercel), pas de service externe à
-- opérer. Protège les routes qui coûtent de l'argent à chaque appel
-- (checkout → session MonCash/Stripe, recharge) et la devinette de codes promo.

create table zabelie_rate_limits (
  key          text not null,        -- ex. 'checkout:<user_id>' / 'coupon_validate:<ip>'
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);

alter table zabelie_rate_limits enable row level security;
-- Aucune policy : service role uniquement (même défaut que le ledger topup).

-- Incrémente le compteur de la fenêtre courante et dit si l'appel est encore
-- dans le budget. ATOMIQUE (upsert) : deux requêtes simultanées ne peuvent pas
-- passer toutes les deux sous un plafond déjà atteint.
create or replace function zabelie_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits   integer;
begin
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'zabelie_rate_limit: p_limit et p_window_seconds doivent être > 0';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into zabelie_rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
  do update set hits = r.hits + 1
  returning hits into v_hits;

  -- Ménage opportuniste (~2 % des appels) : les fenêtres passées ne servent
  -- plus jamais — la table reste minuscule sans cron dédié.
  if random() < 0.02 then
    delete from zabelie_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;
revoke all on function zabelie_rate_limit(text, integer, integer)
  from public, anon, authenticated;
