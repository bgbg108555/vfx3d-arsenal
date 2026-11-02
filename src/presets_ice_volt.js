import * as THREE from 'three';
import {
  TAU, clamp, lerp, smooth, ease, Rng, PAL3D, rampToColors, getScaledHitbox,
  SlashArc3D, GroundWave3D, VortexFunnel3D, BeamCylinder3D, Sigil3D,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import {
  resolvePal, makeStaffCastKeyframes, makeSkyChantKeyframes, spawnGroundCracks,
  spawnMartialStanceGust3D,
} from './fx_helpers.js';
import { spawnSustainedBlizzardZone } from './env_fx3d.js';

export const PRESETS_ICE_VOLT = [
  // =========================================================================
  // ICE 2: 暴風雪極寒渦流 (狂風氣流帶 + 漫天斜吹冰雪結晶 + 雙層暴雪風牆 + 冰錐碎裂)
  // =========================================================================
  {
    id: 'ice_blizzard',
    cat: 'ice',
    cls: '冰霜法師 Cryomancer',
    title: '暴風雪極寒渦流 (狂風漫天冰雪)',
    codeId: 'm.skill.blizzard',
    duration: 3.65,
    releaseTime: 0.34,
    peakTime: 1.45,
    handlesDynamicScale: true,
    contactTimes: [0.45, 1.35, 2.45],
    hitbox: { kind: 'circle', cx: 0, cz: 3.6, radius: 3.5 },
    specNotes: [
      '捲起雙層傾斜狂風氣旋漏斗、6 道高速橫掃 3D 狂風氣流帶與 460 枚斜向狂吹立體冰雪星晶！',
      '高空極寒烏雲壓境、密集六稜冰錐斜砸碎裂 (fbIceShatter)，地面程序化拼接雪原冰裂長效留存',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageFrost', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      const hb = getScaledHitbox(this.hitbox);
      const sp = Math.min(hb.radius * 0.50, 1.85);
      dummies[0].reset(hb.cx, hb.cz, true);
      dummies[1].reset(hb.cx - sp, hb.cz + sp * 0.24, true);
      dummies[2].reset(hb.cx + sp, hb.cz + sp * 0.24, true);
    },
    keyframes: makeSkyChantKeyframes(0.20, 0.34, 3.50),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('mageFrost', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.62, P.hotHex, 0.22, true);
          sim.addLight(tip.x, tip.y, tip.z, P.midHex, 3.2, 4.0, 0.24, true);
        }},
        { t: 0.34, run() {
          spawnSustainedBlizzardZone(sim, {
            cx: hb.cx, cz: hb.cz, radius: hb.radius,
            duration: 3.12, palette: P.pal, dummies, seed: seed + 71,
          });
          sim.addCustom(new GroundWave3D({
            x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.96, thickness: 0.58, height: 0.72, duration: 0.44,
            palette: P.pal, hdr: 2.05, seed: seed + 73,
          }));
          sim.addLight(hb.cx, 2.2, hb.cz, P.hotHex, 6.2, 9.5, 1.65);
        }},
      ];
    },
  },

  // =========================================================================
  // ICE 3: 極光冰晶巨槍 (空中凝結 2.1m 多面體巨型冰槍 -> 破空三冰環 -> 命中爆碎冰林)
  // =========================================================================
  {
    id: 'ice_lance',
    cat: 'ice',
    cls: '冰霜法師 Cryomancer',
    title: '極光冰晶巨槍 (凝結投射碎裂)',
    codeId: 'm.skill.glacial_lance',
    duration: 1.95,
    releaseTime: 0.44,
    peakTime: 0.64,
    contactTimes: [0.44, 0.64, 0.96],
    hitbox: { kind: 'rect', width: 1.6, length: 5.6 },
    specNotes: [
      '0.06s–0.44s 半空旋轉法陣與奧術渦流 Flipbook 凝結出 2.1m 多面體稜鏡巨型冰槍',
      '高速破空穿過三道寒霜氣環，命中目標瞬間炸裂成多晶簇冰刺、受擊星芒 Flipbook 與滿地碎冰',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageFrost', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 4.35, true);
      dummies[1].reset(-0.55, 4.85, true);
      dummies[2].reset(0.55, 4.85, true);
    },
    keyframes: makeStaffCastKeyframes(0.28, 0.44, 1.85),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('mageFrost', paletteOverride);

      const makeLanceGroup = () => {
        const ramp = rampToColors(P.pal, 7);
        const g = new THREE.Group();
        const tipGeo = new THREE.ConeGeometry(0.18, 1.55, 6);
        tipGeo.rotateX(Math.PI / 2);
        const tailGeo = new THREE.ConeGeometry(0.18, 0.55, 6);
        tailGeo.rotateX(-Math.PI / 2);
        tailGeo.translate(0, 0, -0.52);
        const finGeo = new THREE.OctahedronGeometry(0.28, 0);
        finGeo.scale(1.2, 0.25, 0.6);
        finGeo.translate(0, 0, -0.25);
        const lanceMat = new THREE.MeshStandardMaterial({
          color: ramp[4], emissive: ramp[5].clone().multiplyScalar(0.85),
          roughness: 0.15, metalness: 0.35, flatShading: true, transparent: true,
        });
        g.add(new THREE.Mesh(tipGeo, lanceMat), new THREE.Mesh(tailGeo, lanceMat), new THREE.Mesh(finGeo, lanceMat));
        return { g, dispose() { tipGeo.dispose(); tailGeo.dispose(); finGeo.dispose(); lanceMat.dispose(); } };
      };

      return [
        { t: 0.06, isPreGather: true, run() {
          sim.spawnFlipbook({
            atlas: 'fbMagicSwirl', x: 0, y: 1.42, z: 0.95, _mapped: true,
            life: 0.38, size0: 1.35, size1: 0.65, palette: P.pal, hdr: 2.0,
          });
          const lance = makeLanceGroup();
          lance.g.position.set(0, 1.42, 0.95);
          let elapsed = 0;
          sim.addCustom({
            group: lance.g,
            _skipAutoMap: true,
            update(dt) {
              elapsed += dt;
              lance.g.rotation.z += dt * 10.5;
              const s = ease.outBack(clamp(elapsed / 0.28), 1.8);
              lance.g.scale.setScalar(Math.max(0.01, s));
            },
            get done() { return elapsed >= 0.38; },
            dispose() { lance.dispose(); },
          });
        }},
        // Sculpted 2.1m 3D Ice Lance Launch + Air-shear frost rings at 0.44s!
        { t: 0.44, run() {
          const lance = makeLanceGroup();
          const startPos = fighter.getStaffTipWorld();
          const [tx, tz] = sim.mapSkillXZ(0, 4.35, false);
          lance.g.position.copy(startPos);
          let elapsed = 0;
          const flightDur = 0.18;
          sim.addCustom({
            group: lance.g,
            _skipAutoMap: true,
            update(dt) {
              elapsed += dt;
              lance.g.rotation.z += dt * 12.0;
              const u = clamp(elapsed / flightDur);
              lance.g.position.set(lerp(startPos.x, tx, u), lerp(startPos.y, 1.15, u), lerp(startPos.z, tz, ease.inQuad(u)));
            },
            get done() { return elapsed >= flightDur; },
            dispose() { lance.dispose(); },
          });
          const ramp = rampToColors(P.pal, 7);
          for (const [idx, zPos] of [[0, 1.6], [1, 2.7], [2, 3.7]]) {
            const rg = new THREE.TorusGeometry(0.45 + idx * 0.08, 0.026, 6, 28);
            const rm = new THREE.MeshBasicMaterial({ color: ramp[5].clone().multiplyScalar(1.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
            const m = new THREE.Mesh(rg, rm);
            m.position.set(0, 1.28 - idx * 0.05, zPos);
            sim.addCustom({
              mesh: m, life: 0.28, max: 0.28,
              update(_dt, k) {
                m.scale.setScalar(0.6 + (1 - k) * 0.85);
                rm.opacity = k * 0.85;
              },
              dispose() { rg.dispose(); rm.dispose(); },
            });
          }
        }},
        // Impact shatter at 0.62s!
        { t: 0.62, run() {
          const cx = 0, cz = 4.35;
          sim.addLight(cx, 1.2, cz, P.hotHex, 6.4, 7.0, 0.36);
          sim.spawnStarGlint(cx, 1.15, cz, 0.88, '#ffffff', 0.14);
          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: cx, y: 1.15, z: cz - 0.2,
            life: 0.32, size0: 0.95, size1: 1.95, palette: P.pal, hdr: 2.25,
          });
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 1.55, thickness: 0.42, height: 0.65, duration: 0.34,
            palette: P.pal, hdr: 2.1, seed: seed + 81,
          }));
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU;
            sim.spawnCrystal({
              x: cx + Math.cos(a) * 0.52, z: cz + Math.sin(a) * 0.52,
              height: R.range(0.85, 1.25), width: 0.28,
              leanX: Math.cos(a) * 0.35, leanZ: Math.sin(a) * 0.35,
              delay: i * 0.02, hold: 0.55, melt: 0.35, palette: P.pal,
            });
          }
          for (let s = 0; s < 24; s++) {
            const a = R.range(0, TAU), sp = R.range(3.0, 6.8);
            sim.spawnShard({
              x: cx, y: 1.05, z: cz,
              vx: Math.cos(a) * sp, vy: R.range(1.8, 5.5), vz: Math.sin(a) * sp,
              life: R.range(0.42, 0.72), size: R.range(0.07, 0.13), color: P.hotHex, hdr: 1.7,
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: d.homeX, dirZ: 1, power: 1.45, noPush: false, flashColor: P.hotHex, shiver: 0.45 });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // ICE 4: 絕對零度冰牢碎裂 (冰陣 -> 巨型透明多面體冰柱封凍目標 -> 內部裂紋閃光 -> 爆裂粉碎)
  // =========================================================================
  {
    id: 'ice_glacial_prison',
    cat: 'ice',
    cls: '冰霜法師 Cryomancer',
    title: '絕對零度：冰牢封凍與碎裂',
    codeId: 'm.skill.ice_prison',
    duration: 2.25,
    releaseTime: 0.24,
    peakTime: 0.75,
    contactTimes: [0.35, 0.75, 1.24],
    hitbox: { kind: 'circle', cx: 0, cz: 3.6, radius: 2.4 },
    specNotes: [
      '0.24s 地面冰陣急凍，拔起 2.25m 巨型半透明六角多面體冰晶巨柱將敵人完整封入冰中',
      '0.85s 冰柱內部竄出寒霜裂隙閃電 Flipbook，1.18s 劇烈引爆粉碎為漫天立體冰塊',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageFrost', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.6, true);
      dummies[1].reset(-1.35, 3.85, true);
      dummies[2].reset(1.35, 3.85, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE } },
      { t: 0.14, ease: ease.inOutCubic, pose: {
        crouch: 0.10, torsoPitch: -0.22, headPitch: -0.28,
        shRPitch: -2.20, shRYaw: 0.16, elRPitch: -0.18,
        shLPitch: -2.05, shLYaw: -0.24, elLPitch: -0.22, capePitch: 0.46,
      }},
      { t: 0.24, ease: ease.outExpo, pose: {
        z: 0.14, crouch: 0.18, torsoPitch: 0.22, headPitch: 0.04,
        shRPitch: -1.52, shRYaw: 0.06, elRPitch: -0.06,
        shLPitch: -1.25, shLYaw: -0.45, elLPitch: -0.22, capePitch: 0.68,
      }},
      { t: 0.96, ease: ease.inOutCubic, pose: {
        z: 0.08, crouch: 0.12, torsoPitch: -0.20, headPitch: -0.26,
        shRPitch: -2.25, shRYaw: 0.18, elRPitch: -0.16,
        shLPitch: -2.08, shLYaw: -0.26, elLPitch: -0.20, capePitch: 0.52,
      }},
      { t: 1.18, ease: ease.outExpo, pose: {
        z: 0.20, crouch: 0.24, torsoPitch: 0.28, headPitch: 0.08,
        shRPitch: -1.38, shRYaw: 0.12, elRPitch: -0.06,
        shLPitch: -1.08, shLYaw: -0.58, elLPitch: -0.26, capePitch: 0.76,
      }},
      { t: 1.62, ease: ease.inOutCubic, pose: {
        z: 0.10, crouch: 0.12, torsoPitch: 0.14,
        shRPitch: -1.42, shRYaw: 0.14, elRPitch: -0.16,
      }},
      { t: 2.15, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('mageFrost', paletteOverride);
      const cx = 0, cz = 3.6;

      return [
        { t: 0.05, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.58, P.hotHex, 0.18, true);
          sim.addLight(tip.x, tip.y, tip.z, P.midHex, 3.0, 3.8, 0.18, true);
        }},
        // Stage 2: Giant Faceted 3D Ice Monolith Encasing Target!
        { t: 0.24, run() {
          sim.addCustom(new Sigil3D({
            x: cx, y: 0.025, z: cz, radius: 2.25, duration: 1.35,
            style: 'arcane', palette: P.pal, hdr: 1.85, wallHeight: 0.55,
          }));
          const ramp = rampToColors(P.pal, 7);
          const g = new THREE.Group();
          g.position.set(cx, 0, cz);
          const bodyGeo = new THREE.CylinderGeometry(0.68, 0.88, 1.65, 6);
          bodyGeo.translate(0, 0.825, 0);
          const capGeo = new THREE.ConeGeometry(0.68, 0.72, 6);
          capGeo.translate(0, 2.01, 0);
          const mat = new THREE.MeshStandardMaterial({
            color: ramp[3], emissive: ramp[4].clone().multiplyScalar(0.55),
            roughness: 0.12, metalness: 0.25, flatShading: true, transparent: true, opacity: 0.68,
          });
          const edgeMat = new THREE.MeshBasicMaterial({
            color: ramp[6].clone().multiplyScalar(1.6), wireframe: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
          });
          g.add(new THREE.Mesh(bodyGeo, mat), new THREE.Mesh(capGeo, mat));
          g.add(new THREE.Mesh(bodyGeo, edgeMat), new THREE.Mesh(capGeo, edgeMat));

          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            sim.spawnCrystal({
              x: cx + Math.cos(a) * 1.05, z: cz + Math.sin(a) * 1.05,
              height: R.range(0.75, 1.15), width: 0.26,
              leanX: Math.cos(a) * 0.32, leanZ: Math.sin(a) * 0.32,
              delay: i * 0.02, hold: 0.78, melt: 0.18, palette: P.pal,
            });
          }

          let elapsed = 0;
          sim.addCustom({
            group: g,
            update(dt) {
              elapsed += dt;
              const grow = ease.outBack(clamp(elapsed / 0.12), 2.0);
              const vib = elapsed > 0.60 ? Math.sin(elapsed * 75) * 0.035 : 0;
              g.position.x = cx + vib;
              g.scale.set(grow, grow, grow);
              if (elapsed > 0.60) edgeMat.opacity = 0.55 + (elapsed - 0.60) * 1.2;
            },
            get done() { return elapsed >= 0.94; }, // Shatters cleanly at 0.24 + 0.94 = 1.18s!
            dispose() { bodyGeo.dispose(); capGeo.dispose(); mat.dispose(); edgeMat.dispose(); },
          });
          dummies[0].hit({ dirX: 0, dirZ: 0, power: 0.6, noPush: true, flashColor: P.hotHex, shiver: 0.92 });
          sim.addLight(cx, 1.2, cz, P.midHex, 4.8, 6.0, 0.95);
        }},
        // Stage 3: Internal stress cracks before detonation
        { t: 0.82, run() {
          sim.spawnFlipbook({
            atlas: 'fbLightning', x: cx, y: 1.15, z: cz,
            life: 0.34, size0: 1.35, size1: 1.65, palette: P.pal, hdr: 2.2, loopFrames: true,
          });
        }},
        // Stage 4: Violent Cryo Shatter at 1.18s!
        { t: 1.18, run() {
          sim.addLight(cx, 1.3, cz, P.hotHex, 7.5, 8.5, 0.40);
          sim.spawnStarGlint(cx, 1.2, cz, 1.05, '#ffffff', 0.15);
          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: cx, y: 1.2, z: cz,
            life: 0.36, size0: 1.25, size1: 2.45, palette: P.pal, hdr: 2.35,
          });
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 2.34, thickness: 0.52, height: 0.82, duration: 0.38,
            palette: P.pal, hdr: 2.2, seed: seed + 91,
          }));
          for (let s = 0; s < 28; s++) {
            const a = R.range(0, TAU), sp = R.range(3.2, 7.2);
            sim.spawnShard({
              x: cx + Math.cos(a) * 0.4, y: R.range(0.4, 1.8), z: cz + Math.sin(a) * 0.4,
              vx: Math.cos(a) * sp, vy: R.range(2.2, 6.4), vz: Math.sin(a) * sp,
              life: R.range(0.45, 0.78), size: R.range(0.09, 0.16), color: P.hotHex, hdr: 1.75,
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz + 0.3, power: 1.65, noPush: false, flashColor: P.hotHex });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // ICE 5 (WATER): 深海漩渦衝天水柱 (碧藍海流漩渦 + 水花泡沫 Flipbook -> 高壓水龍柱噴發)
  // =========================================================================
  {
    id: 'water_hydro_geyser',
    cat: 'ice',
    cls: '滄海導師 Tidecaller',
    title: '深海漩渦：高壓衝天水柱',
    codeId: 'm.skill.hydro_geyser',
    duration: 2.15,
    releaseTime: 0.44,
    peakTime: 0.72,
    contactTimes: [0.44, 0.72, 1.22],
    hitbox: { kind: 'circle', cx: 0, cz: 3.8, radius: 2.8 },
    specNotes: [
      '0.44s 地面捲起碧海漩渦盤與泡沫水花 Flipbook (fbLiquid)，爆噴 4.5m 高壓螺旋水柱與浪花漏斗',
      '四濺皇冠水珠 Flipbook 與晶瑩水滴',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('waterAqua', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.8, true);
      dummies[1].reset(-1.35, 4.15, true);
      dummies[2].reset(1.35, 4.15, true);
    },
    keyframes: makeSkyChantKeyframes(0.28, 0.44, 2.05),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('waterAqua', paletteOverride);
      const cx = 0, cz = 3.8;

      return [
        { t: 0.05, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnFlipbook({
            atlas: 'fbLiquid', x: tip.x, y: tip.y, z: tip.z, _mapped: true,
            life: 0.34, size0: 0.55, size1: 1.05, palette: P.pal, hdr: 1.9,
          });
        }},
        { t: 0.44, run() {
          sim.addCustom(new VortexFunnel3D({
            x: cx, y: 0.02, z: cz, rBottom: 2.25, rTop: 0.45, height: 0.45,
            duration: 1.15, spinSpeed: 9.5, riseSpeed: -2.5, twist: 2.6,
            palette: P.pal, texStyle, defaultTex: 'silk', hdr: 1.85,
          }));
          sim.addCustom(new BeamCylinder3D({
            p0: new THREE.Vector3(cx, 0.02, cz),
            p1: new THREE.Vector3(cx, 4.55, cz),
            radius: 0.58, duration: 0.96, palette: P.pal,
            texStyle, defaultTex: 'silk', hdr: 2.1, muzzleRings: true,
          }));
          sim.addCustom(new VortexFunnel3D({
            x: cx, y: 0.02, z: cz, rBottom: 0.52, rTop: 1.55, height: 2.95,
            duration: 1.02, spinSpeed: 10.5, riseSpeed: 3.4, twist: 2.2,
            palette: P.pal, texStyle, defaultTex: 'silk', hdr: 1.9,
          }));
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 2.74, thickness: 0.55, height: 0.82, duration: 0.42,
            palette: P.pal, hdr: 2.05, seed: seed + 101,
          }));
          sim.addLight(cx, 2.0, cz, P.hotHex, 6.2, 8.0, 0.95);

          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbLiquid', x: cx + Math.cos(a) * 0.85, y: 0.75 + (i % 2) * 0.8, z: cz + Math.sin(a) * 0.85,
              vx: Math.cos(a) * 1.6, vy: 1.85, vz: Math.sin(a) * 1.6,
              life: 0.65, size0: 0.95, size1: 1.95, palette: P.pal, hdr: 2.0, delay: i * 0.035,
            });
          }
          for (let s = 0; s < 28; s++) {
            const a = R.range(0, TAU), sp = R.range(2.4, 5.6);
            sim.spawnSpark({
              x: cx, y: 1.2, z: cz,
              vx: Math.cos(a) * sp, vy: R.range(3.8, 7.5), vz: Math.sin(a) * sp,
              life: R.range(0.38, 0.68), size: 0.052, stretch: 0.032, gravity: 14.0, color: P.hotHex,
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz + 0.3, power: 1.5, noPush: false, flashColor: P.hotHex });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // VOLT 2: 九天落雷神罰 (天地雙層雷紋法陣 -> 粗壯分叉立體天雷劈落 + 電弧 Flipbook)
  // =========================================================================
  {
    id: 'volt_thunder_strike',
    cat: 'volt',
    cls: '雷霆導師 Stormcaller',
    title: '九天落雷神罰 (天頂劈雷)',
    codeId: 'm.skill.thunder_judgment',
    duration: 1.95,
    releaseTime: 0.44,
    peakTime: 0.52,
    contactTimes: [0.44, 0.52, 0.88],
    hitbox: { kind: 'circle', cx: 0, cz: 3.8, radius: 2.8 },
    specNotes: [
      '地面與 5.6m 高空同步展開雙層雷鳴魔法陣，預警電光匯聚',
      '0.44s 粗壯立體折角主雷霆偕同光柱直劈地面，爆開樹枝狀閃電 Flipbook 與焦黑雷裂紋',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.8, true);
      dummies[1].reset(-1.35, 4.15, true);
      dummies[2].reset(1.35, 4.15, true);
    },
    keyframes: makeSkyChantKeyframes(0.26, 0.44, 1.85),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const R = new Rng(seed);
      const P = resolvePal('mageVolt', paletteOverride);
      const cx = 0, cz = 3.8;

      return [
        { t: 0.04, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnFlipbook({
            atlas: 'fbLightning', x: tip.x, y: tip.y, z: tip.z, _mapped: true,
            life: 0.34, size0: 0.65, size1: 1.15, palette: P.pal, hdr: 2.1, loopFrames: true,
          });
        }},
        { t: 0.44, run() {
          sim.addCustom(new Sigil3D({
            x: cx, y: 0.025, z: cz, radius: 2.55, duration: 1.05,
            style: 'arcane', palette: P.pal, hdr: 1.95, wallHeight: 0.65,
          }));
          sim.addCustom(new Sigil3D({
            x: cx, y: 5.5, z: cz, radius: 2.15, duration: 0.85,
            style: 'arcane', palette: P.pal, hdr: 1.95, wallHeight: 0.35,
          }));
          sim.spawnLightning({
            p0: new THREE.Vector3(cx, 5.6, cz), p1: new THREE.Vector3(cx, 0.05, cz),
            life: 0.34, jag: 0.18, depth: 4, forks: 5, palette: P.pal, thickness: 0.11,
          });
          sim.spawnLightning({
            p0: new THREE.Vector3(cx + 0.4, 5.5, cz - 0.3), p1: new THREE.Vector3(cx - 0.2, 0.05, cz + 0.2),
            life: 0.28, jag: 0.22, depth: 4, forks: 3, palette: P.pal, thickness: 0.065,
          });
          sim.addCustom(new BeamCylinder3D({
            p0: new THREE.Vector3(cx, 5.5, cz), p1: new THREE.Vector3(cx, 0.02, cz),
            radius: 0.38, duration: 0.28, palette: P.pal, texStyle, defaultTex: 'volt', hdr: 2.35, muzzleRings: true,
          }));
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 2.74, thickness: 0.54, height: 0.78, duration: 0.36,
            palette: P.pal, hdr: 2.25, seed: seed + 111,
          }));
          spawnGroundCracks(sim, R, { cx, cz, maxRadius: 2.58, branches: 9, life: 0.85, palette: P.pal, rockCount: 6, rockScale: 0.75 });
          sim.addLight(cx, 1.8, cz, P.hotHex, 8.2, 10.0, 0.36);
          sim.spawnStarGlint(cx, 0.85, cz, 1.15, '#ffffff', 0.14);

          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: cx, y: 1.0, z: cz,
            life: 0.30, size0: 1.15, size1: 2.35, palette: P.pal, hdr: 2.3,
          });
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbLightning', x: cx + Math.cos(a) * 1.05, y: 0.85, z: cz + Math.sin(a) * 1.05,
              life: 0.42, size0: 0.95, size1: 1.75, palette: P.pal, hdr: 2.15, loopFrames: true, delay: i * 0.02,
            });
          }
          for (let s = 0; s < 26; s++) {
            const a = R.range(0, TAU), sp = R.range(3.5, 7.8);
            sim.spawnSpark({
              x: cx, y: 0.4, z: cz,
              vx: Math.cos(a) * sp, vy: R.range(1.8, 5.8), vz: Math.sin(a) * sp,
              life: R.range(0.18, 0.36), size: 0.048, stretch: 0.042, color: P.hotHex,
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz, power: 1.55, noPush: false, flashColor: P.hotHex, shiver: 0.55 });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // VOLT 3: 球狀閃電磁暴線圈 (懸浮雙線圈電漿球 -> 連續四波放射電鞭抽擊 -> 超載引爆)
  // =========================================================================
  {
    id: 'volt_ball_lightning',
    cat: 'volt',
    cls: '雷霆導師 Stormcaller',
    title: '球狀閃電磁暴線圈 (持續電鞭)',
    codeId: 'm.skill.tesla_orb',
    duration: 2.35,
    releaseTime: 0.30,
    peakTime: 0.95,
    contactTimes: [0.42, 0.95, 1.56],
    hitbox: { kind: 'circle', cx: 0, cz: 3.5, radius: 3.5 },
    specNotes: [
      '投出立體雙環陀螺磁暴線圈懸浮於戰場中央，周身環繞動態閃電 Flipbook',
      '連續四波向周圍三名敵人抽射折角電弧，1.52s 磁核超載引爆電漿震波',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 5.15, true);
      dummies[1].reset(-2.05, 2.85, true);
      dummies[2].reset(2.05, 2.85, true);
    },
    keyframes: makeStaffCastKeyframes(0.18, 0.30, 2.25),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const P = resolvePal('mageVolt', paletteOverride);
      const center = new THREE.Vector3(0, 1.45, 3.5);

      const evs = [
        { t: 0.30, run() {
          const ramp = rampToColors(P.pal, 7);
          const g = new THREE.Group();
          const coreGeo = new THREE.OctahedronGeometry(0.24, 1);
          const cageGeo = new THREE.IcosahedronGeometry(0.42, 0);
          const ringGeo = new THREE.TorusGeometry(0.62, 0.028, 8, 32);
          const coreMat = new THREE.MeshBasicMaterial({ color: ramp[6].clone().multiplyScalar(2.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
          const cageMat = new THREE.MeshBasicMaterial({ color: ramp[3].clone().multiplyScalar(1.6), wireframe: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
          const core = new THREE.Mesh(coreGeo, coreMat);
          const cage = new THREE.Mesh(cageGeo, cageMat);
          const r1 = new THREE.Mesh(ringGeo, cageMat);
          const r2 = new THREE.Mesh(ringGeo, coreMat);
          r2.rotation.x = Math.PI / 2;
          g.add(core, cage, r1, r2);

          const p0 = fighter.getStaffTipWorld();
          let elapsed = 0;
          sim.addCustom({
            group: g,
            update(dt) {
              elapsed += dt;
              if (elapsed < 0.22) {
                g.position.lerpVectors(p0, center, ease.outCubic(elapsed / 0.22));
              } else {
                g.position.set(center.x, center.y + Math.sin(elapsed * 8) * 0.08, center.z);
              }
              cage.rotation.y += dt * 7; cage.rotation.x += dt * 5;
              r1.rotation.y += dt * 11; r1.rotation.z += dt * 4;
              r2.rotation.x -= dt * 10; r2.rotation.y += dt * 6;
            },
            get done() { return elapsed >= 1.24; },
            dispose() { coreGeo.dispose(); cageGeo.dispose(); ringGeo.dispose(); coreMat.dispose(); cageMat.dispose(); },
          });
          sim.addLight(0, 1.5, 3.5, P.midHex, 5.0, 7.0, 1.35);
        }},
      ];

      for (const pulseT of [0.58, 0.86, 1.14, 1.38]) {
        evs.push({
          t: pulseT,
          run() {
            sim.spawnFlipbook({
              atlas: 'fbLightning', x: center.x, y: center.y, z: center.z,
              life: 0.28, size0: 1.15, size1: 1.75, palette: P.pal, hdr: 2.15, loopFrames: true,
            });
            for (const d of dummies) {
              const tgt = d.chestWorld();
              sim.spawnLightning({ p0: center, p1: tgt, life: 0.20, jag: 0.22, depth: 4, forks: 2, palette: P.pal, thickness: 0.048 });
              d.hit({ dirX: d.homeX, dirZ: d.homeZ - 3.5, power: 0.85, noPush: true, flashColor: P.hotHex, shiver: 0.32 });
              sim.spawnFlipbook({
                atlas: 'fbHitBurst', x: tgt.x, y: tgt.y, z: tgt.z,
                life: 0.20, size0: 0.55, size1: 1.05, palette: P.pal, hdr: 2.0,
              });
            }
          },
        });
      }

      evs.push({
        t: 1.54,
        run() {
          sim.addLight(0, 1.4, 3.5, P.hotHex, 7.2, 8.5, 0.34);
          sim.spawnStarGlint(0, 1.45, 3.5, 1.05, '#ffffff', 0.14);
          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: 0, y: 1.45, z: 3.5,
            life: 0.34, size0: 1.35, size1: 2.65, palette: P.pal, hdr: 2.35,
          });
          sim.addCustom(new GroundWave3D({
            x: 0, z: 3.5, maxRadius: 3.42, thickness: 0.58, height: 0.78, duration: 0.38,
            palette: P.pal, hdr: 2.2, seed: seed + 121,
          }));
        },
      });
      return evs;
    },
  },

  // =========================================================================
  // VOLT 4: 雷霆震地咆哮 (雙拳聚雷 -> 震地 4.2m 雷冠波 + 10 道貼地放射狂雷)
  // =========================================================================
  {
    id: 'volt_thunderclap',
    cat: 'volt',
    cls: '雷神戰狂 Thunderlord',
    title: '雷霆震地咆哮 (全方位電網)',
    codeId: 'w.skill.thunderclap',
    duration: 1.85,
    releaseTime: 0.36,
    peakTime: 0.44,
    contactTimes: [0.36, 0.44, 0.78],
    hitbox: { kind: 'circle', cx: 0, cz: 0, radius: 4.2 },
    specNotes: [
      '雙臂高舉引雷入體，重踏震地瞬間擴開 4.2m 雷光氣浪冠 (GroundWave3D)',
      '10 道銳利折角地面奔雷呈放射狀竄向四方，伴隨電弧 Flipbook 與雷擊地裂',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('unarmed', hotHex);
      dummies[0].reset(0, 2.85, true);
      dummies[1].reset(-2.45, -1.55, true);
      dummies[2].reset(2.45, -1.55, true);
    },
    keyframes: makeSkyChantKeyframes(0.22, 0.36, 1.75),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      const R = new Rng(seed);
      const P = resolvePal('mageVolt', paletteOverride);

      return [
        { t: 0.05, isPreGather: true, run() {
          for (const h of [fighter.getLeftHandWorld(), fighter.getRightHandWorld()]) {
            sim.spawnFlipbook({
              atlas: 'fbLightning', x: h.x, y: h.y + 0.3, z: h.z, _mapped: true,
              life: 0.28, size0: 0.65, size1: 1.15, palette: P.pal, hdr: 2.1, loopFrames: true,
            });
          }
        }},
        { t: 0.36, run() {
          fighter.hitStop = 0.085;
          sim.addLight(0, 1.2, 0, P.hotHex, 7.5, 9.5, 0.38);
          sim.spawnStarGlint(0, 0.75, 0, 1.1, '#ffffff', 0.14);
          spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.75, duration: 0.65, palette: P.pal, _mapped: true });
          sim.addCustom(new GroundWave3D({
            x: 0, z: 0, maxRadius: 4.14, thickness: 0.68, height: 0.88, duration: 0.40,
            palette: P.pal, hdr: 2.25, seed: seed + 131,
          }));
          spawnGroundCracks(sim, R, { cx: 0, cz: 0, maxRadius: 3.85, branches: 10, life: 0.85, palette: P.pal, rockCount: 8, rockScale: 0.85 });

          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: 0, y: 0.95, z: 0,
            life: 0.32, size0: 1.35, size1: 2.75, palette: P.pal, hdr: 2.3,
          });
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU + R.range(-0.1, 0.1);
            const r = 3.85;
            sim.spawnLightning({
              p0: new THREE.Vector3(Math.cos(a) * 0.35, 0.25, Math.sin(a) * 0.35),
              p1: new THREE.Vector3(Math.cos(a) * r, 0.22, Math.sin(a) * r),
              life: 0.30, jag: 0.20, depth: 4, forks: 2, palette: P.pal, thickness: 0.055,
            });
            if (i % 2 === 0) {
              sim.spawnFlipbook({
                atlas: 'fbLightning', x: Math.cos(a) * 2.1, y: 0.75, z: Math.sin(a) * 2.1,
                life: 0.36, size0: 0.95, size1: 1.65, palette: P.pal, hdr: 2.05, loopFrames: true,
              });
            }
          }
          for (const d of dummies) {
            d.hit({ dirX: d.homeX, dirZ: d.homeZ, power: 1.5, noPush: false, flashColor: P.hotHex, shiver: 0.48 });
          }
        }},
      ];
    },
  },

  // =========================================================================
  // VOLT 5 (WIND): 翠嵐真空風刃球 (氣旋牽引 -> 五軸球形交錯風刃環 + 刀風撕裂 Flipbook)
  // =========================================================================
  {
    id: 'wind_blade_tempest',
    cat: 'volt',
    cls: '疾風導師 Tempest',
    title: '翠嵐真空風刃球 (球形多軸風鐮)',
    codeId: 'm.skill.wind_sphere',
    duration: 2.05,
    releaseTime: 0.42,
    peakTime: 0.76,
    contactTimes: [0.42, 0.76, 1.24],
    hitbox: { kind: 'circle', cx: 0, cz: 3.8, radius: 3.0 },
    specNotes: [
      '前搖杖頂凝聚翠嵐氣旋，0.42s 爆開立體氣流柱與 5 道多軸交錯 3D 球形真空風刃環',
      '高速切割搭配多層刀風撕裂 Flipbook (fbSlash)，終段擴開真空震波',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('windJade', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.8, true);
      dummies[1].reset(-1.45, 4.15, true);
      dummies[2].reset(1.45, 4.15, true);
    },
    keyframes: makeStaffCastKeyframes(0.26, 0.42, 1.95),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      const P = resolvePal('windJade', paletteOverride);
      const cx = 0, cz = 3.8;

      const tilts = [
        [0.45, 0.15],
        [-0.55, -0.25],
        [1.15, 0.42],
        [-1.12, -0.38],
        [0.08, 0.75],
      ];

      return [
        { t: 0.06, isPreGather: true, run() {
          const tip = fighter.getStaffTipWorld();
          sim.spawnFlipbook({
            atlas: 'fbMagicSwirl', x: tip.x, y: tip.y, z: tip.z, _mapped: true,
            life: 0.34, size0: 1.05, size1: 0.45, palette: P.pal, hdr: 2.0,
          });
        }},
        { t: 0.42, run() {
          sim.addCustom(new VortexFunnel3D({
            x: cx, y: 0.05, z: cz, rBottom: 0.65, rTop: 1.85, height: 2.85,
            duration: 1.05, spinSpeed: 12.0, riseSpeed: 2.8, twist: 2.4,
            palette: P.pal, texStyle, defaultTex: 'silk', hdr: 1.85,
          }));
          sim.addLight(cx, 1.4, cz, P.hotHex, 5.8, 7.5, 0.95);

          tilts.forEach(([tz, tx], idx) => {
            sim.addCustom(new SlashArc3D({
              center: [cx, 1.22, cz], radius: 2.15, width: 0.78, thickness: 0.24,
              a0: -Math.PI * 0.95, a1: Math.PI * 0.95, tiltZ: tz, tiltX: tx,
              sweep: 0.14, hold: 0.28, trail: 0.36,
              palette: P.pal, texStyle, defaultTex: 'silk', texRepeat: 2.5, hdrBoost: 2.35, seed: seed + 140 + idx,
            }));
          });
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            sim.spawnFlipbook({
              atlas: 'fbSlash', x: cx + Math.cos(a) * 0.95, y: 1.2 + (i % 2) * 0.35, z: cz + Math.sin(a) * 0.95,
              life: 0.45, size0: 1.05, size1: 1.95, palette: P.pal, hdr: 2.05, loopFrames: true, delay: i * 0.05,
            });
          }
          for (const d of dummies) {
            d.hit({ dirX: cx - d.homeX, dirZ: cz - d.homeZ, power: 1.25, noPush: true, flashColor: P.hotHex, shiver: 0.45 });
          }
        }},
        { t: 1.08, run() {
          sim.addCustom(new GroundWave3D({
            x: cx, z: cz, maxRadius: 2.94, thickness: 0.54, height: 0.75, duration: 0.38,
            palette: P.pal, hdr: 2.15, seed: seed + 149,
          }));
          sim.spawnFlipbook({
            atlas: 'fbHitBurst', x: cx, y: 1.22, z: cz,
            life: 0.30, size0: 1.15, size1: 2.35, palette: P.pal, hdr: 2.25,
          });
          for (const d of dummies) {
            d.hit({ dirX: d.homeX - cx, dirZ: d.homeZ - cz + 0.3, power: 1.4, noPush: false, flashColor: P.hotHex });
          }
        }},
      ];
    },
  },
];
