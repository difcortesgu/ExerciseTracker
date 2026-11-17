import { run, type CliIo } from './cli';
import { anUpstreamExercise, aTreeFor } from './upstream-fixtures';

const UPSTREAM = 'upstream/exercises.json';
const TREE = 'upstream/tree.json';
const OUT = 'assets/exercise-db';

class MemoryIo implements CliIo {
  readonly files = new Map<string, string>();
  readonly out: string[] = [];
  readonly err: string[] = [];

  readFile = (path: string): string => {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: ${path}`);
    }
    return content;
  };

  writeFile = (path: string, content: string): void => {
    this.files.set(path, content);
  };

  fileExists = (path: string): boolean => this.files.has(path);

  stdout = (line: string): void => {
    this.out.push(line);
  };

  stderr = (line: string): void => {
    this.err.push(line);
  };
}

const exercises = [anUpstreamExercise()];

const ioWithInputs = (upstream: unknown = exercises, tree: unknown = aTreeFor(exercises)) => {
  const io = new MemoryIo();
  io.files.set(UPSTREAM, JSON.stringify(upstream));
  io.files.set(TREE, JSON.stringify(tree));
  return io;
};

const readJson = (io: MemoryIo, path: string): unknown => JSON.parse(io.readFile(path));

describe('exercise-db CLI', () => {
  it('writes the compact seed and a readable manifest into the output folder', () => {
    const io = ioWithInputs();

    const exitCode = run([UPSTREAM, TREE, OUT], io);

    expect(exitCode).toBe(0);
    expect(io.readFile(`${OUT}/exercises.json`)).not.toContain('\n  ');
    expect(readJson(io, `${OUT}/exercises.json`)).toMatchObject({ seedVersion: 1 });
    expect(io.readFile(`${OUT}/manifest.json`)).toContain('\n  "seedVersion": 1,');
  });

  it('reports the seed version, counts and conversion notes', () => {
    const io = ioWithInputs([
      anUpstreamExercise({ primaryMuscles: ['glutes'], secondaryMuscles: ['glutes'] }),
    ]);

    run([UPSTREAM, TREE, OUT], io);

    expect(io.out).toEqual([
      'Note: Barbell_Squat: removed secondary muscle(s) also listed as primary: glutes',
      'Seed version 1: 1 exercises, 2 images (100000 bytes).',
    ]);
  });

  it('keeps the seed version on a re-run with the same upstream data', () => {
    const io = ioWithInputs();
    run([UPSTREAM, TREE, OUT], io);

    run([UPSTREAM, TREE, OUT], io);

    expect(readJson(io, `${OUT}/manifest.json`)).toMatchObject({ seedVersion: 1 });
  });

  it('increments the seed version when the upstream data changed', () => {
    const io = ioWithInputs();
    run([UPSTREAM, TREE, OUT], io);
    io.files.set(UPSTREAM, JSON.stringify([anUpstreamExercise({ name: 'Back Squat' })]));

    run([UPSTREAM, TREE, OUT], io);

    expect(readJson(io, `${OUT}/manifest.json`)).toMatchObject({ seedVersion: 2 });
    expect(readJson(io, `${OUT}/exercises.json`)).toMatchObject({ seedVersion: 2 });
  });

  it('fails without writing anything when the upstream data is invalid', () => {
    const io = ioWithInputs([anUpstreamExercise({ equipment: 'sandbag' })]);

    const exitCode = run([UPSTREAM, TREE, OUT], io);

    expect(exitCode).toBe(1);
    expect(io.err).toEqual([expect.stringContaining('unknown equipment "sandbag"')]);
    expect(io.fileExists(`${OUT}/manifest.json`)).toBe(false);
  });

  it('fails when the existing manifest is malformed', () => {
    const io = ioWithInputs();
    io.files.set(`${OUT}/manifest.json`, JSON.stringify({ seedVersion: 'one' }));

    expect(run([UPSTREAM, TREE, OUT], io)).toBe(1);
    expect(io.err).toEqual([expect.stringContaining('manifest.json is malformed')]);
  });

  it('fails when the existing manifest is not JSON (e.g. a merge conflict)', () => {
    const io = ioWithInputs();
    io.files.set(`${OUT}/manifest.json`, '<<<<<<< HEAD');

    expect(run([UPSTREAM, TREE, OUT], io)).toBe(1);
    expect(io.err).toEqual([expect.stringContaining('manifest.json is not valid JSON')]);
  });

  it('explains the usage when an argument is missing', () => {
    const io = new MemoryIo();

    expect(run([UPSTREAM, TREE], io)).toBe(1);
    expect(io.err).toEqual([
      'Usage: node tooling/exercise-db/exercise-db-cli.js <upstream-exercises.json> <git-tree.json> <output-dir>',
    ]);
  });

  it('fails readably when an input file cannot be read', () => {
    const io = new MemoryIo();

    expect(run([UPSTREAM, TREE, OUT], io)).toBe(1);
    expect(io.err).toEqual([`Cannot read ${UPSTREAM}: Error: ENOENT: ${UPSTREAM}`]);
  });

  it('fails readably when an input file is not JSON', () => {
    const io = ioWithInputs();
    io.files.set(TREE, '<html>rate limited</html>');

    expect(run([UPSTREAM, TREE, OUT], io)).toBe(1);
    expect(io.err).toEqual([expect.stringMatching(/^upstream\/tree\.json is not valid JSON: /)]);
  });
});
