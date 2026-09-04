# Architecture

## Decision summary

Treat-Tracker should begin as a single offline-first Expo application. SQLite is the source of truth. Cloud accounts and synchronization are deferred until there is a demonstrated need.

## Platform

### React Native with Expo

Expo provides the most practical iPhone workflow for a contributor without a Mac:

- Physical-device development with EAS development builds.
- Expo Go as a fallback when no Apple Developer membership is available and the required modules ship in the Expo SDK.
- Cloud signing and TestFlight/App Store builds through EAS.
- Over-the-air JavaScript updates, subject to App Store rules and compatible native runtime versions.

Local iOS Simulator and Xcode debugging still require macOS. Maintain an Android or web development target where practical, but validate release behavior on a physical iPhone.

## Logical layers

```text
Expo Router screens
        |
Feature components and hooks
        |
Application services / use cases
        |
Domain calculations     Repository interfaces
                               |
                         SQLite repositories
                               |
                           expo-sqlite
```

Dependencies point inward:

- Routes compose features.
- Features call application services.
- Domain functions contain no React, Expo, database, or network imports.
- Repositories translate persistence rows into domain objects.

## Suggested modules

```text
src/
  features/
    onboarding/
    pets/
    treats/
    entries/
    history/
    insights/
    reminders/
    export/
  domain/
    entities.ts
    dates.ts
    totals.ts
    trends.ts
  db/
    client.ts
    migrations/
    repositories/
    schema.ts
  components/
    Button.tsx
    Card.tsx
    EmptyState.tsx
    ProgressBar.tsx
  state/
    preferences.ts
  theme/
    colors.ts
    spacing.ts
    typography.ts
```

## Persistence

Use `expo-sqlite` with explicit, numbered migrations. A thin query builder may be added if it supports Expo reliably, but repository interfaces remain the architectural boundary.

SQLite is authoritative for:

- Pets
- Treat catalog
- Treat events
- Goals
- Reminder configuration
- Durable preferences

Do not duplicate durable records in Zustand. Zustand may hold the active pet selection, draft UI state, and transient filters. Components subscribe to repository-backed query hooks for durable data.

### Writes

- Validate inputs before opening a transaction.
- Write an event and all snapshots atomically.
- Update `updated_at` on every mutation.
- Prefer soft deletion for entities that may later synchronize.
- Return the committed object; do not optimistically invent durable IDs in UI code.

### Reads

- Query only the date range and pet needed by a screen.
- Add indexes for pet/date history and treat search.
- Calculate small summaries in TypeScript pure functions initially.
- Move aggregation to SQL only after profiling, while keeping reference unit tests.

## Date and time semantics

“Today” is a user-facing local calendar concept, not a UTC date.

Each event stores:

- `occurred_at`: instant in UTC.
- `local_date`: `YYYY-MM-DD` as observed when the event was recorded or selected.
- `timezone`: IANA zone when available.
- `utc_offset_minutes`: fallback offset at that instant.

Grouping uses `local_date`. This keeps an event attached to its intended day after travel or daylight-saving changes. Editing the time should recalculate local date and zone from the editor's selected context.

## Trend engine

Place trend calculations in deterministic pure functions:

```ts
summarizeRange(events, calendarDates)
compareRanges(currentSummary, previousSummary)
rankTreats(events)
```

Tests must cover:

- Empty ranges
- Zero-event days
- Unknown calorie values
- Range boundaries
- Daylight-saving transitions
- Previous range with zero values
- Archived and renamed treats
- Deleted events

Use event snapshots for historical labels and calorie values. Insights must never join current catalog nutrition values onto old events.

## State and data flow

1. User action submits a validated command.
2. Application service commits through a repository transaction.
3. The affected query is invalidated or refreshed.
4. The screen renders committed data.
5. Domain selectors derive presentation summaries.

This explicit flow avoids inconsistencies between in-memory and persisted totals.

## Notifications

Use local notifications for MVP reminders. Store the app-level reminder definition and the platform notification identifier. Reconcile scheduled notifications:

- At application launch
- After reminder edits
- After permission status changes

Notification denial is a normal state. Never block app usage or repeatedly prompt.

## Export

Export is generated locally from repository queries. Include a format version and application version. Escape spreadsheet formulas in CSV fields beginning with `=`, `+`, `-`, or `@`. Use the native share sheet only after the file is complete.

## Optional cloud phase

If shared households or backup justify cloud infrastructure:

- Add Supabase Auth and Postgres.
- Keep local SQLite as the runtime source for offline behavior.
- Add an outbox for pending mutations.
- Use stable UUIDs generated on-device.
- Resolve field conflicts with explicit rules, not silent last-write-wins for every entity.
- Treat event creation as append-first; synchronize edits and tombstones.
- Encrypt transport and enforce row-level security by household.

Cloud sync is a new subsystem, not a repository swap. Write a dedicated synchronization design before implementing it.

## Security and privacy

- Store only data required by product features.
- Keep Apple and EAS credentials outside the repository.
- Use platform secure storage for future tokens, never SQLite or Zustand persistence.
- Avoid logging pet notes, exported records, or authentication tokens.
- Document retention and account deletion before cloud launch.
- Add third-party analytics only through an explicit privacy review.

## Error handling

- Preserve the user's draft when a write fails.
- Present actionable, human-readable errors.
- Log technical context without personal record contents.
- Database migration failure must stop writes and provide a recoverable error path.
- Never silently discard an event.

## Build and release

Device builds are produced by EAS Build; no local Mac or Xcode installation is
part of the workflow. The profiles in `eas.json` are:

- `development`: internal development client (`expo-dev-client`), used with a
  local bundler started by `npm run start:dev-client`.
- `development-simulator`: the same profile targeting the iOS Simulator.
- `preview`: internal distribution and release-candidate testing, standalone.
- `production`: App Store archive, submitted through `eas submit`.

Build numbers come from EAS (`cli.appVersionSource: "remote"` with
`autoIncrement` on the release profiles); only the user-visible `version` string
is edited in `app.config.ts`. Builds are started locally through the `build:*`
npm scripts or on demand through the `EAS Build` GitHub Actions workflow, which
authenticates with an `EXPO_TOKEN` secret. Pull-request CI deliberately does not
run cloud builds.

EAS Update is not configured yet: `expo-updates` is not a dependency and the
build profiles set no update channel. Adding it later means installing
`expo-updates`, choosing a `runtimeVersion` policy, and giving each profile a
channel.

Use environment-specific application identifiers only if parallel installation is needed. Let EAS manage signing initially, using the Apple Developer team selected by the account holder. Keep configuration reproducible in `app.config.ts` and `eas.json`.

## Architectural quality gates

- Strict TypeScript passes.
- All migrations pass from a fresh database and each supported prior schema.
- Domain calculations have deterministic unit tests.
- App launches and records an event in airplane mode.
- A production Expo export succeeds.
- An EAS preview build installs and completes the physical-device smoke test.
