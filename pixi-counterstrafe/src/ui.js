import {
    HistoryFreestyle, HistoryTTK, SessionLogFreestyle, SessionLogTTK,
    SessionLogStrafeLab, SessionLogMicroStrafe,
    Feedback, STATE, PlayerState, MODE,
    P_VELOCITY, P_PHASE,
    StrafeLab, MicroStrafe, SymmetryLog, RhythmState,
    InputState, IN_A, IN_D,
    realisticTimeToReady,
} from './state.js';
import { PRESETS } from './rhythm.js';

function getArrays() {
    if (STATE.currentMode === MODE.TTK) return { session: SessionLogTTK };
    return { session: SessionLogFreestyle };
}

function decelBarStyle(totalDecelMs, coastMs) {
    const f = Math.min(1, totalDecelMs / 320);
    let r, g;
    if (totalDecelMs <= coastMs) { const p = totalDecelMs / (coastMs || 1); r = ~~(p * 230); g = 200; }
    else { const p = Math.min(1, (totalDecelMs - coastMs) / (300 - coastMs)); r = 230; g = ~~(200 * (1 - p)); }
    return `background:rgb(${r},${g},40);width:${~~(f * 88)}px`;
}

function mean(arr) { return arr.length ? ~~(arr.reduce((a, b) => a + b, 0) / arr.length) : null; }

// ===========================================================================
//  AVERAGES (Freestyle / TTK)
// ===========================================================================
export function computeAverages() {
    const { session } = getArrays();
    const totalActionsCount = session.filter(h => h.isAttempt).length;
    document.getElementById('av-act').textContent = totalActionsCount;

    const realShots = session.filter(h => h.isAttempt && !h.isAbort && !h.isFalseStart);
    document.getElementById('av-tot').textContent = realShots.length;

    const falseEl = document.getElementById('av-false');
    if (falseEl) falseEl.textContent = session.filter(h => h.isFalseStart).length;

    if (!realShots.length) {
        ['av-rate','av-breakdown','av-cs','av-spd','av-gap','av-ovl'].forEach(id => {
            const el = document.getElementById(id); if (el) el.textContent = '—';
        });
        const avTts = document.getElementById('av-tts'); if (avTts) avTts.textContent = '—';
        return;
    }

    const succ = realShots.filter(h => h.isSuccess).length;
    document.getElementById('av-rate').textContent = ~~(succ / realShots.length * 100) + '%';

    const cs  = realShots.filter(h => h.csMs > 0).map(h => h.csMs);
    const gap = realShots.filter(h => h.gapMs > 0).map(h => h.gapMs);
    const ovl = realShots.filter(h => h.overlapMs > 0).map(h => h.overlapMs);

    document.getElementById('av-cs').textContent  = cs.length  ? mean(cs)  + 'ms' : '—';
    document.getElementById('av-spd').textContent = mean(realShots.map(h => h.speed)) + ' u/s';
    document.getElementById('av-gap').textContent = gap.length ? mean(gap) + 'ms' : '—';
    document.getElementById('av-ovl').textContent = ovl.length ? mean(ovl) + 'ms' : '—';

    const avTts = document.getElementById('av-tts');
    if (avTts) {
        const ttsVals = realShots.filter(h => h.ttsMs > 0).map(h => h.ttsMs);
        avTts.textContent = ttsVals.length ? mean(ttsVals) + 'ms' : '—';
    }

    let sumGap = 0, sumOvl = 0, sumCs = 0;
    realShots.forEach(h => { sumGap += h.gapMs; sumOvl += h.overlapMs; sumCs += h.csMs; });
    const grandTotal = sumGap + sumOvl + sumCs;
    if (grandTotal > 0) {
        const pGap = ~~(sumGap / grandTotal * 100);
        const pOvl = ~~(sumOvl / grandTotal * 100);
        const pCs  = 100 - pGap - pOvl;
        const parts = [];
        if (pCs  > 0) parts.push(`<span style="color:var(--green)">${pCs}% CS</span>`);
        if (pGap > 0) parts.push(`<span style="color:var(--yellow)">${pGap}% Gap</span>`);
        if (pOvl > 0) parts.push(`<span style="color:var(--red)">${pOvl}% Ovlp</span>`);
        document.getElementById('av-breakdown').innerHTML = parts.join(' / ');
    } else {
        document.getElementById('av-breakdown').textContent = '—';
    }
}

