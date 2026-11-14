import type { BuildNumber } from '@shared/domain/build-number';

import type { Release } from './release';

/** Outcome of comparing the installed build with the latest release (S05-05). */
export type UpdateDecision =
  { readonly kind: 'updateAvailable'; readonly release: Release } | { readonly kind: 'upToDate' };

const UP_TO_DATE: UpdateDecision = Object.freeze({ kind: 'upToDate' });

/** Offers `latest` if and only if it is strictly newer than the installed build. Pure. */
export function decideUpdate(installed: BuildNumber, latest: Release): UpdateDecision {
  return latest.buildNumber > installed
    ? Object.freeze({ kind: 'updateAvailable', release: latest })
    : UP_TO_DATE;
}
