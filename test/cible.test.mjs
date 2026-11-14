// La cible du carnet : port de prescription (herdr-sante), priorité à celle du PC, première fois sans charge,
// autorégulation après la première série.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";

const JOUR = "2026-11-09", AVANT = "2026-11-05";
const q = JSON.stringify;
// Un contexte d'un exercice : schéma S×R, dernière séance (séries, réserves), les charges d'avant pour le pas.
const ctxDe = (nom, S, R, series, rir, plus = {}) => ({
  rotation: ["push"], programme: { push: [nom] },
  exercices: [{ nom, seance: "push", groupe: "pecs", schema: { series: S, reps: R } }],
  historique: { [nom]: { jour: AVANT, series, rir, ...plus } },
});
// `avant` : les séries d'une séance plus ancienne (ctx.progres), pour le pas de l'exercice.
async function cibleDe(nom, S, R, series, rir, avant = null) {
  const ctx = ctxDe(nom, S, R, series, rir);
  if (avant) ctx.progres = { [nom]: [["2026-11-01", 0, 0, avant]] };
  const b = await chargerCarnet({ stockage: { "carnet:ctx": ctx } });
  const c = b.json(`cible(${q({ jour: AVANT, series, rir })}, ${q(nom)})`);
  return [c.sens, c.c, c.rs, c.texte];
}

// Résultats de prescription(occ, S, R, rir, nom) de herdr-sante, textes sans balises.
test("cible : mêmes résultats que herdr-sante", async () => {
  assert.deepEqual(await cibleDe("Développé militaire", 4, 6, Array(4).fill([16, 5]), [4, 4, 4, 4]),
    ["monte", 18, [6, 6, 6, 6], "5 faites avec 4+ en réserve → un cran : 18 kg, vise 4×6"]);
  assert.deepEqual(await cibleDe("Développé incliné haltères", 4, 6, Array(4).fill([22, 5]), [4, null, 4, 4]),
    ["monte", 24, [6, 6, 6, 6], "5 faites avec 4+ en réserve → un cran : 24 kg, vise 4×6"]);
  assert.deepEqual(await cibleDe("Développé couché guidé", 4, 6, [[20, 6], [20, 6], [20, 6], [20, 7]], [4, 4, 4, 4]),
    ["monte", 22.5, [6, 6, 6, 6], "4×6 tenu → un cran : 22,5 kg, vise 4×6"]);
  assert.deepEqual(await cibleDe("Curl biceps", 3, 12, [[12, 4], [12, 4], [12, 3]], [0, 0, 0]),
    ["baisse", 9.5, [11, 11, 11], "4 faites à 0 en réserve pour 12 visées → trop lourd : 9,5 kg, vise 3×11"]);
  assert.deepEqual(await cibleDe("Écarté machine", 3, 12, [[53, 10], [53, 9], [53, 9]], [null, 2, 1]),
    ["baisse", 50.5, [12, 12, 12], "9 faites à 2 en réserve pour 12 visées → trop lourd : 50,5 kg, vise 3×12"]);
  assert.deepEqual(await cibleDe("Écarté machine", 3, 12, [[53, 10], [53, 9], [53, 9]], [null, 2, 1], [[51, 9], [51, 9], [51, 9]]),
    ["baisse", 51, [11, 11, 11], "9 faites à 2 en réserve pour 12 visées → trop lourd : 51 kg, vise 3×11"]);
  assert.deepEqual(await cibleDe("Développé incliné haltères", 4, 6, Array(4).fill([28, 6]), [3, 3, 3, 3]),
    ["garde", 28, [6, 6, 6, 6], "reste à 28, les haltères les plus lourds : ajoute des répétitions, ou passe à la variante guidée"]);
  assert.deepEqual(await cibleDe("Presse", 4, 8, [[100, 8], [100, 8], [100, 7], [100, 8]], [3, 2, 2, 1]),
    ["monte", 102.5, [7, 7, 7, 7], "de la marge en réserve → un cran : 102,5 kg, vise 4×7-8"]);
  assert.deepEqual(await cibleDe("Tirage vertical", 4, 8, [[50, 8], [50, 7]], [2, 2]),
    ["garde", 50, [8, 8, 8, 8], "reste à 50 : vise 4 séries (2 la dernière fois)"]);
  // Hausse « trop facile » sans schéma tenu : le schéma entier reste visé, sans fourchette.
  assert.deepEqual(await cibleDe("Rowing haltères", 4, 8, Array(4).fill([20, 8]), [4, 4, 4, 4]),
    ["monte", 22, [8, 8, 8, 8], "4×8 tenu → un cran : 22 kg, vise 4×8"]);
});

