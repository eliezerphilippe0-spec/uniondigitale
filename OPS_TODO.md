# OPS_TODO — Zabelie Digi

Actions opérationnelles côté porteur (aucune n'est du code). Les écarts de
réconciliation topup détectés par le cron doivent aussi être consignés ici.

## Recharge téléphonique (V-11)

- [ ] Créer le compte **Reloadly** (sandbox gratuit) → renseigner
      `RELOADLY_CLIENT_ID` / `RELOADLY_CLIENT_SECRET` / `RELOADLY_MODE=sandbox`
      sur Vercel. **Jamais de clés dans le chat/le repo.**
- [ ] Synchroniser le catalogue : récupérer les `operatorId` Reloadly
      (Digicel/Natcom Haïti) et les **coûtants réels**, puis mettre à jour
      `zabelie_topup_products` (`provider_product_id`, `cost_htg`,
      `price_htg` = coûtant + ~5 %).
- [ ] Vérifier les préfixes opérateurs (portabilité) : la détection
      `lib/zabelie-topup/phone.ts` pré-remplit seulement, l'acheteur confirme.
- [ ] **Checkpoint humain avant production** : bascule `RELOADLY_MODE=production`
      uniquement après tests sandbox complets (paiement MonCash réel +
      recharge testée sur vos propres numéros).
- [ ] Consigner ici tout écart remonté par le cron (`/api/reconcile`,
      champ `topup.discrepancies`).
- [ ] **Après migrations 0009+0010** : dérouler la vérification post-migration
      (`docs/07-TOPUP.md §4.1–4.2` : trigger append-only actif, RLS, seeds,
      fonctions non exposées, banc d'essai SQL en rollback).
- [ ] **Avant d'ouvrir `/rechaj`** : bout-en-bout sandbox complet
      (`docs/07-TOPUP.md §4.3`) sur un déploiement Preview — la page s'active
      dès que les clés Reloadly sont posées, donc pas de clés en Production
      avant la fin des 6 points.

## Paiements (rappels)

- [ ] Appliquer les migrations `0009` + `0010` sur Supabase
      (`supabase/schema.sql` = tout-en-un).
- [ ] Zelle : `USD_HTG_RATE`, `ZELLE_RECIPIENT`, `ZELLE_RECIPIENT_NAME`.
- [ ] Stripe (optionnel) : nécessite une entité US — voir `docs/04 §2 bis`.

## Écarts de réconciliation topup

_(à compléter au fil de l'eau — date, order_id, nature de l'écart, résolution)_
