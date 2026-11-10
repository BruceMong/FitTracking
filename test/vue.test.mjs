// La vue Exercice est l'écran principal de la séance : affichée par défaut dès qu'il reste des séries à faire,
// la Liste à la demande, et la vue choisie gardée (carnet:vue).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { DC, ELE, ctxPush, avecCtx } from "./fixtures.mjs";

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
  assert.equal(b.stockage()["carnet:vue"], "liste");
  b.evaluer(`allerExercice(${q(ELE)}); dessiner()`);
  assert.equal(b.json("exoGrand()"), ELE);
  assert.equal(b.stockage()["carnet:vue"], "exercice");
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
