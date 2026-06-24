import type { FileNode } from "./file.js";

export type FlatNode = { node: FileNode; depth: number };

function compareNodes(a: FileNode, b: FileNode): number {
    if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
}

function sortChildren(children: FileNode[]): FileNode[] {
    return [...children].sort(compareNodes);
}

/**
 * Returns a deep copy of the tree with every directory's children sorted
 * directories-first then alphabetically by name.
 */
export function sortTree(node: FileNode): FileNode {
    if (node.type !== "directory") {
        return node;
    }
    return { ...node, children: sortChildren(node.children.map(sortTree)) };
}

/**
 * Builds a flat map of file path → file node for O(1) head-metadata lookups.
 * Directory nodes are excluded; only file nodes are indexed.
 */
export function indexTree(
    node: FileNode,
    into: Map<string, FileNode> = new Map()
): Map<string, FileNode> {
    if (node.type === "file") {
        into.set(node.path, node);
        return into;
    }
    for (const child of node.children) {
        indexTree(child, into);
    }
    return into;
}

/**
 * Projects the tree into the flat list of rows currently visible to a
 * virtualized renderer. Only children of expanded directories are included.
 */
export function flattenTree(root: FileNode | null, expanded: Set<string>): FlatNode[] {
    const out: FlatNode[] = [];
    if (!root || root.type !== "directory") {
        return out;
    }
    const walk = (nodes: FileNode[], depth: number) => {
        for (const node of nodes) {
            out.push({ node, depth });
            if (
                node.type === "directory" &&
                !node.ignored &&
                expanded.has(node.path)
            ) {
                walk(node.children, depth + 1);
            }
        }
    };
    walk(root.children, 0);
    return out;
}

/**
 * Inserts a file node at its path, creating any missing intermediate directory
 * nodes as needed, and re-sorts each touched directory's children. Returns a
 * new tree root — the original is never mutated.
 */
export function insertFile(root: FileNode, file: FileNode): FileNode {
    if (root.type !== "directory") {
        return root;
    }
    const segments = file.path.split("/");
    segments.pop();

    const cloneDir = (dir: FileNode, depth: number): FileNode => {
        if (dir.type !== "directory") {
            return dir;
        }
        if (depth === segments.length) {
            const others = dir.children.filter(
                (child) => child.path !== file.path
            );
            return { ...dir, children: sortChildren([...others, file]) };
        }
        const childPath = segments.slice(0, depth + 1).join("/");
        const existing = dir.children.find(
            (child) => child.type === "directory" && child.path === childPath
        );
        const nextChild = cloneDir(
            existing ??
                {
                    type: "directory",
                    name: segments[depth]!,
                    path: childPath,
                    children: [],
                },
            depth + 1
        );
        const others = dir.children.filter((child) => child.path !== childPath);
        return { ...dir, children: sortChildren([...others, nextChild]) };
    };

    return cloneDir(root, 0);
}

/**
 * Removes a file node by its path and returns a new tree. Empty directories
 * are retained — removing them would change the tree shape in ways that could
 * confuse a viewer watching a directory be cleared incrementally.
 */
export function removeFile(root: FileNode, filePath: string): FileNode {
    const prune = (dir: FileNode): FileNode => {
        if (dir.type !== "directory") {
            return dir;
        }
        const children = dir.children
            .filter((child) => !(child.type === "file" && child.path === filePath))
            .map((child) => (child.type === "directory" ? prune(child) : child));
        return { ...dir, children };
    };
    return prune(root);
}
