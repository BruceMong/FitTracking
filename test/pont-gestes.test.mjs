// Les gestes de la montre reçus par le pont de l'APK (prendreMessages, puis acquitter) : appliqués avec les
// fonctions du carnet, à l'heure du geste, une seule fois (n gardé dans carnet:montre-dg), sans écho.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet, deplier } from "./banc.mjs";
import { JOUR, DC, TRI, ELE, avecCtx, appui } from "./fixtures.mjs";

const q = JSON.stringify;
const ID0 = `${JOUR}|${DC}|0`, ID1 = `${JOUR}|${DC}|1`;
const TS = appui(0).ts * 1000;   // 16:58, deux minutes avant l'heure du banc (17:00)
const N = 1794330342;
const geste = (n, g, plus = {}) => ({ type: "geste", n, ts: TS, g, ...plus });
const dernier = (b, cle) => b.pont.envoyes.filter((x) => x.cle === cle).at(-1)?.message;
const series = (b) => b.json(`seanceDuJour().exos.find((e) => e.nom === ${q(DC)})?.series ?? []`);

// Le carnet dans l'APK, montre présente ; l'état de départ est déjà parti (vidé).
async function carnet(plus = {}) {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {}, ...plus });
  await b.attendre(); b.pont.vider();
  return b;
}
const recevoir = async (b, ...ms) => { for (const m of ms) b.pont.recevoir(m); await b.attendre(); await b.attendre(); };
// Toasts espionnés (le #toast du banc ne garde que le dernier).
const espionToasts = (b) => b.evaluer("globalThis.toasts = []; toast = (t) => toasts.push(t)");

test("appui de la montre : série telle que faite, repos calé sur l'heure du geste, réserve demandée", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} }); b.pont.vider();
  b.pont.recevoir(geste(N, "appui", { a: appui(0, { c: 45, r: 5 }) })); await b.attendre();
  assert.deepEqual(b.json(`seanceDuJour().exos[0].series`), [{ c: 45, r: 5, t: "16:58:00", m: ID0 }]);
  assert.deepEqual(b.json(`[minu.fin, minu.debut, minu.appui, minu.appli]`), [TS + 150000, TS, ID0, true]);
  assert.deepEqual(b.json("minu.effort"), { nom: DC, i: 0, vise: 6 });
  const r = b.pont.envoyes.filter((x) => x.cle === "repos").at(-1).message;
  assert.deepEqual([r.dg, r.fait, r.r.id, r.r.fin], [N, ID0, TS, TS + 150000]);
  assert.deepEqual(b.pont.acquis, [1]);
  assert.equal(b.stockage()["carnet:montre-dg"], N);
});

test("geste_rejoue_apres_rechargement : appliqué une fois", async () => {
  const g = geste(N, "appui", { a: appui(0) });
  const b = await carnet();
  await recevoir(b, g);
  assert.equal(series(b).length, 1);
  // La page rechargée avant l'acquittement : le pont rend encore le même geste.
  const b2 = await chargerCarnet({ stockage: b.stockage(), pont: { messages: [g] } }); await b2.attendre();
  assert.equal(series(b2).length, 1);
  assert.deepEqual(b2.pont.acquis, [1]);   // pris quand même : il ne reviendra plus
  assert.equal(b2.json(`appliquerGeste(${q(g)})`), "doublon");
  assert.equal(series(b2).length, 1);
});

test("appui_pont_puis_base : une série, pas de toast « déjà noté »", async () => {
  const etat = { appuis: [] };
  const b = await carnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }),
    reponses: { carnet_montre_appuis: () => etat.appuis } });
  espionToasts(b);
  await recevoir(b, geste(N, "appui", { a: appui(0) }));
  etat.appuis = [{ id: 1, appui: appui(0), recu: "2026-11-09T15:58:01Z" }];
  await b.evaluer("integrerAppuis()"); await b.attendre();
  assert.equal(series(b).length, 1);
  assert.ok(!b.json("toasts").some((t) => /déjà/.test(t)), b.json("toasts").join(" | "));
});

