/* =====================================================
   STATE
===================================================== */
let currentShape = 'slab';
let truckCapacity = 9;
let continuous = false;

let currentItemYards = 0;
let totalYards = 0;

let material = 'concrete';
let roundUpLoads = true;

// Truck Defaults -> Over-Order %
// Bulk materials (rock/sand/topsoil/asphalt) often need a buffer to avoid coming up short.
// We DO NOT apply this to concrete here (concrete already rounds up loads).
let overOrderPct = 0;

const densityTonsPerYd = {
  // NOTE: These are estimates. Moisture/gradation/compaction can change real-world tonnage.
  concrete: null,
  rock: 1.35,
  sand: 1.30,
  topsoil: 0.90,
  asphalt: 1.25
};

/* =====================================================
   SETTINGS (LOAD DEFAULTS)
   - settings-store.js writes to localStorage
   - this file reads settings to change behavior WITHOUT refresh
===================================================== */
const S = window.FieldCalcSettings ? FieldCalcSettings.load() : null;

if (S) {
  // Truck default
  truckCapacity = Number(S.trucks.defaultCapacity) || truckCapacity;

  // Truck buffer (materials only)
  overOrderPct = Number(S.trucks.overOrderPct ?? 0);

  // Load rounding default behavior
  if (S.rounding.loadsDefault === 'up') roundUpLoads = true;
  if (S.rounding.loadsDefault === 'down') roundUpLoads = false;

  // Pull densities from settings (future-proof)
  densityTonsPerYd.rock = Number(S.materials.rock) || densityTonsPerYd.rock;
  densityTonsPerYd.sand = Number(S.materials.sand) || densityTonsPerYd.sand;
  densityTonsPerYd.topsoil = Number(S.materials.topsoil) || densityTonsPerYd.topsoil;
  densityTonsPerYd.asphalt = Number(S.materials.asphalt) || densityTonsPerYd.asphalt;
}

// askLoads controls whether the per-calc rounding toggle appears.
// If Settings says Always Up/Down, we hide the toggle (settings are authoritative).
let askLoads = S ? (S.rounding.loadsDefault === 'ask') : true;

/**
 * Re-reads settings from localStorage and applies them to our runtime state.
 * Called when returning from Settings (visibility/pageshow).
 */
function applySettingsToState() {
  const s = window.FieldCalcSettings ? FieldCalcSettings.load() : null;
  if (!s) return;

  // 1) Truck default
  truckCapacity = Number(s.trucks.defaultCapacity) || truckCapacity;

  // 1b) Truck buffer (materials only)
  overOrderPct = Number(s.trucks.overOrderPct ?? 0);

  // 2) Load rounding default
  if (s.rounding.loadsDefault === 'up') roundUpLoads = true;
  if (s.rounding.loadsDefault === 'down') roundUpLoads = false;

  askLoads = (s.rounding.loadsDefault === 'ask');

  // 3) Densities
  densityTonsPerYd.rock = Number(s.materials.rock) || densityTonsPerYd.rock;
  densityTonsPerYd.sand = Number(s.materials.sand) || densityTonsPerYd.sand;
  densityTonsPerYd.topsoil = Number(s.materials.topsoil) || densityTonsPerYd.topsoil;
  densityTonsPerYd.asphalt = Number(s.materials.asphalt) || densityTonsPerYd.asphalt;
}

/**
 * UI helper: ensures the active truck button matches the current truckCapacity state.
 */
