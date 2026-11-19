const { getDefaultConfig } = require('expo/metro-config');

// Expo detects the pnpm workspace and resolves its packages without manual aliases.
module.exports = getDefaultConfig(__dirname);
