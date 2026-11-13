import type {
  DatabaseMigrator,
  MigrationError,
  MigrationReport,
} from '@shared/application/database-migrator';
import { domainError } from '@shared/domain/domain-error';
import type { Result } from '@shared/domain/result';
import { FakeDatabaseMigrator } from '@test/fakes/fake-database-migrator';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import { BootstrapperToken, createBootstrapper, type StartupError } from './bootstrapper';

const migrationFailure = domainError('db.migrationFailed', 'Database migration "0001" failed.', {
  migration: '0001',
});

describe('createBootstrapper', () => {
  it('runs the pending migrations and resolves to ok', async () => {
    const migrator = new FakeDatabaseMigrator(['0000_init']);
    const bootstrap = createBootstrapper({ migrator, logger: new RecordingLogger() });

    const result = await bootstrap();

    expect(unwrap(result)).toBeUndefined();
    expect(migrator.runs).toBe(1);
  });

  it('logs which migrations were applied', async () => {
    const logger = new RecordingLogger();
    const bootstrap = createBootstrapper({
      migrator: new FakeDatabaseMigrator(['0000_init']),
      logger,
    });

    await bootstrap();

    expect(logger.entriesAt('info')).toEqual([
      {
        level: 'info',
        message: 'Database ready',
        context: { fromVersion: 0, toVersion: 1, applied: ['0000_init'] },
      },
    ]);
  });

  it('returns the migration failure and logs it before returning', async () => {
    const logger = new RecordingLogger();
    const bootstrap = createBootstrapper({
      migrator: FakeDatabaseMigrator.failingWith(migrationFailure),
      logger,
    });

    const error = unwrapErr(await bootstrap());

    expect(error).toBe(migrationFailure);
    expect(logger.entriesAt('error')).toEqual([
      {
        level: 'error',
        message: 'Startup failed: Database migration "0001" failed.',
        context: { code: 'db.migrationFailed', details: { migration: '0001' } },
      },
    ]);
  });

  it('turns an unexpected rejection into a logged failure instead of rejecting', async () => {
    const logger = new RecordingLogger();
    const brokenMigrator: DatabaseMigrator = {
      migrate: (): Promise<Result<MigrationReport, MigrationError>> =>
        Promise.reject(new Error('native crash')),
    };
    const bootstrap = createBootstrapper({ migrator: brokenMigrator, logger });

    const error = unwrapErr(await bootstrap());

    expect(error).toMatchObject({
      code: 'core.startupFailed',
      details: { cause: 'native crash' },
    });
    expect(logger.entriesAt('error')).toHaveLength(1);
  });

  it('describes unexpected rejections that are not Error instances', async () => {
    const bootstrap = createBootstrapper({
      migrator: { migrate: () => Promise.reject('boom') },
      logger: new RecordingLogger(),
    });

    expect(unwrapErr(await bootstrap()).details).toEqual({ cause: 'boom' });
  });
});

describe('StartupError', () => {
  it('types every startup failure with a known code the startup UI can map', async () => {
    const bootstrap = createBootstrapper({
      migrator: { migrate: () => Promise.reject(new Error('native crash')) },
      logger: new RecordingLogger(),
    });

    const code: StartupError['code'] = unwrapErr(await bootstrap()).code;
    // @ts-expect-error -- startup fails only with migration or startup codes
    const unrelatedCode: StartupError['code'] = 'routines.emptyName';

    expect(code).toBe('core.startupFailed');
    expect(unrelatedCode).not.toBe(code);
  });
});

describe('BootstrapperToken', () => {
  it('names the bootstrapper in the container', () => {
    expect(BootstrapperToken.description).toBe('core.Bootstrapper');
  });
});
