import * as THREE from 'three';
import {
  TAU, clamp, lerp, smooth, ease, PAL3D, FX_CONFIG,
  GroundWave3D, VortexFunnel3D, BeamCylinder3D, DomeShield3D, ShockSphere3D,
  getScaledHitbox, makeTranslucentConstructMaterial,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import {
  resolvePal, makeStaffCastKeyframes,
  makeLevelUpTriumphKeyframes, makeEmpowerBuffKeyframes,
  attachWeaponBladeTrail3D, spawnMartialStanceGust3D,
} from './fx_helpers.js';
import { MagicArray3D } from './magic_arrays3d.js';
import {
  buildHolyChaliceAssembly,
  buildSeraphWingsAssembly,
  buildTowerShieldAssembly,
  buildDragonSpiritHeadAssembly,
  buildArmillaryAstrolabeAssembly,
  buildWorldTreeStaffAssembly,
  buildSeraphResurrectionAnkhAssembly,
} from './mesh_props3d.js';

// Palette dedicated to vibrant emerald-jade & warm golden-white restorative magic
const PAL_EMERALD_HEAL = ['#031f16', '#064e3b', '#059669', '#10b981', '#34d399', '#a7f3d0', '#f0fdf4'];
const PAL_DIAMOND_SHIELD = ['#081a2e', '#0c4a6e', '#0284c7', '#38bdf8', '#67e8f9', '#cffafe', '#ffffff'];

function hideEnemyDummies(dummies) {
  for (const d of dummies) d.reset(0, 0, false);
}

function hideAllAllies(allies) {
  if (!allies) return;
  for (const a of allies) a.reset(0, 0, false);
}

/** Helical rising 3D emerald/gold healing ribbons around any unit (caster or ally) */
function spawnHealingHelixRibbons(sim, {
  getCenter,
  duration = 1.45,
  radius = 0.68,
  height = 2.05,
  strands = 3,
  palette = PAL_EMERALD_HEAL,
  sigilStyle = 'nature',
} = {}) {
  const g = new THREE.Group();
  const c0 = getCenter();
  g.position.set(c0.x, 0.05, c0.z);
  const mat = makeTranslucentConstructMaterial({
    palette,
    sigilStyle,
    useHexLattice: false,
    baseAlpha: 0.30,
    rimAlpha: 0.96,
    hdr: 2.35,
  });

  const geos = [];
  for (let s = 0; s < strands; s++) {
    const pts = [];
    const phase = (s / strands) * TAU;
    for (let i = 0; i <= 26; i++) {
      const u = i / 26;
      const ang = phase + u * TAU * 1.45;
      const r = radius * (1.0 - u * 0.28);
      pts.push(new THREE.Vector3(Math.cos(ang) * r, u * height, Math.sin(ang) * r));
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.032, 6, false);
    geos.push(geo);
    g.add(new THREE.Mesh(geo, mat));
  }

  let el = 0;
  sim.addCustom({
    group: g,
    _skipAutoMap: true,
    update(dt) {
      el += dt;
      const c = getCenter();
      g.position.set(c.x, 0.05, c.z);
      g.rotation.y = el * 3.8;
      mat.uniforms.uTime.value = el * 2.2;
      const fade = Math.min(1, el * 6.0) * (1 - smooth(duration - 0.32, duration, el));
      mat.uniforms.uOpacity.value = fade;
      mat.uniforms.uDissolve.value = (1 - fade) * 0.75;
    },
    get done() { return el >= duration; },
    dispose() {
      geos.forEach((geo) => geo.dispose());
      mat.dispose();
    },
  });
}

/** Place 3 party companions in a clear tactical crescent inside a scaled party sanctuary circle */
function setupPartyFormation(allies, hb, { hpFracs = [0.28, 0.36, 0.42], shieldFrac = 0.0 } = {}) {
  if (!allies || allies.length < 3) return;
  const cx = hb.cx ?? 0;
  const cz = hb.cz ?? 5.5;
  const r = Math.min(hb.radius * 0.56, 2.85);
  allies[0].reset(cx - r * 0.85, cz - r * 0.18, true, { hpFrac: hpFracs[0], shieldFrac, yaw: Math.PI * 0.85 });
  allies[1].reset(cx + r * 0.85, cz - r * 0.18, true, { hpFrac: hpFracs[1], shieldFrac, yaw: -Math.PI * 0.85 });
  allies[2].reset(cx, cz + r * 0.62, true, { hpFrac: hpFracs[2], shieldFrac, yaw: Math.PI });
}

export const PRESETS_HEAL_SUPPORT = [
  // =========================================================================
  // A. 自身治癒 / 護盾 / 涅槃 (Target: Self — 3 Presets)
  // =========================================================================
  {
    id: 'sup_self_emerald_vitality',
    cat: 'heal_support',
    targetTeam: 'self',
    chantArchetype: 'sacred_prayer',
    baseChantDur: 1.05,
    cls: '自身聖癒 · 生命回春',
    title: '自身聖癒：翡翠生機回春湧泉',
    codeId: 'support.self.emerald_vitality',
    duration: 2.85,
    peakTime: 0.42,
    handlesDynamicScale: true,
    contactTimes: [0.12, 0.55, 1.05],
    hitbox: { kind: 'circle', targetTeam: 'self', cx: 0, cz: 0, radius: 2.6 },
    specNotes: [
      '施法者自身先進行聖禱詠唱聚氣，詠唱完畢瞬間腳下綻放翡翠生命曼荼羅與三股螺旋上升生機絲帶！',
      '施法者頭頂 3D 血條由殘血 28% 分三波平滑回滿至 100%，伴隨祝福羽光與懸浮翠玉十字徽記',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = paletteOverride ? resolvePal('windJade', paletteOverride) : { pal: PAL_EMERALD_HEAL, hotHex: '#34d399' };
      fighter.setLoadout('mage_staff', P.hotHex);
      fighter.enableSupportHUD({ hpFrac: 0.28, shieldFrac: 0.0 });
      hideEnemyDummies(dummies);
      hideAllAllies(allies);
    },
    keyframes: makeEmpowerBuffKeyframes(0.14, 0.24, 2.70, 'mage_staff'),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride) {
      const pal = paletteOverride ? resolvePal('windJade', paletteOverride).pal : PAL_EMERALD_HEAL;
      const hb = getScaledHitbox(this.hitbox);
      const r = hb.radius;
      return [
        {
          t: 0.24,
          run() {
            fighter.heal(0.36, '+HP 翡翠湧泉');
            sim.addCustom(new MagicArray3D({
              x: 0, y: 0.025, z: 0, _skipAutoMap: true,
              radius: r * 0.94, duration: 2.15,
              tradition: 'eastern', arrayKind: 'layered', layers: 2,
              style: 'nature', palette: pal, hdr: 2.15, exactStyle: true,
            }));
            spawnHealingHelixRibbons(sim, {
              getCenter: () => fighter.root.position,
              duration: 1.95, radius: 0.78 * FX_CONFIG.aoeScale, height: 2.35, strands: 3, palette: pal,
            });
            sim.spawnFlipbook({
              atlas: 'fbBlessing', x: 0, y: 1.15, z: 0, _mapped: true,
              life: 0.78, size0: 1.25, size1: 2.65, palette: pal, hdr: 2.35,
            });
            sim.addCustom(new GroundWave3D({
              x: 0, z: 0, maxRadius: r * 0.92, thickness: 0.45, height: 0.65,
              duration: 0.52, palette: pal, hdr: 2.15, seed: seed + 5,
            }));
          },
        },
        {
          t: 0.78,
          run() {
            fighter.heal(0.42, '+HP 生命回滿 100%');
            sim.spawnNiagaraBurst({
              x: 0, y: 0.35, z: 0, _mapped: true,
              count: 56, spreadRadius: r * 0.65, speed0: 0.8, speed1: 2.8,
              gravity: -2.4, curl: 3.6, size0: 0.044, size1: 0.014,
              life0: 0.65, life1: 1.25, palette: pal, hdr: 2.3,
            });
          },
        },
      ];
    },
  },

  {
    id: 'sup_self_diamond_overshield',
    cat: 'heal_support',
    targetTeam: 'self',
    chantArchetype: 'martial_qi',
    noSigil: true,
    baseChantDur: 0.95,
    cls: '自身護盾 · 聖鎧障壁',
    title: '自身護盾：鑽白聖鎧超量障壁',
    codeId: 'support.self.diamond_overshield',
    duration: 2.80,
    peakTime: 0.38,
    handlesDynamicScale: true,
    contactTimes: [0.10, 0.48],
    hitbox: { kind: 'circle', targetTeam: 'self', cx: 0, cz: 0, radius: 2.5 },
    specNotes: [
      '騎士架盾蓄凝鬥氣（無魔法陣），展開六角蜂巢鑽白折射聖盾穹頂，四周環繞 4 面浮雕騎士塔盾護體！',
      '施法者頭頂同步疊滿鉑青色超量護盾條（Overshield 100%）',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = paletteOverride ? resolvePal('mageFrost', paletteOverride) : { pal: PAL_DIAMOND_SHIELD, hotHex: '#67e8f9' };
      fighter.setLoadout('sword_shield', P.hotHex);
      fighter.enableSupportHUD({ hpFrac: 0.82, shieldFrac: 0.0 });
      hideEnemyDummies(dummies);
      hideAllAllies(allies);
    },
    keyframes: makeEmpowerBuffKeyframes(0.14, 0.24, 2.65, 'sword_shield'),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride) {
      const pal = paletteOverride ? resolvePal('mageFrost', paletteOverride).pal : PAL_DIAMOND_SHIELD;
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            fighter.heal(0.18, '+HP 聖鎧凝結');
            fighter.addShield(1.0, '+100% 鑽白聖盾');
            attachWeaponBladeTrail3D(sim, fighter, { duration: 0.95, width: 0.28, palette: pal, hdr: 2.3 });
            spawnMartialStanceGust3D(sim, {
              x: 0, z: 0, radius: hb.radius * 0.78, duration: 1.35, palette: pal, hdr: 2.2, _mapped: true,
            });
            const dome = new DomeShield3D({
              x: 0, y: 0.02, z: 0, radius: hb.radius * 0.78, duration: 2.05, palette: pal, hdr: 2.25,
            });
            dome._skipAutoMap = true;
            sim.addCustom(dome);

            const orbitGroup = new THREE.Group();
            const shields = [];
            for (let i = 0; i < 4; i++) {
              const sh = buildTowerShieldAssembly({ palette: pal, scale: 0.72 });
              orbitGroup.add(sh.group);
              shields.push({ sh, baseA: (i / 4) * TAU });
            }
            let el = 0;
            sim.addCustom({
              group: orbitGroup,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                const r = hb.radius * 0.56;
                const op = Math.min(1, el * 6) * (1 - smooth(1.65, 2.15, el));
                for (const s of shields) {
                  s.sh.update(dt);
                  const a = s.baseA + el * 2.4;
                  s.sh.group.position.set(Math.cos(a) * r, 1.08 + Math.sin(el * 4 + s.baseA) * 0.08, Math.sin(a) * r);
                  s.sh.group.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
                  s.sh.setOpacity(op);
                }
              },
              get done() { return el >= 2.18; },
              dispose() { shields.forEach((s) => s.sh.dispose()); },
            });

            sim.addCustom(new GroundWave3D({
              x: 0, z: 0, maxRadius: hb.radius * 0.94, thickness: 0.42, height: 0.62,
              duration: 0.45, palette: pal, hdr: 2.2, seed: seed + 17,
            }));
          },
        },
      ];
    },
  },

  {
    id: 'sup_self_nirvana_rebirth',
    cat: 'heal_support',
    targetTeam: 'self',
    chantArchetype: 'eastern_qimen',
    baseChantDur: 1.20,
    cls: '自身涅槃 · 浴火再生',
    title: '自身涅槃：鳳凰浴火淨化再生',
    codeId: 'support.self.phoenix_nirvana',
    duration: 3.05,
    peakTime: 0.48,
    handlesDynamicScale: true,
    contactTimes: [0.12, 0.52],
    hitbox: { kind: 'circle', targetTeam: 'self', cx: 0, cz: 0, radius: 3.0 },
    specNotes: [
      '瀕死 15% HP 狀態下詠唱涅槃聖火，展開十二羽金凰光翼，瞬間回滿 100% 生命並獲得 55% 聖火護盾！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('unarmed', P.hotHex);
      fighter.enableSupportHUD({ hpFrac: 0.15, shieldFrac: 0.0 });
      hideEnemyDummies(dummies);
      hideAllAllies(allies);
    },
    keyframes: makeLevelUpTriumphKeyframes(0.14, 0.24, 2.90),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride) {
      const goldP = resolvePal('holyGold', paletteOverride);
      const fireP = resolvePal('fireInferno', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            fighter.heal(0.85, '✦鳳凰涅槃 100%');
            fighter.addShield(0.55, '+涅槃聖火盾');
            const wings = buildSeraphWingsAssembly({ palette: goldP.pal, scale: 1.55 });
            let wEl = 0;
            sim.addCustom({
              group: wings.group,
              _skipAutoMap: true,
              update(dt) {
                wEl += dt;
                wings.update(dt * 1.35);
                wings.group.position.set(0, 1.48 + Math.sin(wEl * 4) * 0.08, -0.22);
                wings.setOpacity(Math.min(1, wEl * 6) * (1 - smooth(1.85, 2.45, wEl)));
              },
              get done() { return wEl >= 2.50; },
              dispose() { wings.dispose(); },
            });
            sim.spawnFlipbook({
              atlas: 'fbFeatherBurst', x: 0, y: 1.35, z: 0, _mapped: true,
              life: 0.82, size0: 1.5, size1: 3.4, palette: goldP.pal, hdr: 2.55,
            });
            sim.spawnFlipbook({
              atlas: 'fbFlame', x: 0, y: 0.95, z: 0, _mapped: true,
              life: 0.72, size0: 1.2, size1: 2.6, palette: fireP.pal, hdr: 2.25,
            });
            sim.addCustom(new GroundWave3D({
              x: 0, z: 0, maxRadius: hb.radius * 0.95, thickness: 0.55, height: 0.85,
              duration: 0.52, palette: goldP.pal, hdr: 2.35, seed: seed + 29,
            }));
          },
        },
      ];
    },
  },

  // =========================================================================
  // B. 單體遠距隊友治療 / 復活 / 驅散 / 雙人連攜 (Target: Single Ally — 6 Presets)
  // =========================================================================
  {
    id: 'sup_ally_holy_chalice_pour',
    cat: 'heal_support',
    targetTeam: 'ally',
    chantArchetype: 'sacred_prayer',
    baseChantDur: 1.15,
    cls: '單體聖療 · 甘露灌頂',
    title: '單體聖療：祝聖金盃甘露灌頂',
    codeId: 'support.ally.holy_chalice',
    duration: 2.95,
    peakTime: 0.45,
    handlesDynamicScale: true,
    contactTimes: [0.12, 0.58],
    hitbox: { kind: 'circle', targetTeam: 'ally', cx: 0, cz: 7.0, radius: 2.2 },
    specNotes: [
      '施法距離拉大至 7.0m！施法者詠唱完畢後，遠端重傷隊友（22% HP）頭頂顯現 3D 祝聖金盃傾瀉翡翠聖光柱，血量回滿！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = paletteOverride ? resolvePal('holyGold', paletteOverride) : { pal: PAL_EMERALD_HEAL, hotHex: '#34d399' };
      fighter.setLoadout('mage_staff', P.hotHex);
      fighter.resetSupportHUD();
      hideEnemyDummies(dummies);
      hideAllAllies(allies);
      const hb = getScaledHitbox(this.hitbox);
      if (allies[0]) allies[0].reset(hb.cx, hb.cz, true, { hpFrac: 0.22, shieldFrac: 0.0, yaw: Math.PI });
    },
    keyframes: makeStaffCastKeyframes(0.14, 0.24, 2.80),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const pal = paletteOverride ? resolvePal('windJade', paletteOverride).pal : PAL_EMERALD_HEAL;
      const goldP = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      const ally = allies[0];
      return [
        {
          t: 0.24,
          run() {
            const chalice = buildHolyChaliceAssembly({ palette: goldP.pal, scale: 1.45 });
            let el = 0;
            sim.addCustom({
              group: chalice.group,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                chalice.update(dt);
                chalice.group.position.set(hb.cx, 3.25 + Math.sin(el * 3.5) * 0.08, hb.cz);
                chalice.group.rotation.z = Math.sin(Math.min(1, el * 2.2) * Math.PI * 0.5) * 0.42;
                chalice.setOpacity(Math.min(1, el * 6) * (1 - smooth(1.75, 2.25, el)));
              },
              get done() { return el >= 2.30; },
              dispose() { chalice.dispose(); },
            });

            const beam = new BeamCylinder3D({
              p0: new THREE.Vector3(hb.cx, 3.15, hb.cz),
              p1: new THREE.Vector3(hb.cx, 0.05, hb.cz),
              radius: hb.radius * 0.28, duration: 1.45,
              palette: pal, defaultTex: 'silk', hdr: 2.35,
            });
            beam._skipAutoMap = true;
            sim.addCustom(beam);

            if (ally) {
              ally.heal(0.45, '+HP 聖盃甘露');
              spawnHealingHelixRibbons(sim, {
                getCenter: () => ally.worldPosition(),
                duration: 1.85, radius: 0.72, height: 2.2, strands: 3, palette: pal,
              });
            }
            sim.spawnFlipbook({
              atlas: 'fbBlessing', x: hb.cx, y: 1.25, z: hb.cz, _mapped: true,
              life: 0.75, size0: 1.25, size1: 2.65, palette: pal, hdr: 2.35,
            });
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.92, thickness: 0.44, height: 0.65,
              duration: 0.48, palette: pal, hdr: 2.15, seed: seed + 31,
            }));
          },
        },
        {
          t: 0.75,
          run() {
            if (ally) ally.heal(0.40, '+HP 痊癒 100%');
          },
        },
      ];
    },
  },

  {
    id: 'sup_ally_seraph_resurrection',
    cat: 'heal_support',
    targetTeam: 'ally',
    chantArchetype: 'western_cathedral',
    baseChantDur: 1.65,
    cls: '單體復活 · 奇蹟甦生',
    title: '單體復活：熾天聖十字奇蹟甦生',
    codeId: 'support.ally.seraph_resurrect',
    duration: 3.35,
    peakTime: 0.52,
    handlesDynamicScale: true,
    contactTimes: [0.15, 0.65],
    hitbox: { kind: 'circle', targetTeam: 'ally', cx: 0, cz: 7.4, radius: 2.6 },
    specNotes: [
      '遠距 7.4m 倒地陣亡隊友（0% HP 倒臥姿態）！施法者完成莊嚴聖詠後，高空降下 BMesh 精雕「熾天甦生聖十字聖物」與十二羽聖翼！',
      '金色天柱貫注瞬間，倒地隊友起身復甦並回滿 100% 生命與神聖護盾！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = resolvePal('holyGold', paletteOverride);
      fighter.setLoadout('mage_staff', P.hotHex);
      fighter.resetSupportHUD();
      hideEnemyDummies(dummies);
      hideAllAllies(allies);
      const hb = getScaledHitbox(this.hitbox);
      if (allies[0]) allies[0].reset(hb.cx, hb.cz, true, { hpFrac: 0.0, fallen: true, yaw: Math.PI });
    },
    keyframes: makeEmpowerBuffKeyframes(0.14, 0.24, 3.20, 'mage_staff'),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const P = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      const ally = allies[0];
      return [
        {
          t: 0.24,
          run() {
            const ankh = buildSeraphResurrectionAnkhAssembly({ palette: P.pal, scale: 1.55 });
            const wings = buildSeraphWingsAssembly({ palette: P.pal, scale: 1.50 });
            const relicRoot = new THREE.Group();
            relicRoot.add(ankh.group, wings.group);
            wings.group.position.set(0, 0.15, -0.25);

            let el = 0;
            sim.addCustom({
              group: relicRoot,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                ankh.update(dt);
                wings.update(dt);
                const descend = ease.outBack(clamp(el / 0.45), 1.35);
                relicRoot.position.set(hb.cx, lerp(4.8, 2.35, descend), hb.cz);
                const op = Math.min(1, el * 5.5) * (1 - smooth(2.05, 2.65, el));
                ankh.setOpacity(op);
                wings.setOpacity(op);
              },
              get done() { return el >= 2.70; },
              dispose() { ankh.dispose(); wings.dispose(); },
            });

            const beam = new BeamCylinder3D({
              p0: new THREE.Vector3(hb.cx, 0.02, hb.cz),
              p1: new THREE.Vector3(hb.cx, 5.6, hb.cz),
              radius: hb.radius * 0.36, duration: 1.65,
              palette: P.pal, defaultTex: 'silk', hdr: 2.65,
            });
            beam._skipAutoMap = true;
            sim.addCustom(beam);

            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz, _skipAutoMap: true,
              radius: hb.radius * 0.95, duration: 2.45,
              tradition: 'western', arrayKind: 'layered', layers: 3,
              style: 'valkyrie', palette: P.pal, hdr: 2.25, exactStyle: true,
            }));

            sim.spawnFlipbook({
              atlas: 'fbFeatherBurst', x: hb.cx, y: 1.45, z: hb.cz, _mapped: true,
              life: 0.85, size0: 1.55, size1: 3.5, palette: P.pal, hdr: 2.6,
            });
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.96, thickness: 0.56, height: 0.88,
              duration: 0.55, palette: P.pal, hdr: 2.45, seed: seed + 41,
            }));
          },
        },
        {
          t: 0.58,
          run() {
            if (ally) {
              ally.revive('✦奇蹟甦生 100%');
              ally.addShield(0.50, '+甦生聖障');
              spawnHealingHelixRibbons(sim, {
                getCenter: () => ally.worldPosition(),
                duration: 2.0, radius: 0.82, height: 2.4, strands: 4, palette: P.pal,
              });
            }
          },
        },
      ];
    },
  },

  {
    id: 'sup_ally_jade_cleanse_purify',
    cat: 'heal_support',
    targetTeam: 'ally',
    chantArchetype: 'eastern_qimen',
    baseChantDur: 0.95,
    cls: '單體驅散 · 破咒淨化',
    title: '單體驅散：淨世青蓮破咒除魔',
    codeId: 'support.ally.jade_cleanse',
    duration: 2.75,
    peakTime: 0.36,
    handlesDynamicScale: true,
    contactTimes: [0.12, 0.36],
    hitbox: { kind: 'circle', targetTeam: 'ally', cx: 0, cz: 6.8, radius: 2.3 },
    specNotes: [
      '遠距 6.8m 隊友遭暗紫咒鎖纏身！詠唱完畢射出青蓮淨世符光，瞬間震碎暗紫咒鎖化為星屑並恢復生命！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = resolvePal('windJade', paletteOverride);
      fighter.setLoadout('mage_staff', P.hotHex);
      fighter.resetSupportHUD();
      hideEnemyDummies(dummies);
      hideAllAllies(allies);
      const hb = getScaledHitbox(this.hitbox);
      if (allies[1]) allies[1].reset(hb.cx, hb.cz, true, { hpFrac: 0.42, cursed: true, yaw: Math.PI });
    },
    keyframes: makeStaffCastKeyframes(0.14, 0.24, 2.60),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const P = resolvePal('windJade', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      const ally = allies[1];
      return [
        {
          t: 0.24,
          run() {
            const beam = new BeamCylinder3D({
              p0: fighter.getStaffTipWorld(),
              p1: new THREE.Vector3(hb.cx, 1.15, hb.cz),
              radius: 0.22, duration: 0.48,
              palette: P.pal, defaultTex: 'silk', hdr: 2.4,
            });
            beam._skipAutoMap = true;
            sim.addCustom(beam);
          },
        },
        {
          t: 0.40,
          run() {
            if (ally) {
              ally.cleanse('✧破咒淨化 +HP');
              ally.addShield(0.28, '+青蓮淨障');
            }
            const sh = new ShockSphere3D({
              x: hb.cx, y: 1.05, z: hb.cz, r0: 0.25, r1: hb.radius * 0.85,
              duration: 0.42, palette: P.pal, hdr: 2.35, useRunes: true,
            });
            sh._skipAutoMap = true;
            sim.addCustom(sh);
            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz, _skipAutoMap: true,
              radius: hb.radius * 0.92, duration: 1.90,
              tradition: 'eastern', arrayKind: 'talisman_seal', layers: 2,
              style: 'lotusMandala', palette: P.pal, hdr: 2.15, exactStyle: true,
            }));
            for (let i = 0; i < 14; i++) {
              const a = (i / 14) * TAU;
              sim.spawnShard({
                x: hb.cx + Math.cos(a) * 0.45, y: 1.05, z: hb.cz + Math.sin(a) * 0.45, _mapped: true,
                vx: Math.cos(a) * 3.8, vy: 2.4 + (i % 3) * 0.8, vz: Math.sin(a) * 3.8,
                size: 0.11, color: i % 2 === 0 ? '#5eead4' : '#c084fc', life: 0.72,
              });
            }
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.92, thickness: 0.42, height: 0.65,
              duration: 0.45, palette: P.pal, hdr: 2.2, seed: seed + 52,
            }));
          },
        },
      ];
    },
  },

  {
    id: 'sup_ally_aegis_guardian_cocoon',
    cat: 'heal_support',
    targetTeam: 'ally',
    chantArchetype: 'martial_qi',
    noSigil: true,
    baseChantDur: 1.00,
    cls: '單體聖盾 · 守護聖繭',
    title: '單體聖盾：玫瑰塔盾守護聖繭',
    codeId: 'support.ally.aegis_cocoon',
    duration: 2.85,
    peakTime: 0.40,
    handlesDynamicScale: true,
    contactTimes: [0.14],
    hitbox: { kind: 'circle', targetTeam: 'ally', cx: 0, cz: 7.2, radius: 2.4 },
    specNotes: [
      '遠距 7.2m 為前排隊友張開半透明折射騎士穹頂與環繞塔盾（無魔法陣），瞬間賦予 +100% 滿額鉑青超量護盾！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = paletteOverride ? resolvePal('mageFrost', paletteOverride) : { pal: PAL_DIAMOND_SHIELD, hotHex: '#67e8f9' };
      fighter.setLoadout('sword_shield', P.hotHex);
      fighter.resetSupportHUD();
      hideEnemyDummies(dummies);
      hideAllAllies(allies);
      const hb = getScaledHitbox(this.hitbox);
      if (allies[0]) allies[0].reset(hb.cx, hb.cz, true, { hpFrac: 0.64, shieldFrac: 0.0, yaw: Math.PI });
    },
    keyframes: makeEmpowerBuffKeyframes(0.14, 0.24, 2.70, 'sword_shield'),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const pal = paletteOverride ? resolvePal('mageFrost', paletteOverride).pal : PAL_DIAMOND_SHIELD;
      const hb = getScaledHitbox(this.hitbox);
      const ally = allies[0];
      return [
        {
          t: 0.24,
          run() {
            attachWeaponBladeTrail3D(sim, fighter, { duration: 0.85, width: 0.28, palette: pal, hdr: 2.25 });
            spawnMartialStanceGust3D(sim, {
              x: hb.cx, z: hb.cz, radius: hb.radius * 0.78, duration: 1.35, palette: pal, hdr: 2.15, _mapped: true,
            });
            if (ally) {
              ally.heal(0.22, '+HP 聖光穩固');
              ally.addShield(1.0, '+100% 守護聖繭');
            }
            const dome = new DomeShield3D({
              x: hb.cx, y: 0.02, z: hb.cz, radius: hb.radius * 0.78, duration: 2.05, palette: pal, hdr: 2.25,
            });
            dome._skipAutoMap = true;
            sim.addCustom(dome);

            const g = new THREE.Group();
            const shields = [0, 1, 2, 3].map((i) => ({
              sh: buildTowerShieldAssembly({ palette: pal, scale: 0.72 }),
              a0: (i / 4) * TAU,
            }));
            shields.forEach((s) => g.add(s.sh.group));
            let el = 0;
            sim.addCustom({
              group: g,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                const op = Math.min(1, el * 6) * (1 - smooth(1.65, 2.15, el));
                for (const s of shields) {
                  s.sh.update(dt);
                  const a = s.a0 + el * 2.2;
                  s.sh.group.position.set(hb.cx + Math.cos(a) * hb.radius * 0.56, 1.1, hb.cz + Math.sin(a) * hb.radius * 0.56);
                  s.sh.group.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
                  s.sh.setOpacity(op);
                }
              },
              get done() { return el >= 2.20; },
              dispose() { shields.forEach((s) => s.sh.dispose()); },
            });
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.92, thickness: 0.42, height: 0.62,
              duration: 0.45, palette: pal, hdr: 2.2, seed: seed + 61,
            }));
          },
        },
      ];
    },
  },

  {
    id: 'sup_ally_soul_tether_symbiosis',
    cat: 'heal_support',
    targetTeam: 'ally',
    chantArchetype: 'sacred_prayer',
    baseChantDur: 1.05,
    cls: '雙人連攜 · 靈魂共鳴',
    title: '雙人連攜：靈魂共鳴生命連結 (自身⇄隊友)',
    codeId: 'support.ally.soul_tether',
    duration: 3.05,
    peakTime: 0.55,
    handlesDynamicScale: true,
    contactTimes: [0.10, 0.65, 1.25],
    hitbox: { kind: 'circle', targetTeam: 'ally', cx: 0, cz: 6.8, radius: 2.3 },
    specNotes: [
      '施法者（自身）與 6.8m 遠處隊友建立雙向翡翠金靈魂連結光鏈，雙向對流能量球同步治癒自身與隊友並賦予共生護盾！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = paletteOverride ? resolvePal('windJade', paletteOverride) : { pal: PAL_EMERALD_HEAL, hotHex: '#34d399' };
      fighter.setLoadout('mage_staff', P.hotHex);
      fighter.enableSupportHUD({ hpFrac: 0.38, shieldFrac: 0.0 });
      hideEnemyDummies(dummies);
      hideAllAllies(allies);
      const hb = getScaledHitbox(this.hitbox);
      if (allies[2]) allies[2].reset(hb.cx, hb.cz, true, { hpFrac: 0.30, shieldFrac: 0.0, yaw: Math.PI });
    },
    keyframes: makeStaffCastKeyframes(0.14, 0.24, 2.90),
    buildEvents(sim, fighter, _dummies, _seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const pal = paletteOverride ? resolvePal('windJade', paletteOverride).pal : PAL_EMERALD_HEAL;
      const hb = getScaledHitbox(this.hitbox);
      const ally = allies[2];
      return [
        {
          t: 0.24,
          run() {
            fighter.heal(0.35, '+HP 共生連結');
            fighter.addShield(0.45, '+共生聖盾');
            if (ally) {
              ally.heal(0.40, '+HP 共生連結');
              ally.addShield(0.45, '+共生聖盾');
            }
            const p0 = new THREE.Vector3(0, 1.18, 0.15);
            const p1 = new THREE.Vector3(hb.cx, 1.18, hb.cz);
            const tether = new BeamCylinder3D({
              p0, p1, radius: 0.16, duration: 2.15, palette: pal, defaultTex: 'silk', hdr: 2.35,
            });
            tether._skipAutoMap = true;
            sim.addCustom(tether);

            // Bi-directional pulsing spirit orbs streaming along the tether!
            const orbGroup = new THREE.Group();
            const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#a7f3d0').multiplyScalar(2.2) });
            const orbGeo = new THREE.OctahedronGeometry(0.12, 1);
            const orbs = [0, 1, 2, 3].map((i) => {
              const m = new THREE.Mesh(orbGeo, orbMat);
              orbGroup.add(m);
              return { m, offset: i * 0.25, rev: i % 2 === 1 };
            });
            let el = 0;
            sim.addCustom({
              group: orbGroup,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                for (const o of orbs) {
                  const rawU = (el * 0.95 + o.offset) % 1;
                  const u = o.rev ? 1 - rawU : rawU;
                  const arcY = Math.sin(u * Math.PI) * 0.52 * (o.rev ? -0.35 : 1.0);
                  o.m.position.lerpVectors(p0, p1, u);
                  o.m.position.y += arcY;
                  o.m.rotation.y += dt * 5;
                }
              },
              get done() { return el >= 2.15; },
              dispose() { orbGeo.dispose(); orbMat.dispose(); },
            });
          },
        },
        {
          t: 1.05,
          run() {
            fighter.heal(0.35, '+HP 靈魂滿溢');
            if (ally) ally.heal(0.38, '+HP 靈魂滿溢');
          },
        },
      ];
    },
  },

  {
    id: 'sup_ally_valkyrie_feather_wings',
    cat: 'heal_support',
    targetTeam: 'ally',
    chantArchetype: 'sacred_prayer',
    baseChantDur: 0.90,
    cls: '單體賦能 · 羽翼神行',
    title: '單體賦能：女武神疾風羽翼加持',
    codeId: 'support.ally.valkyrie_haste',
    duration: 2.80,
    peakTime: 0.38,
    handlesDynamicScale: true,
    contactTimes: [0.12],
    hitbox: { kind: 'circle', targetTeam: 'ally', cx: 0, cz: 7.2, radius: 2.4 },
    specNotes: [
      '為 7.2m 處翠風遊俠隊友加持女武神十二羽翠金光翼、疾風漩渦與武器賦能，大幅提升攻速與移速！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = resolvePal('windJade', paletteOverride);
      fighter.setLoadout('mage_staff', P.hotHex);
      fighter.resetSupportHUD();
      hideEnemyDummies(dummies);
      hideAllAllies(allies);
      const hb = getScaledHitbox(this.hitbox);
      if (allies[1]) allies[1].reset(hb.cx, hb.cz, true, { hpFrac: 0.85, yaw: Math.PI });
    },
    keyframes: makeStaffCastKeyframes(0.14, 0.24, 2.65),
    buildEvents(sim, _fighter, _dummies, seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const P = resolvePal('windJade', paletteOverride);
      const goldP = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      const ally = allies[1];
      return [
        {
          t: 0.24,
          run() {
            if (ally) {
              ally.heal(0.20, '+HP 翠風護體');
              ally.empowerWeapon('#34d399', 2.2, '▲疾風攻速 +60%');
            }
            const wings = buildSeraphWingsAssembly({ palette: P.pal, scale: 1.38 });
            let el = 0;
            sim.addCustom({
              group: wings.group,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                wings.update(dt * 1.5);
                wings.group.position.set(hb.cx, 1.48, hb.cz + 0.22);
                wings.group.rotation.y = Math.PI;
                wings.setOpacity(Math.min(1, el * 6) * (1 - smooth(1.70, 2.20, el)));
              },
              get done() { return el >= 2.25; },
              dispose() { wings.dispose(); },
            });
            const funnel = new VortexFunnel3D({
              x: hb.cx, y: 0.02, z: hb.cz, r0: 0.45, r1: hb.radius * 0.72, height: 2.35,
              duration: 1.65, palette: P.pal, hdr: 2.1,
            });
            funnel._skipAutoMap = true;
            sim.addCustom(funnel);
            sim.spawnFlipbook({
              atlas: 'fbFeatherBurst', x: hb.cx, y: 1.35, z: hb.cz, _mapped: true,
              life: 0.68, size0: 1.2, size1: 2.7, palette: goldP.pal, hdr: 2.35,
            });
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.90, thickness: 0.42, height: 0.62,
              duration: 0.45, palette: P.pal, hdr: 2.1, seed: seed + 73,
            }));
          },
        },
      ];
    },
  },

  // =========================================================================
  // C. 自身＋全隊隊友群體治療與團隊輔助 (Target: Self + Full Party — 7 Presets)
  // =========================================================================
  {
    id: 'sup_party_chain_heal_wave',
    cat: 'heal_support',
    targetTeam: 'party',
    chantArchetype: 'sacred_prayer',
    baseChantDur: 1.15,
    cls: '小隊連鎖治療 · 碧海潮汐',
    title: '小隊彈跳治療：碧海潮汐連鎖聖癒',
    codeId: 'support.party.chain_heal',
    duration: 3.15,
    peakTime: 0.68,
    handlesDynamicScale: true,
    contactTimes: [0.06, 0.28, 0.52, 0.76],
    hitbox: {
      kind: 'chain',
      targetTeam: 'party',
      targets: [[0, 0], [-2.2, 4.8], [2.2, 6.4], [0, 8.4]],
    },
    specNotes: [
      '施法者詠唱後釋放碧海翡翠治療波，依序於「施法者自身 ➔ 護衛隊友 ➔ 遊俠隊友 ➔ 最遠 8.4m 秘術隊友」間彈跳治癒全隊！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = paletteOverride ? resolvePal('waterAqua', paletteOverride) : { pal: PAL_EMERALD_HEAL, hotHex: '#34d399' };
      fighter.setLoadout('mage_staff', P.hotHex);
      fighter.enableSupportHUD({ hpFrac: 0.44, shieldFrac: 0.0 });
      hideEnemyDummies(dummies);
      const hb = getScaledHitbox(this.hitbox);
      const pts = hb.targets;
      if (allies.length >= 3) {
        allies[0].reset(pts[1][0], pts[1][1], true, { hpFrac: 0.26, yaw: Math.PI * 0.85 });
        allies[1].reset(pts[2][0], pts[2][1], true, { hpFrac: 0.32, yaw: -Math.PI * 0.85 });
        allies[2].reset(pts[3][0], pts[3][1], true, { hpFrac: 0.20, yaw: Math.PI });
      }
    },
    keyframes: makeStaffCastKeyframes(0.14, 0.24, 3.00),
    buildEvents(sim, fighter, _dummies, _seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const pal = paletteOverride ? resolvePal('waterAqua', paletteOverride).pal : PAL_EMERALD_HEAL;
      const hb = getScaledHitbox(this.hitbox);
      const pts = hb.targets.map(([tx, tz]) => new THREE.Vector3(tx, 1.15, tz));
      const units = [fighter, allies[0], allies[1], allies[2]];

      const evs = [];
      for (let i = 0; i < pts.length; i++) {
        evs.push({
          t: +(0.24 + i * 0.22).toFixed(3),
          run() {
            const u = units[i];
            if (u) u.heal(0.68, `+HP 連鎖聖癒 #${i + 1}`);
            if (i > 0) {
              const link = new BeamCylinder3D({
                p0: pts[i - 1], p1: pts[i], radius: 0.17, duration: 0.55,
                palette: pal, defaultTex: 'silk', hdr: 2.35,
              });
              link._skipAutoMap = true;
              sim.addCustom(link);
            }
            sim.spawnFlipbook({
              atlas: 'fbLiquid', x: pts[i].x, y: 1.15, z: pts[i].z, _mapped: true,
              life: 0.65, size0: 1.05, size1: 2.25, palette: pal, hdr: 2.25,
            });
            spawnHealingHelixRibbons(sim, {
              getCenter: () => pts[i],
              duration: 1.35, radius: 0.66, height: 2.0, strands: 2, palette: pal,
            });
          },
        });
      }
      return evs;
    },
  },

  {
    id: 'sup_party_world_tree_sanctuary',
    cat: 'heal_support',
    targetTeam: 'party',
    chantArchetype: 'sacred_prayer',
    baseChantDur: 1.45,
    cls: '全隊領域治療 · 世界樹聖域',
    title: '全隊領域治療：世界樹生命聖域湧泉',
    codeId: 'support.party.world_tree_sanctuary',
    duration: 3.65,
    peakTime: 0.65,
    handlesDynamicScale: true,
    contactTimes: [0.10, 0.85, 1.65],
    hitbox: { kind: 'circle', targetTeam: 'party', cx: 0, cz: 5.6, radius: 4.8 },
    specNotes: [
      '於小隊中央升起 BMesh 精雕「世界樹翡翠生命法杖聖柱」，展開大範圍翡翠生命領域，連續 3 波脈衝治癒施法者與全體 3 名隊友！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = paletteOverride ? resolvePal('windJade', paletteOverride) : { pal: PAL_EMERALD_HEAL, hotHex: '#34d399' };
      fighter.setLoadout('mage_staff', P.hotHex);
      fighter.enableSupportHUD({ hpFrac: 0.35, shieldFrac: 0.0 });
      hideEnemyDummies(dummies);
      const hb = getScaledHitbox(this.hitbox);
      setupPartyFormation(allies, hb, { hpFracs: [0.24, 0.30, 0.28] });
    },
    keyframes: makeEmpowerBuffKeyframes(0.14, 0.24, 3.50, 'mage_staff'),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const pal = paletteOverride ? resolvePal('windJade', paletteOverride).pal : PAL_EMERALD_HEAL;
      const hb = getScaledHitbox(this.hitbox);
      const healWave = (amt, label, idx) => {
        fighter.heal(amt, label);
        for (const a of allies) if (a?.active) a.heal(amt, label);
        sim.addCustom(new GroundWave3D({
          x: hb.cx, z: hb.cz, maxRadius: hb.radius * 0.96, thickness: 0.52, height: 0.72,
          duration: 0.58, palette: pal, hdr: 2.2, seed: seed + 100 + idx,
        }));
      };
      return [
        {
          t: 0.24,
          run() {
            const treeMonument = buildWorldTreeStaffAssembly({ palette: pal, scale: 2.05 });
            let el = 0;
            sim.addCustom({
              group: treeMonument.group,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                treeMonument.update(dt);
                const rise = ease.outBack(clamp(el / 0.48), 1.3);
                treeMonument.group.position.set(hb.cx, lerp(-1.2, 1.55, rise), hb.cz);
                treeMonument.setOpacity(Math.min(1, el * 5) * (1 - smooth(2.45, 3.10, el)));
              },
              get done() { return el >= 3.15; },
              dispose() { treeMonument.dispose(); },
            });

            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz, _skipAutoMap: true,
              radius: hb.radius * 0.96, duration: 3.05,
              tradition: 'eastern', arrayKind: 'layered', layers: 3,
              style: 'nature', palette: pal, hdr: 2.15, exactStyle: true,
            }));
            sim.spawnGroundZone({
              x: hb.cx, z: hb.cz, _mapped: true,
              radius: hb.radius * 0.92, duration: 2.65,
              kind: 'holy', palette: pal, stretchX: 1.08, stretchZ: 0.94, yaw: 0.35,
              emitFlames: true, eruptRocks: false,
            });
            healWave(0.28, '+HP 世界樹脈動 I', 1);
          },
        },
        { t: 1.08, run() { healWave(0.28, '+HP 世界樹脈動 II', 2); } },
        { t: 1.92, run() { healWave(0.32, '+HP 聖域滿溢 100%', 3); } },
      ];
    },
  },

  {
    id: 'sup_party_hex_citadel_barrier',
    cat: 'heal_support',
    targetTeam: 'party',
    chantArchetype: 'martial_qi',
    noSigil: true,
    baseChantDur: 1.30,
    cls: '全隊群體護盾 · 聖堂壁壘',
    title: '全隊群體護盾：六方星穹聖堂壁壘',
    codeId: 'support.party.hex_citadel_dome',
    duration: 3.25,
    peakTime: 0.45,
    handlesDynamicScale: true,
    contactTimes: [0.10, 0.55],
    hitbox: { kind: 'circle', targetTeam: 'party', cx: 0, cz: 5.4, radius: 4.8 },
    specNotes: [
      '持盾戰吼張開巨型半透明六角蜂巢護盾結界籠罩全隊 4 人（無魔法陣），施法者與 3 名隊友同步獲得 +100% 滿額超量護盾！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = paletteOverride ? resolvePal('mageFrost', paletteOverride) : { pal: PAL_DIAMOND_SHIELD, hotHex: '#67e8f9' };
      fighter.setLoadout('sword_shield', P.hotHex);
      fighter.enableSupportHUD({ hpFrac: 0.88, shieldFrac: 0.0 });
      hideEnemyDummies(dummies);
      const hb = getScaledHitbox(this.hitbox);
      setupPartyFormation(allies, hb, { hpFracs: [0.76, 0.82, 0.79] });
    },
    keyframes: makeEmpowerBuffKeyframes(0.14, 0.24, 3.10, 'sword_shield'),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const pal = paletteOverride ? resolvePal('mageFrost', paletteOverride).pal : PAL_DIAMOND_SHIELD;
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            fighter.addShield(1.0, '+100% 群體聖堂壁壘');
            attachWeaponBladeTrail3D(sim, fighter, { duration: 1.05, width: 0.30, palette: pal, hdr: 2.3 });
            for (const a of allies) {
              if (!a?.active) continue;
              a.heal(0.20, '+HP 聖堂庇護');
              a.addShield(1.0, '+100% 群體聖堂壁壘');
            }
            const bigDome = new DomeShield3D({
              x: hb.cx, y: 0.02, z: hb.cz * 0.72, radius: hb.radius * 0.96, duration: 2.45, palette: pal, hdr: 2.25,
            });
            bigDome._skipAutoMap = true;
            sim.addCustom(bigDome);

            spawnMartialStanceGust3D(sim, {
              x: hb.cx, z: hb.cz * 0.72, radius: hb.radius * 0.86, duration: 1.85, palette: pal, hdr: 2.2, _mapped: true,
            });
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz * 0.72, maxRadius: hb.radius, thickness: 0.55, height: 0.82,
              duration: 0.52, palette: pal, hdr: 2.3, seed: seed + 131,
            }));
          },
        },
      ];
    },
  },

  {
    id: 'sup_party_dragon_weapon_enchant',
    cat: 'heal_support',
    targetTeam: 'party',
    chantArchetype: 'martial_qi',
    noSigil: true,
    baseChantDur: 1.10,
    cls: '全隊武器附魔 · 赤龍戰歌',
    title: '全隊武器附魔：赤龍戰歌烈焰賦能',
    codeId: 'support.party.dragon_enchant',
    duration: 3.10,
    peakTime: 0.45,
    handlesDynamicScale: true,
    contactTimes: [0.10, 0.35],
    hitbox: { kind: 'circle', targetTeam: 'party', cx: 0, cz: 5.2, radius: 4.6 },
    specNotes: [
      '召喚盤龍戰魂於小隊上空咆哮，將赤金龍炎灌入施法者與全體 3 名隊友的兵刃與法杖，全隊武器燃起熾熱HDR龍炎！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = resolvePal('fireInferno', paletteOverride);
      fighter.setLoadout('greatsword', P.hotHex);
      fighter.enableSupportHUD({ hpFrac: 0.92, shieldFrac: 0.0 });
      hideEnemyDummies(dummies);
      const hb = getScaledHitbox(this.hitbox);
      setupPartyFormation(allies, hb, { hpFracs: [0.90, 0.88, 0.94] });
    },
    keyframes: makeEmpowerBuffKeyframes(0.14, 0.24, 2.95, 'greatsword'),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const P = resolvePal('fireInferno', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            attachWeaponBladeTrail3D(sim, fighter, { duration: 1.15, width: 0.38, palette: P.pal, hdr: 2.55, sparkRate: 36 });
            spawnMartialStanceGust3D(sim, {
              x: 0, z: 0, radius: 1.75, duration: 1.15, palette: P.pal, hdr: 2.25, _mapped: true,
            });
            const dragon = buildDragonSpiritHeadAssembly({ palette: P.pal, scale: 1.75 });
            let el = 0;
            sim.addCustom({
              group: dragon.group,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                dragon.update(dt);
                dragon.group.position.set(hb.cx, 2.85 + Math.sin(el * 4) * 0.12, hb.cz * 0.75);
                dragon.setOpacity(Math.min(1, el * 6) * (1 - smooth(1.85, 2.45, el)));
              },
              get done() { return el >= 2.50; },
              dispose() { dragon.dispose(); },
            });

            fighter.empowerWeapon('#ff7b29', 2.4, '▲赤龍烈焰附魔');
            for (const a of allies) {
              if (!a?.active) continue;
              a.empowerWeapon('#ff7b29', 2.4, '▲赤龍烈焰附魔');
              const wp = a.worldPosition();
              sim.spawnFlipbook({
                atlas: 'fbFlame', x: wp.x, y: 1.35, z: wp.z, _mapped: true,
                life: 0.68, size0: 0.95, size1: 2.15, palette: P.pal, hdr: 2.35,
              });
            }
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz * 0.72, maxRadius: hb.radius * 0.95, thickness: 0.52, height: 0.78,
              duration: 0.50, palette: P.pal, hdr: 2.3, seed: seed + 145,
            }));
          },
        },
      ];
    },
  },

  {
    id: 'sup_party_zephyr_tailwind_march',
    cat: 'heal_support',
    targetTeam: 'party',
    chantArchetype: 'martial_qi',
    noSigil: true,
    baseChantDur: 0.95,
    cls: '全隊疾風加速 · 翠嵐順風',
    title: '全隊疾風加速：翠嵐順風神行領域',
    codeId: 'support.party.zephyr_tailwind',
    duration: 2.95,
    peakTime: 0.42,
    handlesDynamicScale: true,
    contactTimes: [0.08],
    hitbox: { kind: 'circle', targetTeam: 'party', cx: 0, cz: 5.4, radius: 4.6 },
    specNotes: [
      '展開全隊翠嵐疾風領域（無魔法陣），每位隊友周身捲起上升氣流漩渦與神行羽翼光痕，賦予全隊高機動推進增益！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = resolvePal('windJade', paletteOverride);
      fighter.setLoadout('bow', P.hotHex);
      fighter.enableSupportHUD({ hpFrac: 0.86, shieldFrac: 0.0 });
      hideEnemyDummies(dummies);
      const hb = getScaledHitbox(this.hitbox);
      setupPartyFormation(allies, hb, { hpFracs: [0.80, 0.75, 0.84] });
    },
    keyframes: makeEmpowerBuffKeyframes(0.14, 0.24, 2.80, 'bow'),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const P = resolvePal('windJade', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            fighter.heal(0.16, '▲全隊神行 +45%');
            fighter.addBuff('▲全隊神行 +45%', '#34d399');
            spawnMartialStanceGust3D(sim, {
              x: 0, z: 0, radius: 1.65, duration: 1.15, palette: P.pal, hdr: 2.15, _mapped: true,
            });
            const bigVortex = new VortexFunnel3D({
              x: hb.cx, y: 0.02, z: hb.cz * 0.75, r0: hb.radius * 0.45, r1: hb.radius * 0.95,
              height: 2.45, duration: 1.95, palette: P.pal, hdr: 2.05,
            });
            bigVortex._skipAutoMap = true;
            sim.addCustom(bigVortex);

            for (const a of allies) {
              if (!a?.active) continue;
              a.heal(0.22, '+HP 翠風甦醒');
              a.addBuff('▲全隊神行 +45%', '#34d399');
              spawnHealingHelixRibbons(sim, {
                getCenter: () => a.worldPosition(),
                duration: 1.75, radius: 0.68, height: 2.1, strands: 3, palette: P.pal, sigilStyle: null,
              });
            }
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz * 0.75, maxRadius: hb.radius * 0.96, thickness: 0.48, height: 0.72,
              duration: 0.48, palette: P.pal, hdr: 2.15, seed: seed + 162,
            }));
          },
        },
      ];
    },
  },

  {
    id: 'sup_party_astral_chrono_chorus',
    cat: 'heal_support',
    targetTeam: 'party',
    chantArchetype: 'sequential_4tier',
    baseChantDur: 1.35,
    cls: '全隊回魔減CD · 星盤共鳴',
    title: '全隊回魔減CD：星盤時光魔力共鳴',
    codeId: 'support.party.astral_chrono',
    duration: 3.25,
    peakTime: 0.50,
    handlesDynamicScale: true,
    contactTimes: [0.10, 0.50],
    hitbox: { kind: 'circle', targetTeam: 'party', cx: 0, cz: 5.5, radius: 4.7 },
    specNotes: [
      '小隊上空運轉三軸渾天星盤與卡巴拉星軌陣，對施法者與 3 名隊友降下星界回魔光柱，縮短全技能冷卻！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = resolvePal('mageArcane', paletteOverride);
      fighter.setLoadout('mage_staff', P.hotHex);
      fighter.enableSupportHUD({ hpFrac: 0.78, shieldFrac: 0.20 });
      hideEnemyDummies(dummies);
      const hb = getScaledHitbox(this.hitbox);
      setupPartyFormation(allies, hb, { hpFracs: [0.72, 0.68, 0.74], shieldFrac: 0.15 });
    },
    keyframes: makeEmpowerBuffKeyframes(0.14, 0.24, 3.10, 'mage_staff'),
    buildEvents(sim, fighter, _dummies, _seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const P = resolvePal('mageArcane', paletteOverride);
      const goldP = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            const astro = buildArmillaryAstrolabeAssembly({ palette: goldP.pal, scale: 1.65 });
            let el = 0;
            sim.addCustom({
              group: astro.group,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                astro.update(dt * 1.8);
                astro.group.position.set(hb.cx, 3.15 + Math.sin(el * 3.5) * 0.1, hb.cz * 0.75);
                astro.setOpacity(Math.min(1, el * 5.5) * (1 - smooth(1.95, 2.55, el)));
              },
              get done() { return el >= 2.60; },
              dispose() { astro.dispose(); },
            });

            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz * 0.75, _skipAutoMap: true,
              radius: hb.radius * 0.95, duration: 2.55,
              tradition: 'western', arrayKind: 'layered', layers: 3,
              style: 'chrono', palette: P.pal, hdr: 2.15, exactStyle: true,
            }));

            const partyUnits = [
              { u: fighter, pos: new THREE.Vector3(0, 0, 0) },
              ...allies.filter((a) => a?.active).map((a) => ({ u: a, pos: a.worldPosition() })),
            ];
            for (const { u, pos } of partyUnits) {
              u.heal(0.25, '▲回魔減CD -35%');
              u.addShield(0.45, '+星界魔力盾');
              u.addBuff('▲回魔減CD -35%', '#38bdf8');
              const pillar = new BeamCylinder3D({
                p0: new THREE.Vector3(pos.x, 0.04, pos.z),
                p1: new THREE.Vector3(pos.x, 4.4, pos.z),
                radius: 0.32, duration: 1.25, palette: P.pal, defaultTex: 'silk', hdr: 2.25,
              });
              pillar._skipAutoMap = true;
              sim.addCustom(pillar);
            }
          },
        },
      ];
    },
  },

  {
    id: 'sup_party_lotus_mandala_salvation',
    cat: 'heal_support',
    targetTeam: 'party',
    chantArchetype: 'eastern_qimen',
    baseChantDur: 1.55,
    cls: '全隊東方大補 · 普渡甘露',
    title: '全隊東方大補：千瓣青蓮普渡甘露陣',
    codeId: 'support.party.lotus_salvation_ult',
    duration: 3.60,
    peakTime: 0.62,
    handlesDynamicScale: true,
    contactTimes: [0.12, 0.72],
    hitbox: { kind: 'circle', targetTeam: 'party', cx: 0, cz: 5.6, radius: 4.9 },
    specNotes: [
      '東方救世級大補奧義！施法者完成三重梵音詠唱後，全隊腳下盛開千瓣青蓮曼荼羅大陣，全體瀕死隊友（18%~25% HP）瞬間回滿 100% 並疊加金蓮護盾！',
    ],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const P = paletteOverride ? resolvePal('holyGold', paletteOverride) : { pal: PAL_EMERALD_HEAL, hotHex: '#34d399' };
      fighter.setLoadout('mage_staff', P.hotHex);
      fighter.enableSupportHUD({ hpFrac: 0.22, shieldFrac: 0.0 });
      hideEnemyDummies(dummies);
      const hb = getScaledHitbox(this.hitbox);
      setupPartyFormation(allies, hb, { hpFracs: [0.18, 0.24, 0.20] });
    },
    keyframes: makeEmpowerBuffKeyframes(0.14, 0.24, 3.45, 'mage_staff'),
    buildEvents(sim, fighter, _dummies, seed, paletteOverride, _texStyle = 'auto', allies = []) {
      const pal = paletteOverride ? resolvePal('windJade', paletteOverride).pal : PAL_EMERALD_HEAL;
      const goldP = resolvePal('holyGold', paletteOverride);
      const hb = getScaledHitbox(this.hitbox);
      return [
        {
          t: 0.24,
          run() {
            const chalice = buildHolyChaliceAssembly({ palette: goldP.pal, scale: 1.85 });
            let el = 0;
            sim.addCustom({
              group: chalice.group,
              _skipAutoMap: true,
              update(dt) {
                el += dt;
                chalice.update(dt);
                chalice.group.position.set(hb.cx, 3.35 + Math.sin(el * 3.6) * 0.12, hb.cz * 0.76);
                chalice.group.rotation.y += dt * 1.4;
                chalice.setOpacity(Math.min(1, el * 5.5) * (1 - smooth(2.25, 2.90, el)));
              },
              get done() { return el >= 2.95; },
              dispose() { chalice.dispose(); },
            });

            sim.addCustom(new MagicArray3D({
              x: hb.cx, y: 0.025, z: hb.cz * 0.76, _skipAutoMap: true,
              radius: hb.radius * 0.96, duration: 2.90,
              tradition: 'eastern', arrayKind: 'talisman_seal', layers: 3,
              style: 'lotusMandala', palette: goldP.pal, hdr: 2.25, exactStyle: true,
            }));

            fighter.heal(0.82, '✦普渡甘露 100%');
            fighter.addShield(0.65, '+金蓮法障');
            for (const a of allies) {
              if (!a?.active) continue;
              a.heal(0.85, '✦普渡甘露 100%');
              a.addShield(0.65, '+金蓮法障');
              const wp = a.worldPosition();
              sim.spawnFlipbook({
                atlas: 'fbBlessing', x: wp.x, y: 1.25, z: wp.z, _mapped: true,
                life: 0.80, size0: 1.25, size1: 2.75, palette: pal, hdr: 2.4,
              });
              spawnHealingHelixRibbons(sim, {
                getCenter: () => a.worldPosition(),
                duration: 2.15, radius: 0.74, height: 2.25, strands: 3, palette: pal,
              });
            }
            sim.addCustom(new GroundWave3D({
              x: hb.cx, z: hb.cz * 0.76, maxRadius: hb.radius, thickness: 0.60, height: 0.88,
              duration: 0.56, palette: goldP.pal, hdr: 2.4, seed: seed + 188,
            }));
          },
        },
      ];
    },
  },
];
