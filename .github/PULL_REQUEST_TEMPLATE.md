## Summary

<!-- Briefly describe what this PR adds, fixes, or improves -->

## Type of Change

- [ ] New 3D VFX Preset(s) (`src/presets_*.js` / `src/i18n.js`)
- [ ] Shader / Particle / Physics Improvement (`src/core3d.js`, `src/niagara3d.js`, `src/gpu_sparks3d.js`)
- [ ] Procedural 3D BMesh Prop (`src/mesh_props3d.js` + `blender/build_vfx_models_blender.py`)
- [ ] `.glb` / `.obj` / Engine Bridge Exporter (`src/vfx_exporter3d.js`)
- [ ] UI / Localization / Documentation

## Verification Checklist

- [ ] `npm run verify` passes locally with `0` errors
- [ ] Physical weapon / martial presets spawn **zero** ground magic circles
- [ ] Casted spells maintain pre-release chant causality (zero premature impacts before cast bar reaches `100%`)
- [ ] Both `EN` (default) and `繁中` UI labels display cleanly
