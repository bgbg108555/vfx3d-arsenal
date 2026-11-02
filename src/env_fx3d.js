import * as THREE from 'three';
import {
  TAU, clamp, lerp, smooth, ease, Rng, PAL3D, rampToColors, GLSL_NOISE,
  RibbonTrail3D, GroundWave3D, VortexFunnel3D, Sigil3D, ShockSphere3D,
  makeCraggyRockGeo, makeMagmaRockMaterial, makeTranslucentConstructMaterial, FX_CONFIG,
} from './core3d.js';
import { getTexLib } from './texgen3d.js';
import { buildMagmaMeteorAssembly, buildSpiritSwordAssembly } from './mesh_props3d.js';
import { spawnMartialStanceGust3D } from './fx_helpers.js';

// ============================================================================
// 1. 8 Distinct 3D Charge-Up Variants + 3A Realistic AI Textured Qi/Suction Core!
// ============================================================================
export const CHARGE_VARIANTS_META = [
  { id: 'auto',        label: '各招專屬變體' },
  { id: 'astrolabe',   label: '⚙️ 三環星盤齒輪' },
  { id: 'helix',       label: '🐉 雙螺旋龍脈' },
  { id: 'debris',      label: '🪨 震地浮石升空' },
  { id: 'tesla',       label: '⚡ 電磁雷網充能' },
  { id: 'mirage',      label: '👥 四方殘像合一' },
  { id: 'funnels',     label: '💎 六芒浮游稜鏡' },
  { id: 'singularity', label: '🕳️ 黑洞重力透鏡' },
  { id: 'wings',       label: '🪽 神兵覺醒聖翼' },
];

export function installChargeVariantHook(sim) {
  if (sim) sim._chargeVariantHook = spawnChargeVariant;
}

/**
 * Shared 3A Realistic AI-Textured Charge & Qi-Gather Layer:
 * Pairs chargeVortex plasma suction cone + chargeQiFlow meridian qi-ribbons +
 * crackedMagma / metalDamascus compression sphere + realistic environmental ground reaction!
 */
