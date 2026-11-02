// ============================================================================
// VFX3D Arsenal — Bilingual UI & Catalog Localization (`en` default / `zh`)
// ============================================================================

import { FX_CONFIG } from './texgen3d.js';
import { getEffectiveMoveHitbox } from './core3d.js';
import { getEffectiveChantSpec, isMartialWeaponMove } from './chant_system3d.js';

const STORAGE_KEY = 'vfx3d_arsenal_lang';

export function detectInitialLang(searchParams) {
  const q = searchParams?.get?.('lang')?.toLowerCase?.();
  if (q === 'zh' || q === 'zh-tw' || q === 'zh-hant') return 'zh';
  if (q === 'en') return 'en';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    // Ignore storage errors in sandboxed/private contexts
  }
  return 'en';
}

export function setActiveLang(lang) {
  const next = lang === 'zh' ? 'zh' : 'en';
  FX_CONFIG.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore storage errors
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next === 'zh' ? 'zh-Hant' : 'en';
    document.title = next === 'zh'
      ? 'VFX3D Arsenal — 開源真 3D 遊戲特效全武庫 (398 招・66 貼圖・24 幾何・GLB/ZIP 匯出)'
      : 'VFX3D Arsenal — Open-Source True-3D WebGL Game VFX Library (398 Presets · GLB/ZIP Export)';
  }
  return next;
}

export const CATEGORIES_I18N = {
  all:          { en: 'All Presets',          zh: '全部特效' },
  bow:          { en: '🏹 Archery & Volley',   zh: '🏹 弓箭射擊／箭雨' },
  aaa_env:      { en: '🌟 Sustained Zones',    zh: '🌟 3A 環境/持續區域/寫實陣' },
  heal_support: { en: '💚 Heal & Party Buffs', zh: '💚 治癒/護盾/隊友輔助' },
  summon_zone:  { en: '🐉 Summons & Domains',  zh: '🐉 召喚魔法/領域結界' },
  gamedev_algo: { en: '🧮 GameDev Algorithms', zh: '🧮 遊戲演算法實戰' },
  melee:        { en: '⚔️ Melee & Blade Arts', zh: '⚔️ 刀劍武技' },
  defense:      { en: '🛡️ Shields & Wards',    zh: '🛡️ 半透明盾防' },
  charge:       { en: '💥 Charge & Burst',     zh: '💥 蓄力爆發技' },
  buff_debuff:  { en: '🧪 Warcries & Curses',  zh: '🧪 增益/減益/戰吼' },
  leap_spell:   { en: '☄️ Leaps & Grand Spells', zh: '☄️ 衝鋒/飛天/大法術' },
  ui_fx:        { en: '💎 Loot & Portals',     zh: '💎 系統/拾取/轉場' },
  fire:         { en: '🔥 Fire & Magma',       zh: '🔥 烈焰爆破' },
  ice:          { en: '❄️ Frost & Aqua',       zh: '❄️ 寒冰水系' },
  volt:         { en: '⚡ Lightning & Storm',  zh: '⚡ 雷電戰錘' },
  arcane:       { en: '🔮 Arcane & Astral',    zh: '🔮 奧術星界' },
  holy:         { en: '✨ Holy & Radiant',     zh: '✨ 神聖巨劍' },
  shadow:       { en: '💀 Shadow & Blood',     zh: '💀 暗影鎖鏈' },
  earth:        { en: '🪨 Earth & Basalt',     zh: '🪨 大地巨岩' },
};

export const CHANT_MODES_EN = {
  auto:              '✨ Smart Auto Chant (Matches class & spell archetype)',
  sequential_4tier:  '📿 4-Tier Sequential Grand Array (All skills)',
  eastern_qimen:     '☯️ Eastern Qimen Nine-Palace Array (Circle-in-Square)',
  western_cathedral: '✡️ Western Solomonic Cathedral Rings (Multi-ring)',
  barrel_cannon:     '🎯 Vertical Rail-Gate Magic Barrel (Forward gate)',
  sacred_prayer:     '💚 Sacred Golden-Lotus Benediction (Sanctuary array)',
  martial_qi:        '⚔️ Martial Qi Stance Gather (Weapon wind · Zero sigil)',
  abyss_pact:        '💀 Abyssal Obsidian Blood-Pact Array (Shadow runes)',
  none:              '⚡ Instant Cast (0.00s zero wind-up)',
};

export const CHARGE_VARIANTS_EN = {
  auto:        'Preset Default (Auto)',
  astrolabe:   '⚙️ 3-Axis Armillary Rings',
  helix:       '🐉 Twin Dragon Helix',
  debris:      '🪨 Levitating Basalt Debris',
  tesla:       '⚡ Tesla Arc Cage',
  mirage:      '👥 4-Way Phantom Convergence',
  funnels:     '💎 Hex Prism Funnels',
  singularity: '🕳️ Event-Horizon Lens',
  wings:       '🪽 Awakened Seraph Wings',
};

