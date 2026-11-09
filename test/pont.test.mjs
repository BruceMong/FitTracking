import { test } from "node:test";
import assert from "node:assert/strict";
import { lireGeste, versionSuivante, messageRepos, messagePlan } from "../pont.js";

const DC = "Développé couché guidé", TS = Date.parse("2026-11-09T16:58:00+01:00");
const g = (gg, plus = {}) => ({ type: "geste", n: 1794330342, ts: TS, g: gg, ...plus });
test("lireGeste : gestes lisibles, champs en trop retirés", () => {
  assert.deepEqual(lireGeste(g("plus15", { x: 1 })), { n: 1794330342, ts: TS, g: "plus15" });
  assert.deepEqual(lireGeste(g("regler", { nom: DC, k: 2, ech: false, champ: "c", v: 45 })),
    { n: 1794330342, ts: TS, g: "regler", nom: DC, k: 2, ech: false, champ: "c", v: 45 });
  assert.deepEqual(lireGeste(g("exo", { nom: DC, sens: -1 })), { n: 1794330342, ts: TS, g: "exo", nom: DC, sens: -1 });
  assert.deepEqual(lireGeste(g("reserve", { nom: DC, k: 0, e: 4 })).e, 4);
});
test("lireGeste : illisibles", () => {
  for (const m of [null, "x", { type: "plan" }, g("plus15", { n: 0 }), g("plus15", { n: 1.5 }), g("plus15", { ts: "x" }),
    g("inconnu"), g("appui"), g("annuler", { id: "" }), g("regler", { nom: DC, k: 0, ech: false, champ: "x", v: 1 }),
    g("reserve", { nom: DC, k: 0, e: 5 }), g("exo", { nom: DC, sens: 2 }), g("plus1", {})])
    assert.equal(lireGeste(m), null);
});
test("versionSuivante : croissante même horloge figée ou reculée", () => {
  assert.equal(versionSuivante(0, 1000), 1000);
  assert.equal(versionSuivante(1000, 1000), 1001);
  assert.equal(versionSuivante(5000, 1000), 5001);
});
test("messageRepos : en cours, en pause, aucun", () => {
  const minu = { nom: DC, mode: "repos", duree: 150, fin: TS + 150000, restant: null, debut: TS, effort: { nom: DC, i: 1, vise: 6 } };
  assert.deepEqual(messageRepos(minu, { v: 7, dg: 3, fait: "x", e: null }),
    { type: "repos", v: 7, dg: 3, fait: "x", r: { id: TS, fin: TS + 150000, duree: 150, p: null, nom: DC, ef: { nom: DC, k: 1, e: null } } });
  assert.equal(messageRepos({ ...minu, restant: 42.4 }, { v: 1, dg: 0, fait: null }).r.p, 42400);
  assert.equal(messageRepos({ ...minu, debut: undefined }, { v: 1, dg: 0, fait: null }).r.id, TS);
  assert.equal(messageRepos({ ...minu, effort: undefined }, { v: 1, dg: 0, fait: null }).r.ef, null);
  assert.equal(messageRepos({ ...minu, mode: "superset" }, { v: 1, dg: 0, fait: null }).r, null);
  assert.equal(messageRepos(null, { v: 1, dg: 0, fait: null }).r, null);
});
test("messagePlan : compact, un exercice par entrée de x, f = échauffement | tenue", () => {
  const ETI = "Étirement des ischios", J = "2026-11-09";
  const plan = { jour: J, v: "2026-11-09T15:53:10.000Z", etapes: [
    { id: `${J}|${DC}|e0`, nom: DC, quoi: "échauffement", txt: "22,5 kg × 10", repos: 60, ech: true, k: 0, c: 22.5, r: 10, u: null, pas: 2.5 },
    { id: `${J}|${DC}|0`, nom: DC, quoi: "série 1/4", txt: "42,5 kg × 6", repos: 150, ech: false, k: 0, c: 42.5, r: 6, u: null, pas: 2.5 },
    { id: `${J}|${ETI}|0`, nom: ETI, quoi: "série 1/2", txt: "30 s", repos: 30, ech: false, k: 0, c: 0, r: 30, u: "s", pas: 0 }] };
  const exos = { [DC]: { n: 4, ss: false, mode: "charge" }, [ETI]: { n: 2, ss: false, mode: "duree" } };
  assert.deepEqual(messagePlan(plan, exos, { v: 2, dg: 1 }), { type: "plan", v: 2, dg: 1, j: J,
    x: [[DC, 4, 2.5, 0, 0], [ETI, 2, 0, 0, 2]], e: [[0, 0, 22.5, 10, 60, 1], [0, 0, 42.5, 6, 150, 0], [1, 0, 0, 30, 30, 2]] });
  assert.deepEqual(messagePlan({ jour: J, v: null, etapes: [] }, {}, { v: 2, dg: 1 }),
    { type: "plan", v: 2, dg: 1, j: J, x: [], e: [] });
});
test("messagePlan : 30 étapes réalistes en moins de 1 Ko", () => {
  const J = "2026-11-09";
  // [nom, séries, c, r, repos, mode, ss, échauffements]
  const DEF = [["Développé couché guidé", 4, 42.5, 6, 150, "charge", false, 2], ["Développé incliné haltères", 4, 24, 8, 120, "charge", false, 0],
    ["Écarté à la poulie vis-à-vis", 3, 12.5, 12, 90, "charge", true, 0], ["Élévations latérales", 3, 8, 12, 90, "charge", true, 0],
    ["Extension triceps à la poulie haute", 4, 27.5, 10, 90, "charge", false, 0], ["Pompes déclinées", 3, 0, 15, 60, "reps", false, 0],
    ["Gainage planche", 3, 0, 45, 45, "duree", false, 0], ["Étirement des pectoraux", 2, 0, 30, 30, "duree", false, 0],
    ["Dips lestés", 2, 10, 8, 120, "charge", false, 0]];
  const etapes = [], exos = {};
  for (const [nom, n, c, r, repos, mode, ss, nech] of DEF) {
    exos[nom] = { n, ss, mode };
    const pas = mode === "charge" ? 2.5 : 0, u = mode === "duree" ? "s" : null;
    for (let k = 0; k < nech; k++)
      etapes.push({ id: `${J}|${nom}|e${k}`, nom, quoi: "échauffement", txt: `${c / 2} kg × ${r}`, repos: 60, ech: true, k, c: c / 2, r, u: null, pas });
    for (let k = 0; k < n; k++)
      etapes.push({ id: `${J}|${nom}|${k}`, nom, quoi: `série ${k + 1}/${n}${ss ? " · superset" : ""}`, txt: `${c} kg × ${r}`, repos, ech: false, k, c, r, u, pas });
  }
  const m = messagePlan({ jour: J, v: null, etapes }, exos, { v: 1794330342000, dg: 1794330342 });
  assert.equal(m.e.length, 30);
  assert.equal(m.x.length, 9);
  assert.ok(new TextEncoder().encode(JSON.stringify(m)).length < 1024);
});

