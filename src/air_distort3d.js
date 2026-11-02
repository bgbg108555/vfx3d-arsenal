import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { getTexLib, FX_CONFIG } from './texgen3d.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Manages 3D refractive air-distortion volumes (shockwaves, rising heat-haze over burning ground,
 * gravity implosion lenses, and high-speed blade air-ripples) rendered into a half-res normal/mask buffer.
 */
export class AirDistortionManager3D {
  constructor() {
    this.scene = new THREE.Scene();
    this.items = [];
    this._sphereGeo = new THREE.SphereGeometry(1, 32, 20);
    this._torusGeo = new THREE.TorusGeometry(0.86, 0.20, 12, 48);
    this._torusGeo.rotateX(Math.PI / 2);
    this._cylGeo = new THREE.CylinderGeometry(0.92, 1.0, 1.0, 28, 8, true);
    this._cylGeo.translate(0, 0.5, 0);
  }

  spawn({
    kind = 'shock',   // 'shock' | 'heat' | 'implode' | 'slash'
    x = 0, y = 0.8, z = 0,
    r0 = 0.25, r1 = 2.6,
    height = 1.8,
    duration = 0.42,
    strength = 0.85,
    delay = 0,
    tiltX = 0, tiltZ = 0,
  } = {}) {
    if (FX_CONFIG.tier <= 2) return;
    const tierMul = FX_CONFIG.tier >= 4 ? 1.0 : 0.42;
    const lib = getTexLib();

    const geo = kind === 'heat'
      ? this._cylGeo
      : (kind === 'torus' || kind === 'slash')
        ? this._torusGeo
        : this._sphereGeo;

    const isHeat = kind === 'heat' ? 1.0 : 0.0;
    const signDir = kind === 'implode' ? -1.0 : 1.0;

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uAge: { value: 0 },
        uStrength: { value: clamp(strength * tierMul, 0, 1.0) },
        uIsHeat: { value: isHeat },
        uSign: { value: signDir },
        uNoiseTex: { value: lib.flowNoise },
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
        uniform float uTime, uAge, uStrength, uIsHeat, uSign;
        uniform sampler2D uNoiseTex;

        void main() {
          vec3 N = normalize(vNormView);
          vec3 V = normalize(vViewDir);
          float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);

          if (uIsHeat > 0.5) {
            // Turbulent convection shimmer rising above burning ground
            vec4 n1 = texture2D(uNoiseTex, vec2(vUv.x * 3.0 + uTime * 0.25, vUv.y * 2.4 - uTime * 2.6));
            vec4 n2 = texture2D(uNoiseTex, vec2(vUv.x * 5.0 - uTime * 0.35, vUv.y * 3.8 - uTime * 3.9));
            vec2 turb = (n1.rg + n2.rg - 1.0);
            float vEnv = sin(clamp(vUv.y, 0.0, 1.0) * 3.14159265);
            float lifeEnv = smoothstep(0.0, 0.12, uAge) * (1.0 - smoothstep(0.75, 1.0, uAge));
            float radialEnv = pow(ndv, 1.15);
            float mask = clamp(vEnv * radialEnv * lifeEnv * uStrength, 0.0, 1.0);
            if (mask < 0.01) discard;
            vec2 enc = clamp(vec2(0.5019608) + turb * 0.42, 0.0, 1.0);
            gl_FragColor = vec4(enc.x, enc.y, mask, mask);
          } else {
            // Crisp Fresnel refractive shockwave / implosion lens
            vec4 nz = texture2D(uNoiseTex, vUv * 2.5 + vec2(uTime * 0.6, -uTime * 1.1));
            float rim = pow(1.0 - ndv, 1.55) * smoothstep(0.0, 0.22, 1.0 - ndv);
            float fade = 1.0 - smoothstep(0.35, 1.0, uAge);
            float mask = clamp(rim * fade * uStrength * (0.78 + 0.38 * nz.r), 0.0, 1.0);
            if (mask < 0.01) discard;
            vec2 dirXY = N.xy * uSign + (nz.rg - 0.5) * 0.32;
            vec2 enc = clamp(vec2(0.5019608) + dirXY * 0.48, 0.0, 1.0);
            gl_FragColor = vec4(enc.x, enc.y, mask, mask);
          }
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(tiltX, 0, tiltZ);
    mesh.visible = delay <= 0;
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    this.items.push({
      mesh, mat, kind, r0, r1, height,
      t: -delay, duration: Math.max(0.05, duration),
    });
  }

