-- ============================================================================
-- 0022 — Zabelie Business, Vague 1 « Fè m peye » (se faire payer)
-- ============================================================================
-- Cadrage : docs/13-BUSINESS-V1-TECH.md. Décisions porteur (2026-07-13) :
--   • Commission 10 % (config, ajustable sans migration).
--   • SANS escrow/rétention : le pro est crédité IMMÉDIATEMENT sur son solde
--     disponible (balance_htg), pas de fenêtre J+7. → migration 100 % ADDITIVE :
--     ne touche NI escrow_entries NI mature_wallets NI platform_earnings.
--   • Le mouvement d'argent passe par le livre unique wallet_transactions.
--
-- Invariants money-path respectés (miroir de confirm_payment) :
--   • Totaux JAMAIS acceptés du client — recalculés serveur (qty × unit_price).
--   • Confirmation idempotente (clé unique), montant vérifié en base.
--   • Toute écriture via fonction SECURITY DEFINER révoquée du client.
-- ============================================================================

-- ───────────────────────── Config (taux ajustable) ─────────────────────────
create table zabelie_biz_config (
  key   text primary key,
  value integer not null,
  note  text
);
insert into zabelie_biz_config (key, value, note) values
  ('commission_bps', 1000,
   'Commission Business en points de base (1000 = 10 %). Ajustable sans migration. Défaut de départ — à revalider selon le coût réel du rail MonCash.');

-- ───────────────────────── Taxonomie fermée (docs/12 §3) ────────────────────
create table zabelie_biz_categories (
  slug                text primary key,
  label_fr            text not null,
  label_ht            text not null,
  sort_order          integer not null default 0,
  is_bookable_default boolean not null default false,
  active              boolean not null default true
);
insert into zabelie_biz_categories (slug, label_fr, label_ht, sort_order, is_bookable_default) values
  ('creatif-design',       'Création & design',        'Kreyasyon & desen',      10, false),
  ('audio-musique',        'Audio & musique',          'Odyo & mizik',           20, false),
  ('dev-tech',             'Développement & tech',     'Devlopman & teknoloji',  30, false),
  ('marketing-digital',    'Marketing digital',        'Maketin dijital',        40, false),
  ('redaction-traduction', 'Rédaction & traduction',   'Redaksyon & tradiksyon', 50, false),
  ('formation-coaching',   'Formation & coaching',     'Fòmasyon & kotchin',     60, false),
  ('beaute-bienetre',      'Beauté & bien-être',       'Bèlte & byennèt',        70, true),
  ('evenementiel',         'Événementiel',             'Evènman',                80, true),
  ('artisanat-mode',       'Artisanat & mode',         'Atizana & mòd',          90, false),
  ('services-pro',         'Services professionnels',  'Sèvis pwofesyonèl',     100, false),
  ('maison-reparation',    'Maison & réparation',      'Kay & reparasyon',      110, false),
  ('autre',                'Autre',                    'Lòt',                   999, false);

-- ───────────────────────── Espace professionnel ────────────────────────────
create table zabelie_biz_professionals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references auth.users(id) on delete cascade,
  display_name     text not null,
  slug             text not null unique,
  bio              text,
  avatar_url       text,
  next_invoice_seq integer not null default 1,   -- numéro de facture lisible, par pro
  created_at       timestamptz not null default now()
);

-- ───────────────────────── Répertoire client (propre au pro) ────────────────
create table zabelie_biz_clients (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references zabelie_biz_professionals(id) on delete cascade,
  name            text not null,
  phone           text,
  email           text,
  linked_user_id  uuid references auth.users(id),
  notes           text,
  created_at      timestamptz not null default now()
);
create index biz_clients_pro_idx on zabelie_biz_clients (professional_id);

-- ───────────────────────── Facture ─────────────────────────────────────────
create type zabelie_biz_invoice_status as enum
  ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void');

create table zabelie_biz_invoices (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references zabelie_biz_professionals(id) on delete cascade,
  client_id       uuid not null references zabelie_biz_clients(id) on delete restrict,
  invoice_number  text,                          -- 'FCT-000123', généré à l'envoi
  status          zabelie_biz_invoice_status not null default 'draft',
  subtotal_htg    bigint not null default 0 check (subtotal_htg >= 0),   -- SERVEUR
  total_htg       bigint not null default 0 check (total_htg >= 0),      -- SERVEUR
  paid_htg        bigint not null default 0 check (paid_htg >= 0),       -- SERVEUR
  currency        text not null default 'HTG',
  due_date        date,
  public_token    text not null unique,
  reminded_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (paid_htg <= total_htg)                  -- jamais de sur-paiement
);
create index biz_invoices_pro_idx on zabelie_biz_invoices (professional_id, status);
create index biz_invoices_due_idx on zabelie_biz_invoices (status, due_date);

