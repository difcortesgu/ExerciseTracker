import type { IdGenerator } from '@shared/application/id-generator';

import { defineContract } from './contract-harness';

const SAMPLE_SIZE = 1000;

/** Contract every `IdGenerator` implementation must honour (S0-14). */
export const describeIdGeneratorContract = defineContract<IdGenerator>(
  'IdGenerator',
  (generator) => {
    it('returns non-blank ids', () => {
      expect(generator().next().trim()).not.toBe('');
    });

    it('never repeats an id', () => {
      const ids = Array.from({ length: SAMPLE_SIZE }, () => generator().next());

      expect(new Set(ids).size).toBe(SAMPLE_SIZE);
    });
  },
);
