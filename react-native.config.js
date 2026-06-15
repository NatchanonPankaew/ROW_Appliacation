// The native apps are plain React Native and don't use any Expo native modules
// (expo is only used for the web export / Metro runtime). Exclude Expo packages
// from React Native autolinking so the Android/iOS builds don't try to compile
// the :expo Gradle project (which needs the Expo module gradle plugin).
module.exports = {
  dependencies: {
    expo: { platforms: { android: null, ios: null } },
    'expo-modules-core': { platforms: { android: null, ios: null } },
    'expo-modules-autolinking': { platforms: { android: null, ios: null } },
  },
};
