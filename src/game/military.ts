import * as THREE from "three";
import {
  contactShadow,
  metalPlate,
  paintBody,
  panelLine,
  rivet,
} from "./visualDensity";

const steel = (c = 0x4a5568, _metal = 0.7) => metalPlate(c, 0.34);

const rust = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0x6b3a22,
    metalness: 0.45,
    roughness: 0.62,
    clearcoat: 0.1,
    clearcoatRoughness: 0.7,
    envMapIntensity: 0.7,
  });

const slimePaint = () =>
  paintBody(0x2a8a40, {
    metalness: 0.35,
    roughness: 0.4,
    emissive: 0x0a3010,
    emissiveIntensity: 0.18,
    clearcoat: 0.45,
  });

const reekPaint = () =>
  paintBody(0x4a1520, {
    metalness: 0.52,
    roughness: 0.36,
    emissive: 0x2a0810,
    emissiveIntensity: 0.28,
    clearcoat: 0.4,
  });

const glow = (c: number) =>
  new THREE.MeshPhysicalMaterial({
    color: c,
    emissive: c,
    emissiveIntensity: 0.95,
    metalness: 0.35,
    roughness: 0.25,
    clearcoat: 0.5,
    envMapIntensity: 1.0,
  });

/** Main battle tank — Layer 4 materials / contact / micro-detail. Silhouette frozen. */
export function createTankMesh(
  faction: "slime" | "reek" | "neutral" = "reek",
): THREE.Group {
  const root = new THREE.Group();
  root.name = "Tank";
  const bodyMat =
    faction === "slime"
      ? slimePaint()
      : faction === "reek"
        ? reekPaint()
        : steel();
  const trackMat = steel(0x1a1a22, 0.5);
  const seam = metalPlate(0x0e1014, 0.65);
  const bolt = metalPlate(0x9aa8b4, 0.28);

  root.add(contactShadow(4.2, 5.6, 0.4));

  // Hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 5.2), bodyMat);
  hull.position.y = 0.9;
  hull.castShadow = true;
  hull.receiveShadow = true;
  root.add(hull);

  // Hull panel seams + rivets
  for (const z of [-1.5, 0, 1.5]) {
    const s = panelLine(2.9, "x", seam);
    s.position.set(0, 1.46, z);
    root.add(s);
  }
  for (const x of [-1.45, 1.45]) {
    for (const z of [-2, -0.5, 1, 2]) {
      const r = rivet(bolt, 0.05);
      r.position.set(x, 1.35, z);
      root.add(r);
    }
  }

  // Front glacis slope look
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 1.4), bodyMat);
  nose.position.set(0, 1.0, -2.4);
  nose.rotation.x = 0.35;
  nose.castShadow = true;
  root.add(nose);

  // Tracks
  for (const sx of [-1.7, 1.7]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 5.4), trackMat);
    track.position.set(sx, 0.45, 0);
    track.castShadow = true;
    root.add(track);
    for (let i = 0; i < 4; i++) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.55, 12),
        steel(0x2a2a30, 0.6),
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, 0.35, -2 + i * 1.3);
      root.add(wheel);
    }
  }

  // Turret
  const turret = new THREE.Group();
  turret.name = "turret";
  const tBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.4, 0.9, 14),
    bodyMat,
  );
  tBody.position.y = 1.7;
  tBody.castShadow = true;
  turret.add(tBody);
  // Turret ring detail
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.06, 6, 20),
    seam,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.35;
  turret.add(ring);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 3.8, 10),
    steel(0x2a2a30),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.75, -2.4);
  barrel.castShadow = true;
  turret.add(barrel);
  // Barrel heat sleeve rings
  for (const z of [-1.5, -2.3, -3.1]) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.03, 6, 12),
      metalPlate(0x3a4048, 0.4),
    );
    band.position.set(0, 1.75, z);
    turret.add(band);
  }
  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.22, 0.4, 10),
    steel(0x111118),
  );
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 1.75, -4.3);
  turret.add(muzzle);
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, 0.35, 10),
    bodyMat,
  );
  cup.position.set(0.4, 2.25, 0.2);
  turret.add(cup);
  root.add(turret);

  const ex = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.8), rust());
  ex.position.set(1.0, 1.3, 2.2);
  root.add(ex);

  return root;
}

