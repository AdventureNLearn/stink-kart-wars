/** Six selectable weapons — 1–6 select, Q/E fire (single=primary, double=secondary). */

export type WeaponId =
  | "stink_spray"
  | "ooze_blob"
  | "slime_rocket"
  | "gas_mine"
  | "quantum_bolt"
  | "bandana_blade";

export type WeaponDef = {
  id: WeaponId;
  slot: number;
  name: string;
  short: string;
  /** Primary stink cost */
  cost: number;
  /** Primary cooldown */
  cd: number;
  color: number;
  projectile: "stink" | "ooze" | "rocket" | "mine" | "bolt" | "blade";
  speed: number;
  life: number;
  radius: number;
  damage: number;
  splash: number;
  melee?: number;
  /** Secondary fire (double-tap Q/E/FIRE) */
  secCost: number;
  secCd: number;
  secDamageMul: number;
  secSplashMul: number;
  secCount: number;
  secSpread: number;
  secName: string;
};

export const WEAPONS: WeaponDef[] = [
  {
    id: "stink_spray",
    slot: 1,
    name: "Stink Spray",
    short: "SPRAY",
    cost: 10,
    cd: 0.28,
    color: 0x3dcc5a,
    projectile: "stink",
    speed: 52,
    life: 1.4,
    radius: 2.2,
    damage: 22,
    splash: 0,
    secCost: 22,
    secCd: 0.55,
    secDamageMul: 1.15,
    secSplashMul: 1,
    secCount: 5,
    secSpread: 0.28,
    secName: "Spray Fan",
  },
  {
    id: "ooze_blob",
    slot: 2,
    name: "Ooze Blob",
    short: "OOZE",
    cost: 22,
    cd: 0.85,
    color: 0x8dff9e,
    projectile: "ooze",
    speed: 38,
    life: 1.8,
    radius: 3.2,
    damage: 48,
    splash: 5,
    secCost: 36,
    secCd: 1.2,
    secDamageMul: 1.45,
    secSplashMul: 1.6,
    secCount: 1,
    secSpread: 0,
    secName: "Ooze Bomb",
  },
  {
    id: "slime_rocket",
    slot: 3,
    name: "Slime Rocket",
    short: "RKT",
    cost: 28,
    cd: 1.15,
    color: 0xff6622,
    projectile: "rocket",
    speed: 62,
    life: 2.4,
    radius: 1.8,
    damage: 70,
    splash: 8,
    secCost: 42,
    secCd: 1.5,
    secDamageMul: 1.1,
    secSplashMul: 1.2,
    secCount: 3,
    secSpread: 0.18,
    secName: "Rocket Salvo",
  },
  {
    id: "gas_mine",
    slot: 4,
    name: "Gas Mine",
    short: "MINE",
    cost: 18,
    cd: 1.4,
    color: 0xc4a035,
    projectile: "mine",
    speed: 0,
    life: 12,
    radius: 3.5,
    damage: 55,
    splash: 7,
    secCost: 30,
    secCd: 1.8,
    secDamageMul: 1.05,
    secSplashMul: 1.3,
    secCount: 3,
    secSpread: 0,
    secName: "Mine Cluster",
  },
  {
    id: "quantum_bolt",
    slot: 5,
    name: "Quantum Bolt",
    short: "Q-BOLT",
    cost: 16,
    cd: 0.45,
    color: 0x22d3ee,
    projectile: "bolt",
    speed: 90,
    life: 1.1,
    radius: 1.2,
    damage: 40,
    splash: 2,
    secCost: 28,
    secCd: 0.7,
    secDamageMul: 1.35,
    secSplashMul: 1.5,
    secCount: 3,
    secSpread: 0.12,
    secName: "Bolt Storm",
  },
  {
    id: "bandana_blade",
    slot: 6,
    name: "Bandana Blade",
    short: "BLADE",
    cost: 12,
    cd: 0.55,
    color: 0xe11d2e,
    projectile: "blade",
    speed: 0,
    life: 0.25,
    radius: 4.5,
    damage: 65,
    splash: 4.5,
    melee: 5.5,
    secCost: 24,
    secCd: 0.85,
    secDamageMul: 1.55,
    secSplashMul: 1.4,
    secCount: 1,
    secSpread: 0,
    secName: "Blade Whirl",
  },
];

export function weaponBySlot(slot: number): WeaponDef {
  return WEAPONS[(slot - 1 + 6) % 6]!;
}
