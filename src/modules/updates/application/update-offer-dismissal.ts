import { createToken } from '@shared/application/di/token';

/**
 * Process-scoped memory of "the user turned the update offer down during this launch" (S05-08,
 * QA-05-1). The prompt's state machine lives in a React component; this store lets the decision
 * survive a remount of that component while the JS process keeps running (e.g. Android 11 and
 * older finish the activity on Back but keep the runtime). It is a singleton in the composition
 * root and is deliberately **not** persisted: the next launch (a new container) offers again.
 */
export interface UpdateOfferDismissal {
  /** True once the offer was dismissed in this process. */
  isDismissed(): boolean;
  /** Remembers the dismissal for the rest of this process (idempotent). */
  dismiss(): void;
}

export const UpdateOfferDismissalToken = createToken<UpdateOfferDismissal>(
  'updates.UpdateOfferDismissal',
);

/** Creates an in-memory dismissal store; each instance is one launch. */
export function createUpdateOfferDismissal(): UpdateOfferDismissal {
  let dismissed = false;
  return {
    isDismissed: () => dismissed,
    dismiss: () => {
      dismissed = true;
    },
  };
}