function attach3ATexturedChargeCore(sim, {
  getAnchor, anchor0, duration, radius, palette, variantKey = 'astrolabe',
}) {
  if (FX_CONFIG.tier <= 2 || duration < 0.22) return;
  const lib = getTexLib();
  const ramp = rampToColors(palette, 7);

  // Subtle realistic environmental ground pressure decal beneath charge anchor
  if (duration >= 0.44 && variantKey !== 'debris') {
    const gKind = variantKey === 'tesla'
      ? 'lightning'
      : variantKey === 'singularity'
        ? 'void'
        : variantKey === 'wings'
          ? 'holy'
          : variantKey === 'helix'
            ? 'burning'
            : 'frost';
    sim.spawnGroundZone({
      x: anchor0.x, z: anchor0.z, _mapped: true,
      radius: radius * 0.76,
      duration: duration * 0.88,
      kind: gKind,
      palette,
      emitFlames: false,
      eruptRocks: false,
    });
  }

  const group = new THREE.Group();
  const geos = [];
  const mats = [];

  // 1) Tilted 3A Plasma Suction Vortex Funnel (chargeVortex.webp)
  const gVortex = new THREE.ConeGeometry(radius * 0.78, radius * 0.62, 36, 1, true);
  gVortex.rotateX(Math.PI * 0.5);
  const mVortex = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 1 },
      uTex: { value: lib.chargeVortex },
      uNoise: { value: lib.flowNoise },
      uRamp: { value: ramp },
      uHdr: { value: 1.38 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime, uFade, uHdr;
      uniform sampler2D uTex, uNoise;
      uniform vec3 uRamp[7];
      ${GLSL_NOISE}
      void main() {
        float ang = vUv.x * 6.2831853 + uTime * 5.2 - vUv.y * 2.8;
        float rr = clamp(0.12 + vUv.y * 0.86, 0.0, 1.0);
        vec2 suv = vec2(0.5 + cos(ang) * rr * 0.48, 0.5 + sin(ang) * rr * 0.48);
        vec4 tx = texture2D(uTex, suv);
        vec4 nz = texture2D(uNoise, vec2(vUv.x * 3.0 + uTime * 0.6, vUv.y * 2.0 - uTime * 1.9));
        float edge = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.70, 1.0, vUv.y));
        float lum = max(tx.r, max(tx.g, tx.b));
        float a = clamp((tx.a * 0.85 + nz.r * 0.22) * pow(lum, 1.25) * edge * uFade * 0.58, 0.0, 0.88);
        if (a < 0.015) discard;
        vec3 col = mix(tx.rgb * uHdr, sampleRamp(uRamp, clamp(0.28 + lum * 0.68, 0.0, 0.99)) * uHdr, 0.56);
        gl_FragColor = vec4(col * a, a);
      }
    `,
  });
  const vortexMesh = new THREE.Mesh(gVortex, mVortex);

  // 2) Rising Meridian Qi-Flow Cylinder from Floor to Anchor (chargeQiFlow.webp)
  const gQi = new THREE.CylinderGeometry(radius * 0.30, radius * 0.76, 1.0, 32, 1, true);
  gQi.translate(0, 0.5, 0);
  const mQi = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 1 },
      uTex: { value: lib.chargeQiFlow },
      uRunes: { value: lib.auraRunes },
      uRamp: { value: ramp },
      uHdr: { value: 1.28 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime, uFade, uHdr;
      uniform sampler2D uTex, uRunes;
      uniform vec3 uRamp[7];
      ${GLSL_NOISE}
      void main() {
        vec2 qUv = vec2(vUv.x * 2.0 + vUv.y * 0.45 + uTime * 0.85, vUv.y * 1.35 - uTime * 1.85);
        vec4 tx = texture2D(uTex, qUv);
        vec4 rn = texture2D(uRunes, vec2(vUv.x * 3.0 - uTime * 0.45, vUv.y * 1.6 - uTime * 1.15));
        float vMask = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.74, 1.0, vUv.y));
        float lum = clamp(max(tx.r, max(tx.g, tx.b)) + rn.r * 0.35, 0.0, 1.0);
        float a = clamp((tx.a * 0.85 + rn.a * 0.32) * pow(lum, 1.3) * vMask * uFade * 0.54, 0.0, 0.86);
        if (a < 0.014) discard;
        vec3 col = mix(tx.rgb * uHdr, sampleRamp(uRamp, clamp(0.32 + lum * 0.65, 0.0, 0.99)) * uHdr, 0.58);
        gl_FragColor = vec4(col * a, a);
      }
    `,
  });
  const qiMesh = new THREE.Mesh(gQi, mQi);

  // 3) High-Density Textured Compression Core (metalDamascus or crackedMagma)
  const useMetallicCore = variantKey === 'astrolabe' || variantKey === 'tesla' || variantKey === 'funnels' || variantKey === 'mirage';
  const gCore = new THREE.IcosahedronGeometry(0.17, 2);
  const mCore = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 1 },
      uTex: { value: useMetallicCore ? lib.metalDamascus : lib.crackedMagma },
      uRamp: { value: ramp },
      uHdr: { value: 1.65 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      uniform float uTime, uFade, uHdr;
      uniform sampler2D uTex;
      uniform vec3 uRamp[7];
      ${GLSL_NOISE}
      void main() {
        vec4 tx = texture2D(uTex, vUv * 2.1 + vec2(uTime * 0.52, -uTime * 0.44));
        float fres = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.75);
        float vein = clamp(max(tx.r, max(tx.g, tx.b)) * 0.88 + fres * 0.55, 0.0, 1.0);
        vec3 col = sampleRamp(uRamp, clamp(0.32 + vein * 0.66, 0.0, 0.99)) * uHdr;
        float a = clamp((0.36 + vein * 0.64) * uFade, 0.0, 0.98);
        gl_FragColor = vec4(col * a, a);
      }
    `,
  });
  const coreMesh = new THREE.Mesh(gCore, mCore);

  geos.push(gVortex, gQi, gCore);
  mats.push(mVortex, mQi, mCore);
  group.add(qiMesh, vortexMesh, coreMesh);

  let elapsed = 0;
  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      elapsed += dt;
      const u = clamp(elapsed / duration);
      const fade = smooth(0.0, 0.10, u) * (1 - smooth(0.86, 1.0, u));
      const pos = getAnchor();

      vortexMesh.position.copy(pos);
      vortexMesh.rotation.set(-0.38 + Math.sin(elapsed * 2.6) * 0.12, elapsed * 1.4, elapsed * 3.8);
      const vSc = Math.max(0.05, (1.16 - 0.52 * ease.inQuad(u)));
      vortexMesh.scale.setScalar(vSc);
      mVortex.uniforms.uTime.value = elapsed;
      mVortex.uniforms.uFade.value = fade;

      qiMesh.position.set(pos.x, 0.03, pos.z);
      qiMesh.scale.set(1.0 - 0.28 * u, Math.max(0.35, pos.y + 0.25), 1.0 - 0.28 * u);
      qiMesh.rotation.y = -elapsed * 2.8;
      mQi.uniforms.uTime.value = elapsed;
      mQi.uniforms.uFade.value = fade;

      coreMesh.position.copy(pos);
      const pulse = 0.85 + 0.28 * Math.sin(elapsed * 22.0);
      coreMesh.scale.setScalar(Math.max(0.04, (0.55 + 0.82 * u) * pulse * (1 - smooth(0.90, 1.0, u) * 0.5)));
      coreMesh.rotation.y += dt * 4.6;
      coreMesh.rotation.x += dt * 3.1;
      mCore.uniforms.uTime.value = elapsed;
      mCore.uniforms.uFade.value = fade;
    },
    get done() { return elapsed >= duration; },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  });
}

export function spawnChargeVariant(sim, variantKey, opts = {}) {
  const {
    getAnchor: rawGetAnchor = () => new THREE.Vector3(0, 1.15, 0.5),
    duration = 1.10,
    radius: rawRadius = 1.75,
    palette = PAL3D.warriorGold,
    sigilStyle = null,
    noSigil = false,
  } = opts;
  const effectiveNoSigil = Boolean(noSigil || sim._currentMove?.noSigil);

  if (duration <= 0.16) return;
  const tier = FX_CONFIG.tier;
  const ramp = rampToColors(palette, 7);
  const radius = rawRadius * sim.getAoeScale();
  const getAnchor = () => {
    const raw = rawGetAnchor();
    if (!raw) return new THREE.Vector3(0, 1.15, 0.5);
    if (raw._isWorldScaled || !sim._scaleCtx) return raw;
    const [wx, wz] = sim.mapSkillXZ(raw.x, raw.z, false);
    const v = new THREE.Vector3(wx, raw.y, wz);
    v._isWorldScaled = true;
    return v;
  };
  const anchor0 = getAnchor().clone();

  // Pair EVERY charge variant with 3A realistic AI textures (chargeVortex + chargeQiFlow + magma/damascus core)!
  attach3ATexturedChargeCore(sim, { getAnchor, anchor0, duration, radius, palette, variantKey });

  // Gentle inward Niagara micro-dust stream shared at lower density to bind the anchor
  const emitSuctionDust = (pos, rem, u, vortexMul = 7.0) => {
    if (tier <= 1 || rem <= 0.16) return;
    const pLife = Math.min(0.26, rem - 0.05);
    if (pLife <= 0.07) return;
    sim.niagara.spawnBurst(sim.R, {
      x: pos.x, y: pos.y, z: pos.z,
      count: tier >= 4 ? 4 : 2,
      spreadRadius: radius * (0.95 - 0.35 * u),
      speed0: 0.2, speed1: 0.9,
      drag: 3.4, gravity: -0.3,
      curl: 2.0, vortex: vortexMul,
      vortexCenter: [pos.x, pos.z],
      attractPos: getAnchor,
      attractStr: 15.0 + u * 11.0,
      size0: 0.030, size1: 0.009,
      stretch: 0.024,
      life0: pLife * 0.65, life1: pLife,
      palette, hdr: 2.05, twinkle: 0.45,
    });
  };

  const addWorldSigil = (styleName, radMul = 0.96, wallH = 0.45) => {
    if (effectiveNoSigil) {
      spawnMartialStanceGust3D(sim, {
        x: anchor0.x,
        z: anchor0.z,
        _mapped: true,
        radius: Math.min(1.85, radius * 0.85),
        duration: Math.min(0.95, duration * 0.92),
        palette,
        pebbleCount: 8,
        windLoops: 2,
      });
      return;
    }
    const sg = new Sigil3D({
      x: anchor0.x, y: 0.022, z: anchor0.z,
      radius: radius * radMul, duration: duration * 0.96,
      style: sigilStyle || styleName, palette, hdr: 2.08, wallHeight: wallH,
    });
    sg._skipAutoMap = true;
    sim.addCustom(sg);
  };

  // --------------------------------------------------------------------------
  // Variant 1: ASTROLABE (三環星盤齒輪對轉鎖定 + 時空精密法陣)
  // --------------------------------------------------------------------------
  if (variantKey === 'astrolabe') {
    addWorldSigil('chrono', 0.96, 0.42);

    const group = new THREE.Group();
    const geos = [], mats = [];
    const ringMatMain = new THREE.MeshBasicMaterial({
      color: ramp[4].clone().multiplyScalar(tier === 1 ? 1.0 : 1.85),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const ringMatSub = new THREE.MeshBasicMaterial({
      color: ramp[2].clone().multiplyScalar(tier === 1 ? 0.95 : 1.55),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    mats.push(ringMatMain, ringMatSub);

    const toothGeo = new THREE.OctahedronGeometry(0.055, 0);
    geos.push(toothGeo);

    const rings = [0.46, 0.72, 0.98].map((rScale, idx) => {
      const holder = new THREE.Group();
      const rg = new THREE.TorusGeometry(radius * 0.56 * rScale, 0.018 + idx * 0.004, 8, 52);
      geos.push(rg);
      holder.add(new THREE.Mesh(rg, idx % 2 === 0 ? ringMatMain : ringMatSub));
      const teeth = 8 + idx * 4;
      for (let k = 0; k < teeth; k++) {
        const a = (k / teeth) * TAU;
        const tm = new THREE.Mesh(toothGeo, ringMatMain);
        const rr = radius * 0.56 * rScale;
        tm.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0);
        tm.rotation.z = a;
        tm.scale.set(0.65, 1.55, 0.55);
        holder.add(tm);
      }
      group.add(holder);
      return holder;
    });

    let elapsed = 0, locked = false, dustAcc = 0;
    sim.addCustom({
      group,
      _skipAutoMap: true,
      update(dt) {
        elapsed += dt;
        const u = clamp(elapsed / duration);
        const rem = duration - elapsed;
        const pos = getAnchor();
        group.position.copy(pos);

        const pop = ease.outBack(clamp(u * 6.5), 1.4);
        const fade = 1 - smooth(0.86, 1.0, u);
        group.scale.setScalar(Math.max(0.01, pop * (1.0 - smooth(0.80, 1.0, u) * 0.28)));
        ringMatMain.opacity = fade * 0.92;
        ringMatSub.opacity = fade * 0.76;

        if (u < 0.78) {
          rings[0].rotation.set(elapsed * 5.6, elapsed * 3.4, 0);
          rings[1].rotation.set(-elapsed * 4.2, 0.65, elapsed * 4.8);
          rings[2].rotation.set(0.55, -elapsed * 3.8, -elapsed * 3.1);
        } else {
          const snap = smooth(0.78, 0.90, u);
          for (let i = 0; i < 3; i++) {
            rings[i].rotation.x = lerp(rings[i].rotation.x, 0, snap * 0.45);
            rings[i].rotation.y = lerp(rings[i].rotation.y, 0, snap * 0.45);
            rings[i].rotation.z += dt * (i % 2 === 0 ? 2.5 : -2.5);
          }
          if (!locked && rem > 0.12) {
            locked = true;
            sim.spawnStarGlint(pos.x, pos.y, pos.z, 0.78, palette[5] || '#ffffff', Math.min(0.13, rem - 0.03), true);
            sim.spawnAirDistortion({ kind: 'shock', x: pos.x, y: pos.y, z: pos.z, _mapped: true, r0: 0.15, r1: radius * 0.95, duration: Math.min(0.24, rem - 0.03), strength: 0.72 });
          }
        }
        dustAcc += dt;
        if (dustAcc >= 0.045) { dustAcc = 0; emitSuctionDust(pos, rem, u, 6.5); }
      },
      get done() { return elapsed >= duration; },
      dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
    });
    return;
  }

  // --------------------------------------------------------------------------
  // Variant 2: HELIX (天地雙螺旋龍脈灌頂 + 盤龍炎紋法陣)
  // --------------------------------------------------------------------------
  if (variantKey === 'helix') {
    addWorldSigil('dragonFlame', 0.98, 0.55);

    const altPal = ['#09172e', '#144980', '#1ba8c4', '#6ef5ff', '#ffe07d', '#fff8d6', '#ffffff'];
    const trailA = new RibbonTrail3D({ maxPoints: 26, width: 0.22, palette, hdr: 2.35 });
    const trailB = new RibbonTrail3D({ maxPoints: 26, width: 0.18, palette: FX_CONFIG.paletteOverrideActive ? palette : altPal, hdr: 2.25 });
    sim.root.add(trailA.group, trailB.group);

    const headGeo = new THREE.OctahedronGeometry(0.11, 1);
    const headMatA = new THREE.MeshBasicMaterial({ color: ramp[5].clone().multiplyScalar(2.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const headMatB = new THREE.MeshBasicMaterial({ color: new THREE.Color('#8cf4ff').multiplyScalar(1.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const group = new THREE.Group();
    const headA = new THREE.Mesh(headGeo, headMatA);
    const headB = new THREE.Mesh(headGeo, headMatB);
    group.add(headA, headB);

    let elapsed = 0, burstDone = false;
    sim.addCustom({
      group,
      _skipAutoMap: true,
      update(dt) {
        elapsed += dt;
        const u = clamp(elapsed / duration);
        const rem = duration - elapsed;
        const pos = getAnchor();

        if (u <= 0.82) {
          const p = u / 0.82;
          const ang = p * TAU * 3.2;
          const curR = lerp(radius * 0.92, 0.06, ease.inQuad(p));
          const curY = lerp(0.08, pos.y, ease.outQuad(p));
          const cx = lerp(anchor0.x, pos.x, p);
          const cz = lerp(anchor0.z, pos.z, p);

          const pA = new THREE.Vector3(cx + Math.cos(ang) * curR, curY, cz + Math.sin(ang) * curR);
          const pB = new THREE.Vector3(cx - Math.cos(ang) * curR, curY, cz - Math.sin(ang) * curR);
          headA.position.copy(pA);
          headB.position.copy(pB);
          trailA.pushPoint(pA);
          trailB.pushPoint(pB);
          trailA.update(dt, 0);
          trailB.update(dt, 0);
        } else {
          headA.visible = false;
          headB.visible = false;
          const fadeRate = 1 / Math.max(0.05, duration * 0.18);
          trailA.update(dt, fadeRate);
          trailB.update(dt, fadeRate);
          if (!burstDone && rem > 0.10) {
            burstDone = true;
            sim.spawnStarGlint(pos.x, pos.y, pos.z, 0.82, palette[5] || '#ffffff', Math.min(0.13, rem - 0.02), true);
          }
        }
      },
      get done() { return elapsed >= duration; },
      dispose() {
        sim.root.remove(trailA.group); trailA.dispose();
        sim.root.remove(trailB.group); trailB.dispose();
        headGeo.dispose(); headMatA.dispose(); headMatB.dispose();
      },
    });
    return;
  }

  // --------------------------------------------------------------------------
  // Variant 3: DEBRIS (震地反重力浮石升空 → 磁吸坍縮入核)
  // --------------------------------------------------------------------------
  if (variantKey === 'debris') {
    sim.spawnGroundZone({
      x: anchor0.x, z: anchor0.z, _mapped: true,
      radius: radius * 0.92, duration: duration * 0.95,
      kind: 'crater', palette, emitFlames: false, eruptRocks: false,
    });

    const group = new THREE.Group();
    const geos = [
      makeCraggyRockGeo(0.16, 1, 0.32, 23, 0.90),
      makeCraggyRockGeo(0.20, 1, 0.35, 61, 1.08),
    ];
    const rockMat = makeMagmaRockMaterial({ palette, rockColor: '#2a2326', veinStrength: 2.15 });
    const stones = [];
    const cnt = tier <= 2 ? 5 : 10;
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * TAU + sim.R.range(-0.2, 0.2);
      const r0 = sim.R.range(0.45, radius * 0.88);
      const m = new THREE.Mesh(geos[i % geos.length], rockMat);
      m.scale.setScalar(sim.R.range(0.72, 1.25));
      group.add(m);
      stones.push({
        m, a, r0,
        peakY: sim.R.range(0.65, 2.05),
        spinX: sim.R.range(-4, 4),
        spinY: sim.R.range(-5, 5),
      });
    }

    let elapsed = 0, imploded = false;
    sim.addCustom({
      group,
      _skipAutoMap: true,
      update(dt) {
        elapsed += dt;
        const u = clamp(elapsed / duration);
        const rem = duration - elapsed;
        const pos = getAnchor();
        rockMat.uniforms.uAge.value = u * 0.35;
        rockMat.uniforms.uOpacity.value = 1 - smooth(0.88, 1.0, u);

        for (const s of stones) {
          s.m.rotation.x += s.spinX * dt;
          s.m.rotation.y += s.spinY * dt;
          if (u < 0.74) {
            const lift = ease.outCubic(u / 0.74);
            const curA = s.a + elapsed * 1.45;
            const tremble = Math.sin(elapsed * 42 + s.a * 5) * 0.025 * (1 - lift * 0.4);
            s.m.position.set(
              anchor0.x + Math.cos(curA) * s.r0 + tremble,
              0.05 + s.peakY * lift,
              anchor0.z + Math.sin(curA) * s.r0
            );
          } else {
            const slam = ease.inCubic(clamp((u - 0.74) / 0.22));
            const curA = s.a + 0.74 * duration * 1.45 + slam * 1.2;
            const startPos = new THREE.Vector3(
              anchor0.x + Math.cos(curA) * s.r0,
              0.05 + s.peakY,
              anchor0.z + Math.sin(curA) * s.r0
            );
            s.m.position.lerpVectors(startPos, pos, slam);
            s.m.scale.setScalar(Math.max(0.05, 1.0 - slam * 0.78));
          }
        }
        if (!imploded && u >= 0.88 && rem > 0.10) {
          imploded = true;
          const sh = new ShockSphere3D({
            x: pos.x, y: pos.y, z: pos.z,
            r0: 0.12, r1: radius * 0.78,
            duration: Math.min(0.20, rem - 0.02),
            palette, hdr: 2.35, implode: true, useRunes: !effectiveNoSigil,
          });
          sh._skipAutoMap = true;
          sim.addCustom(sh);
        }
      },
      get done() { return elapsed >= duration; },
      dispose() { geos.forEach((g) => g.dispose()); rockMat.dispose(); },
    });
    return;
  }

  // --------------------------------------------------------------------------
  // Variant 4: TESLA (高壓電磁雷網爬升 + 三柱避雷針與六角加速環)
  // --------------------------------------------------------------------------
  if (variantKey === 'tesla') {
    addWorldSigil('thunder', 0.95, 0.48);

    const group = new THREE.Group();
    const geos = [], mats = [];
    const pylonGeo = new THREE.ConeGeometry(0.11, 1.35, 5);
    pylonGeo.translate(0, 0.675, 0);
    const pylonMat = makeTranslucentConstructMaterial({
      palette, sigilStyle: null, useHexLattice: true, baseAlpha: 0.28, rimAlpha: 0.94, hdr: 2.15,
    });
    geos.push(pylonGeo); mats.push(pylonMat);

    const pylons = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU - Math.PI / 2;
      const px = anchor0.x + Math.cos(a) * radius * 0.78;
      const pz = anchor0.z + Math.sin(a) * radius * 0.78;
      const pm = new THREE.Mesh(pylonGeo, pylonMat);
      pm.position.set(px, 0, pz);
      pm.rotation.set(-Math.sin(a) * 0.18, 0, Math.cos(a) * 0.18);
      group.add(pm);
      pylons.push(new THREE.Vector3(px, 1.28, pz));
    }

    const hexRings = [0, 1, 2].map((idx) => {
      const rg = new THREE.TorusGeometry(0.42 + idx * 0.16, 0.020, 6, 6);
      const rm = new THREE.MeshBasicMaterial({
        color: ramp[5].clone().multiplyScalar(2.1),
        transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      geos.push(rg); mats.push(rm);
      const m = new THREE.Mesh(rg, rm);
      group.add(m);
      return { m, rm, unlockU: 0.16 + idx * 0.26 };
    });

    let elapsed = 0, arcTimer = 0.03;
    sim.addCustom({
      group,
      _skipAutoMap: true,
      update(dt) {
        elapsed += dt;
        const u = clamp(elapsed / duration);
        const rem = duration - elapsed;
        const pos = getAnchor();
        const fade = 1 - smooth(0.86, 1.0, u);

        pylonMat.uniforms.uTime.value = elapsed;
        pylonMat.uniforms.uOpacity.value = Math.min(1, u * 7) * fade;

        hexRings.forEach((hr, idx) => {
          const on = smooth(hr.unlockU, hr.unlockU + 0.08, u);
          hr.m.position.set(pos.x, pos.y, pos.z + 0.22 + idx * 0.28);
          hr.m.rotation.z += dt * (idx % 2 === 0 ? 5.5 : -5.5);
          hr.rm.opacity = on * fade * 0.9;
        });

        arcTimer -= dt;
        if (arcTimer <= 0 && rem > 0.16 && tier >= 2) {
          arcTimer = 0.095;
          const pSrc = pylons[sim.R.int(0, pylons.length - 1)];
          sim.spawnLightning({
            p0: pSrc, p1: pos.clone(), _mapped: true,
            life: Math.min(0.11, rem - 0.04),
            jag: 0.24, depth: 3, forks: 1, palette, thickness: 0.036,
          });
        }
      },
      get done() { return elapsed >= duration; },
      dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
    });
    return;
  }

  // --------------------------------------------------------------------------
  // Variant 5: MIRAGE (四方半透明幻影靈刃逐一疾馳收束合一)
  // --------------------------------------------------------------------------
  if (variantKey === 'mirage') {
    addWorldSigil('bloodbone', 0.96, 0.45);

    const clones = [0, 1, 2, 3].map((i) => {
      const a = (i / 4) * TAU + Math.PI * 0.25;
      const sw = buildSpiritSwordAssembly({ palette, scale: 0.78 });
      const tr = new RibbonTrail3D({ maxPoints: 16, width: 0.18, palette, hdr: 2.2 });
      sim.root.add(sw.group, tr.group);
      return {
        sw, tr, a,
        startU: 0.22 + i * 0.14,
        endU: 0.42 + i * 0.14,
        fused: false,
      };
    });

    let elapsed = 0;
    sim.addCustom({
      _skipAutoMap: true,
      update(dt) {
        elapsed += dt;
        const u = clamp(elapsed / duration);
        const rem = duration - elapsed;
        const pos = getAnchor();

        for (const c of clones) {
          c.sw.update(dt);
          const hoverPos = new THREE.Vector3(
            anchor0.x + Math.cos(c.a) * radius * 1.05,
            pos.y + 0.35 + Math.sin(elapsed * 6 + c.a) * 0.08,
            anchor0.z + Math.sin(c.a) * radius * 1.05
          );
          if (u < c.startU) {
            c.sw.group.position.copy(hoverPos);
            c.sw.group.lookAt(pos);
            c.sw.group.rotateX(Math.PI * 0.5);
            c.sw.setOpacity(Math.min(0.92, u * 6.0));
          } else if (u <= c.endU) {
            const p = ease.inExpo(clamp((u - c.startU) / (c.endU - c.startU)));
            c.sw.group.position.lerpVectors(hoverPos, pos, p);
            c.sw.group.lookAt(pos);
            c.sw.group.rotateX(Math.PI * 0.5);
            c.sw.setOpacity(1 - p * 0.5);
            c.tr.pushPoint(c.sw.group.position);
            c.tr.update(dt, 0);
          } else {
            c.sw.group.visible = false;
            c.tr.update(dt, 6.5);
            if (!c.fused && rem > 0.10) {
              c.fused = true;
              sim.spawnStarGlint(pos.x, pos.y, pos.z, 0.56, palette[5] || '#ffffff', Math.min(0.10, rem - 0.02), true);
            }
          }
        }
      },
      get done() { return elapsed >= duration; },
      dispose() {
        for (const c of clones) {
          sim.root.remove(c.sw.group); c.sw.dispose();
          sim.root.remove(c.tr.group); c.tr.dispose();
        }
      },
    });
    return;
  }

  // --------------------------------------------------------------------------
  // Variant 6: FUNNELS (六芒浮游魔導稜鏡展開 + 六道集束充能雷射)
  // --------------------------------------------------------------------------
  if (variantKey === 'funnels') {
    addWorldSigil('solomon', 0.94, 0.42);

    const group = new THREE.Group();
    const geos = [], mats = [];
    const finGeo = new THREE.OctahedronGeometry(0.20, 0);
    finGeo.scale(0.62, 1.72, 0.62);
    const finMat = makeTranslucentConstructMaterial({
      palette, sigilStyle: effectiveNoSigil ? null : 'solomon', useHexLattice: true, baseAlpha: 0.28, rimAlpha: 0.94, hdr: 2.25,
    });
    const rayGeo = new THREE.CylinderGeometry(0.018, 0.026, 1.0, 8, 1, true);
    rayGeo.translate(0, 0.5, 0);
    rayGeo.rotateX(Math.PI / 2);
    const rayMat = new THREE.MeshBasicMaterial({
      color: ramp[5].clone().multiplyScalar(2.15),
      transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const coreGeo = new THREE.IcosahedronGeometry(0.18, 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: ramp[6].clone().multiplyScalar(2.2),
      transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    geos.push(finGeo, rayGeo, coreGeo);
    mats.push(finMat, rayMat, coreMat);

    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    const units = Array.from({ length: 6 }, (_, i) => {
      const fin = new THREE.Mesh(finGeo, finMat);
      const ray = new THREE.Mesh(rayGeo, rayMat);
      group.add(fin, ray);
      return { fin, ray, baseA: (i / 6) * TAU };
    });

    let elapsed = 0;
    sim.addCustom({
      group,
      _skipAutoMap: true,
      update(dt) {
        elapsed += dt;
        const u = clamp(elapsed / duration);
        const fade = 1 - smooth(0.86, 1.0, u);
        const pos = getAnchor();
        const unfold = ease.outBack(clamp(u * 3.8), 1.5);

        finMat.uniforms.uTime.value = elapsed;
        finMat.uniforms.uOpacity.value = fade;
        const laserOn = smooth(0.26, 0.38, u) * fade;
        rayMat.opacity = laserOn * 0.86;
        coreMat.opacity = laserOn * 0.92;
        coreMesh.position.copy(pos);
        coreMesh.scale.setScalar(Math.max(0.02, (0.35 + 0.85 * u) * fade));

        for (const f of units) {
          const a = f.baseA + elapsed * 2.4;
          const haloR = radius * 0.72 * unfold;
          f.fin.position.set(
            pos.x + Math.cos(a) * haloR,
            pos.y + 0.28 + Math.sin(a) * haloR * 0.65,
            pos.z - 0.55
          );
          f.fin.lookAt(pos);
          const dist = f.fin.position.distanceTo(pos);
          f.ray.position.copy(f.fin.position);
          f.ray.lookAt(pos);
          f.ray.scale.set(1, 1, Math.max(0.01, dist));
        }
      },
      get done() { return elapsed >= duration; },
      dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
    });
    return;
  }

  // --------------------------------------------------------------------------
  // Variant 7: SINGULARITY (黑洞事件視界 + 吸積盤 + 三段心跳重力透鏡空氣扭曲)
  // --------------------------------------------------------------------------
  if (variantKey === 'singularity') {
    addWorldSigil('abyss', 0.96, 0.45);

    if (tier >= 3 && duration >= 0.35) {
      sim.spawnAirDistortion({
        kind: 'implode',
        x: anchor0.x, y: anchor0.y, z: anchor0.z, _mapped: true,
        r0: 0.25, r1: radius * 1.15,
        duration: duration * 0.92,
        strength: 0.95,
      });
    }

    const lib = getTexLib();
    const group = new THREE.Group();
    const voidGeo = new THREE.SphereGeometry(0.28, 28, 20);
    const voidMat = new THREE.MeshBasicMaterial({
      color: 0x04020a, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    const rimGeo = new THREE.SphereGeometry(0.32, 28, 20);
    const rimMat = makeTranslucentConstructMaterial({
      palette, sigilStyle: null, useHexLattice: false,
      baseAlpha: 0.08, rimAlpha: 0.96, rimPower: 2.4, hdr: 2.6, additive: true,
    });
    const accGeo = new THREE.PlaneGeometry(radius * 1.92, radius * 1.92);
    accGeo.rotateX(Math.PI * 0.42);
    const accMat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uFade: { value: 1 },
        uTex: { value: lib.chargeVortex },
        uErode: { value: lib.erosionNoise },
        uRamp: { value: ramp },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime, uFade;
        uniform sampler2D uTex, uErode;
        uniform vec3 uRamp[7];
        ${GLSL_NOISE}
        void main() {
          vec2 c = (vUv - 0.5) * 2.15;
          vec4 er = texture2D(uErode, vUv * 2.5 + vec2(uTime * 0.4, -uTime * 0.5));
          vec2 cw = c + (er.rg - 0.5) * 0.22;
          float r = length(cw);
          float ang = atan(cw.y, cw.x);
          float spiralArm = 0.5 + 0.5 * sin(ang * 4.0 - r * 5.8 + uTime * 8.5 + er.r * 3.2);
          float outerR = 0.60 + pow(spiralArm, 1.6) * 0.46;
          if (r < 0.22 || r > outerR) discard;
          vec2 suv = vec2(0.5 + cos(ang + uTime * 5.5 - r * 2.5) * 0.36, 0.5 + sin(ang + uTime * 5.5 - r * 2.5) * 0.36);
          vec4 tx = texture2D(uTex, suv);
          float band = smoothstep(0.22, 0.34, r) * (1.0 - smoothstep(outerR - 0.25, outerR, r));
          float lum = max(tx.r, max(tx.g, tx.b));
          float a = clamp((tx.a * 0.75 + er.g * 0.35) * band * uFade * 0.90, 0.0, 0.96);
          if (a < 0.015) discard;
          vec3 col = sampleRamp(uRamp, clamp(0.32 + lum * 0.65, 0.0, 0.99)) * 2.15;
          gl_FragColor = vec4(col * a, a);
        }
      `,
    });
    const voidMesh = new THREE.Mesh(voidGeo, voidMat);
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    const accMesh = new THREE.Mesh(accGeo, accMat);
    group.add(accMesh, voidMesh, rimMesh);

    let elapsed = 0, beat = 1;
    sim.addCustom({
      group,
      _skipAutoMap: true,
      update(dt) {
        elapsed += dt;
        const u = clamp(elapsed / duration);
        const rem = duration - elapsed;
        const pos = getAnchor();
        group.position.copy(pos);

        const fade = 1 - smooth(0.86, 1.0, u);
        const pulse = 0.82 + 0.32 * Math.sin(elapsed * 18.0);
        const coreSc = ease.outBack(clamp(u * 5.0), 1.5) * (1 - smooth(0.82, 1.0, u) * 0.85) * pulse;
        voidMesh.scale.setScalar(Math.max(0.01, coreSc));
        rimMesh.scale.setScalar(Math.max(0.01, coreSc * 1.08));
        accMesh.rotation.z += dt * 7.5;
        accMesh.rotation.y += dt * 2.2;
        accMesh.scale.setScalar(Math.max(0.02, (1.15 - u * 0.55) * fade));
        voidMat.opacity = fade * 0.95;
        rimMat.uniforms.uTime.value = elapsed;
        rimMat.uniforms.uOpacity.value = fade;
        accMat.uniforms.uTime.value = elapsed;
        accMat.uniforms.uFade.value = fade * 0.88;

        if (beat <= 3 && u >= beat * 0.25 && rem > 0.16) {
          const sh = new ShockSphere3D({
            x: pos.x, y: pos.y, z: pos.z,
            r0: 0.10, r1: radius * (0.95 - beat * 0.12),
            duration: Math.min(0.22, rem - 0.04),
            palette, hdr: 2.35, implode: true, useRunes: !effectiveNoSigil,
          });
          sh._skipAutoMap = true;
          sim.addCustom(sh);
          if (tier >= 4) {
            sim.spawnDarkSmoke({
              x: pos.x, y: pos.y, z: pos.z, _mapped: true,
              vy: 0.15, life: Math.min(0.28, rem - 0.04),
              size0: radius * 0.9, size1: 0.35, opacity: 0.45,
            });
          }
          beat++;
        }
      },
      get done() { return elapsed >= duration; },
      dispose() {
        voidGeo.dispose(); voidMat.dispose();
        rimGeo.dispose(); rimMat.dispose();
        accGeo.dispose(); accMat.dispose();
      },
    });
    return;
  }

  // --------------------------------------------------------------------------
  // Variant 8: WINGS (神兵三階覺醒展開 12 羽半透明結晶聖翼/炎翼)
  // --------------------------------------------------------------------------
  addWorldSigil('holy', 0.95, 0.52);

  const group = new THREE.Group();
  const bladeGeo = new THREE.OctahedronGeometry(1, 0);
  const bladeMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: null, useHexLattice: false,
    baseAlpha: 0.24, rimAlpha: 0.95, rimPower: 1.85, hdr: 2.35, additive: true,
  });
  const blades = [];
  for (const sgn of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(bladeGeo, bladeMat);
      group.add(m);
      blades.push({
        m, sgn, k,
        stageU: k < 2 ? 0.06 : k < 4 ? 0.36 : 0.64,
      });
    }
  }

  let elapsed = 0, nextWingStage = 0;
  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      elapsed += dt;
      const u = clamp(elapsed / duration);
      const rem = duration - elapsed;
      const pos = getAnchor();
      group.position.set(pos.x, Math.max(1.15, pos.y), pos.z - 0.32);

      const fade = 1 - smooth(0.86, 1.0, u);
      bladeMat.uniforms.uTime.value = elapsed;
      bladeMat.uniforms.uOpacity.value = fade;

      for (const b of blades) {
        const open = ease.outBack(clamp((u - b.stageU) / 0.22), 1.65);
        const len = (0.95 - b.k * 0.08) * open;
        b.m.scale.set(0.085 * open, Math.max(0.001, len), 0.032 * open);
        const spreadAng = (0.35 + b.k * 0.24) * open + Math.sin(elapsed * 6 + b.k) * 0.03;
        b.m.position.set(b.sgn * (0.22 + b.k * 0.20) * open, 0.32 - b.k * 0.14, -b.k * 0.03);
        b.m.rotation.set(0.18, b.sgn * 0.26, -b.sgn * spreadAng);
      }

      const stageThresholds = [0.08, 0.38, 0.66];
      if (nextWingStage < 3 && u >= stageThresholds[nextWingStage] && rem > 0.22) {
        sim.spawnFlipbook({
          atlas: 'fbBlessing',
          x: pos.x, y: pos.y + 0.15, z: pos.z - 0.15, _mapped: true,
          life: Math.min(0.28, rem - 0.04),
          size0: 0.75 + nextWingStage * 0.25,
          size1: 1.55 + nextWingStage * 0.45,
          palette, hdr: 2.35, emitMicro: true,
        });
        nextWingStage++;
      }
    },
    get done() { return elapsed >= duration; },
    dispose() { bladeGeo.dispose(); bladeMat.dispose(); },
  });
}

