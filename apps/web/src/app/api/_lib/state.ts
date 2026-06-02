import {
    type CreateSessionInput,
    type DeltaPayload,
    type DeviceCodeResponse,
    type FileSnapshot,
    type SSEEvent,
    type SessionResponse,
    type TokenResponse,
} from "@spire/types";
import { randomBytes, randomUUID } from "node:crypto";

type DeviceAuthRecord = {
    clientId: string;
    scope: string;
    deviceCode: string;
    userCode: string;
    expiresAt: number;
    interval: number;
    approved: boolean;
    accessToken: string;
};

type AccessTokenRecord = {
    token: string;
    instructorId: string;
    expiresAt: number;
};

type AuthResult =
    | { ok: true; token: AccessTokenRecord }
    | { ok: false; code: "unauthorized" | "expired_token" };

type EndSessionResult =
    | { ok: true; session: SessionResponse }
    | { ok: false; code: "not_found" | "forbidden" | "already_ended" };

type DeltaResult =
    | { ok: true }
    | { ok: false; code: "not_found" | "forbidden" | "inactive_session" };

type SnapshotResult =
    | { ok: true }
    | { ok: false; code: "not_found" | "forbidden" | "inactive_session" };

const deviceAuthStore = new Map<string, DeviceAuthRecord>();
const tokenStore = new Map<string, AccessTokenRecord>();
const sessionStore = new Map<string, SessionResponse>();
const deltaStore = new Map<string, DeltaPayload[]>();
const snapshotStore = new Map<string, FileSnapshot>();
const sessionSubscribers = new Map<string, Set<(event: SSEEvent) => void>>();

function nowMs() {
    return Date.now();
}

function nowIso() {
    return new Date().toISOString();
}

function makeUserCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let value = "";

    for (let index = 0; index < 8; index += 1) {
        const random = randomBytes(1)[0] ?? 0;
        value += alphabet[random % alphabet.length];
    }

    return `${value.slice(0, 4)}-${value.slice(4)}`;
}

function makeJoinCode() {
    return randomBytes(4).toString("hex").toUpperCase();
}

function emitSessionEvent(sessionId: string, event: SSEEvent) {
    const listeners = sessionSubscribers.get(sessionId);
    if (!listeners || listeners.size === 0) {
        return;
    }

    for (const listener of listeners) {
        listener(event);
    }
}

export function issueDeviceCode(input: { clientId: string; scope: string }): DeviceCodeResponse {
    const expiresIn = 600;
    const interval = 2;
    const tokenExpiresIn = 60 * 60;

    const deviceCode = randomUUID();
    const userCode = makeUserCode();
    const instructorId = randomUUID();
    const accessToken = randomUUID();

    const tokenRecord: AccessTokenRecord = {
        token: accessToken,
        instructorId,
        expiresAt: nowMs() + tokenExpiresIn * 1000,
    };

    const deviceRecord: DeviceAuthRecord = {
        clientId: input.clientId,
        scope: input.scope,
        deviceCode,
        userCode,
        expiresAt: nowMs() + expiresIn * 1000,
        interval,
        approved: true,
        accessToken,
    };

    tokenStore.set(accessToken, tokenRecord);
    deviceAuthStore.set(deviceCode, deviceRecord);

    return {
        deviceCode,
        userCode,
        verificationUri: "https://spire.dev/device",
        expiresIn,
        interval,
    };
}

export function exchangeDeviceCode(deviceCode: string) {
    const record = deviceAuthStore.get(deviceCode);

    if (!record) {
        return { ok: false as const, code: "invalid_device_code" as const };
    }

    if (record.expiresAt <= nowMs()) {
        deviceAuthStore.delete(deviceCode);
        return { ok: false as const, code: "expired_token" as const };
    }

    if (!record.approved) {
        return { ok: false as const, code: "authorization_pending" as const };
    }

    const token = tokenStore.get(record.accessToken);
    if (!token || token.expiresAt <= nowMs()) {
        return { ok: false as const, code: "expired_token" as const };
    }

    const response: TokenResponse = {
        accessToken: token.token,
        tokenType: "Bearer",
        expiresIn: Math.max(1, Math.floor((token.expiresAt - nowMs()) / 1000)),
    };

    return { ok: true as const, data: response };
}

