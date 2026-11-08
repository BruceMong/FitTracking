// Les appuis de l'appli montre, relus de la base et intégrés à la séance : la série telle que faite, à l'heure
// de l'appui, la garde anti-doublon (m), le repos du téléphone calé sur la montre et sans notification de fin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { JOUR, DC, TRI, ELE, avecCtx, enCours, appui } from "./fixtures.mjs";

const q = JSON.stringify;
const liste = (...as) => as.map((appui, i) => ({ id: 7 + i, appui, recu: "2026-11-09T15:58:01Z" }));
const banc = (stockage, as) => chargerCarnet({
  stockage: avecCtx({ "carnet:cle": "cle-essai", ...stockage }),
  reponses: { carnet_montre_appuis: () => liste(...as) },
});

test("un appui est noté tel que fait, à son heure", async () => {
  const b = await banc({}, [appui(0, { c: 40, r: 5 })]); await b.attendre();
  assert.deepEqual(b.json("seanceDuJour().exos.find((e) => e.nom === " + q(DC) + ").series"),
    [{ c: 40, r: 5, t: "16:58:00", m: "2026-11-09|Développé couché guidé|0" }]);
  assert.equal(b.stockage()["carnet:montre-appui"], 7);
  assert.deepEqual(b.appels.find((x) => x.fonction === "carnet_montre_appuis").corps.p_depuis, 0);
  assert.ok(b.stockage()["carnet:seance:2026-11-09"].sale);
});
test("repos calé sur la montre, sans notification de fin", async () => {
  const b = await banc({}, [appui(0)]); await b.attendre();
  assert.equal(b.json("minu.fin"), (appui(0).ts + 150) * 1000);
  assert.equal(b.json("minu.appli"), true);
  assert.equal(b.messagesSW.at(-1).repos, null);
});
test("repos_deja_passe", async () => {
  const b = await banc({}, [appui(0, { t: "16:50:00", ts: Date.parse("2026-11-09T16:50:00+01:00") / 1000 })]); await b.attendre();
  assert.equal(b.json("minu"), null);
  assert.equal(b.messagesSW.at(-1)?.repos ?? null, null);
});
test("appui_deja_integre_ignore", async () => {
  const deja = enCours([{ c: 40, r: 5, t: "16:58:00", m: "2026-11-09|Développé couché guidé|0" }]);
  const b = await banc(deja, [appui(0)]); await b.attendre();
  assert.equal(b.json("seanceDuJour().exos[0].series.length"), 1);
  assert.match(b.journalMontre().at(-1).quoi, /déjà intégré/);
});
test("rang déjà noté au téléphone : journalisé « déjà noté »", async () => {
  const b = await banc(enCours([{ c: 42.5, r: 6, t: "16:57:00" }]), [appui(0)]); await b.attendre();
  assert.equal(b.json("seanceDuJour().exos[0].series.length"), 1);
  assert.equal(b.journalMontre().at(-1).quoi, "appli montre : déjà noté : Développé couché guidé, série 1/4");
});
test("reprise après le dernier id lu, appuis appliqués dans l'ordre", async () => {
  const b = await banc({ "carnet:montre-appui": 6 }, [appui(0), appui(1, { r: 5 })]); await b.attendre();
  assert.equal(b.appels.find((x) => x.fonction === "carnet_montre_appuis").corps.p_depuis, 6);
  assert.deepEqual(b.json("seanceDuJour().exos[0].series.map((s) => s.r)"), [6, 5]);
  assert.equal(b.stockage()["carnet:montre-appui"], 8);
});
test("échauffement de la montre : ligne é notée, saisie suivie", async () => {
  const sai = { "carnet:saisie:2026-11-09": { [DC]: { edits: { 0: { c: 45, r: 6 } }, extra: 0, ech: 1, echEdits: {} } } };
  const b = await banc(sai, [appui(0, { id: `2026-11-09|${DC}|e0`, ech: true, c: 20, r: 10, quand: "échauffement" })]); await b.attendre();
  assert.deepEqual(b.json("seanceDuJour().exos[0].ech"), [{ c: 20, r: 10, t: "16:58:00", m: `2026-11-09|${DC}|e0` }]);
  assert.equal(b.json(`saisie[${q(DC)}].ech`), 0);
  assert.deepEqual(b.json(`saisie[${q(DC)}].edits`), { 0: { c: 45, r: 6 } });
});
test("la série prévue réglée au téléphone est consommée par l'appui", async () => {
  const sai = { "carnet:saisie:2026-11-09": { [DC]: { edits: { 0: { c: 45, r: 6 } }, extra: 0, ech: 0, echEdits: {} } } };
  const b = await banc(sai, [appui(0, { c: 45 })]); await b.attendre();
  assert.deepEqual(b.json(`saisie[${q(DC)}].edits`), {});
});
test("appui_d_un_autre_jour : séance de la veille, à envoyer, sans repos", async () => {
  const hier = appui(0, { id: `2026-11-08|${DC}|0`, jour: "2026-11-08", ts: Date.parse("2026-11-08T18:00:00+01:00") / 1000 });
  const b = await banc({}, [hier]); await b.attendre();
  const envoi = b.appels.find((x) => x.fonction === "carnet_ecrire" && x.corps.p_jour === "2026-11-08");
  assert.deepEqual(envoi.corps.p_doc.exos[0].series, [{ c: 42.5, r: 6, t: "16:58:00", m: `2026-11-08|${DC}|0` }]);
  assert.equal(envoi.corps.p_doc.type, "push");
  assert.equal(b.stockage()["carnet:seance:2026-11-08"].doc.exos[0].series.length, 1);
  assert.equal(b.json("seanceDuJour().exos.length"), 0);
  assert.equal(b.json("minu"), null);
});
test("integrations_concurrentes : un seul appel, une seule série", async () => {
  const b = await banc({}, [appui(0)]); await b.attendre();
  b.evaluer(`localStorage.removeItem("carnet:montre-appui")`);
  const lus = () => b.appels.filter((x) => x.fonction === "carnet_montre_appuis").length, avant = lus();
  await Promise.all([b.evaluer("integrerAppuis()"), b.evaluer("integrerAppuis()")]);
  assert.equal(lus(), avant + 1);
  assert.equal(b.json("seanceDuJour().exos[0].series.length"), 1);
});
test("après charger : appuis intégrés avant la publication, le plan les a retirés", async () => {
  const b = await banc({}, [appui(0)]); await b.attendre();
  const f = b.appels.map((x) => x.fonction);
  assert.ok(f.indexOf("carnet_montre_appuis") < f.lastIndexOf("carnet_montre_publier"));
  const p = b.appels.filter((x) => x.fonction === "carnet_montre_publier").at(-1).corps.p_plan;
  assert.equal(p.etapes[0].id, "2026-11-09|Développé couché guidé|1");
});
test("un repos né au téléphone garde sa notification", async () => {
  const b = await banc({}, []); await b.attendre();
  b.evaluer(`validerSerie(${q(DC)})`);
  assert.equal(b.messagesSW.at(-1).repos, b.json("minu.fin"));
});
test("chaque charger republie le plan une fois, même inchangé (le dernier appareil réveillé fait foi)", async () => {
  const b = await banc({}, []); await b.attendre();
  const pubs = () => b.appels.filter((x) => x.fonction === "carnet_montre_publier").length;
  assert.equal(pubs(), 1);
  await b.evaluer("charger()"); await b.attendre();
  assert.equal(pubs(), 2);
});

