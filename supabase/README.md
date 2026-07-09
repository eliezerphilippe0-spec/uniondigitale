# Supabase — Zabelie Digi

Schéma, RLS et logique de paiement de la plateforme (Vague 1).

## Migrations (à appliquer dans l'ordre)

| Fichier | Contenu |
|---------|---------|
| `migrations/0001_schema.sql` | Tables, enums, contraintes, index. Clés d'idempotence `UNIQUE`. |
| `migrations/0002_rls.sql` | Row Level Security : catalogue public, données privées par propriétaire. |
| `migrations/0003_payment_functions.sql` | `confirm_payment()` — confirmation **idempotente** (EPIC 4). |
| `migrations/0004_storage.sql` | Bucket privé `product-files` (fichiers livrables). |
| `migrations/0005_commission.sql` | Tier vendeur + commission (net crédité, `platform_earnings`). Supersède `confirm_payment`. |
| `migrations/0006_escrow_maturation.sql` | Escrow J+7 (`pending`/`available`), `mature_wallets`, `refund_order`. Supersède `confirm_payment`. |
| `migrations/0007`→`0012` | Standalone, avis, rails diaspora, top-up, durcissement sécurité, coupons. |
| `migrations/0013_geo_analytics.sql` | `profiles.country_code` + vues agrégées `analytics_geo_*` (dashboard `/admin/geo`), verrouillées service_role. |
| `migrations/0014_haiti_departments.sql` | `profiles.region_code` + vue `analytics_geo_ht` (talents par département). |
| `migrations/0015_profiles_hardening.sql` | Trigger anti-escalade `role`/`tier` + GRANT colonne (localisation non lisible publiquement). |
| `migrations/0016_gdpr_retention.sql` | `purge_payment_raw()` — purge du payload opérateur clôturé (rétention RGPD). |
| `migrations/0017_seller_suspension.sql` | Suspension réversible (modération) : `suspended_*`, produits masqués via policy, **zéro écriture monétaire** (BRH). |

## Appliquer

Avec la CLI Supabase (recommandé) :

```bash
supabase db push          # applique les migrations sur le projet lié
```

Ou manuellement : exécuter chaque fichier `.sql` dans l'ordre via le SQL Editor.

## Invariants paiement garantis en base

1. **Idempotence** — `payments.idempotency_key` et
   `wallet_transactions.idempotency_key` sont `UNIQUE`. Rejouer un webhook ne
   crée aucun doublon (commande / crédit).
2. **Confirmation serveur-à-serveur** — `confirm_payment()` est `SECURITY
   DEFINER` et n'est exécutable que par le **service role** (webhook MonCash
   vérifié, ou réconciliateur). Jamais depuis le navigateur.
3. **Réconciliation** — statuts (`pending`/`confirmed`/`failed`) et `raw` jsonb
   permettent de rapprocher chaque paiement avec l'opérateur. Aucun orphelin.

## Décision D-3 (V-9)

Comptes/wallet **propres** à Zabelie Digi. Fusion future possible avec
Zabelie 1 via `profiles.zabelie1_user_id` (nullable + unique) — sans migration
lourde.

## Différé (Vague 2 — bloqué)

- **NatCash** : ajouter la valeur `'natcash'` à l'enum `payment_rail`.
- **Retraits BRH** : la table `payouts` existe mais l'exécution des retraits est
  conditionnée aux règles BRH (docs/00-CONTEXTE.md §11/§14).

## Storage

Les livrables (`product_assets.storage_path`) vivent dans un bucket **privé**.
L'accès se fait par **URL signée** délivrée côté serveur **après** paiement
confirmé — jamais d'accès public au fichier.

## Géo-analytics (0007)

`profiles.country_code` (ISO-3166 alpha-2, nullable) alimente le dashboard
back-office `/admin/geo`. Deux vues **agrégées par pays** — `analytics_geo_users`
et `analytics_geo_sales` — n'exposent que des compteurs, **jamais un individu ni
une coordonnée**. Accès **révoqué** à `anon`/`authenticated` : seul le
`service_role` (back-office, garde `role='admin'` côté app) peut les lire.

## Durcissement `profiles` (0009)

Les policies de `profiles` étant **par ligne**, trois colonnes sensibles étaient
exposées/modifiables côté client. Corrections :

- **`role` / `tier` non modifiables côté client** — trigger
  `protect_profile_privileges` : seul le `service_role` peut les fixer ;
  anon/authenticated se voient forcer les défauts (INSERT) ou l'ancienne valeur
  (UPDATE). Bloque l'auto-promotion admin et la fraude au tier de commission.
- **Lecture publique restreinte** — `revoke select` global puis `grant select`
  colonne par colonne : `country_code`, `region_code`, `zabelie1_user_id` ne sont
  lisibles que par le `service_role`. Le catalogue public ne voit que
  `display_name`, `bio`, `avatar_url`, `role`, `tier`.
