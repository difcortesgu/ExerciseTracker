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

  reset(): void {
    this.files.clear();
    this.directories.clear();
    this.behaviour = DEFAULT_BEHAVIOUR;
    this.downloads = [];
    this.failingDeletes = false;
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

export class Directory {
  readonly uri: string;

  constructor(...parts: PathPart[]) {
    this.uri = joinUri(parts);
  }

  get exists(): boolean {
    return memoryFileSystem.directories.has(this.uri);
  }

  create(): void {
    memoryFileSystem.directories.add(this.uri);
  }
}

export class File {
  readonly uri: string;

  constructor(...parts: PathPart[]) {
    this.uri = joinUri(parts);
  }

  get exists(): boolean {
    return memoryFileSystem.files.has(this.uri);
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
};
