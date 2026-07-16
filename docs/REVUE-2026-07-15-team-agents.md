# REVUE 2026-07-15 — Team Agents (Dev Front · Dev Back · QA)

> Audit « produit senior, traduit pour la réalité haïtienne » des 5 flux
> prioritaires. **Aucun commit/merge/migration** n'accompagne ce rapport :
> chaque action attend un « go » explicite du porteur, tâche par tâche.
> Règle de langue (verrouillée porteur, 2026-07-15) : **français par défaut,
> créole haïtien en 2e langue via le bouton FR/KR** — cible : parité 100 %.

## 1. Résumé exécutif

_(à consolider après remontée des agents)_

## 2. Tableau de bord des cibles

| Axe | Cible | État actuel (baseline) | Projeté après corrections |
|---|---|---|---|
| Poids page (produit, checkout) | ≤ 300 KB premier chargement (hors images) | **Mesure dynamique impossible dans le sandbox** (serveur local tué — limite ressources). Bornes statiques : union de tous les chunks partagés = 376 KB gzip (majorant très large, une page n'en charge qu'une partie) ; build Next 15 antérieur : ~171–179 KB bruts/page (≈55–65 KB gzip estimés) + polices auto-hébergées. **À confirmer sur le site réel via pagespeed.web.dev/uniondigitale.vercel.app** | _(à remplir)_ |
| LCP Slow 4G | ≤ 2,5 s | Non mesurable en sandbox — **mesure recommandée : PageSpeed Insights sur l'URL de prod** (gratuit, 1 min) | _(à remplir)_ |
| Lighthouse mobile | Perf ≥ 80 · A11y ≥ 90 | idem (PageSpeed Insights) | _(à remplir)_ |
| Friction checkout | Taps documentés avant/après | Parcours code : page produit → 1 tap « Acheter (MonCash) » (+2 taps optionnels coupon) → passerelle MonCash (externe, ~2-3 étapes) → retour automatique → page statut. **Pas de panier multi-articles** (achat direct 1 produit) | _(à remplir)_ |
| Parité FR/HT | 100 % des textes des 5 flux traduits via bouton KR, zéro anglais | **ÉCART MAJEUR (baseline)** : 5 fichiers des flux ont leur texte français **en dur** (0 appel i18n) → le bouton KR ne les traduit pas : `app/createur/[id]/page.tsx`, `app/vendre/page.tsx`, `app/connexion/page.tsx`, `components/buy-button.tsx` (bouton d'achat !), `components/publish-form.tsx` | 100 % |
| Sécurité | Zéro régression (prix serveur, ledger, RLS, confirmation S2S) | _(verdict QA à consolider)_ | Zéro régression |
| Design system | Zéro couleur/typo hors `app/zabelie-theme.css` | _(constats agents à consolider)_ | 0 écart |

## 3. Constats par flux

### 3.1 Checkout / commande MonCash
_(à consolider)_

### 3.2 Page produit + page vendeur (`/createur/[id]`)
_(à consolider)_

### 3.3 Recharge `/rechaj`
_(à consolider)_

### 3.4 Onboarding vendeur (`/connexion` → `/vendre`)
_(à consolider)_

### 3.5 Recherche / catalogue
_(à consolider — constat d'entrée : `products.category` est du texte libre, pas de taxonomie produits ; les « 56 catégories » du brief n'existent pas dans le repo)_

## 4. Plan d'action priorisé (BL-xxx)
_(à consolider — impact × effort)_

## 5. Hors scope & alertes BRH

| ID | Sujet | Raison |
|---|---|---|
| HORS-SCOPE-001 | Zabelie Business (`/pro`, factures) | Hors des 5 flux du mandat |
| HORS-SCOPE-002 | « Zabelie Sol » | N'existe pas dans ce projet (prémisse de brief corrigée) |
| HORS-SCOPE-003 | Admin (`/admin`) | Hors mandat |
| HORS-SCOPE-004 | Go-live Reloadly (clés Live, solde, marges) | Opérationnel porteur, pas produit |
| HORS-SCOPE-005 | Renommage repo `uniondigitale` → `zabelie-*` | Décision porteur, cosmétique |

### Corrections de prémisses du brief (rappel)
NatCash ⛔ inexistant (MonCash + diaspora USD réels) · `create_pending_order` inexistant (flux réel : `/api/checkout` → `confirm_payment`) · route vendeur réelle `/createur/[id]` · pas de « 56 catégories » produits · français par défaut (pas « Kreyòl-first »).