/** Static / emplaced cannon — Layer 4 densify. */
export function createCannonMesh(size: "field" | "siege" = "field"): THREE.Group {
  const root = new THREE.Group();
  root.name = "Cannon";
  const s = size === "siege" ? 1.6 : 1;
  root.add(contactShadow(2.2 * s, 2.8 * s, 0.35));

  const carriage = new THREE.Mesh(
    new THREE.BoxGeometry(1.6 * s, 0.6 * s, 2.2 * s),
    rust(),
  );
  carriage.position.y = 0.5 * s;
  carriage.castShadow = true;
  carriage.receiveShadow = true;
  root.add(carriage);

  for (const sx of [-0.9 * s, 0.9 * s]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7 * s, 0.7 * s, 0.35 * s, 14),
      steel(0x3a2a20, 0.3),
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx, 0.7 * s, 0.3 * s);
    wheel.castShadow = true;
    root.add(wheel);
    // spoke rim
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.55 * s, 0.04 * s, 6, 16),
      metalPlate(0x5a4a30, 0.5),
    );
    rim.position.set(sx, 0.7 * s, 0.3 * s);
    rim.rotation.y = Math.PI / 2;
    root.add(rim);
  }

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * s, 0.28 * s, 3.2 * s, 12),
    steel(0x2a2a30),
  );
  barrel.rotation.x = Math.PI / 2 - 0.25;
  barrel.position.set(0, 1.1 * s, -1.2 * s);
  barrel.castShadow = true;
  root.add(barrel);

  const breech = new THREE.Mesh(
    new THREE.BoxGeometry(0.7 * s, 0.7 * s, 0.7 * s),
    steel(0x3a3a45),
  );
  breech.position.set(0, 1.0 * s, 0.6 * s);
  root.add(breech);

  return root;
}

/** Self-propelled artillery — Layer 4 densify. */
export function createArtilleryMesh(): THREE.Group {
  const root = new THREE.Group();
  root.name = "Artillery";
  root.add(contactShadow(3.2, 5.0, 0.38));

  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.4, 2.2),
    paintBody(0x3a4a38, { metalness: 0.4, roughness: 0.4, clearcoat: 0.35 }),
  );
  cab.position.set(0, 1.2, -1.6);
  cab.castShadow = true;
  cab.receiveShadow = true;
  root.add(cab);

  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.5, 4.5),
    steel(0x4a4030),
  );
  bed.position.set(0, 0.9, 1.2);
  bed.castShadow = true;
  root.add(bed);

  for (let i = 0; i < 4; i++) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 3.5),
      steel(0x2a2a30),
    );
    rail.position.set(-0.9 + i * 0.6, 1.5, 1.4);
    rail.rotation.x = -0.45;
    root.add(rail);
    const rocket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 2.2, 8),
      glow(0xe11d2e),
    );
    rocket.rotation.x = Math.PI / 2 - 0.45;
    rocket.position.set(-0.9 + i * 0.6, 1.7, 0.6);
    root.add(rocket);
  }

  for (const sx of [-1.2, 1.2]) {
    for (const sz of [-1.5, 0.5, 2.2]) {
      const w = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.4, 12),
        steel(0x1a1a22),
      );
      w.rotation.z = Math.PI / 2;
      w.position.set(sx, 0.4, sz);
      root.add(w);
    }
  }
  return root;
}

/** Shell / rocket projectile mesh. */
export function createShellMesh(
  kind: "shell" | "rocket" | "stink" = "shell",
): THREE.Group {
  const g = new THREE.Group();
  if (kind === "rocket") {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 1.4, 8),
      glow(0xff4422),
    );
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), steel());
    fin.position.z = 0.5;
    g.add(fin);
  } else if (kind === "stink") {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 12),
      glow(0x3dcc5a),
    );
    g.add(body);
  } else {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      metalPlate(0xffcc66, 0.25),
    );
    g.add(body);
    const trail = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.6, 8),
      glow(0xff8800),
    );
    trail.rotation.x = Math.PI;
    trail.position.z = 0.4;
    g.add(trail);
  }
  return g;
}

