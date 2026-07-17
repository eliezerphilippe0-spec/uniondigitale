# OPS_TODO — Zabelie Digi

Actions opérationnelles côté porteur (aucune n'est du code). Les écarts de
réconciliation topup détectés par le cron doivent aussi être consignés ici.

## Backlog revue Team Agents (BL-xxx) — 2026-07-15

Source unique : `docs/REVUE-2026-07-15-team-agents.md` §4 (plan priorisé
complet, constats §3). Rien n'est exécuté sans « go » porteur, tâche par tâche.

- [x] **P0 (Critique/invariants) — FAIT (PR #29, 2026-07-16)** : BL-101
      (réconciliateur : états terminaux, `zabelie_expire_stale_payment`),
      BL-102 (products verrouillé), BL-103 (fichier exigé avant vente),
      BL-104 (nav mobile), BL-105 (taxonomie fermée). Migration **0024
      appliquée en prod** (vérifiée 4/4, scan sécurité inchangé).
- [x] **P1 (quick wins S) — FAIT (PR #31, 2026-07-17)** : BL-110 → BL-125
      (détail au rapport §4). Migration **0025 appliquée en prod** (trigger
      append-only `wallet_transactions`) ; correctif search_path en suivi
      immédiat, migration **0026 appliquée en prod** (PR #32).
- [x] **P2 (chantiers M/L) — FAIT (PRs #33-39, 2026-07-17)** :
      BL-130 parité i18n (#33), BL-131 reset mdp (#34), BL-132 polling paiement
      en attente (#35), BL-133 coupon consommé au paiement confirmé (#36,
      migration 0027), BL-134 pagination + recherche + index catalogue (#37,
      migration 0028), BL-135 fulfillment topup async (#38), BL-138 nettoyage
      Storage (#39). Toutes les PR sont fusionnées dans `main`. Migrations
      **0027 et 0028 appliquées en prod** (vérifiées : `coupon_id` sur
      `orders`, 3 index créés — procédure manuelle, connecteur Supabase
      indisponible au moment de la fusion).
      BL-136 (achat invité — décision produit) reste non traité, volontairement.
- [ ] **BL-137 — ALERTE BRH (décision porteur)** : plafond journalier topup
      calculé en jour UTC (bascule 19-20 h locales) + contrôle non atomique —
      arbitrer fuseau America/Port-au-Prince et/ou contrainte en base.

## Recharge téléphonique (V-11)

- [x] Compte **Reloadly** créé (sandbox).
- [x] Clés `RELOADLY_CLIENT_ID` / `RELOADLY_CLIENT_SECRET` /
      `RELOADLY_MODE=sandbox` posées sur Vercel (**Preview uniquement**). Auth OK.
      ⚠️ Reloadly a des clés **séparées Sandbox / Live** — utiliser les **Sandbox**
      pour le test (sinon erreur `CREDENTIAL_VS_ENVIRONMENT_MISMATCH`).
      ⚠️ Inscription Reloadly : **email pro obligatoire** (gmail refusé).
- [ ] Synchroniser le catalogue : bouton **« Synchroniser le catalogue
      Reloadly »** dans `/admin` (plus de SQL manuel — récupère les
      `operatorId`/dénominations automatiquement). Les **coûtants réels**
      restent à affiner ensuite via le rapport de commissions Reloadly (le
      bouton pose un coûtant = valeur faciale en attendant).
      ⚠️ **Le sandbox Reloadly ne contient PAS Haïti** (Digicel/Natcom absents en
      test) → la synchro renvoie **0 produit** en sandbox. C'est donc une étape
      **de production** (clés Live + solde). Le code gère montants fixes **et**
      opérateurs « en plage » (RANGE) — durci le 2026-07-13.
- [ ] Vérifier les préfixes opérateurs (portabilité) : la détection
      `lib/zabelie-topup/phone.ts` pré-remplit seulement, l'acheteur confirme.
- [ ] **Checkpoint humain avant production** : bascule `RELOADLY_MODE=production`
      uniquement après tests sandbox complets (paiement MonCash réel +
      recharge testée sur vos propres numéros).
- [ ] Consigner ici tout écart remonté par le cron (`/api/reconcile`,
      champ `topup.discrepancies`).
- [ ] **Avant d'ouvrir `/rechaj`** : bout-en-bout sandbox complet
      (`docs/07-TOPUP.md §4.3`) sur un déploiement Preview — la page s'active
      dès que les clés Reloadly sont posées, donc pas de clés en Production
      avant la fin de cette liste.

## Paiements (rappels)

- [x] Migrations `0001` → `0019` appliquées sur Supabase (dont `0009`/`0010`
      topup) — `supabase/schema.sql` reste la concaténation à jour si besoin
      de rejouer sur un nouvel environnement.
- [x] Migrations `0020` → `0023` **appliquées** sur la prod Supabase le
      2026-07-13 (page service, points, Zabelie Business, durcissement du trigger
      fidélité) — via le SQL Editor (`docs/14-MIGRATIONS-SUPABASE.md`). Scan
      sécurité Supabase (`get_advisors`) : **propre** (alertes restantes = par
      conception, cf. session).
- [ ] Zelle : `USD_HTG_RATE`, `ZELLE_RECIPIENT`, `ZELLE_RECIPIENT_NAME`.
- [ ] Stripe (optionnel) : nécessite une entité US — voir `docs/04 §2 bis`.

## Écarts de réconciliation topup

_(à compléter au fil de l'eau — date, order_id, nature de l'écart, résolution)_
