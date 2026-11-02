import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXTURE_KEYS, ensureBakedTextures } from './scripts/pack-textures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const webIdx = argv.indexOf('--web');
const isWebMode = webIdx !== -1;
const webOutDir = isWebMode
  ? path.resolve(__dirname, (argv[webIdx + 1] && !argv[webIdx + 1].startsWith('--')) ? argv[webIdx + 1] : 'dist')
  : null;

if (!isWebMode) {
  ensureBakedTextures({ silent: true });
}

const webTexturePlugin = {
  name: 'externalize-webp-assets',
  setup(build) {
    build.onResolve({ filter: /baked_textures\.js$/ }, () => ({
      path: 'baked-textures-web-urls',
      namespace: 'vfx3d-web',
    }));
    build.onLoad({ filter: /.*/, namespace: 'vfx3d-web' }, () => {
      const urlMap = {};
      for (const k of TEXTURE_KEYS) urlMap[k] = `./assets/${k}.webp`;
      return {
        contents: `export const BAKED_AI_TEXTURES = ${JSON.stringify(urlMap)};`,
        loader: 'js',
      };
    });
  },
};

const result = await esbuild.build({
  entryPoints: [path.join(__dirname, 'src/app.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: ['es2020'],
  plugins: isWebMode ? [webTexturePlugin] : [],
});

const jsBundle = result.outputFiles[0].text;

const FAVICON_URI = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0%" stop-color="#38bdf8"/><stop offset="55%" stop-color="#6366f1"/><stop offset="100%" stop-color="#f59e0b"/>' +
  '</linearGradient></defs>' +
  '<rect width="64" height="64" rx="14" fill="#0b0f19"/>' +
  '<polygon points="32,6 54,24 44,56 20,56 10,24" fill="none" stroke="url(#g)" stroke-width="3.5"/>' +
  '<polygon points="32,12 46,30 32,50 18,30" fill="url(#g)" opacity="0.92"/>' +
  '<circle cx="32" cy="29" r="4.5" fill="#fffbeb"/>' +
  '</svg>'
);

const SITE_URL = 'https://bgbg108555.github.io/vfx3d-arsenal/';
const OG_IMAGE_URL = `${SITE_URL}preview.png`;
const REPO_URL = 'https://github.com/bgbg108555/vfx3d-arsenal';

const cspContent = isWebMode
  ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'none';"
  : "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' data: blob:; object-src 'none'; base-uri 'self';";

const scriptTag = isWebMode
  ? '<script src="./app.js" defer></script>'
  : `<script>${jsBundle.replace(/<\/script>/gi, '<\\/script>')}</script>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#0b0f19" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<meta http-equiv="Content-Security-Policy" content="${cspContent}" />
<title>VFX3D Arsenal — Open-Source True-3D WebGL Game VFX Library (398 Presets · GLB/ZIP Export)</title>
<meta name="description" content="MIT open-source true-3D WebGL / Three.js game VFX library featuring 398 presets, global caster chanting, 24 procedural BMesh 3D props, 66 high-res WebP textures, and one-click animated .GLB / .ZIP export for Blender, UE5, Unity &amp; Godot." />
<link rel="canonical" href="${SITE_URL}" />
<link rel="icon" type="image/svg+xml" href="${FAVICON_URI}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="VFX3D Arsenal" />
<meta property="og:title" content="VFX3D Arsenal — 398 True-3D WebGL Game VFX Presets + GLB/ZIP Exporter" />
<meta property="og:description" content="Interactive 3D game VFX workbench in pure Three.js / WebGL: 398 combat, magic, summon &amp; healing presets, 24 BMesh 3D props, 66 WebP textures, and cross-engine .GLB/.ZIP export. MIT Licensed." />
<meta property="og:url" content="${SITE_URL}" />
<meta property="og:image" content="${OG_IMAGE_URL}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="VFX3D Arsenal 3D WebGL Game VFX Workbench Preview" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="VFX3D Arsenal — 398 Open-Source 3D Game VFX + GLB/ZIP Exporter" />
<meta name="twitter:description" content="Explore 398 real-time 3D WebGL VFX presets, 24 BMesh 3D props &amp; 66 SubUV/sigil textures in your browser, and export animated .GLB / .ZIP packs to Blender, UE5, Unity &amp; Godot." />
<meta name="twitter:image" content="${OG_IMAGE_URL}" />
<style>
  :root {
    color-scheme: dark;
    --brand-accent: #7cc4ff;
    --track-bg: rgba(34, 48, 78, 0.92);
    --track-active: #5fb4ff;
    --thumb-bg: #dff2ff;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #0b0f19; color: #e6eefc; font-family: Inter, "Segoe UI", "Microsoft JhengHei", "PingFang TC", system-ui, sans-serif; user-select: none; }
  #stage { position: fixed; inset: 0; }
  #ui-root { position: fixed; inset: 0; pointer-events: none; display: flex; flex-direction: column; justify-content: space-between; padding: 10px 12px; }
  .panel { pointer-events: auto; background: rgba(11, 16, 29, 0.87); border: 1px solid rgba(98, 138, 214, 0.28); border-radius: 10px; backdrop-filter: blur(8px); box-shadow: 0 8px 28px rgba(0,0,0,0.50); }
  .top-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; min-height: 0; flex: 1; margin-bottom: 6px; }
  #ui-root.stage-focus .top-row { visibility: hidden; pointer-events: none; }

  /* Brand-consistent dark form controls + @supports not fallback (modern-web-guidance: brand-consistent-forms) */
  input[type="checkbox"], input[type="radio"], input[type="range"], progress {
    accent-color: var(--brand-accent);
  }
  @supports not (accent-color: #7cc4ff) {
    .chk-row input[type="checkbox"] {
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1px;
    }
    .chk-row:has(input[type="checkbox"])::before {
      content: "";
      width: 13px;
      height: 13px;
      border: 1.5px solid var(--brand-accent);
      border-radius: 3px;
      background: #142038;
      display: inline-block;
      flex-shrink: 0;
    }
    .chk-row:has(input[type="checkbox"]:checked)::before {
      background: var(--brand-accent);
      box-shadow: inset 0 0 0 2px #0b0f19;
    }
    .chk-row:has(input[type="checkbox"]:focus-visible)::before {
      outline: 2px solid var(--brand-accent);
      outline-offset: 2px;
    }
  }

  /* Modern custom range slider (separate WebKit & Firefox rules + progress() fallback) */
  .fx-slider {
    appearance: none;
    background: transparent;
    cursor: pointer;
    height: 17px;
    --attr-min: 0;
    --attr-max: 100;
    --control-value: 50;
    --track-fill: calc(progress(var(--control-value), var(--attr-min), var(--attr-max)) * 100%);
  }
  @supports not (opacity: progress(1, 0, 100)) {
    .fx-slider {
      --track-fill: calc((var(--control-value) - var(--attr-min)) / (var(--attr-max) - var(--attr-min)) * 100%);
    }
  }
  .fx-slider:focus-visible { outline: 2px solid var(--brand-accent); outline-offset: 2px; border-radius: 4px; }
  .fx-slider::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 999px;
    border: 1px solid rgba(132, 180, 255, 0.26);
    background: linear-gradient(to right, var(--track-active) var(--track-fill), var(--track-bg) var(--track-fill));
  }
  .fx-slider::-webkit-slider-thumb {
    appearance: none;
    width: 13px;
    height: 13px;
    margin-top: -4.5px;
    border-radius: 50%;
    background: var(--thumb-bg);
    border: 2px solid #2b7de9;
    box-shadow: 0 0 8px rgba(95, 180, 255, 0.65);
  }
  .fx-slider::-moz-range-track {
    height: 6px;
    border-radius: 999px;
    border: 1px solid rgba(132, 180, 255, 0.26);
    background: var(--track-bg);
  }
  .fx-slider::-moz-range-progress {
    height: 6px;
    border-radius: 999px;
    background: var(--track-active);
  }
  .fx-slider::-moz-range-thumb {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--thumb-bg);
    border: 2px solid #2b7de9;
    box-shadow: 0 0 8px rgba(95, 180, 255, 0.65);
  }

  /* Left Library Sidebar */
  .left-rail { width: 328px; padding: 9px 11px; display: flex; flex-direction: column; gap: 6px; max-height: calc(100vh - 76px); }
  .brand { padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 4px; }
  .brand-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
  .brand h1 { font-size: 14.2px; font-weight: 800; color: #9ec5ff; letter-spacing: 0.2px; }
  .brand-actions { display: flex; align-items: center; gap: 5px; }
  .lang-switch { display: inline-flex; border-radius: 5px; overflow: hidden; border: 1px solid rgba(124, 196, 255, 0.35); background: rgba(15, 24, 44, 0.9); }
  .lang-btn { padding: 2px 6.5px; border: 0; background: transparent; color: #93b0dc; font-size: 10px; font-weight: 700; cursor: pointer; transition: 0.12s; }
  .lang-btn:hover { color: #ffffff; background: rgba(56, 98, 178, 0.35); }
  .lang-btn.active { background: #2563eb; color: #ffffff; }
  .gh-link { display: inline-flex; align-items: center; gap: 3px; padding: 2px 6.5px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.16); background: rgba(24, 34, 58, 0.88); color: #dce7fa; font-size: 10px; font-weight: 700; text-decoration: none; transition: 0.12s; }
  .gh-link:hover { background: rgba(46, 68, 114, 0.95); border-color: #7cc4ff; color: #fff; }
  .gh-link:focus-visible, .lang-btn:focus-visible, .cat-pill:focus-visible, .move-btn:focus-visible, .dock-tab:focus-visible, .mini-chip:focus-visible, .mini-pill:focus-visible, .tier-btn:focus-visible, .btn:focus-visible, .mini-asset-card:focus-visible { outline: 2px solid var(--brand-accent); outline-offset: 1px; }
  .brand small { align-self: flex-start; font-size: 10px; color: #7ce8c8; font-weight: 700; background: rgba(24, 88, 76, 0.48); padding: 2px 6px; border-radius: 4px; }
  #search-input { width: 100%; padding: 6px 9px; border-radius: 6px; border: 1px solid rgba(130, 175, 255, 0.25); background: rgba(18, 26, 44, 0.9); color: #e6eefc; font-size: 11.4px; outline: none; }
  #search-input:focus-visible { border-color: #7cc4ff; outline: 1px solid #7cc4ff; }
  #cat-tabs { display: flex; flex-wrap: wrap; gap: 4px; max-height: 120px; overflow-y: auto; scrollbar-width: thin; flex-shrink: 0; }
  .cat-pill { padding: 3px 6px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.10); background: rgba(22, 31, 52, 0.82); color: #b9cef2; font-size: 10.5px; cursor: pointer; transition: 0.12s; }
  .cat-pill:hover { background: rgba(42, 62, 102, 0.9); }
  .cat-pill.active { background: #2c5cb0; border-color: #8cc0ff; color: #fff; font-weight: 700; }

  #move-list { display: flex; flex-direction: column; gap: 4px; overflow-y: auto; flex: 1; padding-right: 4px; scrollbar-width: thin; scrollbar-color: #3b588c rgba(14, 20, 36, 0.5); }
  .move-btn { text-align: left; padding: 6px 8px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.08); background: rgba(23, 32, 54, 0.72); color: #dce7fa; cursor: pointer; transition: all 0.12s ease; display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
  .move-btn:hover { background: rgba(40, 58, 96, 0.85); border-color: rgba(130, 175, 255, 0.45); }
  .move-btn.active { background: linear-gradient(135deg, rgba(42, 82, 158, 0.95), rgba(28, 52, 104, 0.95)); border-color: #7cb3ff; box-shadow: 0 0 12px rgba(90, 150, 255, 0.28); }
  .m-top { display: flex; align-items: center; gap: 6px; }
  .m-idx { font-family: Consolas, monospace; font-size: 10.5px; color: #ffd27d; font-weight: 700; }
  .m-cls { font-size: 10.3px; color: #8cb4f5; font-weight: 600; }
  .m-name { font-size: 12px; font-weight: 700; }

  /* Right Asset Showcase Dock + Inspector Controls */
  .right-spec { width: 420px; padding: 9px 11px; display: flex; flex-direction: column; gap: 6px; max-height: calc(100vh - 76px); overflow-y: auto; scrollbar-width: thin; scrollbar-color: #3b588c rgba(14, 20, 36, 0.5); }

  /* Right-Side Live 3D Geometry (24) & WebP Texture (66) Dock */
  .asset-dock { background: rgba(15, 23, 41, 0.92); border: 1px solid rgba(112, 168, 255, 0.34); border-radius: 9px; padding: 7px 8px; display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
  .dock-tabs { display: grid; grid-template-columns: 1.08fr 1.06fr 0.72fr 0.92fr; gap: 4px; }
  .dock-tab { padding: 5px 5px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); background: rgba(24, 34, 58, 0.88); color: #bed3f7; font-size: 10.4px; font-weight: 700; cursor: pointer; transition: 0.12s; white-space: nowrap; }
  .dock-tab:hover { background: rgba(44, 65, 108, 0.92); }
  .dock-tab.active { background: linear-gradient(135deg, #2563eb, #1d4ed8); border-color: #93c5fd; color: #ffffff; box-shadow: 0 0 10px rgba(59,130,246,0.35); }
  .dock-tab.accent { background: linear-gradient(135deg, #0f766e, #1e40af); border-color: #5eead4; color: #f0fdfa; }
  .dock-tab.export-accent { background: linear-gradient(135deg, #059669, #0284c7); border-color: #6ee7b7; color: #ecfdf5; }

  .turntable-wrap { position: relative; border-radius: 7px; overflow: hidden; border: 1px solid rgba(110, 165, 250, 0.30); background: #070b14; }
  #mesh-turntable-canvas { width: 100%; height: 142px; display: block; cursor: grab; }
  #mesh-turntable-canvas:active { cursor: grabbing; }
  .tt-meta { position: absolute; top: 6px; left: 8px; pointer-events: none; text-shadow: 0 1px 4px rgba(0,0,0,0.92); max-width: 62%; }
  #mesh-tt-title { font-size: 11.8px; font-weight: 700; color: #ffd98a; }
  #mesh-tt-sub { font-size: 9.8px; color: #b6cff7; }
  .tt-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 4px; }
  .mini-chip { padding: 2.5px 6.5px; border-radius: 5px; border: 1px solid rgba(145, 195, 255, 0.35); background: rgba(11, 18, 34, 0.84); color: #d9ebff; font-size: 10px; font-weight: 700; cursor: pointer; transition: 0.12s; }
  .mini-chip:hover { background: rgba(38, 64, 112, 0.92); }
  .mini-chip.active { background: #0284c7; border-color: #7dd3fc; color: #fff; }
  .tt-bottom { position: absolute; left: 8px; right: 8px; bottom: 5px; display: flex; justify-content: space-between; align-items: center; pointer-events: none; font-size: 9.8px; color: #8fb4eb; text-shadow: 0 1px 3px rgba(0,0,0,0.95); }
  #mesh-tt-stats { font-family: Consolas, monospace; color: #7ef0d4; font-weight: 700; }

  .mini-asset-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; max-height: 144px; overflow-y: auto; padding-right: 2px; scrollbar-width: thin; scrollbar-color: #3b588c rgba(14, 20, 36, 0.5); }
  .mini-asset-grid.tex-mode { max-height: 256px; }
  .mini-asset-card { background: rgba(20, 29, 50, 0.86); border: 1px solid rgba(120, 165, 245, 0.18); border-radius: 6px; padding: 4px; display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; color: #dce7fa; text-align: center; transition: 0.12s; }
  .mini-asset-card:hover { border-color: rgba(135, 190, 255, 0.62); background: rgba(32, 48, 82, 0.92); }
  .mini-asset-card.active { border-color: #fbbf24; background: rgba(45, 68, 118, 0.95); box-shadow: 0 0 8px rgba(251, 191, 36, 0.32); }
  .mini-thumb-wrap { width: 100%; aspect-ratio: 1.48 / 1; border-radius: 4px; overflow: hidden; background: #060913; display: flex; align-items: center; justify-content: center; }
  .tex-mode .mini-thumb-wrap { aspect-ratio: 1 / 1; }
  .mini-thumb-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .mini-title { font-size: 10px; font-weight: 700; color: #eef4ff; line-height: 1.2; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mini-sub { font-size: 9.2px; color: #8ab0eb; font-family: Consolas, "Microsoft JhengHei", sans-serif; }

  .tex-filter-bar { display: flex; flex-wrap: wrap; gap: 4px; }
  .mini-pill { padding: 3px 6px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.12); background: rgba(22, 32, 54, 0.85); color: #b9cef2; font-size: 10px; cursor: pointer; }
  .mini-pill.active { background: #0d9488; border-color: #5eead4; color: #fff; font-weight: 700; }

  /* Move HUD & Controls */
  .hud-head { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
  #hud-title { font-size: 13px; font-weight: 700; color: #ffffff; }
  #hud-code { font-family: Consolas, monospace; font-size: 10.2px; color: #7fa8eb; background: rgba(40,65,115,0.45); padding: 2px 5px; border-radius: 4px; flex-shrink: 0; }
  #spec-notes { padding-left: 15px; font-size: 10.6px; line-height: 1.40; color: #c3d3ee; display: flex; flex-direction: column; gap: 2px; max-height: 58px; overflow-y: auto; scrollbar-width: thin; }
  .status-strip { display: flex; justify-content: space-between; align-items: center; gap: 4px; padding: 3px 0; border-top: 1px solid rgba(255,255,255,0.08); border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 10.4px; color: #90a9d4; }
  #tier-badge { padding: 1px 6px; border-radius: 4px; background: rgba(16, 112, 98, 0.35); border: 1px solid #34d399; color: #a7f3d0; font-weight: 700; font-size: 10px; }
  #hitstop-badge { padding: 1px 6px; border-radius: 4px; background: rgba(255, 166, 48, 0.22); border: 1px solid #ffb347; color: #ffd285; font-weight: 700; font-size: 10px; transition: opacity 0.06s; }

  .sec-label { font-size: 10.5px; color: #93b0dc; font-weight: 700; display: flex; justify-content: space-between; align-items: center; }
  .tier-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  .tier-btn { padding: 4.5px 4px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); background: rgba(24, 34, 56, 0.86); color: #c9daf6; font-size: 10.2px; font-weight: 700; cursor: pointer; transition: 0.12s; }
  .tier-btn:hover { background: rgba(45, 65, 108, 0.92); }
  .tier-btn.active { background: linear-gradient(135deg, #b45309, #2563eb); border-color: #fde68a; color: #fff; box-shadow: 0 0 10px rgba(251, 191, 36, 0.28); }

  .scale-box { background: rgba(17, 26, 46, 0.78); border: 1px solid rgba(110, 155, 235, 0.22); border-radius: 7px; padding: 5px 8px; display: flex; flex-direction: column; gap: 3px; }
  .chant-box { background: rgba(22, 20, 48, 0.82); border: 1px solid rgba(167, 139, 250, 0.32); border-radius: 7px; padding: 5px 8px; display: flex; flex-direction: column; gap: 4px; }
  #lbl-scale-metrics, #lbl-chant-metrics { font-family: Consolas, "Microsoft JhengHei", monospace; font-size: 10px; color: #7ef0d4; font-weight: 700; }
  #lbl-chant-metrics { color: #fde68a; }
  .slider-row { display: grid; grid-template-columns: 122px 1fr; align-items: center; gap: 8px; font-size: 10.6px; color: #cde0ff; }
  .slider-row b { color: #ffd98a; font-family: Consolas, monospace; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
  .cam-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  .btn { padding: 4.5px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); background: rgba(26, 36, 58, 0.86); color: #dce7fa; font-size: 10.8px; cursor: pointer; transition: 0.12s; }
  .btn:hover { background: rgba(46, 66, 106, 0.92); }
  .btn.active { background: #3362b5; border-color: #8cc0ff; color: #fff; font-weight: 700; }
  select.btn { width: 100%; outline: none; padding: 4.5px 6px; font-size: 10.6px; }
  select.btn:focus-visible { outline: 2px solid var(--brand-accent); outline-offset: 1px; }

  /* Branded customizable <select> progressive enhancement (modern-web-guidance: branded-select-styling) */
  @supports (appearance: base-select) {
    select.btn,
    select.btn::picker(select) {
      appearance: base-select;
    }
    select.btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(24, 35, 58, 0.94);
      color: #dce7fa;
      border: 1px solid rgba(130, 175, 255, 0.25);
    }
    select.btn::picker(select) {
      background: #0d1527;
      color: #e6eefc;
      border: 1px solid rgba(124, 196, 255, 0.44);
      border-radius: 8px;
      padding: 4px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.72);
    }
    select.btn option {
      padding: 5px 8px;
      border-radius: 5px;
      font-size: 11px;
      color: #dce7fa;
    }
    select.btn option:hover {
      background: rgba(56, 98, 178, 0.45);
    }
    select.btn option:checked {
      background: rgba(45, 96, 188, 0.68);
      color: #ffffff;
      font-weight: 700;
    }
  }

  .chk-wrap { display: flex; flex-wrap: wrap; gap: 5px 10px; }
  .chk-row { position: relative; display: flex; align-items: center; gap: 5px; font-size: 10.6px; color: #c7d6f0; cursor: pointer; }
  .hint { font-size: 10.2px; color: #7890ba; line-height: 1.35; }

  /* Stage Center Sequential Chant Cast Bar HUD (fixed floating above bottom bar — zero CLS!) */
  .cast-hud {
    position: fixed;
    left: 50%;
    bottom: 56px;
    transform: translateX(-50%);
    z-index: 12;
    width: min(490px, calc(100vw - 780px));
    min-width: 340px;
    padding: 7px 12px;
    border-radius: 10px;
    background: rgba(9, 14, 28, 0.90);
    border: 1px solid color-mix(in srgb, var(--cast-accent, #7cc4ff) 62%, rgba(255,255,255,0.18));
    box-shadow: 0 0 22px rgba(59, 130, 246, 0.32);
    backdrop-filter: blur(8px);
    display: flex;
    flex-direction: column;
    gap: 5px;
    pointer-events: none;
  }
  .cast-hud[hidden] { display: none !important; }
  .cast-hud-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 11.4px; }
  #cast-hud-title { font-weight: 700; color: #ffffff; }
  #cast-hud-stage { font-family: Consolas, "Microsoft JhengHei", sans-serif; font-size: 10.8px; color: #fde68a; font-weight: 700; }
  .cast-hud-track { height: 7px; border-radius: 999px; background: rgba(24, 35, 62, 0.92); border: 1px solid rgba(145, 195, 255, 0.28); overflow: hidden; }
  #cast-hud-fill { height: 100%; width: 0%; border-radius: 999px; background: linear-gradient(90deg, #3b82f6, var(--cast-accent, #7cc4ff), #fff7ed); box-shadow: 0 0 12px var(--cast-accent, #7cc4ff); }
  #cast-hud-pips { display: flex; justify-content: space-between; gap: 6px; }
  .cast-pip { flex: 1; text-align: center; font-size: 10px; font-weight: 700; padding: 2px 4px; border-radius: 4px; background: rgba(22, 32, 56, 0.78); border: 1px solid rgba(255,255,255,0.10); color: #758db5; transition: 0.12s; }
  .cast-pip.on { background: rgba(45, 92, 178, 0.55); border-color: var(--cast-accent, #93c5fd); color: #fffbeb; box-shadow: 0 0 8px rgba(124, 196, 255, 0.38); }

  /* Bottom Playback Bar (strictly single-row, zero overlap with side docks) */
  .bottom-bar { align-self: center; width: min(1060px, calc(100vw - 24px)); padding: 5px 10px; display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; overflow-x: auto; }
  .bottom-bar .btn { white-space: nowrap; flex-shrink: 0; padding: 4px 7px; font-size: 10.6px; }
  #scrubber { flex: 1; min-width: 110px; }
  #time-readout { font-family: Consolas, monospace; font-size: 11.4px; color: #b9cef2; min-width: 92px; text-align: right; white-space: nowrap; flex-shrink: 0; }

  /* Full-Screen Native Dialogs (<dialog closedby="any">) */
  #atlas-dialog { margin: auto; width: min(1240px, 95vw); max-height: 90vh; border: 1px solid rgba(120, 175, 255, 0.45); border-radius: 12px; background: rgba(10, 15, 28, 0.97); color: #e6eefc; padding: 0; box-shadow: 0 22px 64px rgba(0,0,0,0.80); }
  #export-dialog { margin: auto; width: min(700px, 94vw); max-height: 90vh; border: 1px solid rgba(110, 231, 183, 0.48); border-radius: 12px; background: rgba(10, 16, 30, 0.98); color: #e6eefc; padding: 0; box-shadow: 0 22px 64px rgba(0,0,0,0.82); }
  #atlas-dialog::backdrop, #export-dialog::backdrop { background: rgba(4, 7, 15, 0.76); backdrop-filter: blur(5px); }
  .exp-card { background: rgba(18, 28, 48, 0.88); border: 1px solid rgba(120, 175, 255, 0.24); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 7px; font-size: 11.4px; }
  .exp-code { font-family: Consolas, monospace; font-size: 11px; background: rgba(7, 11, 20, 0.92); border: 1px solid rgba(120, 165, 245, 0.22); border-radius: 6px; padding: 7px 9px; color: #86efac; user-select: text; overflow-x: auto; white-space: pre; }
  .dlg-inner { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; max-height: 90vh; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #3b588c rgba(14, 20, 36, 0.5); }
  .dlg-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); position: sticky; top: 0; background: rgba(10, 15, 28, 0.96); z-index: 4; }
  .dlg-head h2 { font-size: 16px; color: #9ec5ff; }
  .atlas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(296px, 1fr)); gap: 10px; }
  .tex-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
  .atlas-card { background: rgba(20, 29, 49, 0.88); border: 1px solid rgba(120, 165, 245, 0.24); border-radius: 9px; padding: 9px; display: flex; flex-direction: column; gap: 7px; transition: 0.2s; }
  .atlas-card.mesh-dlg-card { cursor: pointer; }
  .atlas-card.mesh-dlg-card:hover { border-color: #7dd3fc; transform: translateY(-1px); }
  .atlas-card.flash-focus { border-color: #fbbf24; box-shadow: 0 0 18px rgba(251, 191, 36, 0.65); }
  .atlas-thumbs { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .sheet-thumb, .anim-thumb, .tex-thumb { border-radius: 6px; border: 1px solid rgba(255,255,255,0.14); background: #060913; }
  .tex-thumb { width: 100%; height: auto; display: block; }
  .square-thumb { aspect-ratio: 1 / 1; object-fit: cover; }
  .atlas-title { font-size: 12px; font-weight: 700; color: #ffd98a; }
  .atlas-title small { color: #8cb4f5; font-weight: 600; }
  .atlas-desc { font-size: 10.8px; color: #a9c0e6; margin-top: 2px; line-height: 1.38; }
</style>
</head>
<body>
<main id="stage" aria-label="3D VFX Interactive Viewport"></main>
<div id="ui-root">
  <div class="top-row">
    <aside class="panel left-rail" aria-label="VFX Preset Library">
      <div class="brand">
        <div class="brand-top">
          <h1 id="brand-title">VFX3D Arsenal</h1>
          <div class="brand-actions">
            <div class="lang-switch" role="group" aria-label="Language">
              <button type="button" class="lang-btn active" data-lang="en">EN</button>
              <button type="button" class="lang-btn" data-lang="zh">繁中</button>
            </div>
            <a class="gh-link" href="${REPO_URL}" target="_blank" rel="noopener noreferrer" aria-label="View source on GitHub">★ GitHub</a>
          </div>
        </div>
        <small id="brand-badge">398 FX · 66 Tex · 24 Meshes · MIT</small>
      </div>
      <input type="search" id="search-input" name="search" aria-label="Search VFX presets" placeholder="🔍 Search 398 VFX (blizzard, arrow rain, judgment, heal, shield, voronoi...)" />
      <div id="cat-tabs"></div>
      <div id="move-list"></div>
      <div class="hint" id="shortcut-hint">Keys: ↑/↓ Prev/Next · F Peak Frame · Space Play/Pause · R Replay</div>
    </aside>

    <aside class="panel right-spec" aria-label="3D Asset and Shader Inspector">
      <div class="asset-dock">
        <div class="dock-tabs">
          <button type="button" class="dock-tab active" data-dock-tab="mesh3d" id="dock-btn-mesh">🧊 3D Props (24)</button>
          <button type="button" class="dock-tab" data-dock-tab="tex54" id="dock-btn-tex">🖼 Textures (66)</button>
          <button type="button" class="dock-tab accent" id="btn-atlas">⛶ Atlas</button>
          <button type="button" class="dock-tab export-accent" id="btn-open-export" title="Export animated .GLB / .OBJ / .ZIP package for Blender, UE5, Unity &amp; Godot">📦 Export 3D</button>
        </div>

        <div id="pane-mesh3d">
          <div class="turntable-wrap">
            <canvas id="mesh-turntable-canvas"></canvas>
            <div class="tt-meta">
              <div id="mesh-tt-title">Rose Cathedral Tower Shield</div>
              <div id="mesh-tt-sub">Curved Fresnel ward + holy sigil projection</div>
            </div>
            <div class="tt-actions">
              <button type="button" class="mini-chip" id="btn-mesh-wire">🕸 Wireframe</button>
              <button type="button" class="mini-chip" id="btn-mesh-solo">🔍 Stage Solo</button>
            </div>
            <div class="tt-bottom">
              <span id="mesh-tt-stats">Verts 0 · Tris 0</span>
              <span id="mesh-tt-hint">Triplanar Relief · Scroll Zoom</span>
            </div>
          </div>
          <div id="right-mesh-grid" class="mini-asset-grid" style="margin-top:5px;"></div>
        </div>

        <div id="pane-tex54" hidden>
          <div class="tex-filter-bar">
            <button type="button" class="mini-pill active" data-tex-cat="all" id="tex-pill-all">All (66)</button>
            <button type="button" class="mini-pill" data-tex-cat="sigil" id="tex-pill-sigil">Sigils (27)</button>
            <button type="button" class="mini-pill" data-tex-cat="flipbook" id="tex-pill-flipbook">4×4 Flipbooks (17)</button>
            <button type="button" class="mini-pill" data-tex-cat="env" id="tex-pill-env">Ground (8)</button>
            <button type="button" class="mini-pill" data-tex-cat="uv" id="tex-pill-uv">Slash / UV (14)</button>
          </div>
          <div id="right-tex-grid" class="mini-asset-grid tex-mode" style="margin-top:5px;"></div>
        </div>
      </div>

      <div class="hud-head">
        <span id="hud-title">Loading...</span>
        <span id="hud-code"></span>
      </div>
      <ul id="spec-notes"></ul>
      <div class="status-strip">
        <span id="fx-count">FX: 0</span>
        <span id="tier-badge">T4: Ultra 3D + Physics</span>
        <span id="hitstop-badge">⚡ Hitstop</span>
      </div>

      <div class="sec-label"><span id="sec-tier-lbl">🏆 Scalability Tier (T1 Vector → T4 Ultra 3D + Env Physics)</span></div>
      <div class="tier-grid" id="tier-bar">
        <button type="button" class="tier-btn" data-tier="1">T1 Vector</button>
        <button type="button" class="tier-btn" data-tier="2">T2 Procedural</button>
        <button type="button" class="tier-btn" data-tier="3">T3 HD Atlas</button>
        <button type="button" class="tier-btn active" data-tier="4">T4 Ultra 3D</button>
      </div>

      <div class="chant-box">
        <div class="sec-label">
          <span id="sec-chant-lbl">📿 Global Caster Chanting (Pre-Release)</span>
          <span id="lbl-chant-metrics"></span>
        </div>
        <select id="sel-chant-mode" name="chantMode" class="btn" aria-label="Global Caster Chanting Mode"></select>
        <div class="slider-row">
          <label for="rng-chant-time"><span id="lbl-txt-chant-time">Chant Time</span> <b id="val-chant-time">1.00x</b></label>
          <input type="range" id="rng-chant-time" name="chantTimeScale" class="fx-slider" min="0.00" max="2.50" step="0.05" value="1.00" />
        </div>
      </div>

      <div class="scale-box">
        <div class="sec-label">
          <span id="sec-scale-lbl">📏 Scope / 🎯 Range / 🔥 Linger</span>
          <span id="lbl-scale-metrics"></span>
          <button type="button" class="mini-chip" id="btn-reset-scale" style="white-space:nowrap;">Reset</button>
        </div>
        <div class="slider-row">
          <label for="rng-aoe"><span id="lbl-txt-aoe">AoE Radius</span> <b id="val-aoe">1.00x</b></label>
          <input type="range" id="rng-aoe" name="aoeScale" class="fx-slider" min="0.50" max="2.20" step="0.05" value="1.00" />
        </div>
        <div class="slider-row">
          <label for="rng-range"><span id="lbl-txt-range">Cast Range</span> <b id="val-range">1.00x</b></label>
          <input type="range" id="rng-range" name="rangeScale" class="fx-slider" min="0.50" max="3.00" step="0.05" value="1.00" />
        </div>
        <div class="slider-row">
          <label for="rng-linger"><span id="lbl-txt-linger">Ground Linger</span> <b id="val-linger">1.65x</b></label>
          <input type="range" id="rng-linger" name="groundLingerScale" class="fx-slider" min="1.00" max="2.50" step="0.05" value="1.65" />
        </div>
        <div class="slider-row">
          <label for="rng-wind-x"><span id="lbl-txt-wind-x">Wind X</span> <b id="val-wind-x">0.0</b></label>
          <input type="range" id="rng-wind-x" class="fx-slider" min="-2" max="2" step="0.1" value="0" />
        </div>
        <div class="slider-row">
          <label for="rng-wind-z"><span id="lbl-txt-wind-z">Wind Z</span> <b id="val-wind-z">0.0</b></label>
          <input type="range" id="rng-wind-z" class="fx-slider" min="-2" max="2" step="0.1" value="0" />
        </div>
      </div>

      <div class="two-col">
        <div>
          <label class="sec-label" for="sel-sigil-tradition" id="sec-trad-lbl" style="margin-bottom:3px;">☯️ Sigil Tradition</label>
          <select id="sel-sigil-tradition" name="sigilTradition" class="btn">
            <option value="auto">Preset Default (Auto)</option>
            <option value="eastern">Eastern (Bagua / Qimen / Talisman / Sword)</option>
            <option value="western">Western (Solomon / Runic / Kabbalah)</option>
          </select>
        </div>
        <div>
          <label class="sec-label" for="sel-sigil-complexity" id="sec-comp-lbl" style="margin-bottom:3px;">🔮 Sigil Layers &amp; Archetype</label>
          <select id="sel-sigil-complexity" name="sigilComplexity" class="btn">
            <option value="auto">Preset Default (Auto)</option>
            <option value="simple1">Minimal 1-Layer Cast Ring</option>
            <option value="dual2">Standard 2-Layer Counter-Spin</option>
            <option value="complex3">Complex 3-Tier Astral Tower</option>
            <option value="siege4">Grand 4-Tier 8-Node Array</option>
            <option value="qimen_square">Circle-in-Square Qimen Palace</option>
            <option value="talisman_seal">Levitating Talisman Seal Cross</option>
            <option value="sword_lotus">Sword-Lotus Sword Formation</option>
          </select>
        </div>
      </div>

      <div class="two-col">
        <div>
          <label class="sec-label" for="sel-charge-variant" id="sec-charge-lbl" style="margin-bottom:3px;">⚡ 3D Charge Variants (8)</label>
          <select id="sel-charge-variant" name="chargeVariant" class="btn"></select>
        </div>
        <div>
          <label class="sec-label" for="sel-texstyle" id="sec-slashuv-lbl" style="margin-bottom:3px;">🎨 Blade / Flow UV Map</label>
          <select id="sel-texstyle" name="texStyle" class="btn">
            <option value="auto">Preset Default (Auto)</option>
            <option value="silk">Flowing Silk (Silk)</option>
            <option value="flame">Solar Prominence (Flame)</option>
            <option value="volt">Plasma Arc (Volt)</option>
            <option value="void">Void Rift (Void)</option>
            <option value="frost">Glacial Rime (Frost)</option>
            <option value="blood">Crimson Thorn (Blood)</option>
          </select>
        </div>
      </div>

      <label class="sec-label" for="sel-palette" id="sec-palette-lbl">🌈 Color Temperature Ramps (16 Multi-Hue Gradients)</label>
      <select id="sel-palette" name="palette" class="btn">
        <option value="">Preset Default Multi-Hue Ramp</option>
        <option value="fireInferno">Inferno Flame: Charcoal Violet → Crimson → Gold → White Plasma</option>
        <option value="warriorGold">Sovereign Gold: Deep Red → Blazing Orange → Imperial Gold → Warm Core</option>
        <option value="mageFrost">Glacial Cryo: Abyssal Navy → Cyan → Ice Blue → Warm Crystal White</option>
        <option value="waterAqua">Abyssal Aqua: Midnight Blue → Cobalt → Caustic Teal → Pearl White</option>
        <option value="mageVolt">Celestial Volt: Indigo → Electric Blue → Cyan Arc → Lime-White Core</option>
        <option value="windJade">Emerald Gale: Deep Teal → Jade Green → Spring Lime → Morning White</option>
        <option value="mageEmerald">Astral Emerald: Forest Slate → Emerald → Bioluminescent Green → Starlight</option>
        <option value="mageArcane">Astral Arcane: Night Indigo → Sapphire → Magenta-Cyan → Warm Gold Core</option>
        <option value="mageViolet">Dimensional Violet: Deep Plum → Neon Violet → Sakura Pink → Ice White</option>
        <option value="holyGold">Cathedral Radiance: Rose Umber → Amber Gold → Radiant Yellow → Diamond</option>
        <option value="voidAbyss">Event Horizon: Obsidian → Dark Violet → Neon Magenta → Pale Cyan Rim</option>
        <option value="rogueBlood">Crimson Eclipse: Black-Violet → Dark Ruby → Scarlet → Molten Gold Core</option>
        <option value="poison">Venom Mire: Dark Sludge → Toxic Green → Acid Chartreuse → Pale Mist</option>
        <option value="earthMagma">Tectonic Magma: Basalt Black → Ochre → Molten Orange → Incandescent Gold</option>
        <option value="rogueShadow">Phantom Dusk: Midnight → Royal Purple → Neon Magenta → Silver Cyan</option>
        <option value="warriorSilver">Tempered Steel: Gunmetal Blue → Cobalt → Frost Cyan → Warm Edge</option>
      </select>

      <div class="two-col" style="align-items:center;">
        <button type="button" class="btn" id="btn-freeze-peak" style="background:linear-gradient(135deg,#384b82,#5c3d7a);border-color:#9cc8ff;font-weight:700;">🔍 Peak Frame (F)</button>
        <div class="cam-grid">
          <button type="button" class="btn active" data-cam="iso">45°</button>
          <button type="button" class="btn" data-cam="side">Side</button>
          <button type="button" class="btn" data-cam="top">Top</button>
          <button type="button" class="btn" data-cam="front">Front</button>
        </div>
      </div>

      <div class="chk-wrap">
        <label class="chk-row"><input type="checkbox" id="chk-actors" name="showActors" checked /> <span id="lbl-chk-actors">Actors</span></label>
        <label class="chk-row"><input type="checkbox" id="chk-hitbox" name="showHitbox" checked /> <span id="lbl-chk-hitbox">Hitbox</span></label>
        <label class="chk-row"><input type="checkbox" id="chk-loop" name="autoLoop" checked /> <span id="lbl-chk-loop">Loop</span></label>
        <label class="chk-row" id="wrap-chk-shake" title="Smooth trauma-squared procedural camera impulse on heavy impacts"><input type="checkbox" id="chk-shake" name="shake" checked /> <span id="lbl-chk-shake">📳 Trauma² Shake</span></label>
        <label class="chk-row" id="wrap-chk-soft" title="Scene-depth intersection softening for SubUV flipbooks &amp; volumetric meshes"><input type="checkbox" id="chk-soft-particles" name="softParticles" /> <span id="lbl-chk-soft">Soft Particles</span></label>
        <label class="chk-row" id="wrap-chk-overdraw" title="Additive fragment overdraw heatmap diagnostic view"><input type="checkbox" id="chk-overdraw" name="overdraw" /> <span id="lbl-chk-overdraw">🔥 Overdraw</span></label>
      </div>
    </aside>
  </div>

  <div id="cast-bar-hud" class="cast-hud" hidden>
    <div class="cast-hud-top">
      <span id="cast-hud-title">4-Tier Grand Array</span>
      <span id="cast-hud-stage">Tier 1 / 4 Chanting</span>
    </div>
    <div class="cast-hud-track"><div id="cast-hud-fill"></div></div>
    <div id="cast-hud-pips"></div>
  </div>

  <footer class="panel bottom-bar" aria-label="Timeline Playback Controls">
    <button type="button" class="btn" id="btn-play">⏸ Pause</button>
    <button type="button" class="btn" id="btn-replay">↺ Replay (R)</button>
    <button type="button" class="btn" id="btn-stage-focus" aria-pressed="false">⛶ Focus Stage</button>
    <button type="button" class="btn" id="btn-prev-frame">◀ -1f</button>
    <button type="button" class="btn" id="btn-next-frame">+1f ▶</button>
    <input type="range" id="scrubber" name="scrubber" class="fx-slider" min="0" max="1000" value="0" aria-label="VFX Timeline Scrubber" />
    <span id="time-readout">0.00s / 0.00s</span>
    <button type="button" class="btn active" data-speed="1">1x</button>
    <button type="button" class="btn" data-speed="0.35">0.35x Slow</button>
    <button type="button" class="btn" data-speed="0.15">0.15x Step</button>
    <button type="button" class="btn" id="btn-export-bottom" style="background:linear-gradient(135deg,#059669,#0284c7);border-color:#6ee7b7;color:#fff;font-weight:700;">📦 Export 3D Pack</button>
  </footer>
</div>

<dialog id="export-dialog" closedby="any" aria-labelledby="export-dialog-title">
  <div class="dlg-inner">
    <div class="dlg-head">
      <h2 id="export-dialog-title">📦 Universal 3D VFX Exporter (.GLB / .OBJ / .WEBP / .ZIP)</h2>
      <button type="button" class="btn" id="btn-close-export" style="padding:6px 14px;font-weight:700;">✕ Close</button>
    </div>

    <div class="exp-card">
      <div class="sec-label" id="exp-step-1" style="color:#6ee7b7;font-size:12px;">1️⃣ Choose Target Asset</div>
      <label class="chk-row" style="font-size:12px;color:#eef6ff;">
        <input type="radio" name="expMode" id="exp-mode-skill" value="skill" checked />
        <span><span id="exp-mode-skill-pre">🎬 Export Active 3D VFX Skill (</span><b id="exp-cur-skill-lbl">Loading</b><span id="exp-mode-skill-suf">) — Includes pre-release chant array + baked keyframes</span></span>
      </label>
      <label class="chk-row" style="font-size:12px;color:#eef6ff;">
        <input type="radio" name="expMode" id="exp-mode-prop" value="prop" />
        <span id="exp-mode-prop-lbl">🧊 Export Standalone BMesh 3D Prop (.glb + .obj/.mtl + PBR/SubUV textures)</span>
      </label>
      <div class="two-col" style="margin-top:4px;">
        <div>
          <label class="sec-label" for="exp-prop-select" id="exp-prop-lbl" style="margin-bottom:3px;">🧊 3D Geometry Prop (24)</label>
          <select id="exp-prop-select" class="btn"></select>
        </div>
        <div>
          <label class="sec-label" for="exp-fps-select" id="exp-fps-lbl" style="margin-bottom:3px;">🎞 Keyframe Bake Rate (FPS)</label>
          <select id="exp-fps-select" class="btn">
            <option value="24" selected>24 FPS (Blender / Maya Film Standard)</option>
            <option value="30">30 FPS (UE5 Niagara / Unity Real-Time)</option>
            <option value="60">60 FPS (High-Density Bake)</option>
          </select>
        </div>
      </div>
      <label class="chk-row" style="margin-top:2px;">
        <input type="checkbox" id="exp-chk-actors" checked />
        <span id="exp-chk-actors-lbl">Include Caster, Party Allies &amp; Target Dummy 3D rigs + pose keyframes</span>
      </label>
    </div>

    <div class="exp-card">
      <div class="sec-label" id="exp-step-2" style="color:#93c5fd;font-size:12px;">2️⃣ One-Click Cross-Engine Bundle (Blender / UE5 / Unity / Maya / Houdini / Godot / Cascadeur)</div>
      <div id="exp-bullets" style="font-size:11.2px;color:#c3d6f5;line-height:1.5;">
        • <b><code>scene_animated.glb</code></b>: Khronos Binary glTF 2.0 with meshes, sampled GPU spark trajectories, continuous quaternion TRS tracks, <code>KHR_materials_emissive_strength</code> &amp; <code>EXT_texture_webp</code><br/>
        • <b><code>meshes/*.glb, *.obj, *.mtl</code></b> + <b><code>textures/*.webp</code></b>: Standalone high-craft 3D props and referenced sigils, 4×4 SubUV flipbooks &amp; ground decals<br/>
        • <b><code>import_blender.py</code> / <code>import_maya.py</code> / <code>UnityVfxImporter.cs</code> / <code>ue5_niagara_emitter.json</code></b>: Ready-to-run DCC &amp; game-engine bridge scripts
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
        <button type="button" class="btn" id="btn-do-export-zip" style="padding:7px 14px;background:linear-gradient(135deg,#059669,#0284c7);border-color:#6ee7b7;color:#fff;font-weight:700;">📦 Download Full Cross-Engine Pack (.zip)</button>
        <button type="button" class="btn" id="btn-do-export-glb" style="padding:7px 14px;background:rgba(37,99,235,0.45);border-color:#93c5fd;color:#fff;font-weight:700;">🧊 Download Standalone Binary (.glb)</button>
      </div>
      <div id="exp-status-msg" style="font-size:11.2px;color:#fde68a;font-family:Consolas,'Microsoft JhengHei',sans-serif;min-height:16px;">Ready: Click either button above to bake and download locally in your browser.</div>
    </div>

    <div class="exp-card">
      <div class="sec-label" id="exp-step-3" style="color:#fcd34d;font-size:12px;">3️⃣ Headless CLI Batch Export &amp; Native Blender BMesh Generator</div>
      <div class="exp-code" id="exp-cli-snippet">npm run export-vfx -- --id chant_seraph_judgment_ray --out ./exports
blender --background --python blender/build_vfx_models_blender.py -- --out ./exports/blender_models --formats glb</div>
    </div>
  </div>
</dialog>

<dialog id="atlas-dialog" closedby="any" aria-labelledby="atlas-dialog-title">
  <div class="dlg-inner">
    <div class="dlg-head">
      <h2 id="atlas-dialog-title">🧊 24 BMesh Triplanar 3D Geometry Props + 🎨 66 High-Res VFX WebP Textures</h2>
      <button type="button" class="btn" id="btn-close-atlas" style="padding:6px 14px;font-weight:700;">✕ Close</button>
    </div>
    <div id="atlas-intro" style="font-size:12px;color:#b8cdf0;line-height:1.5;">
      Click any <b>3D Geometry Prop card</b> below to load it into the interactive 3D turntable (with BMesh beveled fullers &amp; seamless triplanar relief). Also inspect all <b>17 animated 4×4 (16-frame) SubUV flipbooks</b>, <b>27 Eastern/Western orthographic magic sigils</b>, <b>8 ground destruction decals</b>, and <b>14 seamless blade/charge/PBR maps</b>:
    </div>
    <div class="sec-label" id="atlas-sec-mesh" style="font-size:13px;color:#fcd34d;">▶ 24 Procedural BMesh 3D Geometry Props (Click any card to inspect on turntable)</div>
    <div id="dlg-mesh-grid" class="tex-grid"></div>

    <div class="sec-label" id="atlas-sec-fb" style="font-size:13px;color:#7ce8c8;margin-top:6px;">▶ 17 Animated 4×4 (16-Frame) SubUV Sprite Flipbooks (4×4 sheet + live 20 FPS preview)</div>
    <div id="fb-atlas-grid" class="atlas-grid"></div>

    <div class="sec-label" id="atlas-sec-sigil" style="font-size:13px;color:#9ec5ff;margin-top:6px;">▶ 27 Eastern &amp; Western Multi-Layer Magic Circle Sigils</div>
    <div id="sigil-atlas-grid" class="tex-grid"></div>

    <div class="sec-label" id="atlas-sec-env" style="font-size:13px;color:#f9a8d4;margin-top:6px;">▶ 8 Ground Destruction Decals + 14 Charge Vortex / Qi / Damascus / Blade UV Maps</div>
    <div id="env-uv-atlas-grid" class="tex-grid"></div>
  </div>
</dialog>

${scriptTag}
</body>
</html>`;

if (isWebMode) {
  const assetsOutDir = path.join(webOutDir, 'assets');
  fs.mkdirSync(assetsOutDir, { recursive: true });
  for (const key of TEXTURE_KEYS) {
    fs.copyFileSync(
      path.join(__dirname, 'assets', `${key}.webp`),
      path.join(assetsOutDir, `${key}.webp`)
    );
  }
  const socialPreviewSrc = path.join(__dirname, 'docs', 'preview-social.png');
  if (fs.existsSync(socialPreviewSrc)) {
    fs.copyFileSync(socialPreviewSrc, path.join(webOutDir, 'preview.png'));
  }
  fs.writeFileSync(path.join(webOutDir, '.nojekyll'), '', 'utf8');
  fs.writeFileSync(path.join(webOutDir, 'app.js'), jsBundle, 'utf8');
  fs.writeFileSync(path.join(webOutDir, 'index.html'), html, 'utf8');
  console.log(
    `Built web bundle -> ${path.relative(__dirname, webOutDir) || 'dist'}/ ` +
    `(index.html ${(fs.statSync(path.join(webOutDir, 'index.html')).size / 1024).toFixed(1)} KB, ` +
    `app.js ${(fs.statSync(path.join(webOutDir, 'app.js')).size / 1024).toFixed(1)} KB + ${TEXTURE_KEYS.length} WebP assets)`
  );
} else {
  const outputArg = argv.indexOf('--out');
  if (outputArg !== -1 && (!argv[outputArg + 1] || argv[outputArg + 1].startsWith('--'))) {
    throw new Error('Expected a destination file after --out');
  }
  const outHtml = outputArg !== -1
    ? path.resolve(argv[outputArg + 1])
    : path.join(__dirname, 'VFX3D-Arsenal-Showcase.html');
  fs.mkdirSync(path.dirname(outHtml), { recursive: true });
  fs.writeFileSync(outHtml, html, 'utf8');
  console.log('Built standalone HTML:', path.relative(__dirname, outHtml) || 'VFX3D-Arsenal-Showcase.html', `(${(fs.statSync(outHtml).size / 1024).toFixed(1)} KB)`);
}
