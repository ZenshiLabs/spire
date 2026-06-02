import { create } from "zustand";
import { produce } from "immer";
import type { SessionResponse, SessionStatus } from "@spire/types";

interface SessionState {
    sessionId: string | null;
    session: SessionResponse | null;
    status: SessionStatus | "idle";
    viewerCount: number;
    joinCode: string | null;
    // actions
    setSession: (session: SessionResponse) => void;
    setStatus: (status: SessionStatus | "idle") => void;
    setViewerCount: (count: number) => void;
    clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
    sessionId: null,
    session: null,
    status: "idle",
    viewerCount: 0,
    joinCode: null,

    setSession: (session) =>
        set(produce((state: SessionState) => {
            state.sessionId = session.id;
            state.session = session;
            state.status = session.status;
            state.viewerCount = session.viewerCount;
            state.joinCode = session.joinCode;
        })),

    setStatus: (status) =>
        set(produce((state: SessionState) => {
            state.status = status;
            if (state.session) state.session.status = status as SessionStatus;
        })),

    setViewerCount: (count) =>
        set(produce((state: SessionState) => {
            state.viewerCount = count;
            if (state.session) state.session.viewerCount = count;
        })),

    clearSession: () =>
        set(produce((state: SessionState) => {
            state.sessionId = null;
            state.session = null;
            state.status = "idle";
            state.viewerCount = 0;
            state.joinCode = null;
        })),
}));
