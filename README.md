# pixi-counterstrafe

CS2 movement trainer built with PIXI.js and a data-oriented architecture. The app focuses on counter-strafe timing, reaction drills, lab-style movement sessions, and rhythm-based strafe practice.

## Quick start

### Prerequisites
- Node.js 18+
- npm

### Install
```bash
git clone <repository-url>
cd counterstrafe-minigame
npm install
```

### Run locally
```bash
npm run dev
```

This README is intentionally focused on local development and validation for contributors.

### Production build
```bash
npm run build
npm run preview
```

## What is in this version

- Five playable modes: **Freestyle**, **Time to Shot**, **Strafe Lab**, **Micro-Strafe**, and **Rhythm**.
- Shared typed-array state for high-frequency updates and low GC churn.
- Source-style movement constants and acceleration/friction model.
- Sidebar analytics for attempts, decel quality, averages, and symmetry.
- CSV export for regular history and lab sessions.

## Gameplay summary by mode

### Freestyle
Core counter-strafe drill. Build lateral speed, counter with the opposite key, then shoot at or below the accurate threshold (73 u/s).

### Time to Shot
Reaction scenario. The arena arms, then flashes after a random delay. You are scored on time from cue to accurate shot. Shots before cue are logged as false starts.

### Strafe Lab
Wide-peek training format. Complete a distance quota quickly while landing accurate shots. Session results include completion time, shot accuracy, average speed at shot, and shot spread.

### Micro-Strafe
Low-speed ADAD drill. Stay evasive while avoiding threshold overshoots. Includes realistic time-to-ready and inaccurate-distance metrics, and lets you drag the arena circle to reposition.

### Rhythm
Polyrhythmic timing trainer with presets and custom segment editing. Reverse direction on accents and stay on sub-beats/fill to build less readable movement cadence.

## Controls

- **Move:** `A/D` or `Left/Right Arrow`
- **Shoot:** `Left Click` or `Space`
- **Micro-Strafe circle reposition:** drag with mouse

## Architecture overview

- `src/state.js`: constants, typed-array buffers, shared mode/session state, weapon data.
- `src/physics.js`: movement update and attempt phase transitions.
- `src/logic.js`: shot resolution, scoring/classification, history + TTS tracking.
- `src/strafelab.js`: Strafe Lab and Micro-Strafe session lifecycle + metrics.
- `src/rhythm.js`: rhythm presets, schedule generation, metronome tick/update.
- `src/renderer.js`: PIXI scene setup and all arena visuals.
- `src/ui.js`: sidebar rendering, summaries, config controls, CSV export.
- `src/input.js` and `src/audio.js`: input bindings and rhythm click audio.
- `src/main.js`: app boot, mode switching, panel wiring, and frame loop.

## Development notes

1. Keep hot-path state in existing typed arrays where possible.
2. Keep concerns separated by module: physics/logic/renderer/ui.
3. When adding a mode-specific metric, wire both runtime state and UI output.
4. Verify mode switching and CSV export after any scoring or state changes.
5. Use `npm run dev` for local iteration and `npm run build` before opening a PR.

## License

Project code is licensed under the Mozilla Public License 2.0.
