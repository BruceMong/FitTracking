// Les gestes du grand format en fonctions nommées : les boutons du téléphone et, plus tard, les gestes de la
// montre (tâche 5) passent par les mêmes fonctions. Chacune rend true si elle a agi.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { DC, TRI, avecCtx, enCours } from "./fixtures.mjs";

const q = JSON.stringify;
const T0 = Date.parse("2026-11-09T17:00:00+01:00"), ID0 = `2026-11-09|${DC}|0`;

// La séance d'essai, une série du développé couché faite : repos de 150 s, fin à T0 + 150 s.
async function enRepos() {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer(`validerSerie(${q(DC)})`);
  assert.equal(b.json("minu.fin"), T0 + 150000);
  return b;
}

test("ajusterRepos : ±15 s sur la fin et la durée, durée jamais sous 15 s", async () => {
  const b = await enRepos();
  assert.equal(b.json("ajusterRepos(15)"), true);
  assert.equal(b.json("minu.fin"), T0 + 165000);
  assert.equal(b.json("minu.duree"), 165);
  assert.equal(b.stockage()["carnet:minuteur"].fin, T0 + 165000);   // gardé
  b.evaluer("for (let i = 0; i < 10; i++) ajusterRepos(-15)");
  assert.equal(b.json("minu.duree"), 15);
  b.evaluer("ajusterRepos(-15)");
  assert.equal(b.json("minu.duree"), 15);   // plancher
  b.evaluer("arreterRepos()");
  assert.equal(b.json("ajusterRepos(15)"), false);   // sans repos : rien
});

test("pauseRepos / reprendreRepos à l'heure donnée", async () => {
  const b = await enRepos();
  assert.equal(b.json(`pauseRepos(${T0 + 50000})`), true);
  assert.equal(b.json("minu.restant"), 100);
  assert.equal(b.json(`pauseRepos(${T0 + 60000})`), false);   // déjà en pause
  assert.equal(b.json("minu.restant"), 100);
  assert.equal(b.json("ajusterRepos(15)"), true);   // en pause, c'est le restant qui bouge
  assert.equal(b.json("minu.restant"), 115);
  assert.equal(b.json(`reprendreRepos(${T0 + 70000})`), true);
  assert.equal(b.json("minu.fin"), T0 + 185000);
  assert.equal(b.json("minu.restant"), null);
  assert.equal(b.json(`reprendreRepos(${T0 + 80000})`), false);   // pas en pause
  assert.equal(b.json("minu.fin"), T0 + 185000);
});

test("pauseRepos / reprendreRepos : l'exemple du brief, sans ajustement", async () => {
  const b = await enRepos();
  b.evaluer(`pauseRepos(${T0 + 50000}); pauseRepos(${T0 + 60000}); reprendreRepos(${T0 + 70000})`);
  assert.equal(b.json("minu.fin"), T0 + 170000);
  assert.equal(b.json("minu.restant"), null);
  assert.equal(b.stockage()["carnet:minuteur"].fin, T0 + 170000);
});

test("passerRepos : repos arrêté, exercice suivant ouvert", async () => {
  const b = await enRepos();
  b.evaluer("ouvert = null");
  assert.equal(b.json("passerRepos()"), true);
  assert.equal(b.json("minu"), null);
  assert.equal(b.json("ouvert"), DC);   // il lui reste des séries
  assert.equal(b.stockage()["carnet:minuteur"], undefined);
  assert.equal(b.json("passerRepos()"), false);   // plus de repos : rien
});

test("changerExo(1) puis (-1) : même cycle que les flèches du grand format", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  assert.equal(b.json("exoGrand()"), DC);
  assert.equal(b.json("changerExo(1)"), true);
  assert.equal(b.json("exoGrand()"), TRI);
  assert.equal(b.json("changerExo(-1)"), true);
  assert.equal(b.json("exoGrand()"), DC);
  assert.equal(b.json("changerExo(-1)"), true);   // en boucle, comme les flèches
  assert.equal(b.json("exoGrand()"), "Élévations latérales");
  assert.equal(b.json("changerExo(0)"), false);
});

