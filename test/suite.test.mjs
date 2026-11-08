// validerSerie scindée : noter (l'état) / décider la suite (sans effet) / effets. Le plan de la montre
// rejoue noterSerie + suiteApres sur une copie de l'état, sans repos ni enregistrement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { DC, TRI, ELE, avecCtx } from "./fixtures.mjs";

const q = JSON.stringify;

test("suiteApres : repos de l'exercice", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  assert.deepEqual(b.json(`suiteApres(${q(DC)}, noterSerie(${q(DC)}))`), { quoi: "repos", duree: 150 });
});
test("suiteApres : fin d'exercice, un autre suit", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`for (let i = 0; i < 3; i++) noterSerie(${q(DC)})`);
  assert.deepEqual(b.json(`suiteApres(${q(DC)}, noterSerie(${q(DC)}))`), { quoi: "fin", autre: true });
});
test("suiteApres : superset, enchaîner puis repos de paire", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  assert.deepEqual(b.json(`suiteApres(${q(TRI)}, noterSerie(${q(TRI)}))`), { quoi: "superset", part: ELE });
  assert.deepEqual(b.json(`suiteApres(${q(ELE)}, noterSerie(${q(ELE)}))`), { quoi: "repos", duree: 120, ss: true });
});
test("noterSerie seul : ni repos, ni enregistrement, ni message", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  const avant = b.messagesSW.length;
  b.evaluer(`noterSerie(${q(DC)})`);
  assert.equal(b.json(`minu`), null);
  assert.equal(b.stockage()["carnet:seance:2026-11-09"], undefined);
  assert.equal(b.messagesSW.length, avant);
});
