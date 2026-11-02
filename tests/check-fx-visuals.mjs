import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RibbonTrail3D, Sim3D, PAL3D, Rng, ShockSphere3D } from '../src/core3d.js';
import { NiagaraMicroPool3D } from '../src/niagara3d.js';
import { GpuSparkPool3D } from '../src/gpu_sparks3d.js';
import { Fighter3D, DummyTarget3D } from '../src/actors3d.js';
import { MOVES_3D } from '../src/moves3d.js';
import { resolveFlipbookTex } from '../src/texgen3d.js';
import { bakeAnimatedMoveToGLB } from '../src/vfx_exporter3d.js';
import { sampleMeshSurface } from '../src/surface_emit3d.js';

// A posed bone must move sampled positions with its skinned triangle.
const skinGeometry = new THREE.BufferGeometry();
skinGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
skinGeometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0,0,0,0, 0,0,0,0, 0,0,0,0], 4));
skinGeometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1,0,0,0, 1,0,0,0, 1,0,0,0], 4));
const skinned = new THREE.SkinnedMesh(skinGeometry, new THREE.MeshBasicMaterial());
const bone = new THREE.Bone();
skinned.add(bone);
skinned.bind(new THREE.Skeleton([bone]));
bone.position.x = 2;
const sampled = sampleMeshSurface(skinned, new Rng(7), 20);
assert.equal(sampled.length, 20);
assert.ok(sampled.every((point) => point.x >= 2 && point.x <= 3 && point.y >= 0 && point.y <= 1), 'samples must follow the posed bone');
skinGeometry.dispose();
skinned.material.dispose();

// A growing trail should use the whole texture and taper to its current tail,
// rather than drawing duplicate geometry until the point buffer fills.
const ribbon = new RibbonTrail3D({ maxPoints: 12, width: 0.2, palette: PAL3D.mageArcane });
for (let i = 0; i < 4; i++) ribbon.pushPoint(new THREE.Vector3(i, 1, 0));
const verticesPerRing = ribbon.sides + 1;
const tail = ribbon.pts.length - 1;
assert.equal(ribbon.geo.drawRange.count, tail * ribbon.sides * 6);
assert.equal(ribbon.geo.attributes.uv.getX(tail * verticesPerRing), 1);
for (let j = 0; j < verticesPerRing; j++) {
  const index = tail * verticesPerRing + j;
  assert.ok(Math.abs(ribbon.geo.attributes.position.getX(index)) < 1e-6);
  assert.ok(Math.abs(ribbon.geo.attributes.position.getY(index) - 1) < 1e-6);
  assert.ok(Math.abs(ribbon.geo.attributes.position.getZ(index)) < 1e-6);
}
const unused = (ribbon.maxPoints - 1) * verticesPerRing;
assert.ok(Math.abs(ribbon.geo.attributes.position.getY(unused) - 1) < 1e-6, 'unused rings must collapse to the tail for export');
ribbon.dispose();

// The GPU pool must remain bounded, release expired slots and support reuse.
const gpu = new GpuSparkPool3D(new THREE.Group(), 4);
const rng = new Rng(11);
assert.equal(gpu.spawnBurst(rng, { count: 6, life: 0.3, palette: PAL3D.fireInferno }), 4);
assert.equal(gpu.activeCount, 4);
gpu.step(0.4);
assert.equal(gpu.activeCount, 0);
assert.equal(gpu.geometry.instanceCount, 0);
assert.equal(gpu.spawnBurst(rng, { count: 2, life: 0.3, palette: PAL3D.fireInferno }), 2);
gpu.step(0.05);
assert.ok(gpu.sampleSlot([...gpu.activeSlots][0])?.position.every(Number.isFinite), 'GPU trajectory must be sampleable for export');
gpu.clear();
assert.equal(gpu.activeCount, 0);

const windyGpu = new GpuSparkPool3D(new THREE.Group(), 2);
const stillGpu = new GpuSparkPool3D(new THREE.Group(), 2);
windyGpu.spawnBurst(new Rng(33), { count: 1, life: 1, palette: PAL3D.fireInferno, windX: 2 });
stillGpu.spawnBurst(new Rng(33), { count: 1, life: 1, palette: PAL3D.fireInferno });
windyGpu.step(0.2); stillGpu.step(0.2);
assert.ok(windyGpu.sampleSlot(0).position[0] > stillGpu.sampleSlot(0).position[0], 'wind must alter GPU spark trajectories');

