/* =====================================================
   GlovesON FieldCalc — Calculator (app.js)
   -----------------------------------------------------
   GOAL: Mobile-first “jobsite tool” behavior.

   Key idea:
   - This calculator is for ORDERING.
   - Converter is for BUILDING precision.

   This file handles:
   - Shape volume -> cubic yards
   - Pour totals (sum of added items)
   - Truck loads + remainder
   - Material tons estimate
   - Settings responsiveness (no swipe refresh)
   - Optional (feature-toggled): Concrete Bags helper
===================================================== */

/* =====================================================
   1) STATE (app runtime)
===================================================== */
let currentShape = 'slab';
let truckCapacity = 9;        // default if settings are missing
let continuous = false;       // continuous footing runs mode

let currentItemYards = 0;     // current shape yards
let totalYards = 0;           // poured total yards (truth source)

let material = 'concrete';    // 'concrete' | 'rock' | 'sand' | 'topsoil' | 'asphalt'
let roundUpLoads = true;      // non-concrete rounding if “Ask Each Time” is enabled

// Truck Defaults -> Over-Order % (materials only)
// Example: 10 yd of rock + 5% buffer => display 10.5 yd for ordering
let overOrderPct = 0;

/* =====================================================
   2) BAG MIX (Concrete-only helper)
   -----------------------------------------------------
   Why:
   - Sometimes a crew is mixing bags, not ordering ready-mix trucks.
   - We keep this hidden unless user enables it in Settings.
===================================================== */

// Bag selection (lbs). Default is 80 (common on jobsite).
let bagSizeLbs = 80;

// Feature toggle pulled from Settings:
// If false, Bags UI stays hidden even when Concrete is selected.
let bagsEnabled = false;

// Approximate yield per bag (cubic feet of concrete per bag)
// NOTE: These are commonly-used estimates, not lab-certified.
const BAG_YIELD_FT3 = {
  40: 0.30,
  50: 0.375,
  60: 0.45,
  80: 0.60,
  90: 0.675
};

// -----------------------------------------------------
// FUTURE (Pro-ready hook):
// Admixtures toggle & dosage presets.
// For MVP launch, the UI is hidden in index.html.
// We keep the variables + constants so re-enabling later is easy.
// -----------------------------------------------------
let admixturesOn = false;
const ADMIX_OZ_PER_YD3 = 16; // placeholder default dosage
const OZ_PER_GAL = 128;

/* =====================================================
   3) MATERIAL DENSITIES (tons per cubic yard)
   -----------------------------------------------------
   These are estimates. Moisture + gradation changes tonnage.
===================================================== */
const densityTonsPerYd = {
  concrete: null,
  rock: 1.35,
  sand: 1.30,
  topsoil: 0.90,
  asphalt: 1.25
};

/* =====================================================
   4) SETTINGS (load once + re-sync on return)
===================================================== */
const S = window.FieldCalcSettings ? FieldCalcSettings.load() : null;

// If settings exist, override defaults.
if (S) {
  truckCapacity = Number(S.trucks.defaultCapacity) || truckCapacity;
  overOrderPct = Number(S.trucks.overOrderPct ?? 0);

  // Feature toggles
  bagsEnabled = S.features?.enableBags === true;

  if (S.rounding.loadsDefault === 'up') roundUpLoads = true;
  if (S.rounding.loadsDefault === 'down') roundUpLoads = false;

  densityTonsPerYd.rock = Number(S.materials.rock) || densityTonsPerYd.rock;
  densityTonsPerYd.sand = Number(S.materials.sand) || densityTonsPerYd.sand;
  densityTonsPerYd.topsoil = Number(S.materials.topsoil) || densityTonsPerYd.topsoil;
  densityTonsPerYd.asphalt = Number(S.materials.asphalt) || densityTonsPerYd.asphalt;
}

// askLoads controls whether the per-calc rounding toggle appears.
// If settings lock Always Up/Down, we hide the toggle (settings authoritative).
let askLoads = S ? (S.rounding.loadsDefault === 'ask') : true;

/**
 * Re-reads settings from storage and applies to runtime state.
 * Called when returning from Settings via onReturnSync().
 */
