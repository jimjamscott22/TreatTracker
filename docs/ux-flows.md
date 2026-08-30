# UX flows

## Information architecture

Use four primary tabs:

1. **Today**
2. **History**
3. **Insights**
4. **Settings**

Pet switching belongs in the shared top area of Today, History, and Insights. Treat catalog and pet management are accessible through Settings and contextual entry flows.

## First launch

### Goal

Reach a successful first entry without requiring an account, notification permission, or complete profile.

### Flow

1. Welcome screen explains: “Keep a simple record of your pet’s treats.”
2. User enters pet name and selects dog or cat.
3. Optional fields are visually secondary and skippable.
4. User lands on an empty Today screen.
5. Primary action is “Add first treat.”
6. Notification permission is requested only after the user enables a reminder.

### Empty Today state

- Friendly illustration or pet initial.
- “No treats recorded today.”
- Primary button: “Add a treat.”
- Secondary link: “Create favorites for faster tracking.”

## Quick-add a familiar treat

### Goal

Record a favorite in two taps or fewer.

### Flow

1. On Today, user taps a favorite treat chip/card.
2. A compact confirmation appears with default quantity and Undo.
3. Event is committed immediately using the current time.

Long press or an adjacent detail affordance opens quantity/time editing. Do not make the confirmation dialog mandatory for ordinary quick-add; Undo protects against accidental taps.

## Add a new treat

1. User taps the persistent “Add treat” action.
2. A bottom sheet shows search, favorites, and recent treats.
3. If no result matches, “Create ‘name’” appears.
4. User enters:
   - Name
   - Category
   - Quantity and unit
   - Optional calories per unit
   - Time, defaulting to now
   - Optional note
5. User chooses whether to favorite it.
6. Save creates the catalog item and event in one transaction.
7. Today updates and announces success to assistive technology.

Keep advanced fields collapsed until requested.

## Record a one-off treat

The add flow allows “Use once” so a miscellaneous item does not clutter the catalog. The resulting event has complete snapshots and a null `treat_id`.

## Review today

Today presents:

- Pet switcher
- Date and optional previous/next-day controls
- Event count
- Known calorie estimate
- Unknown-calorie disclosure when applicable
- Optional budget progress
- Favorites/recent quick-add area
- Chronological event list

Budget text stays neutral:

- “3 of 5 recorded”
- “2 above your daily budget”
- “Calories unknown for 1 entry”

Do not use warning red solely because a user-defined budget was exceeded.

## Edit or delete an event

1. User taps an event.
2. Detail sheet exposes quantity, treat, date/time, and note.
3. Save validates and recomputes event snapshots as appropriate.
4. Delete requires confirmation describing the affected pet and time.
5. After deletion, show a short Undo affordance when implementation can safely restore the tombstone.

Catalog edits are separate. Changing a catalog item should explain that prior entries will not change.

## Browse history

- Default to a calendar/list hybrid showing daily totals.
- Selecting a date opens its event list.
- Filters include treat, category, and entries with unknown calories.
- A “no entries” date is a valid empty state, not an error.
- Future dates do not imply missing data.

Avoid an infinite, unstructured event feed as the only history view; users reason about treats by day.

## View insights

### Default view

- Active pet
- 7-day / 30-day segmented control
- Daily event chart
- Known calorie chart or summary
- Average events per day
- Comparison with prior range
- Top treats
- Category distribution
- Data completeness note

### Insight explanation

Each card has an info affordance explaining:

- Exact included dates
- Whether zero-event days are included
- Number of unknown-calorie entries
- Comparison period

Charts must have text summaries and accessible labels. Color is never the only carrier of meaning.

## Pet switching

The current pet's name and avatar appear prominently. Switching:

- Updates all summaries and entries together.
- Preserves the current tab and selected range when reasonable.
- Never combines totals unless a future explicit “All pets” view is designed.

Quick-add must always display the recipient pet at the moment of action.

## Reminders

1. User opens Settings → Reminders.
2. User creates an evening review time and selects weekdays.
3. App explains what the notification will do.
4. Only then request system permission.
5. If denied, show system-setting instructions without repeated prompts.

Avoid reminders phrased as medical or guilt-inducing warnings.

## Export

1. User chooses pet, date range, and JSON or CSV.
2. Preview shows entry count and included dates.
3. App creates the file locally.
4. Native share sheet opens.
5. Temporary export is removed according to a documented cleanup policy.

## Error and edge states

### Persistence failure

- Keep the draft.
- State that the entry was not saved.
- Offer Retry.
- Never update displayed totals until commit succeeds.

### Unknown calories

- Display “—” or “Not entered,” not `0 kcal`.
- Totals say “Known calories.”
- Insights state the number of excluded entries.

### Archived treat

- History continues to show its snapshot.
- Entry detail labels it as no longer in the catalog.
- User may create a new catalog treat from the snapshot.

### No active pet

- Route to pet creation.
- Do not render an ambiguous global tracker.

## Accessibility

- Support Dynamic Type without clipping or horizontal scrolling for core actions.
- Minimum interactive target: 44 by 44 points.
- Provide accessible names and hints for icon-only actions.
- Announce saved, undone, and failed entry actions.
- Preserve logical focus when sheets close.
- Offer chart data as readable text.
- Meet WCAG AA contrast for text and meaningful controls.
- Respect reduced motion settings.

## Destructive and sensitive interactions

- Confirm permanent-looking deletes.
- Explain that exports may contain pet names and notes.
- Never shame users for counts, calories, or missed days.
- Avoid celebratory streaks that could encourage unnecessary treat-giving.
