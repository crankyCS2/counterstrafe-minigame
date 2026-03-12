import { InputState, IN_A, IN_D, IN_W, IN_S, IN_FIRE_LATCH } from './state.js';
import { initAudio } from './audio.js';

const W_KEYS = new Set(['w', 'arrowup']);
const A_KEYS = new Set(['a', 'arrowleft']);
const S_KEYS = new Set(['s', 'arrowdown']);
const D_KEYS = new Set(['d', 'arrowright']);

export function initInput(canvasElement, refreshUI, fireCallback) {
    document.addEventListener('keydown', e => {
        if (e.repeat) return;
        const k = e.key.toLowerCase();

        // Unlock AudioContext on first gesture
        initAudio();

        if (W_KEYS.has(k)) {
            InputState[IN_W] = 1;
            refreshUI();
            e.preventDefault();
        } else if (A_KEYS.has(k)) {
            InputState[IN_A] = 1;
            refreshUI();
            e.preventDefault();
        } else if (S_KEYS.has(k)) {
            InputState[IN_S] = 1;
            refreshUI();
            e.preventDefault();
        } else if (D_KEYS.has(k)) {
            InputState[IN_D] = 1;
            refreshUI();
            e.preventDefault();
        } else if (k === ' ') {
            e.preventDefault();
            InputState[IN_FIRE_LATCH] = 1;
            fireCallback();
        }
    });

    document.addEventListener('keyup', e => {
        const k = e.key.toLowerCase();
        if (W_KEYS.has(k)) { InputState[IN_W] = 0; refreshUI(); e.preventDefault(); }
        else if (A_KEYS.has(k)) { InputState[IN_A] = 0; refreshUI(); e.preventDefault(); }
        else if (S_KEYS.has(k)) { InputState[IN_S] = 0; refreshUI(); e.preventDefault(); }
        else if (D_KEYS.has(k)) { InputState[IN_D] = 0; refreshUI(); e.preventDefault(); }
    });

    if (canvasElement) {
        canvasElement.addEventListener('mousedown', e => {
            if (e.button === 0) {
                initAudio();
                InputState[IN_FIRE_LATCH] = 1;
                fireCallback();
            }
        });
    }
}
