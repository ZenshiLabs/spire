"use client";

import { useEffect, useState } from "react";
import type { ChangeType, CheckpointChange, SSEEvent } from "@spire/types";
import { useEditorStore } from "@spire/stores/editor-store";
import { useFileTreeStore } from "@spire/stores/file-tree-store";
import { useHistoryStore } from "@spire/stores/history-store";
import { useSessionStore } from "@spire/stores/session-store";

import { contentCache } from "./content-cache";
import { firstFilePath } from "./reconstruct";
import { fetchSessionState } from "./session-api";

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
            if (event.type === "checkpoint") {
                const checkpoint = event.payload;
                useHistoryStore.getState().addLive(checkpoint);
                useFileTreeStore.getState().applyChanges(checkpoint.changes);
                if (useHistoryStore.getState().selectedSeq === null) {
                    useFileTreeStore
                        .getState()
                        .setDecorations(decorationsFromChanges(checkpoint.changes));
                }
                return;
            }

            if (event.type === "snapshot") {
                useFileTreeStore.getState().setTree(event.payload.tree);
                return;
            }

            if (event.type === "session_ended") {
                useSessionStore.getState().setStatus("ended");
                setStatus("ended");
                eventSource?.close();
            }
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

                sessionStore.setSession(state.session);
                sessionStore.setLoadMode(state.mode);
                historyStore.setInitial(state.checkpoints);

                if (state.contents) {
                    contentCache.prefill(state.contents);
                }

                if (state.snapshot) {
                    treeStore.setTree(state.snapshot.tree);
                    const firstFile = firstFilePath(state.snapshot.tree);
                    if (firstFile) {
                        editorStore.openFile(firstFile);
                        treeStore.setSelectedPath(firstFile);
                        treeStore.expandAncestors(firstFile);
                    }
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