export const MESH_PROPS_EN = {
  aegis_shield:              { title: 'Rose Cathedral Tower Shield',   sub: 'Curved Fresnel ward + holy sigil projection' },
  spirit_greatsword:         { title: 'Starlight Astral Greatsword',   sub: '4-bevel diamond blade + crossguard' },
  storm_warhammer:           { title: 'Thunderbreaker Siege Hammer',   sub: 'Twin-cone head + spinning plasma coils' },
  reaper_scythe:             { title: 'Crimson Soul-Reaper Scythe',    sub: 'Curved crescent blade + dorsal bone spikes' },
  dragon_head:               { title: 'Azure Inferno Dragon Crest',    sub: 'Horned dragon skull + articulated jaw & orb' },
  seraph_wings:              { title: 'Twelve-Plume Seraph Wings',     sub: '12 articulated light plumes + halo ring' },
  armillary_astrolabe:       { title: 'Tri-Axial Armillary Astrolabe', sub: 'Interlocking gear rings + octahedron star core' },
  magma_meteor:              { title: 'Obsidian Magma Meteor',         sub: 'Fractured basalt crust + 3D lava fissures' },
  dragon_arrow:              { title: 'Supersonic Mach Great-Arrow',   sub: 'Armor-piercing broadhead + Mach shock cones' },
  holy_chalice:              { title: 'Lathe-Turned Sacred Chalice',   sub: 'Turned gold goblet + levitating radiant drop' },
  runic_obelisk:             { title: 'Floating Runic Obelisk',        sub: 'Hexagonal monolith + levitating capstone rings' },
  soul_chain:                { title: 'Barbed Soul-Harpoon Chain',     sub: '90° alternating 3D links + barbed spearhead' },
  glacier_cluster:           { title: 'Hexagonal Glacier Crystal',     sub: '7-spire double-terminated ice prisms + Fresnel' },
  manifold_slash:            { title: 'Closed Manifold Blade Arc',     sub: 'Volumetric diamond-cross-section slash mesh' },
  crown_shockwave:           { title: 'Crown Ground-Shockwave Ring',   sub: 'Dual expanding wave skirt + 14 impact spikes' },
  vortex_funnel:             { title: 'Counter-Rotating Vortex Cone',  sub: 'Dual-shell helical cyclone funnel' },
  blackhole_core:            { title: 'Event-Horizon Accretion Core',  sub: 'Relativistic horizon sphere + polar twin jets' },
  geodesic_flipvol:          { title: '4-Shell Geodesic Volume Cage',  sub: 'Tri-axial 60° crossed shells + top cap' },
  qimen_compass:             { title: 'Qimen Divination Astrolabe',    sub: 'Damascus steel + carved jade relief shader' },
  immortal_azure_greatsword: { title: 'Azure Dragon Fullered Blade',   sub: 'Damascus fuller groove + twin-dragon guard' },
  solomon_summon_gate:       { title: 'Solomonic Obsidian Portal',     sub: 'Fluted magma-relief twin pillars + rift vortex' },
  glacier_prism_golem:       { title: 'Abyssal Frost-Prism Core',      sub: 'Sapphire caustic micro-relief armor' },
  world_tree_staff:          { title: 'World-Tree Emerald Greatstaff', sub: '3-strand living roots + levitating emerald heart' },
  seraph_resurrection_ankh:  { title: 'Seraphic Resurrection Ankh',    sub: 'Beveled gold cross + 6-wing radiant core' },
};

