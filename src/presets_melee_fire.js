import * as THREE from 'three';
import {
  TAU, clamp, lerp, smooth, ease, Rng, PAL3D, rampToColors,
  SlashArc3D, RibbonTrail3D, GroundWave3D, VortexFunnel3D, BeamCylinder3D, Sigil3D,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import {
  resolvePal, makeStaffCastKeyframes, makeSkyChantKeyframes, spawnGroundCracks, spawnArcaneOrb,
  attachWeaponBladeTrail3D, spawnMartialStanceGust3D, spawnBladeGroundScar3D,
  spawnMartialAirCutter3D, spawnMachShockRings3D,
} from './fx_helpers.js';
import { buildMagmaMeteorAssembly } from './mesh_props3d.js';

export const PRESETS_MELEE_FIRE = [
  // =========================================================================
  // MELEE 4: 狂戰雙手旋風斬 (360° 雙層逆傾烈焰刀紋環 + 旋風漏斗 + 刀風/受擊 Flipbook)
  // =========================================================================
  {
    id: 'melee_whirlwind',
    cat: 'melee',
    cls: '狂戰士 Berserker',
    title: '雙手巨劍：烈焰旋風斬',
    codeId: 'w.skill.whirlwind',
    duration: 2.05,
    releaseTime: 0.34,
    peakTime: 0.62,
    contactTimes: [0.34, 0.62, 1.05],
    hitbox: { kind: 'circle', cx: 0, cz: 0, radius: 3.2 },
    specNotes: [
      '前搖壓身聚氣捲起奧術渦流 Flipbook，隨後連續兩圈 350° 逆向傾角立體烈焰刀紋環',
      '中心立體扭轉氣流漏斗 (VortexFunnel3D) 搭配三目標受擊星芒 Flipbook 與飛濺火星',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      dummies[0].reset(0, 2.35, true);
      dummies[1].reset(-2.05, -1.15, true);
      dummies[2].reset(2.05, -1.15, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.26, ease: ease.inOutCubic, pose: {
        crouch: 0.24, torsoPitch: 0.25, torsoYaw: -0.95, yaw: 0,
        shRPitch: -1.52, shRYaw: -0.55, elRPitch: -0.08, wrRYaw: 1.35,
        shLPitch: -1.25, shLYaw: 0.55, elLPitch: -0.45,
      }},
      { t: 0.34, ease: ease.outCubic, pose: {
        crouch: 0.21, torsoPitch: 0.20, torsoYaw: 0.25, yaw: 0.72,
        shRPitch: -1.55, shRYaw: 0.15, elRPitch: -0.04, wrRYaw: 1.35,
        shLPitch: -1.35, shLYaw: 0.35, elLPitch: -0.35, capePitch: 0.78,
      }},
      { t: 0.74, ease: ease.inOutSine, pose: {
        crouch: 0.20, torsoPitch: 0.18, torsoYaw: 0.25, yaw: TAU,
        shRPitch: -1.55, shRYaw: 0.15, elRPitch: -0.04, wrRYaw: 1.35,
        shLPitch: -1.35, shLYaw: 0.35, elLPitch: -0.35, capePitch: 0.82,
      }},
      { t: 1.16, ease: ease.outCubic, pose: {
        crouch: 0.22, torsoPitch: 0.22, torsoYaw: 0.35, yaw: TAU * 2,
        shRPitch: -1.50, shRYaw: 0.38, elRPitch: -0.05, wrRYaw: 1.35,
        shLPitch: -1.30, shLYaw: 0.32, elLPitch: -0.40, capePitch: 0.86,
      }},
      { t: 1.95, ease: ease.inOutCubic, pose: { ...REST_POSE, yaw: TAU * 2 } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('fireInferno', paletteOverride);

      const spinHitAll = (pwr) => {
        fighter.hitStop = 0.045;
        for (const d of dummies) {
          if (!d.root.visible) continue;
          const pos = d.root.position;
          d.hit({ dirX: pos.x, dirZ: pos.z, power: pwr, noPush: true, flashColor: P.hotHex });
          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: pos.x * 0.85, y: 1.12, z: pos.z * 0.85,
            life: 0.28, size0: 0.75, size1: 1.45, palette: P.pal, hdr: 2.1,
          });
          sim.spawnFlipbook({
            atlas: 'fbFlame', x: pos.x, y: 1.05, z: pos.z, vy: 1.1,
            life: 0.38, size0: 0.65, size1: 1.25, palette: P.pal, hdr: 1.85,
          });
          for (let i = 0; i < 10; i++) {
            const a = R.range(0, TAU), sp = R.range(3.0, 6.2);
            sim.spawnSpark({
              x: pos.x * 0.88, y: 1.1, z: pos.z * 0.88,
              vx: Math.cos(a) * sp, vy: R.range(1.2, 4.0), vz: Math.sin(a) * sp,
              life: R.range(0.16, 0.28), size: 0.048, color: P.midHex,
            });
          }
        }
      };

      return [
        // Stage 1: Martial footwork stance gust & blazing greatsword ignition (ZERO magic circles!)
        { t: 0.05, isPreGather: true, run() {
          fighter.pulseBodyAura(P.hotHex, 1.25);
          spawnMartialStanceGust3D(sim, {
            x: 0, z: 0, radius: 1.55, duration: 0.36, palette: P.pal, pebbleCount: 9, windLoops: 3,
          });
          sim.addLight(0, 0.9, 0, P.midHex, 3.5, 4.8, 0.30);
        }},
        // Stage 2: Spin 1 + live blazing greatsword ribbon + central fire-wind funnel
        { t: 0.34, run() {
          attachWeaponBladeTrail3D(sim, fighter, {
            duration: 0.88, fadeTime: 0.18, width: 0.25, palette: P.pal, hdr: 2.55,
          });
          fighter.spawnGhost(sim, { color: P.hotHex, life: 0.24, opacity: 0.32 });
          sim.addCustom(new VortexFunnel3D({
            x: 0, y: 0.02, z: 0, rBottom: 0.85, rTop: 2.35, height: 2.15,
            duration: 0.95, spinSpeed: 10.5, riseSpeed: 2.8, twist: 2.1,
            palette: P.pal, texStyle, defaultTex: 'flame', hdr: 1.85,
          }));
          sim.addCustom(new SlashArc3D({
            center: [0, 1.05, 0], radius: 3.05, width: 1.08, thickness: 0.30,
            a0: -Math.PI * 0.95, a1: Math.PI * 0.95, tiltZ: -0.16, tiltX: 0.08,
            sweep: 0.16, hold: 0.08, trail: 0.24,
            palette: P.pal, texStyle, defaultTex: 'flame', texRepeat: 2.4, hdrBoost: 2.4, seed: seed + 1,
          }));
          sim.addCustom(new GroundWave3D({
            x: 0, z: 0, maxRadius: 3.12, thickness: 0.48, height: 0.55, duration: 0.34,
            palette: P.pal, hdr: 1.95, seed: seed + 2,
          }));
          sim.addLight(0, 1.2, 0, P.hotHex, 5.2, 6.5, 0.45);
        }},
        { t: 0.50, run() { spinHitAll(1.05); } },
        // Stage 3: Spin 2 heavier counter-tilted ring + crossed scorched blade furrows + shockwave
        { t: 0.76, run() {
          fighter.spawnGhost(sim, { color: P.midHex, life: 0.24, opacity: 0.34 });
          sim.addCustom(new SlashArc3D({
            center: [0, 1.12, 0], radius: 3.14, width: 1.24, thickness: 0.34,
            a0: -Math.PI * 0.96, a1: Math.PI * 0.96, tiltZ: 0.18, tiltX: -0.08,
            sweep: 0.16, hold: 0.10, trail: 0.28,
            palette: P.pal, texStyle, defaultTex: 'flame', texRepeat: 2.6, hdrBoost: 2.6, seed: seed + 3,
          }));
          spawnBladeGroundScar3D(sim, R, {
            x: 0, z: 0, yaw: 0.78, length: 3.6, width: 0.38, life: 0.68,
            palette: P.pal, zoneKind: 'burning', sparks: 18, rocks: 6,
          });
          spawnBladeGroundScar3D(sim, R, {
            x: 0, z: 0, yaw: -0.78, length: 3.6, width: 0.36, life: 0.68,
            palette: P.pal, zoneKind: 'burning', sparks: 12, rocks: 4,
          });
          sim.spawnFlipbook({
            atlas: 'fbSlash', x: 0, y: 1.15, z: 1.4,
            life: 0.34, size0: 1.4, size1: 2.2, palette: P.pal, hdr: 1.9,
          });
        }},
        { t: 0.92, run() {
          spinHitAll(1.35);
          sim.addCustom(new GroundWave3D({
            x: 0, z: 0, maxRadius: 3.16, thickness: 0.56, height: 0.72, duration: 0.38,
            palette: P.pal, hdr: 2.15, seed: seed + 4,
          }));
        }},
      ];
    },
  },

  // =========================================================================
  // MELEE 5: 死神巨鐮收割 (深淵法陣聚魂 -> 200° 超寬暗影紋鐮光 -> 靈魂冥火 Flipbook)
  // =========================================================================
  {
    id: 'melee_scythe_reap',
    cat: 'melee',
    cls: '死神收割者 Reaper',
    title: '死神巨鐮：深淵收割斬',
    codeId: 'r.skill.reap',
    duration: 1.85,
    releaseTime: 0.47,
    peakTime: 0.54,
    contactTimes: [0.47, 0.54, 0.88],
    hitbox: { kind: 'sector', radius: 3.8, angleDeg: 200 },
    specNotes: [
      '起手無魔法陣！踏步震開暗影碎石氣浪，巨鐮刀鋒亮起猩紅寒芒並拉出雙層實體鐮刃殘影帶',
      '揮出 3.8m / 200° 三層血月真空破風鐮光，犁開橫向焦黑裂地刀痕溝槽並迸發黑煙與血色打鐵火星',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('voidAbyss', paletteOverride);
      fighter.setLoadout('scythe', hotHex);
      dummies[0].reset(0, 2.95, true);
      dummies[1].reset(-2.25, 2.05, true);
      dummies[2].reset(2.25, 2.05, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.34, ease: ease.inOutCubic, pose: {
        crouch: 0.18, torsoPitch: -0.06, torsoYaw: -0.62,
        shRPitch: -1.62, shRYaw: -0.78, elRPitch: -0.08, wrRYaw: 1.28,
        shLPitch: -1.18, shLYaw: 0.42, elLPitch: -0.45,
      }},
      { t: 0.48, ease: ease.outExpo, pose: {
        z: 0.18, crouch: 0.22, torsoPitch: 0.24, torsoYaw: 0.58,
        shRPitch: -1.46, shRYaw: 0.72, elRPitch: -0.04, wrRYaw: 1.28,
        shLPitch: -1.10, shLYaw: -0.45, elLPitch: -0.35, capePitch: 0.72,
      }},
      { t: 1.15, ease: ease.inOutCubic, pose: {
        z: 0.10, crouch: 0.12, torsoPitch: 0.12, torsoYaw: 0.35,
        shRPitch: -1.35, shRYaw: 0.45, elRPitch: -0.18, wrRYaw: 1.0,
      }},
      { t: 1.76, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('voidAbyss', paletteOverride);
      const B = resolvePal('rogueBlood', paletteOverride);

      return [
        { t: 0.04, isPreGather: true, run() {
          fighter.pulseBodyAura(B.hotHex, 0.95);
          spawnMartialStanceGust3D(sim, {
            x: 0, z: 0, radius: 1.60, duration: 0.42, palette: P.pal, pebbleCount: 10, windLoops: 3,
          });
          sim.addLight(-0.5, 1.1, 0.6, B.hotHex, 3.8, 4.5, 0.32);
        }},
        { t: 0.32, isPreGather: true, run() {
          attachWeaponBladeTrail3D(sim, fighter, {
            duration: 0.40, fadeTime: 0.18, width: 0.26, palette: B.pal, wakePalette: P.pal, hdr: 2.55,
          });
        }},
        { t: 0.47, run() {
          fighter.spawnGhost(sim, { color: B.hotHex, life: 0.28, opacity: 0.38 });
          sim.addCustom(new SlashArc3D({
            center: [0, 1.06, 0], radius: 3.74, width: 1.38, thickness: 0.38,
            a0: -1.68, a1: 1.68, tiltZ: -0.18,
            sweep: 0.075, hold: 0.08, trail: 0.28,
            palette: P.pal, texStyle, defaultTex: 'void', texRepeat: 2.2, hdrBoost: 2.55, seed: seed + 5,
          }));
          sim.addCustom(new SlashArc3D({
            center: [0, 1.10, 0], radius: 2.85, width: 0.78, thickness: 0.24,
            a0: -1.60, a1: 1.60, tiltZ: -0.14,
            sweep: 0.065, hold: 0.06, trail: 0.24,
            palette: B.pal, texStyle, defaultTex: 'flame', texRepeat: 2.0, hdrBoost: 2.35, seed: seed + 6,
          }));
          sim.addCustom(new SlashArc3D({
            center: [0, 1.02, 0], radius: 3.55, width: 1.62, thickness: 0.46,
            a0: -1.64, a1: 1.64, tiltZ: -0.18,
            sweep: 0.082, hold: 0.06, trail: 0.26, delay: 0.018,
            palette: PAL3D.warriorSilver, texStyle, defaultTex: 'wind', texRepeat: 1.8, hdrBoost: 1.48, seed: seed + 7,
          }));
          spawnBladeGroundScar3D(sim, R, {
            x: 0, z: 2.35, yaw: 1.35, length: 3.35, width: 0.45, life: 0.72,
            palette: B.pal, zoneKind: 'void', sparks: 22, rocks: 7,
          });
        }},
        { t: 0.48, run() {
          fighter.hitStop = 0.095;
          sim.addLight(0, 1.3, 2.4, P.hotHex, 5.6, 6.8, 0.35);
          // Rising soul flames along the reaped arc
          for (let i = 0; i < 7; i++) {
            const a = lerp(-1.35, 1.35, i / 6);
            const r = 3.25;
            sim.spawnFlipbook({
              atlas: 'fbFlame', x: Math.sin(a) * r, y: 0.85, z: Math.cos(a) * r,
              vy: 1.35, life: 0.52, size0: 0.72, size1: 1.38,
              palette: P.pal, hdr: 2.0, delay: i * 0.02,
            });
          }
          for (const d of dummies) {
            if (!d.root.visible) continue;
            const pos = d.root.position;
            d.hit({ dirX: pos.x * 0.4, dirZ: 1, power: 1.4, noPush: true, flashColor: P.hotHex });
            sim.spawnFlipbook({
              atlas: 'fbHitBurst', x: pos.x, y: 1.15, z: pos.z - 0.2,
              life: 0.30, size0: 0.85, size1: 1.65, palette: B.pal, hdr: 2.2,
            });
            sim.spawnFlipbook({
              atlas: 'fbSmoke', x: pos.x, y: 1.1, z: pos.z, vy: 1.0,
              life: 0.55, size0: 0.65, size1: 1.45, palette: P.pal, hdr: 1.2, opacity: 0.65, additive: false,
            });
            for (let s = 0; s < 12; s++) {
              const a = R.range(0, TAU), sp = R.range(2.8, 6.0);
              sim.spawnSpark({
                x: pos.x, y: 1.15, z: pos.z,
                vx: Math.cos(a) * sp, vy: R.range(1.0, 4.0), vz: Math.sin(a) * sp,
                life: R.range(0.18, 0.32), size: 0.05, color: s % 2 ? P.midHex : B.midHex,
              });
            }
          }
        }},
      ];
    },
  },

  // =========================================================================
  // MELEE 6: 破甲音爆貫穿刺 (槍尖螺旋聚氣 -> 超音速貫穿光束 + 四重立體音爆環)
  // =========================================================================
  {
    id: 'melee_sonic_thrust',
    cat: 'melee',
    cls: '龍騎槍兵 Dragoon',
    title: '破甲長槍：超音速貫穿刺',
    codeId: 'w.skill.sonic_lance',
    duration: 1.65,
    releaseTime: 0.38,
    peakTime: 0.44,
    contactTimes: [0.38, 0.44, 0.72],
    hitbox: { kind: 'rect', width: 1.6, length: 5.8 },
    specNotes: [
      '槍尖凝聚真空漩渦 Flipbook 與向內收縮氣流絲，突刺瞬間射出 5.6m 立體螺旋槍芒柱 (BeamCylinder3D)',
      '沿突刺軸線依序炸開 4 道立體 3D 音爆圓環與三目標貫穿星芒 Flipbook',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('warriorSilver', paletteOverride);
      fighter.setLoadout('spear', hotHex);
      dummies[0].reset(0, 2.05, true);
      dummies[1].reset(0.18, 3.65, true);
      dummies[2].reset(-0.15, 5.15, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.26, ease: ease.inOutCubic, pose: {
        z: -0.18, crouch: 0.22, torsoPitch: 0.16, torsoYaw: -0.42,
        shRPitch: -1.32, shRYaw: -0.32, elRPitch: -0.68, wrRPitch: -0.15,
        shLPitch: -1.10, shLYaw: 0.45, elLPitch: -0.55,
        hipRPitch: 0.38, kneeRPitch: 0.58, hipLPitch: -0.35, kneeLPitch: 0.52,
      }},
      { t: 0.38, ease: ease.outExpo, pose: {
        z: 0.68, crouch: 0.26, torsoPitch: 0.34, torsoYaw: 0.22,
        shRPitch: -1.62, shRYaw: 0.04, elRPitch: -0.02, wrRPitch: 0.02,
        shLPitch: -0.75, shLYaw: -0.65, elLPitch: -0.25,
        hipRPitch: 0.48, kneeRPitch: 0.72, hipLPitch: -0.48, kneeLPitch: 0.68, capePitch: 0.78,
      }},
      { t: 1.05, ease: ease.inOutCubic, pose: {
        z: 0.48, crouch: 0.16, torsoPitch: 0.18, torsoYaw: 0.15,
        shRPitch: -1.48, shRYaw: 0.06, elRPitch: -0.16,
      }},
      { t: 1.58, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('warriorSilver', paletteOverride);
      const G = resolvePal('windJade', paletteOverride);

      const spawnSonicRing = (zPos, radius, delayT) => ({
        t: delayT,
        run() {
          const geo = new THREE.TorusGeometry(radius, 0.032, 8, 36);
          const ramp = rampToColors(P.pal, 7);
          const mat = new THREE.MeshBasicMaterial({
            color: ramp[5].clone().multiplyScalar(1.85),
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const m = new THREE.Mesh(geo, mat);
          m.position.set(0, 1.12, zPos);
          sim.addCustom({
            mesh: m, life: 0.32, max: 0.32,
            update(dt, k) {
              const s = ease.outExpo(clamp((1 - k) * 5)) * (1.0 + (1 - k) * 0.42);
              m.scale.setScalar(Math.max(0.05, s));
              m.rotation.z += dt * 9;
              mat.opacity = Math.pow(k, 0.9) * 0.9;
            },
            dispose() { geo.dispose(); mat.dispose(); },
          });
        },
      });

      return [
        { t: 0.06, isPreGather: true, run() {
          fighter.pulseBodyAura(G.hotHex, 0.75);
          spawnMartialStanceGust3D(sim, {
            x: 0, z: 0, radius: 1.30, duration: 0.32, palette: G.pal, pebbleCount: 7, windLoops: 2,
          });
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * TAU, r = R.range(0.55, 0.95);
            const ox = Math.cos(a) * r, oy = Math.sin(a) * r * 0.7;
            sim.spawnSpark({
              x: ox, y: 1.12 + oy, z: 1.05 + R.range(-0.3, 0.3),
              vx: -ox * 4.5, vy: -oy * 4.5, vz: 0,
              life: 0.22, size: 0.044, stretch: 0.038, color: G.midHex, streakIn: true,
            });
          }
        }},
        { t: 0.36, run() {
          attachWeaponBladeTrail3D(sim, fighter, {
            duration: 0.26, fadeTime: 0.14, width: 0.20, palette: P.pal, wakePalette: G.pal,
          });
          fighter.spawnGhost(sim, { color: G.hotHex, life: 0.24, opacity: 0.34 });
        }},
        { t: 0.38, run() {
          fighter.hitStop = 0.075;
          spawnMachShockRings3D(sim, {
            p0: new THREE.Vector3(0, 1.12, 0.90),
            p1: new THREE.Vector3(0, 1.12, 5.55),
            ringCount: 5, radius0: 0.32, radius1: 0.86, duration: 0.36, palette: G.pal,
          });
          spawnBladeGroundScar3D(sim, R, {
            x: 0, z: 3.1, yaw: 0, length: 4.5, width: 0.34, life: 0.66,
            palette: P.pal, sparks: 20, rocks: 6,
          });
          sim.addCustom(new BeamCylinder3D({
            p0: new THREE.Vector3(0, 1.12, 0.75),
            p1: new THREE.Vector3(0, 1.12, 5.72),
            radius: 0.26, duration: 0.38, palette: P.pal,
            texStyle, defaultTex: 'silk', hdr: 2.25, muzzleRings: true,
          }));
          sim.addCustom(new VortexFunnel3D({
            x: 0, y: 1.12, z: 0.85, rBottom: 0.14, rTop: 0.68, height: 3.6,
            duration: 0.36, spinSpeed: 14.0, riseSpeed: 4.5, twist: 2.6, leanZ: Math.PI * 0.5,
            palette: G.pal, texStyle, defaultTex: 'silk', hdr: 1.75,
          }));
          sim.addLight(0, 1.2, 3.0, P.hotHex, 5.4, 6.5, 0.32);
        }},
        spawnSonicRing(1.35, 0.52, 0.39),
        spawnSonicRing(2.45, 0.66, 0.41),
        spawnSonicRing(3.75, 0.74, 0.43),
        spawnSonicRing(5.05, 0.62, 0.45),
        { t: 0.42, run() {
          dummies.forEach((d, idx) => {
            if (!d.root.visible) return;
            const pos = d.root.position;
            d.hit({ dirX: 0, dirZ: 1, power: 1.35, noPush: false, flashColor: P.hotHex });
            sim.spawnFlipbook({
              atlas: 'fbHitBurst', x: pos.x, y: 1.12, z: pos.z - 0.15,
              life: 0.28, size0: 0.72, size1: 1.48, palette: P.pal, hdr: 2.2, delay: idx * 0.025,
            });
            for (let s = 0; s < 10; s++) {
              const a = R.range(-0.8, 0.8);
              sim.spawnSpark({
                x: pos.x, y: 1.12, z: pos.z,
                vx: Math.sin(a) * 3.5, vy: R.range(-1.5, 3.2), vz: R.range(3.5, 7.5),
                life: R.range(0.16, 0.28), size: 0.046, stretch: 0.042, color: G.hotHex,
              });
            }
          });
        }},
      ];
    },
  },

  // =========================================================================
  // MELEE 7: 疾風雙刃六連亂舞 (高速多角度貼圖刀弧連斬 -> 雙重十字終結斬)
  // =========================================================================
  {
    id: 'melee_blade_flurry',
    cat: 'melee',
    cls: '影舞刺客 Blade Dancer',
    title: '雙匕快攻：疾風六連亂舞',
    codeId: 'r.skill.blade_flurry',
    duration: 1.95,
    releaseTime: 0.24,
    peakTime: 1.08,
    contactTimes: [0.36, 0.72, 1.08],
    hitbox: { kind: 'sector', radius: 2.8, angleDeg: 120 },
    specNotes: [
      '0.24s–0.80s 連續五道不同傾角立體彎月貼圖刀光高速交錯，每擊迸發刀風撕裂 Flipbook',
      '1.04s 雙匕十字重斬終結，爆開猩紅與翠嵐雙色星芒 Flipbook 並掛流血印記',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('windJade', paletteOverride);
      fighter.setLoadout('dual_daggers', hotHex);
      dummies[0].reset(0, 2.05, true);
      dummies[1].reset(-1.05, 2.25, true);
      dummies[2].reset(1.05, 2.25, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE, crouch: 0.14 } },
      { t: 0.15, ease: ease.inOutCubic, pose: { z: -0.06, crouch: 0.22, torsoPitch: 0.14, torsoYaw: -0.44, shRPitch: -1.42, shRYaw: -0.58, elRPitch: -0.35, shLPitch: -1.15, shLYaw: 0.42 } },
      { t: 0.24, ease: ease.outExpo, pose: { z: 0.18, crouch: 0.20, torsoPitch: 0.22, torsoYaw: 0.38, shRPitch: -1.5, shRYaw: 0.45, elRPitch: -0.08, shLPitch: -1.2, shLYaw: 0.45 } },
      { t: 0.38, ease: ease.outExpo, pose: { z: 0.22, crouch: 0.22, torsoPitch: 0.24, torsoYaw: -0.38, shLPitch: -1.5, shLYaw: -0.45, elLPitch: -0.08, shRPitch: -1.1, shRYaw: -0.45 } },
      { t: 0.52, ease: ease.outExpo, pose: { z: 0.25, crouch: 0.20, torsoPitch: 0.20, torsoYaw: 0.42, shRPitch: -1.55, shRYaw: 0.52, elRPitch: -0.05, shLPitch: -1.15, shLYaw: 0.35 } },
      { t: 0.66, ease: ease.outExpo, pose: { z: 0.28, crouch: 0.22, torsoPitch: 0.24, torsoYaw: -0.42, shLPitch: -1.55, shLYaw: -0.52, elLPitch: -0.05, shRPitch: -1.15, shRYaw: -0.35 } },
      { t: 0.80, ease: ease.outExpo, pose: { z: 0.30, crouch: 0.18, torsoPitch: 0.18, torsoYaw: 0.32, shRPitch: -1.62, shRYaw: 0.42, elRPitch: -0.05 } },
      { t: 0.94, ease: ease.inCubic, pose: { z: 0.24, crouch: 0.26, torsoPitch: -0.08, shRPitch: -1.85, shRYaw: -0.65, shLPitch: -1.85, shLYaw: 0.65 } },
      { t: 1.04, ease: ease.outExpo, pose: { z: 0.42, crouch: 0.28, torsoPitch: 0.36, shRPitch: -1.15, shRYaw: 0.72, elRPitch: -0.06, shLPitch: -1.15, shLYaw: -0.72, elLPitch: -0.06, capePitch: 0.72 } },
      { t: 1.85, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('windJade', paletteOverride);
      const B = resolvePal('rogueBlood', paletteOverride);

      const slashes = [
        { t: 0.24, a0: -0.98, a1: 0.98, tiltZ: -0.32, r: 2.48 },
        { t: 0.38, a0: 0.98, a1: -0.98, tiltZ: 0.38, r: 2.52 },
        { t: 0.52, a0: -1.02, a1: 1.02, tiltZ: 0.62, r: 2.55 },
        { t: 0.66, a0: 1.02, a1: -1.02, tiltZ: -0.58, r: 2.56 },
        { t: 0.80, a0: -0.96, a1: 0.96, tiltZ: -0.15, r: 2.60 },
      ];

      const evs = [
        {
          t: 0.12,
          isPreGather: true,
          run() {
            spawnMartialStanceGust3D(sim, {
              x: 0, z: 0, radius: 1.20, duration: 0.26, palette: P.pal, pebbleCount: 6, windLoops: 2,
            });
            attachWeaponBladeTrail3D(sim, fighter, {
              duration: 1.02, fadeTime: 0.16, width: 0.16, dual: true, palette: P.pal, wakePalette: B.pal,
            });
          },
        },
        ...slashes.map((s, idx) => ({
          t: s.t,
          run() {
            if (idx % 2 === 0) {
              fighter.spawnGhost(sim, { color: P.hotHex, life: 0.16, opacity: 0.26 });
            }
            sim.addCustom(new SlashArc3D({
              center: [0, 1.12, 0.14], radius: s.r, width: 0.66, thickness: 0.20,
              a0: s.a0, a1: s.a1, tiltZ: s.tiltZ,
              sweep: 0.045, hold: 0.025, trail: 0.12,
              palette: P.pal, texStyle, defaultTex: 'silk', hdrBoost: 2.25, seed: seed + 10 + idx,
            }));
            const tgt = dummies[idx % 3];
            tgt.hit({ dirX: idx % 2 ? -0.35 : 0.35, dirZ: 1, power: 0.72, noPush: true, flashColor: P.hotHex });
            sim.spawnFlipbook({
              atlas: 'fbSlash', x: tgt.root.position.x * 0.8, y: 1.15, z: 1.85,
              life: 0.20, size0: 0.75, size1: 1.25, palette: P.pal, hdr: 2.0,
            });
            for (let i = 0; i < 6; i++) {
              const a = R.range(-1, 1), sp = R.range(2.8, 5.5);
              sim.spawnSpark({
                x: tgt.root.position.x * 0.8, y: 1.14, z: 1.85,
                vx: Math.sin(a) * sp, vy: R.range(0.8, 3.2), vz: Math.cos(a) * sp * 0.4,
                life: 0.15, size: 0.042, color: P.midHex,
              });
            }
          },
        })),
      ];

      evs.push({
        t: 1.04,
        run() {
          fighter.hitStop = 0.095;
          fighter.spawnGhost(sim, { color: B.hotHex, life: 0.22, opacity: 0.36 });
          for (const [idx, tilt] of [[0, -0.68], [1, 0.68]]) {
            sim.addCustom(new SlashArc3D({
              center: [0, 1.14, 0.16], radius: 2.60, width: 0.98, thickness: 0.28,
              a0: idx === 0 ? -1.04 : 1.04, a1: idx === 0 ? 1.04 : -1.04, tiltZ: tilt,
              sweep: 0.055, hold: 0.05, trail: 0.20,
              palette: idx === 0 ? P.pal : B.pal, texStyle, defaultTex: 'volt', hdrBoost: 2.6, seed: seed + 25 + idx,
            }));
          }
          spawnBladeGroundScar3D(sim, R, {
            x: 0, z: 1.95, yaw: 0.65, length: 2.25, width: 0.30, life: 0.56,
            palette: P.pal, sparks: 12, rocks: 3,
          });
          spawnBladeGroundScar3D(sim, R, {
            x: 0, z: 1.95, yaw: -0.65, length: 2.25, width: 0.30, life: 0.56,
            palette: B.pal, sparks: 12, rocks: 3,
          });
          sim.addLight(0, 1.25, 1.95, B.hotHex, 5.4, 5.8, 0.28);
          for (const d of dummies) {
            const pos = d.root.position;
            d.hit({ dirX: pos.x * 0.3, dirZ: 1, power: 1.35, noPush: true, flashColor: B.hotHex });
            sim.spawnFlipbook({
              atlas: 'fbHitBurst', x: pos.x, y: 1.16, z: pos.z - 0.18,
              life: 0.30, size0: 0.82, size1: 1.55, palette: B.pal, hdr: 2.25,
            });
            sim.spawnStatusMark('bleed', pos, 0.72);
          }
        },
      });
      return evs;
    },
  },

  // =========================================================================
  // FIRE 1: 豪火球爆裂彈 (杖端聚火 Flipbook -> 拖曳火焰尾流火球 -> 多層蘑菇雲爆炸 Flipbook)
  // =========================================================================
  {
    id: 'fire_fireball',
    cat: 'fire',
    cls: '烈焰法師 Pyromancer',
    title: '豪火球爆裂彈 (Flipbook 蘑菇雲)',
    codeId: 'm.skill.fireball',
    duration: 2.05,
    releaseTime: 0.38,
    peakTime: 0.82,
    contactTimes: [0.38, 0.82, 1.18],
    hitbox: { kind: 'circle', cx: 0, cz: 4.8, radius: 2.6 },
    specNotes: [
      '杖頂凝聚烈焰舌 Flipbook，射出重型火球沿途連續拋出立體火焰尾流',
      '命中爆開多層 16 格爆炸火球 (fbExplosion) + 翻滾濃煙蘑菇雲 (fbSmoke) + 熔岩地裂',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 4.8, true);
      dummies[1].reset(-1.35, 5.15, true);
      dummies[2].reset(1.35, 5.15, true);
    },
    keyframes: makeStaffCastKeyframes(0.24, 0.38, 1.95),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('fireInferno', paletteOverride);
      const target = new THREE.Vector3(0, 1.0, 4.8);

      return [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnFlipbook({
            atlas: 'fbFlame', x: tip.x, y: tip.y, z: tip.z, _mapped: true,
            life: 0.34, size0: 0.55, size1: 1.05, palette: P.pal, hdr: 2.1, loopFrames: true,
          });
          sim.addLight(tip.x, tip.y, tip.z, P.midHex, 3.8, 4.5, 0.34, true);
          for (let i = 0; i < 14; i++) {
            const ox = R.range(-0.6, 0.6), oy = R.range(-0.5, 0.5), oz = R.range(-0.6, 0.6);
            sim.spawnSpark({
              x: tip.x + ox, y: tip.y + oy, z: tip.z + oz, _mapped: true,
              vx: -ox * 4.5, vy: -oy * 4.5, vz: -oz * 4.5,
              life: 0.22, size: 0.046, color: P.midHex, streakIn: true,
            });
          }
        }},
        { t: 0.38, run() {
          spawnArcaneOrb(sim, {
            p0: fighter.getStaffTipWorld(), p1: target, arcHeight: 0.42, flightTime: 0.28,
            palette: P.pal, orbSize: 0.22, spiral: true, heavy: true, trailFadeTime: 0.24,
            flipbookWake: 'fbFlame',
            onImpact: () => {
              const cx = 0, cz = 4.8;
              sim.addLight(cx, 1.4, cz, P.hotHex, 7.2, 8.5, 0.48);
              sim.spawnStarGlint(cx, 1.1, cz, 0.95, '#ffffff', 0.16);
              sim.addCustom(new GroundWave3D({
                x: cx, z: cz, maxRadius: 2.54, thickness: 0.55, height: 0.85, duration: 0.40,
                palette: P.pal, hdr: 2.25, seed: seed + 31,
              }));
              spawnGroundCracks(sim, R, { cx, cz, maxRadius: 2.42, branches: 8, life: 0.85, palette: P.pal, rockCount: 8, rockScale: 0.85 });

              // Primary & secondary 3D volumetric explosion flipbooks + rising dark smoke cap!
              sim.spawnFlipbook({
                atlas: 'fbExplosion', x: cx, y: 1.15, z: cz, vy: 0.85,
                life: 0.62, size0: 1.35, size1: 2.85, palette: P.pal, hdr: 2.15,
              });
              for (let i = 0; i < 4; i++) {
                const a = (i / 4) * TAU + 0.4;
                sim.spawnFlipbook({
                  atlas: 'fbExplosion', x: cx + Math.cos(a) * 0.75, y: 0.75, z: cz + Math.sin(a) * 0.75,
                  vx: Math.cos(a) * 1.2, vy: 1.15, vz: Math.sin(a) * 1.2,
                  life: 0.56, size0: 0.95, size1: 2.05, palette: P.pal, hdr: 1.9, delay: 0.04 * i,
                });
                sim.spawnFlipbook({
                  atlas: 'fbSmoke', x: cx + Math.cos(a) * 0.55, y: 1.35, z: cz + Math.sin(a) * 0.55,
                  vx: Math.cos(a) * 0.6, vy: 1.65, vz: Math.sin(a) * 0.6,
                  life: 0.78, size0: 1.05, size1: 2.35, palette: P.pal, hdr: 1.05, opacity: 0.72, additive: false, delay: 0.08 + i * 0.03,
                });
              }
              for (let rIdx = 0; rIdx < 12; rIdx++) {
                const a = (rIdx / 12) * TAU + R.range(-0.18, 0.18);
                const sp = R.range(2.6, 5.4);
                sim.spawnFireRock({
                  x: cx + Math.cos(a) * 0.35, y: 0.55, z: cz + Math.sin(a) * 0.35,
                  vx: Math.cos(a) * sp, vy: R.range(3.2, 6.2), vz: Math.sin(a) * sp,
                  size: R.range(0.14, 0.24), life: R.range(0.65, 1.05),
                  palette: P.pal, emitSparks: true, emitFlame: rIdx % 4 === 0,
                });
              }
              for (let s = 0; s < 26; s++) {
                const a = R.range(0, TAU), sp = R.range(3.2, 7.0);
                sim.spawnSpark({
                  x: cx, y: 0.85, z: cz,
                  vx: Math.cos(a) * sp, vy: R.range(2.2, 6.4), vz: Math.sin(a) * sp,
                  life: R.range(0.24, 0.45), size: 0.054, stretch: 0.04, color: P.midHex,
                });
              }
              for (const d of dummies) {
                d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz + 0.4, power: 1.5, noPush: false, flashColor: P.hotHex });
              }
            },
          });
        }},
      ];
    },
  },

  // =========================================================================
  // FIRE 2: 紅蓮火龍捲風暴 (雙層魔法陣 -> 3.6m 高雙層扭轉火龍捲漏斗 + 盤旋火舌 Flipbook)
  // =========================================================================
  {
    id: 'fire_tornado',
    cat: 'fire',
    cls: '烈焰法師 Pyromancer',
    title: '紅蓮火龍捲風暴 (立體渦流柱)',
    codeId: 'm.skill.fire_tornado',
    duration: 2.35,
    releaseTime: 0.42,
    peakTime: 0.95,
    contactTimes: [0.42, 0.95, 1.55],
    hitbox: { kind: 'circle', cx: 0, cz: 3.8, radius: 2.8 },
    specNotes: [
      '地面展開紅蓮雙層魔法陣 (Sigil3D)，瞬間拔起 3.6m 高雙層流體雜訊扭轉火龍捲 (VortexFunnel3D)',
      '龍捲外圍環繞多團火焰舌 Flipbook 螺旋攀升，頂端翻湧濃煙雲冠與漫天火星',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.8, true);
      dummies[1].reset(-1.45, 4.15, true);
      dummies[2].reset(1.45, 4.15, true);
    },
    keyframes: makeSkyChantKeyframes(0.26, 0.42, 2.25),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('fireInferno', paletteOverride);
      const cx = 0, cz = 3.8;

      const evs = [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.62, P.hotHex, 0.24, true);
          sim.addLight(tip.x, tip.y, tip.z, P.midHex, 3.2, 4.0, 0.28, true);
        }},
        { t: 0.42, run() {
          sim.addCustom(new Sigil3D({
            x: cx, y: 0.025, z: cz, radius: 2.55, duration: 1.50,
            style: 'arcane', palette: P.pal, hdr: 1.9, wallHeight: 0.65,
          }));
          sim.addCustom(new VortexFunnel3D({
            x: cx, y: 0.02, z: cz, rBottom: 0.52, rTop: 1.68, height: 3.65,
            duration: 1.48, spinSpeed: 9.2, riseSpeed: 2.8, twist: 2.4, leanX: 0.08,
            palette: P.pal, texStyle, defaultTex: 'flame', hdr: 2.1,
          }));
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 2.74, thickness: 0.52, height: 0.68, duration: 0.42,
            palette: P.pal, hdr: 2.0, seed: seed + 41,
          }));
          sim.addLight(cx, 2.0, cz, P.hotHex, 6.5, 8.5, 1.35);

          // Spiraling flame flipbooks & embers climbing up the vortex
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU * 2;
            const h0 = 0.35 + (i / 12) * 1.4;
            const r0 = lerp(0.55, 1.25, i / 12);
            sim.spawnFlipbook({
              atlas: 'fbFlame',
              x: cx + Math.cos(a) * r0, y: h0, z: cz + Math.sin(a) * r0,
              vx: -Math.sin(a) * 2.2, vy: 1.85, vz: Math.cos(a) * 2.2,
              life: 0.68, size0: 0.78, size1: 1.45, palette: P.pal, hdr: 1.95,
              loopFrames: true, delay: i * 0.055,
            });
          }
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbSmoke', x: cx + Math.cos(a) * 0.85, y: 3.1, z: cz + Math.sin(a) * 0.85,
              vy: 0.85, life: 0.85, size0: 1.25, size1: 2.25,
              palette: P.pal, hdr: 1.1, opacity: 0.62, additive: false, delay: 0.22 + i * 0.08,
            });
          }
          for (let s = 0; s < 28; s++) {
            const a = R.range(0, TAU), r = R.range(0.5, 1.6);
            sim.spawnSpark({
              x: cx + Math.cos(a) * r, y: R.range(0.2, 1.8), z: cz + Math.sin(a) * r,
              vx: -Math.sin(a) * 4.5, vy: R.range(3.5, 6.8), vz: Math.cos(a) * 4.5,
              life: R.range(0.45, 0.85), size: 0.05, gravity: 2.5, color: P.midHex, delay: R.range(0, 0.45),
            });
          }
        }},
      ];

      for (const hitT of [0.55, 0.92, 1.28]) {
        evs.push({
          t: hitT,
          run() {
            for (const d of dummies) {
              d.hit({ dirX: cx - d.homeX, dirZ: cz - d.homeZ, power: 0.95, noPush: true, flashColor: P.hotHex, shiver: 0.28 });
            }
          },
        });
      }
      return evs;
    },
  },

  // =========================================================================
  // FIRE 3: 熔岩衝天火柱 (地裂熔岩預警 -> 4.8m 垂直流體光柱 + 基座連環爆炎 Flipbook)
  // =========================================================================
  {
    id: 'fire_pillar',
    cat: 'fire',
    cls: '烈焰法師 Pyromancer',
    title: '熔岩衝天火柱 (垂直能量巨柱)',
    codeId: 'm.skill.hell_pillar',
    duration: 2.05,
    releaseTime: 0.44,
    peakTime: 0.68,
    contactTimes: [0.44, 0.68, 1.18],
    hitbox: { kind: 'circle', cx: 0, cz: 4.0, radius: 2.5 },
    specNotes: [
      '前搖地面浮現深淵咒印與赤紅熔岩裂紋預警，0.44s 噴發 4.8m 高雙層熔岩光柱 (BeamCylinder3D)',
      '柱底環狀炸開 fbExplosion 火球簇，頂端衝起濃煙冠與拋物線墜落熔岩碎石',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('earthMagma', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 4.0, true);
      dummies[1].reset(-1.25, 4.35, true);
      dummies[2].reset(1.25, 4.35, true);
    },
    keyframes: makeSkyChantKeyframes(0.28, 0.44, 1.95),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('earthMagma', paletteOverride);
      const cx = 0, cz = 4.0;

      return [
        { t: 0.05, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.65, P.hotHex, 0.24, true);
          sim.addLight(tip.x, tip.y, tip.z, P.midHex, 3.4, 4.2, 0.28, true);
        }},
        { t: 0.44, run() {
          sim.addCustom(new Sigil3D({
            x: cx, y: 0.025, z: cz, radius: 2.35, duration: 1.15,
            style: 'abyss', palette: P.pal, hdr: 1.95, wallHeight: 0.75,
          }));
          spawnGroundCracks(sim, R, { cx, cz, maxRadius: 2.38, branches: 9, life: 1.10, palette: P.pal, rockCount: 10 });
          sim.addCustom(new BeamCylinder3D({
            p0: new THREE.Vector3(cx, 0.02, cz),
            p1: new THREE.Vector3(cx, 4.85, cz),
            radius: 0.72, duration: 0.98, palette: P.pal,
            texStyle, defaultTex: 'flame', hdr: 2.25, muzzleRings: true,
          }));
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 2.46, thickness: 0.54, height: 0.88, duration: 0.38,
            palette: P.pal, hdr: 2.2, seed: seed + 51,
          }));
          sim.addLight(cx, 2.2, cz, P.hotHex, 4.2, 8.5, 0.90);

          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbExplosion', x: cx + Math.cos(a) * 0.75, y: 0.72, z: cz + Math.sin(a) * 0.75,
              vy: 1.45, life: 0.58, size0: 0.95, size1: 1.95, palette: P.pal, hdr: 2.05, delay: i * 0.025,
            });
          }
          sim.spawnFlipbook({
            atlas: 'fbSmoke', x: cx, y: 3.6, z: cz, vy: 1.2,
            life: 0.85, size0: 1.45, size1: 2.75, palette: P.pal, hdr: 1.1, opacity: 0.7, additive: false, delay: 0.12,
          });
          for (let i = 0; i < 12; i++) {
            const a = R.range(0, TAU), sp = R.range(2.2, 4.8);
            sim.spawnFireRock({
              x: cx + Math.cos(a) * 0.45, y: 0.45, z: cz + Math.sin(a) * 0.45,
              vx: Math.cos(a) * sp, vy: R.range(4.4, 7.8), vz: Math.sin(a) * sp,
              size: R.range(0.14, 0.23), life: R.range(0.68, 1.05), palette: P.pal, emitSparks: true,
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz + 0.3, power: 1.55, noPush: false, flashColor: P.hotHex });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // FIRE 4: 天降隕石毀滅 (地面雙層鎖定法陣 -> 斜向拖尾燃燒巨隕石 -> 3.8m 毀滅衝擊)
  // =========================================================================
  {
    id: 'fire_meteor',
    cat: 'fire',
    cls: '大魔導師 Archmage',
    title: '天降隕石毀滅 (全階段大招)',
    codeId: 'm.skill.meteor',
    duration: 2.45,
    releaseTime: 0.34,
    peakTime: 0.92,
    contactTimes: [0.62, 0.92, 1.42],
    hitbox: { kind: 'circle', cx: 0, cz: 3.8, radius: 3.8 },
    specNotes: [
      '0.34s 展開 3.6m 鎖定星盤，高空降下焊接頂點凹凸裂隙發光 3D 巨隕石與伴飛副隕石群',
      '0.86s 主隕石砸地爆開蘑菇火雲與 18 顆帶火光拖尾、真實地板彈跳的 3D 燃燒飛石！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.8, true);
      dummies[1].reset(-2.05, 4.25, true);
      dummies[2].reset(2.05, 4.25, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.20, ease: ease.inOutCubic, pose: {
        crouch: 0.10, torsoPitch: -0.22, headPitch: -0.32,
        shRPitch: -2.25, shRYaw: 0.18, elRPitch: -0.18,
        shLPitch: -2.10, shLYaw: -0.25, elLPitch: -0.22, capePitch: 0.48,
      }},
      { t: 0.34, ease: ease.outExpo, pose: {
        z: 0.14, crouch: 0.18, torsoPitch: 0.20, headPitch: -0.06,
        shRPitch: -1.58, shRYaw: 0.06, elRPitch: -0.06,
        shLPitch: -1.32, shLYaw: -0.45, elLPitch: -0.22, capePitch: 0.68,
      }},
      { t: 0.68, ease: ease.inOutCubic, pose: {
        z: 0.08, crouch: 0.12, torsoPitch: -0.24, headPitch: -0.30,
        shRPitch: -2.30, shRYaw: 0.16, elRPitch: -0.16,
        shLPitch: -2.15, shLYaw: -0.24, elLPitch: -0.20, capePitch: 0.55,
      }},
      { t: 0.86, ease: ease.outExpo, pose: {
        z: 0.20, crouch: 0.24, torsoPitch: 0.30, headPitch: 0.10,
        shRPitch: -1.38, shRYaw: 0.14, elRPitch: -0.06,
        shLPitch: -1.05, shLYaw: -0.58, elLPitch: -0.28, capePitch: 0.78,
      }},
      { t: 1.48, ease: ease.inOutCubic, pose: {
        z: 0.12, crouch: 0.14, torsoPitch: 0.16,
        shRPitch: -1.42, shRYaw: 0.14, elRPitch: -0.16,
        shLPitch: -0.95, shLYaw: -0.42, elLPitch: -0.28,
      }},
      { t: 2.35, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('fireInferno', paletteOverride);
      const M = resolvePal('earthMagma', paletteOverride);
      const cx = 0, cz = 3.8;

      const launchMeteorBody = (p0, p1, radius, flight, seedOff) => {
        const meteor = buildMagmaMeteorAssembly({ radius, palette: P.pal, seed: seed + seedOff });
        meteor.group.position.copy(p0);
        const wakeRibbon = new RibbonTrail3D({ maxPoints: 22, width: radius * 1.45, palette: P.pal, hdr: 2.0 });
        sim.root.add(wakeRibbon.group);
        let elapsed = 0, wakeTimer = 0;
        sim.addCustom({
          group: meteor.group,
          update(dt) {
            elapsed += dt;
            if (elapsed <= flight) {
              const u = clamp(elapsed / flight);
              meteor.group.position.lerpVectors(p0, p1, ease.inQuad(u));
              meteor.update(dt, u);
              wakeRibbon.pushPoint(meteor.group.position.clone());
              wakeRibbon.update(dt, 0);
              wakeTimer -= dt;
              if (wakeTimer <= 0 && u < 0.94) {
                wakeTimer = 0.045;
                sim.spawnFlipbook({
                  atlas: 'fbFlame', x: meteor.group.position.x, y: meteor.group.position.y, z: meteor.group.position.z,
                  vy: 0.65, life: 0.34, size0: radius * 1.9, size1: radius * 3.0, palette: P.pal, hdr: 1.95,
                });
                sim.spawnSpark({
                  x: meteor.group.position.x + R.range(-0.2, 0.2),
                  y: meteor.group.position.y + R.range(-0.2, 0.2),
                  z: meteor.group.position.z + R.range(-0.2, 0.2),
                  vx: R.range(-2.2, 2.2), vy: R.range(1.5, 3.8), vz: R.range(-2.2, 2.2),
                  life: 0.26, size: 0.056, stretch: 0.04, color: P.hotHex,
                });
              }
            } else {
              meteor.group.visible = false;
              wakeRibbon.update(dt, 1 / 0.24);
            }
          },
          get done() { return elapsed >= flight + 0.26; },
          dispose() {
            sim.root.remove(wakeRibbon.group);
            wakeRibbon.dispose();
            meteor.dispose();
          },
        });
      };

      return [
        { t: 0.05, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.68, P.hotHex, 0.24, true);
          sim.addLight(tip.x, tip.y, tip.z, P.midHex, 3.4, 4.2, 0.26, true);
        }},
        // Stage 2A: Colossal Sculpted 3D Craggy Magma Meteor + Follow-up Escort Meteor!
        { t: 0.34, run() {
          sim.addCustom(new Sigil3D({
            x: cx, y: 0.025, z: cz, radius: 3.45, duration: 1.35,
            style: 'arcane', palette: P.pal, hdr: 1.85, wallHeight: 0.75,
          }));
          launchMeteorBody(new THREE.Vector3(-2.85, 6.2, 0.65), new THREE.Vector3(cx, 0.42, cz), 0.76, 0.52, 11);
        }},
        { t: 0.56, run() {
          launchMeteorBody(new THREE.Vector3(2.35, 5.8, 1.35), new THREE.Vector3(cx + 0.95, 0.32, cz + 0.65), 0.44, 0.50, 37);
        }},
        // Stage 3: Cataclysmic Primary Meteor Impact at 0.86s + 18 Bouncing 3D Fire Rocks!
        { t: 0.86, run() {
          sim.addLight(cx, 1.8, cz, P.hotHex, 5.8, 11.0, 0.65);
          sim.spawnStarGlint(cx, 0.9, cz, 1.25, '#ffffff', 0.18);
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 3.74, thickness: 0.72, height: 1.12, duration: 0.48,
            palette: P.pal, hdr: 2.25, seed: seed + 61,
          }));
          spawnGroundCracks(sim, R, { cx, cz, maxRadius: 3.65, branches: 11, life: 1.15, palette: M.pal, rockCount: 12, rockScale: 1.25 });

          sim.spawnFlipbook({
            atlas: 'fbExplosion', x: cx, y: 1.35, z: cz, vy: 1.1,
            life: 0.78, size0: 1.95, size1: 3.75, palette: P.pal, hdr: 2.15,
          });
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            const r = 1.25;
            sim.spawnFlipbook({
              atlas: 'fbExplosion', x: cx + Math.cos(a) * r, y: 0.85, z: cz + Math.sin(a) * r,
              vx: Math.cos(a) * 1.8, vy: 1.25, vz: Math.sin(a) * 1.8,
              life: 0.68, size0: 1.15, size1: 2.35, palette: M.pal, hdr: 1.95, delay: 0.03 * i,
            });
            sim.spawnFlipbook({
              atlas: 'fbSmoke', x: cx + Math.cos(a) * 0.95, y: 1.75, z: cz + Math.sin(a) * 0.95,
              vx: Math.cos(a) * 0.9, vy: 1.85, vz: Math.sin(a) * 0.9,
              life: 0.95, size0: 1.35, size1: 2.85, palette: M.pal, hdr: 1.15, opacity: 0.75, additive: false, delay: 0.10 + i * 0.04,
            });
          }
          // 18 Solid Craggy 3D Magma Boulders blasting outward, shedding fire sparks & bouncing on the arena floor!
          for (let rIdx = 0; rIdx < 18; rIdx++) {
            const a = (rIdx / 18) * TAU + R.range(-0.14, 0.14);
            const sp = R.range(3.0, 6.8);
            sim.spawnFireRock({
              x: cx + Math.cos(a) * 0.45, y: 0.55, z: cz + Math.sin(a) * 0.45,
              vx: Math.cos(a) * sp, vy: R.range(3.8, 7.6), vz: Math.sin(a) * sp,
              size: R.range(0.18, 0.34), life: R.range(0.85, 1.30),
              palette: P.pal, emitSparks: true, emitFlame: rIdx % 3 === 0,
            });
          }
          for (let s = 0; s < 32; s++) {
            const a = R.range(0, TAU), sp = R.range(3.8, 8.2);
            sim.spawnSpark({
              x: cx, y: 0.6, z: cz,
              vx: Math.cos(a) * sp, vy: R.range(3.0, 7.8), vz: Math.sin(a) * sp,
              life: R.range(0.32, 0.62), size: 0.058, stretch: 0.042, color: P.midHex,
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz + 0.5, power: 1.8, noPush: false, flashColor: P.hotHex });
          }
        }},
        // Escort Meteor secondary impact at 1.06s!
        { t: 1.06, run() {
          sim.spawnFlipbook({
            atlas: 'fbExplosion', x: cx + 0.95, y: 0.85, z: cz + 0.65, vy: 1.0,
            life: 0.55, size0: 1.25, size1: 2.45, palette: P.pal, hdr: 2.05,
          });
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU, sp = R.range(2.4, 4.8);
            sim.spawnFireRock({
              x: cx + 0.95, y: 0.42, z: cz + 0.65,
              vx: Math.cos(a) * sp, vy: R.range(2.8, 5.4), vz: Math.sin(a) * sp,
              size: R.range(0.14, 0.22), life: 0.78, palette: M.pal, emitSparks: true,
            });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // FIRE 5: 紅蓮龍息噴吐 (胸前聚火 -> 水平錐形流體火焰漏斗 + 連續噴射火雲 Flipbook)
  // =========================================================================
  {
    id: 'fire_dragon_breath',
    cat: 'fire',
    cls: '龍血武僧 Dragonkin',
    title: '紅蓮龍息噴吐 (錐形噴流)',
    codeId: 'w.skill.dragon_breath',
    duration: 2.15,
    releaseTime: 0.38,
    peakTime: 0.88,
    contactTimes: [0.38, 0.88, 1.38],
    hitbox: { kind: 'sector', radius: 5.0, angleDeg: 65 },
    specNotes: [
      '雙掌胸前聚攏烈焰核心，向前噴出 4.5m 水平錐形流體渦流管 (VortexFunnel3D)',
      '扇形走廊內連續湧出 16 團由小變大的立體火焰與黑煙 Flipbook，層層灼燒三名目標',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('unarmed', hotHex);
      dummies[0].reset(0, 2.65, true);
      dummies[1].reset(-1.05, 4.05, true);
      dummies[2].reset(1.05, 4.05, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.24, ease: ease.inOutCubic, pose: {
        crouch: 0.16, torsoPitch: -0.18, headPitch: -0.22,
        shRPitch: -1.15, shRYaw: 0.55, elRPitch: -0.85,
        shLPitch: -1.15, shLYaw: -0.55, elLPitch: -0.85,
      }},
      { t: 0.38, ease: ease.outExpo, pose: {
        z: 0.12, crouch: 0.22, torsoPitch: 0.26, headPitch: 0.08,
        shRPitch: -1.48, shRYaw: -0.22, elRPitch: -0.12,
        shLPitch: -1.48, shLYaw: 0.22, elLPitch: -0.12, capePitch: 0.72,
      }},
      { t: 1.45, ease: ease.inOutSine, pose: {
        z: 0.12, crouch: 0.20, torsoPitch: 0.22,
        shRPitch: -1.42, shRYaw: -0.28, elRPitch: -0.16,
        shLPitch: -1.42, shLYaw: 0.28, elLPitch: -0.16, capePitch: 0.65,
      }},
      { t: 2.05, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('fireInferno', paletteOverride);

      const evs = [
        { t: 0.08, isPreGather: true, run() {
          sim.spawnFlipbook({
            atlas: 'fbFlame', x: 0, y: 1.28, z: 0.48,
            life: 0.32, size0: 0.45, size1: 0.95, palette: P.pal, hdr: 2.1, loopFrames: true,
          });
          sim.addLight(0, 1.3, 0.5, P.midHex, 3.8, 4.5, 0.32);
        }},
        { t: 0.38, run() {
          sim.addCustom(new VortexFunnel3D({
            x: 0, y: 1.22, z: 0.52, rBottom: 0.16, rTop: 1.32, height: 4.35,
            duration: 1.18, spinSpeed: 11.5, riseSpeed: 3.8, twist: 2.2, leanZ: Math.PI * 0.49,
            palette: P.pal, texStyle, defaultTex: 'flame', hdr: 2.15,
          }));
          sim.addLight(0, 1.4, 2.6, P.hotHex, 6.2, 7.5, 1.15);

          for (let i = 0; i < 16; i++) {
            const delay = i * 0.048;
            const spreadX = R.range(-0.28, 0.28);
            sim.spawnFlipbook({
              atlas: 'fbFlame', x: spreadX * 0.3, y: 1.20, z: 0.65,
              vx: spreadX * 2.6, vy: R.range(-0.15, 0.55), vz: R.range(6.2, 7.8),
              life: 0.58, size0: 0.48, size1: 1.85, drag: 1.15,
              palette: P.pal, hdr: 2.0, loopFrames: true, delay,
            });
            if (i % 3 === 0) {
              sim.spawnFlipbook({
                atlas: 'fbSmoke', x: spreadX * 0.5, y: 1.25, z: 2.2,
                vx: spreadX * 1.8, vy: 1.1, vz: 3.8,
                life: 0.68, size0: 0.85, size1: 2.05, drag: 1.4,
                palette: P.pal, hdr: 1.0, opacity: 0.58, additive: false, delay: delay + 0.12,
              });
            }
          }
          for (let s = 0; s < 26; s++) {
            sim.spawnSpark({
              x: 0, y: 1.22, z: 0.6,
              vx: R.range(-2.2, 2.2), vy: R.range(-0.5, 2.6), vz: R.range(6.5, 10.5),
              life: R.range(0.32, 0.58), size: 0.048, stretch: 0.042, gravity: 4.5, color: P.midHex, delay: R.range(0, 0.65),
            });
          }
        }},
      ];

      for (const hitT of [0.55, 0.85, 1.15]) {
        evs.push({
          t: hitT,
          run() {
            for (const d of dummies) {
              d.hit({ dirX: d.homeX * 0.3, dirZ: 1, power: 1.0, noPush: true, flashColor: P.hotHex, shiver: 0.25 });
            }
          },
        });
      }
      return evs;
    },
  },
];
