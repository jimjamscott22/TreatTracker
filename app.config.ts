import type { ExpoConfig } from 'expo/config';

/**
 * Expo configuration.
 *
 * Kept in app.config.ts so build settings stay reproducible and reviewable
 * (docs/architecture.md). Signing credentials are managed by EAS and must never
 * be committed here.
 *
 * The iOS bundle identifier and Android package below are what EAS Build signs,
 * so changing them creates a new application rather than a new version of this
 * one. Version bumps are handled by EAS (`appVersionSource: "remote"` in
 * eas.json); only the user-visible `version` string is edited here.
 */
const config: ExpoConfig = {
  name: 'Treat Tracker',
  slug: 'treat-tracker',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'treattracker',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.treattracker.app',
    // The app is fully functional offline; no encryption beyond HTTPS defaults.
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'com.treattracker.app',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: '#F7F3EA',
    },
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#F7F3EA',
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: {
      // Written by `eas init` on first use, or supplied by CI as an
      // environment variable so the value never has to be hardcoded here.
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
};

export default config;
