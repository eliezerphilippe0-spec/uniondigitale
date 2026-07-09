import test from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../lib/safe-next";

test("safeNext : accepte les chemins internes", () => {
  assert.equal(safeNext("/produit/beat-kompa"), "/produit/beat-kompa");
  assert.equal(safeNext("/rechaj"), "/rechaj");
  assert.equal(safeNext("/produit/x?a=1#acheter"), "/produit/x?a=1#acheter");
});

test("safeNext : rejette tout open redirect → repli sur /", () => {
  assert.equal(safeNext("https://site-malveillant.com"), "/"); // URL absolue
  assert.equal(safeNext("http://evil.com/produit"), "/");
  assert.equal(safeNext("//evil.com"), "/"); // protocol-relative
  assert.equal(safeNext("/\\evil.com"), "/"); // backslash traité en slash
  assert.equal(safeNext("\\/evil.com"), "/");
  assert.equal(safeNext("javascript:alert(1)"), "/"); // pas un chemin
  assert.equal(safeNext("@evil.com"), "/"); // userinfo-redirect (site+next)
  assert.equal(safeNext("produit/x"), "/"); // relatif sans slash initial
  assert.equal(safeNext(""), "/");
  assert.equal(safeNext(null), "/");
  assert.equal(safeNext(undefined), "/");
});
