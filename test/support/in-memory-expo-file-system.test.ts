import { Directory, File, memoryFileSystem, Paths } from './in-memory-expo-file-system';

describe('in-memory expo-file-system stand-in', () => {
  beforeEach(() => {
    memoryFileSystem.reset();
  });

  it('joins path parts into file URIs under the cache directory', () => {
    const directory = new Directory(Paths.cache, 'updates/');

    expect(new File(directory, '/update.apk').uri).toBe('file:///data/cache/updates/update.apk');
  });

  it('creates directories and deletes existing files only', () => {
    const directory = new Directory(Paths.cache, 'updates');
    const file = new File(directory, 'a.apk');
    memoryFileSystem.files.set(file.uri, 3);

    directory.create();
    file.delete();

    expect(directory.exists).toBe(true);
    expect(file.exists).toBe(false);
    expect(file.size).toBe(0);
    expect(() => file.delete()).toThrow('Cannot delete');
  });

  it('exposes a content URI for sharing with other apps', () => {
    expect(new File('file:///data/cache/a.apk').contentUri).toBe(
      'content://com.farid.exercisetracker.FileSystemFileProvider/data/cache/a.apk',
    );
  });

  it('streams a delivered download into the destination with progress', async () => {
    memoryFileSystem.behaviour = { kind: 'deliver', sizeBytes: 10, serverTotalBytes: -1 };
    const progress: number[] = [];

    const file = await File.downloadFileAsync('https://x/a', new File('file:///a'), {
      onProgress: ({ bytesWritten }) => progress.push(bytesWritten),
    });

    expect(file.size).toBe(10);
    expect(progress).toEqual([5, 10]);
    expect(memoryFileSystem.downloads).toHaveLength(1);
  });

  it('refuses an existing destination unless the download is idempotent', async () => {
    memoryFileSystem.files.set('file:///a', 1);

    await expect(File.downloadFileAsync('https://x/a', new File('file:///a'))).rejects.toThrow(
      'DestinationAlreadyExists',
    );
  });

  it('leaves a partial file behind when the download fails', async () => {
    memoryFileSystem.behaviour = { kind: 'fail', partialBytes: 4, cause: new Error('reset') };

    await expect(File.downloadFileAsync('https://x/a', new File('file:///a'))).rejects.toThrow(
      'reset',
    );
    expect(new File('file:///a').size).toBe(4);
  });

  it('rejects with AbortError when a hanging download is aborted, or was aborted before', async () => {
    memoryFileSystem.behaviour = { kind: 'hang', partialBytes: 2 };
    const controller = new AbortController();
    const pending = File.downloadFileAsync('https://x/a', new File('file:///a'), {
      signal: controller.signal,
    });
    const preAborted = File.downloadFileAsync('https://x/b', new File('file:///b'), {
      signal: AbortSignal.abort(),
    });

    await Promise.resolve();
    await Promise.resolve();
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(preAborted).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('can make deletes fail, to test cleanup failures', () => {
    memoryFileSystem.files.set('file:///a', 1);
    memoryFileSystem.failingDeletes = true;

    expect(() => new File('file:///a').delete()).toThrow('Cannot delete');
  });

  describe('document storage, moving and listing (Sprint 1)', () => {
    const document = (...parts: string[]) => new File(Paths.document, ...parts);

    it('exposes the persistent document directory', () => {
      expect(Paths.document.uri).toBe('file:///data/files');
    });

    it('moves a file to its destination, which then has its URI', async () => {
      const source = new File('file:///data/cache/a.jpg');
      memoryFileSystem.files.set(source.uri, 7);

      await source.move(document('photos', 'b.jpg'));

      expect(memoryFileSystem.files.get('file:///data/files/photos/b.jpg')).toBe(7);
      expect(memoryFileSystem.files.has('file:///data/cache/a.jpg')).toBe(false);
      expect(source.uri).toBe('file:///data/files/photos/b.jpg');
    });

    it('refuses to move a missing file or onto an existing one unless overwriting', async () => {
      memoryFileSystem.files.set('file:///a', 1);
      memoryFileSystem.files.set('file:///b', 2);

      await expect(new File('file:///missing').move(new File('file:///c'))).rejects.toThrow(
        'Cannot move',
      );
      await expect(new File('file:///a').move(new File('file:///b'))).rejects.toThrow(
        'Cannot move',
      );
      await new File('file:///a').move(new File('file:///b'), { overwrite: true });
      expect(memoryFileSystem.files.get('file:///b')).toBe(1);
    });

    it('moves synchronously with the same rules', () => {
      const source = new File('file:///a');
      memoryFileSystem.files.set(source.uri, 3);
      memoryFileSystem.files.set('file:///b', 1);

      expect(() => source.moveSync(new File('file:///b'))).toThrow('Cannot move');
      source.moveSync(new File('file:///b'), { overwrite: true });

      expect(memoryFileSystem.files.get('file:///b')).toBe(3);
      expect(source.uri).toBe('file:///b');
    });

    it('can make moves fail, as when storage is full', async () => {
      memoryFileSystem.files.set('file:///a', 1);
      memoryFileSystem.failingMoves = true;

      await expect(new File('file:///a').move(new File('file:///b'))).rejects.toThrow(
        'Cannot move',
      );
      expect(memoryFileSystem.files.has('file:///a')).toBe(true);
    });

    it('knows the directory a file is in', () => {
      expect(document('photos', 'b.jpg').parentDirectory.uri).toBe('file:///data/files/photos');
    });

    it('creates intermediate directories when asked to', () => {
      new Directory(Paths.document, 'a', 'b').create({ intermediates: true, idempotent: true });

      expect(new Directory(Paths.document, 'a').exists).toBe(true);
      expect(new Directory(Paths.document, 'a', 'b').exists).toBe(true);
    });

    it('lists the direct children of a directory, files and directories', () => {
      new Directory(Paths.document, 'images', 'Curl').create({ intermediates: true });
      memoryFileSystem.files.set(document('images', 'top.jpg').uri, 1);
      memoryFileSystem.files.set(document('images', 'Curl', '0.jpg').uri, 1);

      const children = new Directory(Paths.document, 'images').list();

      expect(
        children.map((child) => [child instanceof File ? 'file' : 'directory', child.uri]),
      ).toEqual([
        ['directory', 'file:///data/files/images/Curl'],
        ['file', 'file:///data/files/images/top.jpg'],
      ]);
    });

    it('refuses to list a missing directory, and can make listing fail', () => {
      const directory = new Directory(Paths.document, 'images');

      expect(() => directory.list()).toThrow('Cannot list');
      directory.create();
      memoryFileSystem.failingLists = true;
      expect(() => directory.list()).toThrow('Cannot list');
    });
  });
});
