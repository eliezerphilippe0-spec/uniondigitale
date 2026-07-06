# Zabelie Digi — Registre des décisions

> Suivi des décisions **verrouillées** (✅) et **ouvertes** (`[À CONFIRMER]`).
> Référencé par `00-CONTEXTE.md §13`.

---

## Décisions verrouillées ✅

| ID | Décision | Détail |
|----|----------|--------|
| V-1 | **Stack** | Next.js (App Router, TS, Tailwind) + Supabase (Postgres/Auth/Storage/RLS). |
| V-2 | **Rail paiement MVP** | MonCash uniquement. NatCash et BRH différés (dépendances bloquantes). |
| V-3 | **Idempotence** | Garantie au niveau base de données (contrainte d'unicité sur clé d'idempotence), pas seulement applicative. |
| V-4 | **Source de vérité paiement** | Webhook / vérification serveur-à-serveur, jamais le seul retour de redirection navigateur. |
| V-5 | **Réconciliation** | Réconciliateur + test « redirect coupé » dans les critères d'acceptation du module paiement. |
| V-6 | **Nommage** | `zabely` / `zabelie` coexistent. Aucun grep-replace global. |
| V-7 | **Design** | Higgsfield pour les visuels ; objectif plateforme ultra-moderne. |
| V-8 | **Distinction projets** | Zabelie Digi (digital) ≠ Zabelie (physique, projet 1). |
| V-9 | **D-3 — Lien avec Zabelie 1** | **INDÉPENDANCE TOTALE (durci).** Zabelie Digi est un projet à part : **aucune fusion** — comptes, wallet, schéma, code — avec Zabelie 1 ni aucun autre projet. La passerelle dormante `zabelie1_user_id` a été retirée (migration `0007_standalone.sql`). Ne pas réintroduire de couplage sans décision explicite du porteur. |
| V-10 | **Rails diaspora USD (Stripe + Zelle)** | Demande porteur (2026-07). Le **ledger reste en HTG** ; montant USD figé au checkout (`payments.expected_usd_cents`, taux `USD_HTG_RATE`) et vérifié **en base** par `confirm_payment`. Zelle = flux **semi-manuel** (pas d'API) : mémo + confirmation admin, même fonction idempotente. Stripe ⚠️ exige une **entité US** (Haïti non supporté marchand) — construit, activable en test. Ceci ne modifie PAS V-2 : MonCash reste le rail principal HTG ; NatCash/BRH toujours ⛔. Voir `03-PAIEMENTS.md` + migration `0009_rails_diaspora.sql`. |

---

## Décisions ouvertes `[À CONFIRMER]`

| ID | Question | Impact | Statut |
|----|----------|--------|--------|
| **D-1** | `[À CONFIRMER]` _(à préciser — issue de la synthèse)_ | — | Ouverte |
| **D-2** | `[À CONFIRMER]` _(à préciser — issue de la synthèse)_ | — | Ouverte |
| ~~**D-3**~~ | ~~Lien auth/wallet avec Zabelie 1~~ | **VERROUILLÉE → V-9.** Séparé, fusion possible plus tard. | ✅ Tranchée |

> ⚠️ D-1 et D-2 étaient marquées `[À CONFIRMER]` dans la synthèse mais leur libellé
> exact n'a pas été fourni. À renseigner par le porteur du projet.
>
> ⚠️ Ne pas trancher unilatéralement ces décisions, surtout **D-3** (impact schéma).
