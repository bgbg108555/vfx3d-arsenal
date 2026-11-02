import * as THREE from 'three';
import { makeSculptedTexturedPropMaterial } from './niagara3d.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;

// ============================================================================
// #27 Seeded Noise: Mulberry32 PRNG + Multi-Octave 1D Smooth Value Noise
// (Deterministic across replays; NEVER calls Math.random!)
// ============================================================================
export function mulberry32(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashInt(n, seed = 1337) {
  let x = ((n | 0) * 374761393 + (seed | 0) * 668265263) | 0;
  x = (x ^ (x >>> 13)) | 0;
  x = Math.imul(x, 1274126177);
  return (((x ^ (x >>> 16)) >>> 0) / 4294967296) * 2 - 1; // [-1, 1]
}

export function smoothNoise1D(x, seed = 1337) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hashInt(i, seed), hashInt(i + 1, seed), u);
}

export function fbm1D(x, seed = 1337, octaves = 3) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1.0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * smoothNoise1D(x * freq, seed + o * 97);
    norm += amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum / Math.max(1e-5, norm);
}

// ============================================================================
// #12 Screen Shake: Trauma-Squared (trauma^2) * Smooth Multi-Octave Noise
// Light hits barely nudge; heavy hits punch hard; zero raw-random frame jitter!
// ============================================================================
export class TraumaCameraShake3D {
  constructor(seed = 7) {
    this.seed = seed;
    this.trauma = 0;
    this.time = 0;
    this.enabled = true;
    this.maxPosOffset = 0.24;
    this.maxRollRad = 0.032;
    this._savedPos = new THREE.Vector3();
    this._savedQuat = new THREE.Quaternion();
    this._applied = false;
  }

  add(amount = 0.35) {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  clear() {
    this.trauma = 0;
    this.time = 0;
  }

  step(dt) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - 1.18 * dt);
  }

  apply(camera) {
    this._applied = false;
    if (!this.enabled || this.trauma <= 0.002 || !camera) return;
    const shake = this.trauma * this.trauma; // trauma^2!
    const t = this.time * 24.0;
    const nx = fbm1D(t, this.seed + 11, 3);
    const ny = fbm1D(t + 31.7, this.seed + 29, 3);
    const nr = fbm1D(t + 73.1, this.seed + 53, 3);

    this._savedPos.copy(camera.position);
    this._savedQuat.copy(camera.quaternion);
    this._applied = true;

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

    camera.position.addScaledVector(right, nx * this.maxPosOffset * shake);
    camera.position.addScaledVector(up, ny * this.maxPosOffset * shake);
    const qRoll = new THREE.Quaternion().setFromAxisAngle(fwd, nr * this.maxRollRad * shake);
    camera.quaternion.premultiply(qRoll);
    camera.updateMatrixWorld(true);
  }

  restore(camera) {
    if (!this._applied || !camera) return;
    camera.position.copy(this._savedPos);
    camera.quaternion.copy(this._savedQuat);
    camera.updateMatrixWorld(true);
    this._applied = false;
  }
}

// ============================================================================
// #13 Squash & Stretch: Volume-Preserving 3D Scale (sx * sy * sz == 1)
// Stretches up to ~1.3x along speed; squashes to ~0.68x on landing & eases back in 0.15s
// ============================================================================
export function computeSquashStretch3D(speed, squashTimer = 0) {
  if (squashTimer > 0) {
    // 0.15s landing squash recovery: 0.68 -> 1.0
    const u = 1 - clamp(squashTimer / 0.15, 0, 1);
    const easeBack = 1 - Math.pow(1 - u, 3);
    const sy = lerp(0.68, 1.0, easeBack);
    const inv = 1 / Math.sqrt(Math.max(0.25, sy));
    return [inv, sy, inv];
  }
  const stretch = 1 + clamp(speed / 18.0, 0, 0.30);
  const perp = 1 / Math.sqrt(stretch);
  return [perp, stretch, perp];
}

// ============================================================================
// #07 Quaternions: Shortest-Arc Spherical Linear Interpolation (dot < 0 negate!)
// ============================================================================
const _qTmp = new THREE.Quaternion();
export function slerpShortestQuat(qCurrent, qTarget, alpha) {
  _qTmp.copy(qTarget);
  if (qCurrent.dot(_qTmp) < 0) {
    _qTmp.set(-_qTmp.x, -_qTmp.y, -_qTmp.z, -_qTmp.w);
  }
  qCurrent.slerp(_qTmp, clamp(alpha, 0, 1));
  return qCurrent;
}

// ============================================================================
// #01 Raycasting, #02 Surface Normals & #26 Swept Segment Anti-Tunneling CCD
// Tests full swept segment [p0 -> p1] against sphere/cylinder hurtboxes & planes!
// ============================================================================
export function sweptSegmentSphereHit(p0, p1, center, radius) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
  const fx = p0.x - center.x, fy = p0.y - center.y, fz = p0.z - center.z;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-9) return null;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const c = fx * fx + fy * fy + fz * fz - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < 0 || t > 1) {
    t = (-b + sq) / (2 * a);
    if (t < 0 || t > 1) return null;
  }
  const point = new THREE.Vector3(p0.x + dx * t, p0.y + dy * t, p0.z + dz * t);
  const normal = point.clone().sub(center).normalize();
  return { t, point, normal };
}

export function sweptSegmentPlaneHit(p0, p1, planePoint, planeNormal, panelRadius = 999) {
  const d0 = p0.clone().sub(planePoint).dot(planeNormal);
  const d1 = p1.clone().sub(planePoint).dot(planeNormal);
  if (d0 * d1 > 0 || Math.abs(d0 - d1) < 1e-6) return null;
  const t = d0 / (d0 - d1);
  if (t < 0 || t > 1) return null;
  const point = p0.clone().lerp(p1, t);
  if (point.distanceTo(planePoint) > panelRadius) return null;
  const normal = d0 >= 0 ? planeNormal.clone().normalize() : planeNormal.clone().negate().normalize();
  return { t, point, normal };
}

export function reflectVelocityAroundNormal(vel, normal, restitution = 0.85) {
  const vn = vel.dot(normal);
  if (vn < 0) {
    vel.addScaledVector(normal, -(1 + restitution) * vn);
  }
  return vel;
}

// ============================================================================
// #30 Spatial Partitioning: Uniform 2D/3D Spatial Hash Grid (Own Cell + 8 Neighbours)
// ============================================================================
export class UniformSpatialGrid {
  constructor(cellSize = 1.0) {
    this.cellSize = Math.max(0.15, cellSize);
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  _key(cx, cz) {
    return `${cx},${cz}`;
  }

  insert(agent, x, z) {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const k = this._key(cx, cz);
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = [];
      this.cells.set(k, bucket);
    }
    bucket.push(agent);
  }

  query9Cells(x, z, out = []) {
    out.length = 0;
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const b = this.cells.get(this._key(cx + dx, cz + dz));
        if (b) {
          for (let i = 0; i < b.length; i++) out.push(b[i]);
        }
      }
    }
    return out;
  }
}

// ============================================================================
// #22 A* Pathfinding: Binary Min-Heap Open Set + Octile 8-Way Heuristic
// Tie-breaking on f broken towards lower h (exact gamedev-cheatsheet spec!)
// ============================================================================
class BinaryMinHeap {
  constructor(compareFn) {
    this.data = [];
    this.cmp = compareFn;
  }
  get size() { return this.data.length; }
  push(item) {
    this.data.push(item);
    this._up(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._down(0);
    }
    return top;
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cmp(this.data[i], this.data[p]) >= 0) break;
      [this.data[i], this.data[p]] = [this.data[p], this.data[i]];
      i = p;
    }
  }
  _down(i) {
    const n = this.data.length;
    while (true) {
      let best = i;
      const l = i * 2 + 1, r = l + 1;
      if (l < n && this.cmp(this.data[l], this.data[best]) < 0) best = l;
      if (r < n && this.cmp(this.data[r], this.data[best]) < 0) best = r;
      if (best === i) break;
      [this.data[i], this.data[best]] = [this.data[best], this.data[i]];
      i = best;
    }
  }
}

