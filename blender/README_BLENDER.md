# VFX3D Arsenal — Blender BMesh 3D VFX Prop Pipeline (`blender/`)

This directory provides [`build_vfx_models_blender.py`](./build_vfx_models_blender.py), a native **Blender 3.6 LTS – 4.x** procedural `bpy` + `bmesh` generator that builds and exports all **24 high-craft 3D VFX geometry props** (fullered 12-station greatswords, beveled warhammers, fluted Solomonic columns, Qimen astrolabes, living world-tree staffs, seraphic crosses, etc.) with Subdivision Surface, angle-weighted Bevel modifiers, Smart UV Project, and Principled BSDF + Fresnel Emission PBR node trees.

## Batch-Generate `.glb` / `.fbx` / `.blend`

Run headlessly with Blender 3.6+ or 4.x installed:

```bash
blender --background --python blender/build_vfx_models_blender.py -- --out ./exports/models --formats glb,fbx,blend
```

Generate a single prop (e.g., `world_tree_staff`):

```bash
blender --background --python blender/build_vfx_models_blender.py -- --only world_tree_staff --out ./exports/models --formats glb
```

## Output Artifacts

- **`exports/models/glb/*.glb`**: Khronos glTF 2.0 Binary with Subdivision + Bevel modifiers, Smart UV UVs, and Principled BSDF Metallic/Roughness/Fresnel Emission materials—ready to drag into Blender, Unreal Engine 5, Unity, Godot, Maya, Houdini, or Cascadeur.
- **`exports/models/fbx/*.fbx`**: Unit-scaled smooth-normal FBX meshes for Maya / 3ds Max / MotionBuilder / UE5 pipelines.
- **`exports/models/vfx3d_24_models_master.blend`**: Master Blender scene with all 24 props arranged in a clean `6×4` inspection grid.

---

## 繁體中文說明

於安裝有 **Blender 3.6 LTS ～ 4.x** 的環境執行上方指令，即可透過原生 `bpy` + `bmesh` 一次自動建立並匯出全套 **24 款 3D 特效幾何模型**（`.glb`、`.fbx` 與 `6×4` 陣列母檔 `vfx3d_24_models_master.blend`）。