// Depth-fade state follows the toggle for both active and newly spawned flipbooks.
const softSim = new Sim3D(new THREE.Scene(), 7);
const sceneDepth = new THREE.DepthTexture(320, 240);
const depthViewport = new THREE.Vector2(320, 240);
softSim.setSoftDepthResources(sceneDepth, depthViewport, 0.12, 165);
softSim.spawnFlipbook({ emitMicro: false });
assert.equal(softSim.flipbooks[0].mat.uniforms.uSoftDepth.value, 0);
softSim.setSoftDepthEnabled(true);
assert.equal(softSim.flipbooks[0].mat.uniforms.uSoftDepth.value, 1);
softSim.spawnFlipbook({ emitMicro: false });
assert.equal(softSim.flipbooks[1].mat.uniforms.uSoftDepth.value, 1);
assert.equal(softSim.flipbooks[1].mat.uniforms.uSceneDepth.value, sceneDepth);
depthViewport.set(640, 480);
assert.equal(softSim.flipbooks[0].mat.uniforms.uDepthResolution.value.x, 640);
softSim.setSoftDepthEnabled(false);
assert.ok(softSim.flipbooks.every((item) => item.mat.uniforms.uSoftDepth.value === 0));
softSim.clear();

// Hot particles cool, and a first ground collision emits bounded child sparks.
const cpu = new NiagaraMicroPool3D(new THREE.Group(), 12);
cpu.spawnBurst(rng, {
  count: 1, palette: PAL3D.fireInferno, life0: 1, life1: 1,
  temperature: 1, temperatureDecay: 2.4, buoyancy: 3.5, collisionSparkCount: 2,
});
const parent = cpu.items[0];
parent.y = 0.03;
parent.vy = -3;
cpu.step(0.02, rng);
assert.ok(parent.temperature < 1, 'hot particles must cool');
assert.equal(cpu.items.length, 3, 'ground collision must emit two child sparks');
assert.ok(cpu.items.slice(1).every((item) => item.collisionSparkCount === 0), 'child sparks must not recursively spawn');
cpu.clear();
cpu.spawnBurst(rng, { count: 1, palette: PAL3D.fireInferno, life0: 1, life1: 1, drag: 0, gravity: 0, curl: 0, windFactor: 1 });
const initialVx = cpu.items[0].vx;
cpu.step(0.1, rng, 2, 0);
assert.ok(cpu.items[0].vx > initialVx, 'wind must affect opted-in CPU particles');
cpu.clear();
cpu.spawnBurst(rng, { count: 1, palette: PAL3D.fireInferno, life0: 1, life1: 1, drag: 0, gravity: 0, curl: 0, bounce: 1, collisionFields: [{ type: 'sphere', x: 0, y: 1, z: 0, radius: 1 }] });
Object.assign(cpu.items[0], { x: -2, y: 1, z: 0, vx: 8, vy: 0, vz: 0 });
cpu.step(0.5, rng);
assert.ok(cpu.items[0].x < -1 && cpu.items[0].vx < 0, 'swept sphere field must prevent tunnelling and reflect incoming particles');
cpu.clear();
cpu.spawnBurst(rng, { count: 1, x: 1, z: 3, palette: PAL3D.fireInferno, vortex: 5, vortexCenter: [1, 3], life0: 1, life1: 1 });
cpu.step(0.1, rng);
assert.ok(['x', 'y', 'z', 'vx', 'vy', 'vz'].every((key) => Number.isFinite(cpu.items[0][key])), 'two-coordinate vortex centers must not produce NaN particles');
cpu.clear();

