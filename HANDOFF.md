# STINK KART WARS — Handoff (2026-08-11 polish restore)

Playable open-world vehicle RPG. Bandana never comes off.

## Durable features (must stay on main)

| Feature | Where | Notes |
|---|---|---|
| **Jump + stomp** | `src/game/engine.ts` | Space / hop → `vy`, gravity, `airborne`. Land on enemy → STOMP KO |
| **FORT_PADS** | `src/game/openWorld.ts` | Hard-flat castle cores + `footprintMinY` |
| **Cover** | `GameApp.tsx` + `public/` | Stinky avatar + hero-bg |
| **Mobile multitouch GAS** | `input.ts` + `GameApp.tsx` | Separate `touchGas` / `touchBrake` / `touchHop`; pointer capture |
| **Reverse gear** | `engine.ts` updatePlayer | Hard-brake when speed>1.5; reverse gear below; max reverse 55% |
| **4 cam modes + zoom** | `engine.ts` `CAM_MODES` | CHASE / NEAR / HIGH / NOSE + `camZoom`; C / [ ] / mobile CAM |
| **Lighting normalization** | `engine.ts` buildScene | No global PointLights; weak PMREM (`environmentIntensity` 0.28); landmark auras only |
| **progressive-refinement** | `.grok/skills/progressive-refinement/` | L1–L6 densify protocol (from QK/HDH) |

## Continuity greps

```bash
grep -n "STOMP\|airborne\|jumpLock" src/game/engine.ts | head
grep -n "FORT_PADS\|footprintMinY" src/game/openWorld.ts | head
grep -n "stinky-avatar\|hero-bg" src/game/GameApp.tsx | head
grep -n "touchGas\|touchBrake" src/game/input.ts | head
grep -n "CAM_MODES\|camZoom\|environmentIntensity\|attachLandmarkAuras" src/game/engine.ts | head
```

## Control layout (mobile)

- **Left:** steer stick (no gas on stick)
- **Center:** DRIFT · STINK · OOZE · JUMP · SPRINT
- **Right column:** BRAKE (top) / GAS (bottom) — vertical, multitouch-safe
- **CAM bar:** cycle mode + zoom −/+
- **HUD:** mode label + zoom %

Desktop: WASD · Space hop · Q stink · E ooze · R sprint · **C** cam cycle · **[ ]** zoom

## Rendering (Layer 6)

- Sun + hemi + ambient + fill + rim
- **Weak RoomEnvironment PMREM** for slime clearcoat (`environmentIntensity ≈ 0.28`)
- **No global PointLight haze**
- Local landmark auras (beacon/scrap/outpost/throne/korus/garage)
- Soft UnrealBloom only on high detail

## Open follow-ups

1. AI racer densify to Stinky L4 parity
2. InstancedMesh for vegetation
3. Hitstop on stomp
4. Drift spark charge ladder polish

## Rules

- Mobile throttle: never route skills through `touchThrottle`; use `touchGas` / `touchBrake` with pointer capture.
- Enemy collision: airborne + above + falling → stomp; airborne + above → pass-through; else body bump.
- Do not reintroduce global battlefield PointLights.
