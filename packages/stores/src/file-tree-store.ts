import { create } from "zustand";
import { produce } from "immer";
import type { FileNode } from "@spire/types";

interface FileTreeState {
    root: FileNode | null;
    expandedPaths: Set<string>;
    selectedPath: string | null;
    // actions
    setTree: (root: FileNode) => void;
    clearTree: () => void;
    toggleExpanded: (path: string) => void;
    setExpanded: (path: string, expanded: boolean) => void;
    setSelectedPath: (path: string | null) => void;
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
    root: null,
    expandedPaths: new Set(),
    selectedPath: null,

    setTree: (root) =>
        set(produce((state: FileTreeState) => {
            state.root = root;
        })),

    clearTree: () =>
        set(produce((state: FileTreeState) => {
            state.root = null;
            state.expandedPaths = new Set();
            state.selectedPath = null;
        })),

    toggleExpanded: (path) =>
        set(produce((state: FileTreeState) => {
            if (state.expandedPaths.has(path)) {
                state.expandedPaths.delete(path);
            } else {
                state.expandedPaths.add(path);
            }
        })),

    setExpanded: (path, expanded) =>
        set(produce((state: FileTreeState) => {
            if (expanded) {
                state.expandedPaths.add(path);
            } else {
                state.expandedPaths.delete(path);
            }
        })),

    setSelectedPath: (path) =>
        set(produce((state: FileTreeState) => {
            state.selectedPath = path;
        })),
}));
