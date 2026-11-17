import { map } from '@shared/domain/result';

import type { VocabularyValue } from '../domain/vocabulary';

import { decodeFields } from './decoded-fields';
import {
  decodeText,
  decodeVocabularyKey,
  decodeVocabularyKind,
  decodeVocabularyOrigin,
  type Decoded,
} from './exercise-decoders';
import type { VocabularyValueRow } from './exercises.schema';

/** Data Mapper between `exercise_vocabulary_values` rows and vocabulary values (S1-29). */
export function vocabularyValueToRow(value: VocabularyValue): VocabularyValueRow {
  return { kind: value.kind, key: value.key, origin: value.origin, label: value.label };
}

export function vocabularyValueFromRow(row: VocabularyValueRow): Decoded<VocabularyValue> {
  const decoded = decodeFields({
    kind: decodeVocabularyKind(row.kind),
    key: decodeVocabularyKey(row.key),
    origin: decodeVocabularyOrigin(row.origin),
    label: decodeText(row.label),
  });
  return map(decoded, (fields) =>
    Object.freeze({
      kind: fields.kind.value,
      key: fields.key.value,
      label: fields.label.value,
      origin: fields.origin.value,
    }),
  );
}