export const TEX_CATALOG_EN = {
  sigilBaguaSimple:     { title: 'Primordial Bagua Single Ring',    badge: 'Eastern · 1-Layer' },
  sigilQimenComplex:    { title: 'Qimen 28-Constellation Compass',  badge: 'Eastern · 3-Layer' },
  sigilTalismanSeal:    { title: 'Five-Thunder Square Seal Array',  badge: 'Eastern · Talisman' },
  sigilXianxiaSword:    { title: 'Eight-Trigram Lotus Sword Array', badge: 'Eastern · Sword Array' },
  sigilLotusMandala:    { title: 'Thousand-Petal Golden Mandala',   badge: 'Eastern · Mandala' },
  sigilRuneSimple:      { title: 'Nordic Runic Base Cast Ring',     badge: 'Western · 1-Layer' },
  sigilHermeticAlchemy: { title: 'Hermetic Tri-Element Alchemy',    badge: 'Western · Alchemy' },
  sigilKabbalahTree:    { title: 'Sephiirot Celestial Tree Array',  badge: 'Western · Star-Track' },
  sigilSiegeCataclysm:  { title: 'Obsidian 8-Node Cataclysm Array', badge: 'Grand · 4-Tier Array' },
  sigilSolomon:         { title: 'Solomonic Brass & Gem Relief',    badge: 'Western · Chiseled' },
  sigilDragonFlame:     { title: 'Coiled Dragon Obsidian Magma',    badge: 'Eastern · Obsidian' },
  sigilGlacier:         { title: 'Boreal Silver & Sapphire Ice',    badge: 'Western · Silver Ice' },
  sigilThunder:         { title: 'Bronze Storm-Hammer Arc Sigil',   badge: 'Western · Bronze' },
  sigilBloodbone:       { title: 'Gothic Wrought-Iron Blood Pact',  badge: 'Western · Iron & Bone' },
  sigilChrono:          { title: 'Clockwork Astrolabe Chrono Ring', badge: 'Western · Clockwork' },
  sigilCelestial:       { title: 'Platinum Sapphire Zodiac Wheel',  badge: 'Western · Zodiac' },
  sigilPhoenix:         { title: 'Vermilion Gold Phoenix Plume',    badge: 'Eastern · Gold Amber' },
  sigilValkyrie:        { title: 'Valkyrie Marble Winged Spear',    badge: 'Western · Marble Gold' },
  sigilLeviathan:       { title: 'Abyssal Bronze & Nacre Coral',    badge: 'Western · Nacre' },
  sigilDemonGate:       { title: 'Infernal Chained Obsidian Gate',  badge: 'Western · Forged Iron' },
  sigilCyberRune:       { title: 'Magitek Titanium Hex Matrix',     badge: 'Western · Magitek' },
  sigilArcane:          { title: 'Astral Dual-Zodiac Arcane Ring',  badge: 'Western · Stylized' },
  sigilHoly:            { title: 'Cathedral Rose-Window Halo',      badge: 'Western · Stylized' },
  sigilAbyss:           { title: 'Abyssal Briar Eclipse Crest',     badge: 'Western · Stylized' },
  sigilNature:          { title: 'World-Tree Jade Vine Crest',      badge: 'Western · Stylized' },
  sigilWar:             { title: 'Twin-Axe Solar Warlord Crest',    badge: 'Western · Stylized' },
  sigilCrescent:        { title: 'Starlight Crescent Plume Ring',   badge: 'Western · Stylized' },

  envScorchLava:        { title: 'Scorched Basalt Lava Fissures',   badge: 'Ground Destruction' },
  envFrostGround:       { title: 'Deep Snow & Sapphire Permafrost', badge: 'Weather Decal' },
  envShatterCrater:     { title: 'Concentric Impact Crater',        badge: 'Ground Destruction' },
  envPoisonSwamp:       { title: 'Bubbling Venom Mire Decal',       badge: 'Hazard Decal' },
  envLightningScorch:   { title: 'Fulgurite Lightning Scorch',      badge: 'Impact Decal' },
  envHolyConsecrate:    { title: 'Consecrated Gold-Inlaid Marble',  badge: 'Sanctuary Decal' },
  envVoidCorruption:    { title: 'Obsidian Void Rift Corruption',   badge: 'Rift Decal' },
  envSandWhirl:         { title: 'Desert Sandstone Vortex Decal',   badge: 'Weather Decal' },

  fbFlame:              { title: 'Roiling Inferno Flame 4×4',       badge: '16-Frame SubUV' },
  fbExplosion:          { title: 'Detonation Fireball Plume 4×4',   badge: '16-Frame SubUV' },
  fbSmoke:              { title: 'Volumetric Billowing Smoke 4×4',  badge: '16-Frame SubUV' },
  fbLightning:          { title: 'High-Voltage Forked Arc 4×4',     badge: '16-Frame SubUV' },
  fbSlash:              { title: 'Fluid Energy Blade Arc 4×4',      badge: '16-Frame SubUV' },
  fbHitBurst:           { title: 'Supernova Impact Flash 4×4',      badge: '16-Frame SubUV' },
  fbMagicSwirl:         { title: 'Nebula Collapse Swirl 4×4',       badge: '16-Frame SubUV' },
  fbLiquid:             { title: 'Cryo Hydro Splash Mist 4×4',      badge: '16-Frame SubUV' },
  fbPoison:             { title: 'Acidic Venom Bubble Burst 4×4',   badge: '16-Frame SubUV' },
  fbBlessing:           { title: 'Radiant Plume Ascension 4×4',     badge: '16-Frame SubUV' },
  fbStarburst:          { title: 'Prismatic Astral Flare 4×4',      badge: '16-Frame SubUV' },
  fbIceShatter:         { title: 'Crystalline Ice Shatter 4×4',     badge: '16-Frame SubUV' },
  fbRockBurst:          { title: 'Basalt Shrapnel Eruption 4×4',    badge: '16-Frame SubUV' },
  fbWindTornado:        { title: 'Emerald Gale Wind-Blades 4×4',    badge: '16-Frame SubUV' },
  fbDarkVortex:         { title: 'Event-Horizon Tendrils 4×4',      badge: '16-Frame SubUV' },
  fbFeatherBurst:       { title: 'Golden Seraph Feathers 4×4',      badge: '16-Frame SubUV' },
  fbBloodSplash:        { title: 'Crimson Thorn Burst 4×4',         badge: '16-Frame SubUV' },

  slashSilk:            { title: 'Flowing Silk Blade Trail UV',     badge: 'Seamless Slash UV' },
  slashFlame:           { title: 'Solar Prominence Blade UV',       badge: 'Seamless Slash UV' },
  slashVolt:            { title: 'Plasma Lightning Blade UV',       badge: 'Seamless Slash UV' },
  slashVoid:            { title: 'Dimensional Rift Blade UV',       badge: 'Seamless Slash UV' },
  slashFrost:           { title: 'Glacial Rime Blade UV',           badge: 'Seamless Slash UV' },
  slashBlood:           { title: 'Crimson Briar Blade UV',          badge: 'Seamless Slash UV' },
  auraRunes:            { title: 'Ascending Runic Pillar UV',       badge: 'Seamless Aura UV' },
  hexShield:            { title: 'Hexagonal Forcefield Lattice',    badge: 'Tileable Pattern' },
  causticsWater:        { title: 'Abyssal Water Caustics Map',      badge: 'Tileable Pattern' },
  crackedMagma:         { title: 'Molten Basalt Crust Map',         badge: 'Tileable Pattern' },
  flowNoise:            { title: 'Dual-Channel Flow Erosion Map',   badge: 'Shader Data Map' },
  chargeVortex:         { title: 'Centripetal Plasma Suction Map',  badge: '3D Charge Map' },
  chargeQiFlow:         { title: 'Meridian Qi Stream Filaments',    badge: '3D Charge Map' },
  metalDamascus:        { title: 'Gilded Damascus Forged Steel',    badge: 'Triplanar PBR Map' },
};

