import * as THREE from 'three';
import {
  TAU, clamp, lerp, smooth, ease, Rng, PAL3D,
  SlashArc3D, RibbonTrail3D, GroundWave3D, VortexFunnel3D, BeamCylinder3D, Sigil3D, ShockSphere3D,
  makeTranslucentConstructMaterial,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import {
  resolvePal, SHIELD_GUARD, spawnGroundCracks,
  attachWeaponBladeTrail3D, spawnBladeGroundScar3D, spawnMachShockRings3D,
} from './fx_helpers.js';
import {
  buildTowerShieldAssembly, buildSpiritSwordAssembly, buildWarhammerAssembly,
  buildDragonSpiritHeadAssembly, buildReaperScytheAssembly, buildSeraphWingsAssembly, buildArmillaryAstrolabeAssembly,
} from './mesh_props3d.js';
import { launch3DArrow } from './presets_bow.js';
import { installChargeVariantHook } from './env_fx3d.js';

// Reusable 3-Stage Charge-Up -> Release Keyframe Helpers
function makeBowCharge3Keyframes(relT = 1.30, endT = 2.65) {
  return [
    { t: 0.00, pose: { ...REST_POSE, torsoYaw: -0.52, shLPitch: -1.42, shLYaw: 0.48, shRPitch: -1.25, elRPitch: -0.85, bowDraw: 0.12, bowArrow: 1 } },
    { t: +(relT * 0.33).toFixed(3), ease: ease.inOutSine, pose: { ...REST_POSE, crouch: 0.10, torsoYaw: -0.58, headYaw: 0.52, shLPitch: -1.52, shLYaw: 0.54, shRPitch: -1.45, shRYaw: -0.22, elRPitch: -1.02, bowDraw: 0.52, bowArrow: 1 } },
    { t: +(relT * 0.68).toFixed(3), ease: ease.inOutSine, pose: { ...REST_POSE, crouch: 0.16, torsoYaw: -0.64, headYaw: 0.58, shLPitch: -1.55, shLYaw: 0.58, shRPitch: -1.48, shRYaw: -0.35, elRPitch: -1.16, bowDraw: 0.84, bowArrow: 1 } },
    { t: +(relT - 0.08).toFixed(3), ease: ease.inCubic, pose: { ...REST_POSE, crouch: 0.22, torsoPitch: -0.08, torsoYaw: -0.68, headYaw: 0.62, shLPitch: -1.58, shLYaw: 0.60, shRPitch: -1.50, shRYaw: -0.44, elRPitch: -1.25, bowDraw: 1.0, bowArrow: 1 } },
    { t: relT, ease: ease.outExpo, pose: { ...REST_POSE, z: -0.14, crouch: 0.16, torsoPitch: 0.06, torsoYaw: -0.62, headYaw: 0.58, shLPitch: -1.62, shLYaw: 0.56, shRPitch: -1.72, shRYaw: -0.68, elRPitch: -0.48, capePitch: 0.72, bowDraw: 0.0, bowArrow: 0 } },
    { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE } },
  ];
}

function makeHeavyChargeSlamKeyframes(relT = 1.25, endT = 2.65) {
  return [
    { t: 0.00, pose: { ...REST_POSE } },
    { t: +(relT * 0.35).toFixed(3), ease: ease.inOutSine, pose: { ...REST_POSE, crouch: 0.16, torsoPitch: -0.12, torsoYaw: -0.48, shRPitch: -1.95, shRYaw: -0.52, elRPitch: -0.35, shLPitch: -1.45, shLYaw: 0.38 } },
    { t: +(relT * 0.72).toFixed(3), ease: ease.inOutSine, pose: { ...REST_POSE, crouch: 0.24, torsoPitch: -0.22, torsoYaw: -0.62, shRPitch: -2.35, shRYaw: -0.58, elRPitch: -0.25, shLPitch: -1.75, shLYaw: 0.45 } },
    { t: +(relT - 0.10).toFixed(3), ease: ease.inCubic, pose: { ...REST_POSE, crouch: 0.30, torsoPitch: -0.28, torsoYaw: -0.68, shRPitch: -2.52, shRYaw: -0.62, elRPitch: -0.18, capePitch: 0.55 } },
    { t: relT, ease: ease.outExpo, pose: { ...REST_POSE, z: 0.52, crouch: 0.24, torsoPitch: 0.34, torsoYaw: 0.38, shRPitch: -0.92, shRYaw: 0.45, elRPitch: -0.06, capePitch: 0.82 } },
    { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE } },
  ];
}

