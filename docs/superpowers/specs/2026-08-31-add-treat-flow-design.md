# Add a treat — design

## Problem

Onboarding lets a user create a pet and land on Today, but there is no way to
reach `treatsRepository.createTreat` or `eventsRepository.recordEvent` from
the UI. `Today`'s quick-add grid only renders once catalog treats already
exist (`app/(tabs)/index.tsx`), and `Settings` is an explicit placeholder.
The result: a fresh install has no visible path to a first entry.

This implements the "Add a new treat" flow already specified in
`docs/ux-flows.md` ("Add a new treat", "Record a one-off treat").

## Entry points

- A "+" button in the Today screen's header (`Tabs.Screen name="index"`
  options in `app/(tabs)/_layout.tsx` or a `headerRight` on the screen
  itself) opens the sheet. Always visible, matches iOS conventions.
- Today's existing `EmptyState` (`app/(tabs)/index.tsx`, currently rendered
  with no `actionLabel`/`onAction`) gets those props wired to the same
  handler, so the empty-day primary button described in ux-flows.md ("Primary
  button: 'Add a treat'") opens it too. Both entry points open the same
  component; there is exactly one handler.

## Sheet component

New component, `AddTreatSheet` (`src/components/AddTreatSheet.tsx`, exported
from `src/components/index.ts`), mounted from `TodayScreen` and controlled by
local `visible` state on that screen — not a routed screen. It needs to hand
results straight back to `useTodayEvents`'s `refresh()` without a round-trip
through router params, and Today already holds the active pet.

Implemented with React Native's built-in `Modal`
(`animationType="slide"`, `transparent`, rounded top corners, translucent
backdrop, dismiss via backdrop tap or a close button). No new dependency.
`react-native-reanimated` / `react-native-gesture-handler` are in
`package.json` but not wired into the app anywhere (no
`GestureHandlerRootView`), and introducing a real draggable sheet
(`@gorhom/bottom-sheet`) is out of scope for this pass — avoids new
Expo-Go-compatibility risk right after the SDK 54 downgrade.

### Step 1 — Search (default)

- Text input filtering via `treatsRepository.searchTreats`, debounced.
- Results reuse the tile styling from Today's quick-add grid
  (`styles.quickAddTile` in `app/(tabs)/index.tsx` — likely worth lifting to
  a shared style/component rather than duplicating).
- Tapping a result records an event immediately from that treat (same
  behavior as Today's existing `quickAdd`) and closes the sheet.
- Below results (or when the query has no match), a row reads `Create
  "<query>"` and advances to Step 2, pre-filling `name` with the query text.
- No explicit favorites/recents sub-list beyond what `searchTreats` /
  `listQuickAddTreats` already order by (`is_favorite DESC, ... name ASC`
  for search results with a non-empty query; an empty query can reuse
  `listQuickAddTreats` to show favorites/recents before the user types).

### Step 2 — Form

Fields, in order:

- Name (required, pre-filled if arriving from "Create")
- Category — horizontal picker over `treatCategorySchema`'s 7 values, using
  `treatCategoryLabels` for display text
- Quantity + unit (required; quantity must parse to a positive integer
  milli value via `toMilli`)
- Kcal per unit (optional — leave blank for "not entered", never coerce to
  zero, per `docs/data-model.md`)
- Time — defaults to "now"; no time picker in this pass (out of scope,
  matches the "keep advanced fields collapsed" guidance in ux-flows.md)
- Note (optional)
- Favorite toggle
- "Use once" toggle — when on, hides the favorite toggle (a one-off treat
  is never a catalog favorite) and changes what Save does (see below)

## Save behavior

### Catalog treat (default, "Use once" off)

Needs one new repository-level function that inserts the treat row *and*
the event row in a single transaction, per ux-flows.md: "Save creates the
catalog item and event in one transaction."

`treatsRepository.createTreat` and `eventsRepository.recordEvent` each open
their own `db.withTransactionAsync` internally — calling both from a
wrapping transaction risks a nested-transaction error, since SQLite (and
expo-sqlite's wrapper) doesn't support that. The new function performs both
inserts (treat row, event row, and the event's `last_used_at` stamp on the
new treat) directly inside one `withTransactionAsync` block, mirroring the
existing SQL in `createTreat`/`recordEvent` rather than calling through
them. Exact placement/name (e.g. `eventsRepository.recordNewCatalogTreat` or
a small new module) is decided during planning.

### One-off ("Use once" on)

No catalog row. Build a `TreatEventDraft` by hand (there's no catalog
`Treat` object to pass to `draftFromTreat`) with `treatId: null` and the
form's values copied directly into the snapshot fields
(`treatNameSnapshot`, `categorySnapshot`, `unitSnapshot`,
`kcalPerUnitMilliSnapshot`), then call the existing
`eventsRepository.recordEvent` unchanged — no transaction-nesting concern
here since only one insert happens.

Both paths end by closing the sheet and calling Today's existing
`refresh()`, and announcing success via `AccessibilityInfo
.announceForAccessibility`, matching the existing `quickAdd` handler in
`app/(tabs)/index.tsx`.

## Validation & errors

Reuse `treatDraftSchema` / `treatEventDraftSchema` (`src/domain/entities.ts`)
for validation, same pattern as `app/onboarding.tsx`: parse on submit, show
the first Zod issue inline (`parsed.error.issues[0]?.message`), keep the
draft on screen on failure — never silently lose what was typed, and never
update Today's displayed totals until commit succeeds (ux-flows.md,
"Persistence failure").

## Accessibility

No new patterns beyond what the codebase already does:
`accessibilityRole`/`accessibilityLabel`/`accessibilityHint` on interactive
elements, `AccessibilityInfo.announceForAccessibility` on commit/cancel,
44×44pt minimum targets via `MIN_TOUCH_TARGET`, as already used in
`app/(tabs)/index.tsx` and `app/onboarding.tsx`.

## Explicitly out of scope for this pass

- Time picker (defaults to now)
- Editing/archiving catalog treats (Settings' "treat catalog" placeholder)
- `@gorhom/bottom-sheet` / drag-to-dismiss gesture
