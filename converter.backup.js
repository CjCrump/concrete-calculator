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
    // Clear tape auto-display when switching tabs (prevents stale outputs)
  if (btn.dataset.mode !== 'tape') {
   if (tapePrettyOut) tapePrettyOut.value = '—';
  }


    recalcAll();
  });
});

/* ============================================================
   TAPE MODE (Clean separation)
   PRIMARY:   Engineer -> Tape (user types decimal feet)
   SECONDARY: Tape -> Engineer (user types ft / inches / fraction)

   IMPORTANT SEPARATION:
   - Snap buttons + Round Up are PREFERENCES (never changed by results)
   - Fraction buttons are USER INPUT for tape fraction
   - Auto output (green) is shown in #tapePrettyOut only

   Behavior:
   - Any typing on one side updates the other side instantly
   - Auto display resets on refresh / tab switch / reset button
============================================================ */

// ---------- DOM ----------
const engFeetIn = document.getElementById('engFeetIn');

const tapeFeet = document.getElementById('tapeFeet');
const tapeInches = document.getElementById('tapeInches');

const tapeFrac = document.getElementById('tapeFrac');                // USER input (free text)
const snapButtons = document.getElementById('snapButtons');          // Preference

const tapeRoundBtn = document.getElementById('tapeRound');
const tapePrettyOut = document.getElementById('tapePrettyOut');

const tapeResetBtn = document.getElementById('tapeResetBtn');

// ---------- State ----------
let tapeLastEdited = 'eng'; // 'eng' | 'tape'
let tapeRoundUp = (S.rounding.tapeMode === 'up');

// USER input fraction (inches) parsed from tapeFrac text
let fracInputValue = 0; // decimal inches (0.0 .. <1.0)


// Preference: snap override (inches). null = use settings default (fracStep).
let snapOverrideStep = null;

// ---------- Helpers ----------
function setAuto(el, on) {
  if (!el) return;
  el.classList.toggle('auto', !!on);
}

function setTapeToggleUI() {
  if (!tapeRoundBtn) return;
  tapeRoundBtn.textContent = tapeRoundUp ? 'ON' : 'OFF';
  tapeRoundBtn.classList.toggle('on', tapeRoundUp);
}

function snapUp(value, step) {
  return Math.ceil(value / step) * step;
}
function snapNearest(value, step) {
  return Math.round(value / step) * step;
}

function getSnapStep() {
  // Default from Settings: fracStep (1/16 or 1/8)
  // Override if user selects snap buttons
  return snapOverrideStep || fracStep;
}

function highlightButtons(container, attr, selectedStr) {
  if (!container) return;
  container.querySelectorAll('button').forEach(b => {
    b.classList.toggle('active', b.getAttribute(attr) === selectedStr);
  });
}

function formatTapePretty(totalInches, stepUsed) {
  // totalInches already snapped
  const ft = Math.floor(totalInches / 12);
  const remIn = totalInches - (ft * 12);

  const denom = Math.round(1 / stepUsed); // 16/8/4/2 depending on step
  const wholeIn = Math.floor(remIn);
  const frac = remIn - wholeIn;

  let num = Math.round(frac * denom);

  // Carry
  if (num === denom) {
    return `${ft}' ${wholeIn + 1}"`;
  }
  if (num === 0) {
    return `${ft}' ${wholeIn}"`;
  }

  return `${ft}' ${wholeIn} ${num}/${denom}"`;
}

function updatePrettyDisplay(totalInches, stepUsed) {
  if (!tapePrettyOut) return;
  tapePrettyOut.value = formatTapePretty(totalInches, stepUsed);
  setAuto(tapePrettyOut, true); // always a result field
}

function resetTapeUI() {
  if (engFeetIn) engFeetIn.value = '';
  if (tapeFeet) tapeFeet.value = '';
  if (tapeInches) tapeInches.value = '';
  if (tapePrettyOut) tapePrettyOut.value = '—';

  // Remove auto from editable fields
  setAuto(engFeetIn, false);
  setAuto(tapeFeet, false);
  setAuto(tapeInches, false);

  // Reset user fraction input + preference snap
  fracInputValue = 0;
  snapOverrideStep = null;

  if (tapeFrac) tapeFrac.value = '';
    setAuto(tapeFrac, false);

  highlightButtons(snapButtons, 'data-snap', 'default');

  tapeLastEdited = 'eng';
}

// ---------- Core calculations ----------
function calcEngineerToTape() {
  if (!engFeetIn || !tapeFeet || !tapeInches || !tapeFrac) return;

  const raw = engFeetIn.value;

  // If user cleared engineer, clear tape outputs too.
  if (raw === '') {
    tapeFeet.value = '';
    tapeInches.value = '';
    tapeFrac.value = '';
    if (tapePrettyOut) tapePrettyOut.value = '—';

    setAuto(tapeFeet, false);
    setAuto(tapeInches, false);
    setAuto(tapeFrac, false);
    setAuto(tapePrettyOut, false);
    return;
  }

  const decFeet = Number(raw);
  if (Number.isNaN(decFeet)) return;

  // Convert decimal feet -> inches
  let totalInches = decFeet * 12;

  // Apply snap preference + rounding preference
  const stepUsed = getSnapStep();
  totalInches = tapeRoundUp ? snapUp(totalInches, stepUsed) : snapNearest(totalInches, stepUsed);

  // Fill tape fields (including snapped fraction)
  // NOTE: this is a RESULT write, so these fields go green.
  setTapeFieldsFromTotalInches(totalInches, stepUsed, true);

  // IMPORTANT: do NOT change snap buttons based on results.
}