// ===========================================================================
//  HISTORY (Freestyle / TTK)
// ===========================================================================
function buildRow(rec) {
    const isTTK = rec.mode === 'ttk';
    const det = [];
    if (isTTK && rec.ttsMs > 0) det.push('TTS ' + rec.ttsMs + 'ms');
    det.push(rec.speed + ' u/s');
    if (rec.totalDecelMs > 0) det.push('decel ' + rec.totalDecelMs + 'ms');
    if (rec.csMs      > 0) det.push('CS '   + rec.csMs      + 'ms');
    if (rec.gapMs     > 0) det.push('gap '  + rec.gapMs     + 'ms');
    if (rec.overlapMs > 0) det.push('ovlp ' + rec.overlapMs + 'ms');
    if (rec.stoppedMs > 0) det.push('wait ' + rec.stoppedMs + 'ms');
    const detHtml  = det.map(d => `<span>${d}</span>`).join('');
    const barStyle = rec.isAttempt && rec.totalDecelMs > 0
        ? `style="${decelBarStyle(rec.totalDecelMs, rec.coastMs)}"` : 'style="display:none"';
    const row = document.createElement('div');
    row.className = 'h-row' + (rec.isAttempt ? '' : ' no-attempt');
    if (isTTK && rec.isAttempt && !rec.isFalseStart) {
        row.style.borderLeft = `3px solid ${rec.isSuccess ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`;
    }
    row.innerHTML =
        `<span class="h-num">#${rec.n}</span>` +
        `<span class="h-res" style="color:${rec.color}">${rec.label}</span>` +
        `<div class="h-det">${detHtml}<div class="h-decel-bar" ${barStyle}></div></div>`;
    return row;
}

export function prependRow(rec) {
    const list = document.getElementById('hist-list');
    list.insertBefore(buildRow(rec), list.firstChild);
    while (list.children.length > 50) list.removeChild(list.lastChild);
}

export function rebuildHistoryDOM() {
    const list = document.getElementById('hist-list');
    list.innerHTML = '';
    const history = STATE.currentMode === MODE.TTK ? HistoryTTK : HistoryFreestyle;
    history.forEach(rec => list.appendChild(buildRow(rec)));
}

// ===========================================================================
//  LIVE SIDEBAR
// ===========================================================================
export function updateSidebar(rec) {
    const lv = document.getElementById('lv-result');
    lv.textContent = rec.label; lv.style.color = rec.color;
    if (rec.totalDecelMs > 0) {
        document.getElementById('lv-total').textContent   = rec.totalDecelMs;
        document.getElementById('lv-total-u').textContent = ' ms';
    } else {
        document.getElementById('lv-total').textContent   = '—';
        document.getElementById('lv-total-u').textContent = '';
    }
    if (rec.csMs > 0) {
        document.getElementById('lv-cs').textContent  = rec.csMs;
        document.getElementById('lv-csu').textContent = ' ms';
    } else {
        document.getElementById('lv-cs').textContent  = '—';
        document.getElementById('lv-csu').textContent = '';
    }
    computeAverages();
    prependRow(rec);
    updateSymmetryUI();
}

// Dummy callback used by lab modes (no sidebar row needed)
export function updateSidebarLabMode(_rec) {
    updateSymmetryUI();
}

const PhaseNames = ['IDLE', 'STRAFING', 'DECELERATING'];
let _keyA, _keyD;
function keyEls() {
    if (!_keyA) _keyA = document.querySelector('.key[data-k="A"]');
    if (!_keyD) _keyD = document.querySelector('.key[data-k="D"]');
    return { keyA: _keyA, keyD: _keyD };
}

