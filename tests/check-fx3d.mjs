import * as THREE from 'three';
import { ensureBakedTextures } from '../scripts/pack-textures.mjs';

ensureBakedTextures({ silent: true });

const {
  Sim3D, Sigil3D, FX_CONFIG, PAL3D, getScaledHitbox, getEffectiveRangeScale, getEffectiveMoveHitbox, mapHitboxPointXZ,
} = await import('../src/core3d.js');
const { AI_TEXTURE_CATALOG, TEX_CONFIG, getTexLib } = await import('../src/texgen3d.js');
const { BAKED_AI_TEXTURES } = await import('../src/baked_textures.js');
const { CHARGE_VARIANTS_META, installChargeVariantHook } = await import('../src/env_fx3d.js');
const { MESH_GALLERY_ITEMS } = await import('../src/mesh_gallery3d.js');
const { MagicArray3D } = await import('../src/magic_arrays3d.js');
const {
  findPathAStarOctile, sweptSegmentSphereHit, computeSquashStretch3D, TraumaCameraShake3D,
  evalCubicBezier3D, buildBezierArcLengthLUT, evalDivergenceFreeCurl3D,
} = await import('../src/gamedev_algos3d.js');
const { Fighter3D, DummyTarget3D, AllyHero3D, REST_POSE } = await import('../src/actors3d.js');
const {
  createChantAwareSession, getEffectiveChantSpec, computeMoveSyncSpec, CHANT_MODES_META, isMartialWeaponMove,
} = await import('../src/chant_system3d.js');
const { exportVfxPackage } = await import('../src/vfx_exporter3d.js');
const { MOVES_3D, CATEGORIES_3D } = await import('../src/moves3d.js');

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 160);
cam.position.set(-5.8, 5.9, -2.5);
const fighter = new Fighter3D(scene);
const dummies = [
  new DummyTarget3D(scene, 0, 2.0),
  new DummyTarget3D(scene, -1.5, 3.5),
  new DummyTarget3D(scene, 1.5, 3.5),
];
const allies = [0, 1, 2].map((i) => new AllyHero3D(scene, i));
const sim = new Sim3D(scene, 7);

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('  ✗ FAIL:', msg);
    failures++;
  }
}

// Check actual shader instances spawned by the presets, not only catalog keys.
// A missing sampler previously left several effects using an empty texture.
const checkedMaterials = new WeakSet();
const missingSamplers = new Map();
const enhancedMoveIds = new Set();
let checkedShaderMaterials = 0;
function inspectShaderBindings(root, context) {
  root.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const mat of materials) {
      if (!mat?.isShaderMaterial || checkedMaterials.has(mat)) continue;
      checkedMaterials.add(mat);
      checkedShaderMaterials++;
      const erosion = getTexLib().erosionNoise;
      if (mat.uniforms.uErodeTex?.value === erosion || mat.uniforms.uNoiseTex?.value === erosion
          || /float (?:cuttingEdge|filaments|streak|relief|innerVeil)\b/.test(mat.fragmentShader)) {
        enhancedMoveIds.add(context);
      }
      const source = `${mat.vertexShader}\n${mat.fragmentShader}`;
      for (const match of source.matchAll(/uniform\s+(?:(?:lowp|mediump|highp)\s+)?sampler(?:2D|Cube)\s+([^;]+);/g)) {
        for (const declaration of match[1].split(',')) {
          const name = declaration.trim().replace(/\s*\[.*$/, '');
          if (!mat.uniforms[name]?.value?.isTexture) {
            const key = `${context}: ${name}`;
            missingSamplers.set(key, (missingSamplers.get(key) || 0) + 1);
          }
        }
      }
    }
  });
}

{
  const erosion = getTexLib().erosionNoise;
  const { data, width, height } = erosion.image;
  assert(erosion.isDataTexture && width === 256 && height === 256, 'Erosion map must contain real 256x256 texture data');
  assert(erosion.wrapS === THREE.RepeatWrapping && erosion.wrapT === THREE.RepeatWrapping, 'Erosion map must repeat in both axes');
  for (let channel = 0; channel < 3; channel++) {
    let min = 255, max = 0, seam = 0, interior = 0, verticalSeam = 0, verticalInterior = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = data[(y * width + x) * 4 + channel];
        min = Math.min(min, value); max = Math.max(max, value);
        if (x < width - 1) interior += Math.abs(value - data[(y * width + x + 1) * 4 + channel]);
        if (y < height - 1) verticalInterior += Math.abs(value - data[((y + 1) * width + x) * 4 + channel]);
      }
      seam += Math.abs(data[(y * width) * 4 + channel] - data[(y * width + width - 1) * 4 + channel]);
    }
    for (let x = 0; x < width; x++) {
      verticalSeam += Math.abs(data[x * 4 + channel] - data[((height - 1) * width + x) * 4 + channel]);
    }
    assert(max - min > 60, `Erosion channel ${channel} must contain spatial detail`);
    assert(seam / height < interior / (height * (width - 1)) * 2.5 + 2, `Erosion channel ${channel} must not have a horizontal tile seam`);
    assert(verticalSeam / width < verticalInterior / (width * (height - 1)) * 2.5 + 2, `Erosion channel ${channel} must not have a vertical tile seam`);
  }
  const sampleSim = new Sim3D(new THREE.Scene(), 7);
  FX_CONFIG.paletteOverrideActive = false;
  sampleSim.spawnFlipbook({ atlas: 'fbFlame', life: 0.5, emitMicro: false });
  const once = sampleSim.flipbooks[sampleSim.flipbooks.length - 1].mat;
  assert(once.uniforms.uErodeTex.value === erosion && once.uniforms.uLoopFrames.value === 0, 'One-shot flipbook must bind erosion and not loop frames');
  FX_CONFIG.paletteOverrideActive = true;
  sampleSim.spawnFlipbook({ atlas: 'fbFlame', life: 0.5, emitMicro: false, loopFrames: true });
  const loop = sampleSim.flipbooks[sampleSim.flipbooks.length - 1].mat;
  assert(loop.uniforms.uLoopFrames.value === 1 && loop.uniforms.uTextureTint.value === 0, 'Looping flipbook must retain an explicit palette override');
  FX_CONFIG.paletteOverrideActive = false;
  sampleSim.clear();
}

