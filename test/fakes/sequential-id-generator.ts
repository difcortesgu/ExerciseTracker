import type { IdGenerator } from '@shared/application/id-generator';

const DEFAULT_PREFIX = 'id';

/** Fake `IdGenerator`: a deterministic sequence (`id-1`, `id-2`, …) so failures are reproducible. */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix: string = DEFAULT_PREFIX) {}

  next(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }
}
