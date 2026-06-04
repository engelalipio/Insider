# Inside — A 2D Platformer Demo

A dark, atmospheric side-scrolling platformer inspired by Playdead's *Inside*. Built with React + Phaser 3, deployable to iOS via Capacitor.

![Game Screenshot](https://via.placeholder.com/800x300/0a0a12/445566?text=inside+game)

---

## Features

- 🌲 Parallax forest backgrounds
- 👮 Guard AI with visible flashlight cones (patrol → alert → chase → return)
- 🧩 Lever & gate puzzle
- 💾 Checkpoints with fade-out respawn
- ☠️ Spike hazards + impact death particles
- 🌧️ Rain particles + ambient audio (Web Audio API)
- 🎮 Touch controls for mobile
- 📱 2 levels — transitions on completion
- 🍎 iOS-ready via Capacitor

---

## Project Structure

```
inside-game/
├── src/
│   ├── App.jsx                  # React wrapper
│   ├── App.css
│   ├── index.css
│   └── game/
│       ├── config.js            # Shared constants (gravity, speed, etc.)
│       ├── index.js             # Phaser game initializer
│       ├── AudioManager.js      # Web Audio API — drone, rain, SFX
│       ├── scenes/
│       │   ├── BootScene.js     # Procedurally generates all textures
│       │   ├── GameScene.js     # Level 1 — forest, lever/gate puzzle
│       │   └── Level2Scene.js   # Level 2 — darker, faster guards, exit door
│       └── entities/
│           ├── Player.js        # Movement, squash/stretch, death/respawn
│           └── Guard.js         # Patrol AI + flashlight cone rendering
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Controls

| Action | Keyboard | Mobile |
|--------|----------|--------|
| Move left | ← or A | ◀ button |
| Move right | → or D | ▶ button |
| Jump | ↑, W, or Space | ▲ button |

---

## Building for Production

```bash
npm run build
```

Output goes to `dist/`.

---

## iOS Deployment (Capacitor)

### First-time setup

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/ios

# Initialize (run once)
npx cap init "Inside Game" "com.yourname.insidegame"

# Build the web app
npm run build

# Add iOS platform
npx cap add ios
```

### Every subsequent deploy

```bash
npm run build
npx cap sync
npx cap open ios
```

Then in Xcode:
1. Select your device or simulator
2. Go to **General → Deployment Info**
3. Uncheck Portrait, keep **Landscape Left** and **Landscape Right** only
4. Hit **Run ▶**

### TestFlight

1. In Xcode, set your Team under **Signing & Capabilities**
2. Select **Any iOS Device** as the build target
3. **Product → Archive**
4. Upload via **Distribute App → TestFlight**

---

## Development Notes

### Adding a new level

1. Create `src/game/scenes/Level3Scene.js` (copy `Level2Scene.js` as a template)
2. Register it in `src/game/index.js`:
   ```js
   import { Level3Scene } from './scenes/Level3Scene.js';
   // ...
   scene: [BootScene, GameScene, Level2Scene, Level3Scene],
   ```
3. In the previous level's `_winGame()`, change `this.scene.start('Level2Scene')` to `'Level3Scene'`

### Updating game files

If you receive a `setup.sh` update script:

```bash
chmod +x setup.sh
./setup.sh
```

Then commit:

```bash
git add .
git commit -m "describe changes"
git push
```

### Audio

All audio is generated via the **Web Audio API** — no audio files needed. The `AudioManager` singleton (`src/game/AudioManager.js`) handles:

- `startAmbient()` / `stopAmbient()` — eerie drone
- `startRain()` / `stopRain()` — rain noise
- `playFootstep()`, `playJump()`, `playDeath()`, `playCheckpoint()`, `playLever()`, `playWin()`

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| [Phaser 3](https://phaser.io/) | 2D game engine |
| [React](https://react.dev/) | App shell / UI wrapper |
| [Vite](https://vitejs.dev/) | Build tool |
| [Capacitor](https://capacitorjs.com/) | iOS packaging |
| Web Audio API | All sound effects |

---

## Roadmap

- [ ] Animated player sprite (run/jump frames)
- [ ] Level 3 — underground cave with darkness/spotlight mechanic
- [ ] Water hazard sections
- [ ] Environmental storytelling (bodies, cages, props)
- [ ] Speedrun timer
- [ ] Haptic feedback on mobile (death, checkpoint)

---

## License

MIT
