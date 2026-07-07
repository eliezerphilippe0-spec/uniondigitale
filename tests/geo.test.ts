import test from "node:test";
import assert from "node:assert/strict";
import { countryFromRequest } from "../lib/geo/country-backfill";
import { countryName } from "../lib/geo/countries";

const mk = (v?: string) =>
  new Request("https://zabelie.test", {
    headers: v ? { "x-vercel-ip-country": v } : {},
  });

test("countryFromRequest : lit x-vercel-ip-country et normalise en majuscules", () => {
  assert.equal(countryFromRequest(mk("HT")), "HT");
  assert.equal(countryFromRequest(mk("fr")), "FR");
});

test("countryFromRequest : rejette absent/inconnu/anonymisé", () => {
  assert.equal(countryFromRequest(mk()), null); // en-tête absent
  assert.equal(countryFromRequest(mk("XX")), null); // inconnu Vercel
  assert.equal(countryFromRequest(mk("T1")), null); // anonymisé (Tor)
  assert.equal(countryFromRequest(mk("HTI")), null); // pas alpha-2
});

test("countryName : libellé FR, repli, et '??' → Non renseigné", () => {
  assert.equal(countryName("HT"), "Haïti");
  assert.equal(countryName("SN"), "Sénégal");
  assert.equal(countryName("??"), "Non renseigné");
  assert.equal(countryName("ZZ", "Fallback"), "Fallback");
  assert.equal(countryName("ZZ"), "ZZ");
});
