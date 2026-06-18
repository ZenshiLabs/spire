"use client";

import { useEffect, useState } from "react";
import type { ChangeType, CheckpointChange, SSEEvent } from "@spire/types";
import { useEditorStore } from "@spire/stores/editor-store";
import { useFileTreeStore } from "@spire/stores/file-tree-store";
import { useHistoryStore } from "@spire/stores/history-store";
import { useSessionStore } from "@spire/stores/session-store";

import { contentCache } from "./content-cache";
import { firstFilePath } from "./reconstruct";
import { fetchSessionState, type SessionState } from "./session-api";

export type StreamStatus = "connecting" | "live" | "ended" | "error";

type StreamResult = {
    status: StreamStatus;
    error: string | null;
};

function decorationsFromChanges(
    changes: CheckpointChange[]
): Map<string, ChangeType> {
    const map = new Map<string, ChangeType>();
    for (const change of changes) {
        map.set(change.path, change.changeType);
    }
    return map;
}

export type EventStores = {
    history: Pick<ReturnType<typeof useHistoryStore.getState>, "addLive" | "selectedSeq">;
    tree: Pick<ReturnType<typeof useFileTreeStore.getState>, "applyChanges" | "setDecorations" | "setTree">;
    session: Pick<ReturnType<typeof useSessionStore.getState>, "setStatus">;
};

/**
 * Applies a single SSE event to the provided stores. Pure function — no React
 * hooks, no I/O. `onSessionEnded` is a callback so the hook can close the
 * EventSource and update React state without coupling this function to either.
 *
 * Extracting this makes the store-mutation logic testable by passing mock
 * stores directly, without mounting a component or mocking EventSource.
 */
export function applySSEEvent(
    event: SSEEvent,
    stores: EventStores,
    onSessionEnded: () => void
): void {
    if (event.type === "checkpoint") {
        const checkpoint = event.payload;
        stores.history.addLive(checkpoint);
        stores.tree.applyChanges(checkpoint.changes);
        if (stores.history.selectedSeq === null) {
            stores.tree.setDecorations(decorationsFromChanges(checkpoint.changes));
        }
        return;
    }

    if (event.type === "snapshot") {
        stores.tree.setTree(event.payload.tree);
        return;
    }

    if (event.type === "session_ended") {
        stores.session.setStatus("ended");
        onSessionEnded();
    }
}

export type HydrateStores = {
    session: Pick<ReturnType<typeof useSessionStore.getState>, "setSession" | "setLoadMode">;
    history: Pick<ReturnType<typeof useHistoryStore.getState>, "setInitial">;
    tree: Pick<ReturnType<typeof useFileTreeStore.getState>, "setTree" | "setSelectedPath" | "expandAncestors">;
    editor: Pick<ReturnType<typeof useEditorStore.getState>, "openFile">;
};

/**
 * Populates all session stores from the initial `/state` payload. Pure
 * function — no React hooks, no network calls. Returns the first file path
 * so the caller can decide whether to open it.
 *
 * Testable by passing mock stores and a SessionState fixture without mounting
 * a component or stubbing fetch.
 */
export function hydrateStoresFromState(
    state: SessionState,
    stores: HydrateStores,
    cache: Pick<typeof contentCache, "prefill">
): { firstFile: string | undefined } {
    stores.session.setSession(state.session);
    stores.session.setLoadMode(state.mode);
    stores.history.setInitial(state.checkpoints);

    if (state.contents) {
        cache.prefill(state.contents);
    }

    let firstFile: string | undefined;
    if (state.snapshot) {
        stores.tree.setTree(state.snapshot.tree);
        firstFile = firstFilePath(state.snapshot.tree);
        if (firstFile) {
            stores.tree.setSelectedPath(firstFile);
            stores.tree.expandAncestors(firstFile);
        }
    }

    return { firstFile };
}

/**
 * Hydrates all session stores from the `/state` endpoint on mount, then
 * subscribes to the live SSE stream for checkpoint, snapshot, and session-ended
 * events. All session data lives in the shared Zustand stores and the content-
 * addressed cache — this hook only surfaces the current connection status and
 * any error message to its caller.
 */
export function useSessionStream(sessionId: string): StreamResult {
    const [status, setStatus] = useState<StreamStatus>("connecting");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const sessionStore = useSessionStore.getState();
        const treeStore = useFileTreeStore.getState();
        const historyStore = useHistoryStore.getState();
        const editorStore = useEditorStore.getState();

        let eventSource: EventSource | null = null;
        const abortController = new AbortController();
        let cancelled = false;

        const handleEvent = (event: SSEEvent) => {
            applySSEEvent(
                event,
                {
                    history: useHistoryStore.getState(),
                    tree: useFileTreeStore.getState(),
                    session: useSessionStore.getState(),
                },
                () => {
                    setStatus("ended");
                    eventSource?.close();
                }
            );
        };

        const connect = () => {
            eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);

            const forward = (raw: MessageEvent<string>) => {
                try {
                    handleEvent(JSON.parse(raw.data) as SSEEvent);
                } catch {
                    /**
                     * Malformed or non-JSON frames (such as SSE keepalive comments) are
                     * silently discarded — they do not represent application events.
                     */
                }
            };

            eventSource.addEventListener("checkpoint", forward);
            eventSource.addEventListener("snapshot", forward);
            eventSource.addEventListener("session_ended", forward);
            eventSource.addEventListener("connected", () => setStatus("live"));
            eventSource.onopen = () => setStatus("live");
            eventSource.onerror = () => {
                setStatus((current) => (current === "ended" ? current : "error"));
            };
        };

        const hydrate = async () => {
            try {
                const state = await fetchSessionState(sessionId, abortController.signal);
                if (cancelled) {
                    return;
                }

                const { firstFile } = hydrateStoresFromState(
                    state,
                    { session: sessionStore, history: historyStore, tree: treeStore, editor: editorStore },
                    contentCache
                );
                if (firstFile) {
                    editorStore.openFile(firstFile);
                }

                if (state.session.status !== "active") {
                    setStatus("ended");
                    return;
                }

                connect();
            } catch (caught) {
                if (cancelled || abortController.signal.aborted) {
                    return;
                }
                setError(
                    caught instanceof Error ? caught.message : "Failed to load session."
                );
                setStatus("error");
            }
        };

        void hydrate();

        return () => {
            cancelled = true;
            abortController.abort();
            eventSource?.close();
            useEditorStore.getState().clearAll();
            useFileTreeStore.getState().clearTree();
            useHistoryStore.getState().clear();
            useSessionStore.getState().clearSession();
            contentCache.clear();
        };
    }, [sessionId]);

    return { status, error };
}
