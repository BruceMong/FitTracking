// Banc d'essai : le vrai app.js chargé sous Node, dans un contexte node:vm, avec un navigateur factice.
//
// Les imports d'app.js sont retirés (même numérotation de lignes) et leurs noms fournis au contexte par le
// banc, qui importe lui-même les modules (sans DOM). Les déclarations de premier niveau d'app.js (let, const,
// function) restent visibles des scripts suivants du même contexte : evaluer() et json() les lisent et les
// changent comme le ferait la console du navigateur.
//
// Jamais de réseau : fetch rejoue `reponses`. Le temps est figé à `maintenant` ; les setTimeout attendent
// lancerMinuteurs(), les setInterval ne partent jamais.
//
// Avec l'option `pont`, le contexte reçoit un faux plugin `Capacitor.Plugins.Montre` (API du « Contrat commun »
// du plan pont), comme dans l'APK ; sans elle, pas de Capacitor : c'est Chrome.
process.env.TZ = "Europe/Paris";

import vm from "node:vm";
import { readFileSync } from "node:fs";

const RACINE = new URL("../", import.meta.url);
const IMPORT = /^import \{([^}]+)\} from "\.\/([\w.-]+)";$/gm;

// Réponses par défaut des fonctions de la base.
const DEFAUTS = {
  carnet_lire: () => ({ contexte: null, seances: [] }),
  carnet_ecrire: () => "2026-11-09T16:00:00Z",
};

// Élément du DOM factice : une propriété lue rend un autre élément (mémorisé), une écriture est gardée,
// un appel rend un élément. Assez pour que dessiner() et les écouteurs passent sans rien afficher.
function elementFactice() {
  const ecrit = new Map();
  const enfants = new Map();
  const propres = {
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  };
  const cible = () => {};
  return new Proxy(cible, {
    get(_, p) {
      if (ecrit.has(p)) return ecrit.get(p);
      if (p === Symbol.toPrimitive) return () => "";
      if (typeof p === "symbol") return undefined;
      if (p === "then") return undefined;   // un élément attendu (await) ne doit pas passer pour une promesse
      if (p in propres) return propres[p];
      if (p === "value" || p === "textContent" || p === "innerHTML") return "";
      if (!enfants.has(p)) enfants.set(p, elementFactice());
      return enfants.get(p);
    },
    set(_, p, v) { ecrit.set(p, v); return true; },
    apply() { return elementFactice(); },
  });
}

// localStorage factice : les valeurs sont des propriétés propres énumérables (Object.keys(localStorage)),
// les méthodes sont sur le prototype.
class StockageFactice {
  getItem(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; }
  setItem(k, v) { this[k] = String(v); }
  removeItem(k) { delete this[k]; }
  key(i) { return Object.keys(this)[i] ?? null; }
  get length() { return Object.keys(this).length; }
}

// Cache Storage factice, en mémoire : chaque entrée est gardée en texte.
function cachesFactices() {
  const tous = new Map();
  const ouvrir = (nom) => {
    if (!tous.has(nom)) {
      const entrees = new Map();
      tous.set(nom, {
        entrees,
        async match(k) { return entrees.has(String(k)) ? new Response(entrees.get(String(k))) : undefined; },
        async put(k, r) { entrees.set(String(k), await r.text()); },
        async delete(k) { return entrees.delete(String(k)); },
        async keys() { return [...entrees.keys()]; },
      });
    }
    return tous.get(nom);
  };
  return {
    tous,
    api: {
      async open(nom) { return ouvrir(nom); },
      async keys() { return []; },
      async has(nom) { return tous.has(nom); },
      async delete(nom) { return tous.delete(nom); },
      async match() { return undefined; },
    },
  };
}

// Copie d'un objet de la page dans le monde du test (assert.deepEqual compare aussi les prototypes, et ceux du
// contexte node:vm ne sont pas ceux d'ici).
const copier = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

