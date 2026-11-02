import * as THREE from 'three';
import { getTexLib } from './texgen3d.js';

// Fine, translucent pressure condensation. Geometry supplies the silhouette;
// the mask breaks up its edges instead of rendering a solid coloured cone.
export function makeVaporMaterial(color, ring = false) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: {
      uColor: { value: color.clone().lerp(new THREE.Color(0xdceeff), 0.64) },
      uNoise: { value: getTexLib().erosionNoise },
      uOpacity: { value: 0 }, uTime: { value: 0 }, uRing: { value: ring ? 1 : 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView, vViewDir;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormalView, vViewDir;
      uniform sampler2D uNoise;
      uniform vec3 uColor;
      uniform float uOpacity, uTime, uRing;
      void main() {
        vec2 flow = uRing > 0.5 ? vUv * 5.0 : vUv * vec2(5.0, 2.6);
        vec4 n = texture2D(uNoise, flow + vec2(uTime * 0.22, -uTime * 0.38));
        vec4 detail = texture2D(uNoise, flow * 2.1 + vec2(-uTime * 0.38, uTime * 0.27));
        float mask;
        if (uRing > 0.5) {
          float r = length(vUv - 0.5) * 2.0;
          mask = smoothstep(0.80, 0.88, r) * (1.0 - smoothstep(0.92, 1.0, r));
        } else {
          float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
          float rim = pow(1.0 - clamp(ndv, 0.0, 1.0), 1.8);
          mask = sin(clamp(vUv.y, 0.0, 1.0) * 3.14159265) * (0.15 + 0.85 * rim);
        }
        float wisps = smoothstep(0.30, 0.72, n.r * 0.65 + detail.g * 0.35);
        float alpha = uOpacity * mask * (0.22 + wisps * 0.78);
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(uColor * (0.64 + 0.36 * detail.b), alpha);
      }
    `,
  });
}
