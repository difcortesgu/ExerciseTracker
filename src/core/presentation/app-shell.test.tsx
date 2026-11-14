import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { BootstrapperToken, type Bootstrapper } from '@core/bootstrap/bootstrapper';
import { createContainer } from '@core/di/container';
import { createToken } from '@shared/application/di/token';
import { domainError } from '@shared/domain/domain-error';
import { err, ok } from '@shared/domain/result';

import { AppShell } from './app-shell';
import { useDependency } from './dependency-provider';

const neverSettles: Bootstrapper = () => new Promise(() => undefined);
const succeeds: Bootstrapper = () => Promise.resolve(ok(undefined));
const failsMigration: Bootstrapper = () =>
  Promise.resolve(err(domainError('db.migrationFailed', 'Migration 0002_sets failed.')));

const GreetingToken = createToken<string>('test.Greeting');

/** Stands in for the update prompt: an overlay that reads the container. */
function GreetingOverlay() {
  return <Text>{`Overlay: ${useDependency(GreetingToken)}`}</Text>;
}

async function renderShell(bootstrap: Bootstrapper): Promise<void> {
  const container = createContainer()
    .register(BootstrapperToken, () => bootstrap)
    .register(GreetingToken, () => 'from the container');
  await render(
    <AppShell resolver={container} overlay={<GreetingOverlay />}>
      <Text>Routes</Text>
    </AppShell>,
  );
}

describe('AppShell (root layout composition, QA-05-3)', () => {
  it('shows neither the routes nor the overlay while startup is in progress', async () => {
    await renderShell(neverSettles);

    expect(screen.getByLabelText('Loading Exercise Tracker')).toBeOnTheScreen();
    expect(screen.queryByText('Routes')).not.toBeOnTheScreen();
    expect(screen.queryByText(/Overlay/)).not.toBeOnTheScreen();
  });

  it('shows the routes and the overlay, both wired to the container, after startup succeeds', async () => {
    await renderShell(succeeds);

    expect(await screen.findByText('Routes')).toBeOnTheScreen();
    expect(screen.getByText('Overlay: from the container')).toBeOnTheScreen();
  });

  it('never shows the overlay over the startup failure screen (S05-08, Q6)', async () => {
    await renderShell(failsMigration);

    expect(await screen.findByLabelText('Startup failed')).toBeOnTheScreen();
    expect(screen.queryByText(/Overlay/)).not.toBeOnTheScreen();
    expect(screen.queryByText('Routes')).not.toBeOnTheScreen();
  });
});
