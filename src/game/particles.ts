import * as THREE from "three";

type Particle = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  active: boolean;
};

const MAX = 600;

export class ParticleSystem {
  points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private pool: Particle[] = [];
  private dummy = new THREE.Vector3();

  constructor() {
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.sizes = new Float32Array(MAX);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.geo.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;

    for (let i = 0; i < MAX; i++) {
      this.pool.push({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 0.3,
        color: new THREE.Color(),
        active: false,
      });
    }
  }

  emit(
    x: number,
    y: number,
    z: number,
    count: number,
    opts: {
      color?: number;
      speed?: number;
      life?: number;
      size?: number;
      spread?: number;
      vy?: number;
    } = {},
  ) {
    const color = opts.color ?? 0x3dcc5a;
    const speed = opts.speed ?? 4;
    const life = opts.life ?? 0.6;
    const size = opts.size ?? 0.3;
    const spread = opts.spread ?? 1;
    const vy = opts.vy ?? 2;
    let spawned = 0;
    for (const p of this.pool) {
      if (spawned >= count) break;
      if (p.active) continue;
      p.active = true;
      p.pos.set(x, y, z);
      p.vel.set(
        (Math.random() - 0.5) * speed * spread,
        Math.random() * vy + 0.5,
        (Math.random() - 0.5) * speed * spread,
      );
      p.life = life * (0.6 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.size = size * (0.7 + Math.random() * 0.6);
      p.color.setHex(color);
      spawned++;
    }
  }

  burstSplat(x: number, y: number, z: number) {
    this.emit(x, y, z, 40, {
      color: 0x3dcc5a,
      speed: 8,
      life: 0.9,
      size: 0.45,
      spread: 1.4,
      vy: 6,
    });
    this.emit(x, y + 0.5, z, 15, {
      color: 0xe11d2e,
      speed: 3,
      life: 1.1,
      size: 0.25,
      vy: 4,
    });
  }

  driftSparks(x: number, y: number, z: number, tier: number) {
    const col =
      tier >= 3 ? 0xa855f7 : tier >= 2 ? 0xf59e0b : tier >= 1 ? 0x3b82f6 : 0x94a3b8;
    this.emit(x, y, z, 3 + tier * 2, {
      color: col,
      speed: 2 + tier,
      life: 0.35,
      size: 0.2,
      vy: 0.5,
    });
  }

  boostTrail(x: number, y: number, z: number) {
    this.emit(x, y, z, 4, {
      color: 0x22d3ee,
      speed: 1.5,
      life: 0.4,
      size: 0.28,
      vy: 0.3,
    });
    this.emit(x, y, z, 2, {
      color: 0xa855f7,
      speed: 1,
      life: 0.5,
      size: 0.22,
      vy: 0.2,
    });
  }

  stinkPuff(x: number, y: number, z: number) {
    this.emit(x, y, z, 12, {
      color: 0x4ade80,
      speed: 2,
      life: 1.2,
      size: 0.55,
      vy: 1.5,
      spread: 1.8,
    });
  }

  update(dt: number) {
    let i = 0;
    for (const p of this.pool) {
      if (!p.active) {
        this.positions[i * 3] = 0;
        this.positions[i * 3 + 1] = -999;
        this.positions[i * 3 + 2] = 0;
        this.sizes[i] = 0;
        i++;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.positions[i * 3 + 1] = -999;
        this.sizes[i] = 0;
        i++;
        continue;
      }
      p.vel.y -= 4 * dt;
      p.pos.addScaledVector(p.vel, dt);
      const t = p.life / p.maxLife;
      this.positions[i * 3] = p.pos.x;
      this.positions[i * 3 + 1] = p.pos.y;
      this.positions[i * 3 + 2] = p.pos.z;
      this.colors[i * 3] = p.color.r * t;
      this.colors[i * 3 + 1] = p.color.g * t;
      this.colors[i * 3 + 2] = p.color.b * t;
      this.sizes[i] = p.size * (0.5 + t * 0.5);
      i++;
    }
    (
      this.geo.attributes.position as THREE.BufferAttribute
    ).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }
}
