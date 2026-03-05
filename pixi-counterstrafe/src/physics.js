import {
    SV, STATE, PlayerState, InputState, AttemptState, TIMING,
    P_VELOCITY, P_VISUAL_POS, P_PHASE, PHASE,
    IN_A, IN_D,
    A_ACTIVE, A_DIR, A_START_MS, A_PEAK_SPEED,
    A_GAP_MS, A_OVERLAP_MS, A_COUNTER_MS, A_STOPPED_MS, A_OVERSHOOT_INTEGRAL,
} from './state.js';
import { abortAttempt }  from './logic.js';
import { tickLabFrame }  from './strafelab.js';

export function updatePhysics(dt, updateSidebarCallback) {
    const prevVelocity = PlayerState[P_VELOCITY];
    const prevAbsSpd   = Math.abs(prevVelocity);

    // ── Source Engine friction ──
    if (Math.abs(PlayerState[P_VELOCITY]) > 0) {
        const control  = Math.max(Math.abs(PlayerState[P_VELOCITY]), SV.stopspeed);
        const drop     = control * SV.friction * dt;
        const newSpeed = Math.max(0, Math.abs(PlayerState[P_VELOCITY]) - drop);
        PlayerState[P_VELOCITY] = newSpeed === 0
            ? 0
            : PlayerState[P_VELOCITY] * (newSpeed / Math.abs(PlayerState[P_VELOCITY]));
    }

    // ── Source Engine acceleration ──
    const wishdir = (InputState[IN_D] === 1 && InputState[IN_A] === 0) ?  1
                  : (InputState[IN_A] === 1 && InputState[IN_D] === 0) ? -1 : 0;

    if (wishdir !== 0) {
        const speedInWish = PlayerState[P_VELOCITY] * wishdir;
        let addspeed = SV.accelerate * STATE.WPN.maxSpeed * dt;
        addspeed = Math.min(addspeed, STATE.WPN.maxSpeed - speedInWish);
        if (addspeed > 0) PlayerState[P_VELOCITY] += wishdir * addspeed;
    }

    const absSpd = Math.abs(PlayerState[P_VELOCITY]);

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
                AttemptState[A_PEAK_SPEED]        = Math.abs(PlayerState[P_VELOCITY]);
                AttemptState[A_DIR]               = Math.sign(PlayerState[P_VELOCITY]);
                AttemptState[A_GAP_MS]            = 0;
                AttemptState[A_OVERLAP_MS]        = 0;
                AttemptState[A_COUNTER_MS]        = 0;
                AttemptState[A_STOPPED_MS]        = 0;
                AttemptState[A_OVERSHOOT_INTEGRAL] = 0;
            }
            break;

        case PHASE.DECELERATING: {
            if (AttemptState[A_ACTIVE] === 0) {
                PlayerState[P_PHASE] = PHASE.IDLE;
                break;
            }
            const frameMs        = dt * TIMING.MS_PER_SECOND;
            const holdingOrig    = AttemptState[A_DIR] === -1 ? InputState[IN_A] === 1 : InputState[IN_D] === 1;
            const holdingCounter = AttemptState[A_DIR] === -1 ? InputState[IN_D] === 1 : InputState[IN_A] === 1;

            if (absSpd < 3) {
                AttemptState[A_STOPPED_MS] += frameMs;
            } else if (holdingOrig && holdingCounter) {
                AttemptState[A_OVERLAP_MS] += frameMs;
            } else if (!holdingOrig && !holdingCounter) {
                AttemptState[A_GAP_MS]     += frameMs;
            } else if (holdingCounter && !holdingOrig) {
                AttemptState[A_COUNTER_MS] += frameMs;
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

    // Lab mode per-frame metrics
    tickLabFrame(dt, PlayerState[P_VELOCITY]);

    // Visual smoothing
    const MAX_DISP = 148;
    const target   = (PlayerState[P_VELOCITY] / STATE.WPN.maxSpeed) * MAX_DISP;
    PlayerState[P_VISUAL_POS] += (target - PlayerState[P_VISUAL_POS]) * Math.min(1, 9 * dt);
}
