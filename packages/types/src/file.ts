import { z } from "zod/v4";

export const VirtualPathSchema = z.string().min(1).regex(/^[^\\]+$/, {
    message: "Path must use forward slashes only",
});
export type VirtualPath = z.infer<typeof VirtualPathSchema>;

export type FileNode =
    | { type: "file"; name: string; path: string; size: number; hash: string }
    | { type: "directory"; name: string; path: string; children: FileNode[] };

export const FileNodeSchema: z.ZodType<FileNode> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("file"),
            name: z.string().min(1),
            path: VirtualPathSchema,
            size: z.number().int().nonnegative(),
            hash: z.string().length(64),
        }),
        z.object({
            type: z.literal("directory"),
            name: z.string().min(1),
            path: VirtualPathSchema,
            children: z.array(z.lazy(() => FileNodeSchema)),
        }),
    ])
);

export const FileSnapshotSchema = z.object({
    sessionId: z.string().uuid(),
    tree: FileNodeSchema,
    timestamp: z.number().int().positive(),
    sequenceNum: z.number().int().nonnegative(),
});
export type FileSnapshot = z.infer<typeof FileSnapshotSchema>;
