// babel-preset-expo wraps @react-native/babel-preset and adds the web (and
// native) transforms Expo needs, so it works for Android/iOS and web alike.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
