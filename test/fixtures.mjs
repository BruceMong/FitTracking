// Données d'essai partagées : un jour (lundi 9 novembre 2026), une séance push, trois exercices dont une
// paire en superset, et la dernière fois de deux d'entre eux.
export const JOUR = "2026-11-09";
export const DC = "Développé couché guidé";
export const TRI = "Triceps poulie basse";
export const ELE = "Élévations latérales";

export const ctxPush = {
  rotation: ["push", "pull", "legs", "repos"],
  programme: { push: [DC, TRI, ELE] },
  exercices: [
    { nom: DC, seance: "push", groupe: "pecs", schema: { series: 4, reps: 6 } },
    { nom: TRI, seance: "push", groupe: "triceps", schema: { series: 3, reps: 12 } },
    { nom: ELE, seance: "push", groupe: "épaules", schema: { series: 3, reps: 12 } },
  ],
  supersets: { [TRI]: ELE, [ELE]: TRI },
  historique: {
    [DC]: { jour: "2026-11-05", series: [[42.5, 6], [42.5, 6], [42.5, 5], [42.5, 5]] },   // cible 42,5 × 6
    [ELE]: { jour: "2026-11-05", series: [[8, 12], [8, 12], [8, 12]] },                      // tenu → 8 × 9
  },
};

// Le stockage d'un téléphone qui a reçu le contexte du PC, plus d'autres clés.
export const avecCtx = (plus = {}) => ({ "carnet:ctx": ctxPush, ...plus });

// La séance du jour déjà commencée au téléphone (entrée carnet:seance:2026-11-09).
export const enCours = (series, plus = {}) => ({
  "carnet:seance:2026-11-09": {
    doc: { jour: JOUR, type: "push", exos: [{ nom: DC, series }], note: "", maj: "2026-11-09T15:53:10.000Z", ...plus },
    sale: false,
  },
});
