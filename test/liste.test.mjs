// La Liste : les cartes de la séance, allégées. Toute la carte ouvre la vue Exercice ; le type de séance ne change
// qu'au second toucher quand des séries sont déjà notées.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { DC, TRI, ELE, avecCtx, avecCtxSansSs } from "./fixtures.mjs";

const q = JSON.stringify;
// Sans clé, la page d'accueil prend la place de la séance : les rendus ci-dessous en posent une.
const avecCle = (plus = {}) => avecCtx({ "carnet:cle": "cle-essai", ...plus });

test("liste : cartes cliquables, sans étiquettes de muscle ni record", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`allerListe(); dessiner()`);
  const h = b.evaluer(`$("#app").innerHTML`);
  assert.equal((h.match(/data-aller=/g) || []).length, 3);
  assert.doesNotMatch(h, /record \d/);
  assert.doesNotMatch(h, /class="info"/);
  assert.match(h, /⚡ avec/);              // paire active dans avecCtx
});
test("liste : superset coupé, rien à l'écran", async () => {
  const b = await chargerCarnet({ stockage: avecCtxSansSs({ "carnet:cle": "cle-essai" }) });
  b.evaluer(`allerListe(); dessiner()`);
  assert.doesNotMatch(b.evaluer(`$("#app").innerHTML`), /superset|⚡/);
});
test("liste : plus d'état de carte ouverte (lignes, note, hors progression)", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`allerListe(); ouvert = ${q(DC)}; dessiner()`);
  const h = b.evaluer(`$("#app").innerHTML`);
  assert.doesNotMatch(h, /class="ls |data-note-exo|data-hp\b|data-plus-serie/);
});
test("type de séance : double toucher quand des séries sont notées", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`validerSerie(${q(DC)})`);
  assert.equal(b.json(`changerType("legs", 1000)`), false);
  assert.equal(b.json("seanceDuJour().type"), "push");
  assert.equal(b.json(`changerType("legs", 2500)`), true);
  assert.equal(b.json("seanceDuJour().type"), "legs");
});
test("type de séance : le second toucher expire après 3 s", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`validerSerie(${q(DC)})`);
  b.json(`changerType("legs", 1000)`);
  assert.equal(b.json(`changerType("legs", 4500)`), false);
  assert.equal(b.json("seanceDuJour().type"), "push");
});
test("type de séance : un seul toucher sans série notée", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  assert.equal(b.json(`changerType("legs", 1000)`), true);
});
test("liste : ni épaule, ni poids, ni photos", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`allerListe(); dessiner()`);
  const h = b.evaluer(`$("#app").innerHTML`);
  assert.doesNotMatch(h, /Épaule droite|Photos de suivi|<b>Poids<\/b>/);
});
test("liste : le bas, dans l'ordre (ajouter, bilan, note, jour sans)", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`allerListe(); dessiner()`);
  const h = b.evaluer(`$("#app").innerHTML`);
  const i = (re) => h.search(re);
  assert.ok(i(/id="ajouter"/) > 0 && i(/id="ajouter"/) < i(/id="note"/));
  assert.ok(i(/id="note"/) < i(/Pas de séance aujourd'hui/));
});
test("liste : plus de carte « Valider depuis la montre » (retirée le 2026-11-12)", async () => {
  const b = await chargerCarnet({ stockage: avecCle({ "carnet:montre": true }) });
  b.evaluer(`allerListe(); dessiner()`);
  assert.doesNotMatch(b.evaluer(`$("#app").innerHTML`), /Valider depuis la montre|data-montre/);
});
test("liste : le type du jour porte « du jour » sous son bouton", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`allerListe(); dessiner()`);
  const h = b.evaluer(`$("#app").innerHTML`);
  assert.match(h, /type-du-jour|du jour/);
  assert.doesNotMatch(h, /data-type="\w+" class="[^"]*">\w+ ·</);
});
