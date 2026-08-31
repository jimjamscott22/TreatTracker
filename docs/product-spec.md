# Product specification

## Summary

Treat-Tracker helps dog and cat caregivers record every treat given during a day and understand patterns in quantity, calories, type, and timing. It is a tracking tool, not a veterinary or nutritional authority.

## Problem

Treats are often given casually by more than one person. By the end of the day, a caregiver may not remember what a pet received, whether an intended limit was exceeded, or whether a behavior or routine is changing over time. Existing calorie trackers commonly prioritize people, meals, or complex nutrition workflows instead of very fast pet treat entry.

## Target users

### Primary: individual caregiver

- Has one or more dogs or cats.
- Wants a private, simple daily record.
- Frequently repeats the same handful of treats.
- May track an optional treat count or calorie budget.

### Later: shared household

- Multiple people give treats to the same pets.
- Needs attribution and synchronization.
- Is outside the MVP because conflict resolution and identity materially increase complexity.

## Jobs to be done

- When I give my pet a familiar treat, I want to record it immediately with minimal effort.
- When I wonder whether my pet has had enough treats today, I want a clear current total.
- When routines change, I want to compare recent behavior with prior periods.
- When I speak with a veterinarian, I want to export an accurate record without the app interpreting it medically.

## Goals

- A favorite treat can be recorded from Today in two taps or fewer.
- A first-time treat can be created and recorded without leaving the entry flow.
- The app remains fully usable without network access.
- Daily totals and trends are reproducible from stored events.
- Users can understand how each insight was calculated.

## Non-goals

- Diagnosing allergies, illness, weight changes, or behavioral conditions.
- Recommending a universal treat allowance.
- Replacing veterinary advice or package feeding directions.
- Tracking complete meals, medication, or clinical records in the MVP.
- Requiring a cloud account.

## Core concepts

- **Pet:** a dog or cat whose events are tracked independently.
- **Treat:** a reusable catalog item with a name, default unit, category, and optional calorie estimate.
- **Treat event:** a timestamped record that a quantity of a treat was given to a pet.
- **Daily budget:** an optional user-defined count or calorie target for one pet.
- **Insight:** a transparent summary calculated from events over a stated date range.

## MVP requirements

### Onboarding and pets

- Create a pet with name and species.
- Optionally add photo, birthday, weight, and daily budget.
- Support multiple pets and select the active pet.
- Continue without an account or network connection.

### Treat catalog

- Create, edit, archive, favorite, and search treats.
- Record name, category, default quantity, unit, and optional calories per unit.
- Provide starter categories but not a prescriptive food database.
- Keep archived treats visible in historical entries.
- Let a caregiver browse archived treats separately from the active catalog and restore one, since archiving is a soft delete rather than a permanent one.

### Event entry

- Quick-add favorite and recent treats from Today.
- Add a custom or catalog treat with quantity and time.
- Default time to now and allow backdating.
- Allow an optional note.
- Prevent zero or negative quantities.
- Clearly label unknown calorie totals rather than treating them as zero.

### Today

- Show the active pet and local calendar date.
- Show treat count and known calorie total.
- Show optional budget progress without judgmental language.
- List events newest first.
- Support editing and deleting an event.
- Make switching pets obvious.

### History

- Browse previous days.
- Search or filter by treat and category.
- Edit or delete an event.
- Distinguish days with no events from unavailable data.

### Insights

- Select 7-day or 30-day range.
- Show daily event count and known calories.
- Show average events per day.
- Show the most frequently recorded treats and categories.
- Show comparison with the immediately preceding range.
- Show how many events lack calorie information.
- Explain range, inclusion rules, and comparison math.

### Reminders

- Let users schedule local reminders such as an evening review.
- Notifications are opt-in.
- The app must remain useful when notification permission is denied.

### Export

- Export a versioned CSV or JSON file for a selected pet and date range.
- Include timestamps, local dates, treat snapshots, quantities, calorie estimates, and notes.
- Do not send exported data to a server unless the user explicitly chooses a share target.

## Calculation definitions

- **Event count:** number of non-deleted treat events in the range.
- **Known calories:** sum of event calorie snapshots only where a calorie estimate exists.
- **Unknown-calorie events:** count of events whose calorie snapshot is absent.
- **Daily average:** range event count divided by the number of calendar days in the selected range, including zero-event days.
- **Change:** `(current - previous) / previous`, shown as a percentage when the previous value is greater than zero. Otherwise use plain-language comparison.
- **Top treat:** event quantities grouped by snapshotted treat identity and label; ties are shown consistently.

The selected range includes today and the preceding `N-1` local calendar dates for the active pet.

## Language and safety

Use neutral wording:

- Prefer “daily budget,” “above your budget,” and “calorie estimate.”
- Avoid “safe,” “healthy,” “unhealthy,” “too many,” or treatment recommendations.
- Include: “Treat-Tracker records estimates you enter and does not provide veterinary advice.”

## Success signals

Initial product validation should focus on:

- Percentage of sessions that successfully record an event.
- Median interactions needed to record a favorite.
- Percentage of users who return to review a prior day.
- Frequency of corrections or deletions, which may reveal entry friction.

Do not add analytics to the MVP solely to collect these signals. Use opt-in research or privacy-preserving telemetry only after a documented decision.

## MVP acceptance scenarios

1. A new user can create a pet and record a first treat while offline.
2. A returning user can record a favorite from Today in two taps or fewer.
3. Two pets maintain separate daily totals and histories.
4. Editing a treat's calorie estimate does not change existing event totals.
5. An event recorded while traveling remains assigned to the local day on which it was entered.
6. Insights include zero-event days and disclose unknown calorie data.
7. The app restarts without connectivity and retains all committed events.
8. A user can export records without creating an account.
