import { test } from "node:test";
import assert from "node:assert/strict";
import { verdictAppui, noterAppui, finReposAppui, clePlan } from "../montre.js";

const ID = "2026-11-09|Développé couché guidé|0";
const a = { id: ID, nom: "Développé couché guidé", jour: "2026-11-09", quand: "série 1/4", ech: false, k: 0,
            c: 40, r: 5, t: "16:58:00", ts: 1794329880, repos: 150 };
const seance = (exos) => ({ jour: "2026-11-09", type: "push", exos, note: "" });

test("verdict : appui illisible", () => {
  for (const x of [{}, { ...a, id: "" }, { ...a, nom: undefined }, { ...a, k: -1 }, { ...a, k: 1.5 }])
    assert.equal(verdictAppui(seance([]), x), "invalide");
});
test("verdict : id déjà porté par une série du jour, même d'un autre exercice ou en échauffement", () => {
  assert.equal(verdictAppui(seance([{ nom: "Autre", series: [{ c: 1, r: 1, m: ID }] }]), a), "doublon");
  assert.equal(verdictAppui(seance([{ nom: a.nom, series: [], ech: [{ c: 1, r: 1, m: ID }] }]), a), "doublon");
});
test("verdict : rang déjà occupé au téléphone", () => {
  assert.equal(verdictAppui(seance([{ nom: a.nom, series: [{ c: 42.5, r: 6 }] }]), a), "deja-note");
  assert.equal(verdictAppui(seance([{ nom: a.nom, series: [], ech: [{ c: 20, r: 10 }] }]), { ...a, ech: true }), "deja-note");
});
test("verdict : à noter (séance absente, rang libre, rang au-delà)", () => {
  assert.equal(verdictAppui(null, a), "noter");
  assert.equal(verdictAppui(seance([{ nom: a.nom, series: [{ c: 42.5, r: 6 }] }]), { ...a, k: 1 }), "noter");
  assert.equal(verdictAppui(seance([{ nom: a.nom, series: [{ c: 42.5, r: 6 }] }]), { ...a, k: 3 }), "noter");
});
test("noterAppui : la série telle que faite, à l'heure de l'appui", () => {
  const d = seance([]);
  noterAppui(d, a);
  assert.deepEqual(d.exos, [{ nom: a.nom, series: [{ c: 40, r: 5, t: "16:58:00", m: ID }] }]);
});
test("noterAppui : échauffement, tenue, jour excusé", () => {
  const d = { ...seance([]), excuse: { tag: "fatigue", texte: "" } };
  noterAppui(d, { ...a, id: "x|e0", ech: true, c: 20, r: 10 });
  assert.deepEqual(d.exos[0], { nom: a.nom, series: [], ech: [{ c: 20, r: 10, t: "16:58:00", m: "x|e0" }] });
  assert.equal(d.excuse, null);
  noterAppui(d, { ...a, id: "y|0", nom: "Gainage", c: 0, r: 45, u: "s" });
  assert.deepEqual(d.exos[1].series, [{ c: 0, r: 45, u: "s", t: "16:58:00", m: "y|0" }]);
});
test("finReposAppui : fin calée sur l'appui, ou rien", () => {
  assert.equal(finReposAppui(a, 1794329900000), 1794330030000);
  assert.equal(finReposAppui(a, 1794330030000), null);
  assert.equal(finReposAppui({ ...a, repos: 0 }, 0), null);
  assert.equal(finReposAppui({ ...a, repos: undefined }, 0), null);
});
test("clePlan ignore v, pas les étapes", () => {
  const p = { jour: "2026-11-09", v: "a", etapes: [{ id: ID }] };
  assert.equal(clePlan(p), clePlan({ ...p, v: "b" }));
  assert.notEqual(clePlan(p), clePlan({ ...p, etapes: [] }));
});