export function updateLiveDOM() {
    document.getElementById('lv-speed').textContent  = ~~Math.abs(PlayerState[P_VELOCITY]);
    document.getElementById('lv-phase').textContent  = PhaseNames[PlayerState[P_PHASE]];
    document.getElementById('hdr-phase').textContent = PhaseNames[PlayerState[P_PHASE]];
    const { keyA, keyD } = keyEls();
    if (keyA) keyA.classList.toggle('on', InputState[IN_A] === 1);
    if (keyD) keyD.classList.toggle('on', InputState[IN_D] === 1);

    const pct = Math.abs(PlayerState[P_VELOCITY]) / STATE.WPN.maxSpeed * 50;
    if (PlayerState[P_VELOCITY] >= 0) {
        document.getElementById('velbar-right').style.width = pct + '%';
        document.getElementById('velbar-left').style.width  = '0%';
    } else {
        document.getElementById('velbar-left').style.width  = pct + '%';
        document.getElementById('velbar-right').style.width = '0%';
    }
}

export function updateBenchmarksUI() {
    document.getElementById('bench-cs').textContent    = Math.round(STATE.CS_MS) + 'ms';
    document.getElementById('bench-coast').textContent = Math.round(STATE.COAST_MS) + 'ms';
    const pct = (STATE.ACCURATE_THRESH / STATE.WPN.maxSpeed) * 50;
    const l = document.getElementById('vbt-l');
    const r = document.getElementById('vbt-r');
    if (l) l.style.right = `calc(50% + ${pct}%)`;
    if (r) r.style.left  = `calc(50% + ${pct}%)`;
}

export function initVelBar() {
    const wrap = document.getElementById('velbar-wrap');
    ['vbt-l', 'vbt-r'].forEach(id => {
        const el = document.createElement('div');
        el.id = id; el.className = 'vb-thresh';
        wrap.appendChild(el);
    });
}

// ===========================================================================
//  SYMMETRY PANEL
// ===========================================================================
export function updateSymmetryUI() {
    const { left, right } = SymmetryLog;
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    const lSpd  = avg(left.map(e => e.speedAtShot));
    const rSpd  = avg(right.map(e => e.speedAtShot));
    const lOat  = avg(left.map(e => e.oneAtTimePct));
    const rOat  = avg(right.map(e => e.oneAtTimePct));

    document.getElementById('sym-l-spd').textContent  = lSpd  != null ? lSpd  + ' u/s' : '—';
    document.getElementById('sym-r-spd').textContent  = rSpd  != null ? rSpd  + ' u/s' : '—';
    document.getElementById('sym-l-oat').textContent  = lOat  != null ? lOat  + '%'    : '—';
    document.getElementById('sym-r-oat').textContent  = rOat  != null ? rOat  + '%'    : '—';
    document.getElementById('sym-l-n').textContent    = left.length;
    document.getElementById('sym-r-n').textContent    = right.length;

    let score = null;
    if (lSpd != null && rSpd != null && Math.max(lSpd, rSpd) > 0) {
        const spdScore = 1 - Math.abs(lSpd - rSpd) / Math.max(lSpd, rSpd);
        const oatScore = (lOat != null && rOat != null)
            ? 1 - Math.abs(lOat - rOat) / 100
            : 1;
        score = Math.round((spdScore * 0.6 + oatScore * 0.4) * 100);
    }

    const scoreEl = document.getElementById('sym-score');
    if (score != null) {
        scoreEl.textContent = score + '%';
        scoreEl.style.color = score >= 90 ? 'var(--green)' : score >= 75 ? 'var(--yellow)' : 'var(--red)';
    } else {
        scoreEl.textContent = '—'; scoreEl.style.color = 'var(--text-dim)';
    }
}