console.log(`Total 3D VFX Presets: ${MOVES_3D.length} across ${CATEGORIES_3D.length - 1} categories`);
assert(MOVES_3D.length === 398, `Expected 398 presets, got ${MOVES_3D.length}`);
assert(MOVES_3D.filter((m) => m.cat === 'chant_ult').length === 0, 'Expected 0 isolated chant_ult presets (chanting is now global!)');
assert(MOVES_3D.filter((m) => m.cat === 'heal_support').length === 16, 'Expected 16 heal_support presets');
assert(MOVES_3D.filter((m) => m.cat === 'summon_zone').length === 14, 'Expected 14 summon_zone presets');
assert(MOVES_3D.filter((m) => m.cat === 'gamedev_algo').length === 10, 'Expected 10 gamedev_algo presets');

// ---------------------------------------------------------------------------
// 1. Release-Phase Timeline, Hitbox, Zero-Sigil Martial Rule & Zero-Leak Check Across All 398 Presets
// ---------------------------------------------------------------------------
const EXPLICIT_MAGIC_ARRAY_IDS = new Set([
  'chant_xianxia_myriad_swords',
  'env_reaper_blood_domain',
  'env_leviathan_maelstrom',
]);
let martialZeroSigilCount = 0;

for (const [idx, mv] of MOVES_3D.entries()) {
  sim.clear();
  sim.setDynamicScaleContext(mv, mv.duration);
  fighter.hitStop = 0;
  fighter.resetSupportHUD();
  allies.forEach((a) => a.reset(0, 0, false));
  mv.setup(fighter, dummies, null, allies);
  const loadout = fighter.loadout;
  const isPhysicalWeapon = loadout !== 'mage_staff' && loadout !== 'unarmed';
  if (isPhysicalWeapon && !EXPLICIT_MAGIC_ARRAY_IDS.has(mv.id)) {
    assert(
      isMartialWeaponMove(mv),
      `[${idx}:${mv.id}] Physical weapon preset (loadout=${loadout}) must be classified as martial/weapon move`
    );
  }
  if (isMartialWeaponMove(mv)) {
    const autoSpec = getEffectiveChantSpec(mv, { ...FX_CONFIG, chantMode: 'auto', chantTimeScale: 1.0 });
    assert(
      !autoSpec.enabled || autoSpec.archetype === 'martial_qi',
      `[${idx}:${mv.id}] Martial/weapon preset in 'auto' mode must use sigil-free 'martial_qi' or instant cast (got ${autoSpec.archetype})`
    );
  }
  const effHb = getEffectiveMoveHitbox(mv);
  const events = mv.buildEvents(sim, fighter, dummies, 7, null, 'auto', allies).map((e) => ({ ...e, fired: false }));

  const dt = 1 / 120;
  let t = 0;
  let maxObservedSlashR = 0;
  let maxObservedWaveR = 0;
  let maxObservedCrystalR = 0;
  let peakActiveCount = 0;
  let spawnedMagicCircle = false;
  let finiteParticles = true;

  while (t <= mv.duration + 0.05) {
    t += dt;
    let firedThisFrame = false;
    for (const ev of events) {
      if (!ev.fired && ev.t <= t + 1e-6) {
        ev.fired = true;
        fighter.applyPose(fighter.sampleKeyframes(mv.keyframes, ev.t));
        ev.run();
        firedThisFrame = true;
      }
    }
    if (fighter.hitStop > 0) fighter.hitStop = Math.max(0, fighter.hitStop - dt);
    else fighter.applyPose(fighter.sampleKeyframes(mv.keyframes, t));

    fighter.updateSupport(dt, cam);
    for (const d of dummies) d.update(dt);
    for (const a of allies) a.update(dt, cam);
    sim.update(dt, cam);
    if (finiteParticles) {
      for (const particle of sim.niagara.items) {
        if (![particle.x, particle.y, particle.z, particle.vx, particle.vy, particle.vz].every(Number.isFinite)) {
          finiteParticles = false;
          assert(false, `[${idx}:${mv.id}] particle position or velocity is not finite`);
          break;
        }
      }
    }
    if (firedThisFrame || Math.abs(t - mv.peakTime) < dt * 0.85
        || Math.abs(t - Math.min(mv.duration - 0.01, mv.peakTime + 0.15)) < dt * 0.85) {
      inspectShaderBindings(sim.root, mv.id);
    }

    if (Math.abs(t - mv.peakTime) < dt * 0.85) {
      peakActiveCount = Math.max(peakActiveCount, sim.activeFxCount);
    }

    for (const c of sim.custom) {
      if (c instanceof Sigil3D || Boolean(c.discEntries)) {
        spawnedMagicCircle = true;
      }
      if (c.o && c.o.radius) {
        const reach = Math.hypot(c.o.center[0], c.o.center[2]) + c.o.radius;
        if (reach > maxObservedSlashR) maxObservedSlashR = reach;
      }
      if (c.maxRadius) {
        if (c.maxRadius > maxObservedWaveR) maxObservedWaveR = c.maxRadius;
      }
    }
    const cx = effHb?.cx ?? 0, cz = effHb?.cz ?? 0;
    for (const cr of sim.crystals) {
      const r = Math.hypot(cr.mesh.position.x - cx, cr.mesh.position.z - cz);
      if (r > maxObservedCrystalR) maxObservedCrystalR = r;
    }
  }

  assert(
    peakActiveCount > 0,
    `[${idx}:${mv.id}] Active VFX at peakTime=${mv.peakTime}s (count=${peakActiveCount})`
  );
  assert(
    sim.activeFxCount === 0 && sim.statusMarks.length === 0,
    `[${idx}:${mv.id}] Zero lingering VFX at end of clip (activeFx=${sim.activeFxCount}, statusMarks=${sim.statusMarks.length})`
  );
  if (isMartialWeaponMove(mv)) {
    assert(
      !spawnedMagicCircle,
      `[${idx}:${mv.id}] Martial/weapon skill (loadout=${loadout}) must spawn ZERO magic circles (Sigil3D / MagicArray3D)`
    );
    martialZeroSigilCount++;
  }

  if (effHb?.kind === 'sector' && maxObservedSlashR > 0) {
    assert(
      maxObservedSlashR <= effHb.radius + 0.04,
      `[${idx}:${mv.id}] Slash outer reach (${maxObservedSlashR.toFixed(2)}m) <= sector radius (${effHb.radius.toFixed(2)}m)`
    );
  }
  if (effHb?.kind === 'circle') {
    if (maxObservedWaveR > 0) {
      assert(
        maxObservedWaveR <= effHb.radius + 0.04,
        `[${idx}:${mv.id}] Shockwave maxRadius (${maxObservedWaveR.toFixed(2)}m) <= circle radius (${effHb.radius.toFixed(2)}m)`
      );
    }
    if (maxObservedCrystalR > 0 && (mv.targetTeam || 'enemy') === 'enemy') {
      assert(
        maxObservedCrystalR <= effHb.radius + 0.05,
        `[${idx}:${mv.id}] Crystal ring radius (${maxObservedCrystalR.toFixed(2)}m) safely inside ${effHb.radius.toFixed(2)}m`
      );
    }
  }

  // Quick override smoke test (palette + texture style)
  sim.clear();
  sim.setDynamicScaleContext(mv, mv.duration);
  mv.setup(fighter, dummies, 'holyGold', allies);
  const ovEvents = mv.buildEvents(sim, fighter, dummies, 11, 'holyGold', 'volt', allies);
  assert(Array.isArray(ovEvents) && ovEvents.length > 0, `[${idx}:${mv.id}] Override buildEvents valid`);
  if (idx < 36 || idx % 45 === 0) {
    console.log(`  ✓ [${String(idx).padStart(3, '0')}] ${mv.cat.padEnd(13)} | ${mv.title} (peakFx=${peakActiveCount})`);
  }
}
console.log(`  ✓ Verified ZERO magic circles (Sigil3D / MagicArray3D) across all ${martialZeroSigilCount} weapon & martial skills!`);

