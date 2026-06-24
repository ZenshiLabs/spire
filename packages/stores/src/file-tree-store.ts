import { create } from "zustand";
import {
    baseName,
    flattenTree,
    indexTree,
    insertFile,
    removeFile,
    sortTree,
    type ChangeType,
    type CheckpointChange,
    type FileNode,
    type FlatNode,
} from "@spire/types";

/** Current content hash and binary flag for a given file path. */
export type HeadMeta = { hash: string; binary: boolean };

interface FileTreeState {
    root: FileNode | null;
    /**
     * Currently visible rows, recomputed only when the tree structure or
     * expanded-path set changes. Used by the virtualized file tree renderer.
     */
    flattened: FlatNode[];
    /**
     * Maps file path → head metadata (hash + binary flag), kept current as
     * checkpoints arrive. Drives content fetches in the editor and file tree.
     */
    headMeta: Map<string, HeadMeta>;
    /**
     * Maps file path → change kind for the checkpoint currently selected in
     * the timeline. Empty when following live head (no checkpoint selected).
     */
    decorations: Map<string, ChangeType>;
    expandedPaths: Set<string>;
    selectedPath: string | null;

    setTree: (root: FileNode) => void;
    applyChanges: (changes: CheckpointChange[]) => void;
    setDecorations: (decorations: Map<string, ChangeType>) => void;
    toggleExpanded: (path: string) => void;
    setExpanded: (path: string, expanded: boolean) => void;
    expandAncestors: (filePath: string) => void;
    setSelectedPath: (path: string | null) => void;
    clearTree: () => void;
}

function buildHeadMeta(index: Map<string, FileNode>): Map<string, HeadMeta> {
    const meta = new Map<string, HeadMeta>();
    for (const [path, node] of index) {
        if (node.type === "file") {
            meta.set(path, { hash: node.hash, binary: Boolean(node.binary) });
        }
    }
    return meta;
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
    root: null,
    flattened: [],
    headMeta: new Map(),
    decorations: new Map(),
    expandedPaths: new Set(),
    selectedPath: null,

    setTree: (incoming) =>
        set((state) => {
            const root = sortTree(incoming);
            return {
                root,
                headMeta: buildHeadMeta(indexTree(root)),
                flattened: flattenTree(root, state.expandedPaths),
            };
        }),

    applyChanges: (changes) =>
        set((state) => {
            if (!state.root) {
                return state;
            }
            let root = state.root;
            const headMeta = new Map(state.headMeta);

            for (const change of changes) {
                if (change.changeType === "deleted") {
                    root = removeFile(root, change.path);
                    headMeta.delete(change.path);
                    continue;
                }
                if (change.afterHash) {
                    headMeta.set(change.path, {
                        hash: change.afterHash,
                        binary: Boolean(change.binary),
                    });
                }
                if (change.changeType === "added" && !state.headMeta.has(change.path)) {
                    root = insertFile(root, {
                        type: "file",
                        name: baseName(change.path),
                        path: change.path,
                        size: 0,
                        hash: change.afterHash ?? "",
                        binary: change.binary,
                    });
                }
            }

            return {
                root,
                headMeta,
                flattened: flattenTree(root, state.expandedPaths),
            };
        }),

    setDecorations: (decorations) => set({ decorations }),

    toggleExpanded: (path) =>
        set((state) => {
            const expandedPaths = new Set(state.expandedPaths);
            if (expandedPaths.has(path)) {
                expandedPaths.delete(path);
            } else {
                expandedPaths.add(path);
            }
            return {
                expandedPaths,
                flattened: flattenTree(state.root, expandedPaths),
            };
        }),

    setExpanded: (path, expanded) =>
        set((state) => {
            const expandedPaths = new Set(state.expandedPaths);
            if (expanded) {
                expandedPaths.add(path);
            } else {
                expandedPaths.delete(path);
            }
            return {
                expandedPaths,
                flattened: flattenTree(state.root, expandedPaths),
            };
        }),

    expandAncestors: (filePath) =>
        set((state) => {
            const expandedPaths = new Set(state.expandedPaths);
            const segments = filePath.split("/");
            segments.pop();
            let prefix = "";
            for (const segment of segments) {
                prefix = prefix ? `${prefix}/${segment}` : segment;
                expandedPaths.add(prefix);
            }
            return {
                expandedPaths,
                flattened: flattenTree(state.root, expandedPaths),
            };
        }),

    setSelectedPath: (path) => set({ selectedPath: path }),

    clearTree: () =>
        set({
            root: null,
            flattened: [],
            headMeta: new Map(),
            decorations: new Map(),
            expandedPaths: new Set(),
            selectedPath: null,
        }),
}));
