import type { QuestDef, QuestId, QuestStatus } from "./types";

export const QUEST_ORDER: QuestId[] = [
  "wake_up",
  "get_wheels",
  "first_blood",
  "slime_outpost",
  "rescue_bandana",
  "korus_core",
  "reek_throne",
];

export const QUESTS: Record<QuestId, QuestDef> = {
  wake_up: {
    id: "wake_up",
    title: "Wake Up, Stinky",
    chapter: 1,
    blurb:
      "You claw out of a sludge crater. The ZeroVerse is burning. Your bandana is still on. Good.",
    objective: "Drive to the Scrap Beacon (cyan pillar north of spawn)",
    rewardXp: 40,
    rewardScrap: 15,
  },
  get_wheels: {
    id: "get_wheels",
    title: "Bandana Drifter Online",
    chapter: 1,
    blurb:
      "Coach Blorp wires boosters into your kart. 'World's ending. Try not to die cute.'",
    objective: "Collect 3 Scrap Caches — follow the gold sky beams near the beacon",
    rewardXp: 60,
    rewardScrap: 25,
  },
  first_blood: {
    id: "first_blood",
    title: "First Blood, First Fart",
    chapter: 2,
    blurb:
      "Slime Raiders stole Coach's lunch. And also civilization. Priorities.",
    objective: "Destroy 6 Slime Raiders",
    rewardXp: 90,
    rewardScrap: 40,
  },
  slime_outpost: {
    id: "slime_outpost",
    title: "Torch the Outpost",
    chapter: 2,
    blurb:
      "A fortified ooze camp pumps korus into the sky. Blow the generators.",
    objective: "Destroy 3 purple generators — follow the magenta sky beams / map dots",
    rewardXp: 120,
    rewardScrap: 60,
  },
  rescue_bandana: {
    id: "rescue_bandana",
    title: "Never Lose the Bandana",
    chapter: 3,
    blurb:
      "Bandit Karts cornered Pilgrim Pete — last true bandana tailor in the wastes.",
    objective: "Drive WEST to Pete's Garage (cyan sky beam) and wipe the Bandit patrol",
    rewardXp: 150,
    rewardScrap: 80,
  },
  korus_core: {
    id: "korus_core",
    title: "Heart of the Vein",
    chapter: 3,
    blurb:
      "Deep canyon: a living korus crystal warps gravity. Harvest it before Reek does.",
    objective: "Claim the Korus Core in the eastern canyon",
    rewardXp: 180,
    rewardScrap: 100,
  },
  reek_throne: {
    id: "reek_throne",
    title: "Stink Kart Wars",
    chapter: 4,
    blurb:
      "Warlord Reek sits on a throne of crushed karts. End the war. Keep the bandana.",
    objective: "Defeat Warlord Reek at the Throne Mesa",
    rewardXp: 400,
    rewardScrap: 250,
  },
};

export type QuestRuntime = {
  id: QuestId;
  status: QuestStatus;
  progress: number;
  target: number;
};

export function makeQuestRuntime(): QuestRuntime[] {
  return QUEST_ORDER.map((id, i) => ({
    id,
    status: i === 0 ? "active" : "locked",
    progress: 0,
    target: questTarget(id),
  }));
}

export function questTarget(id: QuestId): number {
  switch (id) {
    case "wake_up":
      return 1;
    case "get_wheels":
      return 3;
    case "first_blood":
      return 6;
    case "slime_outpost":
      return 3;
    case "rescue_bandana":
      return 1;
    case "korus_core":
      return 1;
    case "reek_throne":
      return 1;
  }
}

export const STORY_BEATS: Record<string, { speaker: string; lines: string[] }> =
  {
    intro: {
      speaker: "COACH BLORP",
      lines: [
        "Rise and reek, kid. ZeroVerse went full apocalypse while you napped in a puddle.",
        "Your kart's half-dead. Your stink is elite. Drive to the Scrap Beacon.",
      ],
    },
    beacon: {
      speaker: "COACH BLORP",
      lines: [
        "Beacon's hot. Three gold sky-beams around you — drive into each scrap cache. Then we put teeth on this ride.",
      ],
    },
    scrap_done: {
      speaker: "COACH BLORP",
      lines: [
        "Boosters online. Stink Cloud armed. Go thin the Raider herd. Q to blast. E for Ooze Overdrive.",
      ],
    },
    outpost: {
      speaker: "MYSTERY RADIO",
      lines: [
        "Three MAGENTA sky-beams on the ridge — those are the generators. Smash the purple cores. Don't breathe the purple.",
      ],
    },
    pete: {
      speaker: "PILGRIM PETE",
      lines: [
        "You found the cyan beam — that's my garage, kid. Clear the orange bandits on the map and I'll stitch you a legend.",
      ],
    },
    core: {
      speaker: "KORUS ECHO",
      lines: [
        "The crystal remembers every wipeout. Take it. Become the stink singularity.",
      ],
    },
    reek: {
      speaker: "WARLORD REEK",
      lines: [
        "Little slime. Big bandana. Small chance. Come die on my throne.",
      ],
    },
    victory: {
      speaker: "COACH BLORP",
      lines: [
        "You did it. Reek is compost. The wastes still stink — but now they stink of victory.",
        "Bandana never came off. Peak performance.",
      ],
    },
  };
