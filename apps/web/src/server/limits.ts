/**
 * Request body size caps per write endpoint, in bytes. The CLI caps individual
 * files at 2MB (MAX_FILE_BYTES), so these ceilings are generous for legitimate
 * traffic while still bounding a hostile payload. All overridable via env for
 * self-hosters with unusual needs.
 */
export const PAYLOAD_LIMITS = {
    snapshot: Number(process.env.SPIRE_MAX_SNAPSHOT_BYTES) || 32 * 1024 * 1024,
    checkpoint: Number(process.env.SPIRE_MAX_CHECKPOINT_BYTES) || 8 * 1024 * 1024,
    session: Number(process.env.SPIRE_MAX_SESSION_BYTES) || 16 * 1024,
} as const;

export type RateLimitConfig = { limit: number; windowSec: number };

/**
 * Fixed-window rate limits per endpoint. Checkpoints are frequent (a save-burst
 * can flush every ~120ms) so their ceiling is high; session creation is keyed by
 * IP to blunt mass session enumeration on this zero-account service.
 */
export const RATE_LIMITS = {
    checkpoint: { limit: 240, windowSec: 60 },
    snapshot: { limit: 15, windowSec: 60 },
    session: { limit: 30, windowSec: 3600 },
    heartbeat: { limit: 30, windowSec: 60 },
} as const satisfies Record<string, RateLimitConfig>;

/** Best-effort client IP from the standard proxy header, for per-IP limits. */
export function clientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    return forwarded?.split(",")[0]?.trim() || "unknown";
}
