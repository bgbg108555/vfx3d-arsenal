import * as THREE from 'three';
import {
  TAU, clamp, lerp, smooth, ease, Rng, PAL3D, rampToColors,
  SlashArc3D, GroundWave3D, RibbonTrail3D, BeamCylinder3D, VortexFunnel3D, FX_CONFIG,
} from './core3d.js';
import { REST_POSE } from './actors3d.js';
import { makeVaporMaterial } from './vapor3d.js';

export function resolvePal(defaultKey, overrideKey) {
  const key = overrideKey && PAL3D[overrideKey] ? overrideKey : defaultKey;
  const pal = PAL3D[key] || PAL3D.warriorSilver;
  return {
    pal,
    midHex: pal[4],
    hotHex: pal[5],
    edgeHex: pal[2],
    deepHex: pal[1],
  };
}

export const SHIELD_GUARD = {
  shLPitch: -0.72, shLYaw: 0.46, shLRoll: 0.14, elLPitch: -0.82, wrLPitch: 0,
};

// Clean reusable cast & combat keyframe generators ("人物動畫有配合就好，重點放特效完整表演")
export function makeStaffCastKeyframes(windupT = 0.25, fireT = 0.36, endT = 1.8) {
  return [
    { t: 0.00, pose: { ...REST_POSE, shRPitch: -0.95, elRPitch: -0.45, wrRPitch: 0.25 } },
    { t: windupT, ease: ease.inOutCubic, pose: {
      crouch: 0.08, torsoPitch: -0.10, torsoYaw: -0.24,
      shRPitch: -1.45, shRYaw: -0.22, elRPitch: -0.25, wrRPitch: 0.12,
      shLPitch: -1.15, shLYaw: 0.35, elLPitch: -0.55,
    }},
    { t: fireT, ease: ease.outExpo, pose: {
      crouch: 0.12, torsoPitch: 0.18, torsoYaw: 0.18,
      shRPitch: -0.82, shRYaw: 0.12, elRPitch: -0.16, wrRPitch: 0.58,
      shLPitch: -0.95, shLYaw: -0.25, elLPitch: -0.35, capePitch: 0.52,
    }},
    { t: endT * 0.72, ease: ease.inOutCubic, pose: {
      crouch: 0.06, torsoPitch: 0.08, shRPitch: -0.92, elRPitch: -0.35, wrRPitch: 0.35,
    }},
    { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE, shRPitch: -0.95, elRPitch: -0.45, wrRPitch: 0.25 } },
  ];
}

export function makeSkyChantKeyframes(chantT = 0.30, slamT = 0.48, endT = 2.0) {
  return [
    { t: 0.00, pose: { ...REST_POSE } },
    { t: chantT, ease: ease.inOutCubic, pose: {
      crouch: 0.06, torsoPitch: -0.18, headPitch: -0.28,
      shRPitch: -2.35, shRYaw: -0.35, elRPitch: -0.18,
      shLPitch: -2.35, shLYaw: 0.35, elLPitch: -0.18, capePitch: 0.45,
    }},
    { t: slamT, ease: ease.outExpo, pose: {
      crouch: 0.16, torsoPitch: 0.22,
      shRPitch: -1.15, shRYaw: 0.18, elRPitch: -0.20,
      shLPitch: -1.15, shLYaw: -0.18, elLPitch: -0.20, capePitch: 0.62,
    }},
    { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE } },
  ];
}

export function makeSkyLeapKeyframes(jumpT = 0.28, apexT = 0.62, landT = 0.86, targetZ = 3.2, endT = 2.45) {
  const takeoffT = +(Math.min(0.14, jumpT * 0.5)).toFixed(3);
  return [
    { t: 0.00, pose: { ...REST_POSE, y: 0, z: 0, crouch: 0.22, torsoPitch: 0.20 } },
    { t: takeoffT, ease: ease.inCubic, pose: { ...REST_POSE, y: 0, z: 0, crouch: 0.34, torsoPitch: 0.28, shRPitch: -0.95, shLPitch: -0.85, capePitch: 0.45 } },
    { t: jumpT, ease: ease.outQuad, pose: { ...REST_POSE, y: 2.85, z: targetZ * 0.45, torsoPitch: -0.25, shRPitch: -2.25, shLPitch: -1.85, hipRPitch: -0.45, kneeRPitch: 0.85, capePitch: 0.92 } },
    { t: apexT, ease: ease.inOutSine, pose: { ...REST_POSE, y: 3.65, z: targetZ * 0.82, torsoPitch: -0.15, shRPitch: -2.45, shLPitch: -2.05, capePitch: 1.05 } },
    { t: landT, ease: ease.inExpo, pose: { ...REST_POSE, y: 0.0, z: targetZ, crouch: 0.32, torsoPitch: 0.36, shRPitch: -0.85, shLPitch: -0.95, capePitch: 0.78 } },
    { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE } },
  ];
}

export function makeRushChargeKeyframes(rushStart = 0.22, rushEnd = 0.56, targetZ = 4.2, endT = 2.25) {
  return [
    { t: 0.00, pose: { ...REST_POSE, ...SHIELD_GUARD, z: 0, crouch: 0.24, torsoPitch: 0.22 } },
    { t: rushStart, ease: ease.inCubic, pose: { ...REST_POSE, ...SHIELD_GUARD, z: 0, crouch: 0.30, torsoPitch: 0.28 } },
    { t: rushEnd, ease: ease.outExpo, pose: { ...REST_POSE, ...SHIELD_GUARD, z: targetZ, crouch: 0.20, torsoPitch: 0.32, shRPitch: -1.35, capePitch: 0.92 } },
    { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE, ...SHIELD_GUARD } },
  ];
}

