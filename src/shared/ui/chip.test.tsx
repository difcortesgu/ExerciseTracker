import { fireEvent, render, screen } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { Chip } from './chip';
import { darkTheme, lightTheme } from './theme/tokens';

describe('Chip', () => {
  afterEach(() => {
    jest.mocked(useColorScheme).mockReset();
  });

  it('is a checkbox named after its label that reports whether it is selected', async () => {
    await render(<Chip label="Weight" selected onPress={() => undefined} />);

    expect(screen.getByRole('checkbox', { name: 'Weight' })).toBeChecked();
  });

  it('is announced as not selected', async () => {
    await render(<Chip label="Reps" selected={false} onPress={() => undefined} />);

    expect(screen.getByRole('checkbox', { name: 'Reps' })).not.toBeChecked();
  });

  it('toggles when tapped', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Reps" selected={false} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Reps' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is a large touch target', async () => {
    await render(<Chip label="Reps" selected={false} onPress={() => undefined} />);

    expect(screen.getByRole('checkbox', { name: 'Reps' })).toHaveStyle({
      minHeight: lightTheme.interaction.minTouchTargetSize,
    });
  });

  it('fills a selected chip with the accent colour and outlines an unselected one', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');
    await render(
      <>
        <Chip label="Weight" selected onPress={() => undefined} />
        <Chip label="Reps" selected={false} onPress={() => undefined} />
      </>,
    );

    expect(screen.getByRole('checkbox', { name: 'Weight' })).toHaveStyle({
      backgroundColor: darkTheme.colors.accent,
    });
    expect(screen.getByText('Weight')).toHaveStyle({ color: darkTheme.colors.background });
    expect(screen.getByRole('checkbox', { name: 'Reps' })).toHaveStyle({
      backgroundColor: 'transparent',
      borderColor: darkTheme.colors.border,
    });
    expect(screen.getByText('Reps')).toHaveStyle({ color: darkTheme.colors.text });
  });

  it('can carry a hint, e.g. that a value is your own', async () => {
    await render(<Chip label="Sandbag" hint="Custom" selected={false} onPress={() => undefined} />);

    expect(screen.getByRole('checkbox', { name: 'Sandbag, Custom' })).toHaveTextContent(
      'SandbagCustom',
    );
  });
});
