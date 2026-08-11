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
import { buildOpenWorld, type OpenWorld, type WorldObject } from "./openWorld";
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
  kind: "stink" | "ooze" | "enemy_shot" | "shell" | "rocket";
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
  kind: "scrap" | "hp" | "stink";
  life: number;
};

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
    sprint: false,
    sprintMeter: 1,
    bank: 0,
    deadTimer: 0,
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
  private storyFlags = new Set<string>();
  private canvas: HTMLCanvasElement;
  private pmrem?: THREE.PMREMGenerator;
  private dustTimer = 0;

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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

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

  /** Layer 6 post: light bloom + output. */
  private setupPost() {
    const w = this.canvas.clientWidth || 1280;
    const h = this.canvas.clientHeight || 720;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.settings.detail === "high") {
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(Math.floor(w * 0.5), Math.floor(h * 0.5)),
        0.18,
        0.4,
        0.88,
      );
      this.composer.addPass(bloom);
    }
    this.composer.addPass(new OutputPass());
    this.composer.setSize(w, h);
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

  private buildScene() {
    this.scene.clear();
    // Layer 6 atmosphere
    this.scene.background = new THREE.Color(0x2a100c);
    this.scene.fog = new THREE.FogExp2(0x2e140f, 0.00235);

    // Environment reflections for Physical materials (shared, once)
    if (!this.pmrem) {
      this.pmrem = new THREE.PMREMGenerator(this.renderer);
      const envScene = new RoomEnvironment();
      this.scene.environment = this.pmrem.fromScene(envScene, 0.04).texture;
    } else if (!this.scene.environment) {
      const envScene = new RoomEnvironment();
      this.scene.environment = this.pmrem.fromScene(envScene, 0.04).texture;
    }

    const hemi = new THREE.HemisphereLight(0xffd0a8, 0x1a0c08, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe8d0, 1.85);
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
    this.scene.add(new THREE.AmbientLight(0x2a1814, 0.42));
    const fill = new THREE.DirectionalLight(0x6a88cc, 0.45);
    fill.position.set(-50, 30, -40);
    this.scene.add(fill);
    // rim / atmosphere
    const rim = new THREE.DirectionalLight(0xff6633, 0.28);
    rim.position.set(0, 20, -80);
    this.scene.add(rim);

    const glow1 = new THREE.PointLight(0xff4422, 1.35, 140);
    glow1.position.set(180, 22, 160);
    this.scene.add(glow1);
    const glow2 = new THREE.PointLight(0x3dcc5a, 1.0, 110);
    glow2.position.set(-100, 18, 50);
    this.scene.add(glow2);
    const glow3 = new THREE.PointLight(0x22d3ee, 0.7, 90);
    glow3.position.set(210, 12, -35);
    this.scene.add(glow3);

    this.world = buildOpenWorld(this.settings.detail);
    this.scene.add(this.world.group);
    this.scene.add(this.particles.points);

    this.playerMesh = createStinkyKart();
    this.scene.add(this.playerMesh);
    this.resetPlayer(0, 0);

    this.spawnArmy();
    this.camPos.set(0, 14, 20);
    this.camLook.set(0, 1, 0);
  }

  private resetPlayer(x: number, z: number) {
    this.player.x = x;
    this.player.z = z;
    this.player.y = this.world.groundY(x, z) + RIDE_HEIGHT;
    this.player.yaw = 0;
    this.player.speed = 0;
    this.player.lateral = 0;
    this.player.hp = this.player.maxHp;
    this.player.stink = this.player.maxStink;
    this.player.invuln = 3.5;
    this.syncPlayerMesh();
  }

  private spawnArmy() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
    this.boss = null;

    // Kart raiders
    for (const pack of [
      { x: 45, z: 40, n: 4, kind: "slime_raider" as const },
      { x: 120, z: 55, n: 4, kind: "slime_raider" as const },
      { x: -90, z: 40, n: 3, kind: "bandit_kart" as const },
      { x: 70, z: -70, n: 3, kind: "bandit_kart" as const },
      { x: 190, z: -20, n: 3, kind: "korus_drone" as const },
    ]) {
      for (let i = 0; i < pack.n; i++) {
        this.spawnEnemy(
          pack.kind,
          pack.x + (Math.random() - 0.5) * 28,
          pack.z + (Math.random() - 0.5) * 28,
        );
      }
    }

    // Tanks
    for (const t of [
      [60, 20, "reek"],
      [100, 80, "reek"],
      [150, 120, "reek"],
      [40, -40, "reek"],
      [-50, 80, "slime"],
      [200, 100, "reek"],
      [170, 150, "reek"],
      [-30, -80, "reek"],
    ] as const) {
      this.spawnEnemy("tank", t[0], t[1]);
    }

    // Artillery
    for (const a of [
      [140, 30],
      [160, 70],
      [100, 0],
      [-60, 20],
      [180, 140],
    ] as const) {
      this.spawnEnemy("artillery", a[0], a[1]);
    }

    // Emplaced cannon crews
    for (const c of [
      [50, 90],
      [80, 50],
      [20, -50],
      [220, 160],
      [160, 190],
      [-80, 70],
    ] as const) {
      this.spawnEnemy("cannon_crew", c[0], c[1]);
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
    this.phase = "playing";
    this.quests = makeQuestRuntime();
    this.storyFlags.clear();
    this.scrapCollected = 0;
    this.generatorsDown = 0;
    this.player.xp = 0;
    this.player.level = 1;
    this.player.scrap = 0;
    this.player.kills = 0;
    this.player.maxHp = 120;
    this.player.maxStink = 100;
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
    if (this.phase === "paused") this.phase = "playing";
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

  private openDialogue(key: string) {
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
    this.clock.connect(document);
    this.clock.reset();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.clock.update();
      let dt = this.clock.getDelta();
      if (dt <= 0 || !isFinite(dt)) dt = 1 / 60;
      dt = Math.min(dt, 0.1);
      this.fixedAcc += dt;
      let steps = 0;
      while (this.fixedAcc >= this.fixedDt && steps < 5) {
        this.fixedUpdate(this.fixedDt);
        this.fixedAcc -= this.fixedDt;
        steps++;
      }
      if (this.fixedAcc >= this.fixedDt) this.fixedAcc = 0;
      // Layer 6 post path
      if (this.composer) this.composer.render();
      else this.renderer.render(this.scene, this.camera);
      this.drawMinimap();
      this.lastHud += dt;
      if (this.lastHud > 0.05) {
        this.lastHud = 0;
        this.emitHud();
      }
    };
    this.raf = requestAnimationFrame(loop);
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
    this.player.stink = Math.min(
      this.player.maxStink,
      this.player.stink + 10 * dt,
    );
    if (this.player.hp > 0 && this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 3 * dt);
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

    if (input.sprint && p.sprintMeter > 0.05) {
      p.sprint = true;
      p.sprintMeter = Math.max(0, p.sprintMeter - 0.28 * dt);
    } else {
      p.sprint = false;
      p.sprintMeter = Math.min(1, p.sprintMeter + 0.14 * dt);
    }

    const maxSpeed = (42 + p.level * 1.8) * (p.sprint ? 1.45 : 1);
    const accel = 48 * (p.sprint ? 1.25 : 1);
    if (throttle > 0) p.speed += accel * throttle * dt;
    else if (throttle < 0) p.speed += accel * 1.4 * throttle * dt;
    else p.speed *= 1 - 0.9 * dt;

    if (p.speed > maxSpeed)
      p.speed = THREE.MathUtils.lerp(p.speed, maxSpeed, 1 - Math.exp(-3 * dt));
    if (p.speed < -maxSpeed * 0.4) p.speed = -maxSpeed * 0.4;

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
    p.y = this.world.groundY(p.x, p.z) + RIDE_HEIGHT;

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
        if (Math.abs(p.speed) > 16 && o.hp < 9000) {
          this.damageObject(o, 15 + Math.abs(p.speed) * 0.35);
        }
      }
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
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

    if (input.stinkCloud && p.stinkCd <= 0 && p.stink >= 18) {
      p.stinkCd = 0.75;
      p.stink -= 18;
      this.fireStink();
      gameAudio.playStinkBomb();
    }
    if (input.skill && p.skillCd <= 0 && p.stink >= 30) {
      p.skillCd = 4.5;
      p.stink -= 30;
      this.fireOoze();
      gameAudio.playFart("big");
      gameAudio.playBoost();
      this.trauma = Math.min(1, this.trauma + 0.45);
    }
    if (input.hop) {
      p.speed += 5;
      gameAudio.playHop();
      this.particles.emit(p.x, p.y, p.z, 8, {
        color: 0xc45c2a,
        speed: 3,
        life: 0.3,
        vy: 2,
      });
    }

    for (const o of this.world.objects) {
      if (!o.alive || o.kind !== "scrap") continue;
      if (Math.hypot(o.x - p.x, o.z - p.z) < 3.5) {
        o.alive = false;
        o.mesh.visible = false;
        this.scrapCollected++;
        this.player.scrap += 8;
        this.bumpQuest("get_wheels");
        gameAudio.playItemGet();
        this.particles.emit(o.x, o.y, o.z, 12, {
          color: 0xffcc33,
          speed: 4,
          life: 0.5,
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
      if (pr.y < ground + 0.4 && (pr.kind === "shell" || pr.kind === "rocket")) {
        this.explode(pr.x, ground + 1, pr.z, pr.splash || 4, pr.damage, pr.owner);
        pr.life = 0;
      }

      pr.mesh.position.set(pr.x, pr.y, pr.z);
      if (pr.kind === "shell" || pr.kind === "rocket") {
        pr.mesh.lookAt(pr.x + pr.vx, pr.y + pr.vy, pr.z + pr.vz);
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
    if (!o.alive || o.hp >= 9000) return;
    o.hp -= amount;
    this.particles.emit(o.x, o.y, o.z, 8, {
      color: 0xffaa44,
      speed: 4,
      life: 0.35,
    });
    if (o.hp <= 0) {
      o.alive = false;
      o.mesh.visible = false;
      gameAudio.playExplosion();
      this.explode(o.x, o.y, o.z, 4, 10, "player");
      this.dropLoot(o.x, o.z);
      if (o.tag === "generator") {
        this.generatorsDown++;
        this.bumpQuest("slime_outpost");
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
    if (Math.random() > 0.6) return;
    const kind =
      Math.random() < 0.4 ? "hp" : Math.random() < 0.7 ? "stink" : "scrap";
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
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const dist = 10 + Math.min(4, Math.abs(p.speed) * 0.05);
    const height = 4.5 + Math.min(1.5, Math.abs(p.speed) * 0.02);
    const back = lookBack ? -1 : 1;
    const desired = new THREE.Vector3(
      p.x - fx * dist * back,
      p.y + height,
      p.z - fz * dist * back,
    );
    const k = 1 - Math.exp(-7 * dt);
    this.camPos.lerp(desired, k);
    const look = new THREE.Vector3(
      p.x + fx * 5 * back,
      p.y + 1.3,
      p.z + fz * 5 * back,
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
    const targetFov = 60 + Math.min(16, Math.abs(p.speed) * 0.2);
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
    const scale = 0.24;
    const cx = w / 2;
    const cy = h / 2;
    const tx = (x: number) => cx + (x - this.player.x) * scale;
    const ty = (z: number) => cy + (z - this.player.z) * scale;

    for (const lm of this.world.landmarks) {
      ctx.fillStyle = lm.id === "throne" ? "#ff224488" : "#22d3ee88";
      ctx.beginPath();
      ctx.arc(tx(lm.x), ty(lm.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = e.isBoss
        ? "#ff2244"
        : e.kind === "tank"
          ? "#ff8844"
          : e.kind === "artillery"
            ? "#ffaa00"
            : "#e11d2e";
      ctx.fillRect(tx(e.x) - 2, ty(e.z) - 2, 4, 4);
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
      speed: Math.abs(this.player.speed),
      kills: this.player.kills,
      questTitle: def?.title ?? "All quests complete",
      questObjective: def?.objective ?? "Dominate the ZeroVerse battlefield.",
      questProgress: q ? `${q.progress}/${q.target}` : "—",
      announce: this.announce,
      dialogue: this.dialogue ? this.dialogue.lines[this.dialogue.i]! : null,
      dialogueSpeaker: this.dialogue?.speaker ?? null,
      minimapHint: this.location,
      combo: this.player.combo,
      bossHp: this.boss?.alive ? this.boss.hp : null,
      bossMax: this.boss?.maxHp ?? null,
      location: this.location,
    });
  }

  private wireControlsTest() {
    if (typeof window === "undefined") return;
    window.__controlsTest = {
      getYaw: () => this.player?.yaw ?? 0,
      getSpeed: () => this.player?.speed ?? 0,
      setSteer: (v: number) => this.input.setSteer(v),
      setKeys: (codes: string[]) => this.input.setKeys(codes),
    };
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setSteer?: (v: number) => void;
      setKeys?: (codes: string[]) => void;
    };
  }
}
