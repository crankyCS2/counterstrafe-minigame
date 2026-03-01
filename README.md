# CS2 Counter-Strafe Trainer

A browser-based training tool for practicing counter-strafing in Counter-Strike 2. It simulates Source Engine movement physics and measures your timing with per-attempt breakdowns of deceleration method, duration, and accuracy.

> **AI Disclosure:** This program was written with the assistance of Claude (Anthropic). The physics model, state machine architecture, and shot classification logic were designed collaboratively between a human and an AI. The code is licensed under the Mozilla Public License 2.0.

---

## Usage

The tool is a single HTML file with no dependencies beyond a Google Fonts stylesheet loaded from CDN. Open it in any modern browser.

**Controls:**

- `A` / `Left Arrow` -- strafe left
- `D` / `Right Arrow` -- strafe right
- `Left Click` on the canvas, or `Space` -- shoot

**The basic drill:**

1. Hold a direction key until the character reaches full speed.
2. Tap the opposite direction key briefly, then release it.
3. Click or press Space to shoot as soon as the character slows down.
4. Read the result in the sidebar history and adjust your timing.

**Reading the sidebar:**

The live data panel at the top of the sidebar shows your current speed, phase, last shot result, total deceleration time, and counter-strafe duration. The averages section accumulates statistics across all attempts in the session. The history list shows the last 50 shots with per-attempt breakdowns.

**Result grades:**

| Label | Total decel time | Meaning |
|---|---|---|
| Perfect | 0 - 80 ms | Clean counter-strafe, shot at earliest accurate window |
| Good | 81 - 100 ms | Solid counter-strafe with minor delay |
| OK | 101 - 130 ms | Acceptable, room to improve |
| Slow | 131 - 180 ms | Some counter-strafe but delayed shot |
| Coasted | 181 ms - coast benchmark | Reached accuracy through friction, not counter-strafing |
| Too Slow | above coast benchmark | Took longer than doing nothing at all |
| Moving | any | Shot fired above 73 u/s, inaccurate |
| Changed Dir | any | Velocity rebuilt past threshold before shooting; counted as a direction change, not an attempt |

The **bench strip** below the live grid shows the analytically computed benchmarks for the selected weapon: how long a pure counter-strafe takes to reach accuracy, and how long coasting takes.

---

## How It Works

### Physics

The physics model replicates the Source Engine movement equations used in CS2. Each frame, two passes run in order.

**Friction pass** (always applied first):

```
control  = max(speed, stopspeed)   // stopspeed = 80
drop     = control * friction * dt // friction = 5.2
newSpeed = max(0, speed - drop)
velocity = velocity * (newSpeed / speed)
```

The `stopspeed` constant means that at low speeds the friction force is boosted as if the character were moving at 80 u/s minimum. This causes deceleration to slow down noticeably as you approach zero, which is why coasting takes disproportionately long for the last few units of speed.

**Acceleration pass** (applied after friction, only when a key is held):

```
wishdir      = direction of held key
speedInWish  = dot(velocity, wishdir)
addspeed     = min(accelerate * maxSpeed * dt, maxSpeed - speedInWish)
velocity    += wishdir * addspeed
```

`accelerate = 5.5`. When `wishdir` opposes the current velocity direction, `speedInWish` is negative, so the allowed `addspeed` budget is larger than when accelerating in the same direction. This is what makes counter-strafing faster than friction alone.

### State Machine

The state machine has three phases: `IDLE`, `STRAFING`, and `DECELERATING`. Crucially, phase transitions are driven entirely by the velocity value computed each frame, not by key events. Key event handlers only flip two boolean flags (`keys.a`, `keys.d`). This avoids an entire class of bugs where out-of-order or stale key events corrupt the phase state.

```
IDLE           -- |velocity| <= 15 u/s, no active attempt
  |
  | velocity rises above 15
  v
STRAFING       -- velocity building or cruising
  |
  | velocity drops by more than 0.5 u/s in a single frame
  | AND peak speed was >= MIN_ATTEMPT_SPEED (85 u/s)
  v
DECELERATING   -- deceleration in progress, attempt accumulates timing
  |             |
  |             | velocity rebuilds above ACCURATE_THRESH (73 u/s)
  |             | AND speed is increasing frame-over-frame
  |             v
  |           STRAFING  (abort logged as "Changed Dir")
  |
  | fireShot() called
  v
IDLE           (attempt logged, attempt object cleared)
```

After a shot, `phase` is reset to `IDLE` and `attempt` is set to `null`. The physics loop will transition back to `STRAFING` naturally on the next frame if a key is still held, without any special post-shot handling. This is intentional: it avoids the stale-keyup corruption problem that plagued earlier event-driven implementations.

