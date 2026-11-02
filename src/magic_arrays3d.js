import * as THREE from 'three';
import {
  TAU, clamp, lerp, smooth, ease, PAL3D, GLSL_NOISE, rampToColors, registerSigilExtraFactory,
} from './core3d.js';
import {
  FX_CONFIG, getTexLib, resolveSigilTex, getSigilTradition, remapSigilStyle,
} from './texgen3d.js';

// ============================================================================
// Shared Holo/Relief Sigil Disc Material Factory (Supports Circular & Square Seals)
// ============================================================================
export function createSigilLayerMaterial({
  style = 'arcane',
  palette = PAL3D.mageArcane,
  hdr = 1.85,
  pulseSpeed = 8.0,
  isGroundDisc = false,
  isSquare = false,
  exactStyle = false,
} = {}) {
  const tier = FX_CONFIG.tier;
  const lib = getTexLib();
  const ramp = rampToColors(palette, 7);
  const sigilTex = resolveSigilTex(style, exactStyle);
  const useAuthenticRgb = tier >= 3 && !FX_CONFIG.paletteOverrideActive;
  const normalBlend = isGroundDisc && useAuthenticRgb;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: Boolean(isGroundDisc),
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
    side: THREE.DoubleSide,
    blending: normalBlend ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uDissolve: { value: 0 },
      uFlash: { value: 0 },
      uHdr: { value: hdr * (tier === 1 ? 0.65 : 1.0) },
      uPulseSpeed: { value: tier === 1 ? 0.0 : pulseSpeed },
      uTintMix: { value: useAuthenticRgb ? (isGroundDisc ? 0.16 : 0.34) : 0.88 },
      uNormalBlend: { value: normalBlend ? 1.0 : 0.0 },
      uIsSquare: { value: isSquare ? 1.0 : 0.0 },
      uSigilTex: { value: sigilTex },
      uNoiseTex: { value: lib.flowNoise },
      uRamp: { value: ramp },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime, uReveal, uDissolve, uFlash, uHdr, uPulseSpeed, uTintMix, uNormalBlend, uIsSquare;
      uniform sampler2D uSigilTex, uNoiseTex;
      uniform vec3 uRamp[7];
      ${GLSL_NOISE}
      void main() {
        vec2 c = vUv - 0.5;
        float rad = uIsSquare > 0.5 ? max(abs(c.x), abs(c.y)) * 2.0 : length(c) * 2.0;
        if (rad > 1.0) discard;

        vec4 sg = texture2D(uSigilTex, vUv);
        vec4 nz = texture2D(uNoiseTex, vUv * 2.6 + vec2(uTime * 0.12, -uTime * 0.18));

        float drawMask = 1.0 - smoothstep(max(0.0, uReveal - 0.12), uReveal + 0.08, rad - nz.r * 0.07);
        float dissVal = sg.a * 0.66 + nz.r * 0.44;
        if (uDissolve > 0.01 && dissVal < uDissolve) discard;

        float wave = uPulseSpeed == 0.0
          ? 0.94
          : (0.78 + 0.44 * pow(max(0.0, sin(rad * 14.0 - uTime * uPulseSpeed)), 3.0));
        float a = clamp(sg.a * drawMask * (0.85 + 0.25 * nz.b), 0.0, 0.98);
        if (a < 0.014) discard;

        float luma = dot(sg.rgb, vec3(0.299, 0.587, 0.114));
        float maxC = max(sg.r, max(sg.g, sg.b));
        float minC = min(sg.r, min(sg.g, sg.b));
        float sat = maxC - minC;

        float heat = clamp(0.20 + luma * 0.64 + sat * 0.22 + (wave - 0.78) * 0.28, 0.0, 0.99);
        vec3 rampCol = sampleRamp(uRamp, heat);
        float emissiveBoost = mix(1.06, uHdr * wave * 1.15, smoothstep(0.30, 0.85, maxC + sat * 0.35));
        vec3 authCol = sg.rgb * emissiveBoost;
        vec3 col = mix(authCol, rampCol * uHdr * wave, uTintMix);
        if (luma > 0.76) {
          col = mix(col, uRamp[6] * (uHdr * 1.18), (luma - 0.76) * 1.8);
        }
        col = mix(col, uRamp[6] * (uHdr * 1.75), clamp(uFlash, 0.0, 1.0));
        if (uNormalBlend > 0.5) {
          gl_FragColor = vec4(col, a);
        } else {
          gl_FragColor = vec4(col * a, a);
        }
      }
    `,
  });
}

// ============================================================================
// Pick Complementary Multi-Layer Styles by Eastern vs Western Tradition
// ============================================================================
function pickLayerStyles(baseStyle, tradition, layers, arrayKind) {
  const s0 = remapSigilStyle(baseStyle, true);
  const isEast = tradition === 'eastern' || (tradition === 'auto' && getSigilTradition(s0) === 'eastern');
  if (layers <= 1) {
    return [arrayKind === 'qimen_square' ? (isEast ? 'talismanSeal' : 'hermeticAlchemy') : (isEast ? (s0 === 'baguaSimple' ? 'baguaSimple' : s0) : (s0 === 'runeSimple' ? 'runeSimple' : s0))];
  }
  if (isEast) {
    if (arrayKind === 'sword_lotus') return ['lotusMandala', 'xianxiaSword', 'baguaSimple', 'qimenComplex'].slice(0, layers);
    if (arrayKind === 'qimen_square' || arrayKind === 'talisman_seal') return ['qimenComplex', 'talismanSeal', 'baguaSimple', 'dragonFlame'].slice(0, layers);
    return [
      s0 === 'baguaSimple' && layers >= 3 ? 'qimenComplex' : s0,
      'talismanSeal',
      'lotusMandala',
      'xianxiaSword',
    ].slice(0, layers);
  }
  if (arrayKind === 'qimen_square') {
    return ['hermeticAlchemy', 'solomon', 'kabbalahTree', 'celestial'].slice(0, layers);
  }
  return [
    layers >= 4 ? 'siegeCataclysm' : s0,
    'hermeticAlchemy',
    'kabbalahTree',
    'celestial',
  ].slice(0, layers);
}

// ============================================================================
// MagicArray3D: Unified Multi-Taxonomy Magic Circle Engine
//   - Cultural Tradition: 'eastern' (中式/東方) vs 'western' (西式/西方)
//   - Layer Complexity: 1 (極簡1層) | 2 (對轉2層) | 3 (立體3層) | 4 (屠城禁咒4層+)
//   - Array Genres ('arrayKind'):
//       'layered'          — 1..4 concentric elevated 3D tiers
//       'qimen_square'     — 外圓內方・奇門九宮方印陣 (3x3 Nine-Palace grid + square seal)
//       'satellite'        — 子母連攜星宿/八門大陣 (central mother + 4/6/8 child circles + leyline beams)
//       'vertical_cannon'  — 立體銃口多重垂直穿透門陣 (coaxial vertical gates along aim vector)
//       'talisman_seal'    — 道家懸浮符籙鎮封十字陣 (orbiting vertical talisman slabs)
//       'sword_lotus'      — 太虛八方御劍青蓮劍陣 (lotus mandala + 8 hovering 3D spirit swords)
//       'sequential_chant' — 逐層疊加詠唱奧義陣 (layers unlock one-by-one at stage intervals, then flash!)
// ============================================================================
export class MagicArray3D {
  constructor({
    x = 0, y = 0.025, z = 0,
    radius = 2.4,
    duration = 2.4,
    tradition = 'auto',        // 'auto' | 'eastern' | 'western'
    arrayKind = 'layered',     // 'layered' | 'qimen_square' | 'satellite' | 'vertical_cannon' | 'talisman_seal' | 'sword_lotus' | 'sequential_chant'
    layers = 3,                // 1 | 2 | 3 | 4
    style = 'solomon',
    layerStyles = null,        // optional explicit array of sigil styles per layer
    palette = PAL3D.mageArcane,
    hdr = 1.95,
    satelliteCount = 0,        // auto-chosen if 0 on 'satellite' or siege 4-layer
    aimOrigin = null,          // Vector3 for 'vertical_cannon'
    aimDir = null,             // Vector3 for 'vertical_cannon'
    chantDuration = 0,         // >0 enables sequential layer-by-layer chant lock-in & climax flash!
    exactStyle = false,
  } = {}) {
    this.duration = duration;
    this.t = 0;
    this._aoeScaleMul = 1.0;
    this.chantDuration = chantDuration > 0 ? chantDuration : (arrayKind === 'sequential_chant' ? duration * 0.68 : 0);
    this.arrayKind = arrayKind;

    // Apply live UI overrides when user explicitly forces Tradition / Complexity
    let effTrad = FX_CONFIG.sigilTradition !== 'auto' && !exactStyle ? FX_CONFIG.sigilTradition : tradition;
    if (effTrad === 'auto') effTrad = getSigilTradition(style);
    this.tradition = effTrad;

    let effKind = arrayKind;
    let effLayers = clamp(Math.round(layers), 1, 4);
    if (FX_CONFIG.sigilComplexity !== 'auto' && !exactStyle && arrayKind !== 'vertical_cannon' && arrayKind !== 'sequential_chant') {
      const c = FX_CONFIG.sigilComplexity;
      if (c === 'simple1') { effKind = 'layered'; effLayers = 1; }
      else if (c === 'dual2') { effKind = 'layered'; effLayers = 2; }
      else if (c === 'complex3') { effKind = 'layered'; effLayers = 3; }
      else if (c === 'siege4') { effKind = 'satellite'; effLayers = 4; }
      else { effKind = c; effLayers = Math.max(2, effLayers); }
    }
    this.effKind = effKind;
    this.layers = effLayers;

    this.group = new THREE.Group();
    if (effKind === 'vertical_cannon') {
      const orig = aimOrigin ? aimOrigin.clone() : new THREE.Vector3(x, Math.max(1.15, y), z);
      const dir = (aimDir ? aimDir.clone() : new THREE.Vector3(0, 0, 1)).normalize();
      this.group.position.copy(orig);
      this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    } else {
      this.group.position.set(x, y, z);
    }

    this.geos = [];
    this.mats = [];
    this.discEntries = [];
    this.satellites = [];
    this.floatProps = [];
    this.gimbals = [];

    const ramp = rampToColors(palette, 7);
    const lib = getTexLib();
    const styles = (layerStyles && layerStyles.length >= effLayers)
      ? layerStyles.map((s) => remapSigilStyle(s, exactStyle))
      : pickLayerStyles(style, effTrad, effLayers, effKind);

    if (effKind === 'vertical_cannon') {
      // Coaxial vertical muzzle-accelerator magic rings spaced along local +Z!
      const gateCount = Math.max(3, effLayers);
      const spacing = clamp(radius * 0.72, 0.75, 1.55);
      for (let i = 0; i < gateCount; i++) {
        const u = i / Math.max(1, gateCount - 1);
        const gateR = radius * lerp(0.46, 1.08, Math.sin(u * Math.PI * 0.72 + 0.25));
        const st = styles[i % styles.length];
        const gPlane = new THREE.PlaneGeometry(gateR * 2, gateR * 2);
        const mat = createSigilLayerMaterial({
          style: st, palette, hdr: hdr * (1.08 - i * 0.05),
          pulseSpeed: (i % 2 === 0 ? 1 : -1) * (9.0 + i * 2.0),
          isGroundDisc: false, exactStyle,
        });
        this.geos.push(gPlane); this.mats.push(mat);
        const mesh = new THREE.Mesh(gPlane, mat);
        mesh.position.z = i * spacing;

        const gRim = new THREE.TorusGeometry(gateR * 0.94, 0.018, 8, 56);
        const mRim = new THREE.MeshBasicMaterial({
          color: ramp[5].clone().multiplyScalar(hdr * 0.8),
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        this.geos.push(gRim); this.mats.push(mRim);
        const rim = new THREE.Mesh(gRim, mRim);
        rim.position.z = i * spacing;
        this.group.add(mesh, rim);

        const unlockFrac = this.chantDuration > 0 ? (i / gateCount) * 0.82 : i * 0.08;
        this.discEntries.push({
          mesh, mat, rim, mRim,
          spinAxis: 'z',
          spinSpeed: (i % 2 === 0 ? 1 : -1) * (1.1 + i * 0.35),
          unlockTime: this.chantDuration > 0 ? unlockFrac * this.chantDuration : i * 0.09,
          baseScale: 1.0,
        });
      }

      // 4 sleek 3D accelerator guide rails linking all vertical cannon gates
      const totalSpan = (gateCount - 1) * spacing;
      const railGeo = new THREE.CylinderGeometry(0.014, 0.014, Math.max(0.2, totalSpan), 6);
      railGeo.rotateX(Math.PI / 2);
      railGeo.translate(0, 0, totalSpan * 0.5);
      const railMat = new THREE.MeshBasicMaterial({
        color: ramp[4].clone().multiplyScalar(hdr * 0.72),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      this.geos.push(railGeo); this.mats.push(railMat);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + Math.PI / 4;
        const rr = radius * 0.68;
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0);
        this.group.add(rail);
      }
      this.railMat = railMat;
      this.update(0);
      return;
    }

    // Horizontal / 3D Multi-Tier Tower Array (1..4 layers)
    const tierHeights = [0.0, 0.26, 0.58, 0.98];
    const tierRadii   = [1.0, 0.74, 0.54, 0.86];
    for (let i = 0; i < effLayers; i++) {
      const rLayer = radius * tierRadii[i];
      const yLayer = tierHeights[i] * clamp(radius / 2.2, 0.75, 1.45);
      const st = styles[i % styles.length];
      const isSq = (effKind === 'qimen_square' && i === 1) || st === 'talismanSeal';
      const gPlane = new THREE.PlaneGeometry(rLayer * 2, rLayer * 2);
      gPlane.rotateX(-Math.PI / 2);
      const mat = createSigilLayerMaterial({
        style: st,
        palette,
        hdr: hdr * (i === 0 ? 0.96 : 0.84),
        pulseSpeed: (i % 2 === 0 ? 1 : -1) * (8.5 + i * 2.5),
        isGroundDisc: i === 0,
        isSquare: isSq,
        exactStyle,
      });
      this.geos.push(gPlane); this.mats.push(mat);
      const mesh = new THREE.Mesh(gPlane, mat);
      mesh.position.y = yLayer;
      this.group.add(mesh);

      const gRim = new THREE.TorusGeometry(rLayer * 0.93, i === 0 ? 0.018 : 0.013, 8, 64);
      gRim.rotateX(Math.PI / 2);
      const mRim = new THREE.MeshBasicMaterial({
        color: ramp[i % 2 === 0 ? 5 : 4].clone().multiplyScalar(hdr * 0.72),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      this.geos.push(gRim); this.mats.push(mRim);
      const rim = new THREE.Mesh(gRim, mRim);
      rim.position.y = yLayer + 0.012;
      this.group.add(rim);

      const unlockTime = this.chantDuration > 0
        ? (i / Math.max(1, effLayers)) * this.chantDuration * 0.82
        : i * 0.11;

      this.discEntries.push({
        mesh, mat, rim, mRim,
        spinAxis: 'y',
        spinSpeed: (i % 2 === 0 ? 1 : -1) * (effLayers === 1 ? 0.42 : 0.68 + i * 0.42),
        unlockTime,
        baseScale: 1.0,
      });
    }

    // Rising cylindrical rune curtain for >= 2 layers
    if (effLayers >= 2 && FX_CONFIG.tier >= 2) {
      const wallH = clamp(radius * (0.24 + effLayers * 0.08), 0.35, 1.35);
      const gWall = new THREE.CylinderGeometry(radius * 0.93, radius * 0.93, wallH, 56, 1, true);
      gWall.translate(0, wallH * 0.5, 0);
      const mWall = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uAuraTex: { value: effTrad === 'eastern' ? lib.chargeQiFlow : lib.auraRunes },
          uNoiseTex: { value: lib.flowNoise },
          uHdr: { value: hdr * 0.72 },
          uRamp: { value: ramp },
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime, uOpacity, uHdr;
          uniform sampler2D uAuraTex, uNoiseTex;
          uniform vec3 uRamp[7];
          ${GLSL_NOISE}
          void main() {
            vec4 nz = texture2D(uNoiseTex, vec2(vUv.x * 4.0 - uTime * 0.25, vUv.y * 1.6 - uTime * 1.5));
            vec4 au = texture2D(uAuraTex, vec2(vUv.x * 3.0 + uTime * 0.18 + (nz.r - 0.5) * 0.04, clamp(vUv.y, 0.02, 0.98)));
            float vFade = 1.0 - smoothstep(0.12, 1.0, vUv.y);
            float lum = max(au.r, max(au.g, au.b));
            float a = au.a * (0.42 + 0.68 * lum) * vFade * uOpacity * 0.52;
            if (a < 0.012) discard;
            float heat = clamp(0.26 + lum * 0.52 + (1.0 - vUv.y) * 0.24, 0.0, 0.98);
            vec3 col = sampleRamp(uRamp, heat) * uHdr;
            gl_FragColor = vec4(col * a, a);
          }
        `,
      });
      this.geos.push(gWall); this.mats.push(mWall);
      this.wallMesh = new THREE.Mesh(gWall, mWall);
      this.wallMat = mWall;
      this.group.add(this.wallMesh);
    }

    // Tilted 3D armillary gimbal rings for Western complex (>=3 layers)
    if (effLayers >= 3 && effTrad === 'western') {
      const gGimbal = new THREE.TorusGeometry(radius * 0.62, 0.015, 8, 64);
      const mGimbal = new THREE.MeshBasicMaterial({
        color: ramp[5].clone().multiplyScalar(hdr * 0.78),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      this.geos.push(gGimbal); this.mats.push(mGimbal);
      for (let k = 0; k < 2; k++) {
        const gm = new THREE.Mesh(gGimbal, mGimbal);
        gm.position.y = 0.52 * clamp(radius / 2.2, 0.8, 1.4);
        gm.rotation.set(0.48 * (k === 0 ? 1 : -1), k * 1.1, 0.35);
        this.group.add(gm);
        this.gimbals.push({ mesh: gm, mat: mGimbal, speed: k === 0 ? 1.6 : -1.9 });
      }
    }

    // Genre 1: 外圓內方・奇門九宮方印陣 ('qimen_square') — 3D 3x3 Nine-Palace Lattice + 4 Corner Jade Seals
    if (effKind === 'qimen_square') {
      const sqHalf = radius * 0.66;
      const barLen = sqHalf * 2;
      const barGeo = new THREE.BoxGeometry(barLen, 0.028, 0.032);
      const barMat = new THREE.MeshBasicMaterial({
        color: ramp[5].clone().multiplyScalar(hdr * 0.88),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      this.geos.push(barGeo); this.mats.push(barMat);
      const qimenGroup = new THREE.Group();
      qimenGroup.position.y = 0.045;
      // Outer square (-1, +1) + internal 3x3 Nine-Palace grid (-1/3, +1/3)
      for (const f of [-1, -0.333, 0.333, 1]) {
        const bX = new THREE.Mesh(barGeo, barMat);
        bX.position.set(0, 0, f * sqHalf);
        const bZ = new THREE.Mesh(barGeo, barMat);
        bZ.rotation.y = Math.PI / 2;
        bZ.position.set(f * sqHalf, 0, 0);
        qimenGroup.add(bX, bZ);
      }
      const pilGeo = new THREE.BoxGeometry(0.08, 0.48, 0.08);
      pilGeo.translate(0, 0.24, 0);
      this.geos.push(pilGeo);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const pil = new THREE.Mesh(pilGeo, barMat);
          pil.position.set(sx * sqHalf, 0, sz * sqHalf);
          qimenGroup.add(pil);
        }
      }
      this.group.add(qimenGroup);
      this.qimenBarMat = barMat;
      this.qimenGroup = qimenGroup;
    }

    // Genre 2: 子母連攜星宿/八門大陣 ('satellite' or 4-layer siege array)
    const satN = satelliteCount > 0
      ? satelliteCount
      : (effKind === 'satellite' ? (effTrad === 'eastern' ? 8 : 6) : (effLayers >= 4 ? (effTrad === 'eastern' ? 8 : 6) : 0));
    if (satN > 0) {
      const satR = radius * 0.28;
      const orbitDist = radius * 1.12;
      const satStyle = effTrad === 'eastern' ? 'baguaSimple' : 'runeSimple';
      const gSat = new THREE.PlaneGeometry(satR * 2, satR * 2);
      gSat.rotateX(-Math.PI / 2);
      const mSat = createSigilLayerMaterial({
        style: satStyle, palette, hdr: hdr * 0.92, pulseSpeed: 10.5, isGroundDisc: false, exactStyle,
      });
      const gLink = new THREE.BoxGeometry(0.032, 0.018, orbitDist);
      gLink.translate(0, 0.025, orbitDist * 0.5);
      const mLink = new THREE.MeshBasicMaterial({
        color: ramp[5].clone().multiplyScalar(hdr * 0.82),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const gBeacon = new THREE.CylinderGeometry(0.018, 0.042, clamp(radius * 0.55, 0.65, 1.85), 6);
      gBeacon.translate(0, clamp(radius * 0.55, 0.65, 1.85) * 0.5, 0);
      this.geos.push(gSat, gLink, gBeacon);
      this.mats.push(mSat, mLink);
      this.satMat = mSat;
      this.satLinkMat = mLink;

      const satUnlock = this.chantDuration > 0 ? this.chantDuration * 0.56 : 0.18;
      for (let i = 0; i < satN; i++) {
        const a = (i / satN) * TAU;
        const holder = new THREE.Group();
        holder.rotation.y = a;
        const subDisc = new THREE.Mesh(gSat, mSat);
        subDisc.position.set(0, 0.035, orbitDist);
        const beacon = new THREE.Mesh(gBeacon, mLink);
        beacon.position.set(0, 0.02, orbitDist);
        const link = new THREE.Mesh(gLink, mLink);
        holder.add(subDisc, beacon, link);
        this.group.add(holder);
        this.satellites.push({ holder, subDisc, unlockTime: satUnlock + i * 0.025 });
      }
    }

    // Genre 3 & 4: Floating Daoist Talisman Slabs ('talisman_seal') OR Hovering Spirit Swords ('sword_lotus')
    if (effKind === 'talisman_seal' || effKind === 'sword_lotus') {
      const count = 8;
      const isSword = effKind === 'sword_lotus';
      const propGeo = isSword
        ? new THREE.ConeGeometry(0.055, 0.92, 4)
        : new THREE.PlaneGeometry(0.24, 0.68);
      if (isSword) propGeo.rotateX(Math.PI); // blade tip pointing down toward array!
      const propMat = isSword
        ? new THREE.MeshBasicMaterial({
            color: ramp[5].clone().multiplyScalar(hdr * 0.92),
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          })
        : new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
            uniforms: {
              uTime: { value: 0 },
              uFade: { value: 1 },
              uTex: { value: lib.sigilTalismanSeal },
              uRamp: { value: ramp },
              uHdr: { value: hdr * 0.95 },
            },
            vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
            fragmentShader: `
              varying vec2 vUv;
              uniform float uTime, uFade, uHdr;
              uniform sampler2D uTex;
              uniform vec3 uRamp[7];
              ${GLSL_NOISE}
              void main() {
                vec4 tx = texture2D(uTex, vUv);
                float border = step(0.88, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0);
                float a = clamp((tx.a * 0.85 + border * 0.55) * uFade, 0.0, 0.96);
                if (a < 0.015) discard;
                float luma = dot(tx.rgb, vec3(0.3, 0.59, 0.11));
                vec3 col = mix(tx.rgb * uHdr, sampleRamp(uRamp, clamp(0.35 + luma * 0.6, 0.0, 0.98)) * uHdr, 0.35);
                gl_FragColor = vec4(col * a, a);
              }
            `,
          });
      this.geos.push(propGeo); this.mats.push(propMat);
      this.floatPropMat = propMat;
      this.floatPropIsShader = !isSword;

      const orbitRing = new THREE.Group();
      this.group.add(orbitRing);
      this.floatOrbitGroup = orbitRing;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU;
        const m = new THREE.Mesh(propGeo, propMat);
        const rr = radius * 0.82;
        m.position.set(Math.sin(a) * rr, 0.62 + (i % 2) * 0.16, Math.cos(a) * rr);
        m.rotation.y = a;
        if (isSword) m.rotation.x += 0.18;
        orbitRing.add(m);
        this.floatProps.push({ mesh: m, baseY: m.position.y, phase: i * 0.8 });
      }
    }

    this.update(0);
  }

  update(dt) {
    this.t += dt;
    const p = clamp(this.t / this.duration);
    this.group.visible = this.t >= 0 && this.t < this.duration;
    if (!this.group.visible) return;

    const globalDissolve = smooth(0.80, 1.0, p) * 1.08;
    const globalFade = 1 - smooth(0.80, 1.0, p);
    const sMul = this._aoeScaleMul || 1.0;
    if (this.effKind === 'vertical_cannon') {
      this.group.scale.set(sMul, sMul, 1);
    } else {
      this.group.scale.set(sMul, 1, sMul);
    }

    // Climax flash right when sequential chant reaches 100%!
    const climaxFlash = this.chantDuration > 0
      ? Math.max(0, 1 - Math.abs(this.t - this.chantDuration) / 0.18)
      : 0;

    for (const d of this.discEntries) {
      const localT = this.t - d.unlockTime;
      if (localT < 0) {
        d.mesh.visible = false;
        d.rim.visible = false;
        continue;
      }
      d.mesh.visible = true;
      d.rim.visible = true;
      const pop = ease.outBack(clamp(localT / 0.22), 1.45) * d.baseScale;
      const reveal = ease.outCubic(clamp(localT / 0.28)) * 1.16;
      const lockFlash = this.chantDuration > 0 ? Math.max(climaxFlash, clamp(1 - localT / 0.14) * 0.75) : 0;

      if (d.spinAxis === 'z') {
        d.mesh.scale.setScalar(pop);
        d.rim.scale.setScalar(pop);
        d.mesh.rotation.z += dt * d.spinSpeed;
      } else {
        d.mesh.scale.set(pop, 1, pop);
        d.rim.scale.set(pop, pop, 1);
        d.mesh.rotation.y += dt * d.spinSpeed;
      }
      d.mat.uniforms.uTime.value = this.t;
      d.mat.uniforms.uReveal.value = reveal;
      d.mat.uniforms.uDissolve.value = globalDissolve;
      d.mat.uniforms.uFlash.value = lockFlash;
      d.mRim.opacity = globalFade * (0.72 + lockFlash * 0.28);
    }

    if (this.railMat) this.railMat.opacity = globalFade * 0.72;
    if (this.wallMat) {
      this.wallMat.uniforms.uTime.value = this.t;
      this.wallMat.uniforms.uOpacity.value = globalFade;
    }
    for (const g of this.gimbals) {
      g.mesh.rotation.y += dt * g.speed;
      g.mesh.rotation.x += dt * g.speed * 0.45;
      g.mat.opacity = globalFade * 0.75;
    }
    if (this.qimenBarMat) {
      this.qimenBarMat.opacity = globalFade * (0.78 + 0.18 * Math.sin(this.t * 8.0));
      this.qimenGroup.rotation.y += dt * 0.18;
    }
    if (this.satellites.length > 0) {
      this.satMat.uniforms.uTime.value = this.t;
      this.satMat.uniforms.uReveal.value = 1.15;
      this.satMat.uniforms.uDissolve.value = globalDissolve;
      this.satMat.uniforms.uFlash.value = climaxFlash;
      this.satLinkMat.opacity = globalFade * 0.74;
      for (const s of this.satellites) {
        const lt = this.t - s.unlockTime;
        s.holder.visible = lt >= 0;
        if (lt >= 0) {
          const sp = ease.outBack(clamp(lt / 0.20), 1.5);
          s.subDisc.scale.set(sp, 1, sp);
          s.subDisc.rotation.y -= dt * 2.1;
          s.holder.rotation.y += dt * 0.24;
        }
      }
    }
    if (this.floatOrbitGroup) {
      this.floatOrbitGroup.rotation.y += dt * 1.15;
      for (const fp of this.floatProps) {
        fp.mesh.position.y = fp.baseY + Math.sin(this.t * 4.5 + fp.phase) * 0.08;
      }
      if (this.floatPropIsShader) {
        this.floatPropMat.uniforms.uTime.value = this.t;
        this.floatPropMat.uniforms.uFade.value = globalFade;
      } else {
        this.floatPropMat.opacity = globalFade * 0.88;
      }
    }
  }

  get done() { return this.t >= this.duration; }
  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
  }
}

