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

## État

🚧 Scaffold Vague 1 (UI + fondations). Données d'exemple, pas encore branché sur
Supabase ni MonCash.
