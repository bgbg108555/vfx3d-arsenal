import * as THREE from 'three';
import { BAKED_AI_TEXTURES } from './baked_textures.js';

// Global live VFX configuration shared across UI, Sim3D, Shaders, and Presets
export const FX_CONFIG = {
  lang: 'en',                  // Active UI language ('en' | 'zh')
  tier: 4,                     // 1: SVG Vector, 2: Procedural Shader, 3: Stylized HD, 4: Ultra 3D + Env Physics
  aoeScale: 1.0,               // 動態作用範圍倍率 (0.50x ~ 2.20x)
  rangeScale: 1.0,             // 動態施放距離倍率 (0.50x ~ 3.00x)
  groundLingerScale: 1.65,     // 地面效果殘留時間倍率 (1.00x ~ 2.50x)
  windX: 0.0,                  // Global ambient wind acceleration, world X
  windZ: 0.0,                  // Global ambient wind acceleration, world Z
  chantMode: 'auto',           // 全技能通用詠唱類型 ('auto' | 'sequential_4tier' | 'eastern_qimen' | 'western_cathedral' | 'barrel_cannon' | 'sacred_prayer' | 'martial_qi' | 'abyss_pact' | 'none')
  chantTimeScale: 1.0,         // 詠唱施法時間倍率 (0.00x 瞬發 ~ 2.50x 長詠唱)
  chargeVariant: 'auto',       // 蓄力變體 ('auto' | 'astrolabe' | 'helix' | 'debris' | 'tesla' | 'mirage' | 'funnels' | 'singularity' | 'wings')
  sigilTradition: 'auto',      // 法陣文化體系 ('auto' | 'eastern' | 'western')
  sigilComplexity: 'auto',     // 法陣圖層/規模/新種類 ('auto' | 'simple1' | 'dual2' | 'complex3' | 'siege4' | 'qimen_square' | 'satellite' | 'vertical_cannon' | 'talisman_seal' | 'sword_lotus')
  paletteOverrideActive: false,
};

