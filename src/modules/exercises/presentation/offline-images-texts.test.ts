import {
  cancelledSummaryText,
  confirmationMessage,
  finishedSummaryText,
  formatImageCount,
  formatMegabytesDecimal,
  missingImagesText,
  progressLabel,
  progressText,
} from './offline-images-texts';

describe('offline images texts (S1-28)', () => {
  describe('formatImageCount', () => {
    it('groups thousands with a space, as in "1 746"', () => {
      expect(formatImageCount(1746)).toBe('1 746');
      expect(formatImageCount(1_234_567)).toBe('1 234 567');
    });

    it('leaves numbers below a thousand unchanged', () => {
      expect(formatImageCount(0)).toBe('0');
      expect(formatImageCount(999)).toBe('999');
    });
  });

  describe('formatMegabytesDecimal', () => {
    it('rounds to whole decimal megabytes from 10 MB on', () => {
      expect(formatMegabytesDecimal(98_671_281)).toBe('99 MB');
      expect(formatMegabytesDecimal(10_000_000)).toBe('10 MB');
    });

    it('shows one decimal below 10 MB', () => {
      expect(formatMegabytesDecimal(9_940_000)).toBe('9.9 MB');
      expect(formatMegabytesDecimal(565_000)).toBe('0.6 MB');
    });

    it('never shows a non-zero amount as 0.0 MB', () => {
      expect(formatMegabytesDecimal(20_000)).toBe('0.1 MB');
    });

    it('shows nothing to download as 0 MB', () => {
      expect(formatMegabytesDecimal(0)).toBe('0 MB');
    });
  });

  describe('confirmationMessage', () => {
    it('states the missing count and the estimated size, labelled as an estimate', () => {
      expect(
        confirmationMessage({ missingCount: 1746, missingBytes: 98_671_281, totalCount: 1746 }),
      ).toBe('1 746 images, about 99 MB. Use Wi-Fi if you can.');
    });

    it('uses the singular for one image', () => {
      expect(confirmationMessage({ missingCount: 1, missingBytes: 56_500, totalCount: 1746 })).toBe(
        '1 image, about 0.1 MB. Use Wi-Fi if you can.',
      );
    });
  });

  describe('missingImagesText', () => {
    it('says how many of all images are not on the phone yet', () => {
      expect(missingImagesText({ missingCount: 496, missingBytes: 1, totalCount: 1746 })).toBe(
        '496 of 1 746 images are not on this phone yet.',
      );
    });
  });

  describe('progress', () => {
    it('counts finished images, failed ones included, as "n of total"', () => {
      const running = { status: 'running', completed: 248, failed: 2, total: 1512 } as const;

      expect(progressText(running)).toBe('250 of 1 512');
      expect(progressLabel(running)).toBe('Image download progress, 250 of 1 512');
    });
  });

  describe('finishedSummaryText', () => {
    it('says how many images were downloaded when none failed', () => {
      expect(finishedSummaryText({ succeeded: 1746, failed: 0, stoppedEarly: false })).toBe(
        '1 746 images downloaded.',
      );
    });

    it('says how many succeeded and how many failed', () => {
      expect(finishedSummaryText({ succeeded: 1, failed: 3, stoppedEarly: false })).toBe(
        '1 image downloaded, 3 failed.',
      );
    });

    it('explains a run that stopped early because the connection seems lost', () => {
      expect(finishedSummaryText({ succeeded: 40, failed: 1706, stoppedEarly: true })).toBe(
        '40 images downloaded, 1 706 failed. The download stopped because the connection seems lost.',
      );
    });
  });

  describe('cancelledSummaryText', () => {
    it('says what was kept and what is still missing', () => {
      expect(cancelledSummaryText({ succeeded: 250, remaining: 1496 })).toBe(
        'Download cancelled. 250 images downloaded, 1 496 still missing.',
      );
    });
  });
});
