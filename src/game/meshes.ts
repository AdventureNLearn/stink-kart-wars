import * as THREE from "three";
import { COLORS } from "./types";
import {
  clothBandana,
  contactShadow,
  eyeCornea,
  eyeSclera,
  metalPlate,
  paintBody,
  panelLine,
  rivet,
  rubberTire,
  slimeSkin,
} from "./visualDensity";

/** Bandana Drifter + Stinky — Layer 4 vehicle / Layer 3–4 character densify.
 *  Silhouette, proportions, names, and attach points UNCHANGED. */
export function createStinkyKart(): THREE.Group {
  const root = new THREE.Group();
  root.name = "StinkyKart";

  const kart = new THREE.Group();
  kart.name = "kart";

  // ── Layer 4 materials ──
  const bodyMat = paintBody(COLORS.slime, {
    roughness: 0.28,
    metalness: 0.18,
    emissive: 0x0a3010,
    emissiveIntensity: 0.18,
    clearcoat: 0.65,
  });
  const darkMat = paintBody(COLORS.slimeDark, {
    roughness: 0.4,
    metalness: 0.22,
    clearcoat: 0.35,
  });
  const quantumMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.quantum,
    emissive: COLORS.quantum,
    emissiveIntensity: 0.95,
    roughness: 0.18,
    metalness: 0.55,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.1,
  });
  const purpleMat = paintBody(COLORS.quantum2, {
    roughness: 0.28,
    metalness: 0.4,
    emissive: COLORS.quantum2,
    emissiveIntensity: 0.35,
    clearcoat: 0.5,
  });
  const bandanaMat = clothBandana(COLORS.bandana);
  const wheelMat = rubberTire();
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.quantum,
    emissive: COLORS.quantum,
    emissiveIntensity: 0.55,
    roughness: 0.22,
    metalness: 0.7,
    clearcoat: 0.6,
  });
  const seamMat = metalPlate(0x1a2218, 0.55);
  const boltMat = metalPlate(0x8a9aa8, 0.3);

  // Contact shadow (Layer 4)
  kart.add(contactShadow(2.4, 3.0, 0.42));

  // Main chassis — same outer size
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 2.2), bodyMat);
  chassis.position.y = 0.45;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  kart.add(chassis);

  // Micro panel seams on chassis (Layer 4 surface)
  for (const z of [-0.55, 0, 0.55]) {
    const seam = panelLine(1.45, "x", seamMat);
    seam.position.set(0, 0.68, z);
    kart.add(seam);
  }
  for (const x of [-0.55, 0.55]) {
    const seam = panelLine(1.9, "z", seamMat);
    seam.position.set(x, 0.68, 0.05);
    kart.add(seam);
  }
  // Rivets along sides
  for (const x of [-0.78, 0.78]) {
    for (const z of [-0.85, -0.25, 0.35, 0.9]) {
      const r = rivet(boltMat, 0.035);
      r.position.set(x, 0.62, z);
      kart.add(r);
    }
  }

  // Underside skid plate (micro volume, inside silhouette)
  const skid = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.06, 1.9), metalPlate(0x2a3038, 0.5));
  skid.position.y = 0.22;
  kart.add(skid);

  // Hood scoop / slime drip
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.9), darkMat);
  hood.position.set(0, 0.72, -0.55);
  hood.castShadow = true;
  kart.add(hood);
  // Hood vent slits
  for (const x of [-0.35, 0, 0.35]) {
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.04, 0.55),
      metalPlate(0x0e1210, 0.7),
    );
    vent.position.set(x, 0.86, -0.55);
    kart.add(vent);
  }

  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.7), darkMat);
  seat.position.set(0, 0.75, 0.35);
  seat.castShadow = true;
  kart.add(seat);
  // Seat cushion sheen strip
  const cushion = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.06, 0.55),
    paintBody(0x1a4a28, { roughness: 0.55, clearcoat: 0.2 }),
  );
  cushion.position.set(0, 0.94, 0.35);
  kart.add(cushion);

  // Korus rune engine glow
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.5), quantumMat);
  engine.position.set(0, 0.5, 0.95);
  engine.name = "engineGlow";
  engine.castShadow = true;
  kart.add(engine);
  // Exhaust nozzles micro-detail
  for (const x of [-0.22, 0.22]) {
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.2, 8),
      metalPlate(0x222830),
    );
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(x, 0.42, 1.22);
    kart.add(nozzle);
  }

  // Side pods
  for (const sx of [-0.95, 0.95]) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 1.4), purpleMat);
    pod.position.set(sx, 0.4, 0.1);
    pod.castShadow = true;
    kart.add(pod);
    const gill = panelLine(1.1, "z", seamMat);
    gill.position.set(sx * 1.12, 0.48, 0.1);
    kart.add(gill);
  }

  // Wheels + tread rings
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  const wheelPos: [number, number, number][] = [
    [-0.9, 0.38, -0.75],
    [0.9, 0.38, -0.75],
    [-0.9, 0.38, 0.8],
    [0.9, 0.38, 0.8],
  ];
  for (const [wx, wy, wz] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, wy, wz);
    w.castShadow = true;
    kart.add(w);
    wheels.push(w);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.34, 10),
      rimMat,
    );
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx, wy, wz);
    kart.add(rim);
    // tread micro-rings
    const tread = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.03, 6, 16),
      rubberTire(),
    );
    tread.rotation.y = Math.PI / 2;
    tread.position.set(wx, wy, wz);
    kart.add(tread);
  }
  (kart as THREE.Group & { wheels?: THREE.Mesh[] }).userData.wheels = wheels;

  // Red bandana streamers on kart
  for (const sx of [-0.5, 0.5]) {
    const streamer = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.9),
      bandanaMat,
    );
    streamer.position.set(sx, 0.95, 0.2);
    streamer.rotation.x = 0.4;
    streamer.name = "bandanaStreamer";
    streamer.castShadow = true;
    kart.add(streamer);
  }

  // Spikes (vikingpunk) — same positions
  for (const [sx, sz] of [
    [-0.7, -1.0],
    [0.7, -1.0],
    [-0.7, 1.0],
    [0.7, 1.0],
  ] as const) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), darkMat);
    spike.position.set(sx, 0.75, sz);
    spike.rotation.x = sz < 0 ? -0.6 : 0.6;
    spike.castShadow = true;
    kart.add(spike);
  }

  // Front bumper plate micro
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.18, 0.2),
    metalPlate(0x3a4540, 0.45),
  );
  bumper.position.set(0, 0.35, -1.15);
  kart.add(bumper);

  root.add(kart);

  // --- Stinky character (Layer 3 + 4 densify) ---
  const stinky = createStinkyBody();
  stinky.position.set(0, 0.95, 0.25);
  stinky.name = "stinky";
  root.add(stinky);

  const sprintForm = createSprintForm();
  sprintForm.visible = false;
  sprintForm.name = "sprintForm";
  root.add(sprintForm);

  return root;
}

