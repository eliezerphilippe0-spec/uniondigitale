# Zabelie Digi — Recharge téléphonique (Topup) & conformité BRH

Service **first-party** de revente de recharge Digicel/Natcom (V-11).
**Principe directeur : Zabelie Digi est un REVENDEUR de recharge télécom,
jamais un émetteur de monnaie électronique** (cadre : Circulaire 121 BRH sur
les fournisseurs de services de paiement électronique).

---

## 1. Checklist de conformité BRH (8 contraintes — NON NÉGOCIABLES)

| # | Contrainte | Implémentation | Preuve |
|---|-----------|----------------|--------|
| 1 | **Aucun solde rechargeable acheteur** | Flux strict paiement → livraison immédiate. Aucune table de solde acheteur ; le schéma topup ne contient AUCUNE colonne de balance. | `0010_topup.sql` (aucun wallet acheteur) |
| 2 | **Aucun transfert P2P** | Aucun endpoint ni fonction de transfert entre utilisateurs. | Revue de `app/api/zabelie/**` |
| 3 | **Aucun cash-in / cash-out** | La plateforme ne convertit jamais monnaie ↔ valeur stockée. | Idem |
| 4 | **Remboursement vers le moyen d'origine uniquement** | Échec de livraison après paiement → `refund_pending` + **checkpoint humain** : l'admin rembourse via MonCash/Zelle (moyen d'origine) PUIS enregistre la référence (`refunded`). Jamais de crédit interne. | `app/api/admin/topup/refunds`, test SQL T5 |
| 5 | **Wallet vendeur = purement comptable, non modifié** | Pipeline topup totalement séparé du money-path marketplace (pas de commission, pas d'escrow, pas d'écriture wallet). | `0010_topup.sql` (aucune référence wallets) |
| 6 | **Traçabilité complète, ledger immuable** | `zabelie_topup_ledger` APPEND-ONLY (trigger bloquant UPDATE/DELETE) : horodatage, acheteur, bénéficiaire, opérateur, montant, réf. paiement, réf. fournisseur, transition. | Test SQL T4 (UPDATE/DELETE → erreur) |
| 7 | **Plafonds anti-abus + velocity** | `zabelie_topup_limits` configurable : **5 000 HTG/tx, 25 000 HTG/jour/compte, flag > 5 bénéficiaires distincts/h** (validés porteur 2026-07). Vérifiés AVANT création de commande ; index dédiés. | `lib/zabelie-topup/limits.ts` + tests unitaires |
| 8 | **KYC-lite proportionné** | Seules données collectées : compte acheteur authentifié + numéro bénéficiaire. Rien d'autre. | `app/api/zabelie/topup/orders` |

> Toute demande future en conflit (ex. « solde rechargeable ») doit être
> REFUSÉE avec explication du risque réglementaire avant toute implémentation.

## 2. Architecture

**Machine à états** (transitions uniquement via `zabelie_topup_transition`,
toute transition invalide lève une erreur — testé) :

```
created → payment_pending → paid → fulfillment_pending → delivered
                                            ↓
                                         failed → refund_pending → refunded
```

**Fournisseur (adapter pattern)** — `lib/zabelie-topup/provider.ts` :
- P1 : **Reloadly** (sandbox) — `reloadly.ts`. Idempotence : `customIdentifier`
  = `order.id` transmis au fournisseur → zéro double-recharge, même en rejeu.
- Fallback prévu : DingConnect (interface prête). P2 : accès direct
  Digicel/Natcom si accord distributeur.
- Retry backoff exponentiel (0 s/2 s/4 s, max 3), même clé d'idempotence.
  Échec définitif après paiement → `refund_pending` + alerte back-office.

**Paiement** : rails existants réutilisés — MonCash (HTG, confirmation
serveur-à-serveur au retour + réconciliateur) et Zelle (USD diaspora,
montant figé `expected_usd_cents`, confirmation admin). NatCash ⛔ (règle
dure). Garde-fous montant EN BASE (`zabelie_topup_confirm_payment`,
idempotente — testée en double livraison).

**Réconciliation** (même cron que le marketplace, Hobby = 2 crons max) :
1. `payment_pending` MonCash → vérité opérateur → confirm + fulfill ;
2. `paid`/`fulfillment_pending` → retente le fulfillment (idempotent) ;
3. delivered ↔ rapport fournisseur 24 h → divergences signalées (réponse cron
   + à reporter dans `OPS_TODO.md`).

**Prix** : résolus serveur depuis `zabelie_topup_products` (jamais du client).
Marge cible ~5 % au-dessus du coûtant (validée porteur), plafonnée par la
marge opérateur réelle (3–8 % en Haïti). Coûtants à synchroniser avec
Reloadly (voir `OPS_TODO.md`).

## 3. Configuration

```
RELOADLY_CLIENT_ID=      # compte https://www.reloadly.com (sandbox gratuit)
RELOADLY_CLIENT_SECRET=
RELOADLY_MODE=sandbox    # puis production (checkpoint humain avant bascule)
```
Non configuré → la page `/rechaj` affiche « service à venir », l'API renvoie 503.

## 4. Fichiers

| Brique | Fichier |
|--------|---------|
| Migration (tables, RLS, ledger, fonctions) | `supabase/migrations/0010_topup.sql` |
| Interface fournisseur | `lib/zabelie-topup/provider.ts` |
| Adapter Reloadly | `lib/zabelie-topup/reloadly.ts` |
| Numéros haïtiens (validation, détection) | `lib/zabelie-topup/phone.ts` |
| Plafonds/velocity (pur, testé) | `lib/zabelie-topup/limits.ts` |
| Orchestration fulfillment | `lib/zabelie-topup/fulfill.ts` |
| Réconciliation | `lib/zabelie-topup/reconcile.ts` |
| API commandes | `app/api/zabelie/topup/orders/` |
| Admin (Zelle, remboursements) | `app/api/admin/topup/` |
| UI acheteur (Kreyòl-first) | `app/rechaj/` |
| Tests SQL | `supabase/tests/zabelie_topup.test.sql` |
| Tests unitaires | `tests/zabelie-topup.test.ts` |
