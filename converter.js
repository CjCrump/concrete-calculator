/* ============================================================
   GlovesON FieldCalc — Unit Converter
   Purpose: field-friendly conversions that behave like a tool,
   not a generic converter.

   Philosophy:
   - Calculator = ordering (round up is good)
   - Converter  = building (precision is required)
   ============================================================ */


/* ============================================================
   SETTINGS (GLOBAL STATE)
   We declare these ONCE at file scope to avoid "redeclare" errors.
   Then we REASSIGN when settings change (onReturnSync).
============================================================ */

// Settings object (reloaded when returning from Settings)
let S = FieldCalcSettings.load();

// Tape precision (in inches):
// - fracDenom = 16 means 1/16"
// - fracStep  = 1/16 inch expressed as a decimal (0.0625)
let fracDenom = Number(S.rounding.fracPrecision || 16); // default 1/16
let fracStep = 1 / fracDenom;


/* ============================================================
   MODE SWITCH UI (Tape / Slope / Yards↔Tons)
============================================================ */
const modeButtons = document.querySelectorAll('.segmented .seg');
const modes = document.querySelectorAll('.mode');

// -----------------------------------------------------
// On refresh: ensure only the active mode is visible.
// (Without this, multiple panels can appear on load.)
// -----------------------------------------------------
(function initModeVisibility() {
  const activeBtn = document.querySelector('.segmented .seg.active');
  const mode = activeBtn?.dataset.mode || 'tape';

  modes.forEach(m => m.classList.add('hidden'));
  document.getElementById(`mode-${mode}`)?.classList.remove('hidden');
})();

modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    // Visual active state
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Show the selected mode panel
    const mode = btn.dataset.mode;
    modes.forEach(m => m.classList.add('hidden'));
    document.getElementById(`mode-${mode}`)?.classList.remove('hidden');

    // Small UX win: recalc when switching modes so UI never looks stale
    recalcAll();
  });
});

/* ============================================================
   TAPE MODE (Two-way, no results panel)
   PRIMARY (top): Engineer -> Tape
   SECONDARY:      Tape -> Engineer

   - "Engineer" output should be tenths (0.1 ft)
   - Tape snapping uses Settings precision (1/16 default, 1/8 optional)
   - JS-populated fields get the .auto class (green)
============================================================ */

let fracValue = 0; // inches fraction value from chip set (0, 1/16, 1/8, 1/4, 1/2)

const engFeetIn = document.getElementById('engFeetIn'); // NEW primary input
const tapeFeet = document.getElementById('tapeFeet');
const tapeInches = document.getElementById('tapeInches');
const tapeRoundBtn = document.getElementById('tapeRound');
const fracButtonsWrap = document.getElementById('fracButtons');

let tapeLastEdited = 'eng'; // 'eng' | 'tape'

// Converter default should be EXACT-ish; Round Up is optional
let tapeRoundUp = (S.rounding.tapeMode === 'up');

function setAuto(el, on) {
  if (!el) return;
  el.classList.toggle('auto', !!on);
}

function setTapeToggleUI() {
  if (!tapeRoundBtn) return;
  tapeRoundBtn.textContent = tapeRoundUp ? 'ON' : 'OFF';
  tapeRoundBtn.classList.toggle('on', tapeRoundUp);
}

// Round UP to the next step (conservative ordering behavior)
function snapUp(value, step) {
  return Math.ceil(value / step) * step;
}

function snapNearest(value, step) {
  return Math.round(value / step) * step;
}

function inchesToParts(inches) {
  const whole = Math.floor(inches);
  const frac = inches - whole;
  const n = Math.round(frac * fracDenom);

  // Carry
  if (n === 0) return { wholeInches: whole, fracInches: 0 };
  if (n === fracDenom) return { wholeInches: whole + 1, fracInches: 0 };

  return { wholeInches: whole, fracInches: n / fracDenom };
}

/**
 * Choose the closest chip value from our fixed chip set.
 * (Keeps UI simple for older users.)
 */
function closestChipValue(fracInches) {
  const chips = [0, 0.0625, 0.125, 0.25, 0.5];
  let best = chips[0];
  let bestDiff = Math.abs(fracInches - best);
  for (const c of chips) {
    const d = Math.abs(fracInches - c);
    if (d < bestDiff) {
      best = c;
      bestDiff = d;
    }
  }
  return best;
}

