import * as THREE from "three";
import { aabbFromCenter, type Aabb } from "./collision";
import { COLORS } from "./types";
import {
  createArtilleryMesh,
  createCannonMesh,
  createCastleMesh,
  createTankMesh,
  createWatchtowerMesh,
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

/** Smooth multi-octave terrain — rolling hills, valleys, mesa, canyon. */
export function terrainHeight(x: number, z: number): number {
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

  // Throne mesa plateau (NE)
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

function mat(color: number, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0.12,
    ...opts,
  });
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
  const grid = detail === "high" ? 140 : detail === "medium" ? 96 : 72;
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
      envMapIntensity: 0.35,
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
    color: 0x2a2832,
    roughness: 0.65,
    metalness: 0.15,
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

  // Scrap caches
  for (const [x, z] of [
    [18, 105],
    [-24, 82],
    [10, 120],
    [-42, 100],
    [38, 75],
  ] as const) {
    const y = terrainHeight(x, z) + 0.7;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.3, 1.8),
      mat(0xc4a035, { emissive: 0x886600, emissiveIntensity: 0.4, metalness: 0.5 }),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    pushObj({
      kind: "scrap",
      x,
      y,
      z,
      yaw: 0,
      hp: 1,
      maxHp: 1,
      solid: false,
      radius: 1.5,
      mesh,
      tag: "scrap_cache",
    });
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
    const castle = createCastleMesh(1.15, "reek");
    castle.position.set(cx, y, cz);
    pushObj({
      kind: "castle",
      x: cx,
      y: y + 8,
      z: cz,
      yaw: 0,
      hp: 9999,
      maxHp: 9999,
      solid: true,
      radius: 28,
      aabb: aabbFromCenter(cx, y + 8, cz, 26, 12, 26),
      mesh: castle,
      tag: "throne",
    });
    // wall cannons around fortress
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = cx + Math.cos(a) * 38;
      const pz = cz + Math.sin(a) * 38;
      const py = terrainHeight(px, pz);
      const cannon = createCannonMesh(i % 3 === 0 ? "siege" : "field");
      cannon.position.set(px, py, pz);
      cannon.rotation.y = a + Math.PI;
      pushObj({
        kind: "cannon",
        x: px,
        y: py + 1,
        z: pz,
        yaw: a + Math.PI,
        hp: 90,
        maxHp: 90,
        solid: true,
        radius: 2.5,
        aabb: aabbFromCenter(px, py + 1, pz, 2, 1.5, 2.5),
        mesh: cannon,
        tag: "fort_cannon",
      });
    }
    // parked tanks
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const px = cx + Math.cos(a) * 50;
      const pz = cz + Math.sin(a) * 50;
      const py = terrainHeight(px, pz);
      const tank = createTankMesh("reek");
      tank.position.set(px, py, pz);
      tank.rotation.y = a + Math.PI;
      tank.scale.setScalar(1.1);
      pushObj({
        kind: "tank_prop",
        x: px,
        y: py + 1,
        z: pz,
        yaw: a,
        hp: 140,
        maxHp: 140,
        solid: true,
        radius: 3.5,
        aabb: aabbFromCenter(px, py + 1, pz, 2.5, 1.5, 3.5),
        mesh: tank,
        tag: "prop_tank",
      });
    }
  }

  // ── Slime Bastion Castle (west) ──
  {
    const cx = -110;
    const cz = 55;
    landmarks.push({
      id: "garage",
      name: "Slime Bastion",
      x: cx,
      z: cz,
      radius: 55,
    });
    const y = terrainHeight(cx, cz);
    const castle = createCastleMesh(0.85, "slime");
    castle.position.set(cx, y, cz);
    pushObj({
      kind: "castle",
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
    const y = terrainHeight(gx, gz) + 2.5;
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.4, 1),
      mat(0xa855f7, { emissive: 0xa855f7, emissiveIntensity: 0.95 }),
    );
    core.position.set(gx, y, gz);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 3.2, 2.2, 10),
      mat(0x2a2035, { metalness: 0.4 }),
    );
    base.position.set(gx, terrainHeight(gx, gz) + 1.1, gz);
    const g = new THREE.Group();
    g.add(base);
    g.add(core);
    // emplaced artillery nearby
    const art = createArtilleryMesh();
    art.position.set(gx + 8, terrainHeight(gx + 8, gz + 4), gz + 4);
    g.add(art);
    pushObj({
      kind: "generator",
      x: gx,
      y,
      z: gz,
      yaw: 0,
      hp: 90,
      maxHp: 90,
      solid: true,
      radius: 3.4,
      aabb: aabbFromCenter(gx, y, gz, 2.8, 3, 2.8),
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
    core.position.set(kx, y, kz);
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
      mesh: core,
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

  // ── Battlefield debris (smooth boulders, wrecks — not Lego blocks) ──
  const propN = Math.floor(160 * density);
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
        mat(0x6a4a38, { roughness: 0.95 }),
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
        mat(0x3a2a20),
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
      // wrecked tank husk
      const tank = createTankMesh(Math.random() > 0.5 ? "reek" : "slime");
      tank.position.set(x, y, z);
      tank.rotation.y = Math.random() * Math.PI * 2;
      tank.rotation.z = (Math.random() - 0.5) * 0.4;
      tank.scale.setScalar(0.85);
      pushObj({
        kind: "tank_prop",
        x,
        y: y + 1,
        z,
        yaw: 0,
        hp: 80,
        maxHp: 80,
        solid: true,
        radius: 3,
        aabb: aabbFromCenter(x, y + 1, z, 2.2, 1.2, 3),
        mesh: tank,
      });
    } else if (roll < 0.8) {
      // field cannon
      const cannon = createCannonMesh("field");
      cannon.position.set(x, y, z);
      cannon.rotation.y = Math.random() * Math.PI * 2;
      pushObj({
        kind: "cannon",
        x,
        y: y + 1,
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