function applySettingsToState() {
  const s = window.FieldCalcSettings ? FieldCalcSettings.load() : null;
  if (!s) return;

  truckCapacity = Number(s.trucks.defaultCapacity) || truckCapacity;
  overOrderPct = Number(s.trucks.overOrderPct ?? 0);

  // Feature toggles
  bagsEnabled = s.features?.enableBags === true;

  if (s.rounding.loadsDefault === 'up') roundUpLoads = true;
  if (s.rounding.loadsDefault === 'down') roundUpLoads = false;

  askLoads = (s.rounding.loadsDefault === 'ask');

  densityTonsPerYd.rock = Number(s.materials.rock) || densityTonsPerYd.rock;
  densityTonsPerYd.sand = Number(s.materials.sand) || densityTonsPerYd.sand;
  densityTonsPerYd.topsoil = Number(s.materials.topsoil) || densityTonsPerYd.topsoil;
  densityTonsPerYd.asphalt = Number(s.materials.asphalt) || densityTonsPerYd.asphalt;
}

/* =====================================================
   5) DOM REFERENCES
===================================================== */
const currentYardsEl = document.getElementById('currentYards');
const totalYardsEl = document.getElementById('totalYards');
const trucksEl = document.getElementById('trucks');
const remainderEl = document.getElementById('remainder');
const tonsLineEl = document.getElementById('tonsLine');

const materialSelect = document.getElementById('material');
const roundingWrap = document.getElementById('roundingWrap');
const roundingToggle = document.getElementById('roundingToggle');

const addItemBtn = document.getElementById('addItemBtn');
const clearPourBtn = document.getElementById('clearPourBtn');

const continuousToggle = document.getElementById('continuousToggle');
const runsWrap = document.getElementById('runsWrap');
const runsInput = document.getElementById('footing-runs');

const wasteWrap = document.getElementById('wasteWrap');
// Density UI (materials only)
const densityWrap = document.getElementById('densityWrap');
const densitySlider = document.getElementById('densitySlider');
const densityNumber = document.getElementById('densityNumber');
const densityValue = document.getElementById('densityValue');

// Easy picker buttons for lists (big UI)
const bagPickerBtn = document.getElementById('bagPickerBtn');
const curbPickerBtn = document.getElementById('curbPickerBtn');

// Bags UI
const bagsWrap = document.getElementById('bagsWrap');
const bagSizeSelect = document.getElementById('bagSize');
const bagsLineEl = document.getElementById('bagsLine');

// Admixtures UI is currently hidden in index.html for MVP launch.
// Keeping these refs reserved so we can re-enable later without refactoring.
const admixtureToggle = document.getElementById('admixtureToggle');
const admixtureLineEl = document.getElementById('admixtureLine');
// =====================================================
// EASY MODE PICKER (full-screen forced selection)
// - Material picker (always available)
// - Bag size picker (only when Bags enabled + Concrete)
// =====================================================
const materialPickerBtn = document.getElementById('materialPickerBtn');

const pickerOverlay = document.getElementById('pickerOverlay');
const pickerTitle = document.getElementById('pickerTitle');
const pickerOptions = document.getElementById('pickerOptions');

// -----------------------------------------------------
// Keep the visible "Material" easy-mode button in sync
// with the hidden <select> value.
// -----------------------------------------------------
function syncMaterialButtonLabel() {
  if (!materialPickerBtn || !materialSelect) return;

  const labelMap = {
    concrete: 'Concrete',
    rock: 'Rock',
    sand: 'Sand',
    topsoil: 'Topsoil',
    asphalt: 'Asphalt'
  };

  materialPickerBtn.textContent = labelMap[materialSelect.value] || 'Select Material';
}

// BAG SIZE: big picker opens modal (only matters if bags enabled + concrete)
bagPickerBtn?.addEventListener('click', () => {
  openPicker({
    title: 'Select Bag Size',
    options: [
      { value: '80', label: '80 lb' },
      { value: '60', label: '60 lb' },
      { value: '50', label: '50 lb' },
      { value: '40', label: '40 lb' },
      { value: '90', label: '90 lb' }
    ],
    onPick: (value) => {
      bagSizeSelect.value = value;
      bagSizeLbs = Number(value) || 80;
      syncBagButtonLabel();
      updateTotals();
    }
  });
});