export const TEX_CONFIG = {
  // 1-6: Classic Stylized High-Res 768x768 Orthographic Magic Sigils
  sigilArcane: { repeatS: false, repeatT: false },
  sigilHoly:   { repeatS: false, repeatT: false },
  sigilAbyss:  { repeatS: false, repeatT: false },
  sigilNature: { repeatS: false, repeatT: false },
  sigilWar:      { repeatS: false, repeatT: false },
  sigilCrescent: { repeatS: false, repeatT: false },

  // 7-18: 12 Realistic Chiseled Multi-Material 768x768 AAA Magic Sigils
  sigilSolomon:     { repeatS: false, repeatT: false },
  sigilDragonFlame: { repeatS: false, repeatT: false },
  sigilGlacier:     { repeatS: false, repeatT: false },
  sigilThunder:     { repeatS: false, repeatT: false },
  sigilBloodbone:   { repeatS: false, repeatT: false },
  sigilChrono:      { repeatS: false, repeatT: false },
  sigilCelestial:   { repeatS: false, repeatT: false },
  sigilPhoenix:     { repeatS: false, repeatT: false },
  sigilValkyrie:    { repeatS: false, repeatT: false },
  sigilLeviathan:   { repeatS: false, repeatT: false },
  sigilDemonGate:   { repeatS: false, repeatT: false },
  sigilCyberRune:   { repeatS: false, repeatT: false },

  // 18B: 9 New Eastern/Western Simple/Complex/New-Genre/Siege-Scale Magic Circle Sigils
  sigilBaguaSimple:     { repeatS: false, repeatT: false },
  sigilQimenComplex:    { repeatS: false, repeatT: false },
  sigilTalismanSeal:    { repeatS: false, repeatT: false },
  sigilXianxiaSword:    { repeatS: false, repeatT: false },
  sigilLotusMandala:    { repeatS: false, repeatT: false },
  sigilRuneSimple:      { repeatS: false, repeatT: false },
  sigilHermeticAlchemy: { repeatS: false, repeatT: false },
  sigilKabbalahTree:    { repeatS: false, repeatT: false },
  sigilSiegeCataclysm:  { repeatS: false, repeatT: false },

  // 19-26: 8 Realistic Ground Environmental Destruction & Weather Decals (640x640)
  envScorchLava:      { repeatS: false, repeatT: false },
  envFrostGround:     { repeatS: false, repeatT: false },
  envShatterCrater:   { repeatS: false, repeatT: false },
  envPoisonSwamp:     { repeatS: false, repeatT: false },
  envLightningScorch: { repeatS: false, repeatT: false },
  envHolyConsecrate:  { repeatS: false, repeatT: false },
  envVoidCorruption:  { repeatS: false, repeatT: false },
  envSandWhirl:       { repeatS: false, repeatT: false },

  // 27-43: 17 High-Res 768x768 (4x4 = 16-Frame) AI-Generated Sprite Flipbooks
  fbFlame:        { repeatS: false, repeatT: false },
  fbExplosion:    { repeatS: false, repeatT: false },
  fbSmoke:        { repeatS: false, repeatT: false },
  fbLightning:    { repeatS: false, repeatT: false },
  fbSlash:        { repeatS: false, repeatT: false },
  fbHitBurst:     { repeatS: false, repeatT: false },
  fbMagicSwirl:   { repeatS: false, repeatT: false },
  fbLiquid:       { repeatS: false, repeatT: false },
  fbPoison:       { repeatS: false, repeatT: false },
  fbBlessing:     { repeatS: false, repeatT: false },
  fbStarburst:    { repeatS: false, repeatT: false },
  fbIceShatter:   { repeatS: false, repeatT: false },
  fbRockBurst:    { repeatS: false, repeatT: false },
  fbWindTornado:  { repeatS: false, repeatT: false },
  fbDarkVortex:   { repeatS: false, repeatT: false },
  fbFeatherBurst: { repeatS: false, repeatT: false },
  fbBloodSplash:  { repeatS: false, repeatT: false },

  // 44-54: 11 Seamless UV Slash, Aura, Shield, Caustics, Magma-Crust & Niagara Flow-Erosion Maps
  slashSilk:     { repeatS: true, repeatT: false },
  slashFlame:    { repeatS: true, repeatT: false },
  slashVolt:     { repeatS: true, repeatT: false },
  slashVoid:     { repeatS: true, repeatT: false },
  slashFrost:    { repeatS: true, repeatT: false },
  slashBlood:    { repeatS: true, repeatT: false },
  auraRunes:     { repeatS: true, repeatT: false },
  hexShield:     { repeatS: true, repeatT: true },
  causticsWater: { repeatS: true, repeatT: true },
  crackedMagma:  { repeatS: true, repeatT: true },
  flowNoise:     { repeatS: true, repeatT: true },
  // Linear data map shared by the dissolve, smoke and ground shaders.
  erosionNoise:  { repeatS: true, repeatT: true, synthetic: true },
  chargeVortex:  { repeatS: false, repeatT: false },
  chargeQiFlow:  { repeatS: true, repeatT: true },
  metalDamascus: { repeatS: true, repeatT: true },

  // Runtime T1 SVG Vector & T2 Procedural Math Textures for Live Quality Tier Grading
  svgSigil:     { repeatS: false, repeatT: false, synthetic: true },
  svgSlash:     { repeatS: true,  repeatT: false, synthetic: true },
  svgFlipbook:  { repeatS: false, repeatT: false, synthetic: true },
  procSigil:    { repeatS: false, repeatT: false, synthetic: true },
  procSlash:    { repeatS: true,  repeatT: false, synthetic: true },
  procFlipbook: { repeatS: false, repeatT: false, synthetic: true },
};