// ---------------------------------------------------------------------------
// 2. Global On-Caster Chanting & Strict Pre-Release Causality Verification!
// ---------------------------------------------------------------------------
console.log(`\nChecking Global On-Caster Chanting (${CHANT_MODES_META.length} modes) & Strict Pre-Release Causality...`);
{
  // (A) Casted Ultimate Spell: 0 attacks during chant, full release strictly after chantDur!
  FX_CONFIG.chantMode = 'auto';
  FX_CONFIG.chantTimeScale = 1.0;
  const rayMv = MOVES_3D.find((m) => m.id === 'chant_seraph_judgment_ray');
  let dummyHitCount = 0;
  const origHits = dummies.map((d) => d.hit.bind(d));
  dummies.forEach((d, i) => {
    d.hit = (opts) => {
      dummyHitCount++;
      return origHits[i](opts);
    };
  });

  const sessA = createChantAwareSession({ mv: rayMv, sim, fighter, dummies, allies, seed: 7 });
  assert(sessA.chantDur >= 1.5, `chant_seraph_judgment_ray has pre-release chantDur=${sessA.chantDur.toFixed(2)}s`);
  const dt = 1 / 60;
  while (sessA.currentTime + dt < sessA.chantDur * 0.94) {
    sessA.step(dt, cam);
  }
  const hasCasterArray = sim.custom.some((c) => c.discEntries && Math.hypot(c.group.position.x, c.group.position.z) < 0.5);
  assert(dummyHitCount === 0, `ZERO dummy hits allowed before chanting finishes (got ${dummyHitCount} at t=${sessA.currentTime.toFixed(2)}s / ${sessA.chantDur.toFixed(2)}s)`);
  assert(hasCasterArray, 'Caster chanting magic array is anchored on fighter at (0, 0) during chant phase');
  const hasDistantVfx =
    sim.fireRocks.length > 0 ||
    sim.rockDebris.length > 0 ||
    sim.crystals.length > 0 ||
    sim.bolts.length > 0 ||
    sim.flipbooks.some((fb) => fb.z > 2.5) ||
    sim.custom.some((c) => c.group && c.group.position.z > 2.5);
  assert(!hasDistantVfx, 'Zero outgoing projectiles, beams or target ground zones beyond z > 2.5m during chant phase');

  // Step past chant completion into release climax
  while (sessA.currentTime < sessA.chantDur + 0.35) {
    sessA.step(dt, cam);
  }
  assert(dummyHitCount > 0, `Dummy hits fire cleanly AFTER chant completes (hits=${dummyHitCount})`);

  // (B) Melee Skill (`melee_whirlwind`) with explicit Global Chant Mode (`martial_qi`)!
  dummyHitCount = 0;
  FX_CONFIG.chantMode = 'martial_qi';
  const meleeMv = MOVES_3D.find((m) => m.id === 'melee_whirlwind');
  const sessB = createChantAwareSession({ mv: meleeMv, sim, fighter, dummies, allies, seed: 7 });
  assert(sessB.chantDur >= 0.8, `Global chantMode='martial_qi' enables pre-release chanting on melee skill melee_whirlwind (${sessB.chantDur.toFixed(2)}s)`);
  let martialChantSpawnedCircle = false;
  while (sessB.currentTime + dt < sessB.chantDur * 0.95) {
    sessB.step(dt, cam);
    if (sim.custom.some((c) => c instanceof Sigil3D || Boolean(c.discEntries))) martialChantSpawnedCircle = true;
  }
  assert(dummyHitCount === 0, `melee_whirlwind with martial_qi chant holds ALL sword strikes until chant completes (hits=${dummyHitCount})`);
  assert(!martialChantSpawnedCircle, 'melee_whirlwind with martial_qi chant spawns ZERO Sigil3D/MagicArray3D during stance windup');
  while (sessB.currentTime < sessB.chantDur + 0.55) {
    sessB.step(dt, cam);
    if (sim.custom.some((c) => c instanceof Sigil3D || Boolean(c.discEntries))) martialChantSpawnedCircle = true;
  }
  assert(dummyHitCount > 0, `melee_whirlwind releases sword strikes after martial_qi chant completes (hits=${dummyHitCount})`);
  assert(!martialChantSpawnedCircle, 'melee_whirlwind with martial_qi chant spawns ZERO Sigil3D/MagicArray3D during release');

  // (C) Instant mode (`chantMode = 'none'`)
  FX_CONFIG.chantMode = 'none';
  assert(getEffectiveChantSpec(rayMv).duration === 0, `chantMode='none' yields 0.00s instant cast`);

  dummies.forEach((d, i) => { d.hit = origHits[i]; });
  FX_CONFIG.chantMode = 'auto';
  FX_CONFIG.chantTimeScale = 1.0;
}

