import { describeLoggerContract } from '@test/contracts/logger.contract';

import { ConsoleLogger } from './console-logger';

/** The contract runs with `console` stubbed at the boundary, so the suite prints nothing. */
describe('ConsoleLogger with console stubbed', () => {
  beforeEach(() => {
    for (const method of ['info', 'warn', 'error'] as const) {
      jest.spyOn(console, method).mockImplementation(() => undefined);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describeLoggerContract('ConsoleLogger', () => new ConsoleLogger());
});

describe('ConsoleLogger', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
  ] as const)('writes %s entries to console.%s with their context', (level, consoleMethod) => {
    const write = jest.spyOn(console, consoleMethod).mockImplementation(() => undefined);

    new ConsoleLogger()[level]('Migration failed', { code: 'db.migrationFailed' });

    expect(write).toHaveBeenCalledWith('[exercise-tracker] Migration failed', {
      code: 'db.migrationFailed',
    });
  });

  it('omits the context argument when there is none', () => {
    const write = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    new ConsoleLogger().info('Database ready');

    expect(write).toHaveBeenCalledWith('[exercise-tracker] Database ready');
  });
});
