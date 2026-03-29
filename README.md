# GlovesOn — Jobsite Companion

> **Built for the jobsite.** Big buttons. Glove-friendly. Works offline. No account required.

A mobile-first progressive web app for construction crews. All data stays on the device — no server, no cloud, no login.

---

## Features

| Tool | Description |
|---|---|
| 🧮 **Calculator** | Concrete & materials volume calculator. Slab, footing, wall, curb, approach, round column. Supports concrete, rock, sand, topsoil, and asphalt. Truck loads, waste %, bag mix estimator. |
| 📐 **Converter** | Field-grade unit conversion. Engineer ↔ tape measure (ft/in/fraction), slope/grade 3-way solver, yards ↔ tons estimator. |
| 📋 **Daily Log** | Time tracking for foremen. Log job, timekeeper, start/end, lunch. Daily or weekly overtime rules. Configurable pay periods. All totals auto-calculated. |
| 📝 **Notes** | Freeform jobsite notes. Pin important notes, auto-title from first line, auto-save on back. Full CRUD. |
| ⚙️ **Settings** | Material density presets, truck capacity defaults, rounding rules, tape precision. |

---

## File Structure

```
index.html              Landing page (app root)
calculator.html         Volume calculator
converter.html          Unit converter
log.html                Daily time log
notes.html              Freeform notes
settings.html           Settings hub
settings-materials.html Material density presets
settings-trucks.html    Truck capacity defaults
settings-rounding.html  Rounding rules
settings-units.html     Units & tape precision
store.js                Shared data layer (Settings + Log + Notes)
styles.css              All styles
README.md               This file
```

**JS is inlined into each HTML file** — no separate app.js, converter.js, etc. `store.js` is the only shared script because it's loaded by every page.

---

## Data Storage

All data is stored in `localStorage` on the user's device:

| Key | Contents |
|---|---|
| `gloveson_settings_v1` | App settings (trucks, rounding, materials, features) |
| `gloveson_log_v1` | Daily log entries array |
| `gloveson_notes_v1` | Notes array |
| `gloveson_log_prefs_v1` | Log UI preferences (OT rule, pay period) |
| `gloveson_last_timekeeper` | Last-used timekeeper name |

Old key `gloveson_fieldcalc_settings_v1` is automatically migrated on first load.

---

## Tech Stack

- Vanilla HTML / CSS / JavaScript — no frameworks, no build step
- `localStorage` for persistence
- Deployable to any static host (Cloudflare Pages, Netlify, Vercel, GitHub Pages)

---

## Deploy

```bash
# Cloudflare Pages (recommended)
# Connect repo, set build command to none, output directory to /

# Or drag-and-drop the folder to Netlify Drop
```

## Roadmap / Future Ideas

### Hourly Wage & Paycheck Estimator (Daily Log v2)
- Add optional hourly wage field to pay period setup (saved per user, never required)
- Estimated gross pay displayed on the summary card: regular hours × rate + OT hours × (rate × 1.5)
- Estimated check display (gross only — no tax math, clearly labeled "estimate before deductions")
- Could expand to: multiple crew members on one log, export/share summary as text

---

## Built By

**ChanceIT Studio** — [chanceitstudio.com](https://chanceitstudio.com)

Version: 1.0