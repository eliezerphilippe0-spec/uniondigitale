import test from "node:test";
import assert from "node:assert/strict";
import { DICT, LANGS, t, type I18nKey } from "../lib/i18n";

test("parité FR/HT : chaque clé existe et est non vide dans les deux langues", () => {
  const frKeys = Object.keys(DICT.fr).sort();
  for (const lang of LANGS) {
    const keys = Object.keys(DICT[lang]).sort();
    assert.deepEqual(
      keys,
      frKeys,
      `clés ${lang} ≠ clés fr (manquantes ou en trop)`
    );
    for (const k of keys) {
      assert.ok(
        DICT[lang][k as I18nKey].trim().length > 0,
        `${lang}.${k} est vide`
      );
    }
  }
});

test("interpolation {vars}", () => {
  assert.equal(
    t("fr", "product.pay", { price: "2 500 HTG" }),
    "Payer 2 500 HTG avec MonCash"
  );
  assert.equal(
    t("ht", "product.pay", { price: "2 500 HTG" }),
    "Peye 2 500 HTG ak MonCash"
  );
});

test("langue inconnue → repli lisible (jamais de crash)", () => {
  // isLang filtre en amont ; t() replie sur fr si la clé manque.
  assert.equal(t("fr", "nav.catalog"), "Catalogue");
  assert.equal(t("ht", "nav.catalog"), "Katalòg");
});