export function findPathAStarOctile(cols, rows, blockedSet, startRC, goalRC) {
  const SQRT2 = Math.SQRT2;
  const octile = (c, r) => {
    const dx = Math.abs(c - goalRC[0]);
    const dz = Math.abs(r - goalRC[1]);
    return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
  };

  const idxOf = (c, r) => r * cols + c;
  const gScore = new Float32Array(cols * rows).fill(Infinity);
  const parent = new Int32Array(cols * rows).fill(-1);
  const closed = new Uint8Array(cols * rows);

  const open = new BinaryMinHeap((a, b) => {
    if (Math.abs(a.f - b.f) > 1e-5) return a.f - b.f;
    return a.h - b.h; // break ties towards lower h!
  });

  const sIdx = idxOf(startRC[0], startRC[1]);
  const gIdx = idxOf(goalRC[0], goalRC[1]);
  gScore[sIdx] = 0;
  const h0 = octile(startRC[0], startRC[1]);
  open.push({ c: startRC[0], r: startRC[1], idx: sIdx, f: h0, h: h0 });

  const dirs = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, SQRT2], [-1, 1, SQRT2], [1, -1, SQRT2], [-1, -1, SQRT2],
  ];

  while (open.size > 0) {
    const cur = open.pop();
    if (closed[cur.idx]) continue;
    if (cur.idx === gIdx) {
      const path = [];
      let k = gIdx;
      while (k !== -1) {
        path.push([k % cols, Math.floor(k / cols)]);
        k = parent[k];
      }
      return path.reverse();
    }
    closed[cur.idx] = 1;

    for (const [dc, dr, stepCost] of dirs) {
      const nc = cur.c + dc, nr = cur.r + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nIdx = idxOf(nc, nr);
      if (closed[nIdx] || (nIdx !== gIdx && blockedSet.has(nIdx))) continue;
      // Prevent corner cutting across diagonal blockers
      if (dc !== 0 && dr !== 0) {
        if (blockedSet.has(idxOf(cur.c + dc, cur.r)) || blockedSet.has(idxOf(cur.c, cur.r + dr))) continue;
      }
      const tentG = gScore[cur.idx] + stepCost;
      if (tentG < gScore[nIdx]) {
        gScore[nIdx] = tentG;
        parent[nIdx] = cur.idx;
        const h = octile(nc, nr);
        open.push({ c: nc, r: nr, idx: nIdx, f: tentG + h, h });
      }
    }
  }
  return [startRC, goalRC];
}

