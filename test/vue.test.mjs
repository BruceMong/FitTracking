// La vue Exercice est l'écran principal de la séance : affichée par défaut dès qu'il reste des séries à faire,
// la Liste à la demande, et la vue choisie gardée (carnet:vue).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { DC, TRI, ELE, JOUR, ctxPush, avecCtx, avecCtxSansSs, enCours } from "./fixtures.mjs";

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

// Séance du jour sans la paire de superset, avec des séries déjà notées (S : une série faite à 16:00).
const S = (c, r) => ({ c, r, t: "16:00:00" });
const sansSs = (exos) => avecCtxSansSs({ "carnet:cle": "cle-essai",
  [`carnet:seance:${JOUR}`]: { doc: { jour: JOUR, type: "push", exos, note: "", maj: "2026-11-09T15:00:00Z" }, sale: false } });
const fois = (n, c, r) => Array.from({ length: n }, () => S(c, r));

// Salle, 2026-11-13 : en plein repos, impossible de corriger la machine d'avant (répétitions, réserve oubliée) : la
// carte touchée dans la Liste ramenait à l'écran du repos. Elle montre désormais cet exercice, le repos courant
// toujours ; ses pastilles s'ouvrent pour corriger, « Retour au repos » (le chrono dedans) revient au repos.
test("pendant un repos, une carte touchée dans la Liste montre cet exercice pour le corriger, le repos continue", async () => {
  const b = await chargerCarnet({ stockage: sansSs([{ nom: ELE, series: fois(3, 8, 12) }]) });
  b.evaluer(`dessiner(); validerSerie(${q(DC)}); allerListe(); dessiner(); allerExercice(${q(ELE)}); dessiner()`);
  assert.equal(b.json("grandVu"), true);
  assert.equal(b.json("etatGrand()"), "repos");
  assert.equal(b.json("consultation()"), ELE);
  assert.equal(b.json("exoAffiche()"), ELE);
  assert.equal(b.json("exoGrand()"), DC);                      // le plan (et la montre) ne bougent pas
  const html = b.json(`corpsGrand(etatGrand())`);
  assert.match(html, new RegExp(ELE));
  assert.equal((html.match(/class="fait" data-pastille=/g) || []).length, 3);
  assert.match(html, /data-g="repos"[^>]*>Retour au repos <span id="g-chrono">/);
  assert.doesNotMatch(html, /data-cocher|data-g="go"|data-min=/);
  // une pastille ouvre la série pour la corriger, réserve comprise
  b.evaluer(`clicGrand({ target: { closest: (sel) => sel === "[data-pastille]" ? { dataset: { pastille: "1", pn: ${q(ELE)} } } : null } })`);
  assert.equal(b.json("feuilleOuverte.quoi"), "serie");
  assert.equal(b.json("feuilleOuverte.nom"), ELE);
  assert.match(b.json(`feuilleSerie(${q(ELE)}, 1, false)`), /data-f-reserve="4"/);
  b.evaluer("fermerFeuille()");
  // « Retour au repos » : l'écran du repos, le chrono n'a pas bougé
  clicG(b, "repos");
  assert.equal(b.json("consultation()"), null);
  assert.equal(b.json("exoAffiche()"), DC);
  assert.equal(b.json("etatGrand()"), "repos");
});
test("pendant un repos, la carte de l'exercice du repos ramène simplement à l'écran du repos", async () => {
  const b = await chargerCarnet({ stockage: sansSs([{ nom: ELE, series: fois(3, 8, 12) }]) });
  b.evaluer(`dessiner(); validerSerie(${q(DC)}); allerListe(); dessiner(); allerExercice(${q(DC)}); dessiner()`);
  assert.equal(b.json("consultation()"), null);
  assert.match(b.json(`corpsGrand(etatGrand())`), /data-g="go"/);
});
test("l'exercice corrigé pendant le repos est oublié avec ce repos : « Go » mène à la série suivante", async () => {
  const b = await chargerCarnet({ stockage: sansSs([{ nom: ELE, series: fois(3, 8, 12) }]) });
  b.evaluer(`dessiner(); validerSerie(${q(DC)}); allerListe(); dessiner(); allerExercice(${q(ELE)}); dessiner()`);
  b.evaluer("passerRepos(); dessiner()");
  assert.equal(b.json("consultation()"), null);
  assert.equal(b.json("exoAffiche()"), DC);
  const html = b.json(`corpsGrand("serie")`);
  assert.match(html, /Série 2 faite/);
  assert.doesNotMatch(html, /data-g="une-de-plus"/);
  assert.equal(b.json(`lignesDe(${q(ELE)}).st.extra`), 0);
  // un nouveau repos ne reprend pas l'ancien choix
  b.evaluer(`validerSerie(${q(DC)}); dessiner()`);
  assert.equal(b.json("consultation()"), null);
});
test("écrans du repos : ⋯ ouvre les actions de l'exercice annoncé (le superset s'y active)", async () => {
  const b = await chargerCarnet({ stockage: sansSs([{ nom: DC, series: fois(3, 42.5, 6) }]) });
  b.evaluer(`dessiner(); validerSerie(${q(DC)}); dessiner()`);   // dernière série du développé : repos, triceps annoncé
  assert.equal(b.json("etatGrand()"), "repos");
  for (const e of ["repos", "fini"]) assert.match(b.json(`corpsGrand(${q(e)})`), /data-g="menu"/);
  clicG(b, "menu");
  assert.deepEqual(b.json("feuilleOuverte"), { quoi: "menu", nom: TRI });
  b.evaluer(`clicFeuille({ dataset: { superset: ${q(TRI)} }, hasAttribute: () => false, closest: () => null }, ${q(TRI)})`);
  assert.equal(b.json(`ssActif(${q(TRI)})`), true);
  assert.equal(b.json("etatGrand()"), "repos");
});
test("écran de fin d'exercice (depuis la Liste) : ⋯ sur l'exercice annoncé", async () => {
  const b = await chargerCarnet({ stockage: sansSs([{ nom: DC, series: fois(3, 42.5, 6) }]) });
  b.evaluer(`allerListe(); dessiner(); validerSerie(${q(DC)}); dessiner()`);
  assert.equal(b.json("minu.mode"), "fin");
  assert.match(b.json(`corpsGrand("fin")`), /data-g="menu"/);
  clicG(b, "menu");
  assert.deepEqual(b.json("feuilleOuverte"), { quoi: "menu", nom: TRI });
});
test("écran de fin de séance : ⋯ sur le dernier exercice fait", async () => {
  const b = await chargerCarnet({ stockage: sansSs([{ nom: DC, series: fois(3, 42.5, 6) }, { nom: TRI, series: fois(3, 20, 12) },
    { nom: ELE, series: fois(3, 8, 12) }]) });
  b.evaluer(`dessiner(); validerSerie(${q(DC)}); dessiner()`);
  assert.equal(b.json("etatGrand()"), "fin");
  assert.equal(b.json("exoGrand()"), null);
  assert.match(b.json(`corpsGrand("fin")`), /data-g="menu"/);
  clicG(b, "menu");
  assert.deepEqual(b.json("feuilleOuverte"), { quoi: "menu", nom: DC });
});

