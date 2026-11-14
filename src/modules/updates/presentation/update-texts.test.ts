import { domainError } from '@shared/domain/domain-error';
import { aRelease } from '@test/builders/release.builder';

import type { DownloadErrorCode } from '../application/apk-downloader';
import type { InstallerErrorCode } from '../application/apk-installer';

import {
  downloadAmountText,
  downloadPercent,
  downloadTitle,
  failureText,
  formatMegabytes,
  offerTitle,
} from './update-texts';

const MEBIBYTE = 1_048_576;

describe('update prompt texts', () => {
  describe('offerTitle', () => {
    it('names the build and its download size', () => {
      const release = aRelease()
        .forBuild(42)
        .withSize(35 * MEBIBYTE)
        .build();

      expect(offerTitle(release)).toBe('Build 42 available (35 MB)');
    });
  });

  describe('downloadTitle', () => {
    it('names the build being downloaded', () => {
      expect(downloadTitle(aRelease().forBuild(43).build())).toBe('Downloading build 43');
    });
  });

  describe('formatMegabytes', () => {
    it.each([
      [35 * MEBIBYTE, '35 MB'],
      [35.4 * MEBIBYTE, '35 MB'],
      [10 * MEBIBYTE, '10 MB'],
      [9.96 * MEBIBYTE, '10.0 MB'],
      [4.25 * MEBIBYTE, '4.3 MB'],
      [0, '0.0 MB'],
    ])('formats %d bytes as %s', (bytes, text) => {
      expect(formatMegabytes(bytes)).toBe(text);
    });
  });

  describe('downloadPercent', () => {
    it.each([
      [0, 100, 0],
      [45, 100, 45],
      [999, 1000, 99],
      [100, 100, 100],
    ])(
      'is %d of %d bytes = %d%%, rounded down so 100%% means complete',
      (received, total, percent) => {
        expect(downloadPercent({ receivedBytes: received, totalBytes: total })).toBe(percent);
      },
    );

    it('never exceeds 100% if the server sends more than expected', () => {
      expect(downloadPercent({ receivedBytes: 150, totalBytes: 100 })).toBe(100);
    });

    it('is 0% when the total is unknown', () => {
      expect(downloadPercent({ receivedBytes: 50, totalBytes: 0 })).toBe(0);
    });
  });

  describe('downloadAmountText', () => {
    it('shows the bytes received of the total', () => {
      expect(
        downloadAmountText({ receivedBytes: 4.25 * MEBIBYTE, totalBytes: 35 * MEBIBYTE }),
      ).toBe('4.3 MB of 35 MB');
    });
  });

  describe('failureText', () => {
    it.each<[DownloadErrorCode | InstallerErrorCode, string, RegExp]>([
      ['updates.downloadFailed', 'Download failed', /connection/],
      ['updates.downloadSizeMismatch', 'Download failed', /incomplete/],
      ['updates.downloadCancelled', 'Download failed', /stopped/],
      ['updates.apkMissing', 'Could not open the installer', /download it again/],
      ['updates.installerUnavailable', 'Could not open the installer', /installer/],
    ])('explains %s readably', (code, title, message) => {
      const text = failureText(domainError(code, 'technical detail'));

      expect(text.title).toBe(title);
      expect(text.message).toMatch(message);
      expect(text.message).not.toMatch(/technical detail/);
    });
  });
});
