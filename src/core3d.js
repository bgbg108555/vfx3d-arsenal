import * as THREE from 'three';
import {
  getTexLib, resolveSlashTex, resolveSigilTex, resolveFlipbookTex, resolveEnvGroundTex, FX_CONFIG,
} from './texgen3d.js';
import { makeTranslucentConstructMaterial, makeSculptedTexturedPropMaterial, ShockSphere3D, NiagaraMicroPool3D } from './niagara3d.js';
import { AirDistortionManager3D } from './air_distort3d.js';
import { TraumaCameraShake3D, computeSquashStretch3D } from './gamedev_algos3d.js';
import { GpuSparkPool3D } from './gpu_sparks3d.js';

export { makeTranslucentConstructMaterial, makeSculptedTexturedPropMaterial, ShockSphere3D, NiagaraMicroPool3D, FX_CONFIG };

// ---- Deterministic RNG & Math ----
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, t0, t1) => clamp((t - t0) / Math.max(1e-5, t1 - t0));
export const smooth = (e0, e1, x) => {
  const t = seg(x, e0, e1);
  return t * t * (3 - 2 * t);
};

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * clamp(t) - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t))),
  outBack: (t, s = 1.8) => {
    t = clamp(t);
    return t <= 0 ? 0 : t >= 1 ? 1 : 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  },
};

export class Rng {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
}

// ---- Multi-Hue Complementary Chromatic Temperature 7-Step HDR Palettes ----
// Every ramp shifts hue across shadow -> midtone -> highlight -> plasma core (NEVER flat monochrome!)
export const PAL3D = {
  warriorSilver: ['#0b132b', '#1b356b', '#2274d4', '#4ecbff', '#a8ebff', '#fff2cf', '#ffffff'],
  warriorGold:   ['#210610', '#690d1f', '#c72814', '#f76c11', '#ffc226', '#fff4a3', '#ffffff'],
  fireInferno:   ['#1a060d', '#5c0916', '#bf1911', '#f75c0e', '#ffb524', '#dffaff', '#ffffff'],
  rogueShadow:   ['#0d041f', '#2f0b54', '#6b189e', '#ab35f0', '#ff73d8', '#d6f5ff', '#ffffff'],
  rogueBlood:    ['#1c0412', '#520726', '#a80e2f', '#eb263a', '#ff7a4d', '#ffe3b8', '#ffffff'],
  mageArcane:    ['#0c082e', '#2c1578', '#1f6ee0', '#36dcff', '#9effe6', '#fff2c2', '#ffffff'],
  mageEmerald:   ['#071b24', '#0d4a4d', '#14946e', '#32e08c', '#b4ff6e', '#efffa8', '#ffffff'],
  mageViolet:    ['#14062b', '#3d0f75', '#7d1fc9', '#c247ff', '#ff8ce6', '#d6f7ff', '#ffffff'],
  mageFrost:     ['#071436', '#123c7d', '#1796b8', '#57e6ff', '#c9e2ff', '#fff6df', '#ffffff'],
  mageVolt:      ['#150838', '#41178f', '#2f64f5', '#52e3ff', '#dbff9c', '#f2fbff', '#ffffff'],
  holyGold:      ['#2b0e10', '#752e14', '#c97614', '#f7be28', '#ffeb8c', '#dff8ff', '#ffffff'],
  waterAqua:     ['#061630', '#0e3f73', '#1285b8', '#2be0d4', '#9effe8', '#fff5d6', '#ffffff'],
  windJade:      ['#081f24', '#0e5245', '#19a362', '#5ce67e', '#ccff82', '#f6ffd4', '#ffffff'],
  voidAbyss:     ['#06020f', '#2b0738', '#731082', '#ad32f2', '#ff78e2', '#c9f6ff', '#ffffff'],
  earthMagma:    ['#171110', '#3d2318', '#8f3612', '#e66a12', '#ffc22e', '#fff4b0', '#ffffff'],
  poison:        ['#1a0726', '#3d1147', '#1e8535', '#6ee326', '#ccff4d', '#f5ffc2', '#ffffff'],
};

export function rampToColors(hexList, n = 7) {
  const src = hexList.map((h) => new THREE.Color(h));
  if (src.length === n) return src;
  return Array.from({ length: n }, (_, i) => {
    const u = (i * (src.length - 1)) / Math.max(1, n - 1);
    const idx = Math.min(src.length - 2, Math.floor(u));
    return src[idx].clone().lerp(src[idx + 1], u - idx);
  });
}

let _sigilExtraFactory = null;
export function registerSigilExtraFactory(fn) {
  _sigilExtraFactory = fn;
}

export const GLSL_NOISE = `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = p * 2.07 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}
vec3 sampleRamp(vec3 r[7], float t) {
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
`;

// ============================================================================
// 1. Watertight Manifold 3D Crescent-Horn Slash (ZERO separated sheets/seams!)
// ============================================================================
// Builds a single closed 3D airfoil/teardrop cross-section swept dynamically
// between [uTail .. uHead] in the vertex shader, pinching cleanly to a 3D point
// at both the leading tip and trailing tail. Looks sculpted from EVERY angle!
export class SlashArc3D {
  constructor(opts) {
    this.o = {
      center: [0, 1.05, 0],
      radius: 2.4,
      width: 0.78,
      thickness: 0.24, // Real 3D closed cross-section thickness in meters
      a0: -Math.PI / 3,
      a1: Math.PI / 3,
      tiltX: 0,
      tiltZ: 0,
      sweep: 0.065,
      hold: 0.045,
      trail: 0.16,
      palette: PAL3D.warriorSilver,
      hdrBoost: 2.2,
      seed: 1,
      delay: 0,
      texStyle: 'auto',
      defaultTex: 'silk',
      texRepeat: 2.2,
      ...opts,
    };
    this.duration = this.o.sweep + this.o.hold + this.o.trail;
    this.t = -this.o.delay;
    this.group = new THREE.Group();
    this.group.position.set(...this.o.center);
    this.group.rotation.order = 'YXZ';
    this.group.rotation.x = this.o.tiltX;
    this.group.rotation.z = this.o.tiltZ;

    // Outer volumetric aura horn + inner dense blade core horn (both watertight closed 3D tubes!)
    this.outerHorn = this._buildClosedHornMesh(
      this.o.radius, this.o.width, this.o.thickness,
      this.o.a0, this.o.a1, this.o.hdrBoost * 0.85, this.o.seed, false
    );
    this.coreHorn = this._buildClosedHornMesh(
      this.o.radius - 0.02, this.o.width * 0.42, this.o.thickness * 0.46,
      this.o.a0, this.o.a1, this.o.hdrBoost * 1.15, this.o.seed + 7.3, true
    );
    this.group.add(this.outerHorn, this.coreHorn);
    this.update(0);
  }