// ============================================================================
// 2. Overhead Churning 3D Storm / Volcanic Cloud Canopy + Sky Rift Sigil
// ============================================================================
export function spawnStormCanopy3D(sim, {
  cx = 0, cz = 4.0, y = 4.65, radius = 3.0, duration = 4.2,
  kind = 'blizzard', // 'blizzard' | 'volcanic' | 'astral'
  palette = PAL3D.mageFrost,
  _mapped = false,
} = {}) {
  if (duration <= 0.25) return;
  const [wCx, wCz] = sim.mapSkillXZ(cx, cz, _mapped);
  const effRadius = radius * (_mapped ? 1.0 : sim.getAoeScale());
  const tier = FX_CONFIG.tier;
  const sigilStyle = kind === 'blizzard' ? 'glacier' : kind === 'astral' ? 'solomon' : 'dragonFlame';

  const skySigil = new Sigil3D({
    x: wCx, y: y - 0.16, z: wCz,
    radius: effRadius * (kind === 'blizzard' ? 0.78 : 0.92),
    duration: duration * 0.96,
    style: sigilStyle,
    palette,
    hdr: kind === 'blizzard' ? 1.35 : 2.25,
    wallHeight: 0.26,
  });
  skySigil._skipAutoMap = true;
  sim.addCustom(skySigil);

  if (tier <= 1) return;

  const cloudColor = kind === 'blizzard'
    ? '#0b182c'
    : kind === 'astral'
      ? '#1a1033'
      : '#1b1113';
  const rimGlow = kind === 'blizzard'
    ? '#64dcff'
    : kind === 'astral'
      ? '#c96bff'
      : '#ff621f';

  const group = new THREE.Group();
  group.position.set(wCx, y, wCz);
  const puffGeo = new THREE.IcosahedronGeometry(0.62, 2);
  const puffMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uCloudCol: { value: new THREE.Color(cloudColor) },
      uGlowCol: { value: new THREE.Color(rimGlow) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormView;
      varying vec3 vViewDir;
      varying float vLocalY;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 1.8 + position.y * 3.0 + position.z * 2.0) * 0.08;
        p.z += cos(uTime * 1.5 + position.x * 2.5) * 0.08;
        vLocalY = p.y;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vNormView;
      varying vec3 vViewDir;
      varying float vLocalY;
      uniform float uTime, uOpacity;
      uniform vec3 uCloudCol, uGlowCol;
      void main() {
        float ndv = clamp(abs(dot(normalize(vNormView), normalize(vViewDir))), 0.0, 1.0);
        float soft = pow(ndv, 1.45);
        float underGlow = clamp(-vLocalY * 1.35 + 0.35, 0.0, 1.0) * (0.65 + 0.35 * sin(uTime * 7.5 + vLocalY * 5.0));
        vec3 col = mix(uCloudCol, uGlowCol * 1.45, underGlow * 0.52);
        float a = soft * uOpacity * 0.86;
        if (a < 0.012) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
  });

  const count = tier >= 4 ? 16 : 9;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const rr = (i % 3 === 0 ? 0.25 : i % 2 === 0 ? 0.62 : 0.88) * effRadius;
    const m = new THREE.Mesh(puffGeo, puffMat);
    const sx = effRadius * sim.R.range(0.45, 0.72);
    const sy = sim.R.range(0.32, 0.52);
    m.scale.set(sx, sy, sx * sim.R.range(0.85, 1.15));
    m.position.set(Math.cos(a) * rr, sim.R.range(-0.12, 0.22), Math.sin(a) * rr);
    group.add(m);
  }

  let elapsed = 0;
  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      elapsed += dt;
      const u = clamp(elapsed / duration);
      const env = smooth(0.0, 0.10, u) * (1 - smooth(0.84, 1.0, u));
      group.rotation.y += dt * (kind === 'blizzard' ? 0.72 : 0.38);
      puffMat.uniforms.uTime.value = elapsed;
      puffMat.uniforms.uOpacity.value = env;
    },
    get done() { return elapsed >= duration; },
    dispose() { puffGeo.dispose(); puffMat.dispose(); },
  });
}

