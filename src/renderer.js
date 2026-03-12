import * as PIXI from 'pixi.js';
import {
    STATE, PlayerState, P_VELOCITY, P_VELOCITY_Y, P_VISUAL_POS, P_VISUAL_POS_Y,
    Feedback, TTKState, RhythmState, MODE,
    MicroStrafeVisuals,
} from './state.js';

let app;
let tearGraphics;
let feedbackText;
let gridGraphics;
let ttkOverlay;
let rhythmGraphics;
let dragHintText;

const RhythmVisuals = {
    flashIdx:     -1,
    flashStartMs:  0,
    FLASH_DUR:   220,
};

export async function initRenderer(parentElement) {
    app = new PIXI.Application();
    await app.init({
        resizeTo:        parentElement,
        backgroundColor: 0x080a0c,
        antialias:       false,
        resolution:      window.devicePixelRatio || 1,
        autoDensity:     true,
    });
    parentElement.appendChild(app.canvas);

    gridGraphics   = new PIXI.Graphics(); app.stage.addChild(gridGraphics);
    ttkOverlay     = new PIXI.Graphics(); ttkOverlay.alpha = 0; app.stage.addChild(ttkOverlay);
    rhythmGraphics = new PIXI.Graphics(); rhythmGraphics.alpha = 0; app.stage.addChild(rhythmGraphics);
    tearGraphics   = new PIXI.Graphics(); app.stage.addChild(tearGraphics);

    feedbackText = new PIXI.Text({
        text: '',
        style: {
            fontFamily: ['JetBrains Mono', 'monospace'],
            fontSize: 24, fontWeight: '700',
            fill: 0xffffff, align: 'center',
        },
    });
    feedbackText.anchor.set(0.5);
    feedbackText.alpha = 0;
    app.stage.addChild(feedbackText);

    dragHintText = new PIXI.Text({
        text: 'drag to reposition',
        style: {
            fontFamily: ['JetBrains Mono', 'monospace'],
            fontSize: 9, fill: 0x3a4248, align: 'center',
            letterSpacing: 1,
        },
    });
    dragHintText.anchor.set(0.5, 0);
    dragHintText.alpha = 0;
    app.stage.addChild(dragHintText);

    drawGrid();
    window.addEventListener('resize', () => { drawGrid(); });
    return app;
}

export function getApp() { return app; }
export function getScreenSize() {
    return app ? { W: app.screen.width, H: app.screen.height } : { W: 0, H: 0 };
}

// ── Background grid ──
function drawGrid() {
    if (!app) return;
    const W = app.screen.width, H = app.screen.height;
    const cx = W * 0.5, cy = H * 0.5;
    gridGraphics.clear();
    const gs = 48;
    for (let x = cx % gs; x < W; x += gs) { gridGraphics.moveTo(x, 0); gridGraphics.lineTo(x, H); }
    for (let y = cy % gs; y < H; y += gs) { gridGraphics.moveTo(0, y); gridGraphics.lineTo(W, y); }
    gridGraphics.stroke({ width: 1, color: 0x0e1214 });
    // Centre cross
    gridGraphics.moveTo(cx - 18, cy); gridGraphics.lineTo(cx + 18, cy);
    gridGraphics.moveTo(cx, cy - 18); gridGraphics.lineTo(cx, cy + 18);
    gridGraphics.stroke({ width: 1, color: 0x161c20 });
}

// ── TTK cue overlay ──
function drawTTKOverlay() {
    if (!app) return;
    const W = app.screen.width, H = app.screen.height;
    ttkOverlay.clear();
    ttkOverlay.rect(0, 0, W, H);
    ttkOverlay.fill({ color: 0x00e5ff, alpha: 0.07 });
}

