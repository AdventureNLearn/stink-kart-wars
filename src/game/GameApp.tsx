import { useCallback, useEffect, useRef, useState } from "react";
import { KartEngine } from "./engine";
import type { HudSnapshot } from "./types";
import {
  ACTION_LABELS,
  codeLabel,
  DEFAULT_BINDINGS,
  loadSettings,
  saveSettings,
  type ControlAction,
  type GameSettings,
} from "./settings";
import { gameAudio } from "./audio";

const BIND_ACTIONS: ControlAction[] = [
  "throttle",
  "brake",
  "steerLeft",
  "steerRight",
  "hop",
  "drift",
  "useItem",
  "skill",
  "stink",
  "sprint",
  "lookBack",
  "pause",
];

type MenuTab = "play" | "settings" | "controls" | "story";

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<KartEngine | null>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [activeBtns, setActiveBtns] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [menuTab, setMenuTab] = useState<MenuTab>("play");
  const [listening, setListening] = useState<ControlAction | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new KartEngine(canvas);
    engineRef.current = engine;
    engine.applySettings(settings);
    engine.setHudCallback(setHud);
    engine.setMinimapCanvas(minimapRef.current);
    engine.start();
    setReady(true);
    const ro = new ResizeObserver(() => {
      engine.resize(canvas.clientWidth, canvas.clientHeight);
    });
    ro.observe(canvas);
    engine.resize(canvas.clientWidth, canvas.clientHeight);
    return () => {
      ro.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setMinimapCanvas(minimapRef.current);
  }, [ready, hud?.phase]);

  const persist = useCallback((next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
    engineRef.current?.applySettings(next);
  }, []);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") {
        setListening(null);
        return;
      }
      persist({
        ...settings,
        bindings: { ...settings.bindings, [listening]: e.code },
      });
      setListening(null);
      gameAudio.playUiClick();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening, settings, persist]);

  const startGame = useCallback(() => {
    gameAudio.unlock();
    engineRef.current?.startGame();
    // ensure keyboard focus for embedded preview
    canvasRef.current?.focus();
  }, []);

  const onStick = useCallback((e: React.PointerEvent) => {
    const el = stickRef.current;
    const engine = engineRef.current;
    if (!el || !engine) return;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (ev.clientX - cx) / (rect.width * 0.4);
      const dy = (ev.clientY - cy) / (rect.height * 0.4);
      engine.input.touchSteer = Math.max(-1, Math.min(1, -dx));
      engine.input.touchThrottle = Math.max(-1, Math.min(1, -dy));
      const knob = el.querySelector(".stick-knob") as HTMLElement | null;
      if (knob) {
        knob.style.transform = `translate(${Math.max(-1, Math.min(1, dx)) * 28}px, ${Math.max(-1, Math.min(1, dy)) * 28}px)`;
      }
    };
    const up = () => {
      engine.input.touchSteer = 0;
      engine.input.touchThrottle = 0;
      const knob = el.querySelector(".stick-knob") as HTMLElement | null;
      if (knob) knob.style.transform = "translate(0,0)";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    move(e.nativeEvent);
  }, []);

  const hold = useCallback((key: string, on: boolean) => {
    const engine = engineRef.current;
    if (!engine) return;
    setActiveBtns((s) => ({ ...s, [key]: on }));
    switch (key) {
      case "accel":
        engine.input.touchThrottle = on ? 1 : 0;
        break;
      case "brake":
        engine.input.touchThrottle = on ? -1 : 0;
        break;
      case "drift":
        engine.input.touchDrift = on;
        engine.input.touchHop = on;
        break;
      case "item":
        engine.input.touchItem = on;
        break;
      case "skill":
        engine.input.touchSkill = on;
        break;
      case "stink":
        engine.input.touchStink = on;
        break;
      case "sprint":
        engine.input.touchSprint = on;
        break;
    }
  }, []);

  const phase = hud?.phase ?? "title";
  const inWorld =
    phase === "playing" ||
    phase === "dialogue" ||
    phase === "dead" ||
    phase === "paused";
  const showTouch = phase === "playing";

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />

      <div className="game-overlay">
        {/* In-world HUD */}
        {inWorld && hud && (
          <>
            <div className="rpg-top">
              <div className="rpg-bars">
                <div className="bar-row">
                  <span>HP</span>
                  <div className="bar">
                    <div
                      className="fill hp"
                      style={{
                        width: `${(hud.hp / hud.maxHp) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="bar-num">
                    {Math.ceil(hud.hp)}/{hud.maxHp}
                  </span>
                </div>
                <div className="bar-row">
                  <span>STINK</span>
                  <div className="bar">
                    <div
                      className="fill stink"
                      style={{
                        width: `${(hud.stink / hud.maxStink) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="bar-row">
                  <span>LV {hud.level}</span>
                  <div className="bar">
                    <div
                      className="fill xp"
                      style={{
                        width: `${Math.min(100, (hud.xp / (hud.level * 100)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="bar-num">⚙ {hud.scrap}</span>
                </div>
              </div>

              <div className="quest-card">
                <p className="q-label">QUEST</p>
                <p className="q-title">{hud.questTitle}</p>
                <p className="q-obj">{hud.questObjective}</p>
                <p className="q-prog">{hud.questProgress}</p>
              </div>
            </div>

            <div className="rpg-center">
              <div className="loc-tag">{hud.location}</div>
              {hud.combo > 1 && (
                <div className="combo">COMBO x{hud.combo}</div>
              )}
              {hud.bossHp != null && hud.bossMax != null && (
                <div className="boss-bar">
                  <span>WARLORD REEK</span>
                  <div className="bar">
                    <div
                      className="fill boss"
                      style={{ width: `${(hud.bossHp / hud.bossMax) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {hud.announce && <div className="announce">{hud.announce}</div>}

            {hud.dialogue && (
              <div
                className="dialogue-box interactive"
                onClick={() => engineRef.current?.advanceDialogue()}
              >
                <p className="dlg-speaker">{hud.dialogueSpeaker}</p>
                <p className="dlg-text">{hud.dialogue}</p>
                <p className="dlg-hint">Click / Space / E — continue</p>
              </div>
            )}

            <div className="rpg-bottom">
              <div className="minimap">
                <canvas ref={minimapRef} width={120} height={120} />
              </div>
              <div className="hud-pill speedo">
                <p className="num">{Math.round(hud.speed * 2.8)}</p>
                <p className="unit">KM/H · {hud.kills} kills</p>
              </div>
              <div className="skill-hints">
                <span>
                  <kbd>Q</kbd> Stink Cloud
                </span>
                <span>
                  <kbd>E</kbd> Ooze Overdrive
                </span>
                <span>
                  <kbd>R</kbd> Sprint
                </span>
              </div>
            </div>

            <button
              type="button"
              className="pause-fab interactive"
              onClick={() => engineRef.current?.pause()}
            >
              ❚❚
            </button>
          </>
        )}

        {/* Title */}
        {phase === "title" && (
          <div className="start-screen interactive menu-screen">
            <p className="menu-kicker">Open World · Vehicle RPG</p>
            <h1 className="start-title wars">STINK KART WARS</h1>
            <p className="start-sub">
              Full-scale ZeroVerse warfare. Smooth battlefields, epic castles, tanks,
              cannons, artillery — and Stinky's bandana never comes off.
            </p>

            <div className="menu-tabs">
              {(
                [
                  ["play", "Play"],
                  ["story", "Story"],
                  ["settings", "Settings"],
                  ["controls", "Controls"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`menu-tab ${menuTab === id ? "active" : ""}`}
                  onClick={() => {
                    setMenuTab(id);
                    gameAudio.unlock();
                    gameAudio.playUiClick();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {menuTab === "play" && (
              <div className="menu-panel">
                <button type="button" className="start-btn" onClick={startGame}>
                  Enter the Wastes
                </button>
                <div className="feature-grid">
                  <div className="feature-card">
                    <strong>Smooth Battlefield</strong>
                    <span>Rolling hills · roads · castles · fortresses</span>
                  </div>
                  <div className="feature-card">
                    <strong>Full Warfare</strong>
                    <span>Tanks · field cannons · rocket artillery</span>
                  </div>
                  <div className="feature-card">
                    <strong>Quest Campaign</strong>
                    <span>7 missions · dialogue · boss Reek</span>
                  </div>
                  <div className="feature-card">
                    <strong>Controls</strong>
                    <span>WASD drive · Q stink · E ooze · R sprint</span>
                  </div>
                </div>
                <p className="start-sub" style={{ marginTop: "0.25rem" }}>
                  Click the game once, then use <strong>W A S D</strong> to drive.
                </p>
              </div>
            )}

            {menuTab === "story" && (
              <div className="menu-panel story-panel">
                <p>
                  <strong>Ch.1</strong> Wake in the sludge. Reach the Scrap Beacon.
                  Arm the Bandana Drifter.
                </p>
                <p>
                  <strong>Ch.2</strong> Wipe Slime Raiders. Torch the Outpost generators.
                </p>
                <p>
                  <strong>Ch.3</strong> Rescue Pilgrim Pete. Claim the Korus Core.
                </p>
                <p>
                  <strong>Ch.4</strong> Climb Throne Mesa. End Warlord Reek. Win the
                  Stink Kart Wars.
                </p>
              </div>
            )}

            {menuTab === "settings" && (
              <div className="menu-panel settings-panel">
                <label className="setting-row">
                  <span>Master</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={settings.masterVol}
                    onChange={(e) =>
                      persist({
                        ...settings,
                        masterVol: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="setting-row">
                  <span>SFX</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={settings.sfxVol}
                    onChange={(e) =>
                      persist({ ...settings, sfxVol: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="setting-row">
                  <span>Music</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={settings.musicVol}
                    onChange={(e) =>
                      persist({
                        ...settings,
                        musicVol: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="setting-row check">
                  <span>Mute</span>
                  <input
                    type="checkbox"
                    checked={settings.mute}
                    onChange={(e) =>
                      persist({ ...settings, mute: e.target.checked })
                    }
                  />
                </label>
                <label className="setting-row check">
                  <span>Camera Shake</span>
                  <input
                    type="checkbox"
                    checked={settings.cameraShake}
                    onChange={(e) =>
                      persist({ ...settings, cameraShake: e.target.checked })
                    }
                  />
                </label>
                <label className="setting-row check">
                  <span>Auto-Accelerate</span>
                  <input
                    type="checkbox"
                    checked={settings.autoAccel}
                    onChange={(e) =>
                      persist({ ...settings, autoAccel: e.target.checked })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    gameAudio.unlock();
                    gameAudio.playFart("wet");
                  }}
                >
                  Test Fart SFX
                </button>
              </div>
            )}

            {menuTab === "controls" && (
              <div className="menu-panel controls-panel">
                <p className="panel-label">Click a row, then press a key</p>
                <div className="bind-list">
                  {BIND_ACTIONS.map((action) => (
                    <button
                      key={action}
                      type="button"
                      className={`bind-row ${listening === action ? "listening" : ""}`}
                      onClick={() => {
                        gameAudio.unlock();
                        setListening(action);
                      }}
                    >
                      <span>{ACTION_LABELS[action]}</span>
                      <kbd>
                        {listening === action
                          ? "…"
                          : codeLabel(settings.bindings[action])}
                      </kbd>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() =>
                    persist({
                      ...settings,
                      bindings: { ...DEFAULT_BINDINGS },
                    })
                  }
                >
                  Reset Defaults
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "paused" && (
          <div className="finish-screen interactive">
            <h2>PAUSED</h2>
            <button
              type="button"
              className="start-btn"
              onClick={() => engineRef.current?.resume()}
            >
              Resume
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => engineRef.current?.returnToTitle()}
            >
              Quit to Title
            </button>
          </div>
        )}

        {phase === "victory" && (
          <div className="finish-screen interactive">
            <h2>STINK KART WARS</h2>
            <p style={{ color: "#3dcc5a", fontWeight: 800 }}>
              Warlord Reek is compost. The bandana never came off.
            </p>
            <p style={{ color: "#8a9a8a" }}>
              Level {hud?.level} · {hud?.kills} kills · {hud?.scrap} scrap
            </p>
            <button type="button" className="start-btn" onClick={startGame}>
              New Game+ Chaos
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => engineRef.current?.returnToTitle()}
            >
              Title
            </button>
          </div>
        )}
      </div>

      {showTouch && (
        <div className="touch-controls">
          <div
            ref={stickRef}
            className="zone stick-base"
            onPointerDown={onStick}
          >
            <div className="stick-knob" />
          </div>
          <div className="zone accel-row">
            <button
              type="button"
              className={`touch-btn ${activeBtns.brake ? "active" : ""}`}
              onPointerDown={() => hold("brake", true)}
              onPointerUp={() => hold("brake", false)}
              onPointerLeave={() => hold("brake", false)}
            >
              BRAKE
            </button>
            <button
              type="button"
              className={`touch-btn ${activeBtns.accel ? "active" : ""}`}
              onPointerDown={() => hold("accel", true)}
              onPointerUp={() => hold("accel", false)}
              onPointerLeave={() => hold("accel", false)}
            >
              GAS
            </button>
          </div>
          <div className="zone btn-cluster">
            <button
              type="button"
              className={`touch-btn drift ${activeBtns.drift ? "active" : ""}`}
              onPointerDown={() => hold("drift", true)}
              onPointerUp={() => hold("drift", false)}
              onPointerLeave={() => hold("drift", false)}
            >
              DRIFT
            </button>
            <button
              type="button"
              className={`touch-btn stink ${activeBtns.stink ? "active" : ""}`}
              onPointerDown={() => hold("stink", true)}
              onPointerUp={() => hold("stink", false)}
              onPointerLeave={() => hold("stink", false)}
            >
              STINK
            </button>
            <button
              type="button"
              className={`touch-btn skill ${activeBtns.skill ? "active" : ""}`}
              onPointerDown={() => hold("skill", true)}
              onPointerUp={() => hold("skill", false)}
              onPointerLeave={() => hold("skill", false)}
            >
              OOZE
            </button>
            <button
              type="button"
              className={`touch-btn ${activeBtns.sprint ? "active" : ""}`}
              onPointerDown={() => hold("sprint", true)}
              onPointerUp={() => hold("sprint", false)}
              onPointerLeave={() => hold("sprint", false)}
            >
              SPRINT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
