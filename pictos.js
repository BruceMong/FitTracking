// Schémas des exercices sans photo (posture, mobilité) : des pictogrammes dessinés ici, deux ou trois
// positions par exercice, pour un rappel d'un coup d'œil sans lancer la vidéo.
//
// Une pose est un squelette en 2D : la hanche H, puis chaque segment par sa direction absolue en
// degrés (0 = vers le bas, 90 = vers la droite, 180 = vers le haut, 270 = vers la gauche). Les
// membres « loin » (le côté caché) sont dessinés plus clair, sous les autres.

const L = { tronc: 50, cou: 9, tete: 9, bras: 29, avantBras: 27, cuisse: 42, jambe: 40, pied: 12 };
const rad = (a) => (a * Math.PI) / 180;
const pt = ([x, y], a, l) => [x + Math.sin(rad(a)) * l, y + Math.cos(rad(a)) * l];

function squelette(p) {
  const H = p.H, S = pt(H, p.tronc, L.tronc), N = pt(S, p.cou ?? p.tronc, L.cou);
  const T = pt(N, p.cou ?? p.tronc, L.tete);
  // De face (ou de dessus) : épaules et hanches ont une largeur, chaque bras et chaque jambe part de son côté.
  const larg = (P, l, i) => (p.face ? pt(P, p.tronc + (i ? -90 : 90), l) : P);
  const bras = (p.bras || []).map(([a, b], i) => { const O = larg(S, 14, i), C = pt(O, a, L.bras); return [O, C, pt(C, b, L.avantBras)]; });
  const jambes = (p.jambes || []).map(([a, b, c], i) => {
    const O = larg(H, 8, i), G = pt(O, a, L.cuisse), K = pt(G, b, L.jambe);
    return [O, G, K, pt(K, c ?? b + 90, L.pied)];
  });
  const epaules = p.face ? [larg(S, 14, 0), larg(S, 14, 1)] : null, hanches = p.face ? [larg(H, 8, 0), larg(H, 8, 1)] : null;
  return { H, S, N, T, bras, jambes, epaules, hanches };
}

const trace = (pts) => "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");