export const UI_STRINGS = {
  en: {
    brandTitle: 'VFX3D Arsenal',
    brandBadge: '398 FX · 66 Tex · 24 Meshes · MIT',
    searchPlaceholder: '🔍 Search 398 VFX (blizzard, arrow rain, judgment, heal, shield, voronoi...)',
    searchAria: 'Search VFX presets',
    shortcutHint: 'Keys: ↑/↓ Prev/Next · F Peak Frame · Space Play/Pause · R Replay',
    dockMesh: '🧊 3D Props (24)',
    dockTex: '🖼 Textures (66)',
    dockAtlas: '⛶ Atlas',
    dockExport: '📦 Export 3D',
    dockExportTitle: 'Export animated .GLB / .OBJ / .ZIP package for Blender, UE5, Unity & Godot',
    wireBtn: '🕸 Wireframe',
    soloBtnEnter: '🔍 Stage Solo',
    soloBtnExit: '✕ Exit Solo',
    ttBottomHint: 'Triplanar Relief · Scroll Zoom',
    texCatAll: 'All (66)',
    texCatSigil: 'Sigils (27)',
    texCatFlipbook: '4×4 Flipbooks (17)',
    texCatEnv: 'Ground (8)',
    texCatUv: 'Slash / UV (14)',
    tierLabels: {
      1: 'T1: SVG Vector',
      2: 'T2: Procedural Shader',
      3: 'T3: Stylized HD',
      4: 'T4: Ultra 3D + Physics',
    },
    tierBtns: {
      1: 'T1 Vector',
      2: 'T2 Procedural',
      3: 'T3 HD Atlas',
      4: 'T4 Ultra 3D',
    },
    tierTips: {
      1: 'Clean runtime SVG vector masks & single-hue additive shaders',
      2: 'Pure mathematical fBm/Voronoi procedural shaders with zero external textures',
      3: 'High-resolution 4×4 SubUV flipbooks & stylized sigils',
      4: 'Chiseled multi-material sigils + basalt rock physics + ground craters + air refraction',
    },
    hitstopBadge: '⚡ Hitstop',
    secTier: '🏆 Scalability Tier (T1 Vector → T4 Ultra 3D + Env Physics)',
    secChant: '📿 Global Caster Chanting (Pre-Release)',
    lblChantTime: 'Chant Time',
    secScale: '📏 Scope / 🎯 Range / 🔥 Linger',
    btnReset: 'Reset',
    lblAoe: 'AoE Radius',
    lblRange: 'Cast Range',
    lblLinger: 'Ground Linger',
    lblWindX: 'Wind X',
    lblWindZ: 'Wind Z',
    secTrad: '☯️ Sigil Tradition',
    tradOptions: {
      auto: 'Preset Default (Auto)',
      eastern: 'Eastern (Bagua / Qimen / Talisman / Sword)',
      western: 'Western (Solomon / Runic / Kabbalah)',
    },
    secComp: '🔮 Sigil Layers & Archetype',
    compOptions: {
      auto: 'Preset Default (Auto)',
      simple1: 'Minimal 1-Layer Cast Ring',
      dual2: 'Standard 2-Layer Counter-Spin',
      complex3: 'Complex 3-Tier Astral Tower',
      siege4: 'Grand 4-Tier 8-Node Array',
      qimen_square: 'Circle-in-Square Qimen Palace',
      talisman_seal: 'Levitating Talisman Seal Cross',
      sword_lotus: 'Sword-Lotus Sword Formation',
    },
    secCharge: '⚡ 3D Charge Variants (8)',
    secSlashUv: '🎨 Blade / Flow UV Map',
    slashUvOptions: {
      auto: 'Preset Default (Auto)',
      silk: 'Flowing Silk (Silk)',
      flame: 'Solar Prominence (Flame)',
      volt: 'Plasma Arc (Volt)',
      void: 'Void Rift (Void)',
      frost: 'Glacial Rime (Frost)',
      blood: 'Crimson Thorn (Blood)',
    },
    secPalette: '🌈 Color Temperature Ramps (16 Multi-Hue Gradients)',
    paletteOptions: {
      '': 'Preset Default Multi-Hue Ramp',
      fireInferno: 'Inferno Flame: Charcoal Violet → Crimson → Gold → White Plasma',
      warriorGold: 'Sovereign Gold: Deep Red → Blazing Orange → Imperial Gold → Warm Core',
      mageFrost: 'Glacial Cryo: Abyssal Navy → Cyan → Ice Blue → Warm Crystal White',
      waterAqua: 'Abyssal Aqua: Midnight Blue → Cobalt → Caustic Teal → Pearl White',
      mageVolt: 'Celestial Volt: Indigo → Electric Blue → Cyan Arc → Lime-White Core',
      windJade: 'Emerald Gale: Deep Teal → Jade Green → Spring Lime → Morning White',
      mageEmerald: 'Astral Emerald: Forest Slate → Emerald → Bioluminescent Green → Starlight',
      mageArcane: 'Astral Arcane: Night Indigo → Sapphire → Magenta-Cyan → Warm Gold Core',
      mageViolet: 'Dimensional Violet: Deep Plum → Neon Violet → Sakura Pink → Ice White',
      holyGold: 'Cathedral Radiance: Rose Umber → Amber Gold → Radiant Yellow → Diamond',
      voidAbyss: 'Event Horizon: Obsidian → Dark Violet → Neon Magenta → Pale Cyan Rim',
      rogueBlood: 'Crimson Eclipse: Black-Violet → Dark Ruby → Scarlet → Molten Gold Core',
      poison: 'Venom Mire: Dark Sludge → Toxic Green → Acid Chartreuse → Pale Mist',
      earthMagma: 'Tectonic Magma: Basalt Black → Ochre → Molten Orange → Incandescent Gold',
      rogueShadow: 'Phantom Dusk: Midnight → Royal Purple → Neon Magenta → Silver Cyan',
      warriorSilver: 'Tempered Steel: Gunmetal Blue → Cobalt → Frost Cyan → Warm Edge',
    },
    btnPeak: '🔍 Peak Frame (F)',
    camBtns: { iso: '45°', side: 'Side', top: 'Top', front: 'Front' },
    chkActors: 'Actors',
    chkHitbox: 'Hitbox',
    chkLoop: 'Loop',
    chkShake: '📳 Trauma² Shake',
    chkShakeTip: 'Smooth trauma-squared procedural camera impulse on heavy impacts',
    chkSoft: 'Soft Particles',
    chkSoftTip: 'Scene-depth intersection softening for SubUV flipbooks & volumetric meshes',
    chkOverdraw: '🔥 Overdraw',
    chkOverdrawTip: 'Additive fragment overdraw heatmap diagnostic view',
    btnPause: '⏸ Pause',
    btnPlay: '▶ Play',
    btnReplay: '↺ Replay (R)',
    btnFocusEnter: '⛶ Focus Stage',
    btnFocusExit: '⛶ Show Panels',
    btnPrevFrame: '◀ -1f',
    btnNextFrame: '+1f ▶',
    speedBtns: { '1': '1x', '0.35': '0.35x Slow', '0.15': '0.15x Step' },
    btnExportBottom: '📦 Export 3D Pack',
    soloHudPrefix: '🧊 3D Prop Inspect: ',
    fxCountTpl: (n, dc, ms) => `FX:${n} · DC:${dc} · ${ms}/16.7ms`,
    chantInstant: 'Instant (0.00s)',
    chantPreTpl: (sec, stages, isMartial) => `Pre-Cast ${sec}s · ${stages} ${isMartial ? 'Qi Stages' : 'Tiers'}`,
    expTitle: '📦 Universal 3D VFX Exporter (.GLB / .OBJ / .WEBP / .ZIP)',
    btnClose: '✕ Close',
    expStep1: '1️⃣ Choose Target Asset',
    expModeSkillPrefix: '🎬 Export Active 3D VFX Skill (',
    expModeSkillSuffix: ') — Includes pre-release chant array + baked keyframes',
    expModeProp: '🧊 Export Standalone BMesh 3D Prop (.glb + .obj/.mtl + PBR/SubUV textures)',
    expPropLbl: '🧊 3D Geometry Prop (24)',
    expFpsLbl: '🎞 Keyframe Bake Rate (FPS)',
    expFpsOptions: {
      '24': '24 FPS (Blender / Maya Film Standard)',
      '30': '30 FPS (UE5 Niagara / Unity Real-Time)',
      '60': '60 FPS (High-Density Bake)',
    },
    expChkActors: 'Include Caster, Party Allies & Target Dummy 3D rigs + pose keyframes',
    expStep2: '2️⃣ One-Click Cross-Engine Bundle (Blender / UE5 / Unity / Maya / Houdini / Godot / Cascadeur)',
    expBulletsHtml:
      '• <b><code>scene_animated.glb</code></b>: Khronos Binary glTF 2.0 with meshes, sampled GPU spark trajectories, continuous quaternion TRS tracks, <code>KHR_materials_emissive_strength</code> & <code>EXT_texture_webp</code><br/>' +
      '• <b><code>meshes/*.glb, *.obj, *.mtl</code></b> + <b><code>textures/*.webp</code></b>: Standalone high-craft 3D props and referenced sigils, 4×4 SubUV flipbooks & ground decals<br/>' +
      '• <b><code>import_blender.py</code> / <code>import_maya.py</code> / <code>UnityVfxImporter.cs</code> / <code>ue5_niagara_emitter.json</code></b>: Ready-to-run DCC & game-engine bridge scripts',
    btnDoZip: '📦 Download Full Cross-Engine Pack (.zip)',
    btnDoGlb: '🧊 Download Standalone Binary (.glb)',
    expReadyMsg: 'Ready: Click either button above to bake and download locally in your browser.',
    expStep3: '3️⃣ Headless CLI Batch Export & Native Blender BMesh Generator',
    atlasTitle: '🧊 24 BMesh Triplanar 3D Geometry Props + 🎨 66 High-Res VFX WebP Textures',
    atlasIntroHtml:
      'Click any <b>3D Geometry Prop card</b> below to load it into the interactive 3D turntable (with BMesh beveled fullers & seamless triplanar relief). Also inspect all <b>17 animated 4×4 (16-frame) SubUV flipbooks</b>, <b>27 Eastern/Western orthographic magic sigils</b>, <b>8 ground destruction decals</b>, and <b>14 seamless blade/charge/PBR maps</b>:',
    atlasSecMesh: '▶ 24 Procedural BMesh 3D Geometry Props (Click any card to inspect on turntable)',
    atlasSecFb: '▶ 17 Animated 4×4 (16-Frame) SubUV Sprite Flipbooks (4×4 sheet + live 20 FPS preview)',
    atlasSecSigil: '▶ 27 Eastern & Western Multi-Layer Magic Circle Sigils',
    atlasSecEnv: '▶ 8 Ground Destruction Decals + 14 Charge Vortex / Qi / Damascus / Blade UV Maps',
  },
  zh: {
    brandTitle: 'VFX3D Arsenal',
    brandBadge: '398招・66貼圖・24幾何・MIT',
    searchPlaceholder: '🔍 搜尋 (弓箭射擊、箭雨、治癒、護盾、詠唱、召喚...)',
    searchAria: '搜尋特效',
    shortcutHint: '快捷鍵：↑/↓ 切換招式 ｜ F 定格高潮幀 ｜ 空白鍵暫停 ｜ R 重播',
    dockMesh: '🧊 幾何(24)',
    dockTex: '🖼 貼圖(66)',
    dockAtlas: '⛶ 大圖',
    dockExport: '📦 匯出3D包',
    dockExportTitle: '打包匯出至 Blender / UE5 / Unity / Maya / Godot',
    wireBtn: '🕸 線框',
    soloBtnEnter: '🔍 主場景放大',
    soloBtnExit: '✕ 退出主場景',
    ttBottomHint: '三平面浮雕貼圖 · 滾輪縮放',
    texCatAll: '全部 (66)',
    texCatSigil: '中西/禁咒法陣 (27)',
    texCatFlipbook: '16格序列圖 (17)',
    texCatEnv: '環境地表 (8)',
    texCatUv: '刀光/聚氣/材質 (14)',
    tierLabels: {
      1: 'T1: SVG簡約向量',
      2: 'T2: 程序化Shader',
      3: 'T3: 高清風格貼圖',
      4: 'T4: 3A寫實+環境物理',
    },
    tierBtns: {
      1: 'T1 SVG簡約',
      2: 'T2 程序化',
      3: 'T3 高清貼圖',
      4: 'T4 3A寫實+環境',
    },
    tierTips: {
      1: '簡約 SVG 向量幾何與單色混合',
      2: '程序化數學噪聲與雙色漸層 Shader',
      3: '高清風格化貼圖與 4×4 序列圖',
      4: '多材質浮雕法陣 + 噴出石塊 + 多貼圖拼接地裂 + 空氣折射',
    },
    hitstopBadge: '⚡ 頓幀',
    secTier: '🏆 特效品質分級 (簡約 SVG 程序化 → 寫實貼圖+環境物理)',
    secChant: '📿 全技能通用施法者詠唱 (完畢後才釋放)',
    lblChantTime: '詠唱時間',
    secScale: '📏 範圍 / 🎯 距離 / 🔥 殘留',
    btnReset: '重置',
    lblAoe: '作用範圍',
    lblRange: '施放距離',
    lblLinger: '地面殘留',
    lblWindX: '環境風 X',
    lblWindZ: '環境風 Z',
    secTrad: '☯️ 法陣體系 (中西區分)',
    tradOptions: {
      auto: '依招式預設體系 (Auto)',
      eastern: '東方中式 (八卦/奇門/符印/仙劍)',
      western: '西方歐式 (所羅門/盧恩/卡巴拉)',
    },
    secComp: '🔮 圖層/繁簡/複合大陣',
    compOptions: {
      auto: '依招式預設圖層 (Auto)',
      simple1: '極簡 1 層單環吟唱陣',
      dual2: '標準 2 層正反雙旋陣',
      complex3: '繁複 3 層立體星軌塔',
      siege4: '禁咒級 4 層八門子母大陣',
      qimen_square: '外圓內方奇門九宮陣',
      talisman_seal: '懸浮符籙鎮封十字陣',
      sword_lotus: '太虛御劍青蓮劍陣',
    },
    secCharge: '⚡ 紋理蓄力變體 (8種)',
    secSlashUv: '🎨 刀光/流體 UV 貼圖',
    slashUvOptions: {
      auto: '各招專屬貼圖 (Auto)',
      silk: '流雲絲綢刀紋 (Silk)',
      flame: '日珥熔火刀紋 (Flame)',
      volt: '雷霆電漿刀紋 (Volt)',
      void: '虛空裂隙刀紋 (Void)',
      frost: '極寒冰稜刀紋 (Frost)',
      blood: '腥紅血棘刀紋 (Blood)',
    },
    secPalette: '🌈 多色相色溫梯度色盤 (16 組跨色相冷暖對比)',
    paletteOptions: {
      '': '原始技能專屬多色相配色 (預設)',
      fireInferno: '煉獄烈焰：深紫炭煙 → 赤紅 → 金黃 → 青白電漿',
      warriorGold: '霸王赤金：暗紅 → 烈橙 → 皇金 → 暖白核',
      mageFrost: '極寒冰晶：深海藍 → 青碧 → 冰藍 → 暖晶白',
      waterAqua: '深海利維坦：午夜藍 → 鈷藍 → 碧綠焦散 → 珍珠白',
      mageVolt: '九天雷鳴：靛紫 → 電光藍 → 青電 → 萊姆白芯',
      windJade: '翠嵐疾風：深青 → 翡翠綠 → 嫩檸綠 → 晨白',
      mageEmerald: '星風翡翠：墨青 → 祖母綠 → 螢光翠 → 星白',
      mageArcane: '星界奧術：星夜靛 → 寶藍 → 青品紅 → 暖金芯',
      mageViolet: '次元紫羅蘭：深淵紫 → 洋紅紫 → 櫻粉 → 冰青白',
      holyGold: '大聖堂聖金：玫瑰褐 → 琥珀金 → 聖耀黃 → 鑽白',
      voidAbyss: '虛空奇點：黑曜 → 暗紫 → 霓虹紫紅 → 蒼青邊',
      rogueBlood: '冥府鮮血：黑紫 → 暗紅 → 腥紅 → 赤金火芯',
      poison: '萬蠱劇毒：紫黑泥沼 → 毒綠 → 螢光酸黃 → 慘白',
      earthMagma: '地脈熔岩：玄武岩黑 → 赭石 → 熔岩橘 → 熾金',
      rogueShadow: '暗影幻殺：夜藍 → 皇家紫 → 霓虹洋紅 → 銀青',
      warriorSilver: '凜冽鋼銀：深鐵藍 → 鈷藍 → 冰青劍氣 → 暖白刃',
    },
    btnPeak: '🔍 定格高潮幀 (F)',
    camBtns: { iso: '45°', side: '側面', top: '俯視', front: '正面' },
    chkActors: '角色木樁',
    chkHitbox: '判定框',
    chkLoop: '循環',
    chkShake: '📳 Trauma²震屏',
    chkShakeTip: '重擊命中時觸發二次方衰減平滑噪聲相機震動',
    chkSoft: '粒子交界柔化',
    chkSoftTip: '以額外場景深度繪製柔化序列圖與體積粒子邊緣',
    chkOverdraw: '🔥 Overdraw熱區',
    chkOverdrawTip: '半透明粒子片段疊層熱區診斷視圖',
    btnPause: '⏸ 暫停',
    btnPlay: '▶ 播放',
    btnReplay: '↺ 重播 (R)',
    btnFocusEnter: '⛶ 專注預覽',
    btnFocusExit: '⛶ 顯示面板',
    btnPrevFrame: '◀ -1格',
    btnNextFrame: '+1格 ▶',
    speedBtns: { '1': '1x 原速', '0.35': '0.35x 慢動作', '0.15': '0.15x 逐幀' },
    btnExportBottom: '📦 匯出 3D 特效包',
    soloHudPrefix: '🧊 3D 幾何體檢視：',
    fxCountTpl: (n, dc, ms) => `單元:${n} · DC:${dc} · ${ms}/16.7ms`,
    chantInstant: '瞬發無詠唱 (0.00s)',
    chantPreTpl: (sec, stages, isMartial) => `施法前 ${sec}s · ${stages}${isMartial ? '段蓄勢' : '重陣'}`,
    expTitle: '📦 萬用 3D 特效打包與跨引擎輸出流水線 (.GLB / .OBJ / .WEBP / .ZIP)',
    btnClose: '✕ 關閉',
    expStep1: '1️⃣ 選擇匯出目標資產',
    expModeSkillPrefix: '🎬 匯出當前技能完整 3D 動畫特效包 (',
    expModeSkillSuffix: ') — 含施法者詠唱疊陣 + 遠距釋放關鍵幀',
    expModeProp: '🧊 匯出單一 BMesh 高精細 3D 幾何模型 (.glb + .obj/.mtl + PBR/SubUV 貼圖)',
    expPropLbl: '🧊 選擇 3D 幾何模型 (24款)',
    expFpsLbl: '🎞 關鍵幀烘焙幀率 (FPS)',
    expFpsOptions: {
      '24': '24 FPS (Blender / Maya 電影動畫標準)',
      '30': '30 FPS (UE5 Niagara / Unity 實機標準)',
      '60': '60 FPS (高密度逐幀烘焙)',
    },
    expChkActors: '包含施法者、友方隊友英雄與受擊木樁 3D 角色模型與動作關鍵幀',
    expStep2: '2️⃣ 一鍵匯出打包內容 (相容 Blender / UE5 / Unity / Maya / Houdini / Godot / Cascadeur)',
    expBulletsHtml:
      '• <b><code>scene_animated.glb</code></b>：標準 Khronos Binary glTF 2.0，內含全場景網格、GPU 粒子實例抽樣、連續四元數 TRS 動畫、<code>KHR_materials_emissive_strength</code> 自發光與 <code>EXT_texture_webp</code> 貼圖<br/>' +
      '• <b><code>meshes/*.glb, *.obj, *.mtl</code></b> ＋ <b><code>textures/*.webp</code></b>：獨立高精細 3D 模型與引用的魔法陣 / 4×4 序列圖 / 地裂貼圖<br/>' +
      '• <b><code>import_blender.py</code> / <code>import_maya.py</code> / <code>UnityVfxImporter.cs</code> / <code>ue5_niagara_emitter.json</code></b>：各主流 3D 軟體與引擎自動橋接腳本',
    btnDoZip: '📦 打包下載完整跨引擎特效包 (.zip)',
    btnDoGlb: '🧊 直接下載單檔動畫/模型 (.glb)',
    expReadyMsg: '準備就緒：點擊上方按鈕即可於瀏覽器內即時烘焙並下載。',
    expStep3: '3️⃣ CLI 批次輸出與原生 Blender Python 建模腳本',
    atlasTitle: '🧊 24 款 BMesh 三平面微浮雕 3D 幾何體 ＋ 🎨 66 張高解析度特效貼圖總覽',
    atlasIntroHtml:
      '點擊任一 <b>3D 幾何體卡片</b> 可直接切換至右側即時旋轉 3D 展示台（搭載 BMesh 倒角血槽拓撲與無接縫 Triplanar 貼圖）；下方完整收錄 <b>17 組 4×4 (16 格) 動態 Flipbook 序列圖</b>、<b>27 張中西體系正交魔法陣</b>、<b>8 張環境破壞/天候地表素材</b> 與 <b>14 張無縫刀光/蓄力聚氣/大馬士革鍛鋼貼圖</b>（共 66 張 WebP 素材）：',
    atlasSecMesh: '▶ 24 款 BMesh 高精細三平面微浮雕 3D 幾何體素材庫 (點擊卡片送入右側即時旋轉展示台)',
    atlasSecFb: '▶ 17 組 4×4 (16 格) 動態 Sprite Flipbook 序列圖集 (左側 4×4 原圖 ＋ 右側 20fps 即時動態預覽)',
    atlasSecSigil: '▶ 27 張中西體系 × 極簡/繁複圖層 × 外圓內方/符印/仙劍/複合大陣',
    atlasSecEnv: '▶ 8 張多貼圖程序化拼接地裂素材 ＋ 14 張蓄力漩渦 / 聚氣真氣 / 大馬士革鋼 / 無縫刀光貼圖',
  },
};