// Faux plugin du pont. `envoyes` : les envoyer({ message, cle }) dans l'ordre ; `fins` : les programmerFin ;
// `acquis` : les `jusqua` acquittés ; `appels` : le nom de chaque méthode appelée (« addListener:connexion »…).
// `recevoir(message)` met un message de la montre en file (seq à partir de 1) et prévient les écouteurs
// `messages` ; `connexion(presente)` change la présence et prévient les écouteurs `connexion`.
// `etatDiffere` : etat() (lent dans l'APK, ~8 s) ne répond qu'à `rendreEtat()`, avec la présence de l'appel.
function fauxPont({ presente = true, messages = [], etatDiffere = false } = {}) {
  const ecouteurs = { messages: [], connexion: [] };
  let seq = 0, file = [], rendre = null;
  const pont = {
    envoyes: [], fins: [], acquis: [], appels: [],
    recevoir(message) {
      file.push({ seq: ++seq, message: copier(message) });
      for (const fn of ecouteurs.messages) fn({ dernier: seq });
      return seq;
    },
    connexion(p) {
      presente = p;
      for (const fn of ecouteurs.connexion) fn({ presente: p });
    },
    vider() { pont.envoyes.length = 0; pont.fins.length = 0; },
    rendreEtat() { rendre?.(); rendre = null; },
  };
  for (const m of messages) file.push({ seq: ++seq, message: copier(m) });
  const plugin = {
    etat() {
      pont.appels.push("etat");
      const x = { kit: "pret", montre: "connectee", appli: "installee", detail: "", presente, notifications: true };
      return etatDiffere ? new Promise((ok) => { rendre = () => ok(x); }) : Promise.resolve(x);
    },
    envoyer(o) {   // gardé tout de suite (un test lit envoyes sans attendre), réponse en promesse
      pont.appels.push("envoyer");
      if (!o?.message) return Promise.resolve({ ok: false, statut: "MESSAGE_INVALIDE" });
      pont.envoyes.push({ message: copier(o.message), cle: o.cle ?? null });
      return Promise.resolve({ ok: true, statut: "SUCCESS" });
    },
    async prendreMessages() {
      pont.appels.push("prendreMessages");
      return { messages: copier(file), perdus: 0 };
    },
    async acquitter(o) {
      pont.appels.push("acquitter");
      if (typeof o?.jusqua !== "number") throw Object.assign(new Error("jusqua"), { code: "MESSAGE_INVALIDE" });
      pont.acquis.push(o.jusqua);
      const avant = file.length;
      file = file.filter((x) => x.seq > o.jusqua);
      return { retires: avant - file.length };
    },
    programmerFin(o) {
      pont.appels.push("programmerFin");
      pont.fins.push(copier(o));
      return Promise.resolve({ ok: true });
    },
    async addListener(nom, fn) {
      pont.appels.push(`addListener:${nom}`);
      (ecouteurs[nom] ||= []).push(fn);
      return { remove: async () => { ecouteurs[nom] = ecouteurs[nom].filter((x) => x !== fn); } };
    },
  };
  return { pont, plugin };
}

// Le `plan` compact rebâti en étapes, par les règles de « Messages » du plan v2 : ce que fera la montre (pour
// les tests seulement ; la montre a les siennes, testées sur le même message).
const kgTxt = (c) => (c === 0 ? "pdc" : String(c).replace(".", ","));
export function deplier(m) {
  return m.e.map(([xi, k, c, r, repos, f]) => {
    const [nom, n, pas, ss, mode] = m.x[xi], ech = !!(f & 1);
    return {
      id: `${m.j}|${nom}|${ech ? "e" : ""}${k}`, nom,
      quoi: ech ? "échauffement" : `série ${k + 1}/${n}${ss ? " · superset" : ""}`,
      txt: mode === 1 ? `${r} rép.` : mode === 2 ? `${r} s` : `${kgTxt(c)} kg × ${r}`,
      repos, ech, k, c, r, u: f & 2 ? "s" : null, pas,
    };
  });
}

