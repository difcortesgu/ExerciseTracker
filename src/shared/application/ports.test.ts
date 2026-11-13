import { ClockToken } from './clock';
import { DatabaseMigratorToken } from './database-migrator';
import { IdGeneratorToken } from './id-generator';
import { LoggerToken } from './logger';

describe('shared port tokens', () => {
  it.each([
    [ClockToken, 'shared.Clock'],
    [IdGeneratorToken, 'shared.IdGenerator'],
    [LoggerToken, 'shared.Logger'],
    [DatabaseMigratorToken, 'shared.DatabaseMigrator'],
  ])('names its token after the port (%#)', (token, description) => {
    expect(token.description).toBe(description);
  });

  it('gives every port its own token', () => {
    const keys = [ClockToken, IdGeneratorToken, LoggerToken, DatabaseMigratorToken].map(
      (token) => token.key,
    );

    expect(new Set(keys).size).toBe(keys.length);
  });
});
