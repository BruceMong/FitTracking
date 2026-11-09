import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnet } from "./banc.mjs";

// Clés fausses : le vrai secret n'apparaît jamais dans les tests.
const CLE = "abcdefghijklmnopqrstu";

test("collerCle : clé gardée sans espaces autour, lecture du serveur lancée", async () => {
  const b = await chargerCarnet({ pont: {} });
  assert.equal(b.json("cle"), null);
  assert.equal(b.json(`collerCle("  ${CLE}  ")`), true);
  await b.attendre();
  assert.equal(b.stockage()["carnet:cle"], CLE);
  assert.equal(b.json("cle"), CLE);
  assert.equal(b.json("cleRefusee"), false);
  assert.ok(b.appels.some((a) => a.fonction === "carnet_lire" && a.corps.p_cle === CLE));
});

test("collerCle : vide, avec espace ou trop courte : refusée, rien d'écrit", async () => {
  const b = await chargerCarnet({ pont: {} });
  for (const t of ["", "   ", "abc def ghijklmnopq", "court", "abcdefghijklmn"]) {
    assert.equal(b.json(`collerCle(${JSON.stringify(t)})`), false, t);
  }
  assert.equal(b.json("cle"), null);
  assert.equal("carnet:cle" in b.stockage(), false);
  assert.equal(b.appels.length, 0);
});

test("clé refusée par le serveur : oubliée, le message le dit", async () => {
  const b = await chargerCarnet({
    pont: {}, stockage: { "carnet:cle": "cle-refusee-essai-1" },
    reponses: { carnet_lire: () => { throw { status: 401, code: "28000", message: "refusée" }; } },
  });
  await b.attendre();
  assert.equal(b.json("cle"), null);
  assert.equal(b.json("cleRefusee"), true);
  assert.equal("carnet:cle" in b.stockage(), false);
});

test("accueil sans clé : le champ n'existe que dans l'APK", async () => {
  const apk = await chargerCarnet({ pont: {} });
  const html = apk.json("accueilSansCle()");
  assert.match(html, /id="cle-collee"/);
  assert.match(html, /type="password"/);
  assert.match(html, /autocomplete="off"/);
  assert.match(html, /autocapitalize="off"/);
  assert.match(html, /data-cle-coller/);
  assert.doesNotMatch(html, /refusée/);
  apk.evaluer("cleRefusee = true");
  assert.match(apk.json("accueilSansCle()"), /Clé refusée par le serveur/);

  const chrome = await chargerCarnet();
  const v1 = chrome.json("accueilSansCle()");
  assert.doesNotMatch(v1, /cle-collee|data-cle-coller|password/);
  assert.match(v1, /carnet-sync --lien/);
});
