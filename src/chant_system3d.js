import * as THREE from 'three';
import {
  TAU, clamp, lerp, ease, PAL3D, FX_CONFIG,
  GroundWave3D, ShockSphere3D,
  getEffectiveRangeScale, mapHitboxPointXZ,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import { resolvePal, spawnMartialStanceGust3D, attachWeaponBladeTrail3D } from './fx_helpers.js';
import { installChargeVariantHook } from './env_fx3d.js';
import { MagicArray3D, CastBar3D } from './magic_arrays3d.js';

export const CHANT_MODES_META = [
  { id: 'auto',              label: '✨ 智能自動詠唱 (依職業/法術自動匹配施法時間)' },
  { id: 'sequential_4tier',  label: '📿 四重逐層疊陣奧義詠唱 (全技能強制 4 階疊陣)' },
  { id: 'eastern_qimen',     label: '☯️ 東方道門奇門九宮詠唱 (全技能外圓內方陣)' },
  { id: 'western_cathedral', label: '✡️ 西方聖堂所羅門詠唱 (全技能聖堂多重環)' },
  { id: 'barrel_cannon',     label: '🎯 立體銃口穿透門詠唱 (全技能前方魔導砲門)' },
  { id: 'sacred_prayer',     label: '💚 聖禱金蓮生命祈願詠唱 (全技能治愈祝聖陣)' },
  { id: 'martial_qi',        label: '⚔️ 武神真氣鬥氣聚斂 (近戰/武器無魔法陣氣勁蓄勢)' },
  { id: 'abyss_pact',        label: '💀 深淵血契黑曜魔紋詠唱 (全技能暗影血契陣)' },
  { id: 'none',              label: '⚡ 瞬發無詠唱 (0.00s 零讀條立即出招)' },
];

const EXPLICIT_MAGIC_ARRAY_IDS = new Set([
  'chant_xianxia_myriad_swords',
  'env_reaper_blood_domain',
  'env_leviathan_maelstrom',
]);

/**
 * True when `mv` is a physical weapon or martial combat technique that MUST NOT spawn magic circles (`Sigil3D` / `MagicArray3D`).
 */
export function isMartialWeaponMove(mv) {
  if (!mv) return false;
  if (mv.noSigil) return true;
  if (mv.allowMagicArray || EXPLICIT_MAGIC_ARRAY_IDS.has(mv.id)) return false;
  const cat = mv.cat || '';
  const id = mv.id || '';
  if (cat === 'melee' || cat === 'bow') return true;
  if (cat === 'defense') {
    return id !== 'def_glacial_bastion' && id !== 'def_void_mirror';
  }
  if (cat === 'charge') {
    return id !== 'chg_staff_supernova' && id !== 'chg_crystal_funnel_cannon';
  }
  if (cat === 'leap_spell') {
    return id.startsWith('rush_') || (id.startsWith('leap_') && id !== 'leap_phoenix_rebirth');
  }
  if (cat === 'buff_debuff') {
    return (
      id.startsWith('buf_warcry_') ||
      id === 'buf_berserk_bloodlust' ||
      id === 'buf_wind_haste' ||
      id === 'buf_titan_unstoppable' ||
      id === 'deb_bleed_lacerate' ||
      id === 'deb_armor_sunder' ||
      id === 'deb_stun_dizzy' ||
      id === 'deb_rage_frenzy' ||
      id === 'deb_abyss_curse' ||
      id === 'deb_silence_seal'
    );
  }
  if (cat === 'gamedev_algo') {
    return (
      id === 'algo_swept_ricochet_railgun' ||
      id === 'algo_instanced_lod_boulder_storm' ||
      id === 'algo_boids_flocking_swords' ||
      id === 'algo_verlet_jakobsen_chains' ||
      id === 'algo_voronoi_cellular_shatter'
    );
  }
  if (cat === 'heal_support') {
    return (
      id === 'sup_self_diamond_overshield' ||
      id === 'sup_ally_aegis_guardian_cocoon' ||
      id === 'sup_party_hex_citadel_barrier' ||
      id === 'sup_party_dragon_weapon_enchant' ||
      id === 'sup_party_zephyr_tailwind_march'
    );
  }
  if (
    id === 'volt_thunderclap' ||
    id === 'volt_storm_hammer' ||
    id === 'earth_titan_spikes' ||
    id === 'earth_boulder_toss' ||
    id === 'holy_hex_shield' ||
    id === 'holy_valkyrie_aura' ||
    id === 'holy_sky_greatsword' ||
    id === 'shadow_blood_siphon' ||
    id === 'poison_venom_swamp' ||
    id === 'shadow_abyss_chains' ||
    id === 'env_cataclysm_trio'
  ) {
    return true;
  }
  return false;
}

export const ARCHETYPE_LABELS = {
  sequential_4tier:  '四重逐層疊陣',
  eastern_qimen:     '東方奇門道陣',
  western_cathedral: '西方聖堂法陣',
  barrel_cannon:     '立體銃口魔導陣',
  sacred_prayer:     '聖禱生命祝聖',
  martial_qi:        '武神真氣聚斂',
  abyss_pact:        '深淵血契魔陣',
};

export const ARCHETYPE_LABELS_EN = {
  sequential_4tier:  '4-Tier Grand Array',
  eastern_qimen:     'Qimen Nine-Palace',
  western_cathedral: 'Solomonic Cathedral',
  barrel_cannon:     'Rail-Gate Barrel',
  sacred_prayer:     'Sacred Lotus Prayer',
  martial_qi:        'Martial Qi Stance',
  abyss_pact:        'Abyssal Blood Pact',
};

function poseLerp(a, b, t) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) out[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
  return out;
}