// ============================================================================
// #25 Steering Behaviors (Arrive + Separation) + #30 Spatial Grid + #32 Time Slicing
// + #07 Shortest-Arc Quaternion Slerp + #26 Swept Hurtbox Hit!
// ============================================================================
export function spawnSteeringSwarmVolley(sim, {
  count = 20,
  origin = new THREE.Vector3(0, 1.45, 0.2),
  targets = [new THREE.Vector3(0, 1.15, 4.0)],
  maxSpeed = 13.5,
  unitWidth = 0.28,
  palette,
  RibbonTrail3D,
  rampToColors,
  onAgentImpact,
  seed = 17,
} = {}) {
  const rand = mulberry32(seed);
  const ramp = rampToColors(palette, 7);
  const group = new THREE.Group();

  const spearGeo = new THREE.ConeGeometry(0.068, 0.48, 5);
  spearGeo.rotateX(Math.PI / 2); // +Z forward!
  const coreGeo = new THREE.OctahedronGeometry(0.085, 0);
  const spearMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.95),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const haloMat = new THREE.MeshBasicMaterial({
    color: ramp[3].clone().multiplyScalar(1.5),
    transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const sepRadius = unitWidth * 2.2;            // ~2 unit widths
  const slowingRadius = unitWidth * 4.2;        // ~4 unit widths for Arrive
  const maxForce = maxSpeed * 4.2;              // ~4x maxSpeed per second
  const grid = new UniformSpatialGrid(sepRadius * 2.0);
  const neighbours = [];
  const zForward = new THREE.Vector3(0, 0, 1);
  const qDesired = new THREE.Quaternion();

  const agents = [];
  for (let i = 0; i < count; i++) {
    const holder = new THREE.Group();
    holder.add(new THREE.Mesh(spearGeo, spearMat), new THREE.Mesh(coreGeo, haloMat));
    holder.position.copy(origin);
    group.add(holder);

    const fanAng = ((i / Math.max(1, count - 1)) - 0.5) * 2.5 + (rand() - 0.5) * 0.25;
    const elev = 0.65 + rand() * 0.75;
    const initSpeed = maxSpeed * (0.65 + rand() * 0.25);
    const vel = new THREE.Vector3(
      Math.sin(fanAng) * Math.cos(elev) * initSpeed,
      Math.sin(elev) * initSpeed,
      -Math.cos(fanAng) * 0.35 * initSpeed
    );
    holder.quaternion.setFromUnitVectors(zForward, vel.clone().normalize());

    const trail = new RibbonTrail3D({ maxPoints: 16, width: 0.14, palette, hdr: 2.0 });
    sim.root.add(trail.group);

    agents.push({
      idx: i,
      holder,
      pos: origin.clone(),
      prevPos: origin.clone(),
      vel,
      cachedSteer: new THREE.Vector3(),
      target: targets[i % targets.length].clone(),
      delay: (i % 6) * 0.025,
      age: 0,
      hit: false,
      fadeAge: 0,
      trail,
    });
  }

  let frameTick = 0;
  const BUCKETS = 4; // #32 Time-slicing across 4 buckets!

  sim.addCustom({
    group,
    update(dt) {
      const bucket = frameTick % BUCKETS;
      frameTick++;

      // Rebuild uniform spatial grid in O(N)
      grid.clear();
      for (const a of agents) {
        if (!a.hit && a.delay <= 0) grid.insert(a, a.pos.x, a.pos.z);
      }

      for (const a of agents) {
        if (a.delay > 0) {
          a.delay -= dt;
          a.holder.visible = false;
          continue;
        }
        if (!a.hit) {
          a.holder.visible = true;
          a.age += dt;
          a.prevPos.copy(a.pos);

          // #32 Time-sliced Steering + Separation decision (recomputed for 1/4 bucket, or after launch arc)
          if (a.age > 0.14 && ((a.idx % BUCKETS) === bucket || a.cachedSteer.lengthSq() === 0)) {
            const toGoal = a.target.clone().sub(a.pos);
            const dist = toGoal.length();
            // #25 Arrive: ramp desired speed inside slowingRadius (after 0.32s windup so volley curves cleanly into hurtbox)
            const desiredSpd = a.age > 0.55
              ? maxSpeed
              : maxSpeed * clamp(dist / Math.max(0.25, slowingRadius), 0.55, 1.0);
            const desiredVel = dist > 1e-4 ? toGoal.multiplyScalar(desiredSpd / dist) : new THREE.Vector3();
            const steer = desiredVel.sub(a.vel);

            // #25 Separation via #30 9-cell Spatial Hash Grid: push apart harder the closer neighbours are!
            grid.query9Cells(a.pos.x, a.pos.z, neighbours);
            const sepForce = new THREE.Vector3();
            for (let j = 0; j < neighbours.length; j++) {
              const other = neighbours[j];
              if (other === a) continue;
              const diff = a.pos.clone().sub(other.pos);
              const d = diff.length();
              if (d > 1e-4 && d < sepRadius) {
                const strength = (1 - d / sepRadius) * maxSpeed * 2.4;
                sepForce.addScaledVector(diff, strength / d);
              }
            }
            steer.add(sepForce);
            if (steer.length() > maxForce) steer.setLength(maxForce);
            a.cachedSteer.copy(steer);
          }

          if (a.age > 0.14) {
            a.vel.addScaledVector(a.cachedSteer, dt);
            if (a.vel.length() > maxSpeed) a.vel.setLength(maxSpeed);
          }
          a.pos.addScaledVector(a.vel, dt);
          a.holder.position.copy(a.pos);

          // #07 Shortest-Arc Quaternion Slerp banking + #09 1 - exp(-k * dt) frame-rate-independent smoothing
          if (a.vel.lengthSq() > 1e-4) {
            qDesired.setFromUnitVectors(zForward, a.vel.clone().normalize());
            slerpShortestQuat(a.holder.quaternion, qDesired, 1 - Math.exp(-18.0 * dt));
          }

          a.trail.pushPoint(a.pos);
          a.trail.update(dt, 0);

          // #26 Swept Segment Anti-Tunneling Hit Detection against target hurtbox sphere
          const hitRes = sweptSegmentSphereHit(a.prevPos, a.pos, a.target, 0.42);
          if (hitRes || a.age >= 1.45) {
            a.hit = true;
            a.holder.visible = false;
            const impactPt = hitRes ? hitRes.point : a.target.clone();
            const impactNorm = hitRes ? hitRes.normal : new THREE.Vector3(0, 1, 0);
            onAgentImpact?.(impactPt, impactNorm, a.idx);
          }
        } else {
          a.fadeAge += dt;
          a.trail.update(dt, 4.8);
        }
      }
    },
    get done() {
      return agents.every((a) => a.hit && a.fadeAge >= 0.24);
    },
    dispose() {
      for (const a of agents) {
        sim.root.remove(a.trail.group);
        a.trail.dispose();
      }
      spearGeo.dispose();
      coreGeo.dispose();
      spearMat.dispose();
      haloMat.dispose();
    },
  });
}

// ============================================================================
// #29 GPU Instancing + #03 3-Level Distance LOD (100% / 30% / 10% + 10% Hysteresis)
// + #04 Frustum Culling + #13 Squash & Stretch!
// ============================================================================
export function spawnInstancedLODBoulderStorm(sim, cameraRef, {
  count = 144,
  cx = 0,
  cz = 4.0,
  radius = 3.2,
  duration = 2.65,
  material,
  makeRockGeo,
  seed = 99,
  onWaveImpact,
} = {}) {
  const rand = mulberry32(seed);
  const group = new THREE.Group();

  // #03 3 LOD Geometries (~100% tris, ~30% tris, ~10% tris)
  const geoLOD0 = makeRockGeo(0.55, 2, 0.30, seed + 1, 1.0); // ~320 tris
  const geoLOD1 = makeRockGeo(0.55, 1, 0.28, seed + 2, 1.0); // ~80 tris
  const geoLOD2 = new THREE.OctahedronGeometry(0.52, 0);      // 8 tris

  const meshLOD0 = new THREE.InstancedMesh(geoLOD0, material, count);
  const meshLOD1 = new THREE.InstancedMesh(geoLOD1, material, count);
  const meshLOD2 = new THREE.InstancedMesh(geoLOD2, material, count);
  for (const im of [meshLOD0, meshLOD1, meshLOD2]) {
    im.frustumCulled = false; // Managed explicitly per-instance via THREE.Frustum below!
    im.count = 0;
    group.add(im);
  }

  // Distance thresholds with 10% hysteresis band so rocks near boundaries NEVER flicker!
  const D01 = 7.2, H01 = D01 * 0.10;
  const D12 = 12.0, H12 = D12 * 0.10;

  const rocks = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * TAU;
    const r = Math.sqrt(rand()) * radius * 0.92;
    const tx = cx + Math.cos(a) * r;
    const tz = cz + Math.sin(a) * r;
    const delay = (i / count) * (duration * 0.52);
    const sz = 0.12 + rand() * 0.20;
    rocks.push({
      x: tx - 1.6 + (rand() - 0.5) * 0.5,
      y: 6.2 + rand() * 3.2,
      z: tz - 1.2 + (rand() - 0.5) * 0.5,
      vx: 1.8 + (rand() - 0.5) * 1.4,
      vy: -(9.5 + rand() * 5.0),
      vz: 1.3 + (rand() - 0.5) * 1.4,
      rx: rand() * TAU, ry: rand() * TAU, rz: rand() * TAU,
      avx: (rand() - 0.5) * 12, avy: (rand() - 0.5) * 12, avz: (rand() - 0.5) * 12,
      size: sz,
      delay,
      life: 1.28,
      bounces: 0,
      squashTimer: 0,
      lod: 0,
    });
  }

  const frustum = new THREE.Frustum();
  const projScreenMat = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  const dummyObj = new THREE.Object3D();
  let elapsed = 0;
  let waveIdx = 0;

  sim.addCustom({
    group,
    update(dt) {
      elapsed += dt;
      const liveCam = cameraRef || sim._lastCam;
      if (liveCam) {
        liveCam.updateMatrixWorld();
        projScreenMat.multiplyMatrices(liveCam.projectionMatrix, liveCam.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMat);
      }

      if (waveIdx < 4 && elapsed >= 0.36 + waveIdx * 0.42) {
        waveIdx++;
        onWaveImpact?.(waveIdx);
      }

      let n0 = 0, n1 = 0, n2 = 0;
      const camPos = liveCam ? liveCam.position : new THREE.Vector3(0, 5, -5);

      for (let i = 0; i < rocks.length; i++) {
        const rk = rocks[i];
        if (elapsed < rk.delay) continue;
        rk.life -= dt;
        if (rk.life <= 0) continue;

        rk.vy -= 18.0 * dt;
        rk.x += rk.vx * dt;
        rk.y += rk.vy * dt;
        rk.z += rk.vz * dt;
        rk.rx += rk.avx * dt;
        rk.ry += rk.avy * dt;
        rk.rz += rk.avz * dt;
        if (rk.squashTimer > 0) rk.squashTimer = Math.max(0, rk.squashTimer - dt);

        const floorY = rk.size * 0.45;
        if (rk.y <= floorY && rk.vy < 0) {
          rk.y = floorY;
          if (rk.bounces < 2 && Math.abs(rk.vy) > 1.5) {
            rk.vy = -rk.vy * 0.48;
            rk.vx *= 0.72;
            rk.vz *= 0.72;
            rk.squashTimer = 0.15; // #13 Squash on bounce!
            rk.bounces++;
          } else {
            rk.vy = 0; rk.vx *= 0.85; rk.vz *= 0.85;
          }
        }

        // #04 Camera Frustum Culling per bounding sphere
        sphere.center.set(rk.x, rk.y, rk.z);
        sphere.radius = rk.size * 1.4;
        if (liveCam && !frustum.intersectsSphere(sphere)) continue;

        // #03 3-Level Distance LOD with 10% Hysteresis Band
        const dist = sphere.center.distanceTo(camPos);
        if (rk.lod === 0 && dist > D01 + H01) rk.lod = 1;
        else if (rk.lod === 1 && dist < D01 - H01) rk.lod = 0;
        else if (rk.lod === 1 && dist > D12 + H12) rk.lod = 2;
        else if (rk.lod === 2 && dist < D12 - H12) rk.lod = 1;

        // #13 Volume-preserving Squash & Stretch + sink fade at end of life
        const spd = Math.hypot(rk.vx, rk.vy, rk.vz);
        const [sx, sy, sz] = computeSquashStretch3D(spd, rk.squashTimer);
        const fadeScale = clamp(rk.life / 0.20, 0, 1);
        const s = rk.size * fadeScale;

        dummyObj.position.set(rk.x, rk.y, rk.z);
        dummyObj.rotation.set(rk.rx, rk.ry, rk.rz);
        dummyObj.scale.set(s * sx, s * sy, s * sz);
        dummyObj.updateMatrix();

        if (rk.lod === 0) meshLOD0.setMatrixAt(n0++, dummyObj.matrix);
        else if (rk.lod === 1) meshLOD1.setMatrixAt(n1++, dummyObj.matrix);
        else meshLOD2.setMatrixAt(n2++, dummyObj.matrix);
      }

      meshLOD0.count = n0; meshLOD0.instanceMatrix.needsUpdate = true;
      meshLOD1.count = n1; meshLOD1.instanceMatrix.needsUpdate = true;
      meshLOD2.count = n2; meshLOD2.instanceMatrix.needsUpdate = true;
    },
    get done() { return elapsed >= duration; },
    dispose() {
      geoLOD0.dispose(); geoLOD1.dispose(); geoLOD2.dispose();
      meshLOD0.dispose(); meshLOD1.dispose(); meshLOD2.dispose();
      material.dispose();
    },
  });
}

