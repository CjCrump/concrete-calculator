const statusEl = document.getElementById('status');
const backBtn = document.getElementById('backBtn');
const saveBtn = document.getElementById('saveBtn');

let s = FieldCalcSettings.load();

let loadsDefault = s.rounding.loadsDefault; // 'up' | 'down' | 'ask'
let tapeMode = s.rounding.tapeMode;         // 'up' | 'exact'

function setActive(selector, matchFn) {
  document.querySelectorAll(selector).forEach(btn => {
    btn.classList.toggle('active', matchFn(btn));
  });
}

function render() {
  setActive('[data-loads]', b => b.dataset.loads === loadsDefault);
  setActive('[data-tape]', b => b.dataset.tape === tapeMode);
  statusEl.textContent = '';
}

document.querySelectorAll('[data-loads]').forEach(btn => {
  btn.addEventListener('click', () => { loadsDefault = btn.dataset.loads; render(); });
});
document.querySelectorAll('[data-tape]').forEach(btn => {
  btn.addEventListener('click', () => { tapeMode = btn.dataset.tape; render(); });
});

saveBtn.addEventListener('click', () => {
  s = FieldCalcSettings.load();
  s.rounding.loadsDefault = loadsDefault;
  s.rounding.tapeMode = tapeMode;
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

function syncRoundingSettingsUI() {
  s = FieldCalcSettings.load();
  loadsDefault = s.rounding.loadsDefault;
  tapeMode = s.rounding.tapeMode;
  render();
}

onReturnSync(syncRoundingSettingsUI);