test("capacité : une série sans réserve notée compte avec 0, et ne fait jamais baisser", async () => {
  // 12, 12, 9@0 : la meilleure série est 12 (réserve 0 au moins), pas la série ratée.
  assert.deepEqual(await cibleDe("Triceps poulie basse", 3, 12, [[20.5, 12], [20.5, 12], [20.5, 9]], [null, null, 0]),
    ["garde", 20.5, [12, 12, 10], "reste à 20,5 : vise 12, 12, 10"]);
  // La meilleure série (7, sans réserve) dirait « baisse » : 0 n'est qu'un minimum, on garde.
  assert.deepEqual(await cibleDe("Leg curl", 3, 12, [[40, 7], [40, 6], [40, 6]], [null, 1, 0]),
    ["garde", 40, [7, 7, 6], "reste à 40 : vise 7, 7, 6"]);
  // Aucune réserve notée : la double progression seule.
  assert.deepEqual(await cibleDe("Curl marteau", 3, 12, [[14, 8], [14, 7], [14, 6]], [null, null, null]),
    ["garde", 14, [8, 7, 7], "reste à 14 : vise 8, 7, 7"]);
});

test("poids du corps : chaque série arrêtée au schéma, une de plus quand il est tenu", async () => {
  assert.deepEqual(await cibleDe("Tractions", 4, 6, [[0, 11], [0, 6], [0, 4], [0, 2]], null),
    ["pdc", 0, [6, 6, 6, 6], "vise 4×6, chaque série arrêtée à 6"]);
  assert.deepEqual(await cibleDe("Dips", 4, 8, [[0, 9], [0, 8], [0, 8], [0, 8]], null),
    ["pdc", 0, [9, 9, 9, 9], "4×8 tenu au poids du corps : vise 4×9, ou du lest"]);
  assert.deepEqual(await cibleDe("Pompes", 4, 10, [[0, 10], [0, 8], [0, 7]], null),
    ["pdc", 0, [10, 8, 8, 7], "vise 10, 8, 8, 7, chaque série arrêtée à 10 au plus"]);
});

test("pasDe : 2 kg aux haltères et au militaire, quel que soit l'historique", async () => {
  const b = await chargerCarnet({ stockage: { "carnet:ctx": ctxDe("Développé incliné haltères", 4, 6, [[22, 6], [28, 6]], null) } });
  assert.equal(b.json(`pasDe("Développé incliné haltères")`), 2);
  assert.equal(b.json(`pasDe("Développé militaire")`), 2);
  assert.equal(b.json(`pasDe("Curl biceps")`), 2.5);
});

test("la prescription du PC l'emporte pour la séance qu'il connaît, et pré-remplit la nouvelle charge", async () => {
  const nom = "Développé couché guidé";
  const ctx = ctxDe(nom, 4, 6, Array(4).fill([20, 6]), [4, 4, 4, 4],
    { cible: "texte du PC", prescription: { sens: "monte", c: 25, rs: [5, 5, 4, 4] } });
  const b = await chargerCarnet({ stockage: { "carnet:ctx": ctx } });
  const { ci, L } = b.json(`lignesDe(${q(nom)})`);
  assert.deepEqual([ci.sens, ci.c, ci.rs, ci.texte, ci.monte], ["monte", 25, [5, 5, 4, 4], "texte du PC", true]);
  assert.deepEqual(L.map((l) => [l.c, l.r]), [[25, 5], [25, 5], [25, 4], [25, 4]]);
});

test("séance plus récente que celle du PC : calcul sur place", async () => {
  const nom = "Développé couché guidé";
  const ctx = ctxDe(nom, 4, 6, Array(4).fill([20, 6]), null, { prescription: { sens: "monte", c: 30, rs: [3, 3, 3, 3] } });
  const plus = { "carnet:seance:2026-11-07": { doc: { jour: "2026-11-07", type: "push",
    exos: [{ nom, series: Array(4).fill({ c: 22.5, r: 6, e: 2 }) }], note: "" }, sale: false } };
  const b = await chargerCarnet({ stockage: { "carnet:ctx": ctx, ...plus } });
  const ci = b.json(`lignesDe(${q(nom)}).ci`);
  assert.equal(ci.sens, "monte");
  assert.equal(ci.c, 25);
  assert.notEqual(ci.texte, "");
});