/** Stinky — Layer 3 muscle/volume definition + Layer 4 materials/skin/eyes.
 *  Pose and silhouette preserved. */
export function createStinkyBody(): THREE.Group {
  const g = new THREE.Group();

  const slimeMat = slimeSkin(COLORS.slime);
  const darkSlime = slimeSkin(COLORS.slimeDark, {
    emissive: 0x061808,
    emissiveIntensity: 0.12,
    opacity: 0.96,
  });
  const bandanaMat = clothBandana(COLORS.bandana);
  const eyeWhite = eyeSclera();
  const eyeYellow = new THREE.MeshPhysicalMaterial({
    color: 0xf5e642,
    emissive: 0xf5e642,
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.05,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
  });
  const pupilMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0a,
    roughness: 0.35,
    metalness: 0.1,
  });
  const toothMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff8e0,
    roughness: 0.28,
    metalness: 0.05,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
  });
  const spikeMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5e642,
    roughness: 0.35,
    metalness: 0.12,
    emissive: 0x665500,
    emissiveIntensity: 0.28,
    clearcoat: 0.4,
  });

  // Inner density core (Layer 3 volume) — slightly smaller, darker
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 1),
    slimeSkin(0x1f8a35, { opacity: 0.85, emissiveIntensity: 0.08 }),
  );
  core.scale.set(1.0, 1.1, 0.9);
  core.position.y = 0.55;
  g.add(core);

  // Outer body (same silhouette as before)
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 2), slimeMat);
  body.scale.set(1.05, 1.15, 0.95);
  body.position.y = 0.55;
  body.castShadow = true;
  body.receiveShadow = true;
  body.name = "body";
  g.add(body);

  // Layer 3 muscle/ridge bands (surface definition, inside silhouette)
  for (const [y, s] of [
    [0.42, 0.48],
    [0.62, 0.52],
    [0.82, 0.42],
  ] as const) {
    const ridge = new THREE.Mesh(
      new THREE.TorusGeometry(s, 0.035, 6, 18),
      darkSlime,
    );
    ridge.rotation.x = Math.PI / 2;
    ridge.position.y = y;
    ridge.scale.set(1.05, 0.95, 1);
    g.add(ridge);
  }
  // Pectoral / cheek blobs (subtle volume)
  for (const x of [-0.28, 0.28]) {
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      slimeMat,
    );
    cheek.position.set(x, 0.68, 0.28);
    cheek.scale.set(1, 0.85, 0.7);
    g.add(cheek);
  }

  // Legs — slight joint bulge (definition)
  for (const lx of [-0.22, 0.22]) {
    const leg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.18, 4, 8),
      slimeMat,
    );
    leg.position.set(lx, 0.18, 0.05);
    leg.castShadow = true;
    g.add(leg);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), darkSlime);
    knee.position.set(lx, 0.22, 0.08);
    g.add(knee);
  }
  // Arms
  for (const ax of [-0.55, 0.55]) {
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.1, 0.22, 4, 8),
      slimeMat,
    );
    arm.position.set(ax, 0.55, 0.05);
    arm.rotation.z = ax > 0 ? -0.4 : 0.4;
    arm.castShadow = true;
    g.add(arm);
    const bicep = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      slimeMat,
    );
    bicep.position.set(ax * 0.85, 0.6, 0.05);
    g.add(bicep);
  }

  // Mohawk spikes
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.35 + (i % 2) * 0.08, 6),
      spikeMat,
    );
    s.position.set((i - 2) * 0.12, 1.2 + (i === 2 ? 0.08 : 0), -0.05);
    s.castShadow = true;
    g.add(s);
  }

  // PERMANENT red bandana — cloth densify
  const bandana = new THREE.Group();
  bandana.name = "bandana";
  const wrap = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.08, 8, 20, Math.PI * 1.3),
    bandanaMat,
  );
  wrap.rotation.x = Math.PI / 2;
  wrap.rotation.z = 0.2;
  wrap.position.set(0, 1.0, 0.05);
  wrap.castShadow = true;
  bandana.add(wrap);
  // Fold crease strip
  const crease = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.025, 4, 16, Math.PI * 1.1),
    clothBandana(0xb01525),
  );
  crease.rotation.x = Math.PI / 2;
  crease.rotation.z = 0.2;
  crease.position.set(0, 1.02, 0.05);
  bandana.add(crease);
  const tail1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.08, 0.45),
    bandanaMat,
  );
  tail1.position.set(0.35, 0.98, -0.25);
  tail1.rotation.y = 0.5;
  tail1.rotation.x = 0.3;
  bandana.add(tail1);
  const tail2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.07, 0.35),
    bandanaMat,
  );
  tail2.position.set(0.28, 0.92, -0.35);
  tail2.rotation.y = 0.7;
  tail2.rotation.x = 0.5;
  bandana.add(tail2);
  g.add(bandana);

  // Eyepatch
  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 12),
    new THREE.MeshPhysicalMaterial({
      color: 0x1a0a0a,
      roughness: 0.85,
      metalness: 0.05,
    }),
  );
  patch.position.set(-0.2, 0.72, 0.42);
  g.add(patch);
  const strap = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.05, 0.04),
    new THREE.MeshPhysicalMaterial({ color: 0x1a0a0a, roughness: 0.8 }),
  );
  strap.position.set(0, 0.78, 0.38);
  strap.rotation.z = 0.15;
  g.add(strap);

  // Right eye — sclera + iris + pupil + cornea (Layer 4)
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), eyeWhite);
  eye.position.set(0.2, 0.7, 0.42);
  g.add(eye);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), eyeYellow);
  iris.position.set(0.2, 0.7, 0.52);
  g.add(iris);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), pupilMat);
  pupil.position.set(0.2, 0.7, 0.58);
  g.add(pupil);
  // Specular cornea shell
  const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 12), eyeCornea());
  cornea.position.set(0.2, 0.7, 0.43);
  g.add(cornea);
  // Catch-light
  const catchLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  catchLight.position.set(0.24, 0.74, 0.54);
  g.add(catchLight);

  // Mouth + teeth
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.12), darkSlime);
  mouth.position.set(0, 0.45, 0.48);
  g.add(mouth);
  // Gum line
  const gum = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.04, 0.08),
    slimeSkin(0x2a6a38, { opacity: 0.95 }),
  );
  gum.position.set(0, 0.52, 0.52);
  g.add(gum);
  for (let i = 0; i < 4; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 5), toothMat);
    tooth.position.set(-0.15 + i * 0.1, 0.52, 0.55);
    tooth.rotation.x = Math.PI;
    g.add(tooth);
  }
  for (let i = 0; i < 3; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 5), toothMat);
    tooth.position.set(-0.1 + i * 0.1, 0.38, 0.55);
    g.add(tooth);
  }

  // Drip blobs
  for (const [dx, dy, dz] of [
    [-0.35, 0.3, 0.2],
    [0.4, 0.25, -0.1],
    [0.1, 0.15, 0.35],
  ] as const) {
    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), slimeMat);
    drip.position.set(dx, dy, dz);
    g.add(drip);
  }

  return g;
}

