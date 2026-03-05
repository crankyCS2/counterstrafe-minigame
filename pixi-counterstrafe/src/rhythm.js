import { RhythmState } from './state.js';
import { playClick }   from './audio.js';

// ===========================================================================
//  PRESETS
//  Each segment: { bars, num, denom, grouping[] }
//  grouping: sizes of beat groups within a measure.
//    e.g. [3,2,2] for 7/8 → accents at beat 0, 3, 5
// ===========================================================================
export const PRESETS = [
    {
        name: '7/8 Pulse',
        bpm: 140,
        segments: [{ bars: 4, num: 7, denom: 8, grouping: [3, 2, 2] }],
    },
    {
        name: '5+7 Cycle',
        bpm: 130,
        segments: [
            { bars: 2, num: 5, denom: 8, grouping: [3, 2] },
            { bars: 1, num: 7, denom: 8, grouping: [3, 2, 2] },
        ],
    },
    {
        name: '11/8 Dense',
        bpm: 120,
        segments: [{ bars: 2, num: 11, denom: 8, grouping: [3, 3, 3, 2] }],
    },
    {
        name: 'Asymmetric',
        bpm: 160,
        segments: [
            { bars: 3, num: 7, denom: 16, grouping: [3, 2, 2] },
            { bars: 2, num: 5, denom:  8, grouping: [3, 2] },
        ],
    },
    {
        name: 'Slow Odd',
        bpm: 72,
        segments: [
            { bars: 1, num: 5, denom: 4, grouping: [3, 2] },
            { bars: 1, num: 7, denom: 4, grouping: [3, 2, 2] },
        ],
    },
];

// ===========================================================================
//  SCHEDULE BUILDER
//  Converts segments + BPM into a flat array of timed beat events.
//  accent levels: 2 = main downbeat, 1 = sub-group start, 0 = regular beat
// ===========================================================================
export function buildSchedule() {
    const { bpm, segments } = RhythmState;
    const quarterMs = 60000 / bpm;
    const schedule  = [];
    let cursor = 0, measureNum = 0;

    for (const seg of segments) {
        // sub-beat duration relative to quarter note
        // denom=8 → eighth = quarterMs × (4/8) = quarterMs × 0.5
        const subBeatMs = quarterMs * (4 / seg.denom);
        const measureMs = subBeatMs * seg.num;

        // Build per-beat accent map for this time signature
        const accentMap = new Array(seg.num).fill(0);
        if (seg.grouping && seg.grouping.length) {
            let pos = 0;
            for (let g = 0; g < seg.grouping.length; g++) {
                if (pos < seg.num) accentMap[pos] = g === 0 ? 2 : 1;
                pos += seg.grouping[g];
            }
        } else {
            accentMap[0] = 2;
        }

        for (let bar = 0; bar < seg.bars; bar++) {
            for (let beat = 0; beat < seg.num; beat++) {
                schedule.push({
                    timeMs:         cursor + beat * subBeatMs,
                    accent:         accentMap[beat],
                    beatInMeasure:  beat,
                    measureNum:     measureNum + bar,
                    totalInMeasure: seg.num,
                });
            }
            cursor    += measureMs;
            measureNum++;
        }
    }

    RhythmState.schedule = schedule;
    RhythmState.cycleMs  = cursor;
}

export function startRhythm(now) {
    buildSchedule();
    RhythmState.active          = true;
    RhythmState.startMs         = now;
    RhythmState._lastFiredTimeMs = -1;
    RhythmState._flashBeatIndex  = -1;
}

export function stopRhythm() {
    RhythmState.active          = false;
    RhythmState._flashBeatIndex  = -1;
}

// ===========================================================================
//  TICK  — called every RAF frame
//  Fires clicks for any beats that elapsed past since last frame.
//  Handles cycle wraparound without drift.
// ===========================================================================
export function updateRhythm(now) {
    if (!RhythmState.active || RhythmState.cycleMs <= 0) return;

    const elapsed = (now - RhythmState.startMs) % RhythmState.cycleMs;

    // Detect cycle wraparound: reset last-fired when elapsed jumps back
    if (RhythmState._lastFiredTimeMs > 0 &&
        elapsed < RhythmState._lastFiredTimeMs - RhythmState.cycleMs * 0.5) {
        RhythmState._lastFiredTimeMs = -1;
    }

    for (let i = 0; i < RhythmState.schedule.length; i++) {
        const beat = RhythmState.schedule[i];
        if (beat.timeMs > RhythmState._lastFiredTimeMs && beat.timeMs <= elapsed) {
            playClick(beat.accent, RhythmState.volume);
            RhythmState._lastFiredTimeMs = beat.timeMs;
            RhythmState._flashBeatIndex  = i;
            RhythmState._flashStartMs    = now;
        }
    }
}
