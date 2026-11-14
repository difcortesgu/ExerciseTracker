import { fireEvent, screen } from '@testing-library/react-native';
import { Slot } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { AppShell, AppTabs } from '@core/presentation';
import { domainError } from '@shared/domain/domain-error';
import { aBuildNumber } from '@test/builders/installed-app.builder';
import {
  aPromptContainer,
  checkNeverSettling,
  checkReturning,
  OFFER_TITLE,
  offerDialog,
  press,
  promptTree,
  renderPrompt,
  withSuccessfulStartup,
} from '@test/support/update-prompt-harness';

import type { UpdateCheckOutcome } from '../application/check-for-update';

import { UpdatePrompt } from './update-prompt';

describe('UpdatePrompt: startup prompt (S05-08)', () => {
  it('keeps the app usable and shows nothing while the check is still running', async () => {
    await renderPrompt(checkNeverSettling);

    expect(screen.getByText('Tabs')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('offers the new build with its size, an Update and a Later action', async () => {
    await renderPrompt();

    expect(await screen.findByRole('header', { name: OFFER_TITLE })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Update' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Later' })).toBeOnTheScreen();
  });

  it.each<[string, UpdateCheckOutcome]>([
    ['up to date', { kind: 'upToDate', installed: aBuildNumber(42) }],
    ['inactive (Expo Go)', { kind: 'inactive' }],
    [
      'failed',
      { kind: 'checkFailed', error: domainError('updates.networkUnavailable', 'Offline.') },
    ],
  ])('shows nothing when the check is %s', async (_name, outcome) => {
    await renderPrompt(checkReturning(outcome));

    expect(screen.getByText('Tabs')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('closes on Later and does not offer again while the app keeps running', async () => {
    const { view, container } = await renderPrompt();

    await press('Later');
    await view.rerender(promptTree(container));

    expect(offerDialog()).not.toBeOnTheScreen();
    expect(screen.getByText('Tabs')).toBeOnTheScreen();
  });

  it("closes like Later when Android's back button is pressed", async () => {
    await renderPrompt();
    await screen.findByRole('header', { name: OFFER_TITLE });

    await fireEvent(screen.getByTestId('update-prompt'), 'requestClose');

    expect(offerDialog()).not.toBeOnTheScreen();
    expect(screen.getByText('Tabs')).toBeOnTheScreen();
  });

  it('does not download anything before the user taps Update', async () => {
    const { downloads } = await renderPrompt();

    expect(await screen.findByRole('header', { name: OFFER_TITLE })).toBeOnTheScreen();
    expect(downloads.attempts).toHaveLength(0);
  });
});

describe('UpdatePrompt in the root layout (AppShell + tabs)', () => {
  it('does not offer again after Later while the user moves between tabs', async () => {
    const container = withSuccessfulStartup(aPromptContainer().container);
    const tab = (name: string) =>
      function TabRoute() {
        return <Text>{`${name} content`}</Text>;
      };
    await renderRouter(
      {
        _layout: () => (
          <AppShell resolver={container} overlay={<UpdatePrompt />}>
            <Slot />
          </AppShell>
        ),
        '(tabs)/_layout': AppTabs,
        '(tabs)/index': tab('Workout'),
        '(tabs)/routines': tab('Routines'),
        '(tabs)/exercises': tab('Exercises'),
        '(tabs)/progress': tab('Progress'),
        '(tabs)/settings': tab('Settings'),
      },
      { initialUrl: '/' },
    );
    await screen.findByRole('header', { name: OFFER_TITLE });

    await press('Later');
    await fireEvent.press(screen.getByLabelText('Settings'));
    await fireEvent.press(screen.getByLabelText('Workout'));

    expect(await screen.findByText('Workout content')).toBeOnTheScreen();
    expect(offerDialog()).not.toBeOnTheScreen();
  });
});