// CURB TYPE: big picker opens modal
curbPickerBtn?.addEventListener('click', () => {
  openPicker({
    title: 'Select Curb Type',
    options: [
      { value: '1.50', label: 'B6-18 (standard)' },
      { value: '1.10', label: 'B6-12' },
      { value: '0.85', label: 'B4-12' },
      { value: '2.25', label: 'Valley Gutter' }
    ],
    onPick: (value, label) => {
      const curbSelect = document.getElementById('curb-type');
      if (!curbSelect) return;

      curbSelect.value = value;
      curbPickerBtn.textContent = label;

      calculate();
      updateTotals();
    }
  });
});

function syncBagButtonLabel() {
  if (!bagPickerBtn || !bagSizeSelect) return;
  bagPickerBtn.textContent = `${bagSizeSelect.value} lb`;
}

function syncCurbButtonLabel() {
  if (!curbPickerBtn) return;
  // Pull label from selected option text
  const opt = document.querySelector('#curb-type option:checked');
  curbPickerBtn.textContent = opt ? opt.textContent : 'Select Curb Type';
}

/**
 * Sync density UI to current material:
 * - Only used for rock/sand/topsoil/asphalt tons estimate
 */
function syncDensityUI() {
  if (!densitySlider || !densityNumber || !densityValue) return;

  const d = densityTonsPerYd[material];
  if (!d) {
    densitySlider.value = 1.35;
    densityNumber.value = 1.35;
    densityValue.textContent = '—';
    return;
  }

  densitySlider.value = Number(d).toFixed(2);
  densityNumber.value = Number(d).toFixed(2);
  densityValue.textContent = Number(d).toFixed(2);
}

// Helper: open modal and force selection
function openPicker({ title, options, onPick }) {
  if (!pickerOverlay || !pickerTitle || !pickerOptions) return;

  pickerTitle.textContent = title;
  pickerOptions.innerHTML = '';

  options.forEach(opt => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn picker-opt';
    b.textContent = opt.label;

    b.addEventListener('click', () => {
      onPick(opt.value, opt.label);
      pickerOverlay.classList.add('hidden'); // close ONLY after selection
    });

    pickerOptions.appendChild(b);
  });

  pickerOverlay.classList.remove('hidden');
}

// MATERIAL: big button opens modal
materialPickerBtn?.addEventListener('click', () => {
  openPicker({
    title: 'Select Material',
    options: [
      { value: 'concrete', label: 'Concrete' },
      { value: 'rock', label: 'Rock' },
      { value: 'sand', label: 'Sand' },
      { value: 'topsoil', label: 'Topsoil' },
      { value: 'asphalt', label: 'Asphalt' }
    ],
    onPick: (value, label) => {
      // Sync hidden <select> so existing logic stays unchanged
      materialSelect.value = value;
        material = value;

      // single source of truth for label rendering
      syncMaterialButtonLabel();

      updateShapeButtonsForMaterial();
      calculate();
      updateTotals();
    }
  });
});

/* =====================================================
   6) UI HELPERS
===================================================== */

/**
 * Highlight correct truck button based on truckCapacity.
 * Called on load AND when settings change.
 */
