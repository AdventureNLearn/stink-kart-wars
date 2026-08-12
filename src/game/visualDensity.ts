/**
 * Progressive densification helpers — Layer 4 materials / micro-detail /
 * contact shadows. Faceted PBR: opaque gel, hard plates, no soap-bubble.
 */
import * as THREE from "three";

/** Soft contact blob under vehicles (Layer 4). */
export function contactShadow(
  width = 2.2,
  depth = 2.8,
  opacity = 0.38,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
  mesh.scale.set(width * 0.5, depth * 0.5, 1);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.04;
  mesh.name = "contactShadow";
  mesh.renderOrder = -1;
  return mesh;
}

/** Panel seam / panel line micro-detail (doesn't change outer volume). */
export function panelLine(
  len: number,
  along: "x" | "z",
  mat: THREE.Material,
): THREE.Mesh {
  const geo =
    along === "x"
      ? new THREE.BoxGeometry(len, 0.02, 0.03)
      : new THREE.BoxGeometry(0.03, 0.02, len);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = false;
  return m;
}

/** Tiny rivet / bolt head. */
export function rivet(mat: THREE.Material, s = 0.04): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, s * 1.6, s * 1.6), mat);
  m.castShadow = false;
  return m;
}

export function paintBody(
  color: number,
  opts: {
    roughness?: number;
    metalness?: number;
    emissive?: number;
    emissiveIntensity?: number;
    clearcoat?: number;
  } = {},
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: opts.roughness ?? 0.38,
    metalness: opts.metalness ?? 0.22,
    clearcoat: opts.clearcoat ?? 0.35,
    clearcoatRoughness: 0.4,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    envMapIntensity: 0.4,
  });
}

export function metalPlate(
  color = 0x4a5568,
  rough = 0.38,
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: rough,
    metalness: 0.82,
    clearcoat: 0.12,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.45,
  });
}

export function rubberTire(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0x12141a,
    roughness: 0.94,
    metalness: 0.04,
    clearcoat: 0.04,
    clearcoatRoughness: 0.92,
  });
}

/** Opaque faceted gel — PBR, no transmission bubble. */
export function slimeSkin(
  color: number,
  opts: { emissive?: number; emissiveIntensity?: number; opacity?: number } = {},
): THREE.MeshPhysicalMaterial {
  const transparent = opts.opacity != null && opts.opacity < 0.98;
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.52,
    metalness: 0.05,
    clearcoat: 0.14,
    clearcoatRoughness: 0.7,
    sheen: 0.18,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(0x6aaa70),
    transparent,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x07180a,
    emissiveIntensity: opts.emissiveIntensity ?? 0.1,
    envMapIntensity: 0.35,
    flatShading: true,
  });
}

/** Hard gel plate for limbs / face plates. */
export function slimePlate(
  color: number,
  opts: { emissive?: number; emissiveIntensity?: number } = {},
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.58,
    metalness: 0.04,
    clearcoat: 0.1,
    clearcoatRoughness: 0.78,
    emissive: opts.emissive ?? 0x061208,
    emissiveIntensity: opts.emissiveIntensity ?? 0.08,
    envMapIntensity: 0.32,
    flatShading: true,
  });
}

export function facetOcta(r: number): THREE.OctahedronGeometry {
  return new THREE.OctahedronGeometry(r, 0);
}

export function facetIcosa(r: number): THREE.IcosahedronGeometry {
  return new THREE.IcosahedronGeometry(r, 0);
}

export function facetWheel(radius = 0.38, width = 0.32, sides = 8): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(radius, radius, width, sides);
  geo.rotateZ(Math.PI / 2);
  return geo;
}

export function withFacetEdges(
  mesh: THREE.Mesh,
  color = 0x0e2a14,
  threshold = 18,
): THREE.Mesh {
  const edges = new THREE.EdgesGeometry(mesh.geometry, threshold);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }),
  );
  line.name = "facetEdges";
  mesh.add(line);
  return mesh;
}

export function clothBandana(color = 0xe11d2e): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.78,
    metalness: 0.0,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xff6680),
    sheenRoughness: 0.55,
    side: THREE.DoubleSide,
    flatShading: true,
  });
}

export function eyeCornea(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.12,
    metalness: 0.0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    transparent: true,
    opacity: 0.35,
    envMapIntensity: 0.35,
  });
}

export function eyeSclera(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xf2efe4,
    roughness: 0.48,
    metalness: 0.0,
    clearcoat: 0.15,
    clearcoatRoughness: 0.5,
    flatShading: true,
  });
}

/** Brushed steel accent for aero panels. */
export function brushedSteel(color = 0x8a96a4): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.42,
    metalness: 0.88,
    clearcoat: 0.2,
    clearcoatRoughness: 0.45,
    envMapIntensity: 0.55,
  });
}

/** Rough leather for straps / pads. */
export function roughLeather(color = 0x1a1210): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.9,
    metalness: 0.02,
    flatShading: true,
  });
}
