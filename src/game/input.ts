import type { InputState } from "./types";
import {
  DEFAULT_BINDINGS,
  type ControlBindings,
  type ControlAction,
} from "./settings";

/** Keyboard + touch unified input — WASD always works as hard fallbacks. */
export class GameInput {
  keys = new Set<string>();
  bindings: ControlBindings = { ...DEFAULT_BINDINGS };
  touchSteer = 0;
  /** Pending weapon slot select (1–6), consumed by engine each sample. */
  weaponSelect: number | null = null;
  /** Legacy combined axis — prefer touchGas / touchBrake so skills never zero throttle. */
  touchThrottle = 0;
  /** Multitouch-safe: hold GAS without skills wiping drive. */
  touchGas = false;
  touchBrake = false;
  touchHop = false;
  touchDrift = false;
  touchItem = false;
  touchSkill = false;
  touchStink = false;
  touchSprint = false;
  /** When true, throttle defaults to soft roll if no brake/reverse held. */
  autoAccel = false;

  private edgeHop = false;
  private edgeItem = false;
  private edgeSkill = false;
  private edgeStink = false;
  private edgePause = false;
  private prev = {
    hop: false,
    item: false,
    skill: false,
    stink: false,
    pause: false,
  };

  private unbind: (() => void) | null = null;

  setBindings(b: ControlBindings) {
    this.bindings = { ...DEFAULT_BINDINGS, ...b };
  }

  private pressed(action: ControlAction) {
    const code = this.bindings[action] || DEFAULT_BINDINGS[action];
    return this.keys.has(code);
  }

  private any(...codes: string[]) {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  attach(target: Window = window) {
    const onDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      // 1–6 weapon select
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 6) this.weaponSelect = n;
      }
      if (e.code.startsWith("Numpad")) {
        const n = Number(e.code.slice(6));
        if (n >= 1 && n <= 6) this.weaponSelect = n;
      }
      // prevent page scroll / browser shortcuts during play
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Space",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "Digit1",
          "Digit2",
          "Digit3",
          "Digit4",
          "Digit5",
          "Digit6",
        ].includes(e.code)
      ) {
        e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    // Only clear on true window blur — NOT visibilitychange (iframe preview
    // flickers can wipe keys mid-drive).
    const onBlur = () => this.keys.clear();
    target.addEventListener("keydown", onDown, { passive: false });
    target.addEventListener("keyup", onUp);
    target.addEventListener("blur", onBlur);
    this.unbind = () => {
      target.removeEventListener("keydown", onDown);
      target.removeEventListener("keyup", onUp);
      target.removeEventListener("blur", onBlur);
    };
  }

  dispose() {
    this.unbind?.();
    this.unbind = null;
  }

  sample(): InputState {
    // HARD fallbacks: WASD + arrows always work even if rebinds break
    let steer = 0;
    if (
      this.pressed("steerLeft") ||
      this.any("KeyA", "ArrowLeft")
    )
      steer += 1;
    if (
      this.pressed("steerRight") ||
      this.any("KeyD", "ArrowRight")
    )
      steer -= 1;
    steer += this.touchSteer;
    steer = Math.max(-1, Math.min(1, steer));

    let throttle = 0;
    if (this.pressed("throttle") || this.any("KeyW", "ArrowUp")) throttle += 1;
    if (this.pressed("brake") || this.any("KeyS", "ArrowDown")) throttle -= 1;

    // Multitouch GAS/BRAKE flags win over combined stick throttle so skill
    // buttons never clobber held acceleration.
    if (this.touchGas) throttle = Math.max(throttle, 1);
    if (this.touchBrake) throttle = Math.min(throttle, -1);
    if (!this.touchGas && !this.touchBrake && Math.abs(this.touchThrottle) > 0.05) {
      throttle = this.touchThrottle;
    }

    // Soft auto-roll only if no reverse intent and not already reversing hard.
    // Never fight brake/reverse with autoAccel.
    if (
      throttle === 0 &&
      this.autoAccel &&
      !this.touchBrake &&
      !this.pressed("brake") &&
      !this.any("KeyS", "ArrowDown") &&
      Math.abs(this.touchThrottle) < 0.05
    ) {
      throttle = 0.35;
    }
    throttle = Math.max(-1, Math.min(1, throttle));

    const hopHeld =
      this.pressed("hop") || this.any("Space") || this.touchHop;
    // Drift is separate from jump — Shift / dedicated drift only (not Space)
    const driftHeld =
      this.pressed("drift") ||
      this.any("ShiftLeft", "ShiftRight") ||
      this.touchDrift;
    const itemHeld =
      this.pressed("useItem") || this.any("KeyX", "KeyF") || this.touchItem;
    const skillHeld =
      this.pressed("skill") || this.any("KeyE") || this.touchSkill;
    const stinkHeld =
      this.pressed("stink") || this.any("KeyQ", "KeyZ") || this.touchStink;
    const sprintHeld =
      this.pressed("sprint") ||
      this.any("KeyR", "ControlLeft") ||
      this.touchSprint;
    const pauseHeld = this.pressed("pause") || this.any("Escape", "KeyP");

    this.edgeHop = hopHeld && !this.prev.hop;
    this.edgeItem = itemHeld && !this.prev.item;
    this.edgeSkill = skillHeld && !this.prev.skill;
    this.edgeStink = stinkHeld && !this.prev.stink;
    this.edgePause = pauseHeld && !this.prev.pause;
    this.prev = {
      hop: hopHeld,
      item: itemHeld,
      skill: skillHeld,
      stink: stinkHeld,
      pause: pauseHeld,
    };

    const weaponSelect = this.weaponSelect;
    this.weaponSelect = null;

    return {
      throttle,
      steer,
      hop: this.edgeHop,
      hopHeld,
      drift: driftHeld,
      useItem: this.edgeItem,
      skill: this.edgeSkill,
      stinkCloud: this.edgeStink,
      sprint: sprintHeld,
      lookBack: this.pressed("lookBack") || this.any("KeyB"),
      pause: this.edgePause,
      autoAccel: this.autoAccel,
      weaponSelect,
      interact:
        this.edgeItem ||
        this.edgeSkill ||
        this.edgeHop ||
        this.any("Enter", "Space"),
    };
  }

  setKeys(codes: string[]) {
    this.keys.clear();
    for (const c of codes) this.keys.add(c);
  }

  setSteer(v: number) {
    this.touchSteer = Math.max(-1, Math.min(1, v));
  }
}