function calcTapeToEngineer() {
  if (!engFeetIn || !tapeFeet || !tapeInches || !tapeFrac) return;

  // If user cleared everything, clear outputs too.
  const allEmpty = (tapeFeet.value === '' && tapeInches.value === '' && tapeFrac.value === '');
  if (allEmpty) {
    engFeetIn.value = '';
    if (tapePrettyOut) tapePrettyOut.value = '—';
    setAuto(engFeetIn, false);
    setAuto(tapePrettyOut, false);
    return;
  }

  const ft = Number(tapeFeet.value) || 0;
  const inch = Number(tapeInches.value) || 0;

  // total inches includes USER fraction input (parsed from #tapeFrac)
  let totalInches = (ft * 12) + inch + fracInputValue;

  // Apply snap preference + rounding preference
  const stepUsed = getSnapStep();
  totalInches = tapeRoundUp ? snapUp(totalInches, stepUsed) : snapNearest(totalInches, stepUsed);

  // Engineer = tenths
  const totalFeet = totalInches / 12;
  engFeetIn.value = totalFeet.toFixed(1);

  setAuto(engFeetIn, true);

  // Pretty display shows snapped tape
  updatePrettyDisplay(totalInches, stepUsed);
}

function recalcTape() {
  if (tapeLastEdited === 'eng') {
    // User typed engineer -> engineer is not “auto”
    setAuto(engFeetIn, false);
    calcEngineerToTape();
  } else {
    // User typed tape -> tape inputs are not “auto”
    setAuto(tapeFeet, false);
    setAuto(tapeInches, false);
    setAuto(tapeFrac, false);
    calcTapeToEngineer();
  }
}

// ---------- Listeners ----------
engFeetIn?.addEventListener('input', () => {
  tapeLastEdited = 'eng';
  recalcTape();
});

[tapeFeet, tapeInches].forEach(el => {
  el?.addEventListener('input', () => {
    tapeLastEdited = 'tape';
    recalcTape();
  });
});

// Fraction field is a first-class input (user can type 1/32, 3/16, 0.125, etc.)
tapeFrac?.addEventListener('input', () => {
  tapeLastEdited = 'tape';

  // While user is typing, this is NOT "auto" (green).
  setAuto(tapeFrac, false);

  // Parse and store as decimal inches (0.0 .. <1.0)
  fracInputValue = parseFractionToInches(tapeFrac.value);

  recalcTape();
});

/**
 * Parse a fraction string into decimal inches.
 * Accepts:
 * - "1/32"
 * - "3/16"
 * - "0.125"
 * - "" (treated as 0)
 */
function parseFractionToInches(raw) {
  if (!raw) return 0;

  const s = String(raw).trim();
  if (s === '' || s === '-' || s === '—') return 0;

  // Decimal input allowed
  if (!s.includes('/')) {
    const n = Number(s);
    if (Number.isNaN(n)) return 0;
    return Math.min(0.999999, Math.max(0, n));
  }

  // Fraction input
  const parts = s.split('/');
  if (parts.length !== 2) return 0;

  const num = Number(parts[0].trim());
  const den = Number(parts[1].trim());
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;

  const v = num / den;
  return Math.min(0.999999, Math.max(0, v));
}

/**
 * Return ONLY the snapped fraction string for the remainder inches.
 * Example: remIn=3.0625 step=1/16 => "1/16"
 */
function snappedFractionText(remInches, stepUsed) {
  const denom = Math.round(1 / stepUsed);
  const whole = Math.floor(remInches);
  const frac = remInches - whole;

  let n = Math.round(frac * denom);
  if (n === denom) n = 0; // carry handled elsewhere
  if (n === 0) return '';

  return `${n}/${denom}`;
}

/**
 * Write fraction text back into the user fraction field.
 * This is intentional: user enters 1/32, snap=1/16 => field becomes 1/16.
 */
function setTapeFieldsFromTotalInches(totalInches, stepUsed, markAsAuto = true) {
  if (!tapeFeet || !tapeInches || !tapeFrac) return;

  const ft = Math.floor(totalInches / 12);
  const remIn = totalInches - (ft * 12);

  const wholeIn = Math.floor(remIn);
  const fracText = snappedFractionText(remIn, stepUsed); // e.g. "1/16" or ""

  // Write outputs
  tapeFeet.value = String(ft);
  tapeInches.value = String(wholeIn);
  tapeFrac.value = fracText;

  // Keep internal fraction state synced to what's displayed
  fracInputValue = parseFractionToInches(fracText);

  // Green highlighting only when these are "result fields"
  setAuto(tapeFeet, markAsAuto);
  setAuto(tapeInches, markAsAuto);
  setAuto(tapeFrac, markAsAuto);

  updatePrettyDisplay(totalInches, stepUsed);
}

// Snap preference buttons (do not auto-change from results)
snapButtons?.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const snapStr = btn.getAttribute('data-snap');

  // "default" means use settings fracStep
  if (snapStr === 'default') {
    snapOverrideStep = null;
  } else {
    snapOverrideStep = Number(snapStr);
  }

  highlightButtons(snapButtons, 'data-snap', snapStr);

  // Recalc using the new snap preference
  recalcTape();
});

// Round Up toggle (preference)
tapeRoundBtn?.addEventListener('click', () => {
  tapeRoundUp = !tapeRoundUp;
  setTapeToggleUI();
  recalcTape();
});

// Reset
tapeResetBtn?.addEventListener('click', () => {
  resetTapeUI();
});

// Init
setTapeToggleUI();
resetTapeUI();


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
