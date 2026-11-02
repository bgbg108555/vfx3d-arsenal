import * as THREE from 'three';
import {
  TAU, clamp, smooth, ease, Rng,
  SlashArc3D, RibbonTrail3D, GroundWave3D, VortexFunnel3D, BeamCylinder3D, Sigil3D, DomeShield3D, ShockSphere3D,
  makeTranslucentConstructMaterial,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import {
  resolvePal, SHIELD_GUARD, makeStaffCastKeyframes, makeSkyChantKeyframes,
  makeLevelUpTriumphKeyframes, makeEmpowerBuffKeyframes,
  spawnRisingBanner3D, spawnAscendingBuffAura,
  spawnGroundCracks, spawnArcaneOrb,
  attachWeaponBladeTrail3D, spawnMartialStanceGust3D,
  spawnBladeGroundScar3D, spawnMartialAirCutter3D, spawnMachShockRings3D,
} from './fx_helpers.js';
import { buildTotemObeliskAssembly } from './mesh_props3d.js';
import { launch3DArrow } from './presets_bow.js';

const PX_POSITIVE_SELF_SET = new Set([
  'ui/level-up', 'ui/achievement', 'ui/quest-complete', 'ui/confetti', 'ui/coin-collect',
  'explosions/firework-burst', 'explosions/firework-rocket',
  'spawn/egg-hatch', 'spawn/coin-drop', 'spawn/respawn-beam',
  'holy/blessing', 'holy/divine-shield', 'holy/feather-burst', 'holy/halo',
  'holy/heal', 'holy/heal-aoe', 'holy/resurrection', 'holy/sunburst',
  'nature/healing-bloom',
  'scifi/force-field', 'scifi/teleporter-pad', 'scifi/energy-core', 'scifi/warp-in', 'scifi/warp-out',
  'impacts/shield-block',
  'arcane/magic-circle-cast', 'arcane/rune-circle', 'arcane/spell-charge', 'arcane/blink-in',
]);

const PX_CELEBRATION_SET = new Set([
  'ui/level-up', 'ui/achievement', 'ui/quest-complete', 'ui/confetti', 'ui/coin-collect',
  'explosions/firework-burst', 'explosions/firework-rocket', 'spawn/egg-hatch', 'spawn/coin-drop',
]);

const PX_TRIUMPH_POSE_SET = new Set([
  'ui/level-up', 'ui/achievement', 'ui/quest-complete', 'holy/resurrection', 'spawn/respawn-beam',
]);

const PX_BANNER_MAP = {
  'ui/level-up': ['LEVEL UP!', '★ 經典黃金升環星雨 ★'],
  'ui/achievement': ['ACHIEVEMENT!', '★ 黃金榮譽勳章解鎖 ★'],
  'ui/quest-complete': ['QUEST CLEAR!', '★ 任務完成黃金聖印 ★'],
  'ui/confetti': ['CELEBRATE!', '✦ 慶典拉炮繽紛彩帶 ✦'],
  'ui/coin-collect': ['GOLD +999 ▲', '✦ 金幣噴泉閃耀入袋 ✦'],
  'pickups/chest-open': ['JACKPOT!', '★ 寶箱開啟大爆金 ★'],
  'pickups/loot-beam': ['MYTHIC LOOT!', '★ 神兵稀有度沖天光柱 ★'],
  'pickups/power-star': ['POWER UP ▲', '★ 無敵力量之星 ★'],
  'pickups/heart-pickup': ['HP +100% ▲', '✦ 生命之心脈動恢復 ✦'],
  'pickups/potion': ['POTION UP ▲', '✦ 煉金魔藥恢復 ✦'],
  'pickups/xp-orb': ['EXP UP ▲', '✦ 經驗靈球吸收 ✦'],
  'holy/blessing': ['BLESSING ▲', '✦ 天恩祝福聖光 ✦'],
  'holy/divine-shield': ['DIVINE SHIELD ▲', '✦ 神聖無敵聖盾 ✦'],
  'holy/heal': ['HEAL +HP ▲', '✦ 單體聖光治癒 ✦'],
  'holy/heal-aoe': ['PARTY HEAL ▲', '✦ 群體治癒聖環 ✦'],
  'holy/resurrection': ['REVIVE ▲', '★ 神聖奇蹟復活 ★'],
  'nature/healing-bloom': ['HEAL BLOOM ▲', '✦ 聖花綻放療癒 ✦'],
  'spawn/respawn-beam': ['RESPAWN ▲', '✦ 重生復活光柱 ✦'],
  'scifi/force-field': ['SHIELD UP ▲', '✦ 六角力場護盾 ✦'],
  'scifi/teleporter-pad': ['TELEPORT ▲', '✦ 星門上升光環光柱 ✦'],
  'ui/combo-counter': ['COMBO x99!', '✦ 連擊超載爆發 ✦'],
  'ui/crit-number': ['CRITICAL!', '✦ 暴擊傷害星芒 ✦'],
  'impacts/crit-hit': ['CRITICAL!', '✦ 致命暴擊火花 ✦'],
};

function hashCodeStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function resolveRichAssetPack(codeId, cat, palKey, baseSigil, baseFb) {
  const h = hashCodeStr(codeId);
  const lc = codeId.toLowerCase();

  let sigil = baseSigil;
  if (lc.includes('blood') || palKey === 'rogueBlood') sigil = 'bloodbone';
  else if (lc.includes('phoenix') || lc.includes('feather') || lc.includes('angel')) sigil = 'phoenix';
  else if (lc.includes('cyber') || lc.includes('scifi') || lc.includes('holo') || lc.includes('plasma') || lc.includes('laser')) sigil = 'cyberRune';
  else if (lc.includes('time') || lc.includes('clock') || lc.includes('chrono')) sigil = 'chrono';
  else if (lc.includes('water') || lc.includes('wave') || lc.includes('ocean') || palKey === 'waterAqua') sigil = (h % 2 === 0) ? 'leviathan' : 'glacier';
  else if (cat === 'fire' || palKey === 'fireInferno') sigil = ['dragonFlame', 'phoenix', 'war'][h % 3];
  else if (cat === 'ice' || palKey === 'mageFrost') sigil = ['glacier', 'leviathan', 'arcane'][h % 3];
  else if (cat === 'volt' || palKey === 'mageVolt') sigil = ['thunder', 'cyberRune', 'solomon'][h % 3];
  else if (cat === 'earth' || palKey === 'earthMagma') sigil = ['earthquake', 'war', 'solomon'][h % 3];
  else if (cat === 'holy' || palKey === 'holyGold') sigil = ['valkyrie', 'holy', 'phoenix', 'solomon'][h % 4];
  else if (cat === 'shadow' || palKey === 'voidAbyss' || palKey === 'rogueShadow') sigil = ['demonGate', 'bloodbone', 'abyss'][h % 3];
  else if (palKey === 'windJade' || palKey === 'mageEmerald' || palKey === 'poison') sigil = ['druid', 'nature'][h % 2];
  else if (cat === 'arcane') sigil = ['celestial', 'solomon', 'chrono', 'crescent'][h % 4];

  let fb = baseFb;
  if (lc.includes('blood') || palKey === 'rogueBlood') fb = 'fbBloodSplash';
  else if (lc.includes('poison') || lc.includes('acid') || palKey === 'poison') fb = 'fbPoison';
  else if (lc.includes('wind') || lc.includes('tornado') || palKey === 'windJade') fb = (h % 2 === 0) ? 'fbWindTornado' : baseFb;
  else if (cat === 'ice' || palKey === 'mageFrost') fb = (h % 2 === 0) ? 'fbIceShatter' : baseFb;
  else if (cat === 'earth' || lc.includes('rock') || lc.includes('dirt')) fb = (h % 2 === 0) ? 'fbRockBurst' : baseFb;
  else if (cat === 'holy' && (h % 2 === 0)) fb = 'fbFeatherBurst';
  else if ((cat === 'shadow' || palKey === 'voidAbyss') && (h % 2 === 0)) fb = 'fbDarkVortex';

  let slashTex = 'silk';
  if (palKey === 'rogueBlood' || lc.includes('blood')) slashTex = 'blood';
  else if (cat === 'ice' || palKey === 'mageFrost' || palKey === 'waterAqua') slashTex = 'frost';
  else if (cat === 'fire' || palKey === 'fireInferno' || palKey === 'warriorGold') slashTex = 'flame';
  else if (cat === 'volt' || palKey === 'mageVolt') slashTex = 'volt';
  else if (cat === 'shadow' || palKey === 'voidAbyss' || palKey === 'rogueShadow') slashTex = 'void';

  let groundKind = null;
  if (cat === 'fire' || palKey === 'fireInferno') groundKind = 'burning';
  else if (cat === 'ice' || palKey === 'mageFrost') groundKind = 'frost';
  else if (cat === 'earth' || palKey === 'earthMagma') groundKind = (h % 2 === 0) ? 'crater' : 'sand';
  else if (palKey === 'poison') groundKind = 'poison';
  else if (cat === 'volt' || palKey === 'mageVolt') groundKind = 'lightning';
  else if (cat === 'holy' || palKey === 'holyGold') groundKind = 'holy';
  else if (cat === 'shadow' || palKey === 'voidAbyss' || palKey === 'rogueBlood') groundKind = 'void';
  else if (palKey === 'windJade') groundKind = 'sand';

  return { sigil, fb, slashTex, groundKind };
}

export function makePixelFxPreset([codeId, cat, cls, title, arch, loadout, palKey, rawSigil, rawFb, desc]) {
  const { sigil, fb, slashTex, groundKind } = resolveRichAssetPack(codeId, cat, palKey, rawSigil, rawFb);
  const id = 'px_' + codeId.replace(/[^a-z0-9]/gi, '_');
  const isMelee = arch === 'melee_cut';
  const isPositiveSelf = codeId.startsWith('pickups/') || PX_POSITIVE_SELF_SET.has(codeId);
  const isCelebration = codeId.startsWith('pickups/') || PX_CELEBRATION_SET.has(codeId);
  const isSelf = isPositiveSelf || arch === 'scifi_holo' || arch === 'loot_ui' || arch === 'flame_loop' || arch === 'weather_sky' || arch === 'critter_3d';
  const cz = isMelee ? 2.2 : isPositiveSelf ? 0 : isSelf ? 1.8 : 3.6;
  const rad = isMelee ? 3.4 : isPositiveSelf ? 2.75 : 3.0;
  const dur = 2.35;

  const targetTeam = codeId === 'holy/heal-aoe' ? 'party' : isPositiveSelf ? 'self' : 'enemy';
  const isQuickUi = isPositiveSelf && (codeId.startsWith('ui/') || codeId.startsWith('pickups/'));
  const isSelfHeal = codeId === 'holy/heal' || codeId === 'holy/heal-aoe' || codeId === 'nature/healing-bloom' || codeId === 'pickups/heart-pickup' || codeId === 'pickups/potion';
  const isSelfShield = codeId === 'holy/divine-shield' || codeId === 'scifi/force-field' || codeId === 'impacts/shield-block';
  const hasHud = isSelfHeal || isSelfShield;
  const hasPhysicalWeapon = loadout !== 'mage_staff' && loadout !== 'unarmed';
  const isMagicBarehand =
    isCelebration ||
    codeId.startsWith('pickups/') ||
    codeId.startsWith('weather/') ||
    codeId.startsWith('critters/') ||
    codeId === 'holy/halo' ||
    codeId === 'spawn/respawn-beam' ||
    codeId === 'scifi/warp-in' ||
    codeId === 'scifi/warp-out' ||
    codeId === 'transitions/star-iris' ||
    codeId === 'transitions/blinds' ||
    codeId === 'transitions/crt-off' ||
    codeId === 'transitions/iris' ||
    codeId === 'ui/heart-lost';
  const isMartial = hasPhysicalWeapon || (loadout === 'unarmed' && !isMagicBarehand);
  const allowFloorSigil = !isMartial && arch !== 'weather_sky' && arch !== 'critter_3d';
  const hasBladeWeapon = loadout === 'sword_shield' || loadout === 'greatsword' || loadout === 'dual_daggers' || loadout === 'scythe' || loadout === 'spear';

  const kf = isMelee
    ? [
        { t: 0.00, pose: { ...REST_POSE, ...(loadout === 'sword_shield' ? SHIELD_GUARD : {}) } },
        { t: 0.24, ease: ease.inCubic, pose: { ...REST_POSE, crouch: 0.18, torsoYaw: -0.52, shRPitch: -1.88, shRYaw: -0.46 } },
        { t: 0.36, ease: ease.outExpo, pose: { ...REST_POSE, z: 0.32, crouch: 0.16, torsoPitch: 0.22, torsoYaw: 0.38, shRPitch: -1.12, shRYaw: 0.44, capePitch: 0.72 } },
        { t: 2.25, ease: ease.inOutCubic, pose: { ...REST_POSE } },
      ]
    : PX_TRIUMPH_POSE_SET.has(codeId)
      ? makeLevelUpTriumphKeyframes(0.20, 0.36, 2.25)
      : isPositiveSelf
        ? makeEmpowerBuffKeyframes(0.20, 0.36, 2.25, loadout)
        : loadout === 'mage_staff'
          ? makeStaffCastKeyframes(0.24, 0.36, 2.25)
          : makeSkyChantKeyframes(0.24, 0.36, 2.25);

  return {
    id,
    cat,
    cls,
    title,
    codeId,
    duration: dur,
    releaseTime: 0.36,
    peakTime: arch === 'proj_shot' ? 0.72 : 0.54,
    contactTimes: [arch === 'proj_shot' ? 0.60 : 0.36],
    targetTeam,
    isCelebration,
    noSigil: isMartial,
    allowMagicArray: !isMartial,
    noAutoChant: isQuickUi || isMartial,
    selfCentered: isPositiveSelf,
    handlesDynamicScale: isPositiveSelf,
    hitbox: isMelee
      ? { kind: 'sector', targetTeam, radius: rad, angleDeg: 130 }
      : { kind: 'circle', targetTeam, cx: 0, cz, radius: rad },
    specNotes: [`[PixelFX 3D 重製 ${codeId}] ${desc}`],
    setup(fighter, dummies, paletteOverride, allies = []) {
      const { hotHex } = resolvePal(palKey, paletteOverride);
      fighter.setLoadout(loadout, hotHex);
      fighter.resetSupportHUD?.();
      allies.forEach((a) => a.reset(0, 0, false));
      if (isSelf) {
        dummies[0].reset(0, 4.4, false);
        dummies[1].reset(0, 0, false);
        dummies[2].reset(0, 0, false);
      } else {
        dummies[0].reset(0, cz, true);
        dummies[1].reset(-1.15, cz + 0.3, !isMelee);
        dummies[2].reset(1.15, cz + 0.3, !isMelee);
      }
      if (isSelfHeal) {
        fighter.enableSupportHUD?.({ hpFrac: 0.42, shieldFrac: 0.0 });
        if (codeId === 'holy/heal-aoe' && allies.length >= 2) {
          allies[0].reset(-1.45, 1.25, true, { hpFrac: 0.38, yaw: Math.PI * 0.82 });
          allies[1].reset(1.45, 1.25, true, { hpFrac: 0.42, yaw: -Math.PI * 0.82 });
        }
      } else if (isSelfShield) {
        fighter.enableSupportHUD?.({ hpFrac: 0.86, shieldFrac: 0.0 });
      }
    },
    keyframes: kf,
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto', allies = []) {
      const R = new Rng(seed);
      const P = resolvePal(palKey, paletteOverride);
      const projectileImpact = (pt) => {
        // The impact belongs at the end of the flight, in unscaled skill space.
        const impactAtlas = cat === 'fire' ? 'fbExplosion' : fb;
        const pointedWeapon = isMartial && (loadout === 'bow' || loadout === 'spear');
        if (!pointedWeapon) {
          sim.spawnFlipbook({
            atlas: impactAtlas, x: pt.x, y: pt.y, z: pt.z,
            life: 0.46, size0: 0.9, size1: 2.15, palette: P.pal, hdr: 1.85,
          });
        }
        if (!isMartial && cat !== 'fire') {
          sim.addCustom(new ShockSphere3D({ x: pt.x, y: pt.y, z: pt.z, r0: 0.16, r1: 1.30, duration: 0.24, palette: P.pal, hdr: 1.55, useRunes: false }));
        }
        sim.spawnStarGlint(pt.x, pt.y, pt.z, 0.32, P.hotHex, 0.14);
        sim.addLight(pt.x, pt.y, pt.z, P.midHex, 3.0, 3.5, 0.16);
        const [vortexX, vortexZ] = sim.mapSkillXZ(pt.x, pt.z);
        sim.spawnNiagaraBurst({
          x: pt.x, y: pt.y, z: pt.z, count: 46, speed0: 1.5, speed1: 5.2, spreadRadius: 0.75,
          gravity: 3.8, curl: 4.4, vortex: 5.8, vortexCenter: [vortexX, vortexZ],
          life0: 0.45, life1: 0.98, size0: 0.042, size1: 0.012, palette: P.pal, hdr: 2.3,
        });
        if (cat === 'volt') {
          for (const side of [-1, 1]) {
            sim.spawnLightning({
              p0: pt, p1: pt.clone().add(new THREE.Vector3(side * 0.75, side * 0.25, 0.35)),
              life: 0.20, jag: 0.18, depth: 3, forks: 1, palette: P.pal, thickness: 0.025,
            });
          }
        }
        dummies.forEach((d) => { if (d.active) d.hit({ dirX: d.homeX * 0.4, dirZ: 1, power: isMartial ? 1.65 : 1.6, flashColor: P.hotHex }); });
      };
      return [
        { t: 0.06, isPreGather: true, run() {
          const tip = loadout === 'mage_staff' ? fighter.getStaffTipWorld() : fighter.getRightHandWorld();
          sim.spawnStarGlint(tip.x, tip.y, tip.z, 0.26, P.hotHex, 0.22, true);
          if (isMartial && hasBladeWeapon) {
            attachWeaponBladeTrail3D(sim, fighter, {
              duration: 0.56, width: loadout === 'greatsword' || loadout === 'scythe' ? 0.36 : 0.28,
              palette: P.pal, dual: loadout === 'dual_daggers', hdr: 2.35, sparkRate: 30,
            });
          }
        }},
        { t: 0.36, run() {
          // 100% Upward Celebration / Buff / Heal / Shield Path (ZERO hitStop, ZERO downward beam!)
          if (isPositiveSelf) {
            fighter.pulseBodyAura?.(P.hotHex, 1.60);
            if (isSelfHeal) {
              fighter.heal?.(0.58, '+HP 聖癒恢復');
              for (const a of allies) {
                if (!a?.active) continue;
                a.heal(0.58, '+HP 群體聖環');
                const wp = a.worldPosition();
                spawnAscendingBuffAura(sim, {
                  x: wp.x, z: wp.z, radius: 0.72, maxH: 2.35, duration: 1.35,
                  ringCount: 3, chevronCount: 4, helixCount: 1,
                  texStyle, flipbook: fb, niagaraCount: 18, palette: P.pal, hdr: 2.1, _mapped: true,
                });
              }
            } else if (isSelfShield) {
              fighter.addShield?.(0.85, '+護盾展開');
            }

            if (isMartial) {
              spawnMartialStanceGust3D(sim, {
                x: 0, z: 0, radius: 1.45, duration: 0.95,
                palette: P.pal, texStyle, hdr: 2.15, _mapped: true,
              });
            } else {
              const sig = new Sigil3D({ x: 0, y: 0.02, z: 0, radius: rad * 0.88, duration: 1.55, style: sigil, palette: P.pal, hdr: 1.48, wallHeight: 0.28 });
              sig._skipAutoMap = true;
              sim.addCustom(sig);
            }

            const bannerInfo = PX_BANNER_MAP[codeId];
            if (bannerInfo) {
              spawnRisingBanner3D(sim, {
                x: 0, y0: hasHud ? 3.16 : 2.18, z: 0, rise: hasHud ? 0.72 : 1.02, duration: 1.65,
                text: bannerInfo[0], subText: bannerInfo[1],
                palette: P.pal, scale: codeId === 'ui/level-up' ? 1.14 : 0.96, _mapped: true,
              });
            }

            if (isSelfShield) {
              const dome = new DomeShield3D({ x: 0, y: 0.02, z: 0, radius: 1.85, duration: 1.48, palette: P.pal, hdr: 2.15 });
              dome._skipAutoMap = true;
              sim.addCustom(dome);
            } else if (arch === 'loot_ui' && codeId.startsWith('pickups/')) {
              const g = new THREE.Group();
              const geo = new THREE.OctahedronGeometry(0.38, 0);
              const mat = makeTranslucentConstructMaterial({ palette: P.pal, sigilStyle: isMartial ? null : sigil, useHexLattice: true, baseAlpha: 0.28, rimAlpha: 0.96, hdr: 2.4 });
              g.add(new THREE.Mesh(geo, mat));
              let el = 0;
              sim.addCustom({
                group: g,
                _skipAutoMap: true,
                update(dt) {
                  el += dt;
                  const u = ease.outCubic(clamp(el / 1.45));
                  g.rotation.y += dt * 4.2;
                  g.position.set(0, 0.95 + u * 0.95, 0.65);
                  mat.uniforms.uTime.value = el;
                  mat.uniforms.uOpacity.value = 1 - smooth(1.10, 1.52, el);
                },
                get done() { return el >= 1.55; },
                dispose() { geo.dispose(); mat.dispose(); },
              });
            }

            const wantPillar = codeId === 'ui/level-up' || codeId === 'pickups/loot-beam' || codeId === 'holy/blessing' || codeId === 'holy/resurrection' || codeId === 'spawn/respawn-beam' || codeId === 'scifi/teleporter-pad' || codeId === 'scifi/warp-in' || codeId === 'arcane/magic-circle-cast';
            const isLvUp = codeId === 'ui/level-up';
            spawnAscendingBuffAura(sim, {
              x: 0, z: 0, radius: isLvUp ? 1.16 : 1.04, maxH: isLvUp ? 3.8 : 3.2, duration: 1.62,
              ringCount: isLvUp ? 6 : 4, chevronCount: isLvUp ? 10 : 7, helixCount: isLvUp ? 3 : 2,
              pillar: wantPillar, pillarRadius: isLvUp ? 0.65 : 0.52, pillarHeight: 5.4,
              vortex: isLvUp || arch === 'water_fountain' || codeId === 'scifi/teleporter-pad',
              texStyle, flipbook: fb, niagaraCount: isLvUp ? 64 : 48,
              palette: P.pal, hdr: 2.38, _mapped: true,
            });
            return;
          }

          fighter.hitStop = 0.05;
          const enemyBanner = PX_BANNER_MAP[codeId];
          if (enemyBanner) {
            spawnRisingBanner3D(sim, {
              x: 0, y0: 2.05, z: cz, rise: 0.85, duration: 1.25,
              text: enemyBanner[0], subText: enemyBanner[1],
              palette: P.pal, scale: 1.04,
            });
          }
          if (allowFloorSigil && arch !== 'proj_shot') {
            sim.addCustom(new Sigil3D({ x: 0, y: 0.02, z: cz, radius: rad * 0.86, duration: 1.42, style: sigil, palette: P.pal, hdr: 1.95, wallHeight: 0.48 }));
          } else if (isMartial && arch !== 'weather_sky' && arch !== 'critter_3d') {
            spawnMartialStanceGust3D(sim, {
              x: 0, z: 0, radius: 1.35, duration: 0.62,
              palette: P.pal, texStyle, hdr: 2.1, _mapped: true,
            });
          }
          if (arch === 'flame_loop') {
            const ped = buildTotemObeliskAssembly({ height: 1.15, palette: P.pal, seed: seed + 5 });
            ped.group.position.set(0, 0, cz);
            let el = 0;
            sim.addCustom({ group: ped.group, update(dt) { el += dt; ped.update(dt); ped.setOpacity(1 - smooth(1.1, 1.5, el)); }, get done() { return el >= 1.52; }, dispose() { ped.dispose(); } });
            for (let i = 0; i < 4; i++) {
              sim.spawnFlipbook({ atlas: fb, x: R.range(-0.18, 0.18), y: 0.85 + i * 0.25, z: cz + R.range(-0.18, 0.18), vy: 0.85, delay: i * 0.16, life: 0.65, size0: 0.95, size1: 1.95, palette: P.pal, hdr: 2.35 });
            }
          } else if (arch === 'cone_jet') {
            const v = new VortexFunnel3D({ x: 0, y: 1.15, z: 0.75, rBottom: 0.16, rTop: 1.25, height: 3.4, duration: 0.95, palette: P.pal, texStyle, defaultTex: 'flame', hdr: 2.35 });
            v.group.rotation.x = Math.PI / 2;
            sim.addCustom(v);
            if (isMartial) {
              spawnMachShockRings3D(sim, {
                p0: new THREE.Vector3(0, 1.15, 0.75), p1: new THREE.Vector3(0, 1.15, cz),
                ringCount: 4, radius0: 0.24, radius1: 0.72, duration: 0.34, palette: P.pal,
              });
            }
            sim.spawnFlipbook({ atlas: fb, x: 0, y: 1.15, z: cz, life: 0.65, size0: 1.1, size1: 2.3, palette: P.pal, hdr: 2.35 });
            dummies.forEach((d) => { if (d.active) d.hit({ dirX: d.homeX * 0.3, dirZ: 1, power: 1.45, flashColor: P.hotHex }); });
          } else if (arch === 'blast') {
            const imp = codeId.includes('implosion') || codeId.includes('black');
            if (groundKind) {
              sim.spawnGroundZone({ x: 0, z: cz, radius: rad * 0.84, duration: 1.42, kind: groundKind, palette: P.pal, emitFlames: true, eruptRocks: true });
            } else {
              sim.spawnRockDebris({ x: 0, y: 0.14, z: cz, count: 8, radius: 0.35, life: 0.92, style: 'basalt', palette: P.pal });
            }
            if (isMartial && hasBladeWeapon) {
              spawnBladeGroundScar3D(sim, {
                x: 0, z: cz, yaw: 0, length: 2.55, width: 0.36, duration: 1.15,
                palette: P.pal, zoneKind: groundKind || 'crater', eruptRocks: true, seed: seed + 19,
              });
            }
            sim.spawnAirDistortion({ kind: imp ? 'implode' : 'shock', x: 0, y: 0.85, z: cz, r0: 0.22, r1: 2.65, duration: 0.44, strength: 0.82 });
            sim.addCustom(new ShockSphere3D({ x: 0, y: 0.95, z: cz, r0: 0.2, r1: 2.55, duration: 0.46, palette: P.pal, hdr: 2.6, implode: imp, useRunes: !isMartial }));
            sim.addCustom(new GroundWave3D({ x: 0, z: cz, maxRadius: 2.65, thickness: 0.58, height: 0.92, duration: 0.48, palette: P.pal, hdr: 2.4, seed: seed + 17 }));
            sim.spawnFlipbook({ atlas: fb, x: 0, y: 1.25, z: cz, life: 0.62, size0: 1.4, size1: 3.2, palette: P.pal, hdr: 2.6 });
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * TAU, sp = R.range(2.4, 5.2);
              sim.spawnFireRock({ x: 0, y: 0.35, z: cz, vx: Math.cos(a) * sp, vy: R.range(3.0, 5.8), vz: Math.sin(a) * sp, size: 0.15, life: 0.9, palette: P.pal });
            }
            spawnGroundCracks(sim, R, { cx: 0, cz, maxRadius: 2.4, branches: 7, life: 0.85, palette: P.pal, rockCount: 6, rockScale: 0.72 });
            dummies.forEach((d) => { if (d.active) d.hit({ dirX: d.homeX * 0.5, dirZ: 1, power: 1.85, flashColor: P.hotHex }); });
          } else if (arch === 'water_fountain') {
            if (groundKind) sim.spawnGroundZone({ x: 0, z: cz, radius: rad * 0.80, duration: 1.38, kind: groundKind, palette: P.pal, emitFlames: false });
            sim.addCustom(new VortexFunnel3D({ x: 0, y: 0.02, z: cz, rBottom: 0.45, rTop: 1.65, height: 2.35, duration: 1.15, palette: P.pal, texStyle, defaultTex: slashTex, hdr: 2.25 }));
            sim.addCustom(new GroundWave3D({ x: 0, z: cz, maxRadius: 2.5, thickness: 0.45, height: 0.65, duration: 0.52, palette: P.pal, hdr: 2.1, seed: seed + 29 }));
            sim.spawnFlipbook({ atlas: palKey === 'waterAqua' ? 'fbLiquid' : fb, x: 0, y: 1.1, z: cz, life: 0.75, size0: 1.2, size1: 2.5, palette: P.pal, hdr: 2.3 });
            dummies.forEach((d) => { if (d.active) d.hit({ dirX: d.homeX * 0.4, dirZ: 1, power: 1.4, flashColor: P.hotHex }); });
          } else if (arch === 'ice_form') {
            sim.spawnGroundZone({ x: 0, z: cz, radius: rad * 0.82, duration: 1.42, kind: cat === 'earth' ? 'crater' : 'frost', palette: P.pal, emitFlames: false, eruptRocks: true });
            sim.spawnFlipbook({ atlas: cat === 'earth' ? 'fbRockBurst' : 'fbIceShatter', x: 0, y: 0.95, z: cz, life: 0.52, size0: 1.1, size1: 2.4, palette: P.pal, hdr: 2.35 });
            for (let i = 0; i < 7; i++) {
              const a = (i / 7) * TAU, rr = i === 0 ? 0 : 1.55;
              sim.spawnCrystal({ x: Math.cos(a) * rr, z: cz + Math.sin(a) * rr, height: i === 0 ? 1.75 : 1.15, width: 0.34, delay: i * 0.04, hold: 0.65, melt: 0.38, palette: P.pal });
            }
            sim.addCustom(new ShockSphere3D({ x: 0, y: 0.85, z: cz, r0: 0.2, r1: 2.3, duration: 0.42, palette: P.pal, hdr: 2.4, useRunes: !isMartial }));
            dummies.forEach((d) => { if (d.active) d.hit({ dirX: d.homeX * 0.4, dirZ: 1, power: 1.55, flashColor: P.hotHex }); });
          } else if (arch === 'volt_arc') {
            sim.spawnGroundZone({ x: 0, z: cz, radius: rad * 0.78, duration: 1.35, kind: cat === 'holy' ? 'holy' : 'lightning', palette: P.pal, emitFlames: true });
            sim.spawnBolt(new THREE.Vector3(0, 5.4, cz), new THREE.Vector3(0, 0.1, cz), { radius: 0.055, jitter: 0.30, life: 0.55, color: P.hotHex });
            for (let i = 0; i < 4; i++) {
              const a = (i / 4) * TAU;
              sim.spawnBolt(new THREE.Vector3(0, 1.1, cz), new THREE.Vector3(Math.cos(a) * 1.8, 0.2, cz + Math.sin(a) * 1.8), { radius: 0.035, jitter: 0.24, life: 0.52, color: P.hotHex });
            }
            sim.spawnFlipbook({ atlas: fb, x: 0, y: 1.2, z: cz, life: 0.52, size0: 1.2, size1: 2.5, palette: P.pal, hdr: 2.5 });
            dummies.forEach((d) => { if (d.active) d.hit({ dirX: d.homeX * 0.4, dirZ: 1, power: 1.65, flashColor: P.hotHex }); });
          } else if (arch === 'scifi_holo') {
            sim.addCustom(new DomeShield3D({ x: 0, y: 0.02, z: cz, radius: 1.85, duration: 1.35, palette: P.pal, hdr: 2.15 }));
            sim.addCustom(new BeamCylinder3D({ p0: new THREE.Vector3(0, 4.8, cz), p1: new THREE.Vector3(0, 0.02, cz), radius: 0.46, duration: 1.15, palette: P.pal, texStyle, defaultTex: 'volt', hdr: 2.3 }));
          } else if (arch === 'melee_cut') {
            fighter.spawnGhost(sim, { color: P.midHex, life: 0.24, opacity: 0.36 });
            for (const sgn of [-1, 1]) {
              sim.addCustom(new SlashArc3D({
                center: [0, 1.1, 0.35], radius: 2.55, width: 1.02, thickness: 0.30,
                a0: -1.18 * sgn, a1: 1.18 * sgn, tiltZ: 0.32 * sgn, delay: sgn > 0 ? 0.07 : 0,
                sweep: 0.06, hold: 0.05, trail: 0.24, palette: P.pal, texStyle, defaultTex: slashTex, hdrBoost: 2.55, seed: seed + (sgn > 0 ? 31 : 32),
              }));
            }
            if (isMartial) {
              spawnMartialAirCutter3D(sim, {
                center: [0, 1.12, 0.35], radius: 2.35, width: 0.85, thickness: 0.24,
                a0: -1.18, a1: 1.18, tiltZ: 0.22,
                palette: P.pal, texStyle, defaultTex: slashTex, hdrBoost: 2.5, seed: seed + 35,
              });
              spawnBladeGroundScar3D(sim, {
                x: 0, z: 1.65, yaw: 0, length: 2.35, width: 0.32, duration: 1.05,
                palette: P.pal, zoneKind: groundKind || 'crater', rocks: 5, seed: seed + 37,
              });
            }
            sim.spawnFlipbook({ atlas: fb, x: 0, y: 1.15, z: 2.1, life: 0.38, size0: 1.05, size1: 2.25, palette: P.pal, hdr: 2.5 });
            dummies.forEach((d) => { if (d.active) d.hit({ dirX: 0, dirZ: 1, power: 1.65, flashColor: P.hotHex }); });
          } else if (arch === 'proj_shot') {
            if (isMartial && (loadout === 'bow' || loadout === 'spear')) {
              const p0 = loadout === 'bow' ? fighter.getBowMuzzleWorld() : fighter.getRightHandWorld();
              const p1 = new THREE.Vector3(0, 1.12, cz);
              spawnMachShockRings3D(sim, { p0, p1, ringCount: 4, radius0: 0.22, radius1: 0.62, duration: 0.32, palette: P.pal });
              launch3DArrow(sim, {
                p0, p1, flightTime: 0.22, scale: loadout === 'spear' ? 1.45 : 1.18,
                palette: P.pal, spiral: true, spiralR: 0.16, trailWidth: 0.20,
                onImpact: projectileImpact,
              });
            } else {
              if (isMartial) {
                spawnMachShockRings3D(sim, {
                  p0: new THREE.Vector3(0, 1.25, 0.85), p1: new THREE.Vector3(0, 1.1, cz),
                  ringCount: 3, radius0: 0.20, radius1: 0.56, duration: 0.30, palette: P.pal,
                });
              }
              spawnArcaneOrb(sim, {
                p0: new THREE.Vector3(0, 1.25, 0.85), p1: new THREE.Vector3(0, 1.1, cz), arcHeight: 0.35, flightTime: 0.24,
                orbSize: 0.22, palette: P.pal,
                spiral: !isMartial && (cat === 'arcane' || cat === 'volt'),
                flipbookWake: cat === 'fire' ? 'fbFlame' : null,
                onImpact: projectileImpact,
              });
            }
          } else if (arch === 'portal_soul') {
            if (!isMartial) {
              sim.addCustom(new Sigil3D({ x: 0, y: 1.45, z: cz, radius: 1.55, duration: 1.45, style: sigil, palette: P.pal, hdr: 2.2, wallHeight: 0.35 }));
            }
            sim.addCustom(new VortexFunnel3D({ x: 0, y: 0.02, z: cz, rBottom: 0.35, rTop: 1.65, height: 2.5, duration: 1.25, palette: P.pal, texStyle, defaultTex: 'void', hdr: 2.3 }));
            sim.spawnFlipbook({ atlas: fb, x: 0, y: 1.35, z: cz, life: 0.85, size0: 1.2, size1: 2.5, palette: P.pal, hdr: 2.4 });
          } else if (arch === 'weather_sky') {
            sim.addCustom(new BeamCylinder3D({ p0: new THREE.Vector3(-1.4, 5.6, cz - 0.8), p1: new THREE.Vector3(0.4, 0.02, cz + 0.4), radius: 0.85, duration: 1.35, palette: P.pal, texStyle, defaultTex: 'silk', hdr: 1.95, muzzleRings: false }));
            sim.spawnFlipbook({ atlas: fb, x: 0, y: 1.6, z: cz, life: 0.95, size0: 1.6, size1: 3.2, palette: P.pal, hdr: 2.1 });
          } else if (arch === 'loot_ui') {
            const g = new THREE.Group(); g.position.set(0, 1.15, cz);
            const geo = new THREE.OctahedronGeometry(0.42, 0);
            const mat = makeTranslucentConstructMaterial({ palette: P.pal, sigilStyle: isMartial ? null : sigil, useHexLattice: true, baseAlpha: 0.26, rimAlpha: 0.96, hdr: 2.4 });
            g.add(new THREE.Mesh(geo, mat));
            let el = 0;
            sim.addCustom({ group: g, update(dt) { el += dt; g.rotation.y += dt * 3.8; g.position.y = 1.15 + Math.sin(el * 5) * 0.14; mat.uniforms.uTime.value = el; mat.uniforms.uOpacity.value = 1 - smooth(1.05, 1.45, el); }, get done() { return el >= 1.48; }, dispose() { geo.dispose(); mat.dispose(); } });
            sim.addCustom(new BeamCylinder3D({ p0: new THREE.Vector3(0, 5.2, cz), p1: new THREE.Vector3(0, 0.02, cz), radius: 0.42, duration: 1.25, palette: P.pal, texStyle, defaultTex: 'silk', hdr: 2.25 }));
            sim.spawnFlipbook({ atlas: 'fbStarburst', x: 0, y: 1.2, z: cz, life: 0.58, size0: 1.2, size1: 2.5, palette: P.pal, hdr: 2.5 });
          } else {
            // critter_3d: Sculpted semi-transparent 3D elemental spirit creature flying a figure-8 with ribbon trail!
            const g = new THREE.Group();
            const bodyGeo = new THREE.IcosahedronGeometry(0.28, 1);
            const wingGeo = new THREE.OctahedronGeometry(0.26, 0); wingGeo.scale(1.6, 0.18, 0.65);
            const mat = makeTranslucentConstructMaterial({ palette: P.pal, sigilStyle: isMartial ? null : sigil, useHexLattice: false, baseAlpha: 0.28, rimAlpha: 0.95, hdr: 2.35 });
            const body = new THREE.Mesh(bodyGeo, mat);
            const wL = new THREE.Mesh(wingGeo, mat); wL.position.x = -0.32;
            const wR = new THREE.Mesh(wingGeo, mat); wR.position.x = 0.32;
            g.add(body, wL, wR);
            const tr = new RibbonTrail3D({ maxPoints: 20, width: 0.18, palette: P.pal, hdr: 2.1 });
            sim.root.add(tr.group);
            let el = 0;
            sim.addCustom({
              group: g,
              update(dt) {
                el += dt;
                const a = el * 4.8;
                g.position.set(Math.sin(a) * 1.15, 1.25 + Math.sin(a * 2) * 0.32, cz + Math.cos(a) * 0.75);
                wL.rotation.z = Math.sin(el * 22) * 0.55;
                wR.rotation.z = -Math.sin(el * 22) * 0.55;
                mat.uniforms.uTime.value = el;
                const fade = 1 - smooth(1.15, 1.50, el);
                mat.uniforms.uOpacity.value = fade;
                if (el < 1.32) tr.pushPoint(g.position);
                tr.update(dt, el > 1.32 ? 1 / 0.22 : 0);
              },
              get done() { return el >= 1.54; },
              dispose() { sim.root.remove(tr.group); tr.dispose(); bodyGeo.dispose(); wingGeo.dispose(); mat.dispose(); },
            });
          }
          if (arch !== 'proj_shot') {
            sim.spawnNiagaraBurst({
              x: 0, y: 1.0, z: cz, count: 46, speed0: 1.5, speed1: 5.2, spreadRadius: 0.75,
              gravity: arch === 'weather_sky' ? 2.2 : arch === 'flame_loop' ? -2.4 : 3.8,
              curl: 4.4, vortex: 5.8, vortexCenter: [0, cz],
              life0: 0.45, life1: 0.98, size0: 0.042, size1: 0.012, palette: P.pal, hdr: 2.3,
            });
          }
        }},
      ];
    },
  };
}

