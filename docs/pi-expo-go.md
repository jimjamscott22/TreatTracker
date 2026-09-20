# Pi Expo Go service

This is the temporary home-Wi-Fi route for using Treat Tracker before an Apple
Developer Program membership is available. The Pi serves JavaScript to the
iPhone; the treat database stays on the iPhone inside Expo Go. Tailscale Serve
is not involved, and the Pi is not a backup of the phone's records.

1. Sign in to the same free Expo account in Expo Go on the iPhone and on the Pi
   with `npx expo login`. The service runs under the Pi account that installed
   it, so that account's Expo login is used.
2. From the repository, run `bash deploy/install-pi-expo.sh`. It stages a
   stable copy under `/opt/treat-tracker-expo/releases`, installs dependencies,
   activates a systemd service on LAN port 8081, and starts it. The installer
   needs passwordless `sudo` for `/opt` and the systemd unit. Re-run it for
   deliberate app updates.
3. Check `systemctl is-active treat-tracker-expo.service` and
   `journalctl -u treat-tracker-expo.service -n 80 --no-pager`. Open the Expo Go
   project URL shown in the log, or start the same release interactively once
   to scan its QR code. Keep the iPhone and Pi on the same home Wi-Fi.
4. Create a test pet and treat, record an entry, close and reopen Expo Go, and
   confirm the entry remains. Save a full backup to Files and verify the file
   exists before relying on the phone as the only copy.

If the Pi is off, the network changes, or Metro stops, Expo Go cannot reliably
launch the project. An EAS `preview` build removes this dependency after Apple
signing is available. Expo Go and the standalone app keep separate databases;
follow [backup-transfer.md](backup-transfer.md) for the handoff.