create table zabelie_biz_invoice_items (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references zabelie_biz_invoices(id) on delete cascade,
  label          text not null,
  qty            integer not null check (qty > 0),
  unit_price_htg bigint not null check (unit_price_htg >= 0),
  line_total_htg bigint not null check (line_total_htg >= 0),   -- RECALCULÉ serveur
  sort_order     integer not null default 0
);
create index biz_items_invoice_idx on zabelie_biz_invoice_items (invoice_id);

-- Paiements — commission stockée ICI (additif ; platform_earnings non touché).
create table zabelie_biz_payments (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references zabelie_biz_invoices(id) on delete cascade,
  provider        payment_rail not null,
  provider_ref    text,
  amount_htg      bigint not null check (amount_htg > 0),      -- brut de CE versement
  commission_htg  bigint not null default 0,                   -- part plateforme
  net_htg         bigint not null default 0,                   -- crédité au pro
  rate_bps        integer not null default 0,                  -- taux figé au paiement
  status          text not null default 'confirmed',
  idempotency_key text unique,                                 -- anti-rejeu
  paid_at         timestamptz not null default now()
);
create index biz_payments_invoice_idx on zabelie_biz_payments (invoice_id);

-- ───────────────────────── RLS ─────────────────────────────────────────────
alter table zabelie_biz_config        enable row level security;
alter table zabelie_biz_categories    enable row level security;
alter table zabelie_biz_professionals enable row level security;
alter table zabelie_biz_clients       enable row level security;
alter table zabelie_biz_invoices      enable row level security;
alter table zabelie_biz_invoice_items enable row level security;
alter table zabelie_biz_payments      enable row level security;

-- Catégories : lecture publique (liste fermée). Config : service role only.
create policy biz_cat_read on zabelie_biz_categories for select using (active);

-- Le pro lit son espace + ses données rattachées.
create policy biz_pro_self on zabelie_biz_professionals for select
  using (auth.uid() = user_id);
create policy biz_clients_owner on zabelie_biz_clients for select using (
  exists (select 1 from zabelie_biz_professionals p
          where p.id = professional_id and p.user_id = auth.uid()));
create policy biz_invoices_owner on zabelie_biz_invoices for select using (
  exists (select 1 from zabelie_biz_professionals p
          where p.id = professional_id and p.user_id = auth.uid()));
create policy biz_items_owner on zabelie_biz_invoice_items for select using (
  exists (select 1 from zabelie_biz_invoices i
          join zabelie_biz_professionals p on p.id = i.professional_id
          where i.id = invoice_id and p.user_id = auth.uid()));
create policy biz_payments_owner on zabelie_biz_payments for select using (
  exists (select 1 from zabelie_biz_invoices i
          join zabelie_biz_professionals p on p.id = i.professional_id
          where i.id = invoice_id and p.user_id = auth.uid()));

-- Aucune écriture directe côté client : tout passe par les fonctions ci-dessous.
revoke insert, update, delete on
  zabelie_biz_config, zabelie_biz_categories, zabelie_biz_professionals,
  zabelie_biz_clients, zabelie_biz_invoices, zabelie_biz_invoice_items,
  zabelie_biz_payments
  from anon, authenticated;

