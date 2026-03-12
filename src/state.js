// ===========================================================================
//  DOD MEMORY LAYOUT
// ===========================================================================

export const SV = {
    friction: 5.2,
    stopspeed: 80,
    accelerate: 5.5,
};

export const TIMING = {
    MS_PER_SECOND: 1000,
    MAX_FRAME_TIME: 0.05,
    TTK_MIN_DELAY_MS: 1500,
    TTK_MAX_DELAY_MS: 10000,
    TTK_RANDOM_RANGE_MS: 8500,
};

export const WEAPONS = {
    knife:  { id: 'knife',  name: 'Knife',         maxSpeed: 250 },
    deagle: { id: 'deagle', name: 'Desert Eagle',   maxSpeed: 230 },
    m4a4:   { id: 'm4a4',   name: 'M4A4',           maxSpeed: 225 },
    m4a1s:  { id: 'm4a1s',  name: 'M4A1-S',         maxSpeed: 225 },
    ak47:   { id: 'ak47',   name: 'AK-47',          maxSpeed: 215 },
    famas:  { id: 'famas',  name: 'FAMAS',          maxSpeed: 220 },
    galil:  { id: 'galil',  name: 'Galil AR',       maxSpeed: 215 },
    awp:    { id: 'awp',    name: 'AWP (Unscoped)', maxSpeed: 200 },
};

export const MODE = {
    FREESTYLE:   'freestyle',
    TTK:         'ttk',
    STRAFELAB:   'strafelab',    // wide-peek: run distance fast, shoot at threshold
    MICROSTRAFE: 'microstrafe',  // micro-movement: stay below threshold, coast cleanly
    RHYTHM:      'rhythm',
};

export const STATE = {
    WPN: WEAPONS.ak47,
    ACCURATE_THRESH: 73,
    MIN_ATTEMPT_SPEED: 85,
    COAST_MS: 0,
    CS_MS: 0,
    currentMode: MODE.FREESTYLE,
    mode2D: false,
};

// TTK mode state
export const TTKState = {
    armed: false,
    cueVisible: false,
    cueSpawnMs: 0,
    delayMs: 0,
    elapsedMs: 0,
    ttsMs: 0,
};

export const PHASE = { IDLE: 0, STRAFING: 1, DECELERATING: 2 };

// ── PlayerState ──
export const P_VELOCITY   = 0;
export const P_VELOCITY_Y = 1;
export const P_VISUAL_POS = 2; // X
export const P_VISUAL_POS_Y = 3;
export const P_PHASE      = 4;
export const PlayerState  = new Float32Array(5);
PlayerState[P_PHASE] = PHASE.IDLE;

// ── InputState ──
export const IN_A          = 0;
export const IN_D          = 1;
export const IN_W          = 2;
export const IN_S          = 3;
export const IN_FIRE_LATCH = 4;
export const InputState    = new Uint8Array(5);

// ── AttemptState ──
export const A_ACTIVE             = 0;
export const A_START_MS           = 1;
export const A_PEAK_SPEED         = 2;
export const A_DIR                = 3; // X dir (legacy) or 2D dir X
export const A_DIR_Y              = 4;
export const A_GAP_MS             = 5;
export const A_OVERLAP_MS         = 6;
export const A_COUNTER_MS         = 7;
export const A_STOPPED_MS         = 8;
export const A_OVERSHOOT_INTEGRAL = 9;
export const A_GAP_X_MS           = 10;
export const A_GAP_Y_MS           = 11;
export const A_OVERLAP_X_MS       = 12;
export const A_OVERLAP_Y_MS       = 13;
export const AttemptState         = new Float64Array(14);

export const HISTORY_MAX      = 50;
export const HistoryFreestyle = [];
export const HistoryTTK       = [];

export const SessionLogFreestyle  = [];
export const SessionLogTTK        = [];
export const SessionLogStrafeLab  = [];  // summary per completed SL session
export const SessionLogMicroStrafe = [];

export const Feedback = { active: false, label: '', color: '', startMs: 0 };

// ===========================================================================
//  SHARED LAB CONFIG (used by both StrafeLab and MicroStrafe)
//  Each mode reads from its own object but the UI binds to these helpers.
// ===========================================================================

