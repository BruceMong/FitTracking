// Hors ligne : l'appli elle-même vient du cache (la salle capte mal), les appels à la base
// passent toujours par le réseau — les séances en attente sont gardées par app.js.
const VERSION = "fittracking-v49";
const FICHIERS = ["./", "index.html", "app.js", "fiches.js", "pictos.js", "corps.js", "montre.js", "pont.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];
// Les photos des fiches d'exercice (~1 Mo), en cache dès l'installation : la salle capte mal.
const IMAGES = [
  "fiches/Band_Pull_Apart-0.jpg",
  "fiches/Band_Pull_Apart-1.jpg",
  "fiches/Barbell_Bench_Press_-_Medium_Grip-0.jpg",
  "fiches/Barbell_Bench_Press_-_Medium_Grip-1.jpg",
  "fiches/Barbell_Incline_Bench_Press_-_Medium_Grip-0.jpg",
  "fiches/Barbell_Incline_Bench_Press_-_Medium_Grip-1.jpg",
  "fiches/Barbell_Shrug-0.jpg",
  "fiches/Barbell_Shrug-1.jpg",
  "fiches/Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench-0.jpg",
  "fiches/Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench-1.jpg",
  "fiches/Bodyweight_Squat-0.jpg",
  "fiches/Bodyweight_Squat-1.jpg",
  "fiches/Butt_Lift_Bridge-0.jpg",
  "fiches/Butt_Lift_Bridge-1.jpg",
  "fiches/Cable_Internal_Rotation-0.jpg",
  "fiches/Cable_Internal_Rotation-1.jpg",
  "fiches/Calf_Stretch_Hands_Against_Wall-0.jpg",
  "fiches/Calf_Stretch_Hands_Against_Wall-1.jpg",
  "fiches/Dead_Bug-0.jpg",
  "fiches/Dead_Bug-1.jpg",
  "fiches/Dips_-_Chest_Version-0.jpg",
  "fiches/Dips_-_Chest_Version-1.jpg",
  "fiches/Dumbbell_Flyes-0.jpg",
  "fiches/Dumbbell_Flyes-1.jpg",
  "fiches/Dumbbell_Shoulder_Press-0.jpg",
  "fiches/Dumbbell_Shoulder_Press-1.jpg",
  "fiches/External_Rotation_with_Band-0.jpg",
  "fiches/External_Rotation_with_Band-1.jpg",
  "fiches/Hanging_Leg_Raise-0.jpg",
  "fiches/Hanging_Leg_Raise-1.jpg",
  "fiches/Hug_Knees_To_Chest-0.jpg",
  "fiches/Hug_Knees_To_Chest-1.jpg",
  "fiches/Hyperextensions_Back_Extensions-0.jpg",
  "fiches/Hyperextensions_Back_Extensions-1.jpg",
  "fiches/Incline_Dumbbell_Curl-0.jpg",
  "fiches/Incline_Dumbbell_Curl-1.jpg",
  "fiches/Inverted_Row-0.jpg",
  "fiches/Inverted_Row-1.jpg",
  "fiches/Kneeling_Hip_Flexor-0.jpg",
  "fiches/Kneeling_Hip_Flexor-1.jpg",
  "fiches/Lying_Dumbbell_Tricep_Extension-0.jpg",
  "fiches/Lying_Dumbbell_Tricep_Extension-1.jpg",
  "fiches/Lying_Face_Down_Plate_Neck_Resistance-0.jpg",
  "fiches/Lying_Face_Down_Plate_Neck_Resistance-1.jpg",
  "fiches/Lying_Face_Up_Plate_Neck_Resistance-0.jpg",
  "fiches/Lying_Face_Up_Plate_Neck_Resistance-1.jpg",
  "fiches/Machine_Preacher_Curls-0.jpg",
  "fiches/Machine_Preacher_Curls-1.jpg",
  "fiches/Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench-0.jpg",
  "fiches/Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench-1.jpg",
  "fiches/Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench-0.jpg",
  "fiches/Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench-1.jpg",
  "fiches/Push-Ups_-_Close_Triceps_Position-0.jpg",
  "fiches/Push-Ups_-_Close_Triceps_Position-1.jpg",
  "fiches/Pushups-0.jpg",
  "fiches/Pushups-1.jpg",
  "fiches/Reverse_Barbell_Curl-0.jpg",
  "fiches/Reverse_Barbell_Curl-1.jpg",
  "fiches/Romanian_Deadlift-0.jpg",
  "fiches/Romanian_Deadlift-1.jpg",
  "fiches/Rope_Straight-Arm_Pulldown-0.jpg",
  "fiches/Rope_Straight-Arm_Pulldown-1.jpg",
  "fiches/Side_Lateral_Raise-0.jpg",
  "fiches/Side_Lateral_Raise-1.jpg",
  "fiches/Side_Neck_Stretch-0.jpg",
  "fiches/Side_Neck_Stretch-1.jpg",
  "fiches/Single_Leg_Glute_Bridge-0.jpg",
  "fiches/Single_Leg_Glute_Bridge-1.jpg",
  "fiches/Split_Squat_with_Dumbbells-0.jpg",
  "fiches/Split_Squat_with_Dumbbells-1.jpg",
  "fiches/Standing_Biceps_Cable_Curl-0.jpg",
  "fiches/Standing_Biceps_Cable_Curl-1.jpg",
  "fiches/Straight-Arm_Dumbbell_Pullover-0.jpg",
  "fiches/Straight-Arm_Dumbbell_Pullover-1.jpg",
  "fiches/Superman-0.jpg",
  "fiches/Superman-1.jpg",
  "fiches/Tricep_Dumbbell_Kickback-0.jpg",
  "fiches/Tricep_Dumbbell_Kickback-1.jpg",
  "fiches/Worlds_Greatest_Stretch-0.jpg",
  "fiches/Worlds_Greatest_Stretch-1.jpg",
  "fiches/Butterfly-0.jpg",
  "fiches/Butterfly-1.jpg",
  "fiches/Cable_Crossover-0.jpg",
  "fiches/Cable_Crossover-1.jpg",
  "fiches/Cable_Crunch-0.jpg",
  "fiches/Cable_Crunch-1.jpg",
  "fiches/Cable_Rear_Delt_Fly-0.jpg",
  "fiches/Cable_Rear_Delt_Fly-1.jpg",
  "fiches/Cable_Rope_Overhead_Triceps_Extension-0.jpg",
  "fiches/Cable_Rope_Overhead_Triceps_Extension-1.jpg",
  "fiches/Cable_Seated_Lateral_Raise-0.jpg",
  "fiches/Cable_Seated_Lateral_Raise-1.jpg",
  "fiches/Dumbbell_Bicep_Curl-0.jpg",
  "fiches/Dumbbell_Bicep_Curl-1.jpg",
  "fiches/Face_Pull-0.jpg",
  "fiches/Face_Pull-1.jpg",
  "fiches/Hammer_Curls-0.jpg",
  "fiches/Hammer_Curls-1.jpg",
  "fiches/Dumbbell_Bench_Press-0.jpg",
  "fiches/Dumbbell_Bench_Press-1.jpg",
  "fiches/Incline_Dumbbell_Press-0.jpg",
  "fiches/Incline_Dumbbell_Press-1.jpg",
  "fiches/Leg_Extensions-0.jpg",
  "fiches/Leg_Extensions-1.jpg",
  "fiches/Leg_Press-0.jpg",
  "fiches/Leg_Press-1.jpg",
  "fiches/Machine_Shoulder_Military_Press-0.jpg",
  "fiches/Machine_Shoulder_Military_Press-1.jpg",
  "fiches/Pullups-0.jpg",
  "fiches/Pullups-1.jpg",
  "fiches/Reverse_Machine_Flyes-0.jpg",
  "fiches/Reverse_Machine_Flyes-1.jpg",
  "fiches/Seated_Cable_Rows-0.jpg",
  "fiches/Seated_Cable_Rows-1.jpg",
  "fiches/Seated_Leg_Curl-0.jpg",
  "fiches/Seated_Leg_Curl-1.jpg",
  "fiches/Smith_Machine_Bench_Press-0.jpg",
  "fiches/Smith_Machine_Bench_Press-1.jpg",
  "fiches/Smith_Machine_Incline_Bench_Press-0.jpg",
  "fiches/Smith_Machine_Incline_Bench_Press-1.jpg",
  "fiches/Standing_Calf_Raises-0.jpg",
  "fiches/Standing_Calf_Raises-1.jpg",
  "fiches/Standing_Leg_Curl-0.jpg",
  "fiches/Standing_Leg_Curl-1.jpg",
  "fiches/Thigh_Abductor-0.jpg",
  "fiches/Thigh_Abductor-1.jpg",
  "fiches/Thigh_Adductor-0.jpg",
  "fiches/Thigh_Adductor-1.jpg",
  "fiches/Triceps_Pushdown-0.jpg",
  "fiches/Triceps_Pushdown-1.jpg",
  "fiches/Walking_Treadmill-0.jpg",
  "fiches/Walking_Treadmill-1.jpg",
  "fiches/Wide-Grip_Lat_Pulldown-0.jpg",
  "fiches/Wide-Grip_Lat_Pulldown-1.jpg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll([...FICHIERS, ...IMAGES])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== MONTRE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Réseau d'abord pour l'appli (une nouvelle version arrive dès qu'on capte), cache sinon.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    // no-cache : le navigateur revalide auprès du serveur au lieu de resservir sa copie HTTP (10 min sur
    // GitHub Pages), sans quoi une nouvelle version mettait jusqu'à 10 minutes à arriver.
    fetch(e.request, { cache: "no-cache" })
      .then((r) => { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copie)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});

// Fin du repos (envoyée par la page à chaque changement du minuteur) : notifiée si le carnet n'est pas à
// l'écran, sinon la page sonne elle-même. Une nouvelle fin, ou une fin nulle, remplace l'attente en cours.
let attente = null;
// ─── Montre : l'appui sur « Série faite », de la notification au carnet.
// Le carnet endormi (téléphone en veille) ne reçoit un message qu'au réveil : l'appui est donc aussi gardé
// en attente (cache MONTRE), que la page relit à chaque retour au premier plan. La page accuse réception ;
// sans réponse sous 2 s, le service worker ramène le carnet au premier plan pour le réveiller. Chaque étape
// va dans un journal, affiché dans la carte « Valider depuis la montre » : c'est ce qui dit, si rien ne se
// passe, où ça s'est arrêté (appui jamais reçu = la montre ou Garmin ; reçu mais pas noté = le carnet).
const MONTRE = "carnet-montre";
const lireMontre = async (cle) => { const r = await (await caches.open(MONTRE)).match(cle); return r ? r.json() : []; };
const ecrireMontre = async (cle, v) => (await caches.open(MONTRE)).put(cle, new Response(JSON.stringify(v)));
const journal = async (quoi) => ecrireMontre("journal", [...(await lireMontre("journal")), { t: Date.now(), quoi }].slice(-12));
const accuses = new Map();   // id de série → résout l'attente d'accusé de réception

self.addEventListener("message", (e) => {
  if (e.data?.test) {   // bouton « Tester la montre » : une notification avec bouton, tout de suite, sans série
    e.waitUntil(journal("test : notification envoyée").then(() => self.registration.showNotification("Test montre", {
      body: "Appuie sur « Série faite » ici, puis sur la montre", tag: "test", renotify: true, icon: "icon-192.png",
      vibrate: [300, 150, 300], data: { test: true }, actions: [{ action: "serie", title: "Série faite" }] })));
    return;
  }
  if (e.data?.accuse) {   // la page a traité l'appui : confirmation sur la montre
    accuses.get(e.data.accuse)?.();
    e.waitUntil(Promise.all([journal(e.data.texte || "noté par le carnet"),
      e.data.ok ? self.registration.showNotification("✓ Série notée", { body: e.data.texte || "", tag: "repos", renotify: true,
        icon: "icon-192.png", vibrate: [120] }) : null]));
    return;
  }
  if (!e.data || !("repos" in e.data)) return;
  attente?.annuler();
  attente = null;
  if (!e.data.repos) return;
  const moi = {};
  const fini = new Promise((ok) => {
    const t = setTimeout(() => ok(true), Math.max(0, e.data.repos - Date.now()));
    moi.annuler = () => { clearTimeout(t); ok(false); };
  });
  attente = moi;
  e.waitUntil(fini.then(async (sonner) => {
    if (attente === moi) attente = null;
    if (!sonner) return;
    const pages = await self.clients.matchAll({ type: "window" });
    // « toujours » (réglage Montre) : même carnet à l'écran, pour que la montre vibre et porte le bouton.
    if (!e.data.toujours && pages.some((c) => c.visibilityState === "visible")) return;
    const s = e.data.serie;
    await journal(s ? `notification envoyée : Go · ${s.nom}, avec le bouton` : "notification envoyée : repos fini, sans bouton");
    await self.registration.showNotification(s ? `Go · ${s.nom}` : "Repos fini", {
      body: s ? `${s.quand} · ${s.txt}` : e.data.quoi || "", tag: "repos", renotify: true, icon: "icon-192.png",
      vibrate: [300, 150, 300, 150, 300], data: s || null,
      actions: s ? [{ action: "serie", title: s.ech ? "Échauffement fait" : "Série faite" }] : [],
    });
  }));
});

// Une notification balayée sans être touchée : notée aussi.
self.addEventListener("notificationclose", (e) => e.waitUntil(journal(`notification balayée : « ${e.notification.title} »`)));

// Toucher la notification ramène au carnet. Son bouton « Série faite » (sur le téléphone, ou relayé par la
// montre) part à la page, qui note la série ; carnet fermé, il le rouvre avec la série dans l'adresse.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const d = e.notification.data;
  // Tout appui va au journal, avec l'action telle que reçue : c'est elle qui dit si le bouton est
  // bien parvenu jusqu'ici, ou s'il est arrivé comme un simple appui sur le texte (action vide).
  const vu = journal(`appui sur « ${e.notification.title} » : ${e.action ? `bouton « ${e.action} »` : "le texte (pas de bouton)"}`);
  if (d?.test) {
    e.waitUntil(vu.then(() => e.action === "serie" ? self.registration.showNotification("✓ Appui bien reçu", {
      body: "Le bouton marche jusqu'au carnet", tag: "test", renotify: true, icon: "icon-192.png", vibrate: [120] }) : null)
      .then(() => self.clients.matchAll({ type: "window" })).then((cs) => cs.forEach((c) => c.postMessage({ journal: 1 }))));
    return;
  }
  e.waitUntil(vu);
  if (e.action === "serie" && d) {
    e.waitUntil((async () => {
      await journal(`appui reçu : ${d.nom}, ${d.quand}`);
      await ecrireMontre("attente", [...(await lireMontre("attente")).filter((x) => x.id !== d.id), d]);
      const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (!cs.length) { await journal("carnet fermé : rouvert"); return self.clients.openWindow(`./#montre=${encodeURIComponent(JSON.stringify(d))}`); }
      const recu = new Promise((ok) => { accuses.set(d.id, () => ok(true)); setTimeout(() => ok(false), 2000); });
      cs.forEach((c) => c.postMessage({ montre: d }));
      if (await recu) return;
      await journal("carnet endormi : ramené au premier plan");
      try { await cs[0].focus(); } catch { await self.clients.openWindow("./"); }
    })().finally(() => accuses.delete(d.id)));
    return;
  }
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow("./"))));
});