export function inferChantPaletteAndStyle(mv, paletteOverride = null) {
  if (paletteOverride && PAL3D[paletteOverride]) {
    return { pal: PAL3D[paletteOverride], hotHex: PAL3D[paletteOverride][5], sigilStyle: 'solomon' };
  }
  const cat = mv?.cat || 'arcane';
  const id = (mv?.id || '').toLowerCase();
  if (cat === 'heal_support') {
    if (id.includes('shield') || id.includes('aegis') || id.includes('citadel')) {
      return { ...resolvePal('mageFrost', null), sigilStyle: 'solomon' };
    }
    if (id.includes('dragon')) {
      return { ...resolvePal('fireInferno', null), sigilStyle: 'dragonFlame' };
    }
    if (id.includes('resurrect') || id.includes('nirvana') || id.includes('lotus')) {
      return { ...resolvePal('holyGold', null), sigilStyle: 'lotusMandala' };
    }
    return { ...resolvePal('windJade', null), sigilStyle: 'nature' };
  }
  if (cat === 'fire' || id.includes('fire') || id.includes('meteor') || id.includes('flame')) {
    return { ...resolvePal('fireInferno', null), sigilStyle: 'dragonFlame' };
  }
  if (cat === 'ice' || id.includes('ice') || id.includes('frost') || id.includes('blizzard') || id.includes('glaci')) {
    return { ...resolvePal('mageFrost', null), sigilStyle: 'glacier' };
  }
  if (cat === 'volt' || id.includes('volt') || id.includes('thunder') || id.includes('lightn')) {
    return { ...resolvePal('mageVolt', null), sigilStyle: 'thunder' };
  }
  if (cat === 'holy' || id.includes('holy') || id.includes('seraph') || id.includes('sanct')) {
    return { ...resolvePal('holyGold', null), sigilStyle: 'valkyrie' };
  }
  if (cat === 'shadow' || id.includes('void') || id.includes('abyss') || id.includes('reaper') || id.includes('blood')) {
    return { ...resolvePal('voidAbyss', null), sigilStyle: 'demonGate' };
  }
  if (cat === 'earth' || id.includes('earth') || id.includes('rock') || id.includes('boulder')) {
    return { ...resolvePal('earthMagma', null), sigilStyle: 'solomon' };
  }
  if (cat === 'bow' || id.includes('wind') || id.includes('jade') || id.includes('xianxia')) {
    return { ...resolvePal('windJade', null), sigilStyle: 'xianxiaSword' };
  }
  if (cat === 'melee' || cat === 'defense' || cat === 'charge') {
    return { ...resolvePal('warriorGold', null), sigilStyle: 'war' };
  }
  return { ...resolvePal('mageArcane', null), sigilStyle: 'kabbalahTree' };
}

/**
 * Computes the active on-caster Chanting & Cast-Time specification for ANY skill in MOVES_3D!
 */