function highlightFracChip(valueInInches) {
  if (!fracButtonsWrap) return;
  const btns = fracButtonsWrap.querySelectorAll('.frac');
  btns.forEach(b => {
    const v = Number(b.getAttribute('data-frac'));
    b.classList.toggle('active', Math.abs(v - valueInInches) < 1e-6);
  });
}

function calcEngineerToTape() {
  if (!engFeetIn || !tapeFeet || !tapeInches) return;

  const decFeetRaw = engFeetIn.value;
  const decFeet = Number(decFeetRaw);

  if (decFeetRaw === '' || Number.isNaN(decFeet)) return;

  // Convert to inches
  let totalInches = decFeet * 12;

  // Snap inches to precision step (nearest by default)
  totalInches = tapeRoundUp ? snapUp(totalInches, fracStep) : snapNearest(totalInches, fracStep);

  const ft = Math.floor(totalInches / 12);
  const remIn = totalInches - (ft * 12);

  const parts = inchesToParts(remIn);
  const chip = closestChipValue(parts.fracInches);

  // Write tape fields (these are results, so green)
  tapeFeet.value = String(ft);
  tapeInches.value = String(parts.wholeInches);
  fracValue = chip;

  setAuto(tapeFeet, true);
  setAuto(tapeInches, true);

  highlightFracChip(fracValue);
}

function calcTapeToEngineer() {
  if (!engFeetIn || !tapeFeet || !tapeInches) return;

  const ft = Number(tapeFeet.value) || 0;
  const inch = Number(tapeInches.value) || 0;

  // total inches includes chip fraction
  let totalInches = (ft * 12) + inch + fracValue;

  // Snap
  totalInches = tapeRoundUp ? snapUp(totalInches, fracStep) : snapNearest(totalInches, fracStep);

  const totalFeet = totalInches / 12;

  // Engineer rule = tenths
  engFeetIn.value = totalFeet.toFixed(1);

  // engFeetIn is a result when user edited tape
  setAuto(engFeetIn, true);
}

function recalcTape() {
  if (tapeLastEdited === 'eng') {
    // User typed engineer; engineer is NOT a result
    setAuto(engFeetIn, false);
    calcEngineerToTape();
  } else {
    // User edited tape; tape fields are NOT results
    setAuto(tapeFeet, false);
    setAuto(tapeInches, false);

    calcTapeToEngineer();
  }
}

// listeners
engFeetIn?.addEventListener('input', () => {
  tapeLastEdited = 'eng';
  recalcTape();
});

[tapeFeet, tapeInches].forEach(el => {
  el?.addEventListener('input', () => {
    tapeLastEdited = 'tape';
    // user typed these, so remove result styling
    setAuto(el, false);
    recalcTape();
  });
});

fracButtonsWrap?.addEventListener('click', (e) => {
  const btn = e.target.closest('.frac');
  if (!btn) return;

  tapeLastEdited = 'tape';

  fracValue = Number(btn.getAttribute('data-frac')) || 0;
  highlightFracChip(fracValue);

  recalcTape();
});

tapeRoundBtn?.addEventListener('click', () => {
  tapeRoundUp = !tapeRoundUp;
  setTapeToggleUI();
  recalcTape();
});

// init
setTapeToggleUI();
highlightFracChip(fracValue);


/* ============================================================
   SLOPE MODE (3-way solver, no results panel)
   Any 2 of the 3 inputs fills the 3rd:
     - Rise + Run -> Grade (%)
     - Grade + Run -> Rise
     - Grade + Rise -> Run

   JS-populated field gets .auto (green)
============================================================ */

const slopePct = document.getElementById('slopePct');
const slopeRun = document.getElementById('slopeRun');
const slopeRiseIn = document.getElementById('slopeRiseIn');

let slopeLastEdited = null; // 'pct' | 'run' | 'rise'