// ── Séance du serveur et appuis : l'intégration ne travaille jamais sur une copie périmée.
const HIER = "2026-11-08";
const hier = () => appui(0, { id: `${HIER}|${DC}|0`, jour: HIER, ts: Date.parse("2026-11-08T18:00:00+01:00") / 1000 });
const duJourServeur = { jour: JOUR, type: "push", exos: [{ nom: DC, series: [{ c: 42.5, r: 6, t: "16:55:00" }] }], note: "",
  maj: "2026-11-09T15:55:30.000Z" };
const hierServeur = { jour: HIER, type: "push", exos: [{ nom: TRI, series: [{ c: 20, r: 12, t: "18:40:00" }] }], note: "",
  maj: "2026-11-08T17:41:00.000Z" };
// Une réponse qui met n tours : carnet_lire plus lent que carnet_montre_appuis, la lecture du serveur arrive
// après les appuis.
const lent = (f, n) => async () => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); return f(); };
// Un appareil B qui a déjà lu le serveur (rien ce jour-là), puis, pendant qu'il dort, un appareil A écrit au
// serveur et la montre envoie un appui. Retour dans l'appli : focus et visibilitychange presque ensemble.
const appareilB = async () => {
  const etat = { seances: [], appuis: [] };
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }),
    reponses: { carnet_lire: lent(() => ({ contexte: null, seances: etat.seances }), 8), carnet_montre_appuis: lent(() => liste(...etat.appuis), 3) } });
  await b.attendre();
  return { b, etat };
};
const fin = async (b) => { for (let i = 0; i < 3; i++) await b.attendre(); b.lancerMinuteurs(); await b.attendre(); };
// Le focus d'abord (relève des appuis), puis visibilitychange (charger).
const course = async (seances, as) => {
  const { b, etat } = await appareilB();
  etat.seances = seances; etat.appuis = as;
  b.evaluer("relireMontre(); integrerAppuis(); charger();");
  await fin(b);
  return b;
};
const envoiDe = (b, j) => b.appels.filter((x) => x.fonction === "carnet_ecrire" && x.corps.p_jour === j).at(-1)?.corps.p_doc;

