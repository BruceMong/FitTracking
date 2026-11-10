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
     [0, 3, 42.5, 5, 120, 0], [1, 0, 20, 12, 0, 0], [2, 0, 8, 9, 120, 0], [1, 1, 20, 12, 0, 0], [2, 1, 8, 9, 120, 0],
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

// Les boutons de la barre du minuteur (data-min) ne passent pas par dessiner() : le plan doit suivre quand même.
const clicMin = (a) => `clicMinuteur({ target: { closest: (s) => s === "[data-min]" ? { dataset: { min: ${q(a)} } } : null } })`;

test("« Sans superset » : le plan repart, bit superset à 0 et chaque exercice seul", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.evaluer(`validerSerie(${q(TRI)}); dessiner()`); b.pont.vider();   // superset : enchaîne les élévations
  b.evaluer(clicMin("repos-seul"));
  const plans = b.pont.envoyes.filter((x) => x.cle === "plan");
  assert.equal(plans.length, 1);
  const m = plans[0].message;
  assert.deepEqual(m.x.filter((x) => x[0] !== DC).map((x) => [x[0], x[3]]), [[TRI, 0], [ELE, 0]]);
  assert.deepEqual(deplier(m), b.json("planMontre().etapes"));
});

test("« OK » pendant le repos d'un superset : le plan repart, sa première étape a changé", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.evaluer(`validerSerie(${q(TRI)}); validerSerie(${q(ELE)}); dessiner()`);
  const avant = b.pont.envoyes.filter((x) => x.cle === "plan").at(-1).message;
  b.pont.vider();
  b.evaluer(clicMin("stop"));
  const plans = b.pont.envoyes.filter((x) => x.cle === "plan");
  assert.equal(plans.length, 1);
  assert.notEqual(deplier(plans[0].message)[0].id, deplier(avant)[0].id);
  assert.equal(deplier(plans[0].message)[0].id, b.json("planMontre().etapes[0].id"));
});

test("plan compact rebâti à l'identique : « + une série », et superset aux nombres de séries différents", async () => {
  // + une série : le N de « série k/N » passe à 5, jusqu'à la dernière
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.evaluer(`lignesDe(${q(DC)}).st.extra++; dessiner()`);
  const m = b.pont.envoyes.filter((x) => x.cle === "plan").at(-1).message;
  assert.deepEqual(m.x[0].slice(0, 2), [DC, 5]);
  assert.deepEqual(deplier(m), b.json("planMontre().etapes"));
  assert.equal(deplier(m)[4].quoi, "série 5/5");
  // superset 3 + 4 séries : la dernière série des élévations se fait seule
  const ctx = { ...ctxPush, exercices: ctxPush.exercices.map((x) => (x.nom === ELE ? { ...x, schema: { series: 4, reps: 12 } } : x)) };
  const b2 = await chargerCarnet({ stockage: { "carnet:ctx": ctx }, pont: {} });
  const m2 = b2.pont.envoyes.filter((x) => x.cle === "plan").at(-1).message;
  assert.deepEqual(m2.x.map((x) => x.slice(0, 2)), [[DC, 4], [TRI, 3], [ELE, 4]]);
  assert.deepEqual(deplier(m2), b2.json("planMontre().etapes"));
});

// ── Fin de repos dans l'APK (tâche 6) : le carnet programme la notification native de fin (programmerFin), et
// ne sonne pas une seconde fois ce que le natif (notification du pont, ou vibration de la montre) a déjà sonné.
const TITRE = "Repos terminé", TEXTE_DC = `${DC} · série 2/4 ensuite · 42,5 kg × 6`;
// Sonneries de fin espionnées : la vibration de fin (le motif, pas les petites vibrations des boutons), le bip et
// le flash de l'écran.
const espionFin = (b) => b.evaluer(`globalThis.sonneries = [];
  navigator.vibrate = (x) => { if (Array.isArray(x)) sonneries.push("vibre"); }; bip = () => sonneries.push("bip");
  $("#flash").classList.add = () => sonneries.push("flash");`);
// Le temps passe la fin du repos (d'une seconde), puis un tic. Date.now avance : la page a été chargée avant.
const finDuRepos = (b) => b.evaluer(`{ const t = minu.fin + 1000; Date.now = () => t; } majRepos()`);

