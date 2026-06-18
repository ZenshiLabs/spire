import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema.js";

let instance: NeonHttpDatabase<typeof schema> | null = null;

/**
 * Lazily-created Drizzle client over Neon's HTTP driver. Initialised on first
 * use (not at import time) so the missing-env error surfaces at request time
 * rather than breaking the build.
 */
export function getDb(): NeonHttpDatabase<typeof schema> {
    if (!instance) {
        const url = process.env.DATABASE_URL;
        if (!url) {
            throw new Error("DATABASE_URL is not set");
        }
        instance = drizzle(neon(url), { schema });
    }
    return instance;
}
