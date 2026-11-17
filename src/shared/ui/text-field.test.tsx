import { fireEvent, render, screen } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { TextField } from './text-field';
import { darkTheme, lightTheme } from './theme/tokens';

describe('TextField', () => {
  afterEach(() => {
    jest.mocked(useColorScheme).mockReset();
  });

  it('is an input found by its label, showing the label above it', async () => {
    await render(<TextField label="Name" value="Goblet squat" onChangeText={() => undefined} />);

    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Goblet squat');
    expect(screen.getByText('Name')).toBeOnTheScreen();
  });

  it('reports every change of the text', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Name" value="" onChangeText={onChangeText} />);

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Squat');

    expect(onChangeText).toHaveBeenCalledWith('Squat');
  });

  it('can hide its visible label when the context already names it (e.g. a search field)', async () => {
    await render(
      <TextField label="Search exercises" hideLabel value="" onChangeText={() => undefined} />,
    );

    expect(screen.getByLabelText('Search exercises')).toBeOnTheScreen();
    expect(screen.queryByText('Search exercises')).not.toBeOnTheScreen();
  });

  it('is a large touch target in the theme colours', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');

    await render(<TextField label="Name" value="" onChangeText={() => undefined} />);

    expect(screen.getByLabelText('Name')).toHaveStyle({
      minHeight: darkTheme.interaction.minTouchTargetSize,
      color: darkTheme.colors.text,
      backgroundColor: darkTheme.colors.surface,
      borderColor: darkTheme.colors.border,
    });
  });

  it('accepts several lines when multiline', async () => {
    await render(
      <TextField label="Instructions" multiline value="" onChangeText={() => undefined} />,
    );

    expect(screen.getByLabelText('Instructions').props.multiline).toBe(true);
  });

  describe('with an error', () => {
    it('shows the error below the field in the danger colour and outlines the field', async () => {
      await render(
        <TextField label="Name" value="" error="Enter a name" onChangeText={() => undefined} />,
      );

      expect(screen.getByText('Enter a name')).toHaveStyle({ color: lightTheme.colors.danger });
      expect(screen.getByLabelText('Name')).toHaveStyle({ borderColor: lightTheme.colors.danger });
    });

    it('describes the input with the error, so screen readers read it with the field', async () => {
      await render(
        <TextField label="Name" value="" error="Enter a name" onChangeText={() => undefined} />,
      );

      expect(screen.getByLabelText('Name')).toHaveAccessibleName('Name');
      expect(screen.getByLabelText('Name').props.accessibilityHint).toBe('Enter a name');
    });
  });
});
