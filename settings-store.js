// settings-store.js
(() => {
  const KEY = 'gloveson_fieldcalc_settings_v1';

  const defaults = {
    units: {
      lengthMode: 'ftin',      // 'ftin' | 'decft'
      thicknessUnit: 'in',     // 'in' | 'ft'
      volumeUnit: 'yd3',       // future: 'ft3' | 'm3'
      weightUnit: 'tons'       // future: 'lbs' | 'tonnes'
    },
    rounding: {
      loadsDefault: 'ask',     // 'up' | 'down' | 'ask'
      tapeMode: 'exact',          // 'up' | 'exact'
      fracPrecision: 16        // 16 | 8 | 4  (1/16, 1/8, 1/4)
    },
    trucks: {
      defaultCapacity: 10,     // 9 | 10 | custom
      overOrderPct: 5          // default buffer
    },
    materials: {
      // estimates; user can change later in Material Presets
      rock: 1.35,
      sand: 1.30,
      topsoil: 0.90,
      asphalt: 1.25
    },

    // ------------------------------------------------------
    // FEATURES (simple on/off switches for optional tools)
    // Why: lets us ship a clean MVP now, then add "packs" later
    // without changing the settings structure.
    // ------------------------------------------------------
    features: {
      enableBags: false // OFF by default until user enables in Settings
    }
  };

  function deepMerge(base, incoming) {
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const k in incoming) {
      if (incoming[k] && typeof incoming[k] === 'object' && !Array.isArray(incoming[k])) {
        out[k] = deepMerge(base[k] || {}, incoming[k]);
      } else {
        out[k] = incoming[k];
      }
    }
    return out;
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(defaults);
      const parsed = JSON.parse(raw);
      return deepMerge(structuredClone(defaults), parsed);
    } catch {
      return structuredClone(defaults);
    }
  }

  function saveSettings(next) {
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  function resetSettings() {
    saveSettings(structuredClone(defaults));
  }

  window.FieldCalcSettings = {
    KEY,
    defaults,
    load: loadSettings,
    save: saveSettings,
    reset: resetSettings
  };
})();