// Sharp angular tapered 3D prism along a polyline
export function buildTaperedPrismGeo(pts, radStart, radPeak, radEnd, yFlatten = 1.0) {
  const sides = 4;
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const u = i / Math.max(1, pts.length - 1);
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dir = next.clone().sub(prev);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    const upRef = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const sA = new THREE.Vector3().crossVectors(dir, upRef).normalize();
    const sB = new THREE.Vector3().crossVectors(dir, sA).normalize();

    const r = u < 0.35
      ? lerp(radStart, radPeak, u / 0.35)
      : lerp(radPeak, radEnd, (u - 0.35) / 0.65);

    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * TAU;
      const cs = Math.cos(a) * r;
      const sn = Math.sin(a) * r * yFlatten;
      pos.push(
        p.x + sA.x * cs + sB.x * sn,
        p.y + sA.y * cs + sB.y * sn,
        p.z + sA.z * cs + sB.z * sn
      );
    }
    if (i < pts.length - 1) {
      for (let s = 0; s < sides; s++) {
        const ns = (s + 1) % sides;
        const a = i * sides + s, b = i * sides + ns;
        const c = (i + 1) * sides + s, d = (i + 1) * sides + ns;
        idx.push(a, c, b, b, c, d);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
}

// Asymmetric Tectonic Jagged 3D Ground Fissures + Multi-Texture Spliced Crater Bed + Basalt Spikes
export function spawnGroundCracks(sim, arg2 = {}, arg3 = undefined) {
  const hasRng = arg2 && typeof arg2.range === 'function';
  const opts = (hasRng ? arg3 : arg2) || {};
  const R = hasRng ? arg2 : (opts.seed != null ? new Rng(opts.seed) : sim.R);
  const cx = opts.cx ?? opts.x ?? 0;
  const cz = opts.cz ?? opts.z ?? 0;
  let maxRadius = opts.maxRadius ?? 3.4;
  const branches = opts.branches ?? 8;
  let life = opts.life ?? opts.duration ?? 0.8;
  const palette = opts.palette ?? PAL3D.warriorGold;
  const rockCount = opts.rockCount ?? 10;
  const rockScale = opts.rockScale ?? 1.0;
  if (sim._clipMaxDuration > 0) {
    const maxRem = sim._clipMaxDuration - (sim._simTime || 0) - 0.04;
    if (maxRem > 0.12) life = Math.min(life, maxRem);
  }
  const [mcx, mcz] = sim.mapSkillXZ ? sim.mapSkillXZ(cx, cz, Boolean(opts._mapped)) : [cx, cz];
  const aoeMul = opts._mapped ? 1.0 : (sim.getAoeScale ? sim.getAoeScale() : 1.0);
  maxRadius *= aoeMul;

  // Underlying procedural multi-texture Voronoi tectonic scar (non-circular jagged fault bed!)
  if (sim.spawnGroundZone && life >= 0.30) {
    sim.spawnGroundZone({
      x: mcx, z: mcz, _mapped: true,
      radius: maxRadius * 0.80,
      duration: life * 0.95,
      kind: 'crater',
      palette,
      emitFlames: false,
      eruptRocks: false,
      stretchX: R.range(0.80, 1.24),
      stretchZ: R.range(0.80, 1.24),
      yaw: R.range(0, TAU),
    });
  }

  const g = new THREE.Group();
  g.position.set(mcx, 0.018, mcz);
  const ramp = rampToColors(palette, 7);
  const geos = [], mats = [];

  const matCore = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.55),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const matGlow = new THREE.MeshBasicMaterial({
    color: ramp[2].clone().multiplyScalar(1.42),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  mats.push(matCore, matGlow);

  // Asymmetric fault clusters & wildly varying branch reach so fissures NEVER form a neat circular wheel!
  const domAxis = R.range(0, TAU);
  for (let i = 0; i < branches; i++) {
    const baseAng = (i / branches) * TAU + R.range(-0.36, 0.36);
    const axisBias = 0.72 + 0.36 * Math.abs(Math.cos(baseAng - domAxis));
    const rStart = R.range(0.10, 0.32);
    const len = R.range(maxRadius * 0.42, maxRadius * 0.98) * axisBias;
    const segs = 7;
    const pts = [new THREE.Vector3(Math.cos(baseAng) * rStart, 0.012, Math.sin(baseAng) * rStart)];
    let curA = baseAng;
    for (let s = 1; s <= segs; s++) {
      const r = lerp(rStart, Math.min(maxRadius * 0.98, len), s / segs);
      curA += R.range(-0.32, 0.32);
      pts.push(new THREE.Vector3(Math.cos(curA) * r, 0.012 + (1 - s / segs) * 0.022, Math.sin(curA) * r));
    }
    const g1 = buildTaperedPrismGeo(pts, 0.026, 0.052, 0.002, 0.35);
    const g2 = buildTaperedPrismGeo(pts, 0.060, 0.115, 0.004, 0.22);
    geos.push(g1, g2);
    g.add(new THREE.Mesh(g2, matGlow), new THREE.Mesh(g1, matCore));

    if (R.chance(0.68)) {
      const forkIdx = R.int(2, 4);
      const forkStart = pts[forkIdx].clone();
      const fAng = curA + R.sign() * R.range(0.42, 0.88);
      const fLen = len * R.range(0.24, 0.44);
      const fPts = [
        forkStart,
        forkStart.clone().add(new THREE.Vector3(Math.cos(fAng) * fLen * 0.5, 0, Math.sin(fAng) * fLen * 0.5)),
        forkStart.clone().add(new THREE.Vector3(Math.cos(fAng + R.range(-0.25, 0.25)) * fLen, 0, Math.sin(fAng + R.range(-0.25, 0.25)) * fLen)),
      ];
      for (const fp of fPts) {
        const d = Math.hypot(fp.x, fp.z);
        if (d > maxRadius * 0.96) {
          fp.x *= (maxRadius * 0.96) / d;
          fp.z *= (maxRadius * 0.96) / d;
        }
      }
      const gf = buildTaperedPrismGeo(fPts, 0.032, 0.022, 0.002, 0.35);
      geos.push(gf);
      g.add(new THREE.Mesh(gf, matCore));
    }
  }

  const slabs = [];
  let rockMat = null;
  if (rockCount > 0) {
    const rockGeo = new THREE.ConeGeometry(1, 1, 4);
    rockGeo.translate(0, 0.45, 0);
    geos.push(rockGeo);
    rockMat = new THREE.MeshStandardMaterial({
      color: 0x242a38,
      emissive: ramp[1].clone().multiplyScalar(0.28),
      roughness: 0.72,
      metalness: 0.22,
      flatShading: true,
      transparent: true,
    });
    mats.push(rockMat);
    for (let i = 0; i < rockCount; i++) {
      const a = (i / rockCount) * TAU + R.range(-0.14, 0.14);
      const rad = R.range(0.55, Math.min(maxRadius * 0.72, 1.45));
      const m = new THREE.Mesh(rockGeo, rockMat);
      const sx = R.range(0.14, 0.24) * rockScale;
      const sy = R.range(0.45, 0.78) * rockScale;
      const sz = R.range(0.12, 0.20) * rockScale;
      m.position.set(Math.cos(a) * rad, -0.04, Math.sin(a) * rad);
      m.rotation.order = 'YXZ';
      m.rotation.set(0.52, Math.atan2(Math.cos(a), Math.sin(a)), 0);
      g.add(m);
      slabs.push({ m, sx, sy, sz });
    }
  }

  sim.addCustom({
    group: g, life, max: life, _skipAutoMap: true,
    update(_dt, k) {
      const pop = ease.outBack(clamp((1 - k) * 9), 2.0);
      const sink = smooth(0.0, 0.28, k);
      for (const s of slabs) {
        s.m.scale.set(s.sx * pop, s.sy * pop * sink, s.sz * pop);
      }
      matCore.opacity = Math.pow(k, 0.78) * 0.9;
      matGlow.opacity = Math.pow(k, 1.1) * 0.75;
      if (rockMat) rockMat.opacity = Math.min(1, k * 3.5);
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
    },
  });
}

// Sculpted 3D Projectile + Closed Tubular Trail + Optional Flipbook Wake & Double Helix
export function spawnArcaneOrb(sim, {
  p0, p1, arcHeight = 0.36, sideCurve = 0, flightTime = 0.24, palette = PAL3D.mageArcane,
  orbSize = 0.14, spiral = false, heavy = false, trailFadeTime = 0.18,
  flipbookWake = null, onImpact,
}) {
  const ramp = rampToColors(palette, 7);
  const wp0 = sim.mapSkillVec3 ? sim.mapSkillVec3(p0) : p0.clone();
  const wp1 = sim.mapSkillVec3 ? sim.mapSkillVec3(p1) : p1.clone();
  const aoeMul = sim.getAoeScale ? sim.getAoeScale() : 1.0;
  const effOrbSize = orbSize * clamp(Math.pow(aoeMul, 0.45), 0.78, 1.45);
  const effSideCurve = sideCurve * aoeMul;

  const group = new THREE.Group();
  group.position.copy(wp0);

  const coreMat = new THREE.MeshBasicMaterial({
    color: ramp[6].clone().multiplyScalar(1.9),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const shellMat = new THREE.MeshBasicMaterial({
    color: ramp[3].clone().multiplyScalar(1.5),
    transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: heavy,
  });
  const coreGeo = new THREE.OctahedronGeometry(effOrbSize, 1);
  const shellGeo = new THREE.IcosahedronGeometry(effOrbSize * 1.65, 0);
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  const shellMesh = new THREE.Mesh(shellGeo, shellMat);
  group.add(coreMesh, shellMesh);

  let ringGeo = null, ring1 = null, ring2 = null;
  if (heavy || spiral) {
    ringGeo = new THREE.TorusGeometry(effOrbSize * 2.0, effOrbSize * 0.12, 6, 20);
    ring1 = new THREE.Mesh(ringGeo, shellMat);
    ring2 = new THREE.Mesh(ringGeo, shellMat);
    ring2.rotation.x = Math.PI / 2;
    group.add(ring1, ring2);
  }

  const mainTrail = new RibbonTrail3D({ maxPoints: 22, width: effOrbSize * 1.9, palette, hdr: 2.0 });
  sim.root.add(mainTrail.group);

  let helixA = null, helixB = null;
  if (spiral) {
    helixA = new RibbonTrail3D({ maxPoints: 24, width: effOrbSize * 0.9, palette, hdr: 1.9 });
    helixB = new RibbonTrail3D({ maxPoints: 24, width: effOrbSize * 0.9, palette, hdr: 1.9 });
    sim.root.add(helixA.group, helixB.group);
  }

  let t = 0, impacted = false, wakeTimer = 0;
  const totalLife = flightTime + trailFadeTime;

  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      t += dt;
      if (t + 1e-6 < flightTime) {
        const u = clamp(t / flightTime);
        const s = Math.sin(u * Math.PI);
        const pos = wp0.clone().lerp(wp1, u);
        pos.y += s * arcHeight;
        pos.x += s * effSideCurve;
        group.position.copy(pos);
        coreMesh.rotation.y += dt * 11;
        shellMesh.rotation.x -= dt * 9;
        if (ring1) { ring1.rotation.y += dt * 13; ring2.rotation.z -= dt * 11; }
        mainTrail.pushPoint(pos);
        mainTrail.update(dt, 0);
        if (spiral) {
          const ang = u * TAU * 2.5;
          const r = 0.20 * s;
          helixA.pushPoint(pos.clone().add(new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r, 0)));
          helixB.pushPoint(pos.clone().add(new THREE.Vector3(-Math.cos(ang) * r, -Math.sin(ang) * r, 0)));
          helixA.update(dt, 0);
          helixB.update(dt, 0);
        }
        if (flipbookWake) {
          wakeTimer -= dt;
          if (wakeTimer <= 0) {
            wakeTimer = 0.035;
            sim.spawnFlipbook({
              atlas: flipbookWake, x: pos.x, y: pos.y, z: pos.z, _mapped: true,
              vy: 0.4, life: 0.24, size0: effOrbSize * 2.8, size1: effOrbSize * 4.5,
              palette, hdr: 1.7, opacity: 0.72, loopFrames: true,
            });
          }
        }
      } else {
        if (!impacted) {
          impacted = true;
          group.visible = false;
          // Pass unscaled skill-space p1 so onImpact callers spawning into sim map ONCE!
          onImpact?.(p1.clone());
        }
        const rate = 1 / Math.max(0.04, trailFadeTime);
        mainTrail.update(dt, rate);
        if (spiral) { helixA.update(dt, rate); helixB.update(dt, rate); }
      }
    },
    get done() { return t >= totalLife; },
    dispose() {
      sim.root.remove(mainTrail.group); mainTrail.dispose();
      if (helixA) { sim.root.remove(helixA.group); helixA.dispose(); }
      if (helixB) { sim.root.remove(helixB.group); helixB.dispose(); }
      coreGeo.dispose(); shellGeo.dispose(); ringGeo?.dispose();
      coreMat.dispose(); shellMat.dispose();
    },
  });
}

