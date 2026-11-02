# VFX3D Arsenal — Engine & Pipeline Architecture

`vfx3d-arsenal` is an independent, zero-runtime-server **Three.js / WebGL** 3D visual effects runtime, procedural BMesh asset generator, and cross-engine `.glb` / `.zip` exporter. Every effect is authored as real 3D geometry, analytical GPU particle trajectories, or physically simulated 3D micro-particles—never flat 2D screen overlays.

---

## 1. Real-Time WebGL Rendering Pipeline

The runtime (`src/app.js`, `src/core3d.js`, `src/air_distort3d.js`) executes a multi-stage HDR post-processing pipeline:

1. **Optional Scene-Depth Pre-Pass (`softDepthTarget`)**: Renders opaque arena and actor depth into a `THREE.DepthTexture` (`UnsignedIntType`) used by volumetric and SubUV flipbook shaders to soften intersections against solid geometry. Disabled by default to save an extra scene draw pass on mobile/integrated GPUs.
2. **Primary Linear HDR Scene Pass**: Renders opaque PBR props, translucent Fresnel shields (`makeTranslucentConstructMaterial`), dynamic tapered `RibbonTrail3D` meshes, `SlashArc3D` manifold blades, `MagicArray3D` multi-tier sigil assemblies, and additive SubUV flipbooks under ACES Filmic tone mapping (`exposure = 0.92`).
3. **Selective HDR Bloom (`UnrealBloomPass`)**: High-threshold (`0.95`), low-radius (`0.24`) bloom preserves crisp rune and blade silhouettes without washing out mid-tones.
4. **Screen-Space Refractive Air Distortion (`AirDistortionPass`)**: Shockwaves, meteor impacts, and sonic booms push radial refractive UV offsets in screen space.
5. **Overdraw Heatmap Diagnostic (`OverdrawHeatmapDebug3D`)**: Optional additive fragment-accumulation view (`src/gamedev_algos3d.js`) exposing transparent pixel overdraw hotspots (1x cool blue -> 8x+ white-hot).

---

## 2. Particle & Simulation Subsystems

Inspired by real-time VFX architecture concepts documented in public Unreal Engine Niagara learning resources (implemented independently in pure Three.js / WebGL with zero third-party engine assets):

- **Analytical GPU Spark Pool (`src/gpu_sparks3d.js`)**: Shared `1,024`-slot instanced pool where positions, velocity drag, gravity, and ambient `X/Z` wind acceleration are evaluated analytically in the vertex shader from birth time (`uTime - aBirth`). Zero per-frame CPU buffer uploads during playback; trajectories are deterministically sampled into animated octahedron nodes during `.glb` export.
- **CPU Physical Micro-Particle Pool (`src/niagara3d.js`)**: Handles Stateful forces that require frame-to-frame integration:
  - Thermal blackbody cooling curves & buoyant lift for explosion embers
  - Non-recursive secondary child sparks on first ground-plane impact
  - Optional swept analytical sphere SDF collision & reflection (`src/distance_field3d.js`)
  - Divergence-free 3D curl noise turbulence & global `X/Z` wind fields
- **SkinnedMesh Surface Emission (`src/surface_emit3d.js`)**: Area-weighted triangle sampling supporting posed `THREE.SkinnedMesh` bone transformations for on-body status effects (ignite, frostbite, purify).
- **4-Tier Live Scalability (`FX_CONFIG.tier = 1..4`)**:
  - **T1 (SVG Vector)**: Crisp runtime SVG vector masks & single-hue additive shaders for stylized / mobile targets.
  - **T2 (Procedural Shader)**: Pure mathematical fBm/Voronoi procedural noise (`erosionNoise`) with zero external image fetches.
  - **T3 (Stylized HD)**: High-resolution `4x4` (16-frame) SubUV flipbooks and clean geometric sigils.
  - **T4 (Ultra 3D + Env Physics)**: Full multi-material chiseled sigils, multi-texture ground destruction craters, 3D basalt rock debris, and refractive shockwaves.

---

## 3. Causality-Verified Chanting & Martial Taxonomy

Every preset in `MOVES_3D` (`398` total across `18` categories) runs through `createChantAwareSession` (`src/chant_system3d.js`):