export async function chargerCarnet({ maintenant = "2026-11-09T17:00:00+01:00", stockage = {}, reponses = {}, pont = null } = {}) {
  const appels = [];
  const messagesSW = [];
  const minuteurs = new Map();
  let prochainMinuteur = 1;

  const localStorage = new StockageFactice();
  for (const [k, v] of Object.entries(stockage)) localStorage.setItem(k, JSON.stringify(v));

  const caches = cachesFactices();

  const elements = new Map();
  const parSelecteur = (s) => { if (!elements.has(s)) elements.set(s, elementFactice()); return elements.get(s); };
  const surDocument = {
    querySelector: parSelecteur,
    getElementById: (id) => parSelecteur(`#${id}`),
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    hidden: false,
  };
  const reste = elementFactice();
  const document = new Proxy({}, {
    get: (_, p) => (p in surDocument ? surDocument[p] : reste[p]),
    set: (_, p, v) => { surDocument[p] = v; return true; },
  });

  async function fetch(url, init = {}) {
    const m = String(url).match(/\/rest\/v1\/rpc\/([\w-]+)$/);
    if (!m) throw new TypeError(`banc : réseau interdit (${url})`);
    const fonction = m[1];
    const corps = init.body ? JSON.parse(init.body) : null;
    appels.push({ fonction, corps });
    const repondre = reponses[fonction] ?? DEFAUTS[fonction] ?? (() => null);
    try {
      const valeur = await repondre(corps);
      return new Response(JSON.stringify(valeur ?? null), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (err) {
      if (err?.status == null) throw err;   // une vraie panne du banc ou du test, pas une réponse HTTP
      return new Response(JSON.stringify({ code: err.code ?? null, message: err.message ?? "" }),
        { status: err.status, headers: { "Content-Type": "application/json" } });
    }
  }

  const contexte = {
    document,
    localStorage,
    navigator: {
      onLine: true,
      vibrate() {},
      serviceWorker: {
        controller: { postMessage: (m) => messagesSW.push(m) },
        register() {},
        addEventListener() {},
      },
    },
    caches: caches.api,
    fetch,
    setTimeout: (fn, ms, ...args) => { const id = prochainMinuteur++; minuteurs.set(id, { fn, ms, args }); return id; },
    clearTimeout: (id) => { minuteurs.delete(id); },
    setInterval: () => prochainMinuteur++,
    clearInterval() {},
    location: { hash: "", pathname: "/", search: "", reload() {} },
    history: { state: null, pushState() {}, replaceState() {}, back() {} },
    addEventListener() {},
    removeEventListener() {},
    console,
    Response,
    URL,
    setImmediate,
  };
  const faux = pont ? fauxPont(pont) : null;
  if (faux) contexte.Capacitor = { Plugins: { Montre: faux.plugin } };

  // Les modules importés par app.js, fournis au contexte sous les mêmes noms.
  let code = readFileSync(new URL("app.js", RACINE), "utf8");
  const modules = [...code.matchAll(IMPORT)];
  for (const [, noms, fichier] of modules) {
    const mod = await import(new URL(fichier, RACINE));
    for (const nom of noms.split(",").map((x) => x.trim()).filter(Boolean)) {
      const [source, local = source] = nom.split(/\s+as\s+/);
      if (!(source in mod)) throw new Error(`banc : ${fichier} n'exporte pas ${source}`);
      contexte[local] = mod[source];
    }
  }
  code = code.replace(IMPORT, "");
  if (/^import\s/m.test(code)) throw new Error("banc : import d'app.js non reconnu");
  code = `"use strict"; ${code}`;

  vm.createContext(contexte);
  // window = le global lui-même ; Date figé à `maintenant` (instant sans argument et Date.now()).
  vm.runInContext(`globalThis.window = globalThis;
    (() => {
      const Vraie = Date, M = ${JSON.stringify(Date.parse(maintenant))};
      globalThis.Date = class Date extends Vraie {
        constructor(...a) { if (a.length) super(...a); else super(M); }
        static now() { return M; }
      };
    })();`, contexte);
  new vm.Script(code, { filename: "app.js" }).runInContext(contexte);

  const evaluer = (c) => vm.runInContext(c, contexte);
  const json = (expr) => {
    const t = evaluer(`JSON.stringify((${expr}))`);
    return t === undefined ? undefined : JSON.parse(t);
  };
  const attendre = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };

  const banc = {
    json,
    evaluer,
    stockage() {
      const o = {};
      for (const k of Object.keys(localStorage)) {
        try { o[k] = JSON.parse(localStorage[k]); } catch { o[k] = localStorage[k]; }
      }
      return o;
    },
    appels,
    messagesSW,
    pont: faux?.pont ?? null,
    // Synchrone : le cache factice garde le texte de chaque entrée (null si le journal n'a jamais été écrit).
    journalMontre() {
      const c = caches.tous.get("carnet-montre");
      return c?.entrees.has("journal") ? JSON.parse(c.entrees.get("journal")) : null;
    },
    attendre,
    lancerMinuteurs() {
      const enAttente = [...minuteurs.entries()];
      for (const [id] of enAttente) minuteurs.delete(id);
      for (const [, { fn, args }] of enAttente) if (typeof fn === "function") fn(...args);
    },
  };
  await attendre();
  return banc;
}
