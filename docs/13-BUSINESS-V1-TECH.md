# Zabelie Business — Vague 1 « Fè m peye » : cadrage technique (prêt à coder)

> **📋 DESIGN TECHNIQUE — AUCUN CODE ÉCRIT.** Niveau « prêt à implémenter » :
> schéma exact, RLS, fonctions, intégration au money-path, plan de test.
> Suite de `docs/12-BUSINESS.md` (§7, Vague 1). À valider avant migration.
> Aucune migration appliquée. Numéro de migration à figer au moment de coder
> (le prochain libre après le dernier réellement mergé).

**Périmètre strict de la Vague 1** : espace pro + **facture off-marketplace** +
**portail client par token** + **paiement MonCash** + crédit du pro (commission
+ escrow J+7, réutilisés) + relances. **PAS** de vitrine publique (Vague 2),
**PAS** de rendez-vous/acompte (Vague 3), **PAS** de rétention/escrow inter-
utilisateurs (BRH — cf. `docs/12` §6).

---

## 1. Décision d'architecture centrale : comment l'argent d'une facture entre dans le ledger unique

Le money-path Digi crédite un vendeur ainsi (dans `confirm_payment`, `0009`) :
`paiement confirmé → commission calculée → NET en escrow J+7 → wallet.pending`
puis `mature_wallets` (cron) fait passer `pending → disponible`.

Tout est **clé sur `orders`** :
- `wallet_transactions.order_id` — **déjà nullable** ✅ (peut accueillir un
  crédit Business sans changement, `idempotency_key = 'biz_invoice_credit:<id>'`).
- `escrow_entries.order_id` — **`not null unique references orders`** ❌ : bloque
  la réutilisation directe pour une facture.
- `platform_earnings.order_id` — à vérifier (probablement même contrainte).

### Recommandation : généralisation MINIMALE de l'escrow, pas de pipeline parallèle

Plutôt que dupliquer toute la logique commission/escrow (risque de divergence)
ou toucher lourdement `orders`, on **généralise la source de l'escrow** :

```sql
-- Migration Business (partie money-path) :
alter table escrow_entries
  alter column order_id drop not null,                 -- devient nullable
  add column invoice_id uuid references zabelie_biz_invoices(id) on delete cascade,
  add constraint escrow_source_exactly_one
    check ((order_id is not null) <> (invoice_id is not null));  -- XOR strict
-- l'unicité order_id existante reste ; on ajoute :
create unique index escrow_invoice_uq on escrow_entries (invoice_id)
  where invoice_id is not null;

alter table platform_earnings
  alter column order_id drop not null,
  add column invoice_id uuid references zabelie_biz_invoices(id) on delete cascade,
  add constraint earnings_source_exactly_one
    check ((order_id is not null) <> (invoice_id is not null));
```

→ Un seul livre de comptes (escrow + wallet + earnings partagés), une seule
logique de maturation (`mature_wallets` inchangé — il lit `escrow_entries` par
`status/matures_at`, pas par `order_id`). **À vérifier à l'implémentation** :
que `mature_wallets` et `refund_order` ne supposent nulle part `order_id not
null` (sinon les adapter — les tests SQL existants doivent rester verts).

> ⚠️ Cette généralisation **touche des tables du money-path en production**.
> C'est le seul point à haut risque de la Vague 1 → migration + tests SQL
> complets + revue humaine obligatoires avant merge. Le reste (factures,
> clients, portail) est additif et neutre.

---

## 2. Schéma — tables Vague 1

```sql
-- Taxonomie fermée (cf. docs/12 §3), seedée par la migration.
create table zabelie_biz_categories (
  slug                text primary key,
  label_fr            text not null,
  label_ht            text not null,
  sort_order          integer not null default 0,
  is_bookable_default boolean not null default false,
  active              boolean not null default true
);
-- seed : les 12 familles de docs/12 §3.

create table zabelie_biz_professionals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  display_name   text not null,
  slug           text not null unique,             -- URL publique (Vague 2)
  bio            text,
  avatar_url     text,
  created_at     timestamptz not null default now()
);

create table zabelie_biz_clients (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references zabelie_biz_professionals(id) on delete cascade,
  name            text not null,
  phone           text,
  email           text,
  linked_user_id  uuid references auth.users(id),  -- si le client a un compte
  notes           text,
  created_at      timestamptz not null default now()
);
create index biz_clients_pro_idx on zabelie_biz_clients (professional_id);

create type zabelie_biz_invoice_status as enum
  ('draft','sent','partially_paid','paid','overdue','void');

create table zabelie_biz_invoices (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references zabelie_biz_professionals(id) on delete cascade,
  client_id       uuid not null references zabelie_biz_clients(id) on delete restrict,
  status          zabelie_biz_invoice_status not null default 'draft',
  subtotal_htg    bigint not null default 0 check (subtotal_htg >= 0),  -- SERVEUR
  total_htg       bigint not null default 0 check (total_htg >= 0),     -- SERVEUR
  paid_htg        bigint not null default 0 check (paid_htg >= 0),      -- SERVEUR
  currency        text not null default 'HTG',
  due_date        date,
  public_token    text not null unique,            -- portail client, opaque
  reminded_at     timestamptz,                     -- anti double-relance
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index biz_invoices_pro_idx    on zabelie_biz_invoices (professional_id, status);
create index biz_invoices_due_idx    on zabelie_biz_invoices (status, due_date);

create table zabelie_biz_invoice_items (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references zabelie_biz_invoices(id) on delete cascade,
  label          text not null,
  qty            integer not null check (qty > 0),
  unit_price_htg bigint not null check (unit_price_htg >= 0),
  line_total_htg bigint not null check (line_total_htg >= 0),  -- RECALCULÉ serveur
  sort_order     integer not null default 0
);
create index biz_items_invoice_idx on zabelie_biz_invoice_items (invoice_id);

create table zabelie_biz_payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references zabelie_biz_invoices(id) on delete cascade,
  provider     payment_rail not null,              -- réutilise l'enum existant (moncash|zelle)
  provider_ref text,
  amount_htg   bigint not null check (amount_htg > 0),
  status       text not null default 'pending',
  idempotency_key text unique,                     -- anti-rejeu webhook
  paid_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index biz_payments_invoice_idx on zabelie_biz_payments (invoice_id);
```

