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
import type { StartupTask } from './startup-task';

/** Lets background work scheduled by the bootstrapper run to completion. */
const flushBackgroundWork = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A task that records when it ran and settles as told. */
function recordingTask(
  name: string,
  log: string[],
  run: () => Promise<unknown> = () => Promise.resolve(),
): StartupTask {
  return {
    name,
    run: () => {
      log.push(name);
      return run();
    },
  };
}

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

describe('createBootstrapper startup tasks (S1-13)', () => {
  it('runs the startup tasks after a successful startup, one after another in order', async () => {
    const log: string[] = [];
    let finishFirst = (): void => undefined;
    const first = recordingTask(
      'first',
      log,
      () => new Promise<void>((resolve) => (finishFirst = resolve)),
    );
    const bootstrap = createBootstrapper({
      migrator: new FakeDatabaseMigrator(),
      logger: new RecordingLogger(),
      startupTasks: [first, recordingTask('second', log)],
    });

    unwrap(await bootstrap());
    await flushBackgroundWork();
    expect(log).toEqual(['first']);

    finishFirst();
    await flushBackgroundWork();
    expect(log).toEqual(['first', 'second']);
  });

  it('resolves ok without waiting for the startup tasks', async () => {
    const neverEnding = recordingTask('slow', [], () => new Promise(() => undefined));
    const bootstrap = createBootstrapper({
      migrator: new FakeDatabaseMigrator(),
      logger: new RecordingLogger(),
      startupTasks: [neverEnding],
    });

    await expect(bootstrap()).resolves.toEqual({ ok: true, value: undefined });
  });

  it('logs a rejecting task as core.startupTaskFailed and still runs the next one', async () => {
    const log: string[] = [];
    const logger = new RecordingLogger();
    const bootstrap = createBootstrapper({
      migrator: new FakeDatabaseMigrator(),
      logger,
      startupTasks: [
        recordingTask('broken', log, () => Promise.reject(new Error('disk gone'))),
        recordingTask('next', log),
      ],
    });

    await bootstrap();
    await flushBackgroundWork();

    expect(log).toEqual(['broken', 'next']);
    expect(logger.entriesAt('error')).toEqual([
      {
        level: 'error',
        message: 'A startup task failed.',
        context: {
          code: 'core.startupTaskFailed',
          details: { task: 'broken', cause: 'disk gone' },
        },
      },
    ]);
  });

  it('logs a task that throws instead of returning a promise', async () => {
    const logger = new RecordingLogger();
    const throwing: StartupTask = {
      name: 'throwing',
      run: () => {
        throw new Error('not a promise');
      },
    };
    const bootstrap = createBootstrapper({
      migrator: new FakeDatabaseMigrator(),
      logger,
      startupTasks: [throwing],
    });

    await bootstrap();
    await flushBackgroundWork();

    expect(logger.entriesAt('error')[0]?.context).toEqual({
      code: 'core.startupTaskFailed',
      details: { task: 'throwing', cause: 'not a promise' },
    });
  });

  it('runs no startup task when startup failed', async () => {
    const log: string[] = [];
    const bootstrap = createBootstrapper({
      migrator: FakeDatabaseMigrator.failingWith(migrationFailure),
      logger: new RecordingLogger(),
      startupTasks: [recordingTask('seed', log)],
    });

    await bootstrap();
    await flushBackgroundWork();

    expect(log).toEqual([]);
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
