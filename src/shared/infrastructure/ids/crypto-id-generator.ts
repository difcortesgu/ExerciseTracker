import { randomUUID } from 'expo-crypto';

import type { IdGenerator } from '@shared/application/id-generator';

/** Adapter: random v4 UUIDs from `expo-crypto` (works in Expo Go) behind the `IdGenerator` port. */
export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