- **Strict Causality**: While `t < chantDuration`, the caster remains anchored near the origin performing multi-stage chanting or martial qi gathering; zero distant projectiles, enemy hit reactions, or party heals can fire prematurely (`tests/check-fx3d.mjs` verifies this across all 398 presets at `120 Hz`).
- **Martial vs. Arcane Separation (`isMartialWeaponMove`)**: Physical melee, bow, shield, warcry, and non-magical combat skills use `martial_qi` stance wind & weapon trails and are strictly forbidden from spawning arcane magic circles (`Sigil3D` / `MagicArray3D`).
- **$C^0$ Pose Continuity**: Root and limb transforms interpolate seamlessly across the chant-to-release boundary (`t = chantDuration`) without single-frame snapping.

---

## 4. Dual Build Targets (`build.mjs`)

| Command | Output | Best For |
| :--- | :--- | :--- |
| `npm run build:web` | `dist/index.html` + `dist/app.js` (~1 MB) + `dist/assets/*.webp` | **GitHub Pages / Web Hosting**: Fast initial boot, parallel HTTP/2 `.webp` caching, zero base64 size inflation |
| `npm run build` | `VFX3D-Arsenal-Showcase.html` (~16.8 MB single file) | **Offline / Air-Gapped / Release Download**: 100% self-contained single HTML file runnable directly via `file://` |

In `--web` mode, `preloadTexLib()` (`src/texgen3d.js`) fetches `./assets/*.webp` in parallel over HTTP, uploads mipmapped `CanvasTexture` instances to the GPU, and hydrates `BAKED_AI_TEXTURES` in memory so browser-side `.glb` and `.zip` exports remain byte-identical to standalone mode.

---

## 5. Cross-Engine `.GLB` / `.ZIP` Export Pipeline

`src/vfx_exporter3d.js` runs identically in the browser UI and headless Node.js (`npm run export-vfx`):

- **`scene_animated.glb`**: Standards-compliant Khronos Binary glTF 2.0 embedding mesh primitives, sampled GPU spark trajectories, quaternion/translation/scale keyframe channels (`24` / `30` / `60` FPS), `KHR_materials_emissive_strength`, and `EXT_texture_webp` textures.
- **Standalone Prop Exports (`meshes/*.glb`, `*.obj`, `*.mtl`)**: Clean BMesh procedural props (`src/bmesh_kernel3d.js`, `src/mesh_props3d.js`) plus native Blender `bpy` + `bmesh` high-poly subdivision scripts (`blender/build_vfx_models_blender.py`).
- **Engine Bridge Scripts**: Auto-generated `import_blender.py`, `import_maya.py`, `UnityVfxImporter.cs`, and `ue5_niagara_emitter.json` inside every `.zip` archive.

### Known Scope & Trade-Offs
- GPU spark trajectories are analytical (collisionless) rather than general-purpose GPU depth-buffer collider simulations, keeping WebGL 2 compatibility universal across desktop and mobile browsers.
- Ground debris bounce physics evaluate against the arena ground plane (`y = 0`) rather than arbitrary scene meshes.
- Exported `.glb` files approximate custom procedural GLSL shaders using standard glTF 2.0 PBR + `KHR_materials_emissive_strength` + baked `.webp` textures; final additive/refraction material tuning in UE5 Niagara, Unity VFX Graph, or Godot should use the included manifest and textures.

---

## 繁體中文架構摘要

`vfx3d-arsenal` 為純 **Three.js / WebGL** 獨立實作之開源真 3D 遊戲特效執行期、BMesh 幾何建模核心與跨引擎 `.glb` / `.zip` 匯出流水線（無須後端伺服器，亦不含任何第三方商業引擎範例資產）：

1. **渲染管線**：整合 ACES Filmic 色調映射、高閾值選擇性泛光（Bloom）、螢幕空間折射熱浪扭曲（`AirDistortionPass`）、可選場景深度粒子交界柔化（Soft Particles）與半透明 Overdraw 熱區診斷視圖。
2. **雙軌粒子系統**：結合 `1,024` 槽位頂點著色器解析火花池（`GpuSparkPool3D`）與支援溫度黑體冷卻、浮力、首次落地次級火花、球形距離場掃掠碰撞及全域風場之 CPU 微粒子池（`NiagaraMicroPool3D`）。
3. **雙模式建置**：`npm run build:web` 產出輕量化 `dist/` 靜態網站（供 GitHub Pages 高速載入與平行快取 `.webp` 貼圖）；`npm run build` 則產出單檔離線版 `VFX3D-Arsenal-Showcase.html`（供 GitHub Releases 下載雙擊即開）。
