/**
 * In-memory stand-in for the native `expo-file-system` module (Sprint 0.5). Jest has no native
 * file system, so adapter tests mock exactly this boundary and nothing else:
 *
 *   jest.mock('expo-file-system', () =>
 *     jest.requireActual<typeof import('@test/support/in-memory-expo-file-system')>(
 *       '@test/support/in-memory-expo-file-system',
 *     ),
 *   );
 *
 * It mimics the documented behaviour the adapters rely on: `downloadFileAsync` streams into the
 * destination (a partial file stays behind on failure, as on Android), rejects with `AbortError`
 * when its signal aborts, and refuses an existing destination unless `idempotent` is set.
 * Sprint 1 adds the persistent `Paths.document`, `File.move` / `moveSync` (refuse a missing source or an
 * existing destination unless `overwrite`, and update the moved file's `uri`), intermediate
 * directories, `File.parentDirectory` and `Directory.list` (direct children; rejects a missing directory), plus switches
 * that make moves and listings fail (storage full, I/O error).
 * Call `memoryFileSystem.reset()` in `beforeEach`.
 */

interface DownloadOptionsLike {
  readonly idempotent?: boolean;
  readonly signal?: AbortSignal;
  readonly onProgress?: (data: { bytesWritten: number; totalBytes: number }) => void;
}

/** What the "server" does with the next downloads. `serverTotalBytes` -1 = no Content-Length. */
export type ServerBehaviour =
  | { readonly kind: 'deliver'; readonly sizeBytes: number; readonly serverTotalBytes: number }
  | { readonly kind: 'fail'; readonly partialBytes: number; readonly cause: Error }
  | { readonly kind: 'hang'; readonly partialBytes: number };

export interface RecordedDownload {
  readonly url: string;
  readonly destinationUri: string;
  readonly options: DownloadOptionsLike;
}

const DEFAULT_BEHAVIOUR: ServerBehaviour = { kind: 'deliver', sizeBytes: 1, serverTotalBytes: -1 };

class InMemoryFileSystem {
  readonly files = new Map<string, number>();
  readonly directories = new Set<string>();
  behaviour: ServerBehaviour = DEFAULT_BEHAVIOUR;
  downloads: RecordedDownload[] = [];
  failingDeletes = false;
  failingMoves = false;
  failingLists = false;

  reset(): void {
    this.files.clear();
    this.directories.clear();
    this.behaviour = DEFAULT_BEHAVIOUR;
    this.downloads = [];
    this.failingDeletes = false;
    this.failingMoves = false;
    this.failingLists = false;
  }
}

export const memoryFileSystem = new InMemoryFileSystem();

type PathPart = string | { readonly uri: string };

function joinUri(parts: readonly PathPart[]): string {
  return parts
    .map((part) => (typeof part === 'string' ? part : part.uri))
    .map((part, index) => (index === 0 ? part.replace(/\/+$/, '') : part.replace(/^\/+|\/+$/g, '')))
    .join('/');
}

function abortError(): Error {
  return Object.assign(new Error('The download was aborted.'), { name: 'AbortError' });
}

interface DirectoryCreateOptionsLike {
  readonly intermediates?: boolean;
  readonly idempotent?: boolean;
}

interface RelocationOptionsLike {
  readonly overwrite?: boolean;
}

function parentUri(uri: string): string {
  return uri.slice(0, uri.lastIndexOf('/'));
}

/** Every ancestor directory URI below `file://` (for `create({ intermediates: true })`). */
function ancestorUris(uri: string): readonly string[] {
  const ancestors: string[] = [];
  for (let parent = parentUri(uri); parent.length > 'file://'.length; parent = parentUri(parent)) {
    ancestors.push(parent);
  }
  return ancestors;
}

export class Directory {
  readonly uri: string;

  constructor(...parts: PathPart[]) {
    this.uri = joinUri(parts);
  }

  get exists(): boolean {
    return memoryFileSystem.directories.has(this.uri);
  }

