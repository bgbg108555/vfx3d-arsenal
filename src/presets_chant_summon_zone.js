import * as THREE from 'three';
import {
  TAU, clamp, lerp, smooth, ease, Rng, PAL3D,
  SlashArc3D, GroundWave3D, VortexFunnel3D, BeamCylinder3D, DomeShield3D, ShockSphere3D,
  getScaledHitbox,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import {
  resolvePal, makeSkyChantKeyframes, makeStaffCastKeyframes, spawnGroundCracks,
  attachWeaponBladeTrail3D, spawnMartialStanceGust3D,
} from './fx_helpers.js';
import {
  installChargeVariantHook,
  spawnSustainedMeteorZone,
} from './env_fx3d.js';
import { MagicArray3D, CastBar3D } from './magic_arrays3d.js';
import {
  buildSpiritSwordAssembly,
  buildTotemObeliskAssembly,
  buildReaperScytheAssembly,
  buildArmillaryAstrolabeAssembly,
  buildSeraphWingsAssembly,
  buildDragonSpiritHeadAssembly,
  buildHolyChaliceAssembly,
  buildQimenCompassAssembly,
  buildImmortalAzureGreatswordAssembly,
  buildSolomonSummonGateAssembly,
  buildGlacierPrismGolemAssembly,
} from './mesh_props3d.js';
import {
  spawnBoidsSwordSwarm,
  spawnVerletSoulChains,
  spawnCubicBezierVolley,
  spawnVoronoiBarrierShatter,
  spawnBFSChainLightning,
  spawnCurlNoisePhoenixField,
} from './gamedev_algos3d.js';

function resetScaledCircleDummies(dummies, rawHb, activeTri = true) {
  const hb = getScaledHitbox(rawHb);
  const cx = hb.cx ?? 0;
  const cz = hb.cz ?? 4.0;
  const spread = Math.min(hb.radius * 0.46, 1.95);
  dummies[0].reset(cx, cz, true);
  dummies[1].reset(cx - spread, cz + spread * 0.18, activeTri);
  dummies[2].reset(cx + spread, cz + spread * 0.18, activeTri);
}

function resetScaledRectDummies(dummies, rawHb) {
  const hb = getScaledHitbox(rawHb);
  const w = hb.width * 0.28;
  dummies[0].reset(0, hb.length * 0.78, true);
  dummies[1].reset(-w, hb.length * 0.56, true);
  dummies[2].reset(w, hb.length * 0.64, true);
}

function makeTwoBeatCastKeyframes(windT, relT, cmdT, endT, sky = false) {
  const holdT = Math.min(relT + 0.32, cmdT - 0.22);
  const preCmdT = Math.max(relT + 0.12, cmdT - 0.15);
  if (sky) {
    return [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: windT, ease: ease.inOutCubic, pose: {
        crouch: 0.06, torsoPitch: -0.18, headPitch: -0.28,
        shRPitch: -2.35, shRYaw: -0.35, elRPitch: -0.18,
        shLPitch: -2.35, shLYaw: 0.35, elLPitch: -0.18, capePitch: 0.45,
      }},
      { t: relT, ease: ease.outExpo, pose: {
        crouch: 0.14, torsoPitch: 0.18,
        shRPitch: -1.25, shRYaw: 0.18, elRPitch: -0.20,
        shLPitch: -1.25, shLYaw: -0.18, elLPitch: -0.20, capePitch: 0.58,
      }},
      { t: holdT, ease: ease.inOutSine, pose: {
        crouch: 0.08, torsoPitch: -0.06,
        shRPitch: -1.65, shRYaw: -0.15, elRPitch: -0.25,
        shLPitch: -1.55, shLYaw: 0.15, elLPitch: -0.25, capePitch: 0.35,
      }},
      { t: preCmdT, ease: ease.inCubic, pose: {
        crouch: 0.08, torsoPitch: -0.20, headPitch: -0.26,
        shRPitch: -2.42, shRYaw: -0.32, elRPitch: -0.16,
        shLPitch: -2.42, shLYaw: 0.32, elLPitch: -0.16, capePitch: 0.48,
      }},
      { t: cmdT, ease: ease.outExpo, pose: {
        crouch: 0.18, torsoPitch: 0.26,
        shRPitch: -1.05, shRYaw: 0.22, elRPitch: -0.16,
        shLPitch: -1.05, shLYaw: -0.22, elLPitch: -0.16, capePitch: 0.72,
      }},
      { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ];
  }
  return [
    { t: 0.00, pose: { ...REST_POSE, shRPitch: -0.95, elRPitch: -0.45, wrRPitch: 0.25 } },
    { t: windT, ease: ease.inOutCubic, pose: {
      crouch: 0.08, torsoPitch: -0.10, torsoYaw: -0.24,
      shRPitch: -1.48, shRYaw: -0.24, elRPitch: -0.24, wrRPitch: 0.12,
      shLPitch: -1.15, shLYaw: 0.35, elLPitch: -0.55,
    }},
    { t: relT, ease: ease.outExpo, pose: {
      crouch: 0.12, torsoPitch: 0.18, torsoYaw: 0.18,
      shRPitch: -0.84, shRYaw: 0.14, elRPitch: -0.16, wrRPitch: 0.56,
      shLPitch: -0.95, shLYaw: -0.25, elLPitch: -0.35, capePitch: 0.52,
    }},
    { t: holdT, ease: ease.inOutSine, pose: {
      crouch: 0.08, torsoPitch: 0.04, torsoYaw: -0.08,
      shRPitch: -1.18, shRYaw: -0.10, elRPitch: -0.30, wrRPitch: 0.28,
      shLPitch: -1.05, shLYaw: 0.20, elLPitch: -0.45, capePitch: 0.30,
    }},
    { t: preCmdT, ease: ease.inCubic, pose: {
      crouch: 0.10, torsoPitch: -0.14, torsoYaw: -0.30,
      shRPitch: -1.72, shRYaw: -0.32, elRPitch: -0.20, wrRPitch: 0.08,
      shLPitch: -1.28, shLYaw: 0.38, elLPitch: -0.48, capePitch: 0.42,
    }},
    { t: cmdT, ease: ease.outExpo, pose: {
      crouch: 0.16, torsoPitch: 0.24, torsoYaw: 0.26,
      shRPitch: -0.78, shRYaw: 0.20, elRPitch: -0.12, wrRPitch: 0.64,
      shLPitch: -0.88, shLYaw: -0.30, elLPitch: -0.30, capePitch: 0.68,
    }},
    { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE, shRPitch: -0.95, elRPitch: -0.45, wrRPitch: 0.25 } },
  ];
}