test("appui_tardif_sans_repos : geste de 16:50, repos fini : série notée, pas de minuteur", async () => {
  const ts = Date.parse("2026-11-09T16:50:00+01:00");
  const b = await carnet();
  await recevoir(b, { ...geste(N, "appui", { a: appui(0, { t: "16:50:00", ts: ts / 1000 }) }), ts });
  assert.deepEqual(series(b).map((s) => s.t), ["16:50:00"]);
  assert.equal(b.json("minu"), null);
});

test("le repos part de l'heure du geste (ts, en ms), pas de celle de l'appui", async () => {
  const b = await carnet();
  await recevoir(b, { ...geste(N, "appui", { a: appui(0) }), ts: TS + 4500 });
  assert.deepEqual(b.json("[minu.debut, minu.fin]"), [TS + 4500, TS + 154500]);
});

test("premier_appui_hors_ligne : lecture du serveur ratée, aucune séance ici : noté quand même", async () => {
  const b = await carnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }),
    reponses: { carnet_lire: () => { throw { status: 503, message: "indisponible" }; } } });
  assert.equal(b.json("luServeur"), false);
  await recevoir(b, geste(N, "appui", { a: appui(0) }));
  assert.equal(series(b).length, 1);
  assert.equal(b.json("minu.appui"), ID0);
});

test("annuler : la série de l'appui retirée et son repos arrêté", async () => {
  const b = await carnet(); espionToasts(b);
  await recevoir(b, geste(N, "appui", { a: appui(0) }));
  await recevoir(b, geste(N + 1, "annuler", { id: ID0 }));
  assert.deepEqual(b.json("seanceDuJour().exos"), []);
  assert.equal(b.json("minu"), null);
  assert.deepEqual(b.json("toasts"), ["Montre : série annulée"]);
  assert.equal(dernier(b, "repos").r, null);
  assert.equal(deplier(dernier(b, "plan"))[0].id, ID0);   // la série est de nouveau à faire
});

test("+15, −15, pause et reprendre à l'heure du geste", async () => {
  const b = await carnet();
  await recevoir(b, geste(N, "appui", { a: appui(0) }));
  await recevoir(b, geste(N + 1, "plus15"), geste(N + 2, "plus15"), geste(N + 3, "moins15"));
  assert.equal(b.json("minu.fin"), TS + 165000);
  await recevoir(b, { ...geste(N + 4, "pause"), ts: TS + 65000 });
  assert.equal(b.json("minu.restant"), 100);
  assert.equal(dernier(b, "repos").r.p, 100000);
  await recevoir(b, { ...geste(N + 5, "reprendre"), ts: TS + 75000 });
  assert.deepEqual(b.json("[minu.fin, minu.restant]"), [TS + 175000, null]);
  assert.deepEqual([dernier(b, "repos").dg, dernier(b, "repos").r.fin], [N + 5, TS + 175000]);
});

test("passer : repos arrêté, la suite ouverte ; le repos envoyé à la montre devient null", async () => {
  const b = await carnet();
  await recevoir(b, geste(N, "appui", { a: appui(0) }));
  b.evaluer("ouvert = null");
  await recevoir(b, geste(N + 1, "passer"));
  assert.equal(b.json("minu"), null);
  assert.equal(b.json("ouvert"), DC);
  assert.deepEqual([dernier(b, "repos").dg, dernier(b, "repos").r], [N + 1, null]);
  assert.equal(deplier(dernier(b, "plan"))[0].id, ID1);
});

test("régler : la ligne prévue suit, le plan renvoyé porte la charge", async () => {
  const b = await carnet();
  await recevoir(b, geste(N, "regler", { nom: DC, k: 0, ech: false, champ: "c", v: 45 }));
  const m = dernier(b, "plan");
  assert.equal(m.e[0][2], 45);
  assert.equal(deplier(m)[0].txt, "45 kg × 6");
  assert.equal(m.dg, N);
  assert.deepEqual(series(b), []);   // une ligne prévue : rien de noté
});

