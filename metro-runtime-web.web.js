// Web only: pulls in the Expo Metro web runtime (Fast Refresh / web shims).
// A native stub (metro-runtime-web.js) takes its place on Android/iOS so Metro
// never has to resolve @expo/metro-runtime (and its expo-constants dep) there.
require('@expo/metro-runtime');
