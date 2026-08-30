# Treat-Tracker

Treat-Tracker is an offline-first iPhone application for quickly recording treats given to dogs and cats and reviewing patterns over time.

This repository handoff contains product and technical design documents. It intentionally does not include an application scaffold yet.

## Product goals

- Record a treat in a few seconds.
- Make the current day's activity obvious.
- Support multiple pets without mixing their histories.
- Show useful 7-day and 30-day trends.
- Work without an internet connection.
- Avoid presenting tracking estimates as veterinary advice.

## Recommended stack

- **Client:** React Native with Expo and TypeScript
- **Navigation:** Expo Router
- **Local persistence:** `expo-sqlite` behind a repository layer
- **Validation:** Zod
- **UI state:** Zustand, limited to transient interface state
- **Forms:** React Hook Form
- **Notifications:** Expo Notifications
- **Testing:** Jest, React Native Testing Library, and Maestro
- **Cloud builds:** Expo Application Services (EAS)
- **Optional later sync:** Supabase Auth and Postgres

This stack can be developed on Linux or Windows, tested on an iPhone with Expo Go or an EAS development build, and built for TestFlight in the cloud. A Mac is not required for the normal workflow. An active Apple Developer Program membership is required for TestFlight and App Store distribution.

## Proposed repository layout

```text
app/                    Expo Router routes
src/
  components/           Reusable UI
  features/             Feature modules
  db/                   Schema, migrations, repositories
  domain/               Domain types and calculations
  state/                Transient UI state
  theme/                Tokens and styling
  utils/                Shared utilities
assets/                 Images, fonts, and icons
docs/                   Product and engineering decisions
e2e/                    Maestro flows
```

## Documents

- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [UX flows](docs/ux-flows.md)
- [Visual design](docs/visual-design.md)
- [Delivery roadmap](docs/roadmap.md)
- [Agent guidance](AGENTS.md)

## Suggested first implementation

1. Scaffold an Expo TypeScript application with Expo Router.
2. Add the local database schema and migrations.
3. Implement pet setup and the Today screen.
4. Implement quick-add and custom treat entry.
5. Add history editing and deletion.
6. Add deterministic trend calculations and tests.
7. Configure EAS and validate on a physical iPhone.

Install current package releases through the package manager rather than copying version numbers from these documents.

## Product principles

- **Fast first:** common treats should take no more than two taps to record.
- **Local first:** core tracking must never depend on connectivity.
- **Explain calculations:** every insight should reveal its date range and basis.
- **Preserve history:** editing a treat catalog item must not rewrite old entries.
- **Respect privacy:** collect no account or analytics data until it provides clear user value.
- **Stay in scope:** Treat-Tracker records user-entered information; it does not diagnose or prescribe.

## Status

The project is in the design/handoff stage. See `docs/roadmap.md` for the recommended implementation sequence and MVP completion criteria.
