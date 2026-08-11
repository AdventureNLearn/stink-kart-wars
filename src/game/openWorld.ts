import * as THREE from "three";
import { aabbFromCenter, type Aabb } from "./collision";
import { COLORS } from "./types";
import {
  createArtilleryMesh,
  createCannonMesh,
  createCastleMesh,
  createTankMesh,
  createWatchtowerMesh,
  createWreckTankMesh,
} from "./military";

export type WorldObjectKind =
  | "ruin"
  | "crystal"
  | "scrap"
  | "generator"
  | "beacon"
  | "garage"
  | "throne"
  | "korus_core"
  | "barrel"
  | "wall"
  | "tree_dead"
  | "rock"
  | "billboard"
  | "pipe"
  | "tower"
  | "castle"
  | "cannon"
  | "tank_prop"
  | "artillery";

export type WorldObject = {
  id: number;
  kind: WorldObjectKind;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  solid: boolean;
  radius: number;
  aabb?: Aabb;
  mesh: THREE.Object3D;
  tag?: string;
  alive: boolean;
};

export type Landmark = {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
};

export type OpenWorld = {
  group: THREE.Group;
  objects: WorldObject[];
  colliders: Aabb[];
  landmarks: Landmark[];
  groundY: (x: number, z: number) => number;
};

let _id = 1;
const nextId = () => _id++;

/**
 * Hard-flat fort cores so large castles sit level (no floating walls on slopes).
 * coreR = fully flat; rimR = soft blend back to raw terrain.
 */
export const FORT_PADS: {
  x: number;
  z: number;
  coreR: number;
  rimR: number;
  /** Target absolute height for the flat pad. */
  floorY: number;
}[] = [
  // Reek Fortress — Throne Mesa
  { x: 190, z: 175, coreR: 30, rimR: 48, floorY: 9.2 },
  // Slime Bastion — west ridge
  { x: -110, z: 55, coreR: 22, rimR: 36, floorY: 3.4 },
  // Ashen Ruins — south
  { x: -20, z: -120, coreR: 18, rimR: 30, floorY: 1.6 },
];

/** Friendly regen pockets — Stinky heals faster inside these. */
export const SAFE_ZONES: {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  regenMul: number;
}[] = [
  { id: "spawn_safe", name: "No Man's Rest", x: 0, z: 0, radius: 28, regenMul: 3.2 },
  { id: "beacon_safe", name: "Scrap Sanctum", x: 0, z: 95, radius: 22, regenMul: 2.6 },
  { id: "bastion_safe", name: "Slime Refuge", x: -110, z: 55, radius: 20, regenMul: 2.4 },
  { id: "ruins_safe", name: "Ashen Haven", x: -20, z: -120, radius: 18, regenMul: 2.2 },
];

/** Rolling hills / valleys / mesa / canyon — no fort plateaus. */
export function rawTerrainHeight(x: number, z: number): number {
  // large smooth rolls
  const a =
    Math.sin(x * 0.008) * Math.cos(z * 0.007) * 7 +
    Math.sin(x * 0.004 + z * 0.003) * 5;
  // mid hills
  const b =
    Math.sin(x * 0.02 + 1.1) * Math.cos(z * 0.018) * 2.4 +
    Math.sin((x * 0.7 + z) * 0.015) * 1.6;
  // subtle detail
  const c =
    Math.sin(x * 0.05) * Math.cos(z * 0.045) * 0.55 +
    Math.sin(x * 0.09 + z * 0.07) * 0.25;

  // Throne mesa plateau (NE) — soft base; FORT_PADS hardens the keep core
  const throne = Math.hypot(x - 190, z - 175);
  const mesa =
    throne < 70
      ? 9 * Math.pow(1 - throne / 70, 1.4)
      : throne < 95
        ? 3 * Math.pow(1 - (throne - 70) / 25, 2)
        : 0;

  // Eastern canyon trench
  const canyonLine = Math.abs(z + 30) + Math.abs(x - 210) * 0.15;
  const canyon =
    canyonLine < 28 ? -5.5 * Math.pow(1 - canyonLine / 28, 1.5) : 0;

  // Central plain flatten near spawn
  const spawn = Math.hypot(x, z);
  const plain = spawn < 50 ? -a * (1 - spawn / 50) * 0.55 : 0;

  // Castle ridge (west garage area)
  const ridge = Math.hypot(x + 100, z - 40);
  const ridgeH = ridge < 45 ? 3.5 * Math.pow(1 - ridge / 45, 1.2) : 0;

  return a + b + c + mesa + canyon + plain + ridgeH;
}