// ============================================================================
// Heroic Upward Celebration & Buff Empowerment Keyframes (ZERO Slam-Crouch / Recoil!)
// ============================================================================
export function makeLevelUpTriumphKeyframes(gatherT = 0.12, releaseT = 0.24, endT = 2.20) {
  const hoverT = +Math.min(endT - 0.55, releaseT + 0.54).toFixed(3);
  const settleT = +Math.min(endT - 0.24, releaseT + 1.18).toFixed(3);
  return [
    { t: 0.00, pose: { ...REST_POSE } },
    { t: gatherT, ease: ease.inOutSine, pose: {
      ...REST_POSE,
      y: 0.02, crouch: 0.04, torsoPitch: -0.06, headPitch: -0.08,
      shRPitch: -1.18, shRYaw: -0.22, elRPitch: -0.78,
      shLPitch: -1.18, shLYaw: 0.22, elLPitch: -0.78, capePitch: 0.30,
    }},
    { t: releaseT, ease: ease.outBack, pose: {
      ...REST_POSE,
      y: 0.24, crouch: 0, torsoPitch: -0.22, headPitch: -0.28,
      shRPitch: -2.42, shRYaw: -0.52, elRPitch: -0.18,
      shLPitch: -2.42, shLYaw: 0.52, elLPitch: -0.18,
      hipRPitch: 0.16, kneeRPitch: 0.34, hipLPitch: -0.10, kneeLPitch: 0.28, capePitch: 0.68,
    }},
    { t: hoverT, ease: ease.inOutSine, pose: {
      ...REST_POSE,
      y: 0.34, crouch: 0, torsoPitch: -0.18, headPitch: -0.22,
      shRPitch: -2.18, shRYaw: -0.62, elRPitch: -0.24,
      shLPitch: -2.18, shLYaw: 0.62, elLPitch: -0.24,
      hipRPitch: 0.20, kneeRPitch: 0.38, hipLPitch: -0.08, kneeLPitch: 0.30, capePitch: 0.78,
    }},
    { t: settleT, ease: ease.inOutSine, pose: {
      ...REST_POSE,
      y: 0.08, crouch: 0, torsoPitch: -0.08, headPitch: -0.10,
      shRPitch: -1.25, shRYaw: -0.38, elRPitch: -0.45,
      shLPitch: -1.25, shLYaw: 0.38, elLPitch: -0.45, capePitch: 0.42,
    }},
    { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE } },
  ];
}

export function makeEmpowerBuffKeyframes(gatherT = 0.20, releaseT = 0.36, endT = 2.15, loadout = 'unarmed') {
  const baseGuard = loadout === 'sword_shield' ? SHIELD_GUARD : {};
  const isStaff = loadout === 'mage_staff';
  const holdT = +Math.min(endT - 0.35, releaseT + 0.56).toFixed(3);
  return [
    { t: 0.00, pose: { ...REST_POSE, ...baseGuard } },
    { t: gatherT, ease: ease.inOutSine, pose: {
      ...REST_POSE,
      crouch: 0.04, torsoPitch: -0.05, torsoYaw: -0.14, headPitch: -0.08,
      shRPitch: -1.26, shRYaw: -0.22, elRPitch: -0.64,
      shLPitch: -1.14, shLYaw: 0.32, elLPitch: -0.66, capePitch: 0.30,
    }},
    { t: releaseT, ease: ease.outBack, pose: {
      ...REST_POSE,
      y: 0.08, crouch: 0, torsoPitch: -0.22, torsoYaw: 0.06, headPitch: -0.26,
      shRPitch: isStaff ? -1.68 : -2.38, shRYaw: isStaff ? -0.16 : -0.44, elRPitch: -0.14, wrRPitch: isStaff ? 0.06 : -0.12,
      shLPitch: -1.92, shLYaw: 0.58, elLPitch: -0.24, capePitch: 0.72,
    }},
    { t: holdT, ease: ease.inOutSine, pose: {
      ...REST_POSE,
      y: 0.04, crouch: 0, torsoPitch: -0.15, torsoYaw: 0.04, headPitch: -0.18,
      shRPitch: isStaff ? -1.58 : -2.12, shRYaw: isStaff ? -0.18 : -0.48, elRPitch: -0.20, wrRPitch: isStaff ? 0.08 : -0.10,
      shLPitch: -1.65, shLYaw: 0.52, elLPitch: -0.30, capePitch: 0.58,
    }},
    { t: endT, ease: ease.inOutCubic, pose: { ...REST_POSE, ...baseGuard } },
  ];
}

