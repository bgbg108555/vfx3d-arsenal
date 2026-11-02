import * as THREE from 'three';
import { collideSphereFields } from './distance_field3d.js';
import { getTexLib, resolveSigilTex, resolveSlashTex } from './texgen3d.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;

function rampToColorsLocal(hexList, n = 7) {
  const src = hexList.map((h) => new THREE.Color(h));
  if (src.length === n) return src;
  return Array.from({ length: n }, (_, i) => {
    const u = (i * (src.length - 1)) / Math.max(1, n - 1);
    const idx = Math.min(src.length - 2, Math.floor(u));
    return src[idx].clone().lerp(src[idx + 1], u - idx);
  });
}

// Fast analytic divergence-free 3D Curl-Noise velocity field for Unreal Niagara turbulence
export function sampleCurl3D(x, y, z, time, freq = 1.65) {
  const px = x * freq + time * 0.85;
  const py = y * freq - time * 1.05;
  const pz = z * freq + time * 0.72;
  // Potential vector field Psi = (p1, p2, p3); Curl = dPsi_z/dy - dPsi_y/dz, etc.
  const cx = Math.cos(py * 1.7 + Math.sin(pz * 1.3)) - Math.sin(pz * 1.9 + Math.cos(px * 1.4));
  const cy = Math.cos(pz * 1.6 + Math.sin(px * 1.5)) - Math.sin(px * 1.8 + Math.cos(py * 1.2));
  const cz = Math.cos(px * 1.7 + Math.sin(py * 1.4)) - Math.sin(py * 1.6 + Math.cos(pz * 1.5));
  return [cx, cy, cz];
}