test("réserve après un appui : @N sur la série, le repos renvoyé le porte", async () => {
  const b = await carnet();
  await recevoir(b, geste(N, "appui", { a: appui(0) }));
  await recevoir(b, geste(N + 1, "reserve", { nom: DC, k: 0, e: 2 }));
  assert.equal(series(b)[0].e, 2);
  assert.deepEqual(dernier(b, "repos").r.ef, { nom: DC, k: 0, e: 2 });
  assert.equal(b.stockage()["carnet:seance:2026-11-09"].doc.exos[0].series[0].e, 2);   // sauvé
});

test("+ une série : le plan renvoyé a une étape de plus", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: {} }); await b.attendre();
  const avant = dernier(b, "plan");
  assert.deepEqual([avant.e.length, avant.x[0][1]], [10, 4]);
  b.pont.vider();
  await recevoir(b, geste(N, "plus1", { nom: DC }));
  const apres = dernier(b, "plan");
  assert.deepEqual([apres.e.length, apres.x[0][1]], [11, 5]);
});

test("autre exercice, séance vierge sans repos : le plan renvoyé part de TRI", async () => {
  const b = await carnet();
  assert.equal(b.json("exoGrand()"), DC);
  await recevoir(b, geste(N, "exo", { nom: DC, sens: 1 }));
  assert.equal(deplier(dernier(b, "plan"))[0].nom, TRI);
});

test("gestes_perimes_ignores : dg avance, l'état repart, rien d'autre", async () => {
  // Les verdicts, un par un.
  const b = await carnet();
  const v = (n, g, plus) => b.json(`appliquerGeste(${q(geste(n, g, plus))})`);
  assert.equal(v(N, "passer"), "ignore");                        // sans repos
  assert.equal(v(N + 1, "plus15"), "ignore");
  assert.equal(v(N + 2, "moins15"), "ignore");
  assert.equal(v(N + 3, "pause"), "ignore");
  assert.equal(v(N + 4, "reprendre"), "ignore");
  assert.equal(v(N + 5, "exo", { nom: TRI, sens: 1 }), "ignore");   // la montre affiche TRI, le carnet propose DC
  assert.equal(b.json("exoGrand()"), DC);
  b.evaluer(`validerSerie(${q(DC)})`);
  assert.equal(v(N + 6, "regler", { nom: DC, k: 0, ech: false, champ: "c", v: 50 }), "ignore");   // ligne faite
  assert.equal(series(b)[0].c, 42.5);
  assert.equal(v(N + 7, "regler", { nom: DC, k: 9, ech: false, champ: "c", v: 50 }), "ignore");   // ligne absente
  assert.equal(v(N + 8, "plus1", { nom: "Inconnu" }), "ignore");
  assert.equal(b.json(`"Inconnu" in saisie`), false);
  assert.equal(v(N + 9, "reserve", { nom: DC, k: 3, e: 1 }), "ignore");   // série pas faite
  assert.equal(v(N + 10, "annuler", { id: "2026-11-09|Inconnu|0" }), "ignore");
  assert.equal(v(N + 11, "appui", { a: appui(0) }), "ignore");   // rang déjà noté au téléphone
  assert.equal(series(b).length, 1);
  assert.equal(b.json(`appliquerGeste(${q({ type: "geste", n: N + 20, ts: TS, g: "voler" })})`), "invalide");
  assert.equal(b.json("appliquerGeste(null)"), "invalide");
  assert.equal(b.json("pontDg"), N + 11);   // un illisible ne touche pas dg
  assert.equal(v(N + 11, "plus15"), "doublon");
  assert.equal(v(N + 12, "regler", { nom: "Inconnu", k: 0, ech: false, champ: "c", v: 50 }), "ignore");
  assert.equal(b.json(`"Inconnu" in saisie`), false);
  // pendant le repos de DC, l'exercice du repos l'emporte : « exo » serait sans effet, il est ignoré
  b.evaluer("ouvert = " + q(DC));
  assert.equal(v(N + 13, "exo", { nom: DC, sens: 1 }), "ignore");
  assert.equal(b.json("ouvert"), DC);
  // repos fini en écran de fin (dernier exercice) : pas de repos à passer
  b.evaluer(`minu = { nom: ${q(DC)}, quoi: "", cible: "", duree: 0, fin: 0, restant: null, mode: "fin", debut: Date.now() }`);
  assert.equal(v(N + 14, "passer"), "ignore");
  assert.equal(b.json("minu.mode"), "fin");
  // enchaînement de superset : pas de flèches au grand format
  b.evaluer(`arreterRepos(); validerSerie(${q(TRI)})`);
  assert.deepEqual(b.json("[minu.mode, exoGrand()]"), ["superset", ELE]);
  assert.equal(v(N + 15, "exo", { nom: ELE, sens: 1 }), "ignore");
  assert.equal(b.json("exoGrand()"), ELE);

  // Par le pont : chaque geste ignoré fait repartir le repos avec le nouveau dg (la montre sait qu'il est pris).
  const p = await carnet();
  await recevoir(p, geste(N, "passer"));
  assert.deepEqual([dernier(p, "repos").dg, dernier(p, "repos").r], [N, null]);
  await recevoir(p, geste(N + 1, "exo", { nom: TRI, sens: 1 }), { type: "geste", n: N + 2, g: "plus15" });   // sans ts : illisible
  assert.equal(dernier(p, "repos").dg, N + 1);
  assert.equal(p.json("pontDg"), N + 1);
  assert.equal(p.pont.envoyes.filter((x) => x.cle === "plan").length, 0);   // rien n'a changé du plan
  assert.deepEqual(p.pont.acquis, [1, 3]);
});

