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
  touchThrottle = 0;
  touchHop = false;
  touchDrift = false;
  touchItem = false;
  touchSkill = false;
  touchStink = false;
  touchSprint = false;
  /** When true, throttle defaults to +0.55 if no brake/reverse held. */
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
    if (Math.abs(this.touchThrottle) > 0.05) throttle = this.touchThrottle;
    // Soft auto-roll only if no reverse and setting on
    if (throttle === 0 && this.autoAccel && Math.abs(this.touchThrottle) < 0.05) {
      throttle = 0.35;
    }
    throttle = Math.max(-1, Math.min(1, throttle));

    const hopHeld =
      this.pressed("hop") || this.any("Space", "KeyC") || this.touchHop;
    const driftHeld =
      this.pressed("drift") ||
      this.any("ShiftLeft", "ShiftRight", "KeyC") ||
      this.touchDrift ||
      hopHeld;
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

    return {
      throttle,
      steer,
      hop: this.edgeHop,
      drift: driftHeld,
      useItem: this.edgeItem,
      skill: this.edgeSkill,
      stinkCloud: this.edgeStink,
      sprint: sprintHeld,
      lookBack: this.pressed("lookBack") || this.any("KeyB"),
      pause: this.edgePause,
      autoAccel: this.autoAccel,
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