// ===========================================================================
//  LAB PROGRESS BARS (shared for both lab modes)
// ===========================================================================
export function updateLabProgressUI() {
    const lab = StrafeLab.active ? StrafeLab : MicroStrafe.active ? MicroStrafe : null;
    if (!lab) return;

    const pct = Math.min(1, lab.accumulatedUnits / lab.quotaUnits) * 100;
    const dist = document.getElementById('sl-pb-dist');
    const txt  = document.getElementById('sl-pb-dist-text');
    if (dist) dist.style.width = pct + '%';
    if (txt)  txt.textContent  = ~~lab.accumulatedUnits + ' / ' + lab.quotaUnits + ' u';

    const shotsRow = document.getElementById('sl-shots-pb-row');
    if (shotsRow) {
        if (lab.quotaShots > 0) {
            shotsRow.style.display = 'flex';
            const sPct = Math.min(1, lab.shotEvents.length / lab.quotaShots) * 100;
            const sBar = document.getElementById('sl-pb-shots');
            const sTxt = document.getElementById('sl-pb-shots-text');
            // colour shots bar by accuracy
            const accurate = lab.shotEvents.filter(s => s.wasAccurate).length;
            const accPct   = lab.shotEvents.length ? Math.round(accurate / lab.shotEvents.length * 100) : 0;
            if (sBar) {
                sBar.style.width = sPct + '%';
                sBar.style.background = accPct >= 80 ? 'var(--green)' : accPct >= 50 ? 'var(--yellow)' : 'var(--red)';
            }
            if (sTxt) sTxt.textContent = lab.shotEvents.length + ' / ' + lab.quotaShots + ' (' + accPct + '% acc)';
        } else {
            shotsRow.style.display = 'none';
        }
    }
}

// ===========================================================================
//  LAB RESULTS OVERLAY
// ===========================================================================
export function showLabResults(results) {
    const overlay = document.getElementById('sl-results');
    if (!overlay) return;

    const isMicro = results.mode === 'microstrafe';
    document.getElementById('slr-title').textContent   = (results.completed ? 'COMPLETE' : 'STOPPED') + (isMicro ? ' — MICRO-STRAFE' : ' — STRAFE LAB');
    document.getElementById('slr-time').textContent    = (results.timeMs / 1000).toFixed(2) + 's';

    const shots = results.completedShots;
    const acc   = results.shotAccuratePct != null ? results.shotAccuratePct + '%' : '—';
    const spd   = results.avgSpeedAtShot  != null ? results.avgSpeedAtShot + ' u/s' : '—';
    document.getElementById('slr-shots').textContent      = shots + (results.quotaShots > 0 ? ' / ' + results.quotaShots : '');
    document.getElementById('slr-shot-acc').textContent   = acc;
    document.getElementById('slr-avg-spd').textContent    = spd;
    document.getElementById('slr-mtr').textContent        = results.avgMTR ? results.avgMTR + 'ms' : '—';

    // Mode-specific rows
    const rrRow = document.getElementById('slr-rtr-row');
    const oiRow = document.getElementById('slr-oi-row');
    const ssRow = document.getElementById('slr-ss-row');

    if (rrRow) rrRow.style.display = isMicro ? 'flex' : 'none';
    if (oiRow) oiRow.style.display = isMicro ? 'flex' : 'none';
    if (ssRow) ssRow.style.display = !isMicro ? 'flex' : 'none';

    if (isMicro) {
        const rtrEl = document.getElementById('slr-rtr');
        const oiEl  = document.getElementById('slr-oi');
        if (rtrEl) rtrEl.textContent = results.rtr != null ? results.rtr + 'ms' : '—';
        if (oiEl)  oiEl.textContent  = results.inaccDistPct != null ? results.inaccDistPct + '%' : '—';
    } else {
        const ssEl = document.getElementById('slr-ss');
        if (ssEl) ssEl.textContent = results.shotSpread != null ? results.shotSpread : '—';
    }

    // Compare to best previous same-config run
    const log     = isMicro ? SessionLogMicroStrafe : SessionLogStrafeLab;
    const sameConfig = log.filter(r =>
        r.completed &&
        r.quotaUnits === results.quotaUnits &&
        r.quotaShots === results.quotaShots &&
        r.direction  === results.direction &&
        r.weapon     === results.weapon
    );
    const compareEl = document.getElementById('slr-compare');
    if (compareEl) {
        if (sameConfig.length >= 2) {
            // best = shortest time (excluding current which was just pushed)
            const prev = sameConfig.slice(0, -1);
            const best = Math.min(...prev.map(r => r.timeMs));
            const diff = results.timeMs - best;
            const sign = diff <= 0 ? '▼' : '▲';
            const col  = diff <= 0 ? 'var(--green)' : 'var(--red)';
            compareEl.innerHTML = `vs best: <span style="color:${col}">${sign} ${(Math.abs(diff)/1000).toFixed(2)}s</span>`;
        } else {
            compareEl.textContent = sameConfig.length === 1 ? 'First completed run — set your baseline!' : '';
        }
    }

    overlay.style.display = 'flex';
}