// ---------------------------------------------------------------------------
// 3. Healing, Shielding, Resurrection & Cleanse Support Skills Verification!
// ---------------------------------------------------------------------------
console.log('Checking Self, Single-Ally, Resurrection, Cleanse & Full-Party Support Skills...');
{
  const runFullSession = (moveId) => {
    const mv = MOVES_3D.find((m) => m.id === moveId);
    assert(Boolean(mv), `Found support preset ${moveId}`);
    const sess = createChantAwareSession({ mv, sim, fighter, dummies, allies, seed: 19 });
    const dt = 1 / 60;
    while (sess.currentTime < sess.totalDuration) sess.step(dt, cam);
  };

  // Self heal
  runFullSession('sup_self_emerald_vitality');
  assert(fighter.statusBar.hpFrac > 0.85, `Self heal restores fighter HP (${fighter.statusBar.hpFrac.toFixed(2)})`);

  // Fallen Ally Resurrection
  const resMv = MOVES_3D.find((m) => m.id === 'sup_ally_seraph_resurrection');
  const resSess = createChantAwareSession({ mv: resMv, sim, fighter, dummies, allies, seed: 21 });
  assert(allies[0].fallen === true && allies[0].statusBar.hpFrac < 0.05, 'Ally[0] starts fallen before resurrection');
  while (resSess.currentTime < resSess.totalDuration) resSess.step(1 / 60, cam);
  assert(allies[0].fallen === false && allies[0].statusBar.hpFrac >= 0.70, `Resurrection revives fallen Ally[0] (hp=${allies[0].statusBar.hpFrac.toFixed(2)})`);

  // Curse Cleanse
  const clnMv = MOVES_3D.find((m) => m.id === 'sup_ally_jade_cleanse_purify');
  const clnSess = createChantAwareSession({ mv: clnMv, sim, fighter, dummies, allies, seed: 23 });
  assert(allies[1].cursed === true, 'Ally[1] starts cursed before cleanse');
  while (clnSess.currentTime < clnSess.totalDuration) clnSess.step(1 / 60, cam);
  assert(allies[1].cursed === false && allies[1].statusBar.shieldFrac > 0.10, 'Jade Cleanse shatters curse chains & grants ward shield');

  // Full-Party Sanctuary & Citadel Overshield
  runFullSession('sup_party_world_tree_sanctuary');
  assert(
    fighter.statusBar.hpFrac > 0.90 && allies.every((a) => a.statusBar.hpFrac > 0.85),
    'World Tree Sanctuary heals both caster and all 3 party allies'
  );
  runFullSession('sup_party_hex_citadel_barrier');
  assert(
    fighter.statusBar.shieldFrac >= 0.45 && allies.every((a) => a.statusBar.shieldFrac >= 0.45),
    'Hex Citadel Barrier grants heavy Overshield to caster and all 3 party allies'
  );
}

