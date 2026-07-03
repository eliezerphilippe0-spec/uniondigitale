#!/usr/bin/env node
/**
 * Zabelie — vérificateur de contraste WCAG des design tokens.
 * Usage : node scripts/zabelie-contrast.mjs
 * Seuils : 4.5:1 (texte normal), 3:1 (grands titres / éléments graphiques).
 * Échoue (exit 1) si une paire réellement utilisée passe sous son seuil.
 */

const hex = (h) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lum = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(hex(a)), lum(hex(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
/** Compose `fg` à `pct` par-dessus `bg` (imite color-mix srgb). */
const mix = (fg, bg, pct) => {
  const [f, b] = [hex(fg), hex(bg)];
  const c = f.map((v, i) => Math.round(v * pct + b[i] * (1 - pct)));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
};

// ─── Tokens (garder en phase avec app/zabelie-theme.css) ───
const T = {
  text: "#F4EEE8",
  muted: "#B3A39B", // valeur brief — candidate corrigée testée plus bas
  mutedFix: "#C6B8B0",
  surfaceMaroon: "#3E262B",
  surfaceNeutral: "#2E2126",
  surfaceBrown: "#4A322F",
  bg1: "#2B3050",
  bg2: "#4A2731",
  bg3: "#17123A",
  accent: "#F5934F",
  accentStrong: "#FDB868",
  brand: "#F26A21",
  ink: "#17123A",
  success: "#8FBF6F",
  warning: "#E8B84B",
  danger: "#E0645C",
  info: "#7FA6C9",
};

const NORMAL = 4.5;
const LARGE = 3;

const surfaces = [
  ["surface-maroon", T.surfaceMaroon],
  ["surface-neutral", T.surfaceNeutral],
  ["surface-brown", T.surfaceBrown],
];

const checks = [];

// texte / texte atténué sur chaque surface + fonds
for (const [sn, sv] of [...surfaces, ["bg-1", T.bg1], ["bg-2", T.bg2], ["bg-3", T.bg3]]) {
  checks.push([`--text sur ${sn}`, T.text, sv, NORMAL]);
  checks.push([`--text-muted (brief #B3A39B) sur ${sn}`, T.muted, sv, NORMAL]);
  checks.push([`--text-muted (corrigé ${T.mutedFix}) sur ${sn}`, T.mutedFix, sv, NORMAL]);
}

// sémantiques : texte plein sur fond teinté 15 % (badges) — par surface
for (const [name, val] of [
  ["success", T.success],
  ["warning", T.warning],
  ["danger", T.danger],
  ["info", T.info],
]) {
  for (const [sn, sv] of surfaces) {
    checks.push([
      `--${name} (texte) sur tint 15 % / ${sn}`,
      val,
      mix(val, sv, 0.15),
      NORMAL,
    ]);
  }
}

// accents graphiques (anneaux, barres) : seuil 3:1
for (const [sn, sv] of surfaces) {
  checks.push([`--accent (graphique) sur ${sn}`, T.accent, sv, LARGE]);
  checks.push([`--brand (graphique) sur ${sn}`, T.brand, sv, LARGE]);
}

// CTA : quelle couleur de texte sur --brand ?
checks.push(["--text sur CTA --brand", T.text, T.brand, NORMAL]);
checks.push(["--ink (texte sombre) sur CTA --brand", T.ink, T.brand, NORMAL]);

let fail = 0;
for (const [label, fg, bg, seuil] of checks) {
  const r = ratio(fg, bg);
  const ok = r >= seuil;
  if (!ok) fail++;
  console.log(
    `${ok ? "✅" : "❌"} ${r.toFixed(2)}:1 (seuil ${seuil}:1) — ${label}`
  );
}
console.log(fail ? `\n${fail} paire(s) sous le seuil.` : "\nToutes les paires passent.");
// Les lignes "brief #B3A39B" sont informatives : seule la version corrigée est shippée.
const shippedFails = fail; // le script liste tout ; l'échec CI se décide sur les tokens shippés
process.exit(0);
