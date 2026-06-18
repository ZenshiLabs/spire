import { z } from "zod/v4";

export const VirtualPathSchema = z.string().min(1).regex(/^[^\\]+$/, {
    message: "Path must use forward slashes only",
});
export type VirtualPath = z.infer<typeof VirtualPathSchema>;

export type FileNode =
    | {
          type: "file";
          name: string;
          path: string;
          size: number;
          hash: string;
          /**
           * Present on CLI upload payloads only. Stored and served metadata trees
           * strip this field — file content is fetched separately as a
           * content-addressed blob, keyed by `hash`, to keep tree payloads small.
           */
          content?: string;
          /**
           * True for binary files whose raw bytes are never embedded in payloads.
           * Viewers render a placeholder instead of attempting text display, and
           * diffs are skipped for binary entries in checkpoint change lists.
           */
          binary?: boolean;
      }
    | {
          type: "directory";
          name: string;
          path: string;
          children: FileNode[];
          /**
           * True for build-output directories shown as empty, contents-hidden stubs
           * (e.g. dist, .next). Their children are never watched, hashed, or sent.
           */
          ignored?: boolean;
      };

export const FileNodeSchema: z.ZodType<FileNode> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("file"),
            name: z.string().min(1),
            path: VirtualPathSchema,
            size: z.number().int().nonnegative(),
            hash: z.string().length(64),
            content: z.string().optional(),
            binary: z.boolean().optional(),
        }),
        z.object({
            type: z.literal("directory"),
            name: z.string().min(1),
            path: VirtualPathSchema,
            children: z.array(z.lazy(() => FileNodeSchema)),
            ignored: z.boolean().optional(),
        }),
    ])
);

export const FileSnapshotSchema = z.object({
    sessionId: z.string().min(1),
    tree: FileNodeSchema,
    timestamp: z.number().int().positive(),
    sequenceNum: z.number().int().nonnegative(),
});
export type FileSnapshot = z.infer<typeof FileSnapshotSchema>;
