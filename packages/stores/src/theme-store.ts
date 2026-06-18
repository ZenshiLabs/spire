import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Persists the user's Monaco/Shiki editor theme selection across page loads and
 * sessions. `"auto"` follows the application's resolved light/dark mode; any
 * other value is a concrete Shiki theme ID such as `"vitesse-dark"`. Stored in
 * localStorage under the key `"spire-editor-theme"`.
 */
interface ThemeState {
    editorTheme: string;
    setEditorTheme: (theme: string) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            editorTheme: "auto",
            setEditorTheme: (theme) => set({ editorTheme: theme }),
        }),
        { name: "spire-editor-theme" }
    )
);
