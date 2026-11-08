// La saisie du jour est gardée par jour dans le téléphone ; une retouche (ou une paire de superset coupée)
// republie le plan pour la montre 1,5 s plus tard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { DC, TRI, ELE, avecCtx } from "./fixtures.mjs";

const q = JSON.stringify;

test("la saisie est gardée par jour", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`lignesDe(${q(DC)}).st.ech++; lignesDe(${q(DC)}).st.edits[1] = { c: 45, r: 6 }; dessiner()`);
  assert.deepEqual(b.stockage()["carnet:saisie:2026-11-09"][DC], { edits: { 1: { c: 45, r: 6 } }, extra: 0, ech: 1, echEdits: {} });
});
test("saisie_survit_au_rechargement", async () => {
  const saisie = { [DC]: { edits: { 1: { c: 45, r: 6 } }, extra: 1, ech: 1, echEdits: {} } };
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:saisie:2026-11-09": saisie }) });
  assert.equal(b.json(`lignesDe(${q(DC)}).W.length`), 1);
  assert.equal(b.json(`lignesDe(${q(DC)}).L.length`), 5);
  assert.equal(b.json(`planMontre().etapes[2].txt`), "45 kg × 6");
});
test("la saisie d'un autre jour est oubliée", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:saisie:2026-11-08": { [DC]: { edits: {}, extra: 2, ech: 0, echEdits: {} } } }) });
  assert.equal(b.stockage()["carnet:saisie:2026-11-08"], undefined);
  assert.equal(b.json(`lignesDe(${q(DC)}).L.length`), 4);
});
test("changer de type de séance remet la saisie à zéro, gardé aussi", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:saisie:2026-11-09": { [DC]: { edits: {}, extra: 1, ech: 0, echEdits: {} } } }) });
  b.evaluer(`saisie = {}; dessiner()`);
  assert.deepEqual(b.stockage()["carnet:saisie:2026-11-09"], {});
});
test("une retouche de saisie republie le plan 1,5 s plus tard", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }) });
  await b.attendre();
  b.evaluer(`lignesDe(${q(DC)}).st.ech++; dessiner()`);
  b.lancerMinuteurs(); await b.attendre();
  const pubs = b.appels.filter((x) => x.fonction === "carnet_montre_publier");
  assert.equal(pubs.at(-1).corps.p_plan.etapes[0].quoi, "échauffement");
});
test("couper une paire de superset republie un plan sans enchaînement", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }) });
  b.evaluer(`dessiner()`);   // la saisie est déjà créée et vue : seule la paire coupée peut changer le plan
  b.lancerMinuteurs(); await b.attendre();
  const pubs = () => b.appels.filter((x) => x.fonction === "carnet_montre_publier");
  const avant = pubs().length;
  b.evaluer(`couperSuperset(${q(TRI)}, ${q(ELE)}, true); dessiner()`);
  b.lancerMinuteurs(); await b.attendre();
  assert.equal(pubs().length, avant + 1);
  const e = pubs().at(-1).corps.p_plan.etapes.filter((x) => x.nom === TRI || x.nom === ELE);
  assert.deepEqual(e.map((x) => x.nom), [TRI, TRI, TRI, ELE, ELE, ELE]);
  assert.ok(e.every((x) => !x.quoi.includes("superset")) && e.slice(0, -1).every((x) => x.repos > 0), "plus de repos 0 entre partenaires (la dernière étape du plan mise à part)");
});
