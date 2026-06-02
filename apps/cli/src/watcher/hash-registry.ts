import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export class HashRegistry {
    private readonly hashes = new Map<string, string>();

    get(filePath: string): string | undefined {
        return this.hashes.get(filePath);
    }

    set(filePath: string, hash: string) {
        this.hashes.set(filePath, hash);
    }

    remove(filePath: string) {
        this.hashes.delete(filePath);
    }

    hasChanged(filePath: string, nextHash: string): boolean {
        return this.hashes.get(filePath) !== nextHash;
    }

    static fromContent(content: string): string {
        return createHash("sha256").update(content).digest("hex");
    }

    static async fromFile(filePath: string): Promise<string> {
        const content = await readFile(filePath);
        return createHash("sha256").update(content).digest("hex");
    }
}

export async function buildInitialHashes(
    rootDir: string,
    accepts: (absolutePath: string) => boolean
): Promise<HashRegistry> {
    const registry = new HashRegistry();

    async function walk(currentDir: string): Promise<void> {
        const entries = await readdir(currentDir, { withFileTypes: true });

        await Promise.all(
            entries.map(async (entry) => {
                const absolutePath = path.join(currentDir, entry.name);

                if (entry.isDirectory()) {
                    if (accepts(absolutePath)) {
                        await walk(absolutePath);
                    }
                    return;
                }

                if (!entry.isFile() || !accepts(absolutePath)) {
                    return;
                }

                const hash = await HashRegistry.fromFile(absolutePath);
                registry.set(absolutePath, hash);
            })
        );
    }

    await walk(rootDir);
    return registry;
}