test("course focus / charger : l'appui s'ajoute à la séance du jour lue au serveur, sans l'écraser", async () => {
  const b = await course([duJourServeur], [appui(1)]);
  assert.deepEqual(envoiDe(b, JOUR).exos[0].series.map((s) => s.t), ["16:55:00", "16:58:00"]);
  assert.deepEqual(b.json("seanceDuJour().exos[0].series.map((s) => s.t)"), ["16:55:00", "16:58:00"]);
});
test("course : charger part pendant la relève des appuis, l'intégration attend sa lecture", async () => {
  const { b, etat } = await appareilB();
  etat.seances = [duJourServeur]; etat.appuis = [appui(1)];
  b.evaluer("integrerAppuis()");
  await new Promise((r) => setImmediate(r));
  b.evaluer("charger()");
  await fin(b);
  assert.deepEqual(envoiDe(b, JOUR).exos[0].series.map((s) => s.t), ["16:55:00", "16:58:00"]);
});
test("course focus / charger : un autre jour absent ici mais lu au serveur y est complété", async () => {
  const b = await course([hierServeur], [hier()]);
  assert.deepEqual(envoiDe(b, HIER).exos.map((e) => e.nom), [TRI, DC]);
});
test("copie locale d'un autre jour, envoyée mais plus ancienne que le serveur : le serveur l'emporte", async () => {
  const vieille = { "carnet:seance:2026-11-08": { doc: { jour: HIER, type: "push", exos: [], note: "", maj: "2026-11-08T10:00:00.000Z" }, sale: false } };
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai", ...vieille }),
    reponses: { carnet_lire: () => ({ contexte: null, seances: [hierServeur] }), carnet_montre_appuis: () => liste(hier()) } });
  await b.attendre();
  assert.deepEqual(envoiDe(b, HIER).exos.map((e) => e.nom), [TRI, DC]);
});
test("copie locale d'un autre jour à envoyer, plus récente : elle l'emporte sur le serveur", async () => {
  // Retouchée ce matin, hors ligne : plus récente que le serveur, et pas encore envoyée.
  const aEnvoyer = { "carnet:seance:2026-11-08": { doc: { jour: HIER, type: "push", exos: [{ nom: ELE, series: [{ c: 8, r: 9, t: "18:50:00" }] }], note: "", maj: "2026-11-09T08:00:00.000Z" }, sale: true } };
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai", ...aEnvoyer }),
    reponses: { carnet_lire: () => ({ contexte: null, seances: [hierServeur] }), carnet_montre_appuis: () => liste(hier()) } });
  await b.attendre();
  assert.deepEqual(envoiDe(b, HIER).exos.map((e) => e.nom), [ELE, DC]);
});
test("lecture du serveur ratée : un jour inconnu ici attend, le curseur n'avance pas ; repris au retour du réseau", async () => {
  let enLigne = false;
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai", ...enCours([]) }),
    reponses: {
      carnet_lire: () => { if (!enLigne) throw { status: 503, message: "indisponible" }; return { contexte: null, seances: [hierServeur] }; },
      carnet_montre_appuis: () => liste(hier(), appui(0)),
    } });
  await b.attendre();
  assert.equal(b.stockage()["carnet:seance:2026-11-08"], undefined);   // rien créé pour hier
  assert.equal(b.json("seanceDuJour().exos[0].series.length"), 1);       // le jour même, connu ici, est noté
  assert.equal(b.stockage()["carnet:montre-appui"], undefined);          // arrêté avant l'appui d'hier (id 7)
  enLigne = true; await b.evaluer("charger()"); await b.attendre();
  assert.deepEqual(envoiDe(b, HIER).exos.map((e) => e.nom), [TRI, DC]);
  assert.equal(b.json("seanceDuJour().exos[0].series.length"), 1);
  assert.equal(b.stockage()["carnet:montre-appui"], 8);
});
test("lecture du serveur ratée, aucune séance du jour ici : l'appui du jour attend aussi", async () => {
  const b = await chargerCarnet({ stockage: avecCtx({ "carnet:cle": "cle-essai" }),
    reponses: { carnet_lire: () => { throw { status: 503, message: "indisponible" }; }, carnet_montre_appuis: () => liste(appui(0)) } });
  await b.attendre();
  assert.equal(b.json("seanceDuJour().exos.length"), 0);
  assert.equal(b.stockage()["carnet:montre-appui"], undefined);
  assert.equal(b.stockage()["carnet:seance:2026-11-09"]?.sale ?? false, false);
});