/** Build a crisp 3D 6-pointed intersecting ice-crystal star geometry for heavy blizzard snowstorms */
function makeSnowCrystalStarGeo() {
  const pos = [], norm = [], uv = [], idx = [];
  let vOff = 0;
  const fins = [
    new THREE.Euler(0, 0, 0),
    new THREE.Euler(0, 0, Math.PI / 3),
    new THREE.Euler(0, 0, -Math.PI / 3),
    new THREE.Euler(0, Math.PI * 0.5, 0),
  ];
  const vTmp = new THREE.Vector3(), nTmp = new THREE.Vector3();
  for (const eu of fins) {
    const q = new THREE.Quaternion().setFromEuler(eu);
    const verts = [
      [0, 0.52, 0, 0.5, 1.0],
      [-0.14, 0, 0, 0.0, 0.5],
      [0, -0.52, 0, 0.5, 0.0],
      [0.14, 0, 0, 1.0, 0.5],
    ];
    nTmp.set(0, 0, 1).applyQuaternion(q);
    for (const vt of verts) {
      vTmp.set(vt[0], vt[1], vt[2]).applyQuaternion(q);
      pos.push(vTmp.x, vTmp.y, vTmp.z);
      norm.push(nTmp.x, nTmp.y, nTmp.z);
      uv.push(vt[3], vt[4]);
    }
    idx.push(vOff, vOff + 1, vOff + 2, vOff, vOff + 2, vOff + 3);
    vOff += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ============================================================================
// 3. Ferocious Sustained Blizzard (狂風怒號氣流帶 + 漫天斜吹冰雪結晶 + 冰錐碎裂 + 極寒積雪!)
// ============================================================================
export function spawnSustainedBlizzardZone(sim, {
  cx: rawCx = 0, cz: rawCz = 4.0, radius: rawRadius = 3.2, duration = 4.4,
  palette = PAL3D.mageFrost, dummies = [], seed = 101,
} = {}) {
  const R = new Rng(seed);
  const [cx, cz] = sim.mapSkillXZ(rawCx, rawCz, false);
  const radius = rawRadius * sim.getAoeScale();
  const aoeFactor = clamp(radius / 3.2, 0.55, 2.4);
  const tier = FX_CONFIG.tier;
  const lib = getTexLib();
  const ramp = rampToColors(palette, 7);

  // 1. Upwind-shifted brooding dark arctic storm clouds (like Meteor Shower so snow & gale underneath pop!)
  spawnStormCanopy3D(sim, {
    cx: cx - 1.25, cz: cz - 1.00, y: 5.15,
    radius: radius * 0.94, duration: duration - 0.06,
    kind: 'blizzard', palette, _mapped: true,
  });

  // 2. Persistent ground snowpack & glacier rune array
  sim.spawnGroundZone({
    x: cx, z: cz, _mapped: true,
    radius: radius * 0.98, duration: duration - 0.06,
    kind: 'frost', palette, emitFlames: true, eruptRocks: false,
  });
  const floorSigil = new Sigil3D({
    x: cx, y: 0.024, z: cz, radius: radius * 0.94, duration: duration - 0.08,
    style: 'glacier', palette, hdr: 2.05, wallHeight: 0.65,
  });
  floorSigil._skipAutoMap = true;
  sim.addCustom(floorSigil);

  // 3. FEROCIOUS HOWLING GALE CYCLONES (狂風雙層暴雪漏斗: 半透明極寒風牆保留暴風眼高反差層次!)
  const outerFunnel = new VortexFunnel3D({
    x: cx, y: 0.02, z: cz,
    rBottom: radius * 0.74, rTop: radius * 1.12, height: 4.35,
    duration: duration - 0.10, spinSpeed: 13.5, riseSpeed: -2.85, twist: 2.75,
    leanX: 0.25, palette, defaultTex: 'frost', hdr: 0.74,
  });
  outerFunnel._skipAutoMap = true;
  sim.addCustom(outerFunnel);

  const innerFunnel = new VortexFunnel3D({
    x: cx, y: 0.04, z: cz,
    rBottom: radius * 0.48, rTop: radius * 0.82, height: 3.90,
    duration: duration - 0.12, spinSpeed: -18.5, riseSpeed: -3.45, twist: 3.35,
    leanX: 0.22, palette, defaultTex: 'silk', hdr: 0.52,
  });
  innerFunnel._skipAutoMap = true;
  sim.addCustom(innerFunnel);

  if (tier >= 3) {
    sim.spawnAirDistortion({
      kind: 'heat', x: cx, y: 0.15, z: cz, _mapped: true,
      r0: radius * 0.78, r1: radius * 0.95, height: 2.9,
      duration: duration - 0.14, strength: 0.62,
    });
  }

  // 4. Staggered perimeter 3D refractive glacier crystal formations
  const crystalRingMaxR = Math.max(0.45, radius - 0.30);
  const crystalCount = Math.max(7, Math.round(13 * Math.sqrt(aoeFactor)));
  for (let i = 0; i < crystalCount; i++) {
    const a = (i / crystalCount) * TAU + R.range(-0.14, 0.14);
    const rr = R.range(crystalRingMaxR * 0.45, crystalRingMaxR);
    const dly = 0.16 + (i / crystalCount) * Math.min(2.0, duration * 0.48);
    const maxHold = Math.max(0.35, duration - dly - 0.55);
    sim.spawnCrystal({
      x: cx + Math.cos(a) * rr,
      z: cz + Math.sin(a) * rr,
      _mapped: true,
      height: R.range(0.95, 1.65),
      width: R.range(0.25, 0.36),
      leanX: Math.cos(a) * 0.26 + 0.14,
      leanZ: Math.sin(a) * 0.26,
      delay: dly,
      hold: Math.min(1.65, maxHold),
      melt: 0.38,
      palette,
    });
  }

  // 5. 3D GALE WIND RIBBONS (狂風氣流帶) + 460-INSTANCE DRIVING 3D SNOWSTORM CRYSTALS (漫天飄落冰雪) + HEAVY ICICLES!
  const group = new THREE.Group();
  const geos = [];
  const mats = [];

  // 5A. 6 Sweeping 3D Helical & Diagonal Gale Wind Ribbons (visible roaring wind streaks!)
  const galeRibbonMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uEnv: { value: 1 },
      uSlashTex: { value: lib.slashFrost },
      uQiTex: { value: lib.chargeQiFlow },
      uNoise: { value: lib.erosionNoise },
      uRamp: { value: ramp },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime, uEnv;
      uniform sampler2D uSlashTex, uQiTex, uNoise;
      uniform vec3 uRamp[7];
      ${GLSL_NOISE}
      void main() {
        vec4 sl = texture2D(uSlashTex, vec2(fract(vUv.x * 2.2 - uTime * 3.15), vUv.y));
        vec4 qi = texture2D(uQiTex, vec2(vUv.x * 3.0 - uTime * 4.2, vUv.y * 1.4 + sin(vUv.x * 12.0 - uTime * 8.0) * 0.08));
        vec4 nz = texture2D(uNoise, vec2(vUv.x * 2.5 - uTime * 2.6, vUv.y * 2.0));
        float band = sin(vUv.y * 3.14159265);
        float streak = clamp(max(sl.r, sl.b) * 0.72 + qi.g * 0.65, 0.0, 1.25);
        float erode = smoothstep(0.46, 0.92, streak * (0.58 + 0.56 * nz.r));
        float a = clamp(erode * pow(band, 1.45) * uEnv * 0.46, 0.0, 0.64);
        if (a < 0.015) discard;
        vec3 col = mix(sampleRamp(uRamp, clamp(0.24 + streak * 0.44, 0.0, 0.84)), vec3(0.76, 0.94, 1.0), 0.28) * 1.25;
        gl_FragColor = vec4(col * a, a);
      }
    `,
  });
  mats.push(galeRibbonMat);

  const galeBands = [];
  const bandCount = tier <= 1 ? 2 : tier === 2 ? 4 : 6;
  for (let b = 0; b < bandCount; b++) {
    const rBand = radius * (0.38 + (b / Math.max(1, bandCount - 1)) * 0.62);
    const hBand = 0.42 + (b % 3) * 0.16;
    const gBand = new THREE.CylinderGeometry(rBand * 1.06, rBand * 0.92, hBand, 40, 1, true, 0, Math.PI * 1.48);
    geos.push(gBand);
    const mBand = new THREE.Mesh(gBand, galeRibbonMat);
    const yBase = 0.38 + b * 0.56;
    mBand.position.set(cx + (b - 2) * 0.08, yBase, cz);
    mBand.rotation.set(0.18 * (b % 2 === 0 ? 1 : -1), b * 1.1, -0.26);
    group.add(mBand);
    galeBands.push({
      mesh: mBand,
      yBase,
      spin: (b % 2 === 0 ? 1 : -1) * (6.8 + b * 1.25),
      bobPhase: b * 1.3,
    });
  }

  // Diagonal straight crosswind shear sheets slicing across the zone!
  const shearCount = tier <= 1 ? 1 : 4;
  const shearSheets = [];
  for (let s = 0; s < shearCount; s++) {
    const gShear = new THREE.PlaneGeometry(radius * 2.35, 0.58, 16, 1);
    // Curve the wind sheet in 3D so it wraps through the storm!
    const pAttr = gShear.attributes.position;
    for (let vi = 0; vi < pAttr.count; vi++) {
      const px = pAttr.getX(vi);
      pAttr.setZ(vi, Math.sin((px / Math.max(0.5, radius)) * 1.6) * 0.38);
    }
    gShear.computeVertexNormals();
    geos.push(gShear);
    const mShear = new THREE.Mesh(gShear, galeRibbonMat);
    const yS = 0.72 + s * 0.78;
    mShear.position.set(cx, yS, cz + (s - 1.5) * radius * 0.36);
    mShear.rotation.set(0.14, -0.35, -0.36);
    group.add(mShear);
    shearSheets.push({ mesh: mShear, baseZ: mShear.position.z, baseY: yS, phase: s * 1.7 });
  }

  // 5B. 460-Instance Wind-Whipped 3D Snowflake & Ice-Crystal Storm!
  const flakeCount = tier === 1 ? 110 : tier === 2 ? 220 : tier === 3 ? 340 : 460;
  const flakeGeo = makeSnowCrystalStarGeo();
  const flakeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: {
      uEnv: { value: 1 },
      uTime: { value: 0 },
      uRamp: { value: ramp },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(0.88, 0.97, 1.0);
        #endif
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vCol;
      uniform float uEnv;
      void main() {
        vec2 d = abs(vUv - 0.5) * 2.0;
        float core = clamp(1.0 - (d.x * 0.85 + d.y * 0.55), 0.0, 1.0);
        float a = clamp(pow(core, 1.35) * uEnv * 0.92, 0.0, 1.0);
        if (a < 0.02) discard;
        vec3 c = mix(vCol, vec3(0.94, 0.98, 1.0), core * 0.55) * 1.65;
        gl_FragColor = vec4(c * a, a);
      }
    `,
  });
  geos.push(flakeGeo);
  mats.push(flakeMat);

  const snowInst = new THREE.InstancedMesh(flakeGeo, flakeMat, flakeCount);
  snowInst.frustumCulled = false;
  group.add(snowInst);

  const flakes = [];
  const dummyObj = new THREE.Object3D();
  const cTmp = new THREE.Color();
  for (let i = 0; i < flakeCount; i++) {
    const ang = R.range(0, TAU);
    const rr = Math.sqrt(R.next()) * radius * 1.05;
    const isBigStar = i % 5 === 0;
    const sz = isBigStar ? R.range(0.15, 0.24) : R.range(0.075, 0.145);
    cTmp.copy(ramp[i % 3 === 0 ? 6 : i % 2 === 0 ? 5 : 4]);
    snowInst.setColorAt(i, cTmp);
    flakes.push({
      x: cx + Math.cos(ang) * rr,
      y: R.range(0.12, 4.85),
      z: cz + Math.sin(ang) * rr,
      vx: R.range(6.2, 9.6),
      vy: R.range(-7.4, -4.8),
      vz: R.range(1.8, 3.8),
      swirl: R.range(2.6, 5.4),
      sz,
      stretch: isBigStar ? 1.35 : R.range(1.6, 2.6),
      rot: R.range(0, TAU),
      spin: R.range(-9, 9),
      phase: R.range(0, TAU),
    });
  }
  if (snowInst.instanceColor) snowInst.instanceColor.needsUpdate = true;

  // 5C. Heavy Slanted 3D Glacier Icicles + Frost Wake
  const icicleGeo = new THREE.ConeGeometry(0.145, 1.38, 6);
  icicleGeo.rotateX(Math.PI / 2);
  const icicleMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: null, useHexLattice: false,
    baseAlpha: 0.66, rimAlpha: 0.98, hdr: 1.72, additive: false,
  });
  geos.push(icicleGeo);
  mats.push(icicleMat);

  const activeIcicles = [];
  let elapsed = 0;
  let snowBurstTimer = 0.02;
  let squallTimer = 0.05;
  let icicleTimer = 0.09;
  let hitTickTimer = 0.38;
  const icicleInterval = clamp(0.088 / Math.sqrt(aoeFactor), 0.052, 0.13);

  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      elapsed += dt;
      const uAll = clamp(elapsed / duration);
      const rem = duration - elapsed;
      const env = smooth(0.0, 0.07, uAll) * (1 - smooth(0.90, 1.0, uAll));

      icicleMat.uniforms.uTime.value = elapsed;
      galeRibbonMat.uniforms.uTime.value = elapsed;
      galeRibbonMat.uniforms.uEnv.value = env;
      flakeMat.uniforms.uTime.value = elapsed;
      flakeMat.uniforms.uEnv.value = env;

      // Animate roaring 3D gale ribbons & diagonal wind shear sheets
      const gustWave = 1.0 + 0.32 * Math.sin(elapsed * 6.5);
      for (const gb of galeBands) {
        gb.mesh.rotation.y += gb.spin * gustWave * dt;
        gb.mesh.position.y = gb.yBase + Math.sin(elapsed * 5.0 + gb.bobPhase) * 0.12;
      }
      for (const sh of shearSheets) {
        sh.mesh.position.x = cx + Math.sin(elapsed * 4.2 + sh.phase) * radius * 0.18;
        sh.mesh.position.y = sh.baseY + Math.cos(elapsed * 5.5 + sh.phase) * 0.10;
      }

      // Update 460 wind-whipped 3D snow crystals with diagonal gale + cyclone swirl!
      for (let i = 0; i < flakeCount; i++) {
        const f = flakes[i];
        const dx = f.x - cx;
        const dz = f.z - cz;
        const dist = Math.max(0.18, Math.hypot(dx, dz));
        const tangX = (-dz / dist) * f.swirl;
        const tangZ = (dx / dist) * f.swirl;
        const pull = dist > radius * 0.92 ? -3.6 : -0.65;
        const gustX = f.vx * gustWave + tangX + (dx / dist) * pull;
        const gustZ = f.vz * gustWave + tangZ + (dz / dist) * pull;

        f.x += gustX * dt;
        f.y += f.vy * dt;
        f.z += gustZ * dt;
        f.rot += f.spin * dt;

        // Respawn upwind at top of storm ceiling whenever a snowflake hits the snowpack or exits downwind!
        if (f.y <= 0.06 || Math.hypot(f.x - cx, f.z - cz) > radius * 1.38) {
          const a = R.range(0, TAU);
          const rr = Math.sqrt(R.next()) * radius * 0.94;
          f.x = cx + Math.cos(a) * rr - radius * 0.52;
          f.y = R.range(3.85, 4.95);
          f.z = cz + Math.sin(a) * rr - radius * 0.24;
        }

        dummyObj.position.set(f.x, f.y, f.z);
        dummyObj.rotation.set(0.32, f.rot, -0.62);
        dummyObj.scale.set(f.sz, f.sz * f.stretch, f.sz);
        dummyObj.updateMatrix();
        snowInst.setMatrixAt(i, dummyObj.matrix);
      }
      snowInst.instanceMatrix.needsUpdate = true;

      // Fast horizontal dark-arctic snow-squall gusts (狂風橫掃深寒雪霧，襯托高反差飄雪!)
      squallTimer -= dt;
      if (squallTimer <= 0 && rem > 0.48 && tier >= 2) {
        squallTimer = 0.25;
        const sLife = Math.min(0.46, rem - 0.06);
        if (sLife > 0.14) {
          const zOff = R.range(-radius * 0.68, radius * 0.68);
          const yOff = R.range(0.65, 2.45);
          sim.spawnFlipbook({
            atlas: 'fbSmoke',
            x: cx - radius * 0.78, y: yOff, z: cz + zOff, _mapped: true,
            vx: R.range(6.8, 9.6), vy: R.range(-0.6, 0.35), vz: R.range(1.4, 2.8),
            life: sLife,
            size0: radius * 0.38, size1: radius * 0.72,
            palette: ['#071121', '#0e2240', '#183d6e', '#2a639e', '#58a6db', '#9ad9ff', '#e8f8ff'],
            hdr: 0.92, opacity: 0.28, additive: false, emitMicro: false,
          });
        }
      }

      // Wind-streaked Niagara fine ice-needle spray
      snowBurstTimer -= dt;
      if (snowBurstTimer <= 0 && rem > 0.45) {
        snowBurstTimer = 0.065;
        const snowLife = Math.min(0.68, rem - 0.06);
        if (snowLife > 0.16) {
          const cnt = Math.max(6, Math.round(34 * aoeFactor * (tier === 1 ? 0.25 : tier === 2 ? 0.55 : 1.0)));
          sim.niagara.spawnBurst(R, {
            x: cx - radius * 0.38,
            y: R.range(2.8, 4.4),
            z: cz - radius * 0.18,
            count: cnt,
            spreadRadius: radius * 0.82,
            speed0: 5.5, speed1: 9.8,
            dir: [0.68, -0.66, 0.28],
            coneAngle: 0.34,
            drag: 0.35,
            gravity: 4.5,
            curl: tier === 1 ? 0 : 4.2,
            vortex: 5.4,
            vortexCenter: [cx, cz],
            size0: 0.072,
            size1: 0.026,
            stretch: 0.038,
            life0: snowLife * 0.72,
            life1: snowLife,
            palette,
            hdr: 2.45,
            bounce: 0.18,
            twinkle: 0.92,
          });
        }
      }

      // Continuous heavy slanted 3D glacier icicles & hailstones shattering on impact!
      icicleTimer -= dt;
      if (icicleTimer <= 0 && rem > 0.56) {
        icicleTimer = icicleInterval;
        const ang = R.range(0, TAU);
        const rr = Math.sqrt(R.next()) * radius * 0.82;
        const tx = cx + Math.cos(ang) * rr;
        const tz = cz + Math.sin(ang) * rr;
        const p0 = new THREE.Vector3(tx - 1.95, 4.85, tz - 0.85);
        const p1 = new THREE.Vector3(tx, 0.14, tz);
        const m = new THREE.Mesh(icicleGeo, icicleMat);
        const sc = R.range(0.85, 1.48);
        m.scale.set(sc, sc, sc * R.range(1.05, 1.45));
        m.position.copy(p0);
        m.lookAt(p1);
        group.add(m);
        activeIcicles.push({ m, p0, p1, el: 0, fl: 0.22 });
      }

      for (let i = activeIcicles.length - 1; i >= 0; i--) {
        const ic = activeIcicles[i];
        ic.el += dt;
        const u = clamp(ic.el / ic.fl);
        ic.m.position.lerpVectors(ic.p0, ic.p1, u);
        if (ic.el >= ic.fl) {
          group.remove(ic.m);
          activeIcicles.splice(i, 1);
          if (rem > 0.28) {
            sim.spawnFlipbook({
              atlas: 'fbIceShatter',
              x: ic.p1.x, y: 0.48, z: ic.p1.z, _mapped: true,
              life: Math.min(0.28, rem - 0.05),
              size0: 0.62, size1: 1.38,
              palette, hdr: 2.35, emitMicro: false,
            });
            sim.spawnRockDebris({
              x: ic.p1.x, y: 0.12, z: ic.p1.z, _mapped: true,
              count: 3, radius: 0.18,
              speed0: 1.8, speed1: 4.2, up0: 2.4, up1: 4.8,
              size0: 0.08, size1: 0.16,
              life: Math.min(0.54, rem - 0.06),
              style: 'ice', palette,
            });
          }
        }
      }

      // Sustained multi-tick freeze & gale push pulses on dummies inside zone
      hitTickTimer -= dt;
      if (hitTickTimer <= 0 && rem > 0.48) {
        hitTickTimer = 0.58;
        const markDur = Math.min(0.56, rem - 0.08);
        for (const d of dummies) {
          if (!d.root.visible) continue;
          const wp = d.worldPosition ? d.worldPosition() : d.root.position;
          wp._isWorldScaled = true;
          if (Math.hypot(wp.x - cx, wp.z - cz) <= radius + 0.85) {
            d.hit({ dirX: 0.52, dirZ: 0.85, power: 1.22, noPush: true, flashColor: palette[5] || '#dff6ff', shiver: 0.55 });
            if (markDur > 0.15) sim.spawnStatusMark('frostRing', wp, markDur);
          }
        }
      }
    },
    get done() { return elapsed >= duration; },
    dispose() {
      while (group.children.length) group.remove(group.children[0]);
      snowInst.dispose();
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  });
}

