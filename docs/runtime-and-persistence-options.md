# iPhone runtime and persistence options

Findings current as of September 2, 2026.

## Executive summary

Treat-Tracker does not need to run continuously in the background to retain
data. A standalone iOS build stores its SQLite database in the app sandbox and
can be opened directly from the Home Screen without Metro, Expo Go, a laptop,
or a server. iOS normally suspends ordinary apps in the background; persistence
comes from committed storage, not from keeping the process alive.

The shortest path to the requested experience is therefore:

1. Create an EAS preview build for a single registered iPhone, or use
   TestFlight while preparing an App Store release.
2. Keep the existing on-device SQLite architecture.
3. Finish versioned export and establish a backup routine before treating the
   phone as the only copy of important records.

A web app behind Tailscale Serve is viable when a private URL is more important
than offline operation. It is not just a hosting change, however. The reliable
version needs an always-on host, an application/API process, server-side
storage, backups, and web-specific work. Tailscale Serve supplies private HTTPS
reachability; it does not keep the application process alive or make storage
persistent.

## Clarifying “background service”

- **On the iPhone:** Neither a normal native app nor a Home Screen web app is a
  general-purpose daemon. iOS schedules limited background work and otherwise
  suspends applications. Treat-Tracker does not need background execution for
  entry, history, insights, or SQLite durability.
- **On a server:** A web backend can run continuously under systemd or a
  container restart policy. This is the service that Tailscale Serve can expose.
- **During development:** Metro is a development bundler. Keeping `expo start`
  alive is not a production deployment strategy.
- **In Tailscale:** `tailscale serve --bg` preserves and resumes the proxy
  configuration, including after a reboot, but the target web server must have
  its own process supervision. The host must remain powered on and connected to
  the tailnet.

## Options

| Option | Home Screen experience | Source of truth | Offline | Code/operations impact | Main limitation |
| --- | --- | --- | --- | --- | --- |
| Standalone Expo iOS app | Native icon and launch | SQLite on the iPhone | Full | Lowest; finish EAS release work | No backup or second-device access until export/sync exists |
| Browser-local Expo PWA | Safari “Add to Home Screen” | Browser storage on that iPhone | Possible with a service worker | Medium; web compatibility, PWA, and hosting work | Browser data is more fragile than native app data |
| Tailscale-served web app with API | Private Home Screen URL | SQLite on an always-on host | No, unless an offline cache/outbox is added | High; add API, web repository, service management, and backup | Host and Tailscale must be available |
| Managed web app and database | Public or authenticated URL | Managed Postgres/libSQL-style service | No, unless sync is designed | High; accounts, authorization, privacy, and migrations | Changes the account-free, local-first MVP |
| Native app plus private sync/backup service | Native icon | Local SQLite plus synchronized server copy | Full | Highest; outbox, identity, conflicts, tombstones, recovery | Sync is a new subsystem, not a repository swap |

### 1. Standalone Expo iOS app — recommended now

This best matches the current product specification and requires the least new
architecture. The repository already has EAS development, preview, and
production profiles.

- An EAS preview build can be installed from a link, but iOS ad hoc
  distribution requires the phone's UDID in the provisioning profile.
- TestFlight avoids running Metro and supports broader testing, but builds
  expire after 90 days.
- An App Store release is the durable distribution path.
- EAS Build and Submit do not require a local Mac, but iOS distribution requires
  a paid Apple Developer account.
- Existing local notifications and offline behavior remain native.

SQLite survives ordinary app termination, suspension, phone restarts, and app
updates. It should not be described as a backup: deleting the app can delete its
local records, and Treat-Tracker's export flow is still roadmap work.

### 2. Browser-local Expo PWA

This removes Apple signing and can be deployed as static files. The user can add
the HTTPS site to the iPhone Home Screen. Data would remain on that browser
installation rather than on the host.

This is not currently a one-command conversion:

- Expo Router needs a web manifest for installability and a separately
  configured service worker for offline asset caching.
- `expo-sqlite` web support in the repository's Expo SDK 54 is alpha. It
  requires WebAssembly support plus `Cross-Origin-Opener-Policy` and
  `Cross-Origin-Embedder-Policy` response headers.
- Direct Tailscale Serve file hosting does not expose response-header
  configuration in its documented CLI. A small HTTP server or reverse proxy
  behind Serve would be needed to set the SQLite headers.
- Safari storage is best-effort by default. A Home Screen web app can request
  persistent mode with the Storage API, but WebKit grants it heuristically and
  the user can still clear site data.
- Browser data is tied to an origin. Changing hostname or scheme creates a
  different storage location unless data is migrated.
- `expo-notifications` does not support web. Reminders would need a separate Web
  Notifications/Push implementation and iPhone-specific validation.

This option is reasonable for a convenience copy or prototype. It should not be
the sole copy of records until export, persistent-storage checks, quota/error
handling, and restore tests exist.

### 3. Web app, server-side SQLite, and Tailscale Serve

