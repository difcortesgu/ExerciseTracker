import { render, screen } from '@testing-library/react-native';

import { Subheading } from './subheading';
import { lightTheme } from './theme/tokens';

describe('Subheading', () => {
  it('is announced as a header, so screen readers can jump between sections', async () => {
    await render(<Subheading>Instructions</Subheading>);

    expect(screen.getByRole('header', { name: 'Instructions' })).toBeOnTheScreen();
  });

  it('is smaller than a screen heading but still strong', async () => {
    await render(<Subheading>Instructions</Subheading>);

    expect(screen.getByRole('header', { name: 'Instructions' })).toHaveStyle({
      fontSize: lightTheme.typography.subheadingSize,
      fontWeight: lightTheme.typography.strongWeight,
      color: lightTheme.colors.text,
    });
    expect(lightTheme.typography.subheadingSize).toBeLessThan(lightTheme.typography.headingSize);
  });
});
