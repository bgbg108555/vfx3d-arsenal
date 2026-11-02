import * as THREE from 'three';
import {
  TAU, clamp, lerp, smooth, ease, Rng, PAL3D,
  SlashArc3D, GroundWave3D, VortexFunnel3D, BeamCylinder3D, Sigil3D, DomeShield3D, ShockSphere3D,
  makeTranslucentConstructMaterial, getScaledHitbox,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import {
  resolvePal, SHIELD_GUARD, makeSkyChantKeyframes, makeStaffCastKeyframes,
  spawnGroundCracks, spawnArcaneOrb,
  attachWeaponBladeTrail3D, spawnMartialStanceGust3D, spawnBladeGroundScar3D, spawnMachShockRings3D,
} from './fx_helpers.js';
import {
  buildMagmaMeteorAssembly, buildTowerShieldAssembly, buildSpiritSwordAssembly, buildArmillaryAstrolabeAssembly,
} from './mesh_props3d.js';
import { spawnSustainedBlizzardZone, spawnSustainedMeteorZone } from './env_fx3d.js';

function makeSkyLeapKeyframes(jumpT = 0.28, apexT = 0.62, landT = 0.86, targetZ = 3.2, endT = 2.45) {
  return [
    { t: 0.00, pose: { ...REST_POSE, y: 0, z: 0, crouch: 0.20, torsoPitch: 0.18 } },
    { t: 0.14, ease: ease.inCubic, pose: { ...REST_POSE, y: 0, z: 0, crouch: 0.34, torsoPitch: 0.28, shRPitch: -0.95, shLPitch: -0.85, capePitch: 0.45 } },
    { t: jumpT, ease: ease.outQuad, pose: { ...REST_POSE, y: 2.85, z: targetZ * 0.45, torsoPitch: -0.25, shRPitch: -2.25, shLPitch: -1.85, hipRPitch: -0.45, kneeRPitch: 0.85, capePitch: 0.92 } },
    { t: apexT, ease: ease.inOutSine, pose: { ...REST_POSE, y: 3.65, z: targetZ * 0.82, torsoPitch: -0.15, shRPitch: -2.45, shLPitch: -2.05, capePitch: 1.05 } },
    { t: landT, ease: ease.inExpo, pose: { ...REST_POSE, y: 0.0, z: targetZ, crouch: 0.32, torsoPitch: 0.36, shRPitch: -0.85, shLPitch: -0.95, capePitch: 0.78 } },
    { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE } },
  ];
}

function makeRushChargeKeyframes(rushStart = 0.20, rushEnd = 0.56, targetZ = 4.2, endT = 2.25) {
  return [
    { t: 0.00, pose: { ...REST_POSE, ...SHIELD_GUARD, y: 0, z: 0, crouch: 0.22, torsoPitch: 0.20 } },
    { t: rushStart, ease: ease.inCubic, pose: { ...REST_POSE, ...SHIELD_GUARD, y: 0, z: 0, crouch: 0.32, torsoPitch: 0.28 } },
    { t: rushEnd, ease: ease.outExpo, pose: { ...REST_POSE, ...SHIELD_GUARD, z: targetZ, crouch: 0.20, torsoPitch: 0.32, shRPitch: -1.35, capePitch: 0.92 } },
    { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE, ...SHIELD_GUARD } },
  ];
}

