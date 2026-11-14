import { aPublishedRelease } from '@test/builders/release.builder';
import {
  describeReleaseSourceContract,
  type ArrangeableReleaseSourceFailure,
} from '@test/contracts/release-source.contract';

import { GITHUB_RELEASE_REPOSITORY, RELEASE_CHECK_TIMEOUT_MS } from './github-release-config';
import {
  GitHubReleaseSource,
  type HttpGet,
  type HttpGetOptions,
  type HttpResponse,
} from './github-release-source';

const LATEST_RELEASE_URL =
  'https://api.github.com/repos/difcortesgu/ExerciseTracker/releases/latest';

type StubAnswer =
  | { readonly kind: 'respond'; readonly status: number; readonly body: unknown }
  | { readonly kind: 'notJson'; readonly status: number }
  | { readonly kind: 'reject'; readonly cause: unknown }
  | { readonly kind: 'hang' };

function abortError(): Error {
  return Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
}

/** Rejects like `fetch` does when its signal is aborted; otherwise never settles. */
function untilAborted<T>(signal: AbortSignal): Promise<T> {
  return new Promise<T>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(abortError()));
  });
}

/** Stub of the HTTP boundary (the global `fetch` in production). */
class StubHttp {
  private answer: StubAnswer = { kind: 'respond', status: 200, body: {} };
  readonly calls: { readonly url: string; readonly options: HttpGetOptions }[] = [];

  readonly get: HttpGet = (url, options) => {
    this.calls.push({ url, options });
    const answer = this.answer;
    if (answer.kind === 'reject') return Promise.reject(answer.cause);
    if (answer.kind === 'hang') return untilAborted(options.signal);
    return Promise.resolve(this.response(answer));
  };

  answerWith(answer: StubAnswer): void {
    this.answer = answer;
  }

  private response(answer: Extract<StubAnswer, { status: number }>): HttpResponse {
    return {
      status: answer.status,
      ok: answer.status >= 200 && answer.status < 300,
      json: () =>
        answer.kind === 'respond'
          ? Promise.resolve(answer.body)
          : Promise.reject(new SyntaxError('Unexpected token < in JSON')),
    };
  }
}

/** GitHub's JSON for a published release (only the fields the app reads, plus noise). */
function gitHubJson(release = aPublishedRelease().build()): unknown {
  return {
    id: 1,
    draft: false,
    prerelease: false,
    tag_name: release.tagName,
    name: 'Build',
    assets: release.assets.map((asset) => ({
      name: asset.name,
      browser_download_url: asset.downloadUrl,
      ...(asset.sizeBytes === null ? {} : { size: asset.sizeBytes }),
      content_type: 'application/vnd.android.package-archive',
    })),
  };
}

const FAILURE_ANSWERS: Record<ArrangeableReleaseSourceFailure, StubAnswer> = {
  'updates.noPublishedRelease': { kind: 'respond', status: 404, body: { message: 'Not Found' } },
  'updates.rateLimited': { kind: 'respond', status: 403, body: { message: 'rate limit' } },
  'updates.httpError': { kind: 'respond', status: 502, body: {} },
  'updates.networkUnavailable': { kind: 'reject', cause: new TypeError('Network request failed') },
  'updates.malformedResponse': { kind: 'notJson', status: 200 },
};

function createSource(http = new StubHttp(), timeoutMs = RELEASE_CHECK_TIMEOUT_MS) {
  const source = new GitHubReleaseSource({
    repository: GITHUB_RELEASE_REPOSITORY,
    timeoutMs,
    fetch: http.get,
  });
  return { source, http };
}

describeReleaseSourceContract('GitHubReleaseSource', () => {
  const { source, http } = createSource();
  return {
    source,
    givenLatestRelease: (release) =>
      http.answerWith({ kind: 'respond', status: 200, body: gitHubJson(release) }),
    givenFailure: (code) => http.answerWith(FAILURE_ANSWERS[code]),
    requestCount: () => http.calls.length,
  };
});

