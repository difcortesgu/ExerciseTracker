import { createToken } from '@shared/application/di/token';
import type { InstalledAppInfo } from '@shared/application/installed-app-info';
import type { Logger } from '@shared/application/logger';
import type { BuildNumber } from '@shared/domain/build-number';
import { describeCause } from '@shared/domain/describe-cause';
import { domainError } from '@shared/domain/domain-error';
import { andThen, err, type Result } from '@shared/domain/result';

import {
  parseRelease,
  type PublishedRelease,
  type Release,
  type ReleaseError,
} from '../domain/release';
import { decideUpdate } from '../domain/update-decision';

import type { ReleaseSource, ReleaseSourceError } from './release-source';

/** Why a check produced no offer although the updater is active. */
export type UpdateCheckError = ReleaseSourceError | ReleaseError;

/** What the startup check found (S05-06). Only `updateAvailable` leads to the dialog. */
export type UpdateCheckOutcome =
  /** Expo Go or a development build: the release source was not called. */
  | { readonly kind: 'inactive' }
  | { readonly kind: 'upToDate'; readonly installed: BuildNumber }
  /** Offline, rate-limited, malformed or invalid release; already logged with its error code. */
  | { readonly kind: 'checkFailed'; readonly error: UpdateCheckError }
  | { readonly kind: 'updateAvailable'; readonly release: Release };

/**
 * Use case: checks once per app launch whether a strictly newer release exists (S05-06).
 *
 * - Never rejects or throws: every failure becomes a logged `checkFailed`.
 * - The first call starts the check; later calls in the same process return the same promise
 *   (at most one request per launch, whatever the UI does).
 */
export type CheckForUpdate = () => Promise<UpdateCheckOutcome>;

export const CheckForUpdateToken = createToken<CheckForUpdate>('updates.CheckForUpdate');

export interface CheckForUpdateDependencies {
  readonly installedAppInfo: InstalledAppInfo;
  readonly releaseSource: ReleaseSource;
  readonly logger: Logger;
}

const INACTIVE: UpdateCheckOutcome = Object.freeze({ kind: 'inactive' });

/** The source must never reject; if it does anyway, treat it as a failed request (never throw). */
async function fetchLatestRelease(
  source: ReleaseSource,
): Promise<Result<PublishedRelease, ReleaseSourceError>> {
  try {
    return await source.fetchLatestRelease();
  } catch (cause) {
    return err(
      domainError('updates.networkUnavailable', 'The release source failed unexpectedly.', {
        cause: describeCause(cause),
      }),
    );
  }
}

async function checkOnce(deps: CheckForUpdateDependencies): Promise<UpdateCheckOutcome> {
  const installed = deps.installedAppInfo.getInstalledApp();
  if (installed.kind === 'development') {
    return INACTIVE;
  }
  const latest = andThen(await fetchLatestRelease(deps.releaseSource), parseRelease);
  if (!latest.ok) {
    deps.logger.warn('Update check failed.', {
      code: latest.error.code,
      details: latest.error.details,
    });
    return Object.freeze({ kind: 'checkFailed', error: latest.error });
  }
  const decision = decideUpdate(installed.buildNumber, latest.value);
  return decision.kind === 'updateAvailable'
    ? decision
    : Object.freeze({ kind: 'upToDate', installed: installed.buildNumber });
}

/**
 * Creates the startup check. The returned function is a **memoizing proxy**: the first call starts
 * the check and every later call returns the same promise, so one instance (a singleton in the
 * composition root) performs at most one request per launch.
 */
export function createCheckForUpdate(deps: CheckForUpdateDependencies): CheckForUpdate {
  let pending: Promise<UpdateCheckOutcome> | undefined;
  return () => {
    pending ??= checkOnce(deps);
    return pending;
  };
}
