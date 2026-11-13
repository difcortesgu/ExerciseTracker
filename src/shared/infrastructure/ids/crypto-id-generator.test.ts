import { describeIdGeneratorContract } from '@test/contracts/id-generator.contract';

import { CryptoIdGenerator } from './crypto-id-generator';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Native module boundary: expo-crypto's native randomUUID is not available in Jest, so it is
// backed by Node's implementation of the same function (RFC 4122 v4).
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

describeIdGeneratorContract('CryptoIdGenerator', () => new CryptoIdGenerator());

describe('CryptoIdGenerator', () => {
  it('returns RFC 4122 version 4 UUIDs', () => {
    expect(new CryptoIdGenerator().next()).toMatch(UUID_V4);
  });
});
