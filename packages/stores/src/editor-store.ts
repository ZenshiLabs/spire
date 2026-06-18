import { create } from "zustand";

/**
 * Manages open editor tabs and the currently active file path. File content is
 * intentionally absent from this store — it lives in the web app's content-
 * addressed LRU cache so memory stays bounded regardless of how many files are
 * opened or how long a session runs.
 */
interface EditorState {
    tabs: string[];
    activeFilePath: string | null;
    openFile: (path: string) => void;
    closeFile: (path: string) => void;
    setActiveFile: (path: string) => void;
    clearAll: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
    tabs: [],
    activeFilePath: null,

    openFile: (path) =>
        set((state) => ({
            tabs: state.tabs.includes(path) ? state.tabs : [...state.tabs, path],
            activeFilePath: path,
        })),

    closeFile: (path) =>
        set((state) => {
            const tabs = state.tabs.filter((p) => p !== path);
            const activeFilePath =
                state.activeFilePath === path
                    ? tabs[tabs.length - 1] ?? null
                    : state.activeFilePath;
            return { tabs, activeFilePath };
        }),

    setActiveFile: (path) => set({ activeFilePath: path }),

    clearAll: () => set({ tabs: [], activeFilePath: null }),
}));
