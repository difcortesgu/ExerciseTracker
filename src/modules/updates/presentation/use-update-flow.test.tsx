import { act, renderHook } from '@testing-library/react-native';

import { DependencyProvider } from '@core/presentation';
import { ok } from '@shared/domain/result';
import {
  aPromptContainer,
  downloadedApk,
  offeredRelease,
} from '@test/support/update-prompt-harness';

import { useUpdateFlow } from './use-update-flow';

async function renderFlow() {
  const setup = aPromptContainer();
  const hook = await renderHook(() => useUpdateFlow(), {
    wrapper: ({ children }) => (
      <DependencyProvider resolver={setup.container}>{children}</DependencyProvider>
    ),
  });
  return { ...setup, result: hook.result };
}

describe('useUpdateFlow view model: fast double taps (two taps before React re-renders)', () => {
  it('starts only one download when Update is tapped twice', async () => {
    const { result, downloads } = await renderFlow();

    const flow = result.current;
    await act(async () => {
      flow.update(offeredRelease);
      flow.update(offeredRelease);
    });

    expect(downloads.attempts).toHaveLength(1);
  });

  it('opens the installer only once when Open installer is tapped twice', async () => {
    const { result, downloads, installer } = await renderFlow();
    await act(async () => result.current.update(offeredRelease));
    await downloads.latest().settle(ok(downloadedApk));

    const flow = result.current;
    await act(async () => {
      flow.openInstaller(downloadedApk);
      flow.openInstaller(downloadedApk);
    });

    expect(installer.opened).toHaveLength(1);
  });
});