// Structured catalog of all 66 AI-generated AAA textures for Right-Side Dock & Full-Screen Atlas Inspector
export const AI_TEXTURE_CATALOG = [
  // 27 Sigils (Eastern/Western × Simple/Complex × New Genres × Cataclysmic Siege + 18 Classic/Chiseled AAA)
  { key: 'sigilBaguaSimple',     cat: 'sigil', title: '先天八卦太極單環陣',     badge: '中式・極簡1層' },
  { key: 'sigilQimenComplex',    cat: 'sigil', title: '奇門遁甲二十八宿羅盤陣', badge: '中式・繁複3層' },
  { key: 'sigilTalismanSeal',    cat: 'sigil', title: '外圓內方五雷敕令符印陣', badge: '中式・新種方印' },
  { key: 'sigilXianxiaSword',    cat: 'sigil', title: '太虛八方御劍青蓮劍陣',   badge: '中式・仙俠劍陣' },
  { key: 'sigilLotusMandala',    cat: 'sigil', title: '梵音千瓣金蓮曼荼羅陣',   badge: '東方・密教蓮陣' },
  { key: 'sigilRuneSimple',      cat: 'sigil', title: '盧恩幾何單環基礎吟唱陣', badge: '西式・極簡1層' },
  { key: 'sigilHermeticAlchemy', cat: 'sigil', title: '赫密斯四象三角煉金法陣', badge: '西式・新種煉金' },
  { key: 'sigilKabbalahTree',    cat: 'sigil', title: '卡巴拉十質點生命樹星陣', badge: '西式・繁複星軌' },
  { key: 'sigilSiegeCataclysm',  cat: 'sigil', title: '七重黑曜八子陣滅世禁咒', badge: '屠城級・4層母陣' },
  { key: 'sigilSolomon',     cat: 'sigil', title: '所羅門黃銅寶石浮雕陣', badge: '西式・多材質浮雕' },
  { key: 'sigilDragonFlame', cat: 'sigil', title: '盤龍黑曜熔金炎紋陣',   badge: '中式・黑曜石浮雕' },
  { key: 'sigilGlacier',     cat: 'sigil', title: '極北白銀藍寶冰晶陣',   badge: '西式・銀雕冰晶' },
  { key: 'sigilThunder',     cat: 'sigil', title: '遠古青銅雷神錘電弧陣', badge: '西式・青銅石雕' },
  { key: 'sigilBloodbone',   cat: 'sigil', title: '哥德鍛鐵白骨血契陣',   badge: '西式・鍛鐵骨雕' },
  { key: 'sigilChrono',      cat: 'sigil', title: '黃金發條星象儀時空陣', badge: '西式・精密齒輪' },
  { key: 'sigilCelestial',   cat: 'sigil', title: '白金藍寶黃道十二宮陣', badge: '西式・星象浮雕' },
  { key: 'sigilPhoenix',     cat: 'sigil', title: '朱紅赤金涅槃鳳羽法陣', badge: '東方・赤金珀雕' },
  { key: 'sigilValkyrie',    cat: 'sigil', title: '女武神白理石聖翼槍陣', badge: '西式・大理石金雕' },
  { key: 'sigilLeviathan',   cat: 'sigil', title: '深海利維坦青銅珊瑚陣', badge: '西式・古銅珠母貝' },
  { key: 'sigilDemonGate',   cat: 'sigil', title: '煉獄鎖鏈羊角黑曜門陣', badge: '西式・熔火鍛鐵' },
  { key: 'sigilCyberRune',   cat: 'sigil', title: '魔導晶路鈦金六角矩陣', badge: '西式・鈦金導光' },
  { key: 'sigilArcane',      cat: 'sigil', title: '星界奧術雙十二宮法陣', badge: '西式・風格化法陣' },
  { key: 'sigilHoly',        cat: 'sigil', title: '大教堂玫瑰花窗聖光陣', badge: '西式・風格化法陣' },
  { key: 'sigilAbyss',       cat: 'sigil', title: '深淵荊棘蝕月魔紋陣',   badge: '西式・風格化法陣' },
  { key: 'sigilNature',      cat: 'sigil', title: '世界樹藤蔓翠玉靈陣',   badge: '西式・風格化法陣' },
  { key: 'sigilWar',         cat: 'sigil', title: '戰神雙斧烈陽破軍陣',   badge: '西式・風格化法陣' },
  { key: 'sigilCrescent',    cat: 'sigil', title: '星辰新月十二宮羽陣',   badge: '西式・風格化法陣' },

  // 8 Environmental Ground Decals
  { key: 'envScorchLava',      cat: 'env', title: '焦黑熔岩龜裂燃燒地表', badge: '環境破壞貼花' },
  { key: 'envFrostGround',     cat: 'env', title: '厚積雪與冰裂藍晶地表', badge: '環境天候貼花' },
  { key: 'envShatterCrater',   cat: 'env', title: '重擊同心碎石陷落隕坑', badge: '環境破壞貼花' },
  { key: 'envPoisonSwamp',     cat: 'env', title: '腐蝕劇毒冒泡泥沼地表', badge: '環境毒沼貼花' },
  { key: 'envLightningScorch', cat: 'env', title: '落雷玻璃化閃電焦痕',   badge: '環境雷擊貼花' },
  { key: 'envHolyConsecrate',  cat: 'env', title: '碎裂大理石聖金祝聖地', badge: '環境聖域貼花' },
  { key: 'envVoidCorruption',  cat: 'env', title: '深淵黑曜紫晶腐化裂隙', badge: '環境腐化貼花' },
  { key: 'envSandWhirl',       cat: 'env', title: '荒漠流沙漩渦砂岩裂地', badge: '環境沙暴貼花' },

  // 17 4x4 Animated Flipbooks
  { key: 'fbFlame',        cat: 'flipbook', title: '烈焰翻騰 4×4 序列圖',   badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbExplosion',    cat: 'flipbook', title: '爆轟火球濃煙 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbSmoke',        cat: 'flipbook', title: '體積濃煙翻滾 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbLightning',    cat: 'flipbook', title: '高壓分岔電弧 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbSlash',        cat: 'flipbook', title: '流體劍氣斬弧 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbHitBurst',     cat: 'flipbook', title: '超新星受擊爆閃 4×4',    badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbMagicSwirl',   cat: 'flipbook', title: '星雲漩渦坍縮 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbLiquid',       cat: 'flipbook', title: '寒水冰霧飛濺 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbPoison',       cat: 'flipbook', title: '劇毒酸液爆泡 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbBlessing',     cat: 'flipbook', title: '神聖光羽昇華 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbStarburst',    cat: 'flipbook', title: '星芒稜鏡閃耀 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbIceShatter',   cat: 'flipbook', title: '冰晶爆碎雪霧 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbRockBurst',    cat: 'flipbook', title: '玄武岩碎塊噴濺 4×4',    badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbWindTornado',  cat: 'flipbook', title: '翠風旋流風刃 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbDarkVortex',   cat: 'flipbook', title: '黑洞暗影觸鬚 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbFeatherBurst', cat: 'flipbook', title: '聖金鳳羽飄散 4×4',      badge: '16 格動態播放', isFlipbook: true },
  { key: 'fbBloodSplash',  cat: 'flipbook', title: '腥紅血晶荊棘 4×4',      badge: '16 格動態播放', isFlipbook: true },

  // 11 Seamless UV Shader Maps
  { key: 'slashSilk',     cat: 'uv', title: '絲綢流光無縫刀光貼圖', badge: '無縫 UV 刀光' },
  { key: 'slashFlame',    cat: 'uv', title: '日珥熔火無縫刀光貼圖', badge: '無縫 UV 刀光' },
  { key: 'slashVolt',     cat: 'uv', title: '雷霆電漿無縫刀光貼圖', badge: '無縫 UV 刀光' },
  { key: 'slashVoid',     cat: 'uv', title: '虛空裂隙無縫刀光貼圖', badge: '無縫 UV 刀光' },
  { key: 'slashFrost',    cat: 'uv', title: '極寒冰稜雪晶刀光貼圖', badge: '無縫 UV 刀光' },
  { key: 'slashBlood',    cat: 'uv', title: '暗紅荊棘血晶刀光貼圖', badge: '無縫 UV 刀光' },
  { key: 'auraRunes',     cat: 'uv', title: '圓柱氣場上升符文光柱', badge: '無縫 UV 氣場' },
  { key: 'hexShield',     cat: 'uv', title: '六角蜂巢力場護盾網格', badge: '無縫二方連續' },
  { key: 'causticsWater', cat: 'uv', title: '深海折射水波焦散貼圖', badge: '無縫二方連續' },
  { key: 'crackedMagma',  cat: 'uv', title: '黑玄武岩熾熱熔岩裂紋', badge: '無縫二方連續' },
  { key: 'flowNoise',     cat: 'uv', title: 'Niagara 雙通道流體侵蝕', badge: 'Shader 侵蝕圖' },
  { key: 'chargeVortex',  cat: 'uv', title: '3A 蓄力向心電漿漩渦圖', badge: '寫實蓄力漩渦' },
  { key: 'chargeQiFlow',  cat: 'uv', title: '3A 聚氣經脈真氣流絲圖', badge: '寫實聚氣絲流' },
  { key: 'metalDamascus', cat: 'uv', title: '大馬士革鍛鋼鎏金符紋', badge: '3D 幾何體貼圖' },
];

function makePlaceholderTex(repeatS = false, repeatT = false) {
  let t;
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = 2;
    cv.height = 2;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 2, 2);
    t = new THREE.CanvasTexture(cv);
    t._sourceCanvas = cv;
  } else {
    const data = new Uint8Array([
      255, 255, 255, 255,  255, 255, 255, 255,
      255, 255, 255, 255,  255, 255, 255, 255,
    ]);
    t = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
  }
  t.wrapS = repeatS ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = repeatT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// A periodic, three-channel fBm map. Keep it independent from the coloured
