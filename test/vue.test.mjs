// La vue Exercice est l'écran principal de la séance : affichée par défaut dès qu'il reste des séries à faire,
// la Liste à la demande, et la vue choisie gardée (carnet:vue).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { DC, TRI, ELE, JOUR, ctxPush, avecCtx, enCours } from "./fixtures.mjs";

const q = JSON.stringify;
// La vue Exercice ne s'affiche qu'avec une clé posée (sans elle, la page d'accueil demande la clé).
const avecCle = (plus = {}) => avecCtx({ "carnet:cle": "cle-essai", ...plus });

test("vue Exercice par défaut quand la séance a des séries à faire", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer("dessiner()");
  assert.equal(b.json("vue"), "exercice");
  assert.equal(b.json("grandVu"), true);
  const html = b.json(`corpsGrand("serie")`);
  assert.match(html, /data-g="liste"/);
  assert.match(html, /data-g="menu"/);
  assert.match(html, /Série 1 faite/);
  assert.equal((html.match(/data-pastille=/g) || []).length, 4);   // DC : 4 séries
  assert.doesNotMatch(html, /data-g="fermer"/);
});
test("pas de vue Exercice sans séries à faire", async () => {
  const b = await chargerCarnet({ stockage: { "carnet:cle": "cle-essai", "carnet:ctx": { ...ctxPush, programme: {} } } });
  b.evaluer("dessiner()");
  assert.equal(b.json("grandVu"), false);
});
test("pas de vue Exercice sans clé", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  b.evaluer("dessiner()");
  assert.equal(b.json("grandVu"), false);
});
test("liste puis exercice : la vue est gardée", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer("allerListe(); dessiner()");
  assert.equal(b.json("grandVu"), false);
  assert.deepEqual(b.stockage()["carnet:vue"], { vue: "liste", jour: JOUR });
  b.evaluer(`allerExercice(${q(ELE)}); dessiner()`);
  assert.equal(b.json("exoGrand()"), ELE);
  assert.deepEqual(b.stockage()["carnet:vue"], { vue: "exercice", jour: JOUR });
});
test("vue Exercice restaurée après rechargement pendant un repos", async () => {
  const a = await chargerCarnet({ stockage: avecCle() });
  a.evaluer(`dessiner(); validerSerie(${q(DC)}); dessiner()`);
  const b = await chargerCarnet({ stockage: a.stockage() });
  b.evaluer("dessiner()");
  assert.equal(b.json("grandVu"), true);
  assert.equal(b.json("etatGrand()"), "repos");
});
test("onglet Santé : pas de vue Exercice", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`onglet = "sante"; dessiner()`);
  assert.equal(b.json("grandVu"), false);
});
test("l'ancienne préférence du grand format (carnet:grand) est retirée au chargement", async () => {
  const b = await chargerCarnet({ stockage: avecCle({ "carnet:grand": true }) });
  assert.equal(b.stockage()["carnet:grand"], undefined);
});
test("vue Exercice : en-tête, infos, pastilles, réglage puis bouton, dans cet ordre", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer("dessiner()");
  const html = b.json(`corpsGrand("serie")`);
  const ordre = [/data-g="prec"/, /exercice 1 sur 3 · pecs/, /data-g="liste"/, /data-g="menu"/, /la dernière fois : 42,5×6, 6, 5, 5/,
    /class="g-info[^"]*">→ reste à 42,5/, /data-pastille="0"/, /data-pm="c"/, /Série 1 faite/].map((r) => html.search(r));
  assert.ok(ordre.every((i) => i >= 0), JSON.stringify(ordre));
  assert.deepEqual(ordre, [...ordre].sort((x, y) => x - y));
  assert.match(html, /class="prochaine" data-pastille="0"/);
  assert.match(html, /class="prevue" data-pastille="3"/);
});
test("le panneau de repos du bas est caché en vue Exercice, affiché en Liste", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`dessiner(); validerSerie(${q(DC)}); dessiner()`);
  assert.equal(b.json(`$("#minuteur").className`), "minuteur");
  assert.equal(b.json(`$("#grand").className.split(" ")[0]`), "ouvert");
  b.evaluer("allerListe(); dessiner()");
  assert.match(b.json(`$("#minuteur").className`), /actif/);
  assert.equal(b.json(`$("#grand").className`), "");
});

// Le développé couché fini (4 séries), touché dans la Liste.
const dcFini = () => avecCle(enCours([1, 2, 3, 4].map(() => ({ c: 42.5, r: 6, t: "16:00:00" }))));
// Un clic de la vue Exercice sur le bouton data-g=g, sans DOM.
const clicG = (b, g) => b.evaluer(`clicGrand({ target: { closest: () => ({ dataset: { g: ${q(g)} } }) } })`);