/** Lowest raw terrain sample under a circular footprint (for foundations). */
export function footprintMinY(
  cx: number,
  cz: number,
  radius: number,
  samples = 16,
): number {
  let min = rawTerrainHeight(cx, cz);
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const r = radius * (0.55 + 0.45 * ((i % 3) / 2));
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    min = Math.min(min, rawTerrainHeight(x, z));
  }
  for (const [dx, dz] of [
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
    [radius * 0.7, radius * 0.7],
    [-radius * 0.7, radius * 0.7],
  ] as const) {
    min = Math.min(min, rawTerrainHeight(cx + dx, cz + dz));
  }
  return min;
}

function fortPadHeight(x: number, z: number, raw: number): number {
  let y = raw;
  for (const pad of FORT_PADS) {
    const d = Math.hypot(x - pad.x, z - pad.z);
    if (d <= pad.coreR) {
      y = Math.max(y, pad.floorY);
    } else if (d < pad.rimR) {
      const t = (d - pad.coreR) / (pad.rimR - pad.coreR);
      const blended = THREE.MathUtils.lerp(pad.floorY, raw, t * t);
      y = Math.max(y, blended);
    }
  }
  return y;
}

/** Public terrain height: raw + hard-flat FORT_PADS. */
export function terrainHeight(x: number, z: number): number {
  const raw = rawTerrainHeight(x, z);
  return fortPadHeight(x, z, raw);
}

/** Stone/earth plinth under castles so walls never float above the mesh. */
export function addCastleFoundation(
  parent: THREE.Object3D,
  x: number,
  z: number,
  topY: number,
  radius: number,
  theme: "reek" | "slime" | "ruins",
) {
  const foot = footprintMinY(x, z, radius * 0.95);
  const thickness = Math.max(3.2, topY - foot + 2.4);
  const color =
    theme === "slime" ? 0x2a4030 : theme === "ruins" ? 0x4a4038 : 0x3a3238;
  const geo = new THREE.CylinderGeometry(
    radius * 1.05,
    radius * 1.18,
    thickness,
    20,
  );
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.96,
      metalness: 0.04,
      envMapIntensity: 0.18,
    }),
  );
  // Sit foundation slightly into the pad so walls never float
  mesh.position.set(x, topY - thickness * 0.5 + 0.05, z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = "CastleFoundation";
  parent.add(mesh);

  const berm = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.22, radius * 1.35, 1.2, 18),
    new THREE.MeshStandardMaterial({
      color: theme === "slime" ? 0x1a3020 : 0x5a3a28,
      roughness: 0.95,
      metalness: 0.02,
    }),
  );
  berm.position.set(x, topY - 0.4, z);
  berm.receiveShadow = true;
  parent.add(berm);
}

function mat(color: number, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.08,
    envMapIntensity: 0.22,
    ...opts,
  });
}

/** Snap object base to terrain so meshes never float or bury. */
function groundAt(x: number, z: number, lift = 0): number {
  return terrainHeight(x, z) + lift;
}

/**
 * Sky light column — readable across the wastes so quest props are never lost.
 * Additive, no shadows.
 */
function addSkyBeam(parent: THREE.Object3D, color: number, height = 52): void {
  const beamMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 2.6, height, 14, 1, true),
    beamMat,
  );
  beam.position.y = height * 0.5 + 0.5;
  beam.name = "skyBeam";
  beam.renderOrder = 2;
  parent.add(beam);

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.48, height, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  core.position.y = height * 0.5 + 0.5;
  core.name = "skyBeamCore";
  core.renderOrder = 3;
  parent.add(core);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 10, 10),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  cap.position.y = height + 0.7;
  cap.name = "skyBeamCap";
  parent.add(cap);

  const flare = new THREE.Mesh(
    new THREE.CircleGeometry(3.0, 20),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  flare.rotation.x = -Math.PI / 2;
  flare.position.y = 0.1;
  flare.name = "skyBeamFlare";
  parent.add(flare);
}

