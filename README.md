# STINK KART WARS

Open-world vehicle combat RPG in the browser — **fully playable**.

Stinky drives the Bandana Drifter across a ZeroVerse battlefield: quests, tanks, artillery, castles, stink weapons, and Warlord Reek.

## Play (local)

```bash
npm install
npm run dev
```

Open **http://localhost:8080**

| Control | Action |
|--------|--------|
| **W / S** | Gas / brake |
| **A / D** | Steer |
| **Q** | Stink Cloud |
| **E** | Ooze Overdrive |
| **R** | Sprint |
| **Space** | Hop |
| **Esc** | Pause |

Mobile: on-screen stick + action buttons.

**Tip:** Click the game canvas once so the browser captures keyboard focus.

## Build

```bash
npm run typecheck
npm run build
npm run preview   # serves production build on :8080
```

## Stack

- React 19 + TypeScript + Vite + TanStack Start
- Three.js (WebGL battlefield, vehicles, combat)
- Tailwind CSS v4
- Optional PGLite / Better Auth (gameplay does not require accounts)

## Security / OPSEC

- **No secrets** are committed. Use `.env.example` as a template only.
- Settings (keybinds, volume) store in **browser `localStorage`** only.
- Do not commit `.env`, tokens, or deploy credentials.
- Prefer a **private** remote if the campaign content is not public yet.

## License

Private project — all rights reserved unless you add a license.
