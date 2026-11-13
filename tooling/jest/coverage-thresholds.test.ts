import { selectApplicableThresholds } from './coverage-thresholds';

const DOMAIN = 'src/{shared,modules/*}/domain/**/*.{ts,tsx}';
const INFRASTRUCTURE = 'src/{shared,modules/*}/infrastructure/**/*.{ts,tsx}';
const full = { lines: 100, branches: 100, functions: 100, statements: 100 };
const ninety = { lines: 90, branches: 90, functions: 90, statements: 90 };

describe('selectApplicableThresholds', () => {
  it('keeps a layer threshold when at least one source file matches its glob', () => {
    const thresholds = selectApplicableThresholds({ global: ninety, [DOMAIN]: full }, [
      'src/modules/routines/domain/routine.ts',
    ]);

    expect(thresholds).toEqual({ global: ninety, [DOMAIN]: full });
  });

  it('drops a layer threshold whose glob matches no source file yet (Jest would fail with "coverage data not found")', () => {
    const thresholds = selectApplicableThresholds(
      { global: ninety, [DOMAIN]: full, [INFRASTRUCTURE]: ninety },
      ['src/shared/domain/result.ts'],
    );

    expect(thresholds).toEqual({ global: ninety, [DOMAIN]: full });
  });

  it('always keeps the global threshold, even without any source file', () => {
    expect(selectApplicableThresholds({ global: ninety, [DOMAIN]: full }, [])).toEqual({
      global: ninety,
    });
  });

  it('matches files with the same glob semantics as Jest (micromatch, braces and globstar)', () => {
    const thresholds = selectApplicableThresholds({ global: ninety, [DOMAIN]: full }, [
      'src/shared/domain/units/weight.ts',
    ]);

    expect(thresholds).toHaveProperty([DOMAIN], full);
  });

  it('does not let a file of another layer activate a threshold', () => {
    const thresholds = selectApplicableThresholds({ global: ninety, [DOMAIN]: full }, [
      'src/modules/routines/application/save-routine.ts',
    ]);

    expect(thresholds).not.toHaveProperty([DOMAIN]);
  });
});