// ============================================================================
// #31 Overdraw Heatmap Visualizer: Counts shaded fragment layers per pixel!
// 1 layer = Cool Blue -> Cyan -> Green -> Amber -> 8+ layers = White Hot
// ============================================================================
export class OverdrawHeatmapDebug3D {
  constructor(width = 800, height = 600) {
    this.rt = new THREE.WebGLRenderTarget(
      Math.max(2, width),
      Math.max(2, height),
      { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat }
    );
    // Each shaded fragment adds 1/10 (0.10) into R channel via AdditiveBlending with depthTest=false!
    this.countMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.115, 0.115, 0.115),
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    this.lutMat = new THREE.ShaderMaterial({
      uniforms: { tCount: { value: this.rt.texture } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tCount;
        varying vec2 vUv;
        vec3 overdrawRamp(float x) {
          if (x < 0.04) return vec3(0.03, 0.04, 0.08);
          float u = clamp((x - 0.10) / 0.85, 0.0, 1.0);
          vec3 c1 = vec3(0.08, 0.32, 0.92); // 1 layer: blue
          vec3 c2 = vec3(0.06, 0.85, 0.78); // 3 layers: cyan-green
          vec3 c3 = vec3(1.00, 0.68, 0.10); // 5 layers: amber
          vec3 c4 = vec3(1.00, 0.18, 0.25); // 7 layers: crimson
          vec3 c5 = vec3(1.00, 0.98, 0.98); // 8+ layers: white hot!
          if (u < 0.25) return mix(c1, c2, u / 0.25);
          if (u < 0.52) return mix(c2, c3, (u - 0.25) / 0.27);
          if (u < 0.78) return mix(c3, c4, (u - 0.52) / 0.26);
          return mix(c4, c5, (u - 0.78) / 0.22);
        }
        void main() {
          float layers = texture2D(tCount, vUv).r;
          gl_FragColor = vec4(overdrawRamp(layers), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.lutMat));
    this._savedClear = new THREE.Color();
  }

  setSize(w, h) {
    this.rt.setSize(Math.max(2, w), Math.max(2, h));
  }

  render(renderer, scene, camera, floorMesh, gridHelper) {
    const prevOverride = scene.overrideMaterial;
    const prevBg = scene.background;
    const prevFloorVis = floorMesh ? floorMesh.visible : true;
    const prevGridVis = gridHelper ? gridHelper.visible : true;
    renderer.getClearColor(this._savedClear);
    const prevAlpha = renderer.getClearAlpha();

    if (floorMesh) floorMesh.visible = false;
    if (gridHelper) gridHelper.visible = false;
    scene.background = null;
    scene.overrideMaterial = this.countMat;

    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 1.0);
    renderer.clear();
    renderer.render(scene, camera);

    scene.overrideMaterial = prevOverride;
    scene.background = prevBg;
    if (floorMesh) floorMesh.visible = prevFloorVis;
    if (gridHelper) gridHelper.visible = prevGridVis;
    renderer.setClearColor(this._savedClear, prevAlpha);

    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCam);
  }
}

// ============================================================================
// #5 Craig Reynolds Boids Flocking (Separation + Alignment + Cohesion) + Spatial Hash
// ============================================================================
export function spawnBoidsSwordSwarm(sim, {
  count = 26,
  duration = 3.65,
  diveStart = 2.05,
  palette = ['#081f24', '#0e5245', '#19a362', '#5ce67e', '#ccff82', '#f6ffd4', '#ffffff'],
  targets = [],
  dummies = [],
  seed = 505,
} = {}) {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  const bladeGeo = new THREE.ConeGeometry(0.065, 0.72, 4);
  bladeGeo.scale(1.0, 1.0, 0.32);
  bladeGeo.rotateX(Math.PI / 2);
  const guardGeo = new THREE.BoxGeometry(0.22, 0.032, 0.055);
  guardGeo.translate(0, 0, -0.22);
  const bladeMat = makeSculptedTexturedPropMaterial({
    palette, materialKind: 'damascus_steel', texScale: 2.3, bumpStrength: 3.0, opacity: 0.96, hdr: 1.65,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(palette[5] || '#ffffff').multiplyScalar(1.9),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const targetPts = targets.length
    ? targets
    : [new THREE.Vector3(0, 0.9, 4.2), new THREE.Vector3(-1.4, 0.9, 4.5), new THREE.Vector3(1.4, 0.9, 4.5)];

  const boids = [];
  for (let i = 0; i < count; i++) {
    const holder = new THREE.Group();
    holder.add(new THREE.Mesh(bladeGeo, bladeMat), new THREE.Mesh(guardGeo, glowMat));
    const a = (i / count) * TAU;
    const p = new THREE.Vector3(
      Math.cos(a) * (1.2 + rand() * 1.1),
      1.6 + rand() * 1.8,
      0.8 + Math.sin(a) * 1.1
    );
    const v = new THREE.Vector3(-Math.sin(a) * 6.5, (rand() - 0.5) * 2.5, Math.cos(a) * 6.5 + 1.5);
    holder.position.copy(p);
    group.add(holder);
    boids.push({
      holder,
      pos: p,
      vel: v,
      tgt: targetPts[i % targetPts.length].clone().add(new THREE.Vector3((rand() - 0.5) * 0.7, -0.65, (rand() - 0.5) * 0.7)),
      diveDelay: diveStart + (i / count) * 0.62,
      impacted: false,
    });
  }

  let elapsed = 0;
  const sepForce = new THREE.Vector3();
  const aliForce = new THREE.Vector3();
  const cohForce = new THREE.Vector3();
  const steerGoal = new THREE.Vector3();
  const lookTmp = new THREE.Vector3();

  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      elapsed += dt;
      const u = clamp(elapsed / duration);
      const rem = duration - elapsed;
      bladeMat.uniforms.uTime.value = elapsed;
      const fade = 1 - clamp((u - 0.88) / 0.12);
      bladeMat.uniforms.uOpacity.value = fade;
      glowMat.opacity = fade * 0.9;

      // Orbiting flock goal above targets before individual dive-strikes
      const goalAngle = elapsed * 2.35;
      const flockCenterGoal = new THREE.Vector3(
        targetPts[0].x + Math.cos(goalAngle) * 1.85,
        2.55 + Math.sin(elapsed * 3.1) * 0.45,
        targetPts[0].z * 0.68 + Math.sin(goalAngle) * 1.45
      );

      for (let i = 0; i < boids.length; i++) {
        const b = boids[i];
        if (b.impacted) continue;

        if (elapsed < b.diveDelay) {
          // Classic 3-rule Boids: Separation + Alignment + Cohesion
          sepForce.set(0, 0, 0);
          aliForce.set(0, 0, 0);
          cohForce.set(0, 0, 0);
          let nSep = 0, nFlock = 0;
          for (let j = 0; j < boids.length; j++) {
            if (i === j || boids[j].impacted) continue;
            const o = boids[j];
            const dx = b.pos.x - o.pos.x;
            const dy = b.pos.y - o.pos.y;
            const dz = b.pos.z - o.pos.z;
            const dSq = dx * dx + dy * dy + dz * dz;
            if (dSq < 2.25 && dSq > 1e-5) {
              const d = Math.sqrt(dSq);
              aliForce.add(o.vel);
              cohForce.add(o.pos);
              nFlock++;
              if (d < 0.78) {
                sepForce.x += (dx / d) / Math.max(0.12, d);
                sepForce.y += (dy / d) / Math.max(0.12, d);
                sepForce.z += (dz / d) / Math.max(0.12, d);
                nSep++;
              }
            }
          }
          if (nFlock > 0) {
            aliForce.divideScalar(nFlock).sub(b.vel).multiplyScalar(2.8);
            cohForce.divideScalar(nFlock).sub(b.pos).multiplyScalar(2.4);
          }
          if (nSep > 0) sepForce.multiplyScalar(4.2);

          steerGoal.copy(flockCenterGoal).sub(b.pos).multiplyScalar(3.6);
          b.vel.x += (sepForce.x + aliForce.x + cohForce.x + steerGoal.x) * dt;
          b.vel.y += (sepForce.y + aliForce.y + cohForce.y + steerGoal.y) * dt;
          b.vel.z += (sepForce.z + aliForce.z + cohForce.z + steerGoal.z) * dt;

          const spd = b.vel.length();
          if (spd > 10.5) b.vel.multiplyScalar(10.5 / spd);
          else if (spd < 5.0 && spd > 1e-4) b.vel.multiplyScalar(5.0 / spd);
        } else {
          // Terminal supersonic seek onto target ground!
          steerGoal.copy(b.tgt).sub(b.pos);
          const dist = steerGoal.length();
          if (dist < 0.34 || b.pos.y <= 0.22) {
            b.impacted = true;
            b.holder.position.set(b.tgt.x, 0.24, b.tgt.z);
            if (rem > 0.24) {
              sim.spawnFlipbook({
                atlas: 'fbHitBurst',
                x: b.tgt.x, y: 0.45, z: b.tgt.z, _mapped: true,
                life: Math.min(0.24, rem - 0.04),
                size0: 0.45, size1: 1.05, palette, hdr: 2.2, emitMicro: false,
              });
              if (i % 6 === 0) {
                for (const d of dummies) {
                  if (d.root.visible) d.hit({ dirX: 0.2, dirZ: 1, power: 1.2, flashColor: palette[5] || '#ffffff' });
                }
              }
            }
            continue;
          }
          steerGoal.normalize().multiplyScalar(Math.max(24.0, b.tgt.length() * 2.2));
          b.vel.lerp(steerGoal, clamp(dt * 12.0));
        }

        b.pos.addScaledVector(b.vel, dt);
        b.holder.position.copy(b.pos);
        lookTmp.copy(b.pos).add(b.vel);
        b.holder.lookAt(lookTmp);
      }
    },
    get done() { return elapsed >= duration; },
    dispose() {
      bladeGeo.dispose();
      guardGeo.dispose();
      bladeMat.dispose();
      glowMat.dispose();
    },
  });
}