export function getEffectiveChantSpec(mv, fxConfig = FX_CONFIG) {
  if (!mv) return { enabled: false, duration: 0, stages: 0, archetype: 'none', label: '' };
  const mode = fxConfig.chantMode || 'auto';
  const timeScale = fxConfig.chantTimeScale ?? 1.0;
  if (mode === 'none' || timeScale <= 0.01) {
    return { enabled: false, duration: 0, stages: 0, archetype: 'none', label: '' };
  }

  // Explicit global override: applies to 100% of ALL skills (including melee, defense, bow, magic, heal!)
  if (mode !== 'auto') {
    const defaultBase = mv.baseChantDur
      || (mode === 'sequential_4tier' ? 1.75 : mode === 'barrel_cannon' ? 1.45 : mode === 'martial_qi' ? 0.90 : 1.15);
    const stages = mode === 'sequential_4tier' || mode === 'barrel_cannon' ? 4 : 3;
    const duration = +clamp(defaultBase * timeScale, 0.25, 4.80).toFixed(3);
    return {
      enabled: true,
      duration,
      stages,
      archetype: mode,
      label: ARCHETYPE_LABELS[mode] || '魔導詠唱',
    };
  }

  // Smart 'auto' mode:
  const cat = mv.cat || '';
  const id = (mv.id || '').toLowerCase();

  if (mv.noAutoChant) {
    return { enabled: false, duration: 0, stages: 0, archetype: 'none', label: '' };
  }

  // Explicit preset chant metadata (e.g., 8 ultimate spells & 16 heal/support spells)
  if (mv.baseChantDur && mv.baseChantDur > 0) {
    const archetype = mv.chantArchetype || 'sequential_4tier';
    const stages = mv.chantStages || (mv.baseChantDur >= 1.75 ? 4 : 3);
    return {
      enabled: true,
      duration: +clamp(mv.baseChantDur * timeScale, 0.28, 4.80).toFixed(3),
      stages,
      archetype,
      label: ARCHETYPE_LABELS[archetype] || '奧義詠唱',
    };
  }

  // Close-quarters instant martial combos & all physical weapon strikes stay snappy and sigil-free in 'auto'!
  if (cat === 'melee' || cat === 'defense') {
    return { enabled: false, duration: 0, stages: 0, archetype: 'none', label: '' };
  }

  if (cat === 'bow') {
    const isHeavyBow = (mv.duration ?? 2.0) >= 2.35 || (mv.hitbox?.radius ?? 0) >= 2.3;
    if (!isHeavyBow) return { enabled: false, duration: 0, stages: 0, archetype: 'none', label: '' };
    return {
      enabled: true,
      duration: +clamp(0.62 * timeScale, 0.25, 3.20).toFixed(3),
      stages: 2,
      archetype: 'martial_qi',
      label: ARCHETYPE_LABELS.martial_qi,
    };
  }

  if (isMartialWeaponMove(mv)) {
    if (cat === 'charge') {
      return {
        enabled: true,
        duration: +clamp(0.95 * timeScale, 0.25, 4.80).toFixed(3),
        stages: 3,
        archetype: 'martial_qi',
        label: ARCHETYPE_LABELS.martial_qi,
      };
    }
    return { enabled: false, duration: 0, stages: 0, archetype: 'none', label: '' };
  }

  if (cat === 'ui_fx') {
    const isInstantSlash = mv.hitbox?.kind === 'sector' && (mv.hitbox?.radius ?? 2.5) <= 3.2;
    if (isInstantSlash) return { enabled: false, duration: 0, stages: 0, archetype: 'none', label: '' };
  }

  // All casted magic, summon, regional zone, charge, buff/debuff, leap-spell, and gamedev-algo skills!
  let archetype = 'western_cathedral';
  let baseDur = 0.92;
  let stages = 3;

  if (cat === 'aaa_env' || cat === 'summon_zone') {
    baseDur = 1.28;
    stages = 3;
    archetype = id.includes('east') || id.includes('dragon') || id.includes('immortal') || id.includes('lotus')
      ? 'eastern_qimen'
      : id.includes('abyss') || id.includes('reaper') || id.includes('venom')
        ? 'abyss_pact'
        : 'sequential_4tier';
  } else if (cat === 'charge') {
    baseDur = 0.95;
    stages = 3;
    archetype = 'martial_qi';
  } else if (cat === 'holy') {
    baseDur = 0.98;
    stages = 3;
    archetype = 'sacred_prayer';
  } else if (cat === 'shadow') {
    baseDur = 0.92;
    stages = 3;
    archetype = 'abyss_pact';
  } else if (cat === 'fire' || cat === 'ice' || cat === 'volt' || cat === 'arcane' || cat === 'earth') {
    const isRectBeam = mv.hitbox?.kind === 'rect' && (mv.hitbox?.length ?? 0) >= 5.0;
    const isLargeAoE = (mv.hitbox?.radius ?? 0) >= 2.8;
    baseDur = isLargeAoE ? 1.12 : 0.86;
    stages = isLargeAoE ? 3 : 2;
    archetype = isRectBeam ? 'barrel_cannon' : (id.includes('qimen') || id.includes('bagua') ? 'eastern_qimen' : 'western_cathedral');
  } else if (cat === 'buff_debuff') {
    baseDur = 0.72;
    stages = 2;
    archetype = mv.targetTeam === 'party' ? 'sacred_prayer' : 'abyss_pact';
  } else if (cat === 'leap_spell' || cat === 'gamedev_algo') {
    baseDur = 0.85;
    stages = 3;
    archetype = id.includes('sword') || id.includes('boids') ? 'martial_qi' : 'western_cathedral';
  }

  return {
    enabled: true,
    duration: +clamp(baseDur * timeScale, 0.25, 4.80).toFixed(3),
    stages,
    archetype,
    label: ARCHETYPE_LABELS[archetype] || '魔導詠唱',
  };
}

function isRestLikePose(pose) {
  if (!pose) return true;
  return (
    Math.abs(pose.shRPitch ?? 0) < 0.36 &&
    Math.abs(pose.shLPitch ?? 0) < 0.36 &&
    Math.abs(pose.torsoYaw ?? 0) < 0.25 &&
    (pose.crouch ?? 0) < 0.08 &&
    (pose.bowDraw ?? 0) < 0.20
  );
}

