import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { generateWorkspaceId } from "./id.js";

export type WorkspaceProject = {
    /** Absolute directory to broadcast. */
    rootDir: string;
    title?: string;
};

export type Workspace = {
    workspaceId: string;
    projects: WorkspaceProject[];
};

export const WORKSPACE_FILENAME = "spire.json";

type ParsedWorkspaceFile = {
    workspaceId?: string;
    title?: string;
    projects: { dir: string; title?: string }[];
};

function workspacePath(cwd: string): string {
    return path.join(cwd, WORKSPACE_FILENAME);
}

function invalid(message: string): never {
    throw new Error(`Invalid ${WORKSPACE_FILENAME}: ${message}`);
}

/**
 * Validates the shape of a parsed `spire.json`. Hand-written rather than using
 * Zod because the CLI does not depend on zod directly (only `@spire/types`,
 * which is bundled) and the schema is small.
 */
function validateWorkspaceFile(parsed: unknown): ParsedWorkspaceFile {
    if (typeof parsed !== "object" || parsed === null) {
        invalid("expected a JSON object.");
    }
    const obj = parsed as Record<string, unknown>;

    const projectsRaw = obj.projects;
    if (!Array.isArray(projectsRaw) || projectsRaw.length === 0) {
        invalid('"projects" must be a non-empty array.');
    }

    const projects = projectsRaw.map((entry, index) => {
        if (typeof entry !== "object" || entry === null) {
            invalid(`project ${index} must be an object.`);
        }
        const project = entry as Record<string, unknown>;
        if (typeof project.dir !== "string" || project.dir.length === 0) {
            invalid(`project ${index} must have a non-empty "dir".`);
        }
        if (project.title !== undefined && typeof project.title !== "string") {
            invalid(`project ${index} "title" must be a string.`);
        }
        return { dir: project.dir, title: project.title as string | undefined };
    });

    const workspaceId =
        typeof obj.workspaceId === "string" ? obj.workspaceId : undefined;
    const title = typeof obj.title === "string" ? obj.title : undefined;
    return { workspaceId, title, projects };
}

/**
 * Loads and validates `spire.json` from `cwd`, returning null when the file does
 * not exist so callers can fall back to positional dirs or the cwd. Project dirs
 * are resolved relative to the workspace file. If the file omits `workspaceId`,
 * one is generated and written back so the group link is stable across runs —
 * the single intentional exception to the CLI's otherwise read-only config
 * handling.
 */
export async function loadWorkspace(cwd: string): Promise<Workspace | null> {
    let raw: string;
    try {
        raw = await readFile(workspacePath(cwd), "utf8");
    } catch {
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error(
            `Failed to parse ${WORKSPACE_FILENAME}: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    const file = validateWorkspaceFile(parsed);

    let workspaceId = file.workspaceId;
    if (!workspaceId) {
        workspaceId = generateWorkspaceId();
        const next = { workspaceId, ...file };
        await writeFile(
            workspacePath(cwd),
            `${JSON.stringify(next, null, 2)}\n`,
            "utf8"
        ).catch(() => {
            // A read-only workspace file is non-fatal: proceed with the generated
            // id for this run; it just will not persist across restarts.
        });
    }

    return {
        workspaceId,
        projects: file.projects.map((project) => ({
            rootDir: path.resolve(cwd, project.dir),
            title: project.title,
        })),
    };
}