test("programmerFin suit le repos : lancé, en pause, repris, ±15 s, arrêté ; repos de la montre compris", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.evaluer(`validerSerie(${q(DC)})`);
  assert.deepEqual(b.pont.fins.at(-1), { fin: T0 + 150000, titre: TITRE, texte: TEXTE_DC });
  b.evaluer("pauseRepos()");
  assert.equal(b.pont.fins.at(-1).fin, null);
  b.evaluer("reprendreRepos()");
  assert.equal(b.pont.fins.at(-1).fin, T0 + 150000);
  b.evaluer("ajusterRepos(15)");
  assert.equal(b.pont.fins.at(-1).fin, T0 + 165000);
  b.evaluer("arreterRepos()");
  assert.equal(b.pont.fins.at(-1).fin, null);
  // un repos lancé par la montre aussi : le pont décide à l'échéance si la montre est là
  b.evaluer(`reposDepuisAppli({ id: ${q(ID0)}, nom: ${q(DC)}, jour: "2026-11-09", ech: false, repos: 150, ts: ${T0 / 1000} },
    { ts: ${T0 - 10000} })`);
  assert.deepEqual(b.pont.fins.at(-1), { fin: T0 + 140000, titre: TITRE, texte: `Montre · ${DC} · repos lancé par la montre` });
});

test("fin du repos, montre présente (sur 75 s) : ni vibration ni bip, le flash reste ; absente : comme en v1", async () => {
  for (const [presente, attendu] of [[true, ["flash"]], [false, ["vibre", "bip", "flash"]]]) {
    const b = await chargerCarnet({ stockage: avecCtx(), pont: { presente } });
    b.evaluer(`validerSerie(${q(DC)})`); espionFin(b);
    finDuRepos(b); await b.attendre(); b.evaluer("majRepos()"); await b.attendre();
    assert.deepEqual(b.json("sonneries"), attendu, `présente : ${presente}`);
    assert.equal(b.json("sonne"), true);
  }
});

test("page à l'écran, montre présente sur 150 s mais pas sur 75 s (morte sans aurevoir) : le téléphone sonne", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.pont.presenteFin = false;
  b.evaluer(`validerSerie(${q(DC)})`); espionFin(b);
  finDuRepos(b); await b.attendre();
  assert.ok(b.pont.appels.includes("presence"));
  assert.deepEqual(b.json("sonneries"), ["flash", "vibre", "bip"]);
  b.evaluer("majRepos()"); await b.attendre();
  assert.deepEqual(b.json("sonneries"), ["flash", "vibre", "bip"]);   // une fois
});

test("presence() rejetée, absente (APK d'avant) ou sans réponse : le téléphone sonne (mieux deux alertes qu'aucune)", async () => {
  for (const [nom, regler] of [["rejet", (p) => { p.presenceRejet = true; }], ["bloquée", (p) => { p.presenceBloquee = true; }]]) {
    const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
    regler(b.pont);
    b.evaluer(`validerSerie(${q(DC)})`); espionFin(b);
    finDuRepos(b); await b.attendre(); b.lancerMinuteurs(); await b.attendre();
    assert.deepEqual(b.json("sonneries"), ["flash", "vibre", "bip"], nom);
    b.pont.presenteFin = false; b.pont.rendrePresence();   // bloquée : la réponse arrive après le délai
    b.lancerMinuteurs(); await b.attendre();
    assert.deepEqual(b.json("sonneries"), ["flash", "vibre", "bip"], `${nom} : une fois`);
  }
  const b = await chargerCarnet({ stockage: avecCtx(), pont: { presence: false } });
  b.evaluer(`validerSerie(${q(DC)})`); espionFin(b);
  finDuRepos(b); await b.attendre();
  assert.deepEqual(b.json("sonneries"), ["vibre", "bip", "flash"], "sans presence() : tout de suite");
});

