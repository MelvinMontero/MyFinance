// ESLint flat config (ESLint 9+) — uses eslint-config-expo v55+ flat preset
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: [
      'node_modules/',
      '.expo/',
      'dist/',
      'android/',
      'ios/',
      'coverage/',
      '*.config.js',
      'metro.config.js',
      'babel.config.js',
      'tailwind.config.js',
      'eslint.config.js',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
