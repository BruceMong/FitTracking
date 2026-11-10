// Le geste « retour » d'Android dans l'APK : MainActivity demande au carnet (window.carnetRetour) s'il referme un
// sous-menu ; sinon, l'appli passe en arrière-plan au lieu de se fermer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { DC, avecCtx } from "./fixtures.mjs";

const q = JSON.stringify;
const avecCle = () => avecCtx({ "carnet:cle": "cle-de-test" });

test("retour : rien d'ouvert, le carnet ne le prend pas (l'appli passe en arrière-plan)", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`dessiner(); $("#fiche").open = false; $("#ajout").open = false`);
  assert.equal(b.json("carnetRetour()"), false);
});

test("retour : la feuille ouverte (série, menu ⋯) se referme", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`dessiner(); $("#fiche").open = false; $("#ajout").open = false; ouvrirFeuille(menuExo(${q(DC)}), { quoi: "menu", nom: ${q(DC)} })`);
  assert.ok(b.json("feuilleOuverte"));
  assert.equal(b.json("carnetRetour()"), true);
  assert.equal(b.json("feuilleOuverte"), null);
});

test("retour : la fiche (« i ») ou l'ajout ouverts se referment", async () => {
  for (const id of ["#fiche", "#ajout"]) {
    const b = await chargerCarnet({ stockage: avecCle() });
    b.evaluer(`dessiner(); $("#fiche").open = false; $("#ajout").open = false;
      globalThis.ferme = null; $(${q(id)}).open = true; $(${q(id)}).close = () => { globalThis.ferme = ${q(id)}; }`);
    assert.equal(b.json("carnetRetour()"), true, id);
    assert.equal(b.json("ferme"), id);
  }
});
