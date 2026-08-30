# Design canvas divergence

Records how the Claude Design canvas for this app differs from the documents in
`docs/` and from the current implementation.

Nothing in this document has been implemented. It exists so the differences are
not lost between now and whenever the canvas direction is revisited.

## Decision

`docs/visual-design.md` remains the visual source of truth. The canvas's
Modernist styling is **not** adopted, and no code was changed on account of the
canvas.

## Source

Exported from Claude Design as `TreatCompiler_iPhone_app_design.zip`. The export
is not committed here; it contains three artboards plus two design-system
bundles:

| Artboard | Dated | Design system | Contents |
|---|---|---|---|
| `TreatCompiler.dc.html` | 28 Aug 2026 | Industry | Three navigation options (2a / 2b / 2c) |
| `TreatCompiler v1 Scope.dc.html` | 29 Aug 2026 | Modernist | Scope document, v2 |
| `TreatCompiler v1 Prototype.dc.html` | — | Modernist | Clickable prototype, "direction 2a · full v1 scope" |

The canvas's own `github.md` records that it read this repository's `docs/` on
2026-08-30 and adopted our calculation definitions and tone, noting that "the
repo's product scope … is broader than our prior TreatCompiler v1 scope."

The app is called **TreatCompiler** on the canvas.

## Where the canvas and this repository already agree

These needed no reconciliation — the canvas adopted them from `docs/`:

- Catalog values are snapshotted onto each entry, so editing or archiving a
  treat never rewrites history.
- Unknown calorie estimates stay null and are disclosed, never counted as zero.
- The daily average divides by calendar days in the range, zero-event days
  included.
- Change against the previous range is a percentage only when the previous value
  is above zero; otherwise a plain-language comparison.
- Top treats are grouped by the name snapshot recorded at the time.
- Neutral budget language, with no warning colour for crossing a self-set
  budget.
- Local-only storage, no accounts and no network; absolute instants plus a local
  calendar date for grouping.
- CSV export escapes cells that could be read as spreadsheet formulas.

## Where they diverge

| Area | Design canvas | This repository |
|---|---|---|
| Primary navigation | Pet switcher fixed at the top showing **both** pets' kcal meters at once; Today / History / Insights as a segmented row beneath it; Settings behind a gear icon in the header | Four bottom tabs (Today, History, Insights, Settings); active pet's name in a plain header, no switcher |
| Giver attribution | Every entry records which of two people gave it, shown as an initial badge on each row (`Person` entity) | No person concept in the schema |
| Medications | Separate `MedItem` / `MedEntry` objects with daily and monthly schedules; daily items pinned above the feed as a checkbox, monthly items appear only when due | Not modelled |
| Daily budget | `dailyBudgetKcal` set by hand on the pet; meter reads e.g. "67 / 90 KCAL" | `daily_goals` table with a metric (`event_count` or `known_kcal`) and effective date ranges; no budget field on the pet |
| Quantity | Whole treats, stepper 1–20 | `quantity_milli`, integer thousandths, supporting fractional amounts |
| Entry photos | Optional photo per entry, stored in the app container | Not modelled |
| Quick-add ordering | Four favorite tiles ordered by frequency of use over the last 30 days | Favorite flag first, then most recently used |
| Visual direction | Modernist: `#f3f2f2` ground, `#eae9e9` surface, `#201e1d` text, `#ec3013` accent, Archivo, **0px** corner radius | Warm paper: `#F7F3EA` canvas, `#FFFDF8` surface, `#25241F` ink, `#C75D3A` accent, platform system font, 10–24px radii |
| App name | TreatCompiler | Treat Tracker |

The two visual directions are opposites — a sharp-cornered modernist treatment
against the "well-designed field notebook" `docs/visual-design.md` asks for.
Adopting the canvas would mean rewriting `src/theme/` and updating
`docs/visual-design.md` so the repository stops contradicting itself.

## Open questions raised by the canvas

Unanswered as of this document:

1. Real daily budget figures for each pet — owner's numbers, or the vet's?
2. Should treats logged after midnight count toward the previous day? The canvas
   notes a 4am rollover would be a small change.
3. Does a growing kitten's budget need to change on a schedule, or be edited by
   hand?
4. Daily medication dose — fixed, or variable?
5. Reminder timing — one evening time for all pets, or per pet?
