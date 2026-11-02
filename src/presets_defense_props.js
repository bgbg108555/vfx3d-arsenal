import * as THREE from 'three';
import {
  TAU, clamp, lerp, smooth, ease, Rng, PAL3D, rampToColors,
  SlashArc3D, RibbonTrail3D, GroundWave3D, VortexFunnel3D, BeamCylinder3D, Sigil3D, DomeShield3D, ShockSphere3D,
  makeCraggyRockGeo, makeMagmaRockMaterial, makeTranslucentConstructMaterial,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import {
  resolvePal, SHIELD_GUARD, makeStaffCastKeyframes, makeSkyChantKeyframes,
  spawnGroundCracks, spawnArcaneOrb,
  attachWeaponBladeTrail3D, spawnMartialStanceGust3D, spawnBladeGroundScar3D, spawnMachShockRings3D,
} from './fx_helpers.js';
import {
  buildMagmaMeteorAssembly, buildTowerShieldAssembly, buildSpiritSwordAssembly,
  buildChainStrandAssembly, buildWarhammerAssembly, buildTotemObeliskAssembly,
} from './mesh_props3d.js';

export const PRESETS_DEFENSE_PROPS = [
  // =========================================================================
  // DEFENSE 1: 重裝聖盾：格擋火光與震波反擊 (3D 巨型塔盾硬扛雙熔岩巨石 -> 黃金盾擊反震!)
  // =========================================================================
  {
    id: 'def_aegis_parry',
    cat: 'defense',
    cls: '重裝聖騎 Guardian',
    title: '重裝聖盾：格擋火光與震波反擊',
    codeId: 'w.def.aegis_counter',
    duration: 2.35,
    releaseTime: 0.16,
    peakTime: 0.72,
    contactTimes: [0.46, 0.72, 0.92],
    hitbox: { kind: 'sector', radius: 3.8, angleDeg: 130 },
    specNotes: [
      '身前展開雙曲面半透明聖殿玫瑰花窗力場聖盾 (Fresnel 邊緣透光 + 六角力場 + 聖翼結晶紋章)，可清晰透視後方持盾騎士！',
      '硬扛兩發敵方燃燒熔岩巨石爆開受擊波紋與彈跳火光碎石，0.92s 蓄滿動能向前轟出黃金反擊震波！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('sword_shield', hotHex);
      dummies[0].reset(0, 3.35, true);
      dummies[1].reset(-1.45, 3.65, true);
      dummies[2].reset(1.45, 3.65, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE, ...SHIELD_GUARD } },
      { t: 0.09, ease: ease.inOutCubic, pose: {
        crouch: 0.28, torsoPitch: 0.20, torsoYaw: -0.22,
        shLPitch: -0.95, shLYaw: 0.42, elLPitch: -0.75,
        shRPitch: -0.88, shRYaw: -0.45, elRPitch: -0.60,
      }},
      { t: 0.16, ease: ease.outBack, pose: {
        crouch: 0.24, torsoPitch: 0.16, torsoYaw: 0.28,
        shLPitch: -1.32, shLYaw: 0.10, elLPitch: -0.45,
        shRPitch: -0.82, shRYaw: -0.45, elRPitch: -0.55,
      }},
      { t: 0.74, ease: ease.inOutSine, pose: {
        z: -0.08, crouch: 0.28, torsoPitch: 0.18, torsoYaw: 0.26,
        shLPitch: -1.35, shLYaw: 0.08, elLPitch: -0.42,
      }},
      { t: 0.92, ease: ease.outExpo, pose: {
        z: 0.36, crouch: 0.20, torsoPitch: 0.28, torsoYaw: -0.22,
        shLPitch: -1.48, shLYaw: -0.35, elLPitch: -0.15,
        shRPitch: -1.42, shRYaw: 0.35, elRPitch: -0.12, capePitch: 0.72,
      }},
      { t: 2.25, ease: ease.inOutCubic, pose: { ...REST_POSE, ...SHIELD_GUARD } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('holyGold', paletteOverride);
      const E = resolvePal('fireInferno', null);
      let shieldObj = null;

      const fireIncomingBoulder = (launchT, p0, hitPt) => ({
        t: launchT,
        run() {
          const rock = buildMagmaMeteorAssembly({ radius: 0.28, palette: E.pal, seed: seed + Math.round(launchT * 100) });
          rock.group.position.copy(p0);
          const flight = 0.24;
          let elapsed = 0;
          sim.addCustom({
            group: rock.group,
            update(dt) {
              elapsed += dt;
              const u = clamp(elapsed / flight);
              rock.group.position.lerpVectors(p0, hitPt, u);
              rock.update(dt, u);
              if (Math.random() < 0.5) {
                sim.spawnSpark({
                  x: rock.group.position.x, y: rock.group.position.y, z: rock.group.position.z,
                  vx: R.range(-1.5, 1.5), vy: R.range(0.8, 2.5), vz: R.range(1.5, 3.5),
                  life: 0.18, size: 0.045, color: E.hotHex,
                });
              }
            },
            get done() { return elapsed >= flight; },
            dispose() { rock.dispose(); },
          });
        },
      });

      const onShieldBlock = (hitT, hx) => ({
        t: hitT,
        run() {
          fighter.hitStop = 0.055;
          shieldObj?.triggerFlash();
          const hz = 1.05, hy = 1.15;
          sim.addLight(hx, hy, hz + 0.2, P.hotHex, 3.8, 5.5, 0.20);
          sim.spawnStarGlint(hx, hy, hz + 0.14, 0.62, '#ffffff', 0.11);
          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: hx, y: hy, z: hz + 0.16,
            life: 0.16, size0: 0.38, size1: 0.82, palette: P.pal, hdr: 1.60,
          });
          // Ricocheting 3D magma rock splinters & golden sparks bouncing toward the front!
          for (let i = 0; i < 8; i++) {
            const a = R.range(-1.1, 1.1), sp = R.range(2.6, 5.4);
            sim.spawnFireRock({
              x: hx, y: hy, z: hz + 0.15,
              vx: Math.sin(a) * sp, vy: R.range(1.8, 4.6), vz: Math.cos(a) * sp * 0.85,
              size: R.range(0.11, 0.18), life: R.range(0.55, 0.88),
              palette: i % 2 === 0 ? E.pal : P.pal, emitSparks: true,
            });
          }
          for (let s = 0; s < 20; s++) {
            const a = R.range(-1.3, 1.3), sp = R.range(3.5, 7.5);
            sim.spawnSpark({
              x: hx, y: hy, z: hz + 0.12,
              vx: Math.sin(a) * sp, vy: R.range(1.2, 4.8), vz: Math.cos(a) * sp * 0.7,
              life: R.range(0.20, 0.36), size: 0.052, stretch: 0.04, color: s % 2 ? P.hotHex : E.hotHex,
            });
          }
        },
      });

      return [
        { t: 0.16, run() {
          shieldObj = buildTowerShieldAssembly({ palette: P.pal, scale: 1.38 });
          const g = shieldObj.group;
          g.position.set(0, 1.05, 0.92);
          spawnMartialStanceGust3D(sim, {
            x: 0, z: 0.25, radius: 1.75, duration: 1.15, palette: P.pal, hdr: 2.2, _mapped: true,
          });
          spawnGroundCracks(sim, R, { cx: 0, cz: 0.92, maxRadius: 1.45, branches: 6, life: 1.15, palette: P.pal, rockCount: 6, rockScale: 0.65 });

          let elapsed = 0;
          const dur = 1.52;
          sim.addCustom({
            group: g,
            update(dt) {
              elapsed += dt;
              shieldObj.update(dt);
              const pop = ease.outBack(clamp(elapsed / 0.14), 1.8);
              const fade = 1 - smooth(dur - 0.28, dur, elapsed);
              const bashZ = elapsed > 0.74 && elapsed < 1.08 ? Math.sin(((elapsed - 0.74) / 0.34) * Math.PI) * 0.55 : 0;
              g.position.set(0, 1.05, 0.92 + bashZ);
              g.scale.setScalar(1.38 * Math.max(0.01, pop));
              shieldObj.setOpacity(fade);
            },
            get done() { return elapsed >= dur; },
            dispose() { shieldObj.dispose(); },
          });
        }},
        fireIncomingBoulder(0.22, new THREE.Vector3(-0.95, 1.55, 4.85), new THREE.Vector3(-0.22, 1.18, 1.08)),
        onShieldBlock(0.46, -0.22),
        fireIncomingBoulder(0.47, new THREE.Vector3(0.95, 1.45, 4.85), new THREE.Vector3(0.22, 1.12, 1.08)),
        onShieldBlock(0.71, 0.22),
        // Stage 3: Kinetic Shield Counter-Blast at 0.92s!
        { t: 0.92, run() {
          fighter.hitStop = 0.085;
          shieldObj?.triggerFlash();
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.62, width: 0.34, palette: P.pal, hdr: 2.55, sparkRate: 36 });
          spawnBladeGroundScar3D(sim, {
            x: 0, z: 1.95, yaw: 0, length: 2.65, width: 0.38, duration: 1.15,
            palette: P.pal, zoneKind: 'holy', eruptRocks: true, seed: seed + 305,
          });
          sim.addCustom(new SlashArc3D({
            center: [0, 1.08, 0.65], radius: 3.08, width: 1.22, thickness: 0.36,
            a0: -1.12, a1: 1.12, tiltZ: -0.10,
            sweep: 0.06, hold: 0.06, trail: 0.22,
            palette: P.pal, texStyle, defaultTex: 'flame', hdrBoost: 2.45, seed: seed + 301,
          }));
          sim.addCustom(new GroundWave3D({
            x: 0, z: 1.45, maxRadius: 2.95, thickness: 0.58, height: 0.85, duration: 0.42,
            palette: P.pal, hdr: 2.2, seed: seed + 302,
          }));
          sim.addLight(0, 1.3, 2.2, P.hotHex, 4.8, 7.5, 0.38);
          for (const d of dummies) {
            d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 1.65, noPush: false, flashColor: P.hotHex });
            sim.spawnFlipbook({
              atlas: 'fbHitBurst', x: d.root.position.x, y: 1.15, z: d.root.position.z - 0.2,
              life: 0.30, size0: 0.85, size1: 1.65, palette: P.pal, hdr: 2.2,
            });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // DEFENSE 2: 大地岩壁：玄武岩巨牆攔截 (7 座立體玄武岩巨碑破土成牆 -> 攔截敵方三連火砲!)
  // =========================================================================
  {
    id: 'def_earthen_bulwark',
    cat: 'defense',
    cls: '大地守護者 Earthwarden',
    title: '大地岩壁：玄武岩巨牆攔截',
    codeId: 'w.def.rock_rampart',
    duration: 2.40,
    releaseTime: 0.28,
    peakTime: 0.86,
    contactTimes: [0.36, 0.86, 1.35],
    hitbox: { kind: 'rect', width: 4.4, length: 2.4 },
    specNotes: [
      '踏地拔起 7 座高 2.2m 半透明熔岩符文結晶玄武岩巨碑組成弧形城牆，伴隨破土碎石與 Niagara 微粒',
      '正面硬接敵方三發重型火球轟炸，火球撞牆炸出蘑菇火雲與 16 顆彈跳火石，半透明晶壁後角色毫髮無傷！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('earthMagma', paletteOverride);
      fighter.setLoadout('unarmed', hotHex);
      dummies[0].reset(0, 4.85, false);
      dummies[1].reset(0, 0, false);
      dummies[2].reset(0, 0, false);
    },
    keyframes: makeSkyChantKeyframes(0.16, 0.28, 2.30),
    buildEvents(sim, _fighter, _dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('earthMagma', paletteOverride);
      const F = resolvePal('fireInferno', null);

      const evs = [
        { t: 0.28, run() {
          const wallGroup = new THREE.Group();
          const geos = [], mats = [];
          const slabs = [];
          const count = 7;

          for (let i = 0; i < count; i++) {
            const frac = (i / (count - 1)) * 2 - 1; // -1..+1
            const ang = frac * 0.68;
            const r = 1.75;
            const hScale = 2.25 - Math.abs(frac) * 0.45;
            const sGeo = makeCraggyRockGeo(0.42, 1, 0.26, seed + 17 * i, hScale);
            sGeo.translate(0, 0.42 * hScale * 0.82, 0);
            const sMat = makeTranslucentConstructMaterial({
              palette: P.pal, sigilStyle: null, useHexLattice: true,
              baseAlpha: 0.24, rimAlpha: 0.94, rimPower: 1.9, hdr: 2.0, additive: false,
            });
            geos.push(sGeo); mats.push(sMat);
            const m = new THREE.Mesh(sGeo, sMat);
            m.position.set(Math.sin(ang) * r, -0.08, Math.cos(ang) * r);
            m.rotation.y = ang;
            wallGroup.add(m);
            slabs.push({ m, sMat, delay: Math.abs(frac) * 0.10 });
          }

          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.65, duration: 1.05, palette: P.pal, hdr: 2.15, _mapped: true });
          spawnGroundCracks(sim, R, { cx: 0, cz: 1.65, maxRadius: 2.35, branches: 9, life: 1.55, palette: P.pal, rockCount: 8, rockScale: 0.85 });
          sim.addCustom(new GroundWave3D({
            x: 0, z: 1.65, maxRadius: 2.45, thickness: 0.52, height: 0.65, duration: 0.38,
            palette: P.pal, hdr: 1.95, seed: seed + 310,
          }));

          let elapsed = 0;
          const dur = 1.75;
          sim.addCustom({
            group: wallGroup,
            update(dt) {
              elapsed += dt;
              const sink = 1 - smooth(dur - 0.35, dur, elapsed);
              for (const s of slabs) {
                const localT = Math.max(0, elapsed - s.delay);
                const pop = ease.outBack(clamp(localT / 0.18), 1.75);
                s.m.scale.set(pop, Math.max(0.01, pop * sink), pop);
                s.sMat.uniforms.uOpacity.value = sink;
              }
            },
            get done() { return elapsed >= dur; },
            dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
          });
        }},
      ];

      // 3 Incoming Fireball Bombardments intercepted by the 3D Basalt Wall!
      const barrages = [
        { t: 0.40, x0: -1.35, hitX: -0.75, hitZ: 1.88 },
        { t: 0.54, x0:  0.00, hitX:  0.00, hitZ: 1.98 },
        { t: 0.68, x0:  1.35, hitX:  0.75, hitZ: 1.88 },
      ];
      barrages.forEach((b) => {
        evs.push({
          t: b.t,
          run() {
            spawnArcaneOrb(sim, {
              p0: new THREE.Vector3(b.x0, 2.25, 5.25),
              p1: new THREE.Vector3(b.hitX, 1.15, b.hitZ),
              arcHeight: 0.35, flightTime: 0.26, palette: F.pal, orbSize: 0.20, heavy: true, flipbookWake: 'fbFlame',
              onImpact: () => {
                sim.addLight(b.hitX, 1.3, b.hitZ + 0.3, F.hotHex, 4.5, 6.0, 0.32);
                sim.spawnFlipbook({
                  atlas: 'fbExplosion', x: b.hitX, y: 1.15, z: b.hitZ + 0.22, vy: 0.85,
                  life: 0.52, size0: 1.05, size1: 2.25, palette: F.pal, hdr: 2.1,
                });
                sim.spawnFlipbook({
                  atlas: 'fbSmoke', x: b.hitX, y: 1.45, z: b.hitZ + 0.32, vy: 1.15,
                  life: 0.68, size0: 0.95, size1: 2.05, palette: P.pal, hdr: 1.1, opacity: 0.72, additive: false,
                });
                for (let r = 0; r < 6; r++) {
                  const a = R.range(-1.2, 1.2), sp = R.range(2.2, 4.8);
                  sim.spawnFireRock({
                    x: b.hitX, y: 1.05, z: b.hitZ + 0.25,
                    vx: Math.sin(a) * sp, vy: R.range(2.0, 4.8), vz: Math.cos(a) * sp,
                    size: R.range(0.13, 0.22), life: R.range(0.58, 0.92), palette: F.pal, emitSparks: true,
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
  // DEFENSE 3: 極寒晶壁：冰晶稜鏡防禦牆 (9 根巨型多面體冰晶稜柱陣 -> 粉碎來襲熔岩巨隕!)
  // =========================================================================
  {
    id: 'def_glacial_bastion',
    cat: 'defense',
    cls: '冰霜守護者 Cryowarden',
    title: '極寒晶壁：冰晶稜鏡防禦牆',
    codeId: 'm.def.ice_bastion',
    duration: 2.35,
    releaseTime: 0.24,
    peakTime: 0.82,
    contactTimes: [0.34, 0.82, 1.26],
    hitbox: { kind: 'sector', radius: 2.8, angleDeg: 140 },
    specNotes: [
      '展開寒冰星盤並連續刺出 9 簇高達 2.3m 的多面體折射冰晶防禦巨牆',
      '正面攔截敵方砸來的立體燃燒巨岩，將巨岩瞬間凍結粉碎為漫天彈跳冰晶與黑曜石塊！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageFrost', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 0, false);
      dummies[1].reset(0, 0, false);
      dummies[2].reset(0, 0, false);
    },
    keyframes: makeStaffCastKeyframes(0.14, 0.24, 2.20),
    buildEvents(sim, _fighter, _dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('mageFrost', paletteOverride);
      const E = resolvePal('fireInferno', null);

      return [
        { t: 0.24, run() {
          sim.addCustom(new Sigil3D({
            x: 0, y: 0.02, z: 1.15, radius: 2.35, duration: 1.70,
            style: 'arcane', palette: P.pal, hdr: 1.85, wallHeight: 0.55,
          }));
          const count = 9;
          for (let i = 0; i < count; i++) {
            const frac = (i / (count - 1)) * 2 - 1;
            const a = frac * 0.85;
            const r = 1.68;
            sim.spawnCrystal({
              x: Math.sin(a) * r,
              z: Math.cos(a) * r,
              height: 2.35 - Math.abs(frac) * 0.55,
              width: 0.44,
              leanX: Math.sin(a) * 0.18,
              leanZ: Math.cos(a) * 0.18,
              delay: Math.abs(frac) * 0.08,
              hold: 1.20,
              melt: 0.42,
              palette: P.pal,
            });
          }
          sim.addLight(0, 1.4, 1.6, P.midHex, 4.2, 6.5, 1.50);
        }},
        // Incoming burning meteor hurled at the Glacial Bastion!
        { t: 0.36, run() {
          const p0 = new THREE.Vector3(0, 3.85, 5.35);
          const p1 = new THREE.Vector3(0, 1.35, 1.88);
          const meteor = buildMagmaMeteorAssembly({ radius: 0.54, palette: E.pal, seed: seed + 44 });
          meteor.group.position.copy(p0);
          const flight = 0.40;
          let elapsed = 0;
          sim.addCustom({
            group: meteor.group,
            update(dt) {
              elapsed += dt;
              const u = clamp(elapsed / flight);
              meteor.group.position.lerpVectors(p0, p1, ease.inQuad(u));
              meteor.update(dt, u);
            },
            get done() { return elapsed >= flight; },
            dispose() { meteor.dispose(); },
          });
        }},
        // Impact & Cryo-Refraction Shatter at 0.76s!
        { t: 0.76, run() {
          const hx = 0, hy = 1.35, hz = 1.92;
          sim.addLight(hx, hy, hz + 0.2, P.hotHex, 5.2, 7.5, 0.42);
          sim.spawnStarGlint(hx, hy, hz + 0.15, 1.15, '#ffffff', 0.16);
          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: hx, y: hy, z: hz + 0.18,
            life: 0.34, size0: 1.15, size1: 2.35, palette: P.pal, hdr: 2.3,
          });
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbSmoke', x: hx + Math.cos(a) * 0.65, y: hy + Math.sin(a) * 0.35, z: hz + 0.35,
              vx: Math.cos(a) * 1.1, vy: 0.85, vz: 1.4,
              life: 0.72, size0: 0.95, size1: 2.15, palette: P.pal, hdr: 1.25, opacity: 0.72, additive: false,
            });
          }
          // 16 Bouncing 3D Frozen Rock & Ice Crystal Chunks!
          for (let r = 0; r < 16; r++) {
            const a = R.range(-1.25, 1.25), sp = R.range(2.8, 6.2);
            sim.spawnFireRock({
              x: hx, y: hy, z: hz + 0.22,
              vx: Math.sin(a) * sp, vy: R.range(2.0, 5.4), vz: Math.cos(a) * sp,
              size: R.range(0.14, 0.25), life: R.range(0.68, 1.05),
              palette: r % 3 === 0 ? E.pal : P.pal, rockColor: r % 3 === 0 ? '#2b1f1c' : '#2a4a66', emitSparks: true,
            });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // DEFENSE 4: 御劍護體：八荒飛劍結界與萬劍反擊 (8 把立體符文飛劍護身彈反 -> 齊射貫穿!)
  // =========================================================================
  {
    id: 'def_blade_ward',
    cat: 'defense',
    cls: '劍仙 Sword Saint',
    title: '御劍護體：八荒飛劍結界',
    codeId: 'w.def.blade_ward',
    duration: 2.45,
    releaseTime: 0.18,
    peakTime: 0.76,
    contactTimes: [0.52, 0.76, 1.24],
    hitbox: { kind: 'circle', cx: 0, cz: 0, radius: 2.2 },
    specNotes: [
      '召喚 8 把有形 3D 菱形切面符文飛劍環繞周身高速盤旋，拖曳劍氣光帶構成護體劍陣',
      '連續彈反三發來襲暗影魔彈爆出金屬火花，1.08s 八劍齊指前方化作萬劍流光貫穿敵陣！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageFrost', paletteOverride);
      fighter.setLoadout('sword_shield', hotHex);
      dummies[0].reset(0, 3.85, true);
      dummies[1].reset(-1.55, 4.15, true);
      dummies[2].reset(1.55, 4.15, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE, ...SHIELD_GUARD } },
      { t: 0.10, ease: ease.inOutCubic, pose: {
        crouch: 0.14, torsoPitch: -0.18, headPitch: -0.22,
        shRPitch: -2.10, shRYaw: 0.18, elRPitch: -0.18,
        shLPitch: -1.10, shLYaw: 0.25, elLPitch: -0.55,
      }},
      { t: 0.18, ease: ease.outExpo, pose: {
        crouch: 0.18, torsoPitch: 0.14,
        shRPitch: -1.48, shRYaw: 0.35, elRPitch: -0.08,
        shLPitch: -1.18, shLYaw: 0.15, elLPitch: -0.48, capePitch: 0.62,
      }},
      { t: 0.92, ease: ease.inOutCubic, pose: {
        crouch: 0.12, torsoPitch: -0.20,
        shRPitch: -2.25, shRYaw: -0.25, elRPitch: -0.16,
        shLPitch: -1.25, shLYaw: 0.22, elLPitch: -0.45,
      }},
      { t: 1.08, ease: ease.outExpo, pose: {
        z: 0.22, crouch: 0.22, torsoPitch: 0.28, torsoYaw: 0.26,
        shRPitch: -1.52, shRYaw: 0.08, elRPitch: -0.04,
        shLPitch: -1.05, shLYaw: -0.42, elLPitch: -0.28, capePitch: 0.76,
      }},
      { t: 2.35, ease: ease.inOutCubic, pose: { ...REST_POSE, ...SHIELD_GUARD } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('mageFrost', paletteOverride);
      const G = resolvePal('holyGold', paletteOverride);
      const E = resolvePal('voidAbyss', null);

      const evs = [
        { t: 0.18, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 1.25, width: 0.30, palette: P.pal, hdr: 2.4, sparkRate: 32 });
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.75, duration: 1.15, palette: P.pal, hdr: 2.2, _mapped: true });
          const holder = new THREE.Group();
          const swords = [];
          const trails = [];
          for (let i = 0; i < 8; i++) {
            const sw = buildSpiritSwordAssembly({ palette: i % 2 === 0 ? P.pal : G.pal, scale: 0.88 });
            holder.add(sw.group);
            const tr = new RibbonTrail3D({ maxPoints: 14, width: 0.14, palette: i % 2 === 0 ? P.pal : G.pal, hdr: 1.95 });
            sim.root.add(tr.group);
            trails.push(tr);

            const tgt = dummies[i % 3].chestWorld();
            swords.push({
              sw, baseAng: (i / 8) * TAU,
              launchStart: new THREE.Vector3(),
              launchEnd: tgt.clone().add(new THREE.Vector3(R.range(-0.25, 0.25), R.range(-0.2, 0.25), 0)),
            });
          }

          let elapsed = 0;
          const orbitEnd = 0.89;
          const totalDur = 1.39;
          const yAxis = new THREE.Vector3(0, 1, 0);
          const tmpDir = new THREE.Vector3();

          sim.addCustom({
            group: holder,
            update(dt) {
              elapsed += dt;
              const fade = 1 - smooth(totalDur - 0.22, totalDur, elapsed);
              swords.forEach((item, idx) => {
                const g = item.sw.group;
                if (elapsed <= orbitEnd) {
                  const a = item.baseAng + elapsed * 7.2;
                  const r = 1.42;
                  const px = Math.cos(a) * r;
                  const pz = Math.sin(a) * r;
                  const py = 1.08 + Math.sin(a * 2 + idx) * 0.26;
                  g.position.set(px, py, pz);
                  // Point blade tangent along orbit!
                  tmpDir.set(-Math.sin(a), Math.cos(a * 2 + idx) * 0.35, Math.cos(a)).normalize();
                  g.quaternion.setFromUnitVectors(yAxis, tmpDir);
                  item.launchStart.copy(g.position);
                } else {
                  const u = clamp((elapsed - orbitEnd) / 0.22);
                  g.position.lerpVectors(item.launchStart, item.launchEnd, ease.inExpo(u));
                  tmpDir.subVectors(item.launchEnd, item.launchStart).normalize();
                  g.quaternion.setFromUnitVectors(yAxis, tmpDir);
                }
                item.sw.setOpacity(fade);
                const tipWorld = new THREE.Vector3(0, 1.05, 0).applyMatrix4(g.matrixWorld);
                if (elapsed < orbitEnd + 0.24) {
                  trails[idx].pushPoint(tipWorld);
                  trails[idx].update(dt, 0);
                } else {
                  trails[idx].update(dt, 1 / 0.22);
                }
              });
            },
            get done() { return elapsed >= totalDur; },
            dispose() {
              swords.forEach((s) => s.sw.dispose());
              trails.forEach((t) => { sim.root.remove(t.group); t.dispose(); });
            },
          });
        }},
      ];

      // 3 Incoming Dark Bolts parried by the orbiting 3D Spirit Swords!
      [
        { t: 0.28, x0: -1.4, hitX: -0.65, hitZ: 1.28 },
        { t: 0.48, x0:  1.4, hitX:  0.65, hitZ: 1.28 },
        { t: 0.66, x0:  0.0, hitX:  0.00, hitZ: 1.42 },
      ].forEach((b) => {
        evs.push({
          t: b.t,
          run() {
            spawnArcaneOrb(sim, {
              p0: new THREE.Vector3(b.x0, 1.35, 4.9),
              p1: new THREE.Vector3(b.hitX, 1.15, b.hitZ),
              arcHeight: 0.15, flightTime: 0.22, palette: E.pal, orbSize: 0.15, heavy: true,
              onImpact: () => {
                sim.addLight(b.hitX, 1.2, b.hitZ, G.hotHex, 4.5, 5.0, 0.22);
                sim.spawnStarGlint(b.hitX, 1.15, b.hitZ, 0.72, '#ffffff', 0.13);
                sim.spawnFlipbook({
                  atlas: 'fbHitBurst', x: b.hitX, y: 1.15, z: b.hitZ,
                  life: 0.26, size0: 0.72, size1: 1.45, palette: G.pal, hdr: 2.2,
                });
                sim.addCustom(new SlashArc3D({
                  center: [b.hitX, 1.15, b.hitZ - 0.3], radius: 0.95, width: 0.38, thickness: 0.16,
                  a0: -1.1, a1: 1.1, tiltZ: b.x0 >= 0 ? 0.55 : -0.55,
                  sweep: 0.05, hold: 0.03, trail: 0.12,
                  palette: P.pal, texStyle, defaultTex: 'silk', hdrBoost: 2.3, seed: seed + Math.round(b.t * 100),
                }));
                for (let s = 0; s < 14; s++) {
                  const a = R.range(-1.2, 1.2), sp = R.range(3.0, 6.5);
                  sim.spawnSpark({
                    x: b.hitX, y: 1.15, z: b.hitZ,
                    vx: Math.sin(a) * sp, vy: R.range(1.0, 4.2), vz: Math.cos(a) * sp,
                    life: 0.24, size: 0.048, stretch: 0.038, color: G.hotHex,
                  });
                }
              },
            });
          },
        });
      });

      // Counter-Volley Impact on all 3 Enemies at 1.24s!
      evs.push({
        t: 1.24,
        run() {
          spawnMachShockRings3D(sim, {
            p0: new THREE.Vector3(0, 1.15, 0.95), p1: new THREE.Vector3(0, 1.15, 3.85),
            count: 4, r0: 0.30, r1: 0.82, duration: 0.34, palette: P.pal,
          });
          for (const d of dummies) {
            const p = d.chestWorld();
            d.hit({ dirX: d.homeX * 0.3, dirZ: 1, power: 1.5, noPush: false, flashColor: P.hotHex });
            sim.spawnFlipbook({
              atlas: 'fbHitBurst', x: p.x, y: p.y, z: p.z,
              life: 0.30, size0: 0.85, size1: 1.65, palette: P.pal, hdr: 2.25,
            });
          }
          sim.addLight(0, 1.3, 3.9, P.hotHex, 4.8, 6.5, 0.32);
        },
      });

      return evs;
    },
  },

  // =========================================================================
  // DEFENSE 5: 不動明王：金剛伏魔金鐘罩 (8 面 3D 黃金盾甲拼合鐘體 -> 扛擊震碎破敵!)
  // =========================================================================
  {
    id: 'def_ironclad_bell',
    cat: 'defense',
    cls: '金剛武僧 Monk',
    title: '不動明王：金剛伏魔金鐘罩',
    codeId: 'w.def.vajra_bell',
    duration: 2.35,
    releaseTime: 0.18,
    peakTime: 0.78,
    contactTimes: [0.36, 0.78, 1.12],
    hitbox: { kind: 'circle', cx: 0, cz: 0, radius: 3.2 },
    specNotes: [
      '8 面立體雕紋黃金護盾裝甲環繞拼合成 360° 金剛伏魔鐘體，外罩蜂巢金光罩與雙轉法輪',
      '硬扛敵方連番重斬爆出漫天彈跳金火，1.12s 八面金甲向外猛烈炸開震飛四方敵人！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('unarmed', hotHex);
      dummies[0].reset(0, 2.55, true);
      dummies[1].reset(-2.15, 1.25, true);
      dummies[2].reset(2.15, 1.25, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.10, ease: ease.inOutCubic, pose: {
        crouch: 0.24, torsoPitch: 0.20,
        shRPitch: -0.95, shRYaw: 0.55, elRPitch: -0.95,
        shLPitch: -0.95, shLYaw: -0.55, elLPitch: -0.95,
      }},
      { t: 0.18, ease: ease.outBack, pose: {
        crouch: 0.16, torsoPitch: -0.10,
        shRPitch: -1.35, shRYaw: -0.45, elRPitch: -0.35,
        shLPitch: -1.35, shLYaw: 0.45, elLPitch: -0.35, capePitch: 0.58,
      }},
      { t: 0.96, ease: ease.inOutCubic, pose: {
        crouch: 0.26, torsoPitch: 0.22,
        shRPitch: -0.92, shRYaw: 0.52, elRPitch: -0.98,
        shLPitch: -0.92, shLYaw: -0.52, elLPitch: -0.98,
      }},
      { t: 1.12, ease: ease.outExpo, pose: {
        crouch: 0.08, torsoPitch: -0.26, headPitch: -0.28,
        shRPitch: -1.55, shRYaw: -0.85, elRPitch: -0.20,
        shLPitch: -1.55, shLYaw: 0.85, elLPitch: -0.20, capePitch: 0.86,
      }},
      { t: 2.25, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, _fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('holyGold', paletteOverride);
      const E = resolvePal('rogueBlood', null);
      const plates = [];

      return [
        { t: 0.18, run() {
          const g = new THREE.Group();
          for (let i = 0; i < 8; i++) {
            const sh = buildTowerShieldAssembly({ palette: P.pal, scale: 0.82, metalColor: '#4a3814' });
            g.add(sh.group);
            plates.push({ sh, ang: (i / 8) * TAU });
          }
          spawnMartialStanceGust3D(sim, {
            x: 0, z: 0, radius: 2.15, duration: 1.25, palette: P.pal, hdr: 2.25, _mapped: true,
          });
          sim.spawnGroundZone({
            x: 0, z: 0, radius: 2.1, duration: 1.45, kind: 'crater', palette: P.pal, eruptRocks: true,
          });
          const dome = new DomeShield3D({
            x: 0, y: 0, z: 0, radius: 1.28, duration: 1.12, palette: P.pal, hdr: 1.75,
          });
          sim.addCustom(dome);

          let elapsed = 0;
          const burstT = 0.94;
          const dur = 1.36;
          sim.addCustom({
            group: g,
            update(dt) {
              elapsed += dt;
              const pop = ease.outBack(clamp(elapsed / 0.18), 1.7);
              const blast = elapsed > burstT ? ease.outExpo(clamp((elapsed - burstT) / 0.32)) : 0;
              const fade = 1 - smooth(dur - 0.25, dur, elapsed);
              for (const p of plates) {
                p.sh.update(dt);
                const a = p.ang + elapsed * 1.35;
                const rad = lerp(1.12, 3.05, blast);
                p.sh.group.position.set(Math.sin(a) * rad, 1.02 + blast * 0.25, Math.cos(a) * rad);
                p.sh.group.rotation.y = a;
                p.sh.group.scale.setScalar(0.82 * Math.max(0.01, pop));
                p.sh.setOpacity(fade);
              }
            },
            get done() { return elapsed >= dur; },
            dispose() { plates.forEach((p) => p.sh.dispose()); },
          });
        }},
        // Enemy crimson slashes hammering the 3D Golden Bell at 0.52s & 0.74s!
        { t: 0.52, run() {
          plates.forEach((p) => p.sh.triggerFlash());
          sim.addCustom(new SlashArc3D({
            center: [0, 1.15, 0.2], radius: 1.55, width: 0.58, thickness: 0.22,
            a0: -1.35, a1: 1.35, tiltZ: 0.42, sweep: 0.06, hold: 0.04, trail: 0.14,
            palette: E.pal, texStyle, defaultTex: 'void', hdrBoost: 2.2, seed: seed + 351,
          }));
          sim.spawnFlipbook({ atlas: 'fbHitBurst', x: 0, y: 1.2, z: 1.18, life: 0.28, size0: 0.85, size1: 1.65, palette: P.pal, hdr: 2.25 });
          for (let s = 0; s < 22; s++) {
            const a = R.range(0, TAU), sp = R.range(2.8, 6.2);
            sim.spawnSpark({ x: Math.sin(a) * 1.1, y: 1.1, z: Math.cos(a) * 1.1, vx: Math.sin(a) * sp, vy: R.range(1.5, 4.5), vz: Math.cos(a) * sp, life: 0.28, size: 0.052, color: P.hotHex });
          }
        }},
        { t: 0.74, run() {
          plates.forEach((p) => p.sh.triggerFlash());
          sim.addCustom(new SlashArc3D({
            center: [0, 1.15, 0.2], radius: 1.58, width: 0.62, thickness: 0.24,
            a0: 1.35, a1: -1.35, tiltZ: -0.45, sweep: 0.06, hold: 0.04, trail: 0.15,
            palette: E.pal, texStyle, defaultTex: 'void', hdrBoost: 2.2, seed: seed + 352,
          }));
          sim.spawnStarGlint(0, 1.2, 1.22, 0.92, '#ffffff', 0.14);
          sim.addLight(0, 1.2, 0, P.hotHex, 4.8, 6.5, 0.32);
          for (let s = 0; s < 24; s++) {
            const a = R.range(0, TAU), sp = R.range(3.2, 6.8);
            sim.spawnSpark({ x: Math.sin(a) * 1.1, y: 1.15, z: Math.cos(a) * 1.1, vx: Math.sin(a) * sp, vy: R.range(1.5, 4.8), vz: Math.cos(a) * sp, life: 0.30, size: 0.052, color: P.hotHex });
          }
        }},
        // Golden Bell Outward Detonation at 1.12s!
        { t: 1.12, run() {
          sim.addCustom(new GroundWave3D({
            x: 0, z: 0, maxRadius: 3.15, thickness: 0.60, height: 0.88, duration: 0.42,
            palette: P.pal, hdr: 2.25, seed: seed + 355,
          }));
          sim.addLight(0, 1.3, 0, P.hotHex, 5.2, 8.0, 0.40);
          for (const d of dummies) {
            d.hit({ dirX: d.homeX, dirZ: d.homeZ, power: 1.65, noPush: false, flashColor: P.hotHex });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // DEFENSE 6: 次元偏轉：虛空雙星門吸收反彈 (前方星門吞噬敵方魔砲 -> 敵頂星門加倍轟落!)
  // =========================================================================
  {
    id: 'def_void_mirror',
    cat: 'defense',
    cls: '時空魔導 Chronomancer',
    title: '次元偏轉：虛空雙星門反彈',
    codeId: 'm.def.rift_reflect',
    duration: 2.35,
    releaseTime: 0.18,
    peakTime: 0.88,
    contactTimes: [0.54, 0.88, 1.24],
    hitbox: { kind: 'circle', cx: 0, cz: 3.8, radius: 2.6 },
    specNotes: [
      '身前展開立體雙環次元鏡門吞噬敵方轟來的重型炎彈，激起空間漣漪完美無傷化解',
      '0.18s 後敵群正上方撕開第二座次元星門，將吸收的能量化為超載虛空巨砲與飛石轟落！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('voidAbyss', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.8, true);
      dummies[1].reset(-1.35, 4.15, true);
      dummies[2].reset(1.35, 4.15, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.10, ease: ease.inOutCubic, pose: {
        crouch: 0.12, torsoPitch: -0.14, torsoYaw: -0.35,
        shRPitch: -1.85, shRYaw: -0.32, elRPitch: -0.32,
        shLPitch: -1.10, shLYaw: 0.35, elLPitch: -0.45,
      }},
      { t: 0.18, ease: ease.outExpo, pose: {
        z: 0.12, crouch: 0.16, torsoPitch: 0.18, torsoYaw: 0.24,
        shRPitch: -1.52, shRYaw: 0.08, elRPitch: -0.08,
        shLPitch: -1.18, shLYaw: -0.32, elLPitch: -0.32, capePitch: 0.56,
      }},
      { t: 0.62, ease: ease.inOutCubic, pose: {
        z: 0.08, crouch: 0.12, torsoPitch: -0.22, headPitch: -0.26,
        shRPitch: -2.25, shRYaw: 0.16, elRPitch: -0.16,
        shLPitch: -2.08, shLYaw: -0.24, elLPitch: -0.20,
      }},
      { t: 0.74, ease: ease.outExpo, pose: {
        z: 0.20, crouch: 0.24, torsoPitch: 0.28, headPitch: 0.08,
        shRPitch: -1.38, shRYaw: 0.12, elRPitch: -0.06,
        shLPitch: -1.06, shLYaw: -0.56, elLPitch: -0.26, capePitch: 0.76,
      }},
      { t: 2.25, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, _fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('voidAbyss', paletteOverride);
      const A = resolvePal('mageArcane', paletteOverride);
      const E = resolvePal('fireInferno', null);

      const spawnPortalRing = (pos, rotX, radius, dur) => {
        const ramp = rampToColors(P.pal, 7);
        const g = new THREE.Group();
        g.position.copy(pos);
        g.rotation.x = rotX;
        const rGeo1 = new THREE.TorusGeometry(radius, 0.065, 10, 40);
        const rGeo2 = new THREE.TorusGeometry(radius * 0.78, 0.038, 8, 32);
        const m1 = new THREE.MeshBasicMaterial({ color: ramp[5].clone().multiplyScalar(1.85), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        const m2 = new THREE.MeshBasicMaterial({ color: ramp[3].clone().multiplyScalar(1.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        const mesh1 = new THREE.Mesh(rGeo1, m1);
        const mesh2 = new THREE.Mesh(rGeo2, m2);
        g.add(mesh1, mesh2);
        let elapsed = 0;
        sim.addCustom({
          group: g,
          update(dt) {
            elapsed += dt;
            const pop = ease.outBack(clamp(elapsed / 0.16), 1.7) * (1 - smooth(dur - 0.25, dur, elapsed));
            g.scale.setScalar(Math.max(0.01, pop));
            mesh1.rotation.z += dt * 3.5;
            mesh2.rotation.z -= dt * 5.5;
          },
          get done() { return elapsed >= dur; },
          dispose() { rGeo1.dispose(); rGeo2.dispose(); m1.dispose(); m2.dispose(); },
        });
      };

      return [
        // Stage 1: Defensive Front Rift Mirror opens at z=1.25
        { t: 0.18, run() {
          spawnPortalRing(new THREE.Vector3(0, 1.22, 1.25), 0, 1.08, 1.05);
          sim.spawnFlipbook({
            atlas: 'fbMagicSwirl', x: 0, y: 1.22, z: 1.25,
            life: 0.95, size0: 1.35, size1: 1.85, palette: P.pal, hdr: 2.0, loopFrames: true,
          });
        }},
        // Stage 2: Enemy heavy firebolt swallowed by the Front Rift at 0.56s!
        { t: 0.30, run() {
          spawnArcaneOrb(sim, {
            p0: new THREE.Vector3(0, 1.35, 4.95),
            p1: new THREE.Vector3(0, 1.22, 1.28),
            arcHeight: 0.22, flightTime: 0.26, palette: E.pal, orbSize: 0.22, heavy: true, flipbookWake: 'fbFlame',
            onImpact: () => {
              sim.addLight(0, 1.22, 1.28, A.hotHex, 4.5, 5.5, 0.25);
              sim.spawnStarGlint(0, 1.22, 1.28, 0.85, '#ffffff', 0.14);
              sim.spawnFlipbook({
                atlas: 'fbHitBurst', x: 0, y: 1.22, z: 1.28,
                life: 0.28, size0: 0.85, size1: 1.75, palette: A.pal, hdr: 2.2,
              });
            },
          });
        }},
        // Stage 3: Second Rift opens high above enemies (y=3.8, z=3.8) & fires amplified Void-Fire Beam down!
        { t: 0.64, run() {
          spawnPortalRing(new THREE.Vector3(0, 3.85, 3.8), Math.PI / 2, 1.28, 1.15);
          sim.spawnFlipbook({
            atlas: 'fbMagicSwirl', x: 0, y: 3.80, z: 3.8,
            life: 1.05, size0: 1.55, size1: 2.15, palette: A.pal, hdr: 2.05, loopFrames: true,
          });
        }},
        { t: 0.74, run() {
          const cx = 0, cz = 3.8;
          sim.addCustom(new BeamCylinder3D({
            p0: new THREE.Vector3(cx, 3.85, cz),
            p1: new THREE.Vector3(cx, 0.02, cz),
            radius: 0.62, duration: 0.72, palette: P.pal,
            texStyle, defaultTex: 'void', hdr: 2.15, muzzleRings: true,
          }));
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 2.54, thickness: 0.54, height: 0.82, duration: 0.40,
            palette: P.pal, hdr: 2.2, seed: seed + 361,
          }));
          sim.addLight(cx, 1.6, cz, P.hotHex, 4.6, 8.0, 0.65);
          sim.spawnFlipbook({
            atlas: 'fbExplosion', x: cx, y: 0.95, z: cz, vy: 0.9,
            life: 0.58, size0: 1.25, size1: 2.55, palette: P.pal, hdr: 2.1,
          });
          for (let r = 0; r < 12; r++) {
            const a = (r / 12) * TAU, sp = R.range(2.4, 5.2);
            sim.spawnFireRock({
              x: cx, y: 0.45, z: cz,
              vx: Math.cos(a) * sp, vy: R.range(2.8, 5.8), vz: Math.sin(a) * sp,
              size: R.range(0.13, 0.22), life: R.range(0.65, 0.98), palette: r % 2 ? P.pal : E.pal, emitSparks: true,
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
  // DEFENSE 7: 聖堂庇護所：浮空四聖盾大穹頂 (2.4m 穹頂 + 4 面浮空 3D 聖盾攔截天降隕石雨!)
  // =========================================================================
  {
    id: 'def_paladin_sanctuary',
    cat: 'defense',
    cls: '聖堂騎士長 Templar',
    title: '聖堂庇護所：浮空聖盾大穹頂',
    codeId: 'p.def.sanctuary_dome',
    duration: 2.45,
    releaseTime: 0.20,
    peakTime: 0.86,
    contactTimes: [0.42, 0.86, 1.28],
    hitbox: { kind: 'circle', cx: 0, cz: 0, radius: 2.6 },
    specNotes: [
      '展開半徑 2.35m 聖光蜂巢大穹頂與黃金戰氣旋流（無魔法陣），4 面立體 3D 聖堂塔盾沿穹頂赤道巡弋護衛',
      '高空三顆燃燒 3D 隕石接連砸向穹頂天幕，觸發球面擴散波紋並於盾外炸裂成無害彈跳火石！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('sword_shield', hotHex);
      dummies[0].reset(0, 0, false);
      dummies[1].reset(0, 0, false);
      dummies[2].reset(0, 0, false);
    },
    keyframes: makeSkyChantKeyframes(0.12, 0.20, 2.35),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('holyGold', paletteOverride);
      const E = resolvePal('fireInferno', null);
      const domeR = 2.32;
      let domeRef = null;

      const evs = [
        { t: 0.20, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 1.15, width: 0.30, palette: P.pal, hdr: 2.35 });
          spawnMartialStanceGust3D(sim, {
            x: 0, z: 0, radius: 2.15, duration: 1.45, palette: P.pal, hdr: 2.25, _mapped: true,
          });
          domeRef = new DomeShield3D({
            x: 0, y: 0, z: 0, radius: domeR, duration: 1.90, palette: P.pal, hdr: 1.95,
          });
          sim.addCustom(domeRef);
          sim.addLight(0, 1.5, 0, P.midHex, 4.2, 7.0, 1.80);

          // 4 Orbiting 3D Paladin Shields guarding the dome perimeter!
          const g = new THREE.Group();
          const shields = [];
          for (let i = 0; i < 4; i++) {
            const sh = buildTowerShieldAssembly({ palette: P.pal, scale: 0.78 });
            g.add(sh.group);
            shields.push({ sh, a0: (i / 4) * TAU });
          }
          let elapsed = 0;
          const dur = 1.85;
          sim.addCustom({
            group: g,
            update(dt) {
              elapsed += dt;
              const fade = 1 - smooth(dur - 0.3, dur, elapsed);
              for (const s of shields) {
                s.sh.update(dt);
                const a = s.a0 + elapsed * 2.2;
                s.sh.group.position.set(Math.sin(a) * (domeR + 0.12), 0.98 + Math.sin(elapsed * 4 + s.a0) * 0.12, Math.cos(a) * (domeR + 0.12));
                s.sh.group.rotation.y = a;
                s.sh.setOpacity(fade);
              }
            },
            get done() { return elapsed >= dur; },
            dispose() { shields.forEach((s) => s.sh.dispose()); },
          });
        }},
      ];

      // 3 Incoming Sky Meteors intercepted on the 3D Sanctuary Dome roof!
      [
        { t: 0.32, p0: new THREE.Vector3(-2.6, 5.6, 2.2), dir: new THREE.Vector3(-0.42, 0.78, 0.46).normalize() },
        { t: 0.50, p0: new THREE.Vector3( 2.4, 5.8, 1.8), dir: new THREE.Vector3( 0.40, 0.82, 0.41).normalize() },
        { t: 0.68, p0: new THREE.Vector3( 0.0, 6.0, 3.2), dir: new THREE.Vector3( 0.00, 0.76, 0.65).normalize() },
      ].forEach((m, idx) => {
        evs.push({
          t: m.t,
          run() {
            const hitPt = m.dir.clone().multiplyScalar(domeR);
            const meteor = buildMagmaMeteorAssembly({ radius: 0.38, palette: E.pal, seed: seed + 70 + idx * 13 });
            meteor.group.position.copy(m.p0);
            const flight = 0.34;
            let elapsed = 0;
            sim.addCustom({
              group: meteor.group,
              update(dt) {
                elapsed += dt;
                const u = clamp(elapsed / flight);
                meteor.group.position.lerpVectors(m.p0, hitPt, ease.inQuad(u));
                meteor.update(dt, u);
                if (elapsed >= flight) {
                  domeRef?.triggerHit(m.dir);
                  sim.spawnStarGlint(hitPt.x, hitPt.y, hitPt.z, 0.95, '#ffffff', 0.15);
                  sim.spawnFlipbook({
                    atlas: 'fbExplosion', x: hitPt.x, y: hitPt.y, z: hitPt.z,
                    life: 0.46, size0: 0.95, size1: 1.95, palette: E.pal, hdr: 2.05,
                  });
                  sim.spawnFlipbook({
                    atlas: 'fbHitBurst', x: hitPt.x, y: hitPt.y, z: hitPt.z,
                    life: 0.30, size0: 0.95, size1: 1.95, palette: P.pal, hdr: 2.25,
                  });
                  for (let r = 0; r < 7; r++) {
                    const tangent = new THREE.Vector3(R.range(-1, 1), 0.3, R.range(-1, 1)).normalize();
                    const sp = R.range(3.2, 5.8);
                    sim.spawnFireRock({
                      x: hitPt.x, y: hitPt.y, z: hitPt.z,
                      vx: (m.dir.x + tangent.x * 0.6) * sp,
                      vy: R.range(1.2, 3.8),
                      vz: (m.dir.z + tangent.z * 0.6) * sp,
                      size: R.range(0.12, 0.20), life: 0.78, palette: E.pal, emitSparks: true,
                    });
                  }
                }
              },
              get done() { return elapsed >= flight; },
              dispose() { meteor.dispose(); },
            });
          },
        });
      });

      return evs;
    },
  },

  // =========================================================================
  // DEFENSE 8: 風神障壁：翡翠氣旋偏轉風牆 (雙層立體亂流風牆 -> 將 4 支敵方烈焰標槍吹飛上天!)
  // =========================================================================
  {
    id: 'def_zephyr_windwall',
    cat: 'defense',
    cls: '疾風劍豪 Windwalker',
    title: '風神障壁：翡翠氣旋偏轉牆',
    codeId: 'w.def.wind_wall',
    duration: 2.30,
    releaseTime: 0.20,
    peakTime: 0.78,
    contactTimes: [0.42, 0.78, 1.16],
    hitbox: { kind: 'rect', width: 4.2, length: 2.2 },
    specNotes: [
      '揮杖掀起雙道水平旋轉翡翠氣流管與亂流風刃幕牆，地面翻騰翠綠氣旋雲霧',
      '敵方連續投射 4 支 3D 烈焰標槍，撞入風牆瞬間被強風暴力吹歪拋飛上天！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('windJade', paletteOverride);
      fighter.setLoadout('spear', hotHex);
      dummies[0].reset(0, 0, false);
      dummies[1].reset(0, 0, false);
      dummies[2].reset(0, 0, false);
    },
    keyframes: makeStaffCastKeyframes(0.12, 0.20, 2.20),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('windJade', paletteOverride);
      const E = resolvePal('fireInferno', null);

      const evs = [
        { t: 0.20, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 1.10, width: 0.34, palette: P.pal, hdr: 2.45, sparkRate: 32 });
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.65, duration: 1.05, palette: P.pal, hdr: 2.2, _mapped: true });
          for (const yRow of [0.65, 1.55]) {
            sim.addCustom(new VortexFunnel3D({
              x: -1.95, y: yRow, z: 1.55, rBottom: 0.38, rTop: 0.48, height: 3.9,
              duration: 1.65, spinSpeed: 13.5, riseSpeed: 3.8, twist: 2.8, leanX: Math.PI / 2,
              palette: P.pal, texStyle, defaultTex: 'silk', hdr: 1.85,
            }));
          }
          for (let i = 0; i < 5; i++) {
            const wx = lerp(-1.5, 1.5, i / 4);
            sim.spawnFlipbook({
              atlas: 'fbSmoke', x: wx, y: 0.55, z: 1.55, vy: 1.15,
              life: 1.15, size0: 0.85, size1: 1.85, palette: P.pal, hdr: 1.2, opacity: 0.55, additive: false, delay: i * 0.05,
            });
          }
          sim.addCustom(new SlashArc3D({
            center: [0, 1.1, 1.45], radius: 2.15, width: 0.85, thickness: 0.28,
            a0: -1.35, a1: 1.35, tiltZ: 0.08, sweep: 0.08, hold: 0.35, trail: 0.85,
            palette: P.pal, texStyle, defaultTex: 'silk', hdrBoost: 2.1, seed: seed + 381,
          }));
          sim.addLight(0, 1.2, 1.55, P.hotHex, 4.2, 6.5, 1.55);
        }},
      ];

      // 4 Tangible 3D Blazing Javelins deflected skyward upon hitting the Wind Wall at z=1.65!
      [-1.15, -0.38, 0.38, 1.15].forEach((jx, idx) => {
        const launchT = 0.30 + idx * 0.11;
        evs.push({
          t: launchT,
          run() {
            const jav = buildSpiritSwordAssembly({ palette: E.pal, scale: 0.95 });
            const tr = new RibbonTrail3D({ maxPoints: 18, width: 0.16, palette: E.pal, hdr: 2.0 });
            sim.root.add(tr.group);

            const pStart = new THREE.Vector3(jx * 1.25, 1.35, 5.45);
            const pWall  = new THREE.Vector3(jx, 1.18, 1.68);
            const pSky   = new THREE.Vector3(jx * 2.4 + (idx % 2 ? 0.9 : -0.9), 4.85, 2.45);
            const yAxis = new THREE.Vector3(0, 1, 0);
            const prevPos = pStart.clone(), dir = new THREE.Vector3();
            let deflected = false;
            let elapsed = 0;
            const total = 0.72;

            sim.addCustom({
              group: jav.group,
              update(dt) {
                elapsed += dt;
                const u = clamp(elapsed / total);
                if (u < 0.42) {
                  const k = u / 0.42;
                  jav.group.position.lerpVectors(pStart, pWall, k);
                } else {
                  if (!deflected) {
                    deflected = true;
                    sim.spawnFlipbook({
                      atlas: 'fbHitBurst', x: pWall.x, y: pWall.y, z: pWall.z,
                      life: 0.26, size0: 0.68, size1: 1.42, palette: P.pal, hdr: 2.2,
                    });
                    for (let s = 0; s < 12; s++) {
                      sim.spawnSpark({
                        x: pWall.x, y: pWall.y, z: pWall.z,
                        vx: R.range(-2.5, 2.5), vy: R.range(3.5, 7.2), vz: R.range(0.5, 3.0),
                        life: 0.26, size: 0.048, color: P.hotHex,
                      });
                    }
                  }
                  const k = (u - 0.42) / 0.58;
                  jav.group.position.lerpVectors(pWall, pSky, ease.outQuad(k));
                  jav.group.rotateZ(dt * 18);
                }
                dir.subVectors(jav.group.position, prevPos);
                if (dir.lengthSq() > 1e-6) {
                  dir.normalize();
                  if (!deflected) jav.group.quaternion.setFromUnitVectors(yAxis, dir);
                }
                prevPos.copy(jav.group.position);
                tr.pushPoint(jav.group.position.clone());
                tr.update(dt, u > 0.8 ? 1 / 0.16 : 0);
                jav.setOpacity(1 - smooth(0.78, 1.0, u));
              },
              get done() { return elapsed >= total; },
              dispose() {
                sim.root.remove(tr.group);
                tr.dispose();
                jav.dispose();
              },
            });
          },
        });
      });

      return evs;
    },
  },

  // =========================================================================
  // PROP 9 (EARTH): 泰坦擲岩：破土巨岩投擲粉碎 (雙手拔起 1.2m 凹凸立體巨岩 -> 拋射砸碎成 20 顆彈跳飛石!)
  // =========================================================================
  {
    id: 'earth_boulder_toss',
    cat: 'earth',
    cls: '泰坦狂戰 Titan',
    title: '泰坦擲岩：巨型熔岩飛石粉碎',
    codeId: 'w.skill.boulder_hurl',
    duration: 2.35,
    releaseTime: 0.44,
    peakTime: 0.88,
    contactTimes: [0.44, 0.88, 1.28],
    hitbox: { kind: 'circle', cx: 0, cz: 3.9, radius: 3.2 },
    specNotes: [
      '雙手插入地面硬生生拔起直徑 1.2m 的焊接頂點凹凸熔岩巨石舉過頭頂，碎土紛紛滑落',
      '0.44s 猛力拋投砸入敵群，巨石當場粉碎為 20 顆帶火光拖尾與真實地板彈跳的 3D 飛石塊！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('earthMagma', paletteOverride);
      fighter.setLoadout('unarmed', hotHex);
      dummies[0].reset(0, 3.9, true);
      dummies[1].reset(-1.45, 4.25, true);
      dummies[2].reset(1.45, 4.25, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.12, ease: ease.outQuad, pose: { crouch: 0.34, torsoPitch: 0.48, shRPitch: -1.15, shLPitch: -1.15, elRPitch: -0.25, elLPitch: -0.25 } },
      { t: 0.34, ease: ease.inOutCubic, pose: { crouch: 0.10, torsoPitch: -0.24, shRPitch: -2.65, shLPitch: -2.65, elRPitch: -0.18, elLPitch: -0.18 } },
      { t: 0.44, ease: ease.outExpo, pose: { z: 0.25, crouch: 0.22, torsoPitch: 0.34, shRPitch: -1.35, shLPitch: -1.35, capePitch: 0.72 } },
      { t: 2.25, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, _fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('earthMagma', paletteOverride);
      const cx = 0, cz = 3.9;

      return [
        { t: 0.12, isPreGather: true, run() {
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.75, duration: 0.72, palette: P.pal, hdr: 2.2, _mapped: true });
          spawnGroundCracks(sim, R, { cx: 0, cz: 0.65, maxRadius: 1.45, branches: 6, life: 0.75, palette: P.pal, rockCount: 6, rockScale: 0.65 });
          const geo = makeCraggyRockGeo(0.64, 2, 0.32, seed + 91, 0.92);
          const mat = makeMagmaRockMaterial({ palette: P.pal, rockColor: '#2c221d', veinStrength: 2.0 });
          const boulder = new THREE.Mesh(geo, mat);
          const pGround = new THREE.Vector3(0, 0.35, 0.65);
          const pOverhead = new THREE.Vector3(0, 2.35, 0.15);
          let elapsed = 0;
          const liftDur = 0.32;
          sim.addCustom({
            mesh: boulder,
            _skipAutoMap: true,
            update(dt) {
              elapsed += dt;
              const u = ease.outBack(clamp(elapsed / liftDur), 1.4);
              boulder.position.lerpVectors(pGround, pOverhead, u);
              boulder.scale.setScalar(clamp(elapsed / 0.12));
              boulder.rotation.x = u * 0.6;
            },
            get done() { return elapsed >= liftDur; },
            dispose() { geo.dispose(); mat.dispose(); },
          });
        }},
        { t: 0.44, run() {
          const [tx, tz] = sim.mapSkillXZ(cx, cz, false);
          spawnMachShockRings3D(sim, {
            p0: new THREE.Vector3(0, 2.15, 0.35), p1: new THREE.Vector3(tx, 0.95, tz),
            count: 4, r0: 0.36, r1: 0.92, duration: 0.38, palette: P.pal, _mapped: true,
          });
          const geo = makeCraggyRockGeo(0.64, 2, 0.32, seed + 91, 0.92);
          const mat = makeMagmaRockMaterial({ palette: P.pal, rockColor: '#2c221d', veinStrength: 2.0 });
          const boulder = new THREE.Mesh(geo, mat);
          const pOverhead = new THREE.Vector3(0, 2.35, 0.15);
          const pTarget = new THREE.Vector3(tx, 0.55, tz);
          boulder.position.copy(pOverhead);
          boulder.rotation.x = 0.6;
          let elapsed = 0;
          const flightDur = 0.36;
          sim.addCustom({
            mesh: boulder,
            _skipAutoMap: true,
            update(dt) {
              elapsed += dt;
              const u = clamp(elapsed / flightDur);
              boulder.position.lerpVectors(pOverhead, pTarget, u);
              boulder.position.y += Math.sin(u * Math.PI) * 1.45;
              boulder.rotation.x += dt * 7.5;
              boulder.rotation.z += dt * 4.2;
            },
            get done() { return elapsed >= flightDur; },
            dispose() { geo.dispose(); mat.dispose(); },
          });
        }},
        // Colossal Boulder Shatter Impact at 0.80s!
        { t: 0.80, run() {
          sim.addLight(cx, 1.4, cz, P.hotHex, 5.4, 9.5, 0.52);
          sim.spawnStarGlint(cx, 0.85, cz, 1.15, '#ffffff', 0.16);
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 3.12, thickness: 0.62, height: 0.92, duration: 0.44,
            palette: P.pal, hdr: 2.2, seed: seed + 391,
          }));
          spawnGroundCracks(sim, R, { cx, cz, maxRadius: 3.05, branches: 10, life: 1.05, palette: P.pal, rockCount: 10, rockScale: 1.05 });

          sim.spawnFlipbook({
            atlas: 'fbExplosion', x: cx, y: 1.05, z: cz, vy: 0.95,
            life: 0.64, size0: 1.45, size1: 2.95, palette: P.pal, hdr: 2.1,
          });
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbSmoke', x: cx + Math.cos(a) * 0.85, y: 1.15, z: cz + Math.sin(a) * 0.85,
              vx: Math.cos(a) * 0.8, vy: 1.35, vz: Math.sin(a) * 0.8,
              life: 0.85, size0: 1.15, size1: 2.45, palette: P.pal, hdr: 1.1, opacity: 0.72, additive: false,
            });
          }
          // 20 Solid Craggy 3D Boulders & Flaming Chunks bouncing across the floor!
          for (let r = 0; r < 20; r++) {
            const a = (r / 20) * TAU + R.range(-0.12, 0.12);
            const sp = R.range(2.6, 6.4);
            sim.spawnFireRock({
              x: cx + Math.cos(a) * 0.35, y: 0.55, z: cz + Math.sin(a) * 0.35,
              vx: Math.cos(a) * sp, vy: R.range(3.4, 7.2), vz: Math.sin(a) * sp,
              size: R.range(0.16, 0.34), life: R.range(0.82, 1.25),
              palette: P.pal, emitSparks: true, emitFlame: r % 5 === 0,
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
  // PROP 10 (HOLY): 天界裁決：五米神罰巨劍貫地 (高空聖陣降下 5.4m 實體 3D 黃金巨劍插地鎮壓!)
  // =========================================================================
  {
    id: 'holy_sky_greatsword',
    cat: 'holy',
    cls: '神聖裁決官 Inquisitor',
    title: '天界裁決：神罰巨劍貫地',
    codeId: 'p.skill.sky_greatsword',
    duration: 2.45,
    releaseTime: 0.26,
    peakTime: 0.84,
    contactTimes: [0.46, 0.84, 1.38],
    hitbox: { kind: 'circle', cx: 0, cz: 3.7, radius: 3.5 },
    specNotes: [
      '破開高空音爆雲洞與四重垂直馬赫環（無魔法陣），長達 5.4 公尺的有形 3D 菱形切面神罰巨劍破空垂直貫落！',
      '0.68s 巨劍深深釘入戰場中央震顫嗡鳴，炸開十字黃金刀疤裂谷、氣浪與 16 顆彈跳金脈飛石！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      dummies[0].reset(0, 4.95, true);
      dummies[1].reset(-1.75, 3.65, true);
      dummies[2].reset(1.75, 3.65, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.16, ease: ease.inOutCubic, pose: {
        crouch: 0.12, torsoPitch: -0.22, headPitch: -0.28,
        shRPitch: -2.25, shRYaw: 0.14, elRPitch: -0.14,
        shLPitch: -2.10, shLYaw: -0.20, elLPitch: -0.22, capePitch: 0.48,
      }},
      { t: 0.26, ease: ease.outExpo, pose: {
        z: 0.14, crouch: 0.18, torsoPitch: 0.20, headPitch: 0.04,
        shRPitch: -1.52, shRYaw: 0.10, elRPitch: -0.06,
        shLPitch: -1.32, shLYaw: -0.24, elLPitch: -0.18, capePitch: 0.66,
      }},
      { t: 0.54, ease: ease.inOutCubic, pose: {
        z: 0.08, crouch: 0.14, torsoPitch: -0.24,
        shRPitch: -2.35, shRYaw: 0.12, elRPitch: -0.10,
        shLPitch: -2.15, shLYaw: -0.22, elLPitch: -0.24,
      }},
      { t: 0.68, ease: ease.outExpo, pose: {
        z: 0.24, crouch: 0.28, torsoPitch: 0.36,
        shRPitch: -1.20, shRYaw: 0.14, elRPitch: -0.05,
        shLPitch: -1.12, shLYaw: -0.20, elLPitch: -0.18, capePitch: 0.80,
      }},
      { t: 2.35, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('holyGold', paletteOverride);
      const cx = 0, cz = 3.7;

      return [
        { t: 0.05, isPreGather: true, run() {
          const tip = fighter.getSwordTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.65, P.hotHex, 0.18, true);
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.85, width: 0.38, palette: P.pal, hdr: 2.55, sparkRate: 36 });
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.68, duration: 0.78, palette: P.pal, hdr: 2.25, _mapped: true });
        }},
        { t: 0.26, run() {
          sim.addCustom(new ShockSphere3D({
            x: cx, y: 5.65, z: cz, r0: 0.35, r1: 2.45, duration: 0.48,
            palette: P.pal, hdr: 2.45, useRunes: false,
          }));
          spawnMachShockRings3D(sim, {
            p0: new THREE.Vector3(cx, 7.6, cz), p1: new THREE.Vector3(cx, 1.35, cz),
            count: 5, r0: 0.55, r1: 1.85, duration: 0.46, palette: P.pal,
          });
          const colossalSword = buildSpiritSwordAssembly({ palette: P.pal, scale: 3.85 });
          const g = colossalSword.group;
          // Blade tip is at +Y (1.22 * 3.85 = 4.70m), so rotate X by PI to point razor tip straight DOWN!
          g.rotation.x = Math.PI;
          g.position.set(cx, 8.8, cz);

          let elapsed = 0;
          const dropDur = 0.42; // hits ground at t = 0.26 + 0.42 = 0.68s!
          const totalDur = 1.78;
          sim.addCustom({
            group: g,
            update(dt) {
              elapsed += dt;
              if (elapsed <= dropDur) {
                const u = ease.inCubic(clamp(elapsed / dropDur));
                // Tip touches y=0.0 when group.y = 4.35 (embedded 0.35m deep into crater!)
                g.position.set(cx, lerp(8.8, 4.25, u), cz);
              } else {
                const post = elapsed - dropDur;
                const vib = post < 0.35 ? Math.sin(post * 85) * 0.05 * (1 - post / 0.35) : 0;
                g.position.set(cx + vib, 4.25, cz);
              }
              colossalSword.setOpacity(1 - smooth(totalDur - 0.35, totalDur, elapsed));
            },
            get done() { return elapsed >= totalDur; },
            dispose() { colossalSword.dispose(); },
          });
        }},
        // Colossal Greatsword Earth-Shattering Impact at 0.68s!
        { t: 0.68, run() {
          sim.addLight(cx, 1.8, cz, P.hotHex, 5.6, 10.5, 0.75);
          sim.spawnStarGlint(cx, 1.1, cz, 1.35, '#ffffff', 0.18);
          for (const [si, yaw] of [[0, 0.55], [1, -0.55]]) {
            spawnBladeGroundScar3D(sim, {
              x: cx, z: cz, yaw, length: 3.15, width: 0.42, duration: 1.45,
              palette: P.pal, zoneKind: 'holy', eruptRocks: si === 0, seed: seed + 403 + si,
            });
          }
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 3.44, thickness: 0.66, height: 0.98, duration: 0.46,
            palette: P.pal, hdr: 2.3, seed: seed + 401,
          }));
          spawnGroundCracks(sim, R, { cx, cz, maxRadius: 3.35, branches: 11, life: 1.35, palette: P.pal, rockCount: 12, rockScale: 1.15 });

          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: cx, y: 1.25, z: cz,
            life: 0.38, size0: 1.45, size1: 2.95, palette: P.pal, hdr: 2.35,
          });
          sim.spawnFlipbook({
            atlas: 'fbExplosion', x: cx, y: 1.05, z: cz, vy: 0.95,
            life: 0.62, size0: 1.35, size1: 2.75, palette: P.pal, hdr: 2.05,
          });
          for (let r = 0; r < 16; r++) {
            const a = (r / 16) * TAU + R.range(-0.1, 0.1);
            const sp = R.range(2.8, 6.2);
            sim.spawnFireRock({
              x: cx + Math.cos(a) * 0.45, y: 0.45, z: cz + Math.sin(a) * 0.45,
              vx: Math.cos(a) * sp, vy: R.range(3.5, 6.8), vz: Math.sin(a) * sp,
              size: R.range(0.15, 0.28), life: R.range(0.75, 1.15),
              palette: P.pal, rockColor: '#3a3228', emitSparks: true,
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz + 0.3, power: 1.75, noPush: false, flashColor: P.hotHex });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // PROP 11 (SHADOW): 冥獄鎖鏈：立體鐵鏈穿刺禁錮 (6 條一環扣一環 3D 鐵鎖鏈破地交叉縛敵 -> 扯碎引爆!)
  // =========================================================================
  {
    id: 'shadow_abyss_chains',
    cat: 'shadow',
    cls: '冥獄典獄長 Jailer',
    title: '冥獄鎖鏈：立體鐵鏈穿刺禁錮',
    codeId: 'm.skill.abyss_chains',
    duration: 2.40,
    releaseTime: 0.24,
    peakTime: 0.86,
    contactTimes: [0.42, 0.86, 1.38],
    hitbox: { kind: 'circle', cx: 0, cz: 3.6, radius: 3.2 },
    specNotes: [
      '巨鐮裂地撕開外圍 6 道冥獄暗影裂縫（無魔法陣），同時射出由 96 個立體交錯金屬鏈環組成的 3D 倒鉤鎖鏈交叉貫穿目標！',
      '0.65s 鎖鏈猛然繃緊拉直迸發火星，1.28s 過載扯斷引爆深淵血焰與飛散碎鏈塊！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('voidAbyss', paletteOverride);
      fighter.setLoadout('scythe', hotHex);
      dummies[0].reset(0, 3.6, true);
      dummies[1].reset(-1.35, 3.95, true);
      dummies[2].reset(1.35, 3.95, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.14, ease: ease.inOutCubic, pose: {
        crouch: 0.16, torsoPitch: -0.14, torsoYaw: -0.52,
        shRPitch: -1.65, shRYaw: -0.68, elRPitch: -0.10, wrRYaw: 1.25,
        shLPitch: -1.18, shLYaw: 0.42, elLPitch: -0.42,
      }},
      { t: 0.24, ease: ease.outExpo, pose: {
        z: 0.16, crouch: 0.22, torsoPitch: 0.22, torsoYaw: 0.48,
        shRPitch: -1.46, shRYaw: 0.62, elRPitch: -0.05, wrRYaw: 1.25,
        shLPitch: -1.10, shLYaw: -0.42, elLPitch: -0.35, capePitch: 0.68,
      }},
      { t: 1.08, ease: ease.inOutCubic, pose: {
        z: 0.06, crouch: 0.14, torsoPitch: -0.22, torsoYaw: -0.35,
        shRPitch: -2.15, shRYaw: -0.45, elRPitch: -0.16,
        shLPitch: -1.95, shLYaw: 0.35, elLPitch: -0.25,
      }},
      { t: 1.28, ease: ease.outExpo, pose: {
        z: 0.22, crouch: 0.26, torsoPitch: 0.32, torsoYaw: 0.42,
        shRPitch: -1.32, shRYaw: 0.58, elRPitch: -0.06, wrRYaw: 1.25,
        shLPitch: -1.05, shLYaw: -0.52, elLPitch: -0.28, capePitch: 0.80,
      }},
      { t: 2.30, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('voidAbyss', paletteOverride);
      const B = resolvePal('rogueBlood', paletteOverride);
      const cx = 0, cz = 3.6;

      return [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getSwordTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.60, B.hotHex, 0.16, true);
          attachWeaponBladeTrail3D(sim, fighter, { duration: 1.35, width: 0.38, palette: B.pal, hdr: 2.5, sparkRate: 34 });
        }},
        { t: 0.24, run() {
          spawnBladeGroundScar3D(sim, {
            x: cx, z: cz, yaw: 0.42, length: 2.85, width: 0.38, duration: 1.38,
            palette: P.pal, zoneKind: 'void', eruptRocks: true, seed: seed + 411,
          });
          const holder = new THREE.Group();
          const chains = [];
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + 0.25;
            const p0 = new THREE.Vector3(cx + Math.cos(a) * 2.75, 0.12, cz + Math.sin(a) * 2.75);
            const p1 = new THREE.Vector3(cx - Math.cos(a) * 0.65, 1.28 + (i % 2) * 0.32, cz - Math.sin(a) * 0.65);
            const ch = buildChainStrandAssembly({
              p0, p1, sag: 0.34, linkCount: 16, palette: i % 2 === 0 ? P.pal : B.pal,
            });
            holder.add(ch.group);
            chains.push(ch);

            sim.spawnFlipbook({
              atlas: 'fbDarkVortex', x: p0.x, y: 0.18, z: p0.z,
              life: 0.95, size0: 0.65, size1: 0.95, palette: P.pal, hdr: 1.9, loopFrames: true,
            });
          }

          let elapsed = 0;
          const snapT = 1.04; // snaps & explodes at 0.24 + 1.04 = 1.28s!
          sim.addCustom({
            group: holder,
            update(dt) {
              elapsed += dt;
              const ext = ease.outExpo(clamp(elapsed / 0.22));
              const tighten = smooth(0.22, 0.48, elapsed);
              const curSag = lerp(0.36, -0.04, tighten);
              for (const ch of chains) {
                ch.layout(ext, curSag);
              }
            },
            get done() { return elapsed >= snapT; },
            dispose() { chains.forEach((c) => c.dispose()); },
          });

          for (const d of dummies) {
            d.hit({ dirX: 0, dirZ: 0, power: 1.0, noPush: true, flashColor: B.hotHex, shiver: 0.95 });
          }
          sim.addLight(cx, 1.3, cz, P.hotHex, 4.5, 7.0, 1.05);
        }},
        // Chains Snap & Violently Detonate at 1.28s!
        { t: 1.28, run() {
          sim.addLight(cx, 1.3, cz, B.hotHex, 5.5, 8.5, 0.45);
          sim.spawnStarGlint(cx, 1.25, cz, 1.15, '#ffffff', 0.16);
          sim.spawnFlipbook({
            atlas: 'fbExplosion', x: cx, y: 1.25, z: cz,
            life: 0.58, size0: 1.35, size1: 2.85, palette: P.pal, hdr: 2.15,
          });
          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: cx, y: 1.25, z: cz,
            life: 0.34, size0: 1.25, size1: 2.55, palette: B.pal, hdr: 2.3,
          });
          for (let r = 0; r < 16; r++) {
            const a = (r / 16) * TAU, sp = R.range(3.0, 6.5);
            sim.spawnFireRock({
              x: cx, y: 1.15, z: cz,
              vx: Math.cos(a) * sp, vy: R.range(2.0, 5.5), vz: Math.sin(a) * sp,
              size: R.range(0.11, 0.19), life: R.range(0.58, 0.92),
              palette: r % 2 ? P.pal : B.pal, rockColor: '#1f1929', emitSparks: true,
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz + 0.3, power: 1.7, noPush: false, flashColor: B.hotHex });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // PROP 12 (VOLT): 雷神戰錘：鍛造天雷轟擊 (2.4x 巨型立體八角戰錘揮砸地面 + 鐵砧雷暴火渣!)
  // =========================================================================
  {
    id: 'volt_storm_hammer',
    cat: 'volt',
    cls: '雷霆鍛造師 Stormforger',
    title: '雷神戰錘：鍛造天雷轟擊',
    codeId: 'w.skill.storm_hammer',
    duration: 2.30,
    releaseTime: 0.64,
    peakTime: 0.72,
    contactTimes: [0.64, 0.72, 1.18],
    hitbox: { kind: 'circle', cx: 0, cz: 3.4, radius: 3.3 },
    specNotes: [
      '凝聚 2.3 倍巨型立體八角符文雷神戰錘，攜帶高壓電弧刀紋弧由頭頂猛力砸落地面！',
      '0.64s 重錘貫地引動九天雷柱與鍛造火花，炸飛 18 顆高彈性熾熱雷紋熔渣塊滿場彈跳！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      dummies[0].reset(0, 3.4, true);
      dummies[1].reset(-1.55, 3.85, true);
      dummies[2].reset(1.55, 3.85, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.38, ease: ease.inOutCubic, pose: { crouch: 0.14, torsoPitch: -0.26, shRPitch: -2.45, shLPitch: -2.35, elRPitch: -0.15, elLPitch: -0.20 } },
      { t: 0.64, ease: ease.inCubic, pose: { z: 0.32, crouch: 0.32, torsoPitch: 0.42, shRPitch: -1.12, shLPitch: -1.08, capePitch: 0.78 } },
      { t: 2.20, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('mageVolt', paletteOverride);
      const G = resolvePal('warriorGold', paletteOverride);
      const cx = 0, cz = 3.4;

      return [
        { t: 0.10, isPreGather: true, run() {
          attachWeaponBladeTrail3D(sim, fighter, { duration: 0.85, width: 0.40, palette: P.pal, hdr: 2.55, sparkRate: 38 });
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.68, duration: 0.68, palette: P.pal, hdr: 2.25, _mapped: true });
          const hammer = buildWarhammerAssembly({ palette: P.pal, scale: 2.15 });
          // Pivot from haft base so it swings in a massive overhead arc onto z=3.4!
          const pivot = new THREE.Group();
          pivot.position.set(0, 1.35, 0.55);
          hammer.group.position.set(0, 2.55, 0);
          hammer.group.rotation.y = Math.PI / 2; // Striking face points along swing!
          pivot.add(hammer.group);

          let elapsed = 0;
          const swingStart = 0.28;
          const hitTime = 0.54; // 0.10 + 0.54 = 0.64s!
          sim.addCustom({
            group: pivot,
            _skipAutoMap: true,
            update(dt) {
              elapsed += dt;
              const pop = ease.outBack(clamp(elapsed / 0.18), 1.6);
              pivot.scale.setScalar(Math.max(0.01, pop));
              if (elapsed < swingStart) {
                pivot.rotation.x = lerp(-0.25, -0.55, elapsed / swingStart);
              } else {
                const u = ease.inCubic(clamp((elapsed - swingStart) / (hitTime - swingStart)));
                pivot.rotation.x = lerp(-0.55, 1.42, u);
              }
            },
            get done() { return elapsed >= hitTime; },
            dispose() { hammer.dispose(); },
          });
        }},
        // Colossal Warhammer Anvil Impact at 0.64s!
        { t: 0.64, run() {
          const slash = new SlashArc3D({
            center: [0, 1.35, 1.25], radius: 2.45, width: 1.05, thickness: 0.32,
            a0: -1.45, a1: 0.65, tiltZ: -Math.PI / 2,
            sweep: 0.05, hold: 0.05, trail: 0.18,
            palette: P.pal, texStyle, defaultTex: 'volt', hdrBoost: 2.4, seed: seed + 421,
          });
          slash._skipAutoMap = true;
          sim.addCustom(slash);

          const hammer = buildWarhammerAssembly({ palette: P.pal, scale: 2.15 });
          const pivot = new THREE.Group();
          pivot.position.set(0, 1.35, 0.55);
          hammer.group.position.set(0, 2.55, 0);
          hammer.group.rotation.y = Math.PI / 2;
          pivot.rotation.x = 1.42;
          pivot.add(hammer.group);
          let hEl = 0;
          const lingerDur = 0.91;
          sim.addCustom({
            group: pivot,
            _skipAutoMap: true,
            update(dt) {
              hEl += dt;
              hammer.update?.(dt);
              hammer.setOpacity(1 - smooth(lingerDur - 0.30, lingerDur, hEl));
            },
            get done() { return hEl >= lingerDur; },
            dispose() { hammer.dispose(); },
          });
          fighter.hitStop = 0.095;
          sim.addLight(cx, 1.6, cz, P.hotHex, 5.5, 9.5, 0.52);
          sim.spawnStarGlint(cx, 0.65, cz, 1.25, '#ffffff', 0.16);
          sim.spawnLightning({
            p0: new THREE.Vector3(cx + 0.2, 6.2, cz - 0.2),
            p1: new THREE.Vector3(cx, 0.45, cz),
            life: 0.38, jag: 0.22, depth: 4, forks: 4, palette: P.pal, thickness: 0.11,
          });
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 3.24, thickness: 0.62, height: 0.92, duration: 0.42,
            palette: P.pal, hdr: 2.25, seed: seed + 422,
          }));
          spawnBladeGroundScar3D(sim, {
            x: cx, z: cz, yaw: 0, length: 2.95, width: 0.42, duration: 1.25,
            palette: P.pal, zoneKind: 'lightning', eruptRocks: true, seed: seed + 425,
          });
          spawnGroundCracks(sim, R, { cx, cz, maxRadius: 3.15, branches: 10, life: 1.15, palette: P.pal, rockCount: 10, rockScale: 1.0 });

          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: cx, y: 0.85, z: cz,
            life: 0.34, size0: 1.25, size1: 2.65, palette: G.pal, hdr: 2.35,
          });
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbLightning', x: cx + Math.cos(a) * 1.05, y: 0.95, z: cz + Math.sin(a) * 1.05,
              life: 0.42, size0: 1.05, size1: 1.85, palette: P.pal, hdr: 2.2, loopFrames: true,
            });
          }
          // 18 High-Bounce Forging Slag & Volt-Crystal Rocks!
          for (let r = 0; r < 18; r++) {
            const a = (r / 18) * TAU + R.range(-0.1, 0.1), sp = R.range(2.8, 6.4);
            sim.spawnFireRock({
              x: cx, y: 0.52, z: cz,
              vx: Math.cos(a) * sp, vy: R.range(3.8, 7.5), vz: Math.sin(a) * sp,
              size: R.range(0.13, 0.24), bounce: 0.56, life: R.range(0.75, 1.15),
              palette: r % 2 === 0 ? P.pal : G.pal, rockColor: '#252c3d', emitSparks: true,
            });
          }
          for (let s = 0; s < 32; s++) {
            const a = R.range(0, TAU), sp = R.range(4.0, 8.8);
            sim.spawnSpark({
              x: cx, y: 0.45, z: cz,
              vx: Math.cos(a) * sp, vy: R.range(2.5, 6.8), vz: Math.sin(a) * sp,
              life: R.range(0.24, 0.48), size: 0.054, stretch: 0.044, bounce: 0.58, color: s % 2 ? P.hotHex : G.hotHex,
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
  // PROP 13 (FIRE): 熔岩圖騰：火山石柱連環噴發 (召喚雕刻 3D 圖騰方尖碑 -> 頂端火盆連噴 10 顆熔岩彈!)
  // =========================================================================
  {
    id: 'fire_volcano_totem',
    cat: 'fire',
    cls: '元素薩滿 Shaman',
    title: '熔岩圖騰：火山石柱連環噴發',
    codeId: 'm.skill.magma_totem',
    duration: 2.45,
    releaseTime: 0.24,
    peakTime: 0.96,
    contactTimes: [0.40, 0.96, 1.45],
    hitbox: { kind: 'circle', cx: 0, cz: 3.2, radius: 3.4 },
    specNotes: [
      '召喚高達 2.2m 的有形 3D 凹凸黑曜石熔岩圖騰柱重砸進場，浮空火環高速旋轉',
      '圖騰頂端火盆連續噴發 10 顆拋物線 3D 熔岩火石轟炸敵群，落地彈跳並引爆火海！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 4.15, true);
      dummies[1].reset(-1.55, 3.75, true);
      dummies[2].reset(1.55, 3.75, true);
    },
    keyframes: makeSkyChantKeyframes(0.14, 0.24, 2.35),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('fireInferno', paletteOverride);
      const M = resolvePal('earthMagma', paletteOverride);
      const tx = 0, tz = 2.05;

      const evs = [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.62, P.hotHex, 0.16, true);
        }},
        { t: 0.24, run() {
          const totem = buildTotemObeliskAssembly({ palette: P.pal, scale: 1.12 });
          totem.group.position.set(tx, 3.2, tz);
          let elapsed = 0;
          const slamDur = 0.16;
          const totalDur = 1.88;
          sim.addCustom({
            group: totem.group,
            update(dt) {
              elapsed += dt;
              totem.update(dt);
              if (elapsed <= slamDur) {
                totem.group.position.y = lerp(3.2, 0.0, ease.inCubic(elapsed / slamDur));
              } else {
                totem.group.position.y = 0.0;
              }
              totem.setOpacity(1 - smooth(totalDur - 0.30, totalDur, elapsed));
            },
            get done() { return elapsed >= totalDur; },
            dispose() { totem.dispose(); },
          });
        }},
        { t: 0.40, run() {
          sim.addCustom(new Sigil3D({
            x: tx, y: 0.025, z: tz, radius: 1.95, duration: 1.65,
            style: 'abyss', palette: P.pal, hdr: 1.9, wallHeight: 0.45,
          }));
          sim.addCustom(new GroundWave3D({
            x: tx, z: tz, maxRadius: 2.35, thickness: 0.48, height: 0.68, duration: 0.36,
            palette: M.pal, hdr: 2.05, seed: seed + 441,
          }));
          spawnGroundCracks(sim, R, { cx: tx, cz: tz, maxRadius: 2.05, branches: 8, life: 1.35, palette: M.pal, rockCount: 8, rockScale: 0.8 });
          sim.addLight(tx, 2.2, tz, P.hotHex, 4.8, 8.0, 1.55);
        }},
      ];

      // Totem top brazier erupts 10 parabolic 3D Lava Bombs onto enemies!
      for (let b = 0; b < 10; b++) {
        const launchT = 0.46 + b * 0.07;
        evs.push({
          t: launchT,
          run() {
            const tgt = dummies[b % 3].root.position;
            const dx = tgt.x - tx + R.range(-0.45, 0.45);
            const dz = tgt.z - tz + R.range(-0.45, 0.45);
            sim.spawnFlipbook({
              atlas: 'fbFlame', x: tx, y: 2.28, z: tz, vy: 1.4,
              life: 0.32, size0: 0.65, size1: 1.35, palette: P.pal, hdr: 2.05,
            });
            sim.spawnFireRock({
              x: tx, y: 2.22, z: tz,
              vx: dx * 1.85, vy: R.range(4.2, 5.8), vz: dz * 1.85,
              size: R.range(0.18, 0.28), life: 1.05, bounce: 0.48,
              palette: P.pal, emitSparks: true, emitFlame: b % 2 === 0,
            });
            if (b % 3 === 1) {
              sim.spawnFlipbook({
                atlas: 'fbExplosion', x: tgt.x, y: 0.75, z: tgt.z, vy: 0.85,
                life: 0.48, size0: 0.95, size1: 1.95, palette: P.pal, hdr: 2.0, delay: 0.42,
              });
              dummies[b % 3].hit({ dirX: dx * 0.3, dirZ: 1, power: 1.25, noPush: false, flashColor: P.hotHex });
            }
          },
        });
      }

      return evs;
    },
  },
];
