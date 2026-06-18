"use client";

import { useEffect, useState } from "react";

import { contentCache } from "./content-cache";
import { fetchFileContent } from "./session-api";

const HASH_RE = /^[0-9a-f]{64}$/i;

export type FileContentState = {
    content: string | null;
    binary: boolean;
    loading: boolean;
    error: string | null;
};

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Failed to load file.";
}

/**
 * Resolves a file's text content for a given version reference. `ref` may be a
 * 64-hex SHA-256 blob hash, the literal string "latest", or a checkpoint sequence
 * number. Content-addressed refs (hashes) hit the shared LRU cache synchronously
 * on a cache hit; cache misses trigger a single fetch that populates the cache for
 * all subsequent renders. Binary files short-circuit immediately without a fetch.
 */
export function useFileContent(
    sessionId: string,
    path: string | null,
    ref: string | null,
    options: { binary?: boolean } = {}
): FileContentState {
    const binaryHint = Boolean(options.binary);
    const cached =
        ref && HASH_RE.test(ref) ? contentCache.get(ref) : undefined;

    const [state, setState] = useState<FileContentState>(() => {
        if (!path || !ref) {
            return { content: null, binary: false, loading: false, error: null };
        }
        if (binaryHint) {
            return { content: "", binary: true, loading: false, error: null };
        }
        if (cached !== undefined) {
            return { content: cached, binary: false, loading: false, error: null };
        }
        return { content: null, binary: false, loading: true, error: null };
    });

    useEffect(() => {
        if (!path || !ref) {
            setState({ content: null, binary: false, loading: false, error: null });
            return;
        }
        if (binaryHint) {
            setState({ content: "", binary: true, loading: false, error: null });
            return;
        }
        const hit = HASH_RE.test(ref) ? contentCache.get(ref) : undefined;
        if (hit !== undefined) {
            setState({ content: hit, binary: false, loading: false, error: null });
            return;
        }

        let cancelled = false;
        const controller = new AbortController();
        setState((prev) => ({ ...prev, loading: true, error: null }));

        fetchFileContent(sessionId, path, ref, controller.signal)
            .then((result) => {
                if (cancelled) {
                    return;
                }
                contentCache.set(result.hash, result.content);
                setState({
                    content: result.content,
                    binary: result.binary,
                    loading: false,
                    error: null,
                });
            })
            .catch((error: unknown) => {
                if (cancelled || controller.signal.aborted) {
                    return;
                }
                setState({
                    content: null,
                    binary: false,
                    loading: false,
                    error: errorMessage(error),
                });
            });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [sessionId, path, ref, binaryHint]);

    return state;
}

/**
 * Warms the content cache for a (path, ref) pair without triggering a render.
 * Called on file-row hover so that clicking a file opens it with zero loading
 * delay in most cases. Silently no-ops if the ref is already cached or if the
 * fetch fails — prefetch is best-effort.
 */
export function prefetchFileContent(
    sessionId: string,
    path: string,
    ref: string
): void {
    if (HASH_RE.test(ref) && contentCache.has(ref)) {
        return;
    }
    void fetchFileContent(sessionId, path, ref)
        .then((result) => contentCache.set(result.hash, result.content))
        .catch(() => {
            /**
             * Prefetch failures are intentionally swallowed. The content will be
             * fetched on demand when the user actually opens the file.
             */
        });
}