// ============================================================================
// 4. Sustained Continuous-Zone Meteor Shower (同一區域持續 4.8s 下流星 + 長效熔岩地裂燃燒 + 噴石塊!)
// ============================================================================
export function spawnSustainedMeteorZone(sim, {
  cx: rawCx = 0, cz: rawCz = 4.2, radius: rawRadius = 3.3, duration = 4.6,
  palette = PAL3D.fireInferno, dummies = [], fighter = null, seed = 202,
  astralDualHue = false,
} = {}) {
  const R = new Rng(seed);
  const [cx, cz] = sim.mapSkillXZ(rawCx, rawCz, false);
  const radius = rawRadius * sim.getAoeScale();
  const aoeFactor = clamp(radius / 3.3, 0.55, 2.4);
  const altAstralPal = PAL3D.mageArcane;

  // 1. Overhead churning volcanic/astral cloud rift (shifted upwind so diagonal meteors emerge visibly!)
  spawnStormCanopy3D(sim, {
    cx: cx - 1.35, cz: cz - 1.15, y: 5.35,
    radius: radius * 0.90,
    duration: duration - 0.08,
    kind: astralDualHue ? 'astral' : 'volcanic',
    palette,
    _mapped: true,
  });

  // 2. Chiseled realistic target-zone sigil + persistent base scorched crater floor!
  sim.spawnGroundZone({
    x: cx, z: cz, _mapped: true,
    radius: radius * 0.92,
    duration: duration - 0.08,
    kind: 'burning',
    palette,
    emitFlames: false,
    eruptRocks: false,
  });
  const floorSigil = new Sigil3D({
    x: cx, y: 0.022, z: cz,
    radius: radius * 0.95,
    duration: duration - 0.10,
    style: astralDualHue ? 'solomon' : 'dragonFlame',
    palette,
    hdr: 2.1,
    wallHeight: 0.58,
  });
  floorSigil._skipAutoMap = true;
  sim.addCustom(floorSigil);

  // 3. Schedule 22..34 continuous staggered diagonal meteors onto the SAME target zone!
  const totalMeteors = Math.max(12, Math.round(24 * Math.pow(aoeFactor, 0.65) * (FX_CONFIG.tier === 1 ? 0.45 : FX_CONFIG.tier === 2 ? 0.7 : 1.0)));
  const rainWindowStart = 0.18;
  const rainWindowEnd = Math.max(0.85, duration - 0.88);
  const schedule = [];
  for (let i = 0; i < totalMeteors; i++) {
    const isFinale = i === totalMeteors - 1;
    const u = i / Math.max(1, totalMeteors - 1);
    const spawnT = isFinale
      ? rainWindowEnd
      : rainWindowStart + u * (rainWindowEnd - rainWindowStart) * 0.94 + R.range(-0.03, 0.03);
    const ang = R.range(0, TAU);
    const rr = isFinale ? 0 : Math.sqrt(R.next()) * radius * 0.74;
    const tx = cx + Math.cos(ang) * rr;
    const tz = cz + Math.sin(ang) * rr;
    const mRad = isFinale ? 0.58 : (i % 5 === 4 ? 0.38 : R.range(0.22, 0.31));
    const useAlt = astralDualHue && (i % 2 === 1) && !FX_CONFIG.paletteOverrideActive;
    schedule.push({
      spawnT: Math.max(0.08, spawnT),
      fired: false,
      tx, tz, mRad, isFinale,
      mPal: useAlt ? altAstralPal : palette,
      seed: seed + i * 29,
    });
  }

  const warnGeo = new THREE.RingGeometry(0.76, 0.96, 32);
  warnGeo.rotateX(-Math.PI / 2);

  let elapsed = 0;
  sim.addCustom({
    _skipAutoMap: true,
    update(dt) {
      elapsed += dt;
      for (const item of schedule) {
        if (!item.fired && elapsed >= item.spawnT) {
          item.fired = true;
          const remAtSpawn = duration - elapsed;
          const fl = item.isFinale ? 0.31 : 0.25;
          if (remAtSpawn <= fl + 0.22) continue;

          // Brief glowing target reticle on floor before impact
          const warnMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(item.mPal[4] || '#ffaa33').multiplyScalar(1.8),
            transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const warnMesh = new THREE.Mesh(warnGeo, warnMat);
          warnMesh.position.set(item.tx, 0.028, item.tz);
          const warnR = item.mRad * 2.4;
          let wEl = 0;
          sim.addCustom({
            mesh: warnMesh,
            _skipAutoMap: true,
            update(wDt) {
              wEl += wDt;
              const wu = clamp(wEl / fl);
              warnMesh.scale.setScalar(lerp(warnR * 1.25, warnR * 0.55, wu));
              warnMat.opacity = (0.35 + 0.55 * wu) * (1 - smooth(0.88, 1.0, wu));
            },
            get done() { return wEl >= fl; },
            dispose() { warnMat.dispose(); },
          });

          // Falling 3D craggy molten meteor + tubular plasma tail
          const p0 = new THREE.Vector3(item.tx - 2.35, 5.85, item.tz - 1.85);
          const p1 = new THREE.Vector3(item.tx, 0.22, item.tz);
          const mt = buildMagmaMeteorAssembly({
            radius: item.mRad,
            palette: item.mPal,
            rockColor: astralDualHue ? '#161229' : '#1f1412',
            seed: item.seed,
          });
          const tail = new RibbonTrail3D({
            maxPoints: 16,
            width: item.mRad * 1.65,
            palette: item.mPal,
            hdr: 2.35,
          });
          sim.root.add(tail.group);

          let mEl = 0, impacted = false;
          const fadeTail = 0.16;
          sim.addCustom({
            group: mt.group,
            _skipAutoMap: true,
            update(mDt) {
              mEl += mDt;
              if (mEl <= fl) {
                const mu = clamp(mEl / fl);
                mt.group.position.lerpVectors(p0, p1, mu);
                mt.update(mDt, mu);
                tail.pushPoint(mt.group.position);
                tail.update(mDt, 0);
              } else {
                if (!impacted) {
                  impacted = true;
                  mt.group.visible = false;
                  const remImpact = duration - elapsed;
                  if (item.isFinale && fighter) fighter.hitStop = 0.085;

                  if (remImpact > 0.24) {
                    const blastLife = Math.min(item.isFinale ? 0.52 : 0.36, remImpact - 0.06);
                    sim.spawnFlipbook({
                      atlas: 'fbExplosion',
                      x: item.tx, y: 0.72 + item.mRad, z: item.tz, _mapped: true,
                      life: blastLife,
                      size0: item.mRad * 2.8,
                      size1: item.mRad * 6.4,
                      palette: item.mPal,
                      hdr: 2.6,
                    });
                    if (FX_CONFIG.tier >= 4) {
                      sim.spawnDarkSmoke({
                        x: item.tx, y: 0.95, z: item.tz, _mapped: true,
                        vy: 1.05,
                        life: Math.min(0.50, remImpact - 0.06),
                        size0: item.mRad * 2.2,
                        size1: item.mRad * 4.8,
                        emberHex: item.mPal[4] || '#ff6e24',
                        opacity: 0.52,
                      });
                    }

                    // Long-lingering overlapping burning lava ground patch!
                    const burnDur = Math.min(3.45, remImpact - 0.06);
                    if (burnDur > 0.28) {
                      sim.spawnGroundZone({
                        x: item.tx, z: item.tz, _mapped: true,
                        radius: clamp(item.mRad * 3.2, 0.88, radius * 0.48),
                        duration: burnDur,
                        kind: 'burning',
                        palette: item.mPal,
                        emitFlames: item.isFinale || R.chance(0.55),
                        eruptRocks: false,
                      });
                    }

                    // Erupting bouncing 3D basalt stone chunks!
                    sim.spawnRockDebris({
                      x: item.tx, y: 0.14, z: item.tz, _mapped: true,
                      count: item.isFinale ? 12 : 4,
                      radius: 0.28,
                      speed0: 2.0, speed1: item.isFinale ? 6.2 : 4.4,
                      up0: 3.2, up1: item.isFinale ? 7.2 : 5.4,
                      size0: 0.09, size1: item.isFinale ? 0.24 : 0.16,
                      life: Math.min(item.isFinale ? 0.82 : 0.58, remImpact - 0.06),
                      style: 'basalt',
                      palette: item.mPal,
                    });

                    // Shockwave crown strictly bounded inside circle radius
                    const radialDist = Math.hypot(item.tx - cx, item.tz - cz);
                    const safeWaveR = Math.min(item.isFinale ? 2.4 : 1.15, Math.max(0.45, radius - radialDist - 0.08));
                    const gw = new GroundWave3D({
                      x: item.tx, z: item.tz,
                      maxRadius: safeWaveR,
                      thickness: item.isFinale ? 0.52 : 0.32,
                      height: item.isFinale ? 0.85 : 0.48,
                      duration: Math.min(0.32, remImpact - 0.06),
                      palette: item.mPal,
                      hdr: 2.25,
                      seed: item.seed,
                    });
                    gw._skipAutoMap = true;
                    sim.addCustom(gw);

                    for (const d of dummies) {
                      if (!d.root.visible) continue;
                      const wp = d.worldPosition ? d.worldPosition() : d.root.position;
                      const dDist = Math.hypot(wp.x - item.tx, wp.z - item.tz);
                      if (item.isFinale || dDist < 1.85) {
                        d.hit({
                          dirX: (wp.x - item.tx) * 0.45,
                          dirZ: 1,
                          power: item.isFinale ? 1.95 : 1.15,
                          noPush: !item.isFinale,
                          flashColor: item.mPal[5] || '#fff4b0',
                        });
                      }
                    }
                  }
                }
                tail.update(mDt, 1 / fadeTail);
              }
            },
            get done() { return mEl >= fl + fadeTail; },
            dispose() {
              sim.root.remove(tail.group);
              tail.dispose();
              mt.dispose();
            },
          });
        }
      }
    },
    get done() { return elapsed >= duration - 0.04; },
    dispose() { warnGeo.dispose(); },
  });
}