describe('GitHubReleaseSource', () => {
  describe('configuration', () => {
    it('reads the releases of difcortesgu/ExerciseTracker with a 10 s timeout', () => {
      expect(GITHUB_RELEASE_REPOSITORY).toEqual({ owner: 'difcortesgu', name: 'ExerciseTracker' });
      expect(RELEASE_CHECK_TIMEOUT_MS).toBe(10_000);
    });
  });

  describe('request', () => {
    it("asks GitHub's public REST API for the latest release, without authentication", async () => {
      const { source, http } = createSource();

      await source.fetchLatestRelease();

      expect(http.calls).toHaveLength(1);
      expect(http.calls[0]?.url).toBe(LATEST_RELEASE_URL);
      expect(http.calls[0]?.options.headers).toEqual({
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      });
    });

    it('builds the URL from the configured repository', async () => {
      const http = new StubHttp();
      const source = new GitHubReleaseSource({
        repository: { owner: 'someone', name: 'fork' },
        timeoutMs: RELEASE_CHECK_TIMEOUT_MS,
        fetch: http.get,
      });

      await source.fetchLatestRelease();

      expect(http.calls[0]?.url).toBe('https://api.github.com/repos/someone/fork/releases/latest');
    });
  });

  describe('response mapping', () => {
    it('maps the tag and every asset, with a missing size as null', async () => {
      const { source, http } = createSource();
      http.answerWith({
        kind: 'respond',
        status: 200,
        body: {
          tag_name: 'build-9',
          assets: [
            { name: 'a.apk', browser_download_url: 'https://github.com/a.apk', size: 12 },
            { name: 'notes.txt', browser_download_url: 'https://github.com/n', size: null },
            { name: 'b.txt', browser_download_url: 'https://github.com/b' },
          ],
        },
      });

      const result = await source.fetchLatestRelease();

      expect(result).toEqual({
        ok: true,
        value: {
          tagName: 'build-9',
          assets: [
            { name: 'a.apk', downloadUrl: 'https://github.com/a.apk', sizeBytes: 12 },
            { name: 'notes.txt', downloadUrl: 'https://github.com/n', sizeBytes: null },
            { name: 'b.txt', downloadUrl: 'https://github.com/b', sizeBytes: null },
          ],
        },
      });
    });

    it.each([
      ['null', null],
      ['an array', []],
      ['a string', 'release'],
      ['no tag', { assets: [] }],
      ['a numeric tag', { tag_name: 42, assets: [] }],
      ['no assets', { tag_name: 'build-1' }],
      ['assets that are not an array', { tag_name: 'build-1', assets: {} }],
      ['an asset that is not an object', { tag_name: 'build-1', assets: ['a.apk'] }],
      [
        'an asset without a name',
        { tag_name: 'build-1', assets: [{ browser_download_url: 'https://github.com/a' }] },
      ],
      ['an asset without a URL', { tag_name: 'build-1', assets: [{ name: 'a.apk', size: 1 }] }],
      [
        'a size that is not a number',
        {
          tag_name: 'build-1',
          assets: [{ name: 'a.apk', browser_download_url: 'https://github.com/a', size: '12' }],
        },
      ],
    ])('rejects a body with %s as updates.malformedResponse', async (_case, body) => {
      const { source, http } = createSource();
      http.answerWith({ kind: 'respond', status: 200, body });

      const result = await source.fetchLatestRelease();

      expect(result).toMatchObject({ ok: false, error: { code: 'updates.malformedResponse' } });
    });
  });

  describe('HTTP failures', () => {
    it.each([
      [404, 'updates.noPublishedRelease'],
      [403, 'updates.rateLimited'],
      [429, 'updates.rateLimited'],
      [500, 'updates.httpError'],
      [503, 'updates.httpError'],
      [401, 'updates.httpError'],
      [304, 'updates.httpError'],
    ])('maps HTTP %d to %s with the status in the details', async (status, code) => {
      const { source, http } = createSource();
      http.answerWith({ kind: 'respond', status, body: {} });

      const result = await source.fetchLatestRelease();

      expect(result).toMatchObject({ ok: false, error: { code, details: { status } } });
    });

    it('maps a rejected request to updates.networkUnavailable with its cause', async () => {
      const { source, http } = createSource();
      http.answerWith({ kind: 'reject', cause: new TypeError('Network request failed') });

      const result = await source.fetchLatestRelease();

      expect(result).toMatchObject({
        ok: false,
        error: { code: 'updates.networkUnavailable', details: { cause: 'Network request failed' } },
      });
    });
  });

  describe('timeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('abandons a request that gets no answer within the timeout', async () => {
      const { source, http } = createSource();
      http.answerWith({ kind: 'hang' });

      const pending = source.fetchLatestRelease();
      jest.advanceTimersByTime(RELEASE_CHECK_TIMEOUT_MS);
      const result = await pending;

      expect(http.calls[0]?.options.signal.aborted).toBe(true);
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'updates.timeout', details: { timeoutMs: RELEASE_CHECK_TIMEOUT_MS } },
      });
    });

    it('abandons a body that does not arrive within the timeout', async () => {
      const http = new StubHttp();
      const slowBody: HttpGet = (url, options) =>
        http.get(url, options).then((response) => ({
          ...response,
          json: () => untilAborted(options.signal),
        }));
      const slowSource = new GitHubReleaseSource({
        repository: GITHUB_RELEASE_REPOSITORY,
        timeoutMs: RELEASE_CHECK_TIMEOUT_MS,
        fetch: slowBody,
      });

      const pending = slowSource.fetchLatestRelease();
      await jest.advanceTimersByTimeAsync(RELEASE_CHECK_TIMEOUT_MS);

      expect(await pending).toMatchObject({ ok: false, error: { code: 'updates.timeout' } });
    });

    it('does not abort or leave a timer behind after a timely answer', async () => {
      const { source, http } = createSource();
      http.answerWith({ kind: 'respond', status: 200, body: gitHubJson() });

      const result = await source.fetchLatestRelease();

      expect(result.ok).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
      expect(http.calls[0]?.options.signal.aborted).toBe(false);
    });
  });
});
