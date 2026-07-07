// Zabelie Talent — Référentiel pays (ISO-3166-1 alpha-2 → nom FR).
// Utilisé par le sélecteur de profil et le libellé du dashboard géo.
// Liste centrée sur le marché (Haïti + Afrique) et la diaspora principale ;
// tout code hors liste retombe sur son nom du fond de carte (world-110m).

export type Country = { code: string; name: string };

export const COUNTRIES: Country[] = [
  // Haïti & Caraïbes
  { code: "HT", name: "Haïti" },
  { code: "DO", name: "République dominicaine" },
  { code: "CU", name: "Cuba" },
  { code: "JM", name: "Jamaïque" },
  // Afrique de l'Ouest
  { code: "SN", name: "Sénégal" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "GN", name: "Guinée" },
  { code: "ML", name: "Mali" },
  { code: "BF", name: "Burkina Faso" },
  { code: "NE", name: "Niger" },
  { code: "TG", name: "Togo" },
  { code: "BJ", name: "Bénin" },
  { code: "GH", name: "Ghana" },
  { code: "NG", name: "Nigeria" },
  { code: "GM", name: "Gambie" },
  { code: "GW", name: "Guinée-Bissau" },
  { code: "LR", name: "Liberia" },
  { code: "SL", name: "Sierra Leone" },
  { code: "MR", name: "Mauritanie" },
  // Afrique centrale
  { code: "CM", name: "Cameroun" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "RD Congo" },
  { code: "GA", name: "Gabon" },
  { code: "TD", name: "Tchad" },
  { code: "CF", name: "Centrafrique" },
  // Afrique de l'Est
  { code: "KE", name: "Kenya" },
  { code: "TZ", name: "Tanzanie" },
  { code: "UG", name: "Ouganda" },
  { code: "RW", name: "Rwanda" },
  { code: "ET", name: "Éthiopie" },
  { code: "SO", name: "Somalie" },
  { code: "MG", name: "Madagascar" },
  // Afrique du Nord
  { code: "MA", name: "Maroc" },
  { code: "DZ", name: "Algérie" },
  { code: "TN", name: "Tunisie" },
  { code: "LY", name: "Libye" },
  { code: "EG", name: "Égypte" },
  // Afrique australe
  { code: "ZA", name: "Afrique du Sud" },
  { code: "AO", name: "Angola" },
  { code: "MZ", name: "Mozambique" },
  { code: "ZM", name: "Zambie" },
  { code: "ZW", name: "Zimbabwe" },
  // Diaspora principale
  { code: "FR", name: "France" },
  { code: "US", name: "États-Unis" },
  { code: "CA", name: "Canada" },
  { code: "BE", name: "Belgique" },
  { code: "GB", name: "Royaume-Uni" },
  { code: "BR", name: "Brésil" },
  { code: "ES", name: "Espagne" },
  { code: "DE", name: "Allemagne" },
  { code: "CL", name: "Chili" },
];

const NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.name]),
);

/** Nom FR d'un code ISO, avec repli optionnel (ex: nom du fond de carte). */
export function countryName(code: string, fallback?: string): string {
  if (code === "??") return "Non renseigné";
  return NAME_BY_CODE[code] ?? fallback ?? code;
}