/** Quest scrap cache — crate + sky beam so it can never hide in the hills. */
function createScrapCacheMesh(questCritical: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = questCritical ? "ScrapCacheQuest" : "ScrapCache";
  const crateMat = mat(0xd4a020, {
    emissive: 0xaa7700,
    emissiveIntensity: questCritical ? 1.05 : 0.55,
    metalness: 0.55,
    roughness: 0.4,
  });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.15, 1.6), crateMat);
  crate.position.y = 0.58;
  crate.castShadow = true;
  crate.receiveShadow = true;
  g.add(crate);
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.18, 1.7),
    mat(0xf0c040, {
      emissive: 0xcc8800,
      emissiveIntensity: 0.65,
      metalness: 0.4,
    }),
  );
  lid.position.y = 1.22;
  g.add(lid);
  const spike = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, 1.8, 8),
    mat(0xffcc33, {
      emissive: 0xffaa00,
      emissiveIntensity: 1.5,
      metalness: 0.3,
    }),
  );
  spike.position.y = 2.1;
  spike.name = "scrapBeacon";
  g.add(spike);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.1, 6, 22),
    mat(0xffdd55, {
      emissive: 0xffaa00,
      emissiveIntensity: 1.15,
      transparent: true,
      opacity: 0.92,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  ring.name = "scrapRing";
  g.add(ring);
  addSkyBeam(g, questCritical ? 0xffcc33 : 0xddaa44, questCritical ? 58 : 38);
  return g;
}

export function buildOpenWorld(
  detail: "low" | "medium" | "high" = "high",
): OpenWorld {
  const group = new THREE.Group();
  group.name = "ZeroVerseBattlefield";
  const objects: WorldObject[] = [];
  const colliders: Aabb[] = [];
  const landmarks: Landmark[] = [];

  const density = detail === "high" ? 1 : detail === "medium" ? 0.7 : 0.45;

  // ── Smooth heightfield terrain ──
  // Higher sample density so structure feet match the mesh (less clipping)
  const grid = detail === "high" ? 168 : detail === "medium" ? 112 : 80;
  const extent = 340;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let iz = 0; iz <= grid; iz++) {
    for (let ix = 0; ix <= grid; ix++) {
      const x = -extent + (ix / grid) * extent * 2;
      const z = -extent + (iz / grid) * extent * 2;
      const y = terrainHeight(x, z);
      pos.push(x, y, z);
      // Mars dirt → greener valleys → ash ridges
      const moist = THREE.MathUtils.clamp(0.5 - y * 0.04, 0, 1);
      const r = 0.55 + 0.15 * moist + 0.08 * Math.sin(x * 0.03);
      const g = 0.22 + 0.25 * moist + 0.05 * Math.cos(z * 0.02);
      const b = 0.1 + 0.08 * moist;
      col.push(r, g, b);
    }
  }
  for (let iz = 0; iz < grid; iz++) {
    for (let ix = 0; ix < grid; ix++) {
      const a = iz * (grid + 1) + ix;
      const b = a + 1;
      const c = a + (grid + 1);
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  tGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  tGeo.setIndex(idx);
  tGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    tGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.06,
      flatShading: false,
      // Layer 6: terrain responds to environment lighting
      envMapIntensity: 0.2,
    }),
  );
  terrain.receiveShadow = true;
  terrain.name = "terrain";
  group.add(terrain);

  // Soft ambient ground haze discs
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 80 + (i % 4) * 40;
    const hx = Math.cos(a) * r;
    const hz = Math.sin(a) * r;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(18 + (i % 3) * 6, 24),
      new THREE.MeshBasicMaterial({
        color: 0xc45c2a,
        transparent: true,
        opacity: 0.05,
        depthWrite: false,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(hx, terrainHeight(hx, hz) + 0.4, hz);
    group.add(disc);
  }

  // ── Roads (smooth asphalt strips) ──
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1a1820,
    roughness: 0.82,
    metalness: 0.08,
    envMapIntensity: 0.18,
  });
  const roadEdge = new THREE.MeshStandardMaterial({
    color: 0xc4a035,
    roughness: 0.5,
    emissive: 0x443300,
    emissiveIntensity: 0.25,
  });

  const addRoad = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    width: number,
    segs = 12,
  ) => {
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs;
      const t1 = (s + 1) / segs;
      const ax = x0 + (x1 - x0) * t0;
      const az = z0 + (z1 - z0) * t0;
      const bx = x0 + (x1 - x0) * t1;
      const bz = z0 + (z1 - z0) * t1;
      const mx = (ax + bx) * 0.5;
      const mz = (az + bz) * 0.5;
      const len = Math.hypot(bx - ax, bz - az);
      const y = terrainHeight(mx, mz) + 0.18;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.22, len + 0.15),
        roadMat,
      );
      mesh.position.set(mx, y, mz);
      mesh.rotation.y = Math.atan2(bx - ax, bz - az);
      mesh.receiveShadow = true;
      group.add(mesh);
      // edge lines
      for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.05, len),
          roadEdge,
        );
        const yaw = Math.atan2(bx - ax, bz - az);
        edge.position.set(
          mx + Math.cos(yaw) * (width * 0.48) * side,
          y + 0.12,
          mz - Math.sin(yaw) * (width * 0.48) * side,
        );
        edge.rotation.y = yaw;
        group.add(edge);
      }
    }
  };

  // Ring + spokes
  const ringR = 75;
  const ringN = 48;
  for (let i = 0; i < ringN; i++) {
    const a0 = (i / ringN) * Math.PI * 2;
    const a1 = ((i + 1) / ringN) * Math.PI * 2;
    addRoad(
      Math.cos(a0) * ringR,
      Math.sin(a0) * ringR,
      Math.cos(a1) * ringR,
      Math.sin(a1) * ringR,
      12,
      2,
    );
  }
  const spokes: [number, number][] = [
    [0, 95],
    [130, 50],
    [-110, 55],
    [210, -35],
    [190, 175],
    [-30, -110],
    [80, -90],
  ];
  for (const [tx, tz] of spokes) {
    addRoad(0, 0, tx, tz, 11, 16);
  }

  const pushObj = (
    o: Omit<WorldObject, "id" | "alive"> & { alive?: boolean },
  ) => {
    const obj: WorldObject = { ...o, id: nextId(), alive: o.alive ?? true };
    objects.push(obj);
    group.add(obj.mesh);
    if (obj.solid && obj.aabb) colliders.push(obj.aabb);
    return obj;
  };

  // ── Landmarks & epic structures ──
  landmarks.push({ id: "spawn", name: "No Man's Land", x: 0, z: 0, radius: 30 });

  // Scrap Beacon
  {
    const bx = 0;
    const bz = 95;
    landmarks.push({
      id: "beacon",
      name: "Scrap Beacon",
      x: bx,
      z: bz,
      radius: 32,
    });
    const y = terrainHeight(bx, bz);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 2.2, 26, 12),
      mat(0x1a2030, {
        emissive: COLORS.quantum,
        emissiveIntensity: 0.7,
        metalness: 0.5,
      }),
    );
    pillar.position.set(bx, y + 13, bz);
    pillar.castShadow = true;
    pushObj({
      kind: "beacon",
      x: bx,
      y: y + 13,
      z: bz,
      yaw: 0,
      hp: 9999,
      maxHp: 9999,
      solid: true,
      radius: 3.5,
      aabb: aabbFromCenter(bx, y + 13, bz, 2.2, 13, 2.2),
      mesh: pillar,
      tag: "quest_beacon",
    });
    // ring of watchtowers
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const tx = bx + Math.cos(a) * 22;
      const tz = bz + Math.sin(a) * 22;
      const tower = createWatchtowerMesh();
      const ty = terrainHeight(tx, tz);
      tower.position.set(tx, ty, tz);
      tower.scale.setScalar(0.7);
      pushObj({
        kind: "tower",
        x: tx,
        y: ty + 7,
        z: tz,
        yaw: a,
        hp: 120,
        maxHp: 120,
        solid: true,
        radius: 3,
        aabb: aabbFromCenter(tx, ty + 7, tz, 2.5, 7, 2.5),
        mesh: tower,
      });
    }
  }

  // Scrap caches — 3 quest-critical near beacon (always findable) + 2 bonus
  // Grounded with physics-compensated lift so they never clip into terrain.
  {
    const questCaches: [number, number][] = [
      [14, 108],
      [-16, 100],
      [8, 85],
    ];
    const bonusCaches: [number, number][] = [
      [-42, 100],
      [38, 75],
    ];
    let qi = 0;
    for (const [x, z] of [...questCaches, ...bonusCaches]) {
      const baseY = groundAt(x, z, 0);
      const mesh = createScrapCacheMesh(qi < 3);
      // Mesh origin at crate base — sit on terrain with small clearance
      mesh.position.set(x, baseY + 0.05, z);
      const isQuest = qi < 3;
      pushObj({
        kind: "scrap",
        x,
        y: baseY + 1.1,
        z,
        yaw: qi * 0.7,
        hp: 1,
        maxHp: 1,
        solid: false,
        radius: 2.2,
        mesh,
        tag: isQuest ? "scrap_cache_quest" : "scrap_cache",
      });
      qi++;
    }
  }

  // ── Reek Fortress Castle (Throne Mesa) ──
  {
    const cx = 190;
    const cz = 175;
    landmarks.push({
      id: "throne",
      name: "Reek Fortress",
      x: cx,
      z: cz,
      radius: 70,
    });
    const y = terrainHeight(cx, cz);
    addCastleFoundation(group, cx, cz, y, 30, "reek");
    const castle = createCastleMesh(1.15, "reek");
    castle.position.set(cx, y, cz);
    // Keep main keep tough but damageable (staged fortress fantasy)
    pushObj({
      kind: "castle",
      x: cx,
      y: y + 8,
      z: cz,
      yaw: 0,
      hp: 4200,
      maxHp: 4200,
      solid: true,
      radius: 28,
      aabb: aabbFromCenter(cx, y + 8, cz, 26, 12, 26),
      mesh: castle,
      tag: "throne",
    });
    // Destructible outer wall towers — player can "blow the fortress up"
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.2;
      const px = cx + Math.cos(a) * 32;
      const pz = cz + Math.sin(a) * 32;
      const py = groundAt(px, pz, 0);
      const tower = createWatchtowerMesh();
      tower.position.set(px, py, pz);
      tower.scale.setScalar(0.85);
      tower.rotation.y = a;
      pushObj({
        kind: "tower",
        x: px,
        y: py + 6,
        z: pz,
        yaw: a,
        hp: 160,
        maxHp: 160,
        solid: true,
        radius: 3.2,
        aabb: aabbFromCenter(px, py + 6, pz, 2.8, 6, 2.8),
        mesh: tower,
        tag: "fort_piece",
      });
    }
    // wall cannons around fortress — smashable
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = cx + Math.cos(a) * 38;
      const pz = cz + Math.sin(a) * 38;
      const py = groundAt(px, pz, 0);
      const cannon = createCannonMesh(i % 3 === 0 ? "siege" : "field");
      cannon.position.set(px, py, pz);
      cannon.rotation.y = a + Math.PI;
      pushObj({
        kind: "cannon",
        x: px,
        y: py + 1,
        z: pz,
        yaw: a + Math.PI,
        hp: 110,
        maxHp: 110,
        solid: true,
        radius: 2.5,
        aabb: aabbFromCenter(px, py + 1, pz, 2, 1.5, 2.5),
        mesh: cannon,
        tag: "fort_cannon",
      });
    }
    // Decommissioned husks around the fort (wreck look — not live enemies)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const px = cx + Math.cos(a) * 52;
      const pz = cz + Math.sin(a) * 52;
      const py = groundAt(px, pz, 0);
      const tank = createWreckTankMesh();
      tank.position.set(px, py, pz);
      tank.rotation.y = a + Math.PI * 0.6;
      tank.scale.setScalar(1.05);
      pushObj({
        kind: "tank_prop",
        x: px,
        y: py + 0.6,
        z: pz,
        yaw: a,
        hp: 50,
        maxHp: 50,
        solid: true,
        radius: 3.2,
        aabb: aabbFromCenter(px, py + 0.6, pz, 2.3, 1.0, 3.0),
        mesh: tank,
        tag: "wreck",
      });
    }
  }

  // ── Pete's Garage / Slime Bastion (west) ──
  {
    const cx = -110;
    const cz = 55;
    landmarks.push({
      id: "garage",
      name: "Pete's Garage",
      x: cx,
      z: cz,
      radius: 55,
    });
    const y = terrainHeight(cx, cz);
    addCastleFoundation(group, cx, cz, y, 24, "slime");
    const castle = createCastleMesh(0.85, "slime");
    castle.position.set(cx, y, cz);

    // Quest marker group — sky beam + garage sign so Pete is never lost
    const peteMark = new THREE.Group();
    peteMark.name = "PetesGarageMarker";
    peteMark.position.set(cx, y, cz);
    addSkyBeam(peteMark, 0x38bdf8, 64);
    // "garage pad" glow disc
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(6, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.15;
    pad.name = "skyBeamFlare";
    peteMark.add(pad);
    // Sign post
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 5.5, 0.35),
      mat(0x4a5568, { metalness: 0.4 }),
    );
    post.position.set(10, 2.75, 8);
    peteMark.add(post);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 1.6, 0.25),
      mat(0xe11d2e, {
        emissive: 0xe11d2e,
        emissiveIntensity: 0.7,
        metalness: 0.2,
      }),
    );
    sign.position.set(10, 5.4, 8);
    sign.name = "peteSign";
    peteMark.add(sign);
    // cyan banner strip
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.35, 0.28),
      mat(0x38bdf8, { emissive: 0x38bdf8, emissiveIntensity: 0.9 }),
    );
    banner.position.set(10, 4.5, 8);
    peteMark.add(banner);

    group.add(peteMark);

    pushObj({
      kind: "garage",
      x: cx,
      y: y + 6,
      z: cz,
      yaw: 0.2,
      hp: 9999,
      maxHp: 9999,
      solid: true,
      radius: 22,
      aabb: aabbFromCenter(cx, y + 6, cz, 20, 10, 20),
      mesh: castle,
      tag: "pete",
    });
    // Invisible quest target used for minimap + beam pulse (mesh is peteMark)
    pushObj({
      kind: "garage",
      x: cx,
      y: y + 2,
      z: cz,
      yaw: 0,
      hp: 9999,
      maxHp: 9999,
      solid: false,
      radius: 8,
      mesh: peteMark,
      tag: "pete_marker",
    });
  }

  // ── Ruined keep (south) ──
  {
    const cx = -20;
    const cz = -120;
    landmarks.push({
      id: "ruins",
      name: "Ashen Ruins",
      x: cx,
      z: cz,
      radius: 40,
    });
    const y = terrainHeight(cx, cz);
    addCastleFoundation(group, cx, cz, y, 20, "ruins");
    const castle = createCastleMesh(0.7, "ruins");
    castle.position.set(cx, y, cz);
    castle.rotation.y = 0.5;
    group.add(castle);
  }

  // ── Slime Outpost + generators ──
  landmarks.push({
    id: "outpost",
    name: "Artillery Outpost",
    x: 130,
    z: 50,
    radius: 45,
  });
  for (let i = 0; i < 3; i++) {
    const gx = 120 + i * 16;
    const gz = 45 + (i % 2) * 12;
    const ground = groundAt(gx, gz, 0);
    const y = ground + 2.8;
    // Self-contained local mesh (origin at ground) — beam + core always co-located
    const g = new THREE.Group();
    g.name = "OutpostGenerator";
    g.position.set(gx, ground, gz);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(3.0, 3.6, 2.4, 12),
      mat(0x2a1038, { metalness: 0.45, roughness: 0.55, emissive: 0x3a1060, emissiveIntensity: 0.35 }),
    );
    base.position.y = 1.2;
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.6, 1),
      mat(0xd946ef, {
        emissive: 0xd946ef,
        emissiveIntensity: 1.35,
        metalness: 0.25,
        roughness: 0.3,
      }),
    );
    core.position.y = 3.4;
    core.castShadow = true;
    core.name = "generatorCore";
    g.add(core);

    // Hot ring under core
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.18, 8, 24),
      mat(0xf0abfc, { emissive: 0xe879f9, emissiveIntensity: 1.2 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 2.0;
    ring.name = "generatorRing";
    g.add(ring);

    // Tall magenta sky beam — unmissable for Torch the Outpost
    addSkyBeam(g, 0xe879f9, 72);

    // Extra bright secondary core shaft
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.9, 70, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfae8ff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    shaft.position.y = 36;
    shaft.name = "skyBeamCore";
    g.add(shaft);

    pushObj({
      kind: "generator",
      x: gx,
      y: y,
      z: gz,
      yaw: 0,
      hp: 90,
      maxHp: 90,
      solid: true,
      radius: 3.8,
      aabb: aabbFromCenter(gx, y, gz, 3.2, 3.5, 3.2),
      mesh: g,
      tag: "generator",
    });
  }
  // field cannons at outpost
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = 130 + Math.cos(a) * 30;
    const pz = 50 + Math.sin(a) * 30;
    const py = terrainHeight(px, pz);
    const cannon = createCannonMesh("field");
    cannon.position.set(px, py, pz);
    cannon.rotation.y = a + Math.PI;
    pushObj({
      kind: "cannon",
      x: px,
      y: py + 1,
      z: pz,
      yaw: a,
      hp: 70,
      maxHp: 70,
      solid: true,
      radius: 2.2,
      aabb: aabbFromCenter(px, py + 1, pz, 1.8, 1.2, 2),
      mesh: cannon,
      tag: "field_cannon",
    });
  }

  // ── Korus Core canyon ──
  landmarks.push({
    id: "korus",
    name: "Korus Canyon",
    x: 210,
    z: -35,
    radius: 40,
  });
  {
    const kx = 210;
    const kz = -35;
    const y = terrainHeight(kx, kz) + 5;
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(4, 1),
      mat(COLORS.quantum, {
        emissive: COLORS.quantum,
        emissiveIntensity: 1.15,
        transparent: true,
        opacity: 0.9,
      }),
    );
    core.position.set(0, 0, 0);
    const coreGroup = new THREE.Group();
    coreGroup.add(core);
    addSkyBeam(coreGroup, 0x22d3ee, 62);
    coreGroup.position.set(kx, y, kz);
    pushObj({
      kind: "korus_core",
      x: kx,
      y,
      z: kz,
      yaw: 0,
      hp: 160,
      maxHp: 160,
      solid: true,
      radius: 4.5,
      aabb: aabbFromCenter(kx, y, kz, 3.5, 4.5, 3.5),
      mesh: coreGroup,
      tag: "korus_core",
    });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const cx = kx + Math.cos(a) * 14;
      const cz = kz + Math.sin(a) * 14;
      const cy = terrainHeight(cx, cz) + 2;
      const cr = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.2 + (i % 3) * 0.3, 0),
        mat(COLORS.quantum2, {
          emissive: COLORS.quantum2,
          emissiveIntensity: 0.55,
        }),
      );
      cr.position.set(cx, cy, cz);
      pushObj({
        kind: "crystal",
        x: cx,
        y: cy,
        z: cz,
        yaw: 0,
        hp: 30,
        maxHp: 30,
        solid: true,
        radius: 1.4,
        aabb: aabbFromCenter(cx, cy, cz, 1.1, 1.5, 1.1),
        mesh: cr,
      });
    }
  }

  // ── Safe zones (regen pockets) ──
  for (const sz of SAFE_ZONES) {
    landmarks.push({
      id: sz.id,
      name: sz.name,
      x: sz.x,
      z: sz.z,
      radius: sz.radius,
    });
    const y = terrainHeight(sz.x, sz.z) + 0.12;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(sz.radius * 0.72, sz.radius * 0.95, 48),
      new THREE.MeshBasicMaterial({
        color: 0x3dcc5a,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(sz.x, y, sz.z);
    group.add(ring);
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(sz.radius * 0.7, 40),
      new THREE.MeshStandardMaterial({
        color: 0x1a3a28,
        roughness: 0.95,
        metalness: 0.05,
        transparent: true,
        opacity: 0.55,
        envMapIntensity: 0.15,
      }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(sz.x, y - 0.02, sz.z);
    pad.receiveShadow = true;
    group.add(pad);
  }

  // ── Battlefield debris (smooth boulders, wrecks — not Lego blocks) ──
  const propN = Math.floor(95 * density);
  for (let i = 0; i < propN; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 30 + Math.random() * 290;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    // keep off castles roughly
    if (Math.hypot(x - 190, z - 175) < 55) continue;
    if (Math.hypot(x + 110, z - 55) < 40) continue;
    const y = terrainHeight(x, z);
    const roll = Math.random();

    if (roll < 0.28) {
      // smooth boulder
      const s = 1.5 + Math.random() * 3.5;
      const rock = new THREE.Mesh(
        new THREE.SphereGeometry(s, 10, 8),
        mat(0x4a3428, { roughness: 0.97 }),
      );
      rock.scale.set(1, 0.55 + Math.random() * 0.35, 1.1);
      rock.position.set(x, y + s * 0.35, z);
      rock.castShadow = true;
      rock.receiveShadow = true;
      pushObj({
        kind: "rock",
        x,
        y: y + s * 0.35,
        z,
        yaw: 0,
        hp: 50,
        maxHp: 50,
        solid: true,
        radius: s * 0.9,
        aabb: aabbFromCenter(x, y + s * 0.35, z, s * 0.85, s * 0.4, s * 0.85),
        mesh: rock,
      });
    } else if (roll < 0.4) {
      // dead smooth tree trunk
      const h = 5 + Math.random() * 7;
      const tree = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.55, h, 8),
        mat(0x2a1e16, { roughness: 0.95 }),
      );
      tree.position.set(x, y + h * 0.5, z);
      tree.rotation.z = (Math.random() - 0.5) * 0.3;
      tree.castShadow = true;
      pushObj({
        kind: "tree_dead",
        x,
        y: y + h * 0.5,
        z,
        yaw: 0,
        hp: 20,
        maxHp: 20,
        solid: true,
        radius: 1.2,
        aabb: aabbFromCenter(x, y + h * 0.5, z, 0.7, h * 0.5, 0.7),
        mesh: tree,
      });
    } else if (roll < 0.52) {
      // crystal
      const cr = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.9 + Math.random() * 0.8, 0),
        mat(COLORS.quantum, {
          emissive: COLORS.quantum,
          emissiveIntensity: 0.5,
        }),
      );
      cr.position.set(x, y + 1.4, z);
      pushObj({
        kind: "crystal",
        x,
        y: y + 1.4,
        z,
        yaw: 0,
        hp: 25,
        maxHp: 25,
        solid: true,
        radius: 1.2,
        aabb: aabbFromCenter(x, y + 1.4, z, 1, 1.4, 1),
        mesh: cr,
      });
    } else if (roll < 0.62) {
      // fuel barrel
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 1.5, 10),
        mat(0x2a8a40, { emissive: 0x0a3010, emissiveIntensity: 0.2 }),
      );
      bar.position.set(x, y + 0.75, z);
      bar.castShadow = true;
      pushObj({
        kind: "barrel",
        x,
        y: y + 0.75,
        z,
        yaw: 0,
        hp: 12,
        maxHp: 12,
        solid: true,
        radius: 0.9,
        aabb: aabbFromCenter(x, y + 0.75, z, 0.6, 0.75, 0.6),
        mesh: bar,
      });
    } else if (roll < 0.72) {
      // dead wreck husk — distinct silhouette, never mistaken for live tank
      const tank = createWreckTankMesh();
      const gy = groundAt(x, z, 0);
      tank.position.set(x, gy, z);
      tank.rotation.y = Math.random() * Math.PI * 2;
      tank.rotation.z = (Math.random() - 0.5) * 0.15;
      tank.scale.setScalar(0.9 + Math.random() * 0.15);
      pushObj({
        kind: "tank_prop",
        x,
        y: gy + 0.6,
        z,
        yaw: tank.rotation.y,
        hp: 45,
        maxHp: 45,
        solid: true,
        radius: 2.8,
        aabb: aabbFromCenter(x, gy + 0.6, z, 2.0, 0.9, 2.6),
        mesh: tank,
        tag: "wreck",
      });
    } else if (roll < 0.8) {
      // field cannon
      const cannon = createCannonMesh("field");
      const cy = groundAt(x, z, 0);
      cannon.position.set(x, cy, z);
      cannon.rotation.y = Math.random() * Math.PI * 2;
      pushObj({
        kind: "cannon",
        x,
        y: cy + 0.9,
        z,
        yaw: 0,
        hp: 55,
        maxHp: 55,
        solid: true,
        radius: 2,
        aabb: aabbFromCenter(x, y + 1, z, 1.5, 1, 2),
        mesh: cannon,
      });
    } else if (roll < 0.88) {
      const art = createArtilleryMesh();
      art.position.set(x, y, z);
      art.rotation.y = Math.random() * Math.PI * 2;
      art.scale.setScalar(0.9);
      pushObj({
        kind: "artillery",
        x,
        y: y + 1,
        z,
        yaw: 0,
        hp: 100,
        maxHp: 100,
        solid: true,
        radius: 3,
        aabb: aabbFromCenter(x, y + 1, z, 2, 1.5, 3),
        mesh: art,
      });
    } else {
      // watchtower
      const tower = createWatchtowerMesh();
      tower.position.set(x, y, z);
      tower.scale.setScalar(0.55 + Math.random() * 0.4);
      pushObj({
        kind: "tower",
        x,
        y: y + 6,
        z,
        yaw: 0,
        hp: 90,
        maxHp: 90,
        solid: true,
        radius: 2.5,
        aabb: aabbFromCenter(x, y + 6, z, 2, 6, 2),
        mesh: tower,
      });
    }
  }

  // Smooth slime pools
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 50 + Math.random() * 220;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(4 + Math.random() * 5, 24),
      mat(COLORS.slimeDark, {
        emissive: COLORS.slime,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.8,
        roughness: 0.15,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, terrainHeight(x, z) + 0.15, z);
    group.add(pool);
  }

  // Trenches / berms as smooth elongated mounds (visual only via thin boxes low profile)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.cos(a) * 100;
    const z = Math.sin(a) * 100;
    const berm = new THREE.Mesh(
      new THREE.CapsuleGeometry(1.2, 14, 4, 8),
      mat(0x5a3a28, { roughness: 0.95 }),
    );
    berm.position.set(x, terrainHeight(x, z) + 0.8, z);
    berm.rotation.z = Math.PI / 2;
    berm.rotation.y = a;
    group.add(berm);
  }

  // ── Layer 6: vegetation + ground interaction (does not change gameplay colliders) ──
  addBattlefieldVegetation(group, density);

  return {
    group,
    objects,
    colliders,
    landmarks,
    groundY: terrainHeight,
  };
}

