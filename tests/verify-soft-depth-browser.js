// Real-WebGL regression fixture: exercise the same flipbook shader as the editor.
import * as THREE from 'three';
import { Sim3D, PAL3D } from '../src/core3d.js';

const output = document.getElementById('result');
try {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(64, 64);
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.12, 165);
  camera.position.set(0, 1, 4);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();

  const surface = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0x080808 }));
  surface.position.y = 1;
  scene.add(surface);
  const depthTarget = new THREE.WebGLRenderTarget(64, 64, { depthBuffer: true, stencilBuffer: false });
  depthTarget.depthTexture = new THREE.DepthTexture(64, 64, THREE.UnsignedIntType);
  const colorTarget = new THREE.WebGLRenderTarget(64, 64);
  const depthMaterial = new THREE.MeshDepthMaterial();
  const sim = new Sim3D(scene, 7);
  sim.setSoftDepthResources(depthTarget.depthTexture, new THREE.Vector2(64, 64), camera.near, camera.far);
  sim.spawnFlipbook({ emitMicro: false, palette: PAL3D.fireInferno });
  sim.root.visible = false;
  const material = sim.flipbooks[0].mat;
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  material.uniforms.uTex.value = white;
  material.uniforms.uNoiseTex.value = white;
  material.uniforms.uErodeTex.value = white;
  const particle = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), material);
  particle.position.set(0, 1, 0.08);
  scene.add(particle);

  function captureDepth() {
    particle.visible = false;
    scene.overrideMaterial = depthMaterial;
    renderer.setRenderTarget(depthTarget);
    renderer.clear();
    renderer.render(scene, camera);
    particle.visible = true;
    scene.overrideMaterial = null;
  }
  function sample(enabled) {
    sim.setSoftDepthEnabled(enabled);
    renderer.setRenderTarget(colorTarget);
    renderer.clear();
    renderer.render(scene, camera);
    const rgba = new Uint8Array(4);
    renderer.readRenderTargetPixels(colorTarget, 32, 32, 1, 1, rgba);
    return [...rgba];
  }
  captureDepth();
  const off = sample(false);
  const close = sample(true);
  surface.position.z = -1;
  captureDepth();
  const far = sample(true);
  const sum = (rgba) => rgba[0] + rgba[1] + rgba[2];
  const ok = sum(off) - sum(close) > 60 && Math.abs(sum(off) - sum(far)) < 12;
  output.textContent = `${ok ? 'PASS' : 'FAIL'} depth fade: off=${off.join(',')} close=${close.join(',')} far=${far.join(',')}`;
  document.title = ok ? 'DEPTH_TEST_PASS' : 'DEPTH_TEST_FAIL';
} catch (error) {
  output.textContent = `FAIL depth fade: ${error.stack || error}`;
  document.title = 'DEPTH_TEST_FAIL';
}
