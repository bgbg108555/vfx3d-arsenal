import * as THREE from 'three';
import {
  TAU, clamp, lerp, smooth, ease, Rng, PAL3D,
  SlashArc3D, RibbonTrail3D, GroundWave3D, VortexFunnel3D, ShockSphere3D,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import {
  resolvePal, spawnGroundCracks,
  spawnMartialStanceGust3D, spawnBladeGroundScar3D, spawnMachShockRings3D,
} from './fx_helpers.js';
import { buildArrowAssembly } from './mesh_props3d.js';

// Reusable Archer Bow Stance & Draw Keyframe Builder (Left hand holds bow forward +Z, Right hand draws string!)
export function makeBowShotKeyframes({ drawT = 0.28, looseT = 0.36, skyAim = false, endT = 1.85 } = {}) {
  const aimPitch = skyAim ? -2.05 : -1.52;
  const torsoP = skyAim ? -0.24 : 0.04;
  return [
    { t: 0.00, pose: {
      ...REST_POSE, torsoYaw: -0.52,
      shLPitch: -1.42, shLYaw: 0.48, elLPitch: -0.08,
      shRPitch: -1.25, shRYaw: 0.15, elRPitch: -0.85, bowDraw: 0.08, bowArrow: 1,
    }},
    { t: drawT, ease: ease.inOutCubic, pose: {
      ...REST_POSE, crouch: 0.10, torsoPitch: torsoP, torsoYaw: -0.62, headYaw: 0.58,
      shLPitch: aimPitch, shLYaw: 0.56, elLPitch: -0.04,
      shRPitch: aimPitch + 0.08, shRYaw: -0.35, elRPitch: -1.18, bowDraw: 0.96, bowArrow: 1,
    }},
    { t: looseT, ease: ease.outExpo, pose: {
      ...REST_POSE, crouch: 0.12, torsoPitch: torsoP - 0.06, torsoYaw: -0.62, headYaw: 0.58,
      shLPitch: aimPitch - 0.05, shLYaw: 0.56, elLPitch: -0.04,
      shRPitch: aimPitch - 0.18, shRYaw: -0.62, elRPitch: -0.55, capePitch: 0.52, bowDraw: 0.0, bowArrow: 0,
    }},
    { t: endT * 0.72, ease: ease.inOutCubic, pose: {
      ...REST_POSE, crouch: 0.06, torsoYaw: -0.52,
      shLPitch: -1.45, shLYaw: 0.50, elLPitch: -0.08,
      shRPitch: -1.18, shRYaw: -0.15, elRPitch: -0.75, bowDraw: 0.0, bowArrow: 0,
    }},
    { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE } },
  ];
}

// Launch a 3D Semi-Transparent Spirit Arrow along an exact 3D ballistic/curved trajectory!
export function launch3DArrow(sim, {
  p0, p1, arcHeight = 0.25, sideCurve = 0, flightTime = 0.22,
  palette = PAL3D.windJade, scale = 1.0, heavy = false,
  trailWidth = 0.14, pinHold = 0.0, onImpact = null,
} = {}) {
  const wp0 = sim.mapSkillVec3 ? sim.mapSkillVec3(p0) : p0.clone();
  const wp1 = sim.mapSkillVec3 ? sim.mapSkillVec3(p1) : p1.clone();
  const aoeMul = sim.getAoeScale ? sim.getAoeScale() : 1.0;
  const effSide = sideCurve * aoeMul;

  const arrow = buildArrowAssembly({ palette, scale, heavy });
  arrow.group.position.copy(wp0);
  const trail = new RibbonTrail3D({ maxPoints: 18, width: trailWidth, palette, hdr: 2.1 });
  sim.root.add(trail.group);

  const yAxis = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const prevPos = wp0.clone();
  const dir = new THREE.Vector3(0, 0, 1);
  let t = 0;
  let impacted = false;
  const fadeDur = 0.16;
  const totalDur = flightTime + pinHold + fadeDur;

  const evalPos = (u, out) => {
    out.lerpVectors(wp0, wp1, u);
    const s = Math.sin(u * Math.PI);
    out.y += s * arcHeight;
    out.x += s * effSide;
    return out;
  };

  sim.addCustom({
    group: arrow.group,
    _skipAutoMap: true,
    update(dt) {
      t += dt;
      if (t + 1e-6 < flightTime) {
        const u = clamp(t / flightTime);
        evalPos(u, pos);
        dir.subVectors(pos, prevPos);
        if (dir.lengthSq() > 1e-7) {
          dir.normalize();
          arrow.group.quaternion.setFromUnitVectors(yAxis, dir);
        }
        prevPos.copy(pos);
        arrow.group.position.copy(pos);
        arrow.update(dt);
        trail.pushPoint(pos);
        trail.update(dt, 0);
      } else {
        if (!impacted) {
          impacted = true;
          evalPos(1.0, arrow.group.position);
          if (pinHold <= 0.005) arrow.group.visible = false;
          // Pass skill-space p1 so onImpact spawns map cleanly ONCE!
          onImpact?.(p1.clone());
        }
        if (pinHold > 0.005) {
          const pinElapsed = t - flightTime;
          const a = 1 - smooth(pinHold * 0.55, pinHold + fadeDur * 0.8, pinElapsed);
          arrow.setOpacity(a);
          if (a <= 0.02) arrow.group.visible = false;
        }
        trail.update(dt, 1 / fadeDur);
      }
    },
    get done() { return t >= totalDur; },
    dispose() {
      sim.root.remove(trail.group);
      trail.dispose();
      arrow.dispose();
    },
  });
}