export function hideLabResults() {
    const overlay = document.getElementById('sl-results');
    if (overlay) overlay.style.display = 'none';
}

// ===========================================================================
//  LAB CONFIG SYNC
// ===========================================================================
export function syncLabConfig(mode) {
    const isSL = mode === MODE.STRAFELAB;
    const isMS = mode === MODE.MICROSTRAFE;
    if (!isSL && !isMS) return;

    const lab      = isSL ? StrafeLab : MicroStrafe;
    const startBtn = document.getElementById('sl-start');
    if (!startBtn) return;

    const inputs = document.querySelectorAll('#sl-config input:not([type=radio]), #sl-config .sl-preset');
    if (lab.active) {
        startBtn.textContent = 'STOP SESSION';
        startBtn.classList.add('sl-stop');
        inputs.forEach(el => el.disabled = true);
        document.getElementById('sl-progress').style.display = 'flex';
    } else {
        startBtn.textContent = 'START SESSION';
        startBtn.classList.remove('sl-stop');
        inputs.forEach(el => el.disabled = false);
        document.getElementById('sl-progress').style.display = 'none';
    }
}

// ===========================================================================
//  RHYTHM CONFIG
// ===========================================================================
export function renderRhythmConfig(onChangeCallback) {
    const table = document.getElementById('rhy-seg-table');
    if (!table) return;
    table.innerHTML = '';

    RhythmState.segments.forEach((seg, i) => {
        const row = document.createElement('div');
        row.className = 'rhy-seg-row';
        row.innerHTML = `
            <div class="num-input-wrap">
                <button class="num-btn" data-field="bars" data-idx="${i}" data-delta="-1">−</button>
                <input class="rhy-mini" type="number" min="1" max="16" value="${seg.bars}" title="Bars" data-field="bars" data-idx="${i}">
                <button class="num-btn" data-field="bars" data-idx="${i}" data-delta="1">+</button>
            </div>
            <span class="rhy-seg-x">×</span>
            <div class="num-input-wrap">
                <button class="num-btn" data-field="num" data-idx="${i}" data-delta="-1">−</button>
                <input class="rhy-mini rhy-num" type="number" min="2" max="16" value="${seg.num}" title="Numerator" data-field="num" data-idx="${i}">
                <button class="num-btn" data-field="num" data-idx="${i}" data-delta="1">+</button>
            </div>
            <span class="rhy-seg-slash">/</span>
            <select class="rhy-mini-sel" data-field="denom" data-idx="${i}" title="Denominator">
                ${[4,8,16].map(d => `<option value="${d}" ${seg.denom===d?'selected':''}>${d}</option>`).join('')}
            </select>
            <input class="rhy-mini rhy-grp" type="text" value="${(seg.grouping||[]).join(',')}" title="Grouping (e.g. 3,2,2)" placeholder="grp" data-field="grouping" data-idx="${i}">
            <button class="rhy-remove" data-idx="${i}" title="Remove">×</button>
        `;
        table.appendChild(row);
    });

    // Delta buttons
    table.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const idx   = +btn.dataset.idx;
            const field = btn.dataset.field;
            const delta = +btn.dataset.delta;
            const input = table.querySelector(`input[data-field="${field}"][data-idx="${idx}"]`);
            const min   = field === 'num' ? 2 : 1;
            const max   = 16;
            const newVal = Math.max(min, Math.min(max, RhythmState.segments[idx][field] + delta));
            RhythmState.segments[idx][field] = newVal;
            input.value = newVal;
            if (onChangeCallback) onChangeCallback();
        });
    });

    // Text inputs
    table.querySelectorAll('input[type=number], select').forEach(el => {
        el.addEventListener('change', e => {
            const idx   = +e.target.dataset.idx;
            const field = e.target.dataset.field;
            const val   = e.target.value;
            if (field === 'denom') RhythmState.segments[idx].denom = +val;
            else RhythmState.segments[idx][field] = parseInt(val, 10);
            if (onChangeCallback) onChangeCallback();
        });
    });
    table.querySelectorAll('input[data-field="grouping"]').forEach(el => {
        el.addEventListener('change', e => {
            const idx    = +e.target.dataset.idx;
            const parsed = e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
            RhythmState.segments[idx].grouping = parsed.length ? parsed : [];
            if (onChangeCallback) onChangeCallback();
        });
    });
    table.querySelectorAll('.rhy-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = +btn.dataset.idx;
            if (RhythmState.segments.length > 1) {
                RhythmState.segments.splice(idx, 1);
                renderRhythmConfig(onChangeCallback);
                if (onChangeCallback) onChangeCallback();
            }
        });
    });
}