test("bonjour : plan puis repos, forcés", async () => {
  const b = await carnet();
  b.evaluer("dessiner(); garder()");
  assert.equal(b.pont.envoyes.length, 0);   // rien de changé depuis le dernier envoi…
  await recevoir(b, { type: "bonjour" });
  // … mais la montre qui s'ouvre a pu perdre ce qui est parti pendant qu'elle était fermée (SUCCESS sans lecture)
  assert.deepEqual(b.pont.envoyes.map((x) => x.cle), ["plan", "repos"]);
  assert.deepEqual(b.pont.acquis, [1]);
});

test("un geste qui lève : écarté, les suivants appliqués, tout acquitté", async () => {
  const b = await carnet();
  await recevoir(b, geste(N, "appui", { a: appui(0) }));
  b.evaluer(`globalThis.avertis = []; globalThis.console = { ...console, warn: (...a) => avertis.push(a.join(" ")) };
    ajusterRepos = () => { throw new Error("panne d'essai"); };`);
  await recevoir(b, geste(N + 1, "plus15"), { ...geste(N + 2, "pause"), ts: TS + 65000 });
  assert.equal(b.json("minu.restant"), 85);    // la pause est passée ; +15 n'a rien fait
  assert.equal(b.json("minu.fin"), TS + 150000);
  assert.deepEqual(b.pont.acquis, [1, 3]);
  assert.equal(b.json("pontDg"), N + 2);
  assert.equal(b.json("avertis").length, 1);
  assert.match(b.json("avertis")[0], /panne d'essai/);
  // rejoué (page rechargée), il ne lèverait plus : il compte comme pris
  assert.equal(b.json(`appliquerGeste(${q(geste(N + 1, "plus15"))})`), "doublon");
  // le dernier de la file lève : dg (gardé) est le sien quand même
  await recevoir(b, geste(N + 3, "moins15"));
  assert.deepEqual([b.json("pontDg"), b.stockage()["carnet:montre-dg"]], [N + 3, N + 3]);
  assert.deepEqual(b.pont.acquis, [1, 3, 4]);
});

test("une réception à la fois : un appel pendant une réception la relance une fois à la fin", async () => {
  const b = await carnet();
  const prises = () => b.pont.appels.filter((x) => x === "prendreMessages").length;
  const avant = prises();
  b.evaluer("recevoirPont(); recevoirPont(); recevoirPont()");
  await b.attendre(); await b.attendre();
  assert.equal(prises() - avant, 2);
});

test("démarrage : les écouteurs messages et connexion avant etat() et prendreMessages()", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(), pont: { messages: [geste(N, "plus1", { nom: DC })] } });
  await b.attendre();
  const a = b.pont.appels;
  assert.ok(a.indexOf("addListener:messages") >= 0);
  assert.ok(a.indexOf("addListener:messages") < a.indexOf("etat"));
  assert.ok(a.indexOf("addListener:messages") < a.indexOf("prendreMessages"));
  assert.equal(b.json("pontDg"), N);   // le geste en attente au démarrage est pris
  assert.deepEqual(b.pont.acquis, [1]);
});