// Helper for Skyward Volley -> Rain of 3D Arrows inside target circle!
function buildArrowRainPreset({
  id, cls, title, codeId, palKey, sigilStyle, arrowCount = 28,
  impactAtlas = 'fbHitBurst', spawnCrystalOnHit = false, extraImpact = null, specNotes,
}) {
  return {
    id, cat: 'bow', cls, title, codeId,
    duration: 2.35, releaseTime: 0.34, peakTime: 1.05, contactTimes: [0.34, 1.05, 1.52],
    hitbox: { kind: 'circle', cx: 0, cz: 4.0, radius: 3.0 },
    specNotes,
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal(palKey, paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 4.0, true);
      dummies[1].reset(-1.45, 3.65, true);
      dummies[2].reset(1.45, 4.35, true);
    },
    keyframes: makeBowShotKeyframes({ drawT: 0.26, looseT: 0.34, skyAim: true, endT: 2.20 }),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal(palKey, paletteOverride);
      const cx = 0, cz = 4.0, maxR = 2.75;
      const evs = [
        // Bow Charge & Skyward Ascent Shot (Sigil-Free Martial Wind Stance + High-Altitude Sonic Cloud-Burst!)
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({
            getAnchor: () => fighter.getBowMuzzleWorld(),
            duration: 0.27, radius: 1.05, palette: P.pal, rate: 140, tiers: 1, noSigil: true,
          });
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.15, duration: 0.45, palette: P.pal, _mapped: true });
        }},
        { t: 0.34, run() {
          const muz = fighter.getBowMuzzleWorld();
          sim.spawnStarGlint(muz.x, muz.y, muz.z, 0.65, P.hotHex, 0.13, true);
          const muzShock = new ShockSphere3D({ x: muz.x, y: muz.y, z: muz.z, r0: 0.12, r1: 0.95, duration: 0.20, palette: P.pal, hdr: 2.2, useRunes: false });
          muzShock._skipAutoMap = true;
          sim.addCustom(muzShock);
          spawnMachShockRings3D(sim, {
            p0: new THREE.Vector3(0, 1.45, 0.45),
            p1: new THREE.Vector3(cx, 5.25, cz - 0.35),
            ringCount: 4, radius0: 0.28, radius1: 0.95, duration: 0.34, palette: P.pal,
          });
          for (let i = 0; i < 5; i++) {
            const sp = (i - 2) * 0.42;
            launch3DArrow(sim, {
              p0: muz, p1: new THREE.Vector3(sp, 5.35, cz + Math.abs(sp) * 0.1),
              arcHeight: 0.35, flightTime: 0.22, palette: P.pal, scale: 1.05, heavy: i === 2,
            });
          }
        }},
        // The burst happens when the ascending arrows reach the sky, not at release.
        { t: 0.56, run() {
          sim.addCustom(new ShockSphere3D({
            x: cx, y: 5.35, z: cz, r0: 0.25, r1: 1.65, duration: 0.42, palette: P.pal, hdr: 1.45, useRunes: false,
          }));
          sim.addCustom(new GroundWave3D({
            x: cx, y: 5.30, z: cz, maxRadius: 2.45, thickness: 0.38, height: 0.42, duration: 0.45, palette: P.pal, hdr: 2.1, seed: seed + 3,
          }));
          sim.spawnFlipbook({
            atlas: 'fbStarburst', x: cx, y: 5.35, z: cz, life: 0.38, size0: 0.65, size1: 1.45, palette: P.pal, hdr: 1.35, opacity: 0.65,
          });
        }},
        // The first descending arrow takes 0.17 s to reach the ground.
        { t: 0.73, run() {
          sim.spawnGroundZone({
            x: cx, z: cz, radius: 2.55, duration: 1.48, kind: 'crater', palette: P.pal, eruptRocks: true,
          });
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 2.82, thickness: 0.42, height: 0.52, duration: 0.42, palette: P.pal, hdr: 2.0, seed: seed + 7,
          }));
        }},
      ];

      // 28+ Staggered Falling 3D Translucent Spirit Arrows raining from the sky sigil!
      for (let i = 0; i < arrowCount; i++) {
        const dropT = 0.56 + (i / arrowCount) * 0.78 + R.range(0, 0.03);
        const a = R.range(0, TAU);
        const rad = Math.sqrt(R.next()) * (maxR - 0.32);
        const tx = cx + Math.cos(a) * rad;
        const tz = cz + Math.sin(a) * rad;
        evs.push({
          t: dropT,
          run() {
            launch3DArrow(sim, {
              p0: new THREE.Vector3(tx - 0.45, 5.35, tz - 0.55),
              p1: new THREE.Vector3(tx, 0.08, tz),
              arcHeight: 0.0, flightTime: 0.17,
              palette: P.pal, scale: 0.96, heavy: i % 6 === 0,
              trailWidth: 0.12, pinHold: 0.28,
              onImpact: (pt) => {
                if (i % 3 === 0) {
                  sim.spawnFlipbook({
                    atlas: impactAtlas, x: pt.x, y: 0.32, z: pt.z,
                    life: 0.26, size0: 0.55, size1: 1.15, palette: P.pal, hdr: 2.1,
                  });
                }
                if (i % 5 === 0) {
                  sim.addCustom(new GroundWave3D({
                    x: pt.x, z: pt.z, maxRadius: Math.min(1.05, 2.95 - rad),
                    thickness: 0.24, height: 0.38, duration: 0.22, palette: P.pal, hdr: 2.0, seed: seed + i,
                  }));
                }
                if (spawnCrystalOnHit && i % 4 === 0 && rad <= maxR - 0.4) {
                  sim.spawnCrystal({ x: pt.x, z: pt.z, height: R.range(0.65, 1.05), width: 0.22, hold: 0.32, melt: 0.24, palette: P.pal });
                }
                sim.spawnNiagaraBurst({
                  x: pt.x, y: 0.10, z: pt.z, count: 10,
                  speed0: 1.8, speed1: 5.2, dirY: 0.85, dirBias: 0.45,
                  drag: 5.5, gravity: 9.5, curl: 2.8,
                  size0: 0.032, size1: 0.010, life0: 0.16, life1: 0.30, palette: P.pal,
                });
                extraImpact?.(sim, pt, P, R, i);
              },
            });
          },
        });
      }

      for (const hitT of [0.78, 1.05, 1.32]) {
        evs.push({
          t: hitT,
          run() {
            sim.addLight(cx, 1.8, cz, P.hotHex, 4.8, 7.5, 0.26);
            for (const d of dummies) {
              d.hit({ dirX: R.range(-0.3, 0.3), dirZ: 1, power: 0.95, noPush: true, flashColor: P.hotHex });
            }
          },
        });
      }
      return evs;
    },
  };
}