export function renderRhythmPresets(onSelectCallback) {
    const container = document.getElementById('rhy-presets');
    if (!container) return;
    container.innerHTML = '';
    PRESETS.forEach(preset => {
        const btn = document.createElement('button');
        btn.className   = 'rhy-preset-btn';
        btn.textContent = preset.name;
        btn.addEventListener('click', () => {
            RhythmState.bpm      = preset.bpm;
            RhythmState.segments = preset.segments.map(s => ({ ...s, grouping: [...(s.grouping || [])] }));
            document.getElementById('rhy-bpm').value     = preset.bpm;
            document.getElementById('rhy-bpm-val').value = preset.bpm;
            renderRhythmConfig(onSelectCallback);
            if (onSelectCallback) onSelectCallback();
        });
        container.appendChild(btn);
    });
}

export function syncRhythmConfig() {
    const startBtn = document.getElementById('rhy-start');
    if (!startBtn) return;
    const controls = document.querySelectorAll('#rhy-config input, #rhy-config select, #rhy-config button:not(#rhy-start), #rhy-config .rhy-preset-btn');
    if (RhythmState.active) {
        startBtn.textContent = 'STOP';
        startBtn.classList.add('sl-stop');
        controls.forEach(el => el.disabled = true);
    } else {
        startBtn.textContent = 'START';
        startBtn.classList.remove('sl-stop');
        controls.forEach(el => el.disabled = false);
    }
}

// ===========================================================================
//  CSV EXPORT
// ===========================================================================
export function exportHistoryCSV() {
    const { session } = getArrays();
    if (session.length === 0) return;
    const modeName = STATE.currentMode === MODE.TTK ? 'TTK' : 'Freestyle';
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'Timestamp,ShotNumber,Mode,Result,Weapon,Speed,TotalDecelMs,CounterStrafeMs,GapMs,OverlapMs,WaitMs,MaxSpeed,CoastMs,TimeToShotMs\n';
    session.forEach(h => {
        csv += [
            h.timestamp || '', h.n, modeName, h.result, h.weapon || STATE.WPN.id,
            h.speed, h.totalDecelMs, h.csMs, h.gapMs, h.overlapMs, h.stoppedMs,
            STATE.WPN.maxSpeed, h.coastMs, h.ttsMs || 0,
        ].join(',') + '\n';
    });
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `cs2-${modeName.toLowerCase()}-session-${Date.now()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

export function exportLabCSV() {
    const isMS   = STATE.currentMode === MODE.MICROSTRAFE;
    const log    = isMS ? SessionLogMicroStrafe : SessionLogStrafeLab;
    const mname  = isMS ? 'microstrafe' : 'strafelab';
    if (!log.length) return;

    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'Timestamp,Mode,Weapon,Direction,QuotaUnits,QuotaShots,Completed,TimeMs,Shots,ShotAccuratePct,AvgSpeedAtShot,AvgMTR,AvgStrafeEff,StrafeCount';
    if (isMS)  csv += ',InaccDistPct,RTR_Ms';
    else       csv += ',ShotSpread';
    csv += '\n';

    log.forEach(r => {
        let row = [
            r.timestamp, mname, r.weapon, r.direction, r.quotaUnits, r.quotaShots,
            r.completed ? 1 : 0, r.timeMs, r.completedShots,
            r.shotAccuratePct ?? '', r.avgSpeedAtShot ?? '', r.avgMTR ?? '',
            r.avgStrafeEff ?? '', r.strafeCount ?? '',
        ];
        if (isMS) row.push(r.inaccDistPct ?? '', r.rtr ?? '');
        else      row.push(r.shotSpread ?? '');
        csv += row.join(',') + '\n';
    });

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `cs2-${mname}-${Date.now()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
