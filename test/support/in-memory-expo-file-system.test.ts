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
});
