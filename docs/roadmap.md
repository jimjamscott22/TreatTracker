# Delivery roadmap

This roadmap is ordered by dependency and risk, not calendar estimates.

## Phase 0: foundation

### Deliverables

- Expo TypeScript scaffold with Expo Router
- Strict TypeScript, formatting, linting, and test configuration
- Theme tokens and accessible base components
- SQLite client and numbered migration runner
- Development, preview, and production EAS profiles
- CI checks for types, lint, tests, and Expo export

### Exit criteria

- Application launches on a physical iPhone.
- Application launches in airplane mode.
- Fresh and migrated test databases initialize successfully.
- EAS preview build installs using the intended Apple Developer team.

## Phase 1: local tracking vertical slice

### Deliverables

- First-run pet creation
- Active pet selection
- Treat catalog
- Add-treat form
- Today list and totals
- Edit and delete event
- Durable event snapshots

### Exit criteria

- A user can create two pets and record separate histories offline.
- Restarting the application preserves records.
- Catalog edits do not modify old event totals.
- Failed writes do not produce phantom totals.
- Core flow passes an end-to-end test and physical-device smoke test.

## Phase 2: speed and daily usefulness

### Deliverables

- Favorites and recent treats
- Two-tap quick-add with Undo
- Optional count or calorie budget
- Previous-day navigation
- History calendar/list
- Search and filters

### Exit criteria

- A favorite can be recorded in two taps or fewer.
- Unknown calories are consistently distinguished from zero.
- Daily grouping passes timezone and daylight-saving tests.
- All common controls meet touch-target and screen-reader requirements.

## Phase 3: explainable insights

### Deliverables

- 7-day and 30-day range summaries
- Daily count and known-calorie visualizations
- Prior-period comparisons
- Top treat and category rankings
- Calculation explanation sheets
- Accessible chart alternatives

### Exit criteria

- Pure-function tests cover every calculation rule in the product specification.
- Zero-event days are included in averages.
- Missing calorie data is disclosed.
- Each insight names exact current and comparison dates.
- Screen reader users can obtain the same information without interpreting a chart.

## Phase 4: reminders and portability

### Deliverables

- Opt-in local reminders
- Notification reconciliation
- Versioned JSON export
- Safe CSV export
- Native share flow
- Privacy and support copy

### Exit criteria

- Permission denial does not block or repeatedly interrupt usage.
- Notifications survive expected application restarts and setting changes.
- Export round-trip tests preserve event values.
- CSV formula-injection defenses are tested.
- Temporary exports follow the documented cleanup policy.

## Phase 5: release hardening

### Deliverables

- App icon, launch assets, and production metadata
- Error recovery and migration-failure experience
- Performance and accessibility review
- Privacy policy and App Store privacy declarations
- TestFlight release candidate

### Exit criteria

- Production EAS build succeeds.
- TestFlight build completes the full physical-iPhone smoke test.
- No secrets or signing assets exist in source control.
- VoiceOver, Dynamic Type, reduced motion, and offline behavior are verified.
- Release notes state known limitations, including lack of cloud backup.

## Deferred decision: accounts and synchronization

Do not begin cloud synchronization as incidental cleanup. First validate:

- Whether users need backup, household sharing, or both.
- Required identity and invitation model.
- Conflict behavior for simultaneous edits and deletes.
- Data retention and account deletion obligations.
- Offline outbox, retry, and migration behavior.
- Supabase row-level security model.

Write and approve a synchronization design before implementation.

## Product questions to validate

- Is event count, calorie estimate, or both most valuable for daily context?
- Do users think in pieces, package servings, weight, or custom portions?
- How often is more than one pet tracked?
- Does quick-add need a confirmation, or is Undo sufficient?
- Which history view best supports real recall: calendar, grouped list, or both?
- Are evening review reminders useful without becoming guilt-inducing?
- Is local export sufficient before cloud backup?

## Backlog after MVP

- Shared households and giver attribution
- Encrypted cloud backup and cross-device sync
- Barcode-assisted catalog entry
- Home-screen widgets
- Siri/App Intent quick entry
- Apple Watch companion entry
- Import from prior exports
- Veterinarian-friendly printable report

Each item requires its own product justification and privacy/accessibility review.

## Definition of done

A feature is complete only when:

- User-visible behavior matches the product and UX documents.
- Durable changes include migration coverage.
- Domain logic has deterministic tests.
- Error, empty, loading, and permission-denied states are handled.
- Accessibility labels and large-text layouts are verified.
- Core behavior works offline.
- Relevant documentation is updated.
- Formatting, linting, types, tests, and production export pass.
- Physical-device checks are reported when platform behavior is involved.
