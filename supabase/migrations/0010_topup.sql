-- Zabelie Digi — Service de recharge téléphonique (topup) Digicel/Natcom (V-11)
-- Positionnement BRH (Circulaire 121) : Zabelie Digi est un REVENDEUR de
-- recharge télécom, JAMAIS un émetteur de monnaie électronique.
--   • Aucun solde rechargeable acheteur, aucun P2P, aucun cash-in/cash-out.
--   • Flux strict : paiement (MonCash/Zelle) → livraison immédiate.
--   • Remboursement uniquement vers le moyen de paiement d'origine.
--   • Traçabilité totale : zabelie_topup_ledger APPEND-ONLY (trigger bloquant).
--   • Plafonds anti-abus configurables (zabelie_topup_limits) + velocity checks.
-- Pipeline volontairement SÉPARÉ du money-path marketplace (orders/payments/
-- wallets) : pas de vendeur, pas de commission, pas d'escrow — le wallet
-- vendeur existant n'est pas touché (contrainte BRH n°5).

-- ───────────────────────── Enums ─────────────────────────
create type topup_operator as enum ('digicel', 'natcom');

-- Machine à états (transitions validées par zabelie_topup_transition) :
-- created → payment_pending → paid → fulfillment_pending → delivered
--                                             ↓
--                                          failed → refund_pending → refunded
create type topup_status as enum (
  'created', 'payment_pending', 'paid', 'fulfillment_pending',
  'delivered', 'failed', 'refund_pending', 'refunded'
);

-- ───────────────────────── Catalogue ─────────────────────────
-- Prix TOUJOURS résolus côté serveur depuis cette table (jamais du client).
-- Montants en centimes ? Non : le HTG s'utilise en unités entières partout
-- ailleurs dans le schéma (amount_htg integer) — on garde la même convention.
create table zabelie_topup_products (
  id                  uuid primary key default gen_random_uuid(),
  operator            topup_operator not null,
  label               text not null,              -- ex. « Rechaj 100 HTG »
  face_value_htg      integer not null check (face_value_htg > 0),   -- valeur livrée
  cost_htg            integer not null check (cost_htg > 0),         -- prix coûtant fournisseur
  price_htg           integer not null check (price_htg > 0),        -- prix de vente
  provider            text not null default 'reloadly',
  provider_product_id text,                       -- operatorId Reloadly
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  check (price_htg >= cost_htg)                   -- marge jamais négative
);

