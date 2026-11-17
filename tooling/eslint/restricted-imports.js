// @ts-check
/**
 * External packages (gitignore-style patterns of `no-restricted-imports`) and I/O globals
 * (`no-restricted-globals`) each layer must not use. Internal layer/module rules live in
 * boundary-policies.js.
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
  // Self-update (Sprint 0.5, ADR-003): installed-app info, execution environment, installer hand-off.
  'expo-application',
  'expo-constants',
  'expo-intent-launcher',
  // Custom exercise photos (Sprint 1, ADR-004): downscaling happens in the photo store adapter.
  'expo-image-manipulator',
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

/**
 * The bundled free-exercise-db seed (Sprint 1, ADR-004) is read only by the seed source adapter in
 * infrastructure; everything else gets its content through the `ExerciseSeedSource` port.
 */
const seedAssetRestriction = {
  group: ['@assets/exercise-db/*', '**/assets/exercise-db/*'],
  message:
    'the bundled exercise dataset is read only by the seed source adapter (infrastructure); use the exercises use cases or ports instead (ADR-004).',
};

const forbiddenImportsInInnerLayers = {
  patterns: [
    seedAssetRestriction,
    {
      group: [...FRAMEWORK_PACKAGES, ...DATABASE_PACKAGES],
      message:
        'domain and application must stay free of frameworks and I/O (ENGINEERING_STANDARDS §1.1); depend on a port instead.',
    },
  ],
};

const forbiddenImportsInPresentation = {
  patterns: [
    seedAssetRestriction,
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

const NETWORK_MESSAGE =
  'network access is I/O: put it in an infrastructure adapter behind an application port (ADR-003).';

/** HTTP from domain, application or presentation would bypass the ports (e.g. `ReleaseSource`). */
const forbiddenNetworkGlobals = ['fetch', 'XMLHttpRequest', 'WebSocket'].map((name) => ({
  name,
  message: `${name}: ${NETWORK_MESSAGE}`,
}));

module.exports = {
  forbiddenNetworkGlobals,
  forbiddenImportsInInnerLayers,
  forbiddenImportsInPresentation,
  forbiddenImportsInProductionAdapters,
};