  step(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (it.t >= it.duration) {
        this.scene.remove(it.mesh);
        it.mat.dispose();
        this.items.splice(i, 1);
        continue;
      }
      if (it.t < 0) {
        it.mesh.visible = false;
        continue;
      }
      it.mesh.visible = true;
      const u = clamp(it.t / it.duration);
      it.mat.uniforms.uTime.value = it.t;
      it.mat.uniforms.uAge.value = u;

      if (it.kind === 'heat') {
        it.mesh.scale.set(it.r1, it.height, it.r1);
      } else if (it.kind === 'implode') {
        const s = lerp(it.r1, it.r0, Math.pow(u, 0.72));
        it.mesh.scale.setScalar(Math.max(0.05, s));
      } else {
        const easeOut = 1 - Math.pow(1 - u, 2.6);
        const s = lerp(it.r0, it.r1, easeOut);
        it.mesh.scale.setScalar(Math.max(0.05, s));
      }
    }
  }

  get activeCount() {
    return this.items.length;
  }

  clear() {
    for (const it of this.items) {
      this.scene.remove(it.mesh);
      it.mat.dispose();
    }
    this.items.length = 0;
  }
}

/**
 * Post-processing EffectComposer Pass that refracts the rendered 3D scene using AirDistortionManager3D.
 */
export class AirDistortionPass extends Pass {
  constructor(distortMgr, camera, width = 800, height = 600) {
    super();
    this.distortMgr = distortMgr;
    this.camera = camera;
    this.rt = new THREE.WebGLRenderTarget(
      Math.max(2, Math.floor(width * 0.5)),
      Math.max(2, Math.floor(height * 0.5)),
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: false,
      }
    );
    this._neutralClear = new THREE.Color(128 / 255, 128 / 255, 0);
    this._savedClear = new THREE.Color();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDistort: { value: this.rt.texture },
        uGlobalStrength: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDistort;
        uniform float uGlobalStrength;
        varying vec2 vUv;

        void main() {
          if (uGlobalStrength <= 0.001) {
            gl_FragColor = texture2D(tDiffuse, vUv);
            return;
          }
          vec4 d = texture2D(tDistort, vUv);
          float mask = d.b * uGlobalStrength;
          if (mask < 0.003) {
            gl_FragColor = texture2D(tDiffuse, vUv);
            return;
          }
          vec2 dir = (d.rg - vec2(0.5019608)) * 2.0;
          vec2 off = dir * mask * 0.042;

          // 3-channel refractive chromatic dispersion + Schlieren shock edge highlight
          float r = texture2D(tDiffuse, clamp(vUv + off * 1.25, 0.002, 0.998)).r;
          float g = texture2D(tDiffuse, clamp(vUv + off,        0.002, 0.998)).g;
          float b = texture2D(tDiffuse, clamp(vUv + off * 0.75, 0.002, 0.998)).b;
          float a = texture2D(tDiffuse, vUv).a;

          vec3 col = vec3(r, g, b);
          float schlieren = pow(clamp(length(dir) * d.b, 0.0, 1.0), 1.65) * uGlobalStrength * 0.16;
          col += vec3(0.82, 0.92, 1.0) * schlieren;
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    this._fsQuad = new FullScreenQuad(this.material);
  }

  setSize(width, height) {
    this.rt.setSize(Math.max(2, Math.floor(width * 0.5)), Math.max(2, Math.floor(height * 0.5)));
  }

  render(renderer, writeBuffer, readBuffer) {
    const active = FX_CONFIG.tier >= 3 && this.distortMgr.activeCount > 0;
    this.material.uniforms.uGlobalStrength.value = !active ? 0.0 : (FX_CONFIG.tier >= 4 ? 1.05 : 0.45);

    if (active) {
      const prevTarget = renderer.getRenderTarget();
      renderer.getClearColor(this._savedClear);
      const prevAlpha = renderer.getClearAlpha();
      const prevAutoClear = renderer.autoClear;

      renderer.autoClear = true;
      renderer.setRenderTarget(this.rt);
      renderer.setClearColor(this._neutralClear, 1.0);
      renderer.clear(true, false, false);
      renderer.render(this.distortMgr.scene, this.camera);

      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(this._savedClear, prevAlpha);
      renderer.autoClear = prevAutoClear;
    }

    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this._fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this._fsQuad.render(renderer);
    }
  }

  dispose() {
    this.rt.dispose();
    this.material.dispose();
    this._fsQuad.dispose();
  }
}