// ============================================================================
// #6 Position-Based Verlet Integration + Jakobsen Distance Constraints (3D Chains)
// ============================================================================
export function spawnVerletSoulChains(sim, {
  anchors = [],
  target = new THREE.Vector3(0, 1.05, 4.2),
  duration = 3.55,
  snapPullTime = 1.85,
  palette = ['#06020f', '#2b0738', '#731082', '#ad32f2', '#ff78e2', '#c9f6ff', '#ffffff'],
  dummies = [],
} = {}) {
  const srcAnchors = anchors.length ? anchors : [
    new THREE.Vector3(-2.1, 2.25, 2.4),
    new THREE.Vector3(2.1, 2.25, 2.4),
    new THREE.Vector3(-1.8, 2.05, 5.8),
    new THREE.Vector3(1.8, 2.05, 5.8),
  ];

  const group = new THREE.Group();
  const linkGeo = new THREE.TorusGeometry(0.11, 0.028, 8, 18);
  const pylonGeo = new THREE.ConeGeometry(0.16, 2.35, 6);
  pylonGeo.translate(0, 1.175, 0);
  const linkMat = makeSculptedTexturedPropMaterial({
    palette, materialKind: 'obsidian_magma', texScale: 2.1, bumpStrength: 3.1, opacity: 0.96, hdr: 1.75,
  });

  const nodesPerChain = 15;
  const chains = srcAnchors.map((anc) => {
    const pylon = new THREE.Mesh(pylonGeo, linkMat);
    pylon.position.set(anc.x, 0, anc.z);
    group.add(pylon);

    const span = anc.distanceTo(target);
    const restLen = (span * 1.16) / (nodesPerChain - 1);
    const pts = [];
    const prev = [];
    const links = [];
    for (let i = 0; i < nodesPerChain; i++) {
      const u = i / (nodesPerChain - 1);
      const p = new THREE.Vector3().lerpVectors(anc, target, u);
      p.y += Math.sin(u * Math.PI) * 0.65; // initial launch arc!
      pts.push(p.clone());
      prev.push(p.clone().add(new THREE.Vector3(0, -0.04, 0)));
      if (i < nodesPerChain - 1) {
        const lm = new THREE.Mesh(linkGeo, linkMat);
        group.add(lm);
        links.push(lm);
      }
    }
    return { anc: anc.clone(), pts, prev, links, restLen, baseRest: restLen };
  });

  let elapsed = 0;
  let snapped = false;
  const diff = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const upAxis = new THREE.Vector3(0, 1, 0);
  const dirTmp = new THREE.Vector3();

  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      elapsed += dt;
      const u = clamp(elapsed / duration);
      const rem = duration - elapsed;
      const stepDt = Math.min(0.025, Math.max(0.004, dt));
      linkMat.uniforms.uTime.value = elapsed;
      linkMat.uniforms.uOpacity.value = 1 - clamp((u - 0.88) / 0.12);

      // Snap taut at snapPullTime (shortens restLen abruptly -> violent catenary whip!)
      const tautFactor = elapsed >= snapPullTime ? 0.80 : 1.0;
      if (!snapped && elapsed >= snapPullTime && rem > 0.25) {
        snapped = true;
        sim.spawnFlipbook({
          atlas: 'fbDarkVortex',
          x: target.x, y: target.y, z: target.z, _mapped: true,
          life: Math.min(0.42, rem - 0.05),
          size0: 1.2, size1: 2.8, palette, hdr: 2.4,
        });
        sim.spawnGroundZone({
          x: target.x, z: target.z, _mapped: true,
          radius: 2.35, duration: Math.min(1.6, rem - 0.06),
          kind: 'void', palette, emitFlames: true, eruptRocks: true,
        });
        for (const d of dummies) {
          if (d.root.visible) d.hit({ dirX: 0, dirZ: -1, power: 1.85, noPush: true, flashColor: palette[5] || '#ffffff' });
        }
      }

      const tgtNow = target.clone();
      tgtNow.y = target.y + Math.sin(elapsed * 9.0) * (snapped ? 0.04 : 0.14);

      for (const ch of chains) {
        ch.restLen = lerp(ch.restLen, ch.baseRest * tautFactor, clamp(dt * 10.0));
        // 1) Verlet position integration: x' = x + (x - x_old)*damping + g*dt^2
        for (let i = 1; i < nodesPerChain - 1; i++) {
          const p = ch.pts[i];
          const pr = ch.prev[i];
          const vx = (p.x - pr.x) * 0.985;
          const vy = (p.y - pr.y) * 0.985;
          const vz = (p.z - pr.z) * 0.985;
          pr.copy(p);
          p.x += vx;
          p.y += vy - 15.5 * stepDt * stepDt;
          p.z += vz;
          if (p.y < 0.08) p.y = 0.08;
        }
        // 2) 6-Iteration Jakobsen Distance Constraint Relaxation
        for (let iter = 0; iter < 6; iter++) {
          ch.pts[0].copy(ch.anc);
          ch.pts[nodesPerChain - 1].copy(tgtNow);
          for (let i = 0; i < nodesPerChain - 1; i++) {
            const pA = ch.pts[i];
            const pB = ch.pts[i + 1];
            diff.subVectors(pB, pA);
            const d = Math.max(1e-5, diff.length());
            const err = (d - ch.restLen) / d;
            if (i === 0) {
              pB.addScaledVector(diff, -err);
            } else if (i + 1 === nodesPerChain - 1) {
              pA.addScaledVector(diff, err);
            } else {
              pA.addScaledVector(diff, err * 0.5);
              pB.addScaledVector(diff, -err * 0.5);
            }
          }
        }
        // Position & alternate-90°-rotate 3D chain links along constrained segments
        for (let i = 0; i < ch.links.length; i++) {
          const pA = ch.pts[i];
          const pB = ch.pts[i + 1];
          mid.addVectors(pA, pB).multiplyScalar(0.5);
          dirTmp.subVectors(pB, pA).normalize();
          const lm = ch.links[i];
          lm.position.copy(mid);
          lm.quaternion.setFromUnitVectors(upAxis, dirTmp);
          if (i % 2 === 1) lm.rotateY(Math.PI * 0.5);
        }
      }
    },
    get done() { return elapsed >= duration; },
    dispose() {
      linkGeo.dispose();
      pylonGeo.dispose();
      linkMat.dispose();
    },
  });
}

// ============================================================================
// #7 Cubic Bézier Curves + 16-Sample Arc-Length Parameterization LUT (Constant Speed!)
// ============================================================================
export function evalCubicBezier3D(p0, p1, p2, p3, t, out = new THREE.Vector3()) {
  const it = 1 - t;
  const b0 = it * it * it;
  const b1 = 3 * it * it * t;
  const b2 = 3 * it * t * t;
  const b3 = t * t * t;
  return out.set(
    b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
    b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
    b0 * p0.z + b1 * p1.z + b2 * p2.z + b3 * p3.z
  );
}

export function buildBezierArcLengthLUT(p0, p1, p2, p3, samples = 20) {
  const table = [{ t: 0, len: 0 }];
  let total = 0;
  const prev = p0.clone();
  const cur = new THREE.Vector3();
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    evalCubicBezier3D(p0, p1, p2, p3, t, cur);
    total += cur.distanceTo(prev);
    table.push({ t, len: total });
    prev.copy(cur);
  }
  return {
    totalLength: Math.max(1e-4, total),
    sampleAtArcFraction(uFrac, out = new THREE.Vector3()) {
      const targetLen = clamp(uFrac, 0, 1) * total;
      let lo = 0, hi = table.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (table[mid].len <= targetLen) lo = mid;
        else hi = mid;
      }
      const a = table[lo], b = table[hi];
      const segT = lerp(a.t, b.t, (targetLen - a.len) / Math.max(1e-5, b.len - a.len));
      return evalCubicBezier3D(p0, p1, p2, p3, segT, out);
    },
  };
}