This most closely matches “open a private URL from my iPhone and have persistent
storage.” A practical single-user shape is:

```text
iPhone Home Screen web app
          |
   Tailscale VPN / HTTPS
          |
    Tailscale Serve
          |
  127.0.0.1 web app + API
          |
  persistent SQLite volume
          |
 encrypted off-host backup
```

On the Linux host:

1. Export and serve the web client, or run an Expo/Node web server.
2. Bind the application to loopback, for example `127.0.0.1:3000`.
3. Run it under systemd or a container with a restart policy.
4. Store SQLite on a durable local or container-mounted volume.
5. Configure `tailscale serve --bg http://127.0.0.1:3000`.
6. Restrict access with tailnet grants/ACLs and keep Funnel disabled unless
   deliberate public exposure is required.
7. Enable Tailscale's VPN On Demand behavior on the iPhone if seamless tailnet
   reconnection is important.
8. Back up SQLite off-host with a SQLite-aware online backup or continuous WAL
   replication such as Litestream, and regularly test restore.

The application changes are material. UI components cannot use the current
on-device repository directly; web requests need a validated API and a
server-side repository. This approach also gives up the present offline
guarantee unless the browser gains a local cache, mutation outbox, retries, and
conflict rules.

An always-on Raspberry Pi, NAS, home server, or small VPS can be the host. A
laptop that sleeps is a poor host, and an ephemeral development workspace must
not hold the only database copy.

### 4. Managed web hosting and database

A static or server-rendered Expo web client can be hosted by EAS Hosting,
Netlify, Cloudflare, or similar infrastructure, with a managed database/API.
This avoids maintaining an always-on home machine and makes the URL reachable
without Tailscale.

It also introduces the largest product-policy changes for a web-only path:
authentication, authorization, internet dependency, provider retention,
privacy documentation, database cost, and account deletion. A private,
unguessable URL is not an adequate authorization design. This option should
follow an explicit decision to change the account-free MVP.

### 5. Keep native and add private backup or synchronization later

The native app can retain local SQLite as the runtime source and synchronize to
a service reachable through Tailscale. This preserves fast offline entry while
adding backup or multi-device access.

It is the strongest long-term capability but not the easiest way to install the
app. It requires the synchronization design already called for in
`architecture.md`: stable actor identity, mutation outbox, retries, conflict
rules, tombstones, server revisions, and tested restore behavior. Backup-only
upload of versioned exports is simpler than bidirectional sync and should be
considered first if disaster recovery is the actual requirement.

## Was web plus Tailscale Serve the easier choice?

It would have been easier for **private URL distribution**: no Apple review,
signing, or per-device native installation. It would not have been easier for
the documented product requirements:

- The existing app is intentionally offline-first and already has native
  SQLite repositories.
- Native SQLite and local notifications are mature on iPhone; their Expo web
  equivalents need additional work or are unsupported.
- A browser-only database is not as strong a sole persistence layer.
- A server-backed web version adds an API and operational responsibility.
- Tailscale access still depends on an online host and an active tailnet
  connection.

Therefore, web plus Tailscale is a useful alternative deployment target, not a
simpler replacement for the current architecture. If the immediate problem is
that Expo Go only works while Metro is running, a standalone EAS build solves
that problem directly.

## Suggested decision sequence

1. **Validate the native path:** produce an EAS preview or TestFlight build,
   install it on the target iPhone, record data, force-quit, reboot, launch
   offline, and confirm the records remain.
2. **Protect the only copy:** complete versioned export and document a recurring
   backup/restore check.
3. **Prototype web only if the URL matters:** run the current screens in iPhone
   Safari and inventory platform failures before choosing browser-local or
   server-side storage.
4. **If choosing Tailscale:** use an always-on host, supervised app process,
   durable volume, ACLs, HTTPS headers, health checks, and tested off-host
   backups.
5. **Do not add bidirectional sync incidentally:** approve a dedicated design
   before changing the source-of-truth model.

## Sources

- [Apple: Finish tasks in the background (WWDC25)](https://developer.apple.com/videos/play/wwdc2025/227/)
- [Expo: Distribute an iOS app with TestFlight](https://docs.expo.dev/submit/testflight/)
- [Expo: Internal distribution](https://docs.expo.dev/build/internal-distribution/)
- [Expo SDK 54: SQLite, including alpha web setup](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/)
- [Expo: Progressive web apps](https://docs.expo.dev/guides/progressive-web-apps/)
- [Expo: Static web rendering](https://docs.expo.dev/router/web/static-rendering/)
- [WebKit: Storage quota, eviction, and persistent mode](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [Tailscale Serve command](https://tailscale.com/docs/reference/tailscale-cli/serve)
- [Tailscale Serve examples and access controls](https://tailscale.com/docs/reference/examples/serve)
- [Tailscale: VPN On Demand for iOS](https://tailscale.com/docs/features/client/ios-vpn-on-demand)
- [Litestream: How SQLite WAL replication works](https://litestream.io/how-it-works/)