test("la réception attend la lecture du serveur en cours (au plus 3 s)", async () => {
  let rendre;
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }), pont: {},
    reponses: { carnet_lire: () => new Promise((ok) => { rendre = () => ok({ contexte: null, seances: [] }); }) } });
  await b.attendre();
  await recevoir(b, geste(N, "appui", { a: appui(0) }));
  assert.equal(series(b).length, 0);   // la lecture n'a pas encore répondu
  rendre(); await b.attendre(); await b.attendre();
  assert.equal(series(b).length, 1);
  // une lecture qui ne répond jamais : au bout de 3 s, la réception passe quand même
  b.evaluer(`chargement = new Promise(() => {})`);
  b.pont.recevoir(geste(N + 1, "plus1", { nom: DC })); await b.attendre();
  assert.equal(b.json("pontDg"), N);
  b.lancerMinuteurs(); await b.attendre(); await b.attendre();
  assert.equal(b.json("pontDg"), N + 1);
});

// ── Décisions du contrôleur (relecture de la tâche 4).

test("route de la base : le repos lancé par l'appui porte son id, annulerAppui l'arrête", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }),
    reponses: { carnet_montre_appuis: () => [{ id: 7, appui: appui(0), recu: "2026-11-09T15:58:01Z" }] } });
  await b.attendre();
  assert.equal(b.json("minu.appui"), ID0);
  assert.equal(b.json(`annulerAppui(${q(ID0)})`), true);
  assert.equal(b.json("minu"), null);
  assert.deepEqual(b.json("seanceDuJour().exos"), []);
});

test("annuler ne vise que le dernier appui noté de son exercice", async () => {
  const b = await carnet();
  await recevoir(b, geste(N, "appui", { a: appui(0) }), { ...geste(N + 1, "appui", { a: appui(1, { t: "16:59:00", ts: appui(1).ts + 60 }) }), ts: TS + 60000 });
  assert.equal(series(b).length, 2);
  assert.equal(b.json(`dernierAppui(${q(ID0)})`), false);
  assert.equal(b.json(`appliquerGeste(${q(geste(N + 2, "annuler", { id: ID0 }))})`), "ignore");
  assert.deepEqual(series(b).map((s) => s.m), [ID0, ID1]);
  assert.equal(b.json("minu.appui"), ID1);
  assert.equal(b.json(`appliquerGeste(${q(geste(N + 3, "annuler", { id: ID1 }))})`), "applique");
  assert.deepEqual(series(b).map((s) => s.m), [ID0]);
  // une série notée au téléphone après l'appui ne l'empêche pas : c'est encore le dernier appui
  b.evaluer(`validerSerie(${q(DC)})`);
  assert.equal(b.json(`appliquerGeste(${q(geste(N + 4, "annuler", { id: ID0 }))})`), "applique");
  assert.deepEqual(series(b).map((s) => s.m ?? null), [null]);
  // échauffement marqué puis série marquée : l'échauffement n'est plus le dernier appui
  b.evaluer(`seanceDuJour().exos[0].ech = [{ c: 20, r: 10, t: "16:50:00", m: "e" }]; seanceDuJour().exos[0].series[0].m = "s"`);
  assert.equal(b.json(`dernierAppui("e")`), false);
  assert.equal(b.json(`dernierAppui("s")`), true);
});