function syncTruckCapacityButtons() {
  document.querySelectorAll('[data-cap]').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-cap="${truckCapacity}"]`);
  if (btn) btn.classList.add('active');
}

/* =====================================================
   ELEMENT REFERENCES
===================================================== */
const currentYardsEl = document.getElementById('currentYards');
const totalYardsEl = document.getElementById('totalYards');
const trucksEl = document.getElementById('trucks');
const remainderEl = document.getElementById('remainder');

const materialSelect = document.getElementById('material');
const roundingWrap = document.getElementById('roundingWrap');
const roundingToggle = document.getElementById('roundingToggle');
const tonsLineEl = document.getElementById('tonsLine');

const addItemBtn = document.getElementById('addItemBtn');
const clearPourBtn = document.getElementById('clearPourBtn');

const continuousToggle = document.getElementById('continuousToggle');
const runsWrap = document.getElementById('runsWrap');
const runsInput = document.getElementById('footing-runs');

/* =====================================================
   MATERIAL / ROUNDING (UI behavior)
===================================================== */
function updateShapeButtonsForMaterial() {
  const isConcrete = material === 'concrete';

  // Show/hide rounding toggle:
  // - Concrete: hidden (always rounds up loads)
  // - Materials: shown ONLY if Settings says "Ask Each Time"
  if (roundingWrap) roundingWrap.style.display = (!isConcrete && askLoads) ? 'flex' : 'none';

  // If the toggle is visible, keep its text + style in sync with roundUpLoads
  if (roundingToggle && !isConcrete && askLoads) {
    roundingToggle.textContent = roundUpLoads ? 'ROUND UP' : 'ROUND DOWN';
    roundingToggle.classList.toggle('on', roundUpLoads);
  }

  // Tons display: only for non-concrete materials
  if (tonsLineEl) tonsLineEl.style.display = isConcrete ? 'none' : 'block';

  // Hide shapes not used for truck materials (keeps UI tight)
  const hideForTruck = ['wall', 'curb'];
  document.querySelectorAll('[data-shape]').forEach(btn => {
    const shape = btn.getAttribute('data-shape');
    const shouldHide = !isConcrete && hideForTruck.includes(shape);
    btn.style.display = shouldHide ? 'none' : '';
  });

  // If the current shape is hidden, fall back to slab
  if (!isConcrete && (currentShape === 'wall' || currentShape === 'curb')) {
    currentShape = 'slab';
    document.querySelectorAll('[data-shape]').forEach(b => b.classList.remove('active'));
    const slabBtn = document.querySelector('[data-shape="slab"]');
    if (slabBtn) slabBtn.classList.add('active');
    continuous = false;
    if (continuousToggle) continuousToggle.textContent = 'Off';
    if (runsWrap) runsWrap.style.display = 'none';
  }

  // Relabel shapes for truck material mode (Tier A + B)
  const labelsConcrete = {
    slab: 'Slab',
    footing: 'Footing',
    wall: 'Wall / Column',
    curb: 'Curb',
    approach: 'Approach',
    column: 'Column (round)'
  };

  const labelsTruck = {
    slab: 'Pad / Area',
    footing: 'Trench / Strip',
    approach: 'Ditch / Taper',
    column: 'Round Hole'
  };

  document.querySelectorAll('[data-shape]').forEach(btn => {
    const shape = btn.getAttribute('data-shape');
    if (material === 'concrete') {
      if (labelsConcrete[shape]) btn.textContent = labelsConcrete[shape];
    } else {
      if (labelsTruck[shape]) btn.textContent = labelsTruck[shape];
      else if (labelsConcrete[shape]) btn.textContent = labelsConcrete[shape]; // fallback for any visible shapes
    }
  });
}

if (materialSelect) {
  materialSelect.addEventListener('change', () => {
    material = materialSelect.value;
    updateShapeButtonsForMaterial();
    calculate();
    updateTotals();
  });
}

if (roundingToggle) {
  roundingToggle.addEventListener('click', () => {
    roundUpLoads = !roundUpLoads;
    roundingToggle.textContent = roundUpLoads ? 'ROUND UP' : 'ROUND DOWN';
    roundingToggle.classList.toggle('on', roundUpLoads);
    updateTotals();
  });
}

// Initialize material-specific UI on first load
updateShapeButtonsForMaterial();

/* =====================================================
   SHAPE SWITCHING
===================================================== */
document.querySelectorAll('[data-shape]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-shape]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentShape = btn.dataset.shape;

    document.querySelectorAll('.shape').forEach(s => s.classList.remove('active'));
    document.querySelector(`.${currentShape}`).classList.add('active');

    // Keep the UI "live" while switching shapes
    calculate();
    updateTotals();
  });
});

/* =====================================================
   TRUCK CAPACITY
===================================================== */
document.querySelectorAll('[data-cap]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-cap]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    truckCapacity = Number(btn.dataset.cap);
    updateTotals();
  });
});

/* =====================================================
   CONTINUOUS FOOTING TOGGLE
===================================================== */
continuousToggle.addEventListener('click', () => {
  continuous = !continuous;

  continuousToggle.textContent = continuous ? 'ON' : 'OFF';
  continuousToggle.classList.toggle('on', continuous);
  runsWrap.style.display = continuous ? 'block' : 'none';

  if (!continuous) runsInput.value = 1;

  // Keep the UI "live" after toggling
  calculate();
  updateTotals();
});

/* =====================================================
   INPUT LISTENERS
   - Any input changes should update both the "current item"
     and the "pour totals" card so the app feels responsive.
===================================================== */
document.querySelectorAll('input').forEach(input =>
  input.addEventListener('input', () => {
    calculate();
    updateTotals(); // keeps bottom card responsive
  })
);

/* =====================================================
   MAIN CALCULATION (current item only)
===================================================== */
function calculate() {
  const waste = Number(document.getElementById('waste').value) / 100;
  let cubicFeet = 0;

  // ----- SLAB -----
  if (currentShape === 'slab') {
    const L = Number(document.getElementById('slab-length').value);
    const W = Number(document.getElementById('slab-width').value);
    const T = Number(document.getElementById('slab-thickness').value) / 12;
    if (!L || !W || !T) return resetCurrent();
    cubicFeet = L * W * T;
  }

  // ----- FOOTING -----
  if (currentShape === 'footing') {
    const L = Number(document.getElementById('footing-length').value);
    const W = Number(document.getElementById('footing-width').value) / 12;
    const D = Number(document.getElementById('footing-depth').value) / 12;
    const runs = continuous ? Number(runsInput.value) || 1 : 1;
    if (!L || !W || !D) return resetCurrent();
    cubicFeet = (L * runs) * W * D;
  }

  // ----- WALL -----
  if (currentShape === 'wall') {
    const L = Number(document.getElementById('wall-length').value);
    const H = Number(document.getElementById('wall-height').value);
    const T = Number(document.getElementById('wall-thickness').value) / 12;
    if (!L || !H || !T) return resetCurrent();
    cubicFeet = L * H * T;
  }

  // ----- CURB -----
  if (currentShape === 'curb') {
    const area = Number(document.getElementById('curb-type').value);
    const L = Number(document.getElementById('curb-length').value);

    if (!area || !L) return resetCurrent();

    cubicFeet = area * L;
  }

  // ----- DITCH / TAPER (TRAPEZOID PRISM) -----
  if (currentShape === 'approach') {
    const W = Number(document.getElementById('approach-width').value);
    const L = Number(document.getElementById('approach-length').value);
    const T1 = Number(document.getElementById('approach-top').value) / 12;
    const T2 = Number(document.getElementById('approach-bottom').value) / 12;

    if (!W || !L || !T1 || !T2) return resetCurrent();

    const avgThickness = (T1 + T2) / 2;
    cubicFeet = W * L * avgThickness;
  }

  // ----- CIRCULAR COLUMN -----
  if (currentShape === 'column') {
    const D = Number(document.getElementById('column-diameter').value) / 12;
    const H = Number(document.getElementById('column-height').value);
    const Q = Number(document.getElementById('column-qty').value) || 1;

    if (!D || !H || !Q) return resetCurrent();

    const radius = D / 2;
    const area = Math.PI * radius * radius;

    cubicFeet = area * H * Q;
  }

  // Apply waste
  cubicFeet += cubicFeet * waste;

  // Convert to yards
  currentItemYards = cubicFeet / 27;
  currentYardsEl.textContent = `${currentItemYards.toFixed(2)} yd³`;
}

/* =====================================================
   TOTAL / TRUCK CALCULATION (pour totals)
   IMPORTANT:
   - totalYards = what the user actually added (truth)
   - displayYards = optional buffered yards for materials ordering
===================================================== */
function updateTotals() {
  const isConcrete = material === 'concrete';

  // Apply buffer ONLY for non-concrete materials
  // This is the "ordering" safety factor (ex: 5% extra rock).
  const bufferMultiplier = (!isConcrete && overOrderPct > 0)
    ? (1 + (overOrderPct / 100))
    : 1;

  // displayYards is what we show + use for truck math
  const displayYards = totalYards * bufferMultiplier;

  totalYardsEl.textContent = `${displayYards.toFixed(2)} yd³`;

  if (displayYards === 0) {
    trucksEl.textContent = '0 trucks';
    remainderEl.textContent = '';
    if (tonsLineEl) tonsLineEl.textContent = '';
    return;
  }

  const rawLoads = displayYards / truckCapacity;

  // Concrete: always round up (ordering behavior)
  // Materials: user-controlled rounding (unless Settings locks it)
  const loads = isConcrete
    ? Math.ceil(rawLoads)
    : (roundUpLoads ? Math.ceil(rawLoads) : Math.floor(rawLoads));

  const remainder = displayYards % truckCapacity;

  trucksEl.textContent = `${loads} trucks`;

  if (!isConcrete && !roundUpLoads && remainder) {
    remainderEl.textContent = `Unassigned: ${remainder.toFixed(2)} yd³`;
  } else {
    remainderEl.textContent = remainder ? `Last load: ${remainder.toFixed(2)} yd³` : '';
  }

  // Tons estimate for non-concrete materials (uses buffered displayYards)
  const density = densityTonsPerYd[material];
  if (tonsLineEl) {
    if (!isConcrete && density) {
      const tons = displayYards * density;
      tonsLineEl.textContent = `Estimated: ${tons.toFixed(1)} tons`;
    } else {
      tonsLineEl.textContent = '';
    }
  }
}

/* =====================================================
   BUTTON ACTIONS
===================================================== */
addItemBtn.addEventListener('click', () => {
  if (!currentItemYards) return;
  totalYards += currentItemYards;
  updateTotals();
});

clearPourBtn.addEventListener('click', () => {
  totalYards = 0;
  updateTotals();
});

/* =====================================================
   HELPERS
===================================================== */
function resetCurrent() {
  currentItemYards = 0;
  currentYardsEl.textContent = '0.00 yd³';
}

/* =====================================================
   SYNC SETTINGS (no swipe refresh)
   We sync when returning from Settings using:
   - visibilitychange
   - pageshow (bfcache restore on mobile)
   - storage (optional multi-tab)
===================================================== */
function onReturnSync(syncFn) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncFn();
  });

  window.addEventListener('pageshow', () => syncFn());

  window.addEventListener('storage', (e) => {
    if (e.key && e.key.includes('gloveson_fieldcalc_settings')) syncFn();
  });
}

function syncCalculatorFromSettings() {
  applySettingsToState();
  syncTruckCapacityButtons();
  updateShapeButtonsForMaterial();
  calculate();
  updateTotals();
}

onReturnSync(syncCalculatorFromSettings);