/** Sparse dry scrub, grass tufts, and dust anchors for Layer 6 atmosphere. */
function addBattlefieldVegetation(group: THREE.Group, density: number) {
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x4a6a28,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const scrubMat = new THREE.MeshStandardMaterial({
    color: 0x5a4028,
    roughness: 0.95,
  });
  const dryMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a30,
    roughness: 0.88,
  });

  const tuftN = Math.floor(120 * density);
  for (let i = 0; i < tuftN; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 12 + Math.random() * 300;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    // keep clear of fortress cores
    if (Math.hypot(x - 190, z - 175) < 48) continue;
    if (Math.hypot(x + 110, z - 55) < 38) continue;
    const y = terrainHeight(x, z);
    const kind = Math.random();
    if (kind < 0.55) {
      // grass tuft cluster
      const tuft = new THREE.Group();
      const blades = 3 + (i % 3);
      for (let b = 0; b < blades; b++) {
        const blade = new THREE.Mesh(
          new THREE.ConeGeometry(0.08, 0.55 + Math.random() * 0.45, 4),
          grassMat,
        );
        blade.position.set(
          (Math.random() - 0.5) * 0.35,
          0.3,
          (Math.random() - 0.5) * 0.35,
        );
        blade.rotation.z = (Math.random() - 0.5) * 0.35;
        blade.rotation.x = (Math.random() - 0.5) * 0.2;
        tuft.add(blade);
      }
      tuft.position.set(x, y, z);
      group.add(tuft);
    } else if (kind < 0.8) {
      // scrub bush
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.55 + Math.random() * 0.5, 7, 6),
        scrubMat,
      );
      bush.scale.set(1.2, 0.65, 1.1);
      bush.position.set(x, y + 0.35, z);
      bush.castShadow = true;
      group.add(bush);
    } else {
      // dry reed
      const reed = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.06, 1.1 + Math.random() * 0.8, 5),
        dryMat,
      );
      reed.position.set(x, y + 0.6, z);
      reed.rotation.z = (Math.random() - 0.5) * 0.25;
      group.add(reed);
    }
  }

  // Ground contact moss patches near roads/landmarks
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x2a5a28,
    roughness: 0.95,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const r = 40 + (i % 7) * 28;
    const x = Math.cos(a) * r + (i % 3) * 4;
    const z = Math.sin(a) * r;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(2.5 + (i % 4), 12), mossMat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, terrainHeight(x, z) + 0.2, z);
    group.add(patch);
  }
}