// flow texture: its channels are data, not sRGB artwork or an alpha mask.
// The lattice wraps at every octave, so bilinear/mipmap sampling is seamless.
function makeErosionTexture(size = 256) {
  const pixels = new Uint8Array(size * size * 4);
  const hash = (x, y, seed) => {
    let h = Math.imul(x + seed * 31, 0x1f123bb5) ^ Math.imul(y + seed * 17, 0x5f356495);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967295;
  };
  const noise = (x, y, grid, seed) => {
    const gx = x * grid / size, gy = y * grid / size;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = gx - ix, fy = gy - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const mask = grid - 1;
    const a = hash(ix & mask, iy & mask, seed);
    const b = hash((ix + 1) & mask, iy & mask, seed);
    const c = hash(ix & mask, (iy + 1) & mask, seed);
    const d = hash((ix + 1) & mask, (iy + 1) & mask, seed);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        let value = 0, weight = 0, amplitude = 1;
        for (let grid = 4; grid <= 64; grid *= 2) {
          value += noise(x, y, grid, channel * 11 + grid) * amplitude;
          weight += amplitude;
          amplitude *= 0.53;
        }
        pixels[offset + channel] = Math.round(255 * value / weight);
      }
      pixels[offset + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  tex.name = 'procedural-erosion-fbm';
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function assignCanvasToTex(tex, cv, cfg, maxAniso = 8) {
  tex.dispose();
  tex.image = cv;
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.wrapS = cfg.repeatS ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = cfg.repeatT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAniso;
  tex.flipY = true;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  tex._sourceCanvas = cv;
}

function buildSvgDataUri(svgContent) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
}

function buildTier1SvgTextures(lib, maxAniso) {
  const sigilSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <g fill="none" stroke="#ffffff" stroke-width="5">
      <circle cx="256" cy="256" r="236"/>
      <circle cx="256" cy="256" r="214" stroke-dasharray="14 10" stroke-width="3"/>
      <polygon points="256,36 446,366 66,366" stroke-width="4"/>
      <polygon points="256,476 446,146 66,146" stroke-width="4"/>
      <rect x="132" y="132" width="248" height="248" transform="rotate(45 256 256)" stroke-width="3"/>
      <circle cx="256" cy="256" r="88" stroke-width="4"/>
      <circle cx="256" cy="256" r="26" fill="#ffffff"/>
    </g>
  </svg>`;

  const slashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="192" viewBox="0 0 512 192">
    <path d="M0,18 L512,18 L512,56 L0,56 Z" fill="#ffffff"/>
    <path d="M0,74 L512,74 L512,96 L0,96 Z" fill="#ffffff" fill-opacity="0.65"/>
    <line x1="0" y1="120" x2="512" y2="120" stroke="#ffffff" stroke-width="6" stroke-dasharray="28 16"/>
  </svg>`;

  let cells = '';
  for (let i = 0; i < 16; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    const cx = col * 128 + 64, cy = row * 128 + 64;
    const u = (i + 1) / 16;
    const rOuter = (16 + u * 44).toFixed(1);
    const rInner = Math.max(4, (1 - u) * 28).toFixed(1);
    const op = (1 - Math.max(0, u - 0.65) * 2.4).toFixed(2);
    const pts = [];
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8 + u * 0.8;
      const rr = k % 2 === 0 ? Number(rOuter) : Number(rOuter) * 0.42;
      pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
    }
    cells += `<g opacity="${op}"><circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="#fff" stroke-width="4"/><polygon points="${pts.join(' ')}" fill="#fff" fill-opacity="0.55" stroke="#fff" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${rInner}" fill="#fff"/></g>`;
  }
  const fbSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${cells}</svg>`;

  const pairs = [
    ['svgSigil', sigilSvg, 512, 512],
    ['svgSlash', slashSvg, 512, 192],
    ['svgFlipbook', fbSvg, 512, 512],
  ];
  return Promise.all(pairs.map(([key, svg, w, h]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      assignCanvasToTex(lib[key], cv, TEX_CONFIG[key], maxAniso);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = buildSvgDataUri(svg);
  })));
}

function buildTier2ProceduralTextures(lib, maxAniso) {
  {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 512;
    const ctx = cv.getContext('2d');
    ctx.translate(256, 256);
    for (const [r, w, al] of [[236, 4, 0.92], [218, 2, 0.65], [164, 3, 0.85], [104, 2.5, 0.8]]) {
      ctx.strokeStyle = `rgba(180,235,255,${al})`;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,245,190,0.9)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let i = 0; i <= 360; i++) {
      const a = (i / 360) * Math.PI * 2;
      const r = 104 + Math.cos(a * 8) * 96;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 92);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(120,210,255,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.fill();
    assignCanvasToTex(lib.procSigil, cv, TEX_CONFIG.procSigil, maxAniso);
  }
  {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 192;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 192);
    g.addColorStop(0.0, 'rgba(255,255,255,0.98)');
    g.addColorStop(0.28, 'rgba(165,225,255,0.82)');
    g.addColorStop(0.68, 'rgba(80,150,255,0.28)');
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    for (let s = 0; s < 5; s++) {
      ctx.lineWidth = 3.5 - s * 0.5;
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 8) {
        const y = 22 + s * 28 + Math.sin((x / 512) * Math.PI * 2 * (s + 2)) * (6 + s * 2);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    assignCanvasToTex(lib.procSlash, cv, TEX_CONFIG.procSlash, maxAniso);
  }
  {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 512;
    const ctx = cv.getContext('2d');
    for (let i = 0; i < 16; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const cx = col * 128 + 64, cy = row * 128 + 64;
      const u = (i + 0.5) / 16;
      const rad = 18 + u * 42;
      const fade = 1 - Math.max(0, u - 0.58) * 2.1;
      const g = ctx.createRadialGradient(cx, cy, rad * 0.12, cx, cy, rad);
      g.addColorStop(0, `rgba(255,255,255,${(0.95 * fade).toFixed(2)})`);
      g.addColorStop(0.55, `rgba(170,225,255,${(0.65 * fade).toFixed(2)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    }
    assignCanvasToTex(lib.procFlipbook, cv, TEX_CONFIG.procFlipbook, maxAniso);
  }
}