export const PRESETS_CHARGE = [
  // 1. 龍魂破滅貫穿箭 (3-Stage Dragon-Piercer Charged Bow)
  {
    id: 'chg_bow_dragon_piercer',
    cat: 'charge',
    cls: '龍魂神射 Dragon Archer',
    title: '三段滿蓄力：龍魂破滅貫穿箭',
    codeId: 'chg.bow.dragon_piercer',
    duration: 2.75,
    peakTime: 1.44,
    contactTimes: [1.38, 1.46, 1.54],
    hitbox: { kind: 'rect', width: 2.2, length: 6.8 },
    specNotes: [
      'Niagara 三段螺旋吸氣聚能 (0.05s→1.25s) 伴隨三層無符文壓縮氣爆球與碎石武神氣勁',
      '滿蓄力射出 1.65 倍半透明龍魂馬赫錐巨箭，掀起五重馬赫音障環與裂地炎痕一路貫穿三尊標靶！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 2.6, true);
      dummies[1].reset(0, 4.3, true);
      dummies[2].reset(0, 6.0, true);
    },
    keyframes: makeBowCharge3Keyframes(1.30, 2.65),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const R = new Rng(seed);
      const P = resolvePal('fireInferno', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'helix', noSigil: true, getAnchor: () => fighter.getBowMuzzleWorld(), duration: 1.22, radius: 1.85, palette: P.pal, rate: 190, vortex: 9.0, tiers: 3 });
        }},
        { t: 1.30, run() {
          fighter.hitStop = 0.09;
          const p0 = fighter.getBowMuzzleWorld();
          const p1 = new THREE.Vector3(0, 1.15, 6.65);
          spawnMachShockRings3D(sim, { p0: new THREE.Vector3(0, 1.25, 0.55), p1, ringCount: 5, radius0: 0.30, radius1: 1.05, duration: 0.42, palette: P.pal });
          spawnBladeGroundScar3D(sim, R, { x: 0, z: 3.4, length: 4.8, width: 0.46, life: 0.95, zoneKind: 'burning', palette: P.pal });
          const drg = buildDragonSpiritHeadAssembly({ palette: P.pal, scale: 1.35 });
          let dEl = 0;
          sim.addCustom({
            group: drg.group,
            update(dt) {
              dEl += dt; drg.update(dt);
              drg.group.position.lerpVectors(p0, p1, clamp(dEl / 0.24));
              drg.group.lookAt(0, 1.15, 7.5);
              drg.setOpacity(1 - smooth(0.32, 0.68, dEl));
            },
            get done() { return dEl >= 0.70; },
            dispose() { drg.dispose(); },
          });
          sim.spawnAirDistortion({ kind: 'shock', x: p0.x, y: p0.y, z: p0.z, r0: 0.2, r1: 2.2, duration: 0.36, strength: 0.85, _mapped: true });
          const muzShock = new ShockSphere3D({ x: p0.x, y: p0.y, z: p0.z, r0: 0.15, r1: 1.55, duration: 0.28, palette: P.pal, hdr: 2.5, useRunes: false });
          muzShock._skipAutoMap = true;
          sim.addCustom(muzShock);
          sim.addCustom(new BeamCylinder3D({ p0, p1, radius: 0.36, duration: 0.65, palette: P.pal, texStyle, defaultTex: 'flame', hdr: 2.35 }));
          launch3DArrow(sim, {
            p0, p1, arcHeight: 0.02, flightTime: 0.22, palette: P.pal, scale: 1.65, heavy: true, trailWidth: 0.32, pinHold: 0.45,
            onImpact: (pt) => {
              sim.spawnGroundZone({ x: 0, z: 4.3, radius: 1.85, duration: 0.92, kind: 'burning', palette: P.pal, emitFlames: true, eruptRocks: true });
              sim.spawnFlipbook({ atlas: 'fbExplosion', x: pt.x, y: pt.y, z: pt.z, life: 0.52, size0: 1.2, size1: 2.8, palette: P.pal, hdr: 2.6 });
              spawnGroundCracks(sim, R, { cx: 0, cz: 4.2, maxRadius: 2.2, branches: 8, life: 0.85, palette: P.pal, rockCount: 8, rockScale: 0.75 });
            },
          });
          dummies.forEach((d, idx) => {
            d.hit({ dirX: 0, dirZ: 1, power: 1.85, flashColor: P.hotHex });
            sim.spawnFlipbook({ atlas: 'fbHitBurst', x: 0, y: 1.15, z: d.root.position.z, delay: 0.05 * idx, life: 0.35, size0: 0.9, size1: 1.9, palette: P.pal, hdr: 2.4 });
          });
        }},
      ];
    },
  },

  // 2. 雷神電磁超導狙擊 (Charged Volt Railgun Bow)
  {
    id: 'chg_bow_volt_railgun',
    cat: 'charge',
    cls: '電磁狙擊手 Storm Sniper',
    title: '蓄力電磁砲：雷神超導貫穿矢',
    codeId: 'chg.bow.volt_railgun',
    duration: 2.65,
    peakTime: 1.36,
    contactTimes: [1.32],
    hitbox: { kind: 'rect', width: 1.8, length: 6.8 },
    specNotes: ['弓身展開三道半透明六角電磁加速環，1.28s 蓄滿超高速射穿全場並炸開高壓雷暴電弧'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 5.2, true);
      dummies[1].reset(-0.65, 3.4, true);
      dummies[2].reset(0.65, 6.2, true);
    },
    keyframes: makeBowCharge3Keyframes(1.29, 2.55),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('mageVolt', paletteOverride);
      return [
        { t: 0.06, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'tesla', noSigil: true, getAnchor: () => fighter.getBowMuzzleWorld(), duration: 1.20, radius: 1.65, palette: P.pal, rate: 175, vortex: 11.0, tiers: 3 });
        }},
        { t: 1.29, run() {
          fighter.hitStop = 0.08;
          const p0 = fighter.getBowMuzzleWorld();
          const p1 = new THREE.Vector3(0, 1.15, 6.6);
          spawnMachShockRings3D(sim, { p0: new THREE.Vector3(0, 1.25, 0.55), p1, ringCount: 5, radius0: 0.26, radius1: 0.92, duration: 0.38, palette: P.pal });
          sim.spawnAirDistortion({ kind: 'shock', x: p0.x, y: p0.y, z: p0.z, r0: 0.15, r1: 2.1, duration: 0.32, strength: 0.85, _mapped: true });
          sim.spawnGroundZone({ x: 0, z: 4.8, radius: 1.55, duration: 1.05, kind: 'lightning', palette: P.pal, emitFlames: true });
          sim.addCustom(new BeamCylinder3D({ p0, p1, radius: 0.28, duration: 0.58, palette: P.pal, texStyle, defaultTex: 'volt', hdr: 2.55 }));
          sim.spawnBolt(p0, p1, { radius: 0.045, jitter: 0.22, life: 0.45, color: P.hotHex });
          launch3DArrow(sim, { p0, p1, arcHeight: 0, flightTime: 0.12, palette: P.pal, scale: 1.5, heavy: true, trailWidth: 0.26, pinHold: 0.42 });
          for (const d of dummies) {
            d.hit({ dirX: 0, dirZ: 1, power: 1.7, flashColor: P.hotHex });
            sim.spawnFlipbook({ atlas: 'fbLightning', x: d.root.position.x, y: 1.2, z: d.root.position.z, life: 0.38, size0: 0.9, size1: 1.9, palette: P.pal, hdr: 2.4 });
          }
        }},
      ];
    },
  },

  // 3. 弒神墜日一矢 (Celestial Sunbreaker Charged Sky-Bow)
  {
    id: 'chg_bow_sunbreaker',
    cat: 'charge',
    cls: '聖光神弓手 Sunbreaker',
    title: '蓄力墜日箭：蒼穹曜日核爆',
    codeId: 'chg.bow.sunbreaker',
    duration: 2.80,
    peakTime: 1.62,
    contactTimes: [1.58],
    hitbox: { kind: 'circle', cx: 0, cz: 4.4, radius: 2.8 },
    specNotes: ['仰天三段聚氣射穿高空音障雲層，1.58s 凝聚成半透明曜日巨箭垂直轟落，引爆碎地烈陽氣浪與金羽星爆'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 4.4, true);
      dummies[1].reset(-1.4, 4.7, true);
      dummies[2].reset(1.4, 4.7, true);
    },
    keyframes: makeBowCharge3Keyframes(1.28, 2.70),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      installChargeVariantHook(sim);
      const R = new Rng(seed);
      const P = resolvePal('holyGold', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'wings', noSigil: true, getAnchor: () => fighter.getBowMuzzleWorld(), duration: 1.18, radius: 1.75, palette: P.pal, rate: 180, vortex: 8.5, tiers: 3 });
        }},
        { t: 1.28, run() {
          const p0 = fighter.getBowMuzzleWorld();
          spawnMachShockRings3D(sim, { p0: new THREE.Vector3(0, 1.4, 0.5), p1: new THREE.Vector3(0, 6.2, 2.6), ringCount: 4, radius0: 0.28, radius1: 0.95, duration: 0.32, palette: P.pal });
          sim.addCustom(new ShockSphere3D({ x: 0, y: 6.3, z: 4.4, r0: 0.2, r1: 2.2, duration: 0.34, palette: P.pal, hdr: 2.3, useRunes: false }));
          launch3DArrow(sim, { p0, p1: new THREE.Vector3(0, 6.2, 2.6), arcHeight: 0.5, flightTime: 0.22, palette: P.pal, scale: 1.35, heavy: true });
        }},
        { t: 1.44, run() {
          launch3DArrow(sim, {
            p0: new THREE.Vector3(0, 6.5, 4.4), p1: new THREE.Vector3(0, 0.12, 4.4), arcHeight: 0, flightTime: 0.14,
            palette: P.pal, scale: 2.1, heavy: true, trailWidth: 0.38, pinHold: 0.55,
            onImpact: () => {
              fighter.hitStop = 0.09;
              sim.spawnGroundZone({ x: 0, z: 4.4, radius: 2.55, duration: 0.98, kind: 'crater', palette: P.pal, emitFlames: true, eruptRocks: true });
              sim.spawnAirDistortion({ kind: 'shock', x: 0, y: 0.7, z: 4.4, r0: 0.2, r1: 2.75, duration: 0.42, strength: 0.88 });
              sim.addCustom(new ShockSphere3D({ x: 0, y: 0.4, z: 4.4, r0: 0.2, r1: 2.65, duration: 0.42, palette: P.pal, hdr: 2.6, useRunes: false }));
              sim.addCustom(new GroundWave3D({ x: 0, z: 4.4, maxRadius: 2.72, thickness: 0.62, height: 0.95, duration: 0.48, palette: P.pal, hdr: 2.4, seed: seed + 11 }));
              sim.spawnFlipbook({ atlas: 'fbFeatherBurst', x: 0, y: 1.2, z: 4.4, life: 0.52, size0: 1.4, size1: 3.2, palette: P.pal, hdr: 2.6 });
              spawnGroundCracks(sim, R, { cx: 0, cz: 4.4, maxRadius: 2.55, branches: 9, life: 0.82, palette: P.pal, rockCount: 8, rockScale: 0.8 });
              dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 1.9, flashColor: P.hotHex }));
            },
          });
        }},
      ];
    },
  },

  // 4. 大劍三段真蓄力・烈焰斷界斬 (Greatsword True Charged Slash)
  {
    id: 'chg_gs_true_slash',
    cat: 'charge',
    cls: '狂戰巨劍 Berserker',
    title: '大劍三段真蓄力：烈焰斷界斬',
    codeId: 'chg.gs.true_slash',
    duration: 2.75,
    peakTime: 1.32,
    contactTimes: [1.28],
    hitbox: { kind: 'sector', radius: 4.2, angleDeg: 130 },
    specNotes: ['經典魔物風三段紅光壓縮蓄力，召喚 2.2 倍半透明熔火巨劍重劈地面，掀起熔岩火柱與裂地衝擊'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      dummies[0].reset(0, 3.1, true);
      dummies[1].reset(-1.35, 3.4, true);
      dummies[2].reset(1.35, 3.4, true);
    },
    keyframes: makeHeavyChargeSlamKeyframes(1.24, 2.65),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const R = new Rng(seed);
      const P = resolvePal('fireInferno', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'debris', noSigil: true, getAnchor: () => fighter.getSwordTipWorld(), duration: 1.16, radius: 1.85, palette: P.pal, rate: 195, vortex: 8.0, tiers: 3 });
        }},
        { t: 1.10, isPreGather: true, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.36, width: 0.26, palette: P.pal, hdr: 2.6 });
        }},
        { t: 1.24, run() {
          fighter.hitStop = 0.10;
          spawnBladeGroundScar3D(sim, R, { x: 0, z: 2.35, length: 3.4, width: 0.46, life: 0.95, zoneKind: 'burning', palette: P.pal });
          const sw = buildSpiritSwordAssembly({ length: 3.1, palette: P.pal });
          sw.group.position.set(0, 0.25, 2.85);
          sw.group.rotation.x = Math.PI;
          let el = 0;
          sim.addCustom({
            group: sw.group,
            update(dt) { el += dt; sw.update(dt); sw.setOpacity(1 - smooth(0.45, 0.85, el)); },
            get done() { return el >= 0.86; },
            dispose() { sw.dispose(); },
          });
          sim.spawnGroundZone({ x: 0, z: 2.85, radius: 2.25, duration: 1.25, kind: 'burning', palette: P.pal, emitFlames: true, eruptRocks: true });
          sim.spawnAirDistortion({ kind: 'shock', x: 0, y: 0.8, z: 2.85, r0: 0.2, r1: 2.8, duration: 0.44, strength: 0.92 });
          sim.addCustom(new SlashArc3D({
            center: [0, 1.2, 0.45], radius: 3.65, width: 1.35, thickness: 0.42,
            a0: -1.35, a1: 1.15, tiltX: 1.18, tiltZ: 0.12,
            sweep: 0.075, hold: 0.07, trail: 0.28, palette: P.pal, texStyle, defaultTex: 'flame', hdrBoost: 2.6, seed: seed + 21,
          }));
          sim.addCustom(new GroundWave3D({ x: 0, z: 2.8, maxRadius: 2.4, thickness: 0.58, height: 0.95, duration: 0.46, palette: P.pal, hdr: 2.35, seed: seed + 22 }));
          sim.spawnFlipbook({ atlas: 'fbExplosion', x: 0, y: 1.1, z: 2.9, life: 0.54, size0: 1.4, size1: 3.1, palette: P.pal, hdr: 2.6 });
          spawnGroundCracks(sim, R, { cx: 0, cz: 2.8, maxRadius: 2.6, branches: 9, life: 0.85, palette: P.pal, rockCount: 10, rockScale: 0.9 });
          dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.4, dirZ: 1, power: 2.0, flashColor: P.hotHex }));
        }},
      ];
    },
  },

  // 5. 巨鎚滿蓄力・崩山裂地碎 (Titan Charged Warhammer)
  {
    id: 'chg_hammer_titan_quake',
    cat: 'charge',
    cls: '雷霆泰坦 Storm Titan',
    title: '巨鎚滿蓄力：雷鳴崩山裂地碎',
    codeId: 'chg.hammer.titan_quake',
    duration: 2.70,
    peakTime: 1.30,
    contactTimes: [1.26],
    hitbox: { kind: 'circle', cx: 0, cz: 2.6, radius: 2.9 },
    specNotes: ['雙手高舉凝聚半透明雷霆戰鎚幻影，滿蓄力砸地爆開球型雷鳴震波與環狀半透明水晶岩刺'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      dummies[0].reset(0, 2.6, true);
      dummies[1].reset(-1.5, 2.9, true);
      dummies[2].reset(1.5, 2.9, true);
    },
    keyframes: makeHeavyChargeSlamKeyframes(1.22, 2.60),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      installChargeVariantHook(sim);
      const R = new Rng(seed);
      const P = resolvePal('mageVolt', paletteOverride);
      return [
        { t: 0.06, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'tesla', noSigil: true, getAnchor: () => fighter.getRightHandWorld(), duration: 1.12, radius: 1.8, palette: P.pal, rate: 185, vortex: 9.5, tiers: 3 });
        }},
        { t: 1.08, isPreGather: true, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.34, width: 0.25, palette: P.pal, hdr: 2.5 });
        }},
        { t: 1.22, run() {
          fighter.hitStop = 0.095;
          spawnBladeGroundScar3D(sim, R, { x: 0, z: 2.6, yaw: 0.55, length: 3.2, width: 0.44, life: 0.92, zoneKind: 'lightning', palette: P.pal });
          spawnBladeGroundScar3D(sim, R, { x: 0, z: 2.6, yaw: -0.55, length: 3.2, width: 0.44, life: 0.92, zoneKind: 'lightning', palette: P.pal });
          const hm = buildWarhammerAssembly({ scale: 1.48, palette: P.pal });
          hm.group.position.set(0, 0.85, 2.55);
          hm.group.rotation.x = Math.PI * 0.48;
          let el = 0;
          sim.addCustom({
            group: hm.group,
            update(dt) { el += dt; hm.update(dt); hm.setOpacity(1 - smooth(0.45, 0.85, el)); },
            get done() { return el >= 0.86; },
            dispose() { hm.dispose(); },
          });
          sim.spawnGroundZone({ x: 0, z: 2.6, radius: 2.65, duration: 1.20, kind: 'crater', palette: P.pal, emitFlames: false, eruptRocks: true });
          sim.spawnFlipbook({ atlas: 'fbRockBurst', x: 0, y: 0.95, z: 2.6, life: 0.50, size0: 1.2, size1: 2.6, palette: P.pal, hdr: 2.35 });
          sim.addCustom(new ShockSphere3D({ x: 0, y: 0.5, z: 2.6, r0: 0.2, r1: 2.65, duration: 0.38, palette: P.pal, hdr: 2.55, useRunes: false }));
          sim.addCustom(new GroundWave3D({ x: 0, z: 2.6, maxRadius: 2.75, thickness: 0.62, height: 0.9, duration: 0.45, palette: P.pal, hdr: 2.35, seed: seed + 31 }));
          sim.spawnBolt(new THREE.Vector3(0, 5.8, 2.6), new THREE.Vector3(0, 0.1, 2.6), { radius: 0.055, jitter: 0.32, life: 0.42, color: P.hotHex });
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            sim.spawnCrystal({ x: Math.cos(a) * 2.1, z: 2.6 + Math.sin(a) * 2.1, height: 1.25, width: 0.32, leanX: Math.cos(a) * 0.35, leanZ: Math.sin(a) * 0.35, hold: 0.55, melt: 0.35, palette: P.pal });
          }
          spawnGroundCracks(sim, R, { cx: 0, cz: 2.6, maxRadius: 2.55, branches: 8, life: 0.82, palette: P.pal, rockCount: 8, rockScale: 0.78 });
          dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 1.9, flashColor: P.hotHex }));
        }},
      ];
    },
  },

  // 6. 拔刀居合蓄力・次元一閃 (Katana Iaido Dimension Slash)
  {
    id: 'chg_katana_iaido_flash',
    cat: 'charge',
    cls: '劍聖 Blademaster',
    title: '居合拔刀蓄力：虛空次元一閃',
    codeId: 'chg.katana.iaido_flash',
    duration: 2.65,
    peakTime: 1.48,
    contactTimes: [1.18, 1.52],
    hitbox: { kind: 'rect', width: 2.8, length: 6.2 },
    specNotes: ['低伏納刀吸納奧術微粒 1.12s，瞬步穿敵留下一道半透明交叉次元裂痕，0.34s 收刀瞬間全場引爆！'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageViolet', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      dummies[0].reset(0, 3.2, true);
      dummies[1].reset(-0.9, 4.4, true);
      dummies[2].reset(0.9, 2.2, true);
    },
    releaseTime: 1.06,
    releaseIsTakeoff: true,
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE, z: 0, crouch: 0.24, torsoPitch: 0.22, torsoYaw: -0.68, shRPitch: -0.45, shRYaw: -0.65, elRPitch: -1.15, shLPitch: -0.62, shLYaw: 0.45 } },
      { t: 1.06, ease: ease.inCubic, pose: { ...REST_POSE, z: 0, crouch: 0.32, torsoPitch: 0.28, torsoYaw: -0.75, shRPitch: -0.42, shRYaw: -0.72, elRPitch: -1.25 } },
      { t: 1.18, ease: ease.outQuart, pose: { ...REST_POSE, z: 5.4, crouch: 0.22, torsoPitch: 0.16, torsoYaw: 0.65, shRPitch: -1.48, shRYaw: 0.72, elRPitch: -0.05, capePitch: 0.85 } },
      { t: 1.42, ease: ease.inOutSine, pose: { ...REST_POSE, z: 5.4, crouch: 0.18, torsoYaw: 0.42, shRPitch: -1.08, elRPitch: -0.58 } },
      { t: 1.50, ease: ease.outExpo, pose: { ...REST_POSE, z: 5.4, crouch: 0.12, torsoYaw: 0.22, shRPitch: -0.52, elRPitch: -1.05 } },
      { t: 2.55, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('mageViolet', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'mirage', noSigil: true, getAnchor: () => fighter.getLeftHandWorld(), duration: 1.00, radius: 1.7, palette: P.pal, rate: 175, vortex: 10.5, tiers: 3 });
        }},
        { t: 1.06, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.46, width: 0.24, palette: P.pal, hdr: 2.6 });
          const gw = new GroundWave3D({ x: 0, z: 0, maxRadius: 1.55, thickness: 0.32, height: 0.48, duration: 0.26, palette: P.pal, hdr: 2.1, seed: seed + 40 });
          gw._skipAutoMap = true;
          sim.addCustom(gw);
          fighter.spawnGhost(sim, { color: P.hotHex, life: 0.26, opacity: 0.45 });
        }},
        { t: 1.18, run() {
          spawnMachShockRings3D(sim, { p0: new THREE.Vector3(0, 1.05, 0.2), p1: new THREE.Vector3(0, 1.05, 5.4), ringCount: 5, radius0: 0.26, radius1: 0.88, duration: 0.36, palette: P.pal });
          spawnBladeGroundScar3D(sim, { x: 0, z: 2.9, length: 4.8, width: 0.42, life: 0.95, zoneKind: 'void', palette: P.pal });
          sim.spawnGroundZone({ x: 0, z: 3.1, radius: 2.35, duration: 1.15, kind: 'void', palette: P.pal, emitFlames: true });
          sim.addCustom(new BeamCylinder3D({ p0: new THREE.Vector3(0, 1.05, 0.2), p1: new THREE.Vector3(0, 1.05, 5.6), radius: 0.24, duration: 0.42, palette: P.pal, texStyle, defaultTex: 'void', hdr: 2.4 }));
          for (const sgn of [-1, 1]) {
            sim.addCustom(new SlashArc3D({
              center: [0, 1.1, 3.0], radius: 2.2, width: 0.92, thickness: 0.26,
              a0: -1.4 * sgn, a1: 1.4 * sgn, tiltZ: 0.52 * sgn,
              sweep: 0.05, hold: 0.34, trail: 0.24, palette: P.pal, texStyle, defaultTex: 'void', hdrBoost: 2.45, seed: seed + (sgn > 0 ? 41 : 42),
            }));
          }
        }},
        { t: 1.50, run() {
          fighter.hitStop = 0.085;
          sim.spawnAirDistortion({ kind: 'implode', x: 0, y: 1.1, z: 3.2, r0: 0.2, r1: 2.5, duration: 0.38, strength: 0.88 });
          sim.addCustom(new ShockSphere3D({ x: 0, y: 1.1, z: 3.2, r0: 0.25, r1: 2.4, duration: 0.36, palette: P.pal, hdr: 2.55, useRunes: false }));
          dummies.forEach((d) => {
            d.hit({ dirX: d.homeX * 0.4, dirZ: -1, power: 1.85, flashColor: P.hotHex });
            sim.spawnFlipbook({ atlas: 'fbDarkVortex', x: d.root.position.x, y: 1.15, z: d.root.position.z, life: 0.36, size0: 1.1, size1: 2.2, palette: P.pal, hdr: 2.5 });
          });
        }},
      ];
    },
  },

  // 7. 長槍螺旋蓄力・貫龍破城突 (Spiral Charge Dragon Lance)
  {
    id: 'chg_spear_spiral_drill',
    cat: 'charge',
    cls: '龍騎槍兵 Dragoon',
    title: '長槍螺旋蓄力：蒼嵐貫龍破城突',
    codeId: 'chg.spear.spiral_drill',
    duration: 2.65,
    peakTime: 1.30,
    contactTimes: [1.26, 1.34],
    hitbox: { kind: 'rect', width: 2.2, length: 6.2 },
    specNotes: ['槍尖高速捲動翡翠風暴漩渦蓄力，1.22s 化作螺旋鑽頭突刺貫穿全線敵陣'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('windJade', paletteOverride);
      fighter.setLoadout('spear', hotHex);
      dummies[0].reset(0, 2.8, true);
      dummies[1].reset(0, 4.5, true);
      dummies[2].reset(0, 0, false);
    },
    keyframes: makeHeavyChargeSlamKeyframes(1.22, 2.55),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('windJade', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'helix', noSigil: true, getAnchor: () => fighter.getRightHandWorld(), duration: 1.12, radius: 1.7, palette: P.pal, rate: 185, vortex: 12.0, tiers: 3 });
        }},
        { t: 1.08, isPreGather: true, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.36, width: 0.22, palette: P.pal, hdr: 2.4 });
        }},
        { t: 1.22, run() {
          fighter.hitStop = 0.08;
          spawnMachShockRings3D(sim, { p0: new THREE.Vector3(0, 1.1, 0.6), p1: new THREE.Vector3(0, 1.1, 5.8), ringCount: 5, radius0: 0.26, radius1: 0.96, duration: 0.44, palette: P.pal });
          sim.spawnAirDistortion({ kind: 'shock', x: 0, y: 1.1, z: 1.4, r0: 0.2, r1: 2.4, duration: 0.36, strength: 0.85 });
          const v = new VortexFunnel3D({ x: 0, y: 1.1, z: 0.8, rBottom: 0.16, rTop: 1.05, height: 5.2, duration: 0.62, palette: P.pal, texStyle, defaultTex: 'silk', hdr: 2.35 });
          v.group.rotation.x = Math.PI / 2;
          sim.addCustom(v);
          sim.addCustom(new BeamCylinder3D({ p0: new THREE.Vector3(0, 1.1, 0.6), p1: new THREE.Vector3(0, 1.1, 6.0), radius: 0.30, duration: 0.55, palette: P.pal, texStyle, defaultTex: 'silk', hdr: 2.3 }));
          [dummies[0], dummies[1]].forEach((d) => {
            d.hit({ dirX: 0, dirZ: 1, power: 1.8, flashColor: P.hotHex });
            sim.spawnFlipbook({ atlas: 'fbWindTornado', x: 0, y: 1.15, z: d.root.position.z, life: 0.42, size0: 1.0, size1: 2.2, palette: P.pal, hdr: 2.4 });
          });
        }},
      ];
    },
  },

  // 8. 霸王重拳滿蓄力・碎星崩界拳 (Starbreaker Charged Fist)
  {
    id: 'chg_fist_starbreaker',
    cat: 'charge',
    cls: '武神宗師 Grandmaster',
    title: '霸王重拳蓄力：碎星崩界一擊',
    codeId: 'chg.fist.starbreaker',
    duration: 2.65,
    peakTime: 1.28,
    contactTimes: [1.24],
    hitbox: { kind: 'sector', radius: 4.4, angleDeg: 110 },
    specNotes: ['右拳壓縮三層黃金霸氣球，轟出瞬間炸開半透明音爆圓頂與扇形碎星衝擊波'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('warriorGold', paletteOverride);
      fighter.setLoadout('unarmed', hotHex);
      dummies[0].reset(0, 2.8, true);
      dummies[1].reset(-1.2, 3.6, true);
      dummies[2].reset(1.2, 3.6, true);
    },
    keyframes: makeHeavyChargeSlamKeyframes(1.20, 2.55),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const R = new Rng(seed);
      const P = resolvePal('warriorGold', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'astrolabe', noSigil: true, getAnchor: () => fighter.getRightHandWorld(), duration: 1.10, radius: 1.75, palette: P.pal, rate: 190, vortex: 9.0, tiers: 3 });
        }},
        { t: 1.20, run() {
          fighter.hitStop = 0.095;
          spawnMachShockRings3D(sim, { p0: new THREE.Vector3(0, 1.15, 0.6), p1: new THREE.Vector3(0, 1.15, 3.8), ringCount: 4, radius0: 0.32, radius1: 1.05, duration: 0.38, palette: P.pal });
          spawnBladeGroundScar3D(sim, R, { x: 0, z: 2.2, length: 3.0, width: 0.44, life: 0.85, palette: P.pal });
          sim.spawnGroundZone({ x: 0, z: 2.5, radius: 2.25, duration: 1.15, kind: 'crater', palette: P.pal, emitFlames: false, eruptRocks: true });
          sim.spawnAirDistortion({ kind: 'shock', x: 0, y: 1.15, z: 1.5, r0: 0.2, r1: 3.0, duration: 0.42, strength: 0.95 });
          sim.addCustom(new ShockSphere3D({ x: 0, y: 1.15, z: 1.4, r0: 0.18, r1: 2.8, duration: 0.38, palette: P.pal, hdr: 2.6, useRunes: false }));
          sim.addCustom(new SlashArc3D({
            center: [0, 1.12, 0.6], radius: 3.6, width: 1.35, thickness: 0.42,
            a0: -0.92, a1: 0.92, sweep: 0.06, hold: 0.06, trail: 0.25, palette: P.pal, texStyle, defaultTex: 'flame', hdrBoost: 2.5, seed: seed + 51,
          }));
          spawnGroundCracks(sim, R, { cx: 0, cz: 2.5, maxRadius: 2.4, branches: 8, life: 0.80, palette: P.pal, rockCount: 8, rockScale: 0.75 });
          dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.4, dirZ: 1, power: 2.0, flashColor: P.hotHex }));
        }},
      ];
    },
  },

  // 9. 大魔導滿蓄力詠唱・毀滅超新星 (Archmage Full-Chant Supernova)
  {
    id: 'chg_staff_supernova',
    cat: 'charge',
    cls: '星界大魔導 Archmage',
    title: '滿蓄力詠唱：星界毀滅超新星',
    codeId: 'chg.staff.supernova',
    duration: 2.80,
    peakTime: 1.46,
    contactTimes: [1.42],
    hitbox: { kind: 'circle', cx: 0, cz: 4.0, radius: 3.1 },
    specNotes: ['雙重奧術與星月法陣同步展開蓄力，半透明星核坍縮後引爆超新星衝擊球與滿天星屑'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageArcane', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 4.0, true);
      dummies[1].reset(-1.5, 4.3, true);
      dummies[2].reset(1.5, 4.3, true);
    },
    keyframes: makeHeavyChargeSlamKeyframes(1.38, 2.70),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('mageArcane', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          const s0 = new Sigil3D({ x: 0, y: 0.02, z: 0, radius: 1.85, duration: 1.32, style: 'solomon', palette: P.pal, hdr: 2.0, wallHeight: 0.5 });
          s0._skipAutoMap = true;
          sim.addCustom(s0);
          sim.spawnChargeGather({ variant: 'singularity', sigilStyle: 'celestial', getAnchor: () => fighter.getStaffTipWorld(), duration: 1.28, radius: 2.0, palette: P.pal, rate: 210, vortex: 10.0, tiers: 3 });
        }},
        { t: 1.38, run() {
          fighter.hitStop = 0.095;
          sim.addCustom(new Sigil3D({ x: 0, y: 0.02, z: 4.0, radius: 2.95, duration: 1.28, style: 'celestial', palette: P.pal, hdr: 2.1, wallHeight: 0.72 }));
          sim.spawnAirDistortion({ kind: 'shock', x: 0, y: 1.3, z: 4.0, r0: 0.25, r1: 3.1, duration: 0.48, strength: 0.95 });
          sim.spawnRockDebris({ x: 0, y: 0.14, z: 4.0, count: 10, radius: 0.6, life: 0.95, style: 'slate', palette: P.pal });
          sim.addCustom(new ShockSphere3D({ x: 0, y: 1.3, z: 4.0, r0: 0.25, r1: 2.95, duration: 0.45, palette: P.pal, hdr: 2.7, useRunes: true }));
          sim.addCustom(new GroundWave3D({ x: 0, z: 4.0, maxRadius: 2.95, thickness: 0.65, height: 1.05, duration: 0.50, palette: P.pal, hdr: 2.45, seed: seed + 61 }));
          sim.spawnFlipbook({ atlas: 'fbStarburst', x: 0, y: 1.5, z: 4.0, life: 0.56, size0: 1.6, size1: 3.6, palette: P.pal, hdr: 2.7 });
          dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 2.0, flashColor: P.hotHex }));
        }},
      ];
    },
  },

  // 10. 聖盾蓄力反擊・聖光裁決衝 (Paladin Charged Shield Ram)
  {
    id: 'chg_shield_holy_ram',
    cat: 'charge',
    cls: '聖殿騎士 Paladin',
    title: '聖盾滿蓄力：半透明聖翼裁決衝',
    codeId: 'chg.shield.holy_ram',
    duration: 2.65,
    peakTime: 1.28,
    contactTimes: [1.22, 1.32],
    hitbox: { kind: 'rect', width: 2.6, length: 5.6 },
    specNotes: ['身前展開半透明玫瑰花窗聖盾吸納金光蓄力，1.18s 頂盾高速猛衝撞飛全線敵人！'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('sword_shield', hotHex);
      dummies[0].reset(0, 2.7, true);
      dummies[1].reset(-0.85, 4.3, true);
      dummies[2].reset(0.85, 4.3, true);
    },
    releaseTime: 1.08,
    releaseIsTakeoff: true,
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE, ...SHIELD_GUARD, crouch: 0.18 } },
      { t: 1.08, ease: ease.inCubic, pose: { ...REST_POSE, ...SHIELD_GUARD, crouch: 0.28, torsoPitch: 0.22 } },
      { t: 1.20, ease: ease.outExpo, pose: { ...REST_POSE, ...SHIELD_GUARD, z: 3.8, crouch: 0.20, torsoPitch: 0.30, capePitch: 0.85 } },
      { t: 2.55, ease: ease.inOutCubic, pose: { ...REST_POSE, ...SHIELD_GUARD } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('holyGold', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          const sh = buildTowerShieldAssembly({ palette: P.pal, scale: 1.32 });
          let el = 0;
          sim.spawnChargeGather({ variant: 'wings', noSigil: true, getAnchor: () => { const v = new THREE.Vector3(0, 1.05, fighter.root.position.z + 0.92); v._isWorldScaled = true; return v; }, duration: 1.00, radius: 1.7, palette: P.pal, rate: 175, vortex: 8.5, tiers: 3 });
          const item = {
            group: sh.group,
            _skipAutoMap: true,
            update(dt) {
              el += dt; sh.update(dt);
              sh.group.position.set(0, 1.05, fighter.root.position.z + 0.90);
              sh.setOpacity(1 - smooth(0.88, 1.02, el));
            },
            get done() { return el >= 1.03; },
            dispose() { sh.dispose(); },
          };
          sim.addCustom(item);
        }},
        { t: 1.08, run() {
          const sh = buildTowerShieldAssembly({ palette: P.pal, scale: 1.36 });
          sh.triggerFlash();
          let el = 0;
          sim.addCustom({
            group: sh.group,
            _skipAutoMap: true,
            update(dt) {
              el += dt; sh.update(dt);
              sh.group.position.set(0, 1.05, fighter.root.position.z + 0.90);
              sh.setOpacity(1 - smooth(0.48, 0.82, el));
            },
            get done() { return el >= 0.85; },
            dispose() { sh.dispose(); },
          });
        }},
        { t: 1.20, run() {
          fighter.hitStop = 0.085;
          spawnMachShockRings3D(sim, { p0: new THREE.Vector3(0, 1.05, 0.4), p1: new THREE.Vector3(0, 1.05, 3.8), ringCount: 4, radius0: 0.32, radius1: 0.98, duration: 0.36, palette: P.pal });
          spawnBladeGroundScar3D(sim, { x: 0, z: 2.2, length: 3.4, width: 0.48, life: 0.85, zoneKind: 'crater', palette: P.pal });
          sim.spawnGroundZone({ x: 0, z: 3.4, radius: 2.15, duration: 1.10, kind: 'crater', palette: P.pal, eruptRocks: true });
          sim.spawnAirDistortion({ kind: 'shock', x: 0, y: 1.1, z: 3.4, r0: 0.2, r1: 2.5, duration: 0.38, strength: 0.86 });
          sim.addCustom(new ShockSphere3D({ x: 0, y: 1.1, z: 3.4, r0: 0.2, r1: 2.3, duration: 0.38, palette: P.pal, hdr: 2.5, useRunes: false }));
          dummies.forEach((d) => {
            d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 1.85, flashColor: P.hotHex });
            sim.spawnFlipbook({ atlas: 'fbFeatherBurst', x: d.root.position.x, y: 1.15, z: d.root.position.z, life: 0.40, size0: 0.95, size1: 2.0, palette: P.pal, hdr: 2.4 });
          });
        }},
      ];
    },
  },

  // 11. 雙刃暗影蓄力・瞬獄千裂斬 (Dual-Blade Shadow Lotus Charge)
  {
    id: 'chg_dagger_shadow_lotus',
    cat: 'charge',
    cls: '影舞刺客 Shadowblade',
    title: '雙刃暗影蓄力：深淵瞬獄千裂斬',
    codeId: 'chg.dagger.shadow_lotus',
    duration: 2.65,
    peakTime: 1.38,
    contactTimes: [1.22, 1.34, 1.46],
    hitbox: { kind: 'circle', cx: 0, cz: 3.2, radius: 2.6 },
    specNotes: ['雙匕凝聚深淵紫黑漩渦蓄力，瞬間在敵陣中綻放 6 道立體暗影蓮華斬弧！'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('voidAbyss', paletteOverride);
      fighter.setLoadout('dual_daggers', hotHex);
      dummies[0].reset(0, 3.2, true);
      dummies[1].reset(-1.25, 3.5, true);
      dummies[2].reset(1.25, 3.5, true);
    },
    keyframes: makeHeavyChargeSlamKeyframes(1.20, 2.55),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('voidAbyss', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'mirage', noSigil: true, getAnchor: () => fighter.getRightHandWorld(), duration: 1.10, radius: 1.75, palette: P.pal, rate: 185, vortex: 11.5, tiers: 3 });
        }},
        { t: 1.08, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.42, width: 0.20, palette: P.pal, dual: true, hdr: 2.5 });
          fighter.spawnGhost(sim, { color: P.hotHex, life: 0.28, opacity: 0.42 });
        }},
        { t: 1.20, run() {
          fighter.hitStop = 0.08;
          spawnBladeGroundScar3D(sim, { x: 0, z: 3.2, yaw: 0.68, length: 2.8, width: 0.38, life: 0.88, zoneKind: 'void', palette: P.pal });
          spawnBladeGroundScar3D(sim, { x: 0, z: 3.2, yaw: -0.68, length: 2.8, width: 0.38, life: 0.88, zoneKind: 'void', palette: P.pal });
          sim.spawnGroundZone({ x: 0, z: 3.2, radius: 2.35, duration: 1.10, kind: 'void', palette: P.pal, emitFlames: true });
          for (let i = 0; i < 6; i++) {
            sim.addCustom(new SlashArc3D({
              center: [0, 1.15, 3.2], radius: 2.25, width: 0.86, thickness: 0.24,
              a0: (i * 1.05) - 1.3, a1: (i * 1.05) + 1.3, tiltX: (i - 2.5) * 0.36, tiltZ: (i % 2 ? 1 : -1) * 0.45,
              delay: i * 0.04, sweep: 0.055, hold: 0.05, trail: 0.22, palette: P.pal, texStyle, defaultTex: i % 2 === 0 ? 'void' : 'blood', hdrBoost: 2.45, seed: seed + 70 + i,
            }));
          }
          dummies.forEach((d) => {
            d.hit({ dirX: d.homeX * 0.4, dirZ: 1, power: 1.75, flashColor: P.hotHex });
            sim.spawnFlipbook({ atlas: 'fbDarkVortex', x: d.root.position.x, y: 1.12, z: d.root.position.z, life: 0.40, size0: 0.9, size1: 1.9, palette: P.pal, hdr: 2.3 });
          });
        }},
      ];
    },
  },

  // 12. 狂戰巨斧蓄力・煉獄大迴旋 (Berserker Charged Fire Whirlwind)
  {
    id: 'chg_axe_inferno_spin',
    cat: 'charge',
    cls: '狂戰士 Berserker',
    title: '戰斧蓄力解放：煉獄大迴旋斬',
    codeId: 'chg.axe.inferno_spin',
    duration: 2.70,
    peakTime: 1.36,
    contactTimes: [1.20, 1.36, 1.52],
    hitbox: { kind: 'circle', cx: 0, cz: 0, radius: 3.4 },
    specNotes: ['原地壓低身軀蓄滿三層烈焰漩渦，解放瞬間連續三圈 360° 雙層火龍捲刀輪席捲全場'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      dummies[0].reset(0, 2.6, true);
      dummies[1].reset(-2.2, 1.4, true);
      dummies[2].reset(2.2, 1.4, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE, crouch: 0.22, torsoYaw: -0.75, shRPitch: -1.45, shRYaw: -0.65 } },
      { t: 1.08, ease: ease.inCubic, pose: { ...REST_POSE, crouch: 0.30, torsoYaw: -0.95, shRPitch: -1.52, shRYaw: -0.75 } },
      { t: 1.16, ease: ease.outExpo, pose: { ...REST_POSE, crouch: 0.20, yaw: TAU * 0.55, shRPitch: -1.55, capePitch: 0.85 } },
      { t: 1.66, ease: ease.outQuart, pose: { ...REST_POSE, crouch: 0.16, yaw: TAU * 3, shRPitch: -1.55, capePitch: 0.85 } },
      { t: 2.60, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('fireInferno', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'debris', noSigil: true, getAnchor: () => { const v = new THREE.Vector3(0, 1.0, 0); v._isWorldScaled = true; return v; }, duration: 1.08, radius: 2.1, palette: P.pal, rate: 190, vortex: 10.0, tiers: 3 });
        }},
        { t: 1.12, isPreGather: true, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.56, width: 0.25, palette: P.pal, hdr: 2.55 });
        }},
        { t: 1.16, run() {
          sim.spawnGroundZone({ x: 0, z: 0, radius: 2.95, duration: 1.18, kind: 'burning', palette: P.pal, emitFlames: true, eruptRocks: true });
          sim.addCustom(new VortexFunnel3D({ x: 0, y: 0.02, z: 0, rBottom: 1.2, rTop: 2.8, height: 2.6, duration: 0.68, palette: P.pal, texStyle, defaultTex: 'flame', hdr: 2.35 }));
          for (let i = 0; i < 3; i++) {
            sim.addCustom(new SlashArc3D({
              center: [0, 0.95 + i * 0.22, 0], radius: 3.1, width: 1.15, thickness: 0.32,
              a0: i * 2.1, a1: i * 2.1 + TAU * 0.92, delay: i * 0.12,
              sweep: 0.12, hold: 0.05, trail: 0.24, palette: P.pal, texStyle, defaultTex: 'flame', hdrBoost: 2.45, seed: seed + 80 + i,
            }));
          }
          dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 1.8, flashColor: P.hotHex }));
        }},
      ];
    },
  },

  // 13. 死神巨鐮滿蓄力・斷魂滿月斬 (Reaper Charged Full-Moon Scythe)
  {
    id: 'chg_scythe_fullmoon',
    cat: 'charge',
    cls: '死神收割者 Reaper',
    title: '巨鐮滿蓄力：冥界斷魂滿月斬',
    codeId: 'chg.scythe.fullmoon',
    duration: 2.65,
    peakTime: 1.30,
    contactTimes: [1.26],
    hitbox: { kind: 'sector', radius: 4.5, angleDeg: 160 },
    specNotes: ['背後升起半透明深淵血月蓄力，滿蓄力揮出 4.1m 超大弧度血紫雙色巨鐮刀輪！'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('rogueBlood', paletteOverride);
      fighter.setLoadout('scythe', hotHex);
      dummies[0].reset(0, 3.3, true);
      dummies[1].reset(-1.8, 3.0, true);
      dummies[2].reset(1.8, 3.0, true);
    },
    keyframes: makeHeavyChargeSlamKeyframes(1.22, 2.55),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('rogueBlood', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'singularity', noSigil: true, getAnchor: () => fighter.getRightHandWorld(), duration: 1.12, radius: 1.9, palette: P.pal, rate: 185, vortex: 9.5, tiers: 3 });
        }},
        { t: 1.08, isPreGather: true, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.36, width: 0.26, palette: P.pal, hdr: 2.55 });
        }},
        { t: 1.22, run() {
          fighter.hitStop = 0.09;
          spawnBladeGroundScar3D(sim, { x: 0, z: 2.4, yaw: 1.25, length: 3.6, width: 0.42, life: 0.88, palette: P.pal });
          const scy = buildReaperScytheAssembly({ palette: P.pal, scale: 1.45 });
          let el = 0;
          sim.addCustom({
            group: scy.group,
            update(dt) {
              el += dt; scy.update(dt);
              scy.group.position.set(0, 1.15, 1.2);
              scy.group.rotation.set(Math.PI * 0.44, el * 9.0, 0.18);
              scy.setOpacity(1 - smooth(0.45, 0.92, el));
            },
            get done() { return el >= 0.95; },
            dispose() { scy.dispose(); },
          });
          sim.addCustom(new SlashArc3D({
            center: [0, 1.08, 0.3], radius: 4.05, width: 1.42, thickness: 0.36,
            a0: -1.45, a1: 1.45, tiltZ: -0.14,
            sweep: 0.075, hold: 0.07, trail: 0.28, palette: P.pal, texStyle, defaultTex: 'blood', hdrBoost: 2.6, seed: seed + 91,
          }));
          dummies.forEach((d) => {
            d.hit({ dirX: d.homeX * 0.4, dirZ: 1, power: 1.9, flashColor: P.hotHex });
            sim.spawnFlipbook({ atlas: 'fbBloodSplash', x: d.root.position.x, y: 1.12, z: d.root.position.z, life: 0.42, size0: 0.95, size1: 2.1, palette: P.pal, hdr: 2.35 });
            sim.spawnStatusMark('bleed', d.root.position, 0.95);
          });
        }},
      ];
    },
  },

  // 14. 氣功聚氣滿蓄力・蒼龍破極波 (Monk Kamehameha Dragon Wave)
  {
    id: 'chg_monk_dragon_cannon',
    cat: 'charge',
    cls: '武道氣宗 Chi Master',
    title: '雙掌聚氣滿蓄力：蒼龍破極氣功砲',
    codeId: 'chg.monk.dragon_cannon',
    duration: 2.75,
    peakTime: 1.42,
    contactTimes: [1.30, 1.48],
    hitbox: { kind: 'rect', width: 2.4, length: 6.6 },
    specNotes: ['雙掌於腰側凝聚三層高密度蒼藍氣旋球，1.26s 雙掌前推轟出粗壯螺旋氣功巨砲！'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('waterAqua', paletteOverride);
      fighter.setLoadout('unarmed', hotHex);
      dummies[0].reset(0, 3.0, true);
      dummies[1].reset(0, 5.2, true);
      dummies[2].reset(0, 0, false);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE, crouch: 0.18, torsoYaw: -0.58, shRPitch: -0.65, shRYaw: -0.55, elRPitch: -0.95, shLPitch: -0.65, shLYaw: -0.35, elLPitch: -0.95 } },
      { t: 1.16, ease: ease.inCubic, pose: { ...REST_POSE, crouch: 0.26, torsoYaw: -0.68, shRPitch: -0.62, shRYaw: -0.62, elRPitch: -1.05, shLPitch: -0.62, shLYaw: -0.42, elLPitch: -1.05 } },
      { t: 1.26, ease: ease.outExpo, pose: { ...REST_POSE, z: 0.25, crouch: 0.22, torsoPitch: 0.20, shRPitch: -1.52, shRYaw: -0.12, elRPitch: -0.05, shLPitch: -1.52, shLYaw: 0.12, elLPitch: -0.05, capePitch: 0.82 } },
      { t: 2.65, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('waterAqua', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'funnels', noSigil: true, getAnchor: () => fighter.getRightHandWorld(), duration: 1.18, radius: 1.85, palette: P.pal, rate: 205, vortex: 11.0, tiers: 3 });
        }},
        { t: 1.26, run() {
          fighter.hitStop = 0.09;
          const p0 = new THREE.Vector3(0, 1.15, 0.75);
          const p1 = new THREE.Vector3(0, 1.15, 6.5);
          spawnMachShockRings3D(sim, { p0, p1, ringCount: 5, radius0: 0.35, radius1: 1.12, duration: 0.46, palette: P.pal });
          const drg = buildDragonSpiritHeadAssembly({ palette: P.pal, scale: 1.45 });
          let el = 0;
          sim.addCustom({
            group: drg.group,
            update(dt) {
              el += dt; drg.update(dt);
              drg.group.position.lerpVectors(p0, p1, clamp(el / 0.28));
              drg.group.lookAt(0, 1.15, 7.5);
              drg.setOpacity(1 - smooth(0.45, 0.85, el));
            },
            get done() { return el >= 0.88; },
            dispose() { drg.dispose(); },
          });
          sim.spawnAirDistortion({ kind: 'shock', x: 0, y: 1.15, z: 0.85, r0: 0.2, r1: 2.3, duration: 0.36, strength: 0.85 });
          sim.addCustom(new ShockSphere3D({ x: 0, y: 1.15, z: 0.85, r0: 0.15, r1: 1.75, duration: 0.34, palette: P.pal, hdr: 2.55, useRunes: false }));
          sim.addCustom(new BeamCylinder3D({ p0, p1, radius: 0.48, duration: 0.78, palette: P.pal, texStyle, defaultTex: 'frost', hdr: 2.55 }));
          [dummies[0], dummies[1]].forEach((d) => {
            d.hit({ dirX: 0, dirZ: 1, power: 1.95, flashColor: P.hotHex });
            sim.spawnFlipbook({ atlas: 'fbHitBurst', x: 0, y: 1.15, z: d.root.position.z, life: 0.46, size0: 1.1, size1: 2.4, palette: P.pal, hdr: 2.5 });
          });
        }},
      ];
    },
  },

  // 15. 月光聖劍蓄力・蒼月破浪斬 (Moonlight Greatsword Charged Wave)
  {
    id: 'chg_gs_moonlight_wave',
    cat: 'charge',
    cls: '星月魔劍士 Moonlight Knight',
    title: '月光大劍蓄力：半透明蒼月劍氣波',
    codeId: 'chg.gs.moonlight_wave',
    duration: 2.70,
    peakTime: 1.38,
    contactTimes: [1.34, 1.46],
    hitbox: { kind: 'rect', width: 3.0, length: 6.2 },
    specNotes: ['高舉半透明冰藍月光巨劍蓄力，揮落瞬間犁開冰裂劍溝並向前滑行推進一道巨型彎月劍氣波！'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageFrost', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      dummies[0].reset(0, 3.2, true);
      dummies[1].reset(-1.1, 5.0, true);
      dummies[2].reset(1.1, 5.0, true);
    },
    keyframes: makeHeavyChargeSlamKeyframes(1.24, 2.60),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('mageFrost', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'astrolabe', noSigil: true, getAnchor: () => fighter.getSwordTipWorld(), duration: 1.15, radius: 1.85, palette: P.pal, rate: 190, vortex: 9.5, tiers: 3 });
        }},
        { t: 1.10, isPreGather: true, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.36, width: 0.25, palette: P.pal, hdr: 2.55 });
        }},
        { t: 1.24, run() {
          fighter.hitStop = 0.085;
          spawnBladeGroundScar3D(sim, { x: 0, z: 2.8, length: 4.2, width: 0.42, life: 0.92, zoneKind: 'frost', palette: P.pal });
          sim.spawnGroundZone({ x: 0, z: 3.4, radius: 2.15, duration: 1.10, kind: 'frost', palette: P.pal, emitFlames: true });
          const waveArc = new SlashArc3D({
            center: [0, 1.15, 0.8], radius: 2.1, width: 0.95, thickness: 0.30,
            a0: -1.15, a1: 1.15, sweep: 0.05, hold: 0.36, trail: 0.22,
            palette: P.pal, texStyle, defaultTex: 'frost', hdrBoost: 2.55, seed: seed + 101,
          });
          const origUpd = waveArc.update.bind(waveArc);
          waveArc.update = (dt) => { origUpd(dt); waveArc.group.position.z += dt * 11.5; };
          sim.addCustom(waveArc);
          dummies.forEach((d) => {
            d.hit({ dirX: d.homeX * 0.35, dirZ: 1, power: 1.85, flashColor: P.hotHex });
            sim.spawnFlipbook({ atlas: 'fbIceShatter', x: d.root.position.x, y: 1.15, z: d.root.position.z, delay: 0.12, life: 0.36, size0: 1.0, size1: 2.1, palette: P.pal, hdr: 2.45 });
          });
        }},
      ];
    },
  },

  // 16. 浮游魔導結晶蓄力・六芒毀滅砲 (6-Crystal Funnel Convergence Beam)
  {
    id: 'chg_crystal_funnel_cannon',
    cat: 'charge',
    cls: '魔導機神 Technomancer',
    title: '六芒浮游稜鏡蓄力：集束毀滅聖砲',
    codeId: 'chg.crystal.funnel_cannon',
    duration: 2.75,
    peakTime: 1.44,
    contactTimes: [1.38],
    hitbox: { kind: 'rect', width: 2.4, length: 6.4 },
    specNotes: ['背後展開 6 枚半透明全息浮游稜鏡同步聚能，1.32s 六道光束匯聚轟出超大型虹光集束砲！'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageEmerald', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.6, true);
      dummies[1].reset(-0.85, 5.4, true);
      dummies[2].reset(0.85, 5.4, true);
    },
    keyframes: makeHeavyChargeSlamKeyframes(1.32, 2.65),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('mageEmerald', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ variant: 'funnels', sigilStyle: 'cyberRune', getAnchor: () => { const v = new THREE.Vector3(0, 1.45, 0.95); v._isWorldScaled = true; return v; }, duration: 1.24, radius: 1.95, palette: P.pal, rate: 195, vortex: 10.5, tiers: 3 });
        }},
        { t: 1.32, run() {
          fighter.hitStop = 0.09;
          const focus = new THREE.Vector3(0, 1.25, 1.5);
          const end = new THREE.Vector3(0, 1.20, 6.3);
          sim.spawnAirDistortion({ kind: 'shock', x: 0, y: 1.25, z: 1.5, r0: 0.2, r1: 2.4, duration: 0.36, strength: 0.88 });
          sim.spawnGroundZone({ x: 0, z: 4.5, radius: 1.9, duration: 1.05, kind: 'lightning', palette: P.pal, emitFlames: true });
          sim.addCustom(new BeamCylinder3D({ p0: focus, p1: end, radius: 0.44, duration: 0.72, palette: P.pal, texStyle, defaultTex: 'volt', hdr: 2.55 }));
          sim.addCustom(new ShockSphere3D({ x: 0, y: 1.25, z: 1.5, r0: 0.15, r1: 1.65, duration: 0.35, palette: P.pal, hdr: 2.5, useRunes: true }));
          dummies.forEach((d) => {
            d.hit({ dirX: d.homeX * 0.4, dirZ: 1, power: 1.9, flashColor: P.hotHex });
            sim.spawnFlipbook({ atlas: 'fbStarburst', x: d.root.position.x, y: 1.2, z: d.root.position.z, life: 0.42, size0: 1.0, size1: 2.2, palette: P.pal, hdr: 2.5 });
          });
        }},
      ];
    },
  },
];
