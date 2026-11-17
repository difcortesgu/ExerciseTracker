import manifest from '@assets/exercise-db/manifest.json';
import { aBuiltInImage } from '@test/builders/exercise.builder';

import {
  BUILT_IN_IMAGE_DIRECTORY,
  CUSTOM_PHOTO_DIRECTORY,
  PARTIAL_DOWNLOAD_SUFFIX,
  PHOTO_FILE_EXTENSION,
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_LONGEST_SIDE_PX,
  builtInImageUrl,
  parseImageBaseUrl,
} from './exercise-image-config';

describe('exercise image configuration (ADR-004 §5, §7)', () => {
  it('stores built-in images and custom photos in their own document folders', () => {
    expect([BUILT_IN_IMAGE_DIRECTORY, CUSTOM_PHOTO_DIRECTORY]).toEqual([
      'exercise-images',
      'exercise-photos',
    ]);
  });

  it('downloads into a temporary sibling file', () => {
    expect(PARTIAL_DOWNLOAD_SUFFIX).toBe('.part');
  });

  it('stores photos as JPEG at quality 0.8 with the longest side at most 1 600 px', () => {
    expect([PHOTO_FILE_EXTENSION, PHOTO_JPEG_QUALITY, PHOTO_MAX_LONGEST_SIDE_PX]).toEqual([
      '.jpg',
      0.8,
      1600,
    ]);
  });

  describe('parseImageBaseUrl', () => {
    it('accepts the pinned manifest image location', () => {
      expect(parseImageBaseUrl(manifest.imageBaseUrl)).toBe(manifest.imageBaseUrl);
    });

    it.each([
      ['an http URL', 'http://example.com/exercises/'],
      ['a URL without a trailing slash', 'https://example.com/exercises'],
      ['an empty string', ''],
    ])('rejects %s as a broken build artefact', (_case, url) => {
      expect(() => parseImageBaseUrl(url)).toThrow('imageBaseUrl');
    });
  });

  describe('builtInImageUrl', () => {
    it('appends the dataset path to the pinned image location', () => {
      const url = builtInImageUrl(
        parseImageBaseUrl(manifest.imageBaseUrl),
        aBuiltInImage('Barbell_Squat/0.jpg').path,
      );

      expect(url).toBe(
        'https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/Barbell_Squat/0.jpg',
      );
    });
  });
});
