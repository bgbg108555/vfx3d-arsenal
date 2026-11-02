import * as THREE from 'three';
import {
  TAU, clamp, lerp, smooth, ease, Rng, PAL3D, rampToColors,
  SlashArc3D, RibbonTrail3D, GroundWave3D, VortexFunnel3D, BeamCylinder3D, Sigil3D, DomeShield3D,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import {
  resolvePal, SHIELD_GUARD, makeStaffCastKeyframes, makeSkyChantKeyframes, makeEmpowerBuffKeyframes, spawnGroundCracks, spawnArcaneOrb,
  attachWeaponBladeTrail3D, spawnMartialStanceGust3D, spawnBladeGroundScar3D,
} from './fx_helpers.js';

export const PRESETS_COSMIC_HOLY_DARK = [
  // =========================================================================
  // ARCANE 2: 奧術星盤魔導巨砲 (杖前直立雙層奧術法陣展開 -> 粗壯螺旋魔導砲持續貫穿)
  // =========================================================================
  {
    id: 'arcane_beam_cannon',
    cat: 'arcane',
    cls: '星界大法師 Astral Mage',
    title: '奧術星盤：魔導巨砲照射',
    codeId: 'm.skill.arcane_cannon',
    duration: 2.25,
    releaseTime: 0.42,
    peakTime: 0.85,
    contactTimes: [0.42, 0.85, 1.38],
    hitbox: { kind: 'rect', width: 1.8, length: 6.2 },
    specNotes: [
      '0.42s 杖端前方垂直展開雙層旋轉奧術星盤 (Sigil3D 直立砲口) 並發射 5.2m 雙層流體螺旋魔導巨砲',
      '貫穿三名敵人並持續爆開電漿與星芒 Flipbook',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageViolet', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 2.35, true);
      dummies[1].reset(-0.22, 3.95, true);
      dummies[2].reset(0.22, 5.45, true);
    },
    keyframes: makeStaffCastKeyframes(0.26, 0.42, 2.15),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('mageViolet', paletteOverride);
      const A = resolvePal('mageArcane', paletteOverride);

      const evs = [
        { t: 0.06, isPreGather: true, run() {
          sim.spawnFlipbook({
            atlas: 'fbMagicSwirl', x: 0, y: 1.24, z: 1.02,
            life: 0.36, size0: 1.45, size1: 0.65, palette: A.pal, hdr: 2.0,
          });
          sim.addLight(0, 1.25, 1.1, P.midHex, 4.5, 5.5, 0.36);
        }},
        { t: 0.42, run() {
          const muzzleSigil = new Sigil3D({
            x: 0, y: 1.24, z: 0.98, radius: 1.05, duration: 1.20,
            style: 'arcane', palette: P.pal, hdr: 2.05, wallHeight: 0.45,
          });
          muzzleSigil.group.rotation.x = Math.PI / 2;
          sim.addCustom(muzzleSigil);
          sim.addCustom(new BeamCylinder3D({
            p0: new THREE.Vector3(0, 1.24, 1.02),
            p1: new THREE.Vector3(0, 1.18, 6.08),
            radius: 0.40, duration: 1.16, palette: P.pal,
            texStyle, defaultTex: 'volt', hdr: 2.35, muzzleRings: true,
          }));
          sim.addLight(0, 1.3, 3.6, P.hotHex, 7.2, 8.5, 1.12);
          sim.spawnStarGlint(0, 1.24, 1.08, 0.95, '#ffffff', 0.16);
        }},
      ];

      for (const hitT of [0.50, 0.78, 1.06, 1.32]) {
        evs.push({
          t: hitT,
          run() {
            dummies.forEach((d, idx) => {
              const pos = d.root.position;
              d.hit({ dirX: idx % 2 ? -0.2 : 0.2, dirZ: 1, power: 0.95, noPush: true, flashColor: P.hotHex, shiver: 0.35 });
              sim.spawnFlipbook({
                atlas: 'fbHitBurst', x: pos.x, y: 1.18, z: pos.z - 0.18,
                life: 0.24, size0: 0.72, size1: 1.45, palette: idx % 2 ? A.pal : P.pal, hdr: 2.15,
              });
            });
            sim.spawnFlipbook({
              atlas: 'fbLightning', x: 0, y: 1.22, z: 2.2 + R.range(0, 3.0),
              life: 0.28, size0: 0.95, size1: 1.55, palette: A.pal, hdr: 2.0, loopFrames: true,
            });
          },
        });
      }
      return evs;
    },
  },

  // =========================================================================
  // ARCANE 3: 萬象奧術飛彈齊射 (星雲蓄力 -> 8 發左右高低大弧度追蹤飛彈交錯轟炸)
  // =========================================================================
  {
    id: 'arcane_missile_volley',
    cat: 'arcane',
    cls: '星界大法師 Astral Mage',
    title: '萬象奧術飛彈齊射 (弧線追蹤群彈)',
    codeId: 'm.skill.arcane_volley',
    duration: 2.25,
    releaseTime: 0.28,
    peakTime: 0.82,
    contactTimes: [0.48, 0.82, 1.18],
    hitbox: { kind: 'circle', cx: 0, cz: 4.6, radius: 3.0 },
    specNotes: [
      '杖頂綻放星雲漩渦 Flipbook，依序向左右與高空甩出 8 枚立體雙環奧術飛彈',
      '每枚飛彈拉出飽滿 3D 弧線能量管束收斂轟向目標群，連環綻放受擊星芒 Flipbook',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageArcane', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 4.6, true);
      dummies[1].reset(-1.45, 4.85, true);
      dummies[2].reset(1.45, 4.85, true);
    },
    keyframes: makeStaffCastKeyframes(0.16, 0.28, 2.15),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P1 = resolvePal('mageArcane', paletteOverride);
      const P2 = resolvePal('mageViolet', paletteOverride);

      const curves = [
        { side: -1.45, arc: 0.55, tgt: 1 },
        { side: 1.45,  arc: 0.55, tgt: 2 },
        { side: -0.95, arc: 1.15, tgt: 0 },
        { side: 0.95,  arc: 1.15, tgt: 0 },
        { side: -1.65, arc: 0.35, tgt: 1 },
        { side: 1.65,  arc: 0.35, tgt: 2 },
        { side: -0.45, arc: 1.45, tgt: 0 },
        { side: 0.45,  arc: 1.45, tgt: 0 },
      ];

      const evs = [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnFlipbook({
            atlas: 'fbMagicSwirl', x: tip.x, y: tip.y, z: tip.z, _mapped: true,
            life: 0.55, size0: 0.85, size1: 1.45, palette: P1.pal, hdr: 2.1, loopFrames: true,
          });
        }},
      ];

      curves.forEach((c, idx) => {
        evs.push({
          t: 0.28 + idx * 0.075,
          run() {
            const P = idx % 2 === 0 ? P1 : P2;
            const d = dummies[c.tgt];
            const p1 = d.chestWorld();
            spawnArcaneOrb(sim, {
              p0: fighter.getStaffTipWorld(), p1,
              arcHeight: c.arc, sideCurve: c.side, flightTime: 0.38,
              palette: P.pal, orbSize: 0.12, spiral: idx >= 6, trailFadeTime: 0.22,
              onImpact: () => {
                d.hit({ dirX: -c.side * 0.25, dirZ: 1, power: 0.85, noPush: true, flashColor: P.hotHex });
                sim.spawnFlipbook({
                  atlas: 'fbHitBurst', x: p1.x, y: p1.y, z: p1.z - 0.15,
                  life: 0.26, size0: 0.65, size1: 1.35, palette: P.pal, hdr: 2.2,
                });
                sim.addLight(p1.x, p1.y, p1.z, P.hotHex, 3.8, 4.2, 0.18);
                for (let s = 0; s < 8; s++) {
                  const a = R.range(0, TAU), sp = R.range(2.4, 5.2);
                  sim.spawnSpark({
                    x: p1.x, y: p1.y, z: p1.z,
                    vx: Math.cos(a) * sp, vy: R.range(0.6, 3.2), vz: Math.sin(a) * sp,
                    life: 0.18, size: 0.042, color: P.midHex,
                  });
                }
              },
            });
          },
        });
      });
      return evs;
    },
  },

  // =========================================================================
  // ARCANE 4: 星界隕星群雨 (高空星界天幕法陣 -> 9 顆星辰連環斜墜爆開星渦與光冠)
  // =========================================================================
  {
    id: 'arcane_starfall',
    cat: 'arcane',
    cls: '占星賢者 Astromancer',
    title: '星界隕星群雨 (天幕流星陣)',
    codeId: 'm.skill.starfall',
    duration: 2.45,
    releaseTime: 0.28,
    peakTime: 1.05,
    contactTimes: [0.55, 1.05, 1.55],
    hitbox: { kind: 'circle', cx: 0, cz: 3.6, radius: 3.8 },
    specNotes: [
      '4.5m 高空與地面同步張開星界大法陣 (Sigil3D)，天頂浮現璀璨銀河漩渦 Flipbook',
      '9 顆立體多面體流星交錯斜墜，每顆落點綻放星雲漩渦 Flipbook 與小型立體星光氣浪冠',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageArcane', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.6, true);
      dummies[1].reset(-1.85, 3.95, true);
      dummies[2].reset(1.85, 3.95, true);
    },
    keyframes: makeSkyChantKeyframes(0.16, 0.28, 2.35),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P1 = resolvePal('mageArcane', paletteOverride);
      const P2 = resolvePal('holyGold', paletteOverride);
      const cx = 0, cz = 3.6;

      const dropPts = [
        [0, 3.6], [-1.6, 3.9], [1.6, 3.9],
        [-0.9, 2.3], [1.1, 2.4], [0, 5.0],
        [-1.9, 3.0], [1.9, 3.1], [0, 3.6],
      ];

      const evs = [
        { t: 0.05, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.62, P1.hotHex, 0.20, true);
          sim.addLight(tip.x, tip.y, tip.z, P1.midHex, 3.2, 4.0, 0.20, true);
        }},
      ];

      dropPts.forEach(([tx, tz], idx) => {
        evs.push({
          t: 0.28 + idx * 0.12,
          run() {
            if (idx === 0) {
              sim.addCustom(new Sigil3D({
                x: cx, y: 0.025, z: cz, radius: 3.55, duration: 1.72,
                style: 'arcane', palette: P1.pal, hdr: 1.75, wallHeight: 0.55,
              }));
              sim.addCustom(new Sigil3D({
                x: cx, y: 4.55, z: cz, radius: 3.15, duration: 1.62,
                style: 'holy', palette: P2.pal, hdr: 1.85, wallHeight: 0.35,
              }));
              sim.spawnFlipbook({
                atlas: 'fbMagicSwirl', x: cx, y: 4.45, z: cz,
                life: 1.45, size0: 2.8, size1: 3.8, palette: P1.pal, hdr: 1.9, loopFrames: true,
              });
            }
            const P = idx % 3 === 2 ? P2 : P1;
            const p0 = new THREE.Vector3(tx - 0.85, 4.55, tz - 0.55);
            const p1 = new THREE.Vector3(tx, 0.12, tz);
            spawnArcaneOrb(sim, {
              p0, p1, arcHeight: 0, flightTime: 0.24,
              palette: P.pal, orbSize: idx === 8 ? 0.22 : 0.14, heavy: true, trailFadeTime: 0.20,
              onImpact: () => {
                sim.spawnStarGlint(tx, 0.35, tz, idx === 8 ? 0.95 : 0.62, '#ffffff', 0.14);
                sim.addLight(tx, 0.8, tz, P.hotHex, 4.5, 4.8, 0.24);
                sim.addCustom(new GroundWave3D({
                  x: tx, z: tz, maxRadius: idx === 8 ? 1.85 : 1.15, thickness: 0.36, height: 0.52, duration: 0.32,
                  palette: P.pal, hdr: 2.1, seed: seed + 160 + idx,
                }));
                sim.spawnFlipbook({
                  atlas: 'fbMagicSwirl', x: tx, y: 0.45, z: tz,
                  life: 0.36, size0: 0.75, size1: 1.55, palette: P.pal, hdr: 2.0,
                });
                for (const d of dummies) {
                  if (Math.hypot(d.homeX - tx, d.homeZ - tz) < 1.85) {
                    d.hit({ dirX: d.homeX - tx, dirZ: d.homeZ - tz + 0.3, power: 0.95, noPush: true, flashColor: P.hotHex });
                  }
                }
              },
            });
          },
        });
      });
      return evs;
    },
  },

  // =========================================================================
  // ARCANE 5: 次元裂隙星門爆發 (直立立體星門圓環 + 雙向漩渦 -> 空間十字撕裂爆發)
  // =========================================================================
  {
    id: 'arcane_portal',
    cat: 'arcane',
    cls: '次元行者 Voidwalker',
    title: '次元裂隙：星門開啟與空間撕裂',
    codeId: 'm.skill.void_rift',
    duration: 2.15,
    releaseTime: 0.28,
    peakTime: 0.96,
    contactTimes: [0.38, 0.96, 1.38],
    hitbox: { kind: 'circle', cx: 0, cz: 3.6, radius: 2.8 },
    specNotes: [
      '0.28s 在戰場中央豎起立體雙環次元星門與直立奧術法陣，中心翻湧星系漩渦 Flipbook',
      '0.92s 星門能量飽和，十字交錯立體暗紫裂隙刀弧撕開空間並炸出奧術星暴',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageViolet', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.6, true);
      dummies[1].reset(-1.45, 3.95, true);
      dummies[2].reset(1.45, 3.95, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.16, ease: ease.inOutCubic, pose: {
        crouch: 0.10, torsoPitch: -0.22, headPitch: -0.28,
        shRPitch: -2.20, shRYaw: 0.16, elRPitch: -0.18,
        shLPitch: -2.05, shLYaw: -0.24, elLPitch: -0.22, capePitch: 0.45,
      }},
      { t: 0.28, ease: ease.outExpo, pose: {
        z: 0.14, crouch: 0.18, torsoPitch: 0.22, headPitch: 0.04,
        shRPitch: -1.54, shRYaw: 0.06, elRPitch: -0.06,
        shLPitch: -1.25, shLYaw: -0.45, elLPitch: -0.22, capePitch: 0.66,
      }},
      { t: 0.74, ease: ease.inOutCubic, pose: {
        z: 0.08, crouch: 0.12, torsoPitch: -0.20, headPitch: -0.26,
        shRPitch: -2.25, shRYaw: 0.18, elRPitch: -0.16,
        shLPitch: -2.08, shLYaw: -0.26, elLPitch: -0.20, capePitch: 0.52,
      }},
      { t: 0.92, ease: ease.outExpo, pose: {
        z: 0.20, crouch: 0.24, torsoPitch: 0.28, headPitch: 0.08,
        shRPitch: -1.38, shRYaw: 0.12, elRPitch: -0.06,
        shLPitch: -1.08, shLYaw: -0.58, elLPitch: -0.26, capePitch: 0.76,
      }},
      { t: 2.05, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('mageViolet', paletteOverride);
      const A = resolvePal('mageArcane', paletteOverride);
      const cx = 0, cz = 3.6;

      return [
        { t: 0.05, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.62, A.hotHex, 0.20, true);
        }},
        { t: 0.28, run() {
          const gateSigil = new Sigil3D({
            x: cx, y: 1.45, z: cz, radius: 1.45, duration: 1.22,
            style: 'arcane', palette: P.pal, hdr: 2.0, wallHeight: 0.45,
          });
          gateSigil.group.rotation.x = Math.PI / 2;
          sim.addCustom(gateSigil);

          // Sculpted 3D Beveled Dimensional Gate Ring
          const ramp = rampToColors(P.pal, 7);
          const g = new THREE.Group();
          g.position.set(cx, 1.45, cz);
          const outerGeo = new THREE.TorusGeometry(1.32, 0.085, 10, 48);
          const innerGeo = new THREE.TorusGeometry(1.08, 0.042, 8, 40);
          const mat1 = new THREE.MeshStandardMaterial({ color: 0x1a1230, emissive: ramp[3].clone().multiplyScalar(1.2), roughness: 0.25, metalness: 0.8, flatShading: true });
          const mat2 = new THREE.MeshBasicMaterial({ color: ramp[5].clone().multiplyScalar(1.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
          const m1 = new THREE.Mesh(outerGeo, mat1);
          const m2 = new THREE.Mesh(innerGeo, mat2);
          g.add(m1, m2);

          let elapsed = 0;
          sim.addCustom({
            group: g,
            update(dt) {
              elapsed += dt;
              const pop = ease.outBack(clamp(elapsed / 0.22), 1.7) * (1 - smooth(0.95, 1.22, elapsed));
              g.scale.setScalar(Math.max(0.01, pop));
              m1.rotation.z += dt * 1.8;
              m2.rotation.z -= dt * 4.2;
              mat2.opacity = clamp(pop);
            },
            get done() { return elapsed >= 1.22; },
            dispose() { outerGeo.dispose(); innerGeo.dispose(); mat1.dispose(); mat2.dispose(); },
          });

          sim.spawnFlipbook({
            atlas: 'fbMagicSwirl', x: cx, y: 1.45, z: cz,
            life: 1.05, size0: 1.65, size1: 2.45, palette: A.pal, hdr: 2.1, loopFrames: true,
          });
          sim.addLight(cx, 1.5, cz, P.midHex, 5.2, 7.0, 1.15);

          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * TAU, r = R.range(1.8, 2.5);
            const ox = Math.cos(a) * r, oy = Math.sin(a) * r * 0.8;
            sim.spawnSpark({
              x: cx + ox, y: 1.45 + oy, z: cz + R.range(-0.8, 0.8),
              vx: -ox * 2.8, vy: -oy * 2.8, vz: 0,
              life: 0.45, size: 0.048, color: A.hotHex, streakIn: true, delay: R.range(0, 0.35),
            });
          }
        }},
        { t: 0.92, run() {
          for (const [idx, tilt] of [[0, -0.75], [1, 0.75]]) {
            sim.addCustom(new SlashArc3D({
              center: [cx, 1.45, cz - 0.6], radius: 2.05, width: 0.85, thickness: 0.28,
              a0: -1.35, a1: 1.35, tiltZ: tilt,
              sweep: 0.07, hold: 0.08, trail: 0.24,
              palette: idx === 0 ? P.pal : A.pal, texStyle, defaultTex: 'void', hdrBoost: 2.5, seed: seed + 170 + idx,
            }));
          }
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 2.74, thickness: 0.54, height: 0.78, duration: 0.40,
            palette: P.pal, hdr: 2.2, seed: seed + 175,
          }));
          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: cx, y: 1.45, z: cz,
            life: 0.36, size0: 1.35, size1: 2.75, palette: A.pal, hdr: 2.35,
          });
          sim.addLight(cx, 1.5, cz, A.hotHex, 7.5, 8.5, 0.38);
          for (const d of dummies) {
            d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz + 0.3, power: 1.5, noPush: false, flashColor: A.hotHex });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // HOLY 1: 聖光天罰裁決柱 (天地八芒聖印法陣 -> 5.4m 黃金聖光巨柱貫頂裁決)
  // =========================================================================
  {
    id: 'holy_smite',
    cat: 'holy',
    cls: '聖殿騎士 Paladin',
    title: '聖光天罰裁決柱 (天地八芒聖陣)',
    codeId: 'p.skill.holy_smite',
    duration: 2.05,
    releaseTime: 0.44,
    peakTime: 0.64,
    contactTimes: [0.44, 0.64, 1.12],
    hitbox: { kind: 'circle', cx: 0, cz: 3.8, radius: 2.8 },
    specNotes: [
      '地面與高空同時亮起精緻八芒聖印貼圖法陣 (sigilHoly)，聖潔光牆緩緩升起',
      '0.44s 降下直徑 1.5m 黃金聖光巨柱 (BeamCylinder3D)，地面綻放聖光氣浪冠與十字星芒 Flipbook',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('unarmed', hotHex);
      dummies[0].reset(0, 3.8, true);
      dummies[1].reset(-1.35, 4.15, true);
      dummies[2].reset(1.35, 4.15, true);
    },
    keyframes: makeSkyChantKeyframes(0.26, 0.44, 1.95),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('holyGold', paletteOverride);
      const cx = 0, cz = 3.8;

      return [
        { t: 0.04, isPreGather: true, run() {
          const h = fighter.getRightHandWorld();
          sim.spawnStarGlint(h.x, h.y + 0.15, h.z, 0.65, P.hotHex, 0.24, true);
          sim.addLight(h.x, h.y + 0.15, h.z, P.midHex, 3.4, 4.2, 0.26, true);
        }},
        { t: 0.44, run() {
          sim.addCustom(new Sigil3D({
            x: cx, y: 0.025, z: cz, radius: 2.62, duration: 1.15,
            style: 'holy', palette: P.pal, hdr: 1.95, wallHeight: 0.85,
          }));
          sim.addCustom(new Sigil3D({
            x: cx, y: 5.35, z: cz, radius: 2.15, duration: 1.05,
            style: 'holy', palette: P.pal, hdr: 1.95, wallHeight: 0.35,
          }));
          sim.addCustom(new BeamCylinder3D({
            p0: new THREE.Vector3(cx, 5.35, cz),
            p1: new THREE.Vector3(cx, 0.02, cz),
            radius: 0.76, duration: 0.98, palette: P.pal,
            texStyle, defaultTex: 'silk', hdr: 2.35, muzzleRings: true,
          }));
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 2.74, thickness: 0.56, height: 0.86, duration: 0.42,
            palette: P.pal, hdr: 2.25, seed: seed + 181,
          }));
          sim.addLight(cx, 2.2, cz, P.hotHex, 4.4, 9.5, 0.88);
          sim.spawnStarGlint(cx, 1.2, cz, 1.25, '#ffffff', 0.16);

          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbHitBurst', x: cx + Math.cos(a) * 0.75, y: 0.95 + i * 0.35, z: cz + Math.sin(a) * 0.75,
              life: 0.38, size0: 0.95, size1: 1.95, palette: P.pal, hdr: 2.2, delay: i * 0.04,
            });
          }
          for (let s = 0; s < 28; s++) {
            const a = R.range(0, TAU), r = R.range(0.4, 2.1);
            sim.spawnSpark({
              x: cx + Math.cos(a) * r, y: R.range(0.1, 1.2), z: cz + Math.sin(a) * r,
              vx: Math.cos(a) * 1.2, vy: R.range(3.5, 6.8), vz: Math.sin(a) * 1.2,
              life: R.range(0.38, 0.72), size: 0.052, gravity: -1.5, color: P.hotHex,
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz + 0.3, power: 1.6, noPush: false, flashColor: P.hotHex });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // HOLY 2: 神聖六角力場護盾 (3D 蜂巢貼圖球形力場展開 -> 攔截 3 發敵方暗紅魔彈激起球面漣漪!)
  // =========================================================================
  {
    id: 'holy_hex_shield',
    cat: 'defense',
    cls: '聖殿騎士 Paladin',
    title: '神聖六角力場護盾 (受擊球面波紋)',
    codeId: 'p.skill.hex_aegis',
    duration: 2.35,
    releaseTime: 0.18,
    peakTime: 0.78,
    contactTimes: [0.25, 0.78, 1.32],
    targetTeam: 'self',
    selfCentered: true,
    handlesDynamicScale: true,
    hitbox: { kind: 'circle', targetTeam: 'self', cx: 0, cz: 0, radius: 2.0 },
    specNotes: [
      '展開 3D 半球形蜂巢網格力場 (DomeShield3D + hexShield 貼圖) 與騎士架盾氣勁波（無魔法陣）',
      '連續三發敵方猩紅魔彈自遠方飛來撞擊護盾，即時觸發球面擴散衝擊波紋與星芒彈反火花！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageArcane', paletteOverride);
      fighter.setLoadout('sword_shield', hotHex);
      dummies[0].reset(0, 4.6, false);
      dummies[1].reset(0, 0, false);
      dummies[2].reset(0, 0, false);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE, ...SHIELD_GUARD } },
      { t: 0.10, ease: ease.inOutCubic, pose: {
        crouch: 0.24, torsoPitch: 0.14, torsoYaw: -0.22,
        shLPitch: -0.92, shLYaw: 0.42, shLRoll: 0.10, elLPitch: -0.78,
        shRPitch: -0.85, shRYaw: -0.42, elRPitch: -0.55,
      }},
      { t: 0.18, ease: ease.outBack, pose: {
        z: 0.12, crouch: 0.18, torsoPitch: 0.08, torsoYaw: 0.25,
        shLPitch: -1.24, shLYaw: 0.12, shLRoll: 0.10, elLPitch: -0.48,
        shRPitch: -0.75, shRYaw: -0.35, elRPitch: -0.45, capePitch: 0.52,
      }},
      { t: 1.75, ease: ease.inOutSine, pose: {
        z: 0.10, crouch: 0.16, torsoPitch: 0.06, torsoYaw: 0.22,
        shLPitch: -1.15, shLYaw: 0.18, shLRoll: 0.10, elLPitch: -0.58,
        shRPitch: -0.75, shRYaw: -0.35, elRPitch: -0.45,
      }},
      { t: 2.25, ease: ease.inOutCubic, pose: { ...REST_POSE, ...SHIELD_GUARD } },
    ],
    buildEvents(sim, fighter, _dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('mageArcane', paletteOverride);
      const H = resolvePal('holyGold', paletteOverride);
      const E = resolvePal('rogueBlood', null); // Enemy incoming fire stays contrasting crimson!

      let shieldRef = null;
      const radius = 1.48;

      const shots = [
        { t: 0.42, p0: new THREE.Vector3(-1.85, 1.35, 4.6), hitDir: new THREE.Vector3(-0.38, 0.58, 0.72).normalize() },
        { t: 0.78, p0: new THREE.Vector3(1.85, 1.25, 4.6),  hitDir: new THREE.Vector3(0.38, 0.52, 0.76).normalize() },
        { t: 1.14, p0: new THREE.Vector3(0, 2.35, 4.8),     hitDir: new THREE.Vector3(0, 0.74, 0.67).normalize() },
      ];

      const evs = [
        { t: 0.18, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 1.10, width: 0.28, palette: P.pal, hdr: 2.35 });
          spawnMartialStanceGust3D(sim, {
            x: 0, z: 0, radius: 1.65, duration: 1.35, palette: H.pal, hdr: 2.2, _mapped: true,
          });
          shieldRef = new DomeShield3D({
            x: 0, y: 0.0, z: 0, radius, duration: 1.82,
            palette: P.pal, hdr: 2.05, fullSphere: false,
          });
          sim.addCustom(shieldRef);
          sim.addLight(0, 1.2, 0, P.midHex, 4.5, 6.0, 1.75);
        }},
      ];

      shots.forEach((s) => {
        evs.push({
          t: s.t,
          run() {
            const impactPt = s.hitDir.clone().multiplyScalar(radius);
            spawnArcaneOrb(sim, {
              p0: s.p0, p1: impactPt, arcHeight: 0.18, flightTime: 0.26,
              palette: E.pal, orbSize: 0.16, heavy: true, trailFadeTime: 0.18,
              onImpact: () => {
                shieldRef?.triggerHit(s.hitDir);
                sim.spawnStarGlint(impactPt.x, impactPt.y, impactPt.z, 0.78, '#ffffff', 0.14);
                sim.addLight(impactPt.x, impactPt.y, impactPt.z, P.hotHex, 5.8, 5.0, 0.24);
                sim.spawnFlipbook({
                  atlas: 'fbHitBurst', x: impactPt.x, y: impactPt.y, z: impactPt.z,
                  life: 0.28, size0: 0.75, size1: 1.55, palette: P.pal, hdr: 2.25,
                });
                for (let i = 0; i < 16; i++) {
                  const sp = R.range(3.0, 6.5);
                  sim.spawnSpark({
                    x: impactPt.x, y: impactPt.y, z: impactPt.z,
                    vx: s.hitDir.x * sp + R.range(-2.2, 2.2),
                    vy: s.hitDir.y * sp + R.range(-1.5, 2.5),
                    vz: s.hitDir.z * sp + R.range(-1.5, 2.5),
                    life: R.range(0.18, 0.32), size: 0.048, color: i % 2 ? P.hotHex : H.hotHex,
                  });
                }
              },
            });
          },
        });
      });
      return evs;
    },
  },

  // =========================================================================
  // HOLY 3: 熾天使聖羽復甦陣 (八芒治癒聖陣 + 翡翠黃金雙螺旋光帶攀升 + 漂浮立體金羽)
  // =========================================================================
  {
    id: 'holy_seraph_heal',
    cat: 'holy',
    cls: '聖光祭司 Cleric',
    title: '熾天使聖羽復甦陣 (雙螺旋祝福)',
    codeId: 'p.skill.seraph_grace',
    duration: 2.35,
    releaseTime: 0.26,
    peakTime: 0.95,
    contactTimes: [0.32, 0.95, 1.48],
    targetTeam: 'self',
    selfCentered: true,
    handlesDynamicScale: true,
    hitbox: { kind: 'circle', targetTeam: 'self', cx: 0, cz: 0, radius: 3.0 },
    specNotes: [
      '腳下展開八芒聖印法陣，柔美聖光沐浴漏斗與三道翡翠/黃金立體螺旋光帶環繞角色緩緩升空',
      '18 片立體雕琢黃金聖羽與星雲漩渦 Flipbook 隨氣流飄升，呈現神聖治癒儀式感',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('unarmed', hotHex);
      dummies[0].reset(0, 0, false);
      dummies[1].reset(0, 0, false);
      dummies[2].reset(0, 0, false);
    },
    keyframes: makeEmpowerBuffKeyframes(0.14, 0.26, 2.25, 'unarmed'),
    buildEvents(sim, _fighter, _dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const G = resolvePal('windJade', paletteOverride);
      const H = resolvePal('holyGold', paletteOverride);

      return [
        { t: 0.26, run() {
          sim.addCustom(new Sigil3D({
            x: 0, y: 0.025, z: 0, radius: 2.75, duration: 1.75,
            style: 'holy', palette: H.pal, hdr: 1.9, wallHeight: 0.75,
          }));
          sim.addCustom(new VortexFunnel3D({
            x: 0, y: 0.02, z: 0, rBottom: 1.45, rTop: 0.85, height: 3.15,
            duration: 1.55, spinSpeed: 4.5, riseSpeed: 1.8, twist: 1.5,
            palette: G.pal, texStyle, defaultTex: 'silk', hdr: 1.65,
          }));
          sim.spawnFlipbook({
            atlas: 'fbMagicSwirl', x: 0, y: 0.35, z: 0,
            life: 1.25, size0: 1.85, size1: 2.65, palette: H.pal, hdr: 1.85, loopFrames: true,
          });
          sim.addLight(0, 1.6, 0, H.hotHex, 5.8, 7.5, 1.55);

          // 3 Ascending 3D Golden-Emerald Helical Ribbons + Floating 3D Seraph Feathers!
          const ribbons = [0, 1, 2].map((i) => {
            const rb = new RibbonTrail3D({ maxPoints: 30, width: 0.18, palette: i % 2 === 0 ? H.pal : G.pal, hdr: 2.0 });
            sim.root.add(rb.group);
            return rb;
          });

          const featherGroup = new THREE.Group();
          const fGeo = new THREE.OctahedronGeometry(1, 0);
          const fMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(H.hotHex).multiplyScalar(1.85), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
          const feathers = [];
          for (let i = 0; i < 18; i++) {
            const m = new THREE.Mesh(fGeo, fMat);
            m.scale.set(0.05, 0.26, 0.10);
            const a = (i / 18) * TAU, r = R.range(0.65, 2.05);
            const y0 = R.range(0.15, 0.95);
            featherGroup.add(m);
            feathers.push({ m, a, r, y0, vy: R.range(1.1, 1.9) });
          }

          let elapsed = 0;
          sim.addCustom({
            group: featherGroup,
            update(dt) {
              elapsed += dt;
              const fade = 1 - smooth(1.18, 1.58, elapsed);
              if (elapsed < 1.20) {
                ribbons.forEach((rb, idx) => {
                  const ang = elapsed * 5.2 + (idx * TAU) / 3;
                  const rad = lerp(1.65, 0.55, clamp(elapsed / 1.20));
                  const py = 0.15 + elapsed * 2.15;
                  rb.pushPoint(new THREE.Vector3(Math.cos(ang) * rad, py, Math.sin(ang) * rad));
                  rb.update(dt, 0);
                });
              } else {
                ribbons.forEach((rb) => rb.update(dt, 1 / 0.38));
              }
              for (const f of feathers) {
                f.a += dt * 1.4;
                const y = f.y0 + elapsed * f.vy;
                f.m.position.set(Math.cos(f.a) * f.r, y, Math.sin(f.a) * f.r);
                f.m.rotation.set(0.45, f.a, Math.sin(elapsed * 4 + f.a) * 0.35);
              }
              fMat.opacity = fade * 0.9;
            },
            get done() { return elapsed >= 1.60; },
            dispose() {
              ribbons.forEach((rb) => { sim.root.remove(rb.group); rb.dispose(); });
              fGeo.dispose(); fMat.dispose();
            },
          });
        }},
      ];
    },
  },

  // =========================================================================
  // HOLY 4: 武神黃金鬥氣覺醒 (踏地碎石裂隙 -> 沖天黃金鬥氣柱 + 鬥氣火焰與生物電弧 Flipbook)
  // =========================================================================
  {
    id: 'holy_valkyrie_aura',
    cat: 'holy',
    cls: '女武神 Valkyrie',
    title: '武神黃金鬥氣覺醒 (爆氣升騰)',
    codeId: 'w.skill.valkyrie_burst',
    duration: 2.15,
    releaseTime: 0.38,
    peakTime: 0.68,
    contactTimes: [0.38, 0.68, 1.18],
    hitbox: { kind: 'circle', cx: 0, cz: 0, radius: 3.4 },
    specNotes: [
      '壓身蓄力後咆哮爆發，腳底震裂 3.3m 黃金地裂與玄武岩塊，掀開 3.4m 鬥氣氣浪冠',
      '周身燃起沖天黃金鬥氣渦流柱 (VortexFunnel3D)、黃金火焰與全身竄動生物電弧 Flipbook！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      dummies[0].reset(0, 2.55, true);
      dummies[1].reset(-2.25, -1.25, true);
      dummies[2].reset(2.25, -1.25, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.24, ease: ease.inOutCubic, pose: {
        crouch: 0.28, torsoPitch: 0.26, headPitch: 0.22,
        shRPitch: -0.95, shRYaw: 0.45, elRPitch: -0.95,
        shLPitch: -0.95, shLYaw: -0.45, elLPitch: -0.95,
      }},
      { t: 0.38, ease: ease.outExpo, pose: {
        crouch: 0.08, torsoPitch: -0.22, headPitch: -0.32,
        shRPitch: -1.45, shRYaw: -0.85, elRPitch: -0.25,
        shLPitch: -1.45, shLYaw: 0.85, elLPitch: -0.25, capePitch: 0.88,
      }},
      { t: 1.45, ease: ease.inOutSine, pose: {
        crouch: 0.10, torsoPitch: -0.16, headPitch: -0.22,
        shRPitch: -1.35, shRYaw: -0.75, elRPitch: -0.30,
        shLPitch: -1.35, shLYaw: 0.75, elLPitch: -0.30, capePitch: 0.75,
      }},
      { t: 2.05, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('holyGold', paletteOverride);

      return [
        { t: 0.06, isPreGather: true, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 1.35, width: 0.38, palette: P.pal, hdr: 2.55, sparkRate: 36 });
          for (let i = 0; i < 18; i++) {
            const a = (i / 18) * TAU, r = R.range(1.2, 2.2);
            sim.spawnSpark({
              x: Math.cos(a) * r, y: R.range(0.2, 1.4), z: Math.sin(a) * r,
              vx: -Math.cos(a) * r * 3.6, vy: 0.5, vz: -Math.sin(a) * r * 3.6,
              life: 0.26, size: 0.048, color: P.midHex, streakIn: true,
            });
          }
        }},
        { t: 0.38, run() {
          sim.addLight(0, 1.4, 0, P.hotHex, 8.2, 10.0, 1.15);
          sim.spawnStarGlint(0, 1.15, 0, 1.15, '#ffffff', 0.16);
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 2.15, duration: 1.05, palette: P.pal, hdr: 2.25, _mapped: true });
          sim.addCustom(new GroundWave3D({
            x: 0, z: 0, maxRadius: 3.34, thickness: 0.62, height: 0.92, duration: 0.42,
            palette: P.pal, hdr: 2.3, seed: seed + 191,
          }));
          spawnGroundCracks(sim, R, { cx: 0, cz: 0, maxRadius: 3.25, branches: 10, life: 1.15, palette: P.pal, rockCount: 10, rockScale: 1.05 });

          sim.addCustom(new VortexFunnel3D({
            x: 0, y: 0.02, z: 0, rBottom: 0.65, rTop: 1.45, height: 3.35,
            duration: 1.25, spinSpeed: 10.5, riseSpeed: 3.6, twist: 1.8,
            palette: P.pal, texStyle, defaultTex: 'flame', hdr: 2.2,
          }));

          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbFlame', x: Math.cos(a) * 0.55, y: 0.75, z: Math.sin(a) * 0.55,
              vy: 1.65, life: 0.68, size0: 0.85, size1: 1.75, palette: P.pal, hdr: 2.15, loopFrames: true, delay: i * 0.05,
            });
          }
          for (let i = 0; i < 4; i++) {
            sim.spawnFlipbook({
              atlas: 'fbLightning', x: R.range(-0.3, 0.3), y: 1.15, z: R.range(-0.3, 0.3),
              life: 0.45, size0: 1.15, size1: 1.85, palette: P.pal, hdr: 2.2, loopFrames: true, delay: i * 0.14,
            });
          }
          for (let s = 0; s < 22; s++) {
            const a = R.range(0, TAU), r = R.range(0.6, 2.2);
            sim.spawnShard({
              x: Math.cos(a) * r, y: 0.15, z: Math.sin(a) * r,
              vx: Math.cos(a) * 0.4, vy: R.range(1.8, 3.6), vz: Math.sin(a) * 0.4,
              life: R.range(0.65, 1.05), size: R.range(0.07, 0.13), gravity: 1.2, color: P.midHex, hdr: 1.5,
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: d.homeX, dirZ: d.homeZ, power: 1.55, noPush: false, flashColor: P.hotHex });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // SHADOW 1: 虛空黑洞引力坍縮 (純黑事件視界球體 + 傾斜吸積盤 + 牽引碎石 -> 坍縮奇點大爆炸!)
  // =========================================================================
  {
    id: 'shadow_black_hole',
    cat: 'shadow',
    cls: '虛空術士 Voidmancer',
    title: '虛空黑洞：引力吸積與奇點坍縮',
    codeId: 'm.skill.singularity',
    duration: 2.45,
    releaseTime: 0.28,
    peakTime: 0.88,
    contactTimes: [0.45, 0.88, 1.48],
    hitbox: { kind: 'circle', cx: 0, cz: 3.8, radius: 3.6 },
    specNotes: [
      '戰場中央生成純黑 3D 事件視界球體，外圍環繞傾斜發光吸積盤與紫黑銀河漩渦 Flipbook',
      '將周遭碎石與敵人向奇點強力牽引，1.38s 瞬間收縮為一點後引爆虛空超新星 (fbExplosion)！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('voidAbyss', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 5.15, true);
      dummies[1].reset(-1.95, 3.25, true);
      dummies[2].reset(1.95, 3.25, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.16, ease: ease.inOutCubic, pose: {
        crouch: 0.10, torsoPitch: -0.22, headPitch: -0.28,
        shRPitch: -2.20, shRYaw: 0.16, elRPitch: -0.18,
        shLPitch: -2.05, shLYaw: -0.24, elLPitch: -0.22, capePitch: 0.45,
      }},
      { t: 0.28, ease: ease.outExpo, pose: {
        z: 0.14, crouch: 0.18, torsoPitch: 0.22, headPitch: 0.04,
        shRPitch: -1.54, shRYaw: 0.06, elRPitch: -0.06,
        shLPitch: -1.25, shLYaw: -0.45, elLPitch: -0.22, capePitch: 0.68,
      }},
      { t: 1.16, ease: ease.inOutCubic, pose: {
        z: 0.08, crouch: 0.12, torsoPitch: -0.22, headPitch: -0.28,
        shRPitch: -2.28, shRYaw: 0.18, elRPitch: -0.16,
        shLPitch: -2.12, shLYaw: -0.26, elLPitch: -0.20, capePitch: 0.54,
      }},
      { t: 1.38, ease: ease.outExpo, pose: {
        z: 0.20, crouch: 0.24, torsoPitch: 0.30, headPitch: 0.10,
        shRPitch: -1.36, shRYaw: 0.12, elRPitch: -0.06,
        shLPitch: -1.06, shLYaw: -0.58, elLPitch: -0.26, capePitch: 0.78,
      }},
      { t: 2.35, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('voidAbyss', paletteOverride);
      const cx = 0, cy = 1.42, cz = 3.8;

      return [
        { t: 0.05, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.62, P.hotHex, 0.20, true);
        }},
        { t: 0.28, run() {
          const ramp = rampToColors(P.pal, 7);
          const g = new THREE.Group();
          g.position.set(cx, cy, cz);

          // Pitch-black 3D Event Horizon Sphere (NormalBlending so it carves a real dark core!)
          const bhGeo = new THREE.SphereGeometry(0.56, 32, 24);
          const bhMat = new THREE.MeshBasicMaterial({ color: 0x020106 });
          const rimGeo = new THREE.SphereGeometry(0.62, 32, 24);
          const rimMat = new THREE.MeshBasicMaterial({
            color: ramp[5].clone().multiplyScalar(2.1), side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
          });
          const discGeo1 = new THREE.TorusGeometry(1.28, 0.14, 8, 48);
          discGeo1.scale(1, 1, 0.25);
          discGeo1.rotateX(Math.PI * 0.42);
          const discGeo2 = new THREE.TorusGeometry(0.92, 0.06, 8, 40);
          discGeo2.rotateX(-Math.PI * 0.35);
          const discMat = new THREE.MeshBasicMaterial({
            color: ramp[4].clone().multiplyScalar(1.85), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
          });

          const bh = new THREE.Mesh(bhGeo, bhMat);
          const rim = new THREE.Mesh(rimGeo, rimMat);
          const d1 = new THREE.Mesh(discGeo1, discMat);
          const d2 = new THREE.Mesh(discGeo2, discMat);
          g.add(d1, d2, rim, bh);

          let elapsed = 0;
          sim.addCustom({
            group: g,
            update(dt) {
              elapsed += dt;
              const grow = ease.outBack(clamp(elapsed / 0.22), 1.6);
              // Implode sharply to 0 between 0.94..1.10s (t = 1.22..1.38s)!
              const pinch = 1 - ease.inCubic(clamp((elapsed - 0.94) / 0.16));
              g.scale.setScalar(Math.max(0.005, grow * pinch));
              d1.rotation.z += dt * 7.5;
              d2.rotation.y -= dt * 9.5;
            },
            get done() { return elapsed >= 1.10; },
            dispose() { bhGeo.dispose(); rimGeo.dispose(); discGeo1.dispose(); discGeo2.dispose(); bhMat.dispose(); rimMat.dispose(); discMat.dispose(); },
          });

          sim.addCustom(new VortexFunnel3D({
            x: cx, y: 0.04, z: cz, rBottom: 2.35, rTop: 0.42, height: 1.45,
            duration: 1.10, spinSpeed: 9.5, riseSpeed: 3.2, twist: 2.8,
            palette: P.pal, texStyle, defaultTex: 'void', hdr: 1.85,
          }));
          sim.spawnFlipbook({
            atlas: 'fbMagicSwirl', x: cx, y: cy, z: cz,
            life: 1.06, size0: 2.65, size1: 1.25, palette: P.pal, hdr: 2.05, loopFrames: true,
          });

          for (let s = 0; s < 28; s++) {
            const a = (s / 28) * TAU, r = R.range(1.8, 3.1);
            const ox = Math.cos(a) * r, oy = R.range(-1.1, 1.1), oz = Math.sin(a) * r;
            sim.spawnSpark({
              x: cx + ox, y: cy + oy, z: cz + oz,
              vx: -ox * 2.4, vy: -oy * 2.4, vz: -oz * 2.4,
              life: 0.52, size: 0.052, color: P.midHex, streakIn: true, delay: R.range(0, 0.55),
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: cx - d.homeX, dirZ: cz - d.homeZ, power: 1.1, noPush: false, flashColor: P.midHex, shiver: 0.65 });
          }
        }},
        // Stage 3: Supernova Singularity Detonation at 1.38s!
        { t: 1.38, run() {
          sim.addLight(cx, cy, cz, P.hotHex, 8.8, 11.0, 0.48);
          sim.spawnStarGlint(cx, cy, cz, 1.35, '#ffffff', 0.16);
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 3.54, thickness: 0.66, height: 0.98, duration: 0.44,
            palette: P.pal, hdr: 2.35, seed: seed + 201,
          }));
          sim.spawnFlipbook({
            atlas: 'fbExplosion', x: cx, y: cy, z: cz,
            life: 0.64, size0: 1.55, size1: 3.45, palette: P.pal, hdr: 2.3,
          });
          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: cx, y: cy, z: cz,
            life: 0.36, size0: 1.45, size1: 2.95, palette: P.pal, hdr: 2.4,
          });
          for (let s = 0; s < 30; s++) {
            const a = R.range(0, TAU), sp = R.range(3.8, 8.5);
            sim.spawnSpark({
              x: cx, y: cy, z: cz,
              vx: Math.cos(a) * sp, vy: R.range(-2.5, 5.5), vz: Math.sin(a) * sp,
              life: R.range(0.24, 0.48), size: 0.054, stretch: 0.044, color: P.hotHex,
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz + 0.4, power: 1.75, noPush: false, flashColor: P.hotHex });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // SHADOW 2: 猩紅鮮血虹吸掠奪 (雙匕十字血刃裂地無魔法陣 -> 6 道 3D 鮮血螺旋光帶逆流吸回胸口!)
  // =========================================================================
  {
    id: 'shadow_blood_siphon',
    cat: 'shadow',
    cls: '鮮血刺客 Bloodletter',
    title: '猩紅鮮血虹吸掠奪 (雙向生命抽取)',
    codeId: 'r.skill.blood_siphon',
    duration: 2.25,
    releaseTime: 0.24,
    peakTime: 0.68,
    contactTimes: [0.34, 0.68, 1.42],
    hitbox: { kind: 'circle', cx: 0, cz: 3.4, radius: 3.4 },
    specNotes: [
      '0.24s 雙匕交錯真空血刃十字撕裂目標區並劈開裂地血痕與鮮血飛濺 Flipbook (fbLiquid)，無任何法陣干擾',
      '6 道蜿蜒立體鮮血能量管束自三名敵人胸口逆向抽回角色體內，1.36s 角色爆開猩紅血氣強化！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('rogueBlood', paletteOverride);
      fighter.setLoadout('dual_daggers', hotHex);
      dummies[0].reset(0, 3.85, true);
      dummies[1].reset(-1.65, 3.05, true);
      dummies[2].reset(1.65, 3.05, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.14, ease: ease.inOutCubic, pose: {
        crouch: 0.16, torsoPitch: -0.16,
        shRPitch: -1.85, shRYaw: -0.55, elRPitch: -0.25,
        shLPitch: -1.85, shLYaw: 0.55, elLPitch: -0.25,
      }},
      { t: 0.24, ease: ease.outExpo, pose: {
        z: 0.16, crouch: 0.22, torsoPitch: 0.26,
        shRPitch: -1.25, shRYaw: 0.45, elRPitch: -0.08,
        shLPitch: -1.25, shLYaw: -0.45, elLPitch: -0.08, capePitch: 0.68,
      }},
      { t: 1.18, ease: ease.inOutCubic, pose: {
        z: 0.06, crouch: 0.20, torsoPitch: 0.18,
        shRPitch: -0.95, shRYaw: 0.45, elRPitch: -0.85,
        shLPitch: -0.95, shLYaw: -0.45, elLPitch: -0.85,
      }},
      { t: 1.36, ease: ease.outExpo, pose: {
        crouch: 0.08, torsoPitch: -0.24, headPitch: -0.28,
        shRPitch: -1.48, shRYaw: -0.82, elRPitch: -0.22,
        shLPitch: -1.48, shLYaw: 0.82, elLPitch: -0.22, capePitch: 0.82,
      }},
      { t: 2.15, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const P = resolvePal('rogueBlood', paletteOverride);
      const cx = 0, cz = 3.4;

      return [
        { t: 0.06, isPreGather: true, run() {
          const h = fighter.getRightHandWorld();
          sim.spawnStarGlint(h.x, h.y, h.z, 0.58, P.hotHex, 0.16, true);
          attachWeaponBladeTrail3D(sim, fighter, { duration: 1.35, width: 0.28, palette: P.pal, dual: true, hdr: 2.5, sparkRate: 34 });
        }},
        { t: 0.24, run() {
          for (const [idx, tilt] of [[0, -0.58], [1, 0.58]]) {
            sim.addCustom(new SlashArc3D({
              center: [cx, 1.12, cz], radius: 2.15, width: 0.72, thickness: 0.24,
              a0: -1.62, a1: 1.62, tiltZ: tilt,
              sweep: 0.075, hold: 0.065, trail: 0.24,
              palette: P.pal, texStyle, defaultTex: 'blood', hdrBoost: 2.45, seed: seed + 205 + idx,
            }));
          }
          spawnBladeGroundScar3D(sim, {
            x: cx, z: cz, yaw: 0.48, length: 2.75, width: 0.36, duration: 1.25,
            palette: P.pal, zoneKind: 'void', rocks: 5, seed: seed + 209,
          });
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 3.15, thickness: 0.52, height: 0.72, duration: 0.38,
            palette: P.pal, hdr: 2.25, seed: seed + 207,
          }));
          for (const d of dummies) {
            const p = d.chestWorld();
            d.hit({ dirX: 0, dirZ: -0.5, power: 1.1, noPush: true, flashColor: P.hotHex, shiver: 0.55 });
            sim.spawnStatusMark('bleed', d.root.position, 1.25);
            sim.spawnFlipbook({
              atlas: 'fbLiquid', x: p.x, y: p.y, z: p.z,
              life: 0.48, size0: 0.85, size1: 1.75, palette: P.pal, hdr: 2.05,
            });
          }

          // 6 Sinuous 3D Blood Siphon Streams whipping from enemies back to caster chest (0, 1.18, 0.1)!
          const streams = [];
          for (let i = 0; i < 6; i++) {
            const rb = new RibbonTrail3D({ maxPoints: 26, width: 0.16, palette: P.pal, hdr: 2.15 });
            sim.root.add(rb.group);
            streams.push({ rb, tgtIdx: i % 3, sign: i < 3 ? 1 : -1, phase: i * 1.1 });
          }

          let elapsed = 0;
          const flight = 1.08;
          sim.addCustom({
            update(dt) {
              elapsed += dt;
              if (elapsed <= flight) {
                const u = clamp(elapsed / flight);
                const s = Math.sin(u * Math.PI);
                const dst = new THREE.Vector3(0, 1.18, 0.12);
                for (const st of streams) {
                  const src = dummies[st.tgtIdx].chestWorld();
                  const pos = src.clone().lerp(dst, ease.inOutSine(u));
                  pos.x += Math.cos(u * TAU * 1.5 + st.phase) * 0.65 * s * st.sign;
                  pos.y += Math.sin(u * Math.PI) * 0.75 + Math.sin(u * TAU * 1.5 + st.phase) * 0.28 * s;
                  st.rb.pushPoint(pos);
                  st.rb.update(dt, 0);
                }
              } else {
                for (const st of streams) st.rb.update(dt, 1 / 0.25);
              }
            },
            get done() { return elapsed >= flight + 0.28; },
            dispose() { streams.forEach((st) => { sim.root.remove(st.rb.group); st.rb.dispose(); }); },
          });
        }},
        // Stage 3: Caster absorbs blood vitality burst!
        { t: 1.36, run() {
          sim.addLight(0, 1.2, 0, P.hotHex, 6.8, 6.5, 0.45);
          sim.spawnStarGlint(0, 1.2, 0.2, 0.85, '#ffffff', 0.15);
          sim.addCustom(new GroundWave3D({
            x: 0, z: 0, maxRadius: 1.95, thickness: 0.42, height: 0.68, duration: 0.36,
            palette: P.pal, hdr: 2.15, seed: seed + 211,
          }));
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbFlame', x: Math.cos(a) * 0.35, y: 0.95, z: Math.sin(a) * 0.35,
              vy: 1.45, life: 0.52, size0: 0.75, size1: 1.55, palette: P.pal, hdr: 2.1,
            });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // SHADOW 3: 深淵六芒魔爪咒池 (深淵六芒陣 -> 8 根立體暗影彎角魔爪破土向內攫抓 + 冥火黑煙)
  // =========================================================================
  {
    id: 'shadow_abyss_pool',
    cat: 'shadow',
    cls: '深淵巫師 Necromancer',
    title: '深淵六芒魔爪咒池 (破土暗影爪)',
    codeId: 'm.skill.abyss_grasp',
    duration: 2.15,
    releaseTime: 0.44,
    peakTime: 0.78,
    contactTimes: [0.44, 0.78, 1.28],
    hitbox: { kind: 'circle', cx: 0, cz: 3.6, radius: 3.0 },
    specNotes: [
      '地面展開深淵六芒星咒印 (sigilAbyss) 與翻騰黑煙 Flipbook',
      '0.44s 外圍破土刺出 8 根立體多節暗影巨爪向圓心狠狠扣合，燃起紫黑冥火與受擊爆發',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('voidAbyss', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.6, true);
      dummies[1].reset(-1.35, 3.95, true);
      dummies[2].reset(1.35, 3.95, true);
    },
    keyframes: makeSkyChantKeyframes(0.28, 0.44, 2.05),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const P = resolvePal('voidAbyss', paletteOverride);
      const cx = 0, cz = 3.6;

      return [
        { t: 0.05, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.62, P.hotHex, 0.24, true);
          sim.addLight(tip.x, tip.y, tip.z, P.midHex, 3.2, 4.0, 0.26, true);
        }},
        { t: 0.44, run() {
          sim.addCustom(new Sigil3D({
            x: cx, y: 0.025, z: cz, radius: 2.82, duration: 1.30,
            style: 'abyss', palette: P.pal, hdr: 2.0, wallHeight: 0.68,
          }));
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbSmoke', x: cx + Math.cos(a) * 1.1, y: 0.45, z: cz + Math.sin(a) * 1.1,
              vy: 0.55, life: 0.75, size0: 1.05, size1: 2.15, palette: P.pal, hdr: 1.05, opacity: 0.68, additive: false,
            });
          }
          const ramp = rampToColors(P.pal, 7);
          const g = new THREE.Group();
          g.position.set(cx, 0, cz);
          const lowerGeo = new THREE.ConeGeometry(0.22, 1.35, 5);
          lowerGeo.translate(0, 0.65, 0);
          const upperGeo = new THREE.ConeGeometry(0.15, 1.25, 5);
          upperGeo.translate(0, 0.60, 0);
          const clawMat = new THREE.MeshStandardMaterial({
            color: 0x12091f, emissive: ramp[3].clone().multiplyScalar(0.95), roughness: 0.35, metalness: 0.55, flatShading: true, transparent: true,
          });
          const veinMat = new THREE.MeshBasicMaterial({
            color: ramp[5].clone().multiplyScalar(1.85), wireframe: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
          });

          const claws = [];
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            const root = new THREE.Group();
            root.position.set(Math.cos(a) * 2.25, -0.1, Math.sin(a) * 2.25);
            root.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); // Face inward toward center!
            const mLow = new THREE.Mesh(lowerGeo, clawMat);
            const vLow = new THREE.Mesh(lowerGeo, veinMat);
            vLow.scale.setScalar(1.03);
            const joint = new THREE.Group();
            joint.position.set(0, 1.18, 0);
            joint.rotation.x = 0.65;
            const mUp = new THREE.Mesh(upperGeo, clawMat);
            const vUp = new THREE.Mesh(upperGeo, veinMat);
            vUp.scale.setScalar(1.04);
            joint.add(mUp, vUp);
            root.add(mLow, vLow, joint);
            g.add(root);
            claws.push({ root, joint });
          }

          let elapsed = 0;
          const life = 1.15;
          sim.addCustom({
            group: g,
            update(dt) {
              elapsed += dt;
              const u = clamp(elapsed / life);
              const pop = ease.outBack(clamp(u * 5.5), 1.9);
              const clench = smooth(0.12, 0.42, u);
              const sink = 1 - smooth(0.75, 1.0, u);
              for (const c of claws) {
                c.root.scale.set(pop, pop * sink, pop);
                c.root.rotation.x = lerp(-0.18, 0.42, clench);
                c.joint.rotation.x = lerp(0.45, 1.08, clench);
              }
              clawMat.opacity = sink;
              veinMat.opacity = sink * 0.88;
            },
            get done() { return elapsed >= life; },
            dispose() { lowerGeo.dispose(); upperGeo.dispose(); clawMat.dispose(); veinMat.dispose(); },
          });

          for (const [idx, tilt] of [[0, -0.55], [1, 0.55]]) {
            sim.addCustom(new SlashArc3D({
              center: [cx, 1.15, cz], radius: 2.15, width: 0.72, thickness: 0.24,
              a0: -1.65, a1: 1.65, tiltZ: tilt,
              sweep: 0.08, hold: 0.10, trail: 0.28,
              palette: P.pal, texStyle, defaultTex: 'void', hdrBoost: 2.35, seed: seed + 225 + idx,
            }));
          }

          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 2.92, thickness: 0.54, height: 0.78, duration: 0.40,
            palette: P.pal, hdr: 2.15, seed: seed + 221,
          }));
          sim.addLight(cx, 1.4, cz, P.hotHex, 6.5, 8.0, 0.95);

          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbFlame', x: cx + Math.cos(a) * 0.95, y: 0.85, z: cz + Math.sin(a) * 0.95,
              vy: 1.25, life: 0.65, size0: 0.85, size1: 1.65, palette: P.pal, hdr: 2.05, delay: i * 0.04,
            });
          }
          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: cx, y: 1.15, z: cz,
            life: 0.34, size0: 1.15, size1: 2.35, palette: P.pal, hdr: 2.25, delay: 0.14,
          });
          for (const d of dummies) {
            d.hit({ dirX: cx - d.homeX, dirZ: cz - d.homeZ, power: 1.45, noPush: true, flashColor: P.hotHex });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // SHADOW 4 (POISON): 劇毒腐蝕瘴氣沼爆 (拋投毒瓶 -> 毒液皇冠噴濺 fbLiquid + 劇毒沼池與瘴氣雲 fbSmoke)
  // =========================================================================
  {
    id: 'poison_venom_swamp',
    cat: 'shadow',
    cls: '劇毒鍊金師 Alchemist',
    title: '劇毒腐蝕瘴氣沼爆 (毒液飛濺與毒霧)',
    codeId: 'r.skill.venom_mire',
    duration: 2.25,
    releaseTime: 0.24,
    peakTime: 0.78,
    contactTimes: [0.32, 0.78, 1.32],
    hitbox: { kind: 'circle', cx: 0, cz: 3.6, radius: 3.2 },
    specNotes: [
      '高拋劇毒鍊金瓶砸入敵陣，爆開多層翠綠毒液皇冠噴濺 Flipbook (fbLiquid)，無任何魔法陣',
      '地面蔓延腐蝕沸騰毒沼地表、立體冒泡毒球與翻滾濃密毒瘴雲團 Flipbook (fbSmoke)',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('poison', paletteOverride);
      fighter.setLoadout('dual_daggers', hotHex);
      dummies[0].reset(0, 3.6, true);
      dummies[1].reset(-1.45, 3.95, true);
      dummies[2].reset(1.45, 3.95, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.14, ease: ease.inOutCubic, pose: { crouch: 0.14, torsoYaw: -0.38, shRPitch: -0.65, shRYaw: -0.35, elRPitch: -0.65 } },
      { t: 0.24, ease: ease.outExpo, pose: { z: 0.14, crouch: 0.16, torsoPitch: 0.20, torsoYaw: 0.34, shRPitch: -1.65, shRYaw: 0.15, elRPitch: -0.12, capePitch: 0.58 } },
      { t: 2.15, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('poison', paletteOverride);
      const cx = 0, cz = 3.6;

      return [
        { t: 0.24, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.65, width: 0.26, palette: P.pal, dual: true, hdr: 2.35, sparkRate: 24 });
          spawnArcaneOrb(sim, {
            p0: fighter.getRightHandWorld(),
            p1: new THREE.Vector3(cx, 0.15, cz),
            arcHeight: 1.55, flightTime: 0.36, palette: P.pal, orbSize: 0.16, heavy: true, trailFadeTime: 0.20,
            onImpact: () => {
              sim.addLight(cx, 1.0, cz, P.hotHex, 6.2, 8.0, 1.15);
              sim.spawnGroundZone({
                x: cx, z: cz, radius: 2.75, duration: 1.38,
                kind: 'poison', palette: P.pal, emitFlames: false, eruptRocks: false,
              });
              sim.addCustom(new GroundWave3D({
                x: cx, z: cz, maxRadius: 3.12, thickness: 0.56, height: 0.75, duration: 0.42,
                palette: P.pal, hdr: 2.1, seed: seed + 231,
              }));

              // Venom splash flipbooks + thick rolling toxic miasma clouds!
              for (let i = 0; i < 6; i++) {
                const a = (i / 6) * TAU;
                const r = i === 0 ? 0 : 1.05;
                sim.spawnFlipbook({
                  atlas: 'fbLiquid', x: cx + Math.cos(a) * r, y: 0.65, z: cz + Math.sin(a) * r,
                  vy: 1.15, life: 0.58, size0: 1.05, size1: 2.15, palette: P.pal, hdr: 2.05, delay: i * 0.03,
                });
                sim.spawnFlipbook({
                  atlas: 'fbSmoke', x: cx + Math.cos(a) * 1.15, y: 0.85, z: cz + Math.sin(a) * 1.15,
                  vx: Math.cos(a) * 0.65, vy: 0.95, vz: Math.sin(a) * 0.65,
                  life: 1.05, size0: 1.15, size1: 2.45, palette: P.pal, hdr: 1.15, opacity: 0.68, additive: false, delay: 0.08 + i * 0.05,
                });
              }

              // Rising 3D toxic bubbles!
              for (let b = 0; b < 16; b++) {
                const a = R.range(0, TAU), r = R.range(0.2, 2.4);
                sim.spawnPuff({
                  x: cx + Math.cos(a) * r, y: 0.18, z: cz + Math.sin(a) * r,
                  vy: R.range(1.2, 2.4), life: R.range(0.55, 0.95), size0: 0.16, size1: 0.42,
                  color: P.hotHex, alpha: 0.55, additive: true, drag: 0.5, delay: R.range(0, 0.35),
                });
              }
              for (const d of dummies) {
                d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz, power: 1.35, noPush: true, flashColor: P.hotHex, shiver: 0.55 });
              }
            },
          });
        }},
      ];
    },
  },

  // =========================================================================
  // EARTH 2: 泰坦破土連環岩刺 (巨劍砸地 -> 四波由小到大向前推進的熔岩礦晶尖刺與煙塵爆發)
  // =========================================================================
  {
    id: 'earth_titan_spikes',
    cat: 'earth',
    cls: '泰坦重裝兵 Titan',
    title: '泰坦破土：連環岩刺衝擊波',
    codeId: 'w.skill.titan_fissure',
    duration: 2.25,
    releaseTime: 0.38,
    peakTime: 0.88,
    contactTimes: [0.42, 0.88, 1.32],
    hitbox: { kind: 'rect', width: 2.2, length: 5.8 },
    specNotes: [
      '雙手巨劍重劈地面，地殼裂痕沿 5.8m 直線走廊節節推進',
      '連續四波立體多晶簇熔岩巨刺由低到高破土衝出，伴隨爆炎與滾滾岩塵 Flipbook！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('earthMagma', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      dummies[0].reset(0, 2.25, true);
      dummies[1].reset(-0.42, 3.75, true);
      dummies[2].reset(0.42, 5.15, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.26, ease: ease.inOutCubic, pose: {
        crouch: 0.16, torsoPitch: -0.22,
        shRPitch: -2.35, shRYaw: 0.12, elRPitch: -0.10,
        shLPitch: -2.15, shLYaw: -0.22, elLPitch: -0.25,
      }},
      { t: 0.38, ease: ease.inCubic, pose: {
        z: 0.24, crouch: 0.32, torsoPitch: 0.42,
        shRPitch: -1.18, shRYaw: 0.14, elRPitch: -0.05,
        shLPitch: -1.10, shLYaw: -0.18, elLPitch: -0.20, capePitch: 0.78,
      }},
      { t: 1.25, ease: ease.inOutCubic, pose: {
        z: 0.24, crouch: 0.22, torsoPitch: 0.28,
        shRPitch: -1.25, shRYaw: 0.14, elRPitch: -0.12,
      }},
      { t: 2.15, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('earthMagma', paletteOverride);

      const waves = [
        { t: 0.38, z: 1.45, h: 0.95, w: 0.30 },
        { t: 0.50, z: 2.65, h: 1.25, w: 0.34 },
        { t: 0.62, z: 3.90, h: 1.55, w: 0.38 },
        { t: 0.74, z: 5.15, h: 1.92, w: 0.44 },
      ];

      return waves.map((wv, idx) => ({
        t: wv.t,
        run() {
          if (idx === 0) {
            fighter.hitStop = 0.085;
            attachWeaponBladeTrail3D(sim, fighter, { duration: 0.85, width: 0.38, palette: P.pal, hdr: 2.5, sparkRate: 36 });
            spawnBladeGroundScar3D(sim, {
              x: 0, z: 3.1, yaw: 0, length: 3.6, width: 0.38, duration: 1.25,
              palette: P.pal, zoneKind: 'crater', rocks: 0, seed: seed + 249,
            });
          }
          spawnGroundCracks(sim, R, { cx: 0, cz: wv.z, maxRadius: 1.05, branches: 6, life: 0.95, palette: P.pal, rockCount: 6, rockScale: 0.85 + idx * 0.15 });
          sim.addCustom(new GroundWave3D({
            x: 0, z: wv.z, maxRadius: 1.06, thickness: 0.36, height: 0.55 + idx * 0.12, duration: 0.34,
            palette: P.pal, hdr: 2.15, seed: seed + 240 + idx,
          }));
          sim.addLight(0, 1.0, wv.z, P.hotHex, 5.2 + idx * 0.8, 6.0, 0.45);

          for (const side of [-0.42, 0, 0.42]) {
            sim.spawnCrystal({
              x: side + R.range(-0.08, 0.08),
              z: wv.z + R.range(-0.12, 0.12),
              height: wv.h * (side === 0 ? 1.12 : 0.84),
              width: wv.w,
              leanX: side * 0.45,
              leanZ: 0.24,
              delay: side === 0 ? 0 : 0.025,
              hold: 0.68,
              melt: 0.38,
              palette: P.pal,
            });
          }
          sim.spawnFlipbook({
            atlas: 'fbExplosion', x: 0, y: 0.65, z: wv.z,
            vy: 0.85, life: 0.46, size0: 0.75, size1: 1.55 + idx * 0.2, palette: P.pal, hdr: 2.0,
          });
          sim.spawnFlipbook({
            atlas: 'fbSmoke', x: 0, y: 0.75, z: wv.z,
            vy: 1.05, life: 0.68, size0: 0.85, size1: 1.85, palette: P.pal, hdr: 1.0, opacity: 0.65, additive: false,
          });
          for (let s = 0; s < 6; s++) {
            const a = R.range(0, TAU), sp = R.range(2.2, 4.8);
            sim.spawnFireRock({
              x: 0, y: 0.32, z: wv.z,
              vx: Math.cos(a) * sp, vy: R.range(3.6, 6.8), vz: Math.sin(a) * sp,
              size: R.range(0.12, 0.21), life: R.range(0.60, 0.92), palette: P.pal, emitSparks: true,
            });
          }
          for (const d of dummies) {
            if (Math.abs(d.homeZ - wv.z) < 0.85) {
              d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 1.45, noPush: false, flashColor: P.hotHex });
            }
          }
        },
      }));
    },
  },
];
