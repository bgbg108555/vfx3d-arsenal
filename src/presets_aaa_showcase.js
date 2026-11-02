import * as THREE from 'three';
import {
  TAU, clamp, smooth, ease, Rng, PAL3D, rampToColors, RibbonTrail3D,
  SlashArc3D, GroundWave3D, VortexFunnel3D, BeamCylinder3D, Sigil3D, DomeShield3D, ShockSphere3D,
  makeCraggyRockGeo, makeMagmaRockMaterial, getScaledHitbox,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import {
  resolvePal, makeSkyChantKeyframes, makeSkyLeapKeyframes, makeStaffCastKeyframes, buildTaperedPrismGeo,
  attachWeaponBladeTrail3D, spawnMartialStanceGust3D, spawnBladeGroundScar3D, spawnMachShockRings3D,
} from './fx_helpers.js';
import {
  spawnSustainedBlizzardZone,
  spawnSustainedMeteorZone,
  installChargeVariantHook,
} from './env_fx3d.js';
import {
  buildTowerShieldAssembly,
  buildWarhammerAssembly,
  buildReaperScytheAssembly,
  buildArmillaryAstrolabeAssembly,
  buildSeraphWingsAssembly,
  buildDragonSpiritHeadAssembly,
  buildHolyChaliceAssembly,
  buildTotemObeliskAssembly,
} from './mesh_props3d.js';
import {
  spawnSteeringSwarmVolley,
  findPathAStarOctile,
  sweptSegmentSphereHit,
  sweptSegmentPlaneHit,
  reflectVelocityAroundNormal,
  spawnInstancedLODBoulderStorm,
} from './gamedev_algos3d.js';

function resetCircleDummies(dummies, rawHb, activeTri = true) {
  const hb = getScaledHitbox(rawHb);
  const cx = hb.cx ?? 0;
  const cz = hb.cz ?? 3.8;
  const spread = Math.min(hb.radius * 0.46, 1.85);
  dummies[0].reset(cx, cz, true);
  dummies[1].reset(cx - spread, cz + spread * 0.18, activeTri);
  dummies[2].reset(cx + spread, cz + spread * 0.18, activeTri);
}

export const PRESETS_AAA_SHOWCASE = [
  // =========================================================================
  // #01 持續區域禁咒：焦土炎龍大流星雨 (5.0s 同一區域連續 24+ 顆隕石 + 地板燃燒 + 噴石塊 + 空氣扭曲)
  // =========================================================================
  {
    id: 'env_sustained_meteor_rain',
    cat: 'aaa_env',
    cls: '3A 持續區域禁咒',
    title: '持續區域流星雨：炎龍焦土隕石風暴 (5.0s)',
    codeId: 'aaa.zone.sustained_meteor',
    duration: 5.05,
    peakTime: 2.25,
    handlesDynamicScale: true,
    contactTimes: [0.85, 2.25, 4.10],
    hitbox: { kind: 'circle', cx: 0, cz: 7.4, radius: 3.4 },
    specNotes: [
      '同一目標區域持續 5.0 秒連續斜墜 24+ 顆 3D 黑曜熔岩隕石，高空翻湧火山黑雲與盤龍炎紋大法陣',
      '每顆隕石撞擊皆留下重疊燃燒熔岩地表 (envScorchLava)、噴出物理彈跳玄武岩石塊，並觸發熱浪與震波空氣扭曲！',
      '支援右側「動態作用範圍 (0.5x~2.2x)」與「施放距離 (0.5x~3.0x)」即時縮放區域大小與隕石密度',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetCircleDummies(dummies, this.hitbox, true);
    },
    keyframes: makeSkyChantKeyframes(0.20, 0.34, 4.92),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('fireInferno', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.05,
          isPreGather: true,
          run() {
            const s0 = new Sigil3D({
              x: 0, y: 0.02, z: 0,
              radius: 1.65, duration: 2.1,
              style: 'dragonFlame', palette: P.pal, hdr: 2.0, wallHeight: 0.38,
            });
            s0._skipAutoMap = true;
            sim.addCustom(s0);
          },
        },
        {
          t: 0.34,
          run() {
            spawnSustainedMeteorZone(sim, {
              cx: hb.cx,
              cz: hb.cz,
              radius: hb.radius,
              duration: 4.44,
              palette: P.pal,
              dummies,
              fighter,
              seed: seed + 101,
              astralDualHue: false,
            });
          },
        },
      ];
    },
  },

  // =========================================================================
  // #02 持續區域大法術：永凍冰龍大暴風雪 (4.85s 同一區域連續狂風下雪 + 28+ 冰錐雨 + 積雪地表)
  // =========================================================================
  {
    id: 'env_sustained_blizzard',
    cat: 'aaa_env',
    cls: '3A 持續區域禁咒',
    title: '持續區域暴風雪：永凍天幕冰錐暴雪 (4.85s)',
    codeId: 'aaa.zone.sustained_blizzard',
    duration: 4.85,
    peakTime: 2.15,
    handlesDynamicScale: true,
    contactTimes: [0.85, 2.15, 3.65],
    hitbox: { kind: 'circle', cx: 0, cz: 7.2, radius: 3.3 },
    specNotes: [
      '狂風呼嘯 + 漫天飄落冰雪：上風處極地黑雲翻湧，雙層反向傾斜暴風龍捲與 6 道 3D 螺旋狂風緞帶 + 4 道斜切風切幕高速橫掃！',
      '460 片 3D 六角冰晶雪花以 42° 強風斜角漫天吹襲，伴隨 28+ 支巨型六稜冰錐斜砸爆碎 (fbIceShatter) 與彈跳碎冰塊',
      '地面以 Shader 程序化拼接非圓形六角霜晶蕨葉裂痕與 Voronoi 凍土岩板，完整支援動態作用範圍與施放距離縮放',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageFrost', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetCircleDummies(dummies, this.hitbox, true);
    },
    keyframes: makeSkyChantKeyframes(0.20, 0.34, 4.72),
    buildEvents(sim, _fighter, dummies, seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('mageFrost', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.05,
          isPreGather: true,
          run() {
            const s0 = new Sigil3D({
              x: 0, y: 0.02, z: 0,
              radius: 1.55, duration: 1.9,
              style: 'glacier', palette: P.pal, hdr: 2.0, wallHeight: 0.35,
            });
            s0._skipAutoMap = true;
            sim.addCustom(s0);
          },
        },
        {
          t: 0.34,
          run() {
            spawnSustainedBlizzardZone(sim, {
              cx: hb.cx,
              cz: hb.cz,
              radius: hb.radius,
              duration: 4.24,
              palette: P.pal,
              dummies,
              seed: seed + 202,
            });
          },
        },
      ];
    },
  },

  // =========================================================================
  // #03 持續區域星界禁咒：所羅門雙色星辰彗星雨 (4.9s 青金雙色星核連續轟炸)
  // =========================================================================
  {
    id: 'env_astral_comet_storm',
    cat: 'aaa_env',
    cls: '3A 星界雙色禁咒',
    title: '持續區域彗星雨：所羅門雙色星辰轟炸 (4.9s)',
    codeId: 'aaa.zone.astral_comet_rain',
    duration: 4.95,
    peakTime: 2.20,
    handlesDynamicScale: true,
    contactTimes: [0.88, 2.20, 3.95],
    hitbox: { kind: 'circle', cx: 0, cz: 7.4, radius: 3.3 },
    specNotes: [
      '赤金日珥與星界青藍雙色交替墜落的持續區域彗星雨，徹底消除單一色塊感',
      '地面展開黑曜石黃金鑲嵌所羅門大法陣 (sigilSolomon)，高空星雲裂隙持續降下星隕並掀起重力空氣折射',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('warriorGold', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetCircleDummies(dummies, this.hitbox, true);
    },
    keyframes: makeSkyChantKeyframes(0.20, 0.34, 4.82),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('warriorGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.05,
          isPreGather: true,
          run() {
            const s0 = new Sigil3D({
              x: 0, y: 0.02, z: 0,
              radius: 1.65, duration: 2.0,
              style: 'celestial', palette: PAL3D.mageArcane, hdr: 2.05, wallHeight: 0.40,
            });
            s0._skipAutoMap = true;
            sim.addCustom(s0);
          },
        },
        {
          t: 0.34,
          run() {
            spawnSustainedMeteorZone(sim, {
              cx: hb.cx,
              cz: hb.cz,
              radius: hb.radius,
              duration: 4.34,
              palette: P.pal,
              dummies,
              fighter,
              seed: seed + 303,
              astralDualHue: true,
            });
          },
        },
      ];
    },
  },

  // =========================================================================
  // #04 3A 環境互動三合一特寫：噴出石塊 + 地板持續燃燒 + 空氣熱浪/震波扭曲
  // =========================================================================
  {
    id: 'env_cataclysm_trio',
    cat: 'aaa_env',
    cls: '3A 環境互動特寫',
    title: '環境破壞三合一：噴出石塊・地板燃燒・空氣扭曲',
    codeId: 'aaa.env.cataclysm_trio',
    duration: 4.55,
    peakTime: 1.18,
    handlesDynamicScale: true,
    contactTimes: [0.86, 1.18, 2.25],
    hitbox: { kind: 'circle', cx: 0, cz: 6.2, radius: 3.2 },
    specNotes: [
      '專為檢視三大 3A 環境表現打造：(1) 18 塊實體受光玄武岩碎石高拋落地物理彈跳 (2) 非圓形 Voronoi 多貼圖程序化拼接裂谷與長時燃燒熔岩黑煙 (3) 螢幕空間震波與熱浪空氣折射',
      '切換右側「特效分級 T1 → T4」與「地面殘留倍率」可即時比較簡約無環境特效與 3A 持久地裂燃燒的差異！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('earthMagma', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      resetCircleDummies(dummies, this.hitbox, true);
    },
    releaseTime: 0.14,
    releaseIsTakeoff: true,
    keyframes: makeSkyLeapKeyframes(0.28, 0.56, 0.84, 4.8, 4.35),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('earthMagma', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      const cx = hb.cx, cz = hb.cz, rad = hb.radius;
      return [
        {
          t: 0.04,
          isPreGather: true,
          run() {
            attachWeaponBladeTrail3D(sim, fighter, { duration: 1.25, width: 0.42, palette: P.pal, hdr: 2.6, sparkRate: 40 });
            sim.spawnChargeGather({
              variant: 'debris',
              noSigil: true,
              getAnchor: () => fighter.getSwordTipWorld(),
              duration: 0.10,
              radius: 1.65,
              palette: P.pal,
            });
          },
        },
        {
          t: 0.14,
          run() {
            spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.65, duration: 0.42, palette: P.pal, _mapped: true });
            const gw = new GroundWave3D({ x: 0, z: 0, maxRadius: 1.75, thickness: 0.35, height: 0.55, duration: 0.32, palette: P.pal, hdr: 2.0, seed: seed + 401 });
            gw._skipAutoMap = true;
            sim.addCustom(gw);
          },
        },
        {
          t: 0.84,
          run() {
            fighter.hitStop = 0.10;
            const hm = buildWarhammerAssembly({ scale: 1.55, palette: P.pal });
            hm.group.position.set(cx, 0.82, cz);
            hm.group.rotation.x = Math.PI * 0.48;
            let el = 0;
            sim.addCustom({
              group: hm.group,
              update(dt) { el += dt; hm.update(dt); hm.setOpacity(1 - smooth(0.65, 1.15, el)); },
              get done() { return el >= 1.18; },
              dispose() { hm.dispose(); },
            });

            // 1. Non-circular procedural spliced stone crater + blade impact trench + long-lingering burning lava floor (zero magic circle)!
            sim.spawnGroundZone({
              x: cx, z: cz, _mapped: true, radius: rad * 0.98, duration: 3.45,
              kind: 'crater', palette: P.pal, stretchX: 1.22, stretchZ: 0.86, yaw: 0.42,
              emitFlames: false, eruptRocks: false,
            });
            sim.spawnGroundZone({
              x: cx, z: cz, _mapped: true, radius: rad * 0.82, duration: 3.48,
              kind: 'burning', palette: PAL3D.fireInferno, stretchX: 0.88, stretchZ: 1.18, yaw: 1.92,
              emitFlames: true, eruptRocks: false,
            });
            spawnMachShockRings3D(sim, {
              p0: new THREE.Vector3(cx, 4.6, cz),
              p1: new THREE.Vector3(cx, 0.25, cz),
              ringCount: 4, radius0: 0.45, radius1: rad * 0.55, duration: 0.42, palette: PAL3D.fireInferno, _mapped: true,
            });
            spawnBladeGroundScar3D(sim, {
              x: cx, z: cz, yaw: 0.18, length: rad * 1.45, width: 0.42, duration: 2.65,
              palette: P.pal, zoneKind: null, rocks: 0, _mapped: true, seed: seed + 402,
            });

            // 2. Massive erupting solid 3D rock debris + fbRockBurst + dark soot contrast
            sim.spawnRockDebris({
              x: cx, y: 0.16, z: cz,
              count: 18, radius: rad * 0.36,
              speed0: 2.6, speed1: 6.4, up0: 4.5, up1: 8.2,
              size0: 0.13, size1: 0.28, life: 1.55,
              style: 'basalt', palette: P.pal,
            });
            sim.spawnFlipbook({
              atlas: 'fbRockBurst', x: cx, y: 1.05, z: cz,
              life: 0.68, size0: 1.5, size1: 3.3, palette: P.pal, hdr: 2.45,
            });
            sim.spawnFlipbook({
              atlas: 'fbExplosion', x: cx, y: 1.15, z: cz,
              life: 0.62, size0: 1.4, size1: 3.1, palette: PAL3D.fireInferno, hdr: 2.6,
            });
            sim.spawnDarkSmoke({
              x: cx, y: 1.25, z: cz, vy: 1.1,
              life: 1.15, size0: 1.3, size1: 2.9, opacity: 0.58,
            });

            // 3. Explicit multi-wave refractive air distortion (shockwave sphere + rising heat haze)
            sim.spawnAirDistortion({
              kind: 'shock', x: cx, y: 0.9, z: cz,
              r0: 0.3, r1: rad * 1.12, duration: 0.56, strength: 1.0,
            });
            sim.addCustom(new GroundWave3D({
              x: cx, z: cz, maxRadius: rad * 0.94,
              thickness: 0.62, height: 0.96, duration: 0.52,
              palette: PAL3D.fireInferno, hdr: 2.45, seed: seed + 404,
            }));

            dummies.forEach((d) => {
              if (d.root.visible) d.hit({ dirX: d.homeX * 0.45, dirZ: 1, power: 2.1, flashColor: P.hotHex });
            });
          },
        },
      ];
    },
  },

  // =========================================================================
  // #05 寫實雙聖浮雕大陣：盤龍蒼炎 × 十二羽熾天鳳翼聖裁
  // =========================================================================
  {
    id: 'env_dragon_phoenix_cathedral',
    cat: 'aaa_env',
    cls: '3A 雕塑幾何×寫實法陣',
    title: '神獸聖裁：3D 盤龍龍首 × 十二羽熾天鳳翼大陣',
    codeId: 'aaa.sculpt.dragon_phoenix',
    duration: 4.35,
    peakTime: 1.35,
    contactTimes: [0.95, 1.35],
    hitbox: { kind: 'circle', cx: 0, cz: 3.8, radius: 3.1 },
    specNotes: [
      '同時展示右側 3D 素材庫中的「盤龍蒼炎龍首」與「十二羽熾天聖翼」兩組精細 3D 幾何雕塑',
      '搭配寫實彩繪玻璃鳳凰聖陣 (sigilPhoenix)、非圓形程序化拼接祝聖地裂與鳳羽爆散序列圖 (fbFeatherBurst)',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.8, true);
      dummies[1].reset(-1.42, 4.05, true);
      dummies[2].reset(1.42, 4.05, true);
    },
    keyframes: makeStaffCastKeyframes(0.68, 0.88, 4.15),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('holyGold', paletteOverride);
      const fireP = resolvePal('fireInferno', paletteOverride);
      return [
        {
          t: 0.05,
          isPreGather: true,
          run() {
            const s0 = new Sigil3D({
              x: 0, y: 0.022, z: 0, radius: 1.85, duration: 0.84,
              style: 'valkyrie', palette: P.pal, hdr: 2.05, wallHeight: 0.45,
            });
            s0._skipAutoMap = true;
            sim.addCustom(s0);
            sim.spawnChargeGather({
              variant: 'wings', sigilStyle: 'phoenix',
              getAnchor: () => fighter.getStaffTipWorld(),
              duration: 0.80, radius: 1.75, palette: P.pal,
            });
          },
        },
        {
          t: 0.88,
          run() {
            fighter.hitStop = 0.09;
            const wings = buildSeraphWingsAssembly({ palette: P.pal, scale: 1.25 });
            let wEl = 0;
            sim.addCustom({
              group: wings.group,
              _skipAutoMap: true,
              update(dt) {
                wEl += dt;
                wings.update(dt);
                wings.group.position.set(0, 1.35, fighter.root.position.z - 0.28);
                wings.setOpacity(Math.min(1, wEl * 6) * (1 - smooth(2.2, 2.8, wEl)));
              },
              get done() { return wEl >= 2.85; },
              dispose() { wings.dispose(); },
            });
            sim.spawnGroundZone({
              x: 0, z: 3.8, radius: 2.85, duration: 3.15,
              kind: 'holy', palette: P.pal, emitFlames: true, eruptRocks: true,
            });
            sim.addCustom(new Sigil3D({
              x: 0, y: 0.025, z: 3.8, radius: 2.92, duration: 2.75,
              style: 'phoenix', palette: fireP.pal, hdr: 2.15, wallHeight: 0.62,
            }));

            // Sculpted 3D Dragon Spirit Head diving from sky onto target sanctuary!
            const drg = buildDragonSpiritHeadAssembly({ palette: fireP.pal, scale: 1.65 });
            const p0 = new THREE.Vector3(0, 4.2, 1.2);
            const p1 = new THREE.Vector3(0, 1.05, 3.8);
            let dEl = 0;
            sim.addCustom({
              group: drg.group,
              update(dt) {
                dEl += dt;
                drg.update(dt);
                const u = clamp(dEl / 0.36);
                drg.group.position.lerpVectors(p0, p1, ease.outCubic(u));
                drg.group.lookAt(0, 0.5, 4.8);
                drg.setOpacity(1 - smooth(1.25, 1.75, dEl));
              },
              get done() { return dEl >= 1.78; },
              dispose() { drg.dispose(); },
            });

            sim.addCustom(new BeamCylinder3D({
              p0: new THREE.Vector3(0, 5.6, 3.8),
              p1: new THREE.Vector3(0, 0.02, 3.8),
              radius: 0.68, duration: 1.15, palette: P.pal, texStyle, defaultTex: 'flame', hdr: 2.45,
            }));
            sim.spawnFlipbook({
              atlas: 'fbFeatherBurst', x: 0, y: 1.35, z: 3.8,
              life: 0.72, size0: 1.5, size1: 3.3, palette: P.pal, hdr: 2.5,
            });
            sim.addCustom(new GroundWave3D({
              x: 0, z: 3.8, maxRadius: 2.92, thickness: 0.56, height: 0.88,
              duration: 0.48, palette: fireP.pal, hdr: 2.35, seed: seed + 505,
            }));
            dummies.forEach((d) => {
              if (d.root.visible) d.hit({ dirX: d.homeX * 0.4, dirZ: 1, power: 1.95, flashColor: P.hotHex });
            });
          },
        },
      ];
    },
  },

  // =========================================================================
  // #06 寫實骸骨惡魔門領域：3D 血月巨鐮 × 鮮血刀紋 × 虛空腐化地裂
  // =========================================================================
  {
    id: 'env_reaper_blood_domain',
    cat: 'aaa_env',
    cls: '3A 暗黑寫實領域',
    title: '冥府血月領域：3D 斷魂巨鐮 × 骸骨惡魔門法陣',
    codeId: 'aaa.sculpt.reaper_blood_domain',
    duration: 4.35,
    peakTime: 1.24,
    contactTimes: [1.16, 1.32],
    hitbox: { kind: 'sector', radius: 4.4, angleDeg: 155 },
    specNotes: [
      '結合雕塑 3D 血月斷魂巨鐮、寫實白骨血晶陣 (sigilBloodbone)、惡魔鎖鏈門陣 (sigilDemonGate) 與非圓形多池虛空腐化地表',
      '刀光採用全新無縫猩紅血刃貼圖 (slashBlood)，命中爆開鮮血飛濺 (fbBloodSplash) 與黑洞漩渦 (fbDarkVortex)',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('rogueBlood', paletteOverride);
      fighter.setLoadout('scythe', hotHex);
      dummies[0].reset(0, 3.1, true);
      dummies[1].reset(-1.55, 2.8, true);
      dummies[2].reset(1.55, 2.8, true);
    },
    releaseTime: 0.14,
    releaseIsTakeoff: true,
    keyframes: makeSkyLeapKeyframes(0.30, 0.72, 1.12, 0.65, 4.15),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('rogueBlood', paletteOverride);
      const voidP = resolvePal('voidAbyss', paletteOverride);
      return [
        {
          t: 0.04,
          isPreGather: true,
          run() {
            sim.spawnChargeGather({
              variant: 'singularity', sigilStyle: 'demonGate',
              getAnchor: () => fighter.getRightHandWorld(),
              duration: 0.10, radius: 1.75, palette: voidP.pal,
            });
          },
        },
        {
          t: 0.14,
          run() {
            const gw = new GroundWave3D({ x: 0, z: 0, maxRadius: 1.65, thickness: 0.34, height: 0.52, duration: 0.32, palette: voidP.pal, hdr: 2.0, seed: seed + 601 });
            gw._skipAutoMap = true;
            sim.addCustom(gw);
          },
        },
        {
          t: 1.12,
          run() {
            fighter.hitStop = 0.095;
            sim.spawnGroundZone({
              x: 0, z: 2.6, radius: 2.65, duration: 2.95,
              kind: 'void', palette: voidP.pal, emitFlames: true, eruptRocks: true,
            });
            sim.addCustom(new Sigil3D({
              x: 0, y: 0.026, z: 2.6, radius: 2.55, duration: 2.65,
              style: 'bloodbone', palette: P.pal, hdr: 2.1, wallHeight: 0.52,
            }));

            const scy = buildReaperScytheAssembly({ palette: P.pal, scale: 1.55 });
            let sEl = 0;
            sim.addCustom({
              group: scy.group,
              update(dt) {
                sEl += dt;
                scy.update(dt);
                scy.group.position.set(0, 1.18, 1.25);
                scy.group.rotation.set(Math.PI * 0.42, sEl * 9.5, 0.22);
                scy.setOpacity(1 - smooth(0.85, 1.38, sEl));
              },
              get done() { return sEl >= 1.42; },
              dispose() { scy.dispose(); },
            });

            for (let k = 0; k < 2; k++) {
              sim.addCustom(new SlashArc3D({
                center: [0, 1.08 + k * 0.16, 0.25],
                radius: 3.95, width: 1.36, thickness: 0.36,
                a0: k === 0 ? -1.42 : 1.42,
                a1: k === 0 ? 1.42 : -1.42,
                tiltZ: k === 0 ? -0.16 : 0.22,
                delay: k * 0.09,
                sweep: 0.07, hold: 0.06, trail: 0.26,
                palette: k === 0 ? P.pal : voidP.pal,
                texStyle, defaultTex: 'blood', hdrBoost: 2.55, seed: seed + 606 + k,
              }));
            }

            dummies.forEach((d) => {
              if (!d.root.visible) return;
              d.hit({ dirX: d.homeX * 0.42, dirZ: 1, power: 1.95, flashColor: P.hotHex });
              sim.spawnFlipbook({
                atlas: 'fbBloodSplash', x: d.root.position.x, y: 1.12, z: d.root.position.z,
                life: 0.48, size0: 1.0, size1: 2.25, palette: P.pal, hdr: 2.35,
              });
              sim.spawnFlipbook({
                atlas: 'fbDarkVortex', x: d.root.position.x, y: 1.18, z: d.root.position.z,
                delay: 0.06, life: 0.52, size0: 0.9, size1: 2.0, palette: voidP.pal, hdr: 2.2,
              });
              sim.spawnStatusMark('bleed', d.root.position, 1.05);
            });
          },
        },
      ];
    },
  },

  // =========================================================================
  // #07 寫實深海羅盤雷獄：利維坦怒濤漩渦 × 雷擊焦痕 × 碎冰爆散
  // =========================================================================
  {
    id: 'env_leviathan_maelstrom',
    cat: 'aaa_env',
    cls: '3A 水雷複合領域',
    title: '深海雷獄：利維坦青銅羅盤陣 × 怒濤雷暴漩渦',
    codeId: 'aaa.zone.leviathan_maelstrom',
    duration: 4.35,
    peakTime: 1.25,
    contactTimes: [0.92, 1.25, 1.62],
    hitbox: { kind: 'circle', cx: 0, cz: 3.9, radius: 3.1 },
    specNotes: [
      '展示寫實深海青銅羅盤珍珠法陣 (sigilLeviathan)、非圓形樹枝狀雷擊玻璃化焦痕地面與寒霜冰晶刀紋 (slashFrost)',
      '深海碧藍與高壓紫電雙色交織，搭配冰晶爆碎序列圖 (fbIceShatter) 與震波空氣扭曲',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('waterAqua', paletteOverride);
      fighter.setLoadout('spear', hotHex);
      dummies[0].reset(0, 3.9, true);
      dummies[1].reset(-1.42, 4.15, true);
      dummies[2].reset(1.42, 4.15, true);
    },
    keyframes: makeStaffCastKeyframes(0.68, 0.88, 4.15),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('waterAqua', paletteOverride);
      const voltP = resolvePal('mageVolt', paletteOverride);
      return [
        {
          t: 0.05,
          isPreGather: true,
          run() {
            sim.spawnChargeGather({
              variant: 'tesla', sigilStyle: 'leviathan',
              getAnchor: () => fighter.getRightHandWorld(),
              duration: 0.80, radius: 1.75, palette: voltP.pal,
            });
          },
        },
        {
          t: 0.88,
          run() {
            fighter.hitStop = 0.085;
            sim.spawnGroundZone({
              x: 0, z: 3.9, radius: 2.85, duration: 3.15,
              kind: 'lightning', palette: voltP.pal, emitFlames: true, eruptRocks: true,
            });
            sim.addCustom(new Sigil3D({
              x: 0, y: 0.026, z: 3.9, radius: 2.95, duration: 2.75,
              style: 'leviathan', palette: P.pal, hdr: 2.15, wallHeight: 0.62,
            }));
            sim.addCustom(new VortexFunnel3D({
              x: 0, y: 0.02, z: 3.9, rBottom: 0.65, rTop: 2.55, height: 3.25,
              duration: 1.65, spinSpeed: 9.2, palette: P.pal, texStyle, defaultTex: 'frost', hdr: 2.25,
            }));
            sim.addCustom(new DomeShield3D({
              x: 0, y: 0.02, z: 3.9, radius: 2.55, duration: 1.45, palette: voltP.pal, hdr: 2.05,
            }));
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * TAU;
              sim.spawnBolt(
                new THREE.Vector3(Math.cos(a) * 1.9, 5.2, 3.9 + Math.sin(a) * 1.9),
                new THREE.Vector3(Math.cos(a) * 0.5, 0.1, 3.9 + Math.sin(a) * 0.5),
                { radius: 0.05, jitter: 0.28, life: 0.68, color: voltP.hotHex }
              );
            }
            sim.spawnFlipbook({
              atlas: 'fbIceShatter', x: 0, y: 1.25, z: 3.9,
              life: 0.65, size0: 1.45, size1: 3.15, palette: P.pal, hdr: 2.45,
            });
            sim.spawnFlipbook({
              atlas: 'fbLightning', x: 0, y: 1.55, z: 3.9,
              delay: 0.08, life: 0.58, size0: 1.35, size1: 2.95, palette: voltP.pal, hdr: 2.55,
            });
            sim.addCustom(new GroundWave3D({
              x: 0, z: 3.9, maxRadius: 2.95, thickness: 0.55, height: 0.82,
              duration: 0.48, palette: P.pal, hdr: 2.3, seed: seed + 707,
            }));
            dummies.forEach((d) => {
              if (d.root.visible) d.hit({ dirX: -d.homeX * 0.35, dirZ: 1, power: 1.85, flashColor: voltP.hotHex });
            });
          },
        },
      ];
    },
  },

  // =========================================================================
  // #08 寫實星象鐘錶聖殿：3D 三軸星盤陀螺儀 × 車削祝聖聖杯 × 全息魔導陣
  // =========================================================================
  {
    id: 'env_chronos_solomon_sanctum',
    cat: 'aaa_env',
    cls: '3A 時空魔導聖殿',
    title: '時空祝聖大聖堂：3D 三軸星盤 × 車削聖杯結界',
    codeId: 'aaa.sculpt.chronos_chalice',
    duration: 4.35,
    peakTime: 1.32,
    contactTimes: [0.96, 1.52],
    hitbox: { kind: 'circle', cx: 0, cz: 3.8, radius: 3.0 },
    specNotes: [
      '中央升起右側 3D 素材庫中的「車削祝聖聖杯」與高空旋轉「三軸星盤陀螺儀」',
      '地面交疊寫實黃銅齒輪時鐘法陣 (sigilChrono)、全息魔導六角陣 (sigilCyberRune) 與非圓形流沙金紋地表',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageArcane', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      dummies[0].reset(0, 3.8, true);
      dummies[1].reset(-1.38, 4.05, true);
      dummies[2].reset(1.38, 4.05, true);
    },
    keyframes: makeSkyChantKeyframes(0.68, 0.90, 4.15),
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto') {
      installChargeVariantHook(sim);
      const P = resolvePal('mageArcane', paletteOverride);
      const goldP = resolvePal('holyGold', paletteOverride);
      return [
        {
          t: 0.05,
          isPreGather: true,
          run() {
            sim.spawnChargeGather({
              variant: 'astrolabe', sigilStyle: 'cyberRune',
              getAnchor: () => fighter.getStaffTipWorld(),
              duration: 0.82, radius: 1.75, palette: P.pal,
            });
          },
        },
        {
          t: 0.90,
          run() {
            fighter.hitStop = 0.085;
            sim.spawnGroundZone({
              x: 0, z: 3.8, radius: 2.78, duration: 3.10,
              kind: 'sand', palette: goldP.pal, emitFlames: true, eruptRocks: false,
            });
            sim.addCustom(new Sigil3D({
              x: 0, y: 0.026, z: 3.8, radius: 2.86, duration: 2.75,
              style: 'chrono', palette: goldP.pal, hdr: 2.15, wallHeight: 0.58,
            }));
            sim.addCustom(new Sigil3D({
              x: 0, y: 3.45, z: 3.8, radius: 2.15, duration: 1.82,
              style: 'cyberRune', palette: P.pal, hdr: 2.15, wallHeight: 0.25,
            }));

            const astro = buildArmillaryAstrolabeAssembly({ palette: P.pal, scale: 1.38 });
            const chalice = buildHolyChaliceAssembly({ palette: goldP.pal, scale: 1.35 });
            let el = 0;
            sim.addCustom({
              group: astro.group,
              update(dt) {
                el += dt;
                astro.update(dt);
                astro.group.position.set(0, 2.55 + Math.sin(el * 3.5) * 0.12, 3.8);
                astro.setOpacity(Math.min(1, el * 6) * (1 - smooth(1.35, 1.85, el)));
              },
              get done() { return el >= 1.88; },
              dispose() { astro.dispose(); },
            });
            let cEl = 0;
            sim.addCustom({
              group: chalice.group,
              update(dt) {
                cEl += dt;
                chalice.update(dt);
                chalice.group.position.set(0, 0.95 + Math.sin(cEl * 4.0) * 0.08, 3.8);
                chalice.group.rotation.y += dt * 1.8;
                chalice.setOpacity(Math.min(1, cEl * 6) * (1 - smooth(1.35, 1.85, cEl)));
              },
              get done() { return cEl >= 1.88; },
              dispose() { chalice.dispose(); },
            });

            sim.addCustom(new BeamCylinder3D({
              p0: new THREE.Vector3(0, 4.8, 3.8),
              p1: new THREE.Vector3(0, 0.02, 3.8),
              radius: 0.52, duration: 1.25, palette: goldP.pal, texStyle, defaultTex: 'silk', hdr: 2.35,
            }));
            sim.spawnAirDistortion({
              kind: 'implode', x: 0, y: 1.5, z: 3.8,
              r0: 0.25, r1: 2.8, duration: 0.65, strength: 0.88,
            });
            sim.spawnFlipbook({
              atlas: 'fbStarburst', x: 0, y: 1.55, z: 3.8,
              life: 0.62, size0: 1.45, size1: 3.1, palette: goldP.pal, hdr: 2.6,
            });
            dummies.forEach((d) => {
              if (d.root.visible) d.hit({ dirX: -d.homeX * 0.35, dirZ: -1, power: 1.8, flashColor: goldP.hotHex });
            });
          },
        },
      ];
    },
  },

  // =========================================================================
  // #09 GameDev Cheatsheet 演算法實戰 ①：群聚分離導彈齊射 (Steering Arrive + Separation + Spatial Grid + Slerp)
  // =========================================================================
  {
    id: 'algo_steering_swarm_barrage',
    cat: 'gamedev_algo',
    cls: '演算法實戰 · Steering',
    title: '演算法① 群聚分離導彈陣 (Steering + 空間網格 + Slerp)',
    codeId: 'algo.steering.swarm_arrive',
    duration: 3.10,
    peakTime: 0.92,
    handlesDynamicScale: true,
    contactTimes: [0.68, 0.92, 1.22],
    hitbox: { kind: 'circle', cx: 0, cz: 7.2, radius: 3.1 },
    specNotes: [
      '實作 gamedev-cheatsheet #25 Steering (Seek/Arrive + Separation) + #30 Uniform Spatial Grid (9 宮格 O(N) 鄰居推斥) + #32 4-Bucket 時間切片',
      '24 枚奧術飛矛升空後自動互斥散開絕不重疊成單點，並以 #07 最短弧 Quaternion Slerp (dot<0 取反) 平滑轉向命中目標！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageArcane', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      resetCircleDummies(dummies, this.hitbox, true);
    },
    keyframes: makeStaffCastKeyframes(0.24, 0.38, 3.0),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('mageArcane', paletteOverride);
      const goldP = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.05,
          isPreGather: true,
          run() {
            const s0 = new Sigil3D({
              x: 0, y: 0.02, z: 0, radius: 1.55, duration: 2.05,
              style: 'cyberRune', palette: P.pal, hdr: 2.05, wallHeight: 0.36,
            });
            s0._skipAutoMap = true;
            sim.addCustom(s0);
            sim.spawnChargeGather({
              variant: 'funnels',
              getAnchor: () => fighter.getStaffTipWorld(),
              duration: 0.32,
              radius: 1.45,
              palette: P.pal,
            });
          },
        },
        {
          t: 0.38,
          run() {
            const origin = fighter.getStaffTipWorld();
            const activeDummies = dummies.filter((d) => d.root.visible);
            const targetCenters = activeDummies.length
              ? activeDummies.map((d) => d.chestWorld())
              : [new THREE.Vector3(hb.cx, 1.15, hb.cz)];

            spawnSteeringSwarmVolley(sim, {
              count: 24,
              origin,
              targets: targetCenters,
              maxSpeed: Math.max(17.5, hb.cz * 2.25),
              unitWidth: 0.28,
              palette: P.pal,
              RibbonTrail3D,
              rampToColors,
              seed: seed + 511,
              onAgentImpact(pt, norm, idx) {
                const useGold = idx % 3 === 0;
                const hitP = useGold ? goldP : P;
                sim.spawnFlipbook({
                  atlas: idx % 2 === 0 ? 'fbHitBurst' : 'fbStarburst',
                  x: pt.x, y: pt.y, z: pt.z,
                  life: 0.30, size0: 0.45, size1: 1.05,
                  palette: hitP.pal, hdr: 2.35,
                });
                for (let s = 0; s < 3; s++) {
                  sim.spawnSpark({
                    x: pt.x, y: pt.y, z: pt.z,
                    vx: norm.x * 4.2 + (s - 1) * 1.4,
                    vy: norm.y * 3.5 + 1.8,
                    vz: norm.z * 4.2,
                    life: 0.20, size: 0.044, stretch: 0.032, color: hitP.hotHex,
                  });
                }
                if (idx % 6 === 0) {
                  sim.spawnAirDistortion({
                    kind: 'shock', x: pt.x, y: pt.y, z: pt.z,
                    r0: 0.15, r1: 1.35, duration: 0.28, strength: 0.55,
                  });
                  const d = activeDummies[idx % Math.max(1, activeDummies.length)];
                  d?.hit({ dirX: -norm.x, dirZ: -norm.z, power: 1.15, flashColor: hitP.hotHex });
                }
              },
            });
          },
        },
      ];
    },
  },

  // =========================================================================
  // #10 GameDev Cheatsheet 演算法實戰 ②：Binary-Heap Octile A* 八向尋路地脈雷火裂隙
  // =========================================================================
  {
    id: 'algo_astar_magma_fissure',
    cat: 'gamedev_algo',
    cls: '演算法實戰 · A* 尋路',
    title: '演算法② A* 八向尋路地脈裂隙 (二元堆積 + Octile 繞障)',
    codeId: 'algo.astar.octile_fissure',
    duration: 3.85,
    peakTime: 1.38,
    handlesDynamicScale: true,
    contactTimes: [0.85, 1.38, 1.75],
    hitbox: { kind: 'rect', width: 3.6, length: 9.6 },
    specNotes: [
      '實作 gamedev-cheatsheet #22 A* Pathfinding：Binary Min-Heap 開放集 + 8 向 Octile 啟發式 + f 同分取較小 h 破平手',
      '場上升起 3 座玄武岩符文方尖碑阻擋直線，地脈雷火自動計算最短八向路徑繞過障礙直擊三具木樁並引爆石塊！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('earthMagma', paletteOverride);
      fighter.setLoadout('mage_staff', hotHex);
      const aoe = Math.min(1.5, getScaledHitbox(this.hitbox).width / 3.6);
      const rng = getScaledHitbox(this.hitbox).length / 6.0;
      dummies[0].reset(0, 4.8 * rng, true);
      dummies[1].reset(-1.25 * aoe, 4.1 * rng, true);
      dummies[2].reset(1.25 * aoe, 4.1 * rng, true);
    },
    keyframes: makeStaffCastKeyframes(0.22, 0.36, 3.10),
    buildEvents(sim, fighter, dummies, _seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('earthMagma', paletteOverride);
      const voltP = resolvePal('mageVolt', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      const wMul = hb.width / 3.6;
      const lMul = hb.length / 6.0;
      return [
        {
          t: 0.36,
          run() {
            const cols = 15, rows = 22;
            const toWorld = (c, r) => new THREE.Vector3(
              (c - 7) * 0.28 * wMul,
              0.03,
              (r * 0.26 + 0.25) * lMul
            );
            const toCell = (wx, wz) => [
              clamp(Math.round(wx / (0.28 * wMul) + 7), 0, cols - 1),
              clamp(Math.round((wz / lMul - 0.25) / 0.26), 0, rows - 1),
            ];

            // Place 3 obstacle obelisk clusters blocking direct center/flank lanes
            const blockerCenters = [[7, 7], [4, 11], [10, 11]];
            const blocked = new Set();
            for (const [bc, br] of blockerCenters) {
              for (let dc = -1; dc <= 1; dc++) {
                for (let dr = -1; dr <= 1; dr++) {
                  blocked.add((br + dr) * cols + (bc + dc));
                }
              }
              const ob = buildTotemObeliskAssembly({ palette: voltP.pal, scale: 0.58 });
              const wp = toWorld(bc, br);
              ob.group.position.set(wp.x, 0, wp.z);
              let el = 0;
              sim.addCustom({
                group: ob.group,
                update(dt) {
                  el += dt;
                  ob.update(dt);
                  const pop = ease.outBack(clamp(el / 0.22), 1.8);
                  const sink = smooth(2.05, 2.42, el);
                  ob.group.scale.setScalar(0.58 * pop * (1 - sink));
                  ob.setOpacity(1 - sink);
                },
                get done() { return el >= 2.45; },
                dispose() { ob.dispose(); },
              });
            }

            const startRC = [7, 1];
            const activeDummies = dummies.filter((d) => d.root.visible);
            activeDummies.forEach((d, di) => {
              const goalRC = toCell(d.homeX, d.homeZ);
              const path = findPathAStarOctile(cols, rows, blocked, startRC, goalRC);
              const worldPts = path.map(([c, r]) => toWorld(c, r));
              const geo = buildTaperedPrismGeo(worldPts, 0.055, 0.085, 0.035, 0.35);
              const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(di === 1 ? voltP.hotHex : P.hotHex).multiplyScalar(1.85),
                transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
              });
              const mesh = new THREE.Mesh(geo, mat);
              let el = 0;
              let cursor = 0;
              let detonated = false;

              sim.addCustom({
                mesh,
                update(dt) {
                  el += dt;
                  const prog = clamp((el - 0.28) / 0.92, 0, 1);
                  const targetIdx = Math.floor(prog * (worldPts.length - 1));
                  while (cursor < targetIdx) {
                    cursor++;
                    const pt = worldPts[cursor];
                    sim.spawnFlipbook({
                      atlas: cursor % 2 === 0 ? 'fbFlame' : 'fbLightning',
                      x: pt.x, y: 0.32, z: pt.z,
                      life: 0.34, size0: 0.42, size1: 0.85,
                      palette: cursor % 2 === 0 ? P.pal : voltP.pal, hdr: 2.1,
                    });
                  }
                  if (prog >= 1 && !detonated) {
                    detonated = true;
                    fighter.hitStop = 0.06;
                    sim.spawnGroundZone({
                      x: d.homeX, z: d.homeZ, _mapped: true, radius: 1.25, duration: 1.75,
                      kind: 'burning', palette: P.pal, emitFlames: true,
                    });
                    sim.spawnRockDebris({
                      x: d.homeX, y: 0.12, z: d.homeZ,
                      count: 6, radius: 0.28, life: 0.92, style: 'basalt', palette: P.pal,
                    });
                    sim.spawnAirDistortion({
                      kind: 'shock', x: d.homeX, y: 0.65, z: d.homeZ,
                      r0: 0.2, r1: 1.85, duration: 0.38, strength: 0.72,
                    });
                    d.hit({ dirX: 0, dirZ: 1, power: 1.65, flashColor: P.hotHex });
                  }
                  mat.opacity = Math.min(1, Math.max(0, (el - 0.26) * 6)) * (1 - smooth(1.85, 2.38, el));
                },
                get done() { return el >= 2.42; },
                dispose() { geo.dispose(); mat.dispose(); },
              });
            });
          },
        },
      ];
    },
  },

  // =========================================================================
  // #11 GameDev Cheatsheet 演算法實戰 ③：Swept-Raycast 防穿隧超音速跳彈電磁砲
  // =========================================================================
  {
    id: 'algo_swept_ricochet_railgun',
    cat: 'gamedev_algo',
    cls: '演算法實戰 · Swept CCD',
    title: '演算法③ Swept-Raycast 防穿隧跳彈電磁砲 (法線反射+i-Frames)',
    codeId: 'algo.ccd.swept_ricochet',
    duration: 2.95,
    peakTime: 0.88,
    handlesDynamicScale: true,
    contactTimes: [0.58, 0.88, 1.18],
    hitbox: { kind: 'rect', width: 3.8, length: 9.8 },
    specNotes: [
      '實作 gamedev-cheatsheet #26 Swept-Segment Anti-Tunneling + #01/#02 表面法線反射 v\'=v-2(v·n)n + #17 Hit-Stop + #18 10Hz 無敵幀閃爍',
      '28m/s 超高速電漿束對整段位移線段進行連續碰撞檢測，精準在兩側半透明水晶鏡盾與木樁間折射跳彈絕不穿牆！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('mageVolt', paletteOverride);
      fighter.setLoadout('bow', hotHex);
      const hb = getScaledHitbox(this.hitbox);
      const wMul = hb.width / 3.8;
      const lMul = hb.length / 6.2;
      dummies[0].reset(0, 4.9 * lMul, true);
      dummies[1].reset(-1.05 * wMul, 2.6 * lMul, true);
      dummies[2].reset(1.05 * wMul, 3.8 * lMul, true);
    },
    keyframes: [
      { t: 0.00, pose: { ...REST_POSE, torsoYaw: -0.52, shLPitch: -1.42, shLYaw: 0.48, shRPitch: -1.25, elRPitch: -0.85, bowDraw: 0.15, bowArrow: 1 } },
      { t: 0.26, ease: ease.inOutSine, pose: { ...REST_POSE, crouch: 0.16, torsoYaw: -0.62, headYaw: 0.56, shLPitch: -1.55, shLYaw: 0.56, shRPitch: -1.48, shRYaw: -0.38, elRPitch: -1.18, bowDraw: 1.0, bowArrow: 1 } },
      { t: 0.38, ease: ease.outExpo, pose: { ...REST_POSE, z: -0.10, crouch: 0.14, torsoYaw: -0.58, headYaw: 0.54, shLPitch: -1.58, shLYaw: 0.54, shRPitch: -1.68, shRYaw: -0.62, elRPitch: -0.50, bowDraw: 0.0, bowArrow: 0 } },
      { t: 0.48, ease: ease.inOutSine, pose: { ...REST_POSE, crouch: 0.16, torsoYaw: -0.62, headYaw: 0.56, shLPitch: -1.55, shLYaw: 0.56, shRPitch: -1.48, shRYaw: -0.38, elRPitch: -1.16, bowDraw: 0.92, bowArrow: 1 } },
      { t: 0.54, ease: ease.outExpo, pose: { ...REST_POSE, z: -0.12, crouch: 0.14, torsoYaw: -0.58, headYaw: 0.54, shLPitch: -1.58, shLYaw: 0.54, shRPitch: -1.68, shRYaw: -0.62, elRPitch: -0.50, bowDraw: 0.0, bowArrow: 0 } },
      { t: 0.64, ease: ease.inOutSine, pose: { ...REST_POSE, crouch: 0.16, torsoYaw: -0.62, headYaw: 0.56, shLPitch: -1.55, shLYaw: 0.56, shRPitch: -1.48, shRYaw: -0.38, elRPitch: -1.16, bowDraw: 0.92, bowArrow: 1 } },
      { t: 0.70, ease: ease.outExpo, pose: { ...REST_POSE, z: -0.14, crouch: 0.14, torsoYaw: -0.58, headYaw: 0.54, shLPitch: -1.58, shLYaw: 0.54, shRPitch: -1.68, shRYaw: -0.62, elRPitch: -0.50, bowDraw: 0.0, bowArrow: 0 } },
      { t: 2.80, ease: ease.inOutCubic, pose: { ...REST_POSE } },
    ],
    buildEvents(sim, fighter, dummies, _seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('mageVolt', paletteOverride);
      const frostP = resolvePal('mageFrost', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      const wMul = hb.width / 3.8;
      const lMul = hb.length / 6.2;

      return [
        {
          t: 0.38,
          run() {
            const mirrors = [
              { pos: new THREE.Vector3(-1.65 * wMul, 1.15, 1.85 * lMul), yaw: Math.PI * 0.34 },
              { pos: new THREE.Vector3(1.65 * wMul, 1.15, 3.25 * lMul),  yaw: -Math.PI * 0.34 },
            ];
            const mirrorPlanes = mirrors.map((m) => {
              const sh = buildTowerShieldAssembly({ palette: frostP.pal, scale: 0.95, sigilStyle: null });
              sh.group.position.copy(m.pos);
              sh.group.rotation.y = m.yaw;
              let el = 0;
              sim.addCustom({
                group: sh.group,
                update(dt) {
                  el += dt;
                  sh.update(dt);
                  sh.setOpacity(Math.min(1, el * 7) * (1 - smooth(1.45, 1.82, el)));
                },
                get done() { return el >= 1.85; },
                dispose() { sh.dispose(); },
              });
              const normal = new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw)).normalize();
              return { center: m.pos, normal };
            });

            // Supersonic railgun bow muzzle shock-rings!
            const muzzle0 = fighter.getBowMuzzleWorld();
            spawnMachShockRings3D(sim, {
              p0: muzzle0.clone(),
              p1: mirrorPlanes[0].center.clone(),
              ringCount: 3, radius0: 0.22, radius1: 0.56, duration: 0.34, palette: P.pal, _mapped: true,
            });

            // Launch 3 swept-CCD ricochet bolts staggered by 0.16s aligned with the 3 bow shots (0.38, 0.54, 0.70)
            [0.00, 0.16, 0.32].forEach((launchDelay, bi) => {
              const muzzle = fighter.getBowMuzzleWorld();
              const pos = new THREE.Vector3(muzzle.x, muzzle.y, muzzle.z);
              const prev = pos.clone();
              const aim = mirrorPlanes[0].center.clone().sub(pos).normalize();
              const vel = aim.multiplyScalar(28.0);
              const trail = new RibbonTrail3D({ maxPoints: 26, width: 0.22, palette: bi === 1 ? frostP.pal : P.pal, hdr: 2.4 });
              sim.root.add(trail.group);
              const hitTargets = new Set(); // #21 Hitbox/Hurtbox: at most 1 hit per target per bolt!
              let age = -launchDelay;
              let finished = false;
              let fadeT = 0;

              sim.addCustom({
                update(dt) {
                  age += dt;
                  if (age < 0) return;
                  if (!finished) {
                    prev.copy(pos);
                    const next = pos.clone().addScaledVector(vel, dt);

                    // Check swept segment against angled crystal mirrors
                    for (let mi = 0; mi < mirrorPlanes.length; mi++) {
                      const mp = mirrorPlanes[mi];
                      const hitM = sweptSegmentPlaneHit(prev, next, mp.center, mp.normal, 1.35);
                      if (hitM) {
                        pos.copy(hitM.point).addScaledVector(hitM.normal, 0.04);
                        // Redirect cleanly toward next mirror or final dummy after surface-normal bounce!
                        reflectVelocityAroundNormal(vel, hitM.normal, 1.0);
                        const guideTarget = mi === 0 ? mirrorPlanes[1].center : dummies[0].chestWorld();
                        vel.lerp(guideTarget.clone().sub(pos).normalize().multiplyScalar(28.0), 0.65);
                        sim.spawnFlipbook({
                          atlas: 'fbLightning', x: hitM.point.x, y: hitM.point.y, z: hitM.point.z,
                          life: 0.28, size0: 0.55, size1: 1.25, palette: frostP.pal, hdr: 2.5,
                        });
                        sim.spawnAirDistortion({
                          kind: 'shock', x: hitM.point.x, y: hitM.point.y, z: hitM.point.z,
                          r0: 0.15, r1: 1.45, duration: 0.25, strength: 0.65,
                        });
                        next.copy(pos).addScaledVector(vel, dt * (1 - hitM.t));
                        break;
                      }
                    }

                    // Check swept segment against dummy hurtboxes (#21 + #18 i-Frames)
                    for (const d of dummies) {
                      if (!d.root.visible || hitTargets.has(d)) continue;
                      const hitD = sweptSegmentSphereHit(prev, next, d.chestWorld(), 0.55);
                      if (hitD) {
                        hitTargets.add(d);
                        fighter.hitStop = 0.05; // #17 Hit-stop!
                        d.hit({ dirX: vel.x, dirZ: vel.z, power: 1.6, flashColor: P.hotHex, iFrames: 0.48 });
                        sim.spawnFlipbook({
                          atlas: 'fbHitBurst', x: hitD.point.x, y: hitD.point.y, z: hitD.point.z,
                          life: 0.30, size0: 0.65, size1: 1.45, palette: P.pal, hdr: 2.6,
                        });
                      }
                    }

                    pos.copy(next);
                    trail.pushPoint(pos);
                    trail.update(dt, 0);
                    if (age >= Math.max(0.66, (hb.length * 1.68) / 28.0) || pos.z > hb.length + 1.2) finished = true;
                  } else {
                    fadeT += dt;
                    trail.update(dt, 5.2);
                  }
                },
                get done() { return finished && fadeT >= 0.26; },
                dispose() {
                  sim.root.remove(trail.group);
                  trail.dispose();
                },
              });
            });
          },
        },
      ];
    },
  },

  // =========================================================================
  // #12 GameDev Cheatsheet 演算法實戰 ④：GPU Instancing 三段 LOD 碎岩風暴 (150 顆單批 + 視錐剔除 + 擠壓拉伸)
  // =========================================================================
  {
    id: 'algo_instanced_lod_boulder_storm',
    cat: 'gamedev_algo',
    cls: '演算法實戰 · GPU Instancing',
    title: '演算法④ GPU Instancing 三段 LOD 隕石雨 (150顆單批+視錐剔除)',
    codeId: 'algo.perf.instanced_lod_cull',
    duration: 4.15,
    peakTime: 1.35,
    handlesDynamicScale: true,
    contactTimes: [0.65, 1.35, 2.05],
    hitbox: { kind: 'circle', cx: 0, cz: 7.4, radius: 3.3 },
    specNotes: [
      '實作 gamedev-cheatsheet #29 GPU Instancing + #03 3-Level LOD (100%/30%/10% 面數 + 10% 遲滯帶防閃爍) + #04 攝影機視錐球體剔除',
      '150 顆實體熔岩巨石僅需 3 個批次 Draw Call 即可高速渲染，落地彈跳套用 #13 等體積擠壓拉伸 (Squash & Stretch) 與 #12 Trauma² 平滑震屏！',
    ],
    setup(fighter, dummies, paletteOverride) {
      const { hotHex } = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('greatsword', hotHex);
      resetCircleDummies(dummies, this.hitbox, true);
    },
    keyframes: makeSkyChantKeyframes(0.20, 0.36, 3.80),
    buildEvents(sim, fighter, dummies, seed, paletteOverride) {
      installChargeVariantHook(sim);
      const P = resolvePal('fireInferno', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.36,
          run() {
            attachWeaponBladeTrail3D(sim, fighter, { duration: 1.45, width: 0.38, palette: P.pal, hdr: 2.55, sparkRate: 36 });
            spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.75, duration: 1.05, palette: P.pal, _mapped: true });
            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true, radius: hb.radius * 0.95, duration: 2.36,
              kind: 'crater', palette: PAL3D.earthMagma, emitFlames: false,
            });
            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true, radius: hb.radius * 0.76, duration: 2.40,
              kind: 'burning', palette: P.pal, emitFlames: true,
            });

            const instMat = makeMagmaRockMaterial({
              palette: P.pal,
              rockColor: '#241a1d',
              veinStrength: 2.05,
              opacity: 1.0,
            });
            instMat.depthWrite = true;

            spawnInstancedLODBoulderStorm(sim, sim._lastCam || null, {
              count: 150,
              cx: hb.cx,
              cz: hb.cz,
              radius: hb.radius,
              duration: 2.46,
              material: instMat,
              makeRockGeo: makeCraggyRockGeo,
              seed: seed + 888,
              onWaveImpact(w) {
                sim.spawnAirDistortion({
                  kind: 'shock', x: hb.cx, y: 0.65, z: hb.cz,
                  r0: 0.25, r1: hb.radius * 0.95, duration: 0.36, strength: 0.72,
                });
                sim.addCustom(new GroundWave3D({
                  x: hb.cx, z: hb.cz,
                  maxRadius: hb.radius * 0.90,
                  thickness: 0.48, height: 0.72, duration: 0.42,
                  palette: P.pal, hdr: 2.25, seed: seed + w * 13,
                }));
                sim.spawnDarkSmoke({
                  x: hb.cx + (w - 2) * 0.55, y: 0.95, z: hb.cz,
                  vy: 1.0, life: 0.75, size0: 1.1, size1: 2.4, opacity: 0.52,
                });
                dummies.forEach((d) => {
                  if (d.root.visible) d.hit({ dirX: d.homeX * 0.35, dirZ: 1, power: 1.4, flashColor: P.hotHex });
                });
              },
            });
          },
        },
      ];
    },
  },
];
