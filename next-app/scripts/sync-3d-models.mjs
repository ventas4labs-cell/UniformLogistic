// ─── 3D model sync ──────────────────────────────────────────────────
// Ingests every model in the repo-root `3D MODELS/` staging folder into
// the models-3d bucket + three_d_models table. It handles all shapes the
// folder shows up in:
//   • `<Product>/*_pbr.glb`  — an extracted export folder
//   • `<Product>.zip`        — auto-extracted to `<Product>/` first
//   • `<Name>.glb`           — a loose top-level model file
// Each is compressed (meshopt geometry + webp textures, ~27 MB → single-
// digit MB), uploaded, and upserted as a three_d_models row keyed by a
// slug of the folder/file name. Admin-authored fields (zones,
// allow_logo_placement, name, assignments) are preserved on re-sync —
// only model_url refreshes.
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
import { execSync } from 'node:child_process';
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

// Auto-extract any top-level *.zip into a same-named folder (unless the
// folder already exists). Uses the system `unzip` (local operator tool).
function extractZips() {
    const zips = fs.readdirSync(MODELS_DIR, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.zip'));
    for (const z of zips) {
        const base = z.name.replace(/\.zip$/i, '');
        const target = path.join(MODELS_DIR, base);
        if (fs.existsSync(target)) continue;
        try {
            console.log(`⇲ extracting ${z.name} → ${base}/`);
            execSync(`unzip -o -q ${JSON.stringify(path.join(MODELS_DIR, z.name))} -d ${JSON.stringify(target)}`);
        } catch (e) {
            console.warn(`  ⚠ could not extract ${z.name}: ${e.message}`);
        }
    }
}

async function processSource(src, manifest, counts) {
    const { name, slug, srcPath } = src;
    const srcBytes = fs.readFileSync(srcPath);
    const hash = sha256(srcBytes);

    if (manifest[slug]?.hash === hash) {
        console.log(`• ${name} (${slug}) — unchanged, skipped`);
        counts.skipped++;
        return;
    }
    try {
        console.log(`↻ ${name} (${slug}) — ${path.basename(srcPath)} @ ${mb(srcBytes.length)} MB`);
        const out = await compress(srcPath);
        const ratio = ((1 - out.length / srcBytes.length) * 100).toFixed(0);
        console.log(`  compressed → ${mb(out.length)} MB (${ratio}% smaller)`);

        const key = `${slug}.glb`;
        const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(key, out, { contentType: 'model/gltf-binary', upsert: true });
        if (upErr) throw upErr;
        const modelUrl = supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;

        const result = await upsertModel(slug, name, modelUrl);
        console.log(`  row ${result} · ${modelUrl}`);
        result === 'inserted' ? counts.added++ : counts.updated++;

        manifest[slug] = { hash, source: path.basename(srcPath), bytes: out.length, at: new Date().toISOString() };
        writeManifest(manifest);
    } catch (e) {
        console.error(`✗ ${name}: ${e.message}`);
        counts.failed++;
    }
}

// ── main ────────────────────────────────────────────────────────────
async function main() {
    if (!fs.existsSync(MODELS_DIR)) {
        console.error(`✗ Folder not found: ${MODELS_DIR}`);
        process.exit(1);
    }
    extractZips();

    const manifest = readManifest();
    const entries = fs.readdirSync(MODELS_DIR, { withFileTypes: true });
    const sources = [];

    // Export folders — <Product>/*_pbr.glb
    for (const d of entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'))) {
        const dir = path.join(MODELS_DIR, d.name);
        const glb = pickGlb(dir);
        if (!glb) { console.warn(`⚠ ${d.name}: no .glb found — skipping`); continue; }
        sources.push({ name: titleize(d.name), slug: slugify(d.name), srcPath: path.join(dir, glb) });
    }
    // Loose top-level model files — <Name>.glb
    for (const f of entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.glb'))) {
        const base = f.name.replace(/\.glb$/i, '');
        sources.push({ name: titleize(base), slug: slugify(base), srcPath: path.join(MODELS_DIR, f.name) });
    }

    // Dedupe by slug (a folder export wins over a loose file of the same name).
    const seen = new Set();
    const unique = sources.filter((s) => (seen.has(s.slug) ? false : (seen.add(s.slug), true)));

    const counts = { added: 0, updated: 0, skipped: 0, failed: 0 };
    for (const s of unique) await processSource(s, manifest, counts);

    console.log(
        `\nDone — ${counts.added} added, ${counts.updated} updated, ${counts.skipped} skipped, ${counts.failed} failed.`
    );
    if (counts.failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