// ── Colour by speed (green=accurate → orange=max speed) ──
function getColor(absV) {
    if (absV <= STATE.ACCURATE_THRESH)
        return lerpRGB([34,197,94], [200,212,218], absV / STATE.ACCURATE_THRESH);
    return lerpRGB([200,212,218], [249,115,22],
        (absV - STATE.ACCURATE_THRESH) / (STATE.WPN.maxSpeed - STATE.ACCURATE_THRESH));
}
function lerpRGB(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    return (~~(a[0]+(b[0]-a[0])*t)<<16) + (~~(a[1]+(b[1]-a[1])*t)<<8) + ~~(a[2]+(b[2]-a[2])*t);
}
function lighten(colorNum, amt) {
    const r=(colorNum>>16)&255, g=(colorNum>>8)&255, b=colorNum&255;
    return (Math.min(255,~~(r+(255-r)*amt))<<16)+(Math.min(255,~~(g+(255-g)*amt))<<8)+Math.min(255,~~(b+(255-b)*amt));
}

// ── Tear-drop shape for freestyle/ttk ──
function drawTearShape(g, cx, cy, R, vx, vy) {
    const absV = Math.hypot(vx, vy);
    if (absV < 2) { g.circle(cx, cy, R); return; }
    
    // Calculate angle of movement
    const angle = Math.atan2(vy, vx);

    // Deformation amount based on speed
    const t = Math.pow(absV / STATE.WPN.maxSpeed, 0.58);
    
    // Local coordinates (before rotation)
    // Positive X is the direction of travel
    const localFrontX = R * (1 + 0.60 * t);
    const localBackX  = -R * (1 - 0.10 * t);
    const localSX     = R * 0.02 * t;
    const h           = R * (1 - 0.30 * t);
    
    // Rotate a local frame coordinate to global position
    const rotX = (lx, ly) => cx + lx * Math.cos(angle) - ly * Math.sin(angle);
    const rotY = (lx, ly) => cy + lx * Math.sin(angle) + ly * Math.cos(angle);

    // Front tip
    const frontX = rotX(localFrontX, 0);
    const frontY = rotY(localFrontX, 0);

    // Back end
    const backX = rotX(localBackX, 0);
    const backY = rotY(localBackX, 0);
    
    // Side points (top and bottom in local coords)
    const topX = rotX(localSX, -h);
    const topY = rotY(localSX, -h);
    const botX = rotX(localSX, h);
    const botY = rotY(localSX, h);

    // Control points for bezier (local coordinates)
    const cpFrontTopLx = localFrontX; const cpFrontTopLy = -h * 0.50;
    const cpTopFrontLx = localSX + R * 0.38; const cpTopFrontLy = -h;
    
    const cpTopBackLx  = localSX - R * 0.52; const cpTopBackLy  = -h;
    const cpBackTopLx  = localBackX;         const cpBackTopLy  = -h * 0.18;
    
    const cpBackBotLx  = localBackX;         const cpBackBotLy  = h * 0.18;
    const cpBotBackLx  = localSX - R * 0.52; const cpBotBackLy  = h;
    
    const cpBotFrontLx = localSX + R * 0.38; const cpBotFrontLy = h;
    const cpFrontBotLx = localFrontX;        const cpFrontBotLy = h * 0.50;

    g.moveTo(frontX, frontY);
    g.bezierCurveTo(
        rotX(cpFrontTopLx, cpFrontTopLy), rotY(cpFrontTopLx, cpFrontTopLy), 
        rotX(cpTopFrontLx, cpTopFrontLy), rotY(cpTopFrontLx, cpTopFrontLy), 
        topX, topY
    );
    g.bezierCurveTo(
        rotX(cpTopBackLx, cpTopBackLy), rotY(cpTopBackLx, cpTopBackLy), 
        rotX(cpBackTopLx, cpBackTopLy), rotY(cpBackTopLx, cpBackTopLy), 
        backX, backY
    );
    g.bezierCurveTo(
        rotX(cpBackBotLx, cpBackBotLy), rotY(cpBackBotLx, cpBackBotLy), 
        rotX(cpBotBackLx, cpBotBackLy), rotY(cpBotBackLx, cpBotBackLy), 
        botX, botY
    );
    g.bezierCurveTo(
        rotX(cpBotFrontLx, cpBotFrontLy), rotY(cpBotFrontLx, cpBotFrontLy), 
        rotX(cpFrontBotLx, cpFrontBotLy), rotY(cpFrontBotLx, cpFrontBotLy), 
        frontX, frontY
    );
}

