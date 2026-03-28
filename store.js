/* ============================================================
   GlovesOn — Unified Store (store.js)
   ------------------------------------------------------------
   Single shared data layer for the entire app.
   Three namespaces:
     GlovesOn.Settings  — app configuration
     GlovesOn.Log       — daily time log entries
     GlovesOn.Notes     — freeform notes

   All data lives in localStorage. No server. No account.
   ============================================================ */

(() => {

  /* ----------------------------------------------------------
     UTILITIES
  ---------------------------------------------------------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

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

  /* ----------------------------------------------------------
     SETTINGS
     Key: gloveson_settings_v1
     Migrates from old key: gloveson_fieldcalc_settings_v1
  ---------------------------------------------------------- */
  const SETTINGS_KEY     = 'gloveson_settings_v1';
  const SETTINGS_KEY_OLD = 'gloveson_fieldcalc_settings_v1';

  const SETTINGS_DEFAULTS = {
    units: {
      lengthMode:    'ftin',   // 'ftin' | 'decft'
      thicknessUnit: 'in',     // 'in' | 'ft'
      volumeUnit:    'yd3',
      weightUnit:    'tons'
    },
    rounding: {
      loadsDefault:  'ask',    // 'up' | 'down' | 'ask'
      tapeMode:      'exact',  // 'up' | 'exact'
      fracPrecision: 16        // 16 | 8 | 4
    },
    trucks: {
      defaultCapacity: 10,
      overOrderPct:    5
    },
    materials: {
      rock:     1.35,
      sand:     1.30,
      topsoil:  0.90,
      asphalt:  1.25
    },
    features: {
      enableBags: false
    },
    log: {
      otRule:     'daily',     // 'daily' | 'weekly'
      payPeriod:  'thisweek'   // 'thisweek' | 'lastweek' | 'biweek' | 'custom'
    }
  };

  function loadSettings() {
    try {
      // One-time migration from old key
      const oldRaw = localStorage.getItem(SETTINGS_KEY_OLD);
      const newRaw = localStorage.getItem(SETTINGS_KEY);

      if (oldRaw && !newRaw) {
        localStorage.setItem(SETTINGS_KEY, oldRaw);
        localStorage.removeItem(SETTINGS_KEY_OLD);
      }

      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return structuredClone(SETTINGS_DEFAULTS);
      return deepMerge(structuredClone(SETTINGS_DEFAULTS), JSON.parse(raw));
    } catch {
      return structuredClone(SETTINGS_DEFAULTS);
    }
  }

  function saveSettings(next) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }

  function resetSettings() {
    saveSettings(structuredClone(SETTINGS_DEFAULTS));
  }

  /* ----------------------------------------------------------
     LOG
     Key: gloveson_log_v1
     Each entry: { id, date, job, timekeeper, start, end, lunch }
       date:        "YYYY-MM-DD"
       start/end:   "HH:MM"
       lunch:       bool — true = took lunch (deduct 0.5h)
  ---------------------------------------------------------- */
  const LOG_KEY = 'gloveson_log_v1';

  function loadLog() {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLog(entries) {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries));
  }

  function saveLogEntry(entry) {
    const entries = loadLog();
    const idx = entries.findIndex(e => e.id === entry.id);
    if (idx >= 0) {
      entries[idx] = entry;
    } else {
      entry.id = entry.id || uid();
      entries.push(entry);
    }
    // Sort by date descending
    entries.sort((a, b) => b.date.localeCompare(a.date));
    saveLog(entries);
    return entry;
  }

  function deleteLogEntry(id) {
    const entries = loadLog().filter(e => e.id !== id);
    saveLog(entries);
  }

  /* ----------------------------------------------------------
     NOTES
     Key: gloveson_notes_v1
     Each note: { id, created, updated, pinned, body }
       body:    raw text; title = first line at render time
       pinned:  bool
  ---------------------------------------------------------- */
  const NOTES_KEY = 'gloveson_notes_v1';

  function loadNotes() {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveNotes(notes) {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }

  function saveNote(note) {
    const notes = loadNotes();
    const now = new Date().toISOString();
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) {
      notes[idx] = { ...notes[idx], ...note, updated: now };
    } else {
      note.id      = note.id || uid();
      note.created = now;
      note.updated = now;
      note.pinned  = note.pinned ?? false;
      notes.unshift(note);
    }
    saveNotes(notes);
    return note;
  }

  function deleteNote(id) {
    saveNotes(loadNotes().filter(n => n.id !== id));
  }

  /* ----------------------------------------------------------
     EXPORT
  ---------------------------------------------------------- */
  window.GlovesOn = {
    Settings: {
      defaults: SETTINGS_DEFAULTS,
      load:     loadSettings,
      save:     saveSettings,
      reset:    resetSettings
    },
    Log: {
      getAll:      loadLog,
      save:        saveLogEntry,
      remove:      deleteLogEntry
    },
    Notes: {
      getAll:      loadNotes,
      save:        saveNote,
      remove:      deleteNote
    },
    uid
  };

  // Legacy alias so any old code using FieldCalcSettings still works
  window.FieldCalcSettings = {
    KEY:      SETTINGS_KEY,
    defaults: SETTINGS_DEFAULTS,
    load:     loadSettings,
    save:     saveSettings,
    reset:    resetSettings
  };

})();
