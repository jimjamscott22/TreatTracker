import type { ExpoConfig } from 'expo/config';

/**
 * Expo configuration.
 *
 * Kept in app.config.ts so build settings stay reproducible and reviewable
 * (docs/architecture.md). Signing credentials are managed by EAS and must never
 * be committed here.
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
};

export default config;