// ── Drag handle: 4-direction move icon ──
function drawDragHandle(g, cx, cy, hovered, dragging) {
    const col   = (hovered || dragging) ? 0x6fb3ff : 0x2a3840;
    const alpha = (hovered || dragging) ? 0.95 : 0.45;
    const arm   = 11; // tip distance from center
    const base  = 4;  // half-width of arrowhead base

    // 4 filled triangles pointing N/S/E/W
    const dirs = [[0,-1],[0,1],[1,0],[-1,0]];
    dirs.forEach(([dx, dy]) => {
        const px = [dx, dy]; // perpendicular
        const tip  = [cx + dx*arm,        cy + dy*arm];
        const bl   = [cx + dx*(arm-6) + dy*base,  cy + dy*(arm-6) - dx*base];
        const br   = [cx + dx*(arm-6) - dy*base,  cy + dy*(arm-6) + dx*base];
        g.poly([tip[0], tip[1], bl[0], bl[1], br[0], br[1]]);
        g.fill({ color: col, alpha });
    });

    // Centre dot
    g.circle(cx, cy, 2);
    g.fill({ color: col, alpha });
}

// ── Snap guidelines (shown while dragging near centre) ──
function drawSnapGuides(g) {
    if (!app) return;
    const W = app.screen.width, H = app.screen.height;
    if (MicroStrafeVisuals._snapX) {
        g.moveTo(W*0.5, 0); g.lineTo(W*0.5, H);
        g.stroke({ width: 1, color: 0x2a7fff, alpha: 0.15 });
    }
    if (MicroStrafeVisuals._snapY) {
        g.moveTo(0, H*0.5); g.lineTo(W, H*0.5);
        g.stroke({ width: 1, color: 0x2a7fff, alpha: 0.15 });
    }
}

// ── Rhythm beat grid ──
function drawRhythmGrid(ts) {
    rhythmGraphics.clear();
    if (!RhythmState.active || !RhythmState.schedule.length) {
        rhythmGraphics.alpha = 0; return;
    }
    rhythmGraphics.alpha = 1;

    const W     = app.screen.width, H = app.screen.height;
    const Y     = H - 60;
    const sched = RhythmState.schedule;
    const n     = sched.length;

    // Measure gap count
    let nGaps = 0;
    sched.forEach((b, i) => { if (i > 0 && b.beatInMeasure === 0) nGaps++; });
    const totalW = W * 0.68;
    const startX = (W - totalW) * 0.5;
    const gapW   = 8;
    const dotArea = totalW - nGaps * gapW;
    const spacing = n > 1 ? dotArea / (n - 1) : 0;

    if (RhythmState._flashBeatIndex !== RhythmVisuals.flashIdx) {
        RhythmVisuals.flashIdx     = RhythmState._flashBeatIndex;
        RhythmVisuals.flashStartMs = RhythmState._flashStartMs;
    }

    let gapOff = 0;
    sched.forEach((beat, i) => {
        if (i > 0 && beat.beatInMeasure === 0) gapOff += gapW;
        const x        = startX + i * spacing + gapOff;
        const baseR    = beat.accent === 2 ? 6 : beat.accent === 1 ? 4.5 : 3;
        const baseAlph = beat.accent === 2 ? 0.50 : beat.accent === 1 ? 0.30 : 0.15;
        const colHex   = beat.accent === 2 ? 0x2a7fff : beat.accent === 1 ? 0x1a5fcc : 0x1e2428;

        let r = baseR, alph = baseAlph;
        if (i === RhythmVisuals.flashIdx) {
            const age = ts - RhythmVisuals.flashStartMs;
            if (age < RhythmVisuals.FLASH_DUR) {
                const boost = 1 - age / RhythmVisuals.FLASH_DUR;
                r    = baseR + boost * (beat.accent === 2 ? 5 : beat.accent === 1 ? 4 : 3);
                alph = Math.min(1, baseAlph + boost * (beat.accent === 2 ? 0.6 : 0.5));
            }
        }
        rhythmGraphics.circle(x, Y, r);
        rhythmGraphics.fill({ color: colHex, alpha: alph });
        if (beat.accent > 0) {
            rhythmGraphics.circle(x, Y, r);
            rhythmGraphics.stroke({ width: 1, color: beat.accent===2 ? 0x4a9fff : 0x2a4faa, alpha: alph*0.6 });
        }
    });
}

