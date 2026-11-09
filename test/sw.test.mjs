import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { posix } from "node:path";

const RACINE = new URL("../", import.meta.url);
const lire = (nom) => (existsSync(new URL(nom, RACINE)) ? readFileSync(new URL(nom, RACINE), "utf8") : null);
const sw = lire("sw.js");
// Déclaration en début de ligne : un ancien tableau laissé en commentaire ne compte pas.
const tableau = (nom) => {
  const m = sw.match(new RegExp(String.raw`^[ \t]*const\s+${nom}\s*=\s*\[([^\]]*)\]`, "m"));
  return m ? [...m[1].matchAll(/"([^"]*)"|'([^']*)'/g)].map((c) => c[1] ?? c[2]) : [];
};
const noms = () => [...new Set([...tableau("FICHIERS"), ...tableau("IMAGES"), "sw.js"].map((n) => (n === "./" ? "index.html" : n)))];

const local = (ref, depuis) => {
  if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(ref)) return null;
  const chemin = posix.normalize(posix.join(posix.dirname(depuis), ref.split(/[?#]/)[0]));
  return chemin.startsWith("..") ? null : chemin === "." ? "index.html" : chemin;
};

test("sw.js : chaque fichier référencé par index.html ou importé par un module listé est dans FICHIERS", () => {
  const liste = noms(), messages = [];
  const signaler = (nom, par) => { if (!liste.includes(nom)) messages.push(`${nom} manque à FICHIERS de sw.js (${par})`); };
  for (const [, , ref] of (lire("index.html") ?? "").matchAll(/\b(src|href)\s*=\s*["']([^"']*)["']/gi)) {
    const nom = local(ref, "index.html");
    if (nom) signaler(nom, "référencé par index.html");
  }
  for (const js of liste.filter((n) => /\.m?js$/.test(n) && n !== "sw.js")) {
    for (const [, ref] of (lire(js) ?? "").matchAll(/(?:^|[;\n])[ \t]*import\s+(?:[^;'"]*?\s+from\s+)?["']([^"']+)["']/g)) {
      const nom = /^\.\.?\//.test(ref) ? local(ref, js) : null;
      if (nom) signaler(nom, `importé par ${js}`);
    }
  }
  assert.deepEqual([...new Set(messages)], []);
});
test("sw.js : pont.js est dans FICHIERS", () => {
  assert.ok(tableau("FICHIERS").includes("pont.js"));
});
