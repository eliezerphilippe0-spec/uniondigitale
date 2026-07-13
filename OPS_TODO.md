# OPS_TODO — Zabelie Digi

Actions opérationnelles côté porteur (aucune n'est du code). Les écarts de
réconciliation topup détectés par le cron doivent aussi être consignés ici.

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
