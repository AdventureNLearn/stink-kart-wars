# STINK KART WARS — Full Reproduction Handoff

**Benchmark commit target:** current `main` after densify / weapons / HUD zone pass  
**Repo:** https://github.com/AdventureNLearn/stink-kart-wars  
**Stack:** Vite + React 19 + TypeScript + Three.js (TanStack Start app shell)

This document is the single source of truth to rebuild or continue the game from a clean clone.

---

## 1. What this game is

Open-world vehicle action-RPG starring **Stinky the Slime** (@stinkycubert):

- Drive a slime kart on a rolling ZeroVerse battlefield
- Jump / stomp, reverse, drift, sprint
- **6 weapons** (keys **1–6**, mobile swipe + **FIRE**)
- Quests, dialogue, scrap, boss **Warlord Reek**
- Castles on hard-flat **FORT_PADS** + foundations (no floating keeps)
- **Safe zones** (green rings) for fast HP / stink regen
- **Quest scrap caches** grounded + glowing beacons; gold minimap blips on `get_wheels`
- **Destructible fort pieces** (towers/cannons/keep) — fortress damage fantasy
- **Taco boost** power-up (speed + jump juice)
- **Crew roster** (`crew.ts`) — Stinky + 6 unlock slots for future select
- Mobile touch: stick · FIRE/JUMP/DRIFT/SPRINT · BRAKE/GAS · CAM

---

## 2. Quick start (reproduce)

```bash
git clone https://github.com/AdventureNLearn/stink-kart-wars.git
cd stink-kart-wars
npm install
npm run dev          # 0.0.0.0:8080
# optional
npm run typecheck
npm run build
```

Platform revive helper: `startup.sh` probes `:8080` then starts `npm run dev` if down.

---

## 3. Source map

| Path | Role |
|------|------|
| `src/game/engine.ts` | Loop, physics, combat, camera, enemies, HUD emit |
| `src/game/openWorld.ts` | Terrain, FORT_PADS, landmarks, props, safe zones, foundations |
| `src/game/GameApp.tsx` | React HUD / touch / menus / weapon strip |
| `src/game/input.ts` | Keyboard + touch → InputState (1–6 weapon select) |
| `src/game/weapons.ts` | Six weapon defs (cost, cd, damage, projectile kind) |
| `src/game/military.ts` | Tank / wreck / cannon / artillery / castle meshes |
| `src/game/meshes.ts` | Stinky kart, AI racers, stink/ooze FX |
| `src/game/visualDensity.ts` | Layer-4 materials, contact shadows |
| `src/game/audio.ts` | WebAudio SFX + music bus |
| `src/game/quests.ts` | Quest order + story beats |
| `src/game/crew.ts` | Stinky + 6 crew slots (data for future select / SFX-VFX packs) |
| `src/game/settings.ts` | Bindings, volumes, **autoAccel default false** |
| `src/game/types.ts` | HudSnapshot, phases, colors |
| `src/game/collision.ts` | Sphere / AABB helpers |
| `src/styles.css` | HUD zoning, touch layout, no-overlap rules |
| `public/` | hero-bg, stinky-avatar, (audio tracks when present) |

---

## 4. Durable gameplay rules (do not regress)

