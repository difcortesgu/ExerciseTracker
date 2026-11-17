import { memoryFileSystem } from './in-memory-expo-file-system';

/**
 * In-memory stand-in for the native `expo-image-manipulator` module (Sprint 1, S1-22). Adapter
 * tests mock exactly this boundary (together with expo-file-system, whose in-memory files it
 * reads and writes):
 *
 *   jest.mock('expo-image-manipulator', () =>
 *     jest.requireActual<typeof import('@test/support/in-memory-image-manipulator')>(
 *       '@test/support/in-memory-image-manipulator',
 *     ),
 *   );
 *
 * It mimics `ImageManipulator.manipulate(uri).resize(…).renderAsync()` and `ImageRef.saveAsync`:
 * rendering needs the source file to exist, `resize` with one side keeps the aspect ratio, and
 * saving writes a new file into the manipulator's cache folder. Rendering or saving can be made
 * to fail. Call `imageManipulator.reset()` (and `memoryFileSystem.reset()`) in `beforeEach`.
 */

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

interface ResizeLike {
  readonly width?: number | null;
  readonly height?: number | null;
}

interface SaveOptionsLike {
  readonly format?: string;
  readonly compress?: number;
}

export type RecordedManipulation =
  | { readonly kind: 'manipulate'; readonly source: string }
  | { readonly kind: 'resize'; readonly size: ResizeLike }
  | { readonly kind: 'render' }
  | { readonly kind: 'save'; readonly options: SaveOptionsLike };

const OUTPUT_DIRECTORY_URI = 'file:///data/cache/ImageManipulator';
const OUTPUT_FILE_BYTES = 1;

export const SaveFormat = Object.freeze({ JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' } as const);

class InMemoryImageManipulator {
  operations: RecordedManipulation[] = [];
  readonly sizes = new Map<string, ImageSize>();
  renderError: Error | undefined;
  saveError: Error | undefined;
  private outputs = 0;

  reset(): void {
    this.operations = [];
    this.sizes.clear();
    this.renderError = undefined;
    this.saveError = undefined;
    this.outputs = 0;
  }

  /** An image file at `uri` (in the in-memory file system) with the given pixel size. */
  givenImage(uri: string, size: ImageSize): void {
    memoryFileSystem.files.set(uri, size.width * size.height);
    this.sizes.set(uri, size);
  }

  givenRenderFails(error: Error): void {
    this.renderError = error;
  }

  givenSaveFails(error: Error): void {
    this.saveError = error;
  }

  nextOutputUri(): string {
    this.outputs += 1;
    return `${OUTPUT_DIRECTORY_URI}/output-${this.outputs}.jpg`;
  }
}

export const imageManipulator = new InMemoryImageManipulator();

function resized(size: ImageSize, target: ResizeLike): ImageSize {
  const width = target.width ?? undefined;
  const height = target.height ?? undefined;
  if (width !== undefined && height !== undefined) return { width, height };
  if (width !== undefined) return { width, height: Math.round((size.height * width) / size.width) };
  if (height !== undefined) {
    return { width: Math.round((size.width * height) / size.height), height };
  }
  return size;
}

class ImageRef {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  saveAsync(options: SaveOptionsLike = {}): Promise<{ uri: string } & ImageSize> {
    imageManipulator.operations.push({ kind: 'save', options });
    if (imageManipulator.saveError !== undefined) return Promise.reject(imageManipulator.saveError);
    const uri = imageManipulator.nextOutputUri();
    memoryFileSystem.files.set(uri, OUTPUT_FILE_BYTES);
    imageManipulator.sizes.set(uri, { width: this.width, height: this.height });
    return Promise.resolve({ uri, width: this.width, height: this.height });
  }
}

class ImageManipulatorContext {
  private resizes: ResizeLike[] = [];

  constructor(private readonly source: string) {}

  resize(size: ResizeLike): ImageManipulatorContext {
    imageManipulator.operations.push({ kind: 'resize', size });
    this.resizes = [...this.resizes, size];
    return this;
  }

  renderAsync(): Promise<ImageRef> {
    imageManipulator.operations.push({ kind: 'render' });
    const size = imageManipulator.sizes.get(this.source);
    if (imageManipulator.renderError !== undefined) {
      return Promise.reject(imageManipulator.renderError);
    }
    if (size === undefined || !memoryFileSystem.files.has(this.source)) {
      return Promise.reject(new Error(`Could not load the image ${this.source}.`));
    }
    const final = this.resizes.reduce(resized, size);
    return Promise.resolve(new ImageRef(final.width, final.height));
  }
}

export const ImageManipulator = {
  manipulate(source: string): ImageManipulatorContext {
    imageManipulator.operations.push({ kind: 'manipulate', source });
    return new ImageManipulatorContext(source);
  },
};
