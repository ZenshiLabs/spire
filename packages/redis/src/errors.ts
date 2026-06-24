import { Data } from "effect";

export class RedisError extends Data.TaggedError("RedisError")<{
    readonly operation: string;
    readonly cause: unknown;
}> {}
