import * as THREE from "three";
import { COLORS } from "./types";
import {
  brushedSteel,
  clothBandana,
  contactShadow,
  facetOcta,
  facetWheel,
  metalPlate,
  paintBody,
  panelLine,
  rivet,
  roughLeather,
  rubberTire,
  slimePlate,
  slimeSkin,
  withFacetEdges,
} from "./visualDensity";

/**
 * Stinky Kart — Road-Kill inspired proportions:
 * giant faceted tires, low aggressive chassis, driver stands proud between the wheels.
 * Faceted polygonal language preserved. Names / attach points kept for engine.
 */
export function createStinkyKart(): THREE.Group {
  const root = new THREE.Group();
  root.name = "StinkyKart";

  const kart = new THREE.Group();
  kart.name = "kart";

  // ── Materials ──
  const bodyMat = paintBody(COLORS.slime, {
    roughness: 0.32,
    metalness: 0.2,
    emissive: 0x0a3010,
    emissiveIntensity: 0.16,
    clearcoat: 0.55,
  });
  const darkMat = paintBody(COLORS.slimeDark, {
    roughness: 0.42,
    metalness: 0.22,
    clearcoat: 0.3,
  });
  const quantumMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.quantum,
    emissive: COLORS.quantum,
    emissiveIntensity: 0.9,
    roughness: 0.2,
    metalness: 0.55,
    clearcoat: 0.7,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.0,
  });
  const purpleMat = paintBody(COLORS.quantum2, {
    roughness: 0.3,
    metalness: 0.38,
    emissive: COLORS.quantum2,
    emissiveIntensity: 0.3,
    clearcoat: 0.45,
  });
  const bandanaMat = clothBandana(COLORS.bandana);
  const wheelMat = rubberTire();
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.quantum,
    emissive: COLORS.quantum,
    emissiveIntensity: 0.5,
    roughness: 0.25,
    metalness: 0.72,
    clearcoat: 0.55,
  });
  const seamMat = metalPlate(0x1a2218, 0.55);
  const boltMat = metalPlate(0x8a9aa8, 0.3);
  const steel = brushedSteel(0x3a4550);

  // Wider contact shadow for giant tires
  kart.add(contactShadow(3.4, 3.8, 0.48));

  // ── GIANT TIRES (Road-Kill energy) ──
  const wheelR = 0.72;
  const wheelW = 0.42;
  const wheels: THREE.Mesh[] = [];
  const wheelPos: [number, number, number][] = [
    [-1.15, wheelR, -0.95],
    [1.15, wheelR, -0.95],
    [-1.15, wheelR, 1.05],
    [1.15, wheelR, 1.05],
  ];
  for (const [wx, wy, wz] of wheelPos) {
    const w = new THREE.Mesh(facetWheel(wheelR, wheelW, 8), wheelMat);
    w.position.set(wx, wy, wz);
    w.castShadow = true;
    w.receiveShadow = true;
    withFacetEdges(w, 0x0a0c10, 22);
    kart.add(w);
    wheels.push(w);

    // rim + hub
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelR * 0.42, wheelR * 0.42, wheelW + 0.04, 8),
      rimMat,
    );
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx, wy, wz);
    kart.add(rim);

    // tread rings
    for (const t of [-0.12, 0.12]) {
      const tread = new THREE.Mesh(
        new THREE.TorusGeometry(wheelR * 0.92, 0.04, 6, 16),
        rubberTire(),
      );
      tread.rotation.y = Math.PI / 2;
      tread.position.set(wx + t, wy, wz);
      kart.add(tread);
    }
  }
  (kart as THREE.Group & { wheels?: THREE.Mesh[] }).userData.wheels = wheels;

  // ── LOW AGGRESSIVE CHASSIS ──
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.38, 2.5), bodyMat);
  chassis.position.y = 0.55;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  withFacetEdges(chassis, 0x0e2a14, 20);
  kart.add(chassis);

  // Aero nose wedge
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.28, 0.7), darkMat);
  nose.position.set(0, 0.48, -1.35);
  nose.rotation.x = 0.25;
  nose.castShadow = true;
  withFacetEdges(nose, 0x0e2a14, 18);
  kart.add(nose);

  // Rear diffuser / spoiler
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.35), steel);
  spoiler.position.set(0, 0.85, 1.35);
  spoiler.castShadow = true;
  kart.add(spoiler);
  const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), steel);
  strutL.position.set(-0.55, 0.68, 1.25);
  kart.add(strutL);
  const strutR = strutL.clone();
  strutR.position.x = 0.55;
  kart.add(strutR);

  // Underside skid
  const skid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 2.1), metalPlate(0x2a3038, 0.5));
  skid.position.y = 0.32;
  kart.add(skid);

  // Hood plate + vents
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.22, 0.95), darkMat);
  hood.position.set(0, 0.78, -0.55);
  hood.castShadow = true;
  kart.add(hood);
  for (const x of [-0.35, 0, 0.35]) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.55), metalPlate(0x0e1210, 0.7));
    vent.position.set(x, 0.9, -0.55);
    kart.add(vent);
  }

  // Seat bucket
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 0.7), darkMat);
  seat.position.set(0, 0.82, 0.4);
  seat.castShadow = true;
  kart.add(seat);

  // Quantum engine block
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.38, 0.55), quantumMat);
  engine.position.set(0, 0.55, 1.05);
  engine.name = "engineGlow";
  engine.castShadow = true;
  kart.add(engine);
  for (const x of [-0.22, 0.22]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.22, 8), metalPlate(0x222830));
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(x, 0.45, 1.35);
    kart.add(nozzle);
  }

  // Side pods (purple)
  for (const sx of [-1.1, 1.1]) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 1.5), purpleMat);
    pod.position.set(sx, 0.48, 0.15);
    pod.castShadow = true;
    withFacetEdges(pod, 0x2a0a40, 18);
    kart.add(pod);
  }

  // Panel seams + rivets
  for (const z of [-0.6, 0, 0.6]) {
    const seam = panelLine(1.7, "x", seamMat);
    seam.position.set(0, 0.75, z);
    kart.add(seam);
  }
  for (const x of [-0.95, 0.95]) {
    for (const z of [-0.9, -0.2, 0.5, 1.0]) {
      const r = rivet(boltMat, 0.04);
      r.position.set(x, 0.68, z);
      kart.add(r);
    }
  }

  // Bandana streamers
  for (const sx of [-0.55, 0.55]) {
    const streamer = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.95), bandanaMat);
    streamer.position.set(sx, 1.05, 0.25);
    streamer.rotation.x = 0.35;
    streamer.name = "bandanaStreamer";
    streamer.castShadow = true;
    kart.add(streamer);
  }

  // Corner spikes
  for (const [sx, sz] of [[-0.85, -1.2], [0.85, -1.2], [-0.85, 1.2], [0.85, 1.2]] as const) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 6), darkMat);
    spike.position.set(sx, 0.78, sz);
    spike.rotation.x = sz < 0 ? -0.55 : 0.55;
    spike.castShadow = true;
    kart.add(spike);
  }

  // Front bumper
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 0.22), metalPlate(0x3a4540, 0.45));
  bumper.position.set(0, 0.4, -1.55);
  kart.add(bumper);

  root.add(kart);

  // Driver stands proud between the giant wheels
  const stinky = createStinkyBody();
  stinky.position.set(0, 0.95, 0.3);
  stinky.name = "stinky";
  root.add(stinky);

  const sprintForm = createSprintForm();
  sprintForm.visible = false;
  sprintForm.name = "sprintForm";
  root.add(sprintForm);

  return root;
}

