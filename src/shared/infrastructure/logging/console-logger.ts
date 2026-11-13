import type { LogContext, Logger } from '@shared/application/logger';

const PREFIX = '[exercise-tracker]';

type ConsoleMethod = 'info' | 'warn' | 'error';

function write(method: ConsoleMethod, message: string, context: LogContext | undefined): void {
  const line = `${PREFIX} ${message}`;
  if (context === undefined) {
    console[method](line);
  } else {
    console[method](line, context);
  }
}

/** Adapter: the `Logger` port on top of `console`; the only production code allowed to use it. */
export class ConsoleLogger implements Logger {
  info(message: string, context?: LogContext): void {
    write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    write('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    write('error', message, context);
  }
}
