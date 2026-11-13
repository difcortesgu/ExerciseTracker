// @ts-check
/**
 * External packages each layer must not import (gitignore-style patterns of `no-restricted-imports`).
 * Internal layer/module rules live in boundary-policies.js.
 */

const DATABASE_PACKAGES = ['expo-sqlite', 'drizzle-orm', 'better-sqlite3'];

/** Expo/native services that must sit behind an application port (ENGINEERING_STANDARDS §1.1). */
const DEVICE_SERVICE_PACKAGES = [
  'expo-audio',
  'expo-av',
  'expo-speech',
  'expo-haptics',
  'expo-notifications',
  'expo-file-system',
  'expo-keep-awake',
  'expo-image-picker',
  'expo-task-manager',
  'expo-background-fetch',
  'expo-crypto',
  'expo-document-picker',
  'expo-sharing',
];

const FRAMEWORK_PACKAGES = [
  'react',
  'react-dom',
  'react-native',
  'react-native-*',
  '@react-native/*',
  '@react-navigation/*',
  'expo',
  'expo-*',
  '@expo/*',
  'zustand',
  'node:*',
];

const forbiddenImportsInInnerLayers = {
  patterns: [
    {
      group: [...FRAMEWORK_PACKAGES, ...DATABASE_PACKAGES],
      message:
        'domain and application must stay free of frameworks and I/O (ENGINEERING_STANDARDS §1.1); depend on a port instead.',
    },
  ],
};

const forbiddenImportsInPresentation = {
  patterns: [
    {
      group: [...DATABASE_PACKAGES, ...DEVICE_SERVICE_PACKAGES],
      message:
        'presentation must not call SQLite or device services directly; resolve a use case from the DI container (ENGINEERING_STANDARDS §5).',
    },
  ],
};

/** better-sqlite3 is the Node SQLite driver for Jest only (ADR-001); it cannot run in Expo Go. */
const forbiddenImportsInProductionAdapters = {
  patterns: [
    {
      group: ['better-sqlite3'],
      message:
        'better-sqlite3 is a Node-only test driver; production adapters use expo-sqlite. Create test databases in test/ or *.test.ts files.',
    },
  ],
};

module.exports = {
  forbiddenImportsInInnerLayers,
  forbiddenImportsInPresentation,
  forbiddenImportsInProductionAdapters,
};
