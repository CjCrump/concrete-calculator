const summaryEl = document.getElementById('summary');
const resetBtn = document.getElementById('resetBtn');

function renderSummary() {
  const s = FieldCalcSettings.load();
  summaryEl.textContent =
    `Truck: ${s.trucks.defaultCapacity} yd • Loads: ${s.rounding.loadsDefault.toUpperCase()} • Thickness: ${s.units.thicknessUnit}`;
}

resetBtn.addEventListener('click', () => {
  FieldCalcSettings.reset();
  renderSummary();
  alert('Defaults reset.');
});

renderSummary();

/* sync settings listener */

function onReturnSync(syncFn) {
  // When returning from Settings or switching apps/tabs
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncFn();
  });

  // Mobile back button / bfcache restore (this is the missing link)
  window.addEventListener('pageshow', () => syncFn());

  // Optional: if another tab changes settings
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.includes('gloveson_fieldcalc_settings')) syncFn();
  });
}

onReturnSync(renderSummary);
