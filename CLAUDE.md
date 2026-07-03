# CLAUDE.md — Zabelie Digi

Version condensée « toujours en contexte ». Le détail est dans `docs/`.

## C'est quoi
**Zabelie Digi** = marketplace de **produits digitaux + talents africains**
(inspirée de **Chariow** et **Talent gn**), avec paiement **mobile money haïtien** et
wallet vendeur. Objectif : **plateforme ultra-moderne**.

**Naming (tranché)** : nom officiel « **Zabelie Digi** » (ex-nom de travail
« Zabelie Talent », retiré). Le repo GitHub `uniondigitale` est une étiquette
technique **à renommer en `zabelie-*`** par le porteur — seule la branche git
`claude/zabelie-talent-*` garde son nom historique.

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

## Documents (chaîne : Contexte → PRD → Design)
- `docs/00-CONTEXTE.md` — contexte complet (15 sections), source de vérité.
- `docs/01-PRD.md` — exigences produit, EPICs.
- `docs/02-DECISIONS.md` — décisions verrouillées + ouvertes.
- `docs/03-PAIEMENTS.md` — architecture paiement (EPIC 4, critique).
- `docs/04-DEPLOIEMENT.md` — guide de mise en prod (Supabase → MonCash → Vercel).