function createSprintForm(): THREE.Group {
  const g = new THREE.Group();
  const mat = slimeSkin(COLORS.slime, {
    emissive: COLORS.quantum,
    emissiveIntensity: 0.4,
    opacity: 0.9,
  });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 10), mat);
  body.rotation.x = Math.PI / 2;
  body.position.z = -0.2;
  body.castShadow = true;
  g.add(body);
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 10),
    new THREE.MeshPhysicalMaterial({
      color: 0xf5e642,
      emissive: 0xf5e642,
      emissiveIntensity: 0.45,
      clearcoat: 0.7,
      roughness: 0.2,
    }),
  );
  eye.position.set(0.12, 0.1, -1.2);
  g.add(eye);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.07, 8, 14),
    clothBandana(COLORS.bandana),
  );
  band.position.set(0, 0.15, -0.5);
  band.rotation.y = Math.PI / 2;
  g.add(band);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.08, 0.5),
    clothBandana(COLORS.bandana),
  );
  tail.position.set(0.15, 0.2, -0.2);
  g.add(tail);
  const trail = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 8),
    new THREE.MeshPhysicalMaterial({
      color: COLORS.quantum2,
      emissive: COLORS.quantum2,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.7,
      roughness: 0.2,
    }),
  );
  trail.position.z = 1.1;
  trail.name = "sprintTrail";
  g.add(trail);
  return g;
}

