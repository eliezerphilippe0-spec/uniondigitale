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

## 6. Critères d'acceptation

- [ ] Rejouer un webhook ne crée aucun doublon (commande / crédit / livraison).
- [ ] **Test « redirect coupé »** : coupure réseau après paiement, avant retour
      navigateur → le système se rattrape via webhook + réconciliateur, sans double
      livraison ni perte.
- [ ] Aucune livraison/crédit sans confirmation serveur-à-serveur.
- [ ] Tout paiement est rapprochable dans le back-office.

## 7. Conformité BRH (différée)

Les **retraits** et l'intégration **NatCash** dépendent des règles BRH (KYC, plafonds,
reporting). ⛔ Bloqué — voir `00-CONTEXTE.md §11` et `§14`.
