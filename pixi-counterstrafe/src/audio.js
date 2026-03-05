// ===========================================================================
//  Web Audio — click tone generator
//  Three accent levels: 0 = soft beat, 1 = medium accent, 2 = main accent
// ===========================================================================

let _ctx = null;

function getCtx() {
    if (!_ctx) _ctx = new AudioContext();
    return _ctx;
}

/** Call this inside any user-gesture handler to unlock the AudioContext. */
export function initAudio() {
    const c = getCtx();
    if (c.state === 'suspended') c.resume();
}

/**
 * @param {0|1|2} level   0 soft, 1 medium, 2 accent
 * @param {number} volume  0–1
 */
export function playClick(level = 0, volume = 0.7) {
    const c = getCtx();
    if (c.state === 'suspended') return;

    const osc = c.createOscillator();
    const env = c.createGain();
    osc.connect(env);
    env.connect(c.destination);

    // A4 / E5 / A5  — pure sine, stacks cleanly in the ear
    const freqs  = [440, 659, 880];
    const peaks  = [0.09, 0.18, 0.34];
    const decayS = [0.045, 0.058, 0.070];

    osc.type = 'sine';
    osc.frequency.value = freqs[level];

    const amp = peaks[level] * Math.max(0, Math.min(1, volume));
    const now = c.currentTime;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(amp, now + 0.003);   // 3 ms attack
    env.gain.exponentialRampToValueAtTime(0.0001, now + decayS[level]);
    osc.start(now);
    osc.stop(now + decayS[level] + 0.01);
}