// ============================================================================
// I. 四重疊陣奧義大法術 (8 Flagship Ultimate Spells — Reassigned into Core Magic Categories!)
//    On-caster progressive chanting & CastBar are driven globally by chant_system3d.js;
//    ALL target devastation fires strictly AFTER chanting reaches 100%!
// ============================================================================
export const CHANT_ULT_MOVES = [
  // 1. 西方四重聖詠疊陣：熾天薔薇極光聖裁砲 (Holy)
  {
    id: 'chant_seraph_judgment_ray',
    cat: 'holy',
    chantArchetype: 'western_cathedral',
    baseChantDur: 2.05,
    chantStages: 4,
    cls: '神聖四重詠唱奧義',
    title: '四重聖詠疊陣：熾天薔薇極光聖裁砲',
    codeId: 'chant.west.seraph_judgment',
    duration: 2.85,
    peakTime: 0.32,
    handlesDynamicScale: true,
    contactTimes: [0.12, 0.65, 1.35],
    hitbox: { kind: 'circle', cx: 0, cz: 7.6, radius: 3.3 },
    specNotes: [
      '施法者自身腳下逐層升起 1→4 重聖堂法陣並推進詠唱法條，詠唱未滿前絕不放出攻擊！',
      '詠唱滿格瞬間施法者展開十二羽熾天聖翼，於 7.6m 遠端敵陣貫下粗壯聖裁極光柱並留下非圓形祝聖裂痕',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.24,
    keyframes: makeSkyChantKeyframes(0.14, 0.24, 2.72),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const P = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            fighter.hitStop = 0.11;
            const wings = buildSeraphWingsAssembly({ palette: P.pal, scale: 1.48 });
            let wEl = 0;
            sim.addCustom({
              group: wings.group,
              _skipAutoMap: true,
              update(dt) {
                wEl += dt;
                wings.update(dt);
                wings.group.position.set(0, 1.52, -0.24);
                wings.setOpacity(Math.min(1, wEl * 7) * (1 - smooth(1.45, 2.05, wEl)));
              },
              get done() { return wEl >= 2.08; },
              dispose() { wings.dispose(); },
            });

            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 4.85, z: hb.cz, _skipAutoMap: true,
              radius: hb.radius * 0.94,
              duration: 1.95,
              tradition: 'western',
              arrayKind: 'layered',
              layers: 4,
              style: 'holy',
              palette: P.pal,
              hdr: 2.2,
            }));

            sim.addCustom(new BeamCylinder3D({
              p0: new THREE.Vector3(hb.cx, 6.2, hb.cz),
              p1: new THREE.Vector3(hb.cx, 0.02, hb.cz),
              radius: hb.radius * 0.42,
              duration: 1.55,
              palette: P.pal,
              texStyle,
              defaultTex: 'silk',
              hdr: 2.65,
            }));
            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.98, duration: 2.25,
              kind: 'holy', palette: P.pal,
              stretchX: 1.18, stretchZ: 0.86, yaw: 0.42,
              emitFlames: true, eruptRocks: true,
            });
            sim.spawnGroundZone({
              x: hb.cx + hb.radius * 0.14, z: hb.cz - hb.radius * 0.10, _mapped: true,
              radius: hb.radius * 0.72, duration: 2.18,
              kind: 'crater', palette: P.pal,
              stretchX: 0.82, stretchZ: 1.24, yaw: 1.85,
              emitFlames: false, eruptRocks: false,
            });
            sim.spawnFlipbook({
              atlas: 'fbFeatherBurst', x: hb.cx, y: 1.45, z: hb.cz, _mapped: true,
              life: 0.78, size0: 1.6, size1: 3.8, palette: P.pal, hdr: 2.6,
            });
            sim.spawnAirDistortion({
              kind: 'shock', x: hb.cx, y: 0.9, z: hb.cz, _mapped: true,
              r0: 0.3, r1: hb.radius * 1.18, duration: 0.58, strength: 0.98,
            });
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.96,
              thickness: 0.62, height: 0.98, duration: 0.56,
              palette: P.pal, hdr: 2.45, seed: seed + 11,
            }));
            dummies.forEach((d) => {
              if (d.root.visible) d.hit({ dirX: 0.2, dirZ: 1, power: 2.15, flashColor: P.hotHex });
            });
          },
        },
      ];
    },
  },

  // 2. 東方四重道法疊陣：外圓內方奇門九宮五雷天罰 (Volt)
  {
    id: 'chant_eastern_qimen_thunder',
    cat: 'volt',
    chantArchetype: 'eastern_qimen',
    baseChantDur: 2.10,
    chantStages: 4,
    cls: '雷電奇門詠唱奧義',
    title: '四重道法疊陣：外圓內方奇門九宮五雷天罰',
    codeId: 'chant.east.qimen_thunder',
    duration: 2.95,
    peakTime: 0.35,
    handlesDynamicScale: true,
    contactTimes: [0.24, 0.55, 1.05],
    hitbox: { kind: 'circle', cx: 0, cz: 7.8, radius: 3.4 },
    specNotes: [
      '施法者自身腳下運轉中式「外圓內方」奇門遁甲九宮大陣進行 4 階詠唱，詠唱完畢才向 7.8m 遠方敵群降下天罰！',
      '滿詠唱瞬間目標上空顯現 3D 奇門青玉羅盤樞並引動九宮方位連續五雷轟頂',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.24,
    keyframes: makeSkyChantKeyframes(0.14, 0.24, 2.80),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('mageVolt', paletteOverride);
      const goldP = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            fighter.hitStop = 0.11;
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.024, z: hb.cz, _skipAutoMap: true,
              radius: hb.radius * 0.96,
              duration: 2.25,
              tradition: 'eastern',
              arrayKind: 'qimen_square',
              layers: 4,
              style: 'qimenComplex',
              palette: goldP.pal,
              hdr: 2.15,
              exactStyle: true,
            }));
            const compass = buildQimenCompassAssembly({ palette: goldP.pal, scale: 1.42 });
            let cEl = 0;
            sim.addCustom({
              group: compass.group,
              _skipAutoMap: true,
              update(dt) {
                cEl += dt;
                compass.update(dt);
                compass.group.position.set(hb.cx, 3.25 + Math.sin(cEl * 3.5) * 0.12, hb.cz);
                compass.setOpacity(Math.min(1, cEl * 5.5) * (1 - smooth(1.75, 2.35, cEl)));
              },
              get done() { return cEl >= 2.40; },
              dispose() { compass.dispose(); },
            });

            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.98, duration: 2.30,
              kind: 'lightning', palette: P.pal,
              stretchX: 1.16, stretchZ: 0.88, yaw: 0.65,
              emitFlames: true, eruptRocks: true,
            });
            spawnGroundCracks(sim, {
              x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.95,
              branches: 9, palette: goldP.pal, duration: 2.15, seed: seed + 29,
            });
            let idx = 0;
            for (let gx = -1; gx <= 1; gx++) {
              for (let gz = -1; gz <= 1; gz++) {
                const px = hb.cx + gx * hb.radius * 0.44;
                const pz = hb.cz + gz * hb.radius * 0.44;
                const delay = idx * 0.055;
                idx++;
                sim.spawnLightning({
                  p0: new THREE.Vector3(px + (gx * 0.3), 6.4, pz),
                  p1: new THREE.Vector3(px, 0.05, pz),
                  _mapped: true,
                  life: 0.55,
                  jag: 0.28, depth: 4, forks: 3,
                  palette: idx % 2 === 0 ? goldP.pal : P.pal,
                  thickness: 0.068,
                });
                sim.spawnFlipbook({
                  atlas: 'fbLightning', x: px, y: 1.05, z: pz, _mapped: true,
                  delay, life: 0.46, size0: 0.95, size1: 2.15, palette: P.pal, hdr: 2.55,
                });
              }
            }
            sim.spawnAirDistortion({
              kind: 'shock', x: hb.cx, y: 0.85, z: hb.cz, _mapped: true,
              r0: 0.3, r1: hb.radius * 1.15, duration: 0.56, strength: 1.0,
            });
            dummies.forEach((d) => {
              if (d.root.visible) d.hit({ dirX: 0, dirZ: 1, power: 2.2, shiver: 0.45, flashColor: P.hotHex });
            });
          },
        },
      ];
    },
  },

  // 3. 四門銃口垂直疊陣：立體穿透魔導崩星巨砲 (Arcane)
  {
    id: 'chant_vertical_rail_starbreaker',
    cat: 'arcane',
    chantArchetype: 'barrel_cannon',
    baseChantDur: 1.95,
    chantStages: 4,
    cls: '奧術立體銃口奧義',
    title: '四門銃口疊陣：立體穿透魔導崩星巨砲',
    codeId: 'chant.cannon.vertical_starbreaker',
    duration: 2.80,
    peakTime: 0.28,
    handlesDynamicScale: true,
    contactTimes: [0.24, 0.65],
    hitbox: { kind: 'rect', width: 3.4, length: 11.8 },
    specNotes: [
      '施法者身前依序展開 4 道立體垂直銃口加速門陣進行詠唱蓄能，射程拉大至 11.8m！',
      '滿詠唱瞬間貫穿 4 道法陣轟出超長程崩星巨砲，地面犁出細長非圓形熔岩焦溝與兩側碎石噴濺',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageArcane', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledRectDummies(dummies, this.hitbox);
    },
    releaseTime: 0.24,
    keyframes: makeStaffCastKeyframes(0.14, 0.24, 2.68),
    buildEvents(sim, fighter, dummies, _seed, paletteOverride, texStyle = 'auto') {
      const P = resolvePal('mageArcane', paletteOverride);
      const fireP = resolvePal('fireInferno', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            fighter.hitStop = 0.12;
            const beamLen = hb.length;
            const beam = new BeamCylinder3D({
              p0: new THREE.Vector3(0, 1.28, 0.82),
              p1: new THREE.Vector3(0, 1.22, beamLen),
              radius: clamp(hb.width * 0.24, 0.48, 1.05),
              duration: 1.48,
              palette: P.pal,
              texStyle,
              defaultTex: 'volt',
              hdr: 2.75,
            });
            beam._skipAutoMap = true;
            sim.addCustom(beam);
            for (const f of [0.28, 0.56, 0.82]) {
              sim.spawnGroundZone({
                x: 0, z: beamLen * f, _mapped: true,
                radius: clamp(hb.width * 0.38, 1.05, 1.95),
                duration: 2.22,
                kind: 'burning',
                palette: fireP.pal,
                stretchX: 0.62,
                stretchZ: 2.35,
                yaw: 0.0,
                emitFlames: true,
                eruptRocks: true,
              });
            }
            sim.spawnFlipbook({
              atlas: 'fbExplosion', x: 0, y: 1.28, z: beamLen * 0.78, _mapped: true,
              life: 0.68, size0: 1.6, size1: 3.6, palette: P.pal, hdr: 2.65,
            });
            sim.spawnAirDistortion({
              kind: 'shock', x: 0, y: 1.25, z: 1.6, _mapped: true,
              r0: 0.2, r1: hb.width * 0.95, duration: 0.48, strength: 0.95,
            });
            dummies.forEach((d) => {
              if (d.root.visible) d.hit({ dirX: 0, dirZ: 1, power: 2.25, flashColor: P.hotHex });
            });
          },
        },
      ];
    },
  },

  // 4. 東方仙俠青蓮疊陣：太虛御劍萬劍歸宗 (Leap / Grand Sword Spell)
  {
    id: 'chant_xianxia_myriad_swords',
    cat: 'leap_spell',
    chantArchetype: 'martial_qi',
    baseChantDur: 1.95,
    chantStages: 3,
    cls: '仙俠御劍詠唱奧義',
    title: '三重青蓮疊陣：太虛御劍萬劍歸宗',
    codeId: 'chant.east.myriad_swords',
    duration: 2.85,
    peakTime: 0.35,
    handlesDynamicScale: true,
    contactTimes: [0.24, 0.55, 1.05],
    hitbox: { kind: 'circle', cx: 0, cz: 7.6, radius: 3.3 },
    specNotes: [
      '施法者周身展開中式仙俠青蓮御劍陣 (`sword_lotus`) 三重聚氣詠唱，讀條完成前絕不出劍！',
      '滿詠唱瞬間 BMesh 精雕「太虛鎮嶽青龍神劍」與 24 柄飛劍齊射 7.6m 遠處敵陣貫地震顫',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('windJade', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.24,
    keyframes: makeSkyChantKeyframes(0.14, 0.24, 2.72),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('windJade', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      const R = new Rng(seed + 404);
      return [
        {
          t: 0.24,
          run() {
            fighter.hitStop = 0.10;
            const kingSword = buildImmortalAzureGreatswordAssembly({ palette: P.pal, scale: 1.80 });
            let kEl = 0;
            sim.addCustom({
              group: kingSword.group,
              _skipAutoMap: true,
              update(dt) {
                kEl += dt;
                kingSword.update(dt);
                const drop = ease.outExpo(clamp(kEl / 0.22));
                kingSword.group.position.set(hb.cx, lerp(6.4, 1.18, drop), hb.cz);
                kingSword.group.rotation.set(Math.PI, kEl * 0.4, 0.08);
                kingSword.setOpacity(1 - smooth(1.75, 2.32, kEl));
              },
              get done() { return kEl >= 2.36; },
              dispose() { kingSword.dispose(); },
            });

            const rainGroup = new THREE.Group();
            const subSwords = [];
            for (let i = 0; i < 24; i++) {
              const a = (i / 24) * TAU + R.range(-0.12, 0.12);
              const r = Math.sqrt((i + 0.5) / 24) * hb.radius * 0.90;
              const sw = buildSpiritSwordAssembly({ palette: P.pal, scale: 0.72 + R.range(0, 0.28) });
              sw.group.rotation.set(Math.PI + R.range(-0.16, 0.16), a, R.range(-0.16, 0.16));
              rainGroup.add(sw.group);
              subSwords.push({
                sw,
                tx: hb.cx + Math.cos(a) * r,
                tz: hb.cz + Math.sin(a) * r,
                delay: (i % 8) * 0.055,
                landed: false,
              });
            }
            let rEl = 0;
            sim.addCustom({
              group: rainGroup,
              _skipAutoMap: true,
              update(dt) {
                rEl += dt;
                const fade = 1 - smooth(1.75, 2.28, rEl);
                for (const s of subSwords) {
                  const lt = rEl - s.delay;
                  s.sw.group.visible = lt >= 0;
                  if (lt < 0) continue;
                  s.sw.update(dt);
                  const u = clamp(lt / 0.20);
                  s.sw.group.position.set(s.tx, lerp(5.8, 0.65, ease.inQuad(u)), s.tz);
                  s.sw.setOpacity(fade);
                  if (u >= 1 && !s.landed) {
                    s.landed = true;
                    sim.spawnStarGlint(s.tx, 0.25, s.tz, 0.52, P.hotHex, 0.16, true);
                  }
                }
              },
              get done() { return rEl >= 2.32; },
              dispose() { subSwords.forEach((s) => s.sw.dispose()); },
            });

            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.96, duration: 2.25,
              kind: 'crater', palette: P.pal,
              stretchX: 1.15, stretchZ: 0.88, yaw: 0.95,
              emitFlames: false, eruptRocks: true,
            });
            dummies.forEach((d) => {
              if (d.root.visible) d.hit({ dirX: 0.2, dirZ: 1, power: 2.05, flashColor: P.hotHex });
            });
          },
        },
      ];
    },
  },

  // 5. 西方卡巴拉秘儀疊陣：生命之樹十質點創世新星 (Arcane)
  {
    id: 'chant_kabbalah_sephirot_nova',
    cat: 'arcane',
    chantArchetype: 'sequential_4tier',
    baseChantDur: 2.05,
    chantStages: 4,
    cls: '奧術秘儀詠唱奧義',
    title: '四重秘儀疊陣：卡巴拉生命之樹創世新星',
    codeId: 'chant.west.kabbalah_nova',
    duration: 2.85,
    peakTime: 0.35,
    handlesDynamicScale: true,
    contactTimes: [0.24, 0.65],
    hitbox: { kind: 'circle', cx: 0, cz: 7.8, radius: 3.3 },
    specNotes: [
      '施法者自身腳下完成四重卡巴拉十質點生命之樹星陣詠唱後，於 7.8m 遠處引爆紫金雙色創世超新星與三軸渾天星盤！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageViolet', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.24,
    keyframes: makeSkyChantKeyframes(0.14, 0.24, 2.72),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('mageViolet', paletteOverride);
      const goldP = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            fighter.hitStop = 0.11;
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz, _skipAutoMap: true,
              radius: hb.radius * 0.95,
              duration: 2.15,
              tradition: 'western',
              arrayKind: 'layered',
              layers: 4,
              style: 'kabbalahTree',
              palette: P.pal,
              hdr: 2.15,
              exactStyle: true,
            }));
            const astro = buildArmillaryAstrolabeAssembly({ palette: goldP.pal, scale: 1.52 });
            let aEl = 0;
            sim.addCustom({
              group: astro.group,
              _skipAutoMap: true,
              update(dt) {
                aEl += dt;
                astro.update(dt * 2.2);
                astro.group.position.set(hb.cx, 2.25 + Math.sin(aEl * 3.8) * 0.14, hb.cz);
                astro.setOpacity(Math.min(1, aEl * 5) * (1 - smooth(1.65, 2.25, aEl)));
              },
              get done() { return aEl >= 2.30; },
              dispose() { astro.dispose(); },
            });

            const sh1 = new ShockSphere3D({
              x: hb.cx, y: 1.45, z: hb.cz,
              r0: 0.22, r1: hb.radius * 1.05,
              duration: 0.56, palette: P.pal, hdr: 2.55, useRunes: true,
            });
            sh1._skipAutoMap = true;
            sim.addCustom(sh1);

            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.96, duration: 2.25,
              kind: 'void', palette: P.pal,
              stretchX: 1.22, stretchZ: 0.86, yaw: 1.15,
              emitFlames: true, eruptRocks: true,
            });
            sim.spawnFlipbook({
              atlas: 'fbStarburst', x: hb.cx, y: 1.65, z: hb.cz, _mapped: true,
              life: 0.68, size0: 1.7, size1: 3.9, palette: goldP.pal, hdr: 2.75,
            });
            sim.spawnFlipbook({
              atlas: 'fbDarkVortex', x: hb.cx, y: 1.35, z: hb.cz, _mapped: true,
              life: 0.65, size0: 1.4, size1: 3.2, palette: P.pal, hdr: 2.4,
            });
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.98,
              thickness: 0.62, height: 0.95, duration: 0.52,
              palette: goldP.pal, hdr: 2.5, seed: seed + 55,
            }));
            dummies.forEach((d) => {
              if (d.root.visible) d.hit({ dirX: -0.25, dirZ: 1, power: 2.15, flashColor: goldP.hotHex });
            });
          },
        },
      ];
    },
  },

  // 6. 東方梵音金蓮疊陣：千瓣曼荼羅大日聖印 (Holy)
  {
    id: 'chant_sanskrit_lotus_buddha',
    cat: 'holy',
    chantArchetype: 'sacred_prayer',
    baseChantDur: 1.95,
    chantStages: 3,
    cls: '東方梵音聖印奧義',
    title: '三重梵音疊陣：千瓣金蓮曼荼羅大日聖印',
    codeId: 'chant.east.lotus_mandala',
    duration: 2.80,
    peakTime: 0.32,
    handlesDynamicScale: true,
    contactTimes: [0.24, 0.68],
    hitbox: { kind: 'circle', cx: 0, cz: 7.4, radius: 3.2 },
    specNotes: [
      '施法者自身完成三重梵文金蓮與道紋符籙詠唱後，於 7.4m 遠端綻放黃金祝聖寶瓶與金青雙色大日聖印光柱！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('warriorGold', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.24,
    keyframes: makeSkyChantKeyframes(0.14, 0.24, 2.68),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const P = resolvePal('warriorGold', paletteOverride);
      const jadeP = resolvePal('windJade', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            fighter.hitStop = 0.10;
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz, _skipAutoMap: true,
              radius: hb.radius * 0.96,
              duration: 2.15,
              tradition: 'eastern',
              arrayKind: 'talisman_seal',
              layers: 3,
              style: 'lotusMandala',
              palette: P.pal,
              hdr: 2.15,
              exactStyle: true,
            }));
            const vessel = buildHolyChaliceAssembly({ palette: P.pal, scale: 1.65 });
            let vEl = 0;
            sim.addCustom({
              group: vessel.group,
              _skipAutoMap: true,
              update(dt) {
                vEl += dt;
                vessel.update(dt);
                vessel.group.position.set(hb.cx, 1.35 + Math.sin(vEl * 3.8) * 0.10, hb.cz);
                vessel.group.rotation.y += dt * 1.6;
                vessel.setOpacity(Math.min(1, vEl * 6) * (1 - smooth(1.65, 2.18, vEl)));
              },
              get done() { return vEl >= 2.22; },
              dispose() { vessel.dispose(); },
            });

            const dome = new DomeShield3D({
              x: hb.cx, y: 0.02, z: hb.cz,
              radius: hb.radius * 0.88, duration: 1.75, palette: jadeP.pal, hdr: 2.05,
            });
            dome._skipAutoMap = true;
            sim.addCustom(dome);
            sim.addCustom(new BeamCylinder3D({
              p0: new THREE.Vector3(hb.cx, 5.8, hb.cz),
              p1: new THREE.Vector3(hb.cx, 0.02, hb.cz),
              radius: hb.radius * 0.36, duration: 1.35,
              palette: P.pal, texStyle, defaultTex: 'flame', hdr: 2.45,
            }));
            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.96, duration: 2.25,
              kind: 'holy', palette: P.pal,
              stretchX: 0.92, stretchZ: 1.16, yaw: 0.55,
              emitFlames: true, eruptRocks: false,
            });
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.98,
              thickness: 0.58, height: 0.85, duration: 0.50,
              palette: P.pal, hdr: 2.4, seed: seed + 66,
            }));
            dummies.forEach((d) => {
              if (d.root.visible) d.hit({ dirX: 0, dirZ: 1, power: 2.0, flashColor: P.hotHex });
            });
          },
        },
      ];
    },
  },

  // 7. 四重子母屠城大陣：八門連攜滅世禁咒 (Fire)
  {
    id: 'chant_siege_cataclysm_forbidden',
    cat: 'fire',
    chantArchetype: 'sequential_4tier',
    baseChantDur: 2.25,
    chantStages: 4,
    cls: '屠城級四重子母禁咒',
    title: '四重子母屠城大陣：八門連攜滅世禁咒',
    codeId: 'chant.siege.eight_gate_cataclysm',
    duration: 3.10,
    peakTime: 0.48,
    handlesDynamicScale: true,
    contactTimes: [0.24, 0.95, 1.95],
    hitbox: { kind: 'circle', cx: 0, cz: 8.4, radius: 3.8 },
    specNotes: [
      '2.25 秒長詠唱完畢後，於 8.4m 遠處展開八門子母連攜屠城大陣，觸發天火隕石連環轟炸與多塊非圓形焦土熔岩裂谷！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.24,
    keyframes: makeSkyChantKeyframes(0.14, 0.24, 2.95),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('fireInferno', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            fighter.hitStop = 0.12;
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz, _skipAutoMap: true,
              radius: hb.radius * 0.96,
              duration: 2.55,
              tradition: 'western',
              arrayKind: 'satellite',
              satelliteCount: 8,
              layers: 4,
              style: 'siegeCataclysm',
              palette: P.pal,
              hdr: 2.25,
              exactStyle: true,
            }));
            spawnSustainedMeteorZone(sim, {
              cx: hb.cx,
              cz: hb.cz,
              radius: hb.radius,
              duration: 2.55,
              palette: P.pal,
              dummies,
              fighter,
              seed: seed + 777,
              astralDualHue: false,
            });
          },
        },
      ];
    },
  },

  // 8. 西方赫密斯四象疊陣：賢者之石三元鍊成爆裂 (Fire / Tri-Element)
  {
    id: 'chant_hermetic_philosopher_flare',
    cat: 'fire',
    chantArchetype: 'western_cathedral',
    baseChantDur: 2.00,
    chantStages: 4,
    cls: '煉金三元詠唱奧義',
    title: '四重煉金疊陣：赫密斯四象賢者之石爆裂',
    codeId: 'chant.west.hermetic_alchemist',
    duration: 2.85,
    peakTime: 0.35,
    handlesDynamicScale: true,
    contactTimes: [0.24, 0.65],
    hitbox: { kind: 'circle', cx: 0, cz: 7.6, radius: 3.3 },
    specNotes: [
      '施法者完成四重赫密斯煉金詠唱後，於 7.6m 遠端引爆冰、雷、火三元素交織衝擊，地面同時拼接霜晶裂片與熔岩地脈焦痕！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.24,
    keyframes: makeSkyChantKeyframes(0.14, 0.24, 2.72),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const fireP = resolvePal('fireInferno', paletteOverride);
      const frostP = resolvePal('mageFrost', paletteOverride);
      const voltP = resolvePal('mageVolt', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            fighter.hitStop = 0.11;
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz, _skipAutoMap: true,
              radius: hb.radius * 0.95,
              duration: 2.15,
              tradition: 'western',
              arrayKind: 'layered',
              layers: 4,
              style: 'hermeticAlchemy',
              layerStyles: ['hermeticAlchemy', 'glacier', 'leviathan', 'solomon'],
              palette: fireP.pal,
              hdr: 2.15,
              exactStyle: true,
            }));
            sim.spawnGroundZone({
              x: hb.cx - hb.radius * 0.24, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.78, duration: 2.28,
              kind: 'frost', palette: frostP.pal,
              stretchX: 0.92, stretchZ: 1.24, yaw: 0.48,
              emitFlames: false, eruptRocks: true,
            });
            sim.spawnGroundZone({
              x: hb.cx + hb.radius * 0.24, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.82, duration: 2.28,
              kind: 'burning', palette: fireP.pal,
              stretchX: 1.18, stretchZ: 0.90, yaw: 2.15,
              emitFlames: true, eruptRocks: true,
            });
            for (let k = 0; k < 3; k++) {
              const a = (k / 3) * TAU;
              const px = hb.cx + Math.cos(a) * hb.radius * 0.42;
              const pz = hb.cz + Math.sin(a) * hb.radius * 0.42;
              const palK = k === 0 ? fireP.pal : k === 1 ? frostP.pal : voltP.pal;
              const atl = k === 0 ? 'fbExplosion' : k === 1 ? 'fbIceShatter' : 'fbLightning';
              sim.spawnFlipbook({
                atlas: atl, x: px, y: 1.25, z: pz, _mapped: true,
                delay: k * 0.06, life: 0.62, size0: 1.35, size1: 3.1, palette: palK, hdr: 2.55,
              });
            }
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.98,
              thickness: 0.60, height: 0.92, duration: 0.52,
              palette: voltP.pal, hdr: 2.45, seed: seed + 88,
            }));
            dummies.forEach((d) => {
              if (d.root.visible) d.hit({ dirX: 0.2, dirZ: 1, power: 2.15, flashColor: '#ffffff' });
            });
          },
        },
      ];
    },
  },
];

