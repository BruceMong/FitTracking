// L'onglet Santé : la journée d'abord, le reste en sections repliables (état gardé dans carnet:replie).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { ctxPush, JOUR } from "./fixtures.mjs";

// Un contexte avec un bloc santé minimal : sans lui, l'onglet n'affiche qu'un message d'attente.
const RAPPORT = "# Rapport\n\n## En bref\nUne semaine tenue.\n\n## Indicateurs\n| Mesure | Valeur |\n|---|---|\n| Séances | 3 |\n\n## Détail\nTexte.\n";
const ctxSante = {
  ...ctxPush,
  jours: [],
  sante: { alertes: [], objectifs: [{ texte: "Marcher 8000 pas", fait: false }], cibles: { sommeil: 480, pas: 8000, seances: 4, intensif: 150 } },
  rapports: [{ jour: "2026-11-08", md: RAPPORT }],
};
const avecSante = (plus = {}) => ({ "carnet:ctx": ctxSante, ...plus });

test("santé : sections dans l'ordre, courbes repliées par défaut", async () => {
  const b = await chargerCarnet({ stockage: avecSante() });
  const h = b.json("sante()");
  const ids = [...h.matchAll(/data-replie="([\w-]+)"/g)].map((m) => m[1]).filter((x) => x !== "rapport-tableau");
  assert.deepEqual(ids, ["aujourdhui", "rapport", "nuit", "courbes", "objectifs"]);
  assert.doesNotMatch(h, /class="carte graphe"/);
});
test("santé : épaule, poids et photos dans Aujourd'hui", async () => {
  const b = await chargerCarnet({ stockage: avecSante() });
  const h = b.json("sante()");
  for (const t of ["Épaule droite", "<b>Poids</b>", "Photos de suivi"]) assert.match(h, new RegExp(t));
});
test("santé : une section dépliée le reste", async () => {
  const b = await chargerCarnet({ stockage: avecSante() });
  b.evaluer(`basculerReplie("courbes")`);
  assert.equal(b.stockage()["carnet:replie"].courbes, false);
  assert.match(b.json("sante()"), /class="carte graphe"/);
});
test("santé : une section ouverte se replie, et le tableau du rapport est replié d'office", async () => {
  const b = await chargerCarnet({ stockage: avecSante() });
  assert.doesNotMatch(b.json("sante()"), /rp-ind/);
  b.evaluer(`basculerReplie("rapport-tableau")`);
  assert.match(b.json("sante()"), /rp-ind/);
  b.evaluer(`basculerReplie("aujourdhui")`);
  const h = b.json("sante()");
  assert.equal(b.stockage()["carnet:replie"].aujourdhui, true);
  assert.doesNotMatch(h, /data-douleur/);
});
test("santé : la douleur et le poids se notent depuis l'onglet", async () => {
  const b = await chargerCarnet({ stockage: avecSante({ "carnet:cle": "cle-essai" }) });
  b.evaluer(`onglet = "sante"; dessiner()`);
  b.clic({ douleur: "3" });
  assert.equal(b.json("seanceDuJour().douleur"), 3);
  b.evaluer(`document.querySelector("#poids").value = "78,4"`);
  b.clic({}, ["data-poids-ok"]);
  assert.equal(b.json("seanceDuJour().poids"), 78.4);
  b.clic({ replie: "aujourdhui" });
  assert.equal(b.stockage()["carnet:replie"].aujourdhui, true);
});
