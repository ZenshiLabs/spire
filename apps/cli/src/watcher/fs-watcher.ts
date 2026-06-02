import { watch, type FSWatcher } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

type ChangeHandler = (absolutePath: string) => Promise<void>;

type WatcherOptions = {
    rootDir: string;
    debounceMs?: number;
    onError?: (error: unknown) => void;
};

export class FsWatcher {
    private watcher: FSWatcher | null = null;
    private readonly timers = new Map<string, NodeJS.Timeout>();

    constructor(
        private readonly options: WatcherOptions,
        private readonly onChange: ChangeHandler
    ) { }

    start() {
        if (this.watcher) {
            return;
        }

        const debounceMs = this.options.debounceMs ?? 300;

        this.watcher = watch(this.options.rootDir, { recursive: true }, (eventType, filename) => {
            if (!filename) {
                return;
            }

            const name = filename.toString();
            const absolutePath = path.join(this.options.rootDir, name);
            const key = `${eventType}:${absolutePath}`;
            const existingTimer = this.timers.get(key);

            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(async () => {
                try {
                    const fileStat = await stat(absolutePath);
                    if (!fileStat.isFile()) {
                        return;
                    }
                } catch {
                    // File deleted or unavailable; let the consumer decide if this matters.
                }

                try {
                    await this.onChange(absolutePath);
                } catch (error: unknown) {
                    this.options.onError?.(error);
                } finally {
                    this.timers.delete(key);
                }
            }, debounceMs);

            this.timers.set(key, timer);
        });
    }

    stop() {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();

        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
}