// Build a crisp 3D upward V-chevron (`▲`) geometry for unmistakable Buff / Level-Up empowerment
function buildUpwardChevronGeo(size = 0.16) {
  const pos = [];
  const idx = [];
  const w = size * 0.95;
  const h = size * 0.82;
  const thick = size * 0.26;
  const d = size * 0.14;
  // 6-vertex front + 6-vertex back extruded V-chevron pointing strictly +Y
  const prof = [
    [0, h],
    [w, -h * 0.35],
    [w * 0.62, -h * 0.68],
    [0, h - thick * 1.45],
    [-w * 0.62, -h * 0.68],
    [-w, -h * 0.35],
  ];
  for (const zOff of [d, -d]) {
    for (const [px, py] of prof) pos.push(px, py, zOff);
  }
  // Front & back faces (triangulated around vertex 0/3)
  idx.push(0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4);
  idx.push(6, 7, 8, 6, 8, 9, 6, 9, 10, 6, 10, 11);
  // Side bevels
  for (let i = 0; i < 6; i++) {
    const ni = (i + 1) % 6;
    const a = i, b = ni, c = i + 6, e = ni + 6;
    idx.push(a, c, b, b, c, e);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Floating 3D Metallic Callout Banner (`LEVEL UP!`, `ATK UP ▲`, `+15 SUCCESS!`, etc.)
 * Combines high-contrast metallic CanvasTexture typography (with dark outer stroke so Bloom never blurs letters!)
 * + real sculpted 3D flanking heraldic wings, stars & upward chevron (100% Node & .GLB compatible!).
 */
export function spawnRisingBanner3D(sim, {
  x = 0,
  y0 = 1.92,
  z = 0,
  rise = 1.08,
  duration = 1.50,
  text = 'LEVEL UP!',
  subText = '★ ALL STATS UP ★',
  palette = PAL3D.holyGold,
  scale = 1.0,
  _mapped = false,
} = {}) {
  if (sim._clipMaxDuration > 0) {
    const maxRem = sim._clipMaxDuration - (sim._simTime || 0) - 0.06;
    if (maxRem > 0.16) duration = Math.min(duration, maxRem);
  }
  const [wx, wz] = sim.mapSkillXZ ? sim.mapSkillXZ(x, z, _mapped) : [x, z];
  const ramp = rampToColors(palette, 7);

  const group = new THREE.Group();
  group.position.set(wx, y0, wz);
  group.rotation.y = -0.62; // Readable default isometric facing before first camera frame

  const geos = [];
  const mats = [];
  let bannerTex = null;
  let shaderMat = null;

  // 1. Real 3D Flanking Heraldic Wing-Feathers, Star Gems & Top Crown Chevron (`▲`)
  const goldMat = new THREE.MeshBasicMaterial({
    color: ramp[4].clone().multiplyScalar(1.25),
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const accentMat = new THREE.MeshBasicMaterial({
    color: ramp[3].clone().multiplyScalar(1.18),
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  mats.push(goldMat, accentMat);

  const chevGeo = buildUpwardChevronGeo(0.21 * scale);
  geos.push(chevGeo);
  const topCrown = new THREE.Mesh(chevGeo, goldMat);
  topCrown.position.set(0, 0.39 * scale, 0.02);
  topCrown.renderOrder = 998;
  group.add(topCrown);

  const wingGeo = new THREE.OctahedronGeometry(1, 0);
  geos.push(wingGeo);
  const wingSpanX = 1.12 * scale;
  const starMeshes = [];
  for (const sgn of [-1, 1]) {
    for (let w = 0; w < 3; w++) {
      const feather = new THREE.Mesh(wingGeo, w === 0 ? goldMat : accentMat);
      const len = (0.29 - w * 0.05) * scale;
      feather.scale.set(len, 0.044 * scale, 0.045 * scale);
      feather.position.set(sgn * (wingSpanX + w * 0.115 * scale), (0.08 - w * 0.07) * scale, 0);
      feather.rotation.z = sgn * (0.28 - w * 0.16);
      feather.renderOrder = 998;
      group.add(feather);
    }
    const star = new THREE.Mesh(wingGeo, goldMat);
    star.scale.set(0.088 * scale, 0.088 * scale, 0.04 * scale);
    star.position.set(sgn * (wingSpanX - 0.12 * scale), 0.03 * scale, 0.03);
    star.renderOrder = 998;
    group.add(star);
    starMeshes.push(star);
  }

  // Headless Node / pure-3D fallback emblem bars when DOM Canvas is unavailable
  if (typeof document === 'undefined') {
    const barGeo = new THREE.BoxGeometry(1.75 * scale, 0.26 * scale, 0.03 * scale);
    geos.push(barGeo);
    group.add(new THREE.Mesh(barGeo, accentMat));
  } else {
    const cv = document.createElement('canvas');
    cv.width = 896;
    cv.height = 288;
    const ctx = cv.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 896, 288);
      const hasArrowSuffix = /▲\s*$/.test(text);
      const cleanText = text.replace(/\s*▲\s*$/, '').trim();

      const cBright = `#${ramp[5].getHexString()}`;
      const cMid = `#${ramp[4].getHexString()}`;
      const cRich = `#${ramp[3].getHexString()}`;

      // Tapered Royal Obsidian-Gold Heraldic Plaque (blocks bright beam bleed so Bloom NEVER washes out letters!)
      const pTop = 38;
      const pBot = subText ? 246 : 210;
      const pMidY = (pTop + pBot) * 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(132, pTop);
      ctx.lineTo(764, pTop);
      ctx.lineTo(828, pMidY);
      ctx.lineTo(764, pBot);
      ctx.lineTo(132, pBot);
      ctx.lineTo(68, pMidY);
      ctx.closePath();

      const plaqueG = ctx.createLinearGradient(68, pTop, 828, pBot);
      plaqueG.addColorStop(0.00, 'rgba(10, 14, 28, 0.76)');
      plaqueG.addColorStop(0.18, 'rgba(12, 16, 32, 0.94)');
      plaqueG.addColorStop(0.50, 'rgba(18, 14, 28, 0.96)');
      plaqueG.addColorStop(0.82, 'rgba(12, 16, 32, 0.94)');
      plaqueG.addColorStop(1.00, 'rgba(10, 14, 28, 0.76)');
      ctx.fillStyle = plaqueG;
      ctx.fill();

      const borderG = ctx.createLinearGradient(68, 0, 828, 0);
      borderG.addColorStop(0.00, cRich);
      borderG.addColorStop(0.25, cMid);
      borderG.addColorStop(0.50, '#fffbeb');
      borderG.addColorStop(0.75, cMid);
      borderG.addColorStop(1.00, cRich);
      ctx.lineWidth = 4.0;
      ctx.strokeStyle = borderG;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(140, pTop + 7);
      ctx.lineTo(756, pTop + 7);
      ctx.moveTo(140, pBot - 7);
      ctx.lineTo(756, pBot - 7);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 250, 220, 0.55)';
      ctx.stroke();
      ctx.restore();

      const lenFactor = cleanText.length > 12 ? 64 : cleanText.length > 9 ? 74 : 86;
      ctx.font = `900 italic ${lenFactor}px "Trebuchet MS", "Segoe UI", "Microsoft JhengHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      const mainY = subText ? 120 : 126;
      const textMetricsW = ctx.measureText(cleanText).width;
      const textCenterX = hasArrowSuffix ? 448 - 28 : 448;

      ctx.save();
      ctx.shadowColor = cRich;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#07050a';
      ctx.lineWidth = 18;
      ctx.strokeText(cleanText, textCenterX, mainY);
      ctx.restore();

      ctx.strokeStyle = '#090604';
      ctx.lineWidth = 13;
      ctx.strokeText(cleanText, textCenterX, mainY);

      const textGrad = ctx.createLinearGradient(0, mainY - 44, 0, mainY + 44);
      textGrad.addColorStop(0.00, '#fffef2');
      textGrad.addColorStop(0.32, cBright);
      textGrad.addColorStop(0.68, cMid);
      textGrad.addColorStop(1.00, cRich);
      ctx.fillStyle = textGrad;
      ctx.fillText(cleanText, textCenterX, mainY);

      if (hasArrowSuffix) {
        const ax = Math.min(765, textCenterX + textMetricsW * 0.5 + 38);
        const drawVectorChevron = (cy, halfW, h) => {
          ctx.beginPath();
          ctx.moveTo(ax, cy - h * 0.55);
          ctx.lineTo(ax + halfW, cy + h * 0.45);
          ctx.lineTo(ax + halfW * 0.52, cy + h * 0.45);
          ctx.lineTo(ax, cy - h * 0.08);
          ctx.lineTo(ax - halfW * 0.52, cy + h * 0.45);
          ctx.lineTo(ax - halfW, cy + h * 0.45);
          ctx.closePath();
          ctx.lineWidth = 8;
          ctx.strokeStyle = '#090604';
          ctx.stroke();
          ctx.fillStyle = textGrad;
          ctx.fill();
        };
        drawVectorChevron(mainY - 12, 24, 28);
        drawVectorChevron(mainY + 14, 20, 24);
      }

      if (subText) {
        ctx.font = '800 27px "Microsoft JhengHei", "Segoe UI", system-ui, sans-serif';
        ctx.strokeStyle = '#080504';
        ctx.lineWidth = 8.0;
        ctx.strokeText(subText, 448, 204);
        ctx.fillStyle = '#fde68a';
        ctx.fillText(subText, 448, 204);
      }
    }

    bannerTex = new THREE.CanvasTexture(cv);
    bannerTex.colorSpace = THREE.SRGBColorSpace;
    bannerTex.needsUpdate = true;

    const planeGeo = new THREE.PlaneGeometry(2.52 * scale, 0.81 * scale);
    geos.push(planeGeo);
    shaderMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: {
        uMap: { value: bannerTex },
        uTime: { value: 0 },
        uOpacity: { value: 1.0 },
        uTint: { value: ramp[4].clone() },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uMap;
        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 uTint;
        void main() {
          vec4 tx = texture2D(uMap, vUv);
          if (tx.a < 0.015) discard;
          float sweep = fract(uTime * 0.78);
          float band = 1.0 - smoothstep(0.0, 0.14, abs((vUv.x + vUv.y * 0.22) * 0.82 - sweep));
          float luma = dot(tx.rgb, vec3(0.299, 0.587, 0.114));
          vec3 col = tx.rgb + uTint * band * smoothstep(0.35, 0.85, luma) * 0.25;
          gl_FragColor = vec4(col, tx.a * uOpacity);
        }
      `,
    });
    mats.push(shaderMat);
    const planeMesh = new THREE.Mesh(planeGeo, shaderMat);
    planeMesh.position.z = 0.03;
    planeMesh.renderOrder = 999;
    group.add(planeMesh);
  }

  let el = 0;
  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt, camera = null) {
      el += dt;
      const u = clamp(el / Math.max(0.05, duration));
      const pop = ease.outBack(clamp(el / 0.18), 1.85);
      const fade = 1 - smooth(0.76, 1.0, u);

      // Strictly upward celebration ascent!
      group.position.set(wx, y0 + rise * ease.outCubic(u), wz);
      group.scale.setScalar(Math.max(0.01, pop));

      if (camera && camera.position) {
        const dx = camera.position.x - wx;
        const dz = camera.position.z - wz;
        if (dx * dx + dz * dz > 1e-4) {
          group.rotation.y = Math.atan2(dx, dz);
        }
      }

      topCrown.position.y = (0.36 + 0.05 * Math.sin(el * 8.0)) * scale;
      for (const st of starMeshes) st.rotation.z = el * 3.2;
      goldMat.opacity = fade;
      accentMat.opacity = fade * 0.9;
      if (shaderMat) {
        shaderMat.uniforms.uTime.value = el;
        shaderMat.uniforms.uOpacity.value = fade;
      }
    },
    get done() { return el >= duration; },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      bannerTex?.dispose();
    },
  });
}

/**
 * 100% Upward-Rising Buff & Celebration Ascension Aura:
 * Staggered upward halo rings + sculpted 3D upward `▲` chevrons + ascending spiral ribbons
 * + optional ground-to-sky upward light pillar + anti-gravity skyward Niagara sparkles!
 */