function makeLabState() {
    return {
        active:    false,
        quotaUnits: 400,
        quotaShots: 5,
        direction: 'right',   // 'left' | 'right'
        // progress
        accumulatedUnits: 0,
        completedShots:   0,
        startMs:          0,
        // shot records [{speed, wasAccurate, quotaFraction}]
        shotEvents: [],
        // per-strafe cs quality — for MicroStrafe RTR and general strafe log
        // [{csMs, gapMs, overlapMs, stoppedMs}]
        attemptLog: [],
        // per-frame direction-correct distance breakdown
        totalDistanceUnits:      0,
        inaccurateDistanceUnits: 0,
        // MTR
        mtrSum:     0,
        mtrSamples: 0,
        // per-strafe efficiency accumulators
        _prevVelocitySign:    0,
        _strafeAccurateUnits: 0,
        _strafeInaccurateMs:  0,
        strafeLog: [],  // [{accurateUnits, inaccurateMs}]
    };
}

export const StrafeLab   = makeLabState();
export const MicroStrafe = makeLabState();

// ===========================================================================
//  SYMMETRY LOG  (global rolling window, all modes)
// ===========================================================================
export const SymmetryLog = {
    // speedAtShot:  speed (u/s) when shot fired
    // oneAtTimePct: % of decel window that was pure counter-key
    left:  [],   // [{speedAtShot, oneAtTimePct}]
    right: [],
    MAX:   150,
};

// ===========================================================================
//  RHYTHM
// ===========================================================================
export const RhythmState = {
    active: false,
    bpm:    140,
    volume: 0.7,
    segments: [
        { bars: 4, num: 7, denom: 8, grouping: [3, 2, 2] },
    ],
    schedule: [],
    cycleMs:  0,
    startMs:  0,
    _lastFiredTimeMs: -1,
    _flashBeatIndex:  -1,
    _flashStartMs:     0,
};

// ===========================================================================
//  UTILITIES
// ===========================================================================

export function recomputeBenchmarks() {
    const maxSpeed = STATE.WPN.maxSpeed;

    let t1 = 0, v1 = maxSpeed;
    const v_thresh = Math.max(SV.stopspeed, STATE.ACCURATE_THRESH);
    if (v1 > v_thresh) { t1 += Math.log(v1 / v_thresh) / SV.friction; v1 = v_thresh; }
    if (v1 > STATE.ACCURATE_THRESH) { t1 += (v1 - STATE.ACCURATE_THRESH) / (SV.friction * SV.stopspeed); }
    STATE.COAST_MS = t1 * TIMING.MS_PER_SECOND;

    const A  = SV.accelerate * maxSpeed / SV.friction;
    const t2 = -Math.log((STATE.ACCURATE_THRESH + A) / (maxSpeed + A)) / SV.friction;
    STATE.CS_MS = t2 * TIMING.MS_PER_SECOND;
}

/**
 * Milliseconds until accurate if the player counter-strafes right now.
 * Uses the CS acceleration model. Returns 0 when already accurate.
 */
export function estimatedMsToAccurate(absV) {
    if (absV <= STATE.ACCURATE_THRESH) return 0;
    const A = SV.accelerate * STATE.WPN.maxSpeed / SV.friction;
    const t = -Math.log((STATE.ACCURATE_THRESH + A) / (absV + A)) / SV.friction;
    return Math.max(0, t * 1000);
}

/**
 * Realistic Time to Ready — weighted average of CS_MS and COAST_MS
 * based on the player's own technique distribution.
 * oneAtTimePct: 0–100, fraction of decel window spent with only the counter key.
 */
export function realisticTimeToReady(oneAtTimePct) {
    const p = Math.max(0, Math.min(100, oneAtTimePct)) / 100;
    return Math.round(STATE.CS_MS * p + STATE.COAST_MS * (1 - p));
}

// ===========================================================================
//  MICRO-STRAFE POSITION VISUALS
//  Tracks the actual pixel position of the ball in Micro-Strafe mode.
//  Updated every frame in main.js; read by renderer.js.
// ===========================================================================
export const MicroStrafeVisuals = {
    x:          null,   // null = spawn at centre on next frame
    y:          null,   // null = spawn at centre on next frame
    isDragging: false,
    isHovered:  false,
    _dragOffsetX: 0,
    _dragOffsetY: 0,
    _snapX:  false,     // true this frame = snapping to centre-X
    _snapY:  false,     // true this frame = snapping to centre-Y
    SNAP_RADIUS: 28,    // px from centre that triggers snap
    // Pixels per unit: set each frame from screen dimensions
    // 450 units ≈ centre-to-edge of arena
    UNITS_TO_HALF_ARENA: 450,
};
