// ─── Client-side image resize + recompress ───────────────────────────
//
// Catalog images render in a 4:5 card at most ~600px wide. Even at 2x
// retina that's 1200x1500 — so a 2000px ceiling on the longest edge
// keeps room to spare. We re-encode as WebP at quality 0.85, which on
// product photos shrinks a 4-15 MB phone shot to ~300-800 KB with no
// visible quality loss in the card grid.
//
// Resize is purely client-side (createImageBitmap + canvas.toBlob), no
// extra deps. Server-side validators downstream still enforce 5 MB +
// mime checks as a safety net in case this falls through.

const MAX_DIMENSION = 2000;
const TARGET_QUALITY = 0.85;

// Resize is destructive for these. SVG is already small; GIF would lose
// frames. Pass them through untouched and let the server validate.
const PRESERVED_MIME_TYPES = new Set(['image/svg+xml', 'image/gif']);

export interface ResizedFile {
    file: File;
    originalSize: number;
    resized: boolean;
}

export async function resizeImageFile(file: File): Promise<ResizedFile> {
    if (PRESERVED_MIME_TYPES.has(file.type)) {
        return { file, originalSize: file.size, resized: false };
    }

    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        // Can't decode (corrupt, HEIC on old Safari, unknown). Let the
        // server-side mime + size check reject it with a real error
        // message instead of throwing a cryptic decode failure here.
        return { file, originalSize: file.size, resized: false };
    }

    const { width, height } = bitmap;
    const maxSide = Math.max(width, height);

    // Already a sensible size — skip re-encode to preserve original quality.
    // 1.5 MB is the threshold where transcoding starts to be worth it.
    if (maxSide <= MAX_DIMENSION && file.size <= 1.5 * 1024 * 1024) {
        bitmap.close();
        return { file, originalSize: file.size, resized: false };
    }

    const scale = maxSide > MAX_DIMENSION ? MAX_DIMENSION / maxSide : 1;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        bitmap.close();
        return { file, originalSize: file.size, resized: false };
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const tryEncode = (mime: string): Promise<Blob | null> =>
        new Promise((resolve) => canvas.toBlob(resolve, mime, TARGET_QUALITY));

    // WebP first (better compression). Fall back to JPEG on any browser
    // that can't encode WebP (Safari <14, ancient Android).
    let blob = await tryEncode('image/webp');
    let outMime = 'image/webp';
    let outExt = 'webp';
    if (!blob) {
        blob = await tryEncode('image/jpeg');
        outMime = 'image/jpeg';
        outExt = 'jpg';
    }
    if (!blob) {
        return { file, originalSize: file.size, resized: false };
    }

    // If transcoding actually made the file larger (rare — happens with
    // already-tiny well-compressed JPEGs), keep the original instead.
    if (blob.size >= file.size) {
        return { file, originalSize: file.size, resized: false };
    }

    const baseName = (file.name.replace(/\.[^.]+$/, '') || 'image').slice(0, 60);
    const out = new File([blob], `${baseName}.${outExt}`, {
        type: outMime,
        lastModified: Date.now()
    });

    return { file: out, originalSize: file.size, resized: true };
}
