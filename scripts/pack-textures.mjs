import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'assets');
const outPath = path.join(rootDir, 'src', 'baked_textures.js');

export const TEXTURE_KEYS = [
  // 1-6: Classic Stylized High-Fantasy Sigils
  'sigilArcane', 'sigilHoly', 'sigilAbyss', 'sigilNature', 'sigilWar', 'sigilCrescent',
  // 7-18: 12 Realistic Chiseled Multi-Material AAA Sigils
  'sigilSolomon', 'sigilDragonFlame', 'sigilGlacier', 'sigilThunder', 'sigilBloodbone', 'sigilChrono',
  'sigilCelestial', 'sigilPhoenix', 'sigilValkyrie', 'sigilLeviathan', 'sigilDemonGate', 'sigilCyberRune',
  // 19-27: 9 Eastern/Western Simple/Complex/New-Genre/Siege-Scale Magic Circle Sigils
  'sigilBaguaSimple', 'sigilQimenComplex', 'sigilTalismanSeal', 'sigilXianxiaSword', 'sigilLotusMandala',
  'sigilRuneSimple', 'sigilHermeticAlchemy', 'sigilKabbalahTree', 'sigilSiegeCataclysm',
  // 28-35: 8 Realistic Ground Destruction & Weather Decals
  'envScorchLava', 'envFrostGround', 'envShatterCrater', 'envPoisonSwamp',
  'envLightningScorch', 'envHolyConsecrate', 'envVoidCorruption', 'envSandWhirl',
  // 36-52: 17 High-Res 4x4 Animated Flipbooks (16-Frame SubUV Atlases)
  'fbFlame', 'fbExplosion', 'fbSmoke', 'fbLightning', 'fbSlash', 'fbHitBurst',
  'fbMagicSwirl', 'fbLiquid', 'fbPoison', 'fbBlessing', 'fbStarburst', 'fbIceShatter',
  'fbRockBurst', 'fbWindTornado', 'fbDarkVortex', 'fbFeatherBurst', 'fbBloodSplash',
  // 53-66: 14 Seamless UV Slash, Aura, Shield, Caustics, Magma, Charge & PBR Maps
  'slashSilk', 'slashFlame', 'slashVolt', 'slashVoid', 'slashFrost', 'slashBlood',
  'auraRunes', 'hexShield', 'causticsWater', 'crackedMagma', 'flowNoise',
  'chargeVortex', 'chargeQiFlow', 'metalDamascus',
];

export function ensureBakedTextures({ force = false, silent = false } = {}) {
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`Assets directory not found: ${assetsDir}`);
  }

  let newestAssetMtime = 0;
  for (const key of TEXTURE_KEYS) {
    const filePath = path.join(assetsDir, `${key}.webp`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing WebP texture asset: assets/${key}.webp`);
    }
    const mtime = fs.statSync(filePath).mtimeMs;
    if (mtime > newestAssetMtime) newestAssetMtime = mtime;
  }

  if (!force && fs.existsSync(outPath)) {
    const outStat = fs.statSync(outPath);
    if (outStat.mtimeMs >= newestAssetMtime && outStat.size > 1024 * 1024) {
      return { skipped: true, count: TEXTURE_KEYS.length, outPath };
    }
  }

  const map = {};
  let totalBytes = 0;
  for (const key of TEXTURE_KEYS) {
    const buf = fs.readFileSync(path.join(assetsDir, `${key}.webp`));
    totalBytes += buf.length;
    map[key] = `data:image/webp;base64,${buf.toString('base64')}`;
  }

  const jsOut = `// Auto-generated from assets/*.webp by scripts/pack-textures.mjs (${TEXTURE_KEYS.length} AAA VFX WebP Textures)\nexport const BAKED_AI_TEXTURES = ${JSON.stringify(map, null, 2)};\n`;
  fs.writeFileSync(outPath, jsOut, 'utf8');

  if (!silent) {
    console.log(`Packed ${TEXTURE_KEYS.length} WebP textures (${(totalBytes / 1024).toFixed(1)} KB) -> src/baked_textures.js`);
  }
  return { skipped: false, count: TEXTURE_KEYS.length, outPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  ensureBakedTextures({ force: process.argv.includes('--force') });
}