/** Epic multi-tower castle — Layer 4 surface densify only (same massing). */
export function createCastleMesh(
  scale = 1,
  theme: "reek" | "slime" | "ruins" = "reek",
): THREE.Group {
  const root = new THREE.Group();
  root.name = "Castle";
  root.scale.setScalar(scale);

  const wallMat = new THREE.MeshPhysicalMaterial({
    color: theme === "slime" ? 0x3a5a40 : theme === "ruins" ? 0x6a5a50 : 0x4a3a42,
    roughness: 0.82,
    metalness: 0.12,
    clearcoat: 0.08,
    clearcoatRoughness: 0.85,
    envMapIntensity: 0.45,
  });
  const roofMat = new THREE.MeshPhysicalMaterial({
    color: theme === "slime" ? 0x1f8a35 : 0x6b1525,
    roughness: 0.65,
    metalness: 0.12,
    emissive: theme === "slime" ? 0x0a3010 : 0x2a0810,
    emissiveIntensity: 0.22,
    clearcoat: 0.2,
  });
  const stoneMat = new THREE.MeshPhysicalMaterial({
    color: 0x5a524c,
    roughness: 0.88,
    metalness: 0.06,
    envMapIntensity: 0.4,
  });

  const wallH = 10;
  const wallLen = 48;
  const wallT = 3;
  const makeWall = (x: number, z: number, rot: number, len: number) => {
    const w = new THREE.Mesh(
      new THREE.BoxGeometry(len, wallH, wallT),
      wallMat,
    );
    w.position.set(x, wallH / 2, z);
    w.rotation.y = rot;
    w.castShadow = true;
    w.receiveShadow = true;
    root.add(w);
    const n = Math.floor(len / 4);
    for (let i = 0; i < n; i++) {
      const mer = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.8, wallT + 0.4),
        wallMat,
      );
      const along = -len / 2 + 2 + i * 4;
      mer.position.set(
        x + Math.cos(rot) * along,
        wallH + 0.9,
        z - Math.sin(rot) * along,
      );
      mer.rotation.y = rot;
      root.add(mer);
    }
  };

  makeWall(0, -wallLen / 2, 0, wallLen);
  makeWall(0, wallLen / 2, 0, wallLen);
  makeWall(-wallLen / 2, 0, Math.PI / 2, wallLen);
  makeWall(wallLen / 2, 0, Math.PI / 2, wallLen);

  const gateL = new THREE.Mesh(new THREE.BoxGeometry(8, wallH + 2, 5), wallMat);
  gateL.position.set(-10, (wallH + 2) / 2, wallLen / 2);
  root.add(gateL);
  const gateR = new THREE.Mesh(new THREE.BoxGeometry(8, wallH + 2, 5), wallMat);
  gateR.position.set(10, (wallH + 2) / 2, wallLen / 2);
  root.add(gateR);
  const arch = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 4), wallMat);
  arch.position.set(0, wallH + 1, wallLen / 2);
  root.add(arch);

  const towerPos = [
    [-wallLen / 2, -wallLen / 2],
    [wallLen / 2, -wallLen / 2],
    [-wallLen / 2, wallLen / 2],
    [wallLen / 2, wallLen / 2],
  ];
  for (const [tx, tz] of towerPos) {
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 5.2, 16, 12),
      wallMat,
    );
    tower.position.set(tx!, 8, tz!);
    tower.castShadow = true;
    root.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 5, 12), roofMat);
    roof.position.set(tx!, 18.5, tz!);
    roof.castShadow = true;
    root.add(roof);
    for (let w = 0; w < 3; w++) {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.6, 0.3),
        glow(theme === "slime" ? 0x3dcc5a : 0xff3355),
      );
      const a = (w / 3) * Math.PI * 2;
      win.position.set(
        tx! + Math.cos(a) * 4.3,
        10 + w,
        tz! + Math.sin(a) * 4.3,
      );
      win.lookAt(tx!, 10, tz!);
      root.add(win);
    }
  }

  const keep = new THREE.Mesh(new THREE.BoxGeometry(16, 22, 16), stoneMat);
  keep.position.set(0, 11, -4);
  keep.castShadow = true;
  keep.receiveShadow = true;
  root.add(keep);
  const keepRoof = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 18), roofMat);
  keepRoof.position.set(0, 23.5, -4);
  root.add(keepRoof);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3, 8, 10), roofMat);
  spire.position.set(0, 29, -4);
  root.add(spire);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 5),
    new THREE.MeshPhysicalMaterial({
      color: theme === "slime" ? 0x3dcc5a : 0xe11d2e,
      side: THREE.DoubleSide,
      emissive: theme === "slime" ? 0x1f8a35 : 0x4a0a10,
      emissiveIntensity: 0.35,
      roughness: 0.7,
    }),
  );
  banner.position.set(2, 26, 4);
  root.add(banner);

  const court = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 20, 0.4, 20),
    new THREE.MeshPhysicalMaterial({
      color: 0x3a342e,
      roughness: 0.9,
      metalness: 0.05,
    }),
  );
  court.position.y = 0.2;
  court.receiveShadow = true;
  root.add(court);

  for (const [bx, bz] of [
    [-12, 8],
    [12, 8],
    [-12, -14],
  ] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 10), stoneMat);
    b.position.set(bx, 3, bz);
    b.castShadow = true;
    root.add(b);
  }

  return root;
}

/** Watchtower densify. */
export function createWatchtowerMesh(): THREE.Group {
  const root = new THREE.Group();
  root.add(contactShadow(3.5, 3.5, 0.3));
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x5a4a48,
    roughness: 0.86,
    metalness: 0.08,
    envMapIntensity: 0.4,
  });
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.8, 14, 12),
    mat,
  );
  shaft.position.y = 7;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  root.add(shaft);
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 2.5, 3, 12),
    mat,
  );
  top.position.y = 15;
  root.add(top);
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 10, 10),
    glow(0xffaa44),
  );
  light.position.y = 17;
  root.add(light);
  return root;
}
