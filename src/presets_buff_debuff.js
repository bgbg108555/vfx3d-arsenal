import * as THREE from 'three';
import { sampleMeshSurface } from './surface_emit3d.js';
import {
  TAU, clamp, smooth, ease, PAL3D,
  SlashArc3D, GroundWave3D, VortexFunnel3D, BeamCylinder3D, Sigil3D, DomeShield3D, ShockSphere3D,
  makeTranslucentConstructMaterial,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import {
  resolvePal, makeStaffCastKeyframes,
  makeEmpowerBuffKeyframes, spawnRisingBanner3D, spawnAscendingBuffAura,
  attachWeaponBladeTrail3D, spawnMartialStanceGust3D, spawnBladeGroundScar3D,
} from './fx_helpers.js';
import { buildChainStrandAssembly, buildTowerShieldAssembly } from './mesh_props3d.js';

// Helper for orbiting 3D Semi-Transparent Holographic Status Construct Rings/Icons over target or self!
function spawnOrbitingConstructs(sim, {
  cx = 0, cy = 1.65, cz = 0, radius = 0.72, count = 4, duration = 1.45,
  palette = PAL3D.holyGold, sigilStyle = 'holy', shape = 'diamond', spin = 4.2, bob = 0.08,
} = {}) {
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  const geo = shape === 'sphere'
    ? new THREE.SphereGeometry(0.14, 16, 12)
    : shape === 'ring'
      ? new THREE.TorusGeometry(0.18, 0.038, 10, 24)
      : new THREE.OctahedronGeometry(0.16, 0);
  if (shape === 'blade') geo.scale(0.45, 1.85, 0.22);
  const mat = makeTranslucentConstructMaterial({
    palette, sigilStyle, useHexLattice: true, baseAlpha: 0.22, rimAlpha: 0.94, hdr: 2.15,
  });
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat);
    g.add(m);
    nodes.push({ m, baseA: (i / count) * TAU });
  }
  let el = 0;
  sim.addCustom({
    group: g,
    update(dt) {
      el += dt;
      mat.uniforms.uTime.value = el * 1.8;
      const pop = ease.outBack(clamp(el / 0.18), 1.6);
      const fade = 1 - smooth(duration - 0.28, duration, el);
      mat.uniforms.uOpacity.value = fade;
      mat.uniforms.uDissolve.value = (1 - fade) * 0.9;
      nodes.forEach((n, idx) => {
        const a = n.baseA + el * spin;
        n.m.position.set(Math.cos(a) * radius, Math.sin(el * 5 + idx) * bob, Math.sin(a) * radius);
        n.m.rotation.y = -a;
        n.m.scale.setScalar(Math.max(0.01, pop));
      });
    },
    get done() { return el >= duration; },
    dispose() { geo.dispose(); mat.dispose(); },
  });
}