/** Faceted polygonal Stinky with real shoulders, straps, layered features. */
export function createStinkyBody(): THREE.Group {
  const g = new THREE.Group();

  const slimeMat = slimeSkin(COLORS.slime);
  const darkSlime = slimeSkin(COLORS.slimeDark, {
    emissive: 0x061808,
    emissiveIntensity: 0.12,
  });
  const plateMat = slimePlate(COLORS.slimeDark);
  const bandanaMat = clothBandana(COLORS.bandana);
  const leather = roughLeather(0x1a1210);
  const eyeWhite = new THREE.MeshPhysicalMaterial({
    color: 0xf2efe4,
    roughness: 0.48,
    metalness: 0.0,
    clearcoat: 0.15,
    flatShading: true,
  });
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
  });
  const spikeMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5e642,
    roughness: 0.35,
    metalness: 0.12,
    emissive: 0x665500,
    emissiveIntensity: 0.28,
    clearcoat: 0.4,
    flatShading: true,
  });

  // Torso — faceted octa
  const torso = new THREE.Mesh(facetOcta(0.48), slimeMat);
  torso.scale.set(1.05, 1.25, 0.9);
  torso.position.y = 0.55;
  torso.castShadow = true;
  torso.receiveShadow = true;
  torso.name = "body";
  withFacetEdges(torso, 0x0e2a14, 16);
  g.add(torso);

  // Chest plate / hoodie layer
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.45, 0.55), plateMat);
  chest.position.set(0, 0.62, 0.12);
  chest.castShadow = true;
  withFacetEdges(chest, 0x0a1a10, 20);
  g.add(chest);

  // Deltoid / shoulder pads (real shoulders)
  for (const sx of [-0.48, 0.48]) {
    const deltoid = new THREE.Mesh(facetOcta(0.2), slimeMat);
    deltoid.scale.set(1.1, 0.85, 0.9);
    deltoid.position.set(sx, 0.78, 0.05);
    deltoid.castShadow = true;
    withFacetEdges(deltoid, 0x0e2a14, 18);
    g.add(deltoid);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.22), leather);
    pad.position.set(sx * 1.05, 0.82, 0.08);
    g.add(pad);
  }

  // Head
  const head = new THREE.Mesh(facetOcta(0.32), slimeMat);
  head.scale.set(1.0, 1.05, 0.95);
  head.position.y = 1.15;
  head.castShadow = true;
  withFacetEdges(head, 0x0e2a14, 16);
  g.add(head);

  // Face plate
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.2), plateMat);
  face.position.set(0, 1.1, 0.22);
  g.add(face);

  // Arms
  for (const ax of [-0.62, 0.62]) {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.2), slimeMat);
    upper.position.set(ax, 0.58, 0.05);
    upper.rotation.z = ax > 0 ? -0.35 : 0.35;
    upper.castShadow = true;
    withFacetEdges(upper, 0x0e2a14, 20);
    g.add(upper);

    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.16), slimeMat);
    lower.position.set(ax * 1.05, 0.32, 0.08);
    lower.castShadow = true;
    g.add(lower);

    // Hand nubs / fingers
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.14), plateMat);
    hand.position.set(ax * 1.08, 0.16, 0.1);
    g.add(hand);
    for (let f = 0; f < 3; f++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), slimeMat);
      finger.position.set(ax * 1.08 + (f - 1) * 0.05, 0.08, 0.12);
      g.add(finger);
    }
  }

  // Legs
  for (const lx of [-0.22, 0.22]) {
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.24), slimeMat);
    thigh.position.set(lx, 0.22, 0.02);
    thigh.castShadow = true;
    withFacetEdges(thigh, 0x0e2a14, 20);
    g.add(thigh);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.2), slimeMat);
    shin.position.set(lx, -0.02, 0.04);
    shin.castShadow = true;
    g.add(shin);
  }

  // Straps across chest
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.06), leather);
  strap.position.set(-0.18, 0.6, 0.38);
  strap.rotation.z = 0.25;
  g.add(strap);
  const strap2 = strap.clone();
  strap2.position.x = 0.18;
  strap2.rotation.z = -0.25;
  g.add(strap2);

  // Mohawk spikes
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32 + (i % 2) * 0.08, 5), spikeMat);
    s.position.set((i - 2) * 0.11, 1.42 + (i === 2 ? 0.06 : 0), -0.02);
    s.castShadow = true;
    g.add(s);
  }

  // Bandana
  const bandana = new THREE.Group();
  bandana.name = "bandana";
  const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.07, 6, 16, Math.PI * 1.25), bandanaMat);
  wrap.rotation.x = Math.PI / 2;
  wrap.rotation.z = 0.15;
  wrap.position.set(0, 1.28, 0.02);
  wrap.castShadow = true;
  bandana.add(wrap);
  const tail1 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.42), bandanaMat);
  tail1.position.set(0.32, 1.22, -0.22);
  tail1.rotation.y = 0.45;
  tail1.rotation.x = 0.25;
  bandana.add(tail1);
  const tail2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.32), bandanaMat);
  tail2.position.set(0.26, 1.16, -0.32);
  tail2.rotation.y = 0.65;
  tail2.rotation.x = 0.45;
  bandana.add(tail2);
  g.add(bandana);

  // Eyepatch
  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(0.14, 8),
    new THREE.MeshPhysicalMaterial({ color: 0x1a0a0a, roughness: 0.85, flatShading: true }),
  );
  patch.position.set(-0.16, 1.12, 0.35);
  g.add(patch);
  const pstrap = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.045, 0.035),
    new THREE.MeshPhysicalMaterial({ color: 0x1a0a0a, roughness: 0.8 }),
  );
  pstrap.position.set(0, 1.18, 0.3);
  pstrap.rotation.z = 0.12;
  g.add(pstrap);

  // Right eye
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.1), eyeWhite);
  eye.position.set(0.16, 1.1, 0.35);
  g.add(eye);
  const iris = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), eyeYellow);
  iris.position.set(0.16, 1.1, 0.42);
  g.add(iris);
  const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), pupilMat);
  pupil.position.set(0.16, 1.1, 0.46);
  g.add(pupil);

  // Mouth + teeth
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.1), darkSlime);
  mouth.position.set(0, 0.92, 0.38);
  g.add(mouth);
  for (let i = 0; i < 4; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 4), toothMat);
    tooth.position.set(-0.12 + i * 0.08, 0.98, 0.44);
    tooth.rotation.x = Math.PI;
    g.add(tooth);
  }

  return g;
}