const WORD_FIXES = {
  aoe: 'AoE',
  dps: 'DPS',
  dot: 'DoT',
  hot: 'HoT',
  lod: 'LOD',
  sdf: 'SDF',
  ik: 'IK',
  ui: 'UI',
  fx: 'FX',
  vfx: 'VFX',
  qi: 'Qi',
  qimen: 'Qimen',
  bagua: 'Bagua',
  xianxia: 'Sword-Sage',
};

const PREFIX_BADGES = [
  ['heal_party_', 'Party Heal: '],
  ['heal_ally_', 'Ally Heal: '],
  ['heal_self_', 'Self Heal: '],
  ['sup_party_', 'Party Buff: '],
  ['sup_ally_', 'Ally Ward: '],
  ['sup_self_', 'Self Shield: '],
  ['chant_', 'Chant Array: '],
  ['sum_', 'Summon: '],
  ['zone_', 'Domain: '],
  ['algo_', 'Algorithm: '],
  ['env_', 'Sustained Zone: '],
  ['bow_', 'Archery: '],
  ['chg_', 'Charged: '],
  ['def_', 'Defense: '],
  ['buf_', 'Buff: '],
  ['deb_', 'Debuff: '],
  ['leap_', 'Aerial Leap: '],
  ['rush_', 'Dash Strike: '],
  ['ui_', 'System FX: '],
  ['pfx_', ''],
];

