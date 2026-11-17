import { Link, router, Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';

import { AppStack } from './app-stack';

function LibraryTab() {
  const [text, setText] = useState('');
  return (
    <>
      <TextInput accessibilityLabel="Search" value={text} onChangeText={setText} />
      <Link href="/exercises/abc">
        <Text>Open detail</Text>
      </Link>
    </>
  );
}

function DetailRoute() {
  return <Text>Detail content</Text>;
}

async function renderStack(): Promise<void> {
  await renderRouter(
    {
      _layout: AppStack,
      // The real tab navigator is tested in app-tabs.test.tsx; a slot is enough here.
      '(tabs)/_layout': () => <Slot />,
      '(tabs)/index': LibraryTab,
      'exercises/[id]/index': DetailRoute,
    },
    { initialUrl: '/' },
  );
}

describe('AppStack (root Stack, ADR-001 §13, S1-17)', () => {
  it('opens on the tabs without a stack header', async () => {
    await renderStack();

    expect(screen.getByLabelText('Search')).toBeOnTheScreen();
    expect(screen.queryByRole('header')).not.toBeOnTheScreen();
  });

  it('opens a stack screen on top of the tabs', async () => {
    await renderStack();

    await fireEvent.press(screen.getByText('Open detail'));

    expect(await screen.findByText('Detail content')).toBeOnTheScreen();
    expect(screen).toHavePathname('/exercises/abc');
  });

  it('returns to the tabs with their state kept when going back', async () => {
    await renderStack();
    await fireEvent.changeText(screen.getByLabelText('Search'), 'squat');
    await fireEvent.press(screen.getByText('Open detail'));
    await screen.findByText('Detail content');

    await act(() => router.back());

    expect(await screen.findByLabelText('Search')).toHaveDisplayValue('squat');
    expect(screen).toHavePathname('/');
  });
});
