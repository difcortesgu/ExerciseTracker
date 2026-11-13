import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { BootstrapperToken, type Bootstrapper } from '@core/bootstrap/bootstrapper';
import { createContainer } from '@core/di/container';
import { domainError } from '@shared/domain/domain-error';
import { err, ok } from '@shared/domain/result';

import { AppBootstrapGate } from './app-bootstrap-gate';
import { DependencyProvider } from './dependency-provider';

const neverSettles: Bootstrapper = () => new Promise(() => undefined);
const succeeds: Bootstrapper = () => Promise.resolve(ok(undefined));
const failsMigration: Bootstrapper = () =>
  Promise.resolve(err(domainError('db.migrationFailed', 'Migration 0002_sets failed.')));

async function renderGate(bootstrap: Bootstrapper): Promise<void> {
  const container = createContainer().register(BootstrapperToken, () => bootstrap);
  await render(
    <DependencyProvider resolver={container}>
      <AppBootstrapGate>
        <Text>Tabs</Text>
      </AppBootstrapGate>
    </DependencyProvider>,
  );
}

describe('AppBootstrapGate', () => {
  it('shows a loading state, not the app, while startup is in progress', async () => {
    await renderGate(neverSettles);

    expect(screen.getByLabelText('Loading Exercise Tracker')).toBeOnTheScreen();
    expect(screen.queryByText('Tabs')).not.toBeOnTheScreen();
  });

  it('shows the app once startup succeeds', async () => {
    await renderGate(succeeds);

    expect(await screen.findByText('Tabs')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Loading Exercise Tracker')).not.toBeOnTheScreen();
  });

  it('shows a readable error screen instead of the app when startup fails', async () => {
    await renderGate(failsMigration);

    expect(await screen.findByLabelText('Startup failed')).toHaveTextContent(
      /Migration 0002_sets failed\./,
    );
    expect(screen.queryByText('Tabs')).not.toBeOnTheScreen();
  });
});
