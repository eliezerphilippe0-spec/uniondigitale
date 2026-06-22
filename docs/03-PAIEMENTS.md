# Zabelie Talent — Architecture de paiement (EPIC 4)

> Détail technique du module le plus critique. Découle de `00-CONTEXTE.md §8–§11`.
> Les **trois invariants** sont des contraintes dures, non négociables.

---

## 1. Rails

| Rail | Statut | Vague |
|------|--------|-------|
| **MonCash** (Digicel) | ✅ Ouvert — rail du MVP | 1 |
| **NatCash** | ⛔ Bloqué — en attente d'accès | 2 |
| **Wallet interne** | ✅ Crédit après confirmation | 1 |

## 2. Les trois invariants (NON NÉGOCIABLES)

1. **Idempotence garantie en base** — clé d'idempotence avec contrainte d'unicité
   PostgreSQL. Rejeu sans effet de bord.
2. **Confirmation serveur-à-serveur obligatoire** — la vérité du paiement vient du
   webhook/vérification opérateur, jamais du retour navigateur seul.
3. **Réconciliation totale** — chaque transaction est rapprochable ; aucun paiement
   orphelin.

## 3. Flux nominal MonCash

```
Acheteur
  │  1. Clique "Payer"
  ▼
App (Next.js)
  │  2. Crée order (status=pending) + payment (idempotency_key unique)
  │  3. Demande à MonCash une session de paiement
  ▼
MonCash  ──redirect──►  Acheteur paie  ──redirect retour──►  App (NON fiable)
  │
  │  4. Webhook serveur-à-serveur ──►  App
  ▼
App
  │  5. Vérifie + applique (idempotent) : order=paid, crédit wallet, livraison
  ▼
Acheteur reçoit le fichier / la mise en relation
```

> Le **retour de redirection navigateur (étape 3 bis)** ne déclenche RIEN de définitif.
> Seul le **webhook (4)** ou le **réconciliateur** confirme.

## 4. Idempotence (niveau base)

- Chaque `payment` porte une `idempotency_key` **UNIQUE** (contrainte DB).
- L'application du paiement (crédit wallet + livraison) est **idempotente** : un même
  événement appliqué deux fois ne produit qu'un seul effet.
- `[INFÉRÉ]` Implémentation : `INSERT ... ON CONFLICT DO NOTHING` / transaction +
  vérification d'état, à détailler à l'implémentation.

## 5. Réconciliateur

Job périodique qui :
- liste les paiements `pending` / ambigus,
- interroge l'état réel chez l'opérateur,
- applique (idempotent) la confirmation ou l'annulation,
- alerte sur les cas non résolus.

## 6. Critères d'acceptation (= specs de test)

- [x] Rejouer la confirmation 3× ne crée qu'un seul crédit (idempotence).
      → `supabase/tests/payment_idempotency.test.sql` (scénario A).
- [x] **Montant falsifié → rejeté** : si l'opérateur rapporte un montant ≠ commande,
      `confirm_payment` met le paiement en `failed`, la commande en `disputed`,
      aucun crédit/livraison. → garde-fou DB + `supabase/tests/...` (scénario B)
      + `tests/payment.test.ts` (`amountMatches`).
- [x] **Redirect coupé** : le réconciliateur (`/api/reconcile`, cron) rattrape les
      paiements `pending` orphelins via vérification serveur-à-serveur.
      → logique isolée dans `lib/reconcile.ts`, **testée** dans
      `tests/reconcile.test.ts` (orphelin rattrapé, encore pending, montant
      rejeté, erreurs non bloquantes, rejeu idempotent).
- [x] Aucune livraison/crédit sans confirmation serveur-à-serveur.
- [x] Parcours navigateur (checkout → redirection MonCash, pages de résultat) :
      `e2e/money-path.spec.ts` (Playwright, exécuté en CI).
- [ ] Tout paiement est rapprochable dans le back-office (`/admin`). ✅ vue en place.

## 7. Implémentation (code)

| Brique | Fichier |
|--------|---------|
| Client MonCash (OAuth, CreatePayment, Retrieve*) | `lib/moncash.ts` |
| Client Supabase service role (serveur) | `lib/supabase/admin.ts` |
| Checkout (order + payment pending → redirect) | `app/api/checkout/route.ts` |
| Retour navigateur (vérif + confirm) | `app/api/moncash/return/route.ts` |
| Réconciliateur (cron, rattrape les pending) | `app/api/reconcile/route.ts` |
| Livraison (URL signée si payé) | `app/api/download/route.ts` |
| Confirmation idempotente (DB) | `supabase/migrations/0003_payment_functions.sql` |

Flux : `BuyButton` → `/api/checkout` → MonCash → retour `/api/moncash/return`
(vérif serveur-à-serveur → `confirm_payment`). En cas de retour coupé,
`/api/reconcile` (cron) interroge MonCash par `orderId` et confirme. La
livraison passe par `/api/download` qui exige une commande `paid`.

> ⚠️ Nécessite des identifiants MonCash (sandbox) et un projet Supabase lié pour
> fonctionner de bout en bout. La logique d'idempotence est garantie en base
> (cf. §4) indépendamment des identifiants.

## 8. Conformité BRH (différée)

Les **retraits** et l'intégration **NatCash** dépendent des règles BRH (KYC, plafonds,
reporting). ⛔ Bloqué — voir `00-CONTEXTE.md §11` et `§14`.
