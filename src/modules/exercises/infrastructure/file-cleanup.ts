import type { File } from 'expo-file-system';

import { describeCause } from '@shared/domain/describe-cause';

/**
 * Deletes the file if it exists, for cleanup after a failure. Cleanup never throws: a failure is
 * returned as a description, so the caller can report it next to the original cause.
 */
export function removeFileQuietly(file: File): string | undefined {
  try {
    if (file.exists) file.delete();
    return undefined;
  } catch (cause) {
    return describeCause(cause);
  }
}
