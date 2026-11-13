import { createToken } from './di/token';

/** Structured, serialisable context attached to a log entry. */
export type LogContext = Readonly<Record<string, unknown>>;

/**
 * Port: diagnostic logging. Only the console adapter touches `console`; tests use
 * `RecordingLogger` to assert on what was logged.
 */
export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

export const LoggerToken = createToken<Logger>('shared.Logger');
