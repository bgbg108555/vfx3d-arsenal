# Changelog

All notable changes to **VFX3D Arsenal** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-02

### Added
- **398 True-3D WebGL / Three.js VFX Presets** organized across 18 gameplay categories (`bow`, `melee`, `defense`, `charge`, `buff_debuff`, `leap_spell`, `heal_support`, `aaa_env`, `summon_zone`, `gamedev_algo`, `fire`, `ice`, `volt`, `arcane`, `holy`, `shadow`, `earth`, `ui_fx`).
- **Bilingual Web Workbench (`EN` Default + `繁中` Toggle)** with live parameter controls (4 quality tiers, 16 color ramps, AOE/range/linger scales, wind X/Z, ground-bounce sparks, SDF obstacle collision, soft particles, overdraw heatmap, and camera presets).
- **Global Caster Chanting & Martial Windup Synchronization** (`src/chant_system3d.js`, `src/magic_arrays3d.js`) with strict pre-release timeline causality locking and zero ground sigils on physical weapon skills.
- **66 High-Resolution `.webp` VFX Textures** (27 Eastern/Western magic sigils, 8 ground decals, 17 `4×4` SubUV flipbooks, and 14 seamless UV maps) with parallel HTTP/2 web loading and automatic Base64 hydration for browser exports.
- **24 Procedural BMesh 3D Geometry Props** in Three.js (`src/mesh_props3d.js`) plus native **Blender 3.6 LTS – 4.x Python BMesh generator** (`blender/build_vfx_models_blender.py`).
- **Universal Cross-Engine 3D Export Pipeline** (`src/vfx_exporter3d.js`, `scripts/export-vfx-pipeline.mjs`) outputting compliant Khronos glTF 2.0 Binary (`.glb`), `.obj`/`.mtl`, `.webp` textures, UE5 Niagara & Unity VFX Graph JSON manifests, and Blender/Maya/Unity import scripts.
- **Dual Build Targets**: Fast multi-asset static web bundle (`npm run build:web` for GitHub Pages with strict `script-src 'self'` CSP) and zero-install offline single-file HTML showcase (`npm run build`).
