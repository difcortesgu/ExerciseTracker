import { ApkDownloaderToken } from './apk-downloader';
import { ApkInstallerToken } from './apk-installer';
import { CheckForUpdateToken } from './check-for-update';
import { DownloadUpdateToken } from './download-update';
import { InstallUpdateToken } from './install-update';
import { ReleaseSourceToken } from './release-source';
import { UpdateOfferDismissalToken } from './update-offer-dismissal';

const TOKENS = [
  [ReleaseSourceToken, 'updates.ReleaseSource'],
  [ApkDownloaderToken, 'updates.ApkDownloader'],
  [ApkInstallerToken, 'updates.ApkInstaller'],
  [CheckForUpdateToken, 'updates.CheckForUpdate'],
  [DownloadUpdateToken, 'updates.DownloadUpdate'],
  [InstallUpdateToken, 'updates.InstallUpdate'],
  [UpdateOfferDismissalToken, 'updates.UpdateOfferDismissal'],
] as const;

describe('updates port and use-case tokens', () => {
  it.each(TOKENS)('names its token after the port or use case (%#)', (token, description) => {
    expect(token.description).toBe(description);
  });

  it('gives every port and use case its own token', () => {
    const keys = TOKENS.map(([token]) => token.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