// Factory for concise, distinct AAA Buff & Debuff Choreographies
function makeStatusPreset({
  id, cls, title, codeId, isDebuff = false, loadout = 'unarmed',
  palKey = 'holyGold', sigilStyle = 'holy', flipbook = 'fbBlessing',
  bannerText = 'BUFF UP ▲', bannerSub = '',
  radius = 2.6, cz = 0, specNotes, customRun,
}) {
  const dur = 2.30;
  const selfCentered = !isDebuff && cz === 0;
  const isPhysical = loadout !== 'mage_staff' && id !== 'deb_charm_siren';
  const kf = isDebuff
    ? (isPhysical
        ? [
            { t: 0.00, pose: { ...REST_POSE } },
            { t: 0.22, ease: ease.inCubic, pose: { ...REST_POSE, crouch: 0.18, torsoYaw: -0.52, shRPitch: -1.85, shRYaw: -0.45 } },
            { t: 0.36, ease: ease.outExpo, pose: { ...REST_POSE, z: 0.35, crouch: 0.16, torsoPitch: 0.22, torsoYaw: 0.38, shRPitch: -1.12, shRYaw: 0.44, capePitch: 0.72 } },
            { t: 2.20, ease: ease.inOutCubic, pose: { ...REST_POSE } },
          ]
        : makeStaffCastKeyframes(0.24, 0.36, 2.20))
    : makeEmpowerBuffKeyframes(0.20, 0.36, 2.20, loadout);
  return {
    id,
    cat: 'buff_debuff',
    cls,
    title,
    codeId,
    duration: dur,
    releaseTime: 0.36,
    peakTime: 0.56,
    contactTimes: [0.36],
    hitbox: { kind: 'circle', targetTeam: isDebuff ? 'enemy' : 'party', cx: 0, cz, radius },
    targetTeam: isDebuff ? 'enemy' : 'party',
    selfCentered,
    handlesDynamicScale: selfCentered,
    specNotes,
    setup(fighter, dummies, paletteOverride, allies = []) {
      const { hotHex } = resolvePal(palKey, paletteOverride);
      fighter.setLoadout(loadout, hotHex);
      if (isDebuff) {
        fighter.resetSupportHUD?.();
        allies.forEach((a) => a.reset(0, 0, false));
        dummies[0].reset(0, cz, true);
        dummies[1].reset(-1.15, cz + 0.35, true);
        dummies[2].reset(1.15, cz + 0.35, true);
      } else {
        fighter.enableSupportHUD?.({ hpFrac: 0.86, shieldFrac: 0.0 });
        dummies[0].reset(0, 3.6, false);
        dummies[1].reset(0, 0, false);
        dummies[2].reset(0, 0, false);
        if (allies.length >= 2) {
          allies[0].reset(-1.55, 1.45, true, { hpFrac: 0.82, yaw: Math.PI * 0.82 });
          allies[1].reset(1.55, 1.45, true, { hpFrac: 0.85, yaw: -Math.PI * 0.82 });
          if (allies[2]) allies[2].reset(0, 0, false);
        }
      }
    },
    keyframes: kf,
    buildEvents(sim, fighter, dummies, seed, paletteOverride, texStyle = 'auto', allies = []) {
      const P = resolvePal(palKey, paletteOverride);
      return [
        { t: 0.06, isPreGather: true, run() {
          const h = fighter.getRightHandWorld();
          sim.spawnStarGlint(h.x, h.y + 0.1, h.z, 0.58, P.hotHex, 0.24, true);
        }},
        { t: 0.36, run() {
          if (isDebuff) {
            fighter.hitStop = 0.05;
            const effFb = (isPhysical && flipbook === 'fbMagicSwirl') ? 'fbDarkVortex' : flipbook;
            if (isPhysical) {
              attachWeaponBladeTrail3D(sim, fighter, { duration: 0.38, palette: P.pal, hdr: 2.4 });
              for (const sgn of [-1, 1]) {
                sim.addCustom(new SlashArc3D({
                  center: [0, 1.15, cz], radius: 1.85, width: 0.72, thickness: 0.22,
                  a0: -1.3 * sgn, a1: 1.3 * sgn, tiltZ: 0.55 * sgn,
                  sweep: 0.055, hold: 0.05, trail: 0.20, palette: P.pal, texStyle, defaultTex: 'silk', hdrBoost: 2.35, seed: seed + (sgn > 0 ? 7 : 8),
                }));
              }
              spawnBladeGroundScar3D(sim, { x: 0, z: cz, length: 2.6, width: 0.38, life: 0.85, palette: P.pal });
            } else if (id !== 'deb_burn_immolate') {
              sim.addCustom(new Sigil3D({
                x: 0, y: 0.02, z: cz, radius: radius * 0.92, duration: 1.45,
                style: sigilStyle, palette: P.pal, hdr: 2.0, wallHeight: 0.55,
              }));
            }
            if (id !== 'deb_burn_immolate') {
              sim.addCustom(new ShockSphere3D({ x: 0, y: 1.05, z: cz, r0: 0.2, r1: radius * 0.88, duration: 0.42, palette: P.pal, hdr: 2.35, useRunes: !isPhysical }));
              sim.addCustom(new GroundWave3D({ x: 0, z: cz, maxRadius: radius * 0.92, thickness: 0.48, height: 0.72, duration: 0.44, palette: P.pal, hdr: 2.1, seed: seed + 13 }));
              sim.spawnFlipbook({ atlas: effFb, x: 0, y: 1.18, z: cz, life: 0.65, size0: 1.15, size1: 2.35, palette: P.pal, hdr: 2.3 });
            }
            sim.spawnNiagaraBurst({
              x: 0, y: 0.85, z: cz, count: 48, speed0: 1.5, speed1: 5.2, spreadRadius: 0.55,
              gravity: 2.5, curl: 4.5, vortex: -5.0, vortexCenter: [0, cz],
              life0: 0.45, life1: 0.95, size0: 0.042, size1: 0.012, palette: P.pal, hdr: 2.3,
            });
            for (const d of dummies) {
              if (!d.active) continue;
              d.hit({ dirX: d.homeX * 0.3, dirZ: 1, power: 1.15, noPush: true, flashColor: P.hotHex });
              if (id === 'deb_burn_immolate') {
                const body = d.pivot.children.find((child) => child.isMesh && child.material === d.bodyMat);
                for (const point of sampleMeshSurface(body, sim.R, 8)) {
                  sim.spawnNiagaraBurst({ x: point.x, y: point.y, z: point.z, _mapped: true, count: 1,
                    speed0: 0.3, speed1: 0.9, dirX: 0, dirY: 1, dirZ: 0, dirBias: 0.7,
                    spreadRadius: 0, gravity: -0.4, curl: 0.4, life0: 0.25, life1: 0.45,
                    size0: 0.04, size1: 0.01, palette: P.pal, hdr: 1.6 });
                }
              }
              sim.spawnFlipbook({ atlas: effFb, x: d.root.position.x, y: 1.15, z: d.root.position.z, life: 0.58,
                size0: id === 'deb_burn_immolate' ? 0.48 : 0.85, size1: id === 'deb_burn_immolate' ? 1.0 : 1.75,
                palette: P.pal, hdr: id === 'deb_burn_immolate' ? 1.3 : 2.2 });
            }
          } else {
            // 100% Upward-Rising Buff Choreography — ZERO hitStop, ZERO chest ShockSphere!
            const shortBuff = title.split('：').pop();
            const effFb = (isPhysical && flipbook === 'fbMagicSwirl') ? 'fbWindTornado' : flipbook;
            fighter.pulseBodyAura?.(P.hotHex, 1.55);
            fighter.empowerWeapon?.(P.hotHex, 1.65, null);

            if (isPhysical) {
              spawnMartialStanceGust3D(sim, { x: 0, z: 0, radius: 1.45, duration: 0.85, palette: P.pal, _mapped: true });
              attachWeaponBladeTrail3D(sim, fighter, { duration: 0.45, palette: P.pal, hdr: 2.35 });
            } else {
              const sig = new Sigil3D({
                x: 0, y: 0.02, z: 0, radius: radius * 0.92, duration: 1.55,
                style: sigilStyle, palette: P.pal, hdr: 1.48, wallHeight: 0.28,
              });
              sig._skipAutoMap = true;
              sim.addCustom(sig);
            }

            spawnRisingBanner3D(sim, {
              x: 0, y0: 3.22, z: 0, rise: 0.72, duration: 1.55,
              text: bannerText,
              subText: bannerSub || `✦ ${shortBuff} ✦`,
              palette: P.pal, scale: 0.96, _mapped: true,
            });
            spawnAscendingBuffAura(sim, {
              x: 0, z: 0, radius: 1.08, maxH: 3.25, duration: 1.55,
              ringCount: 5, chevronCount: 8, helixCount: 2,
              pillar: false, vortex: false,
              texStyle, flipbook: effFb, niagaraCount: 48,
              palette: P.pal, hdr: 1.55, _mapped: true,
            });

            fighter.heal?.(0.18, `▲${shortBuff}`);
            fighter.addBuff?.(`▲${shortBuff}`, P.hotHex);
            for (const a of allies) {
              if (!a?.active) continue;
              a.heal(0.20, `▲${shortBuff}`);
              a.addBuff(`▲${shortBuff}`, P.hotHex);
              a.empowerWeapon?.(P.hotHex, 1.65, `▲${shortBuff}`);
              const wp = a.worldPosition();
              spawnAscendingBuffAura(sim, {
                x: wp.x, z: wp.z, radius: 0.72, maxH: 2.35, duration: 1.38,
                ringCount: 3, chevronCount: 4, helixCount: 1,
                pillar: false, vortex: false,
                texStyle, flipbook: effFb, niagaraCount: 18,
                palette: P.pal, hdr: 2.1, _mapped: true,
              });
            }
          }
          customRun?.(sim, fighter, dummies, P, texStyle, seed);
        }},
      ];
    },
  };
}

