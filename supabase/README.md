# Supabase — Zabelie Talent

Schéma, RLS et logique de paiement de la plateforme (Vague 1).

## Migrations (à appliquer dans l'ordre)

| Fichier | Contenu |
|---------|---------|
| `migrations/0001_schema.sql` | Tables, enums, contraintes, index. Clés d'idempotence `UNIQUE`. |
| `migrations/0002_rls.sql` | Row Level Security : catalogue public, données privées par propriétaire. |
| `migrations/0003_payment_functions.sql` | `confirm_payment()` — confirmation **idempotente** (EPIC 4). |
| `migrations/0004_storage.sql` | Bucket privé `product-files` (fichiers livrables). |
| `migrations/0005_commission.sql` | Tier vendeur + commission (net crédité, `platform_earnings`). Supersède `confirm_payment`. |

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

Comptes/wallet **propres** à Zabelie Talent. Fusion future possible avec
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
