import chokidar, { type FSWatcher } from "chokidar";
import path from "node:path";

export type WatchEventKind = "added" | "modified" | "deleted";

type WatcherOptions = {
    rootDir: string;
    /** Returns true to ignore a path (and, for directories, skip recursing into it). */
    ignored: (absolutePath: string) => boolean;
    onEvent: (absolutePath: string, kind: WatchEventKind) => void;
    onError?: (error: unknown) => void;
    /**
     * Size-stability window (ms) a changed file must hold before it is reported.
     * This is the floor on detection latency, so it is kept low; raise it only on
     * filesystems that surface noisy partial-write events.
     */
    stabilityMs: number;
};

/**
 * Cross-platform recursive file watcher built on chokidar. `awaitWriteFinish`
 * coalesces rapid partial writes and prevents reading a half-written file during
 * a save. Grouping of related changes into checkpoint batches is handled
 * separately by the CheckpointBatcher, which runs above this layer.
 */
export class FileWatcher {
    private watcher: FSWatcher | null = null;

    constructor(private readonly options: WatcherOptions) {}

    start() {
        if (this.watcher) {
            return;
        }

        this.watcher = chokidar.watch(this.options.rootDir, {
            ignored: (candidate: string) =>
                this.options.ignored(path.resolve(candidate)),
            ignoreInitial: true,
            persistent: true,
            awaitWriteFinish: {
                stabilityThreshold: this.options.stabilityMs,
                pollInterval: Math.max(10, Math.floor(this.options.stabilityMs / 3)),
            },
        });

        this.watcher.on("add", (p) =>
            this.options.onEvent(path.resolve(p), "added")
        );
        this.watcher.on("change", (p) =>
            this.options.onEvent(path.resolve(p), "modified")
        );
        this.watcher.on("unlink", (p) =>
            this.options.onEvent(path.resolve(p), "deleted")
        );
        this.watcher.on("error", (error) => this.options.onError?.(error));
    }

    async stop() {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
    }
}
