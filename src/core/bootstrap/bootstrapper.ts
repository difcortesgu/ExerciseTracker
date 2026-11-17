import type { DatabaseMigrator, MigrationError } from '@shared/application/database-migrator';
import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import { describeCause } from '@shared/domain/describe-cause';
import { domainError, type DomainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import type { StartupTask } from './startup-task';

/** Every way startup can fail; a closed union, so the startup UI can map each code. */
export type StartupError = MigrationError | DomainError<'core.startupFailed'>;

/**
 * App startup sequence (S0-17): opens the database and runs pending migrations before any screen
 * is shown. Resolves to `ok` when the app may show the tabs, or to `err` with a readable
 * `DomainError` (already logged through the Logger port) when it must show the error screen.
 * It never rejects: even an unexpected rejection becomes a logged `core.startupFailed`, so the
 * startup UI can never hang or crash.
 *
 * After a successful startup it starts the `StartupTask`s (seeding, orphan photo cleanup) in the
 * background, one after another; they never delay or fail startup (S1-13, ADR-004 "Seeding").
 */
export type Bootstrapper = () => Promise<Result<void, StartupError>>;

export interface BootstrapperDependencies {
  readonly migrator: DatabaseMigrator;
  readonly logger: Logger;
  /** Background work started after a successful startup, in order, never awaited (S1-13). */
  readonly startupTasks?: readonly StartupTask[];
}

const NO_STARTUP_TASKS: readonly StartupTask[] = Object.freeze([]);

/** Runs one task; a rejection or throw (a broken task contract) is logged, never propagated. */
async function runLogged(task: StartupTask, logger: Logger): Promise<void> {
  try {
    await task.run();
  } catch (cause) {
    logger.error('A startup task failed.', {
      code: 'core.startupTaskFailed',
      details: { task: task.name, cause: describeCause(cause) },
    });
  }
}

/** The tasks one after another, after the caller has received `ok` (scheduled, not awaited). */
function startInBackground(tasks: readonly StartupTask[], logger: Logger): void {
  void tasks.reduce<Promise<void>>(
    (previous, task) => previous.then(() => runLogged(task, logger)),
    Promise.resolve(),
  );
}

export const BootstrapperToken = createToken<Bootstrapper>('core.Bootstrapper');

export function createBootstrapper({
  migrator,
  logger,
  startupTasks = NO_STARTUP_TASKS,
}: BootstrapperDependencies): Bootstrapper {
  const fail = (error: StartupError): Result<void, StartupError> => {
    logger.error(`Startup failed: ${error.message}`, { code: error.code, details: error.details });
    return err(error);
  };

  return async () => {
    try {
      const migration = await migrator.migrate();
      if (!migration.ok) {
        return fail(migration.error);
      }
      logger.info('Database ready', { ...migration.value });
      startInBackground(startupTasks, logger);
      return ok(undefined);
    } catch (cause) {
      return fail(
        domainError('core.startupFailed', 'The app could not start.', {
          cause: describeCause(cause),
        }),
      );
    }
  };
}
