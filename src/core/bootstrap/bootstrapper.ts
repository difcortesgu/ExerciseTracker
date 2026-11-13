import type { DatabaseMigrator, MigrationError } from '@shared/application/database-migrator';
import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import { describeCause } from '@shared/domain/describe-cause';
import { domainError, type DomainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

/** Every way startup can fail; a closed union, so the startup UI can map each code. */
export type StartupError = MigrationError | DomainError<'core.startupFailed'>;

/**
 * App startup sequence (S0-17): opens the database and runs pending migrations before any screen
 * is shown. Resolves to `ok` when the app may show the tabs, or to `err` with a readable
 * `DomainError` (already logged through the Logger port) when it must show the error screen.
 * It never rejects: even an unexpected rejection becomes a logged `core.startupFailed`, so the
 * startup UI can never hang or crash.
 */
export type Bootstrapper = () => Promise<Result<void, StartupError>>;

export interface BootstrapperDependencies {
  readonly migrator: DatabaseMigrator;
  readonly logger: Logger;
}

export const BootstrapperToken = createToken<Bootstrapper>('core.Bootstrapper');

export function createBootstrapper({ migrator, logger }: BootstrapperDependencies): Bootstrapper {
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