export function humanizeMoveIdEn(mv) {
  if (!mv) return '';
  if (mv.titleEn) return mv.titleEn;
  let raw = mv.id || '';
  let prefix = '';
  for (const [pre, label] of PREFIX_BADGES) {
    if (raw.startsWith(pre)) {
      raw = raw.slice(pre.length);
      prefix = label;
      break;
    }
  }
  const words = raw.split('_').filter(Boolean).map((w) => {
    const low = w.toLowerCase();
    if (WORD_FIXES[low]) return WORD_FIXES[low];
    return low.charAt(0).toUpperCase() + low.slice(1);
  });
  const durMatch = mv.title?.match(/\((\d+(?:\.\d+)?s)\)/);
  const suffix = durMatch ? ` (${durMatch[1]})` : '';
  return `${prefix}${words.join(' ')}${suffix}`;
}

export function getMoveDisplayTitle(mv, lang = FX_CONFIG.lang) {
  if (!mv) return '';
  return lang === 'zh' ? mv.title : humanizeMoveIdEn(mv);
}

export function getMoveDisplayClass(mv, lang = FX_CONFIG.lang) {
  if (!mv) return '';
  if (lang === 'zh') return mv.cls;
  const catInfo = CATEGORIES_I18N[mv.cat];
  return catInfo ? catInfo.en.replace(/^[^\wA-Za-z]+\s*/, '') : mv.codeId;
}

