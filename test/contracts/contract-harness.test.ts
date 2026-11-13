import { defineContract } from './contract-harness';

interface Counter {
  readonly id: number;
  count: number;
}

const lifecycle: string[] = [];
let nextCounterId = 1;

const describeCounterContract = defineContract<Counter>('Counter', (subject) => {
  it('starts at zero', () => {
    expect(subject().count).toBe(0);
    subject().count += 1;
  });

  it('starts at zero again in the next case (fresh subject)', () => {
    expect(subject().count).toBe(0);
  });
});

describeCounterContract('synchronous factory with disposal', {
  create: () => {
    const counter = { id: nextCounterId++, count: 0 };
    lifecycle.push(`create ${counter.id}`);
    return counter;
  },
  dispose: (counter) => {
    lifecycle.push(`dispose ${counter.id}`);
  },
});

describeCounterContract('asynchronous factory function', async () => {
  await Promise.resolve();
  return { id: nextCounterId++, count: 0 };
});

const released: number[] = [];

interface ReleasableCounter extends Counter {
  readonly release: () => void;
}

describeCounterContract('fixture richer than the port, released on disposal', {
  create: (): ReleasableCounter => {
    const id = nextCounterId++;
    return { id, count: 0, release: () => released.push(id) };
  },
  dispose: (fixture) => fixture.release(),
});

let readLeakySubject: (() => Counter) | undefined;
defineContract<Counter>('Leaky', (subject) => {
  readLeakySubject = subject;
  it('reads the subject inside a case', () => {
    expect(subject().count).toBe(0);
  });
})('subject leaked to a later test', () => ({ id: 0, count: 0 }));

describe('defineContract', () => {
  it('creates a fresh subject for every case and disposes each one afterwards', () => {
    expect(lifecycle).toEqual(['create 1', 'dispose 1', 'create 2', 'dispose 2']);
  });

  it('runs the same cases for every implementation', () => {
    expect(nextCounterId).toBe(7);
  });

  it('hands the full fixture to dispose', () => {
    expect(released).toEqual([5, 6]);
  });

  it('fails clearly when the subject is read outside a contract case', () => {
    expect(() => readLeakySubject?.()).toThrow(/Leaky.*outside a test/);
  });
});
