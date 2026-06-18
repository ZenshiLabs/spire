import { create } from "zustand";
import { produce } from "immer";
import type { SessionResponse, SessionStatus } from "@spire/types";

export type LoadMode = "eager" | "lazy";

interface SessionState {
    sessionId: string | null;
    session: SessionResponse | null;
    status: SessionStatus | "idle";
    /**
     * Determines how the viewer loads file content. In "eager" mode all current
     * file content is shipped in the initial `/state` payload (instant opens). In
     * "lazy" mode content is fetched per-file on demand. The server chooses the
     * mode based on session size at load time.
     */
    loadMode: LoadMode;
    setSession: (session: SessionResponse) => void;
    setStatus: (status: SessionStatus | "idle") => void;
    setLoadMode: (mode: LoadMode) => void;
    clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
    sessionId: null,
    session: null,
    status: "idle",
    loadMode: "eager",

    setSession: (session) =>
        set(
            produce((state: SessionState) => {
                state.sessionId = session.id;
                state.session = session;
                state.status = session.status;
            })
        ),

    setStatus: (status) =>
        set(
            produce((state: SessionState) => {
                state.status = status;
                if (state.session && status !== "idle") {
                    state.session.status = status;
                }
            })
        ),

    setLoadMode: (mode) =>
        set(
            produce((state: SessionState) => {
                state.loadMode = mode;
            })
        ),

    clearSession: () =>
        set(
            produce((state: SessionState) => {
                state.sessionId = null;
                state.session = null;
                state.status = "idle";
                state.loadMode = "eager";
            })
        ),
}));
