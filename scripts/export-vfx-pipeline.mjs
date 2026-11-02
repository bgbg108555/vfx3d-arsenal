#!/usr/bin/env node
/**
 * VFX3D Arsenal — Headless Universal 3D VFX Export & Packaging CLI
 * Examples:
 *   node scripts/export-vfx-pipeline.mjs --id chant_seraph_judgment_ray --out ./exports
 *   node scripts/export-vfx-pipeline.mjs --id sup_party_world_tree_sanctuary --fps 30 --extract
 *   node scripts/export-vfx-pipeline.mjs --prop world_tree_staff --out ./exports
 *   node scripts/export-vfx-pipeline.mjs --all-props --out ./exports/props
 *   node scripts/export-vfx-pipeline.mjs --category heal_support --out ./exports/heal
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FX_CONFIG } from '../src/texgen3d.js';
import { MOVES_3D } from '../src/moves3d.js';
import { MESH_GALLERY_ITEMS } from '../src/mesh_gallery3d.js';
import { exportVfxPackage } from '../src/vfx_exporter3d.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    id: null,
    prop: null,
    allProps: false,
    category: null,
    fps: 24,
    includeActors: true,
    chantMode: null,
    chantTimeScale: null,
    rangeScale: null,
    outDir: path.join(ROOT, 'exports'),
    alsoGlb: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--id' && argv[i + 1]) opts.id = argv[++i];
    else if (a === '--prop' && argv[i + 1]) opts.prop = argv[++i];
    else if (a === '--all-props') opts.allProps = true;
    else if (a === '--category' && argv[i + 1]) opts.category = argv[++i];
    else if (a === '--fps' && argv[i + 1]) opts.fps = Number(argv[++i]) || 24;
    else if (a === '--no-actors') opts.includeActors = false;
    else if (a === '--chant-mode' && argv[i + 1]) opts.chantMode = argv[++i];
    else if (a === '--chant-time' && argv[i + 1]) opts.chantTimeScale = Number(argv[++i]);
    else if (a === '--range' && argv[i + 1]) opts.rangeScale = Number(argv[++i]);
    else if (a === '--out' && argv[i + 1]) opts.outDir = path.resolve(process.cwd(), argv[++i]);
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  console.log([
    'VFX3D Arsenal — Universal 3D VFX Export Pipeline CLI',
    '  --id <moveId>          Export an animated 3D VFX skill (Chant + Release -> .zip + .glb)',
    '  --prop <propId>        Export one of the 24 3D geometry props (.zip + .glb + .obj)',
    '  --all-props            Batch-export all 24 3D geometry props',
    '  --category <catId>     Batch-export all skills in a category (e.g. heal_support)',
    '  --fps <24|30|60>       Animation bake frame rate (default: 24)',
    '  --no-actors            Exclude caster/dummy/ally character meshes (VFX-only)',
    '  --chant-mode <mode>    Override FX_CONFIG.chantMode (auto|sequential_4tier|eastern_qimen|...)',
    '  --chant-time <mul>     Override FX_CONFIG.chantTimeScale (0.0 ~ 2.5)',
    '  --range <mul>          Override FX_CONFIG.rangeScale (0.5 ~ 3.0)',
    '  --out <dir>            Output directory (default: ./exports)',
  ].join('\n'));
  process.exit(0);
}

if (opts.chantMode) FX_CONFIG.chantMode = opts.chantMode;
if (Number.isFinite(opts.chantTimeScale)) FX_CONFIG.chantTimeScale = opts.chantTimeScale;
if (Number.isFinite(opts.rangeScale)) FX_CONFIG.rangeScale = opts.rangeScale;

fs.mkdirSync(opts.outDir, { recursive: true });

const jobs = [];
if (opts.allProps) {
  for (const item of MESH_GALLERY_ITEMS) jobs.push({ propId: item.id });
} else if (opts.prop) {
  const foundProp = MESH_GALLERY_ITEMS.find((p) => p.id === opts.prop);
  if (!foundProp) {
    console.error(`[ERROR] Unknown --prop "${opts.prop}". Available (${MESH_GALLERY_ITEMS.length}): ${MESH_GALLERY_ITEMS.map((p) => p.id).join(', ')}`);
    process.exit(1);
  }
  jobs.push({ propId: foundProp.id });
}

if (opts.category) {
  const matches = MOVES_3D.filter((m) => m.cat === opts.category);
  if (!matches.length) {
    console.error(`[ERROR] Unknown or empty --category "${opts.category}".`);
    process.exit(1);
  }
  for (const mv of matches) jobs.push({ move: mv });
} else if (opts.id) {
  const mv = MOVES_3D.find((m) => m.id === opts.id);
  if (!mv) {
    console.error(`[ERROR] Unknown --id "${opts.id}" (out of ${MOVES_3D.length} moves).`);
    process.exit(1);
  }
  jobs.push({ move: mv });
}

if (!jobs.length) {
  // Default demo export: 1 flagship casted ultimate + 1 party heal + 1 BMesh prop
  const defaultMove = MOVES_3D.find((m) => m.id === 'chant_seraph_judgment_ray') || MOVES_3D[0];
  jobs.push({ move: defaultMove });
}

for (const job of jobs) {
  const pkg = exportVfxPackage({
    move: job.move || null,
    propId: job.propId || null,
    fps: opts.fps,
    includeActors: opts.includeActors,
  });
  const zipPath = path.join(opts.outDir, pkg.fileName);
  fs.writeFileSync(zipPath, pkg.zipBytes);
  let glbNote = '';
  if (opts.alsoGlb && pkg.glbBytes) {
    const glbPath = path.join(opts.outDir, pkg.glbFileName);
    fs.writeFileSync(glbPath, pkg.glbBytes);
    glbNote = ` + ${path.basename(glbPath)} (${(pkg.glbBytes.byteLength / 1024).toFixed(1)} KB)`;
  }
  console.log(
    `[OK] Exported ${pkg.fileName} (${(pkg.zipBytes.byteLength / 1024).toFixed(1)} KB)${glbNote} — ` +
    `${pkg.stats.verts} verts, ${pkg.stats.tris} tris` +
    (pkg.stats.frameCount ? `, ${pkg.stats.frameCount} frames @ ${pkg.stats.fps}fps (chant ${pkg.stats.chantDuration}s)` : '')
  );
}
