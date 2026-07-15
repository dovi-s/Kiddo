module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 moved its Babel transform into react-native-worklets.
    // MUST be the last plugin in the list (it rewrites worklet functions).
    plugins: ["react-native-worklets/plugin"],
  };
};