test("toucher un exercice fini pour le corriger ne change ni l'exercice à faire ni le plan de la montre", async () => {
  const b = await chargerCarnet({ stockage: sansSs([{ nom: DC, series: [S(42.5, 6)] }, { nom: TRI, series: fois(3, 20, 12) }]) });
  b.evaluer(`ouvert = ${q(DC)}; dessiner()`);
  const plan = b.json("planMontre()");
  b.evaluer(`allerListe(); dessiner(); allerExercice(${q(TRI)}); dessiner()`);
  assert.equal(b.json("exoAffiche()"), TRI);
  assert.equal(b.json("exoGrand()"), DC);
  assert.deepEqual(b.json("planMontre()"), plan);
  b.evaluer("quitterExercice()");
  assert.equal(b.json("exoGrand()"), DC);
});
test("exercice fini : « + une série » du menu ⋯ en refait l'exercice en cours, à l'écran", async () => {
  const b = await chargerCarnet({ stockage: sansSs([{ nom: DC, series: [S(42.5, 6)] }, { nom: TRI, series: fois(3, 20, 12) }]) });
  b.evaluer(`dessiner(); allerExercice(${q(TRI)}); dessiner()`);
  b.clic({}, ["data-plus-serie"], TRI);
  assert.equal(b.json("exoAffiche()"), TRI);
  assert.equal(b.json("exoGrand()"), TRI);
  assert.match(b.json(`corpsGrand("serie")`), /Série 4 faite/);
});

test("la ligne de repos d'un autre onglet mène à l'écran du repos de la Séance", async () => {
  const b = await chargerCarnet({ stockage: sansSs([]) });
  b.evaluer(`dessiner(); validerSerie(${q(DC)}); allerListe(); onglet = "sante"; dessiner()`);
  assert.equal(b.json("grandVu"), false);
  // le panneau compact (hors vue Exercice) touché hors de ses boutons
  b.evaluer(`$("#minuteur").classList = { contains: (c) => c === "compact", add() {}, remove() {}, toggle() {} };
    clicMinuteur({ target: { closest: () => null } })`);
  assert.equal(b.json("onglet"), "seance");
  assert.equal(b.json("vue"), "exercice");
  assert.equal(b.json("grandVu"), true);
  assert.equal(b.json("etatGrand()"), "repos");
  assert.deepEqual(b.stockage()["carnet:vue"], { vue: "exercice", jour: JOUR });
});