function numOrNull(el) {
  if (!el) return null;
  const raw = el.value;
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function setAutoValue(el, val) {
  if (!el) return;
  el.value = val;
  el.classList.add('auto');
}

function clearAuto(el) {
  if (!el) return;
  el.classList.remove('auto');
}

function calcSlope3Way() {
  if (!slopePct || !slopeRun || !slopeRiseIn) return;

  const pct = numOrNull(slopePct);
  const run = numOrNull(slopeRun);
  const rise = numOrNull(slopeRiseIn);

  // Remove auto on fields the user is actively editing
  // (We only keep auto on fields we write to.)
  if (slopeLastEdited === 'pct') clearAuto(slopePct);
  if (slopeLastEdited === 'run') clearAuto(slopeRun);
  if (slopeLastEdited === 'rise') clearAuto(slopeRiseIn);

  // If fewer than 2 values are present, do nothing.
  const count = [pct, run, rise].filter(v => v !== null).length;
  if (count < 2) return;

  // If all 3 present, don’t override user-entered values automatically.
  // (Prevents “fighting”)
  if (count === 3) return;

  // Exactly 2 present -> compute the missing one
  // Missing Grade (%)
  if (pct === null && rise !== null && run !== null && run !== 0) {
    const outPct = (rise / run) * 100;
    setAutoValue(slopePct, outPct.toFixed(2));
    return;
  }

  // Missing Rise
  if (rise === null && pct !== null && run !== null) {
    const outRise = (pct / 100) * run;
    setAutoValue(slopeRiseIn, outRise.toFixed(2));
    return;
  }

  // Missing Run (THIS is the “third way” you were missing)
  if (run === null && pct !== null && rise !== null && pct !== 0) {
    const outRun = (rise * 100) / pct;
    setAutoValue(slopeRun, outRun.toFixed(2));
    return;
  }
}

// listeners
slopePct?.addEventListener('input', () => {
  slopeLastEdited = 'pct';
  clearAuto(slopePct);
  calcSlope3Way();
});

slopeRun?.addEventListener('input', () => {
  slopeLastEdited = 'run';
  clearAuto(slopeRun);
  calcSlope3Way();
});

slopeRiseIn?.addEventListener('input', () => {
  slopeLastEdited = 'rise';
  clearAuto(slopeRiseIn);
  calcSlope3Way();
});


/* ============================================================
   YARDS ↔ TONS MODE
   - Uses density presets from Settings (Material Presets)
   - Displays an estimated tonnage

   IMPORTANT:
   This is estimation math. Moisture & compaction changes real tonnage.
============================================================ */
const yardsInput = document.getElementById('yardsInput');
const tonsResult = document.getElementById('tonsResult');
const tonsMaterial = document.getElementById('tonsMaterial');

function calcTons() {
  if (!tonsResult) return;

  const yards = Number(yardsInput?.value);

  // If empty or 0, show dash
  if (!yards) {
    tonsResult.textContent = '—';
    return;
  }

  // Density comes from Settings
  const density = Number(S.materials?.[tonsMaterial?.value]);

  // If density missing for some reason, fail safely
  if (!density) {
    tonsResult.textContent = '—';
    return;
  }

  const tons = yards * density;
  tonsResult.textContent = tons.toFixed(1) + ' tons';
}

[yardsInput, tonsMaterial].forEach(el => {
  if (!el) return;
  el.addEventListener('input', calcTons);
});


/* ============================================================
   SETTINGS RESPONSIVENESS (NO SWIPE REFRESH)
   Some mobile browsers restore pages from cache (bfcache).
   That means normal load events won't rerun. So we listen to:
   - visibilitychange (returning from background)
   - pageshow (back button / bfcache restore)
   - storage (multi-tab change)
============================================================ */
function onReturnSync(syncFn) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncFn();
  });

  // bfcache restore (critical on mobile)
  window.addEventListener('pageshow', () => syncFn());

  // optional: multi-tab support
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.includes('gloveson_fieldcalc_settings')) syncFn();
  });
}

/**
 * Re-load settings and re-apply them to converter runtime.
 * This is the "missing link" that makes settings feel instant.
 */
function syncConverterFromSettings() {
  // 1) Reload settings
  S = FieldCalcSettings.load();

  // 2) Update precision step (1/16 default, user can set 1/8)
  fracDenom = Number(S.rounding.fracPrecision || 16);
  fracStep = 1 / fracDenom;

  // 3) Default tape mode: exact unless Settings explicitly says up
  tapeRoundUp = (S.rounding.tapeMode === 'up');
  setTapeToggleUI();

  // 4) Recalculate everything so the UI matches current settings
  recalcAll();
}

/**
 * Helper: recalculates all modes.
 * Keeps things simple and prevents "only some things updated" bugs.
 */
function recalcAll() {
  // Tape: run whichever direction was last edited
  recalcTape();

  // Slope: run the 3-way solver
  calcSlope3Way();

  // Tons: keep existing
  calcTons();
}

// Start listening for “return from Settings”
onReturnSync(syncConverterFromSettings);

// Initial calculation pass (prevents blank state feeling)
recalcAll();

