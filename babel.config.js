module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Reanimated 4 separó su plugin a react-native-worklets. Va al final.
      'react-native-worklets/plugin',
    ],
  };
};