-- ───────────────────────── Helpers internes ────────────────────────────────
-- Recalcule subtotal/total d'une facture depuis ses lignes (source de vérité).
create or replace function zabelie_biz_recompute_invoice(p_invoice uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_sum bigint;
begin
  select coalesce(sum(line_total_htg), 0) into v_sum
    from zabelie_biz_invoice_items where invoice_id = p_invoice;
  update zabelie_biz_invoices
     set subtotal_htg = v_sum, total_htg = v_sum, updated_at = now()
   where id = p_invoice;
end;
$$;
revoke all on function zabelie_biz_recompute_invoice(uuid) from public, anon, authenticated;

-- ───────────────────────── RPC — ajout/maj d'une ligne (DRAFT only) ─────────
create or replace function zabelie_biz_upsert_item(
  p_invoice     uuid,
  p_label       text,
  p_qty         integer,
  p_unit_price  bigint,
  p_item        uuid default null    -- null = insert ; sinon update
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status zabelie_biz_invoice_status;
  v_line   bigint;
  v_id     uuid;
begin
  select status into v_status from zabelie_biz_invoices where id = p_invoice;
  if v_status is null then
    raise exception 'zabelie_biz_upsert_item: facture introuvable';
  end if;
  if v_status <> 'draft' then
    raise exception 'zabelie_biz_upsert_item: facture non modifiable (statut %)', v_status;
  end if;
  if p_qty <= 0 or p_unit_price < 0 then
    raise exception 'zabelie_biz_upsert_item: qty > 0 et prix >= 0 requis';
  end if;

  v_line := p_qty::bigint * p_unit_price;   -- total ligne RECALCULÉ (jamais du client)

  if p_item is null then
    insert into zabelie_biz_invoice_items (invoice_id, label, qty, unit_price_htg, line_total_htg)
    values (p_invoice, p_label, p_qty, p_unit_price, v_line)
    returning id into v_id;
  else
    update zabelie_biz_invoice_items
       set label = p_label, qty = p_qty, unit_price_htg = p_unit_price, line_total_htg = v_line
     where id = p_item and invoice_id = p_invoice
     returning id into v_id;
  end if;

  perform zabelie_biz_recompute_invoice(p_invoice);
  return v_id;
end;
$$;
revoke all on function zabelie_biz_upsert_item(uuid, text, integer, bigint, uuid)
  from public, anon, authenticated;

-- ───────────────────────── RPC — envoyer (DRAFT → SENT) ─────────────────────
create or replace function zabelie_biz_send_invoice(p_invoice uuid)
returns zabelie_biz_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv zabelie_biz_invoices;
  v_seq integer;
  v_pro uuid;
begin
  select * into v_inv from zabelie_biz_invoices where id = p_invoice for update;
  if not found then raise exception 'send_invoice: facture introuvable'; end if;
  if v_inv.status <> 'draft' then
    raise exception 'send_invoice: déjà envoyée (statut %)', v_inv.status;
  end if;
  if v_inv.total_htg <= 0 then
    raise exception 'send_invoice: total nul — ajoutez au moins une ligne';
  end if;

  -- Numéro lisible, séquence atomique par pro.
  update zabelie_biz_professionals
     set next_invoice_seq = next_invoice_seq + 1
   where id = v_inv.professional_id
   returning next_invoice_seq - 1 into v_seq;

  update zabelie_biz_invoices
     set status = 'sent',
         invoice_number = 'FCT-' || lpad(v_seq::text, 6, '0'),
         updated_at = now()
   where id = p_invoice
   returning * into v_inv;
  return v_inv;
end;
$$;
revoke all on function zabelie_biz_send_invoice(uuid) from public, anon, authenticated;

-- ───────────────────────── RPC — confirmer un paiement (cœur money-path) ────
-- Idempotent, montant vérifié, crédit IMMÉDIAT du net au solde disponible du
-- pro (SANS escrow). Commission figée depuis la config au moment du paiement.
create or replace function zabelie_biz_confirm_invoice_payment(
  p_invoice      uuid,
  p_provider     payment_rail,
  p_provider_ref text,
  p_amount       bigint,
  p_idempotency  text          -- ex: 'biz_pay:<order_ref>' — anti-rejeu
) returns zabelie_biz_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv        zabelie_biz_invoices;
  v_bps        integer;
  v_commission bigint;
  v_net        bigint;
  v_owner      uuid;
  v_wallet     uuid;
  v_pay        zabelie_biz_payments;
begin
  -- Rejeu : même clé déjà encaissée → on renvoie le paiement existant.
  select * into v_pay from zabelie_biz_payments where idempotency_key = p_idempotency;
  if found then return v_pay; end if;

  select * into v_inv from zabelie_biz_invoices where id = p_invoice for update;
  if not found then raise exception 'confirm: facture introuvable'; end if;
  if v_inv.status not in ('sent', 'partially_paid', 'overdue') then
    raise exception 'confirm: facture non payable (statut %)', v_inv.status;
  end if;
  if p_amount <= 0 then raise exception 'confirm: montant invalide'; end if;
  if v_inv.paid_htg + p_amount > v_inv.total_htg then
    raise exception 'confirm: sur-paiement refusé (reste dû %)',
      v_inv.total_htg - v_inv.paid_htg;
  end if;

  -- Commission depuis la config (figée sur le paiement).
  select value into v_bps from zabelie_biz_config where key = 'commission_bps';
  v_bps := coalesce(v_bps, 1000);
  v_commission := round(p_amount::numeric * v_bps / 10000);
  v_net := p_amount - v_commission;

  -- Wallet du pro (créé à la volée). owner_id = user du pro = profiles.id.
  select user_id into v_owner from zabelie_biz_professionals
   where id = v_inv.professional_id;
  insert into wallets (owner_id) values (v_owner) on conflict (owner_id) do nothing;
  select id into v_wallet from wallets where owner_id = v_owner;

  -- Enregistre le paiement (idempotent par clé unique).
  insert into zabelie_biz_payments
    (invoice_id, provider, provider_ref, amount_htg, commission_htg, net_htg,
     rate_bps, status, idempotency_key)
  values
    (p_invoice, p_provider, p_provider_ref, p_amount, v_commission, v_net,
     v_bps, 'confirmed', p_idempotency)
  returning * into v_pay;

  -- Crédit IMMÉDIAT du net au solde DISPONIBLE (sans escrow) + ligne au ledger.
  insert into wallet_transactions
    (wallet_id, type, amount_htg, idempotency_key, reference)
  values
    (v_wallet, 'credit', v_net, 'biz_invoice_credit:' || v_pay.id,
     'Facture ' || coalesce(v_inv.invoice_number, left(v_inv.id::text, 8)));
  update wallets set balance_htg = balance_htg + v_net where id = v_wallet;

  -- Avance l'état de la facture.
  update zabelie_biz_invoices
     set paid_htg = paid_htg + p_amount,
         status = (case when paid_htg + p_amount >= total_htg then 'paid'
                        else 'partially_paid' end)::zabelie_biz_invoice_status,
         updated_at = now()
   where id = p_invoice;

  return v_pay;
end;
$$;
revoke all on function zabelie_biz_confirm_invoice_payment(uuid, payment_rail, text, bigint, text)
  from public, anon, authenticated;

-- ───────────────────────── RPC — annuler (VOID si non payée) ────────────────
create or replace function zabelie_biz_void_invoice(p_invoice uuid)
returns zabelie_biz_invoices
language plpgsql
security definer
set search_path = public
as $$
declare v_inv zabelie_biz_invoices;
begin
  select * into v_inv from zabelie_biz_invoices where id = p_invoice for update;
  if not found then raise exception 'void: facture introuvable'; end if;
  if v_inv.paid_htg > 0 then
    raise exception 'void: facture déjà encaissée — impossible d''annuler';
  end if;
  update zabelie_biz_invoices set status = 'void', updated_at = now()
   where id = p_invoice returning * into v_inv;
  return v_inv;
end;
$$;
revoke all on function zabelie_biz_void_invoice(uuid) from public, anon, authenticated;

-- ───────────────────────── RPC — portail client (par token, SANS login) ────
-- Seule fonction Business exposée à anon. Ne renvoie QUE des colonnes sûres,
-- pour la facture du token — jamais d'ID interne, jamais une autre facture.
create or replace function zabelie_biz_get_invoice_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_inv zabelie_biz_invoices; v_result jsonb;
begin
  select * into v_inv from zabelie_biz_invoices
   where public_token = p_token and status <> 'draft';
  if not found then return null; end if;

  select jsonb_build_object(
    'invoice_number', v_inv.invoice_number,
    'status',         v_inv.status,
    'total_htg',      v_inv.total_htg,
    'paid_htg',       v_inv.paid_htg,
    'currency',       v_inv.currency,
    'due_date',       v_inv.due_date,
    'professional',   (select display_name from zabelie_biz_professionals
                        where id = v_inv.professional_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'label', label, 'qty', qty,
               'unit_price_htg', unit_price_htg, 'line_total_htg', line_total_htg)
             order by sort_order)
      from zabelie_biz_invoice_items where invoice_id = v_inv.id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
-- Exposée au portail public (lecture d'une facture par token opaque uniquement).
revoke all on function zabelie_biz_get_invoice_by_token(text) from public;
grant execute on function zabelie_biz_get_invoice_by_token(text) to anon, authenticated, service_role;
