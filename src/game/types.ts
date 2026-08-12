export type GamePhase = "title" | "playing" | "dialogue" | "dead" | "paused" | "victory";

export interface InputState {
  throttle: number;
  steer: number; // +1 = left (A)
  hop: boolean;
  /** Continuous hop hold (for jumpLock unlock + touch JUMP). */
  hopHeld: boolean;
  drift: boolean;
  useItem: boolean;
  skill: boolean;
  stinkCloud: boolean;
  /** True when this fire edge is secondary (double-tap). */
  secondaryFire?: boolean;
  sprint: boolean;
  lookBack: boolean;
  pause?: boolean;
  interact?: boolean;
  autoAccel?: boolean;
  /** 1–6 weapon select edge */
  weaponSelect?: number | null;
}

export type EnemyKind =
  | "slime_raider"
  | "korus_drone"
  | "bandit_kart"
  | "tank"
  | "artillery"
  | "cannon_crew"
  | "boss_reek";

export type QuestId =
  | "wake_up"
  | "get_wheels"
  | "first_blood"
  | "slime_outpost"
  | "rescue_bandana"
  | "korus_core"
  | "reek_throne";

export type QuestStatus = "locked" | "active" | "ready" | "done";

export interface QuestDef {
  id: QuestId;
  title: string;
  chapter: number;
  blurb: string;
  objective: string;
  rewardXp: number;
  rewardScrap: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  hp: number;
  maxHp: number;
  stink: number;
  maxStink: number;
  xp: number;
  level: number;
  scrap: number;
  /** Signed speed — negative when reversing. */
  speed: number;
  kills: number;
  questTitle: string;
  questObjective: string;
  questProgress: string;
  announce: string | null;
  dialogue: string | null;
  dialogueSpeaker: string | null;
  minimapHint: string;
  combo: number;
  bossHp: number | null;
  bossMax: number | null;
  location: string;
  camMode: string;
  camZoom: number;
  weaponSlot: number;
  weaponName: string;
  weaponCd: number;
  inSafe: boolean;
  safeName: string | null;
}

export const COLORS = {
  slime: 0x3dcc5a,
  slimeDark: 0x1f8a35,
  slimeLight: 0x8dff9e,
  bandana: 0xe11d2e,
  quantum: 0x22d3ee,
  quantum2: 0xa855f7,
  mars: 0xc45c2a,
  marsDark: 0x6b2e14,
  metal: 0x4a5568,
  danger: 0xff3355,
} as const;

export const RIDE_HEIGHT = 0.68;
