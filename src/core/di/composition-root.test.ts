import { openDatabaseSync } from 'expo-sqlite';

import { BootstrapperToken } from '@core/bootstrap/bootstrapper';
import { ClockToken } from '@shared/application/clock';
import { DatabaseMigratorToken } from '@shared/application/database-migrator';
import { IdGeneratorToken } from '@shared/application/id-generator';
import { LoggerToken } from '@shared/application/logger';
import { SqliteDatabaseMigrator } from '@shared/infrastructure/db/sqlite-database-migrator';
import { CryptoIdGenerator } from '@shared/infrastructure/ids/crypto-id-generator';
import { ConsoleLogger } from '@shared/infrastructure/logging/console-logger';
import { SystemClock } from '@shared/infrastructure/time/system-clock';
import { unwrapErr } from '@test/support/unwrap';

import { createProductionContainer, DATABASE_FILE_NAME } from './composition-root';
import type { Resolver } from './container';

// Native module boundaries (not available in Jest). Real behaviour of the adapters is covered by
// their own tests and contract suites; this test proves the wiring.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => {
    throw new Error('no native SQLite in Jest');
  }),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '9b2f6c1e-0d7a-4c3b-8e5f-1a2b3c4d5e6f' }));

describe('createProductionContainer', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['Clock', (container: Resolver) => container.resolve(ClockToken), SystemClock],
    [
      'IdGenerator',
      (container: Resolver) => container.resolve(IdGeneratorToken),
      CryptoIdGenerator,
    ],
    ['Logger', (container: Resolver) => container.resolve(LoggerToken), ConsoleLogger],
    [
      'DatabaseMigrator',
      (container: Resolver) => container.resolve(DatabaseMigratorToken),
      SqliteDatabaseMigrator,
    ],
  ] as const)('wires the %s port to its production adapter', (_port, resolvePort, adapter) => {
    expect(resolvePort(createProductionContainer())).toBeInstanceOf(adapter);
  });

  it('does not open the database until something needs it', () => {
    createProductionContainer().resolve(BootstrapperToken);

    expect(openDatabaseSync).not.toHaveBeenCalled();
  });

  it('wires a bootstrapper that opens the app database and reports failures', async () => {
    const bootstrap = createProductionContainer().resolve(BootstrapperToken);

    const error = unwrapErr(await bootstrap());

    expect(openDatabaseSync).toHaveBeenCalledWith(DATABASE_FILE_NAME);
    expect(error).toMatchObject({
      code: 'db.openFailed',
      details: { cause: 'no native SQLite in Jest' },
    });
    expect(consoleError).toHaveBeenCalled();
  });

  it('creates independent containers', () => {
    expect(createProductionContainer().resolve(ClockToken)).not.toBe(
      createProductionContainer().resolve(ClockToken),
    );
  });
});
