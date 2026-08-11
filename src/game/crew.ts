/**
 * Stinky's crew roster — playable slots for future character select.
 * Stinky is slot 0 (active). Slots 1–6 reserved for crew expansion.
 * Skins/controllers plug into the same kart engine without rewrites.
 */

export type CrewRole =
  | "driver"
  | "bruiser"
  | "support"
  | "scout"
  | "heavy"
  | "trickster"
  | "commander";

export type CrewMember = {
  id: string;
  /** 0 = Stinky (live). 1–6 = future unlocks. */
  slot: number;
  name: string;
  codename: string;
  role: CrewRole;
  /** Short blurb for select screen / dialogue. */
  blurb: string;
  /** Primary palette hex for skin / kart accents. */
  primaryColor: number;
  accentColor: number;
  /** Whether selectable in current build. */
  unlocked: boolean;
  /** Future: mesh factory key. */
  meshKey: string;
  /** SFX pack key for sound designer sheet. */
  sfxPack: string;
  /** VFX pack key for effects manager sheet. */
  vfxPack: string;
};

export const CREW: CrewMember[] = [
  {
    id: "stinky",
    slot: 0,
    name: "Stinky",
    codename: "Bandana Drifter",
    role: "driver",
    blurb: "The slime that never loses the bandana. Alpha ace of ZeroVerse.",
    primaryColor: 0x3dcc5a,
    accentColor: 0xe11d2e,
    unlocked: true,
    meshKey: "stinky_kart",
    sfxPack: "crew_stinky",
    vfxPack: "slime_green",
  },
  {
    id: "crew_blorp",
    slot: 1,
    name: "Coach Blorp",
    codename: "Radio Racer",
    role: "support",
    blurb: "Pit legend. Wires boosters mid-race. Yells usefully.",
    primaryColor: 0x22d3ee,
    accentColor: 0xf5e642,
    unlocked: false,
    meshKey: "crew_blorp",
    sfxPack: "crew_blorp",
    vfxPack: "quantum_cyan",
  },
  {
    id: "crew_pete",
    slot: 2,
    name: "Pilgrim Pete",
    codename: "Bandana Tailor",
    role: "scout",
    blurb: "Last true bandana tailor in the wastes. Fast hands, faster kart.",
    primaryColor: 0xe11d2e,
    accentColor: 0xfff8e0,
    unlocked: false,
    meshKey: "crew_pete",
    sfxPack: "crew_pete",
    vfxPack: "cloth_red",
  },
  {
    id: "crew_goo",
    slot: 3,
    name: "Goo Mercy",
    codename: "Ooze Overdrive",
    role: "bruiser",
    blurb: "Hits like a sludge truck. Leaves a trail of apologies.",
    primaryColor: 0x1f8a35,
    accentColor: 0xa855f7,
    unlocked: false,
    meshKey: "crew_goo",
    sfxPack: "crew_goo",
    vfxPack: "ooze_purple",
  },
  {
    id: "crew_spike",
    slot: 4,
    name: "Spike Rind",
    codename: "Mohawk Missile",
    role: "heavy",
    blurb: "Armored rind. Prefers ramming to small talk.",
    primaryColor: 0xf5e642,
    accentColor: 0x4a5568,
    unlocked: false,
    meshKey: "crew_spike",
    sfxPack: "crew_spike",
    vfxPack: "spark_metal",
  },
  {
    id: "crew_nana",
    slot: 5,
    name: "Nana Drift",
    codename: "Taco Phantom",
    role: "trickster",
    blurb: "Steals power-ups mid-air. Invented the taco line.",
    primaryColor: 0xe8a838,
    accentColor: 0x3dcc5a,
    unlocked: false,
    meshKey: "crew_nana",
    sfxPack: "crew_nana",
    vfxPack: "taco_sparkle",
  },
  {
    id: "crew_reek_defector",
    slot: 6,
    name: "Ash Korus",
    codename: "Throne Defector",
    role: "commander",
    blurb: "Ex-Reek lieutenant. Knows every fort weak joint.",
    primaryColor: 0x4a1520,
    accentColor: 0xff3355,
    unlocked: false,
    meshKey: "crew_ash",
    sfxPack: "crew_ash",
    vfxPack: "reek_ember",
  },
];

export function activeCrew(): CrewMember {
  return CREW.find((c) => c.unlocked && c.slot === 0) ?? CREW[0]!;
}

export function crewBySlot(slot: number): CrewMember | undefined {
  return CREW.find((c) => c.slot === slot);
}