// ---------------------------------------------------------------------------
// 4. Widened Cast Distance (6.3m~9.8m @ 1.0x, up to 3.0x Range Slider) & 24 BMesh Models
// ---------------------------------------------------------------------------
console.log('Checking Widened Cast Distances (up to 3.0x), 66 AI Textures & 24 BMesh 3D Geometry Assets...');
for (const rId of ['spl_grand_fireball_salvo', 'env_sustained_meteor_rain', 'chant_seraph_judgment_ray', 'sum_inferno_dragon_king']) {
  const mv = MOVES_3D.find((m) => m.id === rId);
  const hb1 = getEffectiveMoveHitbox(mv);
  assert((hb1.cz || hb1.length) >= 6.3, `[${rId}] Widened 1.0x engagement distance >= 6.3m (got ${hb1.cz || hb1.length}m)`);
}

{
  FX_CONFIG.rangeScale = 2.60;
  FX_CONFIG.aoeScale = 1.45;
  const fbMv = MOVES_3D.find((m) => m.id === 'spl_grand_fireball_salvo');
  sim.clear();
  sim.setDynamicScaleContext(fbMv, fbMv.duration);
  fbMv.setup(fighter, dummies, null, allies);
  const effRange = getEffectiveRangeScale(fbMv, FX_CONFIG.rangeScale);
  const [wx, wz] = mapHitboxPointXZ(fbMv.hitbox, dummies[0].homeX, dummies[0].homeZ, FX_CONFIG.aoeScale, effRange);
  dummies[0].setWorldPosition(wx, wz);
  const [simMappedX, simMappedZ] = sim.mapSkillXZ(dummies[0].homeX, dummies[0].homeZ);
  assert(
    wz > 15.0 && Math.hypot(simMappedX - wx, simMappedZ - wz) < 1e-4,
    `Long-range 2.60x slider maps spl_grand_fireball_salvo cleanly to ${wz.toFixed(2)}m with ZERO double-scaling`
  );
  FX_CONFIG.rangeScale = 1.0;
  FX_CONFIG.aoeScale = 1.0;
}

assert(AI_TEXTURE_CATALOG.length === 66, `Expected 66 AI textures, got ${AI_TEXTURE_CATALOG.length}`);
for (const tex of AI_TEXTURE_CATALOG) {
  assert(Boolean(TEX_CONFIG[tex.key]), `Missing TEX_CONFIG for ${tex.key}`);
  assert(typeof BAKED_AI_TEXTURES[tex.key] === 'string' && BAKED_AI_TEXTURES[tex.key].startsWith('data:image/webp;base64,'), `Missing baked webp for ${tex.key}`);
}

assert(MESH_GALLERY_ITEMS.length === 24, `Expected 24 BMesh 3D Geometry Assets, got ${MESH_GALLERY_ITEMS.length}`);
for (const item of MESH_GALLERY_ITEMS) {
  const pal = PAL3D[item.defaultPal] || PAL3D.holyGold;
  const asm = item.build(pal);
  let verts = 0, tris = 0;
  asm.group.traverse((o) => {
    if ((o.isMesh || o.isInstancedMesh) && o.geometry?.attributes?.position) {
      verts += o.geometry.attributes.position.count;
      tris += o.geometry.index ? Math.floor(o.geometry.index.count / 3) : Math.floor(o.geometry.attributes.position.count / 3);
    }
  });
  inspectShaderBindings(asm.group, `prop:${item.id}`);
  asm.update?.(0.12);
  asm.dispose?.();
  assert(verts > 0 && tris > 0, `3D Geometry Asset [${item.id}] must have positive verts/tris (got ${verts}/${tris})`);
}

// ---------------------------------------------------------------------------
// 5. Universal 3D VFX Export Pipeline (.GLB + .OBJ + .WEBP + .ZIP) Verification!
// ---------------------------------------------------------------------------
console.log('Checking Universal 3D VFX Export Pipeline (.GLB Khronos v2 + TRS Animations + PKZIP)...');
{
  const parseGlbHeader = (u8) => {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const magic = dv.getUint32(0, true);
    const version = dv.getUint32(4, true);
    const totalLen = dv.getUint32(8, true);
    const jsonLen = dv.getUint32(12, true);
    const jsonType = dv.getUint32(16, true);
    const jsonStr = new TextDecoder().decode(u8.subarray(20, 20 + jsonLen));
    const binType = dv.getUint32(20 + jsonLen + 4, true);
    return { magic, version, totalLen, jsonType, binType, gltf: JSON.parse(jsonStr) };
  };

  // (A) Animated VFX Skill Package
  const expMove = MOVES_3D.find((m) => m.id === 'chant_seraph_judgment_ray');
  const skillPkg = exportVfxPackage({ move: expMove, fps: 24, includeActors: true });
  const zipDv = new DataView(skillPkg.zipBytes.buffer, skillPkg.zipBytes.byteOffset, skillPkg.zipBytes.byteLength);
  assert(zipDv.getUint32(0, true) === 0x04034b50, 'Exported skill .zip starts with valid PKZIP signature 0x04034b50');
  const parsedSkillGlb = parseGlbHeader(skillPkg.glbBytes);
  assert(
    parsedSkillGlb.magic === 0x46546C67 &&
    parsedSkillGlb.version === 2 &&
    parsedSkillGlb.jsonType === 0x4E4F534A &&
    parsedSkillGlb.binType === 0x004E4942,
    'Animated skill .glb has valid Khronos glTF 2.0 header, JSON chunk & BIN chunk'
  );
  assert(
    parsedSkillGlb.gltf.animations?.length === 1 &&
    parsedSkillGlb.gltf.animations[0].channels.length > 20 &&
    parsedSkillGlb.gltf.meshes.length > 5 &&
    skillPkg.manifest.textures.length > 0,
    `Animated skill .glb contains ${parsedSkillGlb.gltf.animations?.[0]?.channels?.length} TRS animation channels, ${parsedSkillGlb.gltf.meshes.length} meshes & ${skillPkg.manifest.textures.length} embedded .webp textures`
  );

  // (B) Standalone BMesh 3D Prop Package
  const propPkg = exportVfxPackage({ propId: 'world_tree_staff' });
  const parsedPropGlb = parseGlbHeader(propPkg.glbBytes);
  assert(
    parsedPropGlb.magic === 0x46546C67 && parsedPropGlb.gltf.meshes.length > 0 && propPkg.stats.tris > 400,
    `Exported BMesh prop world_tree_staff.glb valid (${propPkg.stats.verts} verts / ${propPkg.stats.tris} tris)`
  );
}