  create(options: DirectoryCreateOptionsLike = {}): void {
    if (options.intermediates === true) {
      ancestorUris(this.uri).forEach((ancestor) => memoryFileSystem.directories.add(ancestor));
    }
    memoryFileSystem.directories.add(this.uri);
  }

  list(): (Directory | File)[] {
    if (!this.exists || memoryFileSystem.failingLists) {
      throw new Error(`Cannot list ${this.uri}.`);
    }
    const isChild = (uri: string): boolean => parentUri(uri) === this.uri;
    const directories = [...memoryFileSystem.directories].filter(isChild).sort();
    const files = [...memoryFileSystem.files.keys()].filter(isChild).sort();
    return [...directories.map((uri) => new Directory(uri)), ...files.map((uri) => new File(uri))];
  }
}

export class File {
  private currentUri: string;

  constructor(...parts: PathPart[]) {
    this.currentUri = joinUri(parts);
  }

  /** Like the native module, the URI follows the file when it is moved. */
  get uri(): string {
    return this.currentUri;
  }

  get exists(): boolean {
    return memoryFileSystem.files.has(this.uri);
  }

  get parentDirectory(): Directory {
    return new Directory(parentUri(this.uri));
  }

  get size(): number {
    return memoryFileSystem.files.get(this.uri) ?? 0;
  }

  get contentUri(): string {
    return this.uri.replace(
      'file:///',
      'content://com.farid.exercisetracker.FileSystemFileProvider/',
    );
  }

  delete(): void {
    if (!this.exists || memoryFileSystem.failingDeletes) {
      throw new Error(`Cannot delete ${this.uri}.`);
    }
    memoryFileSystem.files.delete(this.uri);
  }

  move(destination: File, options: RelocationOptionsLike = {}): Promise<void> {
    try {
      this.moveSync(destination, options);
      return Promise.resolve();
    } catch (cause) {
      return Promise.reject(cause);
    }
  }

  moveSync(destination: File, options: RelocationOptionsLike = {}): void {
    const size = memoryFileSystem.files.get(this.uri);
    const blocked = destination.exists && options.overwrite !== true;
    if (size === undefined || blocked || memoryFileSystem.failingMoves) {
      throw new Error(`Cannot move ${this.uri} to ${destination.uri}.`);
    }
    memoryFileSystem.files.delete(this.uri);
    memoryFileSystem.files.set(destination.uri, size);
    this.currentUri = destination.uri;
  }

  static async downloadFileAsync(
    url: string,
    destination: File,
    options: DownloadOptionsLike = {},
  ): Promise<File> {
    memoryFileSystem.downloads.push({ url, destinationUri: destination.uri, options });
    if (destination.exists && options.idempotent !== true) {
      throw new Error('DestinationAlreadyExists');
    }
    await Promise.resolve();
    if (options.signal?.aborted === true) {
      throw abortError();
    }
    return streamInto(destination, memoryFileSystem.behaviour, options);
  }
}

function streamInto(
  destination: File,
  behaviour: ServerBehaviour,
  options: DownloadOptionsLike,
): Promise<File> {
  const write = (bytes: number, totalBytes: number): void => {
    memoryFileSystem.files.set(destination.uri, bytes);
    options.onProgress?.({ bytesWritten: bytes, totalBytes });
  };
  switch (behaviour.kind) {
    case 'deliver':
      write(Math.floor(behaviour.sizeBytes / 2), behaviour.serverTotalBytes);
      write(behaviour.sizeBytes, behaviour.serverTotalBytes);
      return Promise.resolve(destination);
    case 'fail':
      write(behaviour.partialBytes, -1);
      return Promise.reject(behaviour.cause);
    case 'hang':
      write(behaviour.partialBytes, -1);
      return new Promise<File>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(abortError()));
      });
  }
}

export const Paths = {
  get cache(): Directory {
    return new Directory('file:///data/cache');
  },
  get document(): Directory {
    return new Directory('file:///data/files');
  },
};
