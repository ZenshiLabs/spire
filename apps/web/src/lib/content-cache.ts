/**
 * Content-addressed LRU cache of file text content, keyed by SHA-256 blob hash.
 *
 * Because every version of every file has a unique, stable hash, the same
 * content bytes are cached exactly once and shared across open tabs, diff views,
 * and history browsing. Memory stays bounded regardless of how long a viewer
 * browses because the cache evicts the least-recently-used entry whenever either
 * the entry count or total character count exceeds its ceiling.
 *
 * Intentionally kept outside React and Zustand (a plain module singleton) so
 * reads and writes are synchronous O(1) operations that never trigger renders.
 */
const MAX_ENTRIES = 120;
const MAX_CHARS = 12 * 1024 * 1024;

class ContentCache {
    private readonly map = new Map<string, string>();
    private chars = 0;

    has(hash: string): boolean {
        return this.map.has(hash);
    }

    /**
     * Returns the cached content for `hash` and promotes the entry to
     * most-recently-used. Returns undefined on a cache miss.
     */
    get(hash: string): string | undefined {
        const value = this.map.get(hash);
        if (value !== undefined) {
            this.map.delete(hash);
            this.map.set(hash, value);
        }
        return value;
    }

    set(hash: string, content: string): void {
        const existing = this.map.get(hash);
        if (existing !== undefined) {
            this.chars -= existing.length;
            this.map.delete(hash);
        }
        this.map.set(hash, content);
        this.chars += content.length;
        this.evict();
    }

    /**
     * Bulk-fills the cache from a hash → content map returned by the eager-mode
     * `/state` endpoint, avoiding per-file fetches on initial load for small sessions.
     */
    prefill(entries: Record<string, string>): void {
        for (const [hash, content] of Object.entries(entries)) {
            this.set(hash, content);
        }
    }

    private evict(): void {
        while (
            this.map.size > MAX_ENTRIES ||
            (this.chars > MAX_CHARS && this.map.size > 1)
        ) {
            const oldest = this.map.keys().next().value as string | undefined;
            if (oldest === undefined) {
                break;
            }
            this.chars -= this.map.get(oldest)?.length ?? 0;
            this.map.delete(oldest);
        }
    }

    clear(): void {
        this.map.clear();
        this.chars = 0;
    }
}

export const contentCache = new ContentCache();