export function getMoveDisplayNotes(mv, lang = FX_CONFIG.lang) {
  if (!mv) return [];
  if (lang === 'zh' && Array.isArray(mv.specNotes) && mv.specNotes.length) {
    return mv.specNotes;
  }
  const hb = getEffectiveMoveHitbox(mv);
  const chant = getEffectiveChantSpec(mv);
  const martial = isMartialWeaponMove(mv);
  const team = mv.targetTeam || hb?.targetTeam || 'enemy';
  const teamDesc = team === 'party' ? '4-Hero Party Support'
    : team === 'ally' ? 'Single-Ally Support'
    : team === 'self' ? 'Self-Targeted Ward/Buff'
    : 'Hostile Combat Target';

  let shapeDesc = '3D Arena Volume';
  if (hb?.kind === 'circle') {
    shapeDesc = Math.abs(hb.cz ?? 0) >= 0.35
      ? `Circle AoE at ${hb.cz.toFixed(1)}m range (${hb.radius.toFixed(1)}m radius)`
      : `Point-Blank Circle AoE (${hb.radius.toFixed(1)}m radius)`;
  } else if (hb?.kind === 'sector') {
    shapeDesc = `Forward Cone (${hb.radius.toFixed(1)}m reach × ${hb.angleDeg.toFixed(0)}° arc)`;
  } else if (hb?.kind === 'rect') {
    shapeDesc = `Linear Corridor (${hb.length.toFixed(1)}m length × ${hb.width.toFixed(1)}m width)`;
  } else if (hb?.kind === 'chain' && hb.targets?.length) {
    const maxZ = Math.max(...hb.targets.map(([, tz]) => tz));
    shapeDesc = `Multi-Target Chain (${hb.targets.length} hops up to ${maxZ.toFixed(1)}m)`;
  }

  const chantDesc = chant.enabled && chant.duration >= 0.05
    ? `${chant.duration.toFixed(2)}s ${martial ? `${chant.stages}-stage Martial Qi stance (zero magic circle)` : `${chant.stages}-tier Arcane Array chant`} before release`
    : `Instant wind-up (${martial ? 'physical weapon trail, zero magic circle' : 'direct spell release'})`;

  const peak = (mv.peakTime ?? mv.contactTimes?.[0] ?? mv.duration * 0.45).toFixed(2);
  return [
    `${teamDesc} · ${shapeDesc} · Base clip ${mv.duration.toFixed(2)}s (climax @ +${peak}s).`,
    `Causality & Pre-Cast: ${chantDesc}; exportable to animated glTF 2.0 (.glb) & DCC package (.zip).`,
  ];
}