export const PRESETS_LEAP_SPELLS = [
  // ---- 3 CHARGE / RUSH SKILLS (衝鋒類) ----
  {
    id: 'rush_shield_vanguard',
    cat: 'leap_spell',
    cls: '先鋒聖騎 Vanguard',
    title: '衝鋒戰技：半透明聖盾破陣衝鋒',
    codeId: 'rush.shield.vanguard',
    duration: 2.35,
    releaseTime: 0.20,
    releaseIsTakeoff: true,
    peakTime: 0.54,
    contactTimes: [0.40, 0.54],
    hitbox: { kind: 'rect', width: 2.6, length: 5.6 },
    specNotes: ['頂起半透明神聖玫瑰塔盾直線突進 4.2m，沿途拖曳黃金音爆環與裂地碎石撞飛敵群'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('sword_shield', hotHex);
      dummies[0].reset(0, 2.8, true);
      dummies[1].reset(-0.85, 4.4, true);
      dummies[2].reset(0.85, 4.4, true);
    },
    keyframes: makeRushChargeKeyframes(0.20, 0.54, 4.0, 2.25),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('holyGold', paletteOverride);
      return [
        { t: 0.20, run() {
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.25, duration: 0.42, palette: P.pal, _mapped: true });
          spawnMachShockRings3D(sim, { p0: new THREE.Vector3(0, 1.0, 0.5), p1: new THREE.Vector3(0, 1.0, 4.4), ringCount: 4, radius0: 0.30, radius1: 0.95, duration: 0.38, palette: P.pal });
          spawnBladeGroundScar3D(sim, R, { x: 0, z: 2.3, length: 3.8, width: 0.48, life: 0.90, palette: P.pal });
          const sh = buildTowerShieldAssembly({ palette: P.pal, scale: 1.32 });
          let el = 0;
          sim.addCustom({
            group: sh.group,
            update(dt) {
              el += dt; sh.update(dt);
              sh.group.position.set(0, 1.05, fighter.root.position.z + 0.85);
              sh.setOpacity(1 - smooth(0.95, 1.35, el));
            },
            get done() { return el >= 1.38; },
            dispose() { sh.dispose(); },
          });
          sim.addCustom(new BeamCylinder3D({ p0: new THREE.Vector3(0, 0.95, 0.4), p1: new THREE.Vector3(0, 0.95, 4.8), radius: 0.42, duration: 0.58, palette: P.pal, texStyle, defaultTex: 'flame', hdr: 2.25 }));
        }},
        { t: 0.54, run() {
          fighter.hitStop = 0.08;
          sim.addCustom(new ShockSphere3D({ x: 0, y: 1.05, z: 4.4, r0: 0.2, r1: 2.2, duration: 0.36, palette: P.pal, hdr: 2.45, useRunes: false }));
          spawnGroundCracks(sim, R, { cx: 0, cz: 4.2, maxRadius: 2.1, branches: 7, life: 0.85, palette: P.pal, rockCount: 7, rockScale: 0.72 });
          dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 1.85, flashColor: P.hotHex }));
        }},
      ];
    },
  },
  {
    id: 'rush_volt_blitz',
    cat: 'leap_spell',
    cls: '雷閃劍客 Volt Blader',
    title: '極速突進：雷光閃電連環疾馳',
    codeId: 'rush.volt.blitz',
    duration: 2.30,
    releaseTime: 0.20,
    releaseIsTakeoff: true,
    peakTime: 0.56,
    contactTimes: [0.32, 0.44, 0.56],
    hitbox: { kind: 'rect', width: 2.8, length: 5.8 },
    specNotes: ['雙刃裹挾雷光Z字形極速穿梭三名敵人，留下殘像、雙刃刀光軌跡與麻痺電爆'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('dual_daggers', hotHex);
      dummies[0].reset(-0.9, 2.4, true);
      dummies[1].reset(0.9, 3.6, true);
      dummies[2].reset(0, 4.9, true);
    },
    keyframes: makeRushChargeKeyframes(0.20, 0.56, 4.6, 2.20),
    buildEvents(sim, fighter, dummies, _seed, paletteOverride) {
      const P = resolvePal('mageVolt', paletteOverride);
      const pts = [new THREE.Vector3(0, 1.0, 0), new THREE.Vector3(-0.9, 1.1, 2.4), new THREE.Vector3(0.9, 1.1, 3.6), new THREE.Vector3(0, 1.1, 4.9)];
      return [
        { t: 0.20, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.46, width: 0.19, palette: P.pal, dual: true, hdr: 2.5 });
          sim.addCustom(new GroundWave3D({ x: 0, z: 0, maxRadius: 1.35, thickness: 0.28, height: 0.42, duration: 0.25, palette: P.pal }));
        }},
        { t: 0.32, run() {
          fighter.spawnGhost(sim, { color: P.hotHex, life: 0.22, opacity: 0.40 });
          sim.spawnBolt(pts[0], pts[1], { radius: 0.055, jitter: 0.26, life: 0.48, color: P.hotHex });
          sim.spawnFlipbook({ atlas: 'fbLightning', x: pts[1].x, y: 1.15, z: pts[1].z, life: 0.36, size0: 0.9, size1: 1.9, palette: P.pal, hdr: 2.45 });
          dummies[0].hit({ dirX: 0, dirZ: 1, power: 1.55, flashColor: P.hotHex });
        }},
        { t: 0.44, run() {
          fighter.spawnGhost(sim, { color: P.hotHex, life: 0.22, opacity: 0.40 });
          sim.spawnBolt(pts[1], pts[2], { radius: 0.055, jitter: 0.26, life: 0.46, color: P.hotHex });
          sim.spawnFlipbook({ atlas: 'fbLightning', x: pts[2].x, y: 1.15, z: pts[2].z, life: 0.36, size0: 0.9, size1: 1.9, palette: P.pal, hdr: 2.45 });
          dummies[1].hit({ dirX: 0, dirZ: 1, power: 1.60, flashColor: P.hotHex });
        }},
        { t: 0.56, run() {
          fighter.hitStop = 0.07;
          fighter.spawnGhost(sim, { color: P.hotHex, life: 0.24, opacity: 0.44 });
          sim.spawnBolt(pts[2], pts[3], { radius: 0.058, jitter: 0.26, life: 0.48, color: P.hotHex });
          sim.spawnFlipbook({ atlas: 'fbLightning', x: pts[3].x, y: 1.15, z: pts[3].z, life: 0.38, size0: 0.95, size1: 2.0, palette: P.pal, hdr: 2.45 });
          dummies[2].hit({ dirX: 0, dirZ: 1, power: 1.75, flashColor: P.hotHex });
        }},
      ];
    },
  },
  {
    id: 'rush_bull_stampede',
    cat: 'leap_spell',
    cls: '蠻荒狂戰 Juggernaut',
    title: '重裝衝撞：熔岩蠻牛裂地猛衝',
    codeId: 'rush.earth.stampede',
    duration: 2.35,
    releaseTime: 0.20,
    releaseIsTakeoff: true,
    peakTime: 0.58,
    contactTimes: [0.42, 0.56],
    hitbox: { kind: 'rect', width: 2.8, length: 5.6 },
    specNotes: ['全身包覆熔岩氣旋直線狂奔，腳步連續炸開三道熔岩地裂、音爆氣環與飛散火石'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('earthMagma', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      dummies[0].reset(0, 2.9, true);
      dummies[1].reset(-1.0, 4.5, true);
      dummies[2].reset(1.0, 4.5, true);
    },
    keyframes: makeRushChargeKeyframes(0.20, 0.56, 4.1, 2.25),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('earthMagma', paletteOverride);
      return [
        { t: 0.20, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.48, width: 0.24, palette: P.pal, hdr: 2.45 });
          spawnMachShockRings3D(sim, { p0: new THREE.Vector3(0, 1.05, 0.5), p1: new THREE.Vector3(0, 1.05, 4.2), ringCount: 4, radius0: 0.32, radius1: 0.98, duration: 0.40, palette: P.pal });
          sim.addCustom(new GroundWave3D({ x: 0, z: 0, maxRadius: 1.45, thickness: 0.34, height: 0.52, duration: 0.28, palette: P.pal, seed }));
        }},
        ...[0, 1, 2].map((i) => ({
          t: 0.28 + i * 0.14,
          run() {
            const zc = 1.5 + i * 1.35;
            spawnGroundCracks(sim, R, { cx: 0, cz: zc, maxRadius: 1.65, branches: 6, life: 0.85, palette: P.pal, rockCount: 5, rockScale: 0.7 });
            sim.spawnFlipbook({ atlas: 'fbExplosion', x: 0, y: 0.9, z: zc, life: 0.42, size0: 0.95, size1: 2.1, palette: P.pal, hdr: 2.35 });
          },
        })),
        { t: 0.56, run() {
          fighter.hitStop = 0.085;
          spawnBladeGroundScar3D(sim, R, { x: 0, z: 2.6, length: 3.6, width: 0.48, life: 0.85, zoneKind: 'burning', palette: P.pal });
          sim.addCustom(new ShockSphere3D({ x: 0, y: 1.0, z: 4.3, r0: 0.2, r1: 2.3, duration: 0.38, palette: P.pal, hdr: 2.45, useRunes: false }));
          dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 1.9, flashColor: P.hotHex }));
        }},
      ];
    },
  },

  // ---- 4 SKY-LEAP & LANDING SLAMS (飛上天・落地類) ----
  {
    id: 'leap_dragoon_stardiver',
    cat: 'leap_spell',
    cls: '蒼穹龍騎 Dragoon',
    title: '飛天落地：蒼穹龍躍・墜星破滅槍',
    codeId: 'leap.dragoon.stardiver',
    duration: 2.55,
    releaseTime: 0.14,
    releaseIsTakeoff: true,
    peakTime: 0.90,
    contactTimes: [0.86],
    hitbox: { kind: 'circle', cx: 0, cz: 3.4, radius: 2.9 },
    specNotes: ['原地旋風躍升 3.65m 高空懸停，穿破四重馬赫音障環垂直貫落敵陣，炸開碎裂彈坑與龍騎槍柱！'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageArcane', paletteOverride);
      fighter.setLoadout('spear', hotHex);
      dummies[0].reset(0, 3.4, true);
      dummies[1].reset(-1.4, 3.7, true);
      dummies[2].reset(1.4, 3.7, true);
    },
    keyframes: makeSkyLeapKeyframes(0.28, 0.62, 0.86, 3.1, 2.45),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('mageArcane', paletteOverride);
      return [
        { t: 0.14, run() {
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.35, duration: 0.45, palette: P.pal, _mapped: true });
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.78, width: 0.22, palette: P.pal, hdr: 2.5 });
          const vf = new VortexFunnel3D({ x: 0, y: 0.02, z: 0, rBottom: 0.45, rTop: 1.35, height: 2.8, duration: 0.45, palette: P.pal, texStyle, defaultTex: 'silk', hdr: 2.2 });
          vf._skipAutoMap = true;
          sim.addCustom(vf);
        }},
        { t: 0.66, run() {
          spawnMachShockRings3D(sim, { p0: new THREE.Vector3(0, 4.8, 2.8), p1: new THREE.Vector3(0, 0.25, 3.4), ringCount: 4, radius0: 0.28, radius1: 1.05, duration: 0.34, palette: P.pal });
        }},
        { t: 0.86, run() {
          fighter.hitStop = 0.095;
          sim.spawnGroundZone({ x: 0, z: 3.4, radius: 2.65, duration: 1.25, kind: 'crater', palette: P.pal, eruptRocks: true });
          sim.addCustom(new BeamCylinder3D({ p0: new THREE.Vector3(0, 5.8, 3.4), p1: new THREE.Vector3(0, 0.02, 3.4), radius: 0.58, duration: 0.55, palette: P.pal, texStyle, defaultTex: 'volt', hdr: 2.55 }));
          sim.addCustom(new ShockSphere3D({ x: 0, y: 0.6, z: 3.4, r0: 0.25, r1: 2.75, duration: 0.42, palette: P.pal, hdr: 2.6, useRunes: false }));
          sim.addCustom(new GroundWave3D({ x: 0, z: 3.4, maxRadius: 2.8, thickness: 0.62, height: 0.95, duration: 0.48, palette: P.pal, hdr: 2.4, seed: seed + 19 }));
          spawnGroundCracks(sim, R, { cx: 0, cz: 3.4, maxRadius: 2.6, branches: 9, life: 0.85, palette: P.pal, rockCount: 9, rockScale: 0.8 });
          dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 2.0, flashColor: P.hotHex }));
        }},
      ];
    },
  },
  {
    id: 'leap_valkyrie_judgement',
    cat: 'leap_spell',
    cls: '熾天女武神 Valkyrie',
    title: '飛天聖裁：聖翼昇天・神聖巨劍落地斬',
    codeId: 'leap.valkyrie.judgement',
    duration: 2.55,
    releaseTime: 0.14,
    releaseIsTakeoff: true,
    peakTime: 0.90,
    contactTimes: [0.86],
    hitbox: { kind: 'circle', cx: 0, cz: 3.4, radius: 2.9 },
    specNotes: ['震碎足下礫石飛升天際，攜帶 2.8m 半透明神聖大劍穿破音障墜地，犁出十字黃金劍溝審判敵群'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('sword_shield', hotHex);
      dummies[0].reset(0, 3.4, true);
      dummies[1].reset(-1.4, 3.7, true);
      dummies[2].reset(1.4, 3.7, true);
    },
    keyframes: makeSkyLeapKeyframes(0.28, 0.62, 0.86, 3.1, 2.45),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('holyGold', paletteOverride);
      return [
        { t: 0.14, run() {
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.35, duration: 0.45, palette: P.pal, _mapped: true });
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.78, width: 0.22, palette: P.pal, hdr: 2.5 });
          sim.spawnStarGlint(0, 1.15, 0, 0.62, P.hotHex, 0.18, true);
        }},
        { t: 0.66, run() {
          spawnMachShockRings3D(sim, { p0: new THREE.Vector3(0, 4.6, 2.8), p1: new THREE.Vector3(0, 0.25, 3.4), ringCount: 4, radius0: 0.28, radius1: 0.98, duration: 0.34, palette: P.pal });
        }},
        { t: 0.86, run() {
          fighter.hitStop = 0.095;
          sim.spawnGroundZone({ x: 0, z: 3.4, radius: 2.65, duration: 1.25, kind: 'crater', palette: P.pal, eruptRocks: true });
          spawnBladeGroundScar3D(sim, R, { x: 0, z: 3.4, yaw: 0.65, length: 3.2, width: 0.42, life: 0.95, palette: P.pal });
          spawnBladeGroundScar3D(sim, R, { x: 0, z: 3.4, yaw: -0.65, length: 3.2, width: 0.42, life: 0.95, palette: P.pal });
          const sw = buildSpiritSwordAssembly({ length: 2.8, palette: P.pal });
          sw.group.position.set(0, 0.25, 3.4);
          sw.group.rotation.x = Math.PI;
          let el = 0;
          sim.addCustom({
            group: sw.group,
            update(dt) { el += dt; sw.update(dt); sw.setOpacity(1 - smooth(0.55, 0.95, el)); },
            get done() { return el >= 0.98; },
            dispose() { sw.dispose(); },
          });
          sim.addCustom(new GroundWave3D({ x: 0, z: 3.4, maxRadius: 2.8, thickness: 0.6, height: 0.95, duration: 0.46, palette: P.pal, hdr: 2.45, seed: seed + 29 }));
          sim.spawnFlipbook({ atlas: 'fbStarburst', x: 0, y: 1.2, z: 3.4, life: 0.52, size0: 1.4, size1: 3.1, palette: P.pal, hdr: 2.6 });
          spawnGroundCracks(sim, R, { cx: 0, cz: 3.4, maxRadius: 2.55, branches: 8, life: 0.85, palette: P.pal, rockCount: 8, rockScale: 0.78 });
          dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 1.95, flashColor: P.hotHex }));
        }},
      ];
    },
  },
  {
    id: 'leap_berserker_meteor_slam',
    cat: 'leap_spell',
    cls: '狂戰霸主 Warlord',
    title: '跳劈落地：煉獄流星狂戰跳斬',
    codeId: 'leap.berserker.meteor_slam',
    duration: 2.55,
    releaseTime: 0.14,
    releaseIsTakeoff: true,
    peakTime: 0.90,
    contactTimes: [0.86],
    hitbox: { kind: 'circle', cx: 0, cz: 3.4, radius: 2.9 },
    specNotes: ['巨劍拖曳赤紅流火高躍翻劈落地，犁開焦炎劍溝並炸出蘑菇火雲與 12 顆彈跳熔岩火石！'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      dummies[0].reset(0, 3.4, true);
      dummies[1].reset(-1.4, 3.7, true);
      dummies[2].reset(1.4, 3.7, true);
    },
    keyframes: makeSkyLeapKeyframes(0.26, 0.60, 0.86, 3.1, 2.45),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('fireInferno', paletteOverride);
      return [
        { t: 0.14, run() {
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.35, duration: 0.45, palette: P.pal, _mapped: true });
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.78, width: 0.25, palette: P.pal, hdr: 2.55 });
        }},
        { t: 0.86, run() {
          fighter.hitStop = 0.095;
          spawnBladeGroundScar3D(sim, R, { x: 0, z: 3.4, length: 3.4, width: 0.48, life: 0.95, zoneKind: 'burning', palette: P.pal });
          sim.spawnFlipbook({ atlas: 'fbExplosion', x: 0, y: 1.25, z: 3.4, life: 0.58, size0: 1.5, size1: 3.4, palette: P.pal, hdr: 2.65 });
          sim.addCustom(new GroundWave3D({ x: 0, z: 3.4, maxRadius: 2.8, thickness: 0.65, height: 0.95, duration: 0.48, palette: P.pal, hdr: 2.45, seed: seed + 39 }));
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU, sp = R.range(2.8, 5.8);
            sim.spawnFireRock({ x: 0, y: 0.35, z: 3.4, vx: Math.cos(a) * sp, vy: R.range(3.5, 6.8), vz: Math.sin(a) * sp, size: 0.18, life: 0.95, palette: P.pal, emitSparks: true });
          }
          spawnGroundCracks(sim, R, { cx: 0, cz: 3.4, maxRadius: 2.6, branches: 9, life: 0.88, palette: P.pal, rockCount: 9, rockScale: 0.82 });
          dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 2.0, flashColor: P.hotHex }));
        }},
      ];
    },
  },
  {
    id: 'leap_titan_earthshatter',
    cat: 'leap_spell',
    cls: '大地巨神 Earthshaker',
    title: '震地重踏：泰坦碎界三連震波',
    codeId: 'leap.titan.earthshatter',
    duration: 2.65,
    releaseTime: 0.14,
    releaseIsTakeoff: true,
    peakTime: 0.88,
    contactTimes: [0.68, 0.88, 1.08],
    hitbox: { kind: 'circle', cx: 0, cz: 2.8, radius: 3.1 },
    specNotes: ['躍起重踏炸出碎裂彈坑地表、交叉地殼斷層、彈跳玄武岩碎塊、空氣震波扭曲與三圈琥珀岩晶環'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('earthMagma', paletteOverride);
      fighter.setLoadout('unarmed', hotHex);
      dummies[0].reset(0, 2.8, true);
      dummies[1].reset(-1.6, 3.1, true);
      dummies[2].reset(1.6, 3.1, true);
    },
    keyframes: makeSkyLeapKeyframes(0.24, 0.48, 0.68, 2.2, 2.50),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('earthMagma', paletteOverride);
      return [
        { t: 0.14, run() {
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.35, duration: 0.42, palette: P.pal, _mapped: true });
        }},
        { t: 0.68, run() {
          fighter.hitStop = 0.085;
          sim.spawnGroundZone({ x: 0, z: 2.8, radius: 2.95, duration: 1.65, kind: 'crater', palette: P.pal, emitFlames: false, eruptRocks: true });
          spawnBladeGroundScar3D(sim, { x: 0, z: 2.8, yaw: 0.55, length: 3.5, width: 0.46, life: 1.05, palette: P.pal });
          spawnBladeGroundScar3D(sim, { x: 0, z: 2.8, yaw: -0.55, length: 3.5, width: 0.46, life: 1.05, palette: P.pal });
          sim.spawnFlipbook({ atlas: 'fbRockBurst', x: 0, y: 0.95, z: 2.8, life: 0.58, size0: 1.35, size1: 2.95, palette: P.pal, hdr: 2.35 });
          sim.spawnAirDistortion({ kind: 'shock', x: 0, y: 0.75, z: 2.8, r0: 0.25, r1: 3.0, duration: 0.48, strength: 0.92 });
          for (let w = 0; w < 3; w++) {
            const rad = 1.35 + w * 0.65;
            sim.addCustom(new GroundWave3D({ x: 0, z: 2.8, maxRadius: rad + 0.35, thickness: 0.52, height: 0.82, duration: 0.45, palette: P.pal, hdr: 2.3, seed: seed + 50 + w }));
            for (let i = 0; i < 6 + w * 2; i++) {
              const a = (i / (6 + w * 2)) * TAU + w * 0.3;
              sim.spawnCrystal({ x: Math.cos(a) * rad, z: 2.8 + Math.sin(a) * rad, height: 0.95 + w * 0.25, width: 0.28, delay: w * 0.14, hold: 0.58, melt: 0.35, palette: P.pal });
            }
          }
          dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 1.9, flashColor: P.hotHex }));
        }},
      ];
    },
  },

  // ---- 7 CLASSIC RPG GRAND SPELLS (火球 / 冰錐 / 暴風雪 / 流星雨 / 萬雷 / 世界樹 / 時停) ----
  {
    id: 'spl_grand_fireball_salvo',
    cat: 'leap_spell',
    cls: '紅蓮大法師 Pyromancer',
    title: '經典火球術：三連豪火球・炎帝焦土大爆破',
    codeId: 'spl.fire.grand_fireball',
    duration: 2.75,
    releaseTime: 0.32,
    peakTime: 0.96,
    contactTimes: [0.58, 0.74, 0.92],
    hitbox: { kind: 'circle', cx: 0, cz: 4.2, radius: 2.8 },
    specNotes: ['連發兩顆旋轉火球開路，第3發炎帝熔核巨球引爆蘑菇雲、留下持續燃燒焦土地表 (envScorchLava)、噴出碎石與熱浪空氣扭曲！'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 4.2, true);
      dummies[1].reset(-1.35, 4.5, true);
      dummies[2].reset(1.35, 4.5, true);
    },
    keyframes: makeStaffCastKeyframes(0.20, 0.32, 2.60),
    buildEvents(sim, fighter, dummies, _seed, paletteOverride) {
      const P = resolvePal('fireInferno', paletteOverride);
      const mkBall = (t0, xOff, sc, big) => ({
        t: t0,
        run() {
          const muz = fighter.getStaffTipWorld();
          muz.x += xOff * 0.22;
          muz.z += 0.12;
          spawnArcaneOrb(sim, {
            p0: muz, p1: new THREE.Vector3(xOff, 1.1, 4.2),
            arcHeight: 0.35, flightTime: 0.26, radius: sc, palette: P.pal,
            onImpact: (pt) => {
              if (big) fighter.hitStop = 0.085;
              sim.spawnFlipbook({ atlas: 'fbExplosion', x: pt.x, y: pt.y, z: pt.z, life: big ? 0.58 : 0.38, size0: big ? 1.5 : 0.9, size1: big ? 3.4 : 1.9, palette: P.pal, hdr: 2.6 });
              if (big) {
                sim.spawnGroundZone({ x: 0, z: 4.2, radius: 2.55, duration: 1.48, kind: 'burning', palette: P.pal, emitFlames: true, eruptRocks: true });
                sim.addCustom(new Sigil3D({ x: 0, y: 0.024, z: 4.2, radius: 2.6, duration: 1.45, style: 'dragonFlame', palette: P.pal, hdr: 2.1, wallHeight: 0.45 }));
                sim.addCustom(new ShockSphere3D({ x: 0, y: 1.0, z: 4.2, r0: 0.2, r1: 2.65, duration: 0.42, palette: P.pal, hdr: 2.55, useRunes: true }));
              }
              dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.4, dirZ: 1, power: big ? 1.9 : 1.1, flashColor: P.hotHex }));
            },
          });
        },
      });
      return [mkBall(0.32, -0.8, 0.22, false), mkBall(0.48, 0.8, 0.22, false), mkBall(0.66, 0, 0.46, true)];
    },
  },
  {
    id: 'spl_icicle_lance_storm',
    cat: 'leap_spell',
    cls: '極寒魔導師 Cryomancer',
    title: '經典冰錐術：極寒萬鈞冰錐齊射',
    codeId: 'spl.ice.icicle_storm',
    duration: 2.65,
    releaseTime: 0.36,
    peakTime: 0.86,
    contactTimes: [0.60, 0.82, 0.98],
    hitbox: { kind: 'circle', cx: 0, cz: 4.2, radius: 2.8 },
    specNotes: ['身後展開寫實北歐霜銀冰晶大法陣 (sigilGlacier)，連續凝結 12 支半透明六稜巨冰錐貫穿敵陣並鋪展冰封雪地'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageFrost', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 4.2, true);
      dummies[1].reset(-1.35, 4.5, true);
      dummies[2].reset(1.35, 4.5, true);
    },
    keyframes: makeStaffCastKeyframes(0.22, 0.36, 2.52),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('mageFrost', paletteOverride);
      const evs = [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.58, P.hotHex, 0.24, true);
        }},
      ];
      for (let i = 0; i < 12; i++) {
        evs.push({
          t: 0.36 + i * 0.055,
          run() {
            if (i === 0) {
              const casterSigil = new Sigil3D({ x: 0, y: 1.85, z: 0.6, radius: 1.55, duration: 1.35, style: 'glacier', palette: P.pal, hdr: 2.1, wallHeight: 0.25 });
              casterSigil._skipAutoMap = true;
              sim.addCustom(casterSigil);
              sim.spawnGroundZone({ x: 0, z: 4.2, radius: 2.62, duration: 1.95, kind: 'frost', palette: P.pal, emitFlames: true, eruptRocks: false });
            }
            const p0 = new THREE.Vector3(R.range(-1.2, 1.2), R.range(1.6, 2.8), 0.7);
            const ang = R.range(0, TAU), rr = Math.sqrt(R.next()) * 2.15;
            const p1 = new THREE.Vector3(Math.cos(ang) * rr, 0.25, 4.2 + Math.sin(ang) * rr);
            const wp0 = sim.mapSkillVec3 ? sim.mapSkillVec3(p0) : p0.clone();
            const wp1 = sim.mapSkillVec3 ? sim.mapSkillVec3(p1) : p1.clone();
            const geo = new THREE.ConeGeometry(0.14, 1.05, 6);
            geo.rotateX(Math.PI / 2);
            const mat = makeTranslucentConstructMaterial({ palette: P.pal, sigilStyle: null, useHexLattice: false, baseAlpha: 0.34, rimAlpha: 0.95, hdr: 2.3 });
            const m = new THREE.Mesh(geo, mat);
            let el = 0, fl = 0.24;
            sim.addCustom({
              mesh: m,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                m.position.lerpVectors(wp0, wp1, clamp(el / fl));
                m.lookAt(wp1);
                if (el >= fl && el - dt < fl) {
                  sim.spawnCrystal({ x: p1.x, z: p1.z, height: 1.05, width: 0.28, hold: 0.45, melt: 0.30, palette: P.pal });
                  sim.spawnFlipbook({ atlas: i % 2 === 0 ? 'fbIceShatter' : 'fbHitBurst', x: p1.x, y: 0.6, z: p1.z, life: 0.28, size0: 0.65, size1: 1.4, palette: P.pal, hdr: 2.2 });
                }
              },
              get done() { return el >= fl; },
              dispose() { geo.dispose(); mat.dispose(); },
            });
            if (i % 4 === 3) dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.3, dirZ: 1, power: 1.25, flashColor: P.hotHex }));
          },
        });
      }
      return evs;
    },
  },
  {
    id: 'spl_eternal_blizzard',
    cat: 'leap_spell',
    cls: '凜冬女王 Frost Queen',
    title: '終極冰系大法術：永凍天幕持續大暴風雪 (4.75s)',
    codeId: 'spl.ice.eternal_blizzard',
    duration: 4.75,
    releaseTime: 0.36,
    peakTime: 2.05,
    handlesDynamicScale: true,
    contactTimes: [0.85, 2.05, 3.55],
    hitbox: { kind: 'circle', cx: 0, cz: 4.0, radius: 3.2 },
    specNotes: [
      '同一目標區域持續 4.75 秒翻湧極寒烏雲雪幕、斜吹暴雪風簾、連續墜落 28+ 支半透明六稜冰錐與碎冰彈跳！',
      '地面覆蓋寫實積雪冰裂貼圖 (envFrostGround) 與霜銀浮雕大法陣 (sigilGlacier)，外圍冰晶筍分批破土結凍',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageFrost', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      const hb = getScaledHitbox(this.hitbox);
      const sp = Math.min(hb.radius * 0.46, 1.8);
      dummies[0].reset(hb.cx, hb.cz, true);
      dummies[1].reset(hb.cx - sp, hb.cz + sp * 0.18, true);
      dummies[2].reset(hb.cx + sp, hb.cz + sp * 0.18, true);
    },
    keyframes: makeSkyChantKeyframes(0.22, 0.36, 4.62),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('mageFrost', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.62, P.hotHex, 0.24, true);
        }},
        { t: 0.36, run() {
          spawnSustainedBlizzardZone(sim, {
            cx: hb.cx, cz: hb.cz, radius: hb.radius,
            duration: 4.12, palette: P.pal, dummies, seed: seed + 77,
          });
        }},
      ];
    },
  },
  {
    id: 'spl_armageddon_meteor_rain',
    cat: 'leap_spell',
    cls: '星界大賢者 Grand Astrologer',
    title: '終極火系禁咒：星界毀滅持續大流星雨 (4.90s)',
    codeId: 'spl.fire.meteor_shower',
    duration: 4.90,
    releaseTime: 0.36,
    peakTime: 2.15,
    handlesDynamicScale: true,
    contactTimes: [0.85, 2.15, 3.90],
    hitbox: { kind: 'circle', cx: 0, cz: 4.2, radius: 3.3 },
    specNotes: [
      '同一目標區域持續近 5 秒連續斜墜 24+ 顆 3D 黑曜熔岩隕石，高空翻湧火山煙雲與盤龍炎紋大法陣！',
      '每次撞擊皆留下重疊燃燒熔岩坑 (envScorchLava)、噴出彈跳玄武岩碎石，並產生熱對流與震波空氣扭曲',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      const hb = getScaledHitbox(this.hitbox);
      const sp = Math.min(hb.radius * 0.46, 1.85);
      dummies[0].reset(hb.cx, hb.cz, true);
      dummies[1].reset(hb.cx - sp, hb.cz + sp * 0.18, true);
      dummies[2].reset(hb.cx + sp, hb.cz + sp * 0.18, true);
    },
    keyframes: makeSkyChantKeyframes(0.22, 0.36, 4.78),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('fireInferno', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.65, P.hotHex, 0.24, true);
        }},
        { t: 0.36, run() {
          spawnSustainedMeteorZone(sim, {
            cx: hb.cx, cz: hb.cz, radius: hb.radius,
            duration: 4.28, palette: P.pal, dummies, fighter, seed: seed + 88,
          });
        }},
      ];
    },
  },
  {
    id: 'spl_heaven_thunder_prison',
    cat: 'leap_spell',
    cls: '雷帝大導師 Thunder Emperor',
    title: '終極雷系禁咒：九天雷獄萬雷天牢',
    codeId: 'spl.volt.thunder_prison',
    duration: 2.75,
    releaseTime: 0.46,
    peakTime: 0.96,
    contactTimes: [0.46, 0.86, 1.14],
    hitbox: { kind: 'circle', cx: 0, cz: 4.0, radius: 3.0 },
    specNotes: ['地面展開寫實青銅雷神之鎚浮雕陣 (sigilThunder) 與雷擊焦痕 (envLightningScorch)，6 道擎天雷柱圍成電磁天牢'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 4.0, true);
      dummies[1].reset(-1.4, 4.3, true);
      dummies[2].reset(1.4, 4.3, true);
    },
    keyframes: makeSkyChantKeyframes(0.28, 0.46, 2.62),
    buildEvents(sim, fighter, dummies, _seed, paletteOverride, texStyle = 'auto') {
      const P = resolvePal('mageVolt', paletteOverride);
      return [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.65, P.hotHex, 0.30, true);
        }},
        { t: 0.46, run() {
          fighter.hitStop = 0.08;
          sim.addCustom(new Sigil3D({ x: 0, y: 0.024, z: 4.0, radius: 2.85, duration: 1.85, style: 'thunder', palette: P.pal, hdr: 2.15, wallHeight: 0.68 }));
          sim.spawnGroundZone({ x: 0, z: 4.0, radius: 2.78, duration: 1.85, kind: 'lightning', palette: P.pal, emitFlames: true, eruptRocks: true });
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            const px = Math.cos(a) * 2.35, pz = 4.0 + Math.sin(a) * 2.35;
            sim.addCustom(new BeamCylinder3D({ p0: new THREE.Vector3(px, 5.6, pz), p1: new THREE.Vector3(px, 0.02, pz), radius: 0.24, duration: 1.25, palette: P.pal, texStyle, defaultTex: 'volt', hdr: 2.45 }));
            sim.spawnBolt(new THREE.Vector3(px, 1.4, pz), new THREE.Vector3(0, 1.2, 4.0), { radius: 0.042, jitter: 0.28, life: 1.15, color: P.hotHex });
          }
          sim.addCustom(new DomeShield3D({ x: 0, y: 0.02, z: 4.0, radius: 2.45, duration: 1.25, palette: P.pal, hdr: 2.1 }));
          sim.spawnAirDistortion({ kind: 'shock', x: 0, y: 1.0, z: 4.0, r0: 0.25, r1: 2.8, duration: 0.45, strength: 0.85 });
          dummies.forEach((d) => d.hit({ dirX: 0, dirZ: 1, power: 1.85, flashColor: P.hotHex }));
        }},
      ];
    },
  },
  {
    id: 'spl_world_tree_sanctuary',
    cat: 'leap_spell',
    cls: '森羅大賢者 Archdruid',
    title: '自然大法術：世界樹森羅萬象結界',
    codeId: 'spl.nature.world_tree',
    duration: 2.65,
    releaseTime: 0.48,
    peakTime: 0.92,
    contactTimes: [0.48],
    hitbox: { kind: 'circle', cx: 0, cz: 0, radius: 3.2 },
    specNotes: ['展開寫實古樹琥珀苔石浮雕陣 (sigilDruid) 與半透明翡翠守護穹頂，翡翠聖羽與生命螢火漫天飛舞'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageEmerald', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.8, false);
      dummies[1].reset(0, 0, false);
      dummies[2].reset(0, 0, false);
    },
    keyframes: makeSkyChantKeyframes(0.30, 0.48, 2.55),
    buildEvents(sim, fighter, _d, _seed, paletteOverride, texStyle = 'auto') {
      const P = resolvePal('mageEmerald', paletteOverride);
      return [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.62, P.hotHex, 0.30, true);
        }},
        { t: 0.48, run() {
          sim.addCustom(new Sigil3D({ x: 0, y: 0.02, z: 0, radius: 3.05, duration: 1.85, style: 'druid', palette: P.pal, hdr: 2.1, wallHeight: 0.72 }));
          sim.addCustom(new DomeShield3D({ x: 0, y: 0.02, z: 0, radius: 2.85, duration: 1.70, palette: P.pal, hdr: 2.05 }));
          sim.addCustom(new BeamCylinder3D({ p0: new THREE.Vector3(0, 5.5, 0), p1: new THREE.Vector3(0, 0.02, 0), radius: 0.72, duration: 1.35, palette: P.pal, texStyle, defaultTex: 'silk', hdr: 2.25 }));
          sim.spawnFlipbook({ atlas: 'fbFeatherBurst', x: 0, y: 1.35, z: 0, life: 1.15, size0: 1.5, size1: 3.1, palette: P.pal, hdr: 2.35 });
          sim.spawnNiagaraBurst({ x: 0, y: 0.4, z: 0, count: 80, speed0: 1.0, speed1: 3.8, spreadRadius: 2.2, gravity: -2.2, curl: 4.2, vortex: 5.5, vortexCenter: [0, 0], life0: 0.8, life1: 1.5, size0: 0.045, size1: 0.015, palette: P.pal, hdr: 2.3 });
        }},
      ];
    },
  },
  {
    id: 'spl_chrono_timestop',
    cat: 'leap_spell',
    cls: '時空魔導士 Chronomancer',
    title: '時空大禁咒：星鐘絕對時停結界',
    codeId: 'spl.arcane.timestop',
    duration: 2.75,
    releaseTime: 0.36,
    peakTime: 0.96,
    contactTimes: [0.36, 1.52],
    hitbox: { kind: 'circle', cx: 0, cz: 3.8, radius: 3.0 },
    specNotes: ['寫實黃銅齒輪時鐘法陣 (sigilChrono) 搭配中央 3D 三軸星盤陀螺儀，最後重力透鏡空氣扭曲內爆！'],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageViolet', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.8, true);
      dummies[1].reset(-1.4, 4.1, true);
      dummies[2].reset(1.4, 4.1, true);
    },
    keyframes: [
      ...makeSkyChantKeyframes(0.22, 0.36, 1.15).slice(0, 3),
      { t: 1.34, ease: ease.inOutCubic, pose: { ...REST_POSE, crouch: 0.08, torsoPitch: -0.18, shRPitch: -2.10, shLPitch: -1.85, elRPitch: -0.42, capePitch: 0.65 } },
      { t: 1.52, ease: ease.outExpo, pose: { ...REST_POSE, crouch: 0.24, torsoPitch: 0.26, shRPitch: -0.82, shLPitch: -0.75, elRPitch: -0.15, capePitch: 0.78 } },
      { t: 2.62, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, _seed, paletteOverride) {
      const P = resolvePal('mageViolet', paletteOverride);
      return [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.65, P.hotHex, 0.24, true);
        }},
        { t: 0.36, run() {
          sim.addCustom(new Sigil3D({ x: 0, y: 0.02, z: 3.8, radius: 2.85, duration: 1.88, style: 'chrono', palette: P.pal, hdr: 2.15, wallHeight: 0.65 }));
          sim.addCustom(new DomeShield3D({ x: 0, y: 0.02, z: 3.8, radius: 2.65, duration: 1.30, palette: P.pal, hdr: 2.1 }));
          const astro = buildArmillaryAstrolabeAssembly({ palette: P.pal, scale: 1.35 });
          let el = 0;
          const mappedPos = sim.mapSkillVec3 ? sim.mapSkillVec3(new THREE.Vector3(0, 1.85, 3.8)) : new THREE.Vector3(0, 1.85, 3.8);
          sim.addCustom({
            group: astro.group,
            _skipAutoMap: true,
            update(dt) {
              el += dt; astro.update(dt);
              astro.group.position.copy(mappedPos);
              astro.setOpacity(1 - smooth(1.40, 1.88, el));
            },
            get done() { return el >= 1.90; },
            dispose() { astro.dispose(); },
          });
        }},
        { t: 1.52, run() {
          fighter.hitStop = 0.09;
          sim.spawnAirDistortion({ kind: 'implode', x: 0, y: 1.15, z: 3.8, r0: 0.25, r1: 2.9, duration: 0.48, strength: 0.95 });
          sim.addCustom(new ShockSphere3D({ x: 0, y: 1.15, z: 3.8, r0: 0.25, r1: 2.85, duration: 0.42, palette: P.pal, hdr: 2.65, implode: true, useRunes: true }));
          sim.spawnFlipbook({ atlas: 'fbStarburst', x: 0, y: 1.25, z: 3.8, life: 0.52, size0: 1.5, size1: 3.2, palette: P.pal, hdr: 2.65 });
          dummies.forEach((d) => d.hit({ dirX: -d.homeX * 0.4, dirZ: -1, power: 1.9, flashColor: P.hotHex }));
        }},
      ];
    },
  },
];