export function authorize(authorizationHeader: string | null): AuthResult {
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
        return { ok: false, code: "unauthorized" };
    }

    const tokenValue = authorizationHeader.slice("Bearer ".length).trim();
    const token = tokenStore.get(tokenValue);

    if (!token) {
        return { ok: false, code: "unauthorized" };
    }

    if (token.expiresAt <= nowMs()) {
        tokenStore.delete(tokenValue);
        return { ok: false, code: "expired_token" };
    }

    return { ok: true, token };
}

export function createSession(instructorId: string, input: CreateSessionInput): SessionResponse {
    const timestamp = nowIso();

    const session: SessionResponse = {
        id: randomUUID(),
        instructorId,
        title: input.title,
        description: input.description ?? null,
        status: "active",
        maxViewers: input.maxViewers,
        viewerCount: 0,
        joinCode: makeJoinCode(),
        createdAt: timestamp,
        updatedAt: timestamp,
        endedAt: null,
    };

    sessionStore.set(session.id, session);
    return session;
}

export function getSessionById(sessionId: string) {
    return sessionStore.get(sessionId) ?? null;
}

export function listSessionsForInstructor(instructorId: string) {
    return [...sessionStore.values()]
        .filter((session) => session.instructorId === instructorId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSessionDeltas(sessionId: string) {
    return deltaStore.get(sessionId) ?? [];
}

export function getSessionSnapshot(sessionId: string) {
    return snapshotStore.get(sessionId) ?? null;
}

export function subscribeToSession(sessionId: string, listener: (event: SSEEvent) => void) {
    const existing = sessionSubscribers.get(sessionId) ?? new Set<(event: SSEEvent) => void>();
    existing.add(listener);
    sessionSubscribers.set(sessionId, existing);

    return () => {
        const listeners = sessionSubscribers.get(sessionId);
        if (!listeners) {
            return;
        }

        listeners.delete(listener);

        if (listeners.size === 0) {
            sessionSubscribers.delete(sessionId);
        }
    };
}

export function buildConnectedEvent(sessionId: string): SSEEvent {
    return {
        type: "connected",
        sessionId,
        timestamp: nowMs(),
    };
}

export function endSession(sessionId: string, instructorId: string): EndSessionResult {
    const session = sessionStore.get(sessionId);
    if (!session) {
        return { ok: false, code: "not_found" };
    }

    if (session.instructorId !== instructorId) {
        return { ok: false, code: "forbidden" };
    }

    if (session.status !== "active") {
        return { ok: false, code: "already_ended" };
    }

    const updated: SessionResponse = {
        ...session,
        status: "ended",
        endedAt: nowIso(),
        updatedAt: nowIso(),
    };

    sessionStore.set(sessionId, updated);
    emitSessionEvent(sessionId, {
        type: "session_ended",
        sessionId,
        timestamp: nowMs(),
    });

    return { ok: true, session: updated };
}

export function ingestSnapshot(instructorId: string, payload: FileSnapshot): SnapshotResult {
    const session = sessionStore.get(payload.sessionId);

    if (!session) {
        return { ok: false, code: "not_found" };
    }

    if (session.instructorId !== instructorId) {
        return { ok: false, code: "forbidden" };
    }

    if (session.status !== "active") {
        return { ok: false, code: "inactive_session" };
    }

    snapshotStore.set(payload.sessionId, payload);

    const updatedSession: SessionResponse = {
        ...session,
        updatedAt: nowIso(),
    };
    sessionStore.set(payload.sessionId, updatedSession);

    emitSessionEvent(payload.sessionId, {
        type: "snapshot",
        payload,
    });

    return { ok: true };
}

export function ingestDelta(instructorId: string, payload: DeltaPayload): DeltaResult {
    const session = sessionStore.get(payload.sessionId);

    if (!session) {
        return { ok: false, code: "not_found" };
    }

    if (session.instructorId !== instructorId) {
        return { ok: false, code: "forbidden" };
    }

    if (session.status !== "active") {
        return { ok: false, code: "inactive_session" };
    }

    const existing = deltaStore.get(payload.sessionId) ?? [];
    existing.push(payload);
    deltaStore.set(payload.sessionId, existing);

    const updatedSession: SessionResponse = {
        ...session,
        updatedAt: nowIso(),
    };
    sessionStore.set(payload.sessionId, updatedSession);
    emitSessionEvent(payload.sessionId, {
        type: "delta",
        payload,
    });

    return { ok: true };
}
