import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";
import { TRI, avecCtx } from "./fixtures.mjs";

const q = JSON.stringify;

test("ajout : groupé par muscle, alias cherchés mais pas affichés", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  assert.deepEqual(b.json(`listeAjout("", null)`).map((g) => g.groupe), ["pecs", "triceps", "épaules"]);
  assert.deepEqual(b.json(`listeAjout("tri", null)`), [{ groupe: "triceps", noms: [TRI] }]);
});
test("remplacer : le muscle de l'exercice remplacé d'abord, sans lui-même", async () => {
  const b = await chargerCarnet({ stockage: avecCtx() });
  const l = b.json(`listeAjout("", ${q(TRI)})`);
  assert.ok(l.every((g) => !g.noms.includes(TRI)));
});
