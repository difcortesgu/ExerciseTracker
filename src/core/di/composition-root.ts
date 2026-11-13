import { BootstrapperToken, createBootstrapper } from '@core/bootstrap/bootstrapper';
import { ClockToken } from '@shared/application/clock';
import { DatabaseMigratorToken } from '@shared/application/database-migrator';
import { IdGeneratorToken } from '@shared/application/id-generator';
import { LoggerToken } from '@shared/application/logger';
import { APP_MIGRATIONS } from '@shared/infrastructure/db/app-migrations';
import { openExpoSqliteDatabase } from '@shared/infrastructure/db/expo-sqlite-database';
import { SqliteDatabaseToken } from '@shared/infrastructure/db/sqlite-database';
import { SqliteDatabaseMigrator } from '@shared/infrastructure/db/sqlite-database-migrator';
import { CryptoIdGenerator } from '@shared/infrastructure/ids/crypto-id-generator';
import { ConsoleLogger } from '@shared/infrastructure/logging/console-logger';
import { SystemClock } from '@shared/infrastructure/time/system-clock';

import { createContainer, type Container } from './container';

/** The on-device SQLite file. Changing it would orphan existing user data. */
export const DATABASE_FILE_NAME = 'exercise-tracker.db';

/**
 * Composition root (Dependency Injection): the only place where infrastructure adapters are
 * constructed and wired to their ports. Everything is a lazy singleton, so nothing (not even the
 * database) is opened before the bootstrapper needs it. Call once, in `app/_layout.tsx`.
 */
export function createProductionContainer(): Container {
  return createContainer()
    .register(ClockToken, () => new SystemClock())
    .register(IdGeneratorToken, () => new CryptoIdGenerator())
    .register(LoggerToken, () => new ConsoleLogger())
    .register(SqliteDatabaseToken, () => openExpoSqliteDatabase(DATABASE_FILE_NAME))
    .register(
      DatabaseMigratorToken,
      (resolver) =>
        new SqliteDatabaseMigrator({
          openDatabase: () => resolver.resolve(SqliteDatabaseToken),
          migrations: APP_MIGRATIONS,
        }),
    )
    .register(BootstrapperToken, (resolver) =>
      createBootstrapper({
        migrator: resolver.resolve(DatabaseMigratorToken),
        logger: resolver.resolve(LoggerToken),
      }),
    );
}
