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
   TAPE MODE (Precision-first)
   - Default behavior: EXACT (because building requires precision)
   - User can toggle Round Up ON if they want conservative snapping
   - Snap step comes from Settings (1/16 default; user can choose 1/8)
============================================================ */
let fracValue = 0; // optional chip add: 1/16, 1/8, 1/4, 1/2 (in inches)

const tapeFeet = document.getElementById('tapeFeet');
const tapeInches = document.getElementById('tapeInches');
const tapeDecimal = document.getElementById('tapeDecimal');
const tapeRoundBtn = document.getElementById('tapeRound');

// Converter default should be EXACT
// So: tapeRoundUp is true only if Settings explicitly says "up"
let tapeRoundUp = (S.rounding.tapeMode === 'up');

/**
 * Updates the tape toggle button visuals based on tapeRoundUp.
 * Keeping UI logic in one function prevents “drift”.
 */
function setTapeToggleUI() {
  if (!tapeRoundBtn) return;
  tapeRoundBtn.textContent = tapeRoundUp ? 'ON' : 'OFF';
  tapeRoundBtn.classList.toggle('on', tapeRoundUp);
}
setTapeToggleUI();

/**
 * Utility: snap a value UP to the nearest step.
 * Example: snapUp(10.01, 0.125) => 10.125
 */
function snapUp(value, step) {
  return Math.ceil(value / step) * step;
}

/**
 * Tape calculation:
 * - take feet + whole inches + optional fraction chip
 * - optionally snap UP to the selected precision step (1/16 or 1/8)
 * - output Decimal Feet (Engineer Rule) to 0.001 ft
 */
function calcTape() {
  if (!tapeDecimal) return;

  const ft = Number(tapeFeet?.value) || 0;
  const inchesWhole = Number(tapeInches?.value) || 0;

  // Total inches = feet * 12 + whole inches + optional fraction chip
  let totalInches = (ft * 12) + inchesWhole + fracValue;

  // Precision snapping is optional in converter:
  // - default exact (building)
  // - user can turn on Round Up if they want conservative snapping
  if (tapeRoundUp) totalInches = snapUp(totalInches, fracStep);

  // Convert inches back to decimal feet
  const totalFeet = totalInches / 12;

  // Show engineer-rule style decimal feet
  tapeDecimal.textContent = totalFeet.toFixed(3) + ' ft';
}

/* Tape input listeners */
[tapeFeet, tapeInches].forEach(el => {
  if (!el) return;
  el.addEventListener('input', calcTape);
});

/* Fraction chip listeners (quick-add fractions) */
document.querySelectorAll('.frac').forEach(btn => {
  btn.addEventListener('click', () => {
    // Visual active state
    document.querySelectorAll('.frac').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Store selected chip value (in inches)
    fracValue = Number(btn.dataset.frac) || 0;

    calcTape();
  });
});

/* Toggle Round Up (converter only) */
tapeRoundBtn?.addEventListener('click', () => {
  tapeRoundUp = !tapeRoundUp;
  setTapeToggleUI();
  calcTape();
});


/* ============================================================
   SLOPE MODE
   Inputs: % grade and run (ft)
   Output: rise (ft)

   Note:
   - This is a "field safe" simple conversion.
============================================================ */
const slopePct = document.getElementById('slopePct');
const slopeRun = document.getElementById('slopeRun');
const slopeRise = document.getElementById('slopeRise');

function calcSlope() {
  if (!slopeRise) return;

  const pct = Number(slopePct?.value);
  const run = Number(slopeRun?.value);

  // If missing values, show a dash (prevents NaN junk UI)
  if (!pct || !run) {
    slopeRise.textContent = '—';
    return;
  }

  const rise = (pct / 100) * run;
  slopeRise.textContent = rise.toFixed(2) + ' ft';
}

[slopePct, slopeRun].forEach(el => {
  if (!el) return;
  el.addEventListener('input', calcSlope);
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
  calcTape();
  calcSlope();
  calcTons();
}

// Start listening for “return from Settings”
onReturnSync(syncConverterFromSettings);

// Initial calculation pass (prevents blank state feeling)
recalcAll();