let _cache = null;
let _preloadPromise = null;

export function getTexLib() {
  if (_cache) return _cache;
  _cache = {};
  for (const [key, cfg] of Object.entries(TEX_CONFIG)) {
    _cache[key] = key === 'erosionNoise'
      ? makeErosionTexture()
      : makePlaceholderTex(cfg.repeatS, cfg.repeatT);
  }
  return _cache;
}

/**
 * Decodes all 54 baked AI-generated AAA WebP textures + runtime T1 SVG & T2 Procedural textures
 * into GPU-ready CanvasTextures with full mipmapping and max anisotropic filtering.
 */
export async function preloadTexLib(renderer = null) {
  const lib = getTexLib();
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return lib;
  }
  if (_preloadPromise) return _preloadPromise;

  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() || 8;
  lib.erosionNoise.anisotropy = maxAniso;
  buildTier2ProceduralTextures(lib, maxAniso);

  const bytesToBase64 = (u8) => {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      bin += String.fromCharCode(...u8.subarray(i, i + chunk));
    }
    return btoa(bin);
  };

  const aiLoads = Object.entries(TEX_CONFIG)
    .filter(([, cfg]) => !cfg.synthetic)
    .map(([key, cfg]) => new Promise((resolve) => {
      const srcEntry = BAKED_AI_TEXTURES[key];
      if (!srcEntry) { resolve(); return; }

      const loadViaImg = (srcUrl, revokeAfter = false) => {
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas');
          cv.width = img.naturalWidth || img.width;
          cv.height = img.naturalHeight || img.height;
          cv.getContext('2d').drawImage(img, 0, 0);
          assignCanvasToTex(lib[key], cv, cfg, maxAniso);
          if (revokeAfter) URL.revokeObjectURL(srcUrl);
          resolve();
        };
        img.onerror = () => {
          if (revokeAfter) URL.revokeObjectURL(srcUrl);
          resolve();
        };
        img.src = srcUrl;
      };

      if (srcEntry.startsWith('data:')) {
        loadViaImg(srcEntry, false);
        return;
      }

      // Fast HTTP/2 Web Bundle mode: fetch .webp once, hydrate BAKED_AI_TEXTURES for synchronous .GLB/.ZIP export, and upload to GPU
      if (typeof fetch === 'function') {
        fetch(srcEntry)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((ab) => {
            const u8 = new Uint8Array(ab);
            BAKED_AI_TEXTURES[key] = `data:image/webp;base64,${bytesToBase64(u8)}`;
            const blobUrl = URL.createObjectURL(new Blob([u8], { type: 'image/webp' }));
            loadViaImg(blobUrl, true);
          })
          .catch(() => loadViaImg(srcEntry, false));
      } else {
        loadViaImg(srcEntry, false);
      }
    }));

  _preloadPromise = Promise.all([
    ...aiLoads,
    buildTier1SvgTextures(lib, maxAniso),
  ]).then(() => lib);

  return _preloadPromise;
}