export const PRESETS_BOW = [
  // 1. 疾風三連射
  {
    id: 'bow_rapid_combo', cat: 'bow', cls: '遊俠 Ranger',
    title: '疾風三連射：追風三矢', codeId: 'r.bow.combo_1..3',
    duration: 2.05, releaseTime: 0.24, peakTime: 1.18, contactTimes: [0.35, 0.76, 1.18],
    hitbox: { kind: 'rect', width: 1.8, length: 6.0 },
    specNotes: [
      '左手立體反曲神弓搭箭拉弦 (動態弓弦張力)，連續射出三發半透明翠嵐靈矢',
      '第 3 矢附帶螺旋破風錐與 Niagara 旋流微粒，命中爆開十字星芒與擊退氣浪',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('windJade', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 4.4, true);
      dummies[1].reset(0, 0, false);
      dummies[2].reset(0, 0, false);
    },
    keyframes: [
      ...makeBowShotKeyframes({ drawT: 0.18, looseT: 0.24, endT: 0.62 }).slice(0, 3),
      { t: 0.56, ease: ease.inOutCubic, pose: { ...REST_POSE, torsoYaw: -0.62, shLPitch: -1.52, shLYaw: 0.56, shRPitch: -1.44, shRYaw: -0.35, elRPitch: -1.18, bowDraw: 0.92, bowArrow: 1 } },
      { t: 0.64, ease: ease.outExpo, pose: { ...REST_POSE, torsoYaw: -0.62, shLPitch: -1.56, shLYaw: 0.56, shRPitch: -1.68, shRYaw: -0.62, elRPitch: -0.55, bowDraw: 0, bowArrow: 0 } },
      { t: 0.96, ease: ease.inOutCubic, pose: { ...REST_POSE, crouch: 0.14, torsoYaw: -0.64, shLPitch: -1.52, shLYaw: 0.56, shRPitch: -1.44, shRYaw: -0.38, elRPitch: -1.22, bowDraw: 1.0, bowArrow: 1 } },
      { t: 1.06, ease: ease.outExpo, pose: { ...REST_POSE, crouch: 0.16, torsoYaw: -0.64, shLPitch: -1.58, shLYaw: 0.56, shRPitch: -1.72, shRYaw: -0.68, elRPitch: -0.50, bowDraw: 0, bowArrow: 0 } },
      { t: 1.98, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, _seed, paletteOverride) {
      const P = resolvePal('windJade', paletteOverride);
      const d0 = dummies[0];
      return [0.24, 0.64, 1.06].map((shotT, idx) => ({
        t: shotT,
        run() {
          const muz = fighter.getBowMuzzleWorld();
          const heavy = idx === 2;
          sim.spawnStarGlint(muz.x, muz.y, muz.z, heavy ? 0.65 : 0.42, P.hotHex, 0.11, true);
          if (heavy) {
            spawnMachShockRings3D(sim, {
              p0: new THREE.Vector3(0, 1.32, 0.55), p1: new THREE.Vector3(0, 1.15, 4.3),
              ringCount: 4, radius0: 0.22, radius1: 0.72, duration: 0.28, palette: P.pal,
            });
          }
          launch3DArrow(sim, {
            p0: muz, p1: d0.chestWorld(), arcHeight: 0.06, sideCurve: idx === 1 ? 0.18 : idx === 0 ? -0.14 : 0,
            flightTime: heavy ? 0.13 : 0.16, palette: P.pal, scale: heavy ? 1.25 : 1.0, heavy,
            trailWidth: heavy ? 0.22 : 0.13,
            onImpact: (pt) => {
              d0.hit({ dirX: 0, dirZ: 1, power: heavy ? 1.45 : 0.85, noPush: !heavy, flashColor: P.hotHex });
              sim.spawnFlipbook({ atlas: 'fbHitBurst', x: pt.x, y: pt.y, z: pt.z - 0.15, life: 0.26, size0: heavy ? 0.85 : 0.58, size1: heavy ? 1.65 : 1.15, palette: P.pal, hdr: 2.2 });
              sim.spawnNiagaraBurst({ x: pt.x, y: pt.y, z: pt.z, count: heavy ? 42 : 20, speed0: 2.5, speed1: 7.5, drag: 5.5, curl: 3.5, life0: 0.18, life1: 0.38, palette: P.pal });
              if (heavy) sim.addCustom(new ShockSphere3D({ x: pt.x, y: pt.y, z: pt.z, r0: 0.15, r1: 1.45, duration: 0.26, palette: P.pal, hdr: 2.2, useRunes: false }));
            },
          });
        },
      }));
    },
  },

  // 2. 扇形多重排射
  {
    id: 'bow_multishot_fan', cat: 'bow', cls: '神射手 Sniper',
    title: '扇形多重排射：七星散華矢', codeId: 'r.bow.multishot',
    duration: 1.85, releaseTime: 0.36, peakTime: 0.52, contactTimes: [0.36, 0.52, 0.78],
    hitbox: { kind: 'sector', radius: 5.2, angleDeg: 85 },
    specNotes: [
      '弓弦蓄聚星界風壓後一次齊射 9 支半透明星芒靈矢，呈 85° 扇形橫掃全場',
      '弓口爆開新月氣浪弧與 Niagara 旋流星塵，命中三目標同步炸開星芒衝擊',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageArcane', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 4.2, true);
      dummies[1].reset(-1.85, 3.85, true);
      dummies[2].reset(1.85, 3.85, true);
    },
    keyframes: makeBowShotKeyframes({ drawT: 0.28, looseT: 0.36, endT: 1.75 }),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const P = resolvePal('mageArcane', paletteOverride);
      return [
        { t: 0.04, isPreGather: true, run() {
          sim.spawnChargeGather({ getAnchor: () => fighter.getBowMuzzleWorld(), duration: 0.30, radius: 1.15, palette: P.pal, rate: 160, tiers: 1, noSigil: true });
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.2, duration: 0.45, palette: P.pal, _mapped: true });
        } },
        { t: 0.36, run() {
          const muz = fighter.getBowMuzzleWorld();
          const fanArc = new SlashArc3D({
            center: [0, 1.18, 0.35], radius: 1.85, width: 0.55, thickness: 0.18,
            a0: -0.75, a1: 0.75, sweep: 0.05, hold: 0.04, trail: 0.14,
            palette: P.pal, texStyle, defaultTex: 'silk', hdrBoost: 2.3, seed: seed + 5,
          });
          fanArc._skipAutoMap = true;
          sim.addCustom(fanArc);
          const n = 9;
          for (let i = 0; i < n; i++) {
            const ang = ((i / (n - 1)) - 0.5) * 1.32;
            const endPt = new THREE.Vector3(Math.sin(ang) * 4.85, 1.12, Math.cos(ang) * 4.85);
            launch3DArrow(sim, {
              p0: muz, p1: endPt, arcHeight: 0.05, flightTime: 0.18,
              palette: P.pal, scale: 1.0, heavy: i === 4, trailWidth: 0.13,
              onImpact: (pt) => {
                sim.spawnFlipbook({ atlas: 'fbStarburst', x: pt.x, y: pt.y, z: pt.z, life: 0.24, size0: 0.48, size1: 0.98, palette: P.pal, hdr: 2.15 });
              },
            });
          }
        }},
        { t: 0.51, run() {
          for (const d of dummies) {
            const c = d.chestWorld();
            d.hit({ dirX: d.homeX * 0.3, dirZ: 1, power: 1.25, noPush: false, flashColor: P.hotHex });
            sim.spawnFlipbook({ atlas: 'fbHitBurst', x: c.x, y: c.y, z: c.z - 0.15, life: 0.28, size0: 0.75, size1: 1.5, palette: P.pal, hdr: 2.25 });
            sim.spawnNiagaraBurst({ x: c.x, y: c.y, z: c.z, count: 28, speed0: 2.2, speed1: 6.5, drag: 5.2, curl: 3.4, life0: 0.18, life1: 0.36, palette: P.pal });
          }
        }},
      ];
    },
  },

  // 3–7: Five Distinct AAA Arrow Rain (箭雨) Spectacles! (Sigil-Free Sonic Cloud-Burst Choreography!)
  buildArrowRainPreset({
    id: 'bow_arrow_rain', cls: '精靈遊俠 Windrunner',
    title: '漫天箭雨：蒼穹百羽箭幕', codeId: 'r.bow.arrow_rain',
    palKey: 'windJade', sigilStyle: 'nature', arrowCount: 32, impactAtlas: 'fbHitBurst',
    specNotes: [
      '仰角拉滿神弓向天齊射五支穿雲響箭，貫穿音障環於高空炸開無陣紋氣爆雲團',
      '32 支半透明翡翠箭矢自天幕密集傾瀉釘入地面，激起層層風壓波紋與碎石旋流',
    ],
  }),
  buildArrowRainPreset({
    id: 'bow_fire_arrow_rain', cls: '烈焰射手 Pyrobow',
    title: '紅蓮火雨箭：流星炎矢轟炸', codeId: 'r.bow.fire_rain',
    palKey: 'fireInferno', sigilStyle: 'war', arrowCount: 28, impactAtlas: 'fbExplosion',
    extraImpact(sim, pt, P, R, idx) {
      if (idx % 6 === 0) {
        sim.spawnFireRock({ x: pt.x, y: 0.12, z: pt.z, vx: R.range(-2.2, 2.2), vy: R.range(2.2, 4.2), vz: R.range(-2.2, 2.2), size: 0.13, life: 0.45, palette: P.pal });
      }
    },
    specNotes: [
      '對空射出紅蓮信號火矢於高空引爆烈焰雲爆，28 支燃燒炎矢如流星雨轟炸 3.0m 區域',
      '落地連環引爆 Houdini 級蘑菇火雲 Flipbook、彈跳熔岩火石與餘燼微粒',
    ],
  }),
  buildArrowRainPreset({
    id: 'bow_frost_arrow_rain', cls: '極寒獵手 Frostbow',
    title: '極寒冰晶箭雨：永凍天降冰矢', codeId: 'r.bow.frost_rain',
    palKey: 'mageFrost', sigilStyle: 'arcane', arrowCount: 28, impactAtlas: 'fbHitBurst', spawnCrystalOnHit: true,
    specNotes: [
      '對空擊碎極寒氣爆雲團，傾瀉 28 支半透明極光冰晶箭矢',
      '冰矢釘地瞬間折射破土長出半透明多面體冰晶簇，附帶寒霧旋流微粒',
    ],
  }),
  buildArrowRainPreset({
    id: 'bow_poison_arrow_rain', cls: '萬蠱獵人 Venomshot',
    title: '劇毒蝕骨箭雨：萬蠱瘴氣箭幕', codeId: 'r.bow.poison_rain',
    palKey: 'poison', sigilStyle: 'abyss', arrowCount: 26, impactAtlas: 'fbPoison',
    specNotes: [
      '高空爆裂毒囊響箭降下 26 支幽綠蝕骨毒矢，釘入地面爆開 AI 劇毒骷髏瘴氣雲 (fbPoison)',
      '地面持續翻湧冒泡毒霧與上升腐蝕孢子微粒，令範圍內目標陷入中毒減益',
    ],
  }),

  // 8. 後空翻脫身射擊
  {
    id: 'bow_backflip_shot', cat: 'bow', cls: '影襲遊俠 Trickshot',
    title: '後空翻脫身射擊：飛燕迴旋毒矢', codeId: 'r.bow.vault_shot',
    duration: 1.85, releaseTime: 0.12, releaseIsTakeoff: true, peakTime: 0.48, contactTimes: [0.40, 0.56, 0.78],
    hitbox: { kind: 'sector', radius: 4.5, angleDeg: 70 },
    specNotes: [
      '腳踏毒煙爆氣向後高躍滯空，於空中拉滿神弓向下連射三發劇毒釘刺矢拉開距離',
      '命中目標爆開毒液皇冠飛濺 (fbLiquid) 與劇毒骷髏雲 (fbPoison)',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('poison', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 2.6, true);
      dummies[1].reset(-1.1, 3.1, true);
      dummies[2].reset(1.1, 3.1, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE, z: 0, crouch: 0.18 } },
      { t: 0.12, ease: ease.inCubic, pose: { ...REST_POSE, y: 0, z: 0, crouch: 0.30, torsoPitch: 0.22, torsoYaw: -0.45, shLPitch: -1.05, shRPitch: -0.95, bowDraw: 0.25, bowArrow: 1 } },
      { t: 0.32, ease: ease.outCubic, pose: {
        ...REST_POSE, y: 1.25, z: -0.55, torsoPitch: 0.25, torsoYaw: -0.58,
        shLPitch: -1.22, shLYaw: 0.52, shRPitch: -1.18, shRYaw: -0.35, elRPitch: -1.18, bowDraw: 0.96, bowArrow: 1,
        hipRPitch: -0.55, kneeRPitch: 0.85, hipLPitch: 0.35, kneeLPitch: 0.75,
      }},
      { t: 0.40, ease: ease.outExpo, pose: {
        ...REST_POSE, y: 1.05, z: -0.85, torsoPitch: 0.18, torsoYaw: -0.58,
        shLPitch: -1.28, shLYaw: 0.52, shRPitch: -1.45, shRYaw: -0.62, elRPitch: -0.55, bowDraw: 0, bowArrow: 0,
      }},
      { t: 0.76, ease: ease.inCubic, pose: { ...REST_POSE, y: 0, z: -1.35, crouch: 0.24 } },
      { t: 1.75, ease: ease.inOutCubic, pose: { ...REST_POSE, z: -1.35 } },
    ],
    buildEvents(sim, fighter, dummies, _seed, paletteOverride) {
      const P = resolvePal('poison', paletteOverride);
      return [
        { t: 0.12, run() {
          sim.spawnFlipbook({ atlas: 'fbSmoke', x: 0, y: 0.55, z: 0, vy: 0.9, life: 0.55, size0: 0.75, size1: 1.75, palette: P.pal, hdr: 1.4 });
          sim.addCustom(new GroundWave3D({ x: 0, z: 0, maxRadius: 1.45, thickness: 0.32, height: 0.48, duration: 0.28, palette: P.pal }));
        }},
        { t: 0.40, run() {
          const muz = fighter.getBowMuzzleWorld();
          dummies.forEach((d, idx) => {
            launch3DArrow(sim, {
              p0: muz, p1: d.chestWorld(), arcHeight: 0.08, flightTime: 0.16, palette: P.pal, scale: 1.05, heavy: idx === 0,
              onImpact: (pt) => {
                d.hit({ dirX: d.homeX * 0.2, dirZ: 1, power: 1.15, noPush: true, flashColor: P.hotHex });
                sim.spawnFlipbook({ atlas: 'fbPoison', x: pt.x, y: pt.y + 0.25, z: pt.z, vy: 0.55, life: 0.58, size0: 0.68, size1: 1.45, palette: P.pal, hdr: 2.0 });
                sim.spawnFlipbook({ atlas: 'fbLiquid', x: pt.x, y: pt.y, z: pt.z - 0.1, life: 0.32, size0: 0.55, size1: 1.2, palette: P.pal, hdr: 1.9 });
              },
            });
          });
        }},
      ];
    },
  },

  // 9. 追蹤魔導箭群
  {
    id: 'bow_homing_arcane', cat: 'bow', cls: '星界魔弓 Arcane Archer',
    title: '追蹤魔導箭群：星軌十連追魂矢', codeId: 'r.bow.arcane_seeker',
    duration: 2.05, releaseTime: 0.36, peakTime: 0.68, contactTimes: [0.36, 0.68, 0.98],
    hitbox: { kind: 'circle', cx: 0, cz: 4.1, radius: 2.6 },
    specNotes: [
      '弓前展開奧術星盤同時分裂出 10 支大弧度立體曲線追蹤魔導箭，從左右高空包抄敵群',
      '每支魔導箭拖曳封閉管狀星軌光帶與 Niagara 閃爍微粒，匯聚轟炸目標',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageViolet', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 4.1, true);
      dummies[1].reset(-1.25, 4.35, true);
      dummies[2].reset(1.25, 4.35, true);
    },
    keyframes: makeBowShotKeyframes({ drawT: 0.28, looseT: 0.36, endT: 1.95 }),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('mageViolet', paletteOverride);
      const evs = [
        { t: 0.06, isPreGather: true, run() {
          sim.spawnChargeGather({ getAnchor: () => fighter.getBowMuzzleWorld(), duration: 0.28, radius: 1.1, palette: P.pal, rate: 150, tiers: 1, noSigil: true });
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.15, duration: 0.45, palette: P.pal, _mapped: true });
        } },
      ];
      for (let i = 0; i < 10; i++) {
        evs.push({
          t: 0.36 + i * 0.035,
          run() {
            const muz = fighter.getBowMuzzleWorld();
            const tgt = dummies[i % 3];
            const side = (i % 2 === 0 ? 1 : -1) * R.range(0.85, 1.95);
            launch3DArrow(sim, {
              p0: muz, p1: tgt.chestWorld(),
              arcHeight: R.range(0.55, 1.45), sideCurve: side, flightTime: 0.34,
              palette: P.pal, scale: 0.95, trailWidth: 0.14,
              onImpact: (pt) => {
                tgt.hit({ dirX: -side * 0.2, dirZ: 1, power: 0.85, noPush: true, flashColor: P.hotHex });
                sim.spawnFlipbook({ atlas: 'fbStarburst', x: pt.x, y: pt.y, z: pt.z, life: 0.26, size0: 0.58, size1: 1.25, palette: P.pal, hdr: 2.2 });
              },
            });
          },
        });
      }
      return evs;
    },
  },

  // 10. 暴風龍捲箭
  {
    id: 'bow_tornado_shot', cat: 'bow', cls: '暴風神射 Stormbow',
    title: '暴風龍捲箭：翠嵐裂空旋風矢', codeId: 'r.bow.tornado_shot',
    duration: 2.25, releaseTime: 0.36, peakTime: 0.85, contactTimes: [0.38, 0.85, 1.35],
    hitbox: { kind: 'circle', cx: 0, cz: 4.0, radius: 2.8 },
    specNotes: [
      '射出重型破空螺旋巨矢，命中敵陣中心瞬間捲起高達 3.4m 的雙層立體翠嵐龍捲風暴',
      '超過 120 顆 Niagara 旋流微粒沿圓柱切線高速盤旋吸聚，撕裂範圍內所有目標',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('windJade', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 4.0, true);
      dummies[1].reset(-1.35, 3.85, true);
      dummies[2].reset(1.35, 3.85, true);
    },
    keyframes: makeBowShotKeyframes({ drawT: 0.28, looseT: 0.36, endT: 2.15 }),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const P = resolvePal('windJade', paletteOverride);
      return [
        { t: 0.05, isPreGather: true, run() {
          sim.spawnChargeGather({ getAnchor: () => fighter.getBowMuzzleWorld(), duration: 0.29, radius: 1.2, palette: P.pal, rate: 170, tiers: 1, noSigil: true });
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.18, duration: 0.45, palette: P.pal, _mapped: true });
        } },
        { t: 0.36, run() {
          spawnMachShockRings3D(sim, {
            p0: new THREE.Vector3(0, 1.32, 0.55), p1: new THREE.Vector3(0, 1.0, 4.0),
            ringCount: 4, radius0: 0.26, radius1: 0.85, duration: 0.32, palette: P.pal,
          });
          launch3DArrow(sim, {
            p0: fighter.getBowMuzzleWorld(), p1: new THREE.Vector3(0, 1.0, 4.0),
            arcHeight: 0.05, flightTime: 0.16, palette: P.pal, scale: 1.4, heavy: true, trailWidth: 0.24,
            onImpact: () => {
              sim.addCustom(new VortexFunnel3D({
                x: 0, y: 0, z: 4.0, rBottom: 0.55, rTop: 1.85, height: 3.4,
                duration: 1.35, spinSpeed: 9.5, riseSpeed: 2.8, twist: 2.4,
                palette: P.pal, texStyle, defaultTex: 'silk', hdr: 2.1,
              }));
              sim.addCustom(new GroundWave3D({ x: 0, z: 4.0, maxRadius: 2.72, thickness: 0.5, height: 0.72, duration: 0.38, palette: P.pal, seed: seed + 12 }));
              sim.spawnNiagaraBurst({
                x: 0, y: 0.8, z: 4.0, count: 120, spreadRadius: 1.6,
                speed0: 1.2, speed1: 4.2, dirY: 1.0, dirBias: 0.5,
                drag: 2.2, gravity: -2.2, curl: 3.8, vortex: 14.0, vortexCenter: [0, 4.0],
                size0: 0.038, size1: 0.012, life0: 0.65, life1: 1.25, palette: P.pal, bounce: 0,
              });
              for (const d of dummies) d.hit({ dirX: -d.homeX * 0.5, dirZ: -0.4, power: 1.35, noPush: false, flashColor: P.hotHex });
            },
          });
        }},
      ];
    },
  },

  // 11. 縛足荊棘陷阱箭
  {
    id: 'bow_bramble_trap', cat: 'bow', cls: '森羅巡林者 Warden',
    title: '縛足荊棘陷阱箭：森羅纏繞矢', codeId: 'r.bow.bramble_snare',
    duration: 2.15, releaseTime: 0.34, peakTime: 0.75, contactTimes: [0.36, 0.75, 1.25],
    hitbox: { kind: 'circle', cx: 0, cz: 3.8, radius: 2.6 },
    specNotes: [
      '射出翡翠種子重矢釘入敵陣，碎裂地表蔓延森羅毒藤區並破土竄出 8 根立體荊棘尖刺',
      '無任何地面法陣，立體荊棘叢與纏繞氣流鎖住三名目標，伴隨森林孢子微粒',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageEmerald', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 3.8, true);
      dummies[1].reset(-1.3, 3.9, true);
      dummies[2].reset(1.3, 3.9, true);
    },
    keyframes: makeBowShotKeyframes({ drawT: 0.26, looseT: 0.34, endT: 2.0 }),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('mageEmerald', paletteOverride);
      return [
        { t: 0.34, run() {
          launch3DArrow(sim, {
            p0: fighter.getBowMuzzleWorld(), p1: new THREE.Vector3(0, 0.1, 3.8),
            arcHeight: 0.55, flightTime: 0.22, palette: P.pal, scale: 1.15, heavy: true, pinHold: 0.9,
            onImpact: () => {
              sim.spawnGroundZone({ x: 0, z: 3.8, radius: 2.25, duration: 1.30, kind: 'poison', palette: P.pal, eruptRocks: true });
              sim.addCustom(new GroundWave3D({ x: 0, z: 3.8, maxRadius: 2.48, thickness: 0.42, height: 0.55, duration: 0.34, palette: P.pal, seed }));
              for (let k = 0; k < 8; k++) {
                const a = (k / 8) * TAU;
                sim.spawnCrystal({
                  x: Math.cos(a) * 1.65, z: 3.8 + Math.sin(a) * 1.65,
                  height: 1.12, width: 0.26, leanX: -Math.cos(a) * 0.28, leanZ: -Math.sin(a) * 0.28,
                  hold: 0.65, melt: 0.35, palette: P.pal,
                });
              }
              dummies.forEach((d) => {
                d.hit({ dirX: 0, dirZ: 1, power: 0.9, noPush: true, flashColor: P.hotHex, shiver: 0.55 });
                sim.spawnStatusMark('frostRing', d.root.position, 1.15);
                sim.spawnFlipbook({ atlas: 'fbPoison', x: d.root.position.x, y: 0.9, z: d.root.position.z, life: 0.85, size0: 0.78, size1: 1.32, palette: P.pal });
              });
              sim.spawnNiagaraBurst({ x: 0, y: 0.2, z: 3.8, count: 75, spreadRadius: 2.1, speed0: 0.8, speed1: 2.6, dirY: 1, dirBias: 0.65, gravity: -1.5, curl: 3.2, life0: 0.6, life1: 1.15, palette: P.pal, bounce: 0 });
            },
          });
        }},
      ];
    },
  },

  // 12. 彈射雷鳴箭
  {
    id: 'bow_ricochet_volt', cat: 'bow', cls: '雷霆獵手 Stormstalker',
    title: '彈射雷鳴箭：連鎖閃電跳彈矢', codeId: 'r.bow.volt_ricochet',
    duration: 1.95, releaseTime: 0.31, peakTime: 0.66, contactTimes: [0.42, 0.56, 0.70],
    hitbox: { kind: 'chain', targets: [[0, 2.5], [-1.55, 3.8], [1.55, 4.2]] },
    specNotes: [
      '射出高壓雷鳴靈矢，命中首目標後以折角高速彈射串聯另外兩名敵人',
      '每次彈射拉出立體銳利閃電鏈與 fbLightning 電弧球，絕無生硬直線斷裂',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 2.5, true);
      dummies[1].reset(-1.55, 3.8, true);
      dummies[2].reset(1.55, 4.2, true);
    },
    keyframes: makeBowShotKeyframes({ drawT: 0.24, looseT: 0.31, endT: 1.85 }),
    buildEvents(sim, fighter, dummies, _seed, paletteOverride) {
      const P = resolvePal('mageVolt', paletteOverride);
      return [
        { t: 0.31, run() {
          const c0 = dummies[0].chestWorld(), c1 = dummies[1].chestWorld(), c2 = dummies[2].chestWorld();
          launch3DArrow(sim, {
            p0: fighter.getBowMuzzleWorld(), p1: c0, arcHeight: 0.04, flightTime: 0.12, palette: P.pal, scale: 1.15, heavy: true,
            onImpact: () => {
              dummies[0].hit({ dirX: 0, dirZ: 1, power: 1.1, flashColor: P.hotHex, shiver: 0.35 });
              sim.spawnFlipbook({ atlas: 'fbLightning', x: c0.x, y: c0.y, z: c0.z, life: 0.30, size0: 0.8, size1: 1.4, palette: P.pal, hdr: 2.2 });
              sim.spawnLightning({ p0: c0, p1: c1, life: 0.26, palette: P.pal, thickness: 0.055 });
              launch3DArrow(sim, {
                p0: c0, p1: c1, arcHeight: 0.12, flightTime: 0.13, palette: P.pal, scale: 1.1,
                onImpact: () => {
                  dummies[1].hit({ dirX: -0.6, dirZ: 0.8, power: 1.15, flashColor: P.hotHex, shiver: 0.35 });
                  sim.spawnFlipbook({ atlas: 'fbLightning', x: c1.x, y: c1.y, z: c1.z, life: 0.30, size0: 0.8, size1: 1.45, palette: P.pal, hdr: 2.2 });
                  sim.spawnLightning({ p0: c1, p1: c2, life: 0.28, palette: P.pal, thickness: 0.055 });
                  launch3DArrow(sim, {
                    p0: c1, p1: c2, arcHeight: 0.14, flightTime: 0.14, palette: P.pal, scale: 1.1, heavy: true,
                    onImpact: () => {
                      dummies[2].hit({ dirX: 0.7, dirZ: 0.6, power: 1.35, flashColor: P.hotHex, shiver: 0.45 });
                      sim.spawnFlipbook({ atlas: 'fbHitBurst', x: c2.x, y: c2.y, z: c2.z, life: 0.30, size0: 0.85, size1: 1.65, palette: P.pal, hdr: 2.3 });
                    },
                  });
                },
              });
            },
          });
        }},
      ];
    },
  },

  // 13. 暗影噬魂分裂箭
  {
    id: 'bow_shadow_split', cat: 'bow', cls: '暗夜冥弓 Darkbow',
    title: '暗影噬魂分裂箭：虛空子母魔矢', codeId: 'r.bow.void_cluster',
    duration: 2.05, releaseTime: 0.32, peakTime: 0.64, contactTimes: [0.36, 0.64, 0.96],
    hitbox: { kind: 'circle', cx: 0, cz: 4.0, radius: 2.8 },
    specNotes: [
      '射出一支重型虛空母矢於半空爆開黑洞漩渦，瞬間分裂為 12 支子矢俯衝轟炸全場',
      '結合 fbMagicSwirl 星雲裂隙與 Niagara 虛空微粒群，視覺層次極度飽滿',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('voidAbyss', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 4.0, true);
      dummies[1].reset(-1.4, 3.8, true);
      dummies[2].reset(1.4, 3.8, true);
    },
    keyframes: makeBowShotKeyframes({ drawT: 0.25, looseT: 0.32, skyAim: true, endT: 1.95 }),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('voidAbyss', paletteOverride);
      const splitPt = new THREE.Vector3(0, 3.35, 2.75);
      return [
        { t: 0.32, run() {
          spawnMachShockRings3D(sim, {
            p0: new THREE.Vector3(0, 1.38, 0.45), p1: splitPt,
            ringCount: 3, radius0: 0.24, radius1: 0.78, duration: 0.26, palette: P.pal,
          });
          launch3DArrow(sim, {
            p0: fighter.getBowMuzzleWorld(), p1: splitPt, arcHeight: 0.2, flightTime: 0.20, palette: P.pal, scale: 1.45, heavy: true,
            onImpact: () => {
              sim.spawnFlipbook({ atlas: 'fbDarkVortex', x: splitPt.x, y: splitPt.y, z: splitPt.z, life: 0.45, size0: 1.1, size1: 2.1, palette: P.pal, hdr: 2.2 });
              sim.addCustom(new ShockSphere3D({ x: splitPt.x, y: splitPt.y, z: splitPt.z, r0: 0.15, r1: 1.5, duration: 0.25, palette: P.pal, hdr: 2.2, useRunes: false }));
              for (let i = 0; i < 12; i++) {
                const a = (i / 12) * TAU;
                const rad = R.range(0.35, 2.35);
                const end = new THREE.Vector3(Math.cos(a) * rad, 0.12, 4.0 + Math.sin(a) * rad);
                launch3DArrow(sim, {
                  p0: splitPt, p1: end, arcHeight: 0.15, flightTime: 0.22, palette: P.pal, scale: 0.95, pinHold: 0.32,
                  onImpact: (pt) => {
                    sim.spawnFlipbook({ atlas: 'fbHitBurst', x: pt.x, y: 0.35, z: pt.z, life: 0.26, size0: 0.55, size1: 1.2, palette: P.pal, hdr: 2.15 });
                  },
                });
              }
              sim.addCustom(new GroundWave3D({ x: 0, z: 4.0, maxRadius: 2.72, thickness: 0.48, height: 0.65, duration: 0.36, palette: P.pal, seed }));
              dummies.forEach((d) => d.hit({ dirX: d.homeX * 0.3, dirZ: 1, power: 1.3, flashColor: P.hotHex }));
            },
          });
        }},
      ];
    },
  },

  // 14. 暴風連珠百烈箭
  {
    id: 'bow_gatling_barrage', cat: 'bow', cls: '疾風神射 Tempest',
    title: '暴風連珠百烈箭：幻影神速連射', codeId: 'r.bow.gatling_volley',
    duration: 2.15, releaseTime: 0.20, peakTime: 0.82, contactTimes: [0.35, 0.82, 1.32],
    hitbox: { kind: 'sector', radius: 5.0, angleDeg: 45 },
    specNotes: [
      '展開疾風步殘影，1.0 秒內狂暴傾瀉 20 支高速穿雲靈矢構成密集彈幕走廊',
      '弓口持續爆開音爆氣環，敵人胸口連續炸開二十道星芒火花',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('warriorSilver', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 4.2, true);
      dummies[1].reset(-0.85, 4.55, true);
      dummies[2].reset(0.85, 4.55, true);
    },
    keyframes: [
      ...makeBowShotKeyframes({ drawT: 0.13, looseT: 0.20, endT: 0.40 }).slice(0, 3),
      { t: 0.34, ease: ease.inOutSine, pose: { ...REST_POSE, crouch: 0.12, torsoYaw: -0.62, shLPitch: -1.52, shLYaw: 0.56, shRPitch: -1.44, shRYaw: -0.35, elRPitch: -1.16, bowDraw: 0.88, bowArrow: 1 } },
      { t: 0.46, ease: ease.outExpo, pose: { ...REST_POSE, crouch: 0.14, torsoYaw: -0.62, shLPitch: -1.56, shLYaw: 0.56, shRPitch: -1.68, shRYaw: -0.62, elRPitch: -0.55, bowDraw: 0.08, bowArrow: 0 } },
      { t: 0.60, ease: ease.inOutSine, pose: { ...REST_POSE, crouch: 0.14, torsoYaw: -0.64, shLPitch: -1.52, shLYaw: 0.56, shRPitch: -1.44, shRYaw: -0.36, elRPitch: -1.18, bowDraw: 0.90, bowArrow: 1 } },
      { t: 0.72, ease: ease.outExpo, pose: { ...REST_POSE, crouch: 0.15, torsoYaw: -0.64, shLPitch: -1.58, shLYaw: 0.56, shRPitch: -1.70, shRYaw: -0.64, elRPitch: -0.52, bowDraw: 0.08, bowArrow: 0 } },
      { t: 0.86, ease: ease.inOutSine, pose: { ...REST_POSE, crouch: 0.15, torsoYaw: -0.64, shLPitch: -1.52, shLYaw: 0.56, shRPitch: -1.44, shRYaw: -0.38, elRPitch: -1.20, bowDraw: 0.92, bowArrow: 1 } },
      { t: 0.98, ease: ease.outExpo, pose: { ...REST_POSE, crouch: 0.16, torsoYaw: -0.64, shLPitch: -1.58, shLYaw: 0.56, shRPitch: -1.72, shRYaw: -0.66, elRPitch: -0.50, bowDraw: 0.08, bowArrow: 0 } },
      { t: 1.10, ease: ease.inOutSine, pose: { ...REST_POSE, crouch: 0.16, torsoYaw: -0.64, shLPitch: -1.52, shLYaw: 0.56, shRPitch: -1.44, shRYaw: -0.38, elRPitch: -1.22, bowDraw: 0.96, bowArrow: 1 } },
      { t: 1.20, ease: ease.outExpo, pose: { ...REST_POSE, crouch: 0.16, torsoYaw: -0.64, shLPitch: -1.58, shLYaw: 0.56, shRPitch: -1.74, shRYaw: -0.68, elRPitch: -0.48, bowDraw: 0, bowArrow: 0 } },
      { t: 2.05, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('warriorSilver', paletteOverride);
      const evs = [];
      for (let i = 0; i < 20; i++) {
        evs.push({
          t: 0.20 + i * 0.052,
          run() {
            const muz = fighter.getBowMuzzleWorld();
            const tgt = dummies[i % 3];
            const dst = tgt.chestWorld().add(new THREE.Vector3(R.range(-0.22, 0.22), R.range(-0.22, 0.22), 0));
            if (i % 4 === 0) fighter.spawnGhost(sim, { color: P.midHex, life: 0.16, opacity: 0.28 });
            launch3DArrow(sim, {
              p0: muz, p1: dst, arcHeight: R.range(-0.04, 0.08), flightTime: 0.12, palette: P.pal, scale: 0.92,
              onImpact: (pt) => {
                tgt.hit({ dirX: R.range(-0.2, 0.2), dirZ: 1, power: 0.55, noPush: true, flashColor: P.hotHex });
                sim.spawnFlipbook({ atlas: 'fbHitBurst', x: pt.x, y: pt.y, z: pt.z - 0.1, life: 0.18, size0: 0.45, size1: 0.95, palette: P.pal, hdr: 2.15 });
              },
            });
          },
        });
      }
      return evs;
    },
  },

  // 15. 鳳凰火翼穿雲箭
  {
    id: 'bow_phoenix_wing', cat: 'bow', cls: '朱雀神弓 Phoenix Archer',
    title: '鳳凰火翼穿雲箭：朱雀展翅炎矢', codeId: 'r.bow.phoenix_arrow',
    duration: 2.15, releaseTime: 0.44, peakTime: 0.62, contactTimes: [0.44, 0.62, 0.98],
    hitbox: { kind: 'rect', width: 2.8, length: 5.8 },
    specNotes: [
      '拉弓瞬間背後展開一對烈焰刀紋構成的巨型朱雀雙翼 (SlashArc3D 對稱火翼)',
      '射出巨型重裝炎凰神矢沿途犁出地面火浪，貫穿敵陣引發烈焰風暴大爆炸',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 2.6, true);
      dummies[1].reset(-0.65, 4.1, true);
      dummies[2].reset(0.65, 5.1, true);
    },
    keyframes: makeBowShotKeyframes({ drawT: 0.34, looseT: 0.44, endT: 2.05 }),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('fireInferno', paletteOverride);
      return [
        { t: 0.06, isPreGather: true, run() {
          sim.spawnChargeGather({ getAnchor: () => fighter.getBowMuzzleWorld(), duration: 0.36, radius: 1.35, palette: P.pal, rate: 185, tiers: 2, noSigil: true });
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.25, duration: 0.50, palette: P.pal, _mapped: true });
        }},
        { t: 0.44, run() {
          for (const sgn of [-1, 1]) {
            sim.addCustom(new SlashArc3D({
              center: [sgn * 0.25, 1.25, -0.1], radius: 1.85, width: 0.85, thickness: 0.24,
              a0: sgn > 0 ? 0.35 : -2.2, a1: sgn > 0 ? 2.2 : -0.35, tiltZ: sgn * 0.95,
              sweep: 0.14, hold: 0.28, trail: 0.26, palette: P.pal, texStyle, defaultTex: 'flame', hdrBoost: 2.4, seed: seed + sgn,
            }));
          }
          const muz = fighter.getBowMuzzleWorld();
          spawnMachShockRings3D(sim, {
            p0: new THREE.Vector3(0, 1.25, 0.55), p1: new THREE.Vector3(0, 1.15, 5.4),
            ringCount: 5, radius0: 0.28, radius1: 0.95, duration: 0.34, palette: P.pal,
          });
          spawnBladeGroundScar3D(sim, R, { x: 0, z: 3.0, length: 4.2, width: 0.42, life: 0.95, zoneKind: 'burning', palette: P.pal });
          launch3DArrow(sim, {
            p0: muz, p1: new THREE.Vector3(0, 1.15, 5.5), arcHeight: 0.02, flightTime: 0.18,
            palette: P.pal, scale: 1.65, heavy: true, trailWidth: 0.32,
            onImpact: (pt) => {
              sim.spawnFlipbook({ atlas: 'fbExplosion', x: pt.x, y: 1.15, z: pt.z, vy: 0.9, life: 0.62, size0: 1.35, size1: 2.85, palette: P.pal, hdr: 2.25 });
              sim.addCustom(new ShockSphere3D({ x: pt.x, y: 1.15, z: pt.z, r0: 0.2, r1: 2.35, duration: 0.34, palette: P.pal, hdr: 2.2, useRunes: false }));
              spawnGroundCracks(sim, R, { cx: 0, cz: 5.2, maxRadius: 2.2, branches: 8, life: 0.85, palette: P.pal, rockCount: 6 });
            },
          });
          dummies.forEach((d) => {
            d.hit({ dirX: d.homeX * 0.3, dirZ: 1, power: 1.5, noPush: false, flashColor: P.hotHex });
            sim.spawnFlipbook({ atlas: 'fbFlame', x: d.root.position.x, y: 1.0, z: d.root.position.z, vy: 1.1, life: 0.55, size0: 0.85, size1: 1.65, palette: P.pal, hdr: 2.1 });
          });
        }},
      ];
    },
  },

  // 16. 鷹眼看破・致命弱點狙擊
  {
    id: 'bow_hawk_mark_snipe', cat: 'bow', cls: '神鷹狙擊手 Hawkeye',
    title: '鷹眼看破：致命弱點一矢貫心', codeId: 'r.bow.hawk_snipe',
    duration: 2.05, releaseTime: 0.62, peakTime: 0.72, contactTimes: [0.62, 0.72, 1.08],
    hitbox: { kind: 'circle', cx: 0, cz: 4.6, radius: 1.6 },
    specNotes: [
      '屏息沉腰掀起腳下碎石旋風聚斂殺意，無任何魔法陣干擾',
      '0.62s 射出超音速五重馬赫音障環黃金破甲箭瞬間貫心，爆開八芒暴擊星爆與弱點印記',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('warriorGold', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      dummies[0].reset(0, 4.6, true);
      dummies[1].reset(0, 0, false);
      dummies[2].reset(0, 0, false);
    },
    keyframes: makeBowShotKeyframes({ drawT: 0.52, looseT: 0.62, endT: 1.95 }),
    buildEvents(sim, fighter, dummies, _seed, paletteOverride) {
      const P = resolvePal('warriorGold', paletteOverride);
      const d0 = dummies[0];
      return [
        { t: 0.06, isPreGather: true, run() {
          sim.spawnChargeGather({ getAnchor: () => fighter.getBowMuzzleWorld(), duration: 0.54, radius: 1.25, palette: P.pal, rate: 175, tiers: 2, noSigil: true });
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.12, duration: 0.58, palette: P.pal, _mapped: true });
        }},
        { t: 0.62, run() {
          spawnMachShockRings3D(sim, {
            p0: new THREE.Vector3(0, 1.32, 0.55), p1: new THREE.Vector3(0, 1.15, 4.55),
            ringCount: 5, radius0: 0.24, radius1: 0.85, duration: 0.30, palette: P.pal,
          });
          launch3DArrow(sim, {
            p0: fighter.getBowMuzzleWorld(), p1: d0.chestWorld(), arcHeight: 0.0, flightTime: 0.09,
            palette: P.pal, scale: 1.35, heavy: true, trailWidth: 0.25,
            onImpact: (pt) => {
              fighter.hitStop = 0.095;
              d0.hit({ dirX: 0, dirZ: 1, power: 1.85, noPush: false, flashColor: '#ffffff' });
              sim.spawnStatusMark('weakness', d0.root.position, 1.05);
              sim.spawnFlipbook({ atlas: 'fbStarburst', x: pt.x, y: pt.y, z: pt.z - 0.15, life: 0.36, size0: 1.05, size1: 2.25, palette: P.pal, hdr: 2.45 });
              sim.addCustom(new ShockSphere3D({ x: pt.x, y: pt.y, z: pt.z, r0: 0.12, r1: 1.52, duration: 0.28, palette: P.pal, hdr: 2.3, useRunes: false }));
              sim.addCustom(new GroundWave3D({ x: 0, z: 4.6, maxRadius: 1.48, thickness: 0.32, height: 0.45, duration: 0.30, palette: P.pal, hdr: 2.1 }));
              sim.spawnNiagaraBurst({ x: pt.x, y: pt.y, z: pt.z, count: 65, speed0: 3.5, speed1: 10.5, drag: 5.8, curl: 3.2, life0: 0.22, life1: 0.48, palette: P.pal });
            },
          });
        }},
      ];
    },
  },
];
