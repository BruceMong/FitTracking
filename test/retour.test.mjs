// Le geste « retour » d'Android dans l'APK : MainActivity demande au carnet (window.carnetRetour) s'il referme un
// sous-menu ; sinon, l'appli passe en arrière-plan au lieu de se fermer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { DC, avecCtx } from "./fixtures.mjs";

const q = JSON.stringify;
const avecCle = () => avecCtx({ "carnet:cle": "cle-de-test" });

test("retour : sur la Liste, rien d'ouvert, le carnet ne le prend pas (l'appli passe en arrière-plan)", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`allerListe(); dessiner(); $("#fiche").open = false; $("#ajout").open = false`);
  assert.equal(b.json("grandVu"), false);
  assert.equal(b.json("carnetRetour()"), false);
});

test("retour : de la vue Exercice (sous-menu de la Liste), on atterrit sur la Liste", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`dessiner(); $("#fiche").open = false; $("#ajout").open = false; history.state = null`);
  assert.equal(b.json("grandVu"), true);
  assert.equal(b.json("carnetRetour()"), true);
  assert.equal(b.json("vue"), "liste");
  assert.equal(b.json("grandVu"), false);
  assert.equal(b.json("carnetRetour()"), false);   // retour encore : menu des applis
});

test("retour : vue Exercice avec son entrée d'historique, la Liste vient du popstate", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`dessiner(); $("#fiche").open = false; $("#ajout").open = false;
    history.state = { exercice: 1 }; history.back = () => { history.state = null; retourHistorique(); }`);
  assert.equal(b.json("carnetRetour()"), true);
  assert.equal(b.json("vue"), "liste");
});

test("retour : une feuille ouverte sur la vue Exercice se referme, on reste sur l'exercice", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`dessiner(); $("#fiche").open = false; $("#ajout").open = false; ouvrirFeuille(menuExo(${q(DC)}), { quoi: "menu", nom: ${q(DC)} })`);
  assert.equal(b.json("carnetRetour()"), true);
  assert.equal(b.json("feuilleOuverte"), null);
  assert.equal(b.json("vue"), "exercice");
});

test("retour : sur un autre onglet, le carnet ne le prend pas", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`onglet = "sante"; dessiner(); $("#fiche").open = false; $("#ajout").open = false`);
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