const PIXELFX_SPECS_1 = [
  // moves (12)
  ['moves/arrow-shot', 'bow', 'PixelFX 武技重製', '神射：標準疾風平射', 'proj_shot', 'bow', 'windJade', 'nature', 'fbHitBurst', '拉弓蓄氣直線疾射貫穿目標'],
  ['moves/dash-strike', 'melee', 'PixelFX 武技重製', '殘影瞬步・致命一閃', 'melee_cut', 'dual_daggers', 'rogueShadow', 'abyss', 'fbSlash', '高速殘影突進十字斬擊'],
  ['moves/earth-stomp', 'earth', 'PixelFX 武技重製', '裂地重踏・岩刺破土', 'ice_form', 'unarmed', 'earthMagma', 'war', 'fbExplosion', '重踏震裂地面刺出半透明巨岩晶簇'],
  ['moves/fireball-throw', 'fire', 'PixelFX 武技重製', '蓄火投擲・豪火球爆破', 'proj_shot', 'mage_staff', 'fireInferno', 'war', 'fbExplosion', '掌心聚火投出爆裂火球'],
  ['moves/ground-pound', 'earth', 'PixelFX 武技重製', '高空墜地・崩山震波', 'blast', 'greatsword', 'earthMagma', 'war', 'fbExplosion', '躍起墜地炸開雙重震波與飛石'],
  ['moves/holy-smite', 'holy', 'PixelFX 武技重製', '雙手祈天・神聖天罰鎚', 'volt_arc', 'mage_staff', 'holyGold', 'holy', 'fbStarburst', '引動神聖光雷重鎚轟擊目標'],
  ['moves/ice-lance-throw', 'ice', 'PixelFX 武技重製', '凝霜投槍・冰晶貫穿', 'proj_shot', 'spear', 'mageFrost', 'arcane', 'fbHitBurst', '投擲半透明寒冰長槍凍結敵陣'],
  ['moves/lightning-call', 'volt', 'PixelFX 武技重製', '雷紋喚雷・落雷轟頂', 'volt_arc', 'mage_staff', 'mageVolt', 'arcane', 'fbLightning', '地面浮現雷之法陣引落粗壯天雷'],
  ['moves/meteor-call', 'fire', 'PixelFX 武技重製', '大詠唱・天外隕石召喚', 'blast', 'mage_staff', 'fireInferno', 'abyss', 'fbExplosion', '展開詠唱法陣召喚燃燒隕石砸平戰場'],
  ['moves/pistol-shots', 'melee', 'PixelFX 武技重製', '魔導雙槍・三連曳光射擊', 'proj_shot', 'unarmed', 'warriorGold', 'war', 'fbHitBurst', '高速連射曳光彈擊退目標'],
  ['moves/rocket-launcher', 'fire', 'PixelFX 武技重製', '重型魔導火箭筒轟擊', 'proj_shot', 'unarmed', 'fireInferno', 'war', 'fbExplosion', '噴射尾焰推進火箭引爆巨型火球'],
  ['moves/sword-combo', 'melee', 'PixelFX 武技重製', '雙手劍三連・裂地終斬', 'melee_cut', 'greatsword', 'warriorSilver', 'war', 'fbSlash', '踏步斜斬、交叉雙斬接重劈裂地'],
  // fire (12)
  ['fire/brazier', 'fire', 'PixelFX 烈焰圖鑑', '神殿火盆：熊熊聖火餘燼', 'flame_loop', 'mage_staff', 'fireInferno', 'war', 'fbFlame', '立體聖火台持續翻騰烈焰與上升火星'],
  ['fire/campfire', 'fire', 'PixelFX 烈焰圖鑑', '營火晚會：溫暖躍動火舌', 'flame_loop', 'unarmed', 'warriorGold', 'nature', 'fbFlame', '營火堆躍動火苗、暖光與裊裊輕煙'],
  ['fire/candle', 'fire', 'PixelFX 烈焰圖鑑', '秘儀燭火：幽藍火根微光', 'flame_loop', 'mage_staff', 'holyGold', 'crescent', 'fbFlame', '靜謐燭光光暈與漂浮光塵微粒'],
  ['fire/fire-breath', 'fire', 'PixelFX 烈焰圖鑑', '紅龍吐息：錐形白熱火海', 'cone_jet', 'mage_staff', 'fireInferno', 'war', 'fbFlame', '高壓錐形白熱龍息噴流與捲曲濃煙'],
  ['fire/fire-ring', 'fire', 'PixelFX 烈焰圖鑑', '烈焰擴散環：燎原火圈', 'blast', 'mage_staff', 'fireInferno', 'war', 'fbFlame', '腳下白閃後向四周急速擴張烈焰火環'],
  ['fire/fire-tornado', 'fire', 'PixelFX 烈焰圖鑑', '紅蓮火龍捲：螺旋業火柱', 'water_fountain', 'mage_staff', 'fireInferno', 'war', 'fbFlame', '高速旋轉立體火焰漏斗與環繞火星'],
  ['fire/fireball', 'fire', 'PixelFX 烈焰圖鑑', '烈焰飛彈：長尾流火彈', 'proj_shot', 'mage_staff', 'fireInferno', 'arcane', 'fbFlame', '白熱火核拖曳濃煙火尾破空飛行'],
  ['fire/flame-pillar', 'fire', 'PixelFX 烈焰圖鑑', '地裂火柱：熔岩沖天噴發', 'blast', 'mage_staff', 'fireInferno', 'war', 'fbExplosion', '地面龜裂噴出沖天白熱火柱與濃煙'],
  ['fire/flamethrower', 'fire', 'PixelFX 烈焰圖鑑', '高壓噴火器：藍芯烈焰射流', 'cone_jet', 'unarmed', 'fireInferno', 'war', 'fbFlame', '藍焰噴嘴射出高壓連續火流'],
  ['fire/meteor', 'fire', 'PixelFX 烈焰圖鑑', '天火隕石：彗尾撞擊火坑', 'blast', 'mage_staff', 'earthMagma', 'abyss', 'fbExplosion', '燃燒巨岩斜墜炸出熔岩火坑与飛石'],
  ['fire/spirit-flame', 'fire', 'PixelFX 烈焰圖鑑', '幽冥鬼火：冰藍靈魂冷焰', 'flame_loop', 'mage_staff', 'mageArcane', 'abyss', 'fbMagicSwirl', '空心暗核外裹幽藍青色靈魂冷火'],
  ['fire/torch', 'fire', 'PixelFX 烈焰圖鑑', '地下城壁炬：油脂烈火飛星', 'flame_loop', 'sword_shield', 'warriorGold', 'war', 'fbFlame', '松脂火把躍動火舌與飛散火星'],
  // explosions (12)
  ['explosions/barrel-explosion', 'fire', 'PixelFX 爆破圖鑑', '火藥桶大引爆：飛散燃油烈火', 'blast', 'dual_daggers', 'fireInferno', 'war', 'fbExplosion', '火藥桶膨脹炸裂噴出火柱與滿地燃燒碎片'],
  ['explosions/big-explosion', 'fire', 'PixelFX 爆破圖鑑', '三重巨型轟炸：蘑菇火雲', 'blast', 'mage_staff', 'fireInferno', 'war', 'fbExplosion', '白光圓頂、翻滾火球升騰為巨型蘑菇雲'],
  ['explosions/cartoon-pow', 'melee', 'PixelFX 爆破圖鑑', '熱血漫風爆擊：星芒炸裂閃光', 'blast', 'unarmed', 'warriorGold', 'crescent', 'fbStarburst', '高對比鋸齒星芒與放射速度線炸裂'],
  ['explosions/dirt-explosion', 'earth', 'PixelFX 爆破圖鑑', '地雷破土爆：飛石塵柱衝擊', 'blast', 'dual_daggers', 'earthMagma', 'war', 'fbSmoke', '地下引爆掀起V字碎石塊與濃厚煙塵'],
  ['explosions/firework-burst', 'arcane', 'PixelFX 爆破圖鑑', '慶典花火球：璀璨彩星垂落', 'loot_ui', 'mage_staff', 'mageViolet', 'crescent', 'fbStarburst', '高空綻放球狀金芯彩星與閃爍金粉'],
  ['explosions/firework-rocket', 'arcane', 'PixelFX 爆破圖鑑', '沖天煙火彈：黃金棕櫚星雨', 'loot_ui', 'mage_staff', 'holyGold', 'crescent', 'fbStarburst', '拖曳金尾升空炸開垂落黃金星雨'],
  ['explosions/grenade', 'fire', 'PixelFX 爆破圖鑑', '破片手榴彈：彈跳引信爆破', 'proj_shot', 'dual_daggers', 'fireInferno', 'war', 'fbExplosion', '拋投破片彈引爆白閃與高速破片流'],
  ['explosions/implosion', 'shadow', 'PixelFX 爆破圖鑑', '重力內爆：奇點坍縮瞬爆', 'blast', 'mage_staff', 'voidAbyss', 'abyss', 'fbMagicSwirl', '萬物向內收縮坍塌為白點後瞬間炸開'],
  ['explosions/nuke', 'fire', 'PixelFX 爆破圖鑑', '戰術核爆：蕈狀雲與地面塵浪', 'blast', 'mage_staff', 'fireInferno', 'war', 'fbExplosion', '刺眼白閃後升起巨型發光蕈狀火雲與衝擊裙'],
  ['explosions/plasma-explosion', 'volt', 'PixelFX 爆破圖鑑', '電漿超載爆：無煙藍紫電弧球', 'blast', 'mage_staff', 'mageVolt', 'arcane', 'fbLightning', '藍紫電漿球膨脹伴隨多層震波環與電弧'],
  ['explosions/small-explosion', 'fire', 'PixelFX 爆破圖鑑', '標準戰術爆破：濃煙火石飛濺', 'blast', 'dual_daggers', 'earthMagma', 'war', 'fbExplosion', '標準地面爆破震環、滾動煙柱與彈跳餘燼'],
  ['explosions/smoke-bomb', 'shadow', 'PixelFX 爆破圖鑑', '戰術煙霧彈：紫灰濃霧遮蔽', 'portal_soul', 'dual_daggers', 'rogueShadow', 'abyss', 'fbSmoke', '噴發翻湧灰紫濃煙雲團完全隱匿身形'],
  // water (12)
  ['water/bubbles', 'ice', 'PixelFX 水系圖鑑', '深海氣泡泉：虹光浮升水泡', 'water_fountain', 'mage_staff', 'waterAqua', 'nature', 'fbLiquid', '晶瑩半透明氣泡群搖曳浮升並在頂端綻放'],
  ['water/drip', 'ice', 'PixelFX 水系圖鑑', '靈泉水滴：皇冠水花漣漪', 'water_fountain', 'mage_staff', 'waterAqua', 'nature', 'fbLiquid', '水珠墜落水面激起皇冠水花與同心漣漪'],
  ['water/fountain', 'ice', 'PixelFX 水系圖鑑', '聖殿噴泉：琉璃水弧飛珠', 'water_fountain', 'mage_staff', 'waterAqua', 'holy', 'fbLiquid', '湧泉向上綻放琉璃般水弧與清澈水珠'],
  ['water/geyser', 'ice', 'PixelFX 水系圖鑑', '間歇熱泉：白沫沖天水柱', 'water_fountain', 'mage_staff', 'waterAqua', 'nature', 'fbLiquid', '地面沸騰後噴發沖天高壓水柱與水霧雨'],
  ['water/rain-splash', 'ice', 'PixelFX 水系圖鑑', '暴雨積水花：交錯水紋皇冠', 'weather_sky', 'mage_staff', 'waterAqua', 'nature', 'fbLiquid', '密集雨滴砸落水面激起無數水冠與波紋'],
  ['water/ripples', 'ice', 'PixelFX 水系圖鑑', '鏡湖波紋：幽藍光澤漣漪', 'water_fountain', 'mage_staff', 'waterAqua', 'crescent', 'fbLiquid', '靜水擴散層層折射高光的立體波紋環'],
  ['water/splash', 'ice', 'PixelFX 水系圖鑑', '巨浪濺射：白沫水花飛散', 'water_fountain', 'mage_staff', 'waterAqua', 'nature', 'fbLiquid', '重物落水激起高聳水冠與細密水霧'],
  ['water/water-jet', 'ice', 'PixelFX 水系圖鑑', '高壓水砲：激流破甲水柱', 'cone_jet', 'mage_staff', 'waterAqua', 'arcane', 'fbLiquid', '高壓琉璃水柱直射目標並碎裂為浪花'],
  ['water/water-orb', 'ice', 'PixelFX 水系圖鑑', '懸浮水靈球：折射渦流水核', 'scifi_holo', 'mage_staff', 'waterAqua', 'crescent', 'fbLiquid', '半透明折射水球懸浮旋轉並滴落水珠'],
  ['water/waterfall', 'ice', 'PixelFX 水系圖鑑', '飛流直下：銀白瀑布水霧', 'water_fountain', 'mage_staff', 'waterAqua', 'nature', 'fbLiquid', '傾瀉水幕激起翻滾白沫與深潭水霧'],
  ['water/wave-crash', 'ice', 'PixelFX 水系圖鑑', '怒濤拍岸：捲浪碎沫衝擊', 'cone_jet', 'mage_staff', 'waterAqua', 'nature', 'fbLiquid', '巨浪捲曲拍落炸開大片白色浪沫'],
  ['water/whirlpool', 'ice', 'PixelFX 水系圖鑑', '深淵大漩渦：螺旋吞噬水眼', 'portal_soul', 'mage_staff', 'waterAqua', 'abyss', 'fbLiquid', '高速旋轉深水漩渦將萬物捲入渦心'],
  // ice (10)
  ['ice/blizzard-vortex', 'ice', 'PixelFX 寒冰圖鑑', '暴雪冰龍捲：極寒結晶風暴', 'water_fountain', 'mage_staff', 'mageFrost', 'arcane', 'fbMagicSwirl', '傾斜旋轉暴雪漏斗伴隨環繞冰晶碎片'],
  ['ice/freeze', 'ice', 'PixelFX 寒冰圖鑑', '絕對凍結：多面冰棺碎裂', 'ice_form', 'mage_staff', 'mageFrost', 'arcane', 'fbHitBurst', '寒霜攀爬全身凝結半透明多面冰晶塊後炸裂'],
  ['ice/frost-breath', 'ice', 'PixelFX 寒冰圖鑑', '冰龍吐息：極寒冰霧錐風', 'cone_jet', 'mage_staff', 'mageFrost', 'arcane', 'fbSmoke', '噴吐刺骨寒風雲霧與翻滾冰晶'],
  ['ice/frost-nova', 'ice', 'PixelFX 寒冰圖鑑', '冰霜新星：三環冰晶盛開', 'ice_form', 'mage_staff', 'mageFrost', 'arcane', 'fbStarburst', '雪花聚能後向四周綻放三圈半透明冰晶刺'],
  ['ice/ice-crystal', 'ice', 'PixelFX 寒冰圖鑑', '懸浮秘冰晶：折射寒光稜鏡', 'loot_ui', 'mage_staff', 'mageFrost', 'crescent', 'fbStarburst', '半透明多面冰晶緩緩自轉折射星芒'],
  ['ice/ice-lance', 'ice', 'PixelFX 寒冰圖鑑', '極寒冰槍：破空寒氣圓環', 'proj_shot', 'mage_staff', 'mageFrost', 'arcane', 'fbHitBurst', '多面體半透明冰矛攜帶寒氣環高速貫穿'],
  ['ice/ice-shatter', 'ice', 'PixelFX 寒冰圖鑑', '碎冰爆裂：折射冰塊飛散', 'ice_form', 'greatsword', 'mageFrost', 'war', 'fbHitBurst', '巨冰受擊龜裂白閃並炸成滿地滑行冰塊'],
  ['ice/ice-spikes', 'ice', 'PixelFX 寒冰圖鑑', '寒冰地刺浪：連環冰刃破土', 'ice_form', 'mage_staff', 'mageFrost', 'arcane', 'fbHitBurst', '寒霜線貼地疾馳並連續刺出鋒利半透明冰刃'],
  ['ice/icicle-fall', 'ice', 'PixelFX 寒冰圖鑑', '鐘乳冰柱墜：貫地碎冰花', 'ice_form', 'mage_staff', 'mageFrost', 'arcane', 'fbHitBurst', '高空巨型冰錐斷落直刺地面炸開冰屑'],
  ['ice/snowflake-burst', 'ice', 'PixelFX 寒冰圖鑑', '六出雪花爆：晶瑩雪舞飄落', 'loot_ui', 'mage_staff', 'mageFrost', 'crescent', 'fbStarburst', '寒光炸開無數旋轉六角冰晶雪花緩緩飄落'],
  // lightning (11)
  ['lightning/ball-lightning', 'volt', 'PixelFX 雷電圖鑑', '球狀閃電：漂浮電漿放電球', 'proj_shot', 'mage_staff', 'mageVolt', 'arcane', 'fbLightning', '漂浮電漿球不斷向地面與四周劈出電弧'],
  ['lightning/chain-lightning', 'volt', 'PixelFX 雷電圖鑑', '連鎖閃電：三目標跳躍電弧', 'volt_arc', 'mage_staff', 'mageVolt', 'arcane', 'fbLightning', '高壓電弧在三名敵人之間連續彈跳導電'],
  ['lightning/charge-up', 'volt', 'PixelFX 雷電圖鑑', '雷電超載聚氣：萬鈞電爆', 'blast', 'mage_staff', 'mageVolt', 'arcane', 'fbLightning', '電弧向掌心急速收束膨脹後全方位炸裂'],
  ['lightning/electrified', 'volt', 'PixelFX 雷電圖鑑', '全身感電：竄動電流剪影', 'volt_arc', 'unarmed', 'mageVolt', 'arcane', 'fbLightning', '高壓電流竄遍全身並向地面釋放接地火花'],
  ['lightning/lightning-strike', 'volt', 'PixelFX 雷電圖鑑', '定點落雷：雷印裂地焦痕', 'volt_arc', 'mage_staff', 'mageVolt', 'arcane', 'fbLightning', '地面雷印充能後劈下巨雷沿裂縫蔓延電弧'],
  ['lightning/plasma-ball', 'volt', 'PixelFX 雷電圖鑑', '魔導電漿球：玻璃球觸鬚電光', 'scifi_holo', 'mage_staff', 'mageViolet', 'arcane', 'fbLightning', '半透明晶球內無數電漿觸鬚向外攀附閃耀'],
  ['lightning/spark-arc', 'volt', 'PixelFX 雷電圖鑑', '雅各布電弧梯：攀升電極電光', 'volt_arc', 'mage_staff', 'mageVolt', 'arcane', 'fbLightning', '雙極之間拉出向上彎曲攀升的熾白電弧'],
  ['lightning/storm-cloud', 'volt', 'PixelFX 雷電圖鑑', '雷暴烏雲：雲間閃電與豪雨', 'weather_sky', 'mage_staff', 'mageVolt', 'abyss', 'fbLightning', '翻滾雷雲內部電光閃爍並劈下雷霆'],
  ['lightning/tesla-coil', 'volt', 'PixelFX 雷電圖鑑', '特斯拉線圈塔：環狀高壓放電', 'volt_arc', 'mage_staff', 'mageVolt', 'arcane', 'fbLightning', '魔導線圈塔向四周狂暴抽打分叉閃電'],
  ['lightning/thunderclap', 'volt', 'PixelFX 雷電圖鑑', '雷鳴震地：分叉落雷與塵浪', 'blast', 'unarmed', 'mageVolt', 'war', 'fbLightning', '周身白閃劈開分叉電弧與強勁地面震波環'],
  ['lightning/zap-hit', 'volt', 'PixelFX 雷電圖鑑', '高壓電擊命中：焦黑蕨紋火花', 'volt_arc', 'dual_daggers', 'mageVolt', 'war', 'fbLightning', '接觸瞬間過載炸開鋸齒電結與臭氧青煙'],
  // sci-fi (12)
  ['scifi/emp-blast', 'volt', 'PixelFX 科幻魔導', 'EMP 電磁脈衝：掃描線力場球', 'blast', 'unarmed', 'mageArcane', 'arcane', 'fbLightning', '圓盤引爆擴張半透明掃描線電磁球癱瘓全場'],
  ['scifi/energy-core', 'arcane', 'PixelFX 科幻魔導', '反應爐核心：雙環軌道脈動核', 'scifi_holo', 'mage_staff', 'mageArcane', 'arcane', 'fbStarburst', '半透明雙軌道環繞高能脈動電漿核心'],
  ['scifi/force-field', 'defense', 'PixelFX 科幻魔導', '六角力場護盾：受擊波紋裝甲', 'scifi_holo', 'sword_shield', 'mageArcane', 'holy', 'fbHitBurst', '半透明六角蜂巢穹頂攔截彈雨泛起能量漣漪'],
  ['scifi/glitch', 'arcane', 'PixelFX 科幻魔導', '次元訊號錯位：霓虹殘像閃爍', 'portal_soul', 'dual_daggers', 'mageViolet', 'abyss', 'fbMagicSwirl', '空間訊號撕裂閃現紅藍錯位全息殘影'],
  ['scifi/hologram', 'arcane', 'PixelFX 科幻魔導', '全息投影儀：立體幾何星圖', 'scifi_holo', 'mage_staff', 'mageArcane', 'crescent', 'fbMagicSwirl', '地面投影錐浮現半透明旋轉全息魔導陣'],
  ['scifi/jetpack', 'fire', 'PixelFX 科幻魔導', '雙噴射推進器：馬赫環尾焰', 'flame_loop', 'unarmed', 'fireInferno', 'war', 'fbFlame', '雙噴嘴向下噴射白熱馬赫環烈焰與濃煙'],
  ['scifi/laser-grid', 'volt', 'PixelFX 科幻魔導', '鐳射封鎖網：交錯切割紅光', 'scifi_holo', 'dual_daggers', 'rogueBlood', 'war', 'fbHitBurst', '高能紅色鐳射光束交錯掃描切割地面火花'],
  ['scifi/scanner', 'arcane', 'PixelFX 科幻魔導', '戰術鎖定掃描：全身光譜解析', 'scifi_holo', 'bow', 'mageEmerald', 'crescent', 'fbMagicSwirl', '全息光環由頭至腳掃描解析目標弱點'],
  ['scifi/teleporter-pad', 'arcane', 'PixelFX 科幻魔導', '星門傳送台：上升光環光柱', 'scifi_holo', 'mage_staff', 'mageArcane', 'crescent', 'fbBlessing', '傳送陣泛起層層上升光環與閃耀微粒'],
  ['scifi/tractor-beam', 'arcane', 'PixelFX 科幻魔導', '引力牽引光束：浮石螺旋升空', 'portal_soul', 'mage_staff', 'mageEmerald', 'arcane', 'fbMagicSwirl', '高空投影引力光錐將碎石螺旋吸起'],
  ['scifi/warp-in', 'arcane', 'PixelFX 科幻魔導', '折躍降臨：高能光束重構', 'scifi_holo', 'unarmed', 'mageArcane', 'crescent', 'fbStarburst', '光柱轟落由上而下重構英雄實體並收束火花'],
  ['scifi/warp-out', 'arcane', 'PixelFX 科幻魔導', '折躍離場：化光升空消散', 'portal_soul', 'unarmed', 'mageViolet', 'crescent', 'fbStarburst', '全身閃白化作無數光點順光束直衝天際'],
  // melee & impacts & projectiles Part 1 (15)
  ['melee/claw-swipe', 'melee', 'PixelFX 近戰圖鑑', '狂獸利爪：三道赤紅抓痕', 'melee_cut', 'dual_daggers', 'fireInferno', 'war', 'fbSlash', '三道並列熾熱爪痕撕裂空氣留下火星'],
  ['melee/dagger-flurry', 'melee', 'PixelFX 近戰圖鑑', '雙匕疾風亂舞：多角彎月連斬', 'melee_cut', 'dual_daggers', 'warriorSilver', 'war', 'fbSlash', '前方連續交錯高速細密彎月刀弧'],
  ['melee/double-slash', 'melee', 'PixelFX 近戰圖鑑', '十字雙重斬：X型白熱交擊', 'melee_cut', 'sword_shield', 'warriorSilver', 'war', 'fbSlash', '斜劈與逆挑交會成璀璨X字刀芒爆裂'],
  ['melee/hammer-smash', 'earth', 'PixelFX 近戰圖鑑', '重鎚碎地：力場圓頂與飛石', 'blast', 'greatsword', 'warriorGold', 'war', 'fbExplosion', '重鎚猛砸爆開力場震波與彈跳碎岩'],
  ['melee/heavy-cleave', 'fire', 'PixelFX 近戰圖鑑', '烈焰重劈：過頂餘燼裂地斬', 'melee_cut', 'greatsword', 'fireInferno', 'war', 'fbSlash', '厚重烈焰刀弧過頂劈裂大地噴出火燼'],
  ['melee/scythe-reap', 'shadow', 'PixelFX 近戰圖鑑', '死神大收割：幽冥巨型殘月', 'melee_cut', 'scythe', 'voidAbyss', 'abyss', 'fbSlash', '寬幅黑紫幽魂彎月橫掃並化為冷霧消散'],
  ['melee/spear-sweep', 'melee', 'PixelFX 近戰圖鑑', '長槍貼地橫掃：捲塵破足斬', 'melee_cut', 'spear', 'windJade', 'war', 'fbSlash', '低身大範圍長槍橫掃捲起地面沙塵'],
  ['melee/spin-slash', 'melee', 'PixelFX 近戰圖鑑', '迴旋滿月斬：360度環身刀輪', 'melee_cut', 'sword_shield', 'warriorSilver', 'war', 'fbSlash', '刀鋒繞腰旋轉一圈形成封閉銀白光輪'],
  ['melee/sword-slash', 'melee', 'PixelFX 近戰圖鑑', '疾速劍閃：冰藍漸層彎月', 'melee_cut', 'sword_shield', 'mageArcane', 'war', 'fbSlash', '俐落斜斬由熾白冷卻為深邃冰藍刀痕'],
  ['melee/thrust', 'melee', 'PixelFX 近戰圖鑑', '音速突刺：貫穿星芒氣環', 'melee_cut', 'spear', 'warriorSilver', 'war', 'fbHitBurst', '極速一點突刺於槍尖綻放十字貫穿星芒與氣環'],
  ['melee/uppercut', 'melee', 'PixelFX 近戰圖鑑', '昇龍挑斬：衝天彎月星爆', 'melee_cut', 'sword_shield', 'warriorGold', 'war', 'fbStarburst', '由地面向上挑起高聳彎月刀光並於頂端炸裂'],
  ['melee/whip-crack', 'melee', 'PixelFX 近戰圖鑑', '音爆長鞭：破空鞭梢白閃', 'melee_cut', 'dual_daggers', 'fireInferno', 'war', 'fbHitBurst', '流暢鞭弧甩出超音速鞭梢音爆環與火花'],
  ['impacts/crit-hit', 'melee', 'PixelFX 受擊圖鑑', '致命暴擊火花：鋸齒星爆飛晶', 'blast', 'greatsword', 'warriorGold', 'war', 'fbHitBurst', '劇烈白閃鋸齒星芒與四散折射碎片'],
  ['impacts/parry', 'defense', 'PixelFX 受擊圖鑑', '刀劍招架火花：金鐵交鳴十字閃', 'melee_cut', 'sword_shield', 'holyGold', 'holy', 'fbStarburst', '雙刃交鋒迸發清脆十字白星與黃金火星扇'],
  ['impacts/shield-block', 'defense', 'PixelFX 受擊圖鑑', '能量盾格擋：菱格波紋碎散', 'scifi_holo', 'sword_shield', 'mageArcane', 'holy', 'fbHitBurst', '半透明菱格護盾接下重擊泛起漣漪與偏折火花'],
];

export const PRESETS_PIXELFX_1 = PIXELFX_SPECS_1.map(makePixelFxPreset);
