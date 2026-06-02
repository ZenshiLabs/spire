// Raw DB row types — plain interfaces, no Zod (used in server/worker only)

export interface UserRow {
    id: string;
    clerkId: string;
    email: string;
    displayName: string | null;
    createdAt: number; // Unix ms
    updatedAt: number;
}

export interface SessionRow {
    id: string;
    instructorId: string;
    title: string;
    description: string | null;
    status: "pending" | "active" | "ended" | "expired";
    maxViewers: number;
    joinCode: string;
    createdAt: number;
    updatedAt: number;
    endedAt: number | null;
}

export interface FileRow {
    id: string;
    sessionId: string;
    path: string;
    hash: string;
    size: number;
    content: string; // full file content at snapshot time
    createdAt: number;
    updatedAt: number;
}

export interface DeltaRow {
    id: string;
    sessionId: string;
    filePath: string;
    unifiedDiff: string;
    hash: string;
    sequenceNum: number;
    createdAt: number;
}
