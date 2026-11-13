// @ts-check
/**
 * Architecture as data: element types and the dependency policies between them
 * (docs/ENGINEERING_STANDARDS.md §1, ADR-001). Default is "disallow"; every allowed edge is listed.
 *
 * Inward-only rule:   presentation ──► application ──► domain   ◄── infrastructure
 * Composition root:   only src/core/di may import infrastructure from outside infrastructure.
 * Module boundaries:  other modules are reachable only through `src/modules/<name>/index.ts`.
 */

const SAME_MODULE = { module: '{{ from.element.captured.module }}' };

/** @param {string} type @param {Record<string, string>} [captured] */
const element = (type, captured) => ({ element: captured ? { type, captured } : { type } });

/** @param {string} type */
const sameModule = (type) => element(type, SAME_MODULE);

/** The public API of any module: the index.ts directly under src/modules/<name>/. */
const MODULE_PUBLIC_API = { element: { type: 'module', fileInternalPath: 'index.ts' } };

const SHARED_DOMAIN = element('shared-domain');
const SHARED_APPLICATION = element('shared-application');
const SHARED_INFRASTRUCTURE = element('shared-infrastructure');
const SHARED_UI = element('shared-ui');
const CORE_DI = element('core-di');
const CORE_BOOTSTRAP = element('core-bootstrap');
const CORE_PRESENTATION = element('core-presentation');
const TEST_SUPPORT = element('test-support');

/**
 * Layer folders are listed before `module`, so a file inside a layer is classified by its layer
 * and only files directly under src/modules/<name>/ (the index.ts) are of type `module`.
 */
const elementDescriptors = [
  { type: 'shared-domain', pattern: 'src/shared/domain', partialMatch: false },
  { type: 'shared-application', pattern: 'src/shared/application', partialMatch: false },
  { type: 'shared-infrastructure', pattern: 'src/shared/infrastructure', partialMatch: false },
  { type: 'shared-ui', pattern: 'src/shared/ui', partialMatch: false },
  ...['domain', 'application', 'infrastructure', 'presentation'].map((layer) => ({
    type: `module-${layer}`,
    pattern: `src/modules/*/${layer}`,
    capture: ['module'],
    partialMatch: false,
  })),
  { type: 'module', pattern: 'src/modules/*', capture: ['module'], partialMatch: false },
  { type: 'core-di', pattern: 'src/core/di', partialMatch: false },
  { type: 'core-bootstrap', pattern: 'src/core/bootstrap', partialMatch: false },
  { type: 'core-presentation', pattern: 'src/core/presentation', partialMatch: false },
  { type: 'app', pattern: 'app', partialMatch: false },
  { type: 'test-support', pattern: 'test', partialMatch: false },
];

const fileDescriptors = [{ pattern: '**/*.test.{ts,tsx}', category: 'test' }];

/**
 * @param {object} from selector of the importing element
 * @param {object[]} to selectors of the elements it may import
 */
const allow = (from, to) => ({ from, allow: { to } });

const ALL_SOURCE_ELEMENTS = [
  SHARED_DOMAIN,
  SHARED_APPLICATION,
  SHARED_INFRASTRUCTURE,
  SHARED_UI,
  element('module-domain'),
  element('module-application'),
  element('module-infrastructure'),
  element('module-presentation'),
  element('module'),
  CORE_DI,
  CORE_BOOTSTRAP,
  CORE_PRESENTATION,
];

const dependencyPolicies = [
  // Shared kernel
  allow(SHARED_DOMAIN, [SHARED_DOMAIN]),
  allow(SHARED_APPLICATION, [SHARED_DOMAIN, SHARED_APPLICATION]),
  allow(SHARED_INFRASTRUCTURE, [SHARED_DOMAIN, SHARED_APPLICATION, SHARED_INFRASTRUCTURE]),
  allow(SHARED_UI, [SHARED_UI]),

  // Feature modules (own layers only; other modules through their public API)
  allow(element('module-domain'), [SHARED_DOMAIN, sameModule('module-domain')]),
  allow(element('module-application'), [
    SHARED_DOMAIN,
    SHARED_APPLICATION,
    sameModule('module-domain'),
    sameModule('module-application'),
    MODULE_PUBLIC_API,
  ]),
  allow(element('module-infrastructure'), [
    SHARED_DOMAIN,
    SHARED_APPLICATION,
    SHARED_INFRASTRUCTURE,
    sameModule('module-domain'),
    sameModule('module-application'),
    sameModule('module-infrastructure'),
    MODULE_PUBLIC_API,
  ]),
  allow(element('module-presentation'), [
    SHARED_DOMAIN,
    SHARED_APPLICATION,
    SHARED_UI,
    CORE_PRESENTATION,
    sameModule('module-domain'),
    sameModule('module-application'),
    sameModule('module-presentation'),
    MODULE_PUBLIC_API,
  ]),
  // A module's index.ts re-exports its own domain, application and presentation, never infrastructure.
  allow(MODULE_PUBLIC_API, [
    sameModule('module-domain'),
    sameModule('module-application'),
    sameModule('module-presentation'),
  ]),

  // Core: composition root, bootstrap sequence, React binding
  allow(CORE_DI, [
    SHARED_DOMAIN,
    SHARED_APPLICATION,
    SHARED_INFRASTRUCTURE,
    element('module-domain'),
    element('module-application'),
    element('module-infrastructure'),
    MODULE_PUBLIC_API,
    CORE_DI,
    CORE_BOOTSTRAP,
  ]),
  allow(CORE_BOOTSTRAP, [SHARED_DOMAIN, SHARED_APPLICATION, MODULE_PUBLIC_API, CORE_BOOTSTRAP]),
  allow(CORE_PRESENTATION, [
    SHARED_DOMAIN,
    SHARED_APPLICATION,
    SHARED_UI,
    CORE_BOOTSTRAP,
    CORE_PRESENTATION,
  ]),
  // The React binding needs the container *types* only, never the production wiring.
  { from: CORE_PRESENTATION, allow: { to: [CORE_DI] }, dependency: { kind: 'type' } },

  // expo-router routes: thin wiring of screens and the production container
  allow(element('app'), [MODULE_PUBLIC_API, CORE_PRESENTATION, CORE_DI, SHARED_UI, element('app')]),

  // Test support (fakes, builders, contracts) may use any production code, never the reverse.
  allow(TEST_SUPPORT, [...ALL_SOURCE_ELEMENTS, TEST_SUPPORT]),
  // Test files keep their layer's rules and may additionally use test support and build containers.
  allow({ file: { categories: 'test' } }, [TEST_SUPPORT, CORE_DI, CORE_PRESENTATION]),
];

module.exports = { elementDescriptors, fileDescriptors, dependencyPolicies };
