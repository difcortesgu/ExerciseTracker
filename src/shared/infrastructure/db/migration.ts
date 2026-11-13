/**
 * One versioned schema change (S0-19). Versions are 1..n with no gaps; the database's schema
 * version is the highest version applied (0 for an empty database).
 */
export interface Migration {
  readonly version: number;
  /** Stable name, e.g. the drizzle-kit tag `0000_create_exercises`. */
  readonly name: string;
  /** SQL statements run in order, inside one transaction. */
  readonly statements: readonly string[];
}