test("uneSerieDePlus : une ligne prévue de plus", async () => {
  const b = await enRepos();
  assert.equal(b.json(`uneSerieDePlus(${q(DC)})`), true);
  assert.equal(b.json(`lignesDe(${q(DC)}).L.length`), 5);
  assert.equal(b.json(`uneSerieDePlus("Exercice inconnu")`), false);
  assert.equal(b.json(`"Exercice inconnu" in saisie`), false);
});

test("noterReserve : @N sur la série visée", async () => {
  const b = await enRepos();
  assert.equal(b.json(`noterReserve(${q(DC)}, 0, 2)`), true);
  assert.equal(b.json("seanceDuJour().exos[0].series[0].e"), 2);
  assert.equal(b.stockage()["carnet:seance:2026-11-09"].doc.exos[0].series[0].e, 2);   // sauvé
  assert.equal(b.stockage()["carnet:seance:2026-11-09"].sale, true);
  assert.equal(b.json(`noterReserve(${q(DC)}, 9, 1)`), false);
  assert.equal(b.json(`noterReserve(${q(DC)}, 0, 7)`), false);   // hors 0..4
  assert.equal(b.json("seanceDuJour().exos[0].series[0].e"), 2);
});

test("annulerAppui : la série marquée retirée, son repos arrêté ; id inconnu : rien", async () => {
  const b = await chargerCarnet({ stockage: avecCtx(enCours([{ c: 42.5, r: 6, t: "16:58:00", m: ID0 }])) });
  b.evaluer(`minu = { nom: ${q(DC)}, quoi: "Montre", cible: "", duree: 150, fin: ${T0 + 30000}, restant: null,
    mode: "repos", impose: true, appli: true, appui: ${q(ID0)} }; garder()`);
  assert.equal(b.json(`annulerAppui("x")`), false);
  assert.equal(b.json("seanceDuJour().exos.length"), 1);
  assert.equal(b.json(`annulerAppui(${q(ID0)})`), true);
  assert.deepEqual(b.json("seanceDuJour().exos"), []);
  assert.equal(b.json("minu"), null);
  assert.deepEqual(b.stockage()["carnet:seance:2026-11-09"].doc.exos, []);
  await b.attendre();
  assert.equal(b.journalMontre().at(-1).quoi, `appli montre : ${DC} annulée`);
  assert.equal(b.json(`annulerAppui(${q(ID0)})`), false);   // déjà retirée
});

test("annulerAppui : réglages décalés, échauffement marqué, repos d'un autre appui gardé", async () => {
  const ID1 = `2026-11-09|${DC}|1`, IDE = `2026-11-09|${DC}|e0`;
  const b = await chargerCarnet({ stockage: avecCtx(enCours([],
    { exos: [{ nom: DC, series: [{ c: 42.5, r: 6, t: "16:58:00", m: ID0 }, { c: 42.5, r: 6, t: "17:01:00", m: ID1 }],
      ech: [{ c: 22.5, r: 10, t: "16:55:00", m: IDE }] }] })) });
  // la 4e série (k = 3) réglée à 45 kg ; un repos lancé par l'appui de la 2e série
  b.evaluer(`lignesDe(${q(DC)}).st.edits[3] = { c: 45 };
    minu = { nom: ${q(DC)}, quoi: "Montre", cible: "", duree: 150, fin: ${T0 + 30000}, restant: null, mode: "repos", appui: ${q(ID1)} }; garder()`);
  assert.equal(b.json(`annulerAppui(${q(ID0)})`), true);
  assert.deepEqual(b.json("seanceDuJour().exos[0].series.map((x) => x.m)"), [ID1]);
  assert.deepEqual(b.json(`saisie[${q(DC)}].edits`), { 2: { c: 45 } });   // décalé comme retirerSerie
  assert.equal(b.json("minu.appui"), ID1);   // pas le repos de cet appui : gardé
  assert.equal(b.json(`annulerAppui(${q(IDE)})`), true);
  assert.equal(b.json("seanceDuJour().exos[0].ech"), undefined);
  assert.equal(b.json("seanceDuJour().exos.length"), 1);   // une série reste : l'exercice aussi
  assert.notEqual(b.json("minu"), null);
});