test("première fois : aucune charge proposée, la série attend qu'on la choisisse", async () => {
  const nom = "Développé couché guidé";
  const ctx = { rotation: ["push"], programme: { push: [nom] },
    exercices: [{ nom, seance: "push", groupe: "pecs", schema: { series: 4, reps: 6 } }], historique: {} };
  const b = await chargerCarnet({ stockage: { "carnet:ctx": ctx } });
  const { ci, L } = b.json(`lignesDe(${q(nom)})`);
  assert.equal(ci.texte, "première fois : prends une charge pour ~6 répétitions à 2-3 en réserve");
  assert.deepEqual(L.map((l) => l.c), [null, null, null, null]);
  assert.equal(b.json(`cibleTxt(${q(nom)})`), "? kg × 6");
  b.evaluer(`validerSerie(${q(nom)})`);
  assert.equal(b.json(`seanceDuJour().exos.find((e) => e.nom === ${q(nom)})?.series?.length ?? 0`), 0);
  assert.match(b.evaluer(`$("#toast").innerHTML`), /Choisis d'abord la charge/);
  b.evaluer(`regler(${q(nom)}, 0, false, "c", 30)`);
  assert.deepEqual(b.json(`lignesDe(${q(nom)}).L.map((l) => l.c)`), [30, 30, 30, 30]);
  b.evaluer(`validerSerie(${q(nom)})`);
  assert.equal(b.json(`seanceDuJour().exos.find((e) => e.nom === ${q(nom)}).series[0].c`), 30);
});

async function apresPremiere(nom, S, R, histo, faite, plusStockage = {}) {
  const ctx = ctxDe(nom, S, R, histo, null);
  const b = await chargerCarnet({ stockage: { "carnet:ctx": ctx, ...plusStockage } });
  b.evaluer(`validerSerie(${q(nom)})`);
  if (faite.r != null) b.evaluer(`seanceDuJour().exos.find((e) => e.nom === ${q(nom)}).series[0].r = ${faite.r}`);
  b.evaluer(`noterReserve(${q(nom)}, 0, ${faite.e})`);
  return b;
}

test("autorégulation : 4+ en réserve à la première série, un cran de plus pour la suite, signalé", async () => {
  const nom = "Développé couché guidé";
  const b = await apresPremiere(nom, 4, 6, [[20, 6], [20, 6], [20, 6], [20, 5]], { e: 4 });
  assert.deepEqual(b.json(`lignesDe(${q(nom)}).L.map((l) => l.c)`), [20, 22.5, 22.5, 22.5]);
  assert.match(b.evaluer(`$("#toast").innerHTML`), /un cran de plus → 22,5 kg pour la suite/);
  // La deuxième série faite à la nouvelle charge : les suivantes la gardent.
  b.evaluer(`validerSerie(${q(nom)})`);
  assert.deepEqual(b.json(`lignesDe(${q(nom)}).L.map((l) => l.c)`), [20, 22.5, 22.5, 22.5]);
});

test("autorégulation : pas au-delà du plafond des haltères", async () => {
  const nom = "Développé incliné haltères";
  const b = await apresPremiere(nom, 4, 6, [[28, 6], [28, 6], [28, 6], [28, 5]], { e: 4 });
  assert.deepEqual(b.json(`lignesDe(${q(nom)}).L.map((l) => l.c)`), [28, 28, 28, 28]);
});

test("autorégulation : échec deux répétitions sous la cible, un cran de moins ; réserve 1, rien", async () => {
  const nom = "Développé couché guidé";
  const b = await apresPremiere(nom, 4, 6, [[20, 6], [20, 6], [20, 6], [20, 5]], { e: 0, r: 4 });
  assert.deepEqual(b.json(`lignesDe(${q(nom)}).L.map((l) => l.c)`), [20, 17.5, 17.5, 17.5]);
  const b2 = await apresPremiere(nom, 4, 6, [[20, 6], [20, 6], [20, 6], [20, 5]], { e: 1, r: 4 });
  assert.deepEqual(b2.json(`lignesDe(${q(nom)}).L.map((l) => l.c)`), [20, 20, 20, 20]);
});

test("autorégulation : une ligne réglée à la main n'est jamais écrasée", async () => {
  const nom = "Développé couché guidé";
  const b = await chargerCarnet({ stockage: { "carnet:ctx": ctxDe(nom, 4, 6, [[20, 6], [20, 6], [20, 6], [20, 5]], null) } });
  b.evaluer(`validerSerie(${q(nom)})`);
  b.evaluer(`regler(${q(nom)}, 2, false, "c", 21)`);
  b.evaluer(`noterReserve(${q(nom)}, 0, 4)`);
  assert.deepEqual(b.json(`lignesDe(${q(nom)}).L.map((l) => l.c)`), [20, 22.5, 21, 21]);
});
