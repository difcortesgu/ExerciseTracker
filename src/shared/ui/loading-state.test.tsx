import { render, screen } from '@testing-library/react-native';

import { LoadingState } from './loading-state';

describe('LoadingState', () => {
  it('is labelled with what is loading and tells the user', async () => {
    await render(<LoadingState label="Loading routines" />);

    expect(screen.getByLabelText('Loading routines')).toHaveTextContent('Loading routines');
  });

  it('is announced as busy to screen readers', async () => {
    await render(<LoadingState label="Loading routines" />);

    expect(screen.getByLabelText('Loading routines')).toBeBusy();
  });
});
