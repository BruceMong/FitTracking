// Pont carnet ↔ montre (via le plugin de l'APK) : fonctions pures, sans DOM ni localStorage.
// Le contrat des messages est dans le plan v2 (« Messages ») ; ici, la lecture des gestes reçus de la montre et
// la fabrication des messages `plan` (compact) et `repos`.

export const GESTES = ["appui", "annuler", "plus15", "moins15", "pause", "reprendre", "passer", "regler",
  "reserve", "plus1", "exo"];

const chaine = (s) => typeof s === "string" && s !== "";
const entier = (n, min) => Number.isInteger(n) && n >= min;
const fini = (n) => typeof n === "number" && Number.isFinite(n);
const objet = (o) => o !== null && typeof o === "object" && !Array.isArray(o);

// Pour chaque geste : les champs propres et leur contrôle (champs inconnus retirés).
const CHAMPS = {
  appui: { a: objet },
  annuler: { id: chaine },
  plus15: {}, moins15: {}, pause: {}, reprendre: {}, passer: {},
  regler: { nom: chaine, k: (k) => entier(k, 0), ech: (b) => typeof b === "boolean", champ: (c) => c === "c" || c === "r", v: fini },
  reserve: { nom: chaine, k: (k) => entier(k, 0), e: (e) => Number.isInteger(e) && e >= 0 && e <= 4 },
  plus1: { nom: chaine },
  exo: { nom: chaine, sens: (s) => s === 1 || s === -1 },
};

/** Le geste lisible `{ n, ts, g, …champs de g }`, ou null s'il est illisible. */
export function lireGeste(m) {
  if (!objet(m) || m.type !== "geste" || !entier(m.n, 1) || !fini(m.ts) || !GESTES.includes(m.g)) return null;
  const sortie = { n: m.n, ts: m.ts, g: m.g };
  for (const [champ, ok] of Object.entries(CHAMPS[m.g])) {
    if (!ok(m[champ])) return null;
    sortie[champ] = m[champ];
  }
  return sortie;
}

/** Version d'état strictement croissante, même si l'horloge est figée ou reculée. */
export const versionSuivante = (derniere, maintenant) => Math.max(maintenant, (derniere || 0) + 1);

/** Le message `repos` ; `r` est null hors d'un repos. */
export function messageRepos(minu, { v, dg, fait, e }) {
  let r = null;
  if (minu?.mode === "repos") {
    const ef = minu.effort ? { nom: minu.effort.nom, k: minu.effort.i, e: e ?? null } : null;
    r = { id: minu.debut ?? minu.fin - minu.duree * 1000, fin: minu.fin, duree: minu.duree,
      p: minu.restant == null ? null : Math.round(minu.restant * 1000), nom: minu.nom, ef };
  }
  return { type: "repos", v, dg, fait, r };
}

const MODES = { charge: 0, reps: 1, duree: 2 };

/** Le message `plan` compact : exercices dans `x` (ordre de première apparition), étapes dans `e`. */
export function messagePlan(plan, exos, { v, dg }) {
  const x = [], rang = new Map(), e = [];
  for (const et of plan.etapes) {
    if (!rang.has(et.nom)) {
      const ex = exos[et.nom];
      rang.set(et.nom, x.length);
      x.push([et.nom, ex.n, et.pas ?? 0, ex.ss ? 1 : 0, MODES[ex.mode] ?? 0]);
    }
    e.push([rang.get(et.nom), et.k, et.c, et.r, et.repos, (et.ech ? 1 : 0) | (et.u === "s" ? 2 : 0)]);
  }
  return { type: "plan", v, dg, j: plan.jour, x, e };
}
