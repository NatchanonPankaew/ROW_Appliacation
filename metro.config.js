// Use Expo's Metro config so the same bundler serves native (Android/iOS) and
// web. @expo/metro-config is a superset of @react-native/metro-config.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
