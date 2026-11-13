import type { LogContext, Logger } from '@shared/application/logger';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: LogContext;
}

/** Fake `Logger`: records entries so tests can assert on what was logged. */
export class RecordingLogger implements Logger {
  private recorded: readonly LogEntry[] = Object.freeze([]);

  get entries(): readonly LogEntry[] {
    return this.recorded;
  }

  entriesAt(level: LogLevel): readonly LogEntry[] {
    return this.recorded.filter((entry) => entry.level === level);
  }

  info(message: string, context?: LogContext): void {
    this.record('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.record('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.record('error', message, context);
  }

  private record(level: LogLevel, message: string, context: LogContext | undefined): void {
    const entry: LogEntry =
      context === undefined ? { level, message } : { level, message, context };
    this.recorded = Object.freeze([...this.recorded, entry]);
  }
}
