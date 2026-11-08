// Logique pure des appuis venus de la montre : garde anti-doublon, série notée depuis un appui, fin du repos.
// Pur à dessein (ni DOM, ni localStorage, ni réseau) : il se teste seul, et app.js lui passe l'état en argument.

const lignes = (d) => (d?.exos || []).flatMap((e) => [...(e.series || []), ...(e.ech || [])]);

// "invalide" | "doublon" | "deja-note" | "noter"
export function verdictAppui(d, a) {
  if (!a?.id || !a.nom || !a.jour || !Number.isInteger(a.k) || a.k < 0) return "invalide";
  if (lignes(d).some((s) => s.m === a.id)) return "doublon";
  const e = d?.exos?.find((x) => x.nom === a.nom);
  const faites = (a.ech ? e?.ech : e?.series)?.length || 0;
  return faites >= a.k + 1 ? "deja-note" : "noter";
}

// Ajoute la série de l'appui à la séance `d` (créée au besoin) et la rend. Un jour excusé ne l'est plus.
export function noterAppui(d, a) {
  let e = d.exos.find((x) => x.nom === a.nom);
  if (!e) d.exos.push(e = { nom: a.nom, series: [] });
  const s = { c: a.c, r: a.r };
  if (a.u === "s") s.u = "s";
  s.t = a.t;
  s.m = a.id;
  if (a.ech) (e.ech ||= []).push(s); else e.series.push(s);
  if (d.excuse) d.excuse = null;
  return s;
}

// Instant (ms) où le repos de l'étape finit, calé sur l'appui ; null s'il n'y en a pas ou s'il est déjà passé.
export function finReposAppui(a, maintenant) {
  if (!a.repos) return null;
  const fin = (a.ts + a.repos) * 1000;
  return fin > maintenant ? fin : null;
}

// Clé de comparaison d'un plan : ignore `v` (version du document), pas les étapes.
export const clePlan = (plan) => JSON.stringify({ jour: plan.jour, etapes: plan.etapes });
