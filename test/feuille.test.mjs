// Les feuilles du bas de la vue Exercice : toucher une pastille ouvre la série pour la corriger, « ⋯ » ouvre les
// actions de l'exercice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { DC, TRI, avecCtx, avecCtxSansSs } from "./fixtures.mjs";

const q = JSON.stringify;

test("feuille d'une série faite : réglages, réserve, retirer", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`validerSerie(${q(DC)})`);
  const h = b.json(`feuilleSerie(${q(DC)}, 0, false)`);
  assert.match(h, /data-exo="Développé couché guidé"/);
  assert.match(h, /data-pm="c"/); assert.match(h, /data-pm="r"/);
  assert.equal((h.match(/data-f-reserve=/g) || []).length, 5);
  assert.match(h, /data-f-retirer/);
});
test("feuille d'une série prévue : pas de réserve ni de retrait", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  const h = b.json(`feuilleSerie(${q(DC)}, 2, false)`);
  assert.match(h, /data-pm="c"/);
  assert.doesNotMatch(h, /data-f-reserve|data-f-retirer/);
});
test("menu ⋯ : actions dans l'ordre, superset seulement avec un partenaire", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  const m = b.json(`menuExo(${q(TRI)})`);
  const ordre = ["data-memo", "data-f-note", "data-plus-serie", "data-plus-ech", "data-remplacer", "data-superset", "data-hp"];
  const pos = ordre.map((a) => m.indexOf(a));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])));
  assert.doesNotMatch(b.json(`menuExo(${q(DC)})`), /data-superset/);
});
test("menu ⋯ : la case du superset suit la paire", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  assert.match(b.json(`menuExo(${q(TRI)})`), /f-case on/);
  const c = await chargerCarnet({ stockage: avecCtxSansSs() });
  assert.doesNotMatch(c.json(`menuExo(${q(TRI)})`), /f-case on/);
});
test("corriger une série faite pendant le repos : pastilles à l'écran, plan corrigé envoyé à la montre", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }), pont: {} });
  b.evaluer(`validerSerie(${q(DC)}); dessiner()`);
  const fin = b.json("minu.fin");
  // les pastilles de l'exercice sont sur l'écran du repos, avec le nom de leur exercice
  const h = b.json(`corpsGrand("repos")`);
  assert.equal((h.match(/data-pastille=/g) || []).length, 4);
  assert.match(h, /data-pn="Développé couché guidé"/);
  assert.match(h, /g-pastilles compact/);
  b.pont.vider();
  // corriger la charge de la série faite : les séries qui suivent la reprennent, la montre en est prévenue
  b.evaluer(`regler(${q(DC)}, 0, false, "c", 50); dessiner()`);
  assert.equal(b.json("seanceDuJour().exos[0].series[0].c"), 50);
  assert.equal(b.json("minu.fin"), fin);
  assert.equal(b.json("minu.mode"), "repos");
  const plans = b.pont.envoyes.filter((x) => x.cle === "plan");
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].message.e[0].slice(0, 4), [0, 1, 50, 6]);   // série 2 : 50 kg × 6
  assert.equal(plans[0].message.v, b.json("pontV"));
});
test("la feuille ouverte garde son sujet et se rafraîchit", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }) });
  b.evaluer(`validerSerie(${q(DC)}); ouvrirFeuille(feuilleSerie(${q(DC)}, 0, false), { quoi: "serie", nom: ${q(DC)}, k: 0, ech: false })`);
  assert.deepEqual(b.json("feuilleOuverte"), { quoi: "serie", nom: DC, k: 0, ech: false });
  b.evaluer(`regler(${q(DC)}, 0, false, "r", 5); dessiner()`);
  assert.match(b.json("$('#feuille-corps').innerHTML"), /data-f-retirer/);
  b.evaluer("fermerFeuille()");
  assert.equal(b.json("feuilleOuverte"), null);
});
test("la réserve et le retrait d'une série passent par la feuille", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }) });
  b.evaluer(`validerSerie(${q(DC)}); ouvrirFeuille(feuilleSerie(${q(DC)}, 0, false), { quoi: "serie", nom: ${q(DC)}, k: 0, ech: false })`);
  b.evaluer(`clicFeuille({ dataset: { fReserve: "2" }, hasAttribute: (a) => a === "data-f-reserve", closest: () => null }, ${q(DC)})`);
  assert.equal(b.json("seanceDuJour().exos[0].series[0].e"), 2);
  b.evaluer(`clicFeuille({ dataset: {}, hasAttribute: (a) => a === "data-f-retirer", closest: () => null }, ${q(DC)})`);
  assert.equal(b.json("seanceDuJour().exos.length"), 0);
  assert.equal(b.json("feuilleOuverte"), null);
});
test("toucher une pastille ou ⋯ ouvre la feuille de l'exercice affiché", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }) });
  b.evaluer("dessiner()");
  b.evaluer(`clicGrand({ target: { closest: (sel) => sel === "[data-pastille]" ? { dataset: { pastille: "2" } } : null } })`);
  assert.deepEqual(b.json("feuilleOuverte"), { quoi: "serie", nom: DC, k: 2, ech: false });
  b.evaluer(`clicGrand({ target: { closest: (sel) => sel === "[data-g]" ? { dataset: { g: "menu" } } : null } })`);
  assert.deepEqual(b.json("feuilleOuverte"), { quoi: "menu", nom: DC });
});
test("menu ⋯ : le superset se coupe et se réactive par le clic de la feuille", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  const clic = (attrs) => b.evaluer(`clicFeuille({ dataset: ${q(attrs)}, hasAttribute: () => false, closest: () => null }, ${q(TRI)})`);
  assert.equal(b.json(`ssActif(${q(TRI)})`), true);
  clic({ superset: TRI });
  assert.equal(b.json(`ssActif(${q(TRI)})`), false);
  assert.doesNotMatch(b.json(`menuExo(${q(TRI)})`), /f-case on/);
  clic({ superset: TRI });
  assert.equal(b.json(`ssActif(${q(TRI)})`), true);
  assert.match(b.json(`menuExo(${q(TRI)})`), /f-case on/);
});
test("menu ⋯ : la mesure (répétitions / secondes) seulement sans charge, avant « Hors progression »", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  assert.doesNotMatch(b.json(`menuExo(${q(DC)})`), /data-mesure/);
  const c = await chargerCarnet({ stockage: avecCtx({ [`carnet:mesure:${DC}`]: "reps" }) });
  const m = c.json(`menuExo(${q(DC)})`);
  assert.match(m, /data-mesure="duree"[^>]*>Compter en secondes/);
  assert.ok(m.indexOf("data-mesure") < m.indexOf("data-hp"));
  c.evaluer(`clicFeuille({ dataset: { mesure: "duree" }, hasAttribute: () => false, closest: () => null }, ${q(DC)})`);
  assert.equal(c.json(`mesureDe(${q(DC)})`), "duree");
  assert.match(c.json(`menuExo(${q(DC)})`), /data-mesure="reps"[^>]*>Compter en répétitions/);
});