// Keep MagicArray3D, Charge Variants & 10 GameDev Algorithms regression checks
for (const kind of ['layered', 'qimen_square', 'satellite', 'vertical_cannon', 'talisman_seal', 'sword_lotus', 'sequential_chant']) {
  const arr = new MagicArray3D({
    x: 0, y: 0.02, z: 3.0, radius: 2.4, duration: 2.6,
    tradition: kind === 'qimen_square' || kind === 'talisman_seal' || kind === 'sword_lotus' ? 'eastern' : 'western',
    arrayKind: kind, layers: 4, chantDuration: kind === 'sequential_chant' ? 1.6 : 0,
  });
  arr.update(0.35);
  assert(arr.discEntries.some((d) => d.mesh.visible), `MagicArray3D [${kind}] renders visible discs`);
  arr.dispose();
}

const variantKeys = CHARGE_VARIANTS_META.filter((v) => v.id !== 'auto').map((v) => v.id);
assert(variantKeys.length === 8, `Expected 8 distinct charge variants, got ${variantKeys.length}`);

const blocked = new Set([5 * 10 + 5, 5 * 10 + 4, 5 * 10 + 6]);
const astarPath = findPathAStarOctile(10, 10, blocked, [5, 1], [5, 8]);
assert(astarPath.length > 6 && !astarPath.some(([c, r]) => blocked.has(r * 10 + c)), 'Binary-Heap Octile A* avoids obstacle wall');
const ccdHit = sweptSegmentSphereHit(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 10), new THREE.Vector3(0, 1, 5), 0.5);
assert(Boolean(ccdHit) && Math.abs(ccdHit.point.z - 4.5) < 1e-3, 'Swept-segment CCD catches fast projectile without tunneling');
const [ssx, ssy, ssz] = computeSquashStretch3D(12.0, 0.14);
assert(Math.abs(ssx * ssy * ssz - 1.0) < 1e-4, 'Squash & Stretch preserves 3D volume');
const tShake = new TraumaCameraShake3D(7);
tShake.add(0.6);
tShake.step(0.1);
assert(tShake.trauma > 0.4 && tShake.trauma < 0.6, 'Trauma^2 camera shake decays smoothly');
const bp0 = new THREE.Vector3(0, 1, 0), bp1 = new THREE.Vector3(-4, 6, 1), bp2 = new THREE.Vector3(3, 5, 4), bp3 = new THREE.Vector3(0, 1, 6);
const lut = buildBezierArcLengthLUT(bp0, bp1, bp2, bp3, 64);
assert(Math.abs(lut.sampleAtArcFraction(0.25).distanceTo(lut.sampleAtArcFraction(0.50)) - lut.sampleAtArcFraction(0.50).distanceTo(lut.sampleAtArcFraction(0.75))) < 0.25, 'Cubic Bezier Arc-Length LUT constant speed');
const eps = 1e-3, px = 1.3, py = 2.1, pz = -0.7, ct = 0.8;
const dVx = (evalDivergenceFreeCurl3D(px + eps, py, pz, ct)[0] - evalDivergenceFreeCurl3D(px - eps, py, pz, ct)[0]) / (2 * eps);
const dVy = (evalDivergenceFreeCurl3D(px, py + eps, pz, ct)[1] - evalDivergenceFreeCurl3D(px, py - eps, pz, ct)[1]) / (2 * eps);
const dVz = (evalDivergenceFreeCurl3D(px, py, pz + eps, ct)[2] - evalDivergenceFreeCurl3D(px, py, pz - eps, ct)[2]) / (2 * eps);
assert(Math.abs(dVx + dVy + dVz) < 0.02, '3D Curl Noise divergence-free');

FX_CONFIG.tier = 4;
FX_CONFIG.aoeScale = 1.0;
FX_CONFIG.rangeScale = 1.0;

