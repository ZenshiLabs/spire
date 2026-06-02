import { createTwoFilesPatch } from "diff";

export function buildUnifiedDiff(filePath: string, before: string, after: string): string {
    return createTwoFilesPatch(filePath, filePath, before, after, undefined, undefined, {
        context: 3,
    });
}