export function createAIRacerMesh(
  color: number,
  accent: number,
): THREE.Group {
  const root = new THREE.Group();
  root.add(contactShadow(2.0, 2.6, 0.35));

  const bodyMat = paintBody(color, {
    roughness: 0.34,
    metalness: 0.28,
    clearcoat: 0.5,
  });
  const accentMat = paintBody(accent, {
    roughness: 0.3,
    metalness: 0.3,
    emissive: accent,
    emissiveIntensity: 0.35,
    clearcoat: 0.55,
  });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 2.0), bodyMat);
  chassis.position.y = 0.45;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  root.add(chassis);

  // Panel micro lines
  const seam = metalPlate(0x111418, 0.6);
  for (const z of [-0.4, 0.4]) {
    const s = panelLine(1.3, "x", seam);
    s.position.set(0, 0.66, z);
    root.add(s);
  }

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.8), accentMat);
  cabin.position.set(0, 0.8, 0.1);
  cabin.castShadow = true;
  root.add(cabin);

  const wheelMat = rubberTire();
  const wg = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 12);
  wg.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [
    [-0.85, -0.7],
    [0.85, -0.7],
    [-0.85, 0.75],
    [0.85, 0.75],
  ] as const) {
    const w = new THREE.Mesh(wg, wheelMat);
    w.position.set(wx, 0.35, wz);
    w.castShadow = true;
    root.add(w);
  }
  const driver = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.35, 1),
    slimeSkin(accent, { opacity: 0.95 }),
  );
  driver.position.set(0, 1.15, 0.05);
  driver.castShadow = true;
  root.add(driver);
  return root;
}

export function createStinkCloudMesh(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: COLORS.slime,
    transparent: true,
    opacity: 0.5,
    emissive: COLORS.slimeDark,
    emissiveIntensity: 0.45,
    roughness: 1,
    depthWrite: false,
    transmission: 0.2,
    thickness: 0.8,
  });
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.4, 1),
      mat.clone(),
    );
    s.position.set(
      (Math.random() - 0.5) * 1.4,
      Math.random() * 0.8,
      (Math.random() - 0.5) * 1.4,
    );
    g.add(s);
  }
  return g;
}

export function createOozeWaveMesh(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: COLORS.slime,
    transparent: true,
    opacity: 0.72,
    emissive: COLORS.quantum,
    emissiveIntensity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.35,
    clearcoat: 0.4,
  });
  const wave = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.55, 10, 24, Math.PI * 1.1),
    mat,
  );
  wave.rotation.x = Math.PI / 2;
  wave.rotation.z = Math.PI;
  g.add(wave);
  return g;
}

export const AI_PALETTES: [number, number, string][] = [
  [0x1e3a8a, 0xf5e642, "AdventureNLearn"],
  [0x4c1d95, 0xc026d3, "Grimfel"],
  [0x5b21b6, 0xfbbf24, "Gossip Goblin"],
  [0x334155, 0x22d3ee, "Grok"],
  [0x7c2d12, 0xf59e0b, "Rooster"],
];