export function spawnCubicBezierVolley(sim, {
  origin = new THREE.Vector3(0, 1.45, 0.5),
  targets = [],
  count = 16,
  duration = 3.25,
  palette = ['#0c0826', '#241463', '#5229ba', '#8c52ff', '#d48cff', '#9ef5ff', '#ffffff'],
  dummies = [],
  seed = 707,
} = {}) {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  const spearGeo = new THREE.OctahedronGeometry(0.11, 0);
  spearGeo.scale(0.85, 0.85, 3.6);
  const spearMat = makeSculptedTexturedPropMaterial({
    palette, materialKind: 'glacier_sapphire', texScale: 2.0, bumpStrength: 2.8, opacity: 0.95, hdr: 1.75,
  });

  const tgtList = targets.length ? targets : [new THREE.Vector3(0, 1.0, 4.4)];
  const missiles = [];
  for (let i = 0; i < count; i++) {
    const sgn = i % 2 === 0 ? 1 : -1;
    const spread = 1.65 + (i % 4) * 0.72;
    const p0 = origin.clone();
    const tgt = tgtList[i % tgtList.length].clone().add(new THREE.Vector3((rand() - 0.5) * 0.5, (rand() - 0.5) * 0.35, (rand() - 0.5) * 0.5));
    const p1 = new THREE.Vector3(origin.x + sgn * spread * 1.45, 2.8 + rand() * 1.9, origin.z - 1.25);
    const p2 = new THREE.Vector3(tgt.x + sgn * spread * 1.15, 3.3 + rand() * 1.4, lerp(origin.z, tgt.z, 0.68));
    const lut = buildBezierArcLengthLUT(p0, p1, p2, tgt, 20);
    const mesh = new THREE.Mesh(spearGeo, spearMat);
    mesh.visible = false;
    group.add(mesh);

    // Subtle preview curve line showing the exact Cubic Bézier spline!
    const curvePts = Array.from({ length: 18 }, (_, k) => lut.sampleAtArcFraction(k / 17, new THREE.Vector3()));
    const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePts);
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(palette[4] || '#d48cff'),
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    group.add(line);

    missiles.push({
      lut, tgt, mesh, lineGeo, lineMat,
      delay: 0.12 + i * 0.095,
      flightDur: clamp(lut.totalLength / 13.5, 0.42, 0.78), // Exact constant world speed = 13.5 m/s!
      doneHit: false,
    });
  }

  let elapsed = 0;
  const posNow = new THREE.Vector3();
  const posAhead = new THREE.Vector3();

  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      elapsed += dt;
      const rem = duration - elapsed;
      spearMat.uniforms.uTime.value = elapsed;

      for (let i = 0; i < missiles.length; i++) {
        const m = missiles[i];
        const tLocal = elapsed - m.delay;
        if (tLocal < 0) {
          m.lineMat.opacity = clamp((elapsed / Math.max(0.08, m.delay)) * 0.28, 0, 0.28);
          continue;
        }
        const sFrac = clamp(tLocal / m.flightDur, 0, 1);
        if (sFrac < 1.0) {
          m.mesh.visible = true;
          m.lut.sampleAtArcFraction(sFrac, posNow);
          m.lut.sampleAtArcFraction(Math.min(1, sFrac + 0.03), posAhead);
          m.mesh.position.copy(posNow);
          m.mesh.lookAt(posAhead);
          m.lineMat.opacity = (1 - sFrac) * 0.35;
          if (sim.niagara && rem > 0.18) {
            sim.niagara.spawnBurst(sim.R, {
              x: posNow.x, y: posNow.y, z: posNow.z,
              count: 2, spreadRadius: 0.05, speed0: 0.2, speed1: 0.8,
              size0: 0.042, size1: 0.012, life0: 0.14, life1: 0.22,
              palette, hdr: 2.2,
            });
          }
        } else if (!m.doneHit) {
          m.doneHit = true;
          m.mesh.visible = false;
          m.lineMat.opacity = 0;
          if (rem > 0.22) {
            sim.spawnFlipbook({
              atlas: i % 2 === 0 ? 'fbStarburst' : 'fbHitBurst',
              x: m.tgt.x, y: m.tgt.y, z: m.tgt.z, _mapped: true,
              life: Math.min(0.28, rem - 0.04),
              size0: 0.55, size1: 1.35, palette, hdr: 2.35, emitMicro: false,
            });
            if (i % 4 === 0) {
              for (const d of dummies) {
                if (d.root.visible) d.hit({ dirX: 0, dirZ: 1, power: 1.25, flashColor: palette[5] || '#ffffff' });
              }
            }
          }
        }
      }
    },
    get done() { return elapsed >= duration; },
    dispose() {
      spearGeo.dispose();
      spearMat.dispose();
      for (const m of missiles) {
        m.lineGeo.dispose();
        m.lineMat.dispose();
      }
    },
  });
}