export function spawnAscendingBuffAura(sim, {
  x = 0,
  z = 0,
  getCenter = null,
  radius = 1.05,
  maxH = 3.1,
  duration = 1.45,
  ringCount = 4,
  chevronCount = 7,
  helixCount = 2,
  helixPalettes = null,
  pillar = false,
  pillarRadius = 0.56,
  pillarHeight = 5.4,
  vortex = false,
  texStyle = 'auto',
  flipbook = 'fbBlessing',
  niagaraCount = 44,
  palette = PAL3D.holyGold,
  hdr = 2.25,
  _mapped = false,
} = {}) {
  if (sim._clipMaxDuration > 0) {
    const maxRem = sim._clipMaxDuration - (sim._simTime || 0) - 0.06;
    if (maxRem > 0.18) duration = Math.min(duration, maxRem);
  }
  const aoeMul = _mapped ? 1.0 : (sim.getAoeScale ? sim.getAoeScale() : 1.0);
  const effR = radius * clamp(Math.pow(aoeMul, 0.65), 0.75, 1.65);
  const [initWx, initWz] = getCenter
    ? (() => { const c = getCenter(); return [c.x, c.z]; })()
    : (sim.mapSkillXZ ? sim.mapSkillXZ(x, z, _mapped) : [x, z]);

  const ramp = rampToColors(palette, 7);
  const group = new THREE.Group();
  group.position.set(initWx, 0, initWz);
  const geos = [];
  const mats = [];

  // 1. Staggered horizontal golden/elemental halo rings sweeping UPWARD from feet to sky
  const ringGeo = new THREE.TorusGeometry(effR * 1.06, Math.max(0.024, effR * 0.032), 8, 44);
  ringGeo.rotateX(Math.PI / 2);
  geos.push(ringGeo);

  const rings = [];
  for (let i = 0; i < ringCount; i++) {
    const rm = new THREE.MeshBasicMaterial({
      color: ramp[i % 2 === 0 ? 4 : 3].clone().multiplyScalar(1.28),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    mats.push(rm);
    const mesh = new THREE.Mesh(ringGeo, rm);
    group.add(mesh);
    rings.push({
      mesh,
      rm,
      delay: i * (Math.min(0.45, duration * 0.34) / Math.max(1, ringCount)),
    });
  }

  // 2. Sculpted 3D Upward Empowerment Chevrons (`▲`) floating skyward outside the light pillar
  const chevGeo = buildUpwardChevronGeo(0.185 * clamp(effR, 0.78, 1.38));
  geos.push(chevGeo);
  const chevMat = new THREE.MeshBasicMaterial({
    color: ramp[4].clone().multiplyScalar(1.42),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  mats.push(chevMat);

  const chevrons = [];
  for (let i = 0; i < chevronCount; i++) {
    const m = new THREE.Mesh(chevGeo, chevMat);
    group.add(m);
    chevrons.push({
      m,
      baseA: (i / Math.max(1, chevronCount)) * TAU,
      radFrac: 0.92 + (i % 3) * 0.20,
      yOffset: (i % 4) * 0.24,
      speed: 1.55 + (i % 3) * 0.35,
    });
  }

  // 3. Corkscrewing Ascending Spiral Light Ribbons
  const ribbons = [];
  for (let s = 0; s < helixCount; s++) {
    const hPal = Array.isArray(helixPalettes) && helixPalettes[s] ? helixPalettes[s] : palette;
    const rb = new RibbonTrail3D({ maxPoints: 26, width: 0.14 * clamp(effR, 0.8, 1.3), palette: hPal, hdr: 1.45 });
    sim.root.add(rb.group);
    ribbons.push(rb);
  }

  // 4. Optional Translucent Strictly-Upward Light Column & Delicate Rising Vortex (keeps hero 100% visible!)
  if (pillar) {
    const beam = new BeamCylinder3D({
      p0: new THREE.Vector3(initWx, 0.02, initWz),
      p1: new THREE.Vector3(initWx, pillarHeight, initWz),
      radius: pillarRadius * 0.80 * clamp(aoeMul, 0.8, 1.45),
      duration: Math.max(0.25, duration * 0.90),
      palette,
      texStyle,
      defaultTex: 'silk',
      hdr: 1.05,
    });
    beam._skipAutoMap = true;
    sim.addCustom(beam);
  }

  if (vortex) {
    const vf = new VortexFunnel3D({
      x: initWx, y: 0.02, z: initWz,
      rBottom: effR * 0.72, rTop: effR * 1.28, height: maxH * 0.88,
      duration: Math.max(0.25, duration * 0.88),
      spinSpeed: 5.8, riseSpeed: 3.8, twist: 1.4,
      palette, texStyle, defaultTex: 'silk', hdr: 0.92,
    });
    vf._skipAutoMap = true;
    sim.addCustom(vf);
  }

  // 5. Rising Flipbook (`vy > 0`) & Anti-Gravity Niagara Sparkles (`gravity < 0`)
  if (flipbook) {
    sim.spawnFlipbook({
      atlas: flipbook,
      x: initWx, y: 0.92, z: initWz, _mapped: true,
      vy: 1.95,
      life: Math.min(0.85, duration * 0.68),
      size0: 0.88 * clamp(effR, 0.8, 1.25),
      size1: 1.85 * clamp(effR, 0.8, 1.25),
      palette, hdr: 1.32,
    });
  }

  if (niagaraCount > 0 && sim.spawnNiagaraBurst) {
    sim.spawnNiagaraBurst({
      x: initWx, y: 0.22, z: initWz, _mapped: true,
      count: niagaraCount,
      spreadRadius: effR * 0.88,
      speed0: 1.1, speed1: 3.4,
      dirY: 1.0,
      gravity: -3.25,
      curl: 3.4,
      vortex: 6.2,
      vortexCenter: [initWx, initWz],
      size0: 0.046, size1: 0.014,
      life0: Math.min(0.50, duration * 0.45),
      life1: Math.min(1.05, duration * 0.85),
      palette, hdr: 1.65,
    });
  }

  let el = 0;
  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      el += dt;
      let cx = initWx, cz = initWz;
      if (getCenter) {
        const c = getCenter();
        cx = c.x; cz = c.z;
        group.position.set(cx, 0, cz);
      }
      const globalFade = Math.min(1, el * 8.0) * (1 - smooth(duration - 0.28, duration, el));

      // Sweep rings strictly UPWARD
      for (const r of rings) {
        const tLocal = el - r.delay;
        const span = Math.max(0.20, duration - r.delay);
        if (tLocal <= 0 || tLocal >= span) {
          r.mesh.visible = false;
          continue;
        }
        r.mesh.visible = true;
        const ru = clamp(tLocal / span);
        const y = 0.06 + maxH * ease.outQuad(ru);
        const s = 0.78 + 0.34 * Math.sin(ru * Math.PI);
        r.mesh.position.y = y;
        r.mesh.scale.set(s, s, 1);
        r.rm.opacity = Math.sin(ru * Math.PI) * globalFade * 0.88;
      }

      // Float 3D `▲` chevrons skyward
      const u = clamp(el / Math.max(0.1, duration));
      chevMat.opacity = globalFade * 0.92;
      for (const ch of chevrons) {
        const a = ch.baseA + el * 1.35;
        const rr = effR * ch.radFrac;
        const cy = 0.22 + ((ch.yOffset + el * ch.speed) % Math.max(0.8, maxH * 0.88));
        ch.m.position.set(Math.cos(a) * rr, cy, Math.sin(a) * rr);
        ch.m.rotation.y = a + Math.PI * 0.5;
      }

      // Advance upward spiral ribbons
      const activeRibSpan = duration * 0.76;
      if (el < activeRibSpan) {
        const ru = clamp(el / Math.max(0.1, activeRibSpan));
        ribbons.forEach((rb, idx) => {
          const ang = el * 6.2 + (idx * TAU) / Math.max(1, ribbons.length);
          const rr = effR * lerp(0.95, 0.42, ru);
          const py = 0.08 + ru * maxH * 1.05;
          rb.pushPoint(new THREE.Vector3(cx + Math.cos(ang) * rr, py, cz + Math.sin(ang) * rr));
          rb.update(dt, 0);
        });
      } else {
        const fadeRate = 1 / Math.max(0.08, duration - activeRibSpan);
        ribbons.forEach((rb) => rb.update(dt, fadeRate));
      }
    },
    get done() { return el >= duration; },
    dispose() {
      ribbons.forEach((rb) => { sim.root.remove(rb.group); rb.dispose(); });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  });
}

// ============================================================================
// 3A Sigil-Free Physical / Martial Weapon VFX Suite
// (Live Weapon Ribbons, Sonic Air-Cutters, Directional Ground Blade Scars,
//  Martial Stance Footwork Gusts & Supersonic Mach Shock-Rings — ZERO Magic Circles!)
// ============================================================================

export function getFighterWeaponTipWorld(fighter, side = 'R', frac = 1.0) {
  if (!fighter?.root) return new THREE.Vector3(0, 1.1, 0.6);
  fighter.root.updateMatrixWorld(true);
  const kind = fighter.loadout || 'sword_shield';
  if (kind === 'bow') {
    const v = fighter.getBowMuzzleWorld();
    return v;
  }
  const handObj = side === 'L' ? fighter.handL : fighter.handR;
  if (!handObj) return fighter.getRightHandWorld();

  let localPt;
  if (side === 'L') {
    if (kind === 'dual_daggers') localPt = new THREE.Vector3(0, -0.68 * frac, 0);
    else if (kind === 'sword_shield') localPt = new THREE.Vector3(-0.18, -0.12, 0.22 * frac);
    else localPt = new THREE.Vector3(0, -0.16 * frac, 0);
  } else if (kind === 'greatsword') {
    localPt = new THREE.Vector3(0, -1.58 * frac, 0);
  } else if (kind === 'sword_shield') {
    localPt = new THREE.Vector3(0, -1.28 * frac, 0);
  } else if (kind === 'scythe') {
    localPt = new THREE.Vector3(0.42 * frac, -1.50 * frac, 0);
  } else if (kind === 'spear') {
    localPt = new THREE.Vector3(0, -1.88 * frac, 0);
  } else if (kind === 'dual_daggers') {
    localPt = new THREE.Vector3(0, -0.68 * frac, 0);
  } else {
    localPt = new THREE.Vector3(0, -0.18 * frac, 0.08 * frac);
  }
  const out = handObj.localToWorld(localPt);
  out._isWorldScaled = true;
  return out;
}

/**
 * Live 3D Weapon-Edge Ribbon Trail + Mid-Blade Wake + Cold Steel Glint + High-Speed Shed Sparks!
 * Tracks the fighter's actual swinging 3D blade/spear/scythe/daggers in real time.
 */
export function attachWeaponBladeTrail3D(sim, fighter, {
  duration = 0.34,
  fadeTime = 0.14,
  width = 0.19,
  palette = PAL3D.warriorSilver,
  wakePalette = null,
  hdr = 2.35,
  dual = null,
  glint = true,
  sparks = true,
} = {}) {
  if (!sim || !fighter) return;
  let activeDur = Math.max(0.06, duration);
  let fadeDur = Math.max(0.05, fadeTime);
  if (sim._clipMaxDuration > 0) {
    const maxRem = sim._clipMaxDuration - (sim._simTime || 0) - 0.06;
    if (maxRem <= 0.11) return;
    if (activeDur + fadeDur > maxRem) {
      const ratio = maxRem / (activeDur + fadeDur);
      activeDur = Math.max(0.05, activeDur * ratio);
      fadeDur = Math.max(0.04, maxRem - activeDur);
    }
  }

  const isDual = dual !== null ? Boolean(dual) : fighter.loadout === 'dual_daggers';
  const secPal = wakePalette || palette;
  const trails = [];

  const mainR = new RibbonTrail3D({ maxPoints: 24, width, palette, hdr });
  sim.root.add(mainR.group);
  trails.push({ rb: mainR, sample: () => getFighterWeaponTipWorld(fighter, 'R', 1.0) });

  if (isDual) {
    const mainL = new RibbonTrail3D({ maxPoints: 24, width: width * 0.94, palette: secPal, hdr: hdr * 0.96 });
    sim.root.add(mainL.group);
    trails.push({ rb: mainL, sample: () => getFighterWeaponTipWorld(fighter, 'L', 1.0) });
  } else {
    const wakeR = new RibbonTrail3D({ maxPoints: 20, width: width * 1.32, palette: secPal, hdr: hdr * 0.68 });
    sim.root.add(wakeR.group);
    trails.push({ rb: wakeR, sample: () => getFighterWeaponTipWorld(fighter, 'R', 0.62) });
  }

  const pStart = getFighterWeaponTipWorld(fighter, 'R', 1.0);
  if (glint && sim.spawnStarGlint) {
    sim.spawnStarGlint(
      pStart.x, pStart.y, pStart.z,
      0.58,
      palette[5] || '#ffffff',
      Math.min(0.11, activeDur * 0.65),
      true
    );
  }

  let prevTip = pStart.clone();
  let el = 0;
  let sparkCooldown = 0.02;
  const totalLife = activeDur + fadeDur;

  sim.addCustom({
    _skipAutoMap: true,
    update(dt) {
      el += dt;
      if (el <= activeDur) {
        for (const tr of trails) {
          const pt = tr.sample();
          tr.rb.pushPoint(pt);
          tr.rb.update(dt, 0);
        }
        const curTip = trails[0].sample();
        const speed = dt > 1e-4 ? curTip.distanceTo(prevTip) / dt : 0;
        sparkCooldown -= dt;
        if (sparks && speed > 5.2 && sparkCooldown <= 0 && activeDur - el > 0.04) {
          sparkCooldown = 0.028;
          const vel = curTip.clone().sub(prevTip).divideScalar(Math.max(1e-4, dt));
          const spLife = Math.min(0.18, totalLife - el - 0.02);
          if (spLife > 0.06) {
            sim.spawnSpark({
              x: curTip.x, y: curTip.y, z: curTip.z, _mapped: true,
              vx: vel.x * 0.28 + sim.R.range(-1.4, 1.4),
              vy: vel.y * 0.24 + sim.R.range(0.5, 2.4),
              vz: vel.z * 0.28 + sim.R.range(-1.4, 1.4),
              life: spLife,
              size: 0.042,
              stretch: 0.036,
              color: palette[5] || '#fff4c2',
            });
          }
        }
        prevTip.copy(curTip);
      } else {
        const rate = 1 / Math.max(0.04, fadeDur);
        for (const tr of trails) tr.rb.update(dt, rate);
      }
    },
    get done() { return el >= totalLife; },
    dispose() {
      for (const tr of trails) {
        sim.root.remove(tr.rb.group);
        tr.rb.dispose();
      }
    },
  });
}

/**
 * Sigil-Free Physical Martial Stance / Footwork Gust / Battle-Qi Pressure!
 * Replaces floor magic circles with a crisp non-rune shock-dust wave, spiralling ground-shear wind ribbons,
 * and physical 3D stone pebbles trembling & levitating off the earth!
 */
export function spawnMartialStanceGust3D(sim, {
  x = 0,
  z = 0,
  getCenter = null,
  radius = 1.35,
  duration = 0.65,
  palette = PAL3D.warriorSilver,
  pebbleCount = 8,
  windLoops = 2,
  smoke = true,
  _mapped = false,
} = {}) {
  if (!sim) return;
  if (sim._clipMaxDuration > 0) {
    const maxRem = sim._clipMaxDuration - (sim._simTime || 0) - 0.06;
    if (maxRem <= 0.14) return;
    duration = Math.min(duration, maxRem);
  }

  const aoeMul = _mapped ? 1.0 : (sim.getAoeScale ? sim.getAoeScale() : 1.0);
  let effR = radius * clamp(Math.pow(aoeMul, 0.65), 0.75, 1.55);
  const hb = sim._currentHitbox;
  if (hb?.kind === 'circle' && hb.radius > 0) {
    const allowedR = hb.radius * aoeMul - 0.04;
    effR = Math.min(effR, Math.max(0.32, allowedR));
  }

  const [initWx, initWz] = getCenter
    ? (() => { const c = getCenter(); return [c.x, c.z]; })()
    : (sim.mapSkillXZ ? sim.mapSkillXZ(x, z, _mapped) : [x, z]);

  // 1. Crisp low-profile physical footwork pressure shock-dust wave (NO runes!)
  const waveDur = Math.min(0.28, duration * 0.62);
  if (waveDur >= 0.10 && effR >= 0.35) {
    const gw = new GroundWave3D({
      x: initWx, z: initWz, y: 0.02,
      maxRadius: effR,
      thickness: Math.min(0.32, effR * 0.26),
      height: 0.34,
      duration: waveDur,
      palette,
      hdr: 1.58,
      seed: sim.R.int(1, 99),
    });
    gw._skipAutoMap = true;
    sim.addCustom(gw);
  }

  if (smoke && duration >= 0.28) {
    sim.spawnDarkSmoke({
      x: initWx, y: 0.18, z: initWz, _mapped: true,
      vy: 0.36,
      life: Math.min(0.42, duration * 0.72),
      size0: effR * 0.55,
      size1: effR * 1.15,
      emberHex: palette[4] || '#cbd5e1',
      opacity: 0.34,
    });
  }

  // 2. Spiralling wind-shear ribbons + trembling levitating 3D gravel pebbles!
  const ramp = rampToColors(palette, 7);
  const group = new THREE.Group();
  group.position.set(initWx, 0, initWz);
  const geos = [];
  const mats = [];

  const pebGeo = new THREE.DodecahedronGeometry(1, 0);
  geos.push(pebGeo);
  const pebMat = new THREE.MeshStandardMaterial({
    color: 0x333c4d,
    emissive: ramp[2].clone().multiplyScalar(0.32),
    roughness: 0.72,
    metalness: 0.24,
    flatShading: true,
    transparent: true,
    opacity: 0.95,
  });
  mats.push(pebMat);

  const pebbles = [];
  for (let i = 0; i < pebbleCount; i++) {
    const a = (i / Math.max(1, pebbleCount)) * TAU + sim.R.range(-0.24, 0.24);
    const rr = effR * sim.R.range(0.32, 0.88);
    const sz = sim.R.range(0.038, 0.078);
    const m = new THREE.Mesh(pebGeo, pebMat);
    m.scale.set(sz * 1.2, sz * 0.82, sz);
    m.position.set(Math.cos(a) * rr, 0.03, Math.sin(a) * rr);
    m.rotation.set(sim.R.range(0, TAU), sim.R.range(0, TAU), sim.R.range(0, TAU));
    group.add(m);
    pebbles.push({
      m,
      a,
      rr,
      maxY: sim.R.range(0.28, 0.76),
      spinX: sim.R.range(-9, 9),
      spinY: sim.R.range(-9, 9),
      phase: sim.R.range(0, TAU),
    });
  }

  const ribbons = [];
  for (let w = 0; w < windLoops; w++) {
    const rb = new RibbonTrail3D({
      maxPoints: 20,
      width: 0.11 * clamp(effR, 0.75, 1.3),
      palette,
      hdr: 1.72,
    });
    sim.root.add(rb.group);
    ribbons.push(rb);
  }

  let el = 0;
  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      el += dt;
      let cx = initWx, cz = initWz;
      if (getCenter) {
        const c = getCenter();
        cx = c.x; cz = c.z;
        group.position.set(cx, 0, cz);
      }
      const u = clamp(el / Math.max(0.06, duration));
      const liftEnv = Math.sin(u * Math.PI);
      const fade = 1 - smooth(0.75, 1.0, u);
      pebMat.opacity = fade * 0.95;

      for (const p of pebbles) {
        const curA = p.a + el * 1.45;
        const jit = Math.sin(el * 38.0 + p.phase) * 0.014 * liftEnv;
        p.m.position.set(
          Math.cos(curA) * p.rr + jit,
          0.025 + p.maxY * Math.pow(liftEnv, 0.78),
          Math.sin(curA) * p.rr - jit
        );
        p.m.rotation.x += dt * p.spinX;
        p.m.rotation.y += dt * p.spinY;
      }

      const activeSpan = duration * 0.74;
      if (el <= activeSpan) {
        const ru = clamp(el / Math.max(0.05, activeSpan));
        ribbons.forEach((rb, idx) => {
          const ang = el * 9.2 + (idx * TAU) / Math.max(1, ribbons.length);
          const rr = effR * lerp(0.92, 0.36, ru * 0.65);
          const py = 0.05 + ru * 0.88;
          rb.pushPoint(new THREE.Vector3(cx + Math.cos(ang) * rr, py, cz + Math.sin(ang) * rr));
          rb.update(dt, 0);
        });
      } else {
        const rate = 1 / Math.max(0.05, duration - activeSpan);
        ribbons.forEach((rb) => rb.update(dt, rate));
      }
    },
    get done() { return el >= duration; },
    dispose() {
      ribbons.forEach((rb) => { sim.root.remove(rb.group); rb.dispose(); });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  });
}

