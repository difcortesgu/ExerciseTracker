import { err, ok, type Ok } from '@shared/domain/result';

import type { Decoded } from './exercise-decoders';

type Fields = Readonly<Record<string, Decoded<unknown>>>;

/** The same fields, each known to be a success. */
export type DecodedFields<T extends Fields> = T & {
  readonly [K in keyof T]: T[K] extends Decoded<infer V> ? Ok<V> : never;
};

/** Runtime-verified guard: every field decoded successfully. */
function allDecoded<T extends Fields>(fields: T): fields is DecodedFields<T> {
  return Object.values(fields).every((field) => field.ok);
}

/**
 * Combines independently decoded fields of one record (a row, a seed exercise): `ok` with the
 * fields narrowed to successes (read each with `.value`), or `err` naming **every** failing field,
 * so a corrupt record is described completely in one message.
 */
export function decodeFields<T extends Fields>(fields: T): Decoded<DecodedFields<T>> {
  if (allDecoded(fields)) return ok(fields);
  const failures = Object.entries(fields).flatMap(([name, field]) =>
    field.ok ? [] : [`${name}: ${field.error}`],
  );
  return err(failures.join('; '));
}
