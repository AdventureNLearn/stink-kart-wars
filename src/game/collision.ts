/** Simple open-world collision helpers (spheres + AABBs). */

export type Sphere = { x: number; y: number; z: number; r: number };
export type Aabb = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export function sphereSphere(a: Sphere, b: Sphere): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  const rr = a.r + b.r;
  return dx * dx + dy * dy + dz * dz < rr * rr;
}

export function resolveSphereSphere(
  a: Sphere,
  b: Sphere,
): { x: number; z: number } | null {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const d = Math.hypot(dx, dz);
  const rr = a.r + b.r;
  if (d >= rr || d < 1e-6) return null;
  const push = (rr - d) / d;
  return { x: dx * push, z: dz * push };
}

export function sphereAabb(s: Sphere, b: Aabb): boolean {
  const cx = Math.max(b.minX, Math.min(s.x, b.maxX));
  const cy = Math.max(b.minY, Math.min(s.y, b.maxY));
  const cz = Math.max(b.minZ, Math.min(s.z, b.maxZ));
  const dx = s.x - cx;
  const dy = s.y - cy;
  const dz = s.z - cz;
  return dx * dx + dy * dy + dz * dz < s.r * s.r;
}

/** Push sphere out of AABB on XZ (keep Y free for hills). */
export function resolveSphereAabbXZ(
  s: Sphere,
  b: Aabb,
): { x: number; z: number } | null {
  const cx = Math.max(b.minX, Math.min(s.x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(s.z, b.maxZ));
  let dx = s.x - cx;
  let dz = s.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= s.r * s.r) return null;
  // Inside fully: push toward nearest face
  if (d2 < 1e-8) {
    const left = s.x - b.minX;
    const right = b.maxX - s.x;
    const near = s.z - b.minZ;
    const far = b.maxZ - s.z;
    const m = Math.min(left, right, near, far);
    if (m === left) return { x: -(s.r + left), z: 0 };
    if (m === right) return { x: s.r + right, z: 0 };
    if (m === near) return { x: 0, z: -(s.r + near) };
    return { x: 0, z: s.r + far };
  }
  const d = Math.sqrt(d2);
  const push = (s.r - d) / d;
  return { x: dx * push, z: dz * push };
}

export function aabbFromCenter(
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
): Aabb {
  return {
    minX: x - hx,
    maxX: x + hx,
    minY: y - hy,
    maxY: y + hy,
    minZ: z - hz,
    maxZ: z + hz,
  };
}
