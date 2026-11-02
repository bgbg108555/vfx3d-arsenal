import * as THREE from 'three';
import {
  TAU, clamp, lerp, PAL3D, rampToColors,
  makeCraggyRockGeo, makeMagmaRockMaterial, makeTranslucentConstructMaterial, makeSculptedTexturedPropMaterial,
} from './core3d.js';
import { getTexLib } from './texgen3d.js';
import { makeVaporMaterial } from './vapor3d.js';
import {
  buildBeveledBoxGeo,
  buildFulleredBladeGeo,
  buildSculptedFeatherGeo,
  buildFlutedColumnGeo,
  buildOrganicSweepTubeGeo,
  buildDragonSkullLoftGeo,
} from './bmesh_kernel3d.js';

// ============================================================================
// 1. Tangible 3D Craggy Magma Meteor + Translucent Plasma Bow-Shock Hood
// ============================================================================
export function buildMagmaMeteorAssembly({
  radius = 0.72, palette = PAL3D.fireInferno, rockColor = '#1c1210', seed = 31,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];

  const mainGeo = makeCraggyRockGeo(radius, 2, 0.34, seed, 0.94);
  const mainMat = makeMagmaRockMaterial({ palette, rockColor, veinStrength: 2.65 });
  geos.push(mainGeo); mats.push(mainMat);
  const mainRock = new THREE.Mesh(mainGeo, mainMat);
  group.add(mainRock);

  const haloGeo = new THREE.SphereGeometry(radius * 1.24, 28, 20);
  const haloMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: null, useHexLattice: false,
    baseAlpha: 0.08, rimAlpha: 0.78, rimPower: 2.4, hdr: 2.15, additive: true,
  });
  geos.push(haloGeo); mats.push(haloMat);
  const halo = new THREE.Mesh(haloGeo, haloMat);
  group.add(halo);

  const satellites = [];
  for (let i = 0; i < 3; i++) {
    const sGeo = makeCraggyRockGeo(radius * 0.22, 1, 0.34, seed + 19 * (i + 1), 0.9);
    const sMat = makeMagmaRockMaterial({ palette, rockColor, veinStrength: 2.2 });
    geos.push(sGeo); mats.push(sMat);
    const sMesh = new THREE.Mesh(sGeo, sMat);
    group.add(sMesh);
    satellites.push({
      mesh: sMesh, mat: sMat,
      ang: (i / 3) * TAU,
      orbitR: radius * (1.42 + i * 0.14),
      tilt: (i - 1) * 0.48,
      speed: 5.2 + i * 1.2,
    });
  }

  let spinT = 0;
  return {
    group,
    update(dt, age = 0) {
      spinT += dt;
      mainRock.rotation.x += dt * 4.2;
      mainRock.rotation.y += dt * 5.8;
      haloMat.uniforms.uTime.value = spinT * 2.2;
      mainMat.uniforms.uAge.value = age * 0.32;
      for (const s of satellites) {
        const a = s.ang + spinT * s.speed;
        s.mesh.position.set(
          Math.cos(a) * s.orbitR,
          Math.sin(a * 1.3) * radius * 0.42 + s.tilt * 0.2,
          Math.sin(a) * s.orbitR
        );
        s.mesh.rotation.x += dt * 8.0;
        s.mesh.rotation.y += dt * 6.5;
      }
    },
    setOpacity(alpha) {
      mainMat.uniforms.uOpacity.value = alpha;
      haloMat.uniforms.uOpacity.value = alpha;
      haloMat.uniforms.uDissolve.value = clamp(1 - alpha, 0, 1) * 0.9;
      satellites.forEach((s) => { s.mat.uniforms.uOpacity.value = alpha; });
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

// ============================================================================
// 2. AAA Semi-Transparent Holographic Rose-Window Paladin Aegis Shield
// ============================================================================
function evalAegisContour(vNorm) {
  const y = lerp(-0.86, 0.76, vNorm);
  let halfW;
  if (vNorm < 0.76) {
    halfW = 0.62 * Math.pow(Math.sin((vNorm / 0.76) * (Math.PI * 0.5)), 0.68);
  } else {
    const t = (vNorm - 0.76) / 0.24;
    halfW = 0.62 * Math.cos(t * Math.PI * 0.46);
  }
  return { y, halfW };
}

export function buildTowerShieldAssembly({
  palette = PAL3D.holyGold, scale = 1.0, sigilStyle = null,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const segU = 36, segV = 28;
  const pos = [], uvs = [], idx = [];
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const { y, halfW } = evalAegisContour(v);
    const crownLift = v > 0.75 ? Math.sin(((v - 0.75) / 0.25) * Math.PI * 0.5) * 0.06 : 0;
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const s = u * 2 - 1;
      const x = s * halfW;
      const z = 0.14 * (1 - s * s * 0.85) - Math.pow(y * 0.65, 2) * 0.12;
      pos.push(x, y + crownLift * (1 - s * s), z);
      uvs.push(u, v);
    }
  }
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu, b = a + segU + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const shieldGeo = new THREE.BufferGeometry();
  shieldGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shieldGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  shieldGeo.setIndex(idx);
  shieldGeo.computeVertexNormals();
  geos.push(shieldGeo);

  const shieldMat = makeTranslucentConstructMaterial({
    palette,
    sigilStyle,
    useHexLattice: true,
    baseAlpha: 0.075,
    rimAlpha: 0.76,
    rimPower: 2.45,
    hdr: 1.35,
    additive: false,
    hexRepeat: [5.0, 5.0],
  });
  mats.push(shieldMat);
  group.add(new THREE.Mesh(shieldGeo, shieldMat));

  const borderPts = [];
  for (let i = 0; i <= 32; i++) {
    const v = i / 32;
    const { y, halfW } = evalAegisContour(v);
    const z = 0.14 * 0.15 - Math.pow(y * 0.65, 2) * 0.12;
    borderPts.push(new THREE.Vector3(halfW, y, z));
  }
  for (let i = 31; i >= 0; i--) {
    const v = i / 32;
    const { y, halfW } = evalAegisContour(v);
    const z = 0.14 * 0.15 - Math.pow(y * 0.65, 2) * 0.12;
    borderPts.push(new THREE.Vector3(-halfW, y, z));
  }
  const frameCurve = new THREE.CatmullRomCurve3(borderPts, true);
  const frameGeo = new THREE.TubeGeometry(frameCurve, 84, 0.018, 8, true);
  const frameMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.65),
    transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  geos.push(frameGeo); mats.push(frameMat);
  group.add(new THREE.Mesh(frameGeo, frameMat));

  const wingFeatherGeo = new THREE.OctahedronGeometry(1, 0);
  geos.push(wingFeatherGeo);
  const wingMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: null, useHexLattice: false,
    baseAlpha: 0.18, rimAlpha: 0.92, rimPower: 1.8, hdr: 2.1, additive: true,
  });
  mats.push(wingMat);

  const feathers = [];
  for (const sgn of [-1, 1]) {
    for (let f = 0; f < 3; f++) {
      const m = new THREE.Mesh(wingFeatherGeo, wingMat);
      const len = 0.46 - f * 0.08;
      m.scale.set(0.055, len, 0.022);
      const baseX = sgn * (0.64 + f * 0.09);
      const baseY = 0.24 - f * 0.22;
      const baseRotZ = -sgn * (0.42 + f * 0.24);
      m.position.set(baseX, baseY, -0.02 - f * 0.03);
      m.rotation.set(0.15, sgn * 0.22, baseRotZ);
      group.add(m);
      feathers.push({ m, sgn, baseRotZ });
    }
  }

  group.scale.setScalar(scale);
  let clock = 0;
  let flash = 0;

  return {
    group,
    triggerFlash(hitOffset = new THREE.Vector3(0, 0.08, 0.12)) {
      flash = 1.0;
      shieldMat.uniforms.uHitPos.value.copy(hitOffset);
      shieldMat.uniforms.uHitTime.value = clock;
    },
    update(dt) {
      clock += dt;
      flash = Math.max(0, flash - dt * 4.5);
      shieldMat.uniforms.uTime.value = clock;
      shieldMat.uniforms.uFlash.value = flash;
      wingMat.uniforms.uTime.value = clock;
      wingMat.uniforms.uFlash.value = flash;
      for (const f of feathers) {
        f.m.rotation.z = f.baseRotZ - f.sgn * flash * 0.22 + Math.sin(clock * 5.0) * 0.04 * f.sgn;
      }
    },
    setOpacity(a) {
      shieldMat.uniforms.uOpacity.value = a;
      shieldMat.uniforms.uDissolve.value = clamp(1 - a, 0, 1) * 0.92;
      wingMat.uniforms.uOpacity.value = a;
      frameMat.opacity = a * 0.85;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

// ============================================================================
// 3. AAA Semi-Transparent Crystalline Astral Greatsword / Spirit Blade
// ============================================================================
export function buildSpiritSwordAssembly({
  palette = PAL3D.warriorGold, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const bladeGeo = buildFulleredBladeGeo({
    length: 1.36,
    yOffset: 0.0,
    baseHalfW: 0.118,
    ricassoFlare: 1.20,
    midHalfW: 0.090,
    tipStartFrac: 0.72,
    thickness: 0.040,
    fullerDepth: 0.014,
    fullerEndFrac: 0.68,
    segsY: 26,
  });
  geos.push(bladeGeo);

  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xcbdff6, metalness: 0.24, roughness: 0.31,
    emissive: 0x233b5a, emissiveIntensity: 0.85, transparent: true,
  });
  const guardMat = new THREE.MeshStandardMaterial({
    color: 0xd3a255, metalness: 0.36, roughness: 0.35, transparent: true,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x30202a, metalness: 0.12, roughness: 0.72, transparent: true,
  });
  const gemMat = new THREE.MeshStandardMaterial({
    color: 0x46ace3, emissive: 0x135c9a, emissiveIntensity: 0.45,
    metalness: 0.2, roughness: 0.18, transparent: true,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: ramp[4].clone(), transparent: true, opacity: 0.72, depthWrite: false,
  });
  mats.push(bladeMat, guardMat, gripMat, gemMat, coreMat);
  group.add(new THREE.Mesh(bladeGeo, bladeMat));

  const guardCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.34, 0.14, 0),
    new THREE.Vector3(-0.16, 0.01, 0.02),
    new THREE.Vector3(0.00, -0.02, 0),
    new THREE.Vector3(0.16, 0.01, -0.02),
    new THREE.Vector3(0.34, 0.14, 0),
  ]);
  const guardGeo = new THREE.TubeGeometry(guardCurve, 28, 0.024, 8, false);
  const ringGeo = new THREE.TorusGeometry(0.19, 0.012, 8, 32);
  const fullerGeo = new THREE.OctahedronGeometry(1, 0);
  const gripGeo = new THREE.CylinderGeometry(0.024, 0.018, 0.30, 12);
  const pommelGeo = new THREE.OctahedronGeometry(0.058, 0);
  const gemGeo = new THREE.OctahedronGeometry(0.065, 0);
  geos.push(guardGeo, ringGeo, fullerGeo, gripGeo, pommelGeo, gemGeo);

  const guard = new THREE.Mesh(guardGeo, guardMat);
  const haloRing = new THREE.Mesh(ringGeo, coreMat);
  haloRing.position.set(0, 0.12, 0);

  const fuller = new THREE.Mesh(fullerGeo, coreMat);
  fuller.scale.set(0.008, 0.53, 0.045);
  fuller.position.set(0, 0.54, 0);

  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.position.set(0, -0.16, 0);

  const pommel = new THREE.Mesh(pommelGeo, coreMat);
  pommel.position.set(0, -0.34, 0);

  const gem = new THREE.Mesh(gemGeo, gemMat);
  gem.scale.set(1, 1.3, 0.65);
  gem.position.set(0, 0.075, 0.065);

  group.add(guard, haloRing, fuller, grip, pommel, gem);
  group.scale.setScalar(scale);

  let animT = 0;
  return {
    group,
    update(dt = 0) {
      animT += dt;
      gemMat.emissiveIntensity = 0.45 + 0.08 * Math.sin(animT * 2.0);
    },
    setOpacity(a) {
      bladeMat.opacity = a;
      guardMat.opacity = a;
      gripMat.opacity = a;
      gemMat.opacity = a;
      coreMat.opacity = a * 0.72;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

// ============================================================================
// 4. Semi-Transparent Phantom Soul-Chain Strand + Sculpted Astral Harpoon
// ============================================================================
export function buildChainStrandAssembly(arg0 = {}, arg1 = null, arg2 = {}) {
  const isPositional = arg0 && arg0.isVector3;
  const cfg = isPositional ? { p0: arg0, p1: arg1, ...arg2 } : arg0;
  const { p0, p1, sag = 0.28, linkCount = 16, palette = PAL3D.voidAbyss } = cfg;
  const group = new THREE.Group();
  const ramp = rampToColors(palette, 7);
  const linkGeo = new THREE.TorusGeometry(0.082, 0.022, 8, 20);
  linkGeo.scale(1.52, 0.85, 1.0);

  const tipGeo = new THREE.OctahedronGeometry(1, 0);
  tipGeo.scale(0.28, 0.085, 0.085);

  const holoMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: null, useHexLattice: false,
    baseAlpha: 0.24, rimAlpha: 0.95, rimPower: 1.85, hdr: 2.1, additive: true,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.85),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const links = [];
  for (let i = 0; i < linkCount; i++) {
    const m = new THREE.Mesh(linkGeo, i % 2 === 0 ? holoMat : glowMat);
    group.add(m);
    links.push(m);
  }
  const harpoon = new THREE.Mesh(tipGeo, holoMat);
  const harpoonCore = new THREE.Mesh(tipGeo, glowMat);
  harpoonCore.scale.setScalar(0.58);
  harpoon.add(harpoonCore);
  group.add(harpoon);

  const xAxis = new THREE.Vector3(1, 0, 0);
  const tmpPos = new THREE.Vector3(), tmpNext = new THREE.Vector3(), tmpDir = new THREE.Vector3();

  const layout = (extendFrac = 1.0, curSag = sag) => {
    const maxU = clamp(extendFrac, 0.05, 1.0);
    for (let i = 0; i < linkCount; i++) {
      const u = (i / Math.max(1, linkCount - 1)) * maxU;
      const uNext = Math.min(1.0, u + 0.05);
      tmpPos.lerpVectors(p0, p1, u);
      tmpPos.y -= Math.sin(u * Math.PI) * curSag;
      tmpNext.lerpVectors(p0, p1, uNext);
      tmpNext.y -= Math.sin(uNext * Math.PI) * curSag;

      tmpDir.subVectors(tmpNext, tmpPos);
      if (tmpDir.lengthSq() < 1e-6) tmpDir.set(0, 0, 1);
      tmpDir.normalize();

      const m = links[i];
      m.position.copy(tmpPos);
      m.quaternion.setFromUnitVectors(xAxis, tmpDir);
      if (i % 2 === 1) m.rotateX(Math.PI / 2);
      m.visible = i <= Math.ceil(extendFrac * linkCount);
    }
    tmpPos.lerpVectors(p0, p1, maxU);
    tmpPos.y -= Math.sin(maxU * Math.PI) * curSag;
    harpoon.position.copy(tmpPos);
    harpoon.quaternion.setFromUnitVectors(xAxis, tmpDir);
  };

  layout(isPositional ? 1.0 : 0.1, sag);
  let chT = 0;
  return {
    group,
    layout,
    update(dt = 0) {
      chT += dt;
      holoMat.uniforms.uTime.value = chT * 2.0;
    },
    setOpacity(a) {
      holoMat.uniforms.uOpacity.value = a;
      glowMat.opacity = a * 0.9;
    },
    dispose() {
      linkGeo.dispose();
      tipGeo.dispose();
      holoMat.dispose();
      glowMat.dispose();
    },
  };
}

// ============================================================================
// 5. AAA Semi-Transparent Storm-Crystal Runic Warhammer + Floating Valknut Seals
// ============================================================================
export function buildWarhammerAssembly({
  palette = PAL3D.mageVolt, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const crystalMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: 'war', useHexLattice: true,
    baseAlpha: 0.22, rimAlpha: 0.94, rimPower: 1.95, hdr: 2.1, additive: true,
  });
  const runeMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.9),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(crystalMat, runeMat);

  const headGeo = buildBeveledBoxGeo(0.78, 0.54, 0.54, 0.065, 2);
  const faceGeo = buildBeveledBoxGeo(0.16, 0.64, 0.64, 0.038, 2);
  const sealRingGeo = new THREE.TorusGeometry(0.42, 0.018, 10, 44);
  sealRingGeo.rotateY(Math.PI / 2);
  const haftGeo = buildFlutedColumnGeo({
    rBottom: 0.038, rTop: 0.050, height: 1.88, flutes: 8, fluteDepth: 0.006, twist: 0.85, radialSegs: 28, heightSegs: 16,
  });
  const crownSpikeGeo = new THREE.OctahedronGeometry(1, 1);
  geos.push(headGeo, faceGeo, sealRingGeo, haftGeo, crownSpikeGeo);

  group.add(new THREE.Mesh(headGeo, crystalMat));
  for (const sgn of [-1, 1]) {
    const f = new THREE.Mesh(faceGeo, crystalMat);
    f.position.x = sgn * 0.44;
    group.add(f);
    const r = new THREE.Mesh(sealRingGeo, runeMat);
    r.position.x = sgn * 0.53;
    group.add(r);
  }
  const haft = new THREE.Mesh(haftGeo, crystalMat);
  haft.position.y = -0.96;
  const topSpike = new THREE.Mesh(crownSpikeGeo, runeMat);
  topSpike.scale.set(0.09, 0.34, 0.09);
  topSpike.position.y = 0.48;
  group.add(haft, topSpike);
  group.scale.setScalar(scale);

  let hmT = 0;
  return {
    group,
    update(dt = 0) {
      hmT += dt;
      crystalMat.uniforms.uTime.value = hmT * 2.0;
    },
    setOpacity(a) {
      crystalMat.uniforms.uOpacity.value = a;
      crystalMat.uniforms.uDissolve.value = clamp(1 - a, 0, 1) * 0.9;
      runeMat.opacity = a * 0.9;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

// ============================================================================
// 6. AAA Semi-Transparent Levitating Runic Crystal Obelisk Totem
// ============================================================================
export function buildTotemObeliskAssembly({
  palette = PAL3D.fireInferno, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const crystalMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: 'crescent', useHexLattice: true,
    baseAlpha: 0.22, rimAlpha: 0.92, rimPower: 2.0, hdr: 2.05, additive: true,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.9),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(crystalMat, glowMat);

  const plinthGeo = new THREE.CylinderGeometry(0.46, 0.58, 0.24, 6);
  plinthGeo.translate(0, 0.12, 0);
  const spireGeo = new THREE.CylinderGeometry(0.16, 0.38, 1.52, 6);
  spireGeo.translate(0, 1.02, 0);
  const capGeo = new THREE.ConeGeometry(0.22, 0.38, 6);
  capGeo.translate(0, 1.98, 0);
  const ringGeo1 = new THREE.TorusGeometry(0.58, 0.018, 8, 40);
  ringGeo1.rotateX(Math.PI / 2);
  const ringGeo2 = new THREE.TorusGeometry(0.42, 0.014, 8, 32);
  ringGeo2.rotateX(Math.PI / 2);
  const coreGeo = new THREE.OctahedronGeometry(0.22, 1);
  geos.push(plinthGeo, spireGeo, capGeo, ringGeo1, ringGeo2, coreGeo);

  const plinth = new THREE.Mesh(plinthGeo, crystalMat);
  const spire = new THREE.Mesh(spireGeo, crystalMat);
  const cap = new THREE.Mesh(capGeo, crystalMat);
  const ring1 = new THREE.Mesh(ringGeo1, glowMat);
  ring1.position.y = 1.15;
  const ring2 = new THREE.Mesh(ringGeo2, glowMat);
  ring2.position.y = 1.65;
  const brazierCore = new THREE.Mesh(coreGeo, glowMat);
  brazierCore.position.y = 2.05;

  group.add(plinth, spire, cap, ring1, ring2, brazierCore);
  group.scale.setScalar(scale);

  let clock = 0;
  return {
    group,
    topOffsetY: 2.05 * scale,
    update(dt) {
      clock += dt;
      crystalMat.uniforms.uTime.value = clock;
      ring1.rotation.z += dt * 2.4;
      ring2.rotation.z -= dt * 3.6;
      cap.position.y = Math.sin(clock * 4.0) * 0.05;
      brazierCore.rotation.y += dt * 4.5;
      brazierCore.rotation.x += dt * 2.8;
    },
    setOpacity(a) {
      crystalMat.uniforms.uOpacity.value = a;
      crystalMat.uniforms.uDissolve.value = clamp(1 - a, 0, 1) * 0.9;
      glowMat.opacity = a * 0.92;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

// ============================================================================
// 7. AAA Semi-Transparent Spirit Arrow / Dragon-Piercer Lance (+Y = Tip!)
// ============================================================================
export function buildArrowAssembly({
  palette = PAL3D.windJade, scale = 1.0, heavy = false,
} = {}) {
  const group = new THREE.Group();
  const spinGroup = new THREE.Group();
  group.add(spinGroup);
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const holoMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: null, useHexLattice: false,
    baseAlpha: 0.26, rimAlpha: 0.96, rimPower: 1.75, hdr: 2.2, additive: true,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: ramp[6].clone().multiplyScalar(2.0),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(holoMat, coreMat);

  const shaftGeo = new THREE.CylinderGeometry(0.014, 0.011, 0.84, 8);
  shaftGeo.translate(0, -0.06, 0);
  const headGeo = new THREE.OctahedronGeometry(1, 0);
  headGeo.scale(0.065 * (heavy ? 1.45 : 1.0), 0.22 * (heavy ? 1.35 : 1.0), 0.028);
  headGeo.translate(0, 0.42, 0);
  const vaneGeo = new THREE.OctahedronGeometry(1, 0);
  vaneGeo.scale(0.048, 0.14, 0.010);
  geos.push(shaftGeo, headGeo, vaneGeo);

  spinGroup.add(new THREE.Mesh(shaftGeo, coreMat));
  spinGroup.add(new THREE.Mesh(headGeo, holoMat));

  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(vaneGeo, holoMat);
    const a = (i / 3) * TAU;
    f.position.set(Math.cos(a) * 0.032, -0.40, Math.sin(a) * 0.032);
    f.rotation.y = -a;
    f.rotation.z = -0.18;
    spinGroup.add(f);
  }

  let machCone = null;
  let machMat = null;
  if (heavy) {
    const coneGeo = new THREE.ConeGeometry(0.24, 0.56, 64, 8, true);
    coneGeo.translate(0, 0.20, 0);
    geos.push(coneGeo);
    machMat = makeVaporMaterial(ramp[4], false);
    machMat.uniforms.uOpacity.value = 0.18;
    mats.push(machMat);
    machCone = new THREE.Mesh(coneGeo, machMat);
    spinGroup.add(machCone);
  }

  group.scale.setScalar(scale);
  return {
    group,
    update(dt) {
      spinGroup.rotation.y += dt * (heavy ? 18.0 : 9.0);
      if (machCone) machCone.rotation.y -= dt * 24.0;
      if (machMat) machMat.uniforms.uTime.value += dt;
    },
    setOpacity(a) {
      holoMat.uniforms.uOpacity.value = a;
      coreMat.opacity = a;
      if (machMat) machMat.uniforms.uOpacity.value = a * 0.18;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

// ============================================================================
// 8. AAA Sculpted Crescent Reaper Scythe (Curved Beveled Crescent Blade + Spine Thorns)
// ============================================================================
export function buildReaperScytheAssembly({
  palette = PAL3D.rogueBlood, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const bladeMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: 'bloodbone', useHexLattice: false,
    baseAlpha: 0.24, rimAlpha: 0.96, rimPower: 1.8, hdr: 2.25, additive: true,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.95),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(bladeMat, coreMat);

  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.00, -1.05, 0),
    new THREE.Vector3(-0.06, -0.35, 0),
    new THREE.Vector3(0.05, 0.35, 0),
    new THREE.Vector3(0.00, 0.88, 0),
  ]);
  const shaftGeo = new THREE.TubeGeometry(shaftCurve, 32, 0.028, 10, false);
  geos.push(shaftGeo);
  group.add(new THREE.Mesh(shaftGeo, bladeMat));

  const pos = [], idx = [];
  const segs = 9;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const ang = lerp(-0.12, 1.38, u);
    const rad = lerp(0.12, 1.18, Math.pow(u, 0.82));
    const cx = Math.sin(ang) * rad;
    const cy = 0.84 + Math.cos(ang) * 0.28 - u * 0.42;
    const w = Math.sin(Math.pow(1 - u * 0.88, 0.7) * Math.PI * 0.85) * 0.16 * (1 - u * 0.72) + 0.004;
    const tz = 0.032 * (1 - u * 0.82) + 0.002;
    const nx = -Math.cos(ang), ny = Math.sin(ang);
    pos.push(
      cx, cy, tz,
      cx + nx * w * 0.45, cy + ny * w * 0.45, 0,
      cx, cy, -tz,
      cx - nx * w * 1.15, cy - ny * w * 1.15, 0
    );
    if (i < segs) {
      const b = i * 4, n = (i + 1) * 4;
      for (let s = 0; s < 4; s++) {
        const ns = (s + 1) % 4;
        idx.push(b + s, b + ns, n + ns, b + s, n + ns, n + s);
      }
    }
  }
  const bInd = new THREE.BufferGeometry();
  bInd.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bInd.setIndex(idx);
  const crescentGeo = bInd.toNonIndexed();
  bInd.dispose();
  crescentGeo.computeVertexNormals();
  geos.push(crescentGeo);
  group.add(new THREE.Mesh(crescentGeo, bladeMat));

  const eyeGeo = new THREE.OctahedronGeometry(0.095, 1);
  const ringGeo = new THREE.TorusGeometry(0.18, 0.012, 8, 32);
  const thornGeo = new THREE.ConeGeometry(0.038, 0.22, 4);
  geos.push(eyeGeo, ringGeo, thornGeo);

  const eye = new THREE.Mesh(eyeGeo, coreMat);
  eye.position.set(0.02, 0.86, 0);
  const halo = new THREE.Mesh(ringGeo, coreMat);
  halo.position.set(0.02, 0.86, 0);
  group.add(eye, halo);

  for (let k = 0; k < 3; k++) {
    const th = new THREE.Mesh(thornGeo, coreMat);
    th.position.set(-0.08 - k * 0.05, 0.94 - k * 0.11, 0);
    th.rotation.z = 0.85 + k * 0.22;
    group.add(th);
  }

  group.scale.setScalar(scale);
  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      bladeMat.uniforms.uTime.value = t * 2.1;
      halo.rotation.z -= dt * 3.5;
      eye.rotation.y += dt * 4.5;
    },
    setOpacity(a) {
      bladeMat.uniforms.uOpacity.value = a;
      bladeMat.uniforms.uDissolve.value = clamp(1 - a, 0, 1) * 0.9;
      coreMat.opacity = a * 0.92;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

// ============================================================================
// 9. AAA 3-Axis Geared Armillary Astrolabe Gyroscope Sphere
// ============================================================================
export function buildArmillaryAstrolabeAssembly({
  palette = PAL3D.holyGold, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const holoMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: 'solomon', useHexLattice: true,
    baseAlpha: 0.22, rimAlpha: 0.94, rimPower: 1.9, hdr: 2.15, additive: true,
  });
  const goldMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.9),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(holoMat, goldMat);

  const toothGeo = new THREE.OctahedronGeometry(0.048, 0);
  const starCoreGeo = new THREE.OctahedronGeometry(0.24, 0);
  geos.push(toothGeo, starCoreGeo);

  const coreA = new THREE.Mesh(starCoreGeo, holoMat);
  const coreB = new THREE.Mesh(starCoreGeo, goldMat);
  coreB.scale.setScalar(0.58);
  coreB.rotation.set(0.78, 0.78, 0);
  group.add(coreA, coreB);

  const rings = [0.52, 0.76, 1.0].map((r, idx) => {
    const holder = new THREE.Group();
    const rg = new THREE.TorusGeometry(r * 0.78, 0.022, 8, 56);
    geos.push(rg);
    holder.add(new THREE.Mesh(rg, idx === 1 ? goldMat : holoMat));
    const teeth = 8 + idx * 4;
    for (let k = 0; k < teeth; k++) {
      const a = (k / teeth) * TAU;
      const tm = new THREE.Mesh(toothGeo, goldMat);
      tm.position.set(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, 0);
      tm.rotation.z = a;
      tm.scale.set(0.6, 1.6, 0.6);
      holder.add(tm);
    }
    group.add(holder);
    return holder;
  });

  group.scale.setScalar(scale);
  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      holoMat.uniforms.uTime.value = t * 2.0;
      coreA.rotation.y += dt * 2.8;
      coreB.rotation.x -= dt * 3.6;
      rings[0].rotation.set(t * 2.4, t * 1.5, 0);
      rings[1].rotation.set(-t * 1.8, 0.6, t * 2.1);
      rings[2].rotation.set(0.45, -t * 1.4, -t * 1.1);
    },
    setOpacity(a) {
      holoMat.uniforms.uOpacity.value = a;
      goldMat.opacity = a * 0.9;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

// ============================================================================
// 10. AAA 12-Blade Articulated Seraphic / Phoenix Crystal Wings
// ============================================================================
export function buildSeraphWingsAssembly({
  palette = PAL3D.holyGold, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const wingMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: 'holy', useHexLattice: false,
    baseAlpha: 0.20, rimAlpha: 0.95, rimPower: 1.8, hdr: 2.25, additive: true,
  });
  const crestMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.95),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(wingMat, crestMat);

  const featherGeo = buildSculptedFeatherGeo({
    length: 1.0, width: 0.18, thickness: 0.036, curveX: 0.09, camberZ: 0.04, segsY: 16,
  });
  const haloGeo = new THREE.TorusGeometry(0.24, 0.016, 10, 44);
  geos.push(featherGeo, haloGeo);

  const centerHalo = new THREE.Mesh(haloGeo, crestMat);
  centerHalo.position.set(0, 0.28, 0);
  group.add(centerHalo);

  const blades = [];
  for (const sgn of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(featherGeo, wingMat);
      const len = 0.88 - k * 0.082;
      m.scale.set(sgn * (0.95 - k * 0.05), len, 1.0);
      const bx = sgn * (0.20 + k * 0.16);
      const by = 0.34 - k * 0.12;
      const bz = -Math.abs(k - 2) * 0.03;
      const baseZ = -sgn * (0.38 + k * 0.22);
      m.position.set(bx, by, bz);
      m.rotation.set(0.14, sgn * 0.24, baseZ);
      group.add(m);
      blades.push({ m, sgn, k, baseZ });
    }
  }

  group.scale.setScalar(scale);
  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      wingMat.uniforms.uTime.value = t * 2.2;
      centerHalo.rotation.z += dt * 1.8;
      for (const b of blades) {
        b.m.rotation.z = b.baseZ - b.sgn * Math.sin(t * 3.4 + b.k * 0.35) * 0.08;
      }
    },
    setOpacity(a) {
      wingMat.uniforms.uOpacity.value = a;
      crestMat.opacity = a * 0.9;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

// ============================================================================
// 11. AAA Sculpted Draconic Spirit Head (Horned Crystal Skull + Jaw + Whiskers + Pearl)
// ============================================================================
export function buildDragonSpiritHeadAssembly({
  palette = PAL3D.fireInferno, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const dragonMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: 'dragonFlame', useHexLattice: true,
    baseAlpha: 0.24, rimAlpha: 0.96, rimPower: 1.85, hdr: 2.3, additive: true,
  });
  const pearlMat = new THREE.MeshBasicMaterial({
    color: ramp[6].clone().multiplyScalar(2.1),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(dragonMat, pearlMat);

  const snoutGeo = buildDragonSkullLoftGeo({ isJaw: false });
  const jawGeo = buildDragonSkullLoftGeo({ isJaw: true });

  const pearlGeo = new THREE.IcosahedronGeometry(0.13, 2);
  const eyeGeo = new THREE.OctahedronGeometry(0.065, 1);
  const fangGeo = new THREE.ConeGeometry(0.024, 0.11, 8);
  fangGeo.rotateX(Math.PI);
  geos.push(snoutGeo, jawGeo, pearlGeo, eyeGeo, fangGeo);

  const upperHead = new THREE.Mesh(snoutGeo, dragonMat);
  const lowerJaw = new THREE.Mesh(jawGeo, dragonMat);
  const pearl = new THREE.Mesh(pearlGeo, pearlMat);
  pearl.position.set(0, -0.02, 0.38);
  group.add(upperHead, lowerJaw, pearl);

  for (const sgn of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, pearlMat);
    eye.scale.set(0.62, 0.58, 1.85);
    eye.position.set(sgn * 0.22, 0.17, 0.12);
    group.add(eye);

    for (let f = 0; f < 3; f++) {
      const fang = new THREE.Mesh(fangGeo, pearlMat);
      fang.position.set(sgn * (0.14 - f * 0.025), 0.02, 0.24 + f * 0.12);
      upperHead.add(fang);
    }

    const hGeo = buildOrganicSweepTubeGeo({
      points: [
        new THREE.Vector3(sgn * 0.17, 0.22, -0.04),
        new THREE.Vector3(sgn * 0.36, 0.45, -0.32),
        new THREE.Vector3(sgn * 0.30, 0.72, -0.72),
      ],
      r0: 0.056, r1: 0.005, radialSegs: 12, tubularSegs: 26, ridgeCount: 6, ridgeAmp: 0.18, twistTurns: 0.9,
    });
    geos.push(hGeo);
    group.add(new THREE.Mesh(hGeo, dragonMat));

    const wGeo = buildOrganicSweepTubeGeo({
      points: [
        new THREE.Vector3(sgn * 0.15, 0.06, 0.46),
        new THREE.Vector3(sgn * 0.42, 0.12, 0.18),
        new THREE.Vector3(sgn * 0.54, -0.04, -0.28),
      ],
      r0: 0.018, r1: 0.002, radialSegs: 8, tubularSegs: 22, ridgeCount: 3, ridgeAmp: 0.08, twistTurns: 0.5,
    });
    geos.push(wGeo);
    group.add(new THREE.Mesh(wGeo, pearlMat));
  }

  group.scale.setScalar(scale);
  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      dragonMat.uniforms.uTime.value = t * 2.4;
      lowerJaw.rotation.x = 0.08 + Math.sin(t * 6.0) * 0.08;
      pearl.scale.setScalar(0.92 + Math.sin(t * 12.0) * 0.12);
    },
    setOpacity(a) {
      dragonMat.uniforms.uOpacity.value = a;
      pearlMat.opacity = a * 0.95;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

// ============================================================================
// 12. AAA Lathe-Sculpted Ceremonial Holy Chalice / Elixir Sanctuary Vessel
// ============================================================================
export function buildHolyChaliceAssembly({
  palette = PAL3D.holyGold, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const cupMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: 'holy', useHexLattice: true,
    baseAlpha: 0.22, rimAlpha: 0.94, rimPower: 2.0, hdr: 2.15, additive: true,
  });
  const nectarMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(2.0),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(cupMat, nectarMat);

  const lathePts = [
    new THREE.Vector2(0.00, -0.62),
    new THREE.Vector2(0.34, -0.62),
    new THREE.Vector2(0.28, -0.54),
    new THREE.Vector2(0.08, -0.42),
    new THREE.Vector2(0.06, -0.12),
    new THREE.Vector2(0.14, -0.02),
    new THREE.Vector2(0.32, 0.18),
    new THREE.Vector2(0.42, 0.48),
    new THREE.Vector2(0.38, 0.52),
    new THREE.Vector2(0.28, 0.22),
    new THREE.Vector2(0.00, 0.06),
  ];
  const cupGeo = new THREE.LatheGeometry(lathePts, 28);
  const liquidGeo = new THREE.CylinderGeometry(0.33, 0.18, 0.12, 24);
  liquidGeo.translate(0, 0.36, 0);
  const crownGeo = new THREE.TorusGeometry(0.46, 0.014, 8, 36);
  crownGeo.rotateX(Math.PI / 2);
  const dropGeo = new THREE.OctahedronGeometry(0.075, 1);
  geos.push(cupGeo, liquidGeo, crownGeo, dropGeo);

  group.add(new THREE.Mesh(cupGeo, cupMat));
  group.add(new THREE.Mesh(liquidGeo, nectarMat));
  const crown = new THREE.Mesh(crownGeo, nectarMat);
  crown.position.y = 0.56;
  const drop = new THREE.Mesh(dropGeo, nectarMat);
  drop.position.y = 0.72;
  group.add(crown, drop);

  group.scale.setScalar(scale);
  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      cupMat.uniforms.uTime.value = t * 2.0;
      crown.rotation.z += dt * 2.5;
      drop.position.y = 0.72 + Math.sin(t * 4.5) * 0.07;
      drop.rotation.y += dt * 3.8;
    },
    setOpacity(a) {
      cupMat.uniforms.uOpacity.value = a;
      nectarMat.opacity = a * 0.92;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

// ============================================================================
// 13. Qimen Outer-Circle Inner-Square 3D Bagua Compass (奇門外圓內方立體羅盤樞)
// ============================================================================
export function buildQimenCompassAssembly({
  palette = PAL3D.holyGold, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const jadeMat = makeSculptedTexturedPropMaterial({
    palette, materialKind: 'imperial_jade_bronze', texScale: 1.95, bumpStrength: 3.0, opacity: 0.96, hdr: 1.55,
  });
  const steelMat = makeSculptedTexturedPropMaterial({
    palette, materialKind: 'damascus_steel', texScale: 2.2, bumpStrength: 2.8, opacity: 0.96, hdr: 1.45,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.85),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(jadeMat, steelMat, glowMat);

  // Outer celestial Bagua ring + 8 beveled trigram monoliths
  const outerHolder = new THREE.Group();
  const gOuterRing = new THREE.TorusGeometry(0.84, 0.048, 14, 72);
  const gRimThin = new THREE.TorusGeometry(0.92, 0.016, 10, 72);
  const gTooth = buildBeveledBoxGeo(0.12, 0.068, 0.22, 0.016, 2);
  geos.push(gOuterRing, gRimThin, gTooth);
  outerHolder.add(
    new THREE.Mesh(gOuterRing, jadeMat).rotateX(Math.PI / 2),
    new THREE.Mesh(gRimThin, glowMat).rotateX(Math.PI / 2)
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const m = new THREE.Mesh(gTooth, steelMat);
    m.position.set(Math.cos(a) * 0.84, 0, Math.sin(a) * 0.84);
    m.rotation.y = -a;
    outerHolder.add(m);
  }

  // Middle counter-rotating 24-mountain astrolabe ring
  const midHolder = new THREE.Group();
  const gMidRing = new THREE.TorusGeometry(0.58, 0.034, 10, 48);
  geos.push(gMidRing);
  midHolder.add(new THREE.Mesh(gMidRing, steelMat).rotateX(Math.PI / 2));

  // Inner Square 3x3 Nine-Palace Earth Seal (外圓內方!)
  const squareHolder = new THREE.Group();
  const gSquareFrame = buildBeveledBoxGeo(0.68, 0.064, 0.68, 0.018, 2);
  const gBar = buildBeveledBoxGeo(0.66, 0.074, 0.032, 0.008, 1);
  const gCore = new THREE.OctahedronGeometry(0.16, 2);
  geos.push(gSquareFrame, gBar, gCore);
  squareHolder.add(new THREE.Mesh(gSquareFrame, jadeMat));
  for (const off of [-0.11, 0.11]) {
    const bx = new THREE.Mesh(gBar, glowMat);
    bx.position.set(0, 0.01, off);
    const bz = new THREE.Mesh(gBar, glowMat);
    bz.rotation.y = Math.PI / 2;
    bz.position.set(off, 0.01, 0);
    squareHolder.add(bx, bz);
  }
  const corePivot = new THREE.Mesh(gCore, jadeMat);
  corePivot.position.y = 0.24;
  group.add(outerHolder, midHolder, squareHolder, corePivot);
  group.rotation.x = 0.34;
  group.scale.setScalar(scale);

  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      jadeMat.uniforms.uTime.value = t;
      steelMat.uniforms.uTime.value = t;
      outerHolder.rotation.y += dt * 0.95;
      midHolder.rotation.y -= dt * 1.65;
      midHolder.rotation.z = Math.sin(t * 2.2) * 0.14;
      squareHolder.rotation.y += dt * 0.45;
      corePivot.rotation.y -= dt * 2.8;
      corePivot.position.y = 0.24 + Math.sin(t * 4.0) * 0.05;
    },
    setOpacity(a) {
      jadeMat.uniforms.uOpacity.value = a;
      steelMat.uniforms.uOpacity.value = a;
      glowMat.opacity = a * 0.9;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

// ============================================================================
// 14. Forged Damascus Immortal Azure Dragon Greatsword (太虛鎮嶽青龍神劍)
// ============================================================================
export function buildImmortalAzureGreatswordAssembly({
  palette = PAL3D.windJade, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const bladeMat = makeSculptedTexturedPropMaterial({
    palette, materialKind: 'damascus_steel', texScale: 2.25, bumpStrength: 3.2, opacity: 0.98, hdr: 1.55,
  });
  const guardMat = makeSculptedTexturedPropMaterial({
    palette, materialKind: 'imperial_jade_bronze', texScale: 1.85, bumpStrength: 2.9, opacity: 0.98, hdr: 1.5,
  });
  const fullerMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(2.0),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(bladeMat, guardMat, fullerMat);

  // Forged 12-facet Damascus blade with true concave fuller channel + sculpted twin dragon-horn crossguard
  const gBladeBody = buildFulleredBladeGeo({
    length: 1.82,
    yOffset: -0.18,
    baseHalfW: 0.135,
    ricassoFlare: 1.22,
    midHalfW: 0.096,
    tipStartFrac: 0.74,
    thickness: 0.044,
    fullerDepth: 0.016,
    fullerEndFrac: 0.70,
    segsY: 28,
  });
  const gFuller = buildBeveledBoxGeo(0.034, 1.18, 0.062, 0.008, 1);
  gFuller.translate(0, 0.44, 0);

  const gGuardCore = buildBeveledBoxGeo(0.32, 0.16, 0.14, 0.035, 2);
  gGuardCore.translate(0, -0.22, 0);
  const gHorn = buildOrganicSweepTubeGeo({
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.18, 0.05, 0.02),
      new THREE.Vector3(0.38, 0.18, -0.02),
    ],
    r0: 0.052, r1: 0.006, radialSegs: 12, tubularSegs: 22, ridgeCount: 5, ridgeAmp: 0.16, twistTurns: 0.75,
  });
  const gGrip = buildFlutedColumnGeo({
    rBottom: 0.046, rTop: 0.040, height: 0.44, flutes: 8, fluteDepth: 0.006, twist: 1.2, radialSegs: 24, heightSegs: 14,
  });
  gGrip.translate(0, -0.48, 0);
  const gPommel = new THREE.TorusGeometry(0.088, 0.024, 12, 32);
  const gHalo = new THREE.TorusGeometry(0.32, 0.013, 10, 44);
  geos.push(gBladeBody, gFuller, gGuardCore, gHorn, gGrip, gPommel, gHalo);

  const holder = new THREE.Group();
  holder.position.y = -0.32;
  holder.add(
    new THREE.Mesh(gBladeBody, bladeMat),
    new THREE.Mesh(gFuller, fullerMat),
    new THREE.Mesh(gGuardCore, guardMat),
    new THREE.Mesh(gGrip, guardMat)
  );
  for (const sgn of [-1, 1]) {
    const horn = new THREE.Mesh(gHorn, guardMat);
    horn.position.set(sgn * 0.11, -0.22, 0);
    horn.scale.x = sgn;
    holder.add(horn);
  }
  const pommel = new THREE.Mesh(gPommel, guardMat);
  pommel.position.set(0, -0.76, 0);
  holder.add(pommel);

  const halo = new THREE.Mesh(gHalo, fullerMat);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.18;
  holder.add(halo);
  holder.rotation.z = -0.22;
  group.add(holder);
  group.scale.setScalar(scale);

  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      bladeMat.uniforms.uTime.value = t;
      guardMat.uniforms.uTime.value = t;
      halo.rotation.z += dt * 2.6;
      holder.position.y = -0.32 + Math.sin(t * 3.2) * 0.04;
    },
    setOpacity(a) {
      bladeMat.uniforms.uOpacity.value = a;
      guardMat.uniforms.uOpacity.value = a;
      fullerMat.opacity = a * 0.92;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

// ============================================================================
// 15. Solomon Obsidian-Magma Twin-Pillar Summon Gate (所羅門黑曜雙柱召喚門)
// ============================================================================
export function buildSolomonSummonGateAssembly({
  palette = PAL3D.voidAbyss, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);
  const lib = getTexLib();

  const pillarMat = makeSculptedTexturedPropMaterial({
    palette, materialKind: 'obsidian_magma', texScale: 1.9, bumpStrength: 3.2, opacity: 0.98, hdr: 1.65,
  });
  const portalMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uVortex: { value: lib.chargeVortex },
      uErode: { value: lib.erosionNoise },
      uSigil: { value: lib.sigilDemonGate },
      uRamp: { value: ramp },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime, uOpacity;
      uniform sampler2D uVortex, uErode, uSigil;
      uniform vec3 uRamp[7];
      vec3 sampleR(vec3 r[7], float t) {
        float x = clamp(t, 0.0, 1.0) * 6.0;
        int i = int(floor(x)); float f = fract(x);
        if (i <= 0) return mix(r[0], r[1], f);
        if (i == 1) return mix(r[1], r[2], f);
        if (i == 2) return mix(r[2], r[3], f);
        if (i == 3) return mix(r[3], r[4], f);
        if (i == 4) return mix(r[4], r[5], f);
        if (i == 5) return mix(r[5], r[6], f);
        return r[6];
      }
      void main() {
        vec2 c = (vUv - 0.5) * vec2(2.0, 1.65);
        vec4 er = texture2D(uErode, vUv * 2.4 + vec2(uTime * 0.25, -uTime * 0.35));
        float r = length(c + (er.rg - 0.5) * 0.16);
        if (r > 0.94) discard;
        float ang = atan(c.y, c.x) + uTime * 2.8 - r * 2.4;
        vec4 vx = texture2D(uVortex, vec2(0.5 + cos(ang) * r * 0.42, 0.5 + sin(ang) * r * 0.42));
        vec4 sg = texture2D(uSigil, clamp((vUv - 0.5) * 1.15 + 0.5, 0.0, 1.0));
        float lum = clamp(max(vx.r, vx.b) * 0.72 + max(sg.r, sg.g) * 0.65, 0.0, 1.0);
        float edge = 1.0 - smoothstep(0.68, 0.94, r);
        float a = clamp(lum * edge * uOpacity * 0.92, 0.0, 0.96);
        if (a < 0.015) discard;
        vec3 col = sampleR(uRamp, clamp(0.28 + lum * 0.68, 0.0, 0.99)) * 2.15;
        gl_FragColor = vec4(col * a, a);
      }
    `,
  });
  mats.push(pillarMat, portalMat);

  const gPlinth = buildBeveledBoxGeo(0.32, 0.16, 0.32, 0.028, 2);
  const gShaft = buildFlutedColumnGeo({
    rBottom: 0.118, rTop: 0.096, height: 1.38, flutes: 10, fluteDepth: 0.015, twist: 0.72, radialSegs: 40, heightSegs: 20,
  });
  const gCap = buildBeveledBoxGeo(0.29, 0.12, 0.29, 0.024, 2);
  const gLintel = buildBeveledBoxGeo(1.40, 0.16, 0.28, 0.030, 2);
  const gArch = new THREE.TorusGeometry(0.56, 0.068, 12, 44, Math.PI);
  const gSpike = new THREE.ConeGeometry(0.056, 0.28, 8);
  const gPortal = new THREE.PlaneGeometry(1.06, 1.48);
  geos.push(gPlinth, gShaft, gCap, gLintel, gArch, gSpike, gPortal);

  const gate = new THREE.Group();
  gate.position.y = -0.10;
  for (const sgn of [-1, 1]) {
    const px = sgn * 0.54;
    const pl = new THREE.Mesh(gPlinth, pillarMat); pl.position.set(px, -0.68, 0);
    const sh = new THREE.Mesh(gShaft, pillarMat); sh.position.set(px, 0.05, 0);
    const cp = new THREE.Mesh(gCap, pillarMat); cp.position.set(px, 0.76, 0);
    gate.add(pl, sh, cp);
  }
  const lintel = new THREE.Mesh(gLintel, pillarMat);
  lintel.position.set(0, 0.86, 0);
  const arch = new THREE.Mesh(gArch, pillarMat);
  arch.position.set(0, 0.86, 0);
  gate.add(lintel, arch);

  for (let i = -2; i <= 2; i++) {
    const sp = new THREE.Mesh(gSpike, pillarMat);
    const a = (i / 2) * 0.95;
    sp.position.set(Math.sin(a) * 0.62, 0.92 + Math.cos(a) * 0.56, 0);
    sp.rotation.z = -a * 0.65;
    gate.add(sp);
  }

  const portal = new THREE.Mesh(gPortal, portalMat);
  portal.position.set(0, 0.12, 0);
  gate.add(portal);
  group.add(gate);
  group.scale.setScalar(scale);

  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      pillarMat.uniforms.uTime.value = t;
      portalMat.uniforms.uTime.value = t;
    },
    setOpacity(a) {
      pillarMat.uniforms.uOpacity.value = a;
      portalMat.uniforms.uOpacity.value = a;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

// ============================================================================
// 16. Articulated Glacier Sapphire Prism Golem Colossus (極淵六稜寒晶魔像核)
// ============================================================================
export function buildGlacierPrismGolemAssembly({
  palette = PAL3D.mageFrost, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const iceArmorMat = makeSculptedTexturedPropMaterial({
    palette, materialKind: 'glacier_sapphire', texScale: 1.75, bumpStrength: 2.9, opacity: 0.92, hdr: 1.55,
  });
  const reactorMat = new THREE.MeshBasicMaterial({
    color: ramp[6].clone().multiplyScalar(2.15),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(iceArmorMat, reactorMat);

  const gTorso = new THREE.OctahedronGeometry(0.42, 1);
  gTorso.scale(1.18, 1.32, 0.78);
  const gCore = new THREE.OctahedronGeometry(0.16, 0);
  const gHead = new THREE.CylinderGeometry(0.12, 0.16, 0.26, 6);
  const gCrown = new THREE.ConeGeometry(0.06, 0.28, 5);
  const gPauldron = new THREE.ConeGeometry(0.16, 0.56, 6);
  const gFist = new THREE.DodecahedronGeometry(0.20, 0);
  geos.push(gTorso, gCore, gHead, gCrown, gPauldron, gFist);

  const torso = new THREE.Mesh(gTorso, iceArmorMat);
  torso.position.y = 0.08;
  const heart = new THREE.Mesh(gCore, reactorMat);
  heart.position.set(0, 0.12, 0.26);
  const head = new THREE.Mesh(gHead, iceArmorMat);
  head.position.set(0, 0.68, 0.04);
  for (const sgn of [-1, 1]) {
    const cr = new THREE.Mesh(gCrown, iceArmorMat);
    cr.position.set(sgn * 0.12, 0.18, 0);
    cr.rotation.z = -sgn * 0.42;
    head.add(cr);
  }
  group.add(torso, heart, head);

  const shoulders = [];
  const fists = [];
  for (const sgn of [-1, 1]) {
    const shGroup = new THREE.Group();
    shGroup.position.set(sgn * 0.62, 0.36, 0);
    for (let k = 0; k < 3; k++) {
      const sp = new THREE.Mesh(gPauldron, iceArmorMat);
      sp.position.set(sgn * k * 0.06, (1 - k) * 0.08, (k - 1) * 0.08);
      sp.rotation.z = -sgn * (0.55 + k * 0.26);
      shGroup.add(sp);
    }
    group.add(shGroup);
    shoulders.push({ shGroup, sgn });

    const fist = new THREE.Mesh(gFist, iceArmorMat);
    fist.scale.set(0.95, 1.25, 1.10);
    fist.position.set(sgn * 0.72, -0.34, 0.24);
    group.add(fist);
    fists.push({ fist, sgn });
  }

  group.scale.setScalar(scale);
  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      iceArmorMat.uniforms.uTime.value = t;
      torso.position.y = 0.08 + Math.sin(t * 2.8) * 0.04;
      head.position.y = 0.68 + Math.sin(t * 2.8 + 0.5) * 0.04;
      heart.rotation.y += dt * 4.2;
      heart.scale.setScalar(0.92 + 0.16 * Math.sin(t * 9.0));
      for (const s of shoulders) {
        s.shGroup.position.y = 0.36 + Math.sin(t * 2.8 + s.sgn) * 0.06;
      }
      for (const f of fists) {
        f.fist.position.y = -0.34 + Math.cos(t * 3.4 + f.sgn) * 0.08;
        f.fist.rotation.x = Math.sin(t * 2.5) * 0.2;
      }
    },
    setOpacity(a) {
      iceArmorMat.uniforms.uOpacity.value = a * 0.92;
      reactorMat.opacity = a;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

// ============================================================================
// 17. World-Tree Emerald Life Sanctuary Staff (世界樹翡翠生命法杖 — Healer / Party Support)
// ============================================================================
export function buildWorldTreeStaffAssembly({
  palette = PAL3D.mageEmerald, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const barkMat = makeSculptedTexturedPropMaterial({
    palette: PAL3D.holyGold, materialKind: 'imperial_jade_bronze', texScale: 2.1, bumpStrength: 3.1, opacity: 0.98, hdr: 1.45,
  });
  const emeraldMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: 'nature', useHexLattice: false,
    baseAlpha: 0.26, rimAlpha: 0.96, rimPower: 1.75, hdr: 2.35, additive: true,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(2.05),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(barkMat, emeraldMat, glowMat);

  const holder = new THREE.Group();
  holder.position.y = -0.15;

  // Triple intertwined living roots spiraling upward into a botanical cradle!
  for (let b = 0; b < 3; b++) {
    const a0 = (b / 3) * TAU;
    const pts = [];
    for (let s = 0; s <= 7; s++) {
      const u = s / 7;
      const y = lerp(-0.92, 0.78, u);
      const flare = u < 0.62 ? lerp(0.085, 0.048, u / 0.62) : lerp(0.048, 0.28 * Math.sin(((u - 0.62) / 0.38) * Math.PI * 0.88) + 0.06, 1.0);
      const ang = a0 + u * TAU * 0.85;
      pts.push(new THREE.Vector3(Math.cos(ang) * flare, y, Math.sin(ang) * flare));
    }
    const branchGeo = buildOrganicSweepTubeGeo({
      points: pts, r0: 0.044, r1: 0.012, radialSegs: 12, tubularSegs: 32, ridgeCount: 5, ridgeAmp: 0.18, twistTurns: 1.2,
    });
    geos.push(branchGeo);
    holder.add(new THREE.Mesh(branchGeo, barkMat));
  }

  // Faceted Emerald Heart Crystal + 6 Sculpted Living Leaf-Plumes + Golden Sanctuary Halo
  const gHeart = new THREE.OctahedronGeometry(0.18, 2);
  gHeart.scale(0.88, 1.38, 0.88);
  const gCore = new THREE.OctahedronGeometry(0.095, 1);
  const gLeaf = buildSculptedFeatherGeo({ length: 0.42, width: 0.12, thickness: 0.024, curveX: 0.06, camberZ: 0.03, segsY: 14 });
  const gHalo = new THREE.TorusGeometry(0.42, 0.014, 10, 48);
  const gBaseFoot = buildBeveledBoxGeo(0.16, 0.12, 0.16, 0.03, 2);
  geos.push(gHeart, gCore, gLeaf, gHalo, gBaseFoot);

  const heart = new THREE.Mesh(gHeart, emeraldMat);
  heart.position.y = 0.56;
  const innerHeart = new THREE.Mesh(gCore, glowMat);
  innerHeart.position.y = 0.56;
  const halo = new THREE.Mesh(gHalo, glowMat);
  halo.position.y = 0.56;
  const foot = new THREE.Mesh(gBaseFoot, barkMat);
  foot.position.y = -0.94;
  holder.add(heart, innerHeart, halo, foot);

  const leaves = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const lf = new THREE.Mesh(gLeaf, emeraldMat);
    lf.position.set(Math.cos(a) * 0.34, 0.54 + (i % 2) * 0.08, Math.sin(a) * 0.34);
    lf.rotation.set(0.32, -a, -0.48);
    holder.add(lf);
    leaves.push({ lf, a });
  }

  group.add(holder);
  group.scale.setScalar(scale);
  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      barkMat.uniforms.uTime.value = t;
      emeraldMat.uniforms.uTime.value = t * 2.1;
      heart.rotation.y += dt * 1.9;
      innerHeart.rotation.y -= dt * 3.4;
      heart.position.y = 0.56 + Math.sin(t * 3.6) * 0.045;
      innerHeart.position.y = heart.position.y;
      halo.rotation.x = Math.PI * 0.38 + Math.sin(t * 1.8) * 0.18;
      halo.rotation.y += dt * 1.4;
      for (const L of leaves) {
        L.lf.position.y = 0.54 + Math.sin(t * 3.2 + L.a * 2.0) * 0.05;
      }
    },
    setOpacity(a) {
      barkMat.uniforms.uOpacity.value = a;
      emeraldMat.uniforms.uOpacity.value = a;
      glowMat.opacity = a * 0.92;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

// ============================================================================
// 18. Seraphic Resurrection Ankh-Cross Reliquary (熾天甦生聖十字聖物 — Revive / Holy Support)
// ============================================================================
export function buildSeraphResurrectionAnkhAssembly({
  palette = PAL3D.holyGold, scale = 1.0,
} = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const goldMat = makeSculptedTexturedPropMaterial({
    palette, materialKind: 'imperial_jade_bronze', texScale: 1.9, bumpStrength: 2.8, opacity: 0.98, hdr: 1.65,
  });
  const crystalMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: 'valkyrie', useHexLattice: true,
    baseAlpha: 0.22, rimAlpha: 0.96, rimPower: 1.85, hdr: 2.35, additive: true,
  });
  const sunMat = new THREE.MeshBasicMaterial({
    color: ramp[6].clone().multiplyScalar(2.15),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(goldMat, crystalMat, sunMat);

  // Beveled Lower Pillar + Beveled Crossbar + Sculpted Ankh Teardrop Loop
  const gStem = buildBeveledBoxGeo(0.15, 0.96, 0.12, 0.032, 2);
  gStem.translate(0, -0.36, 0);
  const gCrossBar = buildBeveledBoxGeo(0.86, 0.14, 0.12, 0.032, 2);
  gCrossBar.translate(0, 0.08, 0);
  const gLoopPts = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * TAU;
    const rx = Math.sin(a) * 0.24 * (0.65 + 0.35 * (0.5 - 0.5 * Math.cos(a)));
    const ry = 0.44 + (0.5 - 0.5 * Math.cos(a)) * 0.46 - 0.22;
    gLoopPts.push(new THREE.Vector3(rx, ry, 0));
  }
  const gLoop = buildOrganicSweepTubeGeo({
    points: gLoopPts, r0: 0.044, r1: 0.044, radialSegs: 12, tubularSegs: 34, ridgeCount: 4, ridgeAmp: 0.10, twistTurns: 0.0,
  });
  const gHaloOuter = new THREE.TorusGeometry(0.58, 0.016, 10, 56);
  const gSoulGem = new THREE.OctahedronGeometry(0.14, 1);
  const gFeather = buildSculptedFeatherGeo({ length: 0.62, width: 0.14, thickness: 0.028, curveX: 0.07, camberZ: 0.032, segsY: 14 });
  geos.push(gStem, gCrossBar, gLoop, gHaloOuter, gSoulGem, gFeather);

  const body = new THREE.Group();
  body.add(
    new THREE.Mesh(gStem, goldMat),
    new THREE.Mesh(gCrossBar, goldMat),
    new THREE.Mesh(gLoop, goldMat)
  );
  const halo = new THREE.Mesh(gHaloOuter, sunMat);
  halo.position.set(0, 0.16, 0);
  const soulGem = new THREE.Mesh(gSoulGem, crystalMat);
  soulGem.scale.set(0.95, 1.35, 0.85);
  soulGem.position.set(0, 0.08, 0.08);
  const soulCore = new THREE.Mesh(gSoulGem, sunMat);
  soulCore.scale.set(0.52, 0.78, 0.52);
  soulCore.position.set(0, 0.08, 0.08);
  body.add(halo, soulGem, soulCore);

  const plumes = [];
  for (const sgn of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(gFeather, crystalMat);
      m.scale.set(sgn * (1.0 - k * 0.10), 1.0 - k * 0.12, 1.0);
      const baseZ = -sgn * (0.48 + k * 0.26);
      m.position.set(sgn * (0.36 + k * 0.14), 0.18 - k * 0.12, -0.04);
      m.rotation.set(0.12, sgn * 0.22, baseZ);
      body.add(m);
      plumes.push({ m, sgn, k, baseZ });
    }
  }

  group.add(body);
  group.scale.setScalar(scale);
  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      goldMat.uniforms.uTime.value = t;
      crystalMat.uniforms.uTime.value = t * 2.2;
      halo.rotation.z += dt * 1.9;
      soulGem.rotation.y += dt * 3.0;
      soulCore.scale.setScalar(0.54 + Math.sin(t * 7.5) * 0.09);
      body.position.y = Math.sin(t * 3.0) * 0.04;
      for (const p of plumes) {
        p.m.rotation.z = p.baseZ - p.sgn * Math.sin(t * 3.8 + p.k * 0.4) * 0.09;
      }
    },
    setOpacity(a) {
      goldMat.uniforms.uOpacity.value = a;
      crystalMat.uniforms.uOpacity.value = a;
      sunMat.opacity = a * 0.95;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}
