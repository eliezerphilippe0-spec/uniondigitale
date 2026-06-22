# Zabelie Talent

Marketplace de **produits digitaux et talents africains** (inspirée de Chariow et
Talent gn). Paiement mobile money haïtien (MonCash), livraison digitale instantanée,
wallet vendeur.

> ⚠️ **Projet n°2** de la famille Zabelie. À ne pas confondre avec **Zabelie**
> (projet 1), la marketplace de produits **physiques**.

## Stack

- **Next.js** 15 (App Router, TypeScript)
- **Tailwind CSS** 4
- **Supabase** (Postgres, Auth, Storage, RLS)

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner les clés Supabase / MonCash
npm run dev
```

App sur http://localhost:3000

## Scripts

| Commande | Effet |
|----------|-------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires (logique paiement pure) |

## Structure

```
app/                  Pages (App Router)
  page.tsx            Landing ultra-moderne
  catalogue/          Catalogue produits/talents
  produit/[slug]/     Page produit + checkout
components/           Composants UI réutilisables
lib/
  sample-data.ts      Données d'exemple (à remplacer par Supabase)
  supabase/           Clients Supabase (browser + server)
docs/                 Contexte produit, PRD, décisions, paiements
```

## Documentation

La **source de vérité produit** est dans `docs/` :

- `docs/00-CONTEXTE.md` — contexte complet (15 sections)
- `docs/01-PRD.md` — exigences produit, EPICs
- `docs/02-DECISIONS.md` — décisions verrouillées + ouvertes
- `docs/03-PAIEMENTS.md` — architecture paiement (EPIC 4, critique)

Voir aussi `CLAUDE.md` (résumé toujours en contexte).

## Règles dures

1. **Paiement** : idempotence en base, confirmation serveur-à-serveur, réconciliation.
2. **Dépendances bloquantes** : MonCash ✅ / NatCash ⛔ / BRH ⛔.
3. **Nommage** `zabely`/`zabelie` : coexistent, pas de grep-replace global.
4. **Décisions ouvertes** (D-3 surtout) : ne pas trancher seul.

## Catalogue : Supabase ou démo

`lib/products.ts` lit le catalogue depuis Supabase **si** les variables d'env sont
présentes ; sinon il **retombe sur les données d'exemple** (`lib/sample-data.ts`).
La plateforme est donc démontrable sans base.

## Auth & espaces

- `/connexion` — inscription / connexion (Supabase Auth).
- `/vendre` — espace créateur : publier un produit + envoyer le fichier livrable.
- `/tableau-de-bord` — créateur : solde wallet, ventes, produits, édition du profil.
- `/createur/[id]` — profil public d'un créateur + ses produits.
- `/mes-achats` — commandes payées + téléchargement (URL signée).
- `/admin` — back-office (rôle `admin`) : modération produits + suivi paiements.

## Intégration continue

`.github/workflows/ci.yml` exécute `typecheck`, `test` et `build` à chaque push
et pull request (Node 22).

## Tests

- `npm test` — tests unitaires de la logique paiement pure (idempotence des clés,
  statut MonCash, slugify).
- **Tests SQL money-path** (exécutés en CI sur un Postgres jetable) :
  `DATABASE_URL=postgres://… bash supabase/tests/run.sh` — applique les migrations
  puis vérifie idempotence (rejeu 3×), montant falsifié rejeté, commission par tier,
  maturation J+7 et remboursement sans solde fantôme.

## État

🚧 Vague 1 en place : UI, schéma, paiement MonCash (EPIC 4), auth & espaces.
Catalogue branché sur Supabase avec repli démo. Reste à connecter un vrai projet
Supabase + identifiants MonCash sandbox pour un parcours de bout en bout, et
l'upload des fichiers livrables.
