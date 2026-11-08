// Le plan du jour publié pour l'appli montre : ce que le grand format enchaînerait, série par série, rejoué
// sur une copie de l'état ; puis sa publication (forcée après charger, sinon seulement s'il a changé).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { JOUR, DC, TRI, ELE, ctxPush, avecCtx, enCours } from "./fixtures.mjs";

const q = JSON.stringify;
const etapes = (b) => b.json("planMontre().etapes");
const ids = (b) => etapes(b).map((e) => e.id.split("|").slice(1).join("|"));
const T = (k) => `${TRI}|${k}`, E = (k) => `${ELE}|${k}`, D = (k) => `${DC}|${k}`;

// Le grand format joué pour de vrai (validerSerie / cocherEchauffement), avec l'id et le repos lancé à chaque pas.
const grandFormat = (g) => g.json(`(() => { grandVu = true; const r = [];
    for (let nom = exoGrand(), i = 0; nom && i < 100; nom = exoGrand(), i++) {
      const id = idSerie(nom); aFaire(nom).ech ? cocherEchauffement(nom) : validerSerie(nom);
      r.push([id, minu?.mode === "repos" ? minu.duree : 0]);
    } return r; })()`);

test("plan d'une séance vierge : ordre, textes, repos", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  const p = b.json("planMontre()");
  assert.equal(p.jour, "2026-11-09");
  assert.equal(p.v, null);
  assert.deepEqual(ids(b), [D(0), D(1), D(2), D(3), T(0), E(0), T(1), E(1), T(2), E(2)]);
  assert.deepEqual(p.etapes.map((e) => e.repos), [150, 150, 150, 120, 0, 120, 0, 120, 0, 0]);
  assert.deepEqual(p.etapes[0], { id: "2026-11-09|Développé couché guidé|0", nom: DC, quoi: "série 1/4",
    txt: "42,5 kg × 6", repos: 150, ech: false, k: 0, c: 42.5, r: 6, u: null });
  assert.deepEqual(p.etapes[3].quoi, "série 4/4");
  assert.deepEqual([p.etapes[4].quoi, p.etapes[4].txt, p.etapes[5].txt], ["série 1/3 · superset", "20 kg × 12", "8 kg × 9"]);
  assert.equal(p.etapes[9].quoi, "série 3/3 · superset");
});

test("plan avec un échauffement ajouté au téléphone", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`lignesDe(${q(DC)}).st.ech = 1`);
  assert.deepEqual(etapes(b)[0], { id: "2026-11-09|Développé couché guidé|e0", nom: DC, quoi: "échauffement",
    txt: "22,5 kg × 10", repos: 60, ech: true, k: 0, c: 22.5, r: 10, u: null });
  assert.equal(etapes(b)[1].id, "2026-11-09|Développé couché guidé|0");
  assert.equal(etapes(b).length, 11);
});

test("plan en cours de séance : séries faites retirées, charges réglées suivies, v = doc.maj", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(enCours([{ c: 42.5, r: 6, t: "16:50:00" }, { c: 42.5, r: 5, t: "16:53:00" }])) });
  b.evaluer(`lignesDe(${q(DC)}).st.edits[2] = { c: 45, r: 6 }`);
  const p = b.json("planMontre()");
  assert.equal(p.v, "2026-11-09T15:53:10.000Z");
  assert.deepEqual(p.etapes.slice(0, 2).map((e) => [e.id.split("|")[2], e.quoi, e.txt, e.c]),
    [["2", "série 3/4", "45 kg × 6", 45], ["3", "série 4/4", "45 kg × 6", 45]]);
  assert.equal(p.etapes.length, 8);
});

test("plan_superset_debranche : chaque exercice seul, repos normal", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:ss-off:2026-11-09": [`${TRI} + ${ELE}`] }) });
  assert.deepEqual(ids(b).slice(4), [T(0), T(1), T(2), E(0), E(1), E(2)]);
  assert.deepEqual(etapes(b).slice(4).map((e) => e.repos), [90, 90, 120, 90, 90, 0]);
  assert.equal(etapes(b)[4].quoi, "série 1/3");
});

test("plan d'une séance de posture : tenues en secondes", async () => {
  const ctx = { ...ctxPush, programme: { posture: ["Étirement des ischios"] },
    exercices: [{ nom: "Étirement des ischios", seance: "posture", groupe: "mobilité", schema: { series: 2, reps: 30 } }] };
  const b = await chargerCarnet({ stockage: { "carnet:ctx": ctx,
    "carnet:seance:2026-11-09": { doc: { jour: "2026-11-09", type: "posture", exos: [], note: "" }, sale: false } } });
  assert.deepEqual(etapes(b).map((e) => [e.quoi, e.txt, e.c, e.r, e.u, e.repos]),
    [["série 1/2", "30 s", 0, 30, "s", 30], ["série 2/2", "30 s", 0, 30, "s", 0]]);
});

test("le plan suit le grand format pas à pas", async () => {
  const prep = `lignesDe(${q(DC)}).st.ech = 1`;
  const b = await chargerCarnet({ stockage: avecCtx() }); b.evaluer(prep);
  const plan = etapes(b).map((e) => [e.id, e.repos]);
  const g = await chargerCarnet({ stockage: avecCtx() }); g.evaluer(prep);
  const vu = g.json(`(() => { grandVu = true; const r = [];
    for (let nom = exoGrand(), i = 0; nom && i < 100; nom = exoGrand(), i++) {
      const id = idSerie(nom); aFaire(nom).ech ? cocherEchauffement(nom) : validerSerie(nom);
      r.push([id, minu?.mode === "repos" ? minu.duree : 0]);
    } return r; })()`);
  assert.deepEqual(plan, vu);
});

