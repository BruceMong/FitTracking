// Caractérisation : ce que fait le carnet aujourd'hui, qui doit rester vrai jusqu'au bout du plan montre.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { DC, TRI, ELE, avecCtx } from "./fixtures.mjs";

test("prochaine série : id, rang et texte", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  assert.equal(b.json(`idSerie(${JSON.stringify(DC)})`), "2026-11-09|Développé couché guidé|0");
  assert.equal(b.json(`quandSerie(${JSON.stringify(DC)})`), "série 1/4");
  assert.equal(b.json(`cibleTxt(${JSON.stringify(DC)})`), "42,5 kg × 6");
  assert.equal(b.json(`cibleTxt(${JSON.stringify(TRI)})`), "20 kg × 12");
  assert.equal(b.json(`cibleTxt(${JSON.stringify(ELE)})`), "8 kg × 9");
  assert.equal(b.json(`exoGrand()`), DC);
});

test("validerSerie : série notée, repos de l'exercice, fin annoncée au service worker", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`validerSerie(${JSON.stringify(DC)})`);
  assert.deepEqual(b.json(`seanceDuJour().exos[0].series`), [{ c: 42.5, r: 6, t: "17:00:00" }]);
  assert.equal(b.json(`minu.mode`), "repos");
  assert.equal(b.json(`minu.duree`), 150);
  assert.equal(b.json(`minu.quoi`), "Développé couché guidé · série 2/4 ensuite");
  assert.equal(b.messagesSW.at(-1).repos, b.json(`minu.fin`));
});

test("dernière série d'un exercice en grand format : transition de 120 s", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`grandVu = true; for (let i = 0; i < 4; i++) validerSerie(${JSON.stringify(DC)})`);
  assert.equal(b.json(`minu.duree`), 120);
  assert.equal(b.json(`minu.quoi`), "Développé couché guidé : terminé ✓");
  assert.equal(b.json(`exoGrand()`), TRI);
});

test("superset : le partenaire enchaîne, puis 120 s après la paire", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`validerSerie(${JSON.stringify(TRI)})`);
  assert.equal(b.json(`minu.mode`), "superset");
  assert.equal(b.json(`minu.nom`), ELE);
  b.evaluer(`validerSerie(${JSON.stringify(ELE)})`);
  assert.equal(b.json(`minu.mode`), "repos");
  assert.equal(b.json(`minu.duree`), 120);
  assert.equal(b.json(`minu.quoi`), "Superset · repos");
  assert.equal(b.json(`exoGrand()`), TRI);
});

test("échauffement ajouté : ligne é, puis 60 s", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`lignesDe(${JSON.stringify(DC)}).st.ech++`);
  assert.equal(b.json(`idSerie(${JSON.stringify(DC)})`), "2026-11-09|Développé couché guidé|e0");
  assert.equal(b.json(`cibleTxt(${JSON.stringify(DC)})`), "22,5 kg × 10");
  b.evaluer(`cocherEchauffement(${JSON.stringify(DC)})`);
  assert.deepEqual(b.json(`seanceDuJour().exos[0].ech`), [{ c: 22.5, r: 10, t: "17:00:00" }]);
  assert.equal(b.json(`minu.duree`), 60);
});

test("depuisMontre (notification) : la série visée est notée une fois", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  const d = { nom: DC, jour: "2026-11-09", id: "2026-11-09|Développé couché guidé|0", quand: "série 1/4" };
  b.evaluer(`depuisMontre(${JSON.stringify(d)}); depuisMontre(${JSON.stringify({ ...d })})`);
  assert.equal(b.json(`seanceDuJour().exos[0].series.length`), 1);
});
