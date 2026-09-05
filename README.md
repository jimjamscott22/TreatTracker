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
- [iPhone runtime and persistence options](docs/runtime-and-persistence-options.md)
- [Design canvas divergence](docs/design-canvas-divergence.md)
- [Agent guidance](AGENTS.md)

## Getting started

```bash
npm install
npm start                # Expo dev server
npm run start:dev-client # Expo dev server for an EAS development build
npm run typecheck        # tsc --noEmit
npm test                 # Jest
```

Device builds are produced in the cloud by EAS — see
[Running on an iPhone with an EAS build](#running-on-an-iphone-with-an-eas-build).
Expo Go still works as a no-account fallback and is described further below.

## Running on an iPhone with an EAS build

[EAS Build](https://docs.expo.dev/build/introduction/) compiles the native iOS
app on Expo's macOS builders and manages the signing credentials, so no Mac and
no local Xcode installation are needed. This is the project's primary way onto a
physical iPhone: unlike Expo Go, an EAS build includes any native module the app
depends on, installs to the Home Screen with the real icon and name, and — for
preview and production profiles — launches without a dev server running.

### 1. One-time setup

```bash
npm install -g eas-cli   # or rely on the npx-based npm scripts below
npx eas-cli login        # free Expo account
npx eas-cli init         # links the project and writes extra.eas.projectId
```

`eas init` records the project ID in `app.config.ts`. In CI, the same value can
be supplied as the `EAS_PROJECT_ID` environment variable instead of being
committed.

An [Apple Developer Program](https://developer.apple.com/programs/) membership is
required for anything installed on a physical iPhone (development and preview
builds included) and for TestFlight. `eas build` prompts for Apple credentials on
first use and stores the resulting certificates on EAS, never in this repository.

### 2. Build profiles

`eas.json` defines four profiles:

| Profile | Purpose | Distribution | Needs a dev server |
| --- | --- | --- | --- |
| `development` | Day-to-day development with Fast Refresh and the dev menu | Internal (registered devices) | Yes |
| `development-simulator` | Same, for the iOS Simulator on a Mac | Simulator build | Yes |
| `preview` | Release-candidate testing of the real app | Internal (registered devices) | No |
| `production` | App Store / TestFlight archive | Store | No |

`production` and `preview` set `autoIncrement`, and `cli.appVersionSource` is
`remote`, so EAS owns the build number. The user-visible `version` string stays
in `app.config.ts`.

### 3. Build and install

```bash
npm run build:dev         # development client for a registered iPhone
npm run build:preview     # standalone build for device testing
npm run build:production  # App Store archive
```

Each command prints a build page URL. When the build finishes, open that URL (or
the emailed link) on the iPhone and install the app; the device must be
registered with `npx eas-cli device:create` first for internal distribution.

With a `development` build installed, start the bundler in dev-client mode and
open the app:

```bash
npm run start:dev-client
```

`preview` and `production` builds embed the JavaScript bundle and need no
bundler at all.

### 4. TestFlight

```bash
npm run submit:production
```

`eas submit` uploads the latest production build to App Store Connect. The
`submit.production` profile in `eas.json` is intentionally empty so the CLI
prompts for the Apple ID, team, and App Store Connect app on first run; the
answers are stored on EAS.

### Building from GitHub Actions

`.github/workflows/eas-build.yml` runs a build on demand
(**Actions → EAS Build → Run workflow**, choosing a profile and platform). It
needs an [Expo access token](https://expo.dev/settings/access-tokens) stored as
the `EXPO_TOKEN` repository secret, and optionally an `EAS_PROJECT_ID`
repository variable. The regular `CI` workflow is unchanged — it still only
typechecks, tests, and exports, so pull requests do not consume build minutes.

### Troubleshooting EAS builds

- **`eas build` cannot find a project ID:** run `npx eas-cli init`, or export
  `EAS_PROJECT_ID` before the build.
- **The iPhone refuses to install an internal build:** the device is not in the
  provisioning profile. Run `npx eas-cli device:create`, register the phone, and
  rebuild — adding a device does not update existing builds.
- **Build fails during the native install step:** run `npm ci` locally and
  confirm `npm run export:check` passes; a bundling failure surfaces there in a
  minute instead of after a queued cloud build.
- **Credentials prompts in CI:** the workflow passes `--non-interactive`, so any
  missing credential fails the run rather than hanging. Create it once locally
  with an interactive `eas build`.

## Running on an iPhone with Expo Go

Expo Go remains a useful fallback when there is no Apple Developer membership yet, or for a quick look at a branch without waiting on a cloud build. Expo Go is a free sandbox app from Apple's App Store that can load and run this project directly, with no Mac and no Apple Developer account required. This is the fastest way to try the app on a real device during development.

### 1. Install Expo Go on the iPhone

Install **Expo Go** from the [App Store](https://apps.apple.com/app/expo-go/id982107779). Optionally sign in with (or create) a free Expo account in the app — this makes reconnecting to your project easier and isn't required to get started.

### 2. Install dependencies on your computer

From the repository root:

```bash
npm install
```

### 3. Start the Expo dev server

```bash
npm start
```

This runs `expo start` and prints a QR code in the terminal, along with a small interactive menu (press `?` to see all options). Leave this process running while you develop — it rebuilds your JavaScript bundle and pushes updates to the app automatically.

### 4. Connect your iPhone

- **Same Wi-Fi (recommended):** Make sure the iPhone and the computer running the dev server are on the same Wi-Fi network. Open the iPhone's Camera app and point it at the QR code in the terminal (or in the Expo Dev Tools browser tab); tap the notification banner to open the project in Expo Go.
- **Different networks / restrictive Wi-Fi:** If the iPhone can't reach the dev server (e.g. corporate/guest Wi-Fi that isolates devices, or the computer is on Ethernet), press `s` in the terminal to switch to tunnel mode, or run `npm start -- --tunnel` directly. Tunnel mode routes the connection through Expo's servers instead of the local network, at the cost of a slower reload. The first use of tunnel mode installs `@expo/ngrok` if it isn't already present.
- **Signed in to the same Expo account:** If you signed in to Expo Go on the iPhone and to the Expo CLI on your computer (`npx expo login`), the running project also shows up under the "Recently opened" list in Expo Go without scanning anything.

### 5. Iterate

- Save a file and the app reloads automatically (Fast Refresh).
- Shake the iPhone (or use the Expo Go menu) to open the in-app developer menu for a manual reload, toggling performance monitors, etc.
- Terminal keyboard shortcuts while the dev server is running: `r` reloads the app, `m` toggles the dev menu, `j` opens the JS debugger, `c` clears the terminal.

### Troubleshooting Expo Go

- **Stuck on "Connecting..." or bundling never finishes:** Confirm both devices are on the same network and that no VPN is active on either one, then retry with tunnel mode (`s` in the terminal, or `npm start -- --tunnel`).
- **Nothing happens when scanning the QR code:** Make sure Expo Go (not a generic QR reader) opens it — on iPhone, scanning with the system Camera app is enough; it will hand off to Expo Go automatically.
- **Metro/dev server port already in use:** Stop any previous `npm start` process, or run `npx expo start --clear` to reset the bundler cache and pick a new port if prompted.
- **Native module errors on load:** Expo Go can only run modules that ship in the current Expo SDK. Everything this project currently depends on (`expo-sqlite`, `expo-notifications`, `expo-router`, etc.) works in Expo Go; if a future dependency doesn't, you'll need an [EAS development build](https://docs.expo.dev/develop/development-builds/introduction/) instead (see `eas.json`).

### Known Expo Go limitation: notifications

Expo Go does not support **remote/push** notifications as of Expo SDK 53+ (this project targets SDK 57). **Local** notifications — which is what `expo-notifications` is used for here — are fully supported in Expo Go. If the project later adds server-sent push notifications, testing those will require an EAS development build rather than Expo Go.

## Implementation progress

1. ✅ Scaffold an Expo TypeScript application with Expo Router.
2. ✅ Add the local database schema and migrations.
3. 🚧 Implement pet setup and the Today screen — onboarding and Today are in place; the pet switcher, day navigation, and budget display are not.
4. 🚧 Implement quick-add and custom treat entry — quick-add with Undo and the add-treat sheet (header **Add** + empty-state **Add a treat**) are on this branch; catalog editing from Settings is not.
5. ⬜ Add history editing and deletion — repository methods exist (`updateEvent`, `softDeleteEvent`, `restoreEvent`); the History screen is a placeholder.
6. 🚧 Add deterministic trend calculations and tests — `src/domain` and its tests are done; charts are not built.
7. 🚧 Configure EAS and validate on a physical iPhone — `eas.json` defines the development, development-simulator, preview, and production profiles, npm scripts and an on-demand GitHub Actions workflow drive them, and `expo-dev-client` ships as a runtime dependency; no cloud build has been run yet, so the Apple credentials and device registration steps are still unverified.

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

Verified so far: `npm run typecheck` passes, Jest tests pass, and
`npx expo export --platform ios` succeeds. Cloud-agent pull requests do **not**
appear on a physical iPhone automatically. Either check the branch out locally
and run `npm run start:dev-client` against an installed EAS development build,
or run `npm run build:preview` from the branch for a standalone build that needs
no dev server.