/**
 * Directional 3D Blade Cleave Trench / Ground Slash Scar!
 * Carves an elongated glowing tectonic blade gash aligned along `yaw`, flanked by upturned earth ridges,
 * flying 3D rock splinters, tangential steel-clash sparks, dust smoke & air refraction — ZERO circular runes!
 */
export function spawnBladeGroundScar3D(sim, arg2 = {}, arg3 = undefined) {
  if (!sim) return;
  const hasRng = arg2 && typeof arg2.range === 'function';
  const opts = (hasRng ? arg3 : arg2) || {};
  const R = hasRng ? arg2 : sim.R;

  const x = opts.x ?? opts.cx ?? 0;
  const z = opts.z ?? opts.cz ?? 1.65;
  const yaw = opts.yaw ?? 0;
  let length = opts.length ?? 2.35;
  const width = opts.width ?? 0.36;
  let life = opts.life ?? opts.duration ?? 0.66;
  const palette = opts.palette ?? PAL3D.warriorSilver;
  const sparks = opts.sparks ?? 14;
  const rocks = opts.rocks ?? 5;
  const smoke = opts.smoke !== false;
  const zoneKind = opts.zoneKind ?? 'crater';

  if (sim._clipMaxDuration > 0) {
    const maxRem = sim._clipMaxDuration - (sim._simTime || 0) - 0.06;
    if (maxRem <= 0.14) return;
    life = Math.min(life, maxRem);
  }

  const [wx, wz] = sim.mapSkillXZ ? sim.mapSkillXZ(x, z, Boolean(opts._mapped)) : [x, z];
  const aoeMul = opts._mapped ? 1.0 : (sim.getAoeScale ? sim.getAoeScale() : 1.0);
  let effLen = length * aoeMul;
  const effW = width * clamp(aoeMul, 0.8, 1.45);

  const hb = sim._currentHitbox;
  if (hb?.kind === 'circle' && hb.radius > 0) {
    effLen = Math.min(effLen, hb.radius * aoeMul * 1.55);
  }

  // 1. Directional stretched tectonic scar decal (stretched 4.5:1 along blade vector!)
  if (sim.spawnGroundZone && life >= 0.28) {
    sim.spawnGroundZone({
      x: wx, z: wz, _mapped: true,
      radius: Math.min(effLen * 0.34, 1.25),
      duration: life * 0.88,
      kind: zoneKind,
      palette,
      emitFlames: zoneKind === 'burning',
      eruptRocks: false,
      stretchX: 0.34,
      stretchZ: 1.58,
      yaw,
    });
  }

  // 2. Sculpted 3D Razor Furrow Prism + Flanking Upturned Basalt Ridge Clods
  const ramp = rampToColors(palette, 7);
  const group = new THREE.Group();
  group.position.set(wx, 0.018, wz);
  group.rotation.y = yaw;
  const geos = [];
  const mats = [];

  const segs = 8;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const lz = lerp(-effLen * 0.48, effLen * 0.52, u);
    const kink = Math.sin(u * Math.PI * 2.0) * effW * 0.10;
    const archY = Math.sin(u * Math.PI) * 0.045;
    pts.push(new THREE.Vector3(kink, archY, lz));
  }

  const coreGeo = buildTaperedPrismGeo(pts, effW * 0.12, effW * 0.34, effW * 0.05, 0.32);
  const glowGeo = buildTaperedPrismGeo(pts, effW * 0.26, effW * 0.72, effW * 0.10, 0.20);
  geos.push(coreGeo, glowGeo);

  const coreMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.75),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: ramp[3].clone().multiplyScalar(1.38),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  mats.push(coreMat, glowMat);
  group.add(new THREE.Mesh(glowGeo, glowMat), new THREE.Mesh(coreGeo, coreMat));

  // Flanking upturned earth slabs along both sides of the trench
  const clodGeo = new THREE.ConeGeometry(1, 1, 4);
  clodGeo.translate(0, 0.45, 0);
  geos.push(clodGeo);
  const clodMat = new THREE.MeshStandardMaterial({
    color: 0x252c3b,
    emissive: ramp[2].clone().multiplyScalar(0.30),
    roughness: 0.74,
    metalness: 0.20,
    flatShading: true,
    transparent: true,
  });
  mats.push(clodMat);

  const clods = [];
  const clodPairs = 5;
  for (let i = 0; i < clodPairs; i++) {
    const u = (i + 0.5) / clodPairs;
    const lz = lerp(-effLen * 0.38, effLen * 0.42, u);
    const env = Math.sin(u * Math.PI);
    for (const sgn of [-1, 1]) {
      const m = new THREE.Mesh(clodGeo, clodMat);
      const sx = (0.09 + 0.07 * env) * clamp(aoeMul, 0.8, 1.3);
      const sy = (0.22 + 0.26 * env) * clamp(aoeMul, 0.8, 1.3);
      const sz = (0.12 + 0.08 * env) * clamp(aoeMul, 0.8, 1.3);
      m.position.set(sgn * (effW * 0.48 + R.range(0.02, 0.09)), -0.02, lz);
      m.rotation.set(0.18, 0, -sgn * 0.58);
      group.add(m);
      clods.push({ m, sx, sy, sz });
    }
  }

  const fwdX = Math.sin(yaw);
  const fwdZ = Math.cos(yaw);

  // 3. Directional Steel Sparks + Flying Rock Chips + Dust Plume + Air Distortion
  const spLifeMax = Math.min(0.32, life * 0.75);
  if (sparks > 0 && spLifeMax >= 0.08) {
    for (let i = 0; i < sparks; i++) {
      const along = R.range(-0.35, 0.48) * effLen;
      const spreadA = yaw + R.range(-0.62, 0.62);
      const sp = R.range(4.2, 9.8);
      sim.spawnSpark({
        x: wx + fwdX * along,
        y: 0.08,
        z: wz + fwdZ * along,
        _mapped: true,
        vx: Math.sin(spreadA) * sp,
        vy: R.range(1.8, 5.2),
        vz: Math.cos(spreadA) * sp,
        life: spLifeMax * R.range(0.65, 1.0),
        size: R.range(0.038, 0.062),
        stretch: 0.042,
        color: palette[i % 2 === 0 ? 5 : 4] || '#ffe799',
      });
    }
  }

  if (rocks > 0 && life >= 0.34 && sim.spawnRockDebris) {
    sim.spawnRockDebris({
      x: wx + fwdX * effLen * 0.14,
      y: 0.10,
      z: wz + fwdZ * effLen * 0.14,
      _mapped: true,
      count: rocks,
      radius: Math.min(0.45, effLen * 0.22),
      speed0: 2.0,
      speed1: 4.8,
      up0: 2.8,
      up1: 5.4,
      size0: 0.08,
      size1: 0.16,
      life: Math.min(0.72, life * 0.84),
      style: zoneKind === 'frost' ? 'ice' : zoneKind === 'burning' ? 'basalt' : 'slate',
      palette,
    });
  }

  if (smoke && life >= 0.28) {
    sim.spawnDarkSmoke({
      x: wx + fwdX * effLen * 0.22,
      y: 0.24,
      z: wz + fwdZ * effLen * 0.22,
      _mapped: true,
      vx: fwdX * 1.4,
      vy: 0.55,
      vz: fwdZ * 1.4,
      life: Math.min(0.46, life * 0.78),
      size0: 0.52,
      size1: 1.35,
      emberHex: palette[4] || '#f8fafc',
      opacity: 0.40,
    });
  }

  if (sim.spawnAirDistortion && life >= 0.24) {
    sim.spawnAirDistortion({
      kind: 'shock',
      x: wx, y: 0.35, z: wz, _mapped: true,
      r0: 0.18,
      r1: Math.min(2.2, effLen * 0.72),
      duration: Math.min(0.28, life * 0.65),
      strength: 0.56,
    });
  }

  sim.addCustom({
    group,
    life,
    max: life,
    _skipAutoMap: true,
    update(_dt, k) {
      const pop = ease.outExpo(clamp((1 - k) * 9.0));
      const sink = smooth(0.0, 0.26, k);
      for (const c of clods) {
        c.m.scale.set(c.sx * pop, c.sy * pop * sink, c.sz * pop);
      }
      coreMat.opacity = Math.pow(k, 0.72) * 0.94;
      glowMat.opacity = Math.pow(k, 1.05) * 0.76;
      clodMat.opacity = Math.min(1, k * 3.4);
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  });
}

