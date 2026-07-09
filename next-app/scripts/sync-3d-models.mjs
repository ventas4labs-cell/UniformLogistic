// ─── 3D model sync ──────────────────────────────────────────────────
// Walks the repo-root `3D MODELS/<Product>/*_pbr.glb` staging folder,
// compresses each new/changed model (meshopt geometry + webp textures,
// ~27 MB → single-digit MB), uploads it to the `models-3d` Supabase
// bucket, and upserts a `three_d_models` row keyed by a slug of the
// folder name. Admin-authored fields (zones, allow_logo_placement,
// name, assignments) are preserved on re-sync — only model_url refreshes.
//
// Run:  npm run sync:3d
// Idempotent: a manifest of source hashes skips unchanged files.
//
// This is a LOCAL operator tool (it reads a local folder), not part of
// the deployed app. Requires next-app/.env.local with
// NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEXT_APP = path.resolve(__dirname, '..');
const MODELS_DIR = path.resolve(NEXT_APP, '..', '3D MODELS');
const MANIFEST = path.join(MODELS_DIR, '.sync-manifest.json');
const BUCKET = 'models-3d';
const MAX_TEXTURE = 2048;

// ── env ─────────────────────────────────────────────────────────────
function loadEnv() {
    const file = path.join(NEXT_APP, '.env.local');
    if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
        }
        if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in next-app/.env.local');
    process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── helpers ─────────────────────────────────────────────────────────
const slugify = (s) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const titleize = (s) => s.trim().replace(/\s+/g, ' ');
const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function readManifest() {
    try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return {}; }
}
function writeManifest(m) {
    fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
}

// Prefer the PBR variant (recolorable + lights correctly); fall back to
// any *_pbr.glb, then any .glb in the folder.
function pickGlb(dir) {
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.glb'));
    return (
        files.find((f) => /base_basic_pbr\.glb$/i.test(f)) ||
        files.find((f) => /_pbr\.glb$/i.test(f)) ||
        files[0] ||
        null
    );
}

async function compress(srcPath) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    const io = new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
            'meshopt.encoder': MeshoptEncoder,
            'meshopt.decoder': MeshoptDecoder
        });
    const doc = await io.read(srcPath);
    await doc.transform(dedup(), weld());
    try {
        await doc.transform(
            textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [MAX_TEXTURE, MAX_TEXTURE] })
        );
    } catch (e) {
        console.warn(`  ⚠ texture compression skipped: ${e.message}`);
    }
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    return io.writeBinary(doc); // Uint8Array
}

async function upsertModel(slug, name, modelUrl) {
    const { data: existing, error: selErr } = await supabase
        .from('three_d_models')
        .select('id')
        .eq('code', slug)
        .maybeSingle();
    if (selErr) throw selErr;

    if (existing) {
        // Preserve admin edits (name, zones, toggle) — only refresh the URL.
        const { error } = await supabase
            .from('three_d_models')
            .update({ model_url: modelUrl, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        if (error) throw error;
        return 'updated';
    }
    const { error } = await supabase.from('three_d_models').insert({
        code: slug,
        name,
        model_url: modelUrl,
        product_type: 'shirt'
    });
    if (error) throw error;
    return 'inserted';
}

// ── main ────────────────────────────────────────────────────────────
async function main() {
    if (!fs.existsSync(MODELS_DIR)) {
        console.error(`✗ Folder not found: ${MODELS_DIR}`);
        process.exit(1);
    }
    const manifest = readManifest();
    const subdirs = fs.readdirSync(MODELS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
        .map((d) => d.name);

    let added = 0, updated = 0, skipped = 0, failed = 0;

    for (const folder of subdirs) {
        const dir = path.join(MODELS_DIR, folder);
        const glb = pickGlb(dir);
        if (!glb) { console.warn(`⚠ ${folder}: no .glb found — skipping`); continue; }
        const slug = slugify(folder);
        const name = titleize(folder);
        const srcPath = path.join(dir, glb);
        const srcBytes = fs.readFileSync(srcPath);
        const hash = sha256(srcBytes);

        if (manifest[slug]?.hash === hash) {
            console.log(`• ${folder} (${slug}) — unchanged, skipped`);
            skipped++;
            continue;
        }

        try {
            console.log(`↻ ${folder} (${slug}) — ${glb} @ ${mb(srcBytes.length)} MB`);
            const out = await compress(srcPath);
            const ratio = ((1 - out.length / srcBytes.length) * 100).toFixed(0);
            console.log(`  compressed → ${mb(out.length)} MB (${ratio}% smaller)`);

            const key = `${slug}.glb`;
            const { error: upErr } = await supabase.storage
                .from(BUCKET)
                .upload(key, out, { contentType: 'model/gltf-binary', upsert: true });
            if (upErr) throw upErr;
            const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);
            const modelUrl = pub.publicUrl;

            const result = await upsertModel(slug, name, modelUrl);
            console.log(`  row ${result} · ${modelUrl}`);
            result === 'inserted' ? added++ : updated++;

            manifest[slug] = { hash, source: glb, bytes: out.length, at: new Date().toISOString() };
            writeManifest(manifest);
        } catch (e) {
            console.error(`✗ ${folder}: ${e.message}`);
            failed++;
        }
    }

    console.log(`\nDone — ${added} added, ${updated} updated, ${skipped} skipped, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