-- ───────────────────────── Commandes ─────────────────────────
create table zabelie_topup_orders (
  id                 uuid primary key default gen_random_uuid(),
  buyer_id           uuid not null references auth.users(id),
  product_id         uuid not null references zabelie_topup_products(id),
  operator           topup_operator not null,
  beneficiary_phone  text not null,               -- format 509XXXXXXXX
  face_value_htg     integer not null,
  amount_htg         integer not null,            -- prix payé (figé au checkout)
  cost_htg           integer not null,            -- coûtant (figé au checkout)
  status             topup_status not null default 'created',
  rail               payment_rail not null,       -- moncash | zelle (natcash ⛔)
  expected_usd_cents integer,                     -- figé au checkout si rail USD
  payment_ref        text,                        -- transactionId MonCash / réf Zelle
  provider_ref       text,                        -- transactionId fournisseur topup
  attempts           integer not null default 0,  -- tentatives de fulfillment
  last_error         text,
  raw                jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Index velocity checks + relevés par compte (contrainte BRH n°7).
create index zabelie_topup_orders_buyer_idx
  on zabelie_topup_orders (buyer_id, created_at);
create index zabelie_topup_orders_beneficiary_idx
  on zabelie_topup_orders (beneficiary_phone, created_at);
create index zabelie_topup_orders_status_idx
  on zabelie_topup_orders (status, created_at);

-- ───────────────────────── Ledger append-only ─────────────────────────
-- Audit trail immuable (contrainte BRH n°6) : horodatage, compte acheteur,
-- bénéficiaire, opérateur, montant, référence paiement, référence fournisseur,
-- transition de statut. AUCUN UPDATE/DELETE possible (trigger).
create table zabelie_topup_ledger (
  id                bigint generated always as identity primary key,
  order_id          uuid not null references zabelie_topup_orders(id),
  buyer_id          uuid not null,
  beneficiary_phone text not null,
  operator          topup_operator not null,
  amount_htg        integer not null,
  from_status       topup_status,
  to_status         topup_status not null,
  payment_ref       text,
  provider_ref      text,
  detail            jsonb,
  created_at        timestamptz not null default now()
);

create index zabelie_topup_ledger_order_idx on zabelie_topup_ledger (order_id);

create or replace function zabelie_topup_ledger_guard()
returns trigger language plpgsql as $$
begin
  raise exception 'zabelie_topup_ledger est APPEND-ONLY (audit BRH) : % interdit', tg_op;
end;
$$;
create trigger zabelie_topup_ledger_immutable
  before update or delete on zabelie_topup_ledger
  for each row execute function zabelie_topup_ledger_guard();

-- ───────────────────────── Plafonds configurables ─────────────────────────
create table zabelie_topup_limits (
  key        text primary key,
  value      integer not null,
  comment    text,
  updated_at timestamptz not null default now()
);
insert into zabelie_topup_limits (key, value, comment) values
  ('per_tx_htg', 5000,
   'Plafond par transaction (HTG). Validé porteur 2026-07.'),
  ('per_day_htg', 25000,
   'Plafond par jour et par compte acheteur (HTG).'),
  ('distinct_beneficiaries_per_hour', 5,
   'Au-delà de N numéros bénéficiaires différents en 1 h → flag (velocity).');

-- ───────────────────────── RLS ─────────────────────────
alter table zabelie_topup_products enable row level security;
alter table zabelie_topup_orders   enable row level security;
alter table zabelie_topup_ledger   enable row level security;
alter table zabelie_topup_limits   enable row level security;

-- Catalogue : lecture publique des produits actifs (prix affichés).
create policy topup_products_read on zabelie_topup_products
  for select using (active);

-- Commandes : l'acheteur ne voit que les siennes. Écritures = service role
-- uniquement (aucune policy insert/update → refusé pour anon/authenticated).
create policy topup_orders_own on zabelie_topup_orders
  for select using (auth.uid() = buyer_id);

-- Ledger + limits : admin/service uniquement (aucune policy → service role seul).

-- ───────────────────────── Machine à états ─────────────────────────
-- Transitions autorisées — toute autre transition lève une erreur (et rien
-- n'est écrit). Chaque transition réussie ajoute une ligne au ledger.
create or replace function zabelie_topup_transition(
  p_order_id uuid,
  p_to       topup_status,
  p_detail   jsonb default null
)
returns zabelie_topup_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order zabelie_topup_orders;
  v_from  topup_status;
  v_ok    boolean;
begin
  select * into v_order from zabelie_topup_orders
   where id = p_order_id for update;
  if not found then
    raise exception 'zabelie_topup_transition: commande % introuvable', p_order_id;
  end if;
  v_from := v_order.status;

  -- Rejeu idempotent : déjà dans l'état cible → no-op.
  if v_order.status = p_to then
    return v_order;
  end if;

  v_ok := case
    when v_order.status = 'created'             and p_to in ('payment_pending', 'failed') then true
    when v_order.status = 'payment_pending'     and p_to in ('paid', 'failed') then true
    when v_order.status = 'paid'                and p_to in ('fulfillment_pending') then true
    when v_order.status = 'fulfillment_pending' and p_to in ('delivered', 'failed') then true
    when v_order.status = 'failed'              and p_to in ('refund_pending') then true
    when v_order.status = 'refund_pending'      and p_to in ('refunded') then true
    else false
  end;

  if not v_ok then
    raise exception 'zabelie_topup_transition: transition % → % interdite (commande %)',
      v_order.status, p_to, p_order_id;
  end if;

  update zabelie_topup_orders
     set status = p_to, updated_at = now()
   where id = p_order_id
   returning * into v_order;

  insert into zabelie_topup_ledger
    (order_id, buyer_id, beneficiary_phone, operator, amount_htg,
     from_status, to_status, payment_ref, provider_ref, detail)
  values
    (v_order.id, v_order.buyer_id, v_order.beneficiary_phone, v_order.operator,
     v_order.amount_htg, v_from, p_to,
     v_order.payment_ref, v_order.provider_ref, p_detail);

  return v_order;
end;
$$;
revoke all on function zabelie_topup_transition(uuid, topup_status, jsonb)
  from public, anon, authenticated;

-- ───────────────────────── Confirmation de paiement ─────────────────────────
-- Idempotente + garde-fous montant (HTG et USD), miroir des invariants du
-- marketplace. Rejouable sans double effet ; montant falsifié → failed.
create or replace function zabelie_topup_confirm_payment(
  p_order_id  uuid,
  p_payment_ref text default null,
  p_raw       jsonb default null,
  p_amount    integer default null,   -- HTG rapporté par MonCash
  p_usd_cents integer default null    -- cents USD (Zelle)
)
returns zabelie_topup_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order zabelie_topup_orders;
begin
  select * into v_order from zabelie_topup_orders
   where id = p_order_id for update;
  if not found then
    raise exception 'zabelie_topup_confirm_payment: commande % introuvable', p_order_id;
  end if;

  -- Rejeu (webhook livré deux fois) : déjà payé ou plus loin → no-op.
  if v_order.status in ('paid', 'fulfillment_pending', 'delivered',
                        'refund_pending', 'refunded') then
    return v_order;
  end if;

  update zabelie_topup_orders
     set payment_ref = coalesce(p_payment_ref, payment_ref),
         raw = coalesce(p_raw, raw)
   where id = p_order_id;

  -- Garde-fou HTG : montant opérateur ≠ prix figé → REJET tracé.
  if p_amount is not null and p_amount <> v_order.amount_htg then
    return zabelie_topup_transition(p_order_id, 'failed',
      jsonb_build_object('reason', 'payment_amount_mismatch',
                         'reported_htg', p_amount,
                         'expected_htg', v_order.amount_htg));
  end if;

  -- Garde-fou USD : montant reçu ≠ figé au checkout → REJET tracé.
  if p_usd_cents is not null
     and (v_order.expected_usd_cents is null
          or p_usd_cents <> v_order.expected_usd_cents) then
    return zabelie_topup_transition(p_order_id, 'failed',
      jsonb_build_object('reason', 'payment_usd_mismatch',
                         'reported_usd_cents', p_usd_cents,
                         'expected_usd_cents', v_order.expected_usd_cents));
  end if;

  return zabelie_topup_transition(p_order_id, 'paid',
    jsonb_build_object('payment_ref', p_payment_ref));
end;
$$;
revoke all on function zabelie_topup_confirm_payment(uuid, text, jsonb, integer, integer)
  from public, anon, authenticated;

-- ───────────────────────── Seed catalogue ─────────────────────────
-- Dénominations de départ. cost_htg = estimation à SYNCHRONISER avec les prix
-- réels Reloadly sandbox (voir OPS_TODO.md) ; price_htg = marge cible ~5 %
-- au-dessus du coûtant (validé porteur). provider_product_id à renseigner
-- après le mapping des operatorId Reloadly.
insert into zabelie_topup_products
  (operator, label, face_value_htg, cost_htg, price_htg) values
  ('digicel', 'Rechaj Digicel 25 HTG',    25,   25,   27),
  ('digicel', 'Rechaj Digicel 50 HTG',    50,   50,   53),
  ('digicel', 'Rechaj Digicel 100 HTG',  100,  100,  105),
  ('digicel', 'Rechaj Digicel 250 HTG',  250,  250,  263),
  ('digicel', 'Rechaj Digicel 500 HTG',  500,  500,  525),
  ('digicel', 'Rechaj Digicel 1000 HTG', 1000, 1000, 1050),
  ('natcom',  'Rechaj Natcom 25 HTG',     25,   25,   27),
  ('natcom',  'Rechaj Natcom 50 HTG',     50,   50,   53),
  ('natcom',  'Rechaj Natcom 100 HTG',   100,  100,  105),
  ('natcom',  'Rechaj Natcom 250 HTG',   250,  250,  263),
  ('natcom',  'Rechaj Natcom 500 HTG',   500,  500,  525),
  ('natcom',  'Rechaj Natcom 1000 HTG',  1000, 1000, 1050);