/**
 * Multi-Layered 3A Sonic Air-Cutter Crescent (`刀罡破空風壓`)!
 * Pairs a razor-sharp primary `SlashArc3D` with a wider translucent vacuum air-pressure wake
 * + tangential steel sparks, while strictly clamping outer reach inside `sector` hitboxes!
 */
export function spawnMartialAirCutter3D(sim, {
  center = [0, 1.08, 0.45],
  radius = 2.1,
  width = 0.85,
  thickness = 0.22,
  a0 = -1.45,
  a1 = 1.45,
  tiltX = 0,
  tiltZ = 0,
  sweep = 0.068,
  hold = 0.048,
  trail = 0.18,
  palette = PAL3D.warriorSilver,
  wakePalette = null,
  texStyle = 'auto',
  defaultTex = 'silk',
  hdrBoost = 2.45,
  sparks = 12,
  seed = 7,
} = {}) {
  if (!sim) return null;
  let safeRadius = radius;
  const hb = sim._currentHitbox;
  if (hb?.kind === 'sector' && hb.radius > 0) {
    const centerDist = Math.hypot(center[0], center[2]);
    safeRadius = Math.min(safeRadius, Math.max(0.28, hb.radius - centerDist - 0.03));
  }

  let effSweep = sweep;
  let effHold = hold;
  let effTrail = trail;
  if (sim._clipMaxDuration > 0) {
    const maxRem = sim._clipMaxDuration - (sim._simTime || 0) - 0.06;
    if (maxRem <= 0.10) return null;
    const tot = effSweep + effHold + effTrail + 0.03;
    if (tot > maxRem) {
      const k = maxRem / tot;
      effSweep *= k;
      effHold *= k;
      effTrail *= k;
    }
  }

  const mainArc = new SlashArc3D({
    center,
    radius: safeRadius,
    width: Math.min(width, safeRadius * 0.72),
    thickness,
    a0,
    a1,
    tiltX,
    tiltZ,
    sweep: effSweep,
    hold: effHold,
    trail: effTrail,
    palette,
    texStyle,
    defaultTex,
    hdrBoost,
    seed,
  });
  sim.addCustom(mainArc);

  // Secondary wider translucent vacuum air-pressure wake (`真空破風外罡`)
  const wakeR = Math.max(0.22, safeRadius * 0.93);
  const wakeArc = new SlashArc3D({
    center: [center[0], center[1] - 0.02, center[2]],
    radius: wakeR,
    width: Math.min(width * 1.30, wakeR * 0.84),
    thickness: thickness * 1.42,
    a0,
    a1,
    tiltX,
    tiltZ,
    sweep: effSweep * 1.05,
    hold: effHold * 0.95,
    trail: effTrail * 1.04,
    delay: 0.015,
    palette: wakePalette || PAL3D.windJade,
    texStyle,
    defaultTex: 'wind',
    hdrBoost: hdrBoost * 0.62,
    seed: seed + 19,
  });
  sim.addCustom(wakeArc);

  if (sparks > 0) {
    const spLife = Math.min(0.24, effSweep + effHold + effTrail);
    if (spLife >= 0.08) {
      const signDir = a1 >= a0 ? 1 : -1;
      for (let i = 0; i < sparks; i++) {
        const u = (i + 0.5) / sparks;
        const ang = lerp(a0, a1, u);
        const px = center[0] + Math.sin(ang) * safeRadius * 0.90;
        const pz = center[2] + Math.cos(ang) * safeRadius * 0.90;
        const tangX = Math.cos(ang) * signDir;
        const tangZ = -Math.sin(ang) * signDir;
        const sp = sim.R.range(3.5, 8.2);
        sim.spawnSpark({
          x: px,
          y: center[1] + sim.R.range(-0.14, 0.14),
          z: pz,
          vx: tangX * sp + Math.sin(ang) * 2.2,
          vy: sim.R.range(-0.8, 2.4),
          vz: tangZ * sp + Math.cos(ang) * 2.2,
          life: spLife * sim.R.range(0.68, 1.0),
          size: sim.R.range(0.036, 0.056),
          stretch: 0.038,
          delay: u * effSweep * 0.75,
          color: palette[i % 2 === 0 ? 5 : 4] || '#ffffff',
        });
      }
    }
  }
  return mainArc;
}

