/**
 * BL-105 (FRONT-1) — Taxonomie produits FERMÉE, source unique.
 * Avant : la publication acceptait un texte libre (« photo », « Foto »…) alors
 * que le catalogue filtre par ÉGALITÉ STRICTE sur ces libellés → tout produit
 * hors orthographe exacte devenait introuvable via les puces.
 * Pattern : Shopify — le vendeur choisit dans une liste, jamais de texte libre.
 * Les libellés sont EXACTEMENT ceux des puces historiques du catalogue : les
 * produits existants qui matchaient continuent de matcher (aucune migration).
 */
export const PRODUCT_CATEGORIES = [
  "Photo",
  "Business",
  "Musique",
  "Design",
  "Carrière",
  "Marketing",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Whitelist serveur : renvoie la catégorie canonique, ou null si inconnue. */
export function normalizeCategory(input: unknown): ProductCategory | null {
  if (typeof input !== "string") return null;
  const v = input.trim();
  return (PRODUCT_CATEGORIES as readonly string[]).includes(v)
    ? (v as ProductCategory)
    : null;
}