test("exercice fini touché dans la Liste : la vue Exercice le montre, sans « Série faite »", async () => {
  const b = await chargerCarnet({ stockage: dcFini() });
  b.evaluer(`allerListe(); dessiner(); allerExercice(${q(DC)}); dessiner()`);
  assert.equal(b.json("grandVu"), true);
  assert.equal(b.json("exoAffiche()"), DC);
  assert.equal(b.json("exoGrand()"), TRI);   // le plan de la montre ne le voit pas comme en cours
  const html = b.json(`corpsGrand("serie")`);
  assert.doesNotMatch(html, /data-cocher/);
  assert.doesNotMatch(html, /data-pm=/);
  assert.match(html, /\+ une série/);
  assert.match(html, /Exercice suivant ›/);
  assert.equal((html.match(/class="fait" data-pastille=/g) || []).length, 4);
  assert.equal(b.json("planMontre().etapes[0].nom"), TRI);
});
test("exercice fini : « + une série » en refait un exercice en cours", async () => {
  const b = await chargerCarnet({ stockage: dcFini() });
  b.evaluer(`allerExercice(${q(DC)}); dessiner()`);
  clicG(b, "une-de-plus");
  assert.equal(b.json("exoAffiche()"), DC);
  assert.equal(b.json("exoGrand()"), DC);
  const html = b.json(`corpsGrand("serie")`);
  assert.match(html, /data-cocher/);
  assert.match(html, /Série 5 faite/);
});
test("exercice fini : « Exercice suivant › » mène au suivant de la séance, le choix est oublié", async () => {
  const b = await chargerCarnet({ stockage: dcFini() });
  b.evaluer(`allerExercice(${q(DC)}); dessiner()`);
  clicG(b, "suiv");
  assert.equal(b.json("exoAffiche()"), TRI);
  assert.equal(b.json("exoChoisi"), null);
});
test("exercice fini : la Liste ou une série validée oublient le choix", async () => {
  const b = await chargerCarnet({ stockage: dcFini() });
  b.evaluer(`allerExercice(${q(DC)}); allerListe(); allerExercice(${q(TRI)}); dessiner()`);
  assert.equal(b.json("exoAffiche()"), TRI);
  b.evaluer(`allerExercice(${q(DC)}); validerSerie(${q(TRI)}); dessiner()`);
  assert.equal(b.json("exoChoisi"), null);
});

test("retour du téléphone : une entrée d'historique dès que la vue Exercice est à l'écran", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`globalThis.pousses = []; history.pushState = (s) => { pousses.push(s); history.state = s; }; dessiner(); dessiner()`);
  assert.deepEqual(b.json("pousses"), [{ exercice: 1 }]);
  // le retour (popstate, l'entrée retirée) : la Liste
  b.evaluer("history.state = null; retourHistorique()");
  assert.equal(b.json("vue"), "liste");
  assert.equal(b.json("grandVu"), false);
});
test("retour du téléphone sur un autre onglet : la vue reste celle choisie", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`dessiner(); onglet = "sante"; dessiner(); history.state = null; retourHistorique()`);
  assert.equal(b.json("vue"), "exercice");
});
test("☰ avec l'entrée d'historique : history.back(), la Liste vient du popstate", async () => {
  const b = await chargerCarnet({ stockage: avecCle() });
  b.evaluer(`globalThis.retours = 0; history.state = { exercice: 1 };
    history.back = () => { retours++; history.state = null; retourHistorique(); }; dessiner()`);
  clicG(b, "liste");
  assert.equal(b.json("retours"), 1);
  assert.equal(b.json("vue"), "liste");
});

test("repos d'hier ignoré au chargement : la vue Exercice montre l'exercice du jour", async () => {
  const hier = Date.parse("2026-11-08T18:00:00+01:00");
  const minu = { nom: ELE, quoi: "x", cible: "", duree: 90, fin: hier, restant: null, mode: "repos", debut: hier - 90000 };
  const b = await chargerCarnet({ stockage: avecCle({ "carnet:minuteur": minu }) });
  b.evaluer("dessiner()");
  assert.equal(b.json("minu"), null);
  assert.equal(b.stockage()["carnet:minuteur"], undefined);
  assert.equal(b.json("grandVu"), true);
  assert.equal(b.json("etatGrand()"), "serie");
  assert.equal(b.json("exoAffiche()"), DC);
});
test("fin d'exercice d'hier ignorée, rien à faire aujourd'hui : pas de vue Exercice", async () => {
  const hier = Date.parse("2026-11-08T18:00:00+01:00");
  const minu = { nom: ELE, quoi: "x", cible: "", duree: 0, fin: 0, restant: null, mode: "fin", debut: hier };
  const b = await chargerCarnet({ stockage: { "carnet:cle": "cle-essai", "carnet:ctx": { ...ctxPush, programme: {} }, "carnet:minuteur": minu } });
  b.evaluer("dessiner()");
  assert.equal(b.json("grandVu"), false);
});
test("vue Liste choisie hier : aujourd'hui, la vue Exercice", async () => {
  const b = await chargerCarnet({ stockage: avecCle({ "carnet:vue": { vue: "liste", jour: "2026-11-08" } }) });
  b.evaluer("dessiner()");
  assert.equal(b.json("vue"), "exercice");
  assert.equal(b.json("grandVu"), true);
});
test("vue Liste choisie aujourd'hui : gardée au rechargement", async () => {
  const b = await chargerCarnet({ stockage: avecCle({ "carnet:vue": { vue: "liste", jour: JOUR } }) });
  b.evaluer("dessiner()");
  assert.equal(b.json("vue"), "liste");
});