test("fin passée page cachée (APK) : sonne sans sonner, même montre absente ; pas de seconde alerte au retour", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: { presente: false } });
  b.evaluer(`validerSerie(${q(DC)})`); espionFin(b);
  b.visibilite(false);
  finDuRepos(b);   // un tic qui tourne encore page cachée
  assert.equal(b.json("sonne"), true);
  assert.deepEqual(b.json("sonneries"), ["flash"]);
  b.visibilite(true); await b.attendre(); b.evaluer("majRepos()");
  assert.deepEqual(b.json("sonneries"), ["flash"]);
  // un nouveau repos, fini page visible : il sonne (sonne remis à false par le repos)
  b.evaluer(`validerSerie(${q(DC)})`); finDuRepos(b);
  assert.deepEqual(b.json("sonneries"), ["flash", "vibre", "bip", "flash"]);
});

test("fin passée page cachée sans aucun tic : constatée au retour à l'écran, elle ne sonne pas", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: { presente: false } });
  b.evaluer(`validerSerie(${q(DC)})`); espionFin(b);
  b.visibilite(false);
  b.evaluer(`Date.now = () => ${T0 + 151000}`);   // page endormie : aucun majRepos avant le retour
  b.visibilite(true); await b.attendre();
  assert.equal(b.json("sonne"), true);
  assert.deepEqual(b.json("sonneries"), ["flash"]);
});

test("page rechargée après la fin (notification touchée, activité détruite) : pas de sonnerie ; Chrome : comme en v1", async () => {
  const stockage = avecCtx({ "carnet:minuteur": { nom: DC, quoi: `${DC} · série 2/4 ensuite`, cible: "42,5 kg × 6",
    duree: 150, fin: T0 - 1000, restant: null, mode: "repos", impose: false, debut: T0 - 151000 } });
  const b = await chargerCarnet({ stockage, pont: { presente: false } });
  assert.equal(b.json("sonne"), true);
  assert.deepEqual(b.vibrations.filter(Array.isArray), []);
  const c = await chargerCarnet({ stockage });
  assert.equal(c.vibrations.filter(Array.isArray).length, 1);
});

test("service arrêté (programmerFin ok: false) : la fin passée page cachée sonne au retour, comme en v1", async () => {
  // déjà arrêté quand le repos est lancé
  const b = await chargerCarnet({ stockage: avecCtx(), pont: { presente: false } });
  b.pont.finOk = false;
  b.evaluer(`validerSerie(${q(DC)})`); await b.attendre(); espionFin(b);
  b.visibilite(false); b.evaluer(`Date.now = () => ${T0 + 151000}`);
  b.visibilite(true); await b.attendre();
  assert.deepEqual(b.json("sonneries"), ["vibre", "bip", "flash"]);
  // arrêté page cachée (« Arrêter » de sa notification) : la réponse du retour à l'écran le dit, la page sonne
  const c = await chargerCarnet({ stockage: avecCtx(), pont: { presente: false } });
  c.evaluer(`validerSerie(${q(DC)})`); await c.attendre(); espionFin(c);
  c.visibilite(false); c.pont.finOk = false; c.evaluer(`Date.now = () => ${T0 + 151000}`);
  c.visibilite(true); await c.attendre(); c.evaluer("majRepos()"); await c.attendre();
  assert.deepEqual(c.json("sonneries"), ["flash", "vibre", "bip"]);
  c.visibilite(false); c.visibilite(true); await c.attendre();   // une autre réponse ok: false : pas deux fois
  assert.deepEqual(c.json("sonneries"), ["flash", "vibre", "bip"]);
  // service en marche : rien au retour
  const d = await chargerCarnet({ stockage: avecCtx(), pont: { presente: false } });
  d.evaluer(`validerSerie(${q(DC)})`); await d.attendre(); espionFin(d);
  d.visibilite(false); d.evaluer(`Date.now = () => ${T0 + 151000}`);
  d.visibilite(true); await d.attendre();
  assert.deepEqual(d.json("sonneries"), ["flash"]);
});

