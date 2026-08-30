# Treat-Tracker

Treat-Tracker is an offline-first iPhone application for quickly recording treats given to dogs and cats and reviewing patterns over time.

This repository contains the product and technical design documents and an Expo application scaffold built from them.

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
- [Design canvas divergence](docs/design-canvas-divergence.md)
- [Agent guidance](AGENTS.md)

## Getting started

```bash
npm install
npm start          # Expo dev server; open with Expo Go on an iPhone
npm run typecheck  # tsc --noEmit
npm test           # Jest
```

## Implementation progress

1. ✅ Scaffold an Expo TypeScript application with Expo Router.
2. ✅ Add the local database schema and migrations.
3. 🚧 Implement pet setup and the Today screen — onboarding and Today are in place; the pet switcher, day navigation, and budget display are not.
4. 🚧 Implement quick-add and custom treat entry — quick-add with Undo works; the add-treat bottom sheet and catalog entry are not built.
5. ⬜ Add history editing and deletion — repository methods exist (`updateEvent`, `softDeleteEvent`, `restoreEvent`); the History screen is a placeholder.
6. 🚧 Add deterministic trend calculations and tests — `src/domain` and its tests are done; charts are not built.
7. ⬜ Configure EAS and validate on a physical iPhone — `eas.json` has the three profiles; no build has been run.

Install current package releases through the package manager rather than copying version numbers from these documents.

## Product principles

- **Fast first:** common treats should take no more than two taps to record.
- **Local first:** core tracking must never depend on connectivity.
- **Explain calculations:** every insight should reveal its date range and basis.
- **Preserve history:** editing a treat catalog item must not rewrite old entries.
- **Respect privacy:** collect no account or analytics data until it provides clear user value.
- **Stay in scope:** Treat-Tracker records user-entered information; it does not diagnose or prescribe.

## Status

Early implementation. The domain and persistence layers are built and tested; Today,
onboarding, and Insights render real data; History and Settings are placeholders.
See `docs/roadmap.md` for the remaining sequence and MVP completion criteria.

Verified so far: `npm run typecheck` passes, 47 Jest tests pass, and
`npx expo export --platform ios` succeeds. The app has not yet been run on a
physical iPhone, so no on-device behavior is confirmed.