for (const [id, flightTime, effect] of [
  ['px_moves_arrow_shot', 0.22, 'arrow'],
  ['px_fire_fireball', 0.24, 'fire'],
  ['px_projectiles_plasma_shot', 0.24, 'lightning'],
]) {
  const scene = new THREE.Scene();
  const sim = new Sim3D(scene, 7);
  const fighter = new Fighter3D(scene);
  const dummies = [0, 1, 2].map((i) => new DummyTarget3D(scene, i - 1, 3.6));
  const move = MOVES_3D.find((item) => item.id === id);
  assert.ok(move, `missing ${id}`);
  sim.setDynamicScaleContext(move, move.duration);
  move.setup(fighter, dummies, null, []);
  let hits = 0;
  for (const dummy of dummies) {
    const hit = dummy.hit.bind(dummy);
    dummy.hit = (...args) => { hits++; return hit(...args); };
  }
  const targetBursts = [];
  const spawn = sim.spawnNiagaraBurst.bind(sim);
  sim.spawnNiagaraBurst = (options) => {
    if (Math.abs(options.z - 3.6) < 1e-6 && options.count === 46) targetBursts.push(options);
    return spawn(options);
  };
  const release = move.buildEvents(sim, fighter, dummies, 7, null, 'auto', []).find((event) => event.t === 0.36);
  fighter.applyPose(fighter.sampleKeyframes(move.keyframes, release.t));
  release.run();
  assert.equal(targetBursts.length, 0, `${id}: impact particles appeared at release`);
  sim.update(flightTime * 0.5);
  assert.equal(hits, 0, `${id}: target hit before arrival`);
  assert.equal(targetBursts.length, 0, `${id}: impact particles appeared during flight`);
  if (effect === 'fire') {
    assert.ok(sim.flipbooks.some((item) => item.mat.uniforms.uTex.value === resolveFlipbookTex('fbFlame')), 'fire projectile must leave a flame wake');
  }
  sim.update(flightTime * 0.5);
  assert.equal(targetBursts.length, 1, `${id}: one impact burst must follow arrival`);
  assert.ok(hits > 0, `${id}: target should be hit on impact`);
  if (effect === 'lightning') assert.ok(sim.bolts.length >= 2, 'plasma impact must spawn electrical branches');
  if (effect === 'arrow') {
    assert.ok(!sim.custom.some((item) => item instanceof ShockSphere3D), 'physical arrows should not create a spherical energy shield');
    assert.ok(!sim.flipbooks.some((item) => item.mat.uniforms.uTex.value === resolveFlipbookTex('fbHitBurst')), 'physical arrow impacts should use sparks instead of a swirling impact orb');
  }
  if (effect === 'fire') assert.ok(!sim.custom.some((item) => item instanceof ShockSphere3D), 'fire impacts should use the explosion and heat distortion instead of a spherical shield');
  sim.clear();
}

const fireball = MOVES_3D.find((item) => item.id === 'px_moves_fireball_throw');
const baked = bakeAnimatedMoveToGLB(fireball, { fps: 12, includeActors: false, maxInstancesPerPool: 4 });
const view = new DataView(baked.glbBytes.buffer, baked.glbBytes.byteOffset, baked.glbBytes.byteLength);
const jsonSize = view.getUint32(12, true);
const gltf = JSON.parse(new TextDecoder().decode(baked.glbBytes.subarray(20, 20 + jsonSize)));
for (const node of gltf.nodes) {
  for (const key of ['translation', 'rotation', 'scale', 'matrix']) {
    if (node[key]) assert.ok(node[key].every(Number.isFinite), `${node.name}: invalid ${key}`);
  }
}
const binStart = 20 + jsonSize + 8;
const dimensions = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
for (const accessor of gltf.accessors) {
  if (accessor.componentType !== 5126 || accessor.bufferView === undefined) continue;
  const bufferView = gltf.bufferViews[accessor.bufferView];
  const components = dimensions[accessor.type];
  assert.ok(components, `unsupported float accessor type: ${accessor.type}`);
  const stride = bufferView.byteStride || components * 4;
  const start = binStart + (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  for (let item = 0; item < accessor.count; item++) {
    for (let component = 0; component < components; component++) {
      assert.ok(Number.isFinite(view.getFloat32(start + item * stride + component * 4, true)), 'GLB contains non-finite float data');
    }
  }
}
const gpuNode = gltf.nodes.findIndex((node) => node.name?.startsWith('GpuImpactSpark_'));
assert.ok(gpuNode >= 0, 'GLB must include sampled GPU impact sparks');
assert.ok(gltf.nodes.filter((node) => node.name?.startsWith('GpuImpactSpark_')).length <= 4, 'GPU spark export must respect the per-pool limit across the whole animation');
assert.ok(gltf.animations[0].channels.some((channel) => channel.target.node === gpuNode && channel.target.path === 'translation'), 'GPU spark must have an animated trajectory');

console.log('PASS trail taper, fire wake, impact timing, GPU sparks and GLB baking');