// ============================================================================
// 1. Unreal Engine 5 Niagara-Grade Semi-Transparent Hard-Light / Crystal Shader
// ============================================================================
// Used for Summoned Shields, Astral Greatswords, Storm Warhammers, Soul-Chains,
// Crystal Obelisks, and Spirit Arrows — ZERO opaque brown cardboard blocks!
export function makeTranslucentConstructMaterial({
  palette,
  sigilStyle = null,      // e.g. 'holy', 'war', 'crescent', 'arcane', 'abyss', 'nature'
  useHexLattice = true,
  baseAlpha = 0.24,
  rimAlpha = 0.88,
  rimPower = 2.15,
  hdr = 1.48,
  additive = false,
  hexRepeat = [4.5, 4.5],
} = {}) {
  const lib = getTexLib();
  const ramp = rampToColorsLocal(palette, 7);
  const hasSigil = Boolean(sigilStyle);
  const sigilTex = hasSigil ? resolveSigilTex(sigilStyle) : lib.flowNoise;
  const useAdditive = additive && baseAlpha < 0.12;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: useAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1.0 },
      uDissolve: { value: 0.0 },
      uFlash: { value: 0.0 },
      uHitTime: { value: -10.0 },
      uHitPos: { value: new THREE.Vector3(0, 0.1, 0.1) },
      uBaseAlpha: { value: useAdditive ? baseAlpha : Math.max(baseAlpha, 0.38) },
      uRimAlpha: { value: Math.max(rimAlpha, 0.88) },
      uRimPower: { value: rimPower },
      uHdr: { value: hdr },
      uUseSigil: { value: hasSigil ? 1.0 : 0.0 },
      uUseHex: { value: useHexLattice ? 1.0 : 0.0 },
      uHexRep: { value: new THREE.Vector2(hexRepeat[0], hexRepeat[1]) },
      uSigilTex: { value: sigilTex },
      uHexTex: { value: lib.hexShield },
      uNoiseTex: { value: lib.flowNoise },
      uAuraTex: { value: lib.auraRunes },
      uDamascusTex: { value: lib.metalDamascus },
      uCausticTex: { value: lib.causticsWater },
      uRamp: { value: ramp },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vLocalNorm;
      varying vec3 vNormView;
      varying vec3 vViewDir;
      varying vec3 vWorldNorm;
      void main() {
        vUv = uv;
        vLocalPos = position;
        vLocalNorm = normalize(normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        vWorldNorm = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vLocalNorm;
      varying vec3 vNormView;
      varying vec3 vViewDir;
      varying vec3 vWorldNorm;
      uniform float uTime, uOpacity, uDissolve, uFlash, uHitTime;
      uniform float uBaseAlpha, uRimAlpha, uRimPower, uHdr, uUseSigil, uUseHex;
      uniform vec2 uHexRep;
      uniform vec3 uHitPos;
      uniform sampler2D uSigilTex, uHexTex, uNoiseTex, uAuraTex, uDamascusTex, uCausticTex;
      uniform vec3 uRamp[7];

      vec3 sampleRamp7(vec3 r[7], float t) {
        float x = clamp(t, 0.0, 1.0) * 6.0;
        int i = int(floor(x));
        float f = fract(x);
        if (i <= 0) return mix(r[0], r[1], f);
        if (i == 1) return mix(r[1], r[2], f);
        if (i == 2) return mix(r[2], r[3], f);
        if (i == 3) return mix(r[3], r[4], f);
        if (i == 4) return mix(r[4], r[5], f);
        if (i == 5) return mix(r[5], r[6], f);
        return r[6];
      }

      vec4 sampleTriplanar(sampler2D tex, vec3 p, vec3 n, float sc) {
        vec3 w = pow(abs(n), vec3(4.0));
        w /= max(0.0001, w.x + w.y + w.z);
        vec4 tx = texture2D(tex, p.yz * sc);
        vec4 ty = texture2D(tex, p.xz * sc);
        vec4 tz = texture2D(tex, p.xy * sc);
        return tx * w.x + ty * w.y + tz * w.z;
      }

      void main() {
        vec3 nObj = normalize(vLocalNorm);
        vec4 dam0 = sampleTriplanar(uDamascusTex, vLocalPos, nObj, 1.55);
        vec4 damX = sampleTriplanar(uDamascusTex, vLocalPos + vec3(0.012, 0.0, 0.0), nObj, 1.55);
        vec4 damY = sampleTriplanar(uDamascusTex, vLocalPos + vec3(0.0, 0.012, 0.0), nObj, 1.55);
        vec4 caus = sampleTriplanar(uCausticTex, vLocalPos + vec3(uTime * 0.04, -uTime * 0.05, 0.0), nObj, 1.35);

        float grain = dot(dam0.rgb, vec3(0.333));
        float gx = dot(damX.rgb, vec3(0.333)) - grain;
        float gy = dot(damY.rgb, vec3(0.333)) - grain;

        vec3 N = normalize(vNormView + vec3(-gx * 2.6, -gy * 2.6, 0.0));
        vec3 V = normalize(vViewDir);
        float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
        float fresnel = pow(1.0 - ndv, uRimPower);

        vec2 pUv = vLocalPos.xy * 0.85 + vec2(vLocalPos.z * 0.45);
        vec4 nz1 = texture2D(uNoiseTex, pUv * 1.15 + vec2(uTime * 0.14, -uTime * 0.28));
        vec4 nz2 = texture2D(uNoiseTex, pUv * 2.10 - vec2(uTime * 0.22, uTime * 0.18));
        float caustic = clamp(caus.g * 0.62 + nz1.r * 0.32 + nz2.b * 0.36, 0.0, 1.0);

        float dissMask = nz1.r * 0.65 + nz2.g * 0.35;
        if (uDissolve > 0.005 && dissMask < uDissolve) discard;
        float burnEdge = uDissolve > 0.005
          ? (1.0 - smoothstep(uDissolve, uDissolve + 0.14, dissMask))
          : 0.0;

        float hexVal = 0.0;
        if (uUseHex > 0.5) {
          vec4 hx = sampleTriplanar(uHexTex, vLocalPos, nObj, uHexRep.x * 0.42);
          float hLuma = max(hx.r, max(hx.g, hx.b));
          float scan = 0.45 + 0.55 * pow(max(0.0, sin(vLocalPos.y * 7.5 - uTime * 4.5)), 4.0);
          hexVal = pow(clamp(hLuma, 0.0, 1.0), 2.2) * scan;
        }

        float sigilVal = 0.0;
        if (uUseSigil > 0.5) {
          vec2 sUv = clamp(vLocalPos.xy * vec2(0.86, 0.66) + 0.5, 0.0, 1.0);
          vec4 sg = texture2D(uSigilTex, sUv);
          float sLuma = max(sg.r, max(sg.g, sg.b));
          float inBounds = step(0.02, sUv.x) * step(sUv.x, 0.98) * step(0.02, sUv.y) * step(sUv.y, 0.98);
          sigilVal = pow(clamp(sLuma, 0.0, 1.0), 1.85) * inBounds;
        }

        vec3 Lkey = normalize(vec3(0.48, 0.76, 0.44));
        vec3 Lrim = normalize(vec3(-0.62, 0.35, -0.68));
        float diffKey = clamp(dot(N, Lkey) * 0.5 + 0.5, 0.0, 1.0);
        float backRim = clamp(dot(N, Lrim), 0.0, 1.0) * 0.45;
        vec3 H1 = normalize(Lkey + V);
        float specSharp = pow(max(0.0, dot(N, H1)), 58.0) * 1.15;
        float specSheen = pow(max(0.0, dot(N, H1)), 14.0) * 0.36;

        float hitAge = uTime - uHitTime;
        float ripple = 0.0;
        if (hitAge >= 0.0 && hitAge < 0.48) {
          float d = length(vLocalPos - uHitPos);
          float rWave = hitAge * 3.2;
          ripple = (1.0 - smoothstep(0.0, 0.16, abs(d - rWave))) * (1.0 - hitAge / 0.48);
        }

        float filigree = sigilVal * 0.72 + hexVal * 0.38 + smoothstep(0.48, 0.85, grain) * 0.28;
        float alpha = clamp(
          (uBaseAlpha * (0.72 + grain * 0.36) + fresnel * (uRimAlpha - uBaseAlpha * 0.5) * 0.84 + filigree * 0.45 + specSharp * 0.48 + ripple * 0.48 + burnEdge * 0.65 + uFlash * 0.18) * uOpacity,
          0.0, 0.96
        );
        if (alpha < 0.010) discard;

        float shadeBand = clamp(0.10 + diffKey * 0.42 + grain * 0.22 + caustic * 0.14 + filigree * 0.34 + backRim * 0.18, 0.04, 0.96);
        float localHdr = mix(0.76 + diffKey * 0.38, uHdr * 1.24, clamp(fresnel * 0.82 + filigree * 0.68 + specSheen + ripple + burnEdge + uFlash * 0.5, 0.0, 1.0));
        vec3 col = sampleRamp7(uRamp, shadeBand) * localHdr;
        col += sampleRamp7(uRamp, 0.85) * specSheen * 0.45;
        col = mix(col, uRamp[6] * (uHdr * 1.38), clamp(specSharp * 0.78 + burnEdge * 0.85 + ripple * 0.6 + uFlash * 0.35, 0.0, 1.0));
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

// ============================================================================
// 1B. High-Clarity 3A Triplanar Textured & Micro-Relief Sculpted Prop Material
// ============================================================================
export function makeSculptedTexturedPropMaterial({
  palette,
  materialKind = 'damascus_steel', // 'damascus_steel' | 'obsidian_magma' | 'imperial_jade_bronze' | 'glacier_sapphire'
  texScale = 1.85,
  bumpStrength = 2.8,
  opacity = 0.95,
  hdr = 1.45,
} = {}) {
  const lib = getTexLib();
  const ramp = rampToColorsLocal(palette, 7);
  const primaryTex = materialKind === 'obsidian_magma'
    ? lib.crackedMagma
    : materialKind === 'glacier_sapphire'
      ? lib.causticsWater
      : lib.metalDamascus;
  const detailTex = materialKind === 'imperial_jade_bronze'
    ? lib.sigilQimenComplex
    : materialKind === 'obsidian_magma'
      ? lib.metalDamascus
      : materialKind === 'glacier_sapphire'
        ? lib.slashFrost
        : lib.auraRunes;
  const modeId = materialKind === 'obsidian_magma'
    ? 1.0
    : materialKind === 'imperial_jade_bronze'
      ? 2.0
      : materialKind === 'glacier_sapphire'
        ? 3.0
        : 0.0;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: opacity >= 0.86,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uDissolve: { value: 0 },
      uFlash: { value: 0 },
      uTexScale: { value: texScale },
      uBump: { value: bumpStrength },
      uHdr: { value: hdr },
      uMode: { value: modeId },
      uPrimaryTex: { value: primaryTex },
      uDetailTex: { value: detailTex },
      uNoiseTex: { value: lib.erosionNoise },
      uRamp: { value: ramp },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vLocalNorm;
      varying vec3 vNormView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vLocalPos = position;
        vLocalNorm = normalize(normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vLocalNorm;
      varying vec3 vNormView;
      varying vec3 vViewDir;
      uniform float uTime, uOpacity, uDissolve, uFlash, uTexScale, uBump, uHdr, uMode;
      uniform sampler2D uPrimaryTex, uDetailTex, uNoiseTex;
      uniform vec3 uRamp[7];

      vec3 sampleRamp7(vec3 r[7], float t) {
        float x = clamp(t, 0.0, 1.0) * 6.0;
        int i = int(floor(x));
        float f = fract(x);
        if (i <= 0) return mix(r[0], r[1], f);
        if (i == 1) return mix(r[1], r[2], f);
        if (i == 2) return mix(r[2], r[3], f);
        if (i == 3) return mix(r[3], r[4], f);
        if (i == 4) return mix(r[4], r[5], f);
        if (i == 5) return mix(r[5], r[6], f);
        return r[6];
      }

      vec4 triSample(sampler2D tex, vec3 p, vec3 n, float sc) {
        vec3 w = pow(abs(n), vec3(4.0));
        w /= max(0.0001, w.x + w.y + w.z);
        return texture2D(tex, p.yz * sc) * w.x + texture2D(tex, p.xz * sc) * w.y + texture2D(tex, p.xy * sc) * w.z;
      }

      void main() {
        vec3 nObj = normalize(vLocalNorm);
        vec4 t0 = triSample(uPrimaryTex, vLocalPos, nObj, uTexScale);
        vec4 tx = triSample(uPrimaryTex, vLocalPos + vec3(0.010, 0.0, 0.0), nObj, uTexScale);
        vec4 ty = triSample(uPrimaryTex, vLocalPos + vec3(0.0, 0.010, 0.0), nObj, uTexScale);
        vec4 det = triSample(uDetailTex, vLocalPos + vec3(0.0, -uTime * 0.06, 0.0), nObj, uTexScale * 0.85);
        vec4 er = triSample(uNoiseTex, vLocalPos, nObj, 1.5);

        if (uDissolve > 0.005 && er.r < uDissolve) discard;

        float h0 = dot(t0.rgb, vec3(0.35, 0.45, 0.20));
        float hx = dot(tx.rgb, vec3(0.35, 0.45, 0.20)) - h0;
        float hy = dot(ty.rgb, vec3(0.35, 0.45, 0.20)) - h0;

        vec3 N = normalize(vNormView + vec3(-hx * uBump, -hy * uBump, 0.0));
        vec3 V = normalize(vViewDir);
        vec3 L1 = normalize(vec3(0.52, 0.78, 0.42));
        vec3 L2 = normalize(vec3(-0.68, 0.32, -0.58));

        float diff = clamp(dot(N, L1) * 0.55 + 0.45, 0.0, 1.0);
        float fill = clamp(dot(N, L2), 0.0, 1.0) * 0.38;
        float fres = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.1);
        float specRazor = pow(max(0.0, dot(N, normalize(L1 + V))), 68.0);
        float specBroad = pow(max(0.0, dot(N, normalize(L1 + V))), 16.0);

        vec3 baseCol;
        float outAlpha = uOpacity;
        if (uMode < 0.5) {
          vec3 steel = mix(vec3(0.11, 0.14, 0.20), sampleRamp7(uRamp, 0.48), 0.35) * (0.45 + diff * 1.05) * (0.55 + h0 * 0.85);
          float runeMask = smoothstep(0.46, 0.86, max(det.r, det.g));
          vec3 runeGlow = sampleRamp7(uRamp, 0.82) * uHdr * 1.45 * (0.78 + 0.22 * sin(uTime * 5.0 + vLocalPos.y * 6.0));
          baseCol = mix(steel, runeGlow, runeMask * 0.62) + sampleRamp7(uRamp, 0.90) * (specRazor * 1.45 + specBroad * 0.38 + fres * 0.55);
        } else if (uMode < 1.5) {
          float metalGrain = dot(det.rgb, vec3(0.333));
          vec3 basalt = vec3(0.07, 0.06, 0.09) * (0.5 + diff * 1.15) * (0.65 + metalGrain * 0.75);
          float magmaVein = smoothstep(0.36, 0.82, max(t0.r, t0.g));
          vec3 magmaCol = sampleRamp7(uRamp, clamp(0.45 + magmaVein * 0.52, 0.0, 0.99)) * uHdr * 1.75;
          baseCol = mix(basalt, magmaCol, magmaVein * 0.85) + sampleRamp7(uRamp, 0.75) * (fres * 0.65 + specRazor * 0.85);
        } else if (uMode < 2.5) {
          vec3 jade = mix(sampleRamp7(uRamp, 0.24), sampleRamp7(uRamp, 0.58), clamp(diff * 0.65 + h0 * 0.45, 0.0, 1.0)) * (0.72 + fill * 0.6);
          float engrave = smoothstep(0.42, 0.84, max(det.r, det.g));
          vec3 goldInlay = sampleRamp7(uRamp, 0.86) * uHdr * 1.38;
          baseCol = mix(jade, goldInlay, engrave * 0.75) + uRamp[6] * (specRazor * 1.25 + fres * 0.58);
        } else {
          float subsurf = clamp(t0.g * 0.65 + det.b * 0.48, 0.0, 1.0);
          baseCol = sampleRamp7(uRamp, clamp(0.18 + diff * 0.42 + subsurf * 0.36, 0.0, 0.92)) * (0.85 + fres * 0.75);
          baseCol += uRamp[6] * (specRazor * 1.65 + specBroad * 0.45 + fres * 0.65);
          outAlpha = clamp(uOpacity * (0.68 + fres * 0.30 + specRazor * 0.25), 0.0, 0.96);
        }

        baseCol = mix(baseCol, uRamp[6] * (uHdr * 1.5), clamp(uFlash, 0.0, 1.0));
        gl_FragColor = vec4(baseCol, outAlpha);
      }
    `,
  });
}

// ============================================================================
// 2. ShockSphere3D: Expanding / Imploding Niagara Fresnel Shock & Compression Sphere
// ============================================================================
// Hollow crystal-clear center + razor Fresnel shock rim + flowing rune latitude bands!
export class ShockSphere3D {
  constructor({
    x = 0, y = 1.0, z = 0, r0 = 0.18, r1 = 2.6, duration = 0.36,
    palette, hdr = 2.05, implode = false, useRunes = false, delay = 0,
  } = {}) {
    this.r0 = implode ? r1 : r0;
    this.r1 = implode ? r0 : r1;
    this.duration = duration;
    this.implode = implode;
    this.t = -delay;
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);

    const lib = getTexLib();
    const ramp = rampToColorsLocal(palette, 7);
    this.geo = new THREE.SphereGeometry(1, 36, 24);
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uHdr: { value: hdr },
        uUseRunes: { value: useRunes ? 1.0 : 0.0 },
        uNoiseTex: { value: lib.flowNoise },
        uAuraTex: { value: lib.auraRunes },
        uRamp: { value: ramp },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormView;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormView = normalize(normalMatrix * normal);
          vViewDir = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormView;
        varying vec3 vViewDir;
        uniform float uProgress, uTime, uHdr, uUseRunes;
        uniform sampler2D uNoiseTex, uAuraTex;
        uniform vec3 uRamp[7];

        vec3 sampleRamp7(vec3 r[7], float t) {
          float x = clamp(t, 0.0, 1.0) * 6.0;
          int i = int(floor(x));
          float f = fract(x);
          if (i <= 0) return mix(r[0], r[1], f);
          if (i == 1) return mix(r[1], r[2], f);
          if (i == 2) return mix(r[2], r[3], f);
          if (i == 3) return mix(r[3], r[4], f);
          if (i == 4) return mix(r[4], r[5], f);
          if (i == 5) return mix(r[5], r[6], f);
          return r[6];
        }

        void main() {
          float ndv = clamp(abs(dot(normalize(vNormView), normalize(vViewDir))), 0.0, 1.0);
          float rim = pow(1.0 - ndv, 2.75);
          vec4 nz = texture2D(uNoiseTex, vec2(vUv.x * 3.0 + uTime * 0.8, vUv.y * 2.5 - uTime * 1.4));
          float band = pow(max(0.0, sin(vUv.y * 18.8495 - uTime * 8.0)), 6.0) * 0.35 * uUseRunes;
          float runes = 0.0;
          if (uUseRunes > 0.5) {
            vec4 au = texture2D(uAuraTex, vec2(vUv.x * 2.0 + uTime * 0.4, clamp(abs(vUv.y - 0.5) * 2.0, 0.02, 0.98)));
            runes = au.r * au.a * 0.55;
          }
          float env = sin(clamp(uProgress, 0.0, 1.0) * 3.14159265);
          float erode = smoothstep(uProgress * 0.55, uProgress * 0.55 + 0.35, rim + nz.r * 0.45 + runes);
          float a = clamp((rim * 0.82 + band + runes) * erode * env * mix(0.52, 0.88, uUseRunes), 0.0, 1.0);
          if (a < 0.012) discard;
          float heat = clamp(0.32 + rim * 0.52 + nz.b * 0.22 + runes * 0.25, 0.0, 0.99);
          vec3 col = mix(mix(uRamp[3], uRamp[5], rim * 0.45), sampleRamp7(uRamp, heat), uUseRunes) * uHdr;
          gl_FragColor = vec4(col * a, a);
        }
      `,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    this.update(0);
  }

  update(dt) {
    this.t += dt;
    this.group.visible = this.t >= 0 && this.t < this.duration;
    if (!this.group.visible) return;
    const p = clamp(this.t / this.duration);
    const curve = this.implode ? p * p : 1 - Math.pow(1 - p, 3);
    const r = Math.max(0.02, lerp(this.r0, this.r1, curve));
    this.mesh.scale.setScalar(r);
    this.mesh.rotation.y += dt * 2.6;
    this.mat.uniforms.uProgress.value = p;
    this.mat.uniforms.uTime.value = this.t;
  }

  get done() { return this.t >= this.duration; }
  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ============================================================================
// 3. NiagaraMicroPool3D: Single-Draw-Call GPU Instanced Micro-Particle System
// ============================================================================
// Up to 4,096 velocity-stretched 3D octahedron/spindle micro-particles with:
// - Analytic 3D Curl-Noise turbulence (swirling fluid embers/snow/spores/arcane motes)
// - Explosive initial burst + high aerodynamic drag deceleration (Niagara drag curve)
// - Radial Suction / Vortex Implosion toward moving weapon/bow/staff tips (Charged Attacks!)
// - Floor ricochet bounce + asynchronous starlight twinkle + 7-step HDR cooling!
export class NiagaraMicroPool3D {
  constructor(rootGroup, maxParticles = 4096) {
    this.max = maxParticles;
    this.geo = new THREE.OctahedronGeometry(0.5, 0);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, maxParticles);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;

    // Ensure instanceColor buffer exists immediately
    const dummyColor = new THREE.Color(1, 1, 1);
    for (let i = 0; i < maxParticles; i++) {
      this.mesh.setColorAt(i, dummyColor);
    }
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    rootGroup.add(this.mesh);

    this.items = [];
    this.clock = 0;
    this._xAxis = new THREE.Vector3(1, 0, 0);
    this._dir = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._scl = new THREE.Vector3();
    this._mat4 = new THREE.Matrix4();
    this._col = new THREE.Color();
  }

  spawnBurst(R, {
    x = 0, y = 1.0, z = 0,
    count = 36,
    speed0 = 1.8, speed1 = 7.2,
    dirX = 0, dirY = 0.35, dirZ = 0,
    dirBias = 0.0,
    spreadRadius = 0.12,
    drag = 5.2,
    gravity = 4.5,
    curl = 3.2,
    curlFreq = 1.75,
    vortex = 0.0,
    vortexCenter = null,
    attractPos = null,    // THREE.Vector3 or () => THREE.Vector3 for Charged-Attack suction!
    attractStr = 0.0,
    size0 = 0.036,
    size1 = 0.012,
    stretch = 0.026,
    life0 = 0.22,
    life1 = 0.52,
    palette,
    hdr = 2.05,
    bounce = 0.42,
    twinkle = 0.35,
    delay = 0,
    temperature = 0,
    temperatureDecay = 2.0,
    buoyancy = 0,
    collisionSparkCount = 0,
    collisionFields = null,
    windFactor = 0,
  } = {}) {
    const ramp = rampToColorsLocal(palette, 7);
    const n = Math.min(count, this.max - this.items.length);
    for (let i = 0; i < n; i++) {
      // Uniform spherical direction + optional directional cone bias
      const u = R.range(-1, 1);
      const th = R.range(0, TAU);
      const sq = Math.sqrt(Math.max(0, 1 - u * u));
      let nx = sq * Math.cos(th);
      let ny = u;
      let nz = sq * Math.sin(th);
      if (dirBias > 0.001) {
        nx = lerp(nx, dirX, dirBias);
        ny = lerp(ny, dirY, dirBias);
        nz = lerp(nz, dirZ, dirBias);
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
      }
      const sp = R.range(speed0, speed1);
      const life = R.range(life0, life1);
      const rOff = spreadRadius > 0 ? Math.cbrt(R.next()) * spreadRadius : 0;

      this.items.push({
        x: x + nx * rOff,
        y: Math.max(0.03, y + ny * rOff),
        z: z + nz * rOff,
        vx: nx * sp,
        vy: ny * sp,
        vz: nz * sp,
        drag,
        gravity,
        curl,
        curlFreq,
        vortex,
        // Call sites pass [x, z]; also accept a full [x, y, z] vector.
        vortexX: Number.isFinite(vortexCenter?.[0]) ? vortexCenter[0] : x,
        vortexZ: Number.isFinite(vortexCenter?.[2]) ? vortexCenter[2]
          : Number.isFinite(vortexCenter?.[1]) ? vortexCenter[1] : z,
        attractPos,
        attractStr,
        size: R.range(size0 * 0.78, size0 * 1.24),
        sizeEndMul: size1 / Math.max(0.004, size0),
        stretch,
        life,
        max: life,
        ramp,
        hdr,
        bounce,
        twinkle,
        phase: R.range(0, TAU),
        delay: delay + (delay > 0 ? R.range(0, 0.03) : 0),
        temperature,
        temperatureDecay,
        buoyancy,
        collisionSparkCount,
        collisionFields,
        windFactor,
        collided: false,
      });
    }
  }

  step(dt, R = null, windX = 0, windZ = 0) {
    this.clock += dt;
    const collisionEvents = [];
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        // O(1) swap-pop removal!
        const last = this.items.pop();
        if (i < this.items.length) this.items[i] = last;
        continue;
      }

      // 1. Analytic 3D Curl-Noise Fluid Turbulence
      if (p.curl > 0.001) {
        const [cx, cy, cz] = sampleCurl3D(p.x, p.y, p.z, this.clock + p.phase * 0.2, p.curlFreq);
        p.vx += cx * p.curl * dt;
        p.vy += cy * p.curl * 0.85 * dt;
        p.vz += cz * p.curl * dt;
      }

      // 2. Cylindrical Vortex Tangential Orbit
      if (Math.abs(p.vortex) > 0.001) {
        const dx = p.x - p.vortexX;
        const dz = p.z - p.vortexZ;
        const d = Math.hypot(dx, dz) || 0.1;
        p.vx += (-dz / d) * p.vortex * dt;
        p.vz += (dx / d) * p.vortex * dt;
      }

      // 3. Radial Charge-Up Suction / Implosion toward dynamic weapon/bow/staff anchor!
      if (p.attractStr !== 0 && p.attractPos) {
        const tgt = typeof p.attractPos === 'function' ? p.attractPos() : p.attractPos;
        const tx = tgt.x - p.x, ty = tgt.y - p.y, tz = tgt.z - p.z;
        const dist = Math.hypot(tx, ty, tz) || 0.05;
        const f = p.attractStr / Math.max(0.18, dist * 0.65);
        p.vx += (tx / dist) * f * dt;
        p.vy += (ty / dist) * f * dt;
        p.vz += (tz / dist) * f * dt;
      }

      // 4. Gravity & High Aerodynamic Drag Braking
      p.vx += windX * p.windFactor * dt;
      p.vz += windZ * p.windFactor * dt;
      p.vy += (p.buoyancy * p.temperature - p.gravity) * dt;
      p.temperature *= Math.exp(-p.temperatureDecay * dt);
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.vz *= damp;

      const old = p.collisionFields ? { x: p.x, y: p.y, z: p.z } : null;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      if (old) collideSphereFields(p, old, p.collisionFields, p.bounce);

      // 5. Crisp Arena Floor Ricochet
      if (p.bounce > 0 && p.y <= 0.025 && p.vy < 0) {
        p.y = 0.025;
        if (!p.collided && p.collisionSparkCount > 0 && collisionEvents.length < 8) {
          collisionEvents.push({ x: p.x, z: p.z, palette: p.ramp, count: p.collisionSparkCount, hdr: p.hdr });
        }
        p.collided = true;
        p.vy = -p.vy * p.bounce;
        p.vx *= 0.74;
        p.vz *= 0.74;
      }
    }
    // Handle events after simulation so new particles are never stepped twice.
    if (R) for (const event of collisionEvents) {
      this.spawnBurst(R, {
        ...event, y: 0.04, spreadRadius: 0.025, dirX: 0, dirY: 1, dirZ: 0, dirBias: 0.72,
        speed0: 0.6, speed1: 2.2, gravity: 5.0, drag: 3.0, curl: 0.5,
        life0: 0.12, life1: 0.24, size0: 0.022, size1: 0.006,
        bounce: 0, twinkle: 0.15, collisionSparkCount: 0,
      });
    }
  }

  syncVisuals() {
    let visCount = 0;
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      if (p.delay > 0) continue;

      const k = clamp(p.life / p.max); // 1 = newborn white-hot -> 0 = dying ember
      const age = 1 - k;
      const sp = Math.hypot(p.vx, p.vy, p.vz) || 0.01;
      const curSize = p.size * lerp(1.0, p.sizeEndMul, age);
      const len = Math.max(curSize, curSize + sp * p.stretch);

      this._pos.set(p.x, p.y, p.z);
      this._dir.set(p.vx / sp, p.vy / sp, p.vz / sp);
      this._quat.setFromUnitVectors(this._xAxis, this._dir);
      this._scl.set(len, curSize, curSize);
      this._mat4.compose(this._pos, this._quat, this._scl);
      this.mesh.setMatrixAt(visCount, this._mat4);

      // Blackbody 7-step HDR cooling + starlight twinkle
      const heat = clamp((p.buoyancy > 0 ? p.temperature : Math.pow(k, 0.72)) * 0.96, 0.08, 0.99);
      const rIdx = Math.min(5, Math.floor(heat * 6));
      const rFrac = heat * 6 - rIdx;
      this._col.copy(p.ramp[rIdx]).lerp(p.ramp[rIdx + 1], rFrac);

      const tw = p.twinkle > 0 ? (1.0 - p.twinkle * 0.45 + p.twinkle * 0.65 * (0.5 + 0.5 * Math.sin(this.clock * 28.0 + p.phase))) : 1.0;
      const fade = Math.min(1.0, age * 14.0) * Math.pow(k, 0.68);
      this._col.multiplyScalar(p.hdr * tw * fade);
      this.mesh.setColorAt(visCount, this._col);
      visCount++;
    }
    this.mesh.count = visCount;
    if (visCount > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  get activeCount() {
    return this.items.length;
  }

  clear() {
    this.items.length = 0;
    this.mesh.count = 0;
  }
}
