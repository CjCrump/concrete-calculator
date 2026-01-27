const statusEl = document.getElementById('status');
const backBtn = document.getElementById('backBtn');
const saveBtn = document.getElementById('saveBtn');

let s = FieldCalcSettings.load();

// Local working copy
let lengthMode = s.units.lengthMode;        // 'ftin' | 'decft'
let thicknessUnit = s.units.thicknessUnit;  // 'in' | 'ft'
let weightUnit = s.units.weightUnit;        // 'tons'
let fracPrecision = s.rounding.fracPrecision; // 16 | 8 | 4

function setActive(selector, matchFn) {
  document.querySelectorAll(selector).forEach(btn => {
    btn.classList.toggle('active', matchFn(btn));
  });
}

function render() {
  setActive('[data-length]', b => b.dataset.length === lengthMode);
  setActive('[data-thickness]', b => b.dataset.thickness === thicknessUnit);
  setActive('[data-weight]', b => b.dataset.weight === weightUnit);
  setActive('[data-frac]', b => Number(b.dataset.frac) === Number(fracPrecision));
  statusEl.textContent = '';
}

document.querySelectorAll('[data-length]').forEach(btn => {
  btn.addEventListener('click', () => { lengthMode = btn.dataset.length; render(); });
});
document.querySelectorAll('[data-thickness]').forEach(btn => {
  btn.addEventListener('click', () => { thicknessUnit = btn.dataset.thickness; render(); });
});
document.querySelectorAll('[data-weight]').forEach(btn => {
  btn.addEventListener('click', () => { weightUnit = btn.dataset.weight; render(); });
});
document.querySelectorAll('[data-frac]').forEach(btn => {
  btn.addEventListener('click', () => { fracPrecision = Number(btn.dataset.frac); render(); });
});

saveBtn.addEventListener('click', () => {
  s = FieldCalcSettings.load(); // re-load in case another tab changed it
  s.units.lengthMode = lengthMode;
  s.units.thicknessUnit = thicknessUnit;
  s.units.weightUnit = weightUnit;
  s.rounding.fracPrecision = fracPrecision;

  FieldCalcSettings.save(s);
  statusEl.textContent = 'Saved.';
});

backBtn.addEventListener('click', () => history.back());

render();

function onReturnSync(syncFn) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncFn();
  });
  window.addEventListener('pageshow', () => syncFn());
}

function syncUnitsSettingsUI() {
  s = FieldCalcSettings.load();
  lengthMode = s.units.lengthMode;
  thicknessUnit = s.units.thicknessUnit;
  weightUnit = s.units.weightUnit;
  fracPrecision = s.rounding.fracPrecision;
  render();
}

onReturnSync(syncUnitsSettingsUI);
