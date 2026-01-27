const statusEl = document.getElementById('status');
const backBtn = document.getElementById('backBtn');
const saveBtn = document.getElementById('saveBtn');

const customWrap = document.getElementById('customWrap');
const customCap = document.getElementById('customCap');
const overOrder = document.getElementById('overOrder');

let s = FieldCalcSettings.load();

let capMode = String(s.trucks.defaultCapacity); // '10' | '9' | custom numeric

function render() {
  // decide selected state
  let selected = capMode === '9' || capMode === '10' ? capMode : 'custom';

  document.querySelectorAll('[data-cap]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cap === selected);
  });

  customWrap.classList.toggle('hidden', selected !== 'custom');

  if (selected === 'custom') {
    customCap.value = capMode === 'custom' ? '' : capMode;
  } else {
    customCap.value = '';
  }

  overOrder.value = Number(s.trucks.overOrderPct ?? 5);
  statusEl.textContent = '';
}

document.querySelectorAll('[data-cap]').forEach(btn => {
  btn.addEventListener('click', () => {
    const v = btn.dataset.cap;
    if (v === 'custom') {
      capMode = capMode === '9' || capMode === '10' ? 'custom' : capMode;
    } else {
      capMode = v;
    }
    render();
  });
});

saveBtn.addEventListener('click', () => {
  s = FieldCalcSettings.load();

  let capToSave;
  if (capMode === '9' || capMode === '10') {
    capToSave = Number(capMode);
  } else {
    const c = Number(customCap.value);
    capToSave = (c && c > 0) ? c : 10;
  }

  const oo = Number(overOrder.value);
  s.trucks.defaultCapacity = capToSave;
  s.trucks.overOrderPct = (oo >= 0) ? oo : 0;

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

function syncTruckSettingsUI() {
  s = FieldCalcSettings.load();
  capMode = String(s.trucks.defaultCapacity);
  render();
}

onReturnSync(syncTruckSettingsUI);
