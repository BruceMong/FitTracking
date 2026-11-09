// Le carnet dans l'APK : l'état (plan compact, repos) part à la montre par le pont à chaque changement, et en
// entier quand la montre se connecte. Dans Chrome (pas de pont), rien ne change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet, deplier } from "./banc.mjs";
import { DC, TRI, ELE, ctxPush, avecCtx } from "./fixtures.mjs";

const q = JSON.stringify;
const T0 = Date.parse("2026-11-09T17:00:00+01:00"), ID0 = `2026-11-09|${DC}|0`;

test("sans pont (Chrome) : rien de neuf, le service worker reçoit comme en v1", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`validerSerie(${q(DC)}); dessiner()`);
  assert.equal(b.json("pont"), null);
  assert.equal(b.messagesSW.at(-1).repos, T0 + 150000);
});

test("série notée au téléphone : repos (fin absolue, fait, réserve) puis plan", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.pont.vider(); const v0 = b.json("pontV");   // l'état complet est déjà parti au démarrage (montre présente)
  b.evaluer(`validerSerie(${q(DC)}); dessiner()`);
  // validerSerie garde deux fois le minuteur (repos, puis la réserve demandée) : deux repos, puis le plan
  assert.deepEqual(b.pont.envoyes.map((x) => x.cle), ["repos", "repos", "plan"]);
  assert.equal(b.pont.envoyes[0].message.fait, ID0);
  assert.deepEqual(b.pont.envoyes[1].message, { type: "repos", v: v0 + 2, dg: 0, fait: ID0,
    r: { id: T0, fin: T0 + 150000, duree: 150, p: null, nom: DC, ef: { nom: DC, k: 0, e: null } } });
  const plan = b.pont.envoyes[2].message;
  assert.equal(deplier(plan)[0].id, `2026-11-09|${DC}|1`);
  assert.equal(plan.v, v0 + 3);
});

test("plan_compact_du_carnet : forme exacte, et rebâti il redonne planMontre", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} }); b.pont.vider();
  b.evaluer(`lignesDe(${q(DC)}).st.ech = 1; dessiner()`);
  const m = b.pont.envoyes.filter((x) => x.cle === "plan").at(-1).message;
  // même littéral que planCompactCarnet() du plan montre (test/Banc.mc) : la montre est testée sur ce message
  assert.deepEqual([m.j, m.x, m.e], ["2026-11-09", [[DC, 4, 2.5, 0, 0], [TRI, 3, 2.5, 1, 0], [ELE, 3, 2.5, 1, 0]],
    [[0, 0, 22.5, 10, 60, 1], [0, 0, 42.5, 6, 150, 0], [0, 1, 42.5, 6, 150, 0], [0, 2, 42.5, 6, 150, 0],
     [0, 3, 42.5, 6, 120, 0], [1, 0, 20, 12, 0, 0], [2, 0, 8, 9, 120, 0], [1, 1, 20, 12, 0, 0], [2, 1, 8, 9, 120, 0],
     [1, 2, 20, 12, 0, 0], [2, 2, 8, 9, 0, 0]]]);
  assert.deepEqual(deplier(m), b.json("planMontre().etapes"));
});

test("plan compact d'une séance de posture : tenues rebâties à l'identique", async () => {
  // même contexte que le test de posture de plan.test.mjs
  const ctx = { ...ctxPush, programme: { posture: ["Étirement des ischios"] },
    exercices: [{ nom: "Étirement des ischios", seance: "posture", groupe: "mobilité", schema: { series: 2, reps: 30 } }] };
  const b = await chargerCarnet({ pont: {}, stockage: { "carnet:ctx": ctx,
    "carnet:seance:2026-11-09": { doc: { jour: "2026-11-09", type: "posture", exos: [], note: "" }, sale: false } } });
  const m = b.pont.envoyes.filter((x) => x.cle === "plan").at(-1).message;
  assert.deepEqual(m.x, [["Étirement des ischios", 2, 0, 0, 2]]);
  assert.deepEqual(m.e, [[0, 0, 0, 30, 30, 2], [0, 1, 0, 30, 0, 2]]);
  const etapes = deplier(m);
  assert.deepEqual(etapes, b.json("planMontre().etapes"));
  assert.equal(etapes[0].txt, "30 s");
});

