import { promisify } from "node:util";
import zlib from "node:zlib";

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

/** How a blob's bytes are encoded on disk. `hash`/`size` always track raw. */
export type Compression = "none" | "br";

/**
 * Quality 5 trades a little ratio for much faster compression than the default
 * of 11 — appropriate for a request-path write. Source code still compresses
 * ~4-6x at this level.
 */
const BROTLI_QUALITY = 5;

/**
 * Compresses a blob's text for storage. Returns brotli-encoded bytes when that
 * is actually smaller than the raw UTF-8 (tiny or incompressible content stays
 * raw as `"none"`), so we never spend bytes to "compress" a two-line file.
 */
export async function compressBlob(
    content: string
): Promise<{ data: Buffer; compression: Compression }> {
    const raw = Buffer.from(content, "utf8");
    if (raw.length === 0) {
        return { data: raw, compression: "none" };
    }
    const compressed = await brotliCompress(raw, {
        params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
        },
    });
    return compressed.length < raw.length
        ? { data: compressed, compression: "br" }
        : { data: raw, compression: "none" };
}

/** Decodes stored blob bytes back to the original UTF-8 string. */
export async function decompressBlob(
    data: Buffer,
    compression: Compression
): Promise<string> {
    if (compression === "br") {
        const raw = await brotliDecompress(data);
        return raw.toString("utf8");
    }
    return data.toString("utf8");
}