// ============================================================================
// II. 🐉 召喚魔法 / 區域性作用魔法 / 中西方陣法圖鑑 (SUMMON_ZONE_MOVES — 14 Presets)
// ============================================================================
export const SUMMON_ZONE_MOVES = [
  // --- A. 6 Summoning Magic Spells (召喚類魔法) ---
  {
    id: 'sum_inferno_dragon_king',
    cat: 'summon_zone',
    cls: '召喚類魔法 · 炎龍降臨',
    title: '召喚魔法：盤龍炎陣・蒼炎龍王破界吐息',
    codeId: 'summon.dragon_king_breath',
    duration: 4.55,
    peakTime: 1.85,
    handlesDynamicScale: true,
    contactTimes: [1.15, 1.85, 2.65],
    hitbox: { kind: 'circle', cx: 0, cz: 7.4, radius: 3.3 },
    specNotes: [
      '施法者前方展開中式盤龍赤金召喚門陣，實體雕塑「盤龍蒼炎龍首」自法陣破界昂首升起！',
      '龍王橫掃噴吐高溫熔岩龍息光束，將目標區域燒出非圓形焦黑裂谷並持續冒出火舌與黑煙',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.34,
    keyframes: makeTwoBeatCastKeyframes(0.20, 0.34, 1.16, 4.40, false),
    buildEvents(sim, fighter, dummies, _seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('fireInferno', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.34,
          run() {
            sim.addCustom(new MagicArray3D({
              x: 0, y: 0.03, z: 1.35,
              radius: 1.95, duration: 3.45,
              tradition: 'eastern', arrayKind: 'layered', layers: 3,
              style: 'dragonFlame', palette: P.pal, hdr: 2.15, exactStyle: true,
            }));
            const dragon = buildDragonSpiritHeadAssembly({ palette: P.pal, scale: 2.05 });
            let dEl = 0;
            let breathSpawned = false;
            sim.addCustom({
              group: dragon.group,
              _skipAutoMap: true,
              update(dt) {
                dEl += dt;
                dragon.update(dt);
                const rise = ease.outBack(clamp(dEl / 0.65), 1.35);
                const sweepYaw = dEl > 0.85 ? Math.sin((dEl - 0.85) * 2.6) * 0.28 : 0;
                dragon.group.position.set(0, lerp(-0.6, 2.35, rise), 1.35);
                dragon.group.rotation.set(0.26, sweepYaw, 0);
                dragon.setOpacity(Math.min(1, dEl * 4.5) * (1 - smooth(2.95, 3.65, dEl)));

                if (!breathSpawned && dEl >= 0.82) {
                  breathSpawned = true;
                  fighter.hitStop = 0.08;
                  sim.addCustom(new BeamCylinder3D({
                    p0: new THREE.Vector3(0, 2.22, 1.95),
                    p1: new THREE.Vector3(hb.cx, 0.22, hb.cz),
                    radius: hb.radius * 0.28,
                    duration: 1.95,
                    palette: P.pal, texStyle, defaultTex: 'flame', hdr: 2.65,
                  }));
                  sim.spawnGroundZone({
                    x: hb.cx, z: hb.cz, _mapped: true,
                    radius: hb.radius * 0.96, duration: 3.05,
                    kind: 'burning', palette: P.pal,
                    stretchX: 1.28, stretchZ: 0.88, yaw: 0.25,
                    emitFlames: true, eruptRocks: true,
                  });
                  dummies.forEach((d) => {
                    if (d.root.visible) d.hit({ dirX: 0.2, dirZ: 1, power: 1.95, flashColor: P.hotHex });
                  });
                }
              },
              get done() { return dEl >= 3.72; },
              dispose() { dragon.dispose(); },
            });
          },
        },
      ];
    },
  },

  {
    id: 'sum_seraph_valkyrie_descent',
    cat: 'summon_zone',
    cls: '召喚類魔法 · 天使降臨',
    title: '召喚魔法：聖堂天門・十二羽熾天使神劍裁決',
    codeId: 'summon.seraph_valkyrie',
    duration: 4.50,
    peakTime: 1.75,
    handlesDynamicScale: true,
    contactTimes: [1.35, 1.75, 2.45],
    hitbox: { kind: 'circle', cx: 0, cz: 7.2, radius: 3.2 },
    specNotes: [
      '高空開啟西方聖堂三重天門法陣，召喚十二羽熾天聖翼與巨型聖耀靈劍化身懸空降臨！',
      '神劍垂直貫入敵陣中央引爆鳳羽聖光與非圓形祝聖裂痕結界',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.34,
    keyframes: makeTwoBeatCastKeyframes(0.20, 0.34, 1.80, 4.35, true),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.34,
          run() {
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 4.65, z: hb.cz,
              radius: hb.radius * 0.88, duration: 3.25,
              tradition: 'western', arrayKind: 'layered', layers: 3,
              style: 'valkyrie', palette: P.pal, hdr: 2.15, exactStyle: true,
            }));
            const avatar = new THREE.Group();
            const wings = buildSeraphWingsAssembly({ palette: P.pal, scale: 1.75 });
            const sword = buildSpiritSwordAssembly({ palette: P.pal, scale: 1.65 });
            sword.group.rotation.x = Math.PI;
            sword.group.position.set(0, -0.35, 0.25);
            avatar.add(wings.group, sword.group);

            let el = 0;
            let struck = false;
            sim.addCustom({
              group: avatar,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                wings.update(dt);
                sword.update(dt);
                const descend = ease.outCubic(clamp(el / 0.72));
                const plunge = el > 1.22 ? ease.inExpo(clamp((el - 1.22) / 0.24)) : 0;
                avatar.position.set(hb.cx, lerp(4.65, 2.85, descend) - plunge * 1.65, hb.cz);
                const op = Math.min(1, el * 5) * (1 - smooth(2.95, 3.65, el));
                wings.setOpacity(op);
                sword.setOpacity(op);

                if (!struck && el >= 1.46) {
                  struck = true;
                  fighter.hitStop = 0.095;
                  sim.spawnGroundZone({
                    x: hb.cx, z: hb.cz, _mapped: true,
                    radius: hb.radius * 0.96, duration: 2.50,
                    kind: 'holy', palette: P.pal,
                    stretchX: 1.15, stretchZ: 0.92, yaw: 0.78,
                    emitFlames: true, eruptRocks: true,
                  });
                  sim.spawnFlipbook({
                    atlas: 'fbFeatherBurst', x: hb.cx, y: 1.35, z: hb.cz, _mapped: true,
                    life: 0.72, size0: 1.6, size1: 3.6, palette: P.pal, hdr: 2.55,
                  });
                  sim.addCustom(new GroundWave3D({
                    x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.95,
                    thickness: 0.56, height: 0.88, duration: 0.50,
                    palette: P.pal, hdr: 2.4, seed: seed + 121,
                  }));
                  dummies.forEach((d) => {
                    if (d.root.visible) d.hit({ dirX: 0, dirZ: 1, power: 2.05, flashColor: P.hotHex });
                  });
                }
              },
              get done() { return el >= 3.72; },
              dispose() { wings.dispose(); sword.dispose(); },
            });
          },
        },
      ];
    },
  },

  {
    id: 'sum_glacial_colossus_prism',
    cat: 'summon_zone',
    cls: '召喚類魔法 · 寒晶魔像',
    title: '召喚魔法：極淵冰陣・六稜寒晶魔像破土震擊',
    codeId: 'summon.glacier_golem',
    duration: 4.55,
    peakTime: 1.82,
    handlesDynamicScale: true,
    contactTimes: [1.05, 1.82, 2.55],
    hitbox: { kind: 'circle', cx: 0, cz: 7.0, radius: 3.2 },
    specNotes: [
      '地面展開極淵寒冰召喚陣，全新三平面焦散微浮雕「六稜寒晶魔像」自碎冰裂縫破土升起！',
      '寒晶魔像揮動雙拳重砸地面，激起多層六角霜晶蕨葉裂痕與冰錐環爆',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageFrost', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.34,
    keyframes: makeTwoBeatCastKeyframes(0.20, 0.34, 1.89, 4.40, false),
    buildEvents(sim, fighter, dummies, _seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('mageFrost', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.34,
          run() {
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz - 0.55,
              radius: hb.radius * 0.88, duration: 3.45,
              tradition: 'western', arrayKind: 'layered', layers: 3,
              style: 'glacier', palette: P.pal, hdr: 2.05, exactStyle: true,
            }));
            const golem = buildGlacierPrismGolemAssembly({ palette: P.pal, scale: 1.78 });
            let gEl = 0;
            let slammed = false;
            sim.addCustom({
              group: golem.group,
              _skipAutoMap: true,
              update(dt) {
                gEl += dt;
                golem.update(dt * 1.4);
                const emerge = ease.outBack(clamp(gEl / 0.72), 1.4);
                const slamDip = (gEl > 1.35 && gEl < 1.85) ? Math.sin(((gEl - 1.35) / 0.50) * Math.PI) * 0.35 : 0;
                golem.group.position.set(hb.cx, lerp(-1.2, 1.55, emerge) - slamDip, hb.cz - 0.55);
                golem.setOpacity(Math.min(1, gEl * 4.5) * (1 - smooth(3.05, 3.75, gEl)));

                if (!slammed && gEl >= 1.55) {
                  slammed = true;
                  fighter.hitStop = 0.10;
                  sim.spawnGroundZone({
                    x: hb.cx, z: hb.cz, _mapped: true,
                    radius: hb.radius * 0.98, duration: 2.45,
                    kind: 'frost', palette: P.pal,
                    stretchX: 1.18, stretchZ: 0.90, yaw: 0.52,
                    emitFlames: false, eruptRocks: true,
                  });
                  for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * TAU;
                    sim.spawnCrystal({
                      x: hb.cx + Math.cos(a) * hb.radius * 0.62,
                      z: hb.cz + Math.sin(a) * hb.radius * 0.62,
                      _mapped: true,
                      height: 1.45, radius: 0.24, tiltX: Math.sin(a) * 0.28, tiltZ: -Math.cos(a) * 0.28,
                      palette: P.pal, life: 1.95, delay: i * 0.03,
                    });
                  }
                  sim.spawnFlipbook({
                    atlas: 'fbIceShatter', x: hb.cx, y: 1.15, z: hb.cz, _mapped: true,
                    life: 0.65, size0: 1.6, size1: 3.5, palette: P.pal, hdr: 2.5,
                  });
                  dummies.forEach((d) => {
                    if (d.root.visible) d.hit({ dirX: 0, dirZ: 1, power: 2.05, flashColor: P.hotHex });
                  });
                }
              },
              get done() { return gEl >= 3.82; },
              dispose() { golem.dispose(); },
            });
          },
        },
      ];
    },
  },

  {
    id: 'sum_abyssal_reaper_lord',
    cat: 'summon_zone',
    cls: '召喚類魔法 · 魔門死神',
    title: '召喚魔法：所羅門黑曜魔門・冥府死神巨鐮收割',
    codeId: 'summon.solomon_reaper_gate',
    duration: 4.55,
    peakTime: 1.80,
    handlesDynamicScale: true,
    contactTimes: [1.45, 1.80, 2.25],
    hitbox: { kind: 'sector', radius: 5.5, angleDeg: 155 },
    specNotes: [
      '豎立全新三平面黑曜熔岩紋「所羅門黑曜雙柱召喚門」，門內旋動暗紫次元漩渦並伸出巨型血月死神鐮刀！',
      '巨鐮橫斬 155° 血棘弧光，地面蔓延變形蟲多池狀虛空腐化沼痕',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('rogueBlood', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      const hb = getScaledHitbox(this.hitbox);
      const r = hb.radius * 0.72;
      dummies[0].reset(0, r, true);
      dummies[1].reset(-r * 0.48, r * 0.88, true);
      dummies[2].reset(r * 0.48, r * 0.88, true);
    },
    releaseTime: 0.34,
    keyframes: makeTwoBeatCastKeyframes(0.20, 0.34, 1.76, 4.40, false),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const bloodP = resolvePal('rogueBlood', paletteOverride);
      const voidP = resolvePal('voidAbyss', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.34,
          run() {
            const gate = buildSolomonSummonGateAssembly({ palette: voidP.pal, scale: 1.68 });
            const scythe = buildReaperScytheAssembly({ palette: bloodP.pal, scale: 1.85 });
            const root = new THREE.Group();
            root.add(gate.group, scythe.group);

            let el = 0;
            let reaped = false;
            sim.addCustom({
              group: root,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                gate.update(dt);
                scythe.update(dt);
                const rise = ease.outCubic(clamp(el / 0.65));
                gate.group.position.set(0, lerp(-1.1, 1.55, rise), 1.05);
                const fade = 1 - smooth(3.05, 3.75, el);
                gate.setOpacity(Math.min(1, el * 4) * fade);

                const scyOut = clamp((el - 0.65) / 0.55);
                scythe.group.visible = el >= 0.62;
                scythe.group.position.set(0, 1.38, lerp(1.0, hb.radius * 0.42, ease.outCubic(scyOut)));
                scythe.group.rotation.set(Math.PI * 0.44, el > 1.32 ? (el - 1.32) * 8.8 : -0.8, 0.18);
                scythe.setOpacity(clamp((el - 0.62) * 5, 0, 1) * fade);

                if (!reaped && el >= 1.42) {
                  reaped = true;
                  fighter.hitStop = 0.095;
                  const slashArc = new SlashArc3D({
                    center: [0, 1.18, 0.35],
                    radius: hb.radius * 0.90, width: 1.42, thickness: 0.38,
                    a0: -1.42, a1: 1.42, tiltZ: -0.14,
                    sweep: 0.075, hold: 0.06, trail: 0.28,
                    palette: bloodP.pal, texStyle, defaultTex: 'blood', hdrBoost: 2.6, seed: seed + 141,
                  });
                  slashArc._skipAutoMap = true;
                  sim.addCustom(slashArc);

                  sim.spawnGroundZone({
                    x: 0, z: hb.radius * 0.62, _mapped: true,
                    radius: hb.radius * 0.68, duration: 2.55,
                    kind: 'void', palette: voidP.pal,
                    stretchX: 1.32, stretchZ: 0.82, yaw: 0.18,
                    emitFlames: true, eruptRocks: false,
                  });
                  dummies.forEach((d) => {
                    if (!d.root.visible) return;
                    const wp = d.worldPosition();
                    d.hit({ dirX: 0.3, dirZ: 1, power: 2.0, flashColor: bloodP.hotHex });
                    sim.spawnFlipbook({
                      atlas: 'fbBloodSplash', x: wp.x, y: 1.15, z: wp.z, _mapped: true,
                      life: 0.52, size0: 1.1, size1: 2.4, palette: bloodP.pal, hdr: 2.4,
                    });
                  });
                }
              },
              get done() { return el >= 3.82; },
              dispose() { gate.dispose(); scythe.dispose(); },
            });
          },
        },
      ];
    },
  },

  {
    id: 'sum_immortal_azure_sword_spirit',
    cat: 'summon_zone',
    cls: '召喚類魔法 · 鎮嶽劍靈',
    title: '召喚魔法：道家符籙陣・太虛鎮嶽青龍劍靈',
    codeId: 'summon.immortal_sword_spirit',
    duration: 4.50,
    peakTime: 1.72,
    handlesDynamicScale: true,
    contactTimes: [1.35, 1.72, 2.35],
    hitbox: { kind: 'rect', width: 3.4, length: 10.6 },
    specNotes: [
      '中式道家懸浮符籙鎮封陣 (`talisman_seal`) 召喚巨型大馬士革鋼紋「太虛鎮嶽青龍神劍」劍靈！',
      '巨劍凌空怒劈向前，在地面劈開狹長非圓形地殼斷層裂谷與兩排青玉晶筍',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('windJade', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledRectDummies(dummies, this.hitbox);
    },
    releaseTime: 0.34,
    keyframes: makeTwoBeatCastKeyframes(0.20, 0.34, 1.76, 4.35, false),
    buildEvents(sim, fighter, dummies, _seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('windJade', paletteOverride);
      const goldP = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.34,
          run() {
            sim.addCustom(new MagicArray3D({
              x: 0, y: 0.025, z: 1.1,
              radius: 1.85, duration: 3.35,
              tradition: 'eastern', arrayKind: 'talisman_seal', layers: 3,
              style: 'talismanSeal', palette: goldP.pal, hdr: 2.05, exactStyle: true,
            }));
            const gtSword = buildImmortalAzureGreatswordAssembly({ palette: P.pal, scale: 2.25 });
            let el = 0;
            let cleaved = false;
            sim.addCustom({
              group: gtSword.group,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                gtSword.update(dt);
                const rise = ease.outBack(clamp(el / 0.65), 1.4);
                const chop = el > 1.18 ? ease.inExpo(clamp((el - 1.18) / 0.24)) : 0;
                gtSword.group.position.set(0, lerp(0.5, 3.45, rise) - chop * 1.95, lerp(1.1, hb.length * 0.48, chop));
                gtSword.group.rotation.set(chop * Math.PI * 0.56, 0, 0);
                gtSword.setOpacity(Math.min(1, el * 5) * (1 - smooth(2.95, 3.65, el)));

                if (!cleaved && el >= 1.42) {
                  cleaved = true;
                  fighter.hitStop = 0.10;
                  sim.spawnGroundZone({
                    x: 0, z: hb.length * 0.54, _mapped: true,
                    radius: clamp(hb.width * 0.42, 1.1, 2.0), duration: 2.50,
                    kind: 'crater', palette: P.pal,
                    stretchX: 0.58, stretchZ: 2.35, yaw: 0.0,
                    emitFlames: false, eruptRocks: true,
                  });
                  dummies.forEach((d) => {
                    if (d.root.visible) d.hit({ dirX: 0, dirZ: 1, power: 2.1, flashColor: P.hotHex });
                  });
                }
              },
              get done() { return el >= 3.72; },
              dispose() { gtSword.dispose(); },
            });
          },
        },
      ];
    },
  },

  {
    id: 'sum_storm_totem_obelisk_array',
    cat: 'summon_zone',
    cls: '召喚類魔法 · 圖騰結界',
    title: '召喚魔法：雷神三角方尖碑・高壓電磁脈衝陣',
    codeId: 'summon.storm_totem_triad',
    duration: 4.85,
    peakTime: 2.15,
    handlesDynamicScale: true,
    contactTimes: [1.05, 2.15, 3.45],
    hitbox: { kind: 'circle', cx: 0, cz: 7.2, radius: 3.3 },
    specNotes: [
      '於目標外圍三角頂點同時召喚 3 座懸浮水晶「符文圖騰方尖碑」，碑頂雷核互連構成三角高壓電網！',
      '每 0.45 秒向陣內所有目標交叉釋放連鎖電漿，地面形成非圓形玻璃化雷紋焦痕',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.34,
    keyframes: makeStaffCastKeyframes(0.20, 0.34, 4.70),
    buildEvents(sim, _fighter, dummies, _seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('mageVolt', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.34,
          run() {
            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.94, duration: 4.17,
              kind: 'lightning', palette: P.pal,
              stretchX: 1.15, stretchZ: 0.92, yaw: 0.38,
              emitFlames: false, eruptRocks: true,
            });
            const holder = new THREE.Group();
            const totems = [];
            for (let i = 0; i < 3; i++) {
              const a = (i / 3) * TAU - Math.PI / 2;
              const px = hb.cx + Math.cos(a) * hb.radius * 0.84;
              const pz = hb.cz + Math.sin(a) * hb.radius * 0.84;
              const ob = buildTotemObeliskAssembly({ palette: P.pal, scale: 0.92 });
              ob.group.position.set(px, 0, pz);
              holder.add(ob.group);
              totems.push({ ob, top: new THREE.Vector3(px, 1.92, pz) });
            }

            let el = 0;
            let pulseTimer = 0.35;
            sim.addCustom({
              group: holder,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                const rem = 4.27 - el;
                const pop = ease.outBack(clamp(el / 0.38), 1.6);
                const fade = 1 - smooth(3.67, 4.22, el);
                for (const t of totems) {
                  t.ob.update(dt);
                  t.ob.group.scale.setScalar(0.92 * pop * fade);
                  t.ob.setOpacity(fade);
                }
                pulseTimer -= dt;
                if (pulseTimer <= 0 && rem > 0.38) {
                  pulseTimer = 0.45;
                  for (let i = 0; i < 3; i++) {
                    const pA = totems[i].top;
                    const pB = totems[(i + 1) % 3].top;
                    sim.spawnLightning({
                      p0: pA, p1: pB, _mapped: true,
                      life: 0.26, jag: 0.22, depth: 3, forks: 2, palette: P.pal, thickness: 0.052,
                    });
                  }
                  const centerHit = new THREE.Vector3(hb.cx, 1.05, hb.cz);
                  sim.spawnLightning({
                    p0: totems[Math.floor(el * 3) % 3].top, p1: centerHit, _mapped: true,
                    life: 0.24, jag: 0.24, depth: 4, forks: 2, palette: P.pal, thickness: 0.055,
                  });
                  dummies.forEach((d) => {
                    if (d.root.visible) d.hit({ dirX: 0, dirZ: 1, power: 1.15, noPush: true, shiver: 0.28, flashColor: P.hotHex });
                  });
                }
              },
              get done() { return el >= 4.27; },
              dispose() { totems.forEach((t) => t.ob.dispose()); },
            });
          },
        },
      ];
    },
  },

  // --- B. 6 Regional Persistent Zone Magic Spells (區域性作用魔法, 5.4s~5.6s) ---
  {
    id: 'zone_venom_miasma_swamp',
    cat: 'summon_zone',
    cls: '區域性作用魔法 · 毒沼',
    title: '區域魔法：萬蠱蝕骨劇毒泥沼領域 (5.5s)',
    codeId: 'zone.persistent.venom_swamp',
    duration: 5.55,
    peakTime: 2.35,
    handlesDynamicScale: true,
    contactTimes: [0.95, 2.35, 4.10],
    hitbox: { kind: 'circle', cx: 0, cz: 7.2, radius: 3.4 },
    specNotes: [
      '區域性持續控場腐蝕法術：以 Shader 變形蟲代謝球 (Amoeboid Metaballs) 拼接 3 塊不規則劇毒冒泡泥沼，絕非死板正圓貼圖！',
      '長達 5.5 秒不斷鼓起立體毒液氣泡、飄散紫綠瘴氣並對區域內目標造成多段蝕骨持續傷害',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('poison', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.36,
    keyframes: makeStaffCastKeyframes(0.22, 0.36, 5.38),
    buildEvents(sim, _fighter, dummies, _seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('poison', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.36,
          run() {
            // 3 offset irregular amoeboid poison swamp patches forming an organic marsh!
            const patches = [
              { dx: 0, dz: 0, r: 0.96, sx: 1.24, sz: 0.86, yaw: 0.35 },
              { dx: -0.32, dz: 0.22, r: 0.68, sx: 0.88, sz: 1.26, yaw: 1.75 },
              { dx: 0.34, dz: -0.20, r: 0.65, sx: 1.18, sz: 0.84, yaw: 2.65 },
            ];
            for (const p of patches) {
              sim.spawnGroundZone({
                x: hb.cx + p.dx * hb.radius,
                z: hb.cz + p.dz * hb.radius,
                _mapped: true,
                radius: hb.radius * p.r,
                duration: 4.90,
                kind: 'poison',
                palette: P.pal,
                stretchX: p.sx,
                stretchZ: p.sz,
                yaw: p.yaw,
                emitFlames: true,
                eruptRocks: false,
              });
            }

            // 3D bubbling toxic pustules rising & popping across the marsh!
            const bubbleGeo = new THREE.SphereGeometry(0.22, 16, 12);
            const bubbleMat = new THREE.MeshBasicMaterial({
              color: new THREE.Color(P.pal[4]).multiplyScalar(1.55),
              transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false,
            });
            const bGroup = new THREE.Group();
            const bubbles = Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * TAU + i * 0.4;
              const rr = ((i % 4) + 0.5) * 0.21 * hb.radius;
              const m = new THREE.Mesh(bubbleGeo, bubbleMat);
              bGroup.add(m);
              return { m, x: hb.cx + Math.cos(a) * rr, z: hb.cz + Math.sin(a) * rr, phase: i * 0.62 };
            });

            let el = 0;
            let tick = 0.55;
            sim.addCustom({
              group: bGroup,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                const rem = 4.92 - el;
                const fade = 1 - smooth(4.35, 4.90, el);
                bubbleMat.opacity = 0.62 * fade;
                for (const b of bubbles) {
                  const cyc = (el * 1.45 + b.phase) % 1.0;
                  const s = Math.sin(cyc * Math.PI) * (0.65 + 0.55 * cyc) * fade;
                  b.m.position.set(b.x, 0.08 + cyc * 0.42, b.z);
                  b.m.scale.set(s, s * 0.82, s);
                }
                tick -= dt;
                if (tick <= 0 && rem > 0.45) {
                  tick = 0.78;
                  dummies.forEach((d) => {
                    if (!d.root.visible) return;
                    const wp = d.worldPosition();
                    d.hit({ dirX: 0, dirZ: 1, power: 0.95, noPush: true, flashColor: P.hotHex });
                    sim.spawnStatusMark('poison', wp, Math.min(0.65, rem - 0.1));
                  });
                }
              },
              get done() { return el >= 4.94; },
              dispose() { bubbleGeo.dispose(); bubbleMat.dispose(); },
            });
          },
        },
      ];
    },
  },

  {
    id: 'zone_chronos_stasis_domain',
    cat: 'summon_zone',
    cls: '區域性作用魔法 · 時空領域',
    title: '區域魔法：星象儀時空凝滯緩速結界 (5.5s)',
    codeId: 'zone.persistent.chronos_stasis',
    duration: 5.50,
    peakTime: 2.30,
    handlesDynamicScale: true,
    contactTimes: [0.95, 2.30, 4.05],
    hitbox: { kind: 'circle', cx: 0, cz: 7.2, radius: 3.3 },
    specNotes: [
      '展開半透明六角測地線時空穹頂 (`DomeShield3D`) 與懸浮三軸星盤陀螺儀，地面刻劃黃銅齒輪星鐘大陣',
      '結界持續 5.5 秒週期性釋放時間凝滯收縮波與重力透鏡空氣扭曲！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageArcane', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.36,
    keyframes: makeSkyChantKeyframes(0.22, 0.36, 5.35),
    buildEvents(sim, _fighter, dummies, _seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('mageArcane', paletteOverride);
      const goldP = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.36,
          run() {
            const dome = new DomeShield3D({
              x: hb.cx, y: 0.01, z: hb.cz,
              radius: hb.radius * 0.96, duration: 4.85, palette: P.pal, hdr: 1.95,
            });
            dome._skipAutoMap = true;
            sim.addCustom(dome);

            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz,
              radius: hb.radius * 0.92, duration: 4.85,
              tradition: 'western', arrayKind: 'layered', layers: 3,
              style: 'chrono', palette: goldP.pal, hdr: 2.0, exactStyle: true,
            }));

            const astro = buildArmillaryAstrolabeAssembly({ palette: goldP.pal, scale: 1.45 });
            let el = 0;
            let pulse = 0.65;
            sim.addCustom({
              group: astro.group,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                const rem = 4.88 - el;
                astro.update(dt * 0.65);
                astro.group.position.set(hb.cx, 2.25 + Math.sin(el * 2.4) * 0.10, hb.cz);
                astro.setOpacity(Math.min(1, el * 4) * (1 - smooth(4.25, 4.85, el)));
                pulse -= dt;
                if (pulse <= 0 && rem > 0.55) {
                  pulse = 1.05;
                  dome.triggerHit(new THREE.Vector3(0, 1, 0));
                  sim.spawnAirDistortion({
                    kind: 'implode', x: hb.cx, y: 1.25, z: hb.cz, _mapped: true,
                    r0: hb.radius * 0.85, r1: 0.25, duration: 0.45, strength: 0.72,
                  });
                  dummies.forEach((d) => {
                    if (d.root.visible) d.hit({ dirX: 0, dirZ: -1, power: 1.05, noPush: true, flashColor: goldP.hotHex });
                  });
                }
              },
              get done() { return el >= 4.90; },
              dispose() { astro.dispose(); },
            });
          },
        },
      ];
    },
  },

  {
    id: 'zone_world_tree_sanctuary',
    cat: 'summon_zone',
    targetTeam: 'party',
    cls: '區域性作用魔法 · 隊伍祝聖域',
    title: '區域魔法：世界樹金蓮祝聖治癒領域 (5.5s)',
    codeId: 'zone.persistent.sanctuary',
    duration: 5.50,
    peakTime: 2.25,
    handlesDynamicScale: true,
    contactTimes: [0.90, 2.25, 4.00],
    hitbox: { kind: 'circle', targetTeam: 'party', cx: 0, cz: 5.2, radius: 4.4 },
    specNotes: [
      '隊伍友善祝聖庇護領域：結合非圓形翡翠聖金地面焦散紋、東方金蓮曼荼羅與懸浮祝聖聖杯',
      '5.5 秒內持續為施法者與三名隊友恢復生命值並疊加守護聖盾！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const { hotHex } = resolvePal('mageEmerald', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      fighter.enableSupportHUD(0.55, 0.0);
      dummies.forEach((d) => d.reset(0, 0, false));
      const hb = getScaledHitbox(this.hitbox);
      const r = hb.radius * 0.56;
      if (allies[0]) allies[0].reset(hb.cx, hb.cz + r * 0.72, true, { hpFrac: 0.42 });
      if (allies[1]) allies[1].reset(hb.cx - r, hb.cz - r * 0.15, true, { hpFrac: 0.50 });
      if (allies[2]) allies[2].reset(hb.cx + r, hb.cz - r * 0.15, true, { hpFrac: 0.46 });
    },
    releaseTime: 0.36,
    keyframes: makeSkyChantKeyframes(0.22, 0.36, 5.35),
    buildEvents(sim, fighter, dummies, _seed, paletteOverride, _texStyle = 'auto', allies = []) {
      installChargeVariantHook(sim);
      const P = resolvePal('mageEmerald', paletteOverride);
      const goldP = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.36,
          run() {
            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.96, duration: 4.85,
              kind: 'holy', palette: P.pal,
              stretchX: 1.16, stretchZ: 0.92, yaw: 0.62,
              emitFlames: true, eruptRocks: false,
            });
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz, _skipAutoMap: true,
              radius: hb.radius * 0.88, duration: 4.85,
              tradition: 'eastern', arrayKind: 'layered', layers: 2,
              style: 'lotusMandala', palette: goldP.pal, hdr: 1.95, exactStyle: true,
            }));
            const chalice = buildHolyChaliceAssembly({ palette: goldP.pal, scale: 1.28 });
            let el = 0;
            let waveTick = 0.45;
            sim.addCustom({
              group: chalice.group,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                const rem = 4.88 - el;
                chalice.update(dt);
                chalice.group.position.set(hb.cx, 2.35 + Math.sin(el * 3.0) * 0.10, hb.cz);
                chalice.setOpacity(Math.min(1, el * 4) * (1 - smooth(4.25, 4.85, el)));
                waveTick -= dt;
                if (waveTick <= 0 && rem > 0.55) {
                  waveTick = 1.05;
                  sim.spawnFlipbook({
                    atlas: 'fbBlessing', x: hb.cx, y: 1.15, z: hb.cz, _mapped: true,
                    life: 0.48, size0: 1.1, size1: 2.4, palette: goldP.pal, hdr: 2.25,
                  });
                  fighter.heal(0.14, '+320 聖域');
                  fighter.addShield(0.08);
                  allies.forEach((a) => {
                    if (a.root.visible) {
                      a.heal(0.18, '+420 聖域');
                      a.addShield(0.10);
                      sim.spawnStatusMark('shield', a.worldPosition(), Math.min(0.8, rem - 0.1));
                    }
                  });
                  dummies.forEach((d) => {
                    if (d.root.visible) sim.spawnStatusMark('shield', d.worldPosition(), Math.min(0.8, rem - 0.1));
                  });
                }
              },
              get done() { return el >= 4.90; },
              dispose() { chalice.dispose(); },
            });
          },
        },
      ];
    },
  },

  {
    id: 'zone_abyss_gravity_prison',
    cat: 'summon_zone',
    cls: '區域性作用魔法 · 重力牢籠',
    title: '區域魔法：深淵黑洞重力腐化牢籠 (5.6s)',
    codeId: 'zone.persistent.abyss_gravity',
    duration: 5.60,
    peakTime: 2.45,
    handlesDynamicScale: true,
    contactTimes: [0.95, 2.45, 4.15],
    hitbox: { kind: 'circle', cx: 0, cz: 7.4, radius: 3.4 },
    specNotes: [
      '區域中央懸浮高密度黑洞奇點與歪斜吸積漩渦，地面以非圓形多池虛空腐化裂隙蔓延 5.6 秒',
      '外圍升起 6 根黑曜石封鎖稜柱，持續將範圍內敵人向中心牽引並觸發暗物質脈衝！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('voidAbyss', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.36,
    keyframes: makeStaffCastKeyframes(0.22, 0.36, 5.45),
    buildEvents(sim, _fighter, dummies, _seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('voidAbyss', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.36,
          run() {
            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.98, duration: 4.95,
              kind: 'void', palette: P.pal,
              stretchX: 1.22, stretchZ: 0.88, yaw: 0.92,
              emitFlames: true, eruptRocks: true,
            });
            sim.spawnGroundZone({
              x: hb.cx - hb.radius * 0.22, z: hb.cz + hb.radius * 0.18, _mapped: true,
              radius: hb.radius * 0.66, duration: 4.85,
              kind: 'void', palette: P.pal,
              stretchX: 0.85, stretchZ: 1.28, yaw: 2.35,
              emitFlames: false, eruptRocks: false,
            });
            const funnel = new VortexFunnel3D({
              x: hb.cx, y: 0.05, z: hb.cz,
              rBottom: hb.radius * 0.82, rTop: 0.28, height: 1.85,
              duration: 4.85, spinSpeed: -11.5, palette: P.pal, defaultTex: 'void', hdr: 2.15,
            });
            funnel._skipAutoMap = true;
            sim.addCustom(funnel);

            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * TAU;
              sim.spawnCrystal({
                x: hb.cx + Math.cos(a) * hb.radius * 0.86,
                z: hb.cz + Math.sin(a) * hb.radius * 0.86,
                _mapped: true,
                height: 1.65, radius: 0.22, tiltX: -Math.sin(a) * 0.22, tiltZ: Math.cos(a) * 0.22,
                palette: P.pal, life: 4.65, delay: i * 0.05,
              });
            }

            const holeGeo = new THREE.SphereGeometry(0.42, 24, 18);
            const holeMat = new THREE.MeshBasicMaterial({ color: 0x05020a, transparent: true, opacity: 0.96 });
            const rimGeo = new THREE.TorusGeometry(0.56, 0.032, 10, 48);
            const rimMat = new THREE.MeshBasicMaterial({
              color: new THREE.Color(P.pal[5]).multiplyScalar(2.1),
              transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
            });
            const gHole = new THREE.Group();
            const mHole = new THREE.Mesh(holeGeo, holeMat);
            const mRim = new THREE.Mesh(rimGeo, rimMat);
            gHole.add(mHole, mRim);

            let el = 0;
            let tick = 0.65;
            sim.addCustom({
              group: gHole,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                const rem = 4.95 - el;
                const fade = 1 - smooth(4.35, 4.92, el);
                gHole.position.set(hb.cx, 1.45 + Math.sin(el * 3.2) * 0.08, hb.cz);
                mRim.rotation.x += dt * 4.2;
                mRim.rotation.y -= dt * 5.5;
                holeMat.opacity = 0.95 * fade;
                rimMat.opacity = 0.92 * fade;
                tick -= dt;
                if (tick <= 0 && rem > 0.50) {
                  tick = 0.92;
                  sim.spawnAirDistortion({
                    kind: 'implode', x: hb.cx, y: 1.45, z: hb.cz, _mapped: true,
                    r0: hb.radius * 0.85, r1: 0.2, duration: 0.42, strength: 0.85,
                  });
                  dummies.forEach((d) => {
                    if (d.root.visible) d.hit({ dirX: 0, dirZ: -1, power: 1.25, noPush: true, flashColor: P.hotHex });
                  });
                }
              },
              get done() { return el >= 4.96; },
              dispose() { holeGeo.dispose(); holeMat.dispose(); rimGeo.dispose(); rimMat.dispose(); },
            });
          },
        },
      ];
    },
  },

  {
    id: 'zone_desert_quicksand_vortex',
    cat: 'summon_zone',
    cls: '區域性作用魔法 · 流沙狂風',
    title: '區域魔法：荒漠流沙狂風陷坑領域 (5.5s)',
    codeId: 'zone.persistent.quicksand_storm',
    duration: 5.50,
    peakTime: 2.35,
    handlesDynamicScale: true,
    contactTimes: [0.95, 2.35, 4.05],
    hitbox: { kind: 'circle', cx: 0, cz: 7.2, radius: 3.4 },
    specNotes: [
      '地面生成多池不規則荒漠流沙陷坑 (`envSandWhirl` + 程序化拼接)，上方盤旋傾斜沙塵暴龍捲風！',
      '5.5 秒內碎石與流沙不斷繞旋捲起，持續壓制並撕裂區域內敵人',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('warriorGold', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.36,
    keyframes: makeStaffCastKeyframes(0.22, 0.36, 5.35),
    buildEvents(sim, _fighter, dummies, _seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('warriorGold', paletteOverride);
      const earthP = resolvePal('earthMagma', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.36,
          run() {
            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.98, duration: 4.85,
              kind: 'sand', palette: P.pal,
              stretchX: 1.24, stretchZ: 0.88, yaw: 0.45,
              emitFlames: true, eruptRocks: true,
            });
            const cyc1 = new VortexFunnel3D({
              x: hb.cx, y: 0.02, z: hb.cz,
              rBottom: hb.radius * 0.35, rTop: hb.radius * 0.98, height: 3.85,
              duration: 4.80, spinSpeed: 12.5, palette: P.pal, defaultTex: 'silk', hdr: 1.95,
            });
            cyc1.group.rotation.z = -0.14;
            cyc1._skipAutoMap = true;
            sim.addCustom(cyc1);

            let el = 0;
            let tick = 0.60;
            sim.addCustom({
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                const rem = 4.85 - el;
                tick -= dt;
                if (tick <= 0 && rem > 0.55) {
                  tick = 0.85;
                  sim.spawnRockDebris({
                    x: hb.cx, y: 0.15, z: hb.cz, _mapped: true,
                    count: 5, radius: hb.radius * 0.45, life: Math.min(0.75, rem - 0.1),
                    style: 'slate', palette: earthP.pal,
                  });
                  dummies.forEach((d) => {
                    if (d.root.visible) d.hit({ dirX: 0.35, dirZ: -0.5, power: 1.1, noPush: true, flashColor: P.hotHex });
                  });
                }
              },
              get done() { return el >= 4.88; },
              dispose() {},
            });
          },
        },
      ];
    },
  },

  {
    id: 'zone_thunder_fulgurite_field',
    cat: 'summon_zone',
    cls: '區域性作用魔法 · 雷池感電',
    title: '區域魔法：九天雷池玻璃化感電領域 (5.6s)',
    codeId: 'zone.persistent.fulgurite_field',
    duration: 5.60,
    peakTime: 2.35,
    handlesDynamicScale: true,
    contactTimes: [0.88, 2.35, 4.15],
    hitbox: { kind: 'circle', cx: 0, cz: 7.4, radius: 3.4 },
    specNotes: [
      '雙層錯位非圓形樹枝狀雷擊玻璃化焦痕地面 (`lightning`) 長達 5.6 秒持續放電！',
      '地表裂縫不斷向上竄起高壓電弧與球狀閃電，賦予區域內所有敵人感電震顫',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.36,
    keyframes: makeStaffCastKeyframes(0.22, 0.36, 5.45),
    buildEvents(sim, _fighter, dummies, seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('mageVolt', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      const R = new Rng(seed + 919);
      return [
        {
          t: 0.36,
          run() {
            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.98, duration: 4.95,
              kind: 'lightning', palette: P.pal,
              stretchX: 1.25, stretchZ: 0.85, yaw: 0.55,
              emitFlames: true, eruptRocks: true,
            });
            sim.spawnGroundZone({
              x: hb.cx + hb.radius * 0.16, z: hb.cz - hb.radius * 0.14, _mapped: true,
              radius: hb.radius * 0.76, duration: 4.90,
              kind: 'lightning', palette: P.pal,
              stretchX: 0.82, stretchZ: 1.28, yaw: 1.95,
              emitFlames: false, eruptRocks: false,
            });
            let el = 0;
            let arcTick = 0.25;
            sim.addCustom({
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                const rem = 4.95 - el;
                arcTick -= dt;
                if (arcTick <= 0 && rem > 0.38) {
                  arcTick = 0.34;
                  const a1 = R.range(0, TAU), r1 = Math.sqrt(R.next()) * hb.radius * 0.85;
                  const a2 = a1 + R.range(1.2, 2.8), r2 = Math.sqrt(R.next()) * hb.radius * 0.85;
                  const p0 = new THREE.Vector3(hb.cx + Math.cos(a1) * r1, 0.08, hb.cz + Math.sin(a1) * r1);
                  const p1 = new THREE.Vector3(hb.cx + Math.cos(a2) * r2, R.range(1.4, 3.2), hb.cz + Math.sin(a2) * r2);
                  sim.spawnLightning({
                    p0, p1, _mapped: true,
                    life: 0.24, jag: 0.26, depth: 3, forks: 2, palette: P.pal, thickness: 0.048,
                  });
                  if (Math.floor(el * 3) % 2 === 0) {
                    dummies.forEach((d) => {
                      if (d.root.visible) d.hit({ dirX: 0, dirZ: 1, power: 1.0, noPush: true, shiver: 0.32, flashColor: P.hotHex });
                    });
                  }
                }
              },
              get done() { return el >= 4.98; },
              dispose() {},
            });
          },
        },
      ];
    },
  },

  // --- C. 2 East / West Magic Circle Taxonomy Showcases (中西方 × 簡單/複雜 × 圖層/屠城對照) ---
  {
    id: 'arr_eastern_taxonomy_showcase',
    cat: 'summon_zone',
    cls: '中式陣法圖鑑 · 四階對照',
    title: '東方陣法圖鑑：極簡八卦 ➔ 奇門外圓內方 ➔ 八門屠城大陣',
    codeId: 'array.taxonomy.eastern_4tier',
    duration: 5.40,
    peakTime: 4.15,
    handlesDynamicScale: true,
    contactTimes: [0.85, 2.45, 4.15],
    hitbox: { kind: 'circle', cx: 0, cz: 6.8, radius: 3.6 },
    specNotes: [
      '一次完整檢視中式/東方陣法四階段演進：① 極簡 1 層太極八卦陣 ➔ ② 2 層道家懸浮符籙鎮封陣 ➔ ③ 3 層「外圓內方」奇門遁甲九宮陣 ➔ ④ 4 層八門子母連攜屠城大陣！',
      '亦可隨時透過右側「陣法體系 / 圖層複雜度」選單強制套用至全庫任意技能',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, false);
    },
    releaseTime: 0.34,
    keyframes: makeTwoBeatCastKeyframes(0.20, 0.34, 3.45, 5.25, true),
    buildEvents(sim, _fighter, dummies, _seed, paletteOverride) {
      const goldP = resolvePal('holyGold', paletteOverride);
      const jadeP = resolvePal('windJade', paletteOverride);
      const fireP = resolvePal('fireInferno', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.34,
          run() {
            // Stage 1: Simple 1-layer Bagua (Left)
            sim.addCustom(new MagicArray3D({
              x: hb.cx - hb.radius * 0.52, y: 0.025, z: hb.cz - 0.65,
              radius: hb.radius * 0.36, duration: 3.00,
              tradition: 'eastern', arrayKind: 'layered', layers: 1,
              style: 'baguaSimple', palette: jadeP.pal, hdr: 1.95, exactStyle: true,
            }));
          },
        },
        {
          t: 1.15,
          run() {
            // Stage 2: 2-layer Talisman Seal (Right)
            sim.addCustom(new MagicArray3D({
              x: hb.cx + hb.radius * 0.52, y: 0.025, z: hb.cz - 0.65,
              radius: hb.radius * 0.38, duration: 2.25,
              tradition: 'eastern', arrayKind: 'talisman_seal', layers: 2,
              style: 'talismanSeal', palette: goldP.pal, hdr: 2.0, exactStyle: true,
            }));
          },
        },
        {
          t: 2.15,
          run() {
            // Stage 3: 3-layer Outer-Circle Inner-Square Qimen Array (Center)
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz,
              radius: hb.radius * 0.56, duration: 1.45,
              tradition: 'eastern', arrayKind: 'qimen_square', layers: 3,
              style: 'qimenComplex', palette: goldP.pal, hdr: 2.1, exactStyle: true,
            }));
          },
        },
        {
          t: 3.45,
          run() {
            // Stage 4: Colossal 4-layer + 8-Gate Satellite Siege Cataclysm Array!
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.026, z: hb.cz,
              radius: hb.radius * 0.96, duration: 1.80,
              tradition: 'eastern', arrayKind: 'satellite', satelliteCount: 8, layers: 4,
              style: 'qimenComplex', palette: fireP.pal, hdr: 2.25, exactStyle: true,
            }));
            sim.spawnFlipbook({
              atlas: 'fbExplosion', x: hb.cx, y: 1.35, z: hb.cz, _mapped: true,
              delay: 0.25, life: 0.62, size0: 1.5, size1: 3.4, palette: fireP.pal, hdr: 2.55,
            });
            dummies[0].hit({ dirX: 0, dirZ: 1, power: 1.85, flashColor: fireP.hotHex });
          },
        },
      ];
    },
  },

  {
    id: 'arr_western_taxonomy_showcase',
    cat: 'summon_zone',
    cls: '西式陣法圖鑑 · 四階對照',
    title: '西方陣法圖鑑：極簡盧恩 ➔ 赫密斯煉金 ➔ 所羅門屠城禁咒',
    codeId: 'array.taxonomy.western_4tier',
    duration: 5.40,
    peakTime: 4.15,
    handlesDynamicScale: true,
    contactTimes: [0.85, 2.45, 4.15],
    hitbox: { kind: 'circle', cx: 0, cz: 6.8, radius: 3.6 },
    specNotes: [
      '一次完整檢視西式/西方陣法四階段演進：① 極簡 1 層北歐盧恩環 ➔ ② 2 層赫密斯對轉煉金三角陣 ➔ ③ 3 層卡巴拉三軸星環立體陣 ➔ ④ 4 層所羅門六芒星宿子母屠城禁咒！',
      '清楚區分簡單單層、對轉雙層、立體多圖層與攻城級子母連攜大陣',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageArcane', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, false);
    },
    releaseTime: 0.34,
    keyframes: makeTwoBeatCastKeyframes(0.20, 0.34, 3.45, 5.25, true),
    buildEvents(sim, _fighter, dummies, _seed, paletteOverride) {
      const arcP = resolvePal('mageArcane', paletteOverride);
      const vioP = resolvePal('mageViolet', paletteOverride);
      const goldP = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.34,
          run() {
            // Stage 1: Simple 1-layer Nordic Rune Ring (Left)
            sim.addCustom(new MagicArray3D({
              x: hb.cx - hb.radius * 0.52, y: 0.025, z: hb.cz - 0.65,
              radius: hb.radius * 0.36, duration: 3.00,
              tradition: 'western', arrayKind: 'layered', layers: 1,
              style: 'runeSimple', palette: arcP.pal, hdr: 1.95, exactStyle: true,
            }));
          },
        },
        {
          t: 1.15,
          run() {
            // Stage 2: 2-layer Hermetic Counter-Rotating Triangle Array (Right)
            sim.addCustom(new MagicArray3D({
              x: hb.cx + hb.radius * 0.52, y: 0.025, z: hb.cz - 0.65,
              radius: hb.radius * 0.38, duration: 2.25,
              tradition: 'western', arrayKind: 'layered', layers: 2,
              style: 'hermeticAlchemy', palette: goldP.pal, hdr: 2.0, exactStyle: true,
            }));
          },
        },
        {
          t: 2.15,
          run() {
            // Stage 3: 3-layer Kabbalah Gimbal Tower (Center)
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz,
              radius: hb.radius * 0.56, duration: 1.45,
              tradition: 'western', arrayKind: 'layered', layers: 3,
              style: 'kabbalahTree', palette: vioP.pal, hdr: 2.1, exactStyle: true,
            }));
          },
        },
        {
          t: 3.45,
          run() {
            // Stage 4: Colossal 4-layer + 6-Node Solomon Siege Cataclysm Array!
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.026, z: hb.cz,
              radius: hb.radius * 0.96, duration: 1.80,
              tradition: 'western', arrayKind: 'satellite', satelliteCount: 6, layers: 4,
              style: 'siegeCataclysm', palette: goldP.pal, hdr: 2.25, exactStyle: true,
            }));
            sim.spawnFlipbook({
              atlas: 'fbStarburst', x: hb.cx, y: 1.45, z: hb.cz, _mapped: true,
              delay: 0.25, life: 0.62, size0: 1.6, size1: 3.6, palette: goldP.pal, hdr: 2.65,
            });
            dummies[0].hit({ dirX: 0, dirZ: 1, power: 1.85, flashColor: goldP.hotHex });
          },
        },
      ];
    },
  },
];