export const PRESETS_BUFF_DEBUFF = [
  // ---- 8 WARCRIES & BUFFS ----
  makeStatusPreset({
    id: 'buf_warcry_valor', cls: '戰神統帥 Warlord', title: '戰吼增益：霸王破陣咆哮 (全隊攻擊UP)', codeId: 'buf.warcry.valor',
    loadout: 'greatsword', palKey: 'warriorGold', sigilStyle: 'war', flipbook: 'fbStarburst', radius: 3.0, cz: 0,
    bannerText: 'ATK UP ▲', bannerSub: '★ 霸王破陣 · 全隊攻擊提升 ★',
    specNotes: ['昂首高舉巨劍戰吼，升起 5 層黃金強化光環、立體上揚箭頭與 ATK UP ▲ 金翼徽章，4 枚戰劍徽記環繞全身代表攻擊力大幅提升'],
    customRun(sim, _f, _d, P, texStyle) {
      const vf = new VortexFunnel3D({ x: 0, y: 0.02, z: 0, rBottom: 0.85, rTop: 2.1, height: 2.6, duration: 1.15, riseSpeed: 3.8, palette: P.pal, texStyle, defaultTex: 'flame', hdr: 1.05 });
      vf._skipAutoMap = true;
      sim.addCustom(vf);
      spawnOrbitingConstructs(sim, { cx: 0, cy: 1.25, cz: 0, radius: 0.92, count: 4, duration: 1.45, palette: P.pal, sigilStyle: null, shape: 'blade' });
    },
  }),
  makeStatusPreset({
    id: 'buf_warcry_ironwall', cls: '重裝鐵衛 Ironclad', title: '防禦戰吼：金剛鐵壁怒吼 (減傷護甲UP)', codeId: 'buf.warcry.ironwall',
    loadout: 'sword_shield', palKey: 'holyGold', sigilStyle: 'holy', flipbook: 'fbBlessing', radius: 2.8, cz: 0,
    bannerText: 'DEF UP ▲', bannerSub: '★ 金剛鐵壁 · 減傷護甲提升 ★',
    specNotes: ['昂首張開半透明黃金六角穹頂、旋轉全息塔盾與上升守護金環，浮現 DEF UP ▲ 金翼徽章賦予全隊護甲增益'],
    customRun(sim, _f, _d, P) {
      const dome = new DomeShield3D({ x: 0, y: 0.02, z: 0, radius: 1.95, duration: 1.42, palette: P.pal, hdr: 2.1 });
      dome._skipAutoMap = true;
      sim.addCustom(dome);
      const sh = buildTowerShieldAssembly({ palette: P.pal, scale: 0.95 });
      let el = 0;
      sim.addCustom({
        group: sh.group,
        _skipAutoMap: true,
        update(dt) { el += dt; sh.update(dt); sh.group.position.set(0, 1.05 + Math.sin(el * 4) * 0.06, 0.95); sh.setOpacity(1 - smooth(1.0, 1.4, el)); },
        get done() { return el >= 1.42; },
        dispose() { sh.dispose(); },
      });
    },
  }),
  makeStatusPreset({
    id: 'buf_berserk_bloodlust', cls: '狂戰士 Berserker', title: '狂暴增益：嗜血戰意沸騰 (攻速暴擊UP)', codeId: 'buf.berserk.bloodlust',
    loadout: 'dual_daggers', palKey: 'rogueBlood', sigilStyle: 'war', flipbook: 'fbFlame', radius: 2.6, cz: 0,
    bannerText: 'CRIT & ASPD ▲', bannerSub: '★ 嗜血戰意 · 攻速暴擊沸騰 ★',
    specNotes: ['周身升騰赤紅戰意氣旋、上升強化光環與 CRIT & ASPD ▲ 徽章，頭頂凝聚半透明狂戰血晶環'],
    customRun(sim, _f, _d, P, texStyle) {
      const vf = new VortexFunnel3D({ x: 0, y: 0.02, z: 0, rBottom: 0.65, rTop: 1.55, height: 2.6, duration: 1.25, riseSpeed: 4.2, palette: P.pal, texStyle, defaultTex: 'flame', hdr: 2.35 });
      vf._skipAutoMap = true;
      sim.addCustom(vf);
      spawnOrbitingConstructs(sim, { cx: 0, cy: 1.85, cz: 0, radius: 0.55, count: 5, duration: 1.45, palette: P.pal, sigilStyle: null, shape: 'diamond', spin: 6.2 });
    },
  }),
  makeStatusPreset({
    id: 'buf_holy_blessing', cls: '聖光主教 High Priest', title: '神聖增益：熾天使聖光祝福', codeId: 'buf.holy.blessing',
    loadout: 'mage_staff', palKey: 'holyGold', sigilStyle: 'holy', flipbook: 'fbFeatherBurst', radius: 2.8, cz: 0,
    bannerText: 'BLESSING ▲', bannerSub: '★ 熾天使聖光全屬性祝福 ★',
    specNotes: ['聖殿花窗法陣湧起沖天祝福聖光柱（由地面升向天際）、金色聖羽與 BLESSING ▲ 徽章'],
    customRun(sim, _f, _d, P, texStyle) {
      const beam = new BeamCylinder3D({
        p0: new THREE.Vector3(0, 0.02, 0),
        p1: new THREE.Vector3(0, 5.2, 0),
        radius: 0.52, duration: 1.25, palette: P.pal, texStyle, defaultTex: 'silk', hdr: 1.05,
      });
      beam._skipAutoMap = true;
      sim.addCustom(beam);
      spawnOrbitingConstructs(sim, { cx: 0, cy: 1.35, cz: 0, radius: 0.85, count: 4, duration: 1.45, palette: P.pal, sigilStyle: 'holy', shape: 'ring' });
    },
  }),
  makeStatusPreset({
    id: 'buf_nature_regen', cls: '森羅德魯伊 Druid', title: '持續恢復：森羅萬象生命湧泉 (HoT)', codeId: 'buf.nature.regen',
    loadout: 'mage_staff', palKey: 'mageEmerald', sigilStyle: 'nature', flipbook: 'fbBlessing', radius: 2.8, cz: 0,
    bannerText: 'REGEN +HP ▲', bannerSub: '★ 森羅生命湧泉持續恢復 ★',
    specNotes: ['展開世界樹自然法陣，翡翠生命露珠、上升光環與 REGEN +HP ▲ 徽章沿雙螺旋持續升空恢復 HP'],
    customRun(sim, _f, _d, P) {
      spawnOrbitingConstructs(sim, { cx: 0, cy: 1.15, cz: 0, radius: 0.95, count: 6, duration: 1.48, palette: P.pal, sigilStyle: 'nature', shape: 'diamond', bob: 0.22 });
    },
  }),
  makeStatusPreset({
    id: 'buf_wind_haste', cls: '疾風遊俠 Windrunner', title: '速度增益：蒼嵐神行疾風步 (移速閃避UP)', codeId: 'buf.wind.haste',
    loadout: 'bow', palKey: 'windJade', sigilStyle: 'nature', flipbook: 'fbMagicSwirl', radius: 2.6, cz: 0,
    bannerText: 'HASTE UP ▲', bannerSub: '★ 蒼嵐疾風 · 移速閃避提升 ★',
    specNotes: ['腳下捲起雙層上升翠綠氣流漩渦、上揚疾風箭頭與 HASTE UP ▲ 徽章，賦予全隊極速移動與閃避增益'],
    customRun(sim, _f, _d, P, texStyle) {
      const vf = new VortexFunnel3D({ x: 0, y: 0.02, z: 0, rBottom: 0.55, rTop: 1.75, height: 2.25, duration: 1.20, riseSpeed: 4.5, palette: P.pal, texStyle, defaultTex: 'silk', hdr: 2.2 });
      vf._skipAutoMap = true;
      sim.addCustom(vf);
    },
  }),
  makeStatusPreset({
    id: 'buf_arcane_clarity', cls: '星辰賢者 Astromancer', title: '魔力增益：星辰新月魔導湧泉 (回魔減CD)', codeId: 'buf.arcane.clarity',
    loadout: 'mage_staff', palKey: 'mageArcane', sigilStyle: 'crescent', flipbook: 'fbMagicSwirl', radius: 2.7, cz: 0,
    bannerText: 'MANA & CDR ▲', bannerSub: '★ 星月湧泉 · 回魔減冷卻 ★',
    specNotes: ['腳下展開星辰新月法陣，上升魔導光環、4 顆星界魔方與 MANA & CDR ▲ 徽章同步升騰充能'],
    customRun(sim, _f, _d, P) {
      spawnOrbitingConstructs(sim, { cx: 0, cy: 1.4, cz: 0, radius: 0.88, count: 4, duration: 1.48, palette: P.pal, sigilStyle: 'crescent', shape: 'sphere' });
    },
  }),
  makeStatusPreset({
    id: 'buf_titan_unstoppable', cls: '不動明王 Juggernaut', title: '霸體覺醒：金剛不壞免疫結界', codeId: 'buf.titan.unstoppable',
    loadout: 'unarmed', palKey: 'earthMagma', sigilStyle: 'war', flipbook: 'fbStarburst', radius: 2.8, cz: 0,
    bannerText: 'IMMUNE ▲', bannerSub: '★ 金剛不壞 · 霸體免控覺醒 ★',
    specNotes: ['昂首展開半透明琥珀金剛六角護體晶殼、上升霸體光環與 IMMUNE ▲ 徽章，免疫一切擊退與控制效果'],
    customRun(sim, _f, _d, P) {
      const dome = new DomeShield3D({ x: 0, y: 0.02, z: 0, radius: 1.65, duration: 1.45, palette: P.pal, hdr: 2.2 });
      dome._skipAutoMap = true;
      sim.addCustom(dome);
    },
  }),

  // ---- 14 DEBUFFS & STATUS DoTs (中毒、火燒、流血、冰凍、感電、破甲、詛咒、暈眩、睡眠、魅惑、混亂、石化、沈默、狂怒) ----
  makeStatusPreset({
    id: 'deb_poison_miasma', isDebuff: true, cls: '劇毒術士 Venomancer', title: '減益狀態：腐蝕劇毒纏身 (Poison DoT)', codeId: 'deb.poison.miasma',
    loadout: 'mage_staff', palKey: 'poison', sigilStyle: 'abyss', flipbook: 'fbPoison', radius: 2.7, cz: 3.4,
    specNotes: ['AI 生成劇毒骷髏毒霧 Flipbook 持續翻湧，半透明毒液球環繞敵身造成每秒腐蝕中毒傷害'],
    customRun(sim, _f, _d, P) {
      spawnOrbitingConstructs(sim, { cx: 0, cy: 1.25, cz: 3.4, radius: 0.85, count: 5, duration: 1.45, palette: P.pal, sigilStyle: 'abyss', shape: 'sphere', bob: 0.18 });
      sim.spawnFlipbook({ atlas: 'fbLiquid', x: 0, y: 0.55, z: 3.4, life: 0.95, size0: 1.2, size1: 2.2, palette: P.pal, hdr: 2.1 });
    },
  }),
  makeStatusPreset({
    id: 'deb_burn_immolate', isDebuff: true, cls: '烈焰法師 Pyromancer', title: '減益狀態：業火焚身灼燒 (Burn DoT)', codeId: 'deb.burn.immolate',
    loadout: 'mage_staff', palKey: 'fireInferno', sigilStyle: 'war', flipbook: 'fbFlame', radius: 2.7, cz: 3.4,
    specNotes: ['目標陷入立體火柱漩渦與 AI 烈焰 Flipbook 持續灼燒，不斷噴散 Niagara 餘燼火星'],
    customRun(sim, _f, _d, P, texStyle) {
      sim.addCustom(new VortexFunnel3D({ x: 0, y: 0.02, z: 3.4, rBottom: 0.65, rTop: 1.45, height: 2.35, duration: 1.25, palette: P.pal, texStyle, defaultTex: 'flame', hdr: 2.4 }));
    },
  }),
  makeStatusPreset({
    id: 'deb_bleed_lacerate', isDebuff: true, cls: '血刃刺客 Bloodletter', title: '減益狀態：撕裂重創流血 (Bleed DoT)', codeId: 'deb.bleed.lacerate',
    loadout: 'dual_daggers', palKey: 'rogueBlood', sigilStyle: 'war', flipbook: 'fbLiquid', radius: 2.6, cz: 3.4,
    specNotes: ['敵身胸口烙印立體猩紅十字裂傷標記，伴隨血霧飛濺與半透明血晶刺持續扣血'],
    customRun(sim, _f, dummies, P) {
      dummies.forEach((d) => { if (d.active) sim.spawnStatusMark('bleed', d.root.position, 1.35); });
      spawnOrbitingConstructs(sim, { cx: 0, cy: 1.15, cz: 3.4, radius: 0.78, count: 4, duration: 1.35, palette: P.pal, sigilStyle: null, shape: 'blade' });
    },
  }),
  makeStatusPreset({
    id: 'deb_freeze_glacier', isDebuff: true, cls: '凜冬巫師 Cryomancer', title: '減益控場：極寒冰封禁錮 (Frozen)', codeId: 'deb.freeze.glacier',
    loadout: 'mage_staff', palKey: 'mageFrost', sigilStyle: 'arcane', flipbook: 'fbHitBurst', radius: 2.7, cz: 3.4,
    specNotes: ['半透明折射冰晶簇破地而出將敵群凍結，腳踝鎖上立體冰霜結晶環'],
    customRun(sim, _f, dummies, P) {
      for (const d of dummies) {
        if (!d.active) continue;
        sim.spawnCrystal({ x: d.root.position.x, z: d.root.position.z, height: 1.65, width: 0.55, hold: 0.85, melt: 0.42, palette: P.pal });
        sim.spawnStatusMark('frostRing', d.root.position, 1.35);
      }
    },
  }),
  makeStatusPreset({
    id: 'deb_shock_paralyze', isDebuff: true, cls: '雷鳴導師 Stormcaller', title: '減益控場：高壓感電麻痺 (Shocked)', codeId: 'deb.shock.paralyze',
    loadout: 'mage_staff', palKey: 'mageVolt', sigilStyle: 'arcane', flipbook: 'fbLightning', radius: 2.7, cz: 3.4,
    specNotes: ['三名受術敵人之間不斷跳躍立體高壓電弧鏈，全身麻痺抽搐'],
    customRun(sim, _f, dummies, P) {
      sim.spawnBolt(dummies[0].root.position.clone().setY(1.2), dummies[1].root.position.clone().setY(1.2), { radius: 0.04, jitter: 0.25, life: 0.95, color: P.hotHex });
      sim.spawnBolt(dummies[0].root.position.clone().setY(1.2), dummies[2].root.position.clone().setY(1.2), { radius: 0.04, jitter: 0.25, life: 0.95, color: P.hotHex });
      sim.spawnBolt(dummies[1].root.position.clone().setY(1.2), dummies[2].root.position.clone().setY(1.2), { radius: 0.035, jitter: 0.25, life: 0.95, color: P.hotHex });
    },
  }),
  makeStatusPreset({
    id: 'deb_armor_sunder', isDebuff: true, cls: '破甲戰狂 Breaker', title: '減益狀態：碎盾破甲重創 (Armor Break)', codeId: 'deb.armor.sunder',
    loadout: 'greatsword', palKey: 'warriorGold', sigilStyle: 'war', flipbook: 'fbHitBurst', radius: 2.6, cz: 3.4,
    specNotes: ['敵前浮現半透明護盾並瞬間溶解崩裂為滿地折射碎片，掛上頭頂虛弱羽刃標記'],
    customRun(sim, _f, dummies, P) {
      dummies.forEach((d) => { if (d.active) sim.spawnStatusMark('weakness', d.root.position, 1.35); });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        sim.spawnShard({ x: Math.cos(a) * 0.6, y: 1.25, z: 3.4 + Math.sin(a) * 0.6, vx: Math.cos(a) * 3.2, vy: 2.4, vz: Math.sin(a) * 3.2, size: 0.12, life: 0.85, color: P.hotHex });
      }
    },
  }),
  makeStatusPreset({
    id: 'deb_abyss_curse', isDebuff: true, cls: '深淵術士 Warlock', title: '減益狀態：深淵死咒鎖鏈 (Cursed)', codeId: 'deb.abyss.curse',
    loadout: 'scythe', palKey: 'voidAbyss', sigilStyle: 'abyss', flipbook: 'fbMagicSwirl', radius: 2.7, cz: 3.4,
    specNotes: ['冥界巨鐮劈裂地表伸出 3 條半透明黑曜鎖鏈纏繞敵身，降低全屬性抗性'],
    customRun(sim, _f, dummies, P) {
      for (const d of dummies) {
        if (!d.active) continue;
        const ch = buildChainStrandAssembly(new THREE.Vector3(0, 0.05, 3.4), d.root.position.clone().setY(1.25), { sag: -0.15, linkSize: 0.085, palette: P.pal });
        let el = 0;
        sim.addCustom({
          group: ch.group,
          update(dt) { el += dt; ch.setOpacity(1 - smooth(0.95, 1.35, el)); },
          get done() { return el >= 1.38; },
          dispose() { ch.dispose(); },
        });
      }
    },
  }),
  makeStatusPreset({
    id: 'deb_stun_dizzy', isDebuff: true, cls: '重鎚衛士 Warden', title: '減益控場：重擊暈眩星環 (Stunned)', codeId: 'deb.stun.dizzy',
    loadout: 'sword_shield', palKey: 'holyGold', sigilStyle: 'war', flipbook: 'fbStarburst', radius: 2.5, cz: 3.4,
    specNotes: ['目標頭頂高速旋轉半透明黃金暈眩星環與閃爍十字星芒'],
    customRun(sim, _f, _d, P) {
      spawnOrbitingConstructs(sim, { cx: 0, cy: 2.05, cz: 3.4, radius: 0.52, count: 5, duration: 1.42, palette: P.pal, sigilStyle: null, shape: 'diamond', spin: 7.5, bob: 0.04 });
    },
  }),
  makeStatusPreset({
    id: 'deb_sleep_slumber', isDebuff: true, cls: '夢境幻術師 Illusionist', title: '減益控場：星月沉眠夢泡 (Sleep)', codeId: 'deb.sleep.slumber',
    loadout: 'mage_staff', palKey: 'mageViolet', sigilStyle: 'crescent', flipbook: 'fbMagicSwirl', radius: 2.6, cz: 3.4,
    specNotes: ['敵群籠罩於半透明虹彩夢境氣泡與漂浮星月微粒中進入沉睡'],
    customRun(sim, _f, _d, P) {
      spawnOrbitingConstructs(sim, { cx: 0, cy: 1.65, cz: 3.4, radius: 0.72, count: 6, duration: 1.45, palette: P.pal, sigilStyle: 'crescent', shape: 'sphere', spin: 2.2, bob: 0.24 });
    },
  }),
  makeStatusPreset({
    id: 'deb_charm_siren', isDebuff: true, cls: '魅影妖姬 Siren', title: '減益控場：粉紫魔心魅惑 (Charmed)', codeId: 'deb.charm.siren',
    loadout: 'unarmed', palKey: 'rogueShadow', sigilStyle: 'crescent', flipbook: 'fbBlessing', radius: 2.6, cz: 3.4,
    specNotes: ['粉紫霓虹音波球與半透明魅惑稜鏡環繞目標，奪取心智'],
    customRun(sim, _f, _d, P) {
      spawnOrbitingConstructs(sim, { cx: 0, cy: 1.55, cz: 3.4, radius: 0.68, count: 4, duration: 1.45, palette: P.pal, sigilStyle: 'crescent', shape: 'ring', spin: 4.8 });
    },
  }),
  makeStatusPreset({
    id: 'deb_confuse_chaos', isDebuff: true, cls: '混沌魔導 Chaos Mage', title: '減益控場：混沌螺旋迷霧 (Confused)', codeId: 'deb.confuse.chaos',
    loadout: 'mage_staff', palKey: 'mageArcane', sigilStyle: 'abyss', flipbook: 'fbMagicSwirl', radius: 2.6, cz: 3.4,
    specNotes: ['頭頂交錯逆旋雙層半透明混沌圓環與迷幻氣旋，使目標方向錯亂'],
    customRun(sim, _f, _d, P) {
      spawnOrbitingConstructs(sim, { cx: 0, cy: 1.95, cz: 3.4, radius: 0.58, count: 4, duration: 1.42, palette: P.pal, sigilStyle: 'abyss', shape: 'ring', spin: -6.8, bob: 0.14 });
    },
  }),
  makeStatusPreset({
    id: 'deb_petrify_stone', isDebuff: true, cls: '蛇髮魔導 Gorgon', title: '減益控場：大地石化結晶 (Petrified)', codeId: 'deb.petrify.stone',
    loadout: 'mage_staff', palKey: 'earthMagma', sigilStyle: 'war', flipbook: 'fbSmoke', radius: 2.6, cz: 3.4,
    specNotes: ['灰琥珀半透明礦石晶柱包覆敵身，將目標完全石化封鎖'],
    customRun(sim, _f, dummies, P) {
      dummies.forEach((d) => {
        if (d.active) sim.spawnCrystal({ x: d.root.position.x, z: d.root.position.z, height: 1.55, width: 0.52, hold: 0.85, melt: 0.40, palette: P.pal });
      });
    },
  }),
  makeStatusPreset({
    id: 'deb_silence_seal', isDebuff: true, cls: '禁魔審判官 Inquisitor', title: '減益控場：禁魔沈默符印 (Silenced)', codeId: 'deb.silence.seal',
    loadout: 'sword_shield', palKey: 'mageVolt', sigilStyle: 'holy', flipbook: 'fbStarburst', radius: 2.6, cz: 3.4,
    specNotes: ['目標上方壓下垂直交叉半透明禁魔聖印環，封鎖一切法術詠唱'],
    customRun(sim, _f, _d, P) {
      spawnOrbitingConstructs(sim, { cx: 0, cy: 1.45, cz: 3.4, radius: 0.65, count: 3, duration: 1.45, palette: P.pal, sigilStyle: null, shape: 'ring', spin: 5.2 });
    },
  }),
  makeStatusPreset({
    id: 'deb_rage_frenzy', isDebuff: true, cls: '挑釁鬥士 Provoker', title: '減益狀態：狂怒失控蒸氣 (Taunted / Enraged)', codeId: 'deb.rage.frenzy',
    loadout: 'sword_shield', palKey: 'fireInferno', sigilStyle: 'war', flipbook: 'fbSmoke', radius: 2.6, cz: 3.4,
    specNotes: ['敵群噴出赤紅高熱蒸氣雲與怒火火星，防禦下降並強制轉火'],
    customRun(sim, _f, _d, P) {
      spawnOrbitingConstructs(sim, { cx: 0, cy: 1.85, cz: 3.4, radius: 0.56, count: 4, duration: 1.42, palette: P.pal, sigilStyle: null, shape: 'blade', spin: 7.0 });
    },
  }),
];
