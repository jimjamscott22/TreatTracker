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

The known Raspberry Pi 5 and MariaDB service materially strengthen the
server-backed web option. If a private URL is the primary goal, the best web
candidate is now a web client and HTTPS API on the Pi, with a dedicated schema
in the existing MariaDB server, exposed through Tailscale Serve. This removes
the need to procure an always-on host or operate another database engine. It
does not change the shortest native path or remove the web/API implementation
work.

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
| Tailscale-served web app with API | Private Home Screen URL | MariaDB on the existing Pi | No, unless an offline cache/outbox is added | Medium-high; host and database already exist, but API and web repositories do not | Pi and Tailscale must be available |
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

### 3. Web app, Raspberry Pi MariaDB, and Tailscale Serve

This most closely matches “open a private URL from my iPhone and have persistent
storage.” The existing Raspberry Pi 5 and MariaDB service make this a practical
single-user shape:

```text
iPhone Home Screen web app
          |
   Tailscale VPN / HTTPS
          |
    Tailscale Serve
          |
  Pi: 127.0.0.1 web app + API
          |
  dedicated MariaDB database
          |
 encrypted off-host backup
```

On the Pi:

1. Export and serve the web client, or run an Expo/Node web server.
2. Bind the application to loopback, for example `127.0.0.1:3000`.
3. Run it under systemd or a container with a restart policy.
4. Create a dedicated MariaDB database and application user. Restrict that user
   to the API host and grant only the required privileges; do not use the
   MariaDB root account.
5. Keep MariaDB off the public internet. The browser connects only to the HTTPS
   API and must never receive database credentials or connect directly to the
   MariaDB port.
6. Configure `tailscale serve --bg http://127.0.0.1:3000`.
7. Restrict access with tailnet grants/ACLs and keep Funnel disabled unless
   deliberate public exposure is required.
8. Enable Tailscale's VPN On Demand behavior on the iPhone if seamless tailnet
   reconnection is important.
9. Include the new database in the Pi's existing MariaDB-aware backup process,
   retain an encrypted off-host copy, and regularly test a restore.

The application changes are material. UI components cannot use the current
on-device repository directly; web requests need a validated API and a
server-side repository using a MariaDB driver. The pure domain calculations and
validation schemas can be shared.

The current SQLite migration cannot be run unchanged against MariaDB:

- `PRAGMA user_version` must become a server-side migration history table.
- SQLite's filtered indexes using `WHERE deleted_at IS NULL` are not supported
  directly by MariaDB and need different indexes or generated columns.
- Boolean, timestamp, check-constraint, and transaction behavior need explicit
  MariaDB mappings and migration tests.
- The server needs a connection pool, bounded query timeouts, health checks,
  and graceful shutdown.

This approach also gives up the present offline guarantee unless the browser
gains a local cache, mutation outbox, retries, and conflict rules. The Pi
removes the hypothetical host and database setup burden, but a laptop that
sleeps or an ephemeral development workspace should still never hold the only
application or database copy.

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
simpler replacement for the current architecture. The existing Pi and MariaDB
make it substantially more attractive than a greenfield server deployment, so
it is now the preferred web architecture if private-URL access outweighs
offline use. If the immediate problem is only that Expo Go requires Metro, a
standalone EAS build still solves that problem more directly.

## Suggested decision sequence

1. **Validate the native path:** produce an EAS preview or TestFlight build,
   install it on the target iPhone, record data, force-quit, reboot, launch
   offline, and confirm the records remain.
2. **Protect the only copy:** complete versioned export and document a recurring
   backup/restore check.
3. **Prototype web only if the URL matters:** run the current screens in iPhone
   Safari and inventory platform failures before choosing browser-local or
   server-side storage.
4. **If choosing Tailscale:** deploy a small API on the Pi, use a dedicated
   least-privilege MariaDB database and user, supervise the app process, enforce
   ACLs and HTTPS headers, and test the existing off-host backup path.
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
- [MariaDB: Security quickstart and least privilege](https://mariadb.com/docs/platform/mariadb-platform-quickstart-guides/security)
- [MariaDB: Online physical backups](https://mariadb.com/docs/server/server-usage/backup-and-restore/mariadb-backup)