// ============================================================================
// #8 3D Voronoi Cellular Fracture (Nearest-Seed Partitioning + Impulse Shatter)
// ============================================================================
export function spawnVoronoiBarrierShatter(sim, {
  center = new THREE.Vector3(0, 1.35, 3.6),
  width = 3.4,
  height = 2.4,
  cellCount = 24,
  shatterTime = 0.78,
  duration = 3.35,
  palette = ['#061938', '#0d4785', '#1792d1', '#54dbff', '#baf5ff', '#eefbff', '#ffffff'],
  dummies = [],
  seed = 808,
} = {}) {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  const cellMat = makeSculptedTexturedPropMaterial({
    palette, materialKind: 'glacier_sapphire', texScale: 1.9, bumpStrength: 2.9, opacity: 0.94, hdr: 1.65,
  });
  const seamMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(palette[6] || '#ffffff').multiplyScalar(2.4),
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  // 1) Generate 2D Voronoi seed points across the curved barrier shield & clip each cell's polygon via half-plane bisectors!
  const seeds = [];
  for (let i = 0; i < cellCount; i++) {
    const gx = (i % 6) / 6;
    const gy = Math.floor(i / 6) / 4;
    seeds.push({
      x: ((gx + (rand() * 0.75 + 0.12) / 6) - 0.5) * width,
      y: ((gy + (rand() * 0.75 + 0.12) / 4) - 0.5) * height,
    });
  }

  const clipPolyHalfPlane = (poly, midX, midY, nx, ny) => {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const da = (a.x - midX) * nx + (a.y - midY) * ny;
      const db = (b.x - midX) * nx + (b.y - midY) * ny;
      if (da <= 0) out.push(a);
      if ((da <= 0 && db > 0) || (da > 0 && db <= 0)) {
        const t = da / (da - db);
        out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
      }
    }
    return out;
  };

  const geos = [];
  const cells = [];
  const hw = width * 0.5, hh = height * 0.5;

  for (let i = 0; i < cellCount; i++) {
    const s = seeds[i];
    let poly = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ];
    for (let j = 0; j < cellCount; j++) {
      if (i === j) continue;
      const o = seeds[j];
      const dx = o.x - s.x, dy = o.y - s.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-5) continue;
      // Slightly inset by 0.014m so glowing crack seams shine between exact Voronoi polygons!
      const mx = (s.x + o.x) * 0.5 - (dx / len) * 0.012;
      const my = (s.y + o.y) * 0.5 - (dy / len) * 0.012;
      poly = clipPolyHalfPlane(poly, mx, my, dx / len, dy / len);
      if (poly.length < 3) break;
    }
    if (poly.length < 3) continue;

    // Extrude clipped Voronoi polygon into a true 3D beveled crystal slab centered on its own centroid!
    let cx = 0, cy = 0;
    for (const p of poly) { cx += p.x; cy += p.y; }
    cx /= poly.length; cy /= poly.length;

    const shape = new THREE.Shape();
    shape.moveTo(poly[0].x - cx, poly[0].y - cy);
    for (let k = 1; k < poly.length; k++) shape.lineTo(poly[k].x - cx, poly[k].y - cy);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.022,
      bevelThickness: 0.028,
    });
    geo.translate(0, 0, -0.07);
    geos.push(geo);

    const mesh = new THREE.Mesh(geo, cellMat);
    const seamMesh = new THREE.Mesh(geo, seamMat);
    seamMesh.scale.setScalar(1.03);
    const holder = new THREE.Group();
    holder.add(mesh, seamMesh);

    const bowZ = -Math.cos((cx / Math.max(0.5, hw)) * 1.05) * 0.35 + 0.35;
    const basePos = new THREE.Vector3(center.x + cx, Math.max(0.28, center.y + cy), center.z + bowZ);
    holder.position.copy(basePos);
    group.add(holder);

    const radDir = new THREE.Vector3(cx * 1.4 + (rand() - 0.5) * 0.6, cy * 1.1 + 1.45, 2.2 + rand() * 2.4).normalize();
    const spd = 4.2 + rand() * 5.2;
    cells.push({
      holder,
      seamMesh,
      basePos,
      pos: basePos.clone(),
      vel: radDir.multiplyScalar(spd),
      rotVel: new THREE.Vector3((rand() - 0.5) * 11, (rand() - 0.5) * 11, (rand() - 0.5) * 11),
    });
  }

  let elapsed = 0;
  let shattered = false;

  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      elapsed += dt;
      const u = clamp(elapsed / duration);
      const rem = duration - elapsed;
      cellMat.uniforms.uTime.value = elapsed;

      if (elapsed < shatterTime) {
        const tension = clamp(elapsed / shatterTime, 0, 1);
        seamMat.opacity = Math.pow(tension, 2.2) * 0.92;
        cellMat.uniforms.uFlash.value = Math.pow(tension, 3.5) * 0.65;
        for (const c of cells) {
          c.holder.position.set(
            c.basePos.x + Math.sin(elapsed * 55 + c.basePos.y * 9) * 0.025 * tension,
            c.basePos.y + Math.cos(elapsed * 48 + c.basePos.x * 9) * 0.025 * tension,
            c.basePos.z
          );
        }
      } else {
        if (!shattered) {
          shattered = true;
          seamMat.opacity = 0;
          cellMat.uniforms.uFlash.value = 0;
          if (rem > 0.35) {
            sim.spawnAirDistortion({
              kind: 'shock', x: center.x, y: center.y, z: center.z, _mapped: true,
              r0: 0.25, r1: width * 0.95, duration: 0.36, strength: 0.92,
            });
            sim.spawnGroundZone({
              x: center.x, z: center.z + 0.5, _mapped: true,
              radius: width * 0.68, duration: Math.min(2.1, rem - 0.06),
              kind: 'frost', palette, emitFlames: false, eruptRocks: false,
            });
            sim.spawnFlipbook({
              atlas: 'fbIceShatter',
              x: center.x, y: center.y, z: center.z, _mapped: true,
              life: 0.42, size0: 1.5, size1: 3.6, palette, hdr: 2.5,
            });
            for (const d of dummies) {
              if (d.root.visible) d.hit({ dirX: 0, dirZ: 1, power: 1.85, flashColor: '#ffffff' });
            }
          }
        }
        const fade = 1 - clamp((u - 0.82) / 0.18);
        cellMat.uniforms.uOpacity.value = fade * 0.94;
        for (const c of cells) {
          c.seamMesh.visible = false;
          c.vel.y -= 14.8 * dt;
          c.pos.addScaledVector(c.vel, dt);
          if (c.pos.y < 0.14) {
            c.pos.y = 0.14;
            c.vel.y = Math.abs(c.vel.y) * 0.42;
            c.vel.x *= 0.76;
            c.vel.z *= 0.76;
            c.rotVel.multiplyScalar(0.68);
          }
          c.holder.position.copy(c.pos);
          c.holder.rotation.x += c.rotVel.x * dt;
          c.holder.rotation.y += c.rotVel.y * dt;
          c.holder.rotation.z += c.rotVel.z * dt;
        }
      }
    },
    get done() { return elapsed >= duration; },
    dispose() {
      geos.forEach((g) => g.dispose());
      cellMat.dispose();
      seamMat.dispose();
    },
  });
}

// ============================================================================
// #9 Breadth-First Search (BFS) Shortest-Hop Graph + Second-Order Spring-Damper
// ============================================================================
export function spawnBFSChainLightning(sim, {
  origin = new THREE.Vector3(0, 1.25, 0.7),
  center = new THREE.Vector3(0, 1.15, 4.2),
  radius = 2.8,
  duration = 3.35,
  palette = ['#0a1033', '#1d2d8a', '#2c6df2', '#61b8ff', '#a8ebff', '#eefbff', '#ffffff'],
  dummies = [],
  seed = 909,
} = {}) {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  const nodeGeo = new THREE.OctahedronGeometry(0.22, 0);
  nodeGeo.scale(0.85, 1.65, 0.85);
  const ringGeo = new THREE.TorusGeometry(0.32, 0.018, 8, 28);
  const nodeMat = makeSculptedTexturedPropMaterial({
    palette, materialKind: 'damascus_steel', texScale: 2.0, bumpStrength: 2.8, opacity: 0.96, hdr: 1.75,
  });

  // Build 9 relay pylon nodes across the arena (node 0 closest to caster)
  const nodes = [
    { pos: new THREE.Vector3(center.x, 1.25, Math.max(1.6, center.z - radius * 0.75)) },
  ];
  for (let i = 1; i < 9; i++) {
    const a = ((i - 1) / 8) * TAU + (rand() - 0.5) * 0.35;
    const r = radius * (i % 2 === 0 ? 0.52 : 0.88);
    nodes.push({
      pos: new THREE.Vector3(center.x + Math.cos(a) * r, 0.95 + (i % 3) * 0.35, center.z + Math.sin(a) * r),
    });
  }

  // Adjacency list for edges within maxJump
  const maxJump = radius * 0.88;
  const adj = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].pos.distanceTo(nodes[j].pos) <= maxJump) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
    if (adj[i].length === 0 && i > 0) {
      adj[0].push(i);
      adj[i].push(0);
    }
  }

  // Exact FIFO Queue Breadth-First Search (BFS) from node 0!
  const visited = new Array(nodes.length).fill(false);
  const hopDist = new Array(nodes.length).fill(99);
  const bfsParent = new Array(nodes.length).fill(-1);
  const queue = [0];
  visited[0] = true;
  hopDist[0] = 0;
  while (queue.length > 0) {
    const u = queue.shift();
    for (const v of adj[u]) {
      if (!visited[v]) {
        visited[v] = true;
        hopDist[v] = hopDist[u] + 1;
        bfsParent[v] = u;
        queue.push(v);
      }
    }
  }

  const ringMats = [];
  for (let i = 0; i < nodes.length; i++) {
    const holder = new THREE.Group();
    const rm = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette[5] || '#ffffff').multiplyScalar(1.9),
      transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    ringMats.push(rm);
    const mNode = new THREE.Mesh(nodeGeo, nodeMat);
    const mRing = new THREE.Mesh(ringGeo, rm);
    mRing.rotation.x = Math.PI / 2;
    holder.add(mNode, mRing);
    holder.position.copy(nodes[i].pos);
    group.add(holder);
    nodes[i].holder = holder;
    nodes[i].ringMat = rm;
    nodes[i].hop = hopDist[i] < 99 ? hopDist[i] : 2;
    nodes[i].parent = bfsParent[i];
    nodes[i].fired = false;
    // Second-Order Spring-Damper state: y'' = -k*y - c*y'
    nodes[i].disp = 0;
    nodes[i].vel = 0;
    nodes[i].scaleDisp = 0;
    nodes[i].scaleVel = 0;
  }

  let elapsed = 0;
  let pulseTimer = 0.0;

  sim.addCustom({
    group,
    _skipAutoMap: true,
    update(dt) {
      elapsed += dt;
      const u = clamp(elapsed / duration);
      const rem = duration - elapsed;
      nodeMat.uniforms.uTime.value = elapsed;
      const fade = 1 - clamp((u - 0.88) / 0.12);
      nodeMat.uniforms.uOpacity.value = fade;

      for (let i = 0; i < nodes.length; i++) {
        const nd = nodes[i];
        const fireT = 0.22 + nd.hop * 0.28;
        if (!nd.fired && elapsed >= fireT && rem > 0.24) {
          nd.fired = true;
          nd.vel = 3.8;        // Impulse kick into second-order spring-damper!
          nd.scaleVel = 6.2;
          const srcPos = nd.parent >= 0 ? nodes[nd.parent].pos : origin;
          sim.spawnLightning({
            p0: srcPos, p1: nd.pos, _mapped: true,
            life: Math.min(0.42, rem - 0.05),
            jag: 0.22, depth: 4, forks: 2, palette, thickness: 0.058,
          });
          sim.spawnStarGlint(nd.pos.x, nd.pos.y, nd.pos.z, 0.72, '#ffffff', 0.16, true);
          if (i === 0) {
            sim.spawnGroundZone({
              x: center.x, z: center.z, _mapped: true,
              radius: radius * 0.86, duration: Math.min(2.2, rem - 0.06),
              kind: 'lightning', palette, emitFlames: false, eruptRocks: false,
            });
          }
          for (const d of dummies) {
            if (d.root.visible && nd.hop >= 1) {
              d.hit({ dirX: 0.15, dirZ: 1, power: 1.25, noPush: true, flashColor: palette[5] || '#ffffff' });
            }
          }
        }

        // Integrate Second-Order Underdamped Spring-Damper (omega = 22, zeta = 0.22)
        const kSpring = 484.0, cDamp = 9.68;
        nd.vel += (-kSpring * nd.disp - cDamp * nd.vel) * dt;
        nd.disp += nd.vel * dt;
        nd.scaleVel += (-kSpring * nd.scaleDisp - cDamp * nd.scaleVel) * dt;
        nd.scaleDisp += nd.scaleVel * dt;

        nd.holder.position.set(nd.pos.x, nd.pos.y + nd.disp * 0.24, nd.pos.z);
        nd.holder.rotation.y += dt * (nd.fired ? 4.8 : 1.4);
        nd.holder.scale.setScalar(Math.max(0.2, (1.0 + nd.scaleDisp * 0.28) * fade));
        nd.ringMat.opacity = (nd.fired ? 0.88 : 0.22) * fade;
      }

      // Sustained re-crackling arcs across active BFS spanning tree edges!
      pulseTimer -= dt;
      if (pulseTimer <= 0 && elapsed > 0.85 && rem > 0.32) {
        pulseTimer = 0.14;
        const idx = 1 + Math.floor(rand() * (nodes.length - 1));
        const nd = nodes[idx];
        if (nd.fired && nd.parent >= 0) {
          sim.spawnLightning({
            p0: nodes[nd.parent].pos, p1: nd.pos, _mapped: true,
            life: Math.min(0.18, rem - 0.04),
            jag: 0.20, depth: 3, forks: 1, palette, thickness: 0.042,
          });
        }
      }
    },
    get done() { return elapsed >= duration; },
    dispose() {
      nodeGeo.dispose();
      ringGeo.dispose();
      nodeMat.dispose();
      ringMats.forEach((m) => m.dispose());
    },
  });
}