/**
 * Supersonic 3D Mach Vapor Shock-Rings + Axial Slipstream Cone!
 * Snaps concentric 3D pressure rings & supersonic vapor funnels along `p0 -> p1`
 * for spear thrusts, sniper/piercer arrows, shield charges & high-altitude arrow-rain cloud bursts!
 */
export function spawnMachShockRings3D(sim, {
  p0 = new THREE.Vector3(0, 1.15, 0.6),
  p1 = new THREE.Vector3(0, 1.15, 4.6),
  ringCount = 4,
  radius0 = 0.24,
  radius1 = 0.76,
  duration = 0.36,
  palette = PAL3D.warriorSilver,
  cone = true,
  _mapped = false,
} = {}) {
  if (!sim) return;
  if (sim._clipMaxDuration > 0) {
    const maxRem = sim._clipMaxDuration - (sim._simTime || 0) - 0.06;
    if (maxRem <= 0.12) return;
    duration = Math.min(duration, maxRem);
  }

  const wp0 = _mapped ? p0.clone() : (sim.mapSkillVec3 ? sim.mapSkillVec3(p0) : p0.clone());
  const wp1 = _mapped ? p1.clone() : (sim.mapSkillVec3 ? sim.mapSkillVec3(p1) : p1.clone());
  const aoeMul = _mapped ? 1.0 : clamp(Math.pow(sim.getAoeScale ? sim.getAoeScale() : 1.0, 0.55), 0.78, 1.45);

  const dir = wp1.clone().sub(wp0);
  const totalLen = Math.max(0.15, dir.length());
  const unitDir = dir.clone().normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), unitDir);

  const ramp = rampToColors(palette, 7);
  const group = new THREE.Group();
  const geos = [];
  const mats = [];

  const ringGeo = new THREE.RingGeometry(0.80, 1.0, 96, 4);
  ringGeo.rotateX(Math.PI / 2);
  geos.push(ringGeo);

  const coneGeo = cone ? new THREE.CylinderGeometry(0.18, 1.0, 1.0, 64, 8, true) : null;
  if (coneGeo) geos.push(coneGeo);

  const rings = [];
  for (let i = 0; i < ringCount; i++) {
    const frac = ringCount === 1 ? 0.5 : (i / (ringCount - 1));
    const pos = wp0.clone().lerp(wp1, lerp(0.08, 0.90, frac));
    const holder = new THREE.Group();
    holder.position.copy(pos);
    holder.quaternion.copy(quat);

    const rm = makeVaporMaterial(ramp[4], true);
    mats.push(rm);
    const rMesh = new THREE.Mesh(ringGeo, rm);
    holder.add(rMesh);

    let cMesh = null;
    let cm = null;
    if (coneGeo) {
      cm = makeVaporMaterial(ramp[3], false);
      mats.push(cm);
      cMesh = new THREE.Mesh(coneGeo, cm);
      cMesh.position.y = -0.32;
      holder.add(cMesh);
    }

    group.add(holder);
    rings.push({
      holder,
      rMesh,
      rm,
      cMesh,
      cm,
      delay: frac * duration * 0.34,
      targetR: lerp(radius0, radius1, 0.35 + 0.65 * (1 - frac * 0.35)) * aoeMul,
      coneLen: clamp(totalLen * 0.22, 0.35, 1.15),
    });
  }

  let el = 0;
  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      el += dt;
      for (const r of rings) {
        const localT = el - r.delay;
        const span = Math.max(0.10, duration - r.delay);
        if (localT <= 0 || localT >= span) {
          r.holder.visible = false;
          continue;
        }
        r.holder.visible = true;
        const u = clamp(localT / span);
        const curR = lerp(r.targetR * 0.28, r.targetR * 1.25, ease.outExpo(u));
        const fade = Math.pow(1 - u, 1.35);
        r.rMesh.scale.set(curR, 1, curR);
        r.rm.uniforms.uOpacity.value = fade * 0.48;
        r.rm.uniforms.uTime.value = localT;
        if (r.cMesh && r.cm) {
          r.cMesh.scale.set(curR * 0.92, r.coneLen * (0.6 + 0.6 * u), curR * 0.92);
          r.cm.uniforms.uOpacity.value = fade * 0.15;
          r.cm.uniforms.uTime.value = localT;
        }
      }
    },
    get done() { return el >= duration; },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  });
}