test("appui annulé rendu plus tard par la base : pas noté ; la série refaite (même id, autre ts) l'est", async () => {
  const etat = { appuis: [] };
  const b = await carnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }),
    reponses: { carnet_montre_appuis: () => etat.appuis } });
  await recevoir(b, geste(N, "appui", { a: appui(0) }), geste(N + 1, "annuler", { id: ID0 }));
  assert.deepEqual(series(b), []);
  assert.deepEqual(b.stockage()["carnet:montre-annules:2026-11-09"], [{ id: ID0, ts: appui(0).ts }]);
  etat.appuis = [{ id: 1, appui: appui(0), recu: "2026-11-09T15:58:01Z" }];
  await b.evaluer("integrerAppuis()"); await b.attendre();
  assert.deepEqual(series(b), []);
  assert.equal(b.stockage()["carnet:montre-appui"], 1);   // pris : le curseur avance
  const refaite = appui(0, { t: "16:59:40", ts: appui(0).ts + 100 });
  etat.appuis = [{ id: 2, appui: refaite, recu: "2026-11-09T15:59:41Z" }];
  await b.evaluer("integrerAppuis()"); await b.attendre();
  assert.deepEqual(series(b), [{ c: 42.5, r: 6, t: "16:59:40", m: ID0 }]);
  // annulée à son tour, c'est son ts qui est gardé
  await recevoir(b, geste(N + 2, "annuler", { id: ID0 }));
  assert.deepEqual(b.stockage()["carnet:montre-annules:2026-11-09"],
    [{ id: ID0, ts: appui(0).ts }, { id: ID0, ts: refaite.ts }]);
});

test("les annulations des jours passés sont effacées, comme les autres clés du jour", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({
    "carnet:montre-annules:2026-11-08": [{ id: `2026-11-08|${DC}|0`, ts: 1 }],
    "carnet:montre-notes:2026-11-08": { [`2026-11-08|${DC}|0`]: 1 },
    "carnet:montre-annules:2026-11-09": [{ id: ID0, ts: 1 }] }), pont: {} });
  const s = b.stockage();
  assert.equal(s["carnet:montre-annules:2026-11-08"], undefined);
  assert.equal(s["carnet:montre-notes:2026-11-08"], undefined);
  assert.deepEqual(s["carnet:montre-annules:2026-11-09"], [{ id: ID0, ts: 1 }]);
});

test("après annulerAppui : état complet renvoyé, fait remis à null s'il visait l'appui annulé", async () => {
  const b = await carnet();
  await recevoir(b, geste(N, "appui", { a: appui(0) }));
  // un repos qui n'est pas celui de l'appui (il reste), et fait qui vise encore l'appui
  b.evaluer(`minu.appui = "autre"; pontFait = ${q(ID0)}`); b.pont.vider();
  assert.equal(b.json(`annulerAppui(${q(ID0)})`), true);
  assert.deepEqual(b.pont.envoyes.map((x) => x.cle), ["repos", "plan", "repos"]);   // réserve retirée, puis l'état
  assert.ok(b.pont.envoyes.filter((x) => x.cle === "repos").every((x) => x.message.fait === null));
  assert.equal(deplier(dernier(b, "plan"))[0].id, ID0);
  assert.equal(b.json("pontFait"), null);
  // fait qui vise une autre étape : pas touché avant le plan (qui, lui, le remet à null comme toujours)
  await recevoir(b, { ...geste(N + 1, "appui", { a: appui(0, { t: "16:59:00", ts: appui(0).ts + 60 }) }), ts: TS + 60000 });
  b.evaluer(`pontFait = "ailleurs"`); b.pont.vider();
  assert.equal(b.json(`annulerAppui(${q(ID0)})`), true);
  assert.equal(b.pont.envoyes[0].message.fait, "ailleurs");
  assert.deepEqual(b.pont.envoyes.slice(-2).map((x) => [x.cle, x.message.fait ?? null]), [["plan", null], ["repos", null]]);
});

test("sans pont (Chrome) : ni écouteur, ni réception, rien d'écrit pour la montre", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }),
    reponses: { carnet_montre_appuis: () => [{ id: 7, appui: appui(0), recu: "2026-11-09T15:58:01Z" }] } });
  await b.attendre();
  assert.equal(series(b).length, 1);
  assert.equal(await b.evaluer("recevoirPont()"), undefined);
  assert.deepEqual(Object.keys(b.stockage()).filter((k) => /montre-(dg|notes|annules)/.test(k)), []);
});