test("montre absente : rien ne part ; à sa connexion, plan puis repos, forcés", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: { presente: false } });
  b.evaluer(`validerSerie(${q(DC)}); dessiner()`);
  assert.equal(b.pont.envoyes.length, 0);
  b.pont.connexion(true); await b.attendre();
  assert.deepEqual(b.pont.envoyes.map((x) => x.cle), ["plan", "repos"]);
  assert.equal(b.pont.envoyes[1].message.r.fin, T0 + 150000);
});

test("rien de changé, rien de renvoyé", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} }); b.pont.vider();
  b.evaluer("dessiner(); dessiner(); garder()");
  assert.equal(b.pont.envoyes.length, 0);
});

test("versions croissantes, gardées au rechargement", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.evaluer(`validerSerie(${q(DC)}); dessiner()`);
  const vs = b.pont.envoyes.map((x) => x.message.v);
  assert.ok(vs.every((v, i) => i === 0 || v > vs[i - 1]));
  const b2 = await chargerCarnet({ stockage: b.stockage(), pont: {} });
  assert.ok(b2.pont.envoyes[0].message.v > vs.at(-1));
});

// Contrat commun du pont : les écouteurs avant le premier etat(), pour ne perdre aucun changement de présence.
test("démarrage : l'écouteur connexion est posé avant etat(), avec ou sans clé ; plan puis repos", async () => {
  for (const plus of [{}, { "carnet:cle": "cle-essai" }]) {
    const b = await chargerCarnet({ stockage: avecCtx(plus), pont: {} });
    const appels = b.pont.appels;
    assert.ok(appels.indexOf("addListener:connexion") >= 0);
    assert.ok(appels.indexOf("addListener:connexion") < appels.indexOf("etat"));
    assert.deepEqual(b.pont.envoyes.map((x) => x.cle), ["plan", "repos"]);
    assert.equal(b.pont.envoyes[1].message.r, null);
  }
});

test("montre qui part : plus rien n'est envoyé ; elle revient, l'état complet repart même inchangé", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.pont.connexion(false); b.pont.vider();
  b.evaluer(`validerSerie(${q(DC)}); dessiner()`);
  assert.equal(b.pont.envoyes.length, 0);
  b.pont.connexion(true); b.pont.connexion(false); b.pont.vider();
  b.pont.connexion(true);   // rien n'a changé depuis le dernier envoi : forcé quand même
  assert.deepEqual(b.pont.envoyes.map((x) => x.cle), ["plan", "repos"]);
});

test("échauffement coché : fait = id de l'échauffement", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.evaluer(`lignesDe(${q(DC)}).st.ech = 1; dessiner()`); b.pont.vider();
  b.evaluer(`cocherEchauffement(${q(DC)})`);
  const repos = b.pont.envoyes.filter((x) => x.cle === "repos");
  assert.equal(repos.at(-1).message.fait, `2026-11-09|${DC}|e0`);
  assert.equal(repos.at(-1).message.r.duree, 60);
});

test("etat() lent : la présence apprise entre-temps par l'événement l'emporte sur la sienne, plus ancienne", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: { presente: false, etatDiffere: true } });
  b.pont.connexion(true);
  assert.deepEqual(b.pont.envoyes.map((x) => x.cle), ["plan", "repos"]);
  b.pont.rendreEtat(); await b.attendre(); b.pont.vider();   // etat() répond « absente » : périmé
  b.evaluer(`validerSerie(${q(DC)}); dessiner()`);
  assert.deepEqual(b.pont.envoyes.map((x) => x.cle), ["repos", "repos", "plan"]);
});

test("fait ne vaut que jusqu'au plan suivant", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.evaluer(`validerSerie(${q(DC)}); dessiner()`); b.pont.vider();
  b.evaluer("garder()");   // le plan est parti : le repos suivant ne porte plus la série notée
  assert.deepEqual(b.pont.envoyes.map((x) => [x.cle, x.message.fait]), [["repos", null]]);
});

test("réserve notée pendant le repos : le repos repart avec e", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.evaluer(`validerSerie(${q(DC)})`); b.pont.vider();
  // ce que fait clicMinuteur sur un bouton de réserve : la série reçoit e, puis garder()
  b.evaluer(`seanceDuJour().exos.find((e) => e.nom === ${q(DC)}).series[0].e = 3; sauver(); garder()`);
  assert.deepEqual(b.pont.envoyes.map((x) => [x.cle, x.message.r?.ef]), [["repos", { nom: DC, k: 0, e: 3 }]]);
});
