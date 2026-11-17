import type { LogContext, Logger } from '@shared/application/logger';

import { defineContract } from './contract-harness';

const LEVELS = ['info', 'warn', 'error'] as const;

/** A context that `JSON.stringify` cannot serialise: logging must still not fail. */
function circularContext(): LogContext {
  const context: Record<string, unknown> = { code: 'exercises.seedFailed' };
  context.self = context;
  return context;
}

/**
 * Contract every `Logger` implementation must honour (S1-02). The port has no read side, so the
 * observable contract is that logging is **total**: callers log from error paths (failed seeding,
 * startup failures), so a log call must never throw and never return anything to handle,
 * whatever the level or context. What an implementation does with an entry (record it, print it)
 * is checked by its own tests.
 */
export const describeLoggerContract = defineContract<Logger>('Logger', (logger) => {
  it.each(LEVELS)('accepts a %s entry without a context', (level) => {
    expect(logger()[level]('Database ready')).toBeUndefined();
  });

  it.each(LEVELS)('accepts a %s entry with a structured context', (level) => {
    expect(logger()[level]('Seeding failed', { code: 'exercises.seedFailed' })).toBeUndefined();
  });

  it.each(LEVELS)('never throws for a %s entry whose context cannot be serialised', (level) => {
    expect(() => logger()[level]('Unexpected failure', circularContext())).not.toThrow();
  });
});
