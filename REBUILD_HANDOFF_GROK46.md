# STINK KART WARS — Grok 4.6 Full Rebuild Brief

**Paste this entire file as the first message in a new Grok 4.6 / Grok Build chat.**  
That chat must **rebuild a complete, playable, high-fidelity game** — not a scaffold.

| | |
|---|---|
| **Product** | STINK KART WARS |
| **IP / star** | **Stinky the Slime** — [@stinkycubert](https://x.com/stinkycubert) |
| **Owner** | AdventureNLearn |
| **Benchmark repo** | https://github.com/AdventureNLearn/stink-kart-wars (`main` is the only live benchmark) |
| **Latest known commit family** | Pete garage + quest-tied minimap (`8574d90` and later on `main`) |
| **North star look** | Stinky’s **Slimekart** cinematic / console-box-art quality (green slime, red bandana, eyepatch, taco gags, exploding fortresses). Arcade-kart *feel*, AAA *read*. |
| **This chat’s job** | Rebuild a **fully playable** open-world vehicle action-RPG with **fleshed characters, every unit type, L1–L6 rendering, arcade-but-weighty physics**, and **zero TODOs**. |

You (4.6) are Grok Build in the isolated sandbox. Serve on `0.0.0.0:8080`, own `/workspace/startup.sh`, verify with a real browser (not curl 200), keep the server up. Consult **`.grok/skills/`** before building:

| Skill | When |
|---|---|
| `design-ui` | Every HUD / menu / overlay |
| `building-games` + `controls` | Loop, WASD/steer sign, jump, camera, game feel |
| `building-games/references/genres/racing-kart.md` | Arcade kart handling, drift, chase cam |
| `building-games/references/collision-physics.md` | Collision, grounding, smashables |
| `threejs` | Materials, post, GL, disposal |
| `progressive-refinement` | **Mandatory** visual densify (Layers 1→6). Never “make it prettier.” |
| `game-character-consistency` | Every character/unit: identity sheets, turnarounds, damage states |
| `imagine` / `generate2dsprite` | Heroes, portraits, HUD art, optional sprite sheets |
| `game-asset-core` | Asset contracts |

**Do not default to a different game. Do not ship placeholders.** Clone/continue from the repo if the workspace is empty; if source exists, rebuild *in place* toward this spec.

---

## 0. Mission (what “done” means)

A player can:

1. Hit **Enter the Wastes**, hear **one OST track at a time** (Rider → Carousel loop).
2. Drive a **stationary-start** kart (no auto-forward). A = left, D = right, S = reverse, Space = jump/stomp, R = sprint, Shift = drift.
3. Complete **all 7 quests** with **visible objectives** (sky beams + minimap marks that appear only for the **active** quest and **clear on complete**).
4. Fight **spread enemies** that never look like wrecks.
5. Smash **Reek Fortress** pieces, grab **tacos**, sit in **safe zones**, swap **6 weapons** (1–6 select, Q primary, E secondary).
6. Defeat **Warlord Reek** and get the victory beat.
7. Play on **desktop and ~390px mobile** with **nothing covering play-critical chrome**.
8. See a world that reads **Slimekart / console trailer** — not proto-boxes.

`npm run typecheck` and `npm run build` pass. Dev **and** production build render in a browser with a clean console.

---

## 1. What already exists (do not regress)

Current stack: **React 19 + TypeScript + Vite + TanStack Start + Three.js + Tailwind**. Engine is a self-contained canvas module (`src/game/engine.ts`), HUD in `GameApp.tsx`.

### Source map

| Path | Role |
|---|---|
| `src/game/engine.ts` | Loop, arcade physics, combat, cameras, enemies, HUD emit, minimap |
| `src/game/openWorld.ts` | Terrain, `FORT_PADS`, landmarks, props, `SAFE_ZONES`, sky beams |
| `src/game/GameApp.tsx` | Cover, HUD, touch, pause Settings/Controls |
| `src/game/input.ts` | Keyboard + touch → `InputState` |
| `src/game/weapons.ts` | 6 weapons, primary/secondary |
| `src/game/military.ts` | Tank / wreck / cannon / artillery / castle |
| `src/game/meshes.ts` | Stinky kart + body, AI racers, FX |
| `src/game/visualDensity.ts` | L4 materials, contact shadows, rivets |
| `src/game/audio.ts` | Procedural SFX + exclusive OST playlist |
| `src/game/quests.ts` | 7 quests + story beats |
| `src/game/crew.ts` | Stinky + 6 crew **data slots** (not yet playable meshes) |
| `src/game/settings.ts` | Bindings, volumes, `autoAccel: false` |
| `src/game/types.ts` | Phases, colors, HUD snapshot |
| `src/game/collision.ts` | Sphere / AABB |
| `src/styles.css` | HUD zoning, no-overlap |
| `public/audio/Slime_Rider.mp3` | Track 1 |
| `public/audio/Slime_Carousel.mp3` | Track 2 |
| `public/stinky-avatar.png` | Cover art (PNG only — never a typed-null JPEG) |

### Durable rules (hard fail if broken)

1. **No auto-forward.** Kart coasts/stops at throttle 0.
2. **A = left, D = right** (chase cam, speed > 0). Run `controls` self-test.
3. **Jump/stomp:** Space / JUMP; falling onto enemy = stomp.
4. **Reverse:** S / BRAKE is hard-brake then reverse gear. Touch GAS/BRAKE are **not** stick Y.
5. **4 cameras:** CHASE / NEAR / HIGH / NOSE + `[` `]` zoom.
6. **Castles sit on `FORT_PADS` + foundations.** Never floating keeps.
7. **Wrecks ≠ live tanks.** `createWreckTankMesh()` soot/rust. Live = `createTankMesh()`.
8. **Weapons:** 1–6 **select only**. **Q** primary (single). **E** or **Q double-tap** secondary. Mobile FIRE / SEC.
9. **Safe zones** regen HP/stink faster.
10. **HUD:** dialogue mid-screen, bottom chrome hidden while talking. Boss bar only near Reek or after he is hurt.
11. **Lighting:** weak controlled PMREM. No global haze, no object-to-object bounced lighting soup.
12. **Quest caches / gens / Pete / Korus:** sky beams + minimap **only for the active quest**. Markers vanish when that quest completes.
13. **OST:** one song at a time. Never layer Rider + Carousel.
14. **Smashables** (fences, barrels, billboards) toss/break and **respawn ~60s**. Trees stay. Fort pieces stay smashed until reload (fantasy).
15. **Vehicles can sit still.** Enemies tagged `stationary` do not auto-drive.

---

## 2. Character bible (playable roster)

Build **identity first** (`game-character-consistency`): freeze silhouette, palette, markers, then densify L1→L6. Every playable character is a **slime + kart + voice**. Slot 0 ships unlocked; 1–6 unlock via story (Pete after `rescue_bandana`, etc.) but **all must have finished meshes + handling variants**.

### Shared slime grammar

- Translucent **gel body** (icosa / metaball read), inner darker core, wet highlight, contact blob under kart.
- **Asymmetry is law.** Write a side-map before any portrait/mesh: eyepatch, tails, exhaust, signage.
- Kart is a **named ride**, not a generic box. Dual pipes, rivets, panel seams, bandana streamers.

---

### Slot 0 — STINKY (live now)

| | |
|---|---|
| **Name** | Stinky |
| **Codename** | Bandana Drifter |
| **Handle / IP** | @stinkycubert |
| **Role** | Driver / ace |
| **Body** | Bright slime green `#3DCC5A`, darker core `#1F8A35`. Compact, cheeky, slightly hunched racer pose. |
| **Permanent marks** | **Red bandana never comes off** (`#E11D2E`) — wrap + two tails streaming aft. **Left eyepatch** (viewer-right on front view). **Right eye** yellow iris, black pupil, cornea catch-light. **Yellow mohawk spikes** (5 cones). Hoodie-shell `#2A3D8A` over torso. Toothy grin. |
| **Kart** | Bandana Drifter — slime-green chassis, purple side pods `#A855F7`, cyan Korus engine `#22D3EE`, dual exhaust, nose badge, spikes on corners, red streamers. Scale ~1.4 in world. |
| **Voice** | Few words. Cocky, loyal, never loses the bit. |
| **Handling** | Baseline: maxSpeed ~42 + level, accel 48, jump ~15.8, taco 1.28× speed / 1.22× jump. |
| **SFX / VFX** | `crew_stinky` / `slime_green` — wet hops, fart-cloud, green splat. |
| **Unlock** | Start. |

**Must-render:** front / 3⁄4 / side / back identity. Damage: gel nicks, bandana still on. Victory: bandana tails snap in wind.

---

### Slot 1 — COACH BLORP

| | |
|---|---|
| **Name** | Coach Blorp |
| **Codename** | Radio Racer |
| **Role** | Support |
| **Body** | Older, thicker slime, cyan-grey gel `#22D3EE` with mustard `#F5E642` headset and clipboard-fin. Extra jowl ridges. No eyepatch. Small radio mic glued to left cheek. |
| **Kart** | Pit wagon — longer tail, tool racks, spare wheel, yellow caution stripes, antenna. Slightly slower, better regen aura. |
| **Voice** | Yells usefully. Radio static. Current story narrator. |
| **Handling** | −8% top speed, +20% stink regen, short boost-on-radio (secondary). |
| **Unlock** | After `get_wheels` (he “wires the boosters”). |
| **SFX / VFX** | `crew_blorp` / `quantum_cyan` |

---

### Slot 2 — PILGRIM PETE

| | |
|---|---|
| **Name** | Pilgrim Pete |
| **Codename** | Bandana Tailor |
| **Role** | Scout |
| **Body** | Lean red-tinted slime `#C23B3B`, **many** bandanas (head, wrists, antenna). Needle-spike mohawk. Sewing-goggle on one eye (not a war patch). |
| **Kart** | Tailor’s scooter-kart — narrow, light, cloth banners, spool wheels. Fast, fragile. |
| **Home** | **Pete’s Garage** west (`-110, 55`), landmark name exact, **cyan sky beam** + red sign. |
| **Voice** | Sacrilege if you lose a bandana. Warm after you save him. |
| **Handling** | +12% speed, +15% turn, −15% HP. |
| **Unlock** | Complete `rescue_bandana`. |
| **SFX / VFX** | `crew_pete` / `cloth_red` |

---

### Slot 3 — GOO MERCY

| | |
|---|---|
| **Name** | Goo Mercy |
| **Codename** | Ooze Overdrive |
| **Role** | Bruiser |
| **Body** | Huge dark-green `#1F8A35` with purple veins `#A855F7`. Wide stance, apologetic eyes, heavy arms. |
| **Kart** | Sludge truck-kart — fat tires, plow bumper, drip trails. |
| **Voice** | Soft. “Sorry.” Then rams a tank. |
| **Handling** | −15% speed, +35% ram/stomp, wider collision. |
| **Unlock** | After `slime_outpost`. |
| **SFX / VFX** | `crew_goo` / `ooze_purple` |

---

### Slot 4 — SPIKE RIND

| | |
|---|---|
| **Name** | Spike Rind |
| **Codename** | Mohawk Missile |
| **Role** | Heavy |
| **Body** | Harder “rind” slime, yellow `#F5E642` armor plates, metal-grey `#4A5568` studs. All mohawk, no bandana (rival fashion — still respects Stinky’s). |
| **Kart** | Armored wedge, ram prow, almost no windows. |
| **Voice** | Grunts. Prefers ramming. |
| **Handling** | −10% turn, +40% ram damage, knockback resist. |
| **Unlock** | After `first_blood` kill streak ≥ 10 or level 3. |
| **SFX / VFX** | `crew_spike` / `spark_metal` |

---

### Slot 5 — NANA DRIFT

| | |
|---|---|
| **Name** | Nana Drift |
| **Codename** | Taco Phantom |
| **Role** | Trickster |
| **Body** | Golden-orange gel `#E8A838`, lime accents `#3DCC5A`, taco-shell shoulder pads, sly one-tooth grin. |
| **Kart** | Low drift machine, taco spoiler, sparkle trail when boosting. |
| **Voice** | Invented the taco line. Steals pickups mid-air. |
| **Handling** | Best drift / lateral slide, taco duration +4s, slightly less HP. |
| **Unlock** | Collect 3 tacos in one life. |
| **SFX / VFX** | `crew_nana` / `taco_sparkle` |

---

### Slot 6 — ASH KORUS

| | |
|---|---|
| **Name** | Ash Korus |
| **Codename** | Throne Defector |
| **Role** | Commander |
| **Body** | Ash-red `#4A1520` with ember cracks `#FF3355`. Ex-Reek lieutenant. Horn-like korus crystals on crown. One cracked yellow eye. |
| **Kart** | Stolen Reek siege-kart, black-red, wall-cannon hood ornament. |
| **Voice** | Knows every fort weak joint. Cold, then loyal. |
| **Handling** | Bonus damage vs `fort_piece` / `fort_cannon` / castle. |
| **Unlock** | After `reek_throne` (new-game+ / select). For rebuild, unlock after `korus_core`. |
| **SFX / VFX** | `crew_ash` / `reek_ember` |

**Character select:** pause or cover **Crew** tab. Switching mid-run swaps mesh + handling multipliers, keeps HP% and scrap. Same engine.

---

## 3. Non-playable characters

| ID | Name | Function | Look | Where |
|---|---|---|---|---|
| `npc_blorp_radio` | Coach Blorp (radio) | Story beats `intro`, `beacon`, `scrap_done`, `victory` | Headset slime, not necessarily on-map | Radio only until unlocked |
| `npc_pete` | Pilgrim Pete | `rescue_bandana`, garage | See slot 2 | Pete’s Garage pad, not a combatant |
| `npc_korus_echo` | Korus Echo | `korus_core` dialogue | Disembodied cyan crystal voice | Canyon |
| `boss_reek` | **Warlord Reek** | Final boss | Huge dark-red slime warlord, crushed-kart throne, no cute bandana — iron circlet, dual ember eyes, siege-kart the size of a hut | Throne Mesa `190, 175` |
| `mystery_radio` | Mystery Radio | Outpost warning | Unseen | Artillery Outpost |

Reek **must** be unmistakably the boss: scale, silhouette, health bar (only when near or damaged), unique mesh — never a palette-swap raider.

---

## 4. Every unit type (combat + world)

Wrecks, props, and live units **must not share a silhouette**. If a player thinks a rust pile is a tank, you failed.

### Live combat units

| Kind | Faction | Role | HP (now) | Speed | Notes / rebuild target |
|---|---|---|---|---|---|
| `slime_raider` | Slime / feral | Light kart | ~45 | ~28 | Green-brown raider kart, no bandana, rust spikes. First Blood fodder. |
| `bandit_kart` | Bandits | Scout / Pete patrol | ~55 | ~26 | Orange-red rags, stolen cloth. **5 tight on Pete’s Garage** for `rescue_bandana`. |
| `korus_drone` | Reek / crystal | Flyer-hover | ~40 | ~22 | Cyan/purple octa hover, no wheels. Canyon + north packs. |
| `tank` | Reek | Heavy | ~110 | 0 if `stationary` else slow | Live `createTankMesh("reek")`. Turret tracks player. |
| `artillery` | Reek | Long range | ~80 | 0 | Emplaced. Shells arc. Ridge posts. |
| `cannon_crew` | Reek | Emplaced | ~50 | 0 | Small crew + field gun. |
| `boss_reek` | Reek | Boss | high | slow + phases | Unique mesh. Shells, stomp, taunt. `isBoss`. |

**AI:** aggro radius per kind; tanks/artillery/cannon **may sit still**. No auto-forward for parked units. Spread with Poisson-ish `spawnArmy()` — min spacing ~32, keep clear of `SAFE_ZONES` + spawn bubble r=42. **Do not clump.**

### World / interactable units (not enemies)

| Kind / tag | Role | HP | Behavior |
|---|---|---|---|
| `scrap` / `scrap_cache_quest` | Quest crate | 1 | 3 near beacon `(14,108) (-16,100) (8,85)` + 2 bonus. Gold sky beam. Bob + re-ground. Pickup radius generous on `get_wheels`. |
| `scrap` / `scrap_cache` | Bonus crate | 1 | Same, shorter beam. |
| `generator` | Outpost cores | 90 | **3** at ~(120,45) (136,57) (152,45). Magenta 72u beam, spinning core. `slime_outpost`. |
| `korus_core` | Story crystal | 160 | `(210, -35)` cyan beam. |
| `beacon` / `quest_beacon` | Scrap Beacon | invuln | `(0, 95)` cyan/green pillar. `wake_up`. |
| `garage` / `pete` + `pete_marker` | Pete’s Garage | invuln keep | `(-110, 55)` cyan beam + red sign. Landmark **name = "Pete's Garage"**. |
| `castle` / `throne` | Reek keep | 4200 | Damageable. `KEEP DESTROYED!` |
| `tower` / `fort_piece` | Outer towers | 160 | Smash fantasy, breach announces. |
| `cannon` / `fort_cannon` | Wall guns | 110 | Smash + taco chance. |
| `cannon` / `field_cannon` | Outpost guns | 70 | Combat + smash. |
| `tank_prop` / `wreck` | Dead husk | 50 | **Looks dead.** Soot, collapsed track, no turret aim. |
| `tree_dead` | Terrain | high | Stay. Soft collision. |
| smashables (`barrel`, `billboard`, `pipe`, `wall` light) | Juice | low | Toss / break / **respawn ~60s**. |
| pickups `hp` `stink` `scrap` `taco` | Loot | — | Taco = 12s speed+jump juice. |

### Landmarks (world names)

| id | Name | xz | r |
|---|---|---|---|
| spawn | No Man's Land | 0, 0 | 30 |
| beacon | Scrap Beacon | 0, 95 | 32 |
| throne | Reek Fortress | 190, 175 | 70 |
| garage | **Pete's Garage** | -110, 55 | 55 |
| ruins | Ashen Ruins | -20, -120 | 40 |
| outpost | Artillery Outpost | 130, 50 | 45 |
| korus | Korus Canyon | 210, -35 | 40 |

### Fort pads (grounded keeps)

```
Reek Fortress   (190, 175)  coreR 30  rimR 48  floorY 9.2
Pete / Bastion  (-110, 55)  coreR 22  rimR 36  floorY 3.4
Ashen Ruins     (-20,-120)  coreR 18  rimR 30  floorY 1.6
```

### Safe zones

```
No Man's Rest   (0, 0)      r 28  regen 3.2×
Scrap Sanctum   (0, 95)     r 22  regen 2.6×
Slime Refuge    (-110, 55)  r 20  regen 2.4×
Ashen Haven     (-20,-120)  r 18  regen 2.2×
```

Player world clamp ~±320 (terrain extent ~340). Keep playable space open — trees yes, obstacle mazes no.

---

## 5. Quests (must all be completable)

Order: `wake_up` → `get_wheels` → `first_blood` → `slime_outpost` → `rescue_bandana` → `korus_core` → `reek_throne`.

| id | Title | Target | How it completes | Map / beam |
|---|---|---|---|---|
| wake_up | Wake Up, Stinky | 1 | Enter Scrap Beacon radius ~18 | Green beacon |
| get_wheels | Bandana Drifter Online | 3 | Pickup 3 scrap caches | Gold crates + beams |
| first_blood | First Blood, First Fart | 6 | Kill raiders / bandits / tanks | Nearby hostiles red |
| slime_outpost | Torch the Outpost | 3 | Destroy 3 `generator`s | Magenta gens |
| rescue_bandana | Never Lose the Bandana | 1 | Reach Pete + wipe garage bandits | Cyan garage + orange bandits |
| korus_core | Heart of the Vein | 1 | Destroy / claim korus core | Cyan crystal |
| reek_throne | Stink Kart Wars | 1 | Kill Reek | Red fortress / boss |

**Minimap contract:** only **active** quest paints big pulsing marks + edge chevrons. Completed quest marks **gone**. Landmarks are tiny dim ghosts, never look like objectives. HUD `questProgress` includes **distance + remaining count**.

**Dialogue:** mid-screen, opaque, z-40. Bottom HUD hidden while open. Advance Space/Enter. Speakers: COACH BLORP, MYSTERY RADIO, PILGRIM PETE, KORUS ECHO, WARLORD REEK.

---

## 6. Weapons

| Slot | Id | Primary | Secondary |
|---|---|---|---|
| 1 | stink_spray | Spray 22 / 0.28s / cost 10 | Spray Fan ×5 |
| 2 | ooze_blob | Blob 48 splash 5 | Ooze Bomb |
| 3 | slime_rocket | Rocket 70 splash 8 | Salvo ×3 |
| 4 | gas_mine | Mine 55 / 12s life | Cluster ×3 |
| 5 | quantum_bolt | Bolt 40 / speed 90 | Bolt Storm ×3 |
| 6 | bandana_blade | Melee 65 r=4.5 | Blade Whirl |

Ammo = **STINK** meter (regen in safe zones). Numbers **never fire**.

---

## 7. Controls (do not invert)

**Desktop**

| Key | Action |
|---|---|
| W / ↑ | Throttle |
| S / ↓ | Brake then reverse |
| A / ← | Steer **left** |
| D / → | Steer **right** |
| Space | Jump / stomp (not drift) |
| Shift | Drift |
| R | Sprint |
| Q | Primary (double-tap = secondary) |
| E | Secondary |
| 1–6 | Select weapon |
| C / Shift+C | Cycle camera |
| [ ] | Zoom |
| Esc / P | Pause → Resume / Settings / Controls |
| Enter | Advance dialogue / start |

**Mobile:** left stick steer only; **GAS / BRAKE** separate; FIRE JUMP DRIFT SPRINT; SEC; weapon strip swipe; CAM stack. Multitouch-safe.

**Cameras:** CHASE dist 10 h 4.6 · NEAR 6.2/3.2 · HIGH 14/11 · NOSE 2.4/2.1. Smooth lerp, speed FOV, never hard-parent.

**Physics (arcade, not full rigid-body sim):** heading + signed speed + decaying lateral; steer scales with speed; reverse flips steer sign; ground via `terrainHeight` + `RIDE_HEIGHT`; jump vy ~15.8, gravity ~30; hop lock until release+land. Fixed dt 1/60. Smashables get impulse; forts take staged HP + darken.

---

## 8. Rendering protocol (highest quality this platform allows)

You have Three.js, MeshPhysical materials, UnrealBloom (gate on real GPU), weak PMREM `RoomEnvironment`, particles, contact shadows.

### Progressive refinement (mandatory)

Do **not** say “make it realistic.” Advance **one layer at a time** and freeze prior layers:

1. **Structure** — volumes, proportions, readable silhouette (Stinky = slime + bandana + kart).
2. **Articulation** — limbs, wheels, tails, exhaust, eyepatch, weapons.
3. **Definition** — muscle/gel ridges, panel seams, mohawk, castle battlements.
4. **Materials** — `visualDensity.ts`: slime SSS-ish physical, cloth bandana, rubber tires, clearcoat paint, metal plates, wet eyes. Contact shadows.
5. **Dynamics** — wheel spin, bandana tails, gel jiggle, beam pulse, stomp squash, smash toss, drift slide.
6. **Context** — terrain color moisture, landmark auras (short range only), dust, explosions, bloom **only** on real GPU, no lighting soup.

**Lighting law (Stinky’s ask):** objects must **not** flood the scene with indirect bounce. Weak PMREM, low `envMapIntensity` (~0.2–0.35), local point lights only at landmarks/quest beams. Sky beams = additive MeshBasic, no shadows.

**Anti-slop:** no default purple fog, no identical box trees, no shiny plastic everything, no HUD clutter. `design-ui` tokens. Cover uses `stinky-avatar.png` + hero. Identity must survive a screenshot at 1280 and 390.

**Densify pass order after playable loop is green:** (1) Stinky + kart (2) Reek + fortress (3) Pete garage (4) generators / caches (5) each enemy kind unique (6) terrain/veg L6.

---

## 9. Audio

- Unlock + `startMusic` on **Enter the Wastes** (same gesture).
- Playlist: `/audio/Slime_Rider.mp3` then `/audio/Slime_Carousel.mp3`, **exclusive** — silence all others before play. `loop=false`, advance on `ended` only. Presence EQ ok; do not dual-start preload + immediate play.
- SFX: hop, land, explosion, item, boost, fart/stink, UI, engine loop tied to speed.
- Pause Settings: master / sfx / music / mute. Restart music if user raises music from 0.

---

## 10. HUD / UI contract

```
TOP-LEFT     HP / STINK / LV / scrap
TOP-RIGHT    Quest card (title, objective, progress) + pause
TOP-CENTER   Location · combo · boss (gated)
MID          Announce · Dialogue
BOTTOM       minimap+speedo | cam+safe | weapons 1–6
TOUCH        stick | FIRE JUMP DRIFT SPRINT | BRAKE GAS | CAM
PAUSE        Resume · Settings · Controls
COVER        Play / Story / Settings / Controls · Enter the Wastes
```

Nothing covers GAS, CAM, weapons, or dialogue. `dialogue-open` hides bottom chrome.

---

## 11. Suggested rebuild order (playable first)

1. Scaffold TanStack + `startup.sh` + `0.0.0.0:8080`. Clone/sync repo if needed.
2. **Controls + cameras + no auto-forward** — self-test A/D, reverse, jump, 4 cams.
3. World grounded (`FORT_PADS`, terrain, safe zones).
4. Stinky L3–L4 mesh + handling.
5. Quest loop + **quest-only** minimap + sky beams (all 7 completable).
6. Unique enemy meshes + spread AI + wreck distinction.
7. Weapons 1–6 Q/E + taco + smash/respawn + fort fantasy.
8. OST exclusive playlist + pause settings.
9. HUD no-overlap desktop + 390px.
10. **Character pass:** all 7 playables + Reek identity (`game-character-consistency`).
11. **Densify L4–L6** structures, then units, then lighting.
12. `typecheck` + `build` + browser smoke + production-serve smoke.

---

## 12. Acceptance (must all pass)

- [ ] Idle speed is 0 without GAS  
- [ ] A left / D right at speed > 0 (chase)  
- [ ] S reverse works; mobile BRAKE ≠ stick  
- [ ] Jump + stomp  
- [ ] 4 cameras + zoom labeled CHASE/NEAR/HIGH/NOSE  
- [ ] 7 quests completable; Pete = cyan west; gens = magenta; scrap = gold  
- [ ] Minimap marks match **only** active quest  
- [ ] Reek unique; wrecks never aggro  
- [ ] Fort pieces smash with announces  
- [ ] 6 weapons select/fire as specified  
- [ ] OST never overlaps  
- [ ] Dialogue never covers controls  
- [ ] Castles not floating  
- [ ] Safe zones regen  
- [ ] Stinky still has bandana + eyepatch  
- [ ] Typecheck + production build render  
- [ ] Mobile 390×844 no horizontal overflow  

---

## 13. Platform / ops (agent only — never tell the user ports)

- Listen **`0.0.0.0:8080`**. Own **`/workspace/startup.sh`** (idempotent, background).  
- Vite config: `nitro({ preset: "vercel" })` **only** when `command === "build"`. Do not import vendored `vite-tanstack-config`.  
- Public avatar must be a **clean PNG**. No `stinky-avatar.jpg` with type null.  
- Screenshots under `/workspace/screenshots/`.  
- Speak in **product terms** to the player.  
- Push to `https://github.com/AdventureNLearn/stink-kart-wars` `main` when the human asks to ship.

---

## 14. Tone / fantasy

ZeroVerse apocalypse, still funny. Stinky is cute-dangerous. Bandana is religion. Tacos are sacred. Reek is compost-in-waiting. **Never lose the bandana.**

If anything in the cloned repo conflicts with this brief, **this brief wins** except durable control/lighting/HUD rules — those never regress.

**Start now:** inspect workspace + clone if needed, then execute §11. Ship a playable preview, then densify characters and units to L6.