  _buildClosedHornMesh(R, W, T, a0, a1, hdr, seed, isCore) {
    // Parametric grid: iu along arc (0..1 -> pinched to 0 at both ends!), iv around closed cross-section (0..1)
    const segU = 64, segV = 16;
    const dummyPos = new Float32Array((segU + 1) * (segV + 1) * 3);
    const paramsAttr = new Float32Array((segU + 1) * (segV + 1) * 2);
    const idx = [];

    for (let iu = 0; iu <= segU; iu++) {
      const p = iu / segU; // 0 = trailing tip, 1 = leading blade tip
      for (let iv = 0; iv <= segV; iv++) {
        const v = iv / segV; // 0..1 around closed airfoil cross-section
        const k = iu * (segV + 1) + iv;
        paramsAttr[k * 2] = p;
        paramsAttr[k * 2 + 1] = v;
      }
    }
    for (let iu = 0; iu < segU; iu++) {
      for (let iv = 0; iv < segV; iv++) {
        const a = iu * (segV + 1) + iv;
        const b = a + segV + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(dummyPos, 3));
    geo.setAttribute('aParam', new THREE.BufferAttribute(paramsAttr, 2));
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), R + W + 1.0);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uHead: { value: 0 },
        uTail: { value: 0 },
        uAge: { value: 0 },
        uA0: { value: a0 },
        uA1: { value: a1 },
        uR: { value: R },
        uW: { value: W },
        uT: { value: T },
        uHdr: { value: hdr },
        uSeed: { value: seed },
        uCore: { value: isCore ? 1.0 : 0.0 },
        uSlashTex: { value: resolveSlashTex(this.o.texStyle, this.o.defaultTex) },
        uNoiseTex: { value: getTexLib().flowNoise },
        uTexRepeat: { value: this.o.texRepeat },
        uRamp: { value: rampToColors(this.o.palette, 7) },
      },
      vertexShader: `
        attribute vec2 aParam;
        uniform float uHead, uTail, uAge, uA0, uA1, uR, uW, uT;
        varying float vP;
        varying float vQ;
        varying float vRim;
        varying vec3 vNormView;
        varying vec3 vViewDir;

        void main() {
          float p = aParam.x;          // 0 = tail point, 1 = head point
          float theta = aParam.y * 6.2831853; // closed loop around cross-section!

          // Dynamic arc angle along [uTail .. uHead]
          float arcFrac = mix(uTail, uHead, p);
          float ang = mix(uA0, uA1, arcFrac);

          // Crescent envelope: 0 at tail (p=0), fattest at p=0.68, sharp sleek point at head (p=1)!
          float env = pow(sin(p * 3.14159265), 0.58) * pow(p, 0.32) * (1.0 - uTail * 0.30);

          // Closed teardrop/katana cross-section:
          // q in [0..1]: 1 at outer razor edge (theta=0), 0 at inner trailing edge (theta=PI)
          float q = 0.5 + 0.5 * cos(theta);
          // Asymmetric airfoil thickness: fuller near outer 68% of blade, razor sharp at outer rim (q=1) and inner rim (q=0)
          float yProfile = sin(theta) * pow(q, 0.45) * 0.5;

          float curW = uW * env;
          float curT = uT * env;

          float r = uR - curW * (1.0 - q);
          float y = yProfile * curT;

          float sn = sin(ang), cs = cos(ang);
          vec3 pos = vec3(sn * r, y, cs * r);

          // Approximate 3D cross-section normal for volumetric shading!
          vec3 radialOut = vec3(sn, 0.0, cs);
          vec3 nLocal = normalize(radialOut * cos(theta) * 0.65 + vec3(0.0, sin(theta), 0.0));

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          vNormView = normalize(normalMatrix * nLocal);
          vViewDir = normalize(-mv.xyz);
          vP = p;
          vQ = q;
          vRim = abs(sin(theta));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vP;
        varying float vQ;
        varying float vRim;
        varying vec3 vNormView;
        varying vec3 vViewDir;
        uniform float uHead, uTail, uAge, uHdr, uSeed, uCore, uTexRepeat;
        uniform sampler2D uSlashTex, uNoiseTex;
        uniform vec3 uRamp[7];
        ${GLSL_NOISE}

        void main() {
          if (uHead - uTail <= 0.006) discard;

          // Niagara dual-panning flow distortion + AI seamless blade texture!
          vec4 nz = texture2D(uNoiseTex, vec2(vP * 2.4 - uAge * 2.8 + uSeed * 0.11, vQ * 1.6));
          vec2 slashUv = vec2(
            vP * uTexRepeat - uAge * 1.45 + uSeed * 0.13 + (nz.r - 0.5) * 0.08,
            clamp(vQ + (nz.g - 0.5) * 0.04 * (1.0 - vQ), 0.02, 0.985)
          );
          vec4 tx = texture2D(uSlashTex, slashUv);

          // A dense cutting edge, broken inner wake and finer flowing filaments
          // retain the supplied texture while separating the blade from its glow.
          vec4 fine = texture2D(uNoiseTex, vec2(vP * 6.8 + uAge * 2.1, vQ * 3.2 - uSeed * 0.07));
          float ndv = clamp(abs(dot(normalize(vNormView), normalize(vViewDir))), 0.0, 1.0);
          float filaments = smoothstep(0.47, 0.76, fine.r * 0.62 + tx.g * 0.38);
          float cuttingEdge = pow(vQ, 12.0) * smoothstep(0.08, 0.35, vP);
          float rawDensity = (0.30 + 0.68 * tx.r + 0.20 * filaments) * (0.46 + 0.68 * tx.a) * mix(0.52, 1.0, pow(ndv, 0.62));
          float erodeCut = mix(0.06, 0.48, smoothstep(0.55, 1.0, uAge)) + (1.0 - smoothstep(0.0, 0.32, vP)) * 0.36;
          float eroded = smoothstep(erodeCut, erodeCut + 0.26, rawDensity + nz.b * 0.18);

          float alpha = clamp((eroded + cuttingEdge * 0.16) * (uCore > 0.5 ? 0.88 : 0.70), 0.0, 1.0);
          if (alpha < 0.014) discard;

          float heat = clamp(pow(vQ, 1.55) * 0.48 + tx.g * 0.22 + filaments * 0.12 + vP * 0.14 - uAge * 0.16 + uCore * 0.20, 0.0, 0.98);
          vec3 col = sampleRamp(uRamp, heat) * mix(0.88, uHdr * 0.58, pow(vQ, 1.6));
          col += uRamp[5] * (uHdr * 0.18) * filaments * (1.0 - vQ);
          col = mix(col, uRamp[6] * (uHdr * 0.88), clamp(cuttingEdge * (0.60 + 0.25 * tx.b), 0.0, 0.82));
          gl_FragColor = vec4(col * alpha, alpha);
        }
      `,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    return m;
  }

  /** Exact current leading-edge angle in radians so character's sword can lock onto it! */
  currentHeadAngle() {
    const u = ease.outExpo(clamp(this.t / this.o.sweep));
    const a0 = this._effA0 ?? this.o.a0;
    const a1 = this._effA1 ?? this.o.a1;
    return lerp(a0, a1, u);
  }

  applyDynamicScale(sc, mapXZ) {
    const [mx, mz] = mapXZ(this.o.center[0], this.o.center[2]);
    this.group.position.set(mx, this.o.center[1], mz);
    let rMul = sc.aoe;
    let wMul = clamp(sc.aoe, 0.72, 1.55);
    let a0 = this.o.a0;
    let a1 = this.o.a1;
    if (sc.kind === 'sector') {
      rMul = sc.range;
      wMul = clamp(sc.range, 0.72, 1.55);
      const span = Math.abs(a1 - a0);
      if (span < Math.PI * 1.65) {
        a0 = clamp(a0 * sc.aoe, -Math.PI, Math.PI);
        a1 = clamp(a1 * sc.aoe, -Math.PI, Math.PI);
      }
    } else if (sc.kind === 'rect' || sc.kind === 'chain') {
      rMul = 0.5 * (sc.aoe + sc.range);
    }
    this._effA0 = a0;
    this._effA1 = a1;
    const newR = this.o.radius * rMul;
    const newW = this.o.width * wMul;
    this.outerHorn.material.uniforms.uR.value = newR;
    this.outerHorn.material.uniforms.uW.value = newW;
    this.outerHorn.material.uniforms.uA0.value = a0;
    this.outerHorn.material.uniforms.uA1.value = a1;
    this.coreHorn.material.uniforms.uR.value = Math.max(0.05, newR - 0.02);
    this.coreHorn.material.uniforms.uW.value = newW * 0.42;
    this.coreHorn.material.uniforms.uA0.value = a0;
    this.coreHorn.material.uniforms.uA1.value = a1;
  }

  update(dt) {
    this.t += dt;
    const apply = (mesh, timeOffset, lifeScale) => {
      const u = this.t - timeOffset;
      const L = this.duration * lifeScale;
      if (u <= 0 || u >= L) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      mesh.material.uniforms.uHead.value = ease.outExpo(clamp(u / this.o.sweep));
      mesh.material.uniforms.uTail.value = smooth(this.o.sweep + this.o.hold * lifeScale, L, u);
      mesh.material.uniforms.uAge.value = clamp(u / L);
    };
    apply(this.outerHorn, 0, 1.0);
    apply(this.coreHorn, 0, 0.94);
  }

  get active() { return this.t >= 0 && this.t < this.duration; }
  get done() { return this.t >= this.duration; }
  dispose() {
    for (const m of [this.outerHorn, this.coreHorn]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}

// ============================================================================
// 2. Closed Tubular 3D Energy Trail (Watertight 8-sided tapered 3D tube, ZERO flat strips!)
// ============================================================================
export class RibbonTrail3D {
  constructor({ maxPoints = 28, width = 0.16, palette = PAL3D.mageArcane, hdr = 2.0 } = {}) {
    this.maxPoints = maxPoints;
    this.radius = width * 0.62;
    this.pts = [];
    this.sides = 8;
    this.group = new THREE.Group();

    const rings = maxPoints;
    const vertsPerRing = this.sides + 1;
    const pos = new Float32Array(rings * vertsPerRing * 3);
    const uvs = new Float32Array(rings * vertsPerRing * 2);
    const idx = [];
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < vertsPerRing; j++) {
        const k = i * vertsPerRing + j;
        uvs[k * 2] = i / (rings - 1);
        uvs[k * 2 + 1] = j / this.sides;
        if (i < rings - 1 && j < this.sides) {
          const a = k, b = k + vertsPerRing;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geo.setIndex(idx);
    this.geo.setDrawRange(0, 0);

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uFade: { value: 1 },
        uTime: { value: 0 },
        uHdr: { value: hdr },
        uNoiseTex: { value: getTexLib().erosionNoise },
        uRamp: { value: rampToColors(palette, 7) },
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
        uniform float uFade, uTime, uHdr;
        uniform sampler2D uNoiseTex;
        uniform vec3 uRamp[7];
        ${GLSL_NOISE}
        void main() {
          float taper = 1.0 - vUv.x;
          vec2 flowUv = vec2(vUv.x * 3.5 + uTime * 1.8, vUv.y * 2.0);
          vec4 detail = texture2D(uNoiseTex, flowUv);
          float n = fbm(vec2(vUv.x * 9.0 + uTime * 10.0, vUv.y * 6.0));
          float strands = smoothstep(0.35, 0.75, detail.r * 0.65 + n * 0.35);
          float a = pow(taper, 1.2) * (0.42 + 0.38 * n + 0.20 * strands) * uFade * 0.78;
          if (a < 0.02) discard;
          float heat = clamp(taper * 0.66 + n * 0.15 + strands * 0.13, 0.0, 0.92);
          vec3 col = sampleRamp(uRamp, heat) * mix(0.95, uHdr * 0.72, taper);
          col += uRamp[5] * strands * taper * 0.10 * uHdr;
          gl_FragColor = vec4(col * a, a);
        }
      `,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.group.add(this.mesh);
    this.time = 0;
    this.fade = 1;
  }

  pushPoint(v3) {
    this.pts.unshift(v3.clone());
    if (this.pts.length > this.maxPoints) this.pts.pop();
    this._rebuild();
  }

  _rebuild() {
    if (this.pts.length < 2) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = this.fade > 0.01;
    const arr = this.geo.attributes.position.array;
    const uv = this.geo.attributes.uv.array;
    const vertsPerRing = this.sides + 1;
    const count = this.pts.length;
    this.geo.setDrawRange(0, (count - 1) * this.sides * 6);
    for (let i = 0; i < count; i++) {
      const p = this.pts[i];
      const prev = this.pts[Math.max(0, i - 1)];
      const next = this.pts[Math.min(i + 1, count - 1)];
      const dir = next.clone().sub(prev);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      dir.normalize();
      const upRef = Math.abs(dir.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const side = new THREE.Vector3().crossVectors(dir, upRef).normalize();
      const binorm = new THREE.Vector3().crossVectors(dir, side).normalize();

      const u = i / (count - 1);
      // Taper and texture over the actual trail, including its growing phase.
      const r = this.radius * Math.sin(Math.pow(1 - u, 0.75) * Math.PI * 0.92) * (1 - u * 0.85);
      for (let j = 0; j < vertsPerRing; j++) {
        const a = (j / this.sides) * TAU;
        const cs = Math.cos(a) * r, sn = Math.sin(a) * r;
        const off = (i * vertsPerRing + j) * 3;
        arr[off]     = p.x + side.x * cs + binorm.x * sn;
        arr[off + 1] = p.y + side.y * cs + binorm.y * sn;
        arr[off + 2] = p.z + side.z * cs + binorm.z * sn;
        uv[(i * vertsPerRing + j) * 2] = u;
      }
    }
    // Keep unused rings degenerate as well: the GLB baker snapshots the
    // geometry and may not preserve the live draw range.
    const tail = this.pts[count - 1];
    for (let i = count; i < this.maxPoints; i++) {
      for (let j = 0; j < vertsPerRing; j++) {
        const off = (i * vertsPerRing + j) * 3;
        arr[off] = tail.x; arr[off + 1] = tail.y; arr[off + 2] = tail.z;
        uv[(i * vertsPerRing + j) * 2] = 1;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
  }

  update(dt, fadeOutRate = 0) {
    this.time += dt;
    if (fadeOutRate > 0) this.fade = Math.max(0, this.fade - fadeOutRate * dt);
    this.mat.uniforms.uTime.value = this.time;
    this.mat.uniforms.uFade.value = this.fade;
    if (this.fade <= 0.01) this.mesh.visible = false;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ============================================================================
// 3. Sculpted 3D Volumetric Crown Shockwave (Closed 3D Crest + Rolling 3D Lip, ZERO flat floor rings!)
// ============================================================================
export class GroundWave3D {
  constructor({ x = 0, z = 0, y = 0.02, maxRadius = 2.0, thickness = 0.38, height = 0.68, duration = 0.28, palette = PAL3D.mageArcane, hdr = 1.85, seed = 3 } = {}) {
    this.maxRadius = maxRadius;
    this.duration = duration;
    this.height = height * clamp(maxRadius / 2.5, 0.65, 1.45);
    this.lipTube = clamp(thickness * 0.22, 0.05, 0.16);
    this.t = 0;
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);

    const ramp = rampToColors(palette, 7);
    const lib = getTexLib();
    const waveR = new Rng(seed * 31 + 7);
    const ph1 = waveR.range(0, TAU), ph2 = waveR.range(0, TAU), ph3 = waveR.range(0, TAU);
    const radialWarp = (a) => (
      0.88
      + 0.10 * Math.sin(a * 3.0 + ph1)
      + 0.07 * Math.cos(a * 5.0 - ph2)
      + 0.05 * Math.sin(a * 8.0 + ph3)
    );

    // Closed-loop 3D volumetric wave crest with organic asymmetric radial lobes (NEVER a rigid compass circle!)
    const segA = 72, segV = 12;
    const pos = [], uvs = [], idx = [];
    const wallFrac = clamp(thickness / Math.max(0.8, maxRadius) * 0.55, 0.08, 0.22);
    for (let iv = 0; iv <= segV; iv++) {
      const th = (iv / segV) * TAU;
      const hFrac = 0.5 - 0.5 * Math.cos(th);
      const side = Math.sin(th);
      const flare = 0.84 + 0.16 * Math.pow(hFrac, 0.72);
      const rBase = Math.min(1.0, flare + side * wallFrac * (1.0 - hFrac * 0.75) * 0.5);
      const yLocal = Math.pow(hFrac, 0.85);
      for (let ia = 0; ia <= segA; ia++) {
        const u = ia / segA;
        const a = u * TAU;
        const rLocal = rBase * radialWarp(a);
        const yMod = yLocal * (0.85 + 0.28 * Math.sin(a * 6.0 + ph2));
        pos.push(Math.cos(a) * rLocal, yMod, Math.sin(a) * rLocal);
        uvs.push(u, hFrac);
      }
    }
    for (let iv = 0; iv < segV; iv++) {
      for (let ia = 0; ia < segA; ia++) {
        const a = iv * (segA + 1) + ia, b = a + segA + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    this.crownGeo = new THREE.BufferGeometry();
    this.crownGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.crownGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    this.crownGeo.setIndex(idx);

    this.crownMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uProgress: { value: 0 },
        uHdr: { value: hdr },
        uSeed: { value: seed },
        uErodeTex: { value: lib.erosionNoise },
        uFlowTex: { value: lib.flowNoise },
        uRamp: { value: ramp },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uProgress, uHdr, uSeed;
        uniform sampler2D uErodeTex, uFlowTex;
        uniform vec3 uRamp[7];
        ${GLSL_NOISE}
        void main() {
          vec4 fl = texture2D(uFlowTex, vec2(vUv.x * 5.0 + uSeed * 0.13, vUv.y * 1.6 - uProgress * 2.4));
          vec4 er = texture2D(uErodeTex, vec2(vUv.x * 7.0 - uProgress * 0.8, vUv.y * 2.2 + fl.r * 0.25));
          float teeth = clamp(fbm(vec2(vUv.x * 22.0 + uSeed, vUv.y * 3.5 - uProgress * 6.0)) * 0.58 + er.r * 0.50 + er.b * 0.10, 0.0, 1.0);
          float maxH = 0.24 + 0.76 * pow(teeth, 0.85);
          if (vUv.y > maxH) discard;
          float hNorm = vUv.y / max(0.01, maxH);
          float body = pow(1.0 - hNorm, 1.35) * (0.68 + 0.55 * fl.g);
          float tipEdge = smoothstep(0.62, 0.98, hNorm) * (0.65 + er.g * 0.35);
          float fade = 1.0 - smoothstep(0.42, 1.0, uProgress);
          float a = clamp((body * 0.58 + tipEdge * 0.36) * fade, 0.0, 1.0);
          if (a < 0.018) discard;
          float heat = clamp((1.0 - hNorm) * 0.62 + tipEdge * 0.25 + er.g * 0.18 + (1.0 - uProgress) * 0.14, 0.0, 0.96);
          vec3 col = sampleRamp(uRamp, heat) * mix(0.92, uHdr * 0.68, 1.0 - hNorm);
          if (hNorm < 0.12 && uProgress < 0.45) col = mix(col, uRamp[5] * (uHdr * 0.78), 1.0 - hNorm / 0.12);
          gl_FragColor = vec4(col * a, a);
        }
      `,
    });
    this.crownMesh = new THREE.Mesh(this.crownGeo, this.crownMat);
    this.group.add(this.crownMesh);

    // Matching jagged warped 3D leading rim tube (deformed radially to match organic shockwave front!)
    this.lipGeo = new THREE.TorusGeometry(0.985, 0.012, 8, 72);
    this.lipGeo.rotateX(Math.PI / 2);
    const lp = this.lipGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const lx = lp.getX(i), lz = lp.getZ(i);
      const la = Math.atan2(lz, lx);
      const rw = radialWarp(la);
      lp.setX(i, lx * rw);
      lp.setZ(i, lz * rw);
    }
    this.lipGeo.computeVertexNormals();
    this.lipMat = new THREE.MeshBasicMaterial({
      color: ramp[5].clone().multiplyScalar(hdr * 0.68),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lipMesh = new THREE.Mesh(this.lipGeo, this.lipMat);
    this.group.add(this.lipMesh);
    this.update(0);
  }

  update(dt) {
    this.t += dt;
    const p = clamp(this.t / this.duration);
    const vis = this.t >= 0 && this.t < this.duration;
    this.group.visible = vis;
    if (!vis) return;

    const frontFrac = 1.0 - Math.pow(1.0 - clamp(p * 1.16, 0, 1), 3.0);
    const curR = Math.max(0.05, Math.min(this.maxRadius * 0.985, this.maxRadius * frontFrac));
    const curH = this.height * Math.pow(Math.sin(Math.pow(p, 0.48) * Math.PI), 0.72);

    this.crownMesh.scale.set(curR, Math.max(0.03, curH), curR);
    this.crownMat.uniforms.uProgress.value = p;

    const lipR = Math.max(0.04, Math.min(this.maxRadius * 0.98, curR));
    this.lipMesh.scale.set(lipR, 2.2 * (1.15 - 0.55 * p), lipR);
    this.lipMesh.position.y = 0.025;
    this.lipMat.opacity = Math.pow(1 - p, 1.4) * 0.52;
  }

  get done() { return this.t >= this.duration; }
  dispose() {
    this.crownGeo.dispose(); this.crownMat.dispose();
    this.lipGeo.dispose(); this.lipMat.dispose();
  }
}

// ============================================================================
// 3B. VortexFunnel3D: True 3D Textured Tornado / Whirlpool / Aura Column
// ============================================================================
export class VortexFunnel3D {
  constructor({
    x = 0, y = 0, z = 0, rBottom = 0.45, rTop = 1.45, height = 2.8,
    duration = 1.4, spinSpeed = 7.5, riseSpeed = 2.4, twist = 1.8, leanX = 0, leanZ = 0,
    palette = PAL3D.fireInferno, texStyle = 'auto', defaultTex = 'flame', hdr = 1.9,
  } = {}) {
    this.duration = duration;
    this.t = 0;
    this.leanX = leanX;
    this.leanZ = leanZ;
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);

    const lib = getTexLib();
    const ramp = rampToColors(palette, 7);
    const patternTex = resolveSlashTex(texStyle, defaultTex);

    const makeLayer = (rb, rt, h, spinMul, isCore) => {
      const geo = new THREE.CylinderGeometry(rt, rb, h, 40, 20, true);
      geo.translate(0, h * 0.5, 0);
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uLifeFrac: { value: 0 },
          uHeight: { value: h },
          uTwist: { value: twist * (isCore ? -1.2 : 1.0) },
          uSpin: { value: spinSpeed * spinMul },
          uRise: { value: riseSpeed * (isCore ? 1.3 : 1.0) },
          uHdr: { value: hdr * (isCore ? 1.15 : 0.85) },
          uCore: { value: isCore ? 1.0 : 0.0 },
          uNoiseTex: { value: lib.flowNoise },
          uPatTex: { value: patternTex },
          uRamp: { value: ramp },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormView;
          varying vec3 vViewDir;
          uniform float uTime, uHeight, uTwist;
          void main() {
            vUv = uv;
            float hFrac = clamp(position.y / max(0.01, uHeight), 0.0, 1.0);
            float ang = hFrac * uTwist - uTime * 2.2;
            float sway = sin(uTime * 5.0 + hFrac * 4.0) * 0.08 * hFrac;
            float cs = cos(ang), sn = sin(ang);
            vec3 p = vec3(position.x * cs - position.z * sn + sway, position.y, position.x * sn + position.z * cs);
            vec3 n = vec3(normal.x * cs - normal.z * sn, normal.y, normal.x * sn + normal.z * cs);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vNormView = normalize(normalMatrix * n);
            vViewDir = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          varying vec3 vNormView;
          varying vec3 vViewDir;
          uniform float uTime, uLifeFrac, uSpin, uRise, uHdr, uCore;
          uniform sampler2D uNoiseTex, uPatTex;
          uniform vec3 uRamp[7];
          ${GLSL_NOISE}
          void main() {
            vec2 uvFlow = vec2(vUv.x * 2.0 - uTime * uSpin * 0.14, vUv.y * 1.8 - uTime * uRise);
            vec4 nz = texture2D(uNoiseTex, uvFlow);
            vec4 fine = texture2D(uNoiseTex, uvFlow * 1.73 + vec2(0.37, -uTime * 0.22));
            vec4 pt = texture2D(uPatTex, vec2(vUv.x * 3.0 + nz.r * 0.25 - uTime * uSpin * 0.18, clamp(1.0 - abs(vUv.y - 0.5) * 1.8, 0.05, 0.95)));

            float vFade = smoothstep(0.0, 0.14, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
            float lifeEnv = smoothstep(0.0, 0.12, uLifeFrac) * (1.0 - smoothstep(0.74, 1.0, uLifeFrac));
            float ndv = clamp(abs(dot(normalize(vNormView), normalize(vViewDir))), 0.0, 1.0);
            float filaments = smoothstep(0.48, 0.82, fine.r * 0.55 + pt.g * 0.45);
            float bands = clamp(nz.r * 0.50 + nz.g * 0.30 + pt.r * 0.48 + filaments * 0.20 - 0.28, 0.0, 1.0);
            float a = bands * vFade * lifeEnv * mix(0.45, 1.0, pow(ndv, 0.5)) * (uCore > 0.5 ? 0.82 : 0.68);
            if (a < 0.015) discard;

            float heat = clamp(bands * 0.72 + (1.0 - vUv.y) * 0.24 + uCore * 0.22, 0.0, 0.96);
            vec3 col = sampleRamp(uRamp, heat) * uHdr;
            col += uRamp[5] * filaments * bands * uHdr * 0.10;
            gl_FragColor = vec4(col * a, a);
          }
        `,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      return { geo, mat, mesh };
    };

    this.outer = makeLayer(rBottom, rTop, height, 1.0, false);
    this.inner = makeLayer(rBottom * 0.55, rTop * 0.52, height * 0.94, 1.45, true);
    this.group.add(this.outer.mesh, this.inner.mesh);
    this.update(0);
  }

  update(dt) {
    this.t += dt;
    const p = clamp(this.t / this.duration);
    this.group.visible = this.t >= 0 && this.t < this.duration;
    if (!this.group.visible) return;
    const grow = ease.outExpo(clamp(p * 6.0));
    const xz = (0.55 + 0.45 * grow) * (this._aoeScaleMul || 1.0);
    this.group.scale.set(xz, grow, xz);
    this.group.rotation.set(this.leanZ, 0, -this.leanX);
    for (const L of [this.outer, this.inner]) {
      L.mat.uniforms.uTime.value = this.t;
      L.mat.uniforms.uLifeFrac.value = p;
    }
  }

  get done() { return this.t >= this.duration; }
  dispose() {
    this.outer.geo.dispose(); this.outer.mat.dispose();
    this.inner.geo.dispose(); this.inner.mat.dispose();
  }
}

// ============================================================================
// 3C. BeamCylinder3D: Multi-Layer UV-Scrolling 3D Energy Cannon / Sky Pillar
// ============================================================================
export class BeamCylinder3D {
  constructor({
    p0 = new THREE.Vector3(0, 1.2, 0.8),
    p1 = new THREE.Vector3(0, 1.2, 6.2),
    radius = 0.34, duration = 0.9, palette = PAL3D.mageArcane,
    texStyle = 'auto', defaultTex = 'volt', hdr = 2.0, muzzleRings = true,
  } = {}) {
    this.duration = duration;
    this.t = 0;
    this._p0 = p0.clone();
    this._p1 = p1.clone();
    this._lenScale = 1.0;
    this._radScale = 1.0;
    this.group = new THREE.Group();

    const dir = p1.clone().sub(p0);
    const len = Math.max(0.1, dir.length());
    this._origLen = len;
    this.group.position.copy(p0);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

    const lib = getTexLib();
    const ramp = rampToColors(palette, 7);
    const patTex = resolveSlashTex(texStyle, defaultTex);
    this.geos = [];
    this.mats = [];

    const makeShell = (r, isCore) => {
      const g = new THREE.CylinderGeometry(r, r * (isCore ? 0.92 : 1.08), len, 28, 12, true);
      g.translate(0, len * 0.5, 0);
      const m = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uLifeFrac: { value: 0 },
          uHdr: { value: hdr * (isCore ? 0.72 : 0.56) },
          uCore: { value: isCore ? 1.0 : 0.0 },
          uNoiseTex: { value: lib.flowNoise },
          uPatTex: { value: patTex },
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
          uniform float uTime, uLifeFrac, uHdr, uCore;
          uniform sampler2D uNoiseTex, uPatTex;
          uniform vec3 uRamp[7];
          ${GLSL_NOISE}
          void main() {
            float ndv = clamp(abs(dot(normalize(vNormView), normalize(vViewDir))), 0.0, 1.0);
            float radialSoft = pow(ndv, uCore > 0.5 ? 0.68 : 1.22);
            vec4 nz = texture2D(uNoiseTex, vec2(vUv.x * 2.0 + uTime * (uCore > 0.5 ? -2.2 : 1.8), vUv.y * 3.2 - uTime * 7.5));
            vec4 pt = texture2D(uPatTex, vec2(vUv.y * 4.0 - uTime * 8.5, clamp(nz.r, 0.05, 0.95)));
            vec4 fine = texture2D(uNoiseTex, vec2(vUv.x * 4.1 - uTime * 0.9, vUv.y * 7.3 - uTime * 4.5));
            float endSoft = smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
            float env = smoothstep(0.0, 0.08, uLifeFrac) * (1.0 - smoothstep(0.76, 1.0, uLifeFrac));
            float streak = smoothstep(0.50, 0.82, fine.r * 0.55 + pt.g * 0.45);
            float energy = uCore > 0.5 ? (0.72 + 0.20 * nz.b + 0.08 * streak) : clamp(nz.r * 0.55 + pt.r * 0.52 + streak * 0.22 - 0.18, 0.0, 1.0);
            float a = energy * radialSoft * endSoft * env * (uCore > 0.5 ? 0.86 : 0.68);
            if (a < 0.015) discard;
            float heat = uCore > 0.5
              ? clamp(0.66 + energy * 0.32, 0.0, 0.99)
              : clamp(0.24 + energy * 0.48, 0.0, 0.76);
            vec3 col = sampleRamp(uRamp, heat) * uHdr;
            col += uRamp[5] * streak * energy * uHdr * (uCore > 0.5 ? 0.08 : 0.16);
            gl_FragColor = vec4(col * a, a);
          }
        `,
      });
      this.geos.push(g); this.mats.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false;
      return { mesh, m };
    };

    this.core = makeShell(radius * 0.30, true);
    this.sheath = makeShell(radius, false);
    this.beamHolder = new THREE.Group();
    this.beamHolder.add(this.sheath.mesh, this.core.mesh);
    this.group.add(this.beamHolder);

    this.rings = [];
    if (muzzleRings) {
      for (const [idx, yPos] of [[0, 0.06], [1, len * 0.98]]) {
        const rg = new THREE.TorusGeometry(radius * (idx === 0 ? 1.45 : 1.75), radius * 0.09, 8, 32);
        rg.rotateX(Math.PI / 2);
        const rm = new THREE.MeshBasicMaterial({
          color: ramp[5].clone().multiplyScalar(hdr * 0.78),
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        this.geos.push(rg); this.mats.push(rm);
        const m = new THREE.Mesh(rg, rm);
        m.position.y = yPos;
        this.group.add(m);
        this.rings.push({ m, rm });
      }
    }
    this.update(0);
  }

  applyDynamicScale(sc, mapVec) {
    const np0 = mapVec(this._p0);
    const np1 = mapVec(this._p1);
    const dir = np1.clone().sub(np0);
    const newLen = Math.max(0.1, dir.length());
    this.group.position.copy(np0);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this._lenScale = newLen / this._origLen;
    this._radScale = sc.aoe;
    if (this.rings.length > 1) {
      this.rings[1].m.position.y = newLen * 0.98;
    }
  }

  update(dt) {
    this.t += dt;
    const p = clamp(this.t / this.duration);
    this.group.visible = this.t >= 0 && this.t < this.duration;
    if (!this.group.visible) return;
    const pinch = ease.outBack(clamp(p * 10), 1.6) * (1 - smooth(0.78, 1.0, p));
    const pulse = 1 + Math.sin(this.t * 42) * 0.08;
    const w = Math.max(0.01, pinch * pulse) * (this._radScale || 1.0);
    this.beamHolder.scale.set(w, this._lenScale || 1.0, w);
    this.core.m.uniforms.uTime.value = this.t;
    this.core.m.uniforms.uLifeFrac.value = p;
    this.sheath.m.uniforms.uTime.value = this.t;
    this.sheath.m.uniforms.uLifeFrac.value = p;
    this.rings.forEach((r, i) => {
      r.m.rotation.y += dt * (i === 0 ? 8 : -10);
      r.m.scale.setScalar(w);
      r.rm.opacity = pinch * 0.85;
    });
  }

  get done() { return this.t >= this.duration; }
  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
  }
}

// ============================================================================
// 3D. Sigil3D: Full-RGB Multi-Material Chiseled 960x960 AI Magic Circle + Tier Grading
// ============================================================================
export class Sigil3D {
  constructor({
    x = 0, y = 0.025, z = 0, radius = 2.0, duration = 1.4,
    style = 'arcane', palette = PAL3D.mageArcane, hdr = 1.85, wallHeight = 0.58,
    lockSimple = false,
  } = {}) {
    this.duration = duration;
    this.t = 0;
    this._aoeScaleMul = 1.0;
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);

    const tier = FX_CONFIG.tier;
    const lib = getTexLib();
    const ramp = rampToColors(palette, 7);
    const sigilTex = resolveSigilTex(style);
    const useAuthenticRgb = tier >= 3 && !FX_CONFIG.paletteOverrideActive;
    this.geos = [];
    this.mats = [];

    const makeHoloSigilMat = (hdrMul, pulseSpeed, isGroundDisc) => {
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
          uHdr: { value: hdr * hdrMul * (tier === 1 ? 0.62 : 1.0) },
          uPulseSpeed: { value: tier === 1 ? 0.0 : pulseSpeed },
          uTintMix: { value: useAuthenticRgb ? (isGroundDisc ? 0.16 : 0.36) : 0.88 },
          uNormalBlend: { value: normalBlend ? 1.0 : 0.0 },
          uSigilTex: { value: sigilTex },
          uNoiseTex: { value: lib.flowNoise },
          uRamp: { value: ramp },
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime, uReveal, uDissolve, uHdr, uPulseSpeed, uTintMix, uNormalBlend;
          uniform sampler2D uSigilTex, uNoiseTex;
          uniform vec3 uRamp[7];
          ${GLSL_NOISE}
          void main() {
            vec2 c = vUv - 0.5;
            float rad = length(c) * 2.0;
            if (rad > 1.0) discard;

            vec4 sg = texture2D(uSigilTex, vUv);
            vec4 nz = texture2D(uNoiseTex, vUv * 2.6 + vec2(uTime * 0.12, -uTime * 0.18));
            // Fine relief from the existing artwork keeps stone and metal
            // readable underneath the animated emissive runes.
            float heightX = dot(texture2D(uSigilTex, vUv + vec2(0.0015, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float heightY = dot(texture2D(uSigilTex, vUv + vec2(0.0, 0.0015)).rgb, vec3(0.299, 0.587, 0.114));

            float drawMask = 1.0 - smoothstep(max(0.0, uReveal - 0.12), uReveal + 0.08, rad - nz.r * 0.08);
            float dissVal = sg.a * 0.65 + nz.r * 0.45;
            if (uDissolve > 0.01 && dissVal < uDissolve) discard;

            float wave = uPulseSpeed == 0.0
              ? 0.92
              : (0.76 + 0.44 * pow(max(0.0, sin(rad * 15.0 - uTime * uPulseSpeed)), 3.0));
            float a = clamp(sg.a * drawMask * (0.82 + 0.28 * nz.b), 0.0, 0.98);
            if (a < 0.014) discard;

            float luma = dot(sg.rgb, vec3(0.299, 0.587, 0.114));
            float relief = clamp(1.0 + (luma - heightX) * 0.48 + (luma - heightY) * 0.36, 0.82, 1.18);
            float maxC = max(sg.r, max(sg.g, sg.b));
            float minC = min(sg.r, min(sg.g, sg.b));
            float sat = maxC - minC;

            // Preserve chiseled obsidian/brass/silver/bone/ruby RGB relief while making emissive runes bloom!
            float heat = clamp(0.18 + luma * 0.64 + sat * 0.22 + (wave - 0.76) * 0.28, 0.0, 0.99);
            vec3 rampCol = sampleRamp(uRamp, heat);
            float emissiveBoost = mix(1.05, uHdr * wave * 1.12, smoothstep(0.32, 0.86, maxC + sat * 0.35));
            vec3 authCol = sg.rgb * emissiveBoost * relief;
            vec3 col = mix(authCol, rampCol * uHdr * wave, uTintMix);
            if (luma > 0.78) {
              col = mix(col, uRamp[6] * (uHdr * 1.15), (luma - 0.78) * 1.8);
            }
            if (uNormalBlend > 0.5) {
              gl_FragColor = vec4(col, a);
            } else {
              gl_FragColor = vec4(col * a, a);
            }
          }
        `,
      });
    };

    const gMain = new THREE.PlaneGeometry(radius * 2, radius * 2);
    gMain.rotateX(-Math.PI / 2);
    const mMain = makeHoloSigilMat(0.95, 8.5, true);
    this.geos.push(gMain); this.mats.push(mMain);
    this.mainDisc = new THREE.Mesh(gMain, mMain);
    this.group.add(this.mainDisc);

    const gUpper = new THREE.PlaneGeometry(radius * 1.16, radius * 1.16);
    gUpper.rotateX(-Math.PI / 2);
    const mUpper = makeHoloSigilMat(0.64, -11.0, false);
    this.geos.push(gUpper); this.mats.push(mUpper);
    this.upperDisc = new THREE.Mesh(gUpper, mUpper);
    const isSimple1 = FX_CONFIG.sigilComplexity === 'simple1' && !lockSimple;
    this.upperDisc.position.y = 0.20;
    this.upperDisc.visible = tier >= 2 && !isSimple1;
    this.group.add(this.upperDisc);

    // Sleek razor 3D torus bevel around sigil perimeter
    const gRim = new THREE.TorusGeometry(radius * 0.93, 0.016, 8, 72);
    gRim.rotateX(Math.PI / 2);
    const mRim = new THREE.MeshBasicMaterial({
      color: ramp[4].clone().multiplyScalar(tier === 1 ? 0.95 : hdr * 0.72),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.geos.push(gRim); this.mats.push(mRim);
    this.rimMesh = new THREE.Mesh(gRim, mRim);
    this.rimMesh.position.y = 0.018;
    this.group.add(this.rimMesh);

    // Rising 3D cylindrical AI auraRunes curtain around sigil perimeter (Tier 2..4)
    const effWallH = tier === 1 ? 0.01 : wallHeight;
    const gWall = new THREE.CylinderGeometry(radius * 0.93, radius * 0.93, Math.max(0.02, effWallH), 56, 1, true);
    gWall.translate(0, Math.max(0.02, effWallH) * 0.5, 0);
    const mWall = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uAuraTex: { value: tier <= 2 ? lib.procSlash : lib.auraRunes },
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
          vec4 nz = texture2D(uNoiseTex, vec2(vUv.x * 4.0 - uTime * 0.25, vUv.y * 1.5 - uTime * 1.6));
          vec4 au = texture2D(uAuraTex, vec2(vUv.x * 3.0 + uTime * 0.16 + (nz.r - 0.5) * 0.04, clamp(vUv.y, 0.02, 0.98)));
          float vFade = 1.0 - smoothstep(0.15, 1.0, vUv.y);
          float a = au.a * (0.45 + 0.65 * au.r) * vFade * uOpacity * 0.54;
          if (a < 0.012) discard;
          float heat = clamp(0.24 + au.g * 0.52 + (1.0 - vUv.y) * 0.25, 0.0, 0.98);
          vec3 col = sampleRamp(uRamp, heat) * uHdr;
          gl_FragColor = vec4(col * a, a);
        }
      `,
    });
    this.geos.push(gWall); this.mats.push(mWall);
    this.wallMesh = new THREE.Mesh(gWall, mWall);
    this.wallMesh.visible = tier >= 2 && wallHeight > 0.05 && !isSimple1;
    this.wallMat = mWall;
    this.group.add(this.wallMesh);
    this.mMain = mMain; this.mUpper = mUpper; this.mRim = mRim;
    this.tier = tier;
    this._extraArray = null;
    if (!lockSimple && _sigilExtraFactory && FX_CONFIG.sigilComplexity !== 'auto' && FX_CONFIG.sigilComplexity !== 'simple1' && FX_CONFIG.sigilComplexity !== 'dual2') {
      this._extraArray = _sigilExtraFactory({ radius, duration, style, palette, hdr });
      if (this._extraArray?.group) this.group.add(this._extraArray.group);
    }
    this.update(0);
  }

  update(dt) {
    this.t += dt;
    const p = clamp(this.t / this.duration);
    this.group.visible = this.t >= 0 && this.t < this.duration;
    if (!this.group.visible) return;
    const pop = ease.outBack(clamp(p * 6.5), 1.35) * (this._aoeScaleMul || 1.0);
    const reveal = ease.outCubic(clamp(p * 5.2)) * 1.15;
    const dissolve = smooth(0.72, 1.0, p) * 1.08;
    const fade = 1 - smooth(0.72, 1.0, p);
    this.group.scale.set(pop, 1, pop);
    this.mainDisc.rotation.y += dt * (this.tier === 1 ? 0.35 : 0.72);
    this.upperDisc.rotation.y -= dt * 1.35;
    for (const m of [this.mMain, this.mUpper]) {
      m.uniforms.uTime.value = this.t;
      m.uniforms.uReveal.value = reveal;
      m.uniforms.uDissolve.value = dissolve;
    }
    this.mRim.opacity = fade * 0.72;
    this.wallMat.uniforms.uTime.value = this.t;
    this.wallMat.uniforms.uOpacity.value = fade;
    this._extraArray?.update?.(dt);
  }

  get done() { return this.t >= this.duration; }
  dispose() {
    this._extraArray?.dispose?.();
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
  }
}

// ============================================================================
// 3E. DomeShield3D: 3D Geodesic Hex Force-Field Sphere / Barrier with Impact Ripples
// ============================================================================
export class DomeShield3D {
  constructor({
    x = 0, y = 0.0, z = 0, radius = 1.45, duration = 2.0,
    palette = PAL3D.holyGold, hdr = 1.85, fullSphere = false,
  } = {}) {
    this.duration = duration;
    this.t = 0;
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);

    const lib = getTexLib();
    const ramp = rampToColors(palette, 7);
    this.geo = new THREE.SphereGeometry(radius, 40, 24, 0, TAU, 0, fullSphere ? Math.PI : Math.PI * 0.54);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uFade: { value: 1 },
        uHitTime: { value: -10 },
        uHitDir: { value: new THREE.Vector3(0, 0.5, 1).normalize() },
        uHexTex: { value: lib.hexShield },
        uNoiseTex: { value: lib.flowNoise },
        uHdr: { value: hdr },
        uRamp: { value: ramp },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vObjDir;
        varying vec3 vNormView;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vObjDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormView = normalize(normalMatrix * normal);
          vViewDir = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vObjDir;
        varying vec3 vNormView;
        varying vec3 vViewDir;
        uniform float uTime, uFade, uHitTime, uHdr;
        uniform vec3 uHitDir;
        uniform sampler2D uHexTex, uNoiseTex;
        uniform vec3 uRamp[7];
        ${GLSL_NOISE}
        void main() {
          vec4 hx = texture2D(uHexTex, vUv * vec2(7.0, 3.8));
          vec4 nz = texture2D(uNoiseTex, vUv * 3.0 + vec2(uTime * 0.15, -uTime * 0.25));
          float fresnel = pow(1.0 - clamp(abs(dot(normalize(vNormView), normalize(vViewDir))), 0.0, 1.0), 1.85);
          float scan = pow(max(0.0, sin(vObjDir.y * 10.0 - uTime * 5.0)), 6.0);

          // Live impact shock ring across the 3D sphere!
          float hitAge = uTime - uHitTime;
          float ripple = 0.0;
          if (hitAge >= 0.0 && hitAge < 0.45) {
            float angDist = acos(clamp(dot(normalize(vObjDir), uHitDir), -1.0, 1.0));
            float waveR = hitAge * 3.4;
            ripple = (1.0 - smoothstep(0.0, 0.22, abs(angDist - waveR))) * (1.0 - hitAge / 0.45);
          }

          float lattice = hx.r * (0.25 + 0.50 * fresnel + 0.48 * scan + ripple * 1.4);
          float innerVeil = (0.05 + 0.07 * nz.g) * (1.0 - fresnel);
          float a = clamp((innerVeil + fresnel * 0.46 + lattice * 0.55 + ripple * 0.65) * uFade, 0.0, 0.95);
          if (a < 0.015) discard;
          float heat = clamp(0.28 + fresnel * 0.42 + scan * 0.22 + ripple * 0.55 + nz.r * 0.12, 0.0, 0.98);
          vec3 col = sampleRamp(uRamp, heat) * uHdr;
          col += uRamp[5] * uHdr * (ripple * 0.22 + lattice * 0.08);
          gl_FragColor = vec4(col * a, a);
        }
      `,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.group.add(this.mesh);
    this.update(0);
  }

  triggerHit(dirVec) {
    this.mat.uniforms.uHitDir.value.copy(dirVec).normalize();
    this.mat.uniforms.uHitTime.value = this.t;
  }

  update(dt) {
    this.t += dt;
    const p = clamp(this.t / this.duration);
    this.group.visible = this.t >= 0 && this.t < this.duration;
    if (!this.group.visible) return;
    const pop = ease.outBack(clamp(p * 8.0), 1.5) * (this._aoeScaleMul || 1.0);
    const fade = 1 - smooth(0.78, 1.0, p);
    this.group.scale.setScalar(pop);
    this.mat.uniforms.uTime.value = this.t;
    this.mat.uniforms.uFade.value = fade;
  }

  get done() { return this.t >= this.duration; }
  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ============================================================================
// 3F. Watertight Procedural Craggy 3D Rock / Magma Meteor Geometry & Shader
// ============================================================================
export function makeCraggyRockGeo(radius = 0.5, detail = 2, jag = 0.30, seed = 17, squashY = 1.0) {
  const base = new THREE.IcosahedronGeometry(radius, detail);
  const geo = base.index ? base.toNonIndexed() : base;
  if (geo !== base) base.dispose();

  const pos = geo.attributes.position;
  const crevices = new Float32Array(pos.count);

  const hash3 = (x, y, z) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise3 = (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
    const n000 = hash3(ix, iy, iz),       n100 = hash3(ix + 1, iy, iz);
    const n010 = hash3(ix, iy + 1, iz),   n110 = hash3(ix + 1, iy + 1, iz);
    const n001 = hash3(ix, iy, iz + 1),   n101 = hash3(ix + 1, iy, iz + 1);
    const n011 = hash3(ix, iy + 1, iz + 1), n111 = hash3(ix + 1, iy + 1, iz + 1);
    const nx00 = lerp(n000, n100, ux), nx10 = lerp(n010, n110, ux);
    const nx01 = lerp(n001, n101, ux), nx11 = lerp(n011, n111, ux);
    const nxy0 = lerp(nx00, nx10, uy), nxy1 = lerp(nx01, nx11, uy);
    return lerp(nxy0, nxy1, uz);
  };

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    // Quantize unit direction slightly so shared corners match 100% deterministically (watertight!)
    const dx = Math.round((vx / len) * 4096) / 4096;
    const dy = Math.round((vy / len) * 4096) / 4096;
    const dz = Math.round((vz / len) * 4096) / 4096;

    const n1 = noise3(dx * 2.4 + 5, dy * 2.4 + 5, dz * 2.4 + 5);
    const n2 = noise3(dx * 5.2 + 11, dy * 5.2 + 11, dz * 5.2 + 11);
    const ridge = 1.0 - Math.abs(n2 * 2.0 - 1.0); // sharp fracture ridges & fissures!
    const disp = 1.0 + (n1 - 0.48) * jag * 1.65 - (1.0 - ridge) * jag * 0.55;
    const rOut = radius * disp;

    pos.setXYZ(i, dx * rOut, dy * rOut * squashY, dz * rOut);
    // Deep valleys / cracks have lower disp -> bright glowing magma veins!
    crevices[i] = clamp((1.04 - disp) / Math.max(0.08, jag * 0.95), 0, 1);
  }
  geo.setAttribute('aCrevice', new THREE.BufferAttribute(crevices, 1));
  geo.computeVertexNormals();
  return geo;
}

export function makeMagmaRockMaterial({
  palette = PAL3D.fireInferno, rockColor = '#251b18', veinStrength = 1.85, opacity = 1.0,
} = {}) {
  const ramp = rampToColors(palette, 7);
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uRockCol: { value: new THREE.Color(rockColor) },
      uVeinStr: { value: veinStrength },
      uOpacity: { value: opacity },
      uAge: { value: 0 },
      uRamp: { value: ramp },
    },
    vertexShader: `
      attribute float aCrevice;
      varying float vCrevice;
      varying vec3 vNormView;
      varying vec3 vViewDir;
      varying vec3 vLocal;
      void main() {
        vCrevice = aCrevice;
        vLocal = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vCrevice;
      varying vec3 vNormView;
      varying vec3 vViewDir;
      varying vec3 vLocal;
      uniform vec3 uRockCol;
      uniform float uVeinStr, uOpacity, uAge;
      uniform vec3 uRamp[7];
      ${GLSL_NOISE}
      void main() {
        vec3 N = normalize(vNormView);
        vec3 V = normalize(vViewDir);
        float key = clamp(dot(N, normalize(vec3(-0.45, 0.78, 0.42))) * 0.5 + 0.5, 0.0, 1.0);
        float rim = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.2);
        float fineCrack = pow(clamp(1.0 - abs(fbm(vLocal.xy * 6.5 + vLocal.z * 4.0) - 0.48) * 5.0, 0.0, 1.0), 2.0);
        float magmaMask = clamp(pow(vCrevice, 1.35) * 0.95 + fineCrack * 0.55, 0.0, 1.0) * (1.0 - uAge * 0.55);

        vec3 stone = uRockCol * (0.45 + key * 0.95) + uRamp[2] * rim * 0.45 * uVeinStr;
        vec3 veinCol = sampleRamp(uRamp, clamp(0.32 + magmaMask * 0.66, 0.0, 0.98)) * uVeinStr;
        vec3 outCol = mix(stone, veinCol, clamp(magmaMask * 1.15, 0.0, 1.0));
        gl_FragColor = vec4(outCol, uOpacity);
      }
    `,
  });
}

// ============================================================================
// 4. Sim3D: Unified 3D Volumetric Simulation (Textured Meshes + 3D Flipbook Volumes!)
// ============================================================================
export class Sim3D {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.R = new Rng(seed);
    this.root = new THREE.Group();
    scene.add(this.root);

    this.sparks = [];
    this.puffs = [];
    this.shards = [];
    this.fireRocks = [];
    this.rockDebris = [];
    this.crystals = [];
    this.bolts = [];
    this.flipbooks = [];
    this.lights = [];
    this.custom = [];
    this.statusMarks = [];
    this._scaleCtx = null;
    this._currentMove = null;
    this._currentHitbox = null;
    this._chargeVariantHook = null;
    this._simTime = 0;
    this._clipMaxDuration = 0;
    this.softDepth = null;

    this._sparkGeo = new THREE.OctahedronGeometry(0.5, 0);
    this._puffGeo = new THREE.IcosahedronGeometry(0.5, 3);
    this._shardGeo = new THREE.DodecahedronGeometry(0.75, 0);
    this._craggyGeos = [
      makeCraggyRockGeo(0.56, 1, 0.28, 17, 0.88),
      makeCraggyRockGeo(0.56, 1, 0.34, 53, 1.08),
      makeCraggyRockGeo(0.56, 2, 0.26, 97, 0.94),
    ];
    this._crystalPrismGeo = this._makeHexCrystalGeo();
    this._spikeBarGeo = new THREE.OctahedronGeometry(0.5, 0);
    this._flipbookVolumeGeo = this._makeFlipbookVolumeGeo();
    this.niagara = new NiagaraMicroPool3D(this.root, 4096);
    this.gpuSparks = new GpuSparkPool3D(this.root, 1024);
    this.airDistort = new AirDistortionManager3D();
    this.traumaShake = new TraumaCameraShake3D(seed);
  }

  addTrauma(amount = 0.35) {
    this.traumaShake.add(amount);
  }

  setSoftDepthResources(texture, viewport, near, far) {
    this.softDepth = { texture, viewport, near, far, enabled: false };
  }

  setSoftDepthEnabled(enabled) {
    if (!this.softDepth) return;
    this.softDepth.enabled = !!enabled;
    for (const flipbook of this.flipbooks) {
      flipbook.mat.uniforms.uSoftDepth.value = enabled ? 1 : 0;
    }
  }

  /** Dynamic AoE & Cast Range context for presets without manual scaling (ZERO root.scale distortion!) */
  setDynamicScaleContext(mv, clipMaxDuration = 0) {
    this.root.scale.set(1, 1, 1);
    this.root.position.set(0, 0, 0);
    this._scaleCtx = null;
    this._currentMove = mv || null;
    this._currentHitbox = mv?.hitbox || null;
    this._clipMaxDuration = clipMaxDuration > 0 ? clipMaxDuration : (mv?.duration ?? 0);
    if (!mv || mv.handlesDynamicScale) return;
    const aoe = FX_CONFIG.aoeScale;
    const range = getEffectiveRangeScale(mv, FX_CONFIG.rangeScale);
    if (Math.abs(aoe - 1) < 1e-4 && Math.abs(range - 1) < 1e-4) return;
    if (!mv.hitbox) return;
    this._scaleCtx = {
      hb: mv.hitbox,
      kind: mv.hitbox.kind || 'circle',
      aoe,
      range,
    };
  }

  getAoeScale() {
    return this._scaleCtx ? this._scaleCtx.aoe : 1.0;
  }

  mapSkillXZ(x, z, mapped = false) {
    if (mapped || !this._scaleCtx) return [x, z];
    return mapHitboxPointXZ(this._scaleCtx.hb, x, z, this._scaleCtx.aoe, this._scaleCtx.range);
  }

  mapSkillVec3(v) {
    if (!v) return new THREE.Vector3();
    if (v._isWorldScaled || !this._scaleCtx) {
      const out = v.clone();
      if (v._isWorldScaled) out._isWorldScaled = true;
      return out;
    }
    const [mx, mz] = this.mapSkillXZ(v.x, v.z, false);
    const out = new THREE.Vector3(mx, v.y, mz);
    out._isWorldScaled = true;
    return out;
  }

  _mapXZ(x, z, mapped = false) {
    return this.mapSkillXZ(x, z, mapped);
  }

  /** Screen-Space Refractive Air Distortion (shockwave rings, rising heat-haze, implosion lenses) */
  spawnAirDistortion(opts = {}) {
    const [mx, mz] = this.mapSkillXZ(opts.x ?? 0, opts.z ?? 0, Boolean(opts._mapped));
    const aoeMul = opts._mapped ? 1.0 : this.getAoeScale();
    if ((opts.kind ?? 'shock') === 'shock') {
      this.traumaShake.add(clamp((opts.strength ?? 0.6) * 0.42, 0.14, 0.52));
    }
    this.airDistort.spawn({
      ...opts,
      x: mx,
      z: mz,
      r0: (opts.r0 ?? 0.25) * aoeMul,
      r1: (opts.r1 ?? 2.4) * aoeMul,
    });
  }

  /** Dark Charcoal / Soot Volumetric Smoke (NormalBlending contrast layer to eliminate single-color blobs!) */
  spawnDarkSmoke({
    x = 0, y = 0.85, z = 0, vx = 0, vy = 0.85, vz = 0,
    life = 0.58, size0 = 0.85, size1 = 2.05, emberHex = '#ff6e24', opacity = 0.56, delay = 0, _mapped = false,
  } = {}) {
    if (FX_CONFIG.tier <= 2 || life <= 0.08) return;
    const smokePal = ['#07060a', '#121017', '#1f1a22', '#33262b', '#59362c', emberHex, '#ffd6a1'];
    this.spawnFlipbook({
      atlas: 'fbSmoke',
      x, y, z, vx, vy, vz, _mapped,
      life, size0, size1,
      palette: smokePal,
      hdr: 0.92,
      opacity: FX_CONFIG.tier >= 4 ? opacity : opacity * 0.65,
      additive: false,
      emitMicro: false,
      delay,
      drag: 1.8,
      rotSpeed: 0.55,
    });
  }

  /**
   * Environmental Physics: Erupting Solid Lit 3D Rock / Basalt / Ice Chunks!
   * Bounces 2-3 times on y=0 with dust & sparks, settles briefly as rubble, and sinks cleanly before clip end.
   */
  spawnRockDebris({
    x = 0, y = 0.14, z = 0,
    count = 8, radius = 0.35,
    speed0 = 2.2, speed1 = 5.6,
    up0 = 3.6, up1 = 7.0,
    size0 = 0.12, size1 = 0.25,
    life = 1.05, bounce = 0.46,
    style = 'basalt', // 'basalt' | 'slate' | 'ice'
    palette = PAL3D.earthMagma,
    delay = 0,
    _mapped = false,
  } = {}) {
    if (FX_CONFIG.tier <= 1 || life <= 0.12) return;
    const [cx, cz] = this.mapSkillXZ(x, z, _mapped);
    const tierMul = FX_CONFIG.tier === 2 ? 0.35 : FX_CONFIG.tier === 3 ? 0.65 : 1.0;
    const aoeMul = _mapped ? 1.0 : Math.pow(this.getAoeScale(), 0.5);
    const n = Math.max(1, Math.round(count * tierMul * aoeMul));

    const stoneCol = style === 'ice'
      ? '#4a82ad'
      : style === 'slate'
        ? '#394359'
        : '#261f22';
    const veinStr = style === 'ice' ? 1.35 : style === 'slate' ? 0.55 : 1.75;
    const effPal = style === 'ice' ? PAL3D.mageFrost : palette;

    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.R.range(-0.32, 0.32);
      const rOff = this.R.range(0.05, radius);
      const sp = this.R.range(speed0, speed1);
      const sz = this.R.range(size0, size1);
      const geo = this._craggyGeos[this.R.int(0, this._craggyGeos.length - 1)];
      const mat = makeMagmaRockMaterial({
        palette: effPal,
        rockColor: stoneCol,
        veinStrength: veinStr,
        opacity: 1.0,
      });
      mat.depthWrite = true;

      const mesh = new THREE.Mesh(geo, mat);
      const bsx = sz * this.R.range(0.85, 1.35);
      const bsy = sz * this.R.range(0.62, 1.08);
      const bsz = sz * this.R.range(0.82, 1.28);
      mesh.scale.set(bsx, bsy, bsz);
      const px = cx + Math.cos(a) * rOff;
      const pz = cz + Math.sin(a) * rOff;
      mesh.position.set(px, y, pz);
      mesh.rotation.set(this.R.range(0, TAU), this.R.range(0, TAU), this.R.range(0, TAU));
      mesh.visible = delay <= 0;
      this.root.add(mesh);

      const itemLife = life * this.R.range(0.84, 1.0);
      this.rockDebris.push({
        mesh, mat,
        x: px, y, z: pz,
        vx: Math.cos(a) * sp,
        vy: this.R.range(up0, up1),
        vz: Math.sin(a) * sp,
        rx: this.R.range(-12, 12),
        ry: this.R.range(-12, 12),
        rz: this.R.range(-12, 12),
        size: sz,
        bsx, bsy, bsz,
        squashTimer: 0,
        life: itemLife,
        max: itemLife,
        bounce,
        bounces: 0,
        style,
        sparkHex: effPal[4] || '#ffaa33',
        delay,
        rest: false,
      });
    }
    this.traumaShake.add(clamp(n * 0.018, 0.12, 0.38));
  }

  /**
   * Persistent Environmental Ground Zone — Multi-Texture Procedural Shader Splicing!
   * NEVER stamps a rigid circular image: composites 4 textures via stochastic interior patch splicing,
   * 2-pass Voronoi polygonal rock-slab fissures, dendritic crack claws, and amoeboid multi-pools!
   */
  spawnGroundZone({
    x = 0, z = 0,
    radius = 2.0,
    duration = 1.65,
    kind = 'burning', // 'burning' | 'frost' | 'crater' | 'poison' | 'lightning' | 'holy' | 'void' | 'sand'
    palette = PAL3D.fireInferno,
    emitFlames = true,
    eruptRocks = false,
    stretchX = null,
    stretchZ = null,
    yaw = null,
    _mapped = false,
  } = {}) {
    if (duration <= 0.14) return;
    let effDuration = duration * (FX_CONFIG.groundLingerScale ?? 1.65);
    if (this._clipMaxDuration > 0) {
      const maxRem = this._clipMaxDuration - this._simTime - 0.04;
      if (maxRem > 0.16) effDuration = Math.min(effDuration, maxRem);
      else effDuration = Math.min(duration, Math.max(0.14, maxRem));
    }
    const [cx, cz] = this.mapSkillXZ(x, z, _mapped);
    const effR = radius * (_mapped ? 1.0 : this.getAoeScale());
    const tier = FX_CONFIG.tier;
    const lib = getTexLib();
    const texPrimary = resolveEnvGroundTex(kind);
    const texSecondary = (kind === 'burning' || kind === 'crater' || kind === 'lightning')
      ? lib.crackedMagma
      : (kind === 'frost' || kind === 'poison' || kind === 'holy')
        ? lib.causticsWater
        : lib.chargeVortex;
    const ramp = rampToColors(palette, 7);

    // Seeded anisotropy & rotation so NO two ground scars are ever circular or aligned!
    const zSeed = this.R.range(1.5, 96.5);
    const sx = stretchX ?? this.R.range(0.84, 1.20);
    const sz = stretchZ ?? this.R.range(0.84, 1.20);
    const rotYaw = yaw ?? this.R.range(0, TAU);
    const shapeMode = (kind === 'burning' || kind === 'crater' || kind === 'lightning')
      ? 0.0
      : (kind === 'frost' || kind === 'holy')
        ? 1.0
        : 2.0;

    // Larger quad footprint so jagged dendritic fracture claws & satellite puddles extend organically without clipping!
    const geo = new THREE.PlaneGeometry(effR * 2.38 * sx, effR * 2.38 * sz);
    geo.rotateX(-Math.PI / 2);
    const isBurning = (kind === 'burning' || kind === 'lightning' || kind === 'holy') ? 1.0 : 0.0;
    const isFrost = (kind === 'frost' || kind === 'poison' || kind === 'void') ? 1.0 : 0.0;

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
      blending: tier <= 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uAge: { value: 0 },
        uSeed: { value: zSeed },
        uShapeMode: { value: shapeMode },
        uTex: { value: texPrimary },
        uDetailTex: { value: texSecondary },
        uErodeTex: { value: lib.erosionNoise },
        uNoiseTex: { value: lib.flowNoise },
        uIsBurning: { value: isBurning },
        uIsFrost: { value: isFrost },
        uTier: { value: tier },
        uRamp: { value: ramp },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime, uAge, uSeed, uShapeMode, uIsBurning, uIsFrost, uTier;
        uniform sampler2D uTex, uDetailTex, uErodeTex, uNoiseTex;
        uniform vec3 uRamp[7];
        ${GLSL_NOISE}

        vec2 hash22(vec2 p) {
          return vec2(hash21(p), hash21(p + vec2(37.2, 91.7)));
        }

        vec2 rot2(vec2 v, float a) {
          float cs = cos(a), sn = sin(a);
          return vec2(v.x * cs - v.y * sn, v.x * sn + v.y * cs);
        }

        // Stochastic Multi-Patch Interior Splicing: samples ONLY interior [0.22..0.78] across 3 rotated/warped grids
        // so the baked circular border of uTex is NEVER visible and patterns interlock organically!
        vec4 sampleSplicedPrimary(vec2 p, float seed) {
          vec4 acc = vec4(0.0);
          float wSum = 0.0001;
          for (int k = 0; k < 3; k++) {
            float fk = float(k);
            vec2 q = rot2(p, fk * 1.13 + seed * 0.37) * (2.05 + fk * 0.58) + vec2(fk * 7.3, seed * 0.91);
            vec2 cell = floor(q);
            vec2 fr = fract(q);
            vec2 h = hash22(cell + seed + fk * 19.0);
            vec2 uvPatch = vec2(0.5) + (h - 0.5) * 0.18 + rot2(fr - 0.5, h.x * 6.2831853) * 0.36;
            vec4 s = texture2D(uTex, clamp(uvPatch, 0.21, 0.79));
            float tent = sin(fr.x * 3.14159265) * sin(fr.y * 3.14159265);
            float lum = max(s.r, max(s.g, s.b));
            float w = pow(max(0.04, tent), 0.75) * (0.35 + lum * 0.95);
            acc += s * w;
            wSum += w;
          }
          return acc / wSum;
        }

        // Exact 2-Pass Voronoi Polygonal Tectonic Rock-Slab Field (x = seam distance, yz = slab ID hash)
        vec3 voronoiSlab(vec2 x, float seed) {
          vec2 n = floor(x);
          vec2 f = fract(x);
          vec2 mg = vec2(0.0), mr = vec2(0.0);
          float md = 8.0;
          vec2 bestH = vec2(0.5);
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 o = hash22(n + g + seed);
              vec2 r = g + (0.15 + 0.70 * o) - f;
              float d = dot(r, r);
              if (d < md) {
                md = d;
                mr = r;
                mg = g;
                bestH = o;
              }
            }
          }
          md = 8.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 o = hash22(n + g + seed);
              vec2 r = g + (0.15 + 0.70 * o) - f;
              if (dot(mr - r, mr - r) > 0.0001) {
                md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
              }
            }
          }
          return vec3(md, bestH.x, bestH.y);
        }

        void main() {
          // Local domain [-1.19 .. +1.19]
          vec2 p = (vUv - 0.5) * 2.38;
          vec4 flow = texture2D(uNoiseTex, vUv * 2.4 + vec2(uSeed * 0.11, uTime * 0.08));
          vec4 erode = texture2D(uErodeTex, vUv * 2.9 + (flow.rg - 0.5) * 0.25);

          // Domain-warped organic coordinates (eliminates geometric symmetry!)
          vec2 pw = p + (flow.rg - 0.5) * 0.28 + vec2(fbm(p * 2.1 + uSeed) - 0.5, fbm(p * 2.1 + uSeed + 11.4) - 0.5) * 0.34;
          float rWarp = length(pw);
          float ang = atan(pw.y, pw.x);

          // 1) Non-circular organic silhouette synthesis per terrain archetype!
          float mask = 0.0;
          float tendrilVein = 0.0;
          if (uShapeMode < 0.5) {
            // Tectonic Star-Fissure & Scorch Scar: asymmetric lobes + 5..9 sharp jagged outward crack claws + debris islands!
            float lobe = 0.58 + 0.16 * sin(ang * 3.0 + uSeed) + 0.13 * cos(ang * 5.0 - uSeed * 1.7 + flow.r * 2.4);
            float claw1 = pow(clamp(0.5 + 0.5 * cos(ang * 6.0 + fbm(p * 3.4 + uSeed) * 4.2 + uSeed), 0.0, 1.0), 4.5);
            float claw2 = pow(clamp(0.5 + 0.5 * sin(ang * 9.0 - fbm(p * 4.2 - uSeed) * 4.6), 0.0, 1.0), 6.5);
            float maxReach = lobe + claw1 * 0.44 + claw2 * 0.34 + (erode.r - 0.5) * 0.20;
            float coreBody = 1.0 - smoothstep(maxReach - 0.22, maxReach + 0.04, rWarp);
            float satIsland = smoothstep(0.73, 0.84, erode.g * 0.65 + flow.b * 0.5) * (1.0 - smoothstep(0.78, 1.12, rWarp));
            mask = clamp(max(coreBody, satIsland * 0.85), 0.0, 1.0);
            tendrilVein = clamp((claw1 * 0.8 + claw2 * 0.9) * smoothstep(0.28, 0.95, rWarp), 0.0, 1.0);
          } else if (uShapeMode < 1.5) {
            // Dendritic Crystalline Frost / Fractured Rune Slabs: spiky hexagonal/nonagonal crystal ferns!
            float fernA = abs(cos(ang * 6.0 + (flow.r - 0.5) * 2.8 + uSeed));
            float fernB = abs(sin(ang * 9.0 - (erode.r - 0.5) * 3.2 - uSeed * 0.7));
            float crystalReach = 0.56 + pow(fernA, 2.2) * 0.36 + pow(fernB, 3.4) * 0.26 + (erode.g - 0.5) * 0.18;
            mask = 1.0 - smoothstep(crystalReach - 0.18, crystalReach + 0.05, rWarp);
            tendrilVein = pow(fernA, 3.0) * smoothstep(0.32, 0.92, rWarp);
          } else {
            // Amoeboid Multi-Pool Miasma / Corruption / Quicksand: 4 offset organic metaball pools + satellite puddles!
            float field = 0.0;
            for (int m = 0; m < 4; m++) {
              float fm = float(m);
              vec2 hOff = (hash22(vec2(fm * 13.7, uSeed)) - 0.5) * 0.68;
              float radPool = 0.44 + 0.14 * hash21(vec2(uSeed, fm * 5.1));
              float d = length(pw - hOff);
              field += (radPool * radPool) / max(0.04, d * d);
            }
            field += erode.r * 0.42 + flow.g * 0.25;
            mask = smoothstep(1.22, 1.72, field) * (1.0 - smoothstep(0.96, 1.18, length(p)));
            tendrilVein = smoothstep(1.25, 1.58, field) * (1.0 - smoothstep(1.65, 2.2, field));
          }

          // Outward radial shock-propagation wipe on spawn + noise-eroded dissolution at end of life!
          float growR = min(1.35, uAge * 13.5);
          float wipe = 1.0 - smoothstep(max(0.0, growR - 0.16), growR + 0.10, rWarp - erode.r * 0.14);
          mask *= wipe;

          // 2) Multi-Texture Procedural Composite + Voronoi Tectonic Slab Cracks!
          vec4 txPrimary = sampleSplicedPrimary(pw * 0.55, uSeed);
          vec2 detUv = rot2(pw, 0.62) * 0.88 + vec2(uTime * (uShapeMode > 1.5 ? 0.05 : 0.01), -uTime * (uShapeMode > 1.5 ? 0.06 : 0.015));
          vec4 txDetail = texture2D(uDetailTex, detUv + (flow.rg - 0.5) * 0.14);

          vec3 vSlab = voronoiSlab(pw * 3.15 + (flow.rg - 0.5) * 0.55, uSeed);
          float crackWidth = mix(0.075, 0.038, clamp(rWarp * 0.85, 0.0, 1.0));
          float fissureSeam = 1.0 - smoothstep(0.008, crackWidth, vSlab.x);
          float creviceLip = smoothstep(crackWidth, crackWidth + 0.065, vSlab.x) * (1.0 - smoothstep(crackWidth + 0.065, crackWidth + 0.15, vSlab.x));
          float combinedCrack = clamp(max(fissureSeam, tendrilVein * (1.0 - smoothstep(0.0, 0.11, vSlab.x)) * 1.15), 0.0, 1.0);

          float diss = smoothstep(0.88, 1.0, uAge) * 1.12;
          float keepMetric = erode.r * 0.52 + combinedCrack * 0.38 + mask * 0.28;
          if (diss > 0.01 && keepMetric < diss) discard;

          float alphaTex = clamp(txPrimary.a * 0.68 + erode.g * 0.34 + combinedCrack * 0.55, 0.25, 1.0);
          float a = clamp(mask * alphaTex * (uTier <= 1.5 ? 0.55 : 0.96), 0.0, 0.98);
          if (a < 0.014) discard;

          if (uTier <= 2.5) {
            vec3 simpleCol = sampleRamp(uRamp, clamp(combinedCrack * 0.65 + txDetail.r * 0.35, 0.15, 0.95)) * (uTier <= 1.5 ? 0.95 : 1.35);
            gl_FragColor = vec4(simpleCol, a * 0.75);
            return;
          }

          // Height-modulated composite between spliced primary crust & secondary detail + slab shading!
          float slabShade = 0.76 + 0.38 * vSlab.y - creviceLip * 0.28;
          float detailBlend = clamp(txDetail.r * 0.65 + erode.b * 0.35 - 0.22, 0.0, 0.82);
          vec3 crustCol = mix(txPrimary.rgb * slabShade, txDetail.rgb * 1.08, detailBlend * 0.52);

          vec3 col = crustCol;
          if (uIsBurning > 0.5) {
            float hotMask = clamp(combinedCrack * 0.92 + smoothstep(0.42, 0.88, max(txDetail.r, txPrimary.r)) * 0.65, 0.0, 1.0);
            float pulse = 0.84 + 0.36 * sin(uTime * 8.5 + vSlab.z * 6.28 + flow.r * 5.0);
            float cool = 1.0 - smoothstep(0.84, 1.0, uAge) * 0.45;
            vec3 veinGlow = mix(txDetail.rgb, sampleRamp(uRamp, clamp(0.45 + hotMask * 0.52, 0.0, 0.99)), 0.62) * 2.25 * pulse * cool;
            col = mix(crustCol * 0.68, veinGlow, hotMask);
          } else if (uIsFrost > 0.5) {
            float glint = pow(max(txDetail.g, flow.b), 2.4) * (0.55 + 0.45 * sin(uTime * 6.5 + vSlab.y * 9.0));
            vec3 veinGlow = sampleRamp(uRamp, clamp(0.42 + combinedCrack * 0.50 + glint * 0.25, 0.0, 0.98)) * 1.75;
            col = mix(crustCol * 1.08 + txDetail.rgb * glint * 0.55, veinGlow, combinedCrack * 0.72);
          } else {
            // Tectonic stone crater: dark shattered slabs + glowing deep fault crevices!
            vec3 faultGlow = sampleRamp(uRamp, clamp(0.35 + combinedCrack * 0.55, 0.0, 0.96)) * 1.65;
            col = mix(crustCol * 0.92, faultGlow, combinedCrack * 0.68);
          }

          // Crisp darkened scorched/fractured outer lip for physical terrain grounding
          float outerLip = smoothstep(0.02, 0.22, mask) * (1.0 - smoothstep(0.22, 0.52, mask));
          col *= (1.0 - outerLip * 0.24);
          gl_FragColor = vec4(col, a);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, 0.014, cz);
    mesh.rotation.y = rotYaw;
    this.root.add(mesh);

    if (tier >= 3 && kind === 'burning' && effDuration >= 0.45) {
      this.airDistort.spawn({
        kind: 'heat',
        x: cx, y: 0.05, z: cz,
        r0: effR * 0.75, r1: effR * 0.88,
        height: clamp(effR * 0.85, 1.2, 2.5),
        duration: effDuration * 0.92,
        strength: 0.78,
      });
    } else if (tier >= 3 && (kind === 'crater' || kind === 'lightning')) {
      this.airDistort.spawn({
        kind: 'shock',
        x: cx, y: 0.35, z: cz,
        r0: 0.2, r1: effR * 1.05,
        duration: Math.min(0.42, effDuration * 0.5),
        strength: 0.82,
      });
    }

    if (eruptRocks && tier >= 3 && effDuration >= 0.55) {
      this.spawnRockDebris({
        x: cx, y: 0.12, z: cz, _mapped: true,
        count: Math.round(7 * clamp(effR / 1.8, 0.7, 1.8)),
        radius: effR * 0.35,
        life: Math.min(1.15, effDuration * 0.82),
        style: kind === 'frost' ? 'ice' : kind === 'burning' ? 'basalt' : 'slate',
        palette,
      });
    }

    let elapsed = 0;
    let flameTimer = 0.03;
    this.addCustom({
      mesh,
      _skipAutoMap: true,
      update: (dt) => {
        elapsed += dt;
        const u = clamp(elapsed / effDuration);
        mat.uniforms.uTime.value = elapsed;
        mat.uniforms.uAge.value = u;

        if (tier >= 3 && emitFlames && kind !== 'crater') {
          const rem = effDuration - elapsed;
          flameTimer -= dt;
          if (flameTimer <= 0 && rem > 0.26) {
            flameTimer = kind === 'burning' ? 0.14 : 0.22;
            const subLife = Math.min(0.34, rem - 0.05);
            if (subLife > 0.10) {
              const tongues = kind === 'burning' ? Math.max(1, Math.round(effR * 0.85)) : 1;
              for (let k = 0; k < tongues; k++) {
                const ang = this.R.range(0, TAU);
                const rr = Math.sqrt(this.R.next()) * effR * 0.74;
                const fx = cx + Math.cos(ang) * rr;
                const fz = cz + Math.sin(ang) * rr;
                if (kind === 'burning') {
                  this.spawnFlipbook({
                    atlas: 'fbFlame',
                    x: fx, y: 0.34, z: fz, _mapped: true,
                    vy: 0.55, life: subLife,
                    size0: 0.48, size1: 0.92,
                    palette, hdr: 2.05, emitMicro: false,
                  });
                  if (k === 0 && tier >= 4 && this.R.chance(0.65)) {
                    this.spawnDarkSmoke({
                      x: fx, y: 0.55, z: fz, _mapped: true,
                      vy: 0.95, life: subLife,
                      size0: 0.52, size1: 1.18, opacity: 0.42,
                    });
                  }
                } else if (kind === 'poison') {
                  this.spawnFlipbook({
                    atlas: 'fbPoison',
                    x: fx, y: 0.26, z: fz, _mapped: true,
                    vy: 0.32, life: subLife,
                    size0: 0.36, size1: 0.72,
                    palette, hdr: 1.95, emitMicro: false,
                  });
                } else if (kind === 'holy') {
                  this.spawnFlipbook({
                    atlas: 'fbFeatherBurst',
                    x: fx, y: 0.32, z: fz, _mapped: true,
                    vy: 0.48, life: subLife,
                    size0: 0.38, size1: 0.76,
                    palette, hdr: 2.0, emitMicro: false,
                  });
                } else if (kind === 'void') {
                  this.spawnFlipbook({
                    atlas: 'fbDarkVortex',
                    x: fx, y: 0.28, z: fz, _mapped: true,
                    vy: 0.25, life: subLife,
                    size0: 0.42, size1: 0.82,
                    palette, hdr: 1.95, emitMicro: false,
                  });
                } else if (kind === 'sand') {
                  this.spawnFlipbook({
                    atlas: 'fbWindTornado',
                    x: fx, y: 0.30, z: fz, _mapped: true,
                    vy: 0.42, life: subLife,
                    size0: 0.42, size1: 0.85,
                    palette, hdr: 1.9, emitMicro: false,
                  });
                } else {
                  this.niagara.spawnBurst(this.R, {
                    x: fx, y: 0.18, z: fz,
                    count: 5, spreadRadius: effR * 0.35,
                    speed0: 0.3, speed1: 1.1,
                    gravity: -0.6, curl: 2.8,
                    size0: 0.032, size1: 0.010,
                    life0: subLife * 0.6, life1: subLife,
                    palette: kind === 'lightning' ? PAL3D.mageVolt : PAL3D.mageFrost,
                    hdr: 1.9, twinkle: 0.65,
                  });
                }
              }
            }
          }
        }
      },
      get done() { return elapsed >= effDuration; },
      dispose() { geo.dispose(); mat.dispose(); },
    });
  }

  /** Unreal Engine 5 Niagara-grade GPU Instanced Micro-Particle Burst (Curl-Noise + Drag + Suction + Bounce + Twinkle) */
  spawnNiagaraBurst(opts = {}) {
    const tier = FX_CONFIG.tier;
    const tierMul = tier === 1 ? 0.14 : tier === 2 ? 0.45 : tier === 3 ? 0.80 : 1.0;
    const aoeMul = opts._mapped ? 1.0 : Math.pow(this.getAoeScale(), 0.55);
    const baseCount = opts.count ?? 24;
    const scaledCount = Math.max(1, Math.round(baseCount * tierMul * aoeMul));
    const [mx, mz] = this.mapSkillXZ(opts.x ?? 0, opts.z ?? 0, Boolean(opts._mapped));
    this.niagara.spawnBurst(this.R, {
      palette: PAL3D.warriorGold,
      ...opts,
      x: mx,
      z: mz,
      count: scaledCount,
      curl: tier === 1 ? 0 : (opts.curl ?? 2.8),
      spreadRadius: (opts.spreadRadius ?? 0.35) * (opts._mapped ? 1.0 : this.getAoeScale()),
    });
  }

  /**
   * Multi-Stage Niagara Charge-Up Suction & Compression Emitter + 3A Realistic AI Textures!
   * Pairs chargeVortex plasma funnel + chargeQiFlow meridian ribbons + crackedMagma core!
   */
  spawnChargeGather(opts = {}) {
    const chosenVariant = FX_CONFIG.chargeVariant !== 'auto' ? FX_CONFIG.chargeVariant : opts.variant;
    if (chosenVariant && chosenVariant !== 'default' && this._chargeVariantHook) {
      this._chargeVariantHook(this, chosenVariant, opts);
      return;
    }
    const {
      getAnchor,
      duration = 0.85,
      radius = 1.65,
      palette = PAL3D.warriorGold,
      rate = 165,
      vortex = 7.5,
      tiers = 2,
      noSigil = false,
    } = opts;
    const mappedAnchor = () => {
      const raw = getAnchor();
      const [mx, mz] = this.mapSkillXZ(raw.x, raw.z, Boolean(raw._isWorldScaled));
      return new THREE.Vector3(mx, raw.y, mz);
    };

    // 3A Realistic Textured Suction Vortex + Meridian Qi Ribbons + Magma Compression Core (Tier 3..4)
    let texGroup = null;
    const texGeos = [];
    const texMats = [];
    let vortexDisc = null, qiCyl = null, coreSphere = null, vortexMat = null, qiMat = null, coreMat = null;
    if (FX_CONFIG.tier >= 3 && duration >= 0.22) {
      const lib = getTexLib();
      const ramp = rampToColors(palette, 7);
      texGroup = new THREE.Group();
      const pInit = mappedAnchor();
      texGroup.position.copy(pInit);

      const gVortex = new THREE.PlaneGeometry(radius * 1.85, radius * 1.85);
      vortexMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uFade: { value: 1 },
          uTex: { value: lib.chargeVortex },
          uQiTex: { value: lib.chargeQiFlow },
          uErodeTex: { value: lib.erosionNoise },
          uRamp: { value: ramp },
          uHdr: { value: 1.95 },
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime, uFade, uHdr;
          uniform sampler2D uTex, uQiTex, uErodeTex;
          uniform vec3 uRamp[7];
          ${GLSL_NOISE}
          void main() {
            vec2 c = (vUv - 0.5) * 2.15;
            vec4 er = texture2D(uErodeTex, vUv * 2.4 + vec2(uTime * 0.35, -uTime * 0.42));
            vec2 cw = c + (er.rg - 0.5) * 0.24;
            float r = length(cw);
            float ang = atan(cw.y, cw.x);
            // Whipping 5-arm ragged spiral tendrils (breaks circular edge completely!)
            float spiralArm = 0.5 + 0.5 * sin(ang * 5.0 - r * 5.2 + uTime * 7.5 + er.r * 3.0);
            float maxR = 0.62 + pow(spiralArm, 1.8) * 0.48 + (er.g - 0.5) * 0.18;
            if (r > maxR) discard;

            float sAng = ang + uTime * 4.8 - r * 2.6;
            vec2 suv = vec2(0.5 + cos(sAng) * min(0.42, r * 0.42), 0.5 + sin(sAng) * min(0.42, r * 0.42));
            vec4 tx = texture2D(uTex, suv);
            vec4 qi = texture2D(uQiTex, vec2(ang * 0.477 + uTime * 0.9, r * 1.15 + uTime * 1.6));
            float lum = clamp(dot(tx.rgb, vec3(0.3, 0.59, 0.11)) * 0.72 + qi.g * 0.58, 0.0, 1.0);
            float armMask = 1.0 - smoothstep(maxR - 0.26, maxR, r);
            float a = clamp((tx.a * 0.7 + qi.a * 0.5) * lum * armMask * uFade * 0.88, 0.0, 0.96);
            if (a < 0.015) discard;
            vec3 col = mix(tx.rgb * uHdr, sampleRamp(uRamp, clamp(0.28 + lum * 0.68, 0.0, 0.99)) * uHdr, 0.58);
            gl_FragColor = vec4(col * a, a);
          }
        `,
      });
      vortexDisc = new THREE.Mesh(gVortex, vortexMat);
      vortexDisc.rotation.x = -Math.PI * 0.36;

      const gQi = new THREE.CylinderGeometry(radius * 0.38, radius * 0.72, radius * 0.92, 32, 1, true);
      qiMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uFade: { value: 1 },
          uTex: { value: lib.chargeQiFlow },
          uRamp: { value: ramp },
          uHdr: { value: 1.85 },
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime, uFade, uHdr;
          uniform sampler2D uTex;
          uniform vec3 uRamp[7];
          ${GLSL_NOISE}
          void main() {
            vec4 tx = texture2D(uTex, vec2(vUv.x * 2.0 + uTime * 0.85, vUv.y * 1.4 - uTime * 1.65));
            float vMask = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.78, 1.0, vUv.y));
            float lum = max(tx.r, max(tx.g, tx.b));
            float a = clamp(tx.a * lum * vMask * uFade * 0.78, 0.0, 0.95);
            if (a < 0.014) discard;
            vec3 col = mix(tx.rgb * uHdr, sampleRamp(uRamp, clamp(0.32 + lum * 0.64, 0.0, 0.99)) * uHdr, 0.58);
            gl_FragColor = vec4(col * a, a);
          }
        `,
      });
      qiCyl = new THREE.Mesh(gQi, qiMat);

      const gCore = new THREE.IcosahedronGeometry(0.16, 2);
      coreMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uFade: { value: 1 },
          uTex: { value: lib.crackedMagma },
          uRamp: { value: ramp },
          uHdr: { value: 2.25 },
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime, uFade, uHdr;
          uniform sampler2D uTex;
          uniform vec3 uRamp[7];
          ${GLSL_NOISE}
          void main() {
            vec4 tx = texture2D(uTex, vUv * 2.0 + vec2(uTime * 0.45, -uTime * 0.35));
            float lum = dot(tx.rgb, vec3(0.35, 0.5, 0.15));
            vec3 col = sampleRamp(uRamp, clamp(0.38 + lum * 0.62, 0.0, 0.99)) * uHdr;
            float a = clamp((0.55 + lum * 0.45) * uFade, 0.0, 1.0);
            gl_FragColor = vec4(col * a, a);
          }
        `,
      });
      coreSphere = new THREE.Mesh(gCore, coreMat);
      texGroup.add(vortexDisc, qiCyl, coreSphere);
      texGeos.push(gVortex, gQi, gCore);
      texMats.push(vortexMat, qiMat, coreMat);
    }

    let elapsed = 0;
    let accum = 0;
    let nextTier = 1;
    this.addCustom({
      group: texGroup || undefined,
      _skipAutoMap: true,
      update: (dt) => {
        elapsed += dt;
        if (elapsed >= duration) return;
        const pos = mappedAnchor();
        const u = clamp(elapsed / duration);
        if (texGroup) {
          texGroup.position.copy(pos);
          const env = smooth(0.0, 0.14, u) * (1 - smooth(0.84, 1.0, u));
          const pinch = 1.08 - 0.42 * u;
          vortexDisc.scale.setScalar(pinch);
          qiCyl.scale.set(pinch, 0.75 + 0.45 * u, pinch);
          qiCyl.rotation.y -= dt * 3.8;
          coreSphere.scale.setScalar(0.55 + u * 1.15);
          coreSphere.rotation.y += dt * 6.5;
          vortexMat.uniforms.uTime.value = elapsed;
          vortexMat.uniforms.uFade.value = env;
          qiMat.uniforms.uTime.value = elapsed;
          qiMat.uniforms.uFade.value = env;
          coreMat.uniforms.uTime.value = elapsed;
          coreMat.uniforms.uFade.value = env;
        }
        accum += rate * (0.7 + 0.8 * u) * dt;
        const n = Math.floor(accum);
        if (n > 0) {
          accum -= n;
          const rem = Math.max(0.08, duration - elapsed);
          const pLife = Math.min(rem * 0.95, 0.34);
          if (pLife > 0.06) {
            this.niagara.spawnBurst(this.R, {
              x: pos.x, y: pos.y, z: pos.z,
              count: n,
              spreadRadius: radius * (1.12 - 0.45 * u),
              speed0: 0.2, speed1: 1.1,
              drag: 3.4, gravity: -0.4,
              curl: 2.2, vortex,
              vortexCenter: [pos.x, pos.z],
              attractPos: mappedAnchor,
              attractStr: 16.5 + u * 12.0,
              size0: 0.032 + u * 0.014, size1: 0.010,
              stretch: 0.028,
              life0: pLife * 0.65, life1: pLife,
              palette, hdr: 2.0 + u * 0.6, bounce: 0, twinkle: 0.45,
            });
          }
        }
        if (tiers > 0 && nextTier <= tiers && u >= (nextTier / (tiers + 0.25))) {
          const rem = Math.max(0.10, duration - elapsed);
          const sh = new ShockSphere3D({
            x: pos.x, y: pos.y, z: pos.z,
            r0: 0.08, r1: radius * (0.62 + 0.16 * nextTier),
            duration: Math.min(0.24, rem * 0.92),
            palette, hdr: 2.25, implode: true, useRunes: !noSigil,
          });
          sh._skipAutoMap = true;
          this.addCustom(sh);
          this.spawnStarGlint(pos.x, pos.y, pos.z, 0.45 + nextTier * 0.18, palette[5] || '#ffffff', Math.min(0.11, rem * 0.8), true);
          nextTier++;
        }
      },
      get done() { return elapsed >= duration; },
      dispose() {
        texGeos.forEach((g) => g.dispose());
        texMats.forEach((m) => m.dispose());
      },
    });
  }

  /**
   * 4-Shell Geodesic Curved Volumetric Mesh for 16-Frame Flipbooks!
   * 3 vertical curved shells (0°, 60°, 120°) + 1 tilted overhead shell so ANY camera angle
   * (45°, ground-level side, 90° top-down, 360° free orbit) sees full volume while edge-on shells
   * smoothly cosine-fade to 0 — ZERO flat cards and ZERO X-plane seam lines!
   */
  _makeFlipbookVolumeGeo() {
    const pos = [], norm = [], uvs = [], idx = [];
    const orientations = [
      new THREE.Euler(0, 0, 0),
      new THREE.Euler(0, Math.PI / 3, 0),
      new THREE.Euler(0, (2 * Math.PI) / 3, 0),
      new THREE.Euler(Math.PI * 0.46, 0.35, 0),
    ];
    const seg = 4;
    let vOffset = 0;
    const vTmp = new THREE.Vector3(), nTmp = new THREE.Vector3();

    for (const eu of orientations) {
      const q = new THREE.Quaternion().setFromEuler(eu);
      for (let iy = 0; iy <= seg; iy++) {
        const v = iy / seg;
        const py = v - 0.5;
        for (let ix = 0; ix <= seg; ix++) {
          const u = ix / seg;
          const px = u - 0.5;
          const bow = 0.11 * Math.cos(px * Math.PI) * Math.cos(py * Math.PI);
          vTmp.set(px, py, bow).applyQuaternion(q);
          nTmp.set(px * 0.28, py * 0.28, 1.0).normalize().applyQuaternion(q);
          pos.push(vTmp.x, vTmp.y, vTmp.z);
          norm.push(nTmp.x, nTmp.y, nTmp.z);
          uvs.push(u, v);
        }
      }
      for (let iy = 0; iy < seg; iy++) {
        for (let ix = 0; ix < seg; ix++) {
          const a = vOffset + iy * (seg + 1) + ix;
          const b = a + seg + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      vOffset += (seg + 1) * (seg + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    return g;
  }

  /** Spawn a True-3D Multi-Shell Animated 4x4 (16-Frame) Niagara SubUV Flipbook Volume! */
  spawnFlipbook({
    atlas = 'fbFlame', x = 0, y = 0.8, z = 0, vx = 0, vy = 0, vz = 0,
    life = 0.55, size0 = 0.65, size1 = 1.25, palette = PAL3D.fireInferno,
    hdr = 1.85, opacity = 0.9, additive = true, loopFrames = false, fps = 28,
    drag = 1.5, delay = 0, rotSpeed = 0.8, emitMicro = true, _mapped = false,
  } = {}) {
    const [mx, mz] = this.mapSkillXZ(x, z, _mapped);
    const aoeMul = _mapped ? 1.0 : Math.pow(this.getAoeScale(), 0.65);
    const effSize0 = size0 * aoeMul;
    const effSize1 = size1 * aoeMul;
    const lib = getTexLib();
    const tex = resolveFlipbookTex(atlas);
    const ramp = rampToColors(palette, 7);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTex: { value: tex },
        uNoiseTex: { value: lib.flowNoise },
        uErodeTex: { value: lib.erosionNoise },
        uFrame: { value: 0 },
        uAge: { value: 0 },
        uOpacity: { value: opacity },
        uHdr: { value: FX_CONFIG.tier === 1 ? 0.92 : hdr },
        uAdditive: { value: additive ? 1.0 : 0.0 },
        uLoopFrames: { value: loopFrames ? 1.0 : 0.0 },
        uTextureTint: { value: FX_CONFIG.paletteOverrideActive ? 0.0 : 0.20 },
        uRamp: { value: ramp },
        uSceneDepth: { value: this.softDepth?.texture || lib.flowNoise },
        uDepthResolution: { value: this.softDepth?.viewport || new THREE.Vector2(1, 1) },
        uCameraNear: { value: this.softDepth?.near || 0.12 },
        uCameraFar: { value: this.softDepth?.far || 165 },
        uSoftDepth: { value: this.softDepth?.enabled ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying float vWorldY;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldY = wp.y;
          vec4 mv = viewMatrix * wp;
          vNormalView = normalize(normalMatrix * normal);
          vViewDir = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying float vWorldY;
        uniform sampler2D uTex, uNoiseTex, uErodeTex, uSceneDepth;
        uniform float uFrame, uAge, uOpacity, uHdr, uAdditive, uLoopFrames, uTextureTint;
        uniform vec2 uDepthResolution;
        uniform float uCameraNear, uCameraFar, uSoftDepth;
        uniform vec3 uRamp[7];
        ${GLSL_NOISE}

        float eyeDepth(float z) {
          float ndc = z * 2.0 - 1.0;
          return (2.0 * uCameraNear * uCameraFar) /
            (uCameraFar + uCameraNear - ndc * (uCameraFar - uCameraNear));
        }

        vec4 sampleSubUV(float idx, vec2 localUv) {
          float col = mod(idx, 4.0);
          float row = floor(idx / 4.0);
          vec2 cellUv = (vec2(col, 3.0 - row) + localUv) * 0.25;
          return texture2D(uTex, cellUv);
        }

        void main() {
          // Dual-Texture Niagara Flow-Map UV Distortion + Asymmetric Erosion (breaks round sprite blobs!)
          vec4 nz = texture2D(uNoiseTex, vUv * 1.9 + vec2(uAge * 0.38, -uAge * 0.58));
          vec4 er = texture2D(uErodeTex, vUv * 2.6 + vec2(-uAge * 0.32, uAge * 0.44));
          vec2 localUv = clamp(vUv + (nz.rg - 0.5) * (0.028 + 0.048 * uAge) + (er.rg - 0.5) * 0.024, 0.025, 0.975);

          float f0 = floor(mod(uFrame, 16.0));
          float f1 = uLoopFrames > 0.5 ? mod(f0 + 1.0, 16.0) : min(f0 + 1.0, 15.0);
          float blend = fract(uFrame);
          vec4 tx = mix(sampleSubUV(f0, localUv), sampleSubUV(f1, localUv), blend);

          float ndv = clamp(abs(dot(normalize(vNormalView), normalize(vViewDir))), 0.0, 1.0);
          float shellWeight = pow(ndv, 1.28) * 1.18;
          float depthFade = smoothstep(-0.04, 0.16, vWorldY);
          float rimDist = length(vUv - 0.5) * 2.0;
          float irregRim = 1.0 - smoothstep(0.68 + er.r * 0.34, 1.05 + nz.g * 0.18, rimDist);
          float erodeThresh = smoothstep(0.55, 1.0, uAge) * 0.40;
          float erodedAlpha = smoothstep(erodeThresh, min(0.98, erodeThresh + 0.32), tx.a * (0.68 + 0.48 * er.r) * irregRim);

          float a = clamp(erodedAlpha * shellWeight * depthFade * uOpacity, 0.0, 1.0);
          if (uSoftDepth > 0.5) {
            float surfaceDepth = texture2D(uSceneDepth, gl_FragCoord.xy / uDepthResolution).x;
            float separation = eyeDepth(surfaceDepth) - eyeDepth(gl_FragCoord.z);
            a *= smoothstep(0.0, 0.35, separation);
          }
          if (a < 0.012) discard;

          float heat = uAdditive > 0.5
            ? clamp(tx.r * 0.52 + tx.g * 0.34 + tx.b * 0.24 - uAge * 0.15, 0.0, 0.99)
            : clamp(0.26 + tx.r * 0.58 - uAge * 0.12, 0.20, 0.88);
          vec3 colOut = sampleRamp(uRamp, heat) * uHdr;
          // Keep the original map's fine colour variation without losing the
          // effect palette; an explicit palette override remains authoritative.
          float sourceLuma = dot(tx.rgb, vec3(0.2126, 0.7152, 0.0722));
          vec3 sourceTint = clamp(tx.rgb / max(sourceLuma, 0.16), vec3(0.68), vec3(1.35));
          colOut *= mix(vec3(1.0), sourceTint, uTextureTint);
          colOut += uRamp[6] * uHdr * 0.08 * smoothstep(0.72, 0.98, sourceLuma);
          if (tx.b > 0.45 && uAdditive > 0.5) {
            colOut = mix(colOut, uRamp[6] * (uHdr * 1.15), (tx.b - 0.45) * 0.9);
          }
          // Three.js additive and normal blending both apply source alpha.
          gl_FragColor = vec4(colOut, a);
        }
      `,
    });
    const mesh = new THREE.Mesh(this._flipbookVolumeGeo, mat);
    mesh.rotation.y = this.R.range(0, TAU);
    mesh.visible = false;
    this.root.add(mesh);
    this.flipbooks.push({
      mesh, mat, x: mx, y, z: mz, vx, vy, vz,
      life, max: life, size0: effSize0, size1: effSize1, opacity, loopFrames, fps, drag, delay,
      windFactor: atlas === 'fbSmoke' || atlas === 'fbFlame' ? 1 : 0,
      rotY: mesh.rotation.y, rotSpeed: rotSpeed * this.R.sign(),
      startFrame: loopFrames ? this.R.int(0, 15) : 0,
    });

    // A single instanced draw adds short GPU-evaluated sparks to impact atlases.
    if (emitMicro && additive && !loopFrames && life >= 0.20 && FX_CONFIG.tier >= 3
        && ['fbExplosion', 'fbHitBurst', 'fbLightning', 'fbIceShatter', 'fbStarburst'].includes(atlas)) {
      const sparkRng = new Rng(Math.floor(this.R.next() * 4294967296));
      this.gpuSparks.spawnBurst(sparkRng, {
        x: mx, y, z: mz, count: FX_CONFIG.tier === 4 ? 18 : 10, palette,
        life: Math.min(0.52, life * 0.82), delay,
        spread: effSize0 * 0.15, size: clamp(0.055 + effSize0 * 0.025, 0.055, 0.14),
        gravity: atlas === 'fbLightning' ? 1.5 : 4.5,
        windX: atlas === 'fbExplosion' ? FX_CONFIG.windX : 0,
        windZ: atlas === 'fbExplosion' ? FX_CONFIG.windZ : 0,
      });
    }

    // Tier 4 automatic dark-soot contrast cloud + shockwave air refraction on heavy explosions!
    if (FX_CONFIG.tier >= 4 && additive && atlas === 'fbExplosion' && size1 >= 2.0 && life >= 0.36 && !loopFrames) {
      this.spawnDarkSmoke({
        x: mx, y: y + 0.22, z: mz, _mapped: true,
        vy: 0.95,
        life: life * 0.90,
        size0: effSize0 * 0.78,
        size1: effSize1 * 0.92,
        emberHex: palette[4] || '#ff6e24',
        opacity: 0.48,
        delay,
      });
      this.airDistort.spawn({
        kind: 'shock',
        x: mx, y: Math.max(0.5, y), z: mz,
        r0: 0.25, r1: effSize1 * 0.88,
        duration: life * 0.78,
        strength: 0.72,
        delay,
      });
    }

    // Automatic secondary Unreal Niagara curl-noise micro-particles bounded strictly inside flipbook lifetime!
    if (emitMicro && FX_CONFIG.tier >= 2 && additive && life >= 0.20 && !loopFrames) {
      const mLifeMax = Math.min(0.42, life * 0.78);
      if (mLifeMax >= 0.12) {
        const isBlast = atlas === 'fbExplosion' || atlas === 'fbHitBurst' || atlas === 'fbStarburst';
        const cnt = Math.max(2, Math.round((isBlast ? 16 : 9) * (FX_CONFIG.tier === 2 ? 0.4 : FX_CONFIG.tier === 3 ? 0.75 : 1.0)));
        this.niagara.spawnBurst(this.R, {
          x: mx, y, z: mz,
          count: cnt,
          speed0: isBlast ? 2.6 : 1.1,
          speed1: isBlast ? 6.8 : 3.2,
          spreadRadius: effSize0 * 0.22,
          drag: isBlast ? 5.8 : 4.2,
          gravity: atlas === 'fbBlessing' || atlas === 'fbFlame' ? -1.8 : 5.5,
          curl: 3.6,
          size0: 0.032, size1: 0.010,
          stretch: isBlast ? 0.028 : 0.018,
          life0: mLifeMax * 0.58, life1: mLifeMax,
          palette, hdr: hdr * 1.05, bounce: 0.42, twinkle: 0.35, delay,
          temperature: atlas === 'fbExplosion' || atlas === 'fbFlame' ? 1 : 0,
          temperatureDecay: 2.4,
          buoyancy: atlas === 'fbExplosion' || atlas === 'fbFlame' ? 3.5 : 0,
          collisionSparkCount: atlas === 'fbExplosion' && FX_CONFIG.tier >= 3 ? 2 : 0,
          windFactor: atlas === 'fbExplosion' || atlas === 'fbFlame' ? 1 : 0,
        });
      }
    }
  }

  /** Sculpted 6-sided double-tapered quartz crystal geometry (thick waist + sharp faceted spire!) */
  _makeHexCrystalGeo() {
    const pos = [], idx = [];
    const sides = 6;
    const rings = [
      { y: 0.00, r: 0.34 },
      { y: 0.24, r: 0.48 },
      { y: 0.68, r: 0.30 },
      { y: 1.00, r: 0.00 },
    ];
    for (let ir = 0; ir < rings.length; ir++) {
      const { y, r } = rings[ir];
      for (let is = 0; is < sides; is++) {
        const a = (is / sides) * TAU;
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      }
    }
    for (let ir = 0; ir < rings.length - 1; ir++) {
      for (let is = 0; is < sides; is++) {
        const nextS = (is + 1) % sides;
        const a = ir * sides + is, b = ir * sides + nextS;
        const c = (ir + 1) * sides + is, d = (ir + 1) * sides + nextS;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const nonIndexed = g.toNonIndexed();
    g.dispose();
    nonIndexed.computeVertexNormals(); // Flat crisp crystal facet normals!
    return nonIndexed;
  }

  /** Velocity-stretched 3D Diamond Spindle Spark */
  spawnSpark({
    x, y, z, vx, vy, vz, life = 0.22, size = 0.048, stretch = 0.032,
    gravity = 12.0, drag = 2.6, bounce = 0.42, color = '#ffd875', coreWhite = true, delay = 0, streakIn = false, _mapped = false
  }) {
    const [mx, mz] = this.mapSkillXZ(x, z, _mapped);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(coreWhite ? 1.85 : 1.35),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(this._sparkGeo, mat);
    mesh.visible = false;
    this.root.add(mesh);
    this.sparks.push({ mesh, mat, x: mx, y, z: mz, vx, vy, vz, life, max: life, size, stretch, gravity, drag, bounce, delay, streakIn, baseColor: new THREE.Color(color) });
  }

  /** Organic 3D Vertex-Displaced & Noise-Eroded Volumetric Cloudlet (NEVER looks like a ping-pong sphere!) */
  spawnPuff({ x, y, z, vx = 0, vy = 0.4, vz = 0, life = 0.45, size0 = 0.25, size1 = 0.75, color = '#a8dcff', alpha = 0.32, drag = 3.2, additive = true, delay = 0, _mapped = false }) {
    const [mx, mz] = this.mapSkillXZ(x, z, _mapped);
    const aoeMul = _mapped ? 1.0 : Math.pow(this.getAoeScale(), 0.55);
    const c = new THREE.Color(color).multiplyScalar(additive ? 1.25 : 0.95);
    const seed = this.R.range(0, 100);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uColor: { value: c },
        uOpacity: { value: 0 },
        uAge: { value: 0 },
        uSeed: { value: seed },
        uNoiseTex: { value: getTexLib().erosionNoise },
      },
      vertexShader: `
        uniform float uAge, uSeed;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying vec3 vLocalPos;
        ${GLSL_NOISE}
        void main() {
          float disp = fbm(position.xy * 3.2 + vec2(uSeed, uAge * 2.2)) * 0.42;
          vec3 displaced = position * (0.82 + disp);
          vLocalPos = displaced;
          vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
          vNormalView = normalize(normalMatrix * normal);
          vViewDir = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying vec3 vLocalPos;
        uniform vec3 uColor;
        uniform float uOpacity, uAge, uSeed;
        uniform sampler2D uNoiseTex;
        ${GLSL_NOISE}
        void main() {
          float ndv = clamp(abs(dot(normalize(vNormalView), normalize(vViewDir))), 0.0, 1.0);
          float wisp = fbm(vLocalPos.xz * 4.5 + vec2(uSeed, -uAge * 3.0));
          vec4 detail = texture2D(uNoiseTex, vLocalPos.xz * 1.8 + vec2(uSeed * 0.13, -uAge * 0.55));
          float density = wisp * 0.72 + detail.r * 0.28;
          float mask = pow(ndv, 1.9) * smoothstep(0.22 + uAge * 0.25, 0.78, density + ndv * 0.35);
          float a = uOpacity * mask;
          if (a < 0.012) discard;
          gl_FragColor = vec4(uColor * (0.72 + 0.42 * density + 0.12 * detail.g), a);
        }
      `,
    });
    const mesh = new THREE.Mesh(this._puffGeo, mat);
    mesh.rotation.set(this.R.range(0, TAU), this.R.range(0, TAU), this.R.range(0, TAU));
    mesh.visible = false;
    this.root.add(mesh);
    this.puffs.push({
      mesh, mat, x: mx, y, z: mz, vx, vy, vz,
      rx: this.R.range(-2.2, 2.2), ry: this.R.range(-2.2, 2.2),
      life, max: life, size0: size0 * aoeMul, size1: size1 * aoeMul, alpha, drag, delay,
    });
  }

  /** Tumbling Semi-Transparent Refractive 3D Faceted Crystal / Rock Shard */
  spawnShard({ x, y, z, vx, vy, vz, life = 0.4, size = 0.09, gravity = 15.0, bounce = 0.35, color = '#d8f6ff', hdr = 1.65, _mapped = false }) {
    const [mx, mz] = this.mapSkillXZ(x, z, _mapped);
    const baseCol = new THREE.Color(color);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uCol: { value: baseCol },
        uHdr: { value: hdr },
        uOpacity: { value: 1.0 },
      },
      vertexShader: `
        varying vec3 vNorm;
        varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNorm = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vNorm;
        varying vec3 vView;
        uniform vec3 uCol;
        uniform float uHdr, uOpacity;
        void main() {
          vec3 N = normalize(vNorm);
          vec3 V = normalize(vView);
          float fres = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 1.9);
          float spec = pow(max(0.0, dot(N, normalize(vec3(-0.4, 0.8, 0.5) + V))), 22.0);
          float a = clamp((0.32 + fres * 0.58 + spec * 0.4) * uOpacity, 0.0, 0.92);
          vec3 c = uCol * (0.55 + fres * uHdr * 0.85) + vec3(1.0) * spec * uHdr * 0.7;
          gl_FragColor = vec4(c, a);
        }
      `,
    });
    const mesh = new THREE.Mesh(this._shardGeo, mat);
    mesh.scale.set(size * this.R.range(0.7, 1.2), size * this.R.range(1.0, 1.6), size * this.R.range(0.6, 1.0));
    mesh.position.set(mx, y, mz);
    mesh.rotation.set(this.R.range(0, TAU), this.R.range(0, TAU), this.R.range(0, TAU));
    this.root.add(mesh);
    this.shards.push({
      mesh, mat, x: mx, y, z: mz, vx, vy, vz,
      rx: this.R.range(-14, 14), ry: this.R.range(-14, 14), rz: this.R.range(-14, 14),
      life, max: life, gravity, bounce, rest: false,
    });
  }

  /**
   * Physics-Driven Craggy 3D Flying Boulder / Magma Ember Chunk!
   * Features watertight faceted rock mesh + glowing magma/energy fissures + mid-air spark shedding + real floor bounce sparks!
   */
  spawnFireRock({
    x, y, z, vx, vy, vz, size = 0.22, life = 0.95, gravity = 14.5, bounce = 0.44,
    palette = PAL3D.fireInferno, rockColor = '#281d19', veinStrength = 1.85,
    emitSparks = true, emitFlame = false, delay = 0, _mapped = false,
  } = {}) {
    const [mx, mz] = this.mapSkillXZ(x, z, _mapped);
    const geo = this._craggyGeos[this.R.int(0, this._craggyGeos.length - 1)];
    const mat = makeMagmaRockMaterial({ palette, rockColor, veinStrength });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(
      size * this.R.range(0.82, 1.25),
      size * this.R.range(0.78, 1.18),
      size * this.R.range(0.82, 1.25)
    );
    mesh.position.set(mx, y, mz);
    mesh.rotation.set(this.R.range(0, TAU), this.R.range(0, TAU), this.R.range(0, TAU));
    mesh.visible = delay <= 0;
    this.root.add(mesh);
    this.fireRocks.push({
      mesh, mat, x: mx, y, z: mz, vx, vy, vz, size,
      rx: this.R.range(-9, 9), ry: this.R.range(-9, 9), rz: this.R.range(-9, 9),
      life, max: life, gravity, bounce, palette,
      sparkHex: palette[4] || '#ffaa33',
      emitSparks, emitFlame, trailTimer: this.R.range(0.01, 0.05),
      delay, rest: false,
    });
  }

  /** Clustered Multi-Spire Semi-Transparent Refractive 3D Quartz/Ice Formation */
  spawnCrystal({ x, z, height = 1.1, width = 0.28, leanX = 0, leanZ = 0, delay = 0, hold = 0.9, melt = 0.45, palette = PAL3D.mageFrost, _mapped = false }) {
    const ramp = rampToColors(palette, 7);
    const lib = getTexLib();
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uFlash: { value: 1 },
        uGlint: { value: 0 },
        uAlpha: { value: 1 },
        uNoiseTex: { value: lib.flowNoise },
        uRamp: { value: ramp },
      },
      vertexShader: `
        varying vec3 vNorm;
        varying vec3 vViewDir;
        varying vec3 vLocal;
        varying float vH;
        void main() {
          vLocal = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNorm = normalize(normalMatrix * normal);
          vViewDir = normalize(-mv.xyz);
          vH = position.y;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vNorm;
        varying vec3 vViewDir;
        varying vec3 vLocal;
        varying float vH;
        uniform float uFlash, uGlint, uAlpha;
        uniform sampler2D uNoiseTex;
        uniform vec3 uRamp[7];
        ${GLSL_NOISE}
        void main() {
          vec3 N = normalize(vNorm);
          vec3 V = normalize(vViewDir);
          float sun = clamp(dot(N, normalize(vec3(-0.5, 0.8, 0.45))) * 0.5 + 0.5, 0.0, 1.0);
          float fresnel = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 1.85);
          float spec = pow(max(0.0, dot(N, normalize(vec3(-0.4, 0.78, 0.5) + V))), 26.0);
          float h = clamp(vH, 0.0, 1.0);
          vec4 nz = texture2D(uNoiseTex, vLocal.xy * 2.2 + vec2(vLocal.z * 1.8, uGlint * 0.25));

          // Semi-transparent refractive glacier/crystal interior + sharp icy Fresnel facets!
          float facet = floor((sun * 0.55 + h * 0.35 + nz.b * 0.22) * 6.0) / 6.0;
          vec3 col = sampleRamp(uRamp, clamp(0.18 + facet * 0.62, 0.0, 0.90)) * 1.28;
          col += uRamp[5] * fresnel * 1.15 + uRamp[6] * spec * 1.25;
          if (h > 0.76) col = mix(col, uRamp[6] * 1.75, (h - 0.76) / 0.24);
          if (abs(h - uGlint) < 0.06) col += uRamp[6] * 0.95;
          col = mix(col, uRamp[6] * 1.85, uFlash);

          float glassAlpha = clamp((0.28 + fresnel * 0.58 + spec * 0.36 + nz.b * 0.14 + h * 0.12) * uAlpha, 0.0, 0.90);
          gl_FragColor = vec4(col, glassAlpha);
        }
      `,
    });

    const cluster = new THREE.Group();
    cluster.position.set(x, 0, z);
    cluster.rotation.set(leanZ, this.R.range(0, TAU), -leanX);

    // Main central faceted crystal spire
    const mainSpire = new THREE.Mesh(this._crystalPrismGeo, mat);
    cluster.add(mainSpire);

    // Two angled secondary sub-spires at base so it looks like a natural 3D crystal cluster!
    for (let s = 0; s < 2; s++) {
      const sub = new THREE.Mesh(this._crystalPrismGeo, mat);
      const a = s * Math.PI + this.R.range(-0.5, 0.5);
      const subScale = this.R.range(0.45, 0.64);
      sub.scale.set(subScale * 0.9, subScale, subScale * 0.9);
      sub.position.set(Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18);
      sub.rotation.set(Math.sin(a) * 0.42, a, -Math.cos(a) * 0.42);
      cluster.add(sub);
    }

    cluster.visible = false;
    this.root.add(cluster);
    const [mx, mz] = this.mapSkillXZ(x, z, _mapped);
    cluster.position.set(mx, 0, mz);
    const wMul = _mapped ? 1.0 : clamp(Math.pow(this.getAoeScale(), 0.5), 0.78, 1.45);
    this.crystals.push({ mesh: cluster, mat, height, width: width * wMul, delay, hold, melt, t: -delay, phase: this.R.next() });
  }

  /** Sharp Angular Kinked 3D Segmented Lightning (ZERO curvy CatmullRom worms! Dynamically re-crackles!) */
  spawnLightning({ p0, p1, life = 0.20, jag = 0.22, depth = 4, forks = 2, palette = PAL3D.mageVolt, thickness = 0.05, _mapped = false }) {
    const wp0 = _mapped ? p0.clone() : this.mapSkillVec3(p0);
    const wp1 = _mapped ? p1.clone() : this.mapSkillVec3(p1);
    p0 = wp0; p1 = wp1;
    const ramp = rampToColors(palette, 7);
    const group = new THREE.Group();
    this.root.add(group);

    const buildAngularBolt = () => {
      // Clear previous segments cleanly
      while (group.children.length) {
        const ch = group.children[0];
        group.remove(ch);
        ch.geometry.dispose();
      }
      const makePath = (a, b, dp, jg) => {
        let pts = [a.clone(), b.clone()];
        for (let d = 0; d < dp; d++) {
          const next = [pts[0]];
          for (let i = 1; i < pts.length; i++) {
            const A = pts[i - 1], B = pts[i], mid = A.clone().add(B).multiplyScalar(0.5);
            const L = A.distanceTo(B);
            mid.x += (this.R.next() * 2 - 1) * jg * L;
            mid.y += (this.R.next() * 2 - 1) * jg * L * 0.8;
            mid.z += (this.R.next() * 2 - 1) * jg * L;
            next.push(mid, B);
          }
          pts = next;
        }
        return pts;
      };

      // Build sharp straight-segment 4-sided 3D prism mesh along polyline (sharp electric kinks!)
      const addSharpPrismChain = (pts, rad0, rad1, mat) => {
        const sides = 4;
        const pos = [], idx = [];
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const prev = pts[Math.max(0, i - 1)];
          const next = pts[Math.min(pts.length - 1, i + 1)];
          const dir = next.clone().sub(prev);
          if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
          dir.normalize();
          const upRef = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
          const sA = new THREE.Vector3().crossVectors(dir, upRef).normalize();
          const sB = new THREE.Vector3().crossVectors(dir, sA).normalize();
          const r = lerp(rad0, rad1, i / Math.max(1, pts.length - 1));
          for (let s = 0; s < sides; s++) {
            const a = (s / sides) * TAU;
            const cs = Math.cos(a) * r, sn = Math.sin(a) * r;
            pos.push(p.x + sA.x * cs + sB.x * sn, p.y + sA.y * cs + sB.y * sn, p.z + sA.z * cs + sB.z * sn);
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
        group.add(new THREE.Mesh(geo, mat));
      };

      const mainPts = makePath(p0, p1, depth, jag);
      addSharpPrismChain(mainPts, thickness * 0.36, thickness * 0.24, coreMat);
      addSharpPrismChain(mainPts, thickness * 1.25, thickness * 0.85, auraMat);

      for (let f = 0; f < forks; f++) {
        const idxPt = this.R.int(2, Math.max(2, mainPts.length - 3));
        const start = mainPts[idxPt];
        const dir = p1.clone().sub(p0).normalize().multiplyScalar(p0.distanceTo(p1) * this.R.range(0.22, 0.44));
        dir.x += this.R.range(-0.95, 0.95);
        dir.y += this.R.range(-0.65, 0.65);
        dir.z += this.R.range(-0.95, 0.95);
        const fPts = makePath(start, start.clone().add(dir), 3, jag * 1.25);
        addSharpPrismChain(fPts, thickness * 0.32, 0.004, forkMat);
      }
    };

    const coreMat = new THREE.MeshBasicMaterial({ color: ramp[6].clone().multiplyScalar(2.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const auraMat = new THREE.MeshBasicMaterial({ color: ramp[2].clone().multiplyScalar(1.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const forkMat = new THREE.MeshBasicMaterial({ color: ramp[4].clone().multiplyScalar(1.75), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

    buildAngularBolt();
    this.bolts.push({ group, mats: [coreMat, auraMat, forkMat], rebuild: buildAngularBolt, rejagTimer: 0.04, life, max: life });
  }

  spawnBolt(p0, p1, { radius = 0.048, jitter = 0.24, life = 0.45, color = '#9be2ff', palette = null } = {}) {
    const pal = palette || ['#101848', '#223896', color, color, color, '#eef6ff', '#ffffff'];
    this.spawnLightning({ p0, p1, life, jag: jitter, depth: 4, forks: 2, palette: pal, thickness: radius });
  }

  addLight(x, y, z, color, intensity = 4.2, distance = 5.5, life = 0.20, _mapped = false) {
    const [mx, mz] = this.mapSkillXZ(x, z, _mapped);
    const light = new THREE.PointLight(new THREE.Color(color), intensity, distance * Math.max(1, this.getAoeScale()), 1.7);
    light.position.set(mx, y, mz);
    this.root.add(light);
    this.lights.push({ light, maxI: intensity, life, max: life });
    return light;
  }

  /** True 3D 6-Axis Starburst Glint */
  spawnStarGlint(x, y, z, size = 0.5, color = '#ffffff', life = 0.13, _mapped = false) {
    const [mx, mz] = this.mapSkillXZ(x, z, _mapped);
    const g = new THREE.Group();
    g.position.set(mx, y, mz);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(2.1),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const axes = [
      [size * 2.2, size * 0.14, size * 0.14],
      [size * 0.14, size * 2.2, size * 0.14],
      [size * 0.14, size * 0.14, size * 2.2],
    ];
    for (const sc of axes) {
      const bar = new THREE.Mesh(this._spikeBarGeo, mat);
      bar.scale.set(sc[0], sc[1], sc[2]);
      g.add(bar);
    }
    this.root.add(g);
    this.addCustom({
      group: g, life, max: life, _skipAutoMap: true,
      update(dt, k) {
        const s = ease.outBack(Math.min(1, (1 - k) * 4)) * k;
        g.scale.setScalar(Math.max(0.001, s));
        g.rotation.y += dt * 4.5;
        g.rotation.z += dt * 3.2;
        mat.opacity = k;
      },
      dispose() { mat.dispose(); },
    });
  }

  /** Sculpted 3D Status Marks ('weakness' curved feather blades, 'bleed' crimson slashes, 'frostRing' ankle frost) */
  spawnStatusMark(kind, targetPos, duration = 1.5) {
    const [tx, tz] = this.mapSkillXZ(targetPos.x, targetPos.z, Boolean(targetPos._isWorldScaled));
    targetPos = { x: tx, y: targetPos.y ?? 0, z: tz };
    const g = new THREE.Group();
    const mats = [], geos = [];
    if (kind === 'weakness') {
      // Sculpted 3D Valkyrie/Wind shattered feather blades orbiting above head!
      g.position.set(targetPos.x, 2.08, targetPos.z);
      const featherGeo = new THREE.OctahedronGeometry(1, 0);
      geos.push(featherGeo);
      for (let i = 0; i < 4; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(i % 2 === 0 ? '#ffe08a' : '#8ec5ff').multiplyScalar(1.75),
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        mats.push(mat);
        const m = new THREE.Mesh(featherGeo, mat);
        m.scale.set(0.04, 0.22, 0.08);
        const a = (i / 4) * TAU + 0.35;
        m.position.set(Math.cos(a) * 0.25, (i % 2) * 0.06, Math.sin(a) * 0.25);
        m.rotation.set(0.42, a, 0.32);
        g.add(m);
      }
    } else if (kind === 'bleed') {
      g.position.set(targetPos.x, 1.18, targetPos.z);
      const shardGeo = new THREE.OctahedronGeometry(1, 0);
      geos.push(shardGeo);
      for (const sgn of [-1, 1]) {
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#ff2947').multiplyScalar(1.95),
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        mats.push(mat);
        const m = new THREE.Mesh(shardGeo, mat);
        m.scale.set(0.45, 0.038, 0.038);
        m.position.set(0, 0, -0.30);
        m.rotation.z = sgn * 0.68;
        g.add(m);
      }
    } else if (kind === 'frostRing') {
      // Crisp 3D crystalline frost ring + slanted mini quartz shards around enemy ankles!
      g.position.set(targetPos.x, 0.05, targetPos.z);
      const torusGeo = new THREE.TorusGeometry(0.50, 0.028, 6, 32);
      torusGeo.rotateX(Math.PI / 2);
      geos.push(torusGeo);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#8ee2ff').multiplyScalar(1.5),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      mats.push(mat);
      g.add(new THREE.Mesh(torusGeo, mat));

      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const tMesh = new THREE.Mesh(this._crystalPrismGeo, mat);
        tMesh.scale.set(0.11, 0.22 + (i % 2) * 0.08, 0.11);
        tMesh.position.set(Math.cos(a) * 0.50, 0, Math.sin(a) * 0.50);
        tMesh.rotation.set(Math.sin(a) * 0.45, a, -Math.cos(a) * 0.45);
        g.add(tMesh);
      }
    }
    this.root.add(g);
    this.statusMarks.push({ g, mats, geos, kind, life: duration, max: duration });
  }

  addCustom(item) {
    const tgt = item.group || item.mesh;
    if (this._scaleCtx && !item._skipAutoMap) {
      const sc = this._scaleCtx;
      if (typeof item.applyDynamicScale === 'function') {
        if (item.beamHolder) item.applyDynamicScale(sc, (v) => this.mapSkillVec3(v));
        else item.applyDynamicScale(sc, (x, z) => this.mapSkillXZ(x, z, false));
      } else if (tgt) {
        const [mx, mz] = this.mapSkillXZ(tgt.position.x, tgt.position.z, false);
        tgt.position.set(mx, tgt.position.y, mz);
        if (item.maxRadius !== undefined) item.maxRadius *= sc.aoe;
        else if (item.r1 !== undefined) { item.r0 *= sc.aoe; item.r1 *= sc.aoe; }
        else if ('_aoeScaleMul' in item) item._aoeScaleMul = sc.aoe;
      }
    }
    if (FX_CONFIG.tier >= 4 && tgt) {
      if (item.implode !== undefined && item.duration >= 0.24) {
        this.airDistort.spawn({
          kind: item.implode ? 'implode' : 'shock',
          x: tgt.position.x, y: tgt.position.y, z: tgt.position.z,
          r0: Math.min(item.r0, item.r1), r1: Math.max(item.r0, item.r1),
          duration: item.duration * 0.92,
          strength: 0.72,
        });
      } else if (item.o && item.o.thickness >= 0.22 && item.duration >= 0.20) {
        const effR = item.outerHorn?.material?.uniforms?.uR?.value ?? item.o.radius;
        this.airDistort.spawn({
          kind: 'slash',
          x: tgt.position.x, y: tgt.position.y, z: tgt.position.z + effR * 0.45,
          r0: effR * 0.35, r1: effR * 0.92,
          duration: item.duration * 0.88,
          strength: 0.58,
          tiltX: item.o.tiltX || 0,
          tiltZ: item.o.tiltZ || 0,
        });
      }
    }
    if (item.group) {
      if (item.group.parent !== this.root) this.root.add(item.group);
    } else if (item.mesh) {
      this.root.add(item.mesh);
    }
    this.custom.push(item);
    return item;
  }

  update(dt, camera = null) {
    if (camera) this._lastCam = camera;
    const steps = Math.max(1, Math.ceil(Math.abs(dt) * 120 - 1e-6));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) this._step(h);
    this._syncVisuals();
  }

  _step(dt) {
    this._simTime += dt;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life -= dt;
      if (p.life <= 0) {
        this.root.remove(p.mesh);
        p.mat.dispose();
        this.sparks.splice(i, 1);
        continue;
      }
      if (p.streakIn) {
        p.vx += p.vx * 3.5 * dt; p.vy += p.vy * 3.5 * dt; p.vz += p.vz * 3.5 * dt;
      } else {
        p.vy -= p.gravity * dt;
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d; p.vy *= d; p.vz *= d;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (!p.streakIn && p.y <= 0.02 && p.vy < 0) {
        p.y = 0.02;
        p.vy = -p.vy * p.bounce;
        p.vx *= 0.72; p.vz *= 0.72;
      }
    }

    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life -= dt;
      if (p.life <= 0) {
        this.root.remove(p.mesh);
        p.mat.dispose();
        this.puffs.splice(i, 1);
        continue;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx += FX_CONFIG.windX * dt; p.vz += FX_CONFIG.windZ * dt;
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.mesh.rotation.x += p.rx * dt;
      p.mesh.rotation.y += p.ry * dt;
    }

    for (let i = this.flipbooks.length - 1; i >= 0; i--) {
      const fb = this.flipbooks[i];
      if (fb.delay > 0) { fb.delay -= dt; continue; }
      fb.life -= dt;
      if (fb.life <= 0) {
        this.root.remove(fb.mesh);
        fb.mat.dispose();
        this.flipbooks.splice(i, 1);
        continue;
      }
      const d = Math.max(0, 1 - fb.drag * dt);
      fb.vx += FX_CONFIG.windX * fb.windFactor * dt; fb.vz += FX_CONFIG.windZ * fb.windFactor * dt;
      fb.vx *= d; fb.vy *= d; fb.vz *= d;
      fb.x += fb.vx * dt; fb.y += fb.vy * dt; fb.z += fb.vz * dt;
      fb.rotY += fb.rotSpeed * dt;
    }

    for (let i = this.shards.length - 1; i >= 0; i--) {
      const b = this.shards[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.root.remove(b.mesh);
        b.mat.dispose();
        this.shards.splice(i, 1);
        continue;
      }
      if (!b.rest) {
        b.vy -= b.gravity * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        b.mesh.rotation.x += b.rx * dt;
        b.mesh.rotation.y += b.ry * dt;
        b.mesh.rotation.z += b.rz * dt;
        if (b.y <= 0.03 && b.vy < 0) {
          b.y = 0.03;
          if (Math.abs(b.vy) > 1.4 && b.bounce > 0) {
            b.vy = -b.vy * b.bounce; b.vx *= 0.65; b.vz *= 0.65;
          } else {
            b.rest = true; b.vx = b.vy = b.vz = 0;
          }
        }
        b.mesh.position.set(b.x, b.y, b.z);
      }
      b.mat.uniforms.uOpacity.value = Math.min(1, b.life / 0.14);
    }

    for (let i = this.fireRocks.length - 1; i >= 0; i--) {
      const fr = this.fireRocks[i];
      if (fr.delay > 0) {
        fr.delay -= dt;
        fr.mesh.visible = fr.delay <= 0;
        continue;
      }
      fr.mesh.visible = true;
      fr.life -= dt;
      if (fr.life <= 0) {
        this.root.remove(fr.mesh);
        fr.mat.dispose();
        this.fireRocks.splice(i, 1);
        continue;
      }
      const age = 1 - clamp(fr.life / fr.max);
      fr.mat.uniforms.uAge.value = age;
      fr.mat.uniforms.uOpacity.value = Math.min(1, fr.life / 0.18);

      if (!fr.rest) {
        fr.vy -= fr.gravity * dt;
        fr.x += fr.vx * dt; fr.y += fr.vy * dt; fr.z += fr.vz * dt;
        fr.mesh.rotation.x += fr.rx * dt;
        fr.mesh.rotation.y += fr.ry * dt;
        fr.mesh.rotation.z += fr.rz * dt;

        fr.trailTimer -= dt;
        if (fr.trailTimer <= 0 && fr.life > 0.16) {
          fr.trailTimer = 0.048;
          if (fr.emitSparks) {
            this.spawnSpark({
              x: fr.x + this.R.range(-0.04, 0.04),
              y: fr.y + this.R.range(-0.04, 0.04),
              z: fr.z + this.R.range(-0.04, 0.04),
              _mapped: true,
              vx: -fr.vx * 0.18 + this.R.range(-0.9, 0.9),
              vy: this.R.range(0.5, 2.2),
              vz: -fr.vz * 0.18 + this.R.range(-0.9, 0.9),
              life: this.R.range(0.14, 0.24),
              size: Math.max(0.036, fr.size * 0.20),
              stretch: 0.032,
              color: fr.sparkHex,
            });
          }
          if (fr.emitFlame) {
            this.spawnFlipbook({
              atlas: 'fbFlame', x: fr.x, y: fr.y + 0.06, z: fr.z, _mapped: true,
              vy: 0.65, life: 0.22, size0: fr.size * 1.6, size1: fr.size * 2.8,
              palette: fr.palette, hdr: 1.65,
            });
          }
        }

        const floorY = Math.max(0.04, fr.size * 0.36);
        if (fr.y <= floorY && fr.vy < 0) {
          fr.y = floorY;
          if (Math.abs(fr.vy) > 1.55 && fr.bounce > 0) {
            fr.vy = -fr.vy * fr.bounce;
            fr.vx *= 0.68; fr.vz *= 0.68;
            fr.rx *= 0.72; fr.ry *= 0.72; fr.rz *= 0.72;
            if (fr.emitSparks) {
              for (let s = 0; s < 3; s++) {
                const a = this.R.range(0, TAU), sp = this.R.range(1.6, 3.8);
                this.spawnSpark({
                  x: fr.x, y: floorY + 0.02, z: fr.z, _mapped: true,
                  vx: Math.cos(a) * sp, vy: this.R.range(1.2, 3.2), vz: Math.sin(a) * sp,
                  life: 0.18, size: 0.042, stretch: 0.03, color: fr.sparkHex,
                });
              }
            }
          } else {
            fr.rest = true;
            fr.vx = fr.vy = fr.vz = 0;
          }
        }
        fr.mesh.position.set(fr.x, fr.y, fr.z);
      }
    }

    for (let i = this.rockDebris.length - 1; i >= 0; i--) {
      const rb = this.rockDebris[i];
      if (rb.delay > 0) {
        rb.delay -= dt;
        rb.mesh.visible = rb.delay <= 0;
        continue;
      }
      rb.mesh.visible = true;
      rb.life -= dt;
      if (rb.life <= 0) {
        this.root.remove(rb.mesh);
        rb.mat.dispose();
        this.rockDebris.splice(i, 1);
        continue;
      }
      const age = 1 - clamp(rb.life / rb.max);
      rb.mat.uniforms.uAge.value = age;
      const sinkFrac = rb.life < 0.18 ? (1 - rb.life / 0.18) : 0;
      rb.mat.uniforms.uOpacity.value = 1 - sinkFrac;

      if (rb.squashTimer > 0) rb.squashTimer = Math.max(0, rb.squashTimer - dt);
      if (!rb.rest) {
        rb.vy -= 17.5 * dt;
        rb.x += rb.vx * dt;
        rb.y += rb.vy * dt;
        rb.z += rb.vz * dt;
        rb.mesh.rotation.x += rb.rx * dt;
        rb.mesh.rotation.y += rb.ry * dt;
        rb.mesh.rotation.z += rb.rz * dt;

        const floorY = Math.max(0.035, rb.size * 0.38);
        if (rb.y <= floorY && rb.vy < 0) {
          rb.y = floorY;
          if (Math.abs(rb.vy) > 1.35 && rb.bounces < 3) {
            rb.vy = -rb.vy * rb.bounce;
            rb.vx *= 0.68; rb.vz *= 0.68;
            rb.rx *= 0.68; rb.ry *= 0.68; rb.rz *= 0.68;
            rb.squashTimer = 0.15;
            if (rb.bounces === 0 && rb.life > 0.26 && FX_CONFIG.tier >= 3) {
              const pLife = Math.min(0.20, rb.life - 0.04);
              this.spawnPuff({
                x: rb.x, y: floorY + 0.03, z: rb.z, _mapped: true,
                vy: 0.45, life: pLife,
                size0: rb.size * 0.8, size1: rb.size * 2.1,
                color: rb.style === 'ice' ? '#bdeaff' : '#574e4a',
                alpha: 0.36, additive: rb.style === 'ice',
              });
            }
            rb.bounces++;
          } else {
            rb.rest = true;
            rb.vx = rb.vy = rb.vz = 0;
          }
        }
      }
      const spd = rb.rest ? 0 : Math.hypot(rb.vx, rb.vy, rb.vz);
      const [ssx, ssy, ssz] = computeSquashStretch3D(spd, rb.squashTimer);
      rb.mesh.scale.set(rb.bsx * ssx, rb.bsy * ssy, rb.bsz * ssz);
      rb.mesh.position.set(rb.x, rb.y - sinkFrac * rb.size * 0.9, rb.z);
    }

    for (let i = this.crystals.length - 1; i >= 0; i--) {
      const c = this.crystals[i];
      c.t += dt;
      const total = 0.1 + c.hold + c.melt;
      if (c.t >= total) {
        this.root.remove(c.mesh);
        c.mat.dispose();
        this.crystals.splice(i, 1);
        continue;
      }
      if (c.t < 0) { c.mesh.visible = false; continue; }
      c.mesh.visible = true;
      const grow = ease.outBack(clamp(c.t / 0.1), 2.2);
      const sink = smooth(0.1 + c.hold, total, c.t);
      const h = Math.max(0.001, c.height * grow * (1 - sink));
      const w = Math.max(0.001, c.width * (1 - sink * 0.35));
      c.mesh.scale.set(w, h, w);
      c.mat.uniforms.uFlash.value = clamp(1 - c.t / 0.045);
      c.mat.uniforms.uGlint.value = ((c.t * 0.9 + c.phase) % 1.4);
      c.mat.uniforms.uAlpha.value = 1 - sink * 0.85;
    }

    // Dynamic re-crackling angular 3D lightning bolts!
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.life <= 0) {
        while (b.group.children.length) {
          const ch = b.group.children[0];
          b.group.remove(ch);
          ch.geometry.dispose();
        }
        this.root.remove(b.group);
        b.mats.forEach((m) => m.dispose());
        this.bolts.splice(i, 1);
        continue;
      }
      b.rejagTimer -= dt;
      if (b.rejagTimer <= 0 && b.life > 0.04) {
        b.rejagTimer = 0.038;
        b.rebuild();
      }
      const k = b.life / b.max;
      b.mats[0].opacity = k;
      b.mats[1].opacity = k * 0.85;
      b.mats[2].opacity = k * 0.9;
    }

    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      l.life -= dt;
      if (l.life <= 0) {
        this.root.remove(l.light);
        this.lights.splice(i, 1);
        continue;
      }
      const k = l.life / l.max;
      l.light.intensity = l.maxI * k * k;
    }

    for (let i = this.statusMarks.length - 1; i >= 0; i--) {
      const sm = this.statusMarks[i];
      sm.life -= dt;
      if (sm.life <= 0) {
        this.root.remove(sm.g);
        sm.mats.forEach((m) => m.dispose());
        sm.geos.forEach((g) => g.dispose());
        this.statusMarks.splice(i, 1);
        continue;
      }
      const k = sm.life / sm.max;
      if (sm.kind === 'weakness') sm.g.rotation.y += dt * 2.2;
      if (sm.kind === 'frostRing') sm.g.rotation.y -= dt * 0.6;
      const a = Math.min(1, k * 3.5) * Math.min(1, (1 - k) * 12 + 0.2);
      sm.mats.forEach((m) => { m.opacity = a; });
    }

    for (let i = this.custom.length - 1; i >= 0; i--) {
      const c = this.custom[i];
      if (c.life !== undefined && c.max !== undefined) {
        c.life -= dt;
        const k = clamp(c.life / c.max);
        c.update?.(dt, k, this._lastCam);
        if (c.life <= 0) {
          if (c.group) this.root.remove(c.group);
          else if (c.mesh) this.root.remove(c.mesh);
          c.dispose?.();
          this.custom.splice(i, 1);
        }
      } else {
        c.update?.(dt, this._lastCam);
        if (c.done) {
          if (c.group) this.root.remove(c.group);
          else if (c.mesh) this.root.remove(c.mesh);
          c.dispose?.();
          this.custom.splice(i, 1);
        }
      }
    }
    this.niagara.step(dt, this.R, FX_CONFIG.windX, FX_CONFIG.windZ);
    this.gpuSparks.step(dt);
    this.airDistort.step(dt);
    this.traumaShake.step(dt);
  }

  _syncVisuals() {
    const xAxis = new THREE.Vector3(1, 0, 0);
    const dir = new THREE.Vector3();
    for (const p of this.sparks) {
      if (p.delay > 0) { p.mesh.visible = false; continue; }
      p.mesh.visible = true;
      const k = clamp(p.life / p.max);
      const sp = Math.hypot(p.vx, p.vy, p.vz) || 0.01;
      const len = Math.max(p.size, p.size + sp * p.stretch);
      p.mesh.position.set(p.x - (p.vx / sp) * len * 0.3, p.y - (p.vy / sp) * len * 0.3, p.z - (p.vz / sp) * len * 0.3);
      dir.set(p.vx / sp, p.vy / sp, p.vz / sp);
      p.mesh.quaternion.setFromUnitVectors(xAxis, dir);
      const thick = p.size * (0.48 + 0.52 * k);
      p.mesh.scale.set(len, thick, thick);

      const c = k > 0.68 ? new THREE.Color('#ffffff').lerp(p.baseColor, (1 - k) * 2.2) : p.baseColor.clone().multiplyScalar(0.65 + k * 0.85);
      p.mat.color.copy(c).multiplyScalar(1.65);
      p.mat.opacity = Math.min(1, k * 2.4);
    }

    for (const p of this.puffs) {
      if (p.delay > 0) { p.mesh.visible = false; continue; }
      p.mesh.visible = true;
      const age = 1 - clamp(p.life / p.max);
      p.mesh.position.set(p.x, p.y, p.z);
      const s = lerp(p.size0, p.size1, ease.outQuad(age));
      p.mesh.scale.set(s, s * 0.72, s);
      p.mat.uniforms.uAge.value = age;
      p.mat.uniforms.uOpacity.value = p.alpha * Math.min(1, age * 8) * Math.pow(1 - age, 1.35);
    }

    for (const fb of this.flipbooks) {
      if (fb.delay > 0) { fb.mesh.visible = false; continue; }
      fb.mesh.visible = true;
      const age = 1 - clamp(fb.life / fb.max);
      fb.mesh.position.set(fb.x, fb.y, fb.z);
      fb.mesh.rotation.y = fb.rotY;
      const s = lerp(fb.size0, fb.size1, ease.outQuad(age));
      fb.mesh.scale.setScalar(s);
      const elapsed = fb.max - fb.life;
      const frame = fb.loopFrames
        ? (fb.startFrame + elapsed * fb.fps) % 16
        : Math.min(15.99, age * 16.0);
      fb.mat.uniforms.uFrame.value = frame;
      fb.mat.uniforms.uAge.value = age;
      const env = Math.min(1, age * 10) * (1 - smooth(0.68, 1.0, age));
      fb.mat.uniforms.uOpacity.value = fb.opacity * env;
    }
    this.niagara.syncVisuals();
  }

  get activeFxCount() {
    return this.sparks.length + this.puffs.length + this.flipbooks.length + this.shards.length + this.fireRocks.length + this.rockDebris.length + this.crystals.length + this.bolts.length + this.custom.length + this.niagara.activeCount + this.gpuSparks.activeCount + this.airDistort.activeCount;
  }

  clear() {
    while (this.root.children.length) {
      this.root.remove(this.root.children[0]);
    }
    this.niagara.clear();
    this.gpuSparks.clear();
    this.airDistort.clear();
    this.traumaShake.clear();
    this.root.add(this.niagara.mesh);
    this.root.add(this.gpuSparks.mesh);
    this.sparks.length = 0;
    this.puffs.length = 0;
    this.flipbooks.length = 0;
    this.shards.length = 0;
    this.fireRocks.length = 0;
    for (const rb of this.rockDebris) rb.mat.dispose();
    this.rockDebris.length = 0;
    this.crystals.length = 0;
    this.bolts.length = 0;
    this.lights.length = 0;
    this.custom.length = 0;
    this.statusMarks.length = 0;
    this._simTime = 0;
  }
}

// ============================================================================
// 5. Crisp Tactical Floor Hitbox HUD + Orthogonal Dynamic AoE & Cast Distance Math
// ============================================================================
export function getMoveBaseRangeMul(mv) {
  if (!mv || mv.handlesDynamicScale || !mv.hitbox) return 1.0;
  if (mv.targetTeam === 'self') return 1.0;
  if (mv.cat === 'melee' || mv.cat === 'defense' || mv.cat === 'dash') return 1.0;
  const hb = mv.hitbox;
  if (mv.cat === 'leap_spell') {
    return (hb.kind === 'circle' && (hb.cz ?? 0) >= 2.2) ? 1.56 : 1.0;
  }
  if (hb.kind === 'circle' && (hb.cz ?? 0) >= 2.2) return 1.82;
  if (hb.kind === 'rect' && (hb.length ?? 0) >= 4.2) return 1.65;
  if (hb.kind === 'chain') return 1.68;
  return 1.0;
}

export function getEffectiveRangeScale(mv, userRange = FX_CONFIG.rangeScale) {
  if (mv) {
    const team = mv.targetTeam || mv.hitbox?.targetTeam || 'enemy';
    const isCenteredFriendly = mv.hitbox?.kind === 'circle'
      && Math.abs(mv.hitbox.cz ?? 0) < 0.35
      && (team === 'self' || team === 'party' || mv.isCelebration || mv.selfCentered);
    if (team === 'self' || mv.isCelebration || mv.selfCentered || isCenteredFriendly) {
      return 1.0;
    }
  }
  return getMoveBaseRangeMul(mv) * userRange;
}

export function getEffectiveMoveHitbox(mv) {
  if (!mv || !mv.hitbox) return null;
  return getScaledHitbox(mv.hitbox, FX_CONFIG.aoeScale, getEffectiveRangeScale(mv, FX_CONFIG.rangeScale));
}

export function mapHitboxPointXZ(hb, x, z, aoeS = FX_CONFIG.aoeScale, rangeS = FX_CONFIG.rangeScale) {
  if (!hb || (Math.abs(aoeS - 1) < 1e-4 && Math.abs(rangeS - 1) < 1e-4)) return [x, z];
  if (hb.kind === 'sector') {
    const r = Math.hypot(x, z);
    if (r < 0.22) return [x, z * Math.min(rangeS, 1.15)];
    const th = Math.atan2(x, z);
    const thS = clamp(th * aoeS, -Math.PI, Math.PI);
    const rS = r * rangeS;
    return [Math.sin(thS) * rS, Math.cos(thS) * rS];
  }
  if (hb.kind === 'rect' || hb.kind === 'chain') {
    return [x * aoeS, z > 0.24 ? z * rangeS : z];
  }
  if (hb.kind === 'circle') {
    const baseCz = hb.cz ?? 0;
    const baseCx = hb.cx ?? 0;
    if (Math.abs(baseCz) < 0.35) {
      const zShift = (rangeS - 1) * (hb.radius ?? 2.0) * 0.55;
      return [x * aoeS, z * aoeS + zShift];
    }
    const rTarget = (hb.radius ?? 2.0) * 1.18;
    if (Math.hypot(x - baseCx, z - baseCz) <= rTarget || z > Math.max(1.18, baseCz * 0.32)) {
      return [baseCx * aoeS + (x - baseCx) * aoeS, baseCz * rangeS + (z - baseCz) * aoeS];
    }
    return [x, z];
  }
  return [x * aoeS, z * rangeS];
}

export function getScaledHitbox(spec, aoeS = FX_CONFIG.aoeScale, rangeS = FX_CONFIG.rangeScale) {
  if (!spec || (Math.abs(aoeS - 1) < 1e-4 && Math.abs(rangeS - 1) < 1e-4)) return spec;
  if (spec.kind === 'sector') {
    return {
      ...spec,
      radius: +(spec.radius * rangeS).toFixed(3),
      compareRadius: spec.compareRadius ? +(spec.compareRadius * rangeS).toFixed(3) : undefined,
      angleDeg: +clamp(spec.angleDeg * aoeS, 18, 360).toFixed(2),
    };
  }
  if (spec.kind === 'circle') {
    const baseCz = spec.cz ?? 0;
    const cz = Math.abs(baseCz) < 0.35
      ? baseCz + (rangeS - 1) * (spec.radius ?? 2.0) * 0.55
      : baseCz * rangeS;
    return {
      ...spec,
      cx: +((spec.cx ?? 0) * aoeS).toFixed(3),
      cz: +cz.toFixed(3),
      radius: +(spec.radius * aoeS).toFixed(3),
    };
  }
  if (spec.kind === 'rect') {
    return {
      ...spec,
      width: +(spec.width * aoeS).toFixed(3),
      length: +(spec.length * rangeS).toFixed(3),
    };
  }
  if (spec.kind === 'chain') {
    return {
      ...spec,
      targets: spec.targets.map(([tx, tz]) => [+(tx * aoeS).toFixed(3), +(tz * rangeS).toFixed(3)]),
    };
  }
  return spec;
}

export function buildHitboxOverlay(rawSpec, mv = null) {
  const effRange = mv ? getEffectiveRangeScale(mv, FX_CONFIG.rangeScale) : FX_CONFIG.rangeScale;
  const spec = getScaledHitbox(rawSpec, FX_CONFIG.aoeScale, effRange);
  const team = rawSpec?.targetTeam || mv?.targetTeam || 'enemy';
  const group = new THREE.Group();
  group.position.y = 0.012;

  const teamPalette = mv?.isCelebration
    ? { line: 0xfacc15, fill: 0xfbbf24, sub: 0xfef08a, fillOp: 0.036 }
    : team === 'self'
      ? { line: 0x38bdf8, fill: 0x38bdf8, sub: 0xfacc15, fillOp: 0.042 }
      : team === 'ally'
        ? { line: 0x34d399, fill: 0x10b981, sub: 0x6ee7b7, fillOp: 0.045 }
        : team === 'party'
          ? { line: 0x10b981, fill: 0x34d399, sub: 0xfde047, fillOp: 0.040 }
          : { line: 0xff4d6d, fill: 0xff3355, sub: 0x5ea2ff, fillOp: 0.028 };

  const lineMat = new THREE.LineBasicMaterial({ color: teamPalette.line, transparent: true, opacity: 0.82 });
  const fillMat = new THREE.MeshBasicMaterial({
    color: teamPalette.fill, transparent: true, opacity: teamPalette.fillOp, side: THREE.DoubleSide, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -6,
  });
  const subLineMat = new THREE.LineBasicMaterial({ color: teamPalette.sub, transparent: true, opacity: 0.58 });

  const addSector = (r, deg, matL, matF) => {
    const half = (deg * Math.PI) / 360;
    const pts = [new THREE.Vector3(0, 0, 0)];
    const segs = 56;
    for (let i = 0; i <= segs; i++) {
      const a = -half + (half * 2 * i) / segs;
      pts.push(new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r));
    }
    pts.push(new THREE.Vector3(0, 0, 0));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matL));
    if (matF) {
      const pos = [];
      for (let i = 0; i < segs; i++) {
        const a0 = -half + (half * 2 * i) / segs, a1 = -half + (half * 2 * (i + 1)) / segs;
        pos.push(0, 0, 0, Math.sin(a0) * r, 0, Math.cos(a0) * r, Math.sin(a1) * r, 0, Math.cos(a1) * r);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      group.add(new THREE.Mesh(g, matF));
    }
  };

  const addCircle = (cx, cz, r, matL, matF) => {
    const pts = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * TAU;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matL));
    if (matF) {
      const g = new THREE.CircleGeometry(r, 56);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, matF);
      m.position.set(cx, 0, cz);
      group.add(m);
    }
  };

  if (spec.kind === 'sector') {
    addSector(spec.radius, spec.angleDeg, lineMat, fillMat);
    if (spec.compareRadius) addSector(spec.compareRadius, spec.angleDeg, subLineMat, null);
  } else if (spec.kind === 'circle') {
    addCircle(spec.cx ?? 0, spec.cz ?? 0, spec.radius, lineMat, fillMat);
    if ((team === 'ally' || team === 'party') && Math.hypot(spec.cx ?? 0, spec.cz ?? 0) > 0.6) {
      const tetherPts = [new THREE.Vector3(0, 0.008, 0), new THREE.Vector3(spec.cx ?? 0, 0.008, spec.cz ?? 0)];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tetherPts), subLineMat));
      addCircle(0, 0, 1.05, subLineMat, null);
    } else if (team === 'self') {
      addCircle(spec.cx ?? 0, spec.cz ?? 0, spec.radius * 0.68, subLineMat, null);
    }
  } else if (spec.kind === 'rect') {
    const hw = spec.width / 2, len = spec.length;
    const pts = [
      new THREE.Vector3(-hw, 0, 0), new THREE.Vector3(hw, 0, 0),
      new THREE.Vector3(hw, 0, len), new THREE.Vector3(-hw, 0, len),
      new THREE.Vector3(-hw, 0, 0),
    ];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    const g = new THREE.PlaneGeometry(spec.width, len);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, fillMat);
    m.position.set(0, 0, len / 2);
    group.add(m);
  } else if (spec.kind === 'chain') {
    let prev = new THREE.Vector3(0, 0.008, 0);
    for (const [tx, tz] of spec.targets) {
      addCircle(tx, tz, team === 'party' || team === 'ally' ? 0.82 : 0.55, lineMat, fillMat);
      if (team === 'party' || team === 'ally') {
        const cur = new THREE.Vector3(tx, 0.008, tz);
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([prev, cur]), subLineMat));
        prev = cur;
      }
    }
  }
  return group;
}
