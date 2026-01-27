const summaryEl = document.getElementById('summary');
const resetBtn = document.getElementById('resetBtn');

// =====================================================
// Feature Toggles (MVP)
// - Keep these lightweight so Settings stays simple.
// - Today: Bags enable/disable
// - Later: Pro features can hook in here (forms, logs, etc.)
// =====================================================
// =====================================================
// Easy Mode Toggle UI (Bags)
// =====================================================
const enableBagsRow = document.getElementById('enableBagsRow');
const enableBagsPill = document.getElementById('enableBagsPill');
const enableBagsPillLabel = document.getElementById('enableBagsPillLabel');
const enableBagsPillIcon = document.getElementById('enableBagsPillIcon');

const saveFeaturesBtn = document.getElementById('saveFeaturesBtn');

// Single source of truth for the current UI state
let enableBagsValue = false;


function renderSummary() {
  const s = FieldCalcSettings.load();
  summaryEl.textContent =
    `Truck: ${s.trucks.defaultCapacity} yd • Loads: ${s.rounding.loadsDefault.toUpperCase()} • Thickness: ${s.units.thicknessUnit}`;
}

// -----------------------------------------------------
// Load from storage (source of truth) into local state
// -----------------------------------------------------
function loadFeaturesFromStore() {
  const s = FieldCalcSettings.load();
  enableBagsValue = s.features?.enableBags === true;
}

// -----------------------------------------------------
// Render current local state -> UI
// (does NOT reload storage, so taps don’t get overwritten)
// -----------------------------------------------------
function renderFeatures() {
  enableBagsRow?.setAttribute('aria-pressed', String(enableBagsValue));

  if (enableBagsPill) {
    enableBagsPill.classList.toggle('on', enableBagsValue);
    enableBagsPill.classList.toggle('off', !enableBagsValue);
  }

  if (enableBagsPillLabel) enableBagsPillLabel.textContent = enableBagsValue ? 'ON' : 'OFF';
  if (enableBagsPillIcon) enableBagsPillIcon.textContent = enableBagsValue ? '✓' : '✕';
}


// Tap anywhere on the row toggles the value (easy mode)
enableBagsRow?.addEventListener('click', () => {
  enableBagsValue = !enableBagsValue;
  renderFeatures(); // refresh UI instantly (even before saving)
});

saveFeaturesBtn?.addEventListener('click', () => {
  const s = FieldCalcSettings.load();
  if (!s.features) s.features = {};

  // Persist the current easy-mode toggle value
  s.features.enableBags = enableBagsValue;

  FieldCalcSettings.save(s);
  alert('Saved.');
  renderFeatures();
});


resetBtn.addEventListener('click', () => {
  FieldCalcSettings.reset();
  renderSummary();
  renderFeatures();
  alert('Defaults reset.');
});

// First render
renderSummary();
loadFeaturesFromStore();
renderFeatures();


/* =====================================================
   Settings responsiveness (no swipe refresh)
   -----------------------------------------------------
   Some mobile browsers restore pages from cache (bfcache).
   So we listen to:
   - visibilitychange
   - pageshow (bfcache restore)
   - storage (multi-tab)
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

onReturnSync(() => {
  renderSummary();
  loadFeaturesFromStore();
  renderFeatures();
});

