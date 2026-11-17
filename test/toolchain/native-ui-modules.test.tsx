/**
 * Proves that the Sprint 1 UI packages render in Jest without a native runtime (jest-expo mocks the
 * native views), so presentation tests can use them directly: `expo-image` for exercise images and
 * `@expo/vector-icons` for the tab bar icons (S1-05, S1-17, S1-18). Device-service packages
 * (`expo-image-picker`, `expo-image-manipulator`, `expo-file-system`) are only used by
 * infrastructure adapters, whose tests mock exactly that native boundary.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';

describe('Sprint 1 UI packages in Jest', () => {
  it('renders an expo-image Image that is found by its accessibility label', async () => {
    await render(
      <Image
        source={{ uri: 'file:///data/exercise-images/Barbell_Squat/0.jpg' }}
        accessibilityLabel="Barbell Squat, image 1 of 2"
      />,
    );

    expect(screen.getByLabelText('Barbell Squat, image 1 of 2')).toBeOnTheScreen();
  });

  it('renders an @expo/vector-icons icon with the colour it is given', async () => {
    await render(<Ionicons name="barbell" size={24} color="#208AEF" testID="tab-icon" />);

    expect(screen.getByTestId('tab-icon')).toHaveStyle({ color: '#208AEF' });
  });
});
