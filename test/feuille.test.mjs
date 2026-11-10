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

test("menu ⋯ : « Hors progression » caché quand toute la séance est hors progression", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  assert.match(b.json(`menuExo(${q(DC)})`), /data-hp/);
  b.evaluer("seanceDuJour().hp = true");
  assert.doesNotMatch(b.json(`menuExo(${q(DC)})`), /data-hp/);
});

// La charge et les répétitions se tapent aussi : un champ entre les − / +, dans la feuille et dans la vue Exercice.
const champ = (h, c) => h.match(new RegExp(`<input [^>]*data-champ="${c}"[^>]*>`))?.[0] ?? "";
test("feuille d'une série : charge et répétitions en champs à taper", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`validerSerie(${q(DC)})`);
  const h = b.json(`feuilleSerie(${q(DC)}, 0, false)`);
  assert.match(champ(h, "c"), /inputmode="decimal"/);
  assert.match(champ(h, "c"), /placeholder="pdc"/);
  assert.match(champ(h, "c"), /value="42,5"/);
  assert.match(champ(h, "c"), /enterkeyhint="done"/);
  assert.match(champ(h, "r"), /inputmode="numeric"/);
  assert.match(champ(h, "r"), /value="6"/);
  assert.match(h, /data-pm="c"/);
});
test("vue Exercice : charge et répétitions en champs à taper", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }) });
  b.evaluer("dessiner()");
  const h = b.json(`corpsGrand("serie")`);
  assert.match(champ(h, "c"), /inputmode="decimal"/);
  assert.match(champ(h, "c"), /placeholder="pdc"/);
  assert.match(champ(h, "c"), /value="42,5"/);
  assert.match(champ(h, "r"), /inputmode="numeric"/);
  assert.match(champ(h, "r"), /enterkeyhint="done"/);
  assert.match(h, /data-pm="c" data-d="-1"/);
});
test("une charge tapée puis validée règle la série prévue, le champ est quitté et la vue redessinée", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }) });
  b.evaluer("dessiner()");
  const el = b.taper(DC, 0, "c", "60");
  assert.equal(el.flou, true);
  assert.equal(b.json(`aFaire(${q(DC)}).l.c`), 60);
  b.lancerMinuteurs();
  assert.match(champ(b.json(`$("#g-corps").innerHTML`), "c"), /value="60"/);
  b.taper(DC, 0, "c", "pdc");
  assert.equal(b.json(`aFaire(${q(DC)}).l.c`), 0);
  b.taper(DC, 0, "r", "8");
  assert.equal(b.json(`aFaire(${q(DC)}).l.r`), 8);
  b.taper(DC, 0, "r", "abc");   // illisible : rien ne change
  assert.equal(b.json(`aFaire(${q(DC)}).l.r`), 8);
});
test("une valeur tapée dans la feuille corrige la série faite", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }) });
  b.evaluer(`dessiner(); validerSerie(${q(DC)}); ouvrirFeuille(feuilleSerie(${q(DC)}, 0, false), { quoi: "serie", nom: ${q(DC)}, k: 0, ech: false })`);
  b.taper(DC, 0, "c", "47,5");
  b.lancerMinuteurs();
  assert.equal(b.json("seanceDuJour().exos[0].series[0].c"), 47.5);
  assert.match(champ(b.json(`$("#feuille-corps").innerHTML`), "c"), /value="47,5"/);
});
test("un champ en cours de saisie n'est pas effacé par un redessin", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }) });
  b.evaluer(`dessiner(); ouvrirFeuille(feuilleSerie(${q(DC)}, 1, false), { quoi: "serie", nom: ${q(DC)}, k: 1, ech: false })`);
  const vue = b.json(`$("#g-corps").innerHTML`), feuille = b.json(`$("#feuille-corps").innerHTML`);
  // le doigt dans un champ : un changement venu d'ailleurs (la montre, la base) ne réécrit ni la vue ni la feuille
  b.evaluer(`document.activeElement = { dataset: { champ: "c" } }; regler(${q(DC)}, 0, false, "r", 3); dessiner()`);
  assert.equal(b.json(`$("#g-corps").innerHTML`), vue);
  assert.equal(b.json(`$("#feuille-corps").innerHTML`), feuille);
  // le champ quitté : tout se remet à jour
  b.evaluer("document.activeElement = null; dessiner()");
  assert.notEqual(b.json(`$("#g-corps").innerHTML`), vue);
  assert.notEqual(b.json(`$("#feuille-corps").innerHTML`), feuille);
});