test("lireGeste : regler accepte les deux champs c et r", () => {
  for (const champ of ["c", "r"])
    assert.equal(lireGeste(g("regler", { nom: DC, k: 0, ech: true, champ, v: 8 })).champ, champ);
});
test("lireGeste : chaque champ invalide rend null", () => {
  const regler = { nom: DC, k: 0, ech: false, champ: "c", v: 1 };
  const mauvais = [
    g("regler", { ...regler, ech: "oui" }), g("regler", { ...regler, ech: 0 }),
    g("regler", { ...regler, k: -1 }), g("regler", { ...regler, k: 1.5 }),
    g("regler", { ...regler, v: NaN }), g("regler", { ...regler, v: "45" }),
    g("regler", { ...regler, nom: undefined }), g("plus1", { nom: "" }),
    g("annuler", {}), g("annuler", { id: 3 }),
    g("appui", { a: "x" }), g("appui", { a: [] }), g("appui", { a: null }),
    g("reserve", { nom: DC, k: 0, e: -1 }), g("reserve", { nom: DC, k: 0, e: 1.5 }),
    g("plus15", { ts: NaN }), g("plus15", { ts: Infinity }),
  ];
  mauvais.forEach((m, i) => assert.equal(lireGeste(m), null, `cas ${i}`));
});
test("messageRepos : id = debut quand il diffère de fin - duree * 1000", () => {
  const minu = { nom: DC, mode: "repos", duree: 150, fin: TS + 150000, restant: null, debut: TS + 5 };
  assert.equal(messageRepos(minu, { v: 1, dg: 0, fait: null }).r.id, TS + 5);
});
test("messagePlan : le bit superset de x vaut 1 pour un exercice en superset", () => {
  const J = "2026-11-09", EL = "Élévations latérales";
  const plan = { jour: J, v: null, etapes: [
    { id: `${J}|${DC}|0`, nom: DC, quoi: "série 1/1", txt: "40 kg × 6", repos: 90, ech: false, k: 0, c: 40, r: 6, u: null, pas: 2.5 },
    { id: `${J}|${EL}|0`, nom: EL, quoi: "série 1/1 · superset", txt: "8 kg × 12", repos: 90, ech: false, k: 0, c: 8, r: 12, u: null, pas: 1 }] };
  const m = messagePlan(plan, { [DC]: { n: 1, ss: false, mode: "charge" }, [EL]: { n: 1, ss: true, mode: "charge" } }, { v: 1, dg: 0 });
  assert.deepEqual(m.x, [[DC, 1, 2.5, 0, 0], [EL, 1, 1, 1, 0]]);
});
test("messagePlan : exercice absent de exos, erreur claire", () => {
  const J = "2026-11-09";
  const plan = { jour: J, v: null, etapes: [{ id: "i", nom: DC, quoi: "q", txt: "t", repos: 60, ech: false, k: 0, c: 1, r: 1, u: null, pas: 0 }] };
  assert.throws(() => messagePlan(plan, {}, { v: 1, dg: 0 }), (e) => e instanceof Error && !(e instanceof TypeError) && e.message.includes(DC) && /manque/.test(e.message));
});