1. **Drive:** no forced auto-forward. `autoAccel` defaults **false**. Kart coasts/stops when throttle is 0.
2. **Steer:** A = left, D = right (chase cam, forward). `controls` skill signs.
3. **Jump/stomp:** Space / JUMP; airborne fall on enemy = stomp damage.
4. **Reverse:** S / BRAKE; separate hard-brake vs reverse gear in `updatePlayer`.
5. **Mobile:** multitouch-safe `touchGas` / `touchBrake` (not stick throttle).
6. **Cameras:** CHASE / NEAR / HIGH / NOSE + zoom; labels match HUD.
7. **Castles grounded:** `FORT_PADS` + `addCastleFoundation` + `terrainHeight`.
8. **Wrecks ≠ enemies:** `createWreckTankMesh()` husks with soot; live tanks use `createTankMesh`.
9. **Weapons:** 1–6 select only · **Q** primary · **E** secondary (or double-tap Q / SEC) · mobile FIRE/SEC.
10. **Safe zones:** `SAFE_ZONES` in openWorld; regen multiplier in engine.
11. **HUD:** nothing covers play-critical chrome. Dialogue mid-screen; bottom chrome **hidden** while dialogue open. Boss bar only when near Reek or he is damaged.
12. **Lighting:** controlled weak PMREM; avoid global haze / excess env intensity.
13. **Scrap caches:** 3 quest caches near Scrap Beacon with glow spikes + bob; re-grounded every frame; gold dots on minimap during `get_wheels`. Never clip under terrain.
14. **Fortress fantasy:** Reek outer towers/cannons/keep are damageable (`fort_piece` / `fort_cannon` / `throne`). Smash for breach announcements + taco drops.
15. **Taco boost:** temporary max-speed + jump multiplier; air particle trail while boosted.
16. **Crew slots:** `CREW` array slot 0 live; slots 1–6 reserved (Coach Blorp, Pete, Goo Mercy, Spike Rind, Nana Drift, Ash Korus).

---

## 5. Weapons (reference)

| Input | Action |
|-------|--------|
| **1–6** | Select weapon (no fire) |
| **Q** (single) | Primary fire of selected |
| **Q** double-tap / **E** | Secondary fire of selected |
| Mobile **FIRE** / **SEC** | Primary / secondary |

| Slot | Id | Secondary |
|------|-----|-----------|
| 1 | stink_spray | Spray Fan (5-way) |
| 2 | ooze_blob | Ooze Bomb |
| 3 | slime_rocket | Rocket Salvo (3) |
| 4 | gas_mine | Mine Cluster |
| 5 | quantum_bolt | Bolt Storm |
| 6 | bandana_blade | Blade Whirl |

Ammo = **STINK** meter. Defs in `weapons.ts`.

---

## 6. World / combat density

- Enemy spawn: Poisson-ish scatter via `spawnArmy()` — min spacing, clear of safe zones & spawn bubble.
- Props thinned; wrecks tagged `wreck`.
- Terrain grid denser for structure seating.

---

## 7. HUD layout contract

```
TOP-LEFT     HP / STINK / LV bars
TOP-RIGHT    Quest card (+ pause FAB far right)
TOP-CENTER   Location · combo · boss (gated)
MID          Announce · Dialogue (centered, z-index 40)
BOTTOM       [minimap+speedo] [cam+safe] [weapon 1–6]
TOUCH        stick | FIRE JUMP DRIFT SPRINT | BRAKE/GAS | CAM stack
```

When `dialogue` is open: bottom chrome `.is-hidden`, top dimmed, dialogue opaque mid-viewport.

---

## 8. Verify before ship

```bash
npm run typecheck
npm run build
# browser
# - Enter Wastes → dismiss dialogue (Space) → bottom HUD reappears clean
# - Idle speed stays 0 without GAS
# - 1–6 changes weapon strip highlight
# - Mobile 390×844: no dialogue over GAS; no CHASE pill inside dialogue text
# - Drive to throne mesa → boss bar appears near Reek only
```

Smoke helper: `node scripts/browser-smoke.mjs http://127.0.0.1:8080/ screenshots/out.png`

---

## 9. Audio notes

- SFX: procedural WebAudio in `audio.ts` (unlock on first gesture).
- **OST loop (wired):** `public/audio/Slime_Rider.mp3` → `Slime_Carousel.mp3` → repeat.
  - Playlist in `gameAudio.startMusic()` via HTMLAudioElement; volumes follow Master/Music/Mute.
  - Starts on "Enter the Wastes"; stops on title return.

---

## 10. Archive policy

Older experimental branches / WIP polish commits are **archived**. **`main` is the sole benchmark.** Do not resurrect pre-benchmark control/lighting regressions without a new feature branch.

---

## 11. Credits

- Character / IP inspiration: **Stinky** — [x.com/stinkycubert](https://x.com/stinkycubert)
- Build: AdventureNLearn + Grok Build (xAI)