// ============================================================================
// III. 🧮 遊戲演算法實戰擴充 (NEW_GAMEDEV_ALGO_MOVES — Presets ⑤..⑩)
// ============================================================================
export const NEW_GAMEDEV_ALGO_MOVES = [
  {
    id: 'algo_boids_flocking_swords',
    cat: 'gamedev_algo',
    cls: '演算法實戰 · Boids Flocking',
    title: '演算法⑤ Boids 群聚三法則飛劍陣 (分離+對齊+凝聚)',
    codeId: 'algo.boids.flocking_swords',
    duration: 4.05,
    peakTime: 1.55,
    handlesDynamicScale: true,
    contactTimes: [1.15, 2.15, 2.65],
    hitbox: { kind: 'circle', cx: 0, cz: 7.2, radius: 3.2 },
    specNotes: [
      '實作 Craig Reynolds 經典 Boids 群聚演算法：Separation (近距反平方排斥) + Alignment (鄰居速度對齊) + Cohesion (鄰居質心凝聚)',
      '26 柄大馬士革鋼紋飛劍先在空中形成自然魚群/鳥群流體盤旋陣型，2.05 秒後分批俯衝貫穿目標！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('windJade', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.36,
    noSigil: true,
    keyframes: makeStaffCastKeyframes(0.22, 0.36, 3.90),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('windJade', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.36,
          run() {
            attachWeaponBladeTrail3D(sim, fighter, { duration: 1.15, width: 0.36, palette: P.pal, hdr: 2.45, sparkRate: 34 });
            spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.75, duration: 1.05, palette: P.pal, hdr: 2.2, _mapped: true });
            const targets = dummies.filter((d) => d.root.visible).map((d) => d.chestWorld());
            spawnBoidsSwordSwarm(sim, {
              count: 26,
              duration: 3.42,
              diveStart: 1.85,
              palette: P.pal,
              targets: targets.length ? targets : [new THREE.Vector3(hb.cx, 1.0, hb.cz)],
              dummies,
              seed: seed + 505,
            });
          },
        },
      ];
    },
  },

  {
    id: 'algo_verlet_jakobsen_chains',
    cat: 'gamedev_algo',
    cls: '演算法實戰 · Verlet 物理',
    title: '演算法⑥ Verlet 積分 + Jakobsen 約束物理鎖魂鐵鏈',
    codeId: 'algo.physics.verlet_jakobsen',
    duration: 3.95,
    peakTime: 1.98,
    handlesDynamicScale: true,
    contactTimes: [0.85, 1.98, 2.65],
    hitbox: { kind: 'circle', cx: 0, cz: 7.0, radius: 3.2 },
    specNotes: [
      '實作無速度變數 Verlet 位置積分 x\' = x + (x - x_old)·d + g·dt² 搭配每幀 6 次 Jakobsen 距離約束鬆弛法',
      '4 條實體黑曜鐵鏈呈現真實重力懸鏈線垂墜擺動，1.98 秒瞬間縮短約束長度繃緊絞殺目標！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('voidAbyss', paletteOverride);
      fighter.setLoadout('scythe', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.36,
    noSigil: true,
    keyframes: makeTwoBeatCastKeyframes(0.22, 0.36, 1.98, 3.80, false),
    buildEvents(sim, fighter, dummies, _seed, paletteOverride) {
      const P = resolvePal('voidAbyss', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      const r = hb.radius * 0.78;
      return [
        {
          t: 0.36,
          run() {
            attachWeaponBladeTrail3D(sim, fighter, { duration: 1.25, width: 0.38, palette: P.pal, hdr: 2.45, sparkRate: 32 });
            spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.68, duration: 0.98, palette: P.pal, hdr: 2.15, _mapped: true });
            spawnVerletSoulChains(sim, {
              anchors: [
                new THREE.Vector3(hb.cx - r, 2.25, hb.cz - r * 0.75),
                new THREE.Vector3(hb.cx + r, 2.25, hb.cz - r * 0.75),
                new THREE.Vector3(hb.cx - r * 0.85, 2.05, hb.cz + r * 0.75),
                new THREE.Vector3(hb.cx + r * 0.85, 2.05, hb.cz + r * 0.75),
              ],
              target: new THREE.Vector3(hb.cx, 1.08, hb.cz),
              duration: 3.35,
              snapPullTime: 1.62,
              palette: P.pal,
              dummies,
            });
          },
        },
      ];
    },
  },

  {
    id: 'algo_cubic_bezier_arc_homing',
    cat: 'gamedev_algo',
    cls: '演算法實戰 · 弧長參數化貝茲',
    title: '演算法⑦ 三次貝茲曲線 + 弧長查找表 (LUT) 等速導引彈幕',
    codeId: 'algo.spline.bezier_arclength_lut',
    duration: 3.65,
    peakTime: 1.25,
    handlesDynamicScale: true,
    contactTimes: [0.75, 1.25, 1.95],
    hitbox: { kind: 'circle', cx: 0, cz: 7.4, radius: 3.1 },
    specNotes: [
      '實作 Cubic Bézier B(t) 搭配 20 段累積弧長二分搜尋表 (`buildBezierArcLengthLUT`)，解決一般貝茲 t 等速導致大曲率處忽快忽慢的通病！',
      '16 枚藍寶石奧術梭沿雙翼立體貝茲弧線嚴格保持 13.5m/s 恆定世界速率精準匯聚轟擊',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageViolet', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.36,
    keyframes: makeStaffCastKeyframes(0.22, 0.36, 3.50),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('mageViolet', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.36,
          run() {
            const targets = dummies.filter((d) => d.root.visible).map((d) => d.chestWorld());
            spawnCubicBezierVolley(sim, {
              origin: fighter.getStaffTipWorld(),
              targets: targets.length ? targets : [new THREE.Vector3(hb.cx, 1.1, hb.cz)],
              count: 16,
              duration: 3.05,
              palette: P.pal,
              dummies,
              seed: seed + 707,
            });
          },
        },
      ];
    },
  },

  {
    id: 'algo_voronoi_cellular_shatter',
    cat: 'gamedev_algo',
    cls: '演算法實戰 · Voronoi 碎裂',
    title: '演算法⑧ Voronoi 泰森多邊形半平面裁切 3D 晶壁爆碎',
    codeId: 'algo.fracture.voronoi_shatter',
    duration: 3.75,
    peakTime: 1.14,
    handlesDynamicScale: true,
    contactTimes: [0.85, 1.14, 1.65],
    hitbox: { kind: 'circle', cx: 0, cz: 6.8, radius: 3.1 },
    specNotes: [
      '實作精確 2D Voronoi 種子垂直平分線半平面多邊形裁切 (`clipPolyHalfPlane`) + 3D 斜角擠出 (`ExtrudeGeometry`)！',
      '24 塊零重疊多邊形寒晶障壁先由裂縫透出蓄能白光，1.14 秒應聲爆碎為獨立受重力彈跳的 3D 冰晶岩塊',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageFrost', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.36,
    noSigil: true,
    keyframes: makeTwoBeatCastKeyframes(0.22, 0.36, 1.14, 3.60, false),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('mageFrost', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.36,
          run() {
            attachWeaponBladeTrail3D(sim, fighter, { duration: 1.05, width: 0.38, palette: P.pal, hdr: 2.45, sparkRate: 34 });
            spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.68, duration: 0.98, palette: P.pal, hdr: 2.15, _mapped: true });
            spawnVoronoiBarrierShatter(sim, {
              center: new THREE.Vector3(hb.cx, 1.38, Math.max(1.8, hb.cz - 0.55)),
              width: hb.radius * 1.12,
              height: 2.45,
              cellCount: 24,
              shatterTime: 0.78,
              duration: 3.15,
              palette: P.pal,
              dummies,
              seed: seed + 808,
            });
          },
        },
      ];
    },
  },

  {
    id: 'algo_bfs_spring_chain_lightning',
    cat: 'gamedev_algo',
    cls: '演算法實戰 · BFS + 二階彈簧',
    title: '演算法⑨ BFS 最短跳數生成樹連鎖閃電 + 二階欠阻尼彈簧',
    codeId: 'algo.graph.bfs_spring_lightning',
    duration: 3.75,
    peakTime: 1.18,
    handlesDynamicScale: true,
    contactTimes: [0.65, 1.18, 1.95],
    hitbox: { kind: 'circle', cx: 0, cz: 7.2, radius: 3.2 },
    specNotes: [
      '實作 FIFO 佇列廣度優先搜尋 (`BFS`) 建立 9 座雷導節點最短跳數生成樹，依 hop=0→1→2→3 階層精準傳導閃電！',
      '每座雷導稜柱受電擊時以二階欠阻尼彈簧微分方程 y\'\' = -k·y - c·y\' (ζ=0.22) 產生真實 Q 彈物理回振',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.36,
    keyframes: makeStaffCastKeyframes(0.22, 0.36, 3.60),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('mageVolt', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.36,
          run() {
            spawnBFSChainLightning(sim, {
              origin: fighter.getStaffTipWorld(),
              center: new THREE.Vector3(hb.cx, 1.15, hb.cz),
              radius: hb.radius * 0.90,
              duration: 3.15,
              palette: P.pal,
              dummies,
              seed: seed + 909,
            });
          },
        },
      ];
    },
  },

  {
    id: 'algo_curl_noise_phoenix_flow',
    cat: 'gamedev_algo',
    cls: '演算法實戰 · Curl-Noise 流體',
    title: '演算法⑩ 3D 無散度 Curl-Noise 旋度流體鳳凰火羽場',
    codeId: 'algo.fluid.curl_noise_phoenix',
    duration: 4.15,
    peakTime: 1.85,
    handlesDynamicScale: true,
    contactTimes: [0.95, 1.85, 2.95],
    hitbox: { kind: 'circle', cx: 0, cz: 7.0, radius: 3.2 },
    specNotes: [
      '實作 Bridson 3D 向量位旋度流場 v = ∇ × Ψ（數值散度 ∇·v ≡ 0），粒子絕不壓縮堆積成死點，呈現絲滑無壓縮渦流！',
      '320 枚 GPU Instancing 鳳凰火羽沿無散度渦流盤旋升騰，搭配非圓形多貼圖拼接熔岩地裂',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetScaledCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.36,
    keyframes: makeSkyChantKeyframes(0.22, 0.36, 4.00),
    buildEvents(sim, _fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('fireInferno', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.36,
          run() {
            spawnCurlNoisePhoenixField(sim, {
              center: new THREE.Vector3(hb.cx, 0.25, hb.cz),
              radius: hb.radius * 0.92,
              count: 320,
              duration: 3.58,
              palette: P.pal,
              dummies,
              seed: seed + 1010,
            });
          },
        },
      ];
    },
  },
];
