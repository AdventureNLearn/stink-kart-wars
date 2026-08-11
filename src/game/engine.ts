import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GameInput } from "./input";
import { ParticleSystem } from "./particles";
import {
  AI_PALETTES,
  createAIRacerMesh,
  createOozeWaveMesh,
  createStinkCloudMesh,
  createStinkyKart,
} from "./meshes";
import {
  createArtilleryMesh,
  createCannonMesh,
  createShellMesh,
  createTankMesh,
} from "./military";
import {
  buildOpenWorld,
  SAFE_ZONES,
  type OpenWorld,
  type WorldObject,
} from "./openWorld";
import { WEAPONS, weaponBySlot, type WeaponDef } from "./weapons";
import {
  resolveSphereAabbXZ,
  resolveSphereSphere,
  type Sphere,
} from "./collision";
import {
  makeQuestRuntime,
  QUESTS,
  QUEST_ORDER,
  STORY_BEATS,
  type QuestRuntime,
} from "./quests";
import { gameAudio } from "./audio";
import { loadSettings, type GameSettings } from "./settings";
import {
  RIDE_HEIGHT,
  type EnemyKind,
  type GamePhase,
  type HudSnapshot,
  type QuestId,
} from "./types";

type Projectile = {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  kind: "stink" | "ooze" | "enemy_shot" | "shell" | "rocket" | "mine" | "bolt" | "blade";
  owner: "player" | "enemy";
  radius: number;
  damage: number;
  splash: number;
};

type Enemy = {
  id: number;
  kind: EnemyKind;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  hp: number;
  maxHp: number;
  radius: number;
  fireCd: number;
  stun: number;
  alive: boolean;
  isBoss: boolean;
  aggro: number;
  stationary: boolean;
};

type Pickup = {
  mesh: THREE.Object3D;
  x: number;
  z: number;
  kind: "scrap" | "hp" | "stink" | "taco";
  life: number;
};


/** Four chase angles — product labels match mobile CAM HUD. */
export const CAM_MODES = [
  { id: "chase", label: "CHASE", dist: 10, height: 4.6, lookAhead: 5, baseFov: 60 },
  { id: "near", label: "NEAR", dist: 6.2, height: 3.2, lookAhead: 4, baseFov: 68 },
  { id: "high", label: "HIGH", dist: 14, height: 11, lookAhead: 2, baseFov: 58 },
  { id: "nose", label: "NOSE", dist: 2.4, height: 2.1, lookAhead: 10, baseFov: 72 },
] as const;

let eid = 1;