/**
 * Determines a move's native release/takeoff sync point (`releaseT`) so that when `chantDur > 0`,
 * CastBar 100% (`globalT === chantDur`) === Character Release Keyframe === Outgoing VFX Release!
 */
export function computeMoveSyncSpec(mv, rawReleaseEvents = null) {
  const kfs = mv?.keyframes || [];
  let locoIdx = -1;
  for (let i = 1; i < kfs.length; i++) {
    const p = kfs[i].pose || {};
    if ((p.y ?? 0) > 0.45 || (p.z ?? 0) > 0.95) {
      locoIdx = i;
      break;
    }
  }

  const nonGather = (rawReleaseEvents || []).filter((ev) => !ev.isPreGather);
  const firstOutEvT = nonGather.length ? Math.max(0, nonGather[0].t ?? 0) : null;

  let releaseT;
  let isTakeoffRelease = false;
  if (typeof mv?.releaseTime === 'number') {
    releaseT = Math.max(0, mv.releaseTime);
    isTakeoffRelease = Boolean(mv.releaseIsTakeoff) || (locoIdx > 0 && Math.abs(kfs[locoIdx - 1].t - releaseT) < 0.03);
  } else if (locoIdx > 0) {
    const takeoffKfT = Math.max(0, kfs[locoIdx - 1].t ?? 0);
    // Distinguish immediate rush/leap skills (takeoff <= 0.35s) from stationary charge-then-dash (e.g. iaido / shield ram >= 0.9s)
    if (takeoffKfT <= 0.40) {
      releaseT = firstOutEvT !== null ? Math.min(takeoffKfT > 0.01 ? takeoffKfT : firstOutEvT, firstOutEvT) : takeoffKfT;
      isTakeoffRelease = true;
    } else {
      releaseT = firstOutEvT !== null ? firstOutEvT : takeoffKfT;
      isTakeoffRelease = false;
    }
  } else if (firstOutEvT !== null) {
    releaseT = firstOutEvT;
  } else {
    // Fallback when called statically without实例化 events (e.g. UI HUD / contact sheet helpers)
    const actionKf = kfs.find((k, idx) => idx > 0 && !isRestLikePose(k.pose));
    releaseT = mv?.cat === 'charge' ? 1.24 : (actionKf ? Math.min(0.48, actionKf.t + 0.12) : 0.32);
  }

  // Locate the release keyframe near `releaseT` and its preceding windup-coil keyframe (`windupT`)
  let relKfIdx = -1;
  let bestDist = Infinity;
  for (let i = 1; i < kfs.length; i++) {
    const d = Math.abs(kfs[i].t - releaseT);
    if (d < bestDist) {
      bestDist = d;
      relKfIdx = i;
    }
  }
  let windupT = Math.max(0, releaseT - 0.12);
  let hasDistinctWindup = false;
  if (relKfIdx >= 1 && bestDist <= 0.10) {
    const prevKf = kfs[relKfIdx - 1];
    if (prevKf && prevKf.t < releaseT - 0.02 && !isRestLikePose(prevKf.pose)) {
      windupT = prevKf.t;
      hasDistinctWindup = true;
    }
  } else {
    // Find latest non-rest keyframe strictly before releaseT
    for (let i = kfs.length - 1; i >= 1; i--) {
      if (kfs[i].t < releaseT - 0.02 && !isRestLikePose(kfs[i].pose)) {
        windupT = kfs[i].t;
        hasDistinctWindup = true;
        break;
      }
    }
  }

  return { releaseT, windupT, hasDistinctWindup, isTakeoffRelease };
}

export function getMoveTimeOffset(mv, cfg = FX_CONFIG) {
  const spec = getEffectiveChantSpec(mv, cfg);
  if (!spec.enabled || spec.duration <= 0) return 0;
  const sync = computeMoveSyncSpec(mv, null);
  return spec.duration - sync.releaseT;
}

/**
 * Biomechanically grounded on-caster Chanting Choreography (0 <= t < chantEndT).
 * Caster stays strictly at (0, _, 0) gathering power, then coils into `targetCoilPose` with ZERO drop to REST_POSE!
 */