---

## 3. Machine à états de la facture

```
DRAFT ─(send_invoice)─► SENT ─(paiement confirmé)─► PAID
  │                       │
  │                       ├─(versement partiel)─► PARTIALLY_PAID ─(solde)─► PAID
  │                       ├─(cron: due_date < now)─► OVERDUE ─(paiement)─► PAID
  └─(void_invoice)─► VOID ◄─(void_invoice, si non payée)
```
- `DRAFT → SENT` : `zabelie_biz_send_invoice(id)` — fige le total, génère le
  `public_token` si absent, marque `sent`. Une facture `sent` n'est plus
  éditable (les items sont verrouillés — sinon le montant présenté au client
  changerait sous ses yeux).
- `SENT/PARTIALLY_PAID/OVERDUE → PAID|PARTIALLY_PAID` : **uniquement** via
  confirmation de paiement serveur-à-serveur (jamais le client).
- `→ VOID` : seulement si `paid_htg = 0` (on n'annule pas une facture déjà
  encaissée — remboursement = autre flux, hors V1).

---

## 4. Fonctions SQL (toutes `security definer`, `search_path=public`, `revoke all` du client)

| Fonction | Rôle | Garde-fous |
|---|---|---|
| `zabelie_biz_upsert_item(invoice, label, qty, unit_price)` | Ajoute/maj une ligne **en DRAFT uniquement** ; recalcule `line_total = qty*unit_price` puis `subtotal/total` de la facture | prix jamais du client au sens « total » ; refuse si statut ≠ draft |
| `zabelie_biz_send_invoice(invoice)` | DRAFT→SENT, fige, génère token | refuse si total = 0 ou statut ≠ draft |
| `zabelie_biz_confirm_invoice_payment(invoice, provider_ref, amount, raw)` | **Cœur money-path.** Idempotent (clé `biz_invoice_credit:<payment_id>`), vérifie `amount`, incrémente `paid_htg`, passe `partially_paid`/`paid`, crédite le NET (après commission tier) en **escrow J+7** + `platform_earnings`, écrit `wallet_transactions` | miroir exact de `confirm_payment` ; montant vérifié en base ; anti-rejeu sur `provider_ref` |
| `zabelie_biz_get_invoice_by_token(token)` | Vue **portail client sans login** : renvoie uniquement colonnes sûres (montants, statut, items, nom du pro) — jamais d'IDs internes ni de données d'autres factures | exposée à `anon` en lecture, mais ne prend qu'un token opaque ; aucune autre fonction Business n'est exposée |
| `zabelie_biz_void_invoice(invoice)` | → VOID si `paid_htg=0` | refuse si déjà encaissée |

> Le crédit du pro **réutilise la maturation existante** : `escrow_entries`
> (généralisé §1) + `mature_wallets` (inchangé). Zéro nouvelle logique de
> maturation.

---

## 5. RLS

```sql
alter table zabelie_biz_professionals enable row level security;
alter table zabelie_biz_clients       enable row level security;
alter table zabelie_biz_invoices      enable row level security;
alter table zabelie_biz_invoice_items enable row level security;
alter table zabelie_biz_payments      enable row level security;
alter table zabelie_biz_categories    enable row level security;

-- Catégories : lecture publique (liste fermée).
create policy biz_cat_read on zabelie_biz_categories for select using (active);

-- Le pro ne voit QUE son espace (via son user_id).
create policy biz_pro_self on zabelie_biz_professionals for select
  using (auth.uid() = user_id);
-- clients / invoices / items / payments : lisibles par le pro propriétaire.
create policy biz_clients_owner on zabelie_biz_clients for select using (
  exists (select 1 from zabelie_biz_professionals p
          where p.id = professional_id and p.user_id = auth.uid()));
-- (mêmes policies SELECT pour invoices/items/payments via jointure au pro)

-- AUCUNE policy insert/update/delete pour authenticated/anon : toute écriture
-- passe par les fonctions security definer ci-dessus. revoke explicite en plus.
revoke insert, update, delete on zabelie_biz_professionals, zabelie_biz_clients,
  zabelie_biz_invoices, zabelie_biz_invoice_items, zabelie_biz_payments
  from authenticated, anon;
```

