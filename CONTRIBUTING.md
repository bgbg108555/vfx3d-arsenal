# Contributing to VFX3D Arsenal

Thank you for contributing to **VFX3D Arsenal**! Our goal is to maintain a clean, modular, zero-dependency-overhead 3D WebGL VFX library that exports cleanly into standard DCC tools and game engines.

## 1. Adding New VFX Presets (`src/presets_*.js`)

1. Add your preset to an existing category pack (such as `src/presets_melee_fire.js`, `src/presets_bow.js`, or `src/presets_leap_spells.js`), or create a new `src/presets_<your_pack>.js` module and register it in `FLAGSHIP_RAW` inside [`src/moves3d.js`](./src/moves3d.js).
2. **Design & Technical Conventions**:
   - **Physical Weapon & Martial Presets** (`sword_shield`, `greatsword`, `dual_daggers`, `spear`, `scythe`, `bow`, and physical barehand techniques): **Do not spawn ground magic circles** (`Sigil3D` / `MagicArray3D`). Instead, layer `attachWeaponBladeTrail3D`, `SlashArc3D`, `spawnMartialStanceGust3D`, `spawnBladeGroundScar3D`, `spawnMachShockRings3D`, and `GpuSparkPool3D`.
   - **Arcane Spells, Summons & Domains**: Align `releaseTime` within `25ms` of the release keyframe in `keyframes`, and ensure all spawned custom meshes, particles, and status marks expire cleanly by `duration` (`activeFxCount === 0` at clip end).
   - **Bilingual Display (`EN` Default)**: Add an explicit English title (`PRESET_TITLES_EN[id]`, or set `titleEn` on your preset object) in [`src/i18n.js`](./src/i18n.js) so both `EN` and `繁中` UI modes display cleanly.
   - **Originality**: Only submit original or generic fantasy/sci-fi combat & spell VFX. Do not include third-party proprietary game IP, trademarked skill names, or confidential design data.

## 2. Local Verification Before Submitting a PR

Run the full automated verification and build suite:

```bash
npm run verify
```

Make sure:
1. `tests/check-fx3d.mjs`, `tests/check-bow3d.mjs`, and `tests/check-fx-visuals.mjs` pass with **0 failures** (update the expected total preset count assertion in `tests/check-fx3d.mjs` when adding new presets).
2. Both `dist/` (`npm run build:web`) and `VFX3D-Arsenal-Showcase.html` (`npm run build`) compile cleanly and render without WebGL shader or CSP warnings (`npm run serve`).

By submitting a contribution, you agree that your work will be licensed under the repository's [**MIT License**](./LICENSE).

---

## 繁體中文貢獻說明

1. **新增特效預設**：可於既有 `src/presets_*.js` 擴充，或新增獨立模組並註冊至 [`src/moves3d.js`](./src/moves3d.js)。物理武器與體術武技請遵守「零地面魔法陣」規範；法術與召喚請確保 `releaseTime` 與出招關鍵幀對齊且於 `duration` 結束前完全消散。請僅提交原創或通用奇幻／科幻特效，勿包含任何第三方商業遊戲專有名稱。
2. **本地驗證**：提交 PR 前請執行 `npm run verify`，確認三套自動化測試 0 錯誤通過且單檔 `VFX3D-Arsenal-Showcase.html` 已同步更新。
