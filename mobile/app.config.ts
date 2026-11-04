import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Fute.io',
  slug: 'futeio',
  version: '0.1.0',
  scheme: 'futeio',
  platforms: ['android', 'ios'],
  userInterfaceStyle: 'automatic',
  backgroundColor: '#f7f7f2',
  ios: {
    bundleIdentifier: 'com.futeio.app',
    supportsTablet: false,
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.futeio.app',
    blockedPermissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    ['expo-secure-store', { configureAndroidBackup: true }],
  ],
};

export default config;