export class KartEngine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer | null = null;
  input = new GameInput();
  particles = new ParticleSystem();
  settings: GameSettings = loadSettings();

  phase: GamePhase = "title";
  world!: OpenWorld;
  playerMesh!: THREE.Group;
  player = {
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    speed: 0,
    lateral: 0,
    /** Vertical velocity for jump / stomp. */
    vy: 0,
    airborne: false,
    /** Blocks re-jump until release + land. */
    jumpLock: false,
    hp: 120,
    maxHp: 120,
    stink: 100,
    maxStink: 100,
    xp: 0,
    level: 1,
    scrap: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    invuln: 0,
    skillCd: 0,
    stinkCd: 0,
    weaponCd: 0,
    weaponSlot: 1,
    sprint: false,
    sprintMeter: 1,
    bank: 0,
    deadTimer: 0,
    /** Taco power-up remaining seconds (speed + jump juice). */
    tacoBoost: 0,
  };

  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  quests: QuestRuntime[] = makeQuestRuntime();
  dialogue: { speaker: string; lines: string[]; i: number } | null = null;
  announce: string | null = null;
  announceTimer = 0;
  location = "No Man's Land";
  trauma = 0;

  /** Active camera mode index into CAM_MODES. */
  camMode = 0;
  /** 0 = farthest (zoomed out), 1 = closest (zoomed in). */
  camZoom = 0.45;
  tickCount = 0;
  softwareGL = false;
  private renderDebt = 0;

  private clock = new THREE.Timer();
  private running = false;
  private raf = 0;
  private fixedAcc = 0;
  private readonly fixedDt = 1 / 60;
  private onHud: ((h: HudSnapshot) => void) | null = null;
  private minimapCanvas: HTMLCanvasElement | null = null;
  private lastHud = 0;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private keysInteractPrev = false;
  private boss: Enemy | null = null;
  private scrapCollected = 0;
  private generatorsDown = 0;
  private fortPiecesDown = 0;
  private storyFlags = new Set<string>();
  private canvas: HTMLCanvasElement;
  private pmrem?: THREE.PMREMGenerator;
  private dustTimer = 0;
  private landmarkAuras: THREE.PointLight[] = [];
  private prevHopHeld = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    // Software GL (CI / headless / SwiftShader) cannot take full open-world cost
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    let glSoft = /SwiftShader|llvmpipe|Software/i.test(ua);
    try {
      const gl = this.renderer.getContext() as WebGLRenderingContext;
      const dbg = gl?.getExtension?.("WEBGL_debug_renderer_info");
      if (dbg) {
        const rendererInfo = String(
          gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "",
        );
        if (/SwiftShader|llvmpipe|Software|Microsoft Basic/i.test(rendererInfo)) {
          glSoft = true;
        }
      }
    } catch {
      /* ignore */
    }
    this.softwareGL = glSoft;
    this.renderer.shadowMap.enabled = !this.softwareGL;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (this.softwareGL) {
      this.renderer.setPixelRatio(1);
      this.settings = { ...this.settings, detail: "low" };
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      62,
      canvas.clientWidth / Math.max(1, canvas.clientHeight),
      0.1,
      900,
    );

    canvas.tabIndex = 0;
    canvas.style.outline = "none";
    canvas.addEventListener("pointerdown", () => canvas.focus());

    this.input.attach();
    this.applySettings(this.settings);
    this.buildScene();
    this.setupPost();
    this.wireControlsTest();
  }

  /** Layer 6 post. Skip bloom on software GL — it can stall the frame loop. */
  private setupPost() {
    const w = this.canvas.clientWidth || 1280;
    const h = this.canvas.clientHeight || 720;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const softwareGL = /SwiftShader|llvmpipe|Software/i.test(ua);
    const useBloom = this.settings.detail === "high" && !softwareGL && w >= 800;
    if (!useBloom) {
      this.composer = null;
      return;
    }
    try {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(Math.floor(w * 0.5), Math.floor(h * 0.5)),
        0.1,
        0.3,
        0.92,
      );
      this.composer.addPass(bloom);
      this.composer.addPass(new OutputPass());
      this.composer.setSize(w, h);
    } catch {
      this.composer = null;
    }
  }

  setHudCallback(cb: (h: HudSnapshot) => void) {
    this.onHud = cb;
  }
  setMinimapCanvas(c: HTMLCanvasElement | null) {
    this.minimapCanvas = c;
  }

  applySettings(s: GameSettings) {
    this.settings = s;
    this.input.setBindings(s.bindings);
    this.input.autoAccel = s.autoAccel;
    gameAudio.setVolumes({
      master: s.masterVol,
      sfx: s.sfxVol,
      music: s.musicVol,
      mute: s.mute,
    });
    const pr = s.detail === "high" ? 2 : s.detail === "medium" ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pr));
    if (this.composer) {
      this.composer.setPixelRatio(Math.min(window.devicePixelRatio, pr));
    }
  }

  /** Cycle CHASE → NEAR → HIGH → NOSE. */
  cycleCamMode(dir: 1 | -1 = 1) {
    const n = CAM_MODES.length;
    this.camMode = (this.camMode + dir + n) % n;
    this.announce = CAM_MODES[this.camMode]!.label;
    this.announceTimer = 0.55;
  }

  /** Zoom in (+) or out (−). zoom 1 = closest. */
  adjustCamZoom(delta: number) {
    this.camZoom = THREE.MathUtils.clamp(this.camZoom + delta, 0, 1);
  }

  private buildScene() {
    this.scene.clear();
    this.landmarkAuras = [];
    // Layer 6 atmosphere — no global PointLight haze
    this.scene.background = new THREE.Color(0x2a100c);
    this.scene.fog = new THREE.FogExp2(0x2e140f, 0.0021);

    // Controlled weak PMREM for Physical clearcoat/slime (skip on software GL)
    if (!this.softwareGL) {
      if (!this.pmrem) {
        this.pmrem = new THREE.PMREMGenerator(this.renderer);
      }
      const envScene = new RoomEnvironment();
      this.scene.environment = this.pmrem.fromScene(envScene, 0.02).texture;
      (
        this.scene as THREE.Scene & { environmentIntensity?: number }
      ).environmentIntensity = 0.28;
    } else {
      this.scene.environment = null;
    }

    const hemi = new THREE.HemisphereLight(0xffd0a8, 0x1a0c08, 0.88);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe8d0, 1.65);
    sun.position.set(90, 140, 50);
    sun.castShadow = this.settings.detail !== "low";
    sun.shadow.mapSize.set(
      this.settings.detail === "high" ? 2048 : 1024,
      this.settings.detail === "high" ? 2048 : 1024,
    );
    sun.shadow.camera.left = -220;
    sun.shadow.camera.right = 220;
    sun.shadow.camera.top = 220;
    sun.shadow.camera.bottom = -220;
    sun.shadow.camera.far = 500;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x2a1814, 0.38));
    const fill = new THREE.DirectionalLight(0x6a88cc, 0.38);
    fill.position.set(-50, 30, -40);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff6633, 0.22);
    rim.position.set(0, 20, -80);
    this.scene.add(rim);

    this.world = buildOpenWorld(this.settings.detail);
    this.scene.add(this.world.group);
    this.scene.add(this.particles.points);
    this.attachLandmarkAuras();

    this.playerMesh = createStinkyKart();
    this.scene.add(this.playerMesh);
    this.resetPlayer(0, 0);

    this.spawnArmy();
    this.camPos.set(0, 14, 20);
    this.camLook.set(0, 1, 0);
  }

  /** Layer 6: short-range practical lights at landmarks only. */
  private attachLandmarkAuras() {
    if (this.softwareGL) return;
    const auraSpecs: {
      id: string;
      color: number;
      intensity: number;
      dist: number;
      y: number;
    }[] = [
      { id: "beacon", color: 0x3dcc5a, intensity: 0.55, dist: 42, y: 6 },
      { id: "scrap", color: 0xf59e0b, intensity: 0.4, dist: 36, y: 5 },
      { id: "outpost", color: 0x22d3ee, intensity: 0.35, dist: 40, y: 5 },
      { id: "throne", color: 0xff4422, intensity: 0.5, dist: 48, y: 8 },
      { id: "korus", color: 0xa855f7, intensity: 0.45, dist: 38, y: 6 },
      { id: "garage", color: 0x88aacc, intensity: 0.3, dist: 28, y: 4 },
    ];
    for (const lm of this.world.landmarks) {
      const spec = auraSpecs.find(
        (s) => lm.id === s.id || lm.id.includes(s.id),
      );
      if (!spec) continue;
      const light = new THREE.PointLight(
        spec.color,
        spec.intensity,
        spec.dist,
        2,
      );
      light.position.set(
        lm.x,
        this.world.groundY(lm.x, lm.z) + spec.y,
        lm.z,
      );
      light.castShadow = false;
      this.scene.add(light);
      this.landmarkAuras.push(light);
    }
  }

  private resetPlayer(x: number, z: number) {
    this.player.x = x;
    this.player.z = z;
    this.player.y = this.world.groundY(x, z) + RIDE_HEIGHT;
    this.player.yaw = 0;
    this.player.speed = 0;
    this.player.lateral = 0;
    this.player.vy = 0;
    this.player.airborne = false;
    this.player.jumpLock = false;
    this.prevHopHeld = false;
    this.player.hp = this.player.maxHp;
    this.player.stink = this.player.maxStink;
    this.player.invuln = 3.5;
    this.syncPlayerMesh();
  }

  private spawnArmy() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
    this.boss = null;

    // Poisson-ish scatter: more units, minimum spacing, keep clear of safe zones
    const placed: { x: number; z: number }[] = [];
    const minDist = 32;
    const isSafe = (x: number, z: number) =>
      SAFE_ZONES.some((sz) => Math.hypot(x - sz.x, z - sz.z) < sz.radius + 14);
    const tryPlace = (kind: EnemyKind, preferX: number, preferZ: number, jitter = 40) => {
      for (let attempt = 0; attempt < 36; attempt++) {
        const spread = jitter * (0.55 + (attempt / 36) * 1.6);
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * spread;
        const x = preferX + Math.cos(ang) * rad;
        const z = preferZ + Math.sin(ang) * rad;
        if (Math.hypot(x, z) < 42) continue; // keep spawn clear
        if (isSafe(x, z)) continue;
        if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < minDist)) continue;
        placed.push({ x, z });
        this.spawnEnemy(kind, x, z);
        return;
      }
      // last resort: walk outward from prefer until spacing ok
      for (let r = minDist; r < 120; r += 8) {
        const ang = Math.random() * Math.PI * 2;
        const x = preferX + Math.cos(ang) * r;
        const z = preferZ + Math.sin(ang) * r;
        if (Math.hypot(x, z) < 42 || isSafe(x, z)) continue;
        if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < minDist * 0.85)) continue;
        placed.push({ x, z });
        this.spawnEnemy(kind, x, z);
        return;
      }
    };

    // Spread raider packs across map arcs (not tight clumps)
    const raiderHubs: [number, number, EnemyKind, number][] = [
      [55, 55, "slime_raider", 5],
      [140, 70, "slime_raider", 4],
      [-100, 30, "bandit_kart", 4],
      [80, -90, "bandit_kart", 4],
      [200, -40, "korus_drone", 5],
      [-40, -90, "slime_raider", 3],
      [160, 140, "bandit_kart", 3],
      [-70, 100, "korus_drone", 3],
      [30, 160, "slime_raider", 3],
      [220, 80, "korus_drone", 3],
    ];
    for (const [hx, hz, kind, n] of raiderHubs) {
      for (let i = 0; i < n; i++) tryPlace(kind, hx, hz, 55);
    }

    // Tanks — sparse ring, not stacked on hubs
    const tankSpots: [number, number][] = [
      [70, 10],
      [115, 95],
      [165, 130],
      [35, -55],
      [-65, 90],
      [210, 95],
      [175, 165],
      [-45, -70],
      [95, -30],
      [-20, 130],
      [240, 40],
      [50, 200],
    ];
    for (const [x, z] of tankSpots) tryPlace("tank", x, z, 28);

    // Artillery — long range posts on ridges
    for (const [x, z] of [
      [150, 25],
      [175, 85],
      [110, -15],
      [-75, 15],
      [195, 150],
      [40, -110],
      [-30, 160],
    ] as const) {
      tryPlace("artillery", x, z, 22);
    }

    // Emplaced crews near objectives but not clustered
    for (const [x, z] of [
      [55, 100],
      [95, 40],
      [15, -60],
      [230, 155],
      [155, 195],
      [-90, 75],
      [125, 120],
      [-10, -140],
    ] as const) {
      tryPlace("cannon_crew", x, z, 18);
    }

    this.boss = this.spawnEnemy("boss_reek", 190, 185, true);
  }

  private spawnEnemy(
    kind: EnemyKind,
    x: number,
    z: number,
    isBoss = false,
  ): Enemy {
    let mesh: THREE.Group;
    if (kind === "tank" || kind === "boss_reek") {
      mesh = createTankMesh(isBoss ? "reek" : Math.random() > 0.3 ? "reek" : "slime");
      if (isBoss) mesh.scale.setScalar(2.2);
      else mesh.scale.setScalar(1.15);
    } else if (kind === "artillery") {
      mesh = createArtilleryMesh();
    } else if (kind === "cannon_crew") {
      mesh = createCannonMesh("field");
    } else {
      const palette =
        kind === "korus_drone"
          ? ([0x22d3ee, 0xa855f7, "Drone"] as const)
          : kind === "bandit_kart"
            ? ([0x8b4513, 0xe11d2e, "Bandit"] as const)
            : AI_PALETTES[Math.floor(Math.random() * AI_PALETTES.length)]!;
      mesh = createAIRacerMesh(palette[0], palette[1]);
    }
    this.scene.add(mesh);

    const stats: Record<
      EnemyKind,
      { hp: number; speed: number; r: number; stationary: boolean; aggro: number }
    > = {
      slime_raider: { hp: 40, speed: 24, r: 1.6, stationary: false, aggro: 50 },
      korus_drone: { hp: 32, speed: 28, r: 1.4, stationary: false, aggro: 55 },
      bandit_kart: { hp: 55, speed: 26, r: 1.7, stationary: false, aggro: 48 },
      tank: { hp: 180, speed: 14, r: 3.4, stationary: false, aggro: 70 },
      artillery: { hp: 120, speed: 0, r: 3.0, stationary: true, aggro: 100 },
      cannon_crew: { hp: 70, speed: 0, r: 2.2, stationary: true, aggro: 80 },
      boss_reek: { hp: 650, speed: 16, r: 5.5, stationary: false, aggro: 0 },
    };
    const st = stats[kind];
    const e: Enemy = {
      id: eid++,
      kind,
      mesh,
      x,
      y: this.world.groundY(x, z) + (kind === "tank" || isBoss ? 0.2 : RIDE_HEIGHT),
      z,
      yaw: Math.random() * Math.PI * 2,
      speed: 0,
      hp: st.hp,
      maxHp: st.hp,
      radius: st.r,
      fireCd: 0.5 + Math.random() * 1.5,
      stun: 0,
      alive: true,
      isBoss,
      aggro: isBoss ? 0 : st.aggro,
      stationary: st.stationary,
    };
    this.enemies.push(e);
    return e;
  }

  startGame() {
    gameAudio.unlock();
    gameAudio.playUiClick();
    gameAudio.startMusic(1);
    gameAudio.setRacing(true);
    this.wireControlsTest();
    this.phase = "playing";
    this.quests = makeQuestRuntime();
    this.storyFlags.clear();
    this.scrapCollected = 0;
    this.generatorsDown = 0;
    this.fortPiecesDown = 0;
    this.player.xp = 0;
    this.player.level = 1;
    this.player.scrap = 0;
    this.player.kills = 0;
    this.player.maxHp = 120;
    this.player.maxStink = 100;
    this.player.weaponSlot = 1;
    this.player.weaponCd = 0;
    this.player.tacoBoost = 0;
    this.resetPlayer(0, 0);
    this.spawnArmy();
    this.openDialogue("intro");
    try {
      this.canvas.focus();
    } catch {
      /* ignore */
    }
  }

  returnToTitle() {
    this.phase = "title";
    gameAudio.setRacing(false);
    gameAudio.stopMusic();
    this.dialogue = null;
  }

  pause() {
    if (this.phase === "playing") this.phase = "paused";
  }
  resume() {
    if (this.phase === "paused") {
      this.phase = "playing";
      // Auto-resume OST if browser suspended it
      gameAudio.unlock();
      if (!gameAudio.isMusicPlaying()) gameAudio.startMusic(1);
    }
  }

  advanceDialogue() {
    if (!this.dialogue) return;
    this.dialogue.i++;
    if (this.dialogue.i >= this.dialogue.lines.length) {
      this.dialogue = null;
      if (this.storyFlags.has("victory_pending")) {
        this.phase = "victory";
      }
    }
  }

  openDialogue(key: string) {
    const beat = STORY_BEATS[key];
    if (!beat) return;
    this.dialogue = { speaker: beat.speaker, lines: beat.lines, i: 0 };
    // Dialogue is NON-BLOCKING — phase stays playing so controls work
    if (this.phase === "title") this.phase = "playing";
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
  }

  start() {
    if (this.running) return;
    this.running = true;
    try {
      this.clock.connect(document);
    } catch {
      /* optional */
    }
    this.clock.reset();
    const loop = () => {
      if (!this.running) return;
      // Always re-schedule first so a slow render cannot kill the sim forever
      this.raf = requestAnimationFrame(loop);
      try {
        this.clock.update();
        let dt = this.clock.getDelta();
        if (dt <= 0 || !isFinite(dt)) dt = 1 / 60;
        dt = Math.min(dt, 0.05);
        this.fixedAcc += dt;
        let steps = 0;
        while (this.fixedAcc >= this.fixedDt && steps < 5) {
          this.fixedUpdate(this.fixedDt);
          this.fixedAcc -= this.fixedDt;
          steps++;
        }
        if (this.fixedAcc >= this.fixedDt) this.fixedAcc = 0;

        // Render with skip debt when frames are heavy (software GL / big world)
        if (this.renderDebt > 0) {
          this.renderDebt--;
        } else {
          const t0 = performance.now();
          try {
            if (this.composer) this.composer.render();
            else this.renderer.render(this.scene, this.camera);
          } catch {
            this.composer = null;
            try {
              this.renderer.render(this.scene, this.camera);
            } catch {
              /* ignore */
            }
          }
          const cost = performance.now() - t0;
          if (cost > 40) this.renderDebt = this.softwareGL ? 3 : 1;
          // Always paint minimap (2D) — softwareGL was hiding generator blips
          this.drawMinimap();

        }

        this.lastHud += dt;
        if (this.lastHud > 0.05) {
          this.lastHud = 0;
          this.emitHud();
        }
      } catch (err) {
        console.warn("[SKW] frame error", err);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Test helper: advance simulation without waiting on RAF/render. */
  stepSim(seconds = 0.25) {
    const steps = Math.max(1, Math.round(seconds / this.fixedDt));
    for (let i = 0; i < steps; i++) this.fixedUpdate(this.fixedDt);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    this.input.dispose();
    this.clock.dispose();
    this.composer?.dispose();
    this.pmrem?.dispose();
    this.renderer.dispose();
    gameAudio.dispose();
    if (typeof window !== "undefined" && window.__kartEngine === this) {
      window.__kartEngine = undefined;
    }
  }

  private activeQuest(): QuestRuntime | null {
    return this.quests.find((q) => q.status === "active") ?? null;
  }

  private completeQuest(id: QuestId) {
    const q = this.quests.find((x) => x.id === id);
    if (!q || q.status === "done") return;
    q.status = "done";
    q.progress = q.target;
    const def = QUESTS[id];
    this.player.xp += def.rewardXp;
    this.player.scrap += def.rewardScrap;
    this.announce = `QUEST COMPLETE: ${def.title}`;
    this.announceTimer = 2.5;
    gameAudio.playBoost();
    this.levelUpCheck();
    const idx = QUEST_ORDER.indexOf(id);
    if (idx >= 0 && idx < QUEST_ORDER.length - 1) {
      const next = this.quests.find((x) => x.id === QUEST_ORDER[idx + 1]);
      if (next) next.status = "active";
    }
  }

  private levelUpCheck() {
    const need = this.player.level * 100;
    while (this.player.xp >= need) {
      this.player.xp -= need;
      this.player.level++;
      this.player.maxHp += 18;
      this.player.hp = this.player.maxHp;
      this.player.maxStink += 10;
      this.announce = `LEVEL ${this.player.level}!`;
      this.announceTimer = 2;
      gameAudio.playItemGet();
    }
  }

  private bumpQuest(id: QuestId, amount = 1) {
    const q = this.quests.find((x) => x.id === id);
    if (!q || q.status !== "active") return;
    q.progress = Math.min(q.target, q.progress + amount);
    if (q.progress >= q.target) this.completeQuest(id);
  }

  private fixedUpdate(dt: number) {
    this.tickCount++;
    if (this.phase === "title") {
      const t = performance.now() * 0.00015;
      this.camera.position.set(
        Math.cos(t) * 55 + 20,
        22,
        Math.sin(t) * 55 + 30,
      );
      this.camera.lookAt(40, 4, 40);
      this.particles.update(dt);
      return;
    }

    if (this.phase === "paused" || this.phase === "victory") {
      const input = this.input.sample();
      if (input.pause && this.phase === "paused") this.resume();
      return;
    }

    if (this.phase === "dead") {
      this.player.deadTimer -= dt;
      if (this.player.deadTimer <= 0) {
        this.phase = "playing";
        this.resetPlayer(0, 0);
        this.announce = "BACK FROM THE OOZE";
        this.announceTimer = 1.5;
      }
      return;
    }

    const input = this.input.sample();

    // Dialogue advance (non-blocking) — Space / Enter / E / click
    if (this.dialogue) {
      const interact =
        input.interact ||
        input.useItem ||
        this.input.keys.has("Enter") ||
        this.input.keys.has("Space");
      if (interact && !this.keysInteractPrev) this.advanceDialogue();
      this.keysInteractPrev = interact;
    } else {
      this.keysInteractPrev = false;
    }

    if (input.pause) {
      this.pause();
      return;
    }

    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    if (this.announceTimer > 0) {
      this.announceTimer -= dt;
      if (this.announceTimer <= 0) this.announce = null;
    }
    if (this.player.comboTimer > 0) {
      this.player.comboTimer -= dt;
      if (this.player.comboTimer <= 0) this.player.combo = 0;
    }
    if (this.player.invuln > 0) this.player.invuln -= dt;
    if (this.player.skillCd > 0) this.player.skillCd -= dt;
    if (this.player.stinkCd > 0) this.player.stinkCd -= dt;
    if (this.player.weaponCd > 0) this.player.weaponCd -= dt;
    if (this.player.tacoBoost > 0) this.player.tacoBoost -= dt;
    const safe = this.activeSafeZone();
    const regenMul = safe?.regenMul ?? 1;
    this.player.stink = Math.min(
      this.player.maxStink,
      this.player.stink + 10 * regenMul * dt,
    );
    if (this.player.hp > 0 && this.player.hp < this.player.maxHp) {
      const base = safe ? 12 * regenMul : 3;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + base * dt);
    }

    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.checkQuestTriggers();
    this.updateCamera(dt, input.lookBack);
    this.particles.update(dt);
    gameAudio.updateEngine(this.player.speed, input.throttle);

    for (const o of this.world.objects) {
      if (!o.alive) continue;
      if (
        o.kind === "crystal" ||
        o.kind === "korus_core" ||
        o.kind === "generator"
      ) {
        o.mesh.rotation.y += dt * 1.1;
        // Spin generator core harder so purple cores read as active targets
        if (o.kind === "generator") {
          const core = o.mesh.getObjectByName("generatorCore");
          if (core) core.rotation.y += dt * 2.4;
          const ring = o.mesh.getObjectByName("generatorRing");
          if (ring) ring.rotation.z += dt * 1.6;
        }
      }
      // Scrap caches: re-ground every frame + bob/spin so they never clip or vanish
      if (o.kind === "scrap") {
        const gy = this.world.groundY(o.x, o.z);
        const bob = Math.sin(performance.now() * 0.003 + o.x) * 0.18;
        o.y = gy + 1.1 + bob;
        o.mesh.position.set(o.x, gy + 0.05 + bob * 0.4, o.z);
        o.mesh.rotation.y += dt * 0.9;
        const ring = o.mesh.getObjectByName("scrapRing");
        if (ring) ring.rotation.z += dt * 2.2;
      }
      // Pulse sky beams on quest props (scrap / generators / korus)
      if (
        o.kind === "scrap" ||
        o.kind === "generator" ||
        o.kind === "korus_core"
      ) {
        const t = performance.now() * 0.003;
        const pulse = 0.85 + Math.sin(t + o.x * 0.1) * 0.15;
        o.mesh.traverse((ch) => {
          if (
            ch.name === "skyBeam" ||
            ch.name === "skyBeamCore" ||
            ch.name === "skyBeamCap" ||
            ch.name === "skyBeamFlare"
          ) {
            ch.scale.setScalar(
              ch.name === "skyBeam" || ch.name === "skyBeamCore"
                ? 1
                : pulse,
            );
            if (ch.name === "skyBeam" || ch.name === "skyBeamCore") {
              ch.scale.set(pulse, 1, pulse);
            }
            const mat = (ch as THREE.Mesh).material as THREE.MeshBasicMaterial;
            if (mat && "opacity" in mat) {
              const base =
                ch.name === "skyBeamCore"
                  ? 0.65
                  : ch.name === "skyBeam"
                    ? 0.4
                    : 0.5;
              mat.opacity = base * (0.75 + pulse * 0.35);
            }
          }
        });
      }
    }

    // ambient battlefield explosions far away
    if (Math.random() < dt * 0.35) {
      const a = Math.random() * Math.PI * 2;
      const r = 80 + Math.random() * 160;
      const x = this.player.x + Math.cos(a) * r;
      const z = this.player.z + Math.sin(a) * r;
      this.particles.emit(x, this.world.groundY(x, z) + 2, z, 14, {
        color: 0xff6622,
        speed: 6,
        life: 0.6,
        vy: 4,
      });
    }

    // Layer 6: ambient dust / ash near player
    this.dustTimer += dt;
    if (this.dustTimer > 0.12) {
      this.dustTimer = 0;
      const px = this.player.x + (Math.random() - 0.5) * 22;
      const pz = this.player.z + (Math.random() - 0.5) * 22;
      this.particles.emit(px, this.world.groundY(px, pz) + 0.4, pz, 2, {
        color: 0xc4a080,
        speed: 0.6,
        life: 1.8,
        size: 0.22,
        vy: 0.8,
        spread: 1.5,
      });
    }
  }

  private updatePlayer(
    dt: number,
    input: ReturnType<GameInput["sample"]>,
  ) {
    const p = this.player;
    const throttle = input.throttle;

    if (input.weaponSelect && input.weaponSelect >= 1 && input.weaponSelect <= 6) {
      this.selectWeapon(input.weaponSelect);
    }

    if (input.sprint && p.sprintMeter > 0.05) {
      p.sprint = true;
      p.sprintMeter = Math.max(0, p.sprintMeter - 0.28 * dt);
    } else {
      p.sprint = false;
      p.sprintMeter = Math.min(1, p.sprintMeter + 0.14 * dt);
    }

    const maxSpeed =
      (42 + p.level * 1.8) *
      (p.sprint ? 1.45 : 1) *
      (p.tacoBoost > 0 ? 1.28 : 1);
    const accel = 48 * (p.sprint ? 1.25 : 1) * (p.tacoBoost > 0 ? 1.15 : 1);
    const thr = throttle;
    // Forward / hard-brake / reverse gear — BRAKE and S reverse properly
    if (thr > 0.05) {
      if (p.speed < -0.5) p.speed += accel * 2.6 * thr * dt;
      else p.speed += accel * thr * dt;
    } else if (thr < -0.05) {
      if (p.speed > 1.5) p.speed += accel * 2.4 * thr * dt;
      else p.speed += accel * 1.25 * thr * dt;
    } else {
      p.speed *= 1 - 0.85 * dt;
      if (Math.abs(p.speed) < 0.12) p.speed = 0;
    }

    if (p.speed > maxSpeed)
      p.speed = THREE.MathUtils.lerp(p.speed, maxSpeed, 1 - Math.exp(-3 * dt));
    if (p.speed < -maxSpeed * 0.55) p.speed = -maxSpeed * 0.55;

    const sf = THREE.MathUtils.clamp(Math.abs(p.speed) / 8, 0.15, 1);
    // snappy steer
    const turn = 2.1 * (input.drift ? 1.4 : 1) * (p.sprint ? 0.65 : 1);
    const rev = p.speed >= 0 ? 1 : -1;
    p.yaw += input.steer * turn * sf * rev * dt;
    p.bank = THREE.MathUtils.lerp(
      p.bank,
      THREE.MathUtils.clamp(input.steer * -0.14 * sf, -0.28, 0.28),
      1 - Math.exp(-8 * dt),
    );
    p.lateral = THREE.MathUtils.lerp(
      p.lateral,
      input.drift ? input.steer * 8 : 0,
      1 - Math.exp(-6 * dt),
    );

    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    p.x += (fx * p.speed + rx * p.lateral) * dt;
    p.z += (fz * p.speed + rz * p.lateral) * dt;

    const lim = 320;
    p.x = THREE.MathUtils.clamp(p.x, -lim, lim);
    p.z = THREE.MathUtils.clamp(p.z, -lim, lim);

    // ── Jump / stomp vertical physics ──
    const groundY = this.world.groundY(p.x, p.z) + RIDE_HEIGHT;
    const tacoMul = p.tacoBoost > 0 ? 1.22 : 1;
    const JUMP_VY = 15.8 * tacoMul;
    const GRAVITY = 30;
    // Engine-side hop edge (survives double-sample / dialogue Space)
    const hopEdge = (input.hopHeld && !this.prevHopHeld) || input.hop;
    this.prevHopHeld = !!input.hopHeld;
    if (hopEdge && !p.airborne && !p.jumpLock) {
      p.vy = JUMP_VY;
      p.airborne = true;
      p.jumpLock = true;
      gameAudio.playHop();
      this.particles.emit(p.x, p.y, p.z, 14, {
        color: p.tacoBoost > 0 ? 0xffcc44 : 0xc45c2a,
        speed: 5,
        life: 0.4,
        vy: 4,
      });
    }
    if (!input.hopHeld && !p.airborne) p.jumpLock = false;

    if (p.airborne) {
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      // Air trail juice
      if (Math.random() < dt * 18) {
        this.particles.emit(p.x, p.y - 0.3, p.z, 1, {
          color: p.tacoBoost > 0 ? 0xffdd66 : 0x8dff9e,
          speed: 1.2,
          life: 0.35,
          size: 0.18,
          vy: 0.5,
        });
      }
      if (p.y <= groundY && p.vy <= 0) {
        p.y = groundY;
        p.vy = 0;
        p.airborne = false;
        this.particles.emit(p.x, p.y, p.z, 8, {
          color: 0x8a6040,
          speed: 3,
          life: 0.28,
          vy: 1.5,
        });
      }
    } else {
      p.y = groundY;
      p.vy = 0;
    }

    const sphere: Sphere = { x: p.x, y: p.y, z: p.z, r: 1.5 };
    for (const box of this.world.colliders) {
      const push = resolveSphereAabbXZ(sphere, box);
      if (push) {
        p.x += push.x;
        p.z += push.z;
        sphere.x = p.x;
        sphere.z = p.z;
        p.speed *= 0.72;
      }
    }
    for (const o of this.world.objects) {
      if (!o.alive || !o.solid) continue;
      // skip huge castle interiors for soft pass near gates
      if (o.kind === "castle" && Math.hypot(o.x - p.x, o.z - p.z) < o.radius * 0.55)
        continue;
      const push = resolveSphereSphere(sphere, {
        x: o.x,
        y: o.y,
        z: o.z,
        r: o.radius,
      });
      if (push) {
        p.x += push.x * 0.85;
        p.z += push.z * 0.85;
        sphere.x = p.x;
        sphere.z = p.z;
        p.speed *= 0.78;
        if (
          Math.abs(p.speed) > 14 &&
          o.hp < 9000 &&
          (o.tag === "fort_piece" ||
            o.tag === "fort_cannon" ||
            o.tag === "throne" ||
            o.hp < 500)
        ) {
          this.damageObject(o, 18 + Math.abs(p.speed) * 0.45);
        } else if (Math.abs(p.speed) > 16 && o.hp < 9000) {
          this.damageObject(o, 15 + Math.abs(p.speed) * 0.35);
        }
      }
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const distXZ = Math.hypot(dx, dz);
      const touchR = 1.5 + e.radius;
      if (distXZ > touchR) continue;

      // Stomp: airborne, above enemy, falling → KO / chunk
      const above = p.y > e.y + e.radius * 0.35;
      if (p.airborne && above) {
        if (p.vy < 0) {
          // STOMP hit
          const isHeavy =
            e.isBoss || e.kind === "tank" || e.kind === "artillery";
          if (isHeavy) {
            this.damageEnemy(e, 55 + p.level * 4);
            p.vy = 10; // bounce
            p.airborne = true;
            this.announce = "STOMP!";
            this.announceTimer = 0.7;
          } else {
            this.damageEnemy(e, 999); // raiders / drones / bandits one-shot
            p.vy = 7;
            p.airborne = true;
            this.announce = "STOMP KO!";
            this.announceTimer = 0.85;
          }
          this.trauma = Math.min(1, this.trauma + 0.35);
          this.particles.emit(e.x, e.y + 1.5, e.z, 18, {
            color: 0x3dcc5a,
            speed: 8,
            life: 0.5,
            vy: 5,
          });
          gameAudio.playExplosion();
        }
        // pass-through while above (no body bump)
        continue;
      }

      const push = resolveSphereSphere(sphere, {
        x: e.x,
        y: e.y,
        z: e.z,
        r: e.radius,
      });
      if (push) {
        p.x += push.x * 0.55;
        p.z += push.z * 0.55;
        e.x -= push.x * 0.4;
        e.z -= push.z * 0.4;
        if (Math.abs(p.speed) > 18) {
          this.damageEnemy(e, 22 + Math.abs(p.speed) * 0.5);
          p.speed *= 0.65;
          this.trauma = Math.min(1, this.trauma + 0.2);
        }
      }
    }

    // Weapon fire — 1–6 select · Q/E/FIRE operate selected weapon
    // single tap = primary · double-tap or E = secondary
    if (input.useItem || input.stinkCloud || input.skill || input.secondaryFire) {
      this.tryFireWeapon(p.weaponSlot, !!(input.secondaryFire || input.skill));
    }

    for (const o of this.world.objects) {
      if (!o.alive || o.kind !== "scrap") continue;
      // Generous radius during get_wheels so the 3rd cache always feels fair
      const onScrapQuest = this.activeQuest()?.id === "get_wheels";
      const pickR = onScrapQuest ? 6.0 : 4.2;
      if (Math.hypot(o.x - p.x, o.z - p.z) < pickR) {
        o.alive = false;
        o.mesh.visible = false;
        this.scrapCollected++;
        this.player.scrap += 8;
        this.bumpQuest("get_wheels");
        gameAudio.playItemGet();
        this.announce = `SCRAP ${Math.min(3, this.scrapCollected)}/3`;
        this.announceTimer = 1.1;
        this.particles.emit(o.x, o.y, o.z, 16, {
          color: 0xffcc33,
          speed: 5,
          life: 0.55,
        });
      }
    }

    let loc = "Open Battlefield";
    for (const lm of this.world.landmarks) {
      if (Math.hypot(lm.x - p.x, lm.z - p.z) < lm.radius) {
        loc = lm.name;
        break;
      }
    }
    this.location = loc;
    this.syncPlayerMesh();
  }

  private syncPlayerMesh() {
    const p = this.player;
    this.playerMesh.position.set(p.x, p.y, p.z);
    this.playerMesh.rotation.order = "YXZ";
    this.playerMesh.rotation.y = p.yaw + Math.PI;
    this.playerMesh.rotation.z = p.bank;
    this.playerMesh.rotation.x = 0;
    this.playerMesh.scale.setScalar(1.4);
    this.playerMesh.visible =
      p.invuln <= 0 || Math.floor(p.invuln * 12) % 2 === 0;
  }


  private activeSafeZone() {
    const p = this.player;
    for (const sz of SAFE_ZONES) {
      if (Math.hypot(p.x - sz.x, p.z - sz.z) < sz.radius) return sz;
    }
    return null;
  }

  selectWeapon(slot: number) {
    const s = Math.max(1, Math.min(6, Math.round(slot)));
    this.player.weaponSlot = s;
    const w = weaponBySlot(s);
    this.announce = `${s}: ${w.name}`;
    this.announceTimer = 0.7;
  }

  cycleWeapon(dir: 1 | -1) {
    const next = ((this.player.weaponSlot - 1 + dir + 6) % 6) + 1;
    this.selectWeapon(next);
  }

  private tryFireWeapon(slot: number, secondary = false) {
    const p = this.player;
    const w = weaponBySlot(slot);
    const cost = secondary ? w.secCost : w.cost;
    const cd = secondary ? w.secCd : w.cd;
    if (p.weaponCd > 0.02) return;
    if (p.stink < cost) {
      this.announce = "LOW STINK";
      this.announceTimer = 0.55;
      return;
    }
    p.weaponSlot = w.slot;
    p.weaponCd = cd;
    p.stink -= cost;
    if (secondary) {
      this.announce = w.secName;
      this.announceTimer = 0.55;
    }
    this.fireWeapon(w, secondary);
  }

  private fireWeapon(w: WeaponDef, secondary = false) {
    const p = this.player;
    const baseYaw = p.yaw;
    const dmgMul = secondary ? w.secDamageMul : 1;
    const splashMul = secondary ? w.secSplashMul : 1;
    const count = secondary ? Math.max(1, w.secCount) : 1;
    const spread = secondary ? w.secSpread : 0;
    const damage = (w.damage + p.level * 3) * dmgMul;
    const splash = w.splash * splashMul;
    const radius = w.radius * (secondary ? 1.15 : 1);
    const melee = (w.melee ?? 5.5) * (secondary ? 1.35 : 1);

    if (w.projectile === "blade") {
      gameAudio.playFart("big");
      this.trauma = Math.min(1, this.trauma + (secondary ? 0.4 : 0.25));
      const fx = -Math.sin(baseYaw);
      const fz = -Math.cos(baseYaw);
      this.particles.emit(p.x + fx * 2, p.y + 1.2, p.z + fz * 2, secondary ? 28 : 16, {
        color: w.color,
        speed: secondary ? 12 : 8,
        life: 0.4,
        vy: 2,
      });
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - p.x, e.z - p.z) < melee) {
          this.damageEnemy(e, damage);
        }
      }
      return;
    }

    if (w.projectile === "mine") {
      for (let i = 0; i < count; i++) {
        const ang = baseYaw + (i - (count - 1) / 2) * 0.55;
        const fx = -Math.sin(ang);
        const fz = -Math.cos(ang);
        const mesh = createStinkCloudMesh();
        mesh.scale.setScalar(secondary ? 0.9 : 0.7);
        const x = p.x - fx * (2.5 + i * 0.8);
        const z = p.z - fz * (2.5 + i * 0.8);
        const y = this.world.groundY(x, z) + 0.6;
        mesh.position.set(x, y, z);
        this.scene.add(mesh);
        this.projectiles.push({
          mesh,
          x,
          y,
          z,
          vx: 0,
          vy: 0,
          vz: 0,
          life: w.life,
          kind: "mine",
          owner: "player",
          radius,
          damage,
          splash,
        });
      }
      gameAudio.playStinkBomb();
      return;
    }

    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const yaw = baseYaw + offset;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      let mesh: THREE.Group;
      if (w.projectile === "ooze") mesh = createOozeWaveMesh();
      else if (w.projectile === "rocket") mesh = createShellMesh("rocket");
      else if (w.projectile === "bolt") mesh = createShellMesh("shell");
      else mesh = createStinkCloudMesh();

      const speed = w.speed + Math.abs(p.speed) * 0.4;
      const x = p.x + fx * 3.2;
      const z = p.z + fz * 3.2;
      const y = p.y + 1.1;
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      const kind =
        w.projectile === "rocket"
          ? "rocket"
          : w.projectile === "bolt"
            ? "bolt"
            : w.projectile === "ooze"
              ? "ooze"
              : "stink";
      this.projectiles.push({
        mesh,
        x,
        y,
        z,
        vx: fx * speed,
        vy: w.projectile === "rocket" ? 2.5 + (secondary ? 1 : 0) : 0,
        vz: fz * speed,
        life: w.life * (secondary ? 1.1 : 1),
        kind,
        owner: "player",
        radius,
        damage,
        splash,
      });
      if (w.projectile === "stink") {
        this.particles.stinkPuff(x, y, z);
      }
    }
    if (w.projectile === "stink") gameAudio.playStinkBomb();
    else if (w.projectile === "ooze") {
      gameAudio.playFart("big");
      gameAudio.playBoost();
      this.trauma = Math.min(1, this.trauma + 0.35);
    } else {
      gameAudio.playBoost();
    }
  }

  private fireStink() {
    const p = this.player;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const mesh = createStinkCloudMesh();
    const x = p.x + fx * 3.2;
    const z = p.z + fz * 3.2;
    mesh.position.set(x, p.y + 1, z);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      x,
      y: p.y + 1,
      z,
      vx: fx * (48 + Math.abs(p.speed) * 0.5),
      vy: 0,
      vz: fz * (48 + Math.abs(p.speed) * 0.5),
      life: 2.0,
      kind: "stink",
      owner: "player",
      radius: 2.8,
      damage: 32 + p.level * 4,
      splash: 0,
    });
    this.particles.stinkPuff(x, p.y + 1, z);
  }

  private fireOoze() {
    const p = this.player;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const mesh = createOozeWaveMesh();
    const x = p.x + fx * 2;
    const z = p.z + fz * 2;
    mesh.position.set(x, p.y + 0.4, z);
    mesh.rotation.y = p.yaw;
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      x,
      y: p.y + 0.4,
      z,
      vx: fx * 40,
      vy: 0,
      vz: fz * 40,
      life: 1.3,
      kind: "ooze",
      owner: "player",
      radius: 3.8,
      damage: 60 + p.level * 6,
      splash: 6,
    });
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - p.x, e.z - p.z) < 16) {
        this.damageEnemy(e, 30);
        e.stun = 1.3;
      }
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;

      if (e.isBoss) {
        const q = this.activeQuest();
        if (!q || q.id !== "reek_throne") {
          e.mesh.position.set(e.x, e.y, e.z);
          e.mesh.rotation.y = e.yaw;
          continue;
        }
        e.aggro = 250;
      }

      if (e.stun > 0) {
        e.stun -= dt;
        e.mesh.position.set(e.x, e.y, e.z);
        continue;
      }

      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.hypot(dx, dz);

      if (dist < e.aggro) {
        const desired = Math.atan2(-dx, -dz);
        let err = desired - e.yaw;
        while (err > Math.PI) err -= Math.PI * 2;
        while (err < -Math.PI) err += Math.PI * 2;
        const turnRate =
          e.kind === "tank" || e.isBoss ? 1.1 : e.stationary ? 2.5 : 2.2;
        e.yaw += THREE.MathUtils.clamp(err, -turnRate * dt, turnRate * dt);

        if (!e.stationary) {
          const maxS =
            e.kind === "tank" || e.isBoss
              ? 15
              : e.kind === "korus_drone"
                ? 30
                : 25;
          // tanks prefer range
          const wantClose =
            e.kind === "tank" || e.isBoss ? dist > 28 : dist > 12;
          if (wantClose) {
            e.speed = THREE.MathUtils.lerp(e.speed, maxS, 1 - Math.exp(-2 * dt));
          } else {
            e.speed = THREE.MathUtils.lerp(e.speed, maxS * 0.2, 1 - Math.exp(-2 * dt));
          }
        }

        e.fireCd -= dt;
        if (e.fireCd <= 0 && dist < (e.kind === "artillery" ? 140 : 75)) {
          e.fireCd =
            e.kind === "artillery"
              ? 2.8
              : e.kind === "tank" || e.isBoss
                ? 1.4
                : e.kind === "cannon_crew"
                  ? 2.0
                  : 1.3;
          this.enemyFire(e, dist);
        }
      } else if (!e.stationary) {
        e.speed *= 1 - 1.5 * dt;
        e.yaw += Math.sin(performance.now() * 0.001 + e.id) * 0.35 * dt;
      }

      if (!e.stationary) {
        const fx = -Math.sin(e.yaw);
        const fz = -Math.cos(e.yaw);
        e.x += fx * e.speed * dt;
        e.z += fz * e.speed * dt;
      }
      const groundOff =
        e.kind === "tank" || e.isBoss || e.kind === "artillery" ? 0.15 : RIDE_HEIGHT;
      e.y = this.world.groundY(e.x, e.z) + groundOff;

      const sp: Sphere = { x: e.x, y: e.y, z: e.z, r: e.radius };
      for (const box of this.world.colliders) {
        const push = resolveSphereAabbXZ(sp, box);
        if (push) {
          e.x += push.x;
          e.z += push.z;
          sp.x = e.x;
          sp.z = e.z;
        }
      }

      e.mesh.position.set(e.x, e.y, e.z);
      e.mesh.rotation.order = "YXZ";
      // tanks face yaw; karts need +PI like player
      if (
        e.kind === "tank" ||
        e.kind === "artillery" ||
        e.kind === "cannon_crew" ||
        e.isBoss
      ) {
        e.mesh.rotation.y = e.yaw;
      } else {
        e.mesh.rotation.y = e.yaw + Math.PI;
      }
    }
  }

  private enemyFire(e: Enemy, dist: number) {
    const fx = -Math.sin(e.yaw);
    const fz = -Math.cos(e.yaw);

    if (e.kind === "artillery") {
      // lobbed rocket
      const mesh = createShellMesh("rocket");
      const x = e.x + fx * 2;
      const z = e.z + fz * 2;
      mesh.position.set(x, e.y + 2, z);
      this.scene.add(mesh);
      const lead = dist * 0.15;
      this.projectiles.push({
        mesh,
        x,
        y: e.y + 2,
        z,
        vx: fx * 32,
        vy: 12 + dist * 0.05,
        vz: fz * 32,
        life: 3.5,
        kind: "rocket",
        owner: "enemy",
        radius: 2.2,
        damage: 28,
        splash: 8,
      });
      void lead;
      gameAudio.playExplosion();
      return;
    }

    if (e.kind === "tank" || e.isBoss || e.kind === "cannon_crew") {
      const mesh = createShellMesh("shell");
      const x = e.x + fx * (e.isBoss ? 5 : 3.5);
      const z = e.z + fz * (e.isBoss ? 5 : 3.5);
      mesh.position.set(x, e.y + 1.8, z);
      this.scene.add(mesh);
      const spd = e.isBoss ? 55 : e.kind === "tank" ? 48 : 42;
      this.projectiles.push({
        mesh,
        x,
        y: e.y + 1.8,
        z,
        vx: fx * spd,
        vy: 0.5,
        vz: fz * spd,
        life: 2.8,
        kind: "shell",
        owner: "enemy",
        radius: e.isBoss ? 2.2 : 1.4,
        damage: e.isBoss ? 30 : e.kind === "tank" ? 22 : 16,
        splash: e.isBoss ? 7 : 4,
      });
      this.particles.emit(x, e.y + 1.8, z, 8, {
        color: 0xffaa44,
        speed: 5,
        life: 0.3,
      });
      return;
    }

    // kart / drone shot
    const mesh = createStinkCloudMesh();
    mesh.scale.setScalar(0.7);
    const x = e.x + fx * 2.5;
    const z = e.z + fz * 2.5;
    mesh.position.set(x, e.y + 1, z);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      x,
      y: e.y + 1,
      z,
      vx: fx * 30,
      vy: 0,
      vz: fz * 30,
      life: 2.2,
      kind: "enemy_shot",
      owner: "enemy",
      radius: 1.6,
      damage: 12,
      splash: 0,
    });
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i]!;
      pr.life -= dt;
      pr.vy -= (pr.kind === "rocket" || pr.kind === "shell" ? 14 : 0) * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;

      const ground = this.world.groundY(pr.x, pr.z);
      if (
        pr.y < ground + 0.4 &&
        (pr.kind === "shell" || pr.kind === "rocket" || pr.kind === "bolt")
      ) {
        this.explode(pr.x, ground + 1, pr.z, pr.splash || 4, pr.damage, pr.owner);
        pr.life = 0;
      }

      pr.mesh.position.set(pr.x, pr.y, pr.z);
      if (pr.kind === "shell" || pr.kind === "rocket" || pr.kind === "bolt") {
        pr.mesh.lookAt(pr.x + pr.vx, pr.y + pr.vy, pr.z + pr.vz);
      }
      if (pr.kind === "mine") {
        pr.mesh.rotation.y += dt * 1.5;
      } else {
        pr.mesh.rotation.y += dt * 4;
      }

      if (pr.owner === "player") {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (Math.hypot(e.x - pr.x, e.z - pr.z) < pr.radius + e.radius) {
            this.damageEnemy(e, pr.damage);
            if (pr.kind === "stink") e.stun = Math.max(e.stun, 0.9);
            if (pr.splash > 0)
              this.explode(pr.x, pr.y, pr.z, pr.splash, pr.damage * 0.5, "player");
            pr.life = 0;
            break;
          }
        }
        for (const o of this.world.objects) {
          if (!o.alive || o.hp >= 9000) continue;
          if (Math.hypot(o.x - pr.x, o.z - pr.z) < pr.radius + o.radius) {
            this.damageObject(o, pr.damage * 0.85);
            pr.life = 0;
            break;
          }
        }
      } else {
        const p = this.player;
        if (
          p.invuln <= 0 &&
          Math.hypot(p.x - pr.x, p.z - pr.z) < pr.radius + 1.6 &&
          Math.abs(pr.y - p.y) < 3
        ) {
          this.damagePlayer(pr.damage);
          if (pr.splash > 0)
            this.explode(pr.x, pr.y, pr.z, pr.splash, pr.damage * 0.4, "enemy");
          pr.life = 0;
        }
      }

      if (pr.life <= 0) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private explode(
    x: number,
    y: number,
    z: number,
    radius: number,
    damage: number,
    owner: "player" | "enemy",
  ) {
    this.particles.emit(x, y, z, 28, {
      color: 0xff6622,
      speed: 10,
      life: 0.7,
      vy: 6,
    });
    this.particles.emit(x, y, z, 12, {
      color: 0xffcc44,
      speed: 5,
      life: 0.5,
      vy: 3,
    });
    this.trauma = Math.min(1, this.trauma + 0.25);
    gameAudio.playExplosion();

    if (owner === "player") {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - x, e.z - z) < radius) {
          this.damageEnemy(e, damage);
        }
      }
    } else {
      if (
        this.player.invuln <= 0 &&
        Math.hypot(this.player.x - x, this.player.z - z) < radius
      ) {
        this.damagePlayer(damage * 0.7);
      }
    }
  }

  private updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i]!;
      pk.life -= dt;
      pk.mesh.rotation.y += dt * 3;
      pk.mesh.position.y =
        this.world.groundY(pk.x, pk.z) +
        1 +
        Math.sin(performance.now() * 0.005) * 0.2;
      if (Math.hypot(pk.x - this.player.x, pk.z - this.player.z) < 2.8) {
        if (pk.kind === "hp") {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
        } else if (pk.kind === "stink") {
          this.player.stink = Math.min(
            this.player.maxStink,
            this.player.stink + 45,
          );
        } else if (pk.kind === "taco") {
          this.player.tacoBoost = Math.max(this.player.tacoBoost, 12);
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);
          this.announce = "TACO BOOST!";
          this.announceTimer = 1.4;
        } else {
          this.player.scrap += 5;
        }
        gameAudio.playItemGet();
        this.scene.remove(pk.mesh);
        this.pickups.splice(i, 1);
        continue;
      }
      if (pk.life <= 0) {
        this.scene.remove(pk.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  private damagePlayer(amount: number) {
    if (this.player.invuln > 0) return;
    this.player.hp -= amount;
    this.player.invuln = 0.75;
    this.trauma = Math.min(1, this.trauma + 0.4);
    gameAudio.playExplosion();
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.phase = "dead";
      this.player.deadTimer = 2.2;
      this.announce = "WIPED OUT";
      this.announceTimer = 2;
      gameAudio.playWipeout();
      this.particles.burstSplat(this.player.x, this.player.y, this.player.z);
    }
  }

  private damageEnemy(e: Enemy, amount: number) {
    if (!e.alive) return;
    e.hp -= amount;
    this.particles.emit(e.x, e.y + 1.2, e.z, 12, {
      color: 0xff4466,
      speed: 6,
      life: 0.4,
    });
    if (e.hp <= 0) {
      e.alive = false;
      e.mesh.visible = false;
      this.player.kills++;
      this.player.combo++;
      this.player.comboTimer = 3;
      this.player.xp +=
        e.isBoss
          ? 250
          : e.kind === "tank"
            ? 55
            : e.kind === "artillery"
              ? 40
              : 22;
      this.levelUpCheck();
      gameAudio.playExplosion();
      this.particles.burstSplat(e.x, e.y + 0.5, e.z);
      this.explode(e.x, e.y + 1, e.z, 5, 15, "player");
      this.dropLoot(e.x, e.z);
      if (
        e.kind === "slime_raider" ||
        e.kind === "bandit_kart" ||
        e.kind === "tank"
      ) {
        this.bumpQuest("first_blood");
      }
      if (e.kind === "bandit_kart") {
        const left = this.enemies.filter(
          (x) =>
            x.alive &&
            x.kind === "bandit_kart" &&
            Math.hypot(x.x + 110, x.z - 55) < 55,
        );
        if (left.length === 0) this.bumpQuest("rescue_bandana");
      }
      if (e.isBoss) {
        this.bumpQuest("reek_throne");
        this.storyFlags.add("victory_pending");
        this.openDialogue("victory");
      }
    }
  }

  private damageObject(o: WorldObject, amount: number) {
    // Invincible props only (beacon, main landscape markers with 9000+)
    if (!o.alive || o.hp >= 9000) return;
    o.hp -= amount;
    // Staged visual damage — darken mesh as HP drops
    const ratio = Math.max(0, o.hp / o.maxHp);
    o.mesh.traverse((ch) => {
      const m = ch as THREE.Mesh;
      if (m.isMesh && m.material && "emissive" in (m.material as object)) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.emissive) {
          mat.emissiveIntensity = Math.max(0.05, (mat.emissiveIntensity || 0.3) * 0.92);
        }
        if (ratio < 0.45 && mat.color) {
          mat.color.offsetHSL(0, -0.05, -0.04);
        }
      }
    });
    this.particles.emit(o.x, o.y, o.z, 10, {
      color: 0xffaa44,
      speed: 5,
      life: 0.4,
    });
    if (o.hp <= 0) {
      o.alive = false;
      o.mesh.visible = false;
      gameAudio.playExplosion();
      const blast =
        o.tag === "fort_piece" || o.tag === "fort_cannon" || o.tag === "throne"
          ? 7
          : 4;
      this.explode(o.x, o.y, o.z, blast, 14, "player");
      this.dropLoot(o.x, o.z);
      // Fortress fantasy feedback
      if (o.tag === "fort_piece" || o.tag === "fort_cannon") {
        this.fortPiecesDown = (this.fortPiecesDown ?? 0) + 1;
        if (this.fortPiecesDown === 1) {
          this.announce = "FORTRESS BREACHED!";
          this.announceTimer = 1.8;
        } else if (this.fortPiecesDown === 4) {
          this.announce = "REEK FORTRESS CRUMBLING!";
          this.announceTimer = 2;
        } else if (this.fortPiecesDown >= 8) {
          this.announce = "FORTRESS GUTTED — FIND REEK!";
          this.announceTimer = 2.2;
        }
        // Chance to drop taco after fort smash
        if (Math.random() < 0.35) this.spawnTaco(o.x, o.z);
      }
      if (o.tag === "throne") {
        this.announce = "KEEP DESTROYED!";
        this.announceTimer = 2.5;
        this.spawnTaco(o.x, o.z);
        this.spawnTaco(o.x + 4, o.z - 3);
      }
      if (o.tag === "generator") {
        this.generatorsDown++;
        this.bumpQuest("slime_outpost");
        const left = this.world.objects.filter(
          (x) => x.alive && x.tag === "generator",
        ).length;
        this.announce =
          left > 0
            ? `GENERATOR DOWN! ${left} left — follow magenta beams`
            : "OUTPOST GENERATORS TORCHED!";
        this.announceTimer = 2.0;
      }
      if (o.tag === "korus_core") {
        this.bumpQuest("korus_core");
        this.openDialogue("core");
      }
      if (o.aabb) {
        const i = this.world.colliders.indexOf(o.aabb);
        if (i >= 0) this.world.colliders.splice(i, 1);
      }
    }
  }

  private dropLoot(x: number, z: number) {
    if (Math.random() > 0.55) return;
    const roll = Math.random();
    const kind: Pickup["kind"] =
      roll < 0.12
        ? "taco"
        : roll < 0.45
          ? "hp"
          : roll < 0.78
            ? "stink"
            : "scrap";
    if (kind === "taco") {
      this.spawnTaco(x, z);
      return;
    }
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({
        color:
          kind === "hp" ? 0xff4466 : kind === "stink" ? 0x3dcc5a : 0xffcc33,
        emissive:
          kind === "hp" ? 0xff2244 : kind === "stink" ? 0x1f8a35 : 0xaa8800,
        emissiveIntensity: 0.7,
      }),
    );
    mesh.position.set(x, this.world.groundY(x, z) + 1, z);
    this.scene.add(mesh);
    this.pickups.push({ mesh, x, z, kind, life: 22 });
  }

  private spawnTaco(x: number, z: number) {
    const g = new THREE.Group();
    // Simple taco: shell + filling
    const shell = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.22, 8, 12, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0xe8a838,
        emissive: 0xaa6600,
        emissiveIntensity: 0.45,
        roughness: 0.55,
      }),
    );
    shell.rotation.x = Math.PI / 2;
    shell.rotation.z = Math.PI;
    g.add(shell);
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.25, 0.35),
      new THREE.MeshStandardMaterial({
        color: 0x3dcc5a,
        emissive: 0x1f8a35,
        emissiveIntensity: 0.5,
      }),
    );
    fill.position.y = 0.12;
    g.add(fill);
    g.position.set(x, this.world.groundY(x, z) + 1.1, z);
    this.scene.add(g);
    this.pickups.push({ mesh: g, x, z, kind: "taco", life: 28 });
  }

  private checkQuestTriggers() {
    const q = this.activeQuest();
    if (!q) return;
    const p = this.player;

    if (q.id === "wake_up") {
      if (Math.hypot(p.x - 0, p.z - 95) < 18) {
        this.bumpQuest("wake_up");
        if (!this.storyFlags.has("beacon")) {
          this.storyFlags.add("beacon");
          this.openDialogue("beacon");
        }
      }
    }

    if (
      q.id === "slime_outpost" &&
      !this.storyFlags.has("outpost_dlg") &&
      Math.hypot(p.x - 130, p.z - 50) < 42
    ) {
      this.storyFlags.add("outpost_dlg");
      this.openDialogue("outpost");
    }

    if (q.id === "rescue_bandana" && !this.storyFlags.has("pete")) {
      if (Math.hypot(p.x + 110, p.z - 55) < 22) {
        this.storyFlags.add("pete");
        this.openDialogue("pete");
        const left = this.enemies.filter(
          (x) =>
            x.alive &&
            x.kind === "bandit_kart" &&
            Math.hypot(x.x + 110, x.z - 55) < 55,
        );
        if (left.length === 0) this.bumpQuest("rescue_bandana");
      }
    }

    if (q.id === "reek_throne" && !this.storyFlags.has("reek_dlg")) {
      if (Math.hypot(p.x - 190, p.z - 175) < 45) {
        this.storyFlags.add("reek_dlg");
        this.openDialogue("reek");
      }
    }

    const gw = this.quests.find((x) => x.id === "get_wheels");
    if (gw?.status === "done" && !this.storyFlags.has("scrap_done")) {
      this.storyFlags.add("scrap_done");
      this.openDialogue("scrap_done");
    }
  }

  private updateCamera(dt: number, lookBack: boolean) {
    const p = this.player;
    const mode = CAM_MODES[this.camMode] ?? CAM_MODES[0]!;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const zScale = THREE.MathUtils.lerp(1.35, 0.62, this.camZoom);
    const dist =
      mode.dist * zScale + Math.min(3.5, Math.abs(p.speed) * 0.04);
    const height =
      mode.height * zScale + Math.min(1.2, Math.abs(p.speed) * 0.015);
    const back = lookBack ? -1 : 1;
    const desired = new THREE.Vector3(
      p.x - fx * dist * back,
      p.y + height,
      p.z - fz * dist * back,
    );
    const k = 1 - Math.exp(-7 * dt);
    this.camPos.lerp(desired, k);
    const look = new THREE.Vector3(
      p.x + fx * mode.lookAhead * back,
      p.y + (mode.id === "nose" ? 1.0 : 1.3),
      p.z + fz * mode.lookAhead * back,
    );
    this.camLook.lerp(look, k);

    const shake = this.settings.cameraShake ? this.trauma * this.trauma : 0;
    const t = performance.now() * 0.02;
    this.camera.position.set(
      this.camPos.x + Math.sin(t * 1.7) * shake * 0.5,
      this.camPos.y + Math.cos(t * 2.1) * shake * 0.3,
      this.camPos.z + Math.sin(t * 1.3) * shake * 0.5,
    );
    this.camera.lookAt(this.camLook);
    const targetFov =
      mode.baseFov +
      Math.min(14, Math.abs(p.speed) * 0.18) -
      this.camZoom * 4;
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      targetFov,
      1 - Math.exp(-4 * dt),
    );
    this.camera.updateProjectionMatrix();
  }

  private drawMinimap() {
    const c = this.minimapCanvas;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.fillStyle = "#0a1018";
    ctx.fillRect(0, 0, w, h);
    // Zoomed out so outpost generators stay readable
    const scale = 0.2;
    const cx = w / 2;
    const cy = h / 2;
    const pad = 8;
    const clampEdge = (px: number, py: number) => {
      const out = px < pad || px > w - pad || py < pad || py > h - pad;
      return {
        x: THREE.MathUtils.clamp(px, pad, w - pad),
        y: THREE.MathUtils.clamp(py, pad, h - pad),
        out,
      };
    };
    const tx = (x: number) => cx + (x - this.player.x) * scale;
    const ty = (z: number) => cy + (z - this.player.z) * scale;

    for (const lm of this.world.landmarks) {
      const p = clampEdge(tx(lm.x), ty(lm.z));
      ctx.fillStyle =
        lm.id === "throne"
          ? "#ff224488"
          : lm.id === "outpost"
            ? "#e879f988"
            : "#22d3ee88";
      ctx.beginPath();
      ctx.arc(p.x, p.y, lm.id === "outpost" ? 6 : 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Quest objectives — edge-clamped so far targets still show as chevrons
    const q = this.activeQuest();
    const MAP_RANGE = 220;
    const pulse = 0.55 + Math.sin(performance.now() * 0.008) * 0.45;
    for (const o of this.world.objects) {
      if (!o.alive) continue;
      const dist = Math.hypot(o.x - this.player.x, o.z - this.player.z);
      const inRange = dist < MAP_RANGE;

      let color: string | null = null;
      let radius = 3;
      if (o.kind === "scrap") {
        const scrapQuest = q?.id === "get_wheels";
        if (scrapQuest || inRange) {
          color = "#ffcc33";
          radius = scrapQuest ? 5 : 4;
        }
      } else if (o.tag === "generator") {
        // Always on-map during Torch the Outpost
        if (q?.id === "slime_outpost" || inRange) {
          color = "#e879f9";
          radius = q?.id === "slime_outpost" ? 6 : 4;
        }
      } else if (o.tag === "korus_core") {
        if (q?.id === "korus_core" || inRange) {
          color = "#22d3ee";
          radius = 5;
        }
      } else if (
        o.tag === "quest_beacon" &&
        (q?.id === "wake_up" || inRange)
      ) {
        color = "#3dcc5a";
        radius = 4;
      }
      if (!color) continue;

      const p = clampEdge(tx(o.x), ty(o.z));
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.4 + pulse * 0.5;
      ctx.lineWidth = p.out ? 3 : 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 3 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (p.out) {
        const ang = Math.atan2(ty(o.z) - cy, tx(o.x) - cx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(-4, 5);
        ctx.lineTo(-4, -5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const p = clampEdge(tx(e.x), ty(e.z));
      if (p.out && !e.isBoss) continue;
      ctx.fillStyle = e.isBoss
        ? "#ff2244"
        : e.kind === "tank"
          ? "#ff8844"
          : e.kind === "artillery"
            ? "#ffaa00"
            : "#e11d2e";
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.fillStyle = "#3dcc5a";
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    const fx = -Math.sin(this.player.yaw) * 8;
    const fz = -Math.cos(this.player.yaw) * 8;
    ctx.strokeStyle = "#8dff9e";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + fx * scale * 3, cy + fz * scale * 3);
    ctx.stroke();
  }

  private emitHud() {
    if (!this.onHud) return;
    const q = this.activeQuest();
    const def = q ? QUESTS[q.id] : null;
    // Report playing even when dialogue open (non-blocking)
    const phase: GamePhase =
      this.phase === "playing" && this.dialogue ? "playing" : this.phase;
    this.onHud({
      phase,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      stink: this.player.stink,
      maxStink: this.player.maxStink,
      xp: this.player.xp,
      level: this.player.level,
      scrap: this.player.scrap,
      speed: this.player.speed,
      kills: this.player.kills,
      questTitle: def?.title ?? "All quests complete",
      questObjective: def?.objective ?? "Dominate the ZeroVerse battlefield.",
      questProgress: (() => {
        if (!q) return "—";
        if (q.id === "get_wheels")
          return `${q.progress}/${q.target} · gold beams on map`;
        if (q.id === "slime_outpost") {
          const left = this.world.objects.filter(
            (o) => o.alive && o.tag === "generator",
          );
          let nearest = Infinity;
          for (const g of left) {
            nearest = Math.min(
              nearest,
              Math.hypot(g.x - this.player.x, g.z - this.player.z),
            );
          }
          const nearTxt =
            left.length && Number.isFinite(nearest)
              ? ` · nearest ${Math.round(nearest)}m`
              : "";
          return `${q.progress}/${q.target} gens · magenta beams${nearTxt}`;
        }
        return `${q.progress}/${q.target}`;
      })(),
      announce: this.announce,
      dialogue: this.dialogue ? this.dialogue.lines[this.dialogue.i]! : null,
      dialogueSpeaker: this.dialogue?.speaker ?? null,
      minimapHint: this.location,
      combo: this.player.combo,
      bossHp: (() => {
        const b = this.boss;
        if (!b?.alive) return null;
        const near =
          Math.hypot(b.x - this.player.x, b.z - this.player.z) < 95;
        const hurt = b.hp < b.maxHp - 0.5;
        return near || hurt ? b.hp : null;
      })(),
      bossMax: this.boss?.alive ? this.boss.maxHp : null,
      location: this.location,
      camMode: (CAM_MODES[this.camMode] ?? CAM_MODES[0]!).label,
      camZoom: this.camZoom,
      weaponSlot: this.player.weaponSlot,
      weaponName: weaponBySlot(this.player.weaponSlot).short,
      weaponCd: this.player.weaponCd,
      inSafe: !!this.activeSafeZone(),
      safeName: this.activeSafeZone()?.name ?? null,
    });
  }

  private wireControlsTest() {
    if (typeof window === "undefined") return;
    window.__kartEngine = this;
    window.__controlsTest = {
      getYaw: () => this.player?.yaw ?? 0,
      getSpeed: () => this.player?.speed ?? 0,
      getAirborne: () => this.player?.airborne ?? false,
      getVy: () => this.player?.vy ?? 0,
      getCamMode: () =>
        (CAM_MODES[this.camMode] ?? CAM_MODES[0]!).label,
      getCamZoom: () => this.camZoom,
      getPhase: () => this.phase,
      getPlayer: () => ({
        x: this.player.x,
        z: this.player.z,
        speed: this.player.speed,
        yaw: this.player.yaw,
        airborne: this.player.airborne,
      }),
      setSteer: (v: number) => this.input.setSteer(v),
      setKeys: (codes: string[]) => this.input.setKeys(codes),
      setTouchGas: (v: boolean) => {
        this.input.touchGas = v;
      },
      setTouchBrake: (v: boolean) => {
        this.input.touchBrake = v;
      },
      setTouchHop: (v: boolean) => {
        this.input.touchHop = v;
      },
      getTouchFlags: () => ({
        gas: this.input.touchGas,
        brake: this.input.touchBrake,
        hop: this.input.touchHop,
        autoAccel: this.input.autoAccel,
        keys: [...this.input.keys],
      }),
      clearDialogue: () => {
        this.dialogue = null;
      },
      setAutoAccel: (v: boolean) => {
        this.input.autoAccel = v;
      },
      forceJump: () => {
        const p = this.player;
        if (!p.airborne) {
          p.vy = 13.5;
          p.airborne = true;
          p.jumpLock = true;
        }
      },
      cycleCam: (dir: 1 | -1 = 1) => this.cycleCamMode(dir),
      adjustZoom: (d: number) => this.adjustCamZoom(d),
      stepSim: (s = 0.25) => this.stepSim(s),
      selectWeapon: (slot: number) => this.selectWeapon(slot),
      cycleWeapon: (dir: 1 | -1 = 1) => this.cycleWeapon(dir),
      getWeapon: () => this.player.weaponSlot,
      isMusicPlaying: () => gameAudio.isMusicPlaying(),
      startMusic: () => gameAudio.startMusic(1),
      getMusicDebug: () => gameAudio.debugMusic(),
    };
  }
}

declare global {
  interface Window {
    __kartEngine?: KartEngine;
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getAirborne?: () => boolean;
      getVy?: () => number;
      getCamMode?: () => string;
      getCamZoom?: () => number;
      getPhase?: () => string;
      getPlayer?: () => {
        x: number;
        z: number;
        speed: number;
        yaw: number;
        airborne: boolean;
      };
      getTouchFlags?: () => {
        gas: boolean;
        brake: boolean;
        hop: boolean;
        autoAccel: boolean;
        keys: string[];
      };
      setSteer?: (v: number) => void;
      setKeys?: (codes: string[]) => void;
      setTouchGas?: (v: boolean) => void;
      setTouchBrake?: (v: boolean) => void;
      setTouchHop?: (v: boolean) => void;
      clearDialogue?: () => void;
      setAutoAccel?: (v: boolean) => void;
      forceJump?: () => void;
      cycleCam?: (dir?: 1 | -1) => void;
      adjustZoom?: (d: number) => void;
      stepSim?: (s?: number) => void;
      selectWeapon?: (slot: number) => void;
      cycleWeapon?: (dir?: 1 | -1) => void;
      getWeapon?: () => number;
      isMusicPlaying?: () => boolean;
      startMusic?: () => void;
      getMusicDebug?: () => Record<string, unknown>;
    };
  }
}
