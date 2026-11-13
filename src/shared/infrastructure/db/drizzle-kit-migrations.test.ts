import { migrationsFromDrizzleKit, type DrizzleKitMigrationBundle } from './drizzle-kit-migrations';

const journalEntry = (idx: number, tag: string) => ({
  idx,
  version: '6',
  when: 1_793_000_000_000 + idx,
  tag,
  breakpoints: true,
});

const bundle: DrizzleKitMigrationBundle = {
  journal: {
    entries: [journalEntry(1, '0001_add_sets'), journalEntry(0, '0000_init')],
  },
  migrations: {
    m0000:
      'CREATE TABLE `a` (`id` text);\n--> statement-breakpoint\nCREATE TABLE `b` (`id` text);\n',
    m0001: 'CREATE TABLE `sets` (`id` text);',
  },
};

describe('migrationsFromDrizzleKit', () => {
  it('turns the generated journal into ordered, versioned migrations', () => {
    const migrations = migrationsFromDrizzleKit(bundle);

    expect(migrations.map(({ version, name }) => ({ version, name }))).toEqual([
      { version: 1, name: '0000_init' },
      { version: 2, name: '0001_add_sets' },
    ]);
  });

  it('splits each migration into statements at the drizzle-kit breakpoints', () => {
    const [first] = migrationsFromDrizzleKit(bundle);

    expect(first?.statements).toEqual([
      'CREATE TABLE `a` (`id` text);',
      'CREATE TABLE `b` (`id` text);',
    ]);
  });

  it('returns no migrations for an empty journal', () => {
    expect(migrationsFromDrizzleKit({ journal: { entries: [] }, migrations: {} })).toEqual([]);
  });

  it('throws a programmer error naming a journal entry without SQL', () => {
    const broken: DrizzleKitMigrationBundle = {
      journal: { entries: [journalEntry(0, '0000_init')] },
      migrations: {},
    };

    expect(() => migrationsFromDrizzleKit(broken)).toThrow(/0000_init/);
  });
});