// sauver() recalcule doc.type (typeReel) : une séance « autre » dont la première série est d'un exercice
// push devient push, et le grand format enchaîne alors les autres exercices du programme push.
test("plan d'une séance « autre » que sa première série fait push : le type suit, comme au grand format", async () => {
  const stockage = avecCtx({ "carnet:seance:2026-11-09":
    { doc: { jour: JOUR, type: "autre", exos: [{ nom: DC, series: [] }], note: "" }, sale: false } });
  const b = await chargerCarnet({ stockage });
  assert.deepEqual(ids(b), [D(0), D(1), D(2), D(3), T(0), E(0), T(1), E(1), T(2), E(2)]);
  assert.equal(etapes(b)[3].repos, 120);   // fin de DC, un autre exercice suit : transition
  assert.equal(b.json("doc.type"), "autre");   // la vraie séance n'a pas bougé
  const plan = etapes(b).map((e) => [e.id, e.repos]);
  assert.deepEqual(plan, grandFormat(await chargerCarnet({ stockage })));
});

test("planMontre ne touche à rien", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(enCours([{ c: 42.5, r: 6, t: "16:50:00" }])) });
  b.evaluer(`seanceDuJour(); lignesDe(${q(DC)}).st.ech = 1; minu = { nom: ${q(DC)}, mode: "repos", duree: 150, fin: 0 }`);
  const etat = `({ doc, saisie, minu, ouvert, choisie })`, avant = [b.json(etat), b.stockage(), b.messagesSW.length];
  b.evaluer("planMontre()");
  assert.deepEqual([b.json(etat), b.stockage(), b.messagesSW.length], avant);
});

test("30 étapes tiennent dans 8 Ko", async () => {
  const noms = Array.from({ length: 7 }, (_, i) => `Développé incliné haltères n°${i + 1}`);
  const ctx = { ...ctxPush, programme: { push: noms }, supersets: {},
    exercices: noms.map((nom) => ({ nom, seance: "push", groupe: "pecs", schema: { series: 4, reps: 8 } })) };
  const b = await chargerCarnet({ stockage: { "carnet:ctx": ctx } });
  b.evaluer(`lignesDe(${q(noms[0])}).st.ech = 2`);
  assert.equal(etapes(b).length, 30);
  assert.ok(Buffer.byteLength(JSON.stringify(b.json("planMontre()"))) < 8192);
});

test("publication : forcée après charger, puis seulement si le plan change", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }) });
  await b.attendre();
  const pubs = () => b.appels.filter((x) => x.fonction === "carnet_montre_publier");
  assert.equal(pubs().length, 1);
  assert.equal(pubs()[0].corps.p_cle, "cle-essai");
  assert.equal(pubs()[0].corps.p_plan.etapes.length, 10);
  await b.evaluer("synchroniser()"); await b.attendre();
  assert.equal(pubs().length, 1);
  b.evaluer(`validerSerie(${q(DC)})`); await b.evaluer("synchroniser()"); await b.attendre();
  assert.equal(pubs().length, 2);
  assert.equal(pubs()[1].corps.p_plan.etapes[0].id, "2026-11-09|Développé couché guidé|1");
});

test("publication refusée : rien de retenu, on réessaie au prochain synchroniser", async () => {
  let refus = true;
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }),
    reponses: { carnet_montre_publier: () => { if (refus) throw { status: 503, message: "indisponible" }; return null; } } });
  await b.attendre();
  const n = () => b.appels.filter((x) => x.fonction === "carnet_montre_publier").length, avant = n();
  assert.ok(avant >= 1);
  assert.equal(b.stockage()["carnet:montre-publie"], undefined);
  refus = false; await b.evaluer("synchroniser()"); await b.attendre();
  assert.equal(n(), avant + 1);
  assert.ok(b.stockage()["carnet:montre-publie"]);
});

test("changer d'exercice au téléphone (« suiv » du grand format) republie le plan, qui part de cet exercice", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }) });
  await b.attendre(); b.evaluer("dessiner()"); b.lancerMinuteurs(); await b.attendre();
  const pubs = () => b.appels.filter((x) => x.fonction === "carnet_montre_publier");
  const avant = pubs().length;
  // Le geste « suiv » du grand format (écouteur de #grand), tel quel.
  b.evaluer(`grandVu = true; { const suite = exosAffiches(seanceDuJour()).filter(resteSeries), i = suite.indexOf(exoGrand());
    ouvert = suite[(i + 1) % suite.length]; choisie = null; dessiner(); }`);
  for (let i = 0; i < 3; i++) { b.lancerMinuteurs(); await b.attendre(); }
  assert.equal(b.json("exoGrand()"), TRI);
  assert.equal(pubs().length, avant + 1);
  assert.equal(pubs().at(-1).corps.p_plan.etapes[0].nom, TRI);
});

test("planMontre : une série que noterSerie ne note pas arrête le plan au lieu de lever", async () => {
  // Inatteignable aujourd'hui (aFaire lit la même ligne et la trouve) : noterSerie remplacé pour l'essai.
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer("noterSerie = () => null");
  assert.deepEqual(b.json("planMontre().etapes"), []);
});