test("notifications du Carnet refusées : un toast, une fois ; montre absente, la fin passée page cachée sonne au retour", async () => {
  const TOAST = "notifications du Carnet refusées : pas d'alerte de fin de repos écran éteint";
  const b = await chargerCarnet({ stockage: avecCtx(), pont: { presente: false } });
  b.evaluer("globalThis.toasts = []; toast = (t) => toasts.push(t)");
  b.pont.notifications = false;
  b.visibilite(false); b.visibilite(true); await b.attendre();   // relues au retour à l'écran
  assert.deepEqual(b.json("toasts"), [TOAST]);
  b.evaluer(`validerSerie(${q(DC)})`); espionFin(b);
  b.visibilite(false); b.evaluer(`Date.now = () => ${T0 + 151000}`);
  b.visibilite(true); await b.attendre();
  assert.deepEqual(b.json("sonneries"), ["vibre", "bip", "flash"]);
  assert.deepEqual(b.json("toasts"), [TOAST]);   // une fois
  // lues dès le démarrage ; montre présente, c'est elle qui a vibré : rien au retour
  const c = await chargerCarnet({ stockage: avecCtx(), pont: { notifications: false } });
  c.evaluer(`validerSerie(${q(DC)})`); espionFin(c);
  c.visibilite(false); c.evaluer(`Date.now = () => ${T0 + 151000}`);
  c.visibilite(true); await c.attendre();
  assert.deepEqual(c.json("sonneries"), ["flash"]);
  // démarrage, montre absente : la fin passée page cachée sonne au retour
  const d = await chargerCarnet({ stockage: avecCtx(), pont: { presente: false, notifications: false } });
  d.evaluer(`validerSerie(${q(DC)})`); espionFin(d);
  d.visibilite(false); d.evaluer(`Date.now = () => ${T0 + 151000}`);
  d.visibilite(true); await d.attendre();
  assert.deepEqual(d.json("sonneries"), ["vibre", "bip", "flash"]);
});

test("en pause, la fin figée ne compte pas : un −15 s qui épuise le restant après un retour à l'écran sonne", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: { presente: false } });
  b.evaluer(`validerSerie(${q(DC)}); minu.restant = 10; minu.fin = ${T0 - 60000}; garder()`); espionFin(b);
  b.visibilite(false); b.evaluer(`Date.now = () => ${T0 + 1000}`); b.visibilite(true); await b.attendre();
  assert.deepEqual(b.json("sonneries"), []);
  b.evaluer("ajusterRepos(-15)");
  assert.deepEqual(b.json("sonneries"), ["vibre", "bip", "flash"]);
});

test("programmerFin redonné au démarrage et au retour à l'écran (la fin meurt avec le service)", async () => {
  const stocke = (fin) => avecCtx({ "carnet:minuteur": { nom: DC, quoi: `${DC} · série 2/4 ensuite`, cible: "42,5 kg × 6",
    duree: 150, fin, restant: null, mode: "repos", impose: false, debut: fin - 150000 } });
  const b = await chargerCarnet({ stockage: stocke(T0 + 60000), pont: {} });
  assert.deepEqual(b.pont.fins, [{ fin: T0 + 60000, titre: TITRE, texte: TEXTE_DC }]);
  b.pont.vider();
  b.visibilite(false);
  assert.equal(b.pont.fins.length, 0);
  b.visibilite(true); await b.attendre();
  assert.deepEqual(b.pont.fins, [{ fin: T0 + 60000, titre: TITRE, texte: TEXTE_DC }]);
  // repos fini : rien à programmer, l'ancienne fin annulée
  const b2 = await chargerCarnet({ stockage: stocke(T0 - 1000), pont: {} });
  assert.deepEqual(b2.pont.fins.map((x) => x.fin), [null]);
  // sans repos : null au démarrage et au retour
  const b3 = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b3.visibilite(false); b3.visibilite(true); await b3.attendre();
  assert.deepEqual(b3.pont.fins.map((x) => x.fin), [null, null]);
});

test("Chrome : programmerFin jamais appelé, vibration et bip comme en v1, fin passée page cachée comprise", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`validerSerie(${q(DC)}); programmerFinPont()`); espionFin(b);
  finDuRepos(b);
  assert.deepEqual(b.json("sonneries"), ["vibre", "bip", "flash"]);
  // pas de notification native : la fin passée page cachée sonne au retour, comme en v1
  b.evaluer(`arreterRepos(); validerSerie(${q(DC)}); sonneries.length = 0`);
  b.visibilite(false); b.evaluer(`minu.fin = ${T0 - 1}`);
  b.visibilite(true); await b.attendre(); b.evaluer("majRepos()");
  assert.deepEqual(b.json("sonneries"), ["vibre", "bip", "flash"]);
  assert.equal(b.messagesSW.at(-1).repos, null);   // le service worker suit comme avant (repos fini : rien)
});

