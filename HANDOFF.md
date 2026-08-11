# STINK KART WARS — Build Handoff

**Repo:** https://github.com/AdventureNLearn/stink-kart-wars  
**Stack:** React 19 + TypeScript + Vite + TanStack Start + Three.js  
**Character:** Stinky the Slime (@stinkycubert) — bandana never comes off  
**Last durable push:** session 2026-08-11 (jump/stomp, cover, mobile, grounded castles)

---

## Quick start (every new session)

```bash
git clone https://github.com/AdventureNLearn/stink-kart-wars.git
cd stink-kart-wars
npm install
npm run typecheck
npm run build
npm run dev   # http://0.0.0.0:8080
```

**Hard rules for this environment**
1. Sandbox wipes uncommitted work. **Commit + push early** or archive under `/home/workdir/artifacts/archives/`.
2. Live `vite dev` may OOM (~2GB sandbox). Prefer `npm run build` as the truth gate; publish uses the production build.
3. Do **not** claim features exist on GitHub unless they are in the committed tree.
4. Publish target historically: `sk01.grok.me` (check free before publish).

---

## What is in the game (durable)

### Core RPG
- Open world vehicle combat, 7 quests → boss Warlord Reek
- Enemies: slime_raider, korus_drone, bandit_kart, tank, artillery, cannon_crew, boss_reek
- Skills: **Q** Stink Cloud, **E** Ooze Overdrive, **R** Sprint
- Phases: title | playing | dialogue | dead | paused | victory

### Session features (must remain)
| Feature | Where | Notes |
|---------|--------|--------|
| **Jump + stomp** | `src/game/engine.ts` | Space / hop → `vy`, gravity, airborne. Land on enemy → STOMP KO (raiders one-shot; tanks/boss chunk + bounce) |
| **Cover page** | `GameApp.tsx` + `styles.css` | Stinky X avatar (`public/stinky-avatar.jpg`), hero bg (`public/hero-bg.jpg`), @stinkycubert credit |
| **Mobile multitouch GAS** | `input.ts` + `GameApp.tsx` | Separate `touchGas` / `touchBrake`; pointer capture; skills must not zero throttle |
| **Mobile JUMP** | `GameApp.tsx` | `bindHold("jump")` between GAS and BRAKE |
| **Grounded castles** | `openWorld.ts` | `FORT_PADS` hard-flat cores, `footprintMinY`, `addCastleFoundation` under Reek / Slime Bastion / Ruins |

### Controls
| Input | Action |
|-------|--------|
| W/S | Gas / brake |
| A/D | Steer |
| **Space** | **Jump / stomp** |
| Q | Stink Cloud |
| E | Ooze |
| R | Sprint |
| Esc | Pause |

Mobile: STEER stick (left) · GAS / JUMP / BRAKE (right) · STINK / OOZE / DRIFT / BOOST (action cluster)

---

## Key files

```
src/game/engine.ts      # Loop, jump physics, stomp, combat, camera chase
src/game/openWorld.ts   # Terrain, FORT_PADS, castles, landmarks
src/game/meshes.ts      # Stinky body + bandana, kart, AI racers
src/game/military.ts    # Tanks, cannons, createCastleMesh
src/game/input.ts       # Keys + touchGas/touchBrake/touchHop
src/game/GameApp.tsx    # Cover UI, HUD, mobile controls
src/game/settings.ts    # Bindings (hop = Jump / Stomp)
src/game/quests.ts      # 7-mission campaign
src/styles.css          # Cover + mobile layout
public/stinky-avatar.jpg
public/hero-bg.jpg
public/og.jpg
```

---

## Known gaps (not yet in repo)

These were discussed in earlier sessions but **are not durable** unless you re-implement and push:

1. **4 camera modes + zoom** — still single chase camera
2. **Lighting normalization** — global PointLights still present (can look hazy); local auras for safe zones not landed
3. **Full meme-character densify** beyond current Stinky body (AI racers still simpler)

Do not tell the user these exist until they are in `main` and verified.

---

## Verify before claiming “done”

```bash
npm run typecheck
npm run build
# Feature grep smoke
grep -n "STOMP\|airborne\|jumpLock" src/game/engine.ts | head
grep -n "FORT_PADS\|footprintMinY\|addCastleFoundation" src/game/openWorld.ts | head
grep -n "stinky-avatar\|cover-title\|bindHold" src/game/GameApp.tsx | head
grep -n "touchGas\|touchBrake" src/game/input.ts | head
test -f public/stinky-avatar.jpg && test -f public/hero-bg.jpg && echo assets_ok
```

---

## Publish checklist

1. `npm run typecheck` + `npm run build` green  
2. Cover loads avatar + hero  
3. Enter the Wastes → drive, jump, stomp a raider  
4. Mobile: GAS held while firing STINK/OOZE still accelerates  
5. Castles sit on terrain (no floating walls)  
6. Push to GitHub **before** sandbox wipe  
7. Publish only after user confirm  

---

## Architecture notes

- Player `y` is no longer glued every frame to ground: jump uses `vy` + gravity; land snaps to `groundY + RIDE_HEIGHT`.
- Enemy collision: if airborne + above + falling → stomp; if airborne + above → pass-through; else body bump/ram.
- Terrain: `rawTerrainHeight` + `FORT_PADS` (hard core, soft rim) so large footprints do not hang on slopes.
- Mobile throttle: never route skills through `touchThrottle`; use `touchGas` / `touchBrake` flags with pointer capture.
