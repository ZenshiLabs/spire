import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

/**
 * Load environment variables from the web app's env files so that database
 * migrations share a single source of truth for DATABASE_URL rather than
 * requiring a separate .env file at the package level.
 */
loadEnv({ path: "../../apps/web/.env.local" });
loadEnv({ path: "../../apps/web/.env" });

export default defineConfig({
    schema: "./src/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL ?? "",
    },
});
