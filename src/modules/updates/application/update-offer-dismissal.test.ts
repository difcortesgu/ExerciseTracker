import { createUpdateOfferDismissal, UpdateOfferDismissalToken } from './update-offer-dismissal';

describe('createUpdateOfferDismissal', () => {
  it('starts with the offer not dismissed', () => {
    expect(createUpdateOfferDismissal().isDismissed()).toBe(false);
  });

  it('remembers a dismissal for as long as the instance lives (the rest of the launch)', () => {
    const dismissal = createUpdateOfferDismissal();

    dismissal.dismiss();
    dismissal.dismiss();

    expect(dismissal.isDismissed()).toBe(true);
  });

  it('keeps each instance independent, so a new launch (new container) offers again', () => {
    const thisLaunch = createUpdateOfferDismissal();
    thisLaunch.dismiss();

    expect(createUpdateOfferDismissal().isDismissed()).toBe(false);
  });

  it('is registered under its own token', () => {
    expect(UpdateOfferDismissalToken.description).toBe('updates.UpdateOfferDismissal');
  });
});