export function sampleCasterChantPose(loadout, archetype, t, chantEndT, targetCoilPose = null) {
  const effDur = Math.max(0.05, chantEndT);
  const u = clamp(t / effDur, 0, 1);
  const rampIn = ease.outCubic(clamp(u / 0.22, 0, 1));
  const wave = Math.sin(t * 5.4);
  const pulse = Math.cos(t * 3.8);
  const levitate = (archetype === 'sequential_4tier' || archetype === 'sacred_prayer' || archetype === 'eastern_qimen') && effDur >= 0.95
    ? Math.sin(clamp((u - 0.15) / 0.72, 0, 1) * Math.PI) * 0.16
    : 0;

  let chantPose;
  if (loadout === 'mage_staff') {
    chantPose = {
      ...REST_POSE,
      x: 0,
      y: levitate,
      z: 0,
      crouch: 0.08 * (1 - levitate * 3) + 0.02 * pulse,
      torsoPitch: -0.10 * rampIn + 0.03 * wave,
      torsoYaw: -0.12 * rampIn + 0.05 * pulse,
      headPitch: -0.18 * rampIn,
      shRPitch: -1.18 * rampIn + 0.06 * wave,
      shRYaw: -0.15,
      elRPitch: -0.42,
      wrRPitch: -0.15,
      shLPitch: -1.32 * rampIn - 0.12 * wave,
      shLYaw: 0.36 + 0.14 * pulse,
      elLPitch: -0.62 + 0.10 * wave,
      capePitch: 0.44 + 0.16 * Math.abs(wave) + levitate * 1.4,
    };
  } else if (loadout === 'bow') {
    const draw = clamp(0.18 + u * 0.68, 0, 0.90);
    chantPose = {
      ...REST_POSE,
      x: 0, y: 0, z: 0,
      crouch: 0.12 * rampIn,
      torsoPitch: 0.06,
      torsoYaw: -0.52 * rampIn,
      headYaw: 0.48 * rampIn,
      shLPitch: -1.50 * rampIn,
      shLYaw: 0.45 * rampIn,
      elLPitch: -0.06,
      shRPitch: -1.46 * rampIn,
      shRYaw: -0.25,
      elRPitch: -1.15 * draw,
      bowDraw: draw,
      bowArrow: 1,
      capePitch: 0.35 + 0.12 * Math.abs(wave),
    };
  } else if (loadout === 'unarmed' || loadout === 'dual_daggers') {
    chantPose = {
      ...REST_POSE,
      x: 0, y: levitate * 0.85, z: 0,
      crouch: 0.10 * rampIn,
      torsoPitch: -0.12 * rampIn + 0.03 * wave,
      headPitch: -0.16 * rampIn,
      shRPitch: -1.25 * rampIn + 0.08 * wave,
      shRYaw: 0.32,
      elRPitch: -0.88,
      shLPitch: -1.25 * rampIn - 0.08 * wave,
      shLYaw: -0.32,
      elLPitch: -0.88,
      capePitch: 0.42 + 0.15 * Math.abs(wave),
    };
  } else {
    // Sword & Shield / Greatsword / Spear / Scythe: heroic martial qi-focusing stance on (0,0,0)
    chantPose = {
      ...REST_POSE,
      x: 0, y: 0, z: 0,
      crouch: 0.15 * rampIn + 0.02 * pulse,
      torsoPitch: 0.10 * rampIn + 0.03 * wave,
      torsoYaw: -0.22 * rampIn,
      headPitch: -0.08,
      shRPitch: -1.35 * rampIn + 0.06 * wave,
      shRYaw: 0.18,
      elRPitch: -0.72,
      wrRYaw: 0.35,
      shLPitch: -0.95 * rampIn,
      shLYaw: 0.42,
      elLPitch: -0.85,
      capePitch: 0.40 + 0.14 * Math.abs(wave),
    };
  }

  if (targetCoilPose) {
    const coilWindow = Math.min(0.28, effDur * 0.38);
    const coilStart = effDur - coilWindow;
    if (t > coilStart && coilWindow > 1e-4) {
      const blend = ease.inOutCubic(clamp((t - coilStart) / coilWindow, 0, 1));
      const safeCoil = {
        ...REST_POSE,
        ...targetCoilPose,
        x: 0,
        y: Math.min(0.24, Math.max(0, targetCoilPose.y ?? 0)),
        z: clamp(targetCoilPose.z ?? 0, -0.22, 0.22),
      };
      return poseLerp(chantPose, safeCoil, blend);
    }
  }
  return chantPose;
}

function getCasterFocusWorld(fighter) {
  let pt;
  if (fighter.loadout === 'mage_staff') {
    pt = fighter.getStaffTipWorld();
  } else if (fighter.loadout === 'bow') {
    pt = fighter.getBowMuzzleWorld();
  } else if (fighter.loadout === 'unarmed' || fighter.loadout === 'dual_daggers') {
    pt = fighter.getLeftHandWorld().add(fighter.getRightHandWorld()).multiplyScalar(0.5);
  } else {
    pt = fighter.getRightHandWorld().lerp(fighter.getSwordTipWorld(), 0.42);
  }
  pt._isWorldScaled = true; // Never let Sim3D auto-shift caster weapon tip toward distant enemy hitbox!
  return pt;
}

/**
 * Spawns ONLY on-caster Chanting VFX (CastBar3D + progressive MagicArray3D + weapon/hand mana gather).
 * Strictly anchored at caster (0, _, 0) so ZERO premature attacks touch distant targets!
 */