// ---------------------------------------------------------------------------
// 6. All-398-Skill Animation Playback & VFX Release Frame-Accurate Sync Audit
// ---------------------------------------------------------------------------
console.log('\nChecking All-398-Skill Animation Playback <-> Skill VFX Release Synchronization (Instant + Chanted)...');
{
  const hasDistantSceneVfx = (zLimit = 2.25) => (
    sim.fireRocks.some((r) => r.mesh.position.z > zLimit) ||
    sim.rockDebris.some((r) => r.mesh.position.z > zLimit) ||
    sim.crystals.some((c) => c.mesh.position.z > zLimit) ||
    sim.bolts.some((b) => {
      const pos = b.line?.geometry?.attributes?.position;
      if (!pos) return false;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getZ(i) > zLimit) return true;
      }
      return false;
    }) ||
    sim.flipbooks.some((fb) => fb.z > zLimit) ||
    sim.custom.some((c) => {
      const gz = c.group?.position?.z ?? c.mesh?.position?.z ?? c.o?.z ?? c.z ?? 0;
      return gz > zLimit;
    })
  );

  const poseDeviationFromRest = (pose) => {
    let maxDiff = 0;
    for (const [k, v] of Object.entries(REST_POSE)) {
      if (k === 'x' || k === 'y' || k === 'z') continue;
      maxDiff = Math.max(maxDiff, Math.abs((pose[k] ?? 0) - v));
    }
    return maxDiff;
  };

  let dummyHits = 0;
  const origDummyHits = dummies.map((d) => d.hit.bind(d));
  dummies.forEach((d, idx) => {
    d.hit = (opts) => {
      dummyHits++;
      return origDummyHits[idx](opts);
    };
  });

  const prevGroundLinger = FX_CONFIG.groundLingerScale;
  FX_CONFIG.groundLingerScale = 1.0;

  for (const [idx, mv] of MOVES_3D.entries()) {
    // --- (A) Instant Mode (chantDur = 0) ---
    FX_CONFIG.chantMode = 'none';
    FX_CONFIG.chantTimeScale = 1.0;
    dummyHits = 0;
    const instSess = createChantAwareSession({ mv, sim, fighter, dummies, allies, seed: 7 });
    const initHp = fighter.statusBar.hpFrac;
    const initSh = fighter.statusBar.shieldFrac;
    const initAllyHp = allies.map((a) => a.statusBar.hpFrac);
    const initAllySh = allies.map((a) => a.statusBar.shieldFrac);

    const nonChantEvs = instSess.scheduledEvents.filter((e) => !e.isChantEvent && !e.isPreGather);
    if (nonChantEvs.length > 0) {
      const firstOutT = nonChantEvs[0].t;
      assert(
        Math.abs(instSess.releaseT - firstOutT) <= 0.026,
        `[InstantSync ${idx}:${mv.id}] releaseT=${instSess.releaseT.toFixed(3)}s vs firstOutEv=${firstOutT.toFixed(3)}s (>0.025s)`
      );
    }

    const kfs = mv.keyframes || [];
    if (kfs.length > 1) {
      const minKfDist = Math.min(...kfs.map((k) => Math.abs(k.t - instSess.releaseT)));
      assert(
        minKfDist <= 0.026,
        `[InstantKfSync ${idx}:${mv.id}] No keyframe within 25ms of releaseT=${instSess.releaseT.toFixed(3)}s (nearest dist=${minKfDist.toFixed(3)}s)`
      );
    }

    const dt = 1 / 120;
    const preInstantLimit = Math.max(0, instSess.releaseT - 0.025);
    while (instSess.currentTime + dt <= preInstantLimit) {
      instSess.step(dt, cam);
    }
    if (preInstantLimit >= 0.02) {
      const allyChanged = allies.some((a, i) => (
        a.statusBar.hpFrac > initAllyHp[i] + 1e-4 || a.statusBar.shieldFrac > initAllySh[i] + 1e-4
      )) || fighter.statusBar.hpFrac > initHp + 1e-4 || fighter.statusBar.shieldFrac > initSh + 1e-4;
      assert(
        dummyHits === 0 && !allyChanged && !hasDistantSceneVfx(2.25),
        `[InstantPreRelease ${idx}:${mv.id}] Premature hit/support/distant-VFX at t=${instSess.currentTime.toFixed(3)}s before releaseT=${instSess.releaseT.toFixed(3)}s (hits=${dummyHits}, allyChanged=${allyChanged}, distantVfx=${hasDistantSceneVfx(2.25)})`
      );
    }

    // --- (B) Chanted Mode (chantDur > 0 across 100% of all 452 skills!) ---
    FX_CONFIG.chantMode = 'auto';
    if (!getEffectiveChantSpec(mv, FX_CONFIG).enabled) {
      FX_CONFIG.chantMode = 'martial_qi';
    }
    dummyHits = 0;
    const chantSess = createChantAwareSession({ mv, sim, fighter, dummies, allies, seed: 7 });
    const cInitHp = fighter.statusBar.hpFrac;
    const cInitSh = fighter.statusBar.shieldFrac;
    const cInitAllyHp = allies.map((a) => a.statusBar.hpFrac);
    const cInitAllySh = allies.map((a) => a.statusBar.shieldFrac);

    assert(
      chantSess.chantDur > 0 && Math.abs(chantSess.releaseGlobalT - chantSess.chantDur) <= 0.025,
      `[ChantReleaseSync ${idx}:${mv.id}] CastBar 100% chantDur=${chantSess.chantDur.toFixed(3)}s !== releaseGlobalT=${chantSess.releaseGlobalT.toFixed(3)}s`
    );

    const prePhaseLimit = Math.max(0, (chantSess.chantPhaseEndT ?? chantSess.chantDur) - 0.015);
    while (chantSess.currentTime + dt <= prePhaseLimit) {
      chantSess.step(dt, cam);
    }
    assert(
      Math.abs(fighter.root.position.x) <= 0.25 && Math.abs(fighter.root.position.z) <= 0.25,
      `[ChantAnchor ${idx}:${mv.id}] Fighter drifted off (0,0) during chant phase: (${fighter.root.position.x.toFixed(2)}, ${fighter.root.position.z.toFixed(2)})`
    );

    const preChantLimit = Math.max(0, chantSess.chantDur - 0.025);
    let chantCircleSpawned = false;
    while (chantSess.currentTime + dt <= preChantLimit) {
      chantSess.step(dt, cam);
      if (sim.custom.some((c) => c instanceof Sigil3D || Boolean(c.discEntries))) chantCircleSpawned = true;
    }
    if (isMartialWeaponMove(mv)) {
      assert(
        !chantCircleSpawned,
        `[MartialChantNoSigil ${idx}:${mv.id}] Martial/weapon skill spawned a magic circle during chant phase`
      );
    }
    const cAllyChanged = allies.some((a, i) => (
      a.statusBar.hpFrac > cInitAllyHp[i] + 1e-4 || a.statusBar.shieldFrac > cInitAllySh[i] + 1e-4
    )) || fighter.statusBar.hpFrac > cInitHp + 1e-4 || fighter.statusBar.shieldFrac > cInitSh + 1e-4;

    const maxPreReleaseZ = chantSess.isTakeoffRelease ? 0.25 : 0.85;
    assert(
      Math.abs(fighter.root.position.x) <= 0.35 && Math.abs(fighter.root.position.z) <= maxPreReleaseZ,
      `[ChantLungeBound ${idx}:${mv.id}] Fighter moved too far before chantDur: (${fighter.root.position.x.toFixed(2)}, ${fighter.root.position.z.toFixed(2)}) > ${maxPreReleaseZ}m`
    );
    assert(
      dummyHits === 0 && !cAllyChanged && !hasDistantSceneVfx(2.25),
      `[ChantCausality ${idx}:${mv.id}] Premature hit/support/distant-VFX during chant at t=${chantSess.currentTime.toFixed(3)}s/${chantSess.chantDur.toFixed(3)}s (hits=${dummyHits}, support=${cAllyChanged}, distantVfx=${hasDistantSceneVfx(2.25)})`
    );

    // Verify C^0 trajectory continuity across chantDur (zero 1-frame snap & non-REST release pose)
    const poseBefore = chantSess.samplePoseAt(Math.max(0, chantSess.chantDur - 0.001));
    const poseAtRel = chantSess.samplePoseAt(chantSess.chantDur);
    const poseAfter = chantSess.samplePoseAt(chantSess.chantDur + 0.001);
    assert(
      Math.abs((poseAfter.z ?? 0) - (poseBefore.z ?? 0)) <= 0.35 && Math.abs((poseAfter.y ?? 0) - (poseBefore.y ?? 0)) <= 0.35,
      `[ChantContinuity ${idx}:${mv.id}] Root position snapped across chantDur: before=(${(poseBefore.y ?? 0).toFixed(2)},${(poseBefore.z ?? 0).toFixed(2)}) after=(${(poseAfter.y ?? 0).toFixed(2)},${(poseAfter.z ?? 0).toFixed(2)})`
    );
    assert(
      poseDeviationFromRest(poseAtRel) >= 0.12,
      `[ChantPoseActive ${idx}:${mv.id}] Fighter dropped to REST_POSE at release moment t=${chantSess.chantDur.toFixed(3)}s (dev=${poseDeviationFromRest(poseAtRel).toFixed(3)})`
    );
  }

  dummies.forEach((d, idx) => { d.hit = origDummyHits[idx]; });
  FX_CONFIG.chantMode = 'auto';
  FX_CONFIG.chantTimeScale = 1.0;
  FX_CONFIG.groundLingerScale = prevGroundLinger;
}

for (const [binding, count] of missingSamplers) {
  assert(false, `Missing shader texture binding: ${binding} (${count} material instances)`);
}
console.log(`  Checked texture bindings on ${checkedShaderMaterials} spawned shader materials.`);
const withoutEnhancedMaterials = MOVES_3D.filter((mv) => !enhancedMoveIds.has(mv.id));
console.log(`  Modified shared shader/erosion materials observed in ${MOVES_3D.length - withoutEnhancedMaterials.length}/${MOVES_3D.length} preset timelines at sampled events and peaks.`);
if (withoutEnhancedMaterials.length) console.log(`  No modified material observed for: ${withoutEnhancedMaterials.map((mv) => mv.id).join(', ')}`);
console.log('  ✓ Global Chanting + 398-Skill Frame-Accurate Anim/VFX Sync + Support/Heal + Widened Range + 24 BMesh Models + .GLB/.ZIP Exporter ALL VERIFIED!');

if (failures > 0) {
  console.error(`\nFAILED with ${failures} issue(s).`);
  process.exit(1);
} else {
  console.log(`\nALL ${MOVES_3D.length} 3D VFX PRESETS PASSED TIMELINE, CHANT CAUSALITY, SUPPORT & EXPORT CHECKS!`);
}
