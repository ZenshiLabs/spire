import { create } from "zustand";
import { produce } from "immer";

interface EditorState {
    activeFilePath: string | null;
    openFiles: string[];
    fileContents: Record<string, string>; // path → content
    // actions
    openFile: (path: string, content: string) => void;
    closeFile: (path: string) => void;
    setFileContent: (path: string, content: string) => void;
    applyDelta: (path: string, newContent: string) => void;
    setActiveFile: (path: string | null) => void;
    clearAll: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
    activeFilePath: null,
    openFiles: [],
    fileContents: {},

    openFile: (path, content) =>
        set(produce((state: EditorState) => {
            if (!state.openFiles.includes(path)) {
                state.openFiles.push(path);
            }
            state.fileContents[path] = content;
            state.activeFilePath = path;
        })),

    closeFile: (path) =>
        set(produce((state: EditorState) => {
            state.openFiles = state.openFiles.filter((p) => p !== path);
            delete state.fileContents[path];
            if (state.activeFilePath === path) {
                state.activeFilePath = state.openFiles[state.openFiles.length - 1] ?? null;
            }
        })),

    setFileContent: (path, content) =>
        set(produce((state: EditorState) => {
            state.fileContents[path] = content;
        })),

    applyDelta: (path, newContent) =>
        set(produce((state: EditorState) => {
            state.fileContents[path] = newContent;
            if (!state.openFiles.includes(path)) {
                state.openFiles.push(path);
            }
        })),

    setActiveFile: (path) =>
        set(produce((state: EditorState) => {
            state.activeFilePath = path;
        })),

    clearAll: () =>
        set(produce((state: EditorState) => {
            state.activeFilePath = null;
            state.openFiles = [];
            state.fileContents = {};
        })),
}));