export function spawnCasterChantRig(sim, fighter, mv, chantSpec, paletteOverride = null) {
  const { pal, sigilStyle } = inferChantPaletteAndStyle(mv, paletteOverride);
  const castDur = chantSpec.duration;
  const arch = chantSpec.archetype;

  // 1. Overhead 3D CastBar + Stage Cast-Bar HUD
  const yOffset = fighter.statusBar?.group?.visible ? 0.68 : 0.42;
  const fallbackEnTitle = (mv.titleEn || mv.id || '')
    .replace(/^(?:env|chant|sum|zone|algo|bow|chg|def|buf|deb|leap|rush|ui|pfx)_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  sim.addCustom(new CastBar3D({
    sim,
    getAnchor: () => fighter.headTopWorld().add(new THREE.Vector3(0, yOffset, 0)),
    castDuration: castDur,
    holdAfterRelease: 0.48,
    stages: chantSpec.stages,
    spellTitle: mv.title,
    spellTitleEn: fallbackEnTitle,
    traditionLabel: chantSpec.label,
    traditionLabelEn: ARCHETYPE_LABELS_EN[arch] || 'Arcane Chant',
    isMartialQi: arch === 'martial_qi',
    palette: pal,
  }));

  // 2. On-Caster Pre-Release Rig:
  //    - `martial_qi`: 100% SIGIL-FREE physical martial stance pressure (shock-dust + spiralling wind + levitating pebbles + blade aura)!
  //    - Magical traditions: Progressive MagicArray3D unlocking ring-by-ring across 0..castDur!
  const isSigilFreeMartial = arch === 'martial_qi';
  const arrayHdr = clamp(1.42 - Math.max(0, chantSpec.stages - 2) * 0.14, 1.08, 1.45);
  if (isSigilFreeMartial) {
    fighter.pulseBodyAura(pal[4] || '#fbbf24', castDur + 0.36);
    spawnMartialStanceGust3D(sim, {
      x: 0,
      z: 0,
      _mapped: true,
      radius: 1.55,
      duration: castDur + 0.18,
      palette: pal,
      pebbleCount: 10,
      windLoops: 3,
    });
    attachWeaponBladeTrail3D(sim, fighter, {
      duration: Math.max(0.18, castDur),
      fadeTime: 0.16,
      width: 0.16,
      palette: pal,
      hdr: 2.15,
      sparks: true,
    });
  } else if (arch === 'barrel_cannon') {
    const arr = new MagicArray3D({
      aimOrigin: new THREE.Vector3(0, 1.25, 0.78),
      aimDir: new THREE.Vector3(0, 0, 1),
      radius: 1.32,
      duration: castDur + 0.65,
      tradition: 'western',
      arrayKind: 'vertical_cannon',
      layers: chantSpec.stages,
      style: 'cyberRune',
      palette: pal,
      chantDuration: castDur,
      hdr: arrayHdr,
      exactStyle: true,
    });
    arr._skipAutoMap = true;
    sim.addCustom(arr);
  } else {
    const arrayCfg = arch === 'eastern_qimen'
      ? { tradition: 'eastern', arrayKind: 'qimen_square', style: 'qimenComplex' }
      : arch === 'sacred_prayer'
        ? { tradition: 'eastern', arrayKind: 'talisman_seal', style: 'lotusMandala' }
        : arch === 'abyss_pact'
          ? { tradition: 'western', arrayKind: 'sequential_chant', style: 'demonGate' }
          : { tradition: 'western', arrayKind: 'sequential_chant', style: sigilStyle };

    const arr = new MagicArray3D({
      x: 0, y: 0.024, z: 0,
      radius: clamp(1.55 + chantSpec.stages * 0.16, 1.65, 2.35),
      duration: castDur + 0.68,
      tradition: arrayCfg.tradition,
      arrayKind: arrayCfg.arrayKind,
      layers: chantSpec.stages,
      style: arrayCfg.style,
      palette: pal,
      chantDuration: castDur,
      hdr: arrayHdr,
    });
    arr._skipAutoMap = true;
    sim.addCustom(arr);
  }

  // 3. Weapon-tip / Hand Mana or Martial-Qi Suction
  const variantMap = {
    sequential_4tier: 'astrolabe',
    eastern_qimen: 'tesla',
    western_cathedral: 'wings',
    barrel_cannon: 'astrolabe',
    sacred_prayer: 'helix',
    martial_qi: 'helix',
    abyss_pact: 'singularity',
  };
  sim.spawnChargeGather({
    variant: FX_CONFIG.chargeVariant !== 'auto' ? FX_CONFIG.chargeVariant : (variantMap[arch] || 'helix'),
    sigilStyle: isSigilFreeMartial ? null : sigilStyle,
    noSigil: isSigilFreeMartial,
    getAnchor: () => getCasterFocusWorld(fighter),
    duration: Math.max(0.22, castDur - 0.03),
    radius: 1.48,
    palette: pal,
  });
}

function spawnChantReleaseFlash(sim, fighter, mv, paletteOverride = null, seed = 7) {
  const { pal, hotHex } = inferChantPaletteAndStyle(mv, paletteOverride);
  const focus = getCasterFocusWorld(fighter);
  const sigilFree = FX_CONFIG.chantMode === 'martial_qi' || isMartialWeaponMove(mv);
  sim.spawnStarGlint(focus.x, focus.y, focus.z, 0.62, hotHex, 0.18, true);

  const sh = new ShockSphere3D({
    x: focus.x, y: focus.y, z: focus.z,
    r0: 0.08, r1: 0.68,
    duration: 0.20,
    palette: pal,
    hdr: 1.25,
    useRunes: !sigilFree,
  });
  sh._skipAutoMap = true;
  sim.addCustom(sh);

  const gw = new GroundWave3D({
    x: 0, z: 0,
    maxRadius: 1.85,
    thickness: 0.32,
    height: 0.34,
    duration: 0.32,
    palette: pal,
    hdr: 1.32,
    seed: seed + 911,
  });
  gw._skipAutoMap = true;
  sim.addCustom(gw);
}

/**
 * Unified Timeline Session shared across Browser Stage, Automated Verification, and 3D VFX Exporter!
 * Enforces strict causality:
 *   - [0 .. chantDur): ONLY caster chants at (0,0,0); ZERO skill release events fire!
 *   - [chantDur .. totalDuration]: Full skill release executes!
 */
export function createChantAwareSession({
  mv,
  sim,
  fighter,
  dummies = [],
  allies = [],
  seed = 7,
  paletteOverride = null,
  texStyle = 'auto',
} = {}) {
  const chantSpec = getEffectiveChantSpec(mv, FX_CONFIG);
  const chantDur = chantSpec.enabled ? chantSpec.duration : 0;
  const lingerExtra = Math.max(0, ((FX_CONFIG.groundLingerScale ?? 1.65) - 1.0) * 1.35);

  FX_CONFIG.paletteOverrideActive = Boolean(paletteOverride);
  if (typeof document !== 'undefined') {
    const castHud = document.getElementById('cast-bar-hud');
    if (castHud) castHud.hidden = true;
  }

  sim.clear();
  // Temporary upper-bound clip duration during buildEvents; finalized right after computing exact timeOffset!
  sim.setDynamicScaleContext(mv, chantDur + (mv.duration ?? 2.5) + lingerExtra);
  installChargeVariantHook(sim);
  sim.R.s = (seed >>> 0) || 1;

  fighter.hitStop = 0;
  fighter.resetSupportHUD?.();
  for (const a of allies) a.reset(0, 0, false);

  mv.setup(fighter, dummies, paletteOverride || null, allies);

  // Visually place target dummies at boosted/scaled world coordinates while keeping d.homeX/homeZ in 1.0x skill space
  const effRange = getEffectiveRangeScale(mv, FX_CONFIG.rangeScale);
  if (!mv.handlesDynamicScale && (Math.abs(FX_CONFIG.aoeScale - 1) > 1e-4 || Math.abs(effRange - 1) > 1e-4)) {
    for (const d of dummies) {
      if (!d.root.visible) continue;
      const [wx, wz] = mapHitboxPointXZ(mv.hitbox, d.homeX, d.homeZ, FX_CONFIG.aoeScale, effRange);
      d.setWorldPosition(wx, wz);
    }
  }

  const rawReleaseEvents = (mv.buildEvents(
    sim, fighter, dummies, seed, paletteOverride || null, texStyle || 'auto', allies
  ) || []).slice().sort((a, b) => (a.t ?? 0) - (b.t ?? 0));

  const syncSpec = computeMoveSyncSpec(mv, rawReleaseEvents);
  const { releaseT, windupT, hasDistinctWindup, isTakeoffRelease } = syncSpec;

  const filteredEvents = chantDur > 0
    ? rawReleaseEvents.filter((ev) => !ev.isPreGather)
    : rawReleaseEvents;
  const earliestReqEvT = filteredEvents.length ? Math.max(0, filteredEvents[0].t ?? 0) : releaseT;
  const timeOffset = chantDur > 0
    ? Math.max(chantDur - releaseT, 0.005 - earliestReqEvT)
    : 0;
  const releaseGlobalT = +(releaseT + timeOffset).toFixed(5);
  const totalDuration = +(Math.max(chantDur + 0.45, (mv.duration ?? 2.5) + timeOffset) + lingerExtra).toFixed(3);
  sim._clipMaxDuration = totalDuration;

  const sampleReleasePose = (localT) => {
    const pose = fighter.sampleKeyframes(mv.keyframes, Math.max(0, localT));
    if (!mv.handlesDynamicScale && Math.abs(effRange - 1) > 1e-4 && (pose.z ?? 0) > 0.22) {
      return { ...pose, z: 0.22 + (pose.z - 0.22) * effRange };
    }
    return pose;
  };

  const windupPose = sampleReleasePose(windupT);
  const releasePose = sampleReleasePose(releaseT);
  const rawSwingSpan = Math.max(0.06, releaseT - windupT);
  const swingDur = chantDur > 0
    ? (isTakeoffRelease ? 0 : clamp(rawSwingSpan, 0.06, Math.min(0.28, releaseGlobalT * 0.42)))
    : 0;
  const chantPhaseEndT = Math.max(0.02, releaseGlobalT - swingDur);

  const samplePoseAt = (globalT) => {
    if (chantDur <= 0) {
      return sampleReleasePose(globalT);
    }
    if (isTakeoffRelease) {
      if (globalT < releaseGlobalT) {
        return sampleCasterChantPose(fighter.loadout, chantSpec.archetype, globalT, releaseGlobalT, releasePose);
      }
      return sampleReleasePose(releaseT + (globalT - releaseGlobalT));
    }
    if (globalT < chantPhaseEndT) {
      return sampleCasterChantPose(
        fighter.loadout,
        chantSpec.archetype,
        globalT,
        chantPhaseEndT,
        hasDistinctWindup ? windupPose : null
      );
    }
    if (globalT < releaseGlobalT) {
      const u = clamp((globalT - chantPhaseEndT) / Math.max(1e-5, swingDur), 0, 1);
      if (hasDistinctWindup) {
        return sampleReleasePose(lerp(windupT, releaseT, u));
      }
      const chantEndPose = sampleCasterChantPose(fighter.loadout, chantSpec.archetype, chantPhaseEndT, chantPhaseEndT, null);
      return poseLerp(chantEndPose, releasePose, ease.outExpo(u));
    }
    return sampleReleasePose(releaseT + (globalT - releaseGlobalT));
  };

  fighter.applyPose(samplePoseAt(0));

  const scheduledEvents = [];
  if (chantDur > 0) {
    scheduledEvents.push({
      t: 0.005,
      isChantEvent: true,
      fired: false,
      run() {
        spawnCasterChantRig(sim, fighter, mv, chantSpec, paletteOverride);
      },
    });
    scheduledEvents.push({
      t: releaseGlobalT,
      isChantEvent: true,
      fired: false,
      run() {
        spawnChantReleaseFlash(sim, fighter, mv, paletteOverride, seed);
      },
    });
  }

  for (const ev of filteredEvents) {
    scheduledEvents.push({
      ...ev,
      t: +Math.max(0.001, (ev.t ?? 0) + timeOffset).toFixed(5),
      fired: false,
    });
  }
  scheduledEvents.sort((a, b) => a.t - b.t);

  let currentTime = 0;
  let poseFreezePose = null;
  let freezeRecoverTimer = 0;
  let freezeRecoverFrom = null;
  const FREEZE_RECOVER_DUR = 0.05;

  return {
    mv,
    chantSpec,
    chantDur,
    chantPhaseEndT,
    isTakeoffRelease,
    releaseT,
    releaseGlobalT,
    timeOffset,
    totalDuration,
    scheduledEvents,
    get currentTime() { return currentTime; },
    samplePoseAt,
    step(dt, camera = null) {
      currentTime += dt;
      for (const ev of scheduledEvents) {
        if (!ev.fired && ev.t <= currentTime + 1e-6) {
          ev.fired = true;
          if (fighter.hitStop <= 0) {
            fighter.applyPose(samplePoseAt(ev.t));
          }
          const prevScaleCtx = sim._scaleCtx;
          if (ev.isPreGather) sim._scaleCtx = null;
          try {
            ev.run();
          } finally {
            sim._scaleCtx = prevScaleCtx;
          }
        }
      }

      if (fighter.hitStop > 0) {
        if (!poseFreezePose) poseFreezePose = { ...fighter.pose };
        fighter.hitStop = Math.max(0, fighter.hitStop - dt);
        fighter.applyPose(poseFreezePose);
        if (fighter.hitStop <= 0) {
          freezeRecoverFrom = { ...poseFreezePose };
          freezeRecoverTimer = FREEZE_RECOVER_DUR;
          poseFreezePose = null;
        }
      } else {
        poseFreezePose = null;
        const targetPose = samplePoseAt(currentTime);
        if (freezeRecoverTimer > 0 && freezeRecoverFrom) {
          freezeRecoverTimer = Math.max(0, freezeRecoverTimer - dt);
          const blend = 1 - (freezeRecoverTimer / FREEZE_RECOVER_DUR);
          fighter.applyPose(poseLerp(freezeRecoverFrom, targetPose, ease.outQuad(blend)));
          if (freezeRecoverTimer <= 0) freezeRecoverFrom = null;
        } else {
          fighter.applyPose(targetPose);
        }
      }

      fighter.updateSupport?.(dt, camera);
      for (const d of dummies) d.update(dt);
      for (const a of allies) a.update(dt, camera);
      sim.update(dt, camera);
    },
  };
}
