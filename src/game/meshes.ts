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
  // Hood vent slots
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
  // Dual exhaust pipes (Slimekart silhouette)
  for (const x of [-0.28, 0.28]) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.85, 8),
      metalPlate(0x2a3038, 0.4),
    );
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 0.48, 1.35);
    pipe.castShadow = true;
    kart.add(pipe);
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.18, 8),
      quantumMat,
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.set(x, 0.48, 1.78);
    tip.name = "exhaustTip";
    kart.add(tip);
  }
  // SLIMEKART nose badge
  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.22, 0.08),
    purpleMat,
  );
  badge.position.set(0, 0.55, -1.12);
  kart.add(badge);
  const badgeGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.1, 0.06),
    quantumMat,
  );
  badgeGlow.position.set(0, 0.55, -1.16);
  kart.add(badgeGlow);

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
