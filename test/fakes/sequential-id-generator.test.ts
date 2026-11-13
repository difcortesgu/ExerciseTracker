import { describeIdGeneratorContract } from '@test/contracts/id-generator.contract';

import { SequentialIdGenerator } from './sequential-id-generator';

describeIdGeneratorContract('SequentialIdGenerator', () => new SequentialIdGenerator());

describe('SequentialIdGenerator', () => {
  it('returns a predictable sequence', () => {
    const generator = new SequentialIdGenerator();

    expect([generator.next(), generator.next(), generator.next()]).toEqual([
      'id-1',
      'id-2',
      'id-3',
    ]);
  });

  it('uses the given prefix', () => {
    expect(new SequentialIdGenerator('block').next()).toBe('block-1');
  });

  it('restarts the sequence for each new generator', () => {
    new SequentialIdGenerator().next();

    expect(new SequentialIdGenerator().next()).toBe('id-1');
  });
});