test("annulerAppui : la réserve demandée suit la série qu'elle visait", async () => {
  const ID1 = `2026-11-09|${DC}|1`;
  const b = await chargerCarnet({ stockage: avecCtx(enCours([
    { c: 42.5, r: 6, t: "16:58:00", m: ID0 }, { c: 42.5, r: 6, t: "17:01:00", m: ID1 }])) });
  b.evaluer(`minu = { nom: ${q(DC)}, quoi: "x", cible: "", duree: 150, fin: ${T0 + 30000}, restant: null, mode: "repos",
    effort: { nom: ${q(DC)}, i: 1, vise: 6 } }; garder()`);
  b.evaluer(`annulerAppui(${q(ID0)})`);
  assert.equal(b.json("minu.effort.i"), 0);   // toujours la série de 17:01
  b.evaluer(`annulerAppui(${q(ID1)})`);
  assert.equal(b.json("minu.effort"), undefined);   // la série visée n'existe plus
});

// Un clic factice : `closest(sel)` rend un élément portant data-<cle>="<v>" pour le sélecteur visé.
const ESPION = `globalThis.evt = (sel, cle, v) => ({ target: { closest: (s) => (s === sel ? { dataset: { [cle]: v } } : null) } });
  globalThis.vus = [];
  for (const f of ["ajusterRepos", "pauseRepos", "reprendreRepos", "passerRepos", "changerExo", "uneSerieDePlus", "noterReserve"]) {
    const vrai = globalThis[f];
    globalThis[f] = (...a) => (vus.push([f, ...a]), vrai(...a));
  }`;

test("les boutons du téléphone passent par les mêmes fonctions", async () => {
  const b = await enRepos();
  b.evaluer(ESPION);
  b.evaluer(`clicMinuteur(evt("[data-min]", "min", "15"))`);
  assert.equal(b.json("minu.fin"), T0 + 165000);
  assert.equal(b.json("minu.duree"), 165);
  b.evaluer(`clicMinuteur(evt("[data-min]", "min", "pause"))`);
  assert.equal(b.json("minu.restant"), 165);
  b.evaluer(`clicMinuteur(evt("[data-min]", "min", "-15"))`);
  assert.equal(b.json("minu.restant"), 150);
  assert.equal(b.json("minu.duree"), 150);
  b.evaluer(`clicMinuteur(evt("[data-min]", "min", "pause"))`);
  assert.equal(b.json("minu.fin"), T0 + 150000);
  assert.equal(b.json("minu.restant"), null);
  b.evaluer(`clicMinuteur(evt("[data-effort]", "effort", "3"))`);
  assert.equal(b.json("seanceDuJour().exos[0].series[0].e"), 3);
  assert.deepEqual(b.json("vus"), [["ajusterRepos", 15], ["pauseRepos"], ["ajusterRepos", -15], ["reprendreRepos"],
    ["noterReserve", DC, 0, 3]]);
});

test("les boutons du grand format passent par les mêmes fonctions", async () => {
  const b = await enRepos();
  b.evaluer(ESPION);
  b.evaluer(`clicGrand(evt("[data-g]", "g", "plus"))`);
  assert.equal(b.json(`lignesDe(${q(DC)}).L.length`), 5);
  b.evaluer(`clicGrand(evt("[data-g]", "g", "go"))`);
  assert.equal(b.json("minu"), null);
  assert.equal(b.json("ouvert"), DC);
  b.evaluer(`clicGrand(evt("[data-g]", "g", "suiv"))`);
  assert.equal(b.json("exoGrand()"), TRI);
  b.evaluer(`clicGrand(evt("[data-g]", "g", "prec"))`);
  assert.equal(b.json("exoGrand()"), DC);
  assert.deepEqual(b.json("vus"), [["uneSerieDePlus", DC], ["passerRepos"], ["changerExo", 1, DC], ["changerExo", -1, TRI]]);
  // (au téléphone, les flèches partent de l'exercice affiché : exoAffiche, qui peut être un exercice fini)
});
