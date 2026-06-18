export type ChangeKind = "added" | "modified" | "deleted";

type FlushFn = (changes: Map<string, ChangeKind>) => Promise<void>;

type BatcherOptions = {
    /** Flush after this much idle time with no further changes. */
    idleMs: number;
    /** Hard cap: flush at least this often during a sustained burst. */
    maxWaitMs: number;
    onFlush: FlushFn;
};

/**
 * Merges two successive events for the same path into a single effective
 * change kind, or returns null when the events cancel out (e.g. a file that
 * is added then immediately deleted within the same batch window).
 */
function mergeKind(
    prev: ChangeKind | undefined,
    next: ChangeKind
): ChangeKind | null {
    if (!prev) {
        return next;
    }
    if (next === "deleted") {
        return prev === "added" ? null : "deleted";
    }
    if (next === "added") {
        return prev === "deleted" ? "modified" : prev;
    }
    return prev === "added" ? "added" : "modified";
}

/**
 * Coalesces a burst of file-change events into a single checkpoint upload.
 * Flushes after `idleMs` of inactivity (saves have stopped) or after
 * `maxWaitMs` regardless (sustained edit burst). Merges repeated events for
 * the same path so the checkpoint contains at most one entry per file.
 * Serializes concurrent flushes so checkpoint uploads never overlap or reorder.
 */
export class CheckpointBatcher {
    private pending = new Map<string, ChangeKind>();
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private maxTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Chains flush promises so that a new flush always waits for the previous
     * one to complete. This prevents concurrent uploads and ensures the server
     * receives checkpoints in the order they were batched.
     */
    private flushing: Promise<void> = Promise.resolve();

    constructor(private readonly options: BatcherOptions) {}

    add(absolutePath: string, kind: ChangeKind) {
        const merged = mergeKind(this.pending.get(absolutePath), kind);
        if (merged === null) {
            this.pending.delete(absolutePath);
        } else {
            this.pending.set(absolutePath, merged);
        }

        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        this.idleTimer = setTimeout(() => void this.flush(), this.options.idleMs);

        if (!this.maxTimer) {
            this.maxTimer = setTimeout(
                () => void this.flush(),
                this.options.maxWaitMs
            );
        }
    }

    private clearTimers() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        if (this.maxTimer) {
            clearTimeout(this.maxTimer);
            this.maxTimer = null;
        }
    }

    private async flush(): Promise<void> {
        this.clearTimers();
        if (this.pending.size === 0) {
            return;
        }
        const batch = this.pending;
        this.pending = new Map();
        this.flushing = this.flushing
            .then(() => this.options.onFlush(batch))
            .catch(() => {
                /**
                 * onFlush is responsible for logging its own errors. Swallowing the
                 * rejection here keeps the serialization chain intact so subsequent
                 * flushes are not blocked by a failed upload.
                 */
            });
        await this.flushing;
    }

    /**
     * Immediately flushes any pending changes and waits for all in-flight uploads
     * to settle. Called during graceful shutdown to ensure the final save burst
     * is captured before the session is closed.
     */
    async flushNow(): Promise<void> {
        await this.flush();
        await this.flushing;
    }

    stop() {
        this.clearTimers();
        this.pending.clear();
    }
}
