// Le superset du programme est désactivé par défaut : on l'active pour la journée, gardé au rechargement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { DC, TRI, ELE, SS_TRI_ELE, avecCtxSansSs } from "./fixtures.mjs";

const q = JSON.stringify;

test("superset : désactivé par défaut", async () => {
  const b = await chargerCarnet({ stockage: avecCtxSansSs() });
  assert.equal(b.json(`ssActif(${q(TRI)})`), false);
  assert.equal(b.json(`ssActif(${q(ELE)})`), false);
  // le plan montre ne marque aucune étape superset (« · superset » dans quoi)
  assert.ok(b.json("planMontre().etapes").every((e) => !e.quoi.includes("superset")));
});
test("superset : activé pour la journée, gardé au rechargement", async () => {
  const b = await chargerCarnet({ stockage: avecCtxSansSs() });
  assert.equal(b.json(`basculerSuperset(${q(TRI)})`), true);
  assert.equal(b.json(`ssActif(${q(ELE)})`), true);
  assert.deepEqual(b.stockage()["carnet:ss-on:2026-11-09"], [SS_TRI_ELE]);
  assert.equal(b.json(`basculerSuperset(${q(ELE)})`), false);
  assert.deepEqual(b.stockage()["carnet:ss-on:2026-11-09"], []);
});
test("superset : sans partenaire, rien ne bascule", async () => {
  const b = await chargerCarnet({ stockage: avecCtxSansSs() });
  assert.equal(b.json(`basculerSuperset(${q(DC)})`), false);
  assert.equal(b.stockage()["carnet:ss-on:2026-11-09"], undefined);
});
test("superset : les clés ss-on des jours passés partent, l'ancienne ss-off est ignorée", async () => {
  const b = await chargerCarnet({ stockage: avecCtxSansSs({ "carnet:ss-on:2026-11-08": [SS_TRI_ELE], "carnet:ss-off:2026-11-09": [] }) });
  assert.equal(b.stockage()["carnet:ss-on:2026-11-08"], undefined);
  assert.equal(b.stockage()["carnet:ss-off:2026-11-09"], undefined);
  assert.equal(b.json(`ssActif(${q(TRI)})`), false);
});
test("superset activé pendant le repos : le partenaire vient ensuite", async () => {
  const b = await chargerCarnet({ stockage: avecCtxSansSs() });
  b.evaluer(`grandVu = true; ouvert = ${q(TRI)}; validerSerie(${q(TRI)})`);
  assert.equal(b.json("minu.mode"), "repos");
  b.evaluer(`basculerSuperset(${q(TRI)})`);
  assert.equal(b.json("exoGrand()"), ELE);
});
