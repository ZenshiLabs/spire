import { Effect } from "effect";

import { DbError } from "./errors.js";

export const fromDb = <T>(
    operation: string,
    thunk: () => Promise<T>
): Effect.Effect<T, DbError> =>
    Effect.tryPromise({
        try: thunk,
        catch: (cause) => new DbError({ operation, cause }),
    });