// ===========================================================================
//  MAIN RENDER TICK
// ===========================================================================
export function renderPixi(ts) {
    if (!app) return;
    const W = app.screen.width, H = app.screen.height;
    const cx = W * 0.5, cy = H * 0.5;
    const isMicro = STATE.currentMode === MODE.MICROSTRAFE;

    // TTK cue overlay
    if (TTKState.cueVisible) {
        if (ttkOverlay.alpha < 1) { drawTTKOverlay(); ttkOverlay.alpha = 1; }
    } else {
        if (ttkOverlay.alpha > 0) ttkOverlay.alpha = Math.max(0, ttkOverlay.alpha - 0.08);
    }

    drawRhythmGrid(ts);

    tearGraphics.clear();
    const vel  = PlayerState[P_VELOCITY];
    const absV = Math.abs(vel);
    const col  = getColor(absV);
    const R    = 40;

    if (isMicro) {
        // ── Micro-Strafe: true-position circle, never deformed ──
        const mv = MicroStrafeVisuals;
        const bx = mv.x ?? cx;
        const by = mv.y ?? cy;

        // Snap guides while dragging
        if (mv.isDragging) drawSnapGuides(tearGraphics);

        // Glow halo
        tearGraphics.circle(bx, by, R * 1.55);
        tearGraphics.fill({ color: col, alpha: 0.055 });
        // Main circle
        tearGraphics.circle(bx, by, R);
        tearGraphics.fill({ color: col, alpha: 1.0 });
        tearGraphics.circle(bx, by, R);
        tearGraphics.stroke({ width: 1.5, color: lighten(col, 0.32) });

        // Drag handle (move icon)
        drawDragHandle(tearGraphics, bx, by, mv.isHovered, mv.isDragging);

        // Hint text
        dragHintText.x     = bx;
        dragHintText.y     = by + R + 9;
        dragHintText.alpha = (mv.isHovered && !mv.isDragging) ? 0.7 : 0;

    } else {
        // ── Normal modes: velocity-displaced tear shape ──
        dragHintText.alpha = 0;
        const bx = cx + PlayerState[P_VISUAL_POS];
        const by = cy + (STATE.mode2D ? PlayerState[P_VISUAL_POS_Y] : 0);

        const vx = PlayerState[P_VELOCITY];
        const vy = STATE.mode2D ? PlayerState[P_VELOCITY_Y] : 0;

        // Glow
        drawTearShape(tearGraphics, bx, by, R * 1.55, vx, vy);
        tearGraphics.fill({ color: col, alpha: 0.055 });
        // Body
        drawTearShape(tearGraphics, bx, by, R, vx, vy);
        tearGraphics.fill({ color: col, alpha: 1.0 });
        tearGraphics.stroke({ width: 1.5, color: lighten(col, 0.32) });
    }

    // Feedback float text
    if (Feedback.active) {
        const elapsed = ts - Feedback.startMs;
        const dur     = 700;
        if (elapsed < dur) {
            const t = elapsed / dur;
            feedbackText.alpha      = Math.pow(1 - t, 1.5);
            feedbackText.text       = Feedback.label;
            feedbackText.style.fill = parseInt(Feedback.color.replace('#','0x'));
            feedbackText.style.fontSize = isMicro ? 18 : 24;
            const fbx = isMicro ? (MicroStrafeVisuals.x ?? cx) : cx + PlayerState[P_VISUAL_POS];
            const fby = isMicro ? (MicroStrafeVisuals.y ?? cy) : cy + (STATE.mode2D ? PlayerState[P_VISUAL_POS_Y] : 0);
            feedbackText.x = fbx;
            feedbackText.y = fby - R * 2.3 - t * 28;
        } else {
            Feedback.active = false;
            feedbackText.alpha = 0;
        }
    }
}
