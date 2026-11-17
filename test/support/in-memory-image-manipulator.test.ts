import { memoryFileSystem } from './in-memory-expo-file-system';
import { ImageManipulator, imageManipulator, SaveFormat } from './in-memory-image-manipulator';

const SOURCE = 'file:///picker/a.jpg';

describe('in-memory expo-image-manipulator stand-in', () => {
  beforeEach(() => {
    memoryFileSystem.reset();
    imageManipulator.reset();
  });

  it('renders and saves an arranged image into the manipulator cache, recording each step', async () => {
    imageManipulator.givenImage(SOURCE, { width: 400, height: 300 });

    const image = await ImageManipulator.manipulate(SOURCE).renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

    expect(saved).toEqual({
      uri: 'file:///data/cache/ImageManipulator/output-1.jpg',
      width: 400,
      height: 300,
    });
    expect(memoryFileSystem.files.has(saved.uri)).toBe(true);
    expect(imageManipulator.operations).toEqual([
      { kind: 'manipulate', source: SOURCE },
      { kind: 'render' },
      { kind: 'save', options: { format: 'jpeg', compress: 0.8 } },
    ]);
  });

  it('keeps the aspect ratio when resizing by one side, like the native module', async () => {
    imageManipulator.givenImage(SOURCE, { width: 4000, height: 3000 });

    const byWidth = await ImageManipulator.manipulate(SOURCE).resize({ width: 1600 }).renderAsync();
    const byHeight = await ImageManipulator.manipulate(SOURCE)
      .resize({ height: 1500 })
      .renderAsync();
    const both = await ImageManipulator.manipulate(SOURCE)
      .resize({ width: 10, height: 20 })
      .renderAsync();

    expect([byWidth.width, byWidth.height]).toEqual([1600, 1200]);
    expect([byHeight.width, byHeight.height]).toEqual([2000, 1500]);
    expect([both.width, both.height]).toEqual([10, 20]);
    expect(imageManipulator.operations).toContainEqual({
      kind: 'resize',
      size: { width: 1600 },
    });
  });

  it('cannot render an image whose file does not exist', async () => {
    await expect(ImageManipulator.manipulate(SOURCE).renderAsync()).rejects.toThrow(
      'Could not load',
    );
  });

  it('can make rendering or saving fail', async () => {
    imageManipulator.givenImage(SOURCE, { width: 4, height: 3 });

    imageManipulator.givenSaveFails(new Error('No space left'));
    const image = await ImageManipulator.manipulate(SOURCE).renderAsync();
    await expect(image.saveAsync()).rejects.toThrow('No space left');

    imageManipulator.givenRenderFails(new Error('Out of memory'));
    await expect(ImageManipulator.manipulate(SOURCE).renderAsync()).rejects.toThrow(
      'Out of memory',
    );
  });
});
