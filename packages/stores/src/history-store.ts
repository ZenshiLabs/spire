import { create } from "zustand";
import type { Checkpoint, CheckpointSummary } from "@spire/types";

interface HistoryState {
    /**
     * Checkpoint summaries ordered newest-first for the timeline list.
     * Summaries omit the per-file change list to keep memory usage low;
     * the full checkpoint is fetched and cached in `bySeq` on demand.
     */
    checkpoints: CheckpointSummary[];
    /**
     * Cache of full checkpoints (with per-file changes), keyed by seq.
     * Populated lazily when the user opens a checkpoint in the timeline.
     */
    bySeq: Map<number, Checkpoint>;
    /**
     * The checkpoint seq currently being viewed in the timeline, or null when
     * following the live head. Null also clears the change decorations on the
     * file tree.
     */
    selectedSeq: number | null;
    /**
     * Count of new checkpoints that arrived via SSE while the user was browsing
     * a historical checkpoint. Shown as a "jump to latest" prompt.
     */
    newWhileBrowsing: number;

    setInitial: (checkpoints: CheckpointSummary[]) => void;
    addLive: (checkpoint: Checkpoint) => void;
    cacheCheckpoint: (checkpoint: Checkpoint) => void;
    selectSeq: (seq: number | null) => void;
    clear: () => void;
}

function toSummary(checkpoint: Checkpoint): CheckpointSummary {
    const { changes: _changes, ...summary } = checkpoint;
    void _changes;
    return summary;
}

export const useHistoryStore = create<HistoryState>((set) => ({
    checkpoints: [],
    bySeq: new Map(),
    selectedSeq: null,
    newWhileBrowsing: 0,

    setInitial: (checkpoints) =>
        set({
            checkpoints: [...checkpoints].sort((a, b) => b.seq - a.seq),
            bySeq: new Map(),
            selectedSeq: null,
            newWhileBrowsing: 0,
        }),

    addLive: (checkpoint) =>
        set((state) => {
            if (state.bySeq.has(checkpoint.seq)) {
                return state;
            }
            const bySeq = new Map(state.bySeq);
            bySeq.set(checkpoint.seq, checkpoint);
            return {
                checkpoints: [toSummary(checkpoint), ...state.checkpoints],
                bySeq,
                newWhileBrowsing:
                    state.selectedSeq === null
                        ? state.newWhileBrowsing
                        : state.newWhileBrowsing + 1,
            };
        }),

    cacheCheckpoint: (checkpoint) =>
        set((state) => {
            const bySeq = new Map(state.bySeq);
            bySeq.set(checkpoint.seq, checkpoint);
            return { bySeq };
        }),

    selectSeq: (seq) =>
        set((state) => ({
            selectedSeq: seq,
            newWhileBrowsing: seq === null ? 0 : state.newWhileBrowsing,
        })),

    clear: () =>
        set({
            checkpoints: [],
            bySeq: new Map(),
            selectedSeq: null,
            newWhileBrowsing: 0,
        }),
}));
