/* =====================================================
   Settings — Material Presets
   Tons per cubic yard (estimates)
   Range: 0.50–2.00 step 0.05
===================================================== */

const saveBtn = document.getElementById('saveBtn');
const savedMsg = document.getElementById('savedMsg');

// =====================================================
// Back button (matches other Settings pages behavior)
// - Uses history when possible (feels native)
// - Falls back to Settings home if opened directly
// =====================================================
const backBtn = document.getElementById('backBtn');

backBtn?.addEventListener('click', () => {
  // If user navigated here from inside the app, go back.
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  // If they opened this page directly (bookmark / refresh), go to settings.
  window.location.href = 'settings.html';
});

function clamp(v) {
  const min = 0.5, max = 2.0, step = 0.05;
  const clamped = Math.min(max, Math.max(min, v));
  return Math.round(clamped / step) * step;
}

function bindMaterial(key) {
  const slider = document.getElementById(`${key}Slider`);
  const num = document.getElementById(`${key}Num`);
  const val = document.getElementById(`${key}Val`);

  function setUI(next) {
    const v = clamp(next);
    slider.value = v.toFixed(2);
    num.value = v.toFixed(2);
    val.textContent = v.toFixed(2);
  }

  // initial load
  const s = FieldCalcSettings.load();
  const initial = Number(s.materials?.[key]) || Number(FieldCalcSettings.defaults.materials[key]);
  setUI(initial);

  // live sync (does not save yet)
  slider.addEventListener('input', () => setUI(Number(slider.value)));
  num.addEventListener('input', () => setUI(Number(num.value)));

  // return getter for save step
  return () => clamp(Number(num.value));
}

const getRock = bindMaterial('rock');
const getSand = bindMaterial('sand');
const getTopsoil = bindMaterial('topsoil');
const getAsphalt = bindMaterial('asphalt');

saveBtn?.addEventListener('click', () => {
  const s = FieldCalcSettings.load();
  if (!s.materials) s.materials = {};

  s.materials.rock = getRock();
  s.materials.sand = getSand();
  s.materials.topsoil = getTopsoil();
  s.materials.asphalt = getAsphalt();

  FieldCalcSettings.save(s);
  savedMsg.textContent = 'Saved.';
  setTimeout(() => (savedMsg.textContent = ''), 1200);
});

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