### Attempt Object

When the transition from `STRAFING` to `DECELERATING` occurs, `makeAttempt()` creates a plain object:

```js
{
  decelStartAt: now,       // timestamp, used to compute totalDecelMs
  peakSpeed:    absSpd,    // speed at moment decel began
  dir:          sign(vel), // -1 for left, 1 for right
  gapMs:      0,           // time with neither key held
  overlapMs:  0,           // time with both keys held simultaneously
  counterMs:  0,           // time with only the counter key held
  stoppedMs:  0,           // time with velocity < 3 u/s
}
```

Each frame inside `DECELERATING`, the current key state is inspected and the appropriate timer is incremented by `dt * 1000`. This is simple and correct because timing accumulation happens in the same place as physics -- the game loop -- not scattered across asynchronous event handlers.

### Shot Classification

`classify(speed, totalDecelMs)` runs when the player fires. It takes the current speed and elapsed milliseconds since `decelStartAt`. It does not read the attempt object directly (except for `peakSpeed` to filter out non-attempts) so that the logic remains a pure function of two numbers and is easy to test or adjust.

`COAST_MS` and `CS_MS` are computed analytically from the Source Engine constants at startup by `computeCoastMs()` and `computeCsMs()`. These benchmarks update automatically if you add new weapons or change the physics constants.

### Rendering

The canvas is resized via a `ResizeObserver` to stay pixel-perfect at any DPR. The teardrop character shape is drawn with bezier curves in `drawTear()`: the pointiness and stretch are proportional to `(absSpeed / maxSpeed) ^ 0.58`, giving a perceptually even squish curve. Color interpolates from green (accurate) through neutral grey to orange (full speed) via `getColor()`.

`visualPos` is a smoothed copy of the true physics position, updated each frame with a lerp: `visualPos += (target - visualPos) * min(1, 9 * dt)`. This decouples the visual character position from the physics simulation so the character feels responsive without teleporting.

---

## Code Structure

The file is a single self-contained HTML file. All logic is in one `<script>` block, organized into clearly labeled sections.

| Section | Lines (approx.) | Purpose |
|---|---|---|
| CSS | top of file | Layout, velocity bar, WASD widget, sidebar, history rows |
| `SV` constant | ~206 | Source Engine physics constants |
| `WEAPONS` / `WPN` | ~215 | Weapon max speed table and active weapon pointer |
| `computeCoastMs` / `computeCsMs` | ~226 | Analytical benchmark calculations |
| `recomputeBenchmarks` | ~247 | Populates bench strip and threshold markers in the velocity bar |
| State variables | ~264 | `velocity`, `keys`, `phase`, `attempt`, `feedback`, `history` |
| `makeAttempt` | ~286 | Factory for a fresh attempt timing object |
| Input handlers | ~298 | `keydown` / `keyup` -- flip booleans only, no state logic |
| `fireShot` | ~331 | Snapshot attempt, run classify, log record, reset state |
| `classify` | ~367 | Pure function mapping (speed, totalDecelMs) to a result label |
| `updatePhysics` | ~397 | Source Engine friction + acceleration + velocity-driven state machine |
| `render` | ~540 | Canvas draw, velocity bar DOM update, live data DOM update |
| `refreshKeyUI` | ~622 | Toggles `.on` class on WASD key elements |
| `updateSidebar` | ~629 | Pushes a record into the live grid and calls `computeAverages` |
| `computeAverages` | ~653 | Aggregates history array into the averages section |
| `prependRow` | ~690 | Creates and inserts a history row DOM element |
| `initVelBar` | ~747 | Creates threshold marker elements in the velocity bar |
| Game loop | ~758 | `requestAnimationFrame` loop calling `updatePhysics` then `render` |

### Adding a Weapon

Add an entry to the `WEAPONS` object and change `WPN` to point at it:

```js
const WEAPONS = {
  ak47:  { name:'AK-47', maxSpeed: 221 },
  sg553: { name:'SG-553', maxSpeed: 210 },  // new entry
};
let WPN = WEAPONS.sg553;
```

Call `recomputeBenchmarks()` after changing `WPN` if you want to switch weapons at runtime.

### Adjusting Grade Thresholds

The time buckets in `classify()` are plain numeric comparisons in milliseconds against `totalDecelMs`. They are independent of the physics constants and can be tuned freely.

### Changing Physics Constants

Edit the `SV` object. `recomputeBenchmarks()` will recalculate `COAST_MS` and `CS_MS` on the next call (it is called once at boot). If you change constants at runtime, call `recomputeBenchmarks()` again to keep the benchmarks accurate.

---

## License

Mozilla Public License 2.0.