// ============================================================================
// CastBar3D: Synchronized 3D World Floating Cast Gauge + Stage HUD Cast Bar!
// Shows Stage I -> II -> III -> IV lock-in ticks matching sequential circle stacking
// before flashing "✦ 奧義解放！✦" upon release!
// ============================================================================
export class CastBar3D {
  constructor({
    sim,
    getAnchor = () => new THREE.Vector3(0, 2.38, 0),
    castDuration = 2.2,
    holdAfterRelease = 0.55,
    stages = 4,
    spellTitle = '四重疊陣奧義詠唱',
    spellTitleEn = '',
    traditionLabel = '太古奧義',
    traditionLabelEn = '',
    isMartialQi = false,
    palette = PAL3D.mageArcane,
  } = {}) {
    this.sim = sim;
    this.getAnchor = getAnchor;
    this.castDuration = Math.max(0.2, castDuration);
    this.duration = this.castDuration + holdAfterRelease;
    this.stages = clamp(Math.round(stages), 2, 6);
    this.spellTitle = spellTitle;
    this.spellTitleEn = spellTitleEn;
    this.traditionLabel = traditionLabel;
    this.traditionLabelEn = traditionLabelEn;
    this.isMartialQi = Boolean(isMartialQi);
    this.t = 0;
    this._skipAutoMap = true;

    const ramp = rampToColors(palette, 7);
    this.geos = [];
    this.mats = [];
    this.group = new THREE.Group();

    // Sleek 3D world-space arcane cast bar frame above caster
    const barW = 1.28, barH = 0.095;
    const bgGeo = new THREE.PlaneGeometry(barW + 0.08, barH + 0.055);
    const bgMat = new THREE.MeshBasicMaterial({
      color: 0x090d18, transparent: true, opacity: 0.82, depthWrite: false, side: THREE.DoubleSide,
    });
    const borderGeo = new THREE.PlaneGeometry(barW + 0.12, barH + 0.085);
    const borderMat = new THREE.MeshBasicMaterial({
      color: ramp[4].clone().multiplyScalar(1.35),
      transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const fillGeo = new THREE.PlaneGeometry(barW, barH);
    fillGeo.translate(barW * 0.5, 0, 0);
    const fillMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uFill: { value: 0 },
        uFade: { value: 1 },
        uClimax: { value: 0 },
        uRamp: { value: ramp },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime, uFill, uFade, uClimax;
        uniform vec3 uRamp[7];
        ${GLSL_NOISE}
        void main() {
          if (vUv.x > uFill) discard;
          float edgeGlow = smoothstep(uFill - 0.08, uFill, vUv.x);
          float flow = 0.78 + 0.28 * sin(vUv.x * 24.0 - uTime * 14.0);
          float heat = clamp(0.32 + vUv.x * 0.48 + edgeGlow * 0.35 + uClimax * 0.4, 0.0, 0.99);
          vec3 col = sampleRamp(uRamp, heat) * (1.55 + edgeGlow * 0.85 + uClimax * 0.9) * flow;
          float a = clamp((0.82 + edgeGlow * 0.18) * uFade, 0.0, 1.0);
          gl_FragColor = vec4(col * a, a);
        }
      `,
    });

    this.geos.push(bgGeo, borderGeo, fillGeo);
    this.mats.push(bgMat, borderMat, fillMat);

    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.position.z = -0.004;
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    fillMesh.position.set(-barW * 0.5, 0, 0.004);
    this.group.add(borderMesh, bgMesh, fillMesh);
    this.bgMat = bgMat;
    this.borderMat = borderMat;
    this.fillMat = fillMat;

    // 3D diamond rune pips above the cast bar showing Stage 1..N lock-in!
    const pipGeo = new THREE.OctahedronGeometry(0.052, 0);
    this.geos.push(pipGeo);
    this.pips = [];
    for (let i = 0; i < this.stages; i++) {
      const pipMat = new THREE.MeshBasicMaterial({
        color: ramp[5].clone().multiplyScalar(1.85),
        transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      this.mats.push(pipMat);
      const pm = new THREE.Mesh(pipGeo, pipMat);
      const px = lerp(-barW * 0.42, barW * 0.42, this.stages === 1 ? 0.5 : i / (this.stages - 1));
      pm.position.set(px, barH + 0.085, 0.006);
      this.group.add(pm);
      this.pips.push({ mesh: pm, mat: pipMat, threshold: (i / this.stages) * 0.84 });
    }

    this.accentHex = '#' + ramp[5].getHexString();
    this._skipAutoMap = true;
    this._syncDomHud(0, false, 1);
  }

  _syncDomHud(prog, released, fade) {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('cast-bar-hud');
    if (!el) return;
    if (fade <= 0.02) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.style.opacity = fade.toFixed(3);
    el.style.setProperty('--cast-accent', this.accentHex);

    const titleEl = document.getElementById('cast-hud-title');
    const stageEl = document.getElementById('cast-hud-stage');
    const fillEl = document.getElementById('cast-hud-fill');
    const pipsEl = document.getElementById('cast-hud-pips');

    const unlocked = released
      ? this.stages
      : Math.min(this.stages, Math.max(1, Math.floor((prog / 0.85) * this.stages) + 1));
    const curSec = Math.min(this.castDuration, Math.max(0, this.t)).toFixed(2);
    const totSec = this.castDuration.toFixed(2);
    const isEn = FX_CONFIG.lang !== 'zh';

    const isMartialQi = Boolean(
      this.isMartialQi ||
      this.traditionLabel.includes('武神') ||
      this.traditionLabel.includes('真氣') ||
      this.traditionLabel.includes('Martial')
    );
    const dispTrad = isEn && this.traditionLabelEn ? this.traditionLabelEn : this.traditionLabel;
    const dispTitle = isEn && this.spellTitleEn ? this.spellTitleEn : this.spellTitle;
    if (titleEl) titleEl.textContent = `[${dispTrad}] ${dispTitle}`;
    if (stageEl) {
      if (isEn) {
        stageEl.textContent = isMartialQi
          ? (released
            ? `⚔ ${this.stages}-Stage Martial Qi Ready (${totSec}s) · Released! ⚔`
            : `Stage ${unlocked}/${this.stages} Qi Gather · ${curSec}s / ${totSec}s (${Math.round(prog * 100)}%)`)
          : (released
            ? `✦ ${this.stages}-Tier Array Complete (${totSec}s) · Released! ✦`
            : `Tier ${unlocked}/${this.stages} Chanting · ${curSec}s / ${totSec}s (${Math.round(prog * 100)}%)`);
      } else {
        stageEl.textContent = isMartialQi
          ? (released
            ? `⚔ ${this.stages} 段鬥氣蓄勢完畢 (${totSec}s)・武技釋放！ ⚔`
            : `第 ${unlocked}/${this.stages} 段鬥氣蓄勢 · ${curSec}s / ${totSec}s (${Math.round(prog * 100)}%)`)
          : (released
            ? `✦ ${this.stages} 重法陣詠唱完畢 (${totSec}s)・技能釋放！ ✦`
            : `第 ${unlocked}/${this.stages} 重詠唱 · ${curSec}s / ${totSec}s (${Math.round(prog * 100)}%)`);
      }
    }
    if (fillEl) fillEl.style.width = `${(clamp(prog, 0, 1) * 100).toFixed(1)}%`;
    if (pipsEl) {
      const pipKey = `${isEn ? 'en' : 'zh'}_${isMartialQi ? 'm' : 'a'}`;
      if (pipsEl.childElementCount !== this.stages || pipsEl.dataset.pipUnit !== pipKey) {
        pipsEl.dataset.pipUnit = pipKey;
        pipsEl.innerHTML = Array.from({ length: this.stages }, (_, idx) => {
          const lbl = isEn
            ? `${isMartialQi ? 'Stage' : 'Tier'} ${idx + 1}`
            : `第${idx + 1}${isMartialQi ? '段' : '陣'}`;
          return `<span class="cast-pip" data-idx="${idx}">${lbl}</span>`;
        }).join('');
      }
      for (let i = 0; i < pipsEl.children.length; i++) {
        pipsEl.children[i].classList.toggle('on', i < unlocked || released);
      }
    }
  }

  update(dt) {
    this.t += dt;
    const vis = this.t >= 0 && this.t < this.duration;
    this.group.visible = vis;
    if (!vis) {
      this._syncDomHud(1, true, 0);
      return;
    }

    const pos = this.getAnchor();
    this.group.position.copy(pos);
    if (this.sim?._lastCam) {
      this.group.quaternion.copy(this.sim._lastCam.quaternion);
    }

    const prog = clamp(this.t / this.castDuration, 0, 1);
    const released = this.t >= this.castDuration;
    const fade = 1 - smooth(this.castDuration + 0.15, this.duration, this.t);
    const climax = released ? clamp(1 - (this.t - this.castDuration) / 0.35, 0, 1) : 0;

    this.fillMat.uniforms.uTime.value = this.t;
    this.fillMat.uniforms.uFill.value = Math.max(0.01, prog);
    this.fillMat.uniforms.uFade.value = fade;
    this.fillMat.uniforms.uClimax.value = climax;
    this.bgMat.opacity = 0.78 * fade;
    this.borderMat.opacity = (0.68 + climax * 0.32) * fade;

    for (const pip of this.pips) {
      const on = prog >= pip.threshold;
      pip.mat.opacity = (on ? 0.95 : 0.20) * fade;
      const sc = on ? (1.15 + climax * 0.35) : 0.72;
      pip.mesh.scale.setScalar(sc);
      if (on) pip.mesh.rotation.y += dt * 4.5;
    }

    this._syncDomHud(prog, released, fade);
  }

  get done() { return this.t >= this.duration; }
  dispose() {
    this._syncDomHud(0, false, 0);
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
  }
}

registerSigilExtraFactory(({ radius, duration, style, palette, hdr }) => {
  const comp = FX_CONFIG.sigilComplexity;
  const kind = comp === 'complex3' ? 'layered' : (comp === 'siege4' ? 'satellite' : comp);
  return new MagicArray3D({
    x: 0, y: 0.01, z: 0,
    radius: radius * 0.96,
    duration,
    style,
    palette,
    hdr: hdr * 0.92,
    arrayKind: kind,
    layers: comp === 'siege4' ? 4 : 3,
  });
});
