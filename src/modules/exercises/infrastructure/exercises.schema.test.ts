import { getTableConfig } from 'drizzle-orm/sqlite-core';

import { exerciseLibrarySeed, exercises, exerciseVocabularyValues } from './exercises.schema';

describe('exercises schema (S1-04, ADR-004 §2)', () => {
  it('indexes the name key and the archived flag of exercises', () => {
    const { indexes } = getTableConfig(exercises);

    expect(
      indexes.map(({ config }) => ({
        name: config.name,
        columns: config.columns.map((column) => ('name' in column ? column.name : '')),
        unique: config.unique,
      })),
    ).toEqual([
      { name: 'exercises_name_key_idx', columns: ['name_key'], unique: false },
      { name: 'exercises_archived_idx', columns: ['archived'], unique: false },
    ]);
  });

  it('keeps source keys unique, but not names (T9)', () => {
    const { columns } = getTableConfig(exercises);
    const uniqueColumns = columns.filter((column) => column.isUnique).map(({ name }) => name);

    expect(uniqueColumns).toEqual(['source_key']);
  });

  it('identifies a vocabulary value by kind, key and origin', () => {
    const { primaryKeys } = getTableConfig(exerciseVocabularyValues);

    expect(primaryKeys.map((key) => key.columns.map(({ name }) => name))).toEqual([
      ['kind', 'key', 'origin'],
    ]);
  });

  it('stores the seed version in a single-row table keyed by id', () => {
    const { columns } = getTableConfig(exerciseLibrarySeed);

    expect(columns.map(({ name, primary }) => ({ name, primary }))).toEqual([
      { name: 'id', primary: true },
      { name: 'seed_version', primary: false },
    ]);
  });
});