**Portail client** : le client n'a PAS de ligne RLS. Il accède via la route
serveur `/facture/[token]` qui appelle `zabelie_biz_get_invoice_by_token` (la
seule fonction exposée) — jamais un accès table direct, jamais l'ID interne.

---

## 6. Routes API (Next.js)

| Route | Méthode | Auth | Rôle |
|---|---|---|---|
| `/api/biz/activate` | POST | pro | crée `professionals` (slug) |
| `/api/biz/clients` | GET/POST | pro | répertoire (auto-créé à la 1re facture aussi) |
| `/api/biz/invoices` | POST | pro | crée DRAFT + items (total recalculé serveur) |
| `/api/biz/invoices/[id]/send` | POST | pro | DRAFT→SENT, renvoie le lien `public_token` |
| `/api/biz/invoices/[id]` | GET | pro | détail (RLS) |
| `/api/facture/[token]` | GET | public | portail client (fonction token) |
| `/api/facture/[token]/pay` | POST | public | initie le paiement MonCash pour la facture |
| `/api/moncash/return` | (existant) | — | **étendre** : si `reference` = une facture Business → `zabelie_biz_confirm_invoice_payment` au lieu de `confirm_payment` |

> Le point d'intégration paiement = le **même** retour MonCash déjà en prod
> (`app/api/moncash/return`), qui aiguille déjà topup vs marketplace ; on ajoute
> une 3ᵉ branche « facture Business ». Réconciliateur : idem, une branche de plus.

---

## 7. Crons (Vercel)
- **Relances** : cron quotidien — factures `sent` dont `due_date` approche/dépasse
  → passe `overdue`, envoie relance (Resend, best-effort, `reminded_at` anti
  double-envoi). Réutilise `lib/zabelie-email.ts`.
- ⚠️ Plan Hobby = quotidien ; suffisant pour des relances (pas de la
  réconciliation fine).

---

## 8. Plan de test (SQL, gabarit `supabase/tests/*.test.sql`)
- **B1** total recalculé serveur : injecter un `line_total`/`total` faux → la
  fonction l'écrase par `qty*unit_price`.
- **B2** facture `sent` non éditable : `upsert_item` sur une facture envoyée → refus.
- **B3** confirmation idempotente : 3× `confirm_invoice_payment` → un seul
  crédit escrow, un seul `platform_earnings`, `paid_htg` correct.
- **B4** montant falsifié → rejet (miroir du scénario money-path).
- **B5** partiel → `partially_paid`, solde → `paid`.
- **B6** void interdit si `paid_htg>0`.
- **B7** portail token : `get_invoice_by_token` ne renvoie jamais une autre
  facture ; `award`/écritures refusées au rôle `authenticated`.
- **B8** escrow généralisé : `mature_wallets` fait mûrir un crédit **facture**
  comme un crédit **commande** (les tests money-path existants restent verts).

---

## 9. Décisions (⚑ = tranchées par le porteur)
1. ⚑ **Commission Business = 7 % fixe** (décision porteur 2026-07-13), J+7 comme
   Digi. Taux fixe unique (pas de paliers), donc plus simple que
   `commission_rate_bps(tier)`. **À stocker en config base** (table type
   `zabelie_biz_config` ou réutilisation d'un pattern « clé/valeur » comme
   `zabelie_topup_limits`), pas en dur dans la fonction → ajustable sans
   migration. ⚠️ Nuance à afficher clairement au pro : 7 % se situe entre les
   paliers Digi (Standard 10 % / Elite 6 %) — un vendeur Elite paie donc un peu
   plus sur ses factures Business que sur ses ventes produit. Choix assumé.
2. **Généralisation de l'escrow (§1)** : OK pour toucher `escrow_entries`/
   `platform_earnings` en prod (avec migration + tests + revue) ? C'est le seul
   point sensible. *(Alternative plus lourde : pipeline escrow Business séparé.)*
3. **Paiement partiel** : autorisé au client librement, ou seulement des jalons
   définis par le pro ? *(défaut : libre au MVP, plus simple.)*
4. **Numéro de facture lisible** (ex. `FCT-000123`) en plus de l'UUID ? *(utile
   pour l'usage réel — proposé : oui, séquence par pro.)*

> Rien n'est codé tant que (1)–(4) ne sont pas tranchés, en particulier (2).
