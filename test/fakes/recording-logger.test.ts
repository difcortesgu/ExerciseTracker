import { RecordingLogger } from './recording-logger';

describe('RecordingLogger', () => {
  it('records every entry with its level, message and context, in order', () => {
    const logger = new RecordingLogger();

    logger.info('Started');
    logger.warn('Slow query', { durationMs: 250 });
    logger.error('Migration failed', { code: 'db.migrationFailed' });

    expect(logger.entries).toEqual([
      { level: 'info', message: 'Started' },
      { level: 'warn', message: 'Slow query', context: { durationMs: 250 } },
      { level: 'error', message: 'Migration failed', context: { code: 'db.migrationFailed' } },
    ]);
  });

  it('filters entries by level', () => {
    const logger = new RecordingLogger();
    logger.info('Started');
    logger.error('Boom');

    expect(logger.entriesAt('error')).toEqual([{ level: 'error', message: 'Boom' }]);
  });

  it('exposes a read-only snapshot of the entries', () => {
    const logger = new RecordingLogger();
    const before = logger.entries;

    logger.info('Started');

    expect(before).toEqual([]);
    expect(Object.isFrozen(logger.entries)).toBe(true);
  });
});
