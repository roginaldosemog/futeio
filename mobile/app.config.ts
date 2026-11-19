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
    blockedPermissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'],
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-web-browser',
    ['expo-secure-store', { configureAndroidBackup: true }],
    ['expo-image-picker', {
      photosPermission: 'Escolha uma foto para seu perfil na pelada.',
      cameraPermission: false,
      microphonePermission: false,
    }],
  ],
};

export default config;
