import type { ExerciseLibraryError } from '@modules/exercises/application/library-errors';
import type {
  OfflineImages,
  OfflineImagesEstimate,
  OfflineImagesState,
} from '@modules/exercises/application/offline-images';
import { err, ok, type Result } from '@shared/domain/result';

interface ArrangedImages {
  readonly cached: number;
  readonly missing: number;
  readonly failing?: number;
  readonly sizeBytes: number;
}

const IDLE: OfflineImagesState = Object.freeze({ status: 'idle' });

/**
 * Fake `OfflineImages` (S1-28): a tiny simulation of the bulk download over an arranged number of
 * images, with no network or files. Downloads complete one per microtask unless held, so the
 * same contract suite as the real service passes. Screen tests can also force any state with
 * `showState` and count `start`/`cancel` calls.
 */
export class FakeOfflineImages implements OfflineImages {
  private state: OfflineImagesState = IDLE;
  private readonly listeners = new Set<(state: OfflineImagesState) => void>();
  private cached = 0;
  /** One entry per missing image: `true` if its download fails. */
  private missing: readonly boolean[] = [];
  private sizeBytes = 0;
  private estimateFailure: ExerciseLibraryError | null = null;
  private held: { readonly released: Promise<void>; readonly release: () => void } | null = null;
  private runId = 0;
  private starts = 0;
  private cancels = 0;

  get startCalls(): number {
    return this.starts;
  }

  get cancelCalls(): number {
    return this.cancels;
  }

  givenImages({ cached, missing, failing = 0, sizeBytes }: ArrangedImages): void {
    this.cached = cached;
    this.missing = Array.from({ length: missing }, (_unused, index) => index < failing);
    this.sizeBytes = sizeBytes;
  }

  failEstimateWith(error: ExerciseLibraryError): void {
    this.estimateFailure = error;
  }

  holdDownloads(): void {
    let release = (): void => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.held = { released, release };
  }

  releaseDownloads(): void {
    this.held?.release();
    this.held = null;
  }

  /** Forces a state, e.g. "running 250 of 1 512", for screen tests. */
  showState(state: OfflineImagesState): void {
    this.setState(state);
  }

  estimate(): Promise<Result<OfflineImagesEstimate, ExerciseLibraryError>> {
    if (this.estimateFailure !== null) return Promise.resolve(err(this.estimateFailure));
    return Promise.resolve(
      ok({
        missingCount: this.missing.length,
        missingBytes: this.missing.length * this.sizeBytes,
        totalCount: this.cached + this.missing.length,
      }),
    );
  }

  start(): void {
    this.starts += 1;
    if (this.state.status === 'preparing' || this.state.status === 'running') return;
    this.runId += 1;
    this.setState({ status: 'preparing' });
    void this.run(this.runId);
  }

  cancel(): void {
    this.cancels += 1;
    if (this.state.status === 'running') {
      this.setState({
        status: 'cancelled',
        succeeded: this.state.completed,
        remaining: this.state.total - this.state.completed,
      });
    }
  }

  getState(): OfflineImagesState {
    return this.state;
  }

  subscribe(listener: (state: OfflineImagesState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async run(runId: number): Promise<void> {
    await Promise.resolve();
    const queue = this.missing;
    const failedSoFar: boolean[] = [];
    let completed = 0;
    this.setState({ status: 'running', completed, failed: 0, total: queue.length });
    for (const [position, fails] of queue.entries()) {
      await (this.held?.released ?? Promise.resolve());
      if (runId !== this.runId || this.state.status !== 'running') return;
      if (fails) failedSoFar.push(true);
      else completed += 1;
      // Each finished image is cached at once, so a later cancel keeps it.
      this.cached = this.cached + (fails ? 0 : 1);
      this.missing = [...failedSoFar, ...queue.slice(position + 1)];
      this.setState({
        status: 'running',
        completed,
        failed: failedSoFar.length,
        total: queue.length,
      });
    }
    this.setState({
      status: 'finished',
      succeeded: completed,
      failed: failedSoFar.length,
      stoppedEarly: false,
    });
  }

  private setState(next: OfflineImagesState): void {
    if (JSON.stringify(next) === JSON.stringify(this.state)) return;
    this.state = Object.freeze(next);
    this.listeners.forEach((listener) => listener(this.state));
  }
}
