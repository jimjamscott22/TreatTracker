# AGENTS.md

This file guides coding agents and contributors working on Treat-Tracker.

## Mission

Build an offline-first Expo application that lets a person record a pet treat in seconds and understand daily, weekly, and monthly patterns. Optimize for reliability and clarity before adding social, cloud, or machine-learning features.

## Read first

Before changing behavior, read:

1. `docs/product-spec.md`
2. `docs/architecture.md`
3. `docs/data-model.md`
4. The relevant feature section in `docs/ux-flows.md`

If implementation and documentation disagree, do not silently choose one. Preserve user data, document the discrepancy, and update the governing design decision with the code change.

## Non-negotiable constraints

- The primary target is iPhone.
- Development and release must work without a local Mac by using Expo and EAS.
- Core entry, history, and insights features must work offline.
- Store event timestamps in UTC and preserve the event's local calendar date.
- Snapshot display and calorie values on each event so catalog edits do not alter history.
- Treat calorie values are estimates supplied by the user or packaging.
- Do not provide diagnosis, treatment, or fixed nutritional recommendations.
- Make daily budgets optional and user-configurable.
- Do not require an account for the MVP.
- Do not add telemetry, advertising, or third-party tracking by default.

## Engineering conventions

- Use TypeScript with strict mode; avoid `any`.
- Keep domain calculations in pure functions under `src/domain`.
- Access SQLite through repositories; UI components must not execute SQL.
- Use schema validation at form, import, and sync boundaries.
- Keep Zustand stores for transient UI state, not durable records.
- Prefer feature-local components until reuse is demonstrated.
- Use stable UUIDs for persisted entities.
- Store energy as integer thousandths of a kilocalorie when calculations require precision; format values for display at the boundary.
- Use accessible labels, dynamic type, and a minimum 44-by-44-point touch target.
- Use the current stable dependency releases installed through the package manager.

## Data safety

- Every schema change requires a forward migration and a migration test.
- Destructive actions require confirmation and should use soft deletion when future synchronization may be affected.
- Updates to catalog treats must never mutate prior event snapshots.
- Import operations must validate the entire input and report rejected rows.
- Exported data must use a documented, versioned format.

## Testing expectations

For each behavior change, add the lowest-cost test that proves it:

- Unit tests for date grouping, totals, averages, budget percentages, and migrations.
- Component tests for validation, empty states, and quick-add interactions.
- End-to-end tests for onboarding, recording, editing, deleting, and viewing an insight.
- Physical-iPhone smoke testing for notifications, safe areas, keyboard behavior, and offline launches.

Before marking work complete:

1. Run formatting, linting, type checking, and relevant tests.
2. Run the production Expo export or equivalent build check.
3. Confirm no secret, signing credential, or personal data is committed.
4. Update documents when a decision or user-visible behavior changes.
5. Report exactly which checks passed and any checks not run.

## Scope control

MVP includes:

- Local pet profiles
- Treat catalog and favorites
- Fast event entry
- Daily summary and optional budget
- History with edit/delete
- 7-day and 30-day insights
- Local reminders
- Data export

MVP excludes:

- Accounts and cross-device synchronization
- Shared households
- Veterinary recommendations
- Image recognition or barcode scanning
- Public social features
- Subscription billing

Implement excluded features only after an explicit product decision updates the documentation.

## Decision priorities

When requirements compete, use this order:

1. Prevent data loss or corruption.
2. Preserve offline behavior.
3. Keep treat entry fast.
4. Maintain accessibility.
5. Keep calculations explainable.
6. Reduce implementation complexity.

## Commit and review guidance

- Keep commits focused and describe user-visible outcomes.
- Include database migrations with the model change that needs them.
- Never commit generated signing files, `.env` secrets, or Apple credentials.
- Explain unusual platform-specific choices in `docs/architecture.md`.