// Le dessin d'une pose : accessoires (sol, mur, serviette, élastique, flèches) puis le corps.
function svgPose(p, cadre = [0, 0, 200, 150]) {
  const k = squelette(p), out = [];
  const trait = (d, cls) => out.push(`<path d="${d}" class="${cls}"/>`);
  for (const a of p.acc || []) {
    if (a.sol != null) out.push(`<line x1="${cadre[0]}" y1="${a.sol}" x2="${cadre[0] + cadre[2]}" y2="${a.sol}" class="p-sol"/>`);
    if (a.mur != null) out.push(`<line x1="${a.mur}" y1="${cadre[1]}" x2="${a.mur}" y2="${cadre[1] + cadre[3]}" class="p-sol"/>`);
    if (a.rouleau) out.push(`<circle cx="${a.rouleau[0]}" cy="${a.rouleau[1]}" r="${a.rouleau[2] || 5}" class="p-acc"/>`);
    if (a.rect) out.push(`<rect x="${a.rect[0]}" y="${a.rect[1]}" width="${a.rect[2]}" height="${a.rect[3]}" rx="2" class="p-acc"/>`);
  }
  // Le côté caché d'abord, plus clair.
  const loin = (i) => (p.loin || []).includes(i);
  k.jambes.forEach((j, i) => loin(`j${i}`) && trait(trace(j), "p-loin"));
  k.bras.forEach((b, i) => loin(`b${i}`) && trait(trace(b), "p-loin"));
  trait(trace([k.H, k.S, k.N]), "p-corps");
  if (k.epaules) { trait(trace(k.epaules), "p-corps"); trait(trace(k.hanches), "p-corps"); }
  k.jambes.forEach((j, i) => !loin(`j${i}`) && trait(trace(j), "p-corps"));
  k.bras.forEach((b, i) => !loin(`b${i}`) && trait(trace(b), "p-corps"));
  out.push(`<circle cx="${k.T[0].toFixed(1)}" cy="${k.T[1].toFixed(1)}" r="${L.tete}" class="p-tete"/>`);
  if (p.regard != null) { const [x, y] = pt(k.T, p.regard, L.tete + 2.5); out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" class="p-nez"/>`); }
  for (const a of p.acc || []) {
    if (a.elastique) { const [m1, m2] = [k.bras[0][2], k.bras[1][2]]; out.push(`<path d="${trace([m1, m2])}" class="p-elastique"/>`); }
    if (a.fleche) {
      const [[x1, y1], [x2, y2], c = 0] = a.fleche, mx = (x1 + x2) / 2 - (y2 - y1) * c, my = (y1 + y2) / 2 + (x2 - x1) * c;
      out.push(`<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" class="p-fleche" marker-end="url(#pointe)"/>`);
    }
    if (a.texte) out.push(`<text x="${a.texte[0]}" y="${a.texte[1]}" class="p-texte">${a.texte[2]}</text>`);
  }
  return `<svg viewBox="${cadre.join(" ")}" class="picto" aria-hidden="true"><defs><marker id="pointe" viewBox="0 0 10 10" refX="7" refY="5"
    markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="p-pointe"/></marker></defs>${out.join("")}</svg>`;
}

// Raccourcis de poses.
const debout = (x, y, plus = {}) => ({ H: [x, y], tronc: 180, regard: 90, bras: [[0, 0], [0, 0]], jambes: [[0, 0], [0, 0]], loin: ["b1", "j1"], ...plus });

// nom exact (exercices.md) → [{titre, pose, cadre}]
export const PICTOS = {
  "Respiration allongé sur le côté": [
    { titre: "vu de dessus : sur le côté, hanches et genoux à 90°, inspirer par le nez", pose: { H: [125, 60], tronc: 270, cou: 270, bras: [[0, 0], [10, 300]],
      jambes: [[0, 90, 90], [5, 95, 95]], loin: ["j1", "b1"], acc: [{ rect: [44, 50, 14, 20] }, { fleche: [[100, 30], [100, 44], 0] }] } },
    { titre: "souffler longtemps : les côtes descendent", pose: { H: [125, 60], tronc: 270, cou: 270, bras: [[0, 0], [10, 300]],
      jambes: [[0, 90, 90], [5, 95, 95]], loin: ["j1", "b1"], acc: [{ rect: [44, 50, 14, 20] }, { fleche: [[100, 44], [100, 30], 0] }] } },
  ],
  "Chin tuck sur serviette": [
    { titre: "sur le dos, serviette roulée sous la nuque", pose: { H: [130, 112], tronc: 270, cou: 270, regard: 180, bras: [[90, 90], [90, 90]],
      jambes: [[140, 30, 90], [140, 30, 90]], loin: ["j1", "b1"], acc: [{ sol: 122 }, { rouleau: [76, 119, 5] }] } },
    { titre: "rentrer le menton, l'arrière de la tête glisse sur le sol", pose: { H: [130, 112], tronc: 270, cou: 270, regard: 140, bras: [[90, 90], [90, 90]],
      jambes: [[140, 30, 90], [140, 30, 90]], loin: ["j1", "b1"], acc: [{ sol: 122 }, { rouleau: [76, 119, 5] }, { fleche: [[50, 86], [70, 92], -0.4] }] } },
  ],
  "I-Y-T à plat ventre": [
    { titre: "I : bras dans l'axe, pouces en l'air", cadre: [0, 0, 200, 110], pose: { face: true, H: [130, 55], tronc: 270, cou: 270, bras: [[268, 268], [272, 272]],
      jambes: [[95, 90], [85, 90]] } },
    { titre: "Y : en diagonale", cadre: [0, 0, 200, 110], pose: { face: true, H: [130, 55], tronc: 270, cou: 270, bras: [[310, 310], [230, 230]],
      jambes: [[95, 90], [85, 90]] } },
    { titre: "T : à l'horizontale", cadre: [0, 0, 200, 110], pose: { face: true, H: [130, 55], tronc: 270, cou: 270, bras: [[0, 0], [180, 180]],
      jambes: [[95, 90], [85, 90]] } },
  ],
  "Enfiler l'aiguille": [
    { titre: "à quatre pattes, ouvrir un bras vers le plafond", pose: { H: [130, 74], tronc: 254, cou: 250, regard: 0, bras: [[0, 0], [178, 180]],
      jambes: [[0, 90, 90], [0, 90, 90]], loin: ["j1", "b0"], acc: [{ sol: 117 }, { fleche: [[62, 12], [48, 34], -0.4] }] } },
    { titre: "le glisser sous le corps, épaule et tempe au sol", pose: { H: [130, 74], tronc: 262, cou: 265, regard: 20, bras: [[330, 0], [20, 80]],
      jambes: [[0, 90, 90], [0, 90, 90]], loin: ["j1", "b0"], acc: [{ sol: 117 }, { fleche: [[96, 104], [118, 110], 0] }] } },
  ],
  "Mobilité de cheville genou en avant": [
    { titre: "un genou au sol, pied avant à plat", pose: { H: [92, 100], tronc: 180, regard: 90, bras: [[45, 70], [35, 60]],
      jambes: [[90, 0, 90], [0, 270, 270]], loin: ["j1", "b1"], acc: [{ sol: 142 }] } },
    { titre: "avancer le genou au-dessus des orteils, talon collé au sol", pose: { H: [100, 100], tronc: 178, regard: 90, bras: [[50, 75], [40, 65]],
      jambes: [[85, 340, 90], [350, 270, 270]], loin: ["j1", "b1"], acc: [{ sol: 142 }, { fleche: [[146, 92], [162, 98], 0] }] } },
  ],
  "Étirement des pectoraux au mur": [
    { titre: "de face : bras tendu à hauteur d'épaule, paume au mur", cadre: [0, 0, 200, 170], pose: { face: true, H: [118, 92], tronc: 180, bras: [[270, 270], [355, 0]],
      jambes: [[4, 0, 300], [356, 0, 60]], acc: [{ mur: 49 }, { sol: 168 }] } },
    { titre: "tourner le buste à l'opposé du mur jusqu'à sentir le pec", cadre: [0, 0, 200, 170], pose: { face: true, H: [122, 92], tronc: 177, bras: [[268, 268], [350, 0]],
      jambes: [[4, 0, 300], [356, 0, 60]], acc: [{ mur: 49 }, { sol: 168 }, { fleche: [[142, 30], [168, 42], -0.4] }] } },
  ],
  "Wall angel": [
    { titre: "de face, dos au mur : bras en W, avant-bras au mur", cadre: [0, 0, 200, 170], pose: { face: true, H: [100, 92], tronc: 180, bras: [[240, 185], [120, 175]],
      jambes: [[4, 0, 300], [356, 0, 60]], acc: [{ sol: 168 }] } },
    { titre: "monter en Y sans décoller ni cambrer", cadre: [0, 0, 200, 170], pose: { face: true, H: [100, 92], tronc: 180, bras: [[210, 205], [150, 155]],
      jambes: [[4, 0, 300], [356, 0, 60]], acc: [{ sol: 168 }, { fleche: [[148, 46], [158, 18], 0] }] } },
  ],
};

export function pictosDe(nom) {
  const p = PICTOS[nom];
  if (!p) return "";
  return `<div class="f-pictos n${p.length}">${p.map((x) => `<figure>${svgPose(x.pose, x.cadre)}<figcaption>${x.titre}</figcaption></figure>`).join("")}</div>`;
}