export function resolveSlashTex(styleKey = 'auto', defaultStyle = 'silk') {
  const lib = getTexLib();
  if (FX_CONFIG.tier === 1) return lib.svgSlash;
  if (FX_CONFIG.tier === 2) return lib.procSlash;
  const key = (!styleKey || styleKey === 'auto') ? defaultStyle : styleKey;
  if (key === 'flame') return lib.slashFlame;
  if (key === 'volt')  return lib.slashVolt;
  if (key === 'void')  return lib.slashVoid;
  if (key === 'frost') return lib.slashFrost;
  if (key === 'blood') return lib.slashBlood;
  return lib.slashSilk;
}

const EASTERN_SIGIL_STYLES = new Set([
  'baguaSimple', 'qimenComplex', 'talismanSeal', 'xianxiaSword', 'lotusMandala', 'dragonFlame', 'phoenix',
]);

export function getSigilTradition(style = 'arcane') {
  return EASTERN_SIGIL_STYLES.has(style) ? 'eastern' : 'western';
}

export function remapSigilStyle(style = 'arcane', exact = false) {
  let s = style || 'arcane';
  if (!exact) {
    const trad = FX_CONFIG.sigilTradition;
    if (trad === 'eastern' && !EASTERN_SIGIL_STYLES.has(s)) {
      if (s === 'runeSimple') s = 'baguaSimple';
      else if (s === 'holy' || s === 'valkyrie' || s === 'crescent') s = 'lotusMandala';
      else if (s === 'war' || s === 'thunder' || s === 'bloodbone' || s === 'demonGate') s = 'talismanSeal';
      else if (s === 'glacier' || s === 'nature' || s === 'leviathan' || s === 'cyberRune') s = 'xianxiaSword';
      else if (s === 'siegeCataclysm' || s === 'abyss') s = 'dragonFlame';
      else s = 'qimenComplex';
    } else if (trad === 'western' && EASTERN_SIGIL_STYLES.has(s)) {
      if (s === 'baguaSimple') s = 'runeSimple';
      else if (s === 'qimenComplex') s = 'solomon';
      else if (s === 'talismanSeal') s = 'hermeticAlchemy';
      else if (s === 'xianxiaSword') s = 'valkyrie';
      else if (s === 'lotusMandala') s = 'celestial';
      else if (s === 'dragonFlame') s = 'demonGate';
      else s = 'holy';
    }

    const comp = FX_CONFIG.sigilComplexity;
    const isEast = EASTERN_SIGIL_STYLES.has(s);
    if (comp === 'simple1') {
      s = isEast ? 'baguaSimple' : 'runeSimple';
    } else if (comp === 'qimen_square' || comp === 'talisman_seal') {
      s = isEast ? 'talismanSeal' : 'hermeticAlchemy';
    } else if (comp === 'sword_lotus') {
      s = isEast ? 'xianxiaSword' : 'valkyrie';
    } else if (comp === 'siege4') {
      s = isEast ? 'qimenComplex' : 'siegeCataclysm';
    }
  }
  return s;
}

