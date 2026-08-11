export type ControlAction =
  | "throttle"
  | "brake"
  | "steerLeft"
  | "steerRight"
  | "hop"
  | "drift"
  | "useItem"
  | "skill"
  | "stink"
  | "sprint"
  | "lookBack"
  | "pause";

export type ControlBindings = Record<ControlAction, string>;

export type GraphicsDetail = "low" | "medium" | "high";

export interface GameSettings {
  masterVol: number;
  sfxVol: number;
  musicVol: number;
  mute: boolean;
  detail: GraphicsDetail;
  cameraShake: boolean;
  showFps: boolean;
  autoAccel: boolean;
  bindings: ControlBindings;
  worldId: WorldId;
}

export type WorldId = "wastes" | "lagoon" | "abyss";

export const DEFAULT_BINDINGS: ControlBindings = {
  throttle: "KeyW",
  brake: "KeyS",
  steerLeft: "KeyA",
  steerRight: "KeyD",
  hop: "Space",
  drift: "ShiftLeft",
  useItem: "KeyX",
  skill: "KeyE",
  stink: "KeyQ",
  sprint: "KeyR",
  lookBack: "KeyB",
  pause: "Escape",
};

export const ACTION_LABELS: Record<ControlAction, string> = {
  throttle: "Accelerate",
  brake: "Brake / Reverse",
  steerLeft: "Steer Left",
  steerRight: "Steer Right",
  hop: "Jump / Stomp",
  drift: "Drift (hold)",
  useItem: "Use Item",
  skill: "Ooze Overdrive",
  stink: "Stink Cloud",
  sprint: "Quantum Sprint",
  lookBack: "Look Back",
  pause: "Pause / Menu",
};

export const DEFAULT_SETTINGS: GameSettings = {
  masterVol: 0.8,
  sfxVol: 0.9,
  musicVol: 0.45,
  mute: false,
  detail: "high",
  cameraShake: true,
  showFps: false,
  autoAccel: false,
  bindings: { ...DEFAULT_BINDINGS },
  worldId: "wastes",
};

const STORAGE_KEY = "stinky-kart-settings-v1";

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      bindings: { ...DEFAULT_BINDINGS, ...(parsed.bindings ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(s: GameSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function codeLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "Space";
  if (code === "ShiftLeft") return "L-Shift";
  if (code === "ShiftRight") return "R-Shift";
  if (code === "ControlLeft") return "L-Ctrl";
  if (code === "ControlRight") return "R-Ctrl";
  if (code === "ArrowUp") return "↑";
  if (code === "ArrowDown") return "↓";
  if (code === "ArrowLeft") return "←";
  if (code === "ArrowRight") return "→";
  if (code === "Escape") return "Esc";
  return code;
}
