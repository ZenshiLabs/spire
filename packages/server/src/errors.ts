import { Data } from "effect";

export class DbError extends Data.TaggedError("DbError")<{
    readonly operation: string;
    readonly cause: unknown;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
    readonly resource: string;
    readonly id: string;
}> {}

export class ConflictError extends Data.TaggedError("ConflictError")<{
    readonly message: string;
}> {}

export type ServerError = DbError | NotFoundError | ConflictError;
