# CLAUDE.md — Zabelie Digi

Version condensée « toujours en contexte ». Le détail est dans `docs/`.

## C'est quoi
**Zabelie Digi** = marketplace de **produits digitaux + talents africains**
(inspirée de **Chariow** et **Talent gn**), avec paiement **mobile money haïtien** et
wallet vendeur. Objectif : **plateforme ultra-moderne**.

**Naming (tranché)** : le nom officiel et UNIQUE est « **Zabelie Digi** » —
tout ancien nom de travail est éliminé (décision porteur, anti-confusion).
Le repo GitHub `uniondigitale` est une étiquette technique **à renommer en
`zabelie-*`** par le porteur ; le nom de la branche git de travail est un
identifiant technique historique, sans signification produit.

⚠️ **À ne pas confondre avec Zabelie (projet 1)**, la marketplace de produits
**physiques**. Ce projet-ci est le **deuxième**, dédié au **digital**.

## Stack
Next.js (App Router, TS, Tailwind) + Supabase (Postgres/Auth/Storage/RLS).
Design : **Higgsfield** pour les visuels.

## Règles dures (ne jamais enfreindre)
1. **Paiement — 3 invariants** : (a) idempotence garantie **en base** ;
   (b) confirmation **serveur-à-serveur** obligatoire (jamais le retour navigateur seul) ;
   (c) **réconciliation** totale, aucun paiement orphelin. → `docs/03-PAIEMENTS.md`.
2. **Dépendances bloquantes** : MonCash ✅ constructible ; **NatCash ⛔** et
   **BRH ⛔** en attente — ne pas coder un rail qui ne peut pas encore exister.
   → `docs/00-CONTEXTE.md §14`.
3. **Nommage `zabely` / `zabelie`** : les deux coexistent. **Aucun grep-replace global.**
4. **Projet totalement indépendant** : Zabelie Digi ne fusionne avec **aucun**
   autre projet (ni Zabelie 1, ni autre) — auth, wallet, schéma, code (D-3 durcie,
   V-9). Ne jamais réintroduire de couplage. Décisions `[À CONFIRMER]` restantes
   (D-1/D-2) : ne pas trancher seul, demander.

## Topup — recharge téléphonique (V-11)
Service **first-party** de revente de recharge **Digicel/Natcom**
(`app/rechaj`, `lib/zabelie-topup/`, migration `0010`). Cadre **BRH Circ. 121,
non négociable** : Zabelie Digi = **revendeur télécom, jamais émetteur de
monnaie électronique**. Interdits absolus (REFUSER si demandé) : solde
rechargeable acheteur, P2P, cash-in/cash-out, remboursement vers un solde
interne (moyen d'origine uniquement + checkpoint humain), montants en float,
prix venant du client. Ledger `zabelie_topup_ledger` **append-only** (trigger).
Fournisseur : Reloadly (adapter pattern), idempotence transmise au fournisseur
(customIdentifier = order.id). Plafonds : 5 000 HTG/tx · 25 000 HTG/j ·
5 bénéficiaires/h (configurables en base). → `docs/07-TOPUP.md`.

## Documents (chaîne : Contexte → PRD → Design)
- `docs/00-CONTEXTE.md` — contexte complet (15 sections), source de vérité.
- `docs/01-PRD.md` — exigences produit, EPICs.
- `docs/02-DECISIONS.md` — décisions verrouillées + ouvertes.
- `docs/03-PAIEMENTS.md` — architecture paiement (EPIC 4, critique).
- `docs/04-DEPLOIEMENT.md` — guide de mise en prod (Supabase → MonCash → Vercel).
- `docs/07-TOPUP.md` — recharge téléphonique + checklist conformité BRH.
- `OPS_TODO.md` — actions opérationnelles porteur + écarts de réconciliation.