export function getPropDisplay(item, lang = FX_CONFIG.lang) {
  if (lang === 'zh') return { title: item.title, sub: item.sub };
  return MESH_PROPS_EN[item.id] || { title: item.id, sub: item.sub };
}

export function getTexDisplay(item, lang = FX_CONFIG.lang) {
  if (lang === 'zh') return { title: item.title, badge: item.badge };
  return TEX_CATALOG_EN[item.key] || { title: item.key, badge: item.badge };
}

export function formatHitboxMetricsI18n(mv, lang = FX_CONFIG.lang) {
  const hb = getEffectiveMoveHitbox(mv);
  if (!hb) return '';
  const team = mv.targetTeam || hb.targetTeam || 'enemy';
  if (lang === 'zh') {
    const teamTag = team === 'self' ? '💚自身 · '
      : team === 'ally' ? '💚單體隊友 · '
      : team === 'party' ? '💚全隊輔助 · ' : '';
    if (hb.kind === 'sector') return `${teamTag}距離 ${hb.radius.toFixed(2)}m · 扇角 ${hb.angleDeg.toFixed(0)}°`;
    if (hb.kind === 'circle') {
      const cz = hb.cz ?? 0;
      return Math.abs(cz) >= 0.35
        ? `${teamTag}距離 ${cz.toFixed(2)}m · 半徑 ${hb.radius.toFixed(2)}m`
        : `${teamTag}自身半徑 ${hb.radius.toFixed(2)}m`;
    }
    if (hb.kind === 'rect') return `${teamTag}射程 ${hb.length.toFixed(2)}m × 寬 ${hb.width.toFixed(2)}m`;
    if (hb.kind === 'chain' && hb.targets?.length) {
      const maxZ = Math.max(...hb.targets.map(([, tz]) => tz));
      return `${teamTag}連鎖 ${hb.targets.length} 目標 · 最遠 ${maxZ.toFixed(2)}m`;
    }
    return '';
  }

  const teamTag = team === 'self' ? '💚Self · '
    : team === 'ally' ? '💚Ally · '
    : team === 'party' ? '💚Party · ' : '';
  if (hb.kind === 'sector') return `${teamTag}Reach ${hb.radius.toFixed(2)}m · ${hb.angleDeg.toFixed(0)}°`;
  if (hb.kind === 'circle') {
    const cz = hb.cz ?? 0;
    return Math.abs(cz) >= 0.35
      ? `${teamTag}Range ${cz.toFixed(2)}m · R ${hb.radius.toFixed(2)}m`
      : `${teamTag}Self R ${hb.radius.toFixed(2)}m`;
  }
  if (hb.kind === 'rect') return `${teamTag}${hb.length.toFixed(2)}m × ${hb.width.toFixed(2)}m`;
  if (hb.kind === 'chain' && hb.targets?.length) {
    const maxZ = Math.max(...hb.targets.map(([, tz]) => tz));
    return `${teamTag}${hb.targets.length} Hops · Max ${maxZ.toFixed(2)}m`;
  }
  return '';
}