function createSprintForm(): THREE.Group {
  const g = new THREE.Group();
  const mat = slimeSkin(COLORS.slime, {
    emissive: COLORS.quantum,
    emissiveIntensity: 0.4,
  });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 8), mat);
  body.rotation.x = Math.PI / 2;
  body.position.z = -0.2;
  body.castShadow = true;
  withFacetEdges(body, 0x0e2a14, 18);
  g.add(body);
  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.1),
    new THREE.MeshPhysicalMaterial({
      color: 0xf5e642,
      emissive: 0xf5e642,
      emissiveIntensity: 0.45,
      clearcoat: 0.7,
      roughness: 0.2,
      flatShading: true,
    }),
  );
  eye.position.set(0.12, 0.1, -1.2);
  g.add(eye);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.07, 6, 12),
    clothBandana(COLORS.bandana),
  );
  band.position.set(0, 0.15, -0.5);
  band.rotation.y = Math.PI / 2;
  g.add(band);
  const trail = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 6, 6),
    new THREE.MeshPhysicalMaterial({
      color: COLORS.quantum2,
      emissive: COLORS.quantum2,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.7,
      roughness: 0.2,
      flatShading: true,
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
  root.add(contactShadow(2.2, 2.8, 0.38));

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
  withFacetEdges(chassis, 0x111418, 18);
  root.add(chassis);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.8), accentMat);
  cabin.position.set(0, 0.8, 0.1);
  cabin.castShadow = true;
  root.add(cabin);

  const wheelMat = rubberTire();
  for (const [wx, wz] of [[-0.85, -0.7], [0.85, -0.7], [-0.85, 0.75], [0.85, 0.75]] as const) {
    const w = new THREE.Mesh(facetWheel(0.35, 0.28, 8), wheelMat);
    w.position.set(wx, 0.35, wz);
    w.castShadow = true;
    root.add(w);
  }
  const driver = new THREE.Mesh(facetOcta(0.32), slimeSkin(accent));
  driver.position.set(0, 1.15, 0.05);
  driver.castShadow = true;
  withFacetEdges(driver, 0x111418, 16);
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
    flatShading: true,
  });
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(facetOcta(0.45 + Math.random() * 0.35), mat.clone());
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
    flatShading: true,
  });
  const wave = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.55, 8, 20, Math.PI * 1.1),
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