export function resolveSigilTex(style = 'arcane', exact = false) {
  const lib = getTexLib();
  if (FX_CONFIG.tier === 1) return lib.svgSigil;
  if (FX_CONFIG.tier === 2) return lib.procSigil;

  const s = remapSigilStyle(style, exact);

  // Tier 3 uses stylized / clean geometric sigils; Tier 4 unlocks all 27 realistic chiseled multi-material sigils!
  if (FX_CONFIG.tier === 3) {
    if (s === 'baguaSimple') return lib.sigilBaguaSimple;
    if (s === 'runeSimple') return lib.sigilRuneSimple;
    if (s === 'holy' || s === 'solomon' || s === 'valkyrie' || s === 'lotusMandala') return lib.sigilHoly;
    if (s === 'abyss' || s === 'bloodbone' || s === 'demonGate' || s === 'siegeCataclysm') return lib.sigilAbyss;
    if (s === 'nature' || s === 'leviathan' || s === 'xianxiaSword') return lib.sigilNature;
    if (s === 'war' || s === 'dragonFlame' || s === 'phoenix' || s === 'thunder' || s === 'talismanSeal') return lib.sigilWar;
    if (s === 'crescent' || s === 'chrono' || s === 'celestial' || s === 'qimenComplex' || s === 'kabbalahTree') return lib.sigilCrescent;
    return lib.sigilArcane;
  }

  switch (s) {
    case 'holy':            return lib.sigilHoly;
    case 'abyss':           return lib.sigilAbyss;
    case 'nature':          return lib.sigilNature;
    case 'war':             return lib.sigilWar;
    case 'crescent':        return lib.sigilCrescent;
    case 'solomon':         return lib.sigilSolomon;
    case 'dragonFlame':     return lib.sigilDragonFlame;
    case 'glacier':         return lib.sigilGlacier;
    case 'thunder':         return lib.sigilThunder;
    case 'bloodbone':       return lib.sigilBloodbone;
    case 'chrono':          return lib.sigilChrono;
    case 'celestial':       return lib.sigilCelestial;
    case 'phoenix':         return lib.sigilPhoenix;
    case 'valkyrie':        return lib.sigilValkyrie;
    case 'leviathan':       return lib.sigilLeviathan;
    case 'demonGate':       return lib.sigilDemonGate;
    case 'cyberRune':       return lib.sigilCyberRune;
    case 'baguaSimple':     return lib.sigilBaguaSimple;
    case 'qimenComplex':    return lib.sigilQimenComplex;
    case 'talismanSeal':    return lib.sigilTalismanSeal;
    case 'xianxiaSword':    return lib.sigilXianxiaSword;
    case 'lotusMandala':    return lib.sigilLotusMandala;
    case 'runeSimple':      return lib.sigilRuneSimple;
    case 'hermeticAlchemy': return lib.sigilHermeticAlchemy;
    case 'kabbalahTree':    return lib.sigilKabbalahTree;
    case 'siegeCataclysm':  return lib.sigilSiegeCataclysm;
    default:                return lib.sigilArcane;
  }
}

export function resolveFlipbookTex(atlas = 'fbFlame') {
  const lib = getTexLib();
  if (FX_CONFIG.tier === 1) return lib.svgFlipbook;
  if (FX_CONFIG.tier === 2) return lib.procFlipbook;
  return lib[atlas] || lib.fbFlame;
}

export function resolveEnvGroundTex(kind = 'burning') {
  const lib = getTexLib();
  if (FX_CONFIG.tier === 1) return lib.svgSigil;
  if (FX_CONFIG.tier === 2) return lib.procSigil;
  switch (kind) {
    case 'frost':     return lib.envFrostGround;
    case 'crater':    return lib.envShatterCrater;
    case 'poison':    return lib.envPoisonSwamp;
    case 'lightning': return lib.envLightningScorch;
    case 'holy':      return lib.envHolyConsecrate;
    case 'void':      return lib.envVoidCorruption;
    case 'sand':      return lib.envSandWhirl;
    default:          return lib.envScorchLava;
  }
}
