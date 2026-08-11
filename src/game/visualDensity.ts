/**
 * Progressive densification helpers — Layer 4 materials / micro-detail /
 * contact shadows. Does NOT change silhouette scale or gameplay hooks.
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
  const m = new THREE.Mesh(new THREE.SphereGeometry(s, 6, 6), mat);
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
    roughness: opts.roughness ?? 0.32,
    metalness: opts.metalness ?? 0.22,
    clearcoat: opts.clearcoat ?? 0.55,
    clearcoatRoughness: 0.28,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    envMapIntensity: 0.32,
  });
}

export function metalPlate(
  color = 0x4a5568,
  rough = 0.38,
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: rough,
    metalness: 0.78,
    clearcoat: 0.15,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.38,
  });
}

export function rubberTire(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0x12141a,
    roughness: 0.92,
    metalness: 0.05,
    clearcoat: 0.05,
    clearcoatRoughness: 0.9,
  });
}

/** Translucent slime skin (Layer 4 character materials). */
export function slimeSkin(
  color: number,
  opts: { emissive?: number; emissiveIntensity?: number; opacity?: number } = {},
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18,
    sheen: 0.45,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color(0x8dff9e),
    transmission: 0.12,
    thickness: 0.6,
    transparent: true,
    opacity: opts.opacity ?? 0.94,
    emissive: opts.emissive ?? 0x0a2810,
    emissiveIntensity: opts.emissiveIntensity ?? 0.18,
    envMapIntensity: 0.28,
  });
}

export function clothBandana(color = 0xe11d2e): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.72,
    metalness: 0.0,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xff6680),
    sheenRoughness: 0.6,
  });
}

export function eyeCornea(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transmission: 0.35,
    thickness: 0.2,
    transparent: true,
    opacity: 0.55,
    envMapIntensity: 0.4,
  });
}

export function eyeSclera(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xf5f5e8,
    roughness: 0.35,
    metalness: 0.0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
  });
}