test("programmerFin rejeté : averti (console.warn), rien d'autre", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.evaluer(`globalThis.avertis = []; globalThis.console = { ...console, warn: (...a) => avertis.push(a.join(" ")) };
    Capacitor.Plugins.Montre.programmerFin = () => Promise.reject(new Error("MESSAGE_INVALIDE"));
    validerSerie(${q(DC)})`);
  await b.attendre();
  assert.ok(b.json("avertis").includes("fin de repos non programmée MESSAGE_INVALIDE"), b.json("avertis").join(" | "));
});

// ── Relecture finale de la branche.

test("en pause, montre présente : un −15 s qui épuise le restant fait sonner le téléphone (la montre ne finira pas)", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.evaluer(`validerSerie(${q(DC)}); pauseRepos(); minu.restant = 10; garder()`); espionFin(b);
  b.evaluer("ajusterRepos(-15)"); await b.attendre();
  assert.deepEqual(b.json("sonneries"), ["vibre", "bip", "flash"]);
  assert.ok(!b.pont.appels.includes("presence"));
  assert.equal(b.pont.envoyes.filter((x) => x.cle === "repos").at(-1).message.r.p, 0);
});

test("programmerFin ok: true après une fin laissée au natif : un service arrêté plus tard ne fait pas sonner ce repos", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: { presente: false } });
  b.evaluer(`validerSerie(${q(DC)})`); await b.attendre(); espionFin(b);
  b.visibilite(false); b.evaluer(`Date.now = () => ${T0 + 151000}`);
  b.visibilite(true); await b.attendre();   // le natif a notifié (ok: true)
  assert.deepEqual(b.json("sonneries"), ["flash"]);
  assert.equal(b.json("pontTu"), null);
  b.visibilite(false); b.pont.finOk = false; b.visibilite(true); await b.attendre();
  assert.deepEqual(b.json("sonneries"), ["flash"]);
});

test("programmerFin rejeté : pontFinOk passe à false (rien ne sera notifié)", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.evaluer(`globalThis.console = { ...console, warn() {} };
    Capacitor.Plugins.Montre.programmerFin = () => Promise.reject(new Error("MESSAGE_INVALIDE"));
    validerSerie(${q(DC)})`);
  await b.attendre();
  assert.equal(b.json("pontFinOk"), false);
});

test("APK plus ancienne, sans programmerFin, acquitter ni presence : rien ne plante, la page sonne comme en v1", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }),
    pont: { sans: ["programmerFin", "acquitter", "presence"] } }); await b.attendre();
  b.evaluer(`globalThis.avertis = []; globalThis.console = { ...console, warn: (...a) => avertis.push(a.join(" ")) }`);
  b.evaluer(`validerSerie(${q(DC)})`); await b.attendre(); espionFin(b);
  assert.equal(b.json("minu.fin"), T0 + 150000);
  // fin passée page cachée : aucune notification native possible, la page sonne au retour
  b.visibilite(false); b.evaluer(`Date.now = () => ${T0 + 151000}`);
  b.visibilite(true); await b.attendre();
  assert.deepEqual(b.json("sonneries"), ["vibre", "bip", "flash"]);
  // un geste de la montre est appliqué, sans acquittement possible
  b.evaluer("arreterRepos()");
  b.pont.recevoir({ type: "geste", n: 1794330342, ts: T0, g: "plus1", nom: DC }); await b.attendre(); await b.attendre();
  assert.equal(b.json(`saisie[${q(DC)}].extra`), 1);
  assert.ok(!b.json("avertis").some((t) => /réception de la montre/.test(t)), b.json("avertis").join(" | "));
});

test("etat() rejeté au retour à l'écran : averti (console.warn)", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} });
  b.evaluer(`globalThis.avertis = []; globalThis.console = { ...console, warn: (...a) => avertis.push(a.join(" ")) };
    Capacitor.Plugins.Montre.etat = () => Promise.reject(new Error("KIT_INDISPONIBLE"))`);
  b.visibilite(false); b.visibilite(true); await b.attendre();
  assert.ok(b.json("avertis").includes("état du pont non lu KIT_INDISPONIBLE"), b.json("avertis").join(" | "));
});