// ============================================================================
// #10 3D Divergence-Free Curl-Noise Flow Field (v = ∇ × Ψ, ∇·v ≡ 0)
// ============================================================================
function evalPotentialPsi(x, y, z, t) {
  const sx = x * 0.92, sy = y * 0.92, sz = z * 0.92;
  const p1 = Math.sin(sy * 1.7 + t * 1.9) * Math.cos(sz * 1.5 - t * 1.3) + 0.5 * Math.sin((sx + sz) * 2.3 + t * 2.4);
  const p2 = Math.sin(sz * 1.8 - t * 1.7) * Math.cos(sx * 1.6 + t * 1.5) + 0.5 * Math.cos((sy - sx) * 2.1 - t * 2.1);
  const p3 = Math.sin(sx * 1.6 + t * 2.1) * Math.cos(sy * 1.8 + t * 1.4) + 0.5 * Math.sin((sy + sz) * 2.2 - t * 1.8);
  return [p1, p2, p3];
}

export function evalDivergenceFreeCurl3D(x, y, z, t, eps = 0.04) {
  const pyP = evalPotentialPsi(x, y + eps, z, t);
  const pyM = evalPotentialPsi(x, y - eps, z, t);
  const pzP = evalPotentialPsi(x, y, z + eps, t);
  const pzM = evalPotentialPsi(x, y, z - eps, t);
  const pxP = evalPotentialPsi(x + eps, y, z, t);
  const pxM = evalPotentialPsi(x - eps, y, z, t);
  const inv2e = 0.5 / eps;
  // v = (dPsi3/dy - dPsi2/dz, dPsi1/dz - dPsi3/dx, dPsi2/dx - dPsi1/dy) -> exact div(v) = 0!
  return [
    (pyP[2] - pyM[2]) * inv2e - (pzP[1] - pzM[1]) * inv2e,
    (pzP[0] - pzM[0]) * inv2e - (pxP[2] - pxM[2]) * inv2e,
    (pxP[1] - pxM[1]) * inv2e - (pyP[0] - pyM[0]) * inv2e,
  ];
}

export function spawnCurlNoisePhoenixField(sim, {
  center = new THREE.Vector3(0, 0.25, 4.0),
  radius = 2.8,
  count = 320,
  duration = 3.85,
  palette = ['#1a0500', '#590d00', '#b82500', '#ff5e00', '#ffb300', '#fff099', '#ffffff'],
  dummies = [],
  seed = 1010,
} = {}) {
  const rand = mulberry32(seed);
  const plumeGeo = new THREE.OctahedronGeometry(0.08, 0);
  plumeGeo.scale(0.55, 0.35, 2.8);
  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const inst = new THREE.InstancedMesh(plumeGeo, plumeMat, count);
  inst.frustumCulled = false;

  const particles = [];
  const cTmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = rand() * TAU;
    const r = Math.sqrt(rand()) * radius * 0.85;
    cTmp.set(palette[3 + (i % 4)] || '#ffb300').multiplyScalar(1.85);
    inst.setColorAt(i, cTmp);
    particles.push({
      x: center.x + Math.cos(a) * r,
      y: 0.12 + rand() * 2.8,
      z: center.z + Math.sin(a) * r,
      vx: 0, vy: 1.5, vz: 0,
      scale: 0.65 + rand() * 0.95,
    });
  }
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

  sim.spawnGroundZone({
    x: center.x, z: center.z, _mapped: true,
    radius: radius * 0.92, duration: duration - 0.12,
    kind: 'burning', palette, emitFlames: true, eruptRocks: false,
  });

  let elapsed = 0;
  let tickTimer = 0.55;
  const dummyObj = new THREE.Object3D();
  const lookTarget = new THREE.Vector3();

  sim.addCustom({
    mesh: inst,
    _skipAutoMap: true,
    update(dt) {
      elapsed += dt;
      const u = clamp(elapsed / duration);
      const rem = duration - elapsed;
      const env = clamp(u * 8.0, 0, 1) * (1 - clamp((u - 0.86) / 0.14, 0, 1));
      plumeMat.opacity = env * 0.92;

      for (let i = 0; i < count; i++) {
        const p = particles[i];
        const [cx, cy, cz] = evalDivergenceFreeCurl3D(p.x - center.x, p.y, p.z - center.z, elapsed);
        const dx = p.x - center.x, dz = p.z - center.z;
        const r = Math.max(0.15, Math.hypot(dx, dz));
        const confine = r > radius * 0.85 ? -2.8 : -0.45;
        p.vx = cx * 3.1 + (-dz / r) * 2.4 + (dx / r) * confine;
        p.vy = Math.abs(cy) * 1.8 + 1.65;
        p.vz = cz * 3.1 + (dx / r) * 2.4 + (dz / r) * confine;

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y > 4.25) {
          const a = rand() * TAU;
          const rr = Math.sqrt(rand()) * radius * 0.72;
          p.x = center.x + Math.cos(a) * rr;
          p.y = 0.10 + rand() * 0.35;
          p.z = center.z + Math.sin(a) * rr;
        }

        dummyObj.position.set(p.x, p.y, p.z);
        lookTarget.set(p.x + p.vx, p.y + p.vy, p.z + p.vz);
        dummyObj.lookAt(lookTarget);
        const sc = p.scale * env;
        dummyObj.scale.set(sc, sc, sc * (1.0 + 0.12 * Math.hypot(p.vx, p.vy, p.vz)));
        dummyObj.updateMatrix();
        inst.setMatrixAt(i, dummyObj.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;

      tickTimer -= dt;
      if (tickTimer <= 0 && rem > 0.45) {
        tickTimer = 0.72;
        for (const d of dummies) {
          if (d.root.visible) d.hit({ dirX: 0.2, dirZ: 1, power: 1.25, noPush: true, flashColor: palette[5] || '#fff099' });
        }
      }
    },
    get done() { return elapsed >= duration; },
    dispose() {
      inst.dispose();
      plumeGeo.dispose();
      plumeMat.dispose();
    },
  });
}
