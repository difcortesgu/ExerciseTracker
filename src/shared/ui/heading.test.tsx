import { render, screen } from '@testing-library/react-native';

import { Heading } from './heading';
import { lightTheme } from './theme/tokens';

describe('Heading', () => {
  it('is announced as a header by screen readers', async () => {
    await render(<Heading>Leg day</Heading>);

    expect(screen.getByRole('header', { name: 'Leg day' })).toBeOnTheScreen();
  });

  it('uses the theme heading size and strong weight, so it reads at arm’s length', async () => {
    await render(<Heading>Leg day</Heading>);

    expect(screen.getByRole('header', { name: 'Leg day' })).toHaveStyle({
      fontSize: lightTheme.typography.headingSize,
      fontWeight: lightTheme.typography.strongWeight,
    });
  });
});