function syncTruckCapacityButtons() {
  document.querySelectorAll('[data-cap]').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-cap="${truckCapacity}"]`);
  if (btn) btn.classList.add('active');
}

/**
 * Material rules:
 * - Concrete shows full shape set + hides tons
 * - Materials hide wall/curb + show tons
 * - Rounding toggle only appears when “Ask Each Time” is enabled in Settings
 * - Bags helper appears only when Concrete AND enabled in Settings
 */
function updateShapeButtonsForMaterial() {
  // -----------------------------------------------------
  // IMPORTANT: compute these fresh every time this runs
  // -----------------------------------------------------
  const isConcrete = (material === 'concrete');
const wasteAllowed = (material === 'concrete' || material === 'asphalt');

// Materials that need density (tons estimate). Concrete is excluded.
const densityAllowed = (material === 'rock' || material === 'sand' || material === 'topsoil' || material === 'asphalt');

// Waste UI only for Concrete + Asphalt
if (wasteWrap) wasteWrap.style.display = wasteAllowed ? 'flex' : 'none';

// Density UI for non-concrete ton materials
if (densityWrap) densityWrap.classList.toggle('hidden', !densityAllowed);

// Keep density controls synced when switching materials
if (densityAllowed) syncDensityUI();


  // Loads rounding toggle only for NON-concrete materials (and only if Ask Each Time)
  if (roundingWrap) roundingWrap.style.display = (!isConcrete && askLoads) ? 'flex' : 'none';


  if (roundingToggle && !isConcrete && askLoads) {
    roundingToggle.textContent = roundUpLoads ? 'ROUND UP' : 'ROUND DOWN';
    roundingToggle.classList.toggle('on', roundUpLoads);
  }

  // --- Tons line (materials only) ---
  if (tonsLineEl) tonsLineEl.style.display = isConcrete ? 'none' : 'block';

  // --- Bags visibility rule (single source of truth) ---
  // Only show when:
  // 1) Concrete is selected AND
  // 2) Settings.features.enableBags is true
  if (bagsWrap) bagsWrap.classList.toggle('hidden', !isConcrete || !bagsEnabled);

  // --- Hide certain shapes for truck materials ---
  const hideForTruck = ['wall', 'curb'];
  document.querySelectorAll('[data-shape]').forEach(btn => {
    const shape = btn.getAttribute('data-shape');
    const shouldHide = !isConcrete && hideForTruck.includes(shape);
    btn.style.display = shouldHide ? 'none' : '';
  });

  // If the current shape becomes hidden, fall back to slab
  if (!isConcrete && (currentShape === 'wall' || currentShape === 'curb')) {
    currentShape = 'slab';

    document.querySelectorAll('[data-shape]').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-shape="slab"]')?.classList.add('active');

    continuous = false;
    if (continuousToggle) {
      continuousToggle.textContent = 'OFF';
      continuousToggle.classList.remove('on');
    }
    if (runsWrap) runsWrap.style.display = 'none';

    document.querySelectorAll('.shape').forEach(s => s.classList.remove('active'));
    document.querySelector('.slab')?.classList.add('active');
  }

  // --- Relabel shapes in materials mode ---
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
    if (isConcrete) {
      if (labelsConcrete[shape]) btn.textContent = labelsConcrete[shape];
    } else {
      if (labelsTruck[shape]) btn.textContent = labelsTruck[shape];
      else if (labelsConcrete[shape]) btn.textContent = labelsConcrete[shape];
    }
  });
}

/* =====================================================
   7) EVENT LISTENERS
===================================================== */

materialSelect?.addEventListener('change', () => {
  material = materialSelect.value;

  // Keep big easy-mode button text correct
  syncMaterialButtonLabel();

  updateShapeButtonsForMaterial();
  calculate();
  updateTotals();
});

function clampDensity(v) {
  // Clamp to 0.50–2.00 and snap to 0.05 increments
  const min = 0.5, max = 2.0, step = 0.05;
  const clamped = Math.min(max, Math.max(min, v));
  return Math.round(clamped / step) * step;
}

function saveDensityForCurrentMaterial(nextDensity) {
  // Save into settings-store so it persists (Material Presets)
  const s = window.FieldCalcSettings ? FieldCalcSettings.load() : null;
  if (!s) return;

  if (!s.materials) s.materials = {};
  s.materials[material] = nextDensity;
  FieldCalcSettings.save(s);

  // Update runtime state too
  densityTonsPerYd[material] = nextDensity;
}

densitySlider?.addEventListener('input', () => {
  const next = clampDensity(Number(densitySlider.value));
  if (densityNumber) densityNumber.value = next.toFixed(2);
  if (densityValue) densityValue.textContent = next.toFixed(2);

  saveDensityForCurrentMaterial(next);
  updateTotals();
});

densityNumber?.addEventListener('input', () => {
  const next = clampDensity(Number(densityNumber.value));
  if (densitySlider) densitySlider.value = next.toFixed(2);
  if (densityValue) densityValue.textContent = next.toFixed(2);

  saveDensityForCurrentMaterial(next);
  updateTotals();
});

roundingToggle?.addEventListener('click', () => {
  roundUpLoads = !roundUpLoads;
  roundingToggle.textContent = roundUpLoads ? 'ROUND UP' : 'ROUND DOWN';
  roundingToggle.classList.toggle('on', roundUpLoads);
  updateTotals();
});

document.querySelectorAll('[data-shape]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-shape]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentShape = btn.dataset.shape;
    document.querySelectorAll('.shape').forEach(s => s.classList.remove('active'));
    document.querySelector(`.${currentShape}`)?.classList.add('active');

    calculate();
    updateTotals();
  });
});

document.querySelectorAll('[data-cap]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-cap]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    truckCapacity = Number(btn.dataset.cap);
    updateTotals();
  });
});

continuousToggle?.addEventListener('click', () => {
  continuous = !continuous;

  continuousToggle.textContent = continuous ? 'ON' : 'OFF';
  continuousToggle.classList.toggle('on', continuous);
  if (runsWrap) runsWrap.style.display = continuous ? 'block' : 'none';

  if (!continuous && runsInput) runsInput.value = 1;

  calculate();
  updateTotals();
});

document.querySelectorAll('input').forEach(input =>
  input.addEventListener('input', () => {
    calculate();
    updateTotals();
  })
);

// Bag size dropdown (only matters if bags are enabled)
bagSizeSelect?.addEventListener('change', () => {
  bagSizeLbs = Number(bagSizeSelect.value) || 80;
  updateTotals();
});

// -----------------------------------------------------
// FUTURE (Pro-ready hook):
// Admixtures toggle listener.
// UI is hidden for MVP launch, so we comment this out for now.
// -----------------------------------------------------
/*
admixtureToggle?.addEventListener('click', () => {
  admixturesOn = !admixturesOn;

  admixtureToggle.textContent = admixturesOn ? 'ON' : 'OFF';
  admixtureToggle.classList.toggle('on', admixturesOn);

  updateTotals();
});
*/

addItemBtn?.addEventListener('click', () => {
  if (!currentItemYards) return;
  totalYards += currentItemYards;
  updateTotals();
});

clearPourBtn?.addEventListener('click', () => {
  totalYards = 0;
  updateTotals();
});

/* =====================================================
   8) CALCULATIONS
===================================================== */

function resetCurrent() {
  currentItemYards = 0;
  if (currentYardsEl) currentYardsEl.textContent = '0.00 yd³';
}

function calculate() {
    // =====================================================
  // Waste rule (lock-in):
  // - Waste applies to CONCRETE and ASPHALT only
  // - Rock / sand / topsoil should NOT add waste by default
  //   (those are usually handled via over-order % / buffer instead)
  // =====================================================
  const wasteAllowed = (material === 'concrete' || material === 'asphalt');

  const wastePctRaw = Number(document.getElementById('waste')?.value) || 0;
  const wastePct = wasteAllowed ? wastePctRaw : 0;
  const waste = wastePct / 100;


  let cubicFeet = 0;

  if (currentShape === 'slab') {
    const L = Number(document.getElementById('slab-length')?.value);
    const W = Number(document.getElementById('slab-width')?.value);
    const T = Number(document.getElementById('slab-thickness')?.value) / 12;
    if (!L || !W || !T) return resetCurrent();
    cubicFeet = L * W * T;
  }

  if (currentShape === 'footing') {
    const L = Number(document.getElementById('footing-length')?.value);
    const W = Number(document.getElementById('footing-width')?.value) / 12;
    const D = Number(document.getElementById('footing-depth')?.value) / 12;
    const runs = continuous ? (Number(runsInput?.value) || 1) : 1;
    if (!L || !W || !D) return resetCurrent();
    cubicFeet = (L * runs) * W * D;
  }

  if (currentShape === 'wall') {
    const L = Number(document.getElementById('wall-length')?.value);
    const H = Number(document.getElementById('wall-height')?.value);
    const T = Number(document.getElementById('wall-thickness')?.value) / 12;
    if (!L || !H || !T) return resetCurrent();
    cubicFeet = L * H * T;
  }

  if (currentShape === 'curb') {
    const area = Number(document.getElementById('curb-type')?.value);
    const L = Number(document.getElementById('curb-length')?.value);
    if (!area || !L) return resetCurrent();
    cubicFeet = area * L;
  }

  if (currentShape === 'approach') {
    const W = Number(document.getElementById('approach-width')?.value);
    const L = Number(document.getElementById('approach-length')?.value);
    const T1 = Number(document.getElementById('approach-top')?.value) / 12;
    const T2 = Number(document.getElementById('approach-bottom')?.value) / 12;
    if (!W || !L || !T1 || !T2) return resetCurrent();
    const avgThickness = (T1 + T2) / 2;
    cubicFeet = W * L * avgThickness;
  }

  if (currentShape === 'column') {
    const D = Number(document.getElementById('column-diameter')?.value) / 12;
    const H = Number(document.getElementById('column-height')?.value);
    const Q = Number(document.getElementById('column-qty')?.value) || 1;
    if (!D || !H || !Q) return resetCurrent();
    const radius = D / 2;
    const area = Math.PI * radius * radius;
    cubicFeet = area * H * Q;
  }

  cubicFeet += cubicFeet * waste;

  currentItemYards = cubicFeet / 27;
  if (currentYardsEl) currentYardsEl.textContent = `${currentItemYards.toFixed(2)} yd³`;
}

function updateTotals() {
  const isConcrete = material === 'concrete';

  // Materials-only buffer
  const bufferMultiplier = (!isConcrete && overOrderPct > 0)
    ? (1 + (overOrderPct / 100))
    : 1;

  const displayYards = totalYards * bufferMultiplier;

  if (totalYardsEl) totalYardsEl.textContent = `${displayYards.toFixed(2)} yd³`;

  if (displayYards === 0) {
    if (trucksEl) trucksEl.textContent = '0 trucks';
    if (remainderEl) remainderEl.textContent = '';
    if (tonsLineEl) tonsLineEl.textContent = '';

    if (bagsLineEl) bagsLineEl.textContent = '';
    if (admixtureLineEl) admixtureLineEl.textContent = '';
    return;
  }

  const rawLoads = displayYards / truckCapacity;

  const loads = isConcrete
    ? Math.ceil(rawLoads)
    : (roundUpLoads ? Math.ceil(rawLoads) : Math.floor(rawLoads));

  const remainder = displayYards % truckCapacity;

  if (trucksEl) trucksEl.textContent = `${loads} trucks`;

  if (remainderEl) {
    if (!isConcrete && !roundUpLoads && remainder) {
      remainderEl.textContent = `Unassigned: ${remainder.toFixed(2)} yd³`;
    } else {
      remainderEl.textContent = remainder ? `Last load: ${remainder.toFixed(2)} yd³` : '';
    }
  }

  const density = densityTonsPerYd[material];
  if (tonsLineEl) {
    if (!isConcrete && density) {
      const tons = displayYards * density;
      tonsLineEl.textContent = `Estimated: ${tons.toFixed(1)} tons`;
    } else {
      tonsLineEl.textContent = '';
    }
  }

  // =====================================================
  // Bags helper (only if enabled + concrete)
  // =====================================================
  if (isConcrete && bagsEnabled) {
    const yd3 = Number(totalYards) || 0;

    if (bagsLineEl) {
      if (yd3 <= 0) {
        bagsLineEl.textContent = '';
      } else {
        const ft3 = yd3 * 27;
        const yieldFt3 = BAG_YIELD_FT3[bagSizeLbs] || BAG_YIELD_FT3[80];
        const bags = Math.ceil(ft3 / yieldFt3);
        bagsLineEl.textContent = `Bag mix estimate: ~${bags} bags (${bagSizeLbs} lb)`;
      }
    }

    // -----------------------------------------------------
    // FUTURE (Pro-ready hook): Admixture estimate output
    // Keeping the code parked for later.
    // -----------------------------------------------------
    /*
    if (admixtureLineEl) {
      if (!admixturesOn || yd3 <= 0) {
        admixtureLineEl.textContent = '';
      } else {
        const totalOz = yd3 * ADMIX_OZ_PER_YD3;
        const gallons = totalOz / OZ_PER_GAL;
        admixtureLineEl.textContent =
          `Admixture estimate: ~${totalOz.toFixed(0)} oz (${gallons.toFixed(2)} gal)`;
      }
    }
    */
  } else {
    // Either:
    // - not concrete, OR
    // - bags feature disabled in Settings
    if (bagsLineEl) bagsLineEl.textContent = '';
    if (admixtureLineEl) admixtureLineEl.textContent = '';
  }
}

/* =====================================================
   9) SETTINGS RESPONSIVENESS (no swipe refresh)
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
  syncMaterialButtonLabel();
  syncTruckCapacityButtons();
  syncBagButtonLabel();
  syncCurbButtonLabel();
  syncDensityUI();
  updateShapeButtonsForMaterial();
  calculate();
  updateTotals();
}


/* =====================================================
   10) INITIAL BOOTSTRAP
===================================================== */
syncMaterialButtonLabel();
updateShapeButtonsForMaterial();
syncTruckCapacityButtons();
syncBagButtonLabel();
syncCurbButtonLabel();
syncDensityUI();
calculate();
updateTotals();
