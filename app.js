/* =====================================================
   STATE
===================================================== */
let currentShape = 'slab';
let truckCapacity = 9;
let continuous = false;

let currentItemYards = 0;
let totalYards = 0;

/* =====================================================
   ELEMENT REFERENCES
===================================================== */
const currentYardsEl = document.getElementById('currentYards');
const totalYardsEl = document.getElementById('totalYards');
const trucksEl = document.getElementById('trucks');
const remainderEl = document.getElementById('remainder');

const addItemBtn = document.getElementById('addItemBtn');
const clearPourBtn = document.getElementById('clearPourBtn');

const continuousToggle = document.getElementById('continuousToggle');
const runsWrap = document.getElementById('runsWrap');
const runsInput = document.getElementById('footing-runs');

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

    calculate();
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

  calculate();
});

/* =====================================================
   INPUT LISTENERS
===================================================== */
document.querySelectorAll('input').forEach(input =>
  input.addEventListener('input', calculate)
);

/* =====================================================
   MAIN CALCULATION
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

  // Apply waste
  cubicFeet += cubicFeet * waste;

  // Convert to yards
  currentItemYards = cubicFeet / 27;
  currentYardsEl.textContent = `${currentItemYards.toFixed(2)} yd³`;
}

/* =====================================================
   TOTAL / TRUCK CALCULATION
===================================================== */
function updateTotals() {
  totalYardsEl.textContent = `${totalYards.toFixed(2)} yd³`;

  if (totalYards === 0) {
    trucksEl.textContent = '0 trucks';
    remainderEl.textContent = '';
    return;
  }

  const full = Math.floor(totalYards / truckCapacity);
  const remainder = totalYards % truckCapacity;

  trucksEl.textContent =
    full + (remainder ? 1 : 0) + ' trucks';

  remainderEl.textContent =
    remainder ? `Last load: ${remainder.toFixed(2)} yd³` : '';
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


