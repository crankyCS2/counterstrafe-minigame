import {
    SV, STATE, PlayerState, InputState, AttemptState, TIMING,
    P_VELOCITY, P_VELOCITY_Y, P_VISUAL_POS, P_VISUAL_POS_Y, P_PHASE, PHASE,
    IN_A, IN_D, IN_W, IN_S,
    A_ACTIVE, A_DIR, A_DIR_Y, A_START_MS, A_PEAK_SPEED,
    A_GAP_MS, A_OVERLAP_MS, A_COUNTER_MS, A_STOPPED_MS, A_OVERSHOOT_INTEGRAL,
    A_GAP_X_MS, A_GAP_Y_MS, A_OVERLAP_X_MS, A_OVERLAP_Y_MS,
} from './state.js';
import { abortAttempt }  from './logic.js';
import { tickLabFrame }  from './strafelab.js';

export function updatePhysics(dt, updateSidebarCallback) {
    let vx = PlayerState[P_VELOCITY];
    let vy = STATE.mode2D ? PlayerState[P_VELOCITY_Y] : 0;
    
    const prevAbsSpd = Math.hypot(vx, vy);

    // ── Source Engine friction ──
    const speed = Math.hypot(vx, vy);
    if (speed > 0) {
        const control  = Math.max(speed, SV.stopspeed);
        const drop     = control * SV.friction * dt;
        let newSpeed = Math.max(0, speed - drop);
        
        if (newSpeed !== speed) {
            newSpeed /= speed;
            vx *= newSpeed;
            vy *= newSpeed;
        }
    }

    // ── Source Engine acceleration ──
    let wishdirX = (InputState[IN_D] === 1 && InputState[IN_A] === 0) ?  1
                 : (InputState[IN_A] === 1 && InputState[IN_D] === 0) ? -1 : 0;
    let wishdirY = 0;
    
    if (STATE.mode2D) {
        wishdirY = (InputState[IN_S] === 1 && InputState[IN_W] === 0) ?  1
                 : (InputState[IN_W] === 1 && InputState[IN_S] === 0) ? -1 : 0;
    }

    // Normalize wishdir if magnitude > 1
    const wishdirMag = Math.hypot(wishdirX, wishdirY);
    if (wishdirMag > 0) {
        wishdirX /= wishdirMag;
        wishdirY /= wishdirMag;
        
        const currentSpeedInWishDir = vx * wishdirX + vy * wishdirY;
        const addSpeedCap = STATE.WPN.maxSpeed - currentSpeedInWishDir;
        
        if (addSpeedCap > 0) {
            let accelSpeed = SV.accelerate * STATE.WPN.maxSpeed * dt;
            accelSpeed = Math.min(accelSpeed, addSpeedCap);
            vx += accelSpeed * wishdirX;
            vy += accelSpeed * wishdirY;
        }
    }

    PlayerState[P_VELOCITY] = vx;
    if (STATE.mode2D) PlayerState[P_VELOCITY_Y] = vy;

    const absSpd = Math.hypot(vx, vy);

    switch (PlayerState[P_PHASE]) {
        case PHASE.IDLE:
            if (absSpd > 15) {
                PlayerState[P_PHASE]   = PHASE.STRAFING;
                AttemptState[A_ACTIVE] = 0;
            }
            break;

        case PHASE.STRAFING:
            if (AttemptState[A_ACTIVE] === 1) {
                AttemptState[A_PEAK_SPEED] = Math.max(AttemptState[A_PEAK_SPEED], absSpd);
            }
            if (prevAbsSpd >= STATE.MIN_ATTEMPT_SPEED && absSpd < prevAbsSpd - 0.5) {
                PlayerState[P_PHASE]              = PHASE.DECELERATING;
                AttemptState[A_ACTIVE]            = 1;
                AttemptState[A_START_MS]          = performance.now();
                AttemptState[A_PEAK_SPEED]        = prevAbsSpd;
                
                // Direction of peak speed
                if (absSpd > 0) {
                    AttemptState[A_DIR]   = PlayerState[P_VELOCITY] / absSpd;
                    AttemptState[A_DIR_Y] = STATE.mode2D ? (PlayerState[P_VELOCITY_Y] / absSpd) : 0;
                } else {
                    AttemptState[A_DIR] = 0;
                    AttemptState[A_DIR_Y] = 0;
                }
                
                AttemptState[A_GAP_MS]             = 0;
                AttemptState[A_OVERLAP_MS]         = 0;
                AttemptState[A_COUNTER_MS]         = 0;
                AttemptState[A_STOPPED_MS]         = 0;
                AttemptState[A_OVERSHOOT_INTEGRAL] = 0;
                AttemptState[A_GAP_X_MS]           = 0;
                AttemptState[A_GAP_Y_MS]           = 0;
                AttemptState[A_OVERLAP_X_MS]       = 0;
                AttemptState[A_OVERLAP_Y_MS]       = 0;
            }
            break;

        case PHASE.DECELERATING: {
            if (AttemptState[A_ACTIVE] === 0) {
                PlayerState[P_PHASE] = PHASE.IDLE;
                break;
            }
            const frameMs = dt * TIMING.MS_PER_SECOND;
            
            // Recompute wishdir from inputs (no normalization needed for dot sign check)
            let rawWishX = (InputState[IN_D] === 1 ? 1 : 0) - (InputState[IN_A] === 1 ? 1 : 0);
            let rawWishY = STATE.mode2D ? ((InputState[IN_S] === 1 ? 1 : 0) - (InputState[IN_W] === 1 ? 1 : 0)) : 0;
            
            const dot = rawWishX * AttemptState[A_DIR] + rawWishY * AttemptState[A_DIR_Y];

            // Axis-specific overlap/gap breakdown (for diagnostics in 2D drills)
            const dirX = AttemptState[A_DIR];
            const dirY = AttemptState[A_DIR_Y];
            const relX = Math.abs(dirX) > 0.05;
            const relY = STATE.mode2D && Math.abs(dirY) > 0.05;

            if (relX) {
                if (rawWishX === 0) AttemptState[A_GAP_X_MS] += frameMs;
                else if (Math.sign(rawWishX) === Math.sign(dirX)) AttemptState[A_OVERLAP_X_MS] += frameMs;
            }
            if (relY) {
                if (rawWishY === 0) AttemptState[A_GAP_Y_MS] += frameMs;
                else if (Math.sign(rawWishY) === Math.sign(dirY)) AttemptState[A_OVERLAP_Y_MS] += frameMs;
            }

            const activeMoveKeys = STATE.mode2D
                ? (InputState[IN_W] + InputState[IN_A] + InputState[IN_S] + InputState[IN_D])
                : (InputState[IN_A] + InputState[IN_D]);

            if (absSpd < 3) {
                AttemptState[A_STOPPED_MS] += frameMs;
            } else if (activeMoveKeys > 1 && Math.abs(dot) < 0.1) {
                // Holding multiple keys somewhat perpendicular (overlapping)
                AttemptState[A_OVERLAP_MS] += frameMs;
            } else if (rawWishX === 0 && rawWishY === 0) {
                AttemptState[A_GAP_MS]     += frameMs;
            } else if (dot < -0.1) {
                AttemptState[A_COUNTER_MS] += frameMs;
            } else if (dot > 0.1) {
                AttemptState[A_OVERLAP_MS] += frameMs; // Holding forward again/overlap
            } else {
                // Dead zone: single key at near-perpendicular angle (|dot| ≤ 0.1).
                // Treated as overlap since you haven't released all keys or counter-strafed.
                AttemptState[A_OVERLAP_MS] += frameMs;
            }

            if (absSpd > STATE.ACCURATE_THRESH) {
                AttemptState[A_OVERSHOOT_INTEGRAL] += (absSpd - STATE.ACCURATE_THRESH) * frameMs;
            }

            if (absSpd > STATE.ACCURATE_THRESH && AttemptState[A_PEAK_SPEED] >= STATE.MIN_ATTEMPT_SPEED) {
                if (absSpd > prevAbsSpd + 0.5) {
                    abortAttempt(performance.now(), absSpd, updateSidebarCallback);
                }
            }
            break;
        }
    }

    if (AttemptState[A_ACTIVE] === 1) {
        AttemptState[A_PEAK_SPEED] = Math.max(AttemptState[A_PEAK_SPEED], absSpd);
    }

    // Lab mode per-frame metrics - uses true 2D velocity
    tickLabFrame(dt, vx, vy);

    // Visual smoothing
    const MAX_DISP = 148;
    const targetX = (PlayerState[P_VELOCITY] / STATE.WPN.maxSpeed) * MAX_DISP;
    const targetY = STATE.mode2D ? ((PlayerState[P_VELOCITY_Y] / STATE.WPN.maxSpeed) * MAX_DISP) : 0;
    
    PlayerState[P_VISUAL_POS] += (targetX - PlayerState[P_VISUAL_POS]) * Math.min(1, 9 * dt);
    PlayerState[P_VISUAL_POS_Y] += (targetY - PlayerState[P_VISUAL_POS_Y]) * Math.min(1, 9 * dt);
}
