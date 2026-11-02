import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Blender BMesh-inspired Procedural High-Craft 3D Modeling Kernel.
 * Produces clean, manifold, UV-mapped BufferGeometries with beveled edges,
 * recessed fuller blood-grooves, fluted columns, sculpted feathers, and
 * parallel-transport organic sweep tubes — used both in WebGL and `.glb`/`.obj` export.
 */

// 1. Beveled / Chamfered Architectural & Armor Box (Blender BevelModifier equivalent)
export function buildBeveledBoxGeo(w = 1, h = 1, d = 1, bevel = 0.04, segs = 2) {
  const geo = new THREE.BoxGeometry(1, 1, 1, 4 + segs * 2, 4 + segs * 2, 4 + segs * 2);
  const pos = geo.attributes.position;
  const hw = w * 0.5, hh = h * 0.5, hd = d * 0.5;
  const bx = Math.min(bevel, hw * 0.45);
  const by = Math.min(bevel, hh * 0.45);
  const bz = Math.min(bevel, hd * 0.45);
  const ix = Math.max(1e-4, hw - bx);
  const iy = Math.max(1e-4, hh - by);
  const iz = Math.max(1e-4, hd - bz);

  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  const dVec = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    // Map unit cube [-0.5..0.5] to target box, then project outer shell onto rounded bevel corner
    const px = pos.getX(i) * w;
    const py = pos.getY(i) * h;
    const pz = pos.getZ(i) * d;
    c.set(clamp(px, -ix, ix), clamp(py, -iy, iy), clamp(pz, -iz, iz));
    dVec.set((px - c.x) / Math.max(1e-5, bx), (py - c.y) / Math.max(1e-5, by), (pz - c.z) / Math.max(1e-5, bz));
    const len = dVec.length();
    if (len > 1e-5) {
      dVec.divideScalar(len);
      v.set(c.x + dVec.x * bx, c.y + dVec.y * by, c.z + dVec.z * bz);
    } else {
      v.copy(c);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// 2. Forged Multi-Facet Blade with Recessed Dual-Face Fuller Groove & Ricasso Flair
export function buildFulleredBladeGeo({
  length = 1.65,
  yOffset = 0.0,
  baseHalfW = 0.115,
  ricassoFlare = 1.18,
  midHalfW = 0.092,
  tipStartFrac = 0.72,
  thickness = 0.042,
  fullerDepth = 0.013,
  fullerEndFrac = 0.68,
  curveX = 0.0,
  segsY = 24,
} = {}) {
  // 12-point cross-section around perimeter (counter-clockwise looking down -Y)
  const ringCount = 12;
  const pos = [];
  const uvs = [];
  const idx = [];

  for (let iy = 0; iy <= segsY; iy++) {
    const v = iy / segsY;
    const y = yOffset + v * length;

    let hw;
    if (v < 0.10) {
      hw = baseHalfW * lerp(0.92, ricassoFlare, Math.sin((v / 0.10) * Math.PI * 0.5));
    } else if (v < tipStartFrac) {
      const u = (v - 0.10) / Math.max(1e-4, tipStartFrac - 0.10);
      hw = lerp(baseHalfW * ricassoFlare, midHalfW, Math.pow(u, 0.55));
    } else {
      const u = (v - tipStartFrac) / Math.max(1e-4, 1.0 - tipStartFrac);
      hw = midHalfW * (1 - Math.pow(u, 1.45)) + 0.0012;
    }

    const tz = thickness * (1 - Math.pow(v, 1.35) * 0.88) + 0.001;
    const fullerMask = v < fullerEndFrac
      ? Math.sin(clamp(v / fullerEndFrac, 0, 1) * Math.PI)
      : 0.0;
    const fd = Math.min(tz * 0.62, fullerDepth * fullerMask);
    const bendX = curveX * Math.pow(v, 1.85);

    // 12 perimeter stations: razor edges, bevel shoulders, fuller lips, concave fuller center
    const section = [
      [hw, 0],
      [hw * 0.52, tz * 0.86],
      [hw * 0.25, tz],
      [0, tz - fd],
      [-hw * 0.25, tz],
      [-hw * 0.52, tz * 0.86],
      [-hw, 0],
      [-hw * 0.52, -tz * 0.86],
      [-hw * 0.25, -tz],
      [0, -(tz - fd)],
      [hw * 0.25, -tz],
      [hw * 0.52, -tz * 0.86],
    ];

    for (let s = 0; s < ringCount; s++) {
      pos.push(bendX + section[s][0], y, section[s][1]);
      uvs.push(s / ringCount, v);
    }

    if (iy < segsY) {
      const b = iy * ringCount;
      const n = (iy + 1) * ringCount;
      for (let s = 0; s < ringCount; s++) {
        const ns = (s + 1) % ringCount;
        idx.push(b + s, n + s, n + ns, b + s, n + ns, b + ns);
      }
    }
  }

  // Cap base cleanly
  const baseCenterIdx = pos.length / 3;
  pos.push(0, yOffset, 0);
  uvs.push(0.5, 0);
  for (let s = 0; s < ringCount; s++) {
    const ns = (s + 1) % ringCount;
    idx.push(baseCenterIdx, ns, s);
  }

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  indexed.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  indexed.setIndex(idx);
  const crisp = indexed.toNonIndexed();
  indexed.dispose();
  crisp.computeVertexNormals();
  return crisp;
}

// 3. Sculpted Asymmetrical Cambered Wing Feather / Crystal Plume
export function buildSculptedFeatherGeo({
  length = 0.88,
  width = 0.14,
  thickness = 0.030,
  curveX = 0.08,
  camberZ = 0.035,
  segsY = 16,
} = {}) {
  const ringCount = 8;
  const pos = [];
  const uvs = [];
  const idx = [];

  for (let iy = 0; iy <= segsY; iy++) {
    const v = iy / segsY;
    const y = (v - 0.5) * length;
    const env = Math.pow(Math.sin(clamp(v, 0.002, 0.998) * Math.PI), 0.58) * (1.0 - v * 0.18);
    const wLead = width * 0.36 * env + 0.0015;
    const wTrail = width * 0.72 * env + 0.0015;
    const tz = thickness * (1.0 - v * 0.68) * env + 0.001;
    const cx = curveX * Math.pow(v, 1.65);
    const cz = camberZ * Math.sin(v * Math.PI);

    const ring = [
      [cx + wLead, y, cz],
      [cx + wLead * 0.35, y, cz + tz],
      [cx - wTrail * 0.25, y, cz + tz * 0.68],
      [cx - wTrail, y, cz - tz * 0.12],
      [cx - wTrail * 0.25, y, cz - tz * 0.55],
      [cx + wLead * 0.35, y, cz - tz * 0.85],
      [cx + wLead * 0.72, y, cz - tz * 0.35],
      [cx + wLead * 0.85, y, cz + tz * 0.35],
    ];
    for (let s = 0; s < ringCount; s++) {
      pos.push(ring[s][0], ring[s][1], ring[s][2]);
      uvs.push(s / ringCount, v);
    }
    if (iy < segsY) {
      const b = iy * ringCount, n = (iy + 1) * ringCount;
      for (let s = 0; s < ringCount; s++) {
        const ns = (s + 1) % ringCount;
        idx.push(b + s, n + s, n + ns, b + s, n + ns, b + ns);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// 4. Architectural Fluted / Solomonic Carved Pillar Column
export function buildFlutedColumnGeo({
  rBottom = 0.12,
  rTop = 0.098,
  height = 1.38,
  flutes = 10,
  fluteDepth = 0.014,
  twist = 0.35,
  radialSegs = 40,
  heightSegs = 20,
} = {}) {
  const pos = [];
  const uvs = [];
  const idx = [];
  const y0 = -height * 0.5;

  for (let iy = 0; iy <= heightSegs; iy++) {
    const v = iy / heightSegs;
    const y = y0 + v * height;
    const entasis = Math.sin(v * Math.PI) * 0.008;
    const baseR = lerp(rBottom, rTop, v) + entasis;
    const fluteFade = Math.sin(clamp((v - 0.06) / 0.88, 0, 1) * Math.PI);

    for (let ir = 0; ir <= radialSegs; ir++) {
      const u = ir / radialSegs;
      const a = u * TAU;
      const groove = Math.max(0, Math.cos((a + v * twist) * flutes));
      const r = baseR - groove * fluteDepth * fluteFade;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uvs.push(u, v);
    }
  }
  const row = radialSegs + 1;
  for (let iy = 0; iy < heightSegs; iy++) {
    for (let ir = 0; ir < radialSegs; ir++) {
      const a = iy * row + ir, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// 5. Parallel-Transport Organic Swept Horn / Living Root / Branch Tube
export function buildOrganicSweepTubeGeo({
  points = [],
  r0 = 0.055,
  r1 = 0.004,
  radialSegs = 12,
  tubularSegs = 28,
  ridgeCount = 5,
  ridgeAmp = 0.16,
  twistTurns = 0.65,
} = {}) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const pos = [];
  const uvs = [];
  const idx = [];
  const pt = new THREE.Vector3();

  for (let it = 0; it <= tubularSegs; it++) {
    const v = it / tubularSegs;
    curve.getPointAt(v, pt);
    const N = frames.normals[it];
    const B = frames.binormals[it];
    const baseR = lerp(r0, r1, Math.pow(v, 0.82));

    for (let ir = 0; ir <= radialSegs; ir++) {
      const u = ir / radialSegs;
      const a = u * TAU;
      const ridge = 1.0 + ridgeAmp * Math.cos(a * ridgeCount + v * twistTurns * TAU) * (1.0 - v * 0.45);
      const r = Math.max(0.001, baseR * ridge);
      const cs = Math.cos(a) * r;
      const sn = Math.sin(a) * r;
      pos.push(
        pt.x + N.x * cs + B.x * sn,
        pt.y + N.y * cs + B.y * sn,
        pt.z + N.z * cs + B.z * sn
      );
      uvs.push(u, v);
    }
  }

  const row = radialSegs + 1;
  for (let it = 0; it < tubularSegs; it++) {
    for (let ir = 0; ir < radialSegs; ir++) {
      const a = it * row + ir, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// 6. Sculpted Anatomical Draconic Cranium & Snout Loft (+Z forward)
export function buildDragonSkullLoftGeo({ isJaw = false } = {}) {
  const stations = isJaw
    ? [
        { z: -0.14, wx: 0.22, hy: 0.08, yOff: -0.10, ridge: 0.02 },
        { z:  0.04, wx: 0.24, hy: 0.10, yOff: -0.14, ridge: 0.04 },
        { z:  0.24, wx: 0.18, hy: 0.08, yOff: -0.16, ridge: 0.05 },
        { z:  0.44, wx: 0.12, hy: 0.06, yOff: -0.15, ridge: 0.03 },
        { z:  0.58, wx: 0.05, hy: 0.035, yOff: -0.12, ridge: 0.01 },
      ]
    : [
        { z: -0.32, wx: 0.26, hy: 0.18, yOff: 0.14, ridge: 0.06 },
        { z: -0.10, wx: 0.34, hy: 0.22, yOff: 0.16, ridge: 0.10 },
        { z:  0.14, wx: 0.26, hy: 0.17, yOff: 0.12, ridge: 0.08 },
        { z:  0.38, wx: 0.19, hy: 0.13, yOff: 0.08, ridge: 0.06 },
        { z:  0.58, wx: 0.13, hy: 0.09, yOff: 0.05, ridge: 0.04 },
        { z:  0.68, wx: 0.04, hy: 0.04, yOff: 0.03, ridge: 0.01 },
      ];

  const radial = 16;
  const pos = [];
  const uvs = [];
  const idx = [];

  for (let iz = 0; iz < stations.length; iz++) {
    const st = stations[iz];
    const v = iz / (stations.length - 1);
    for (let ir = 0; ir <= radial; ir++) {
      const u = ir / radial;
      const a = u * TAU;
      const browFlair = !isJaw ? Math.pow(Math.max(0, Math.sin(a)), 2) * st.ridge : -Math.pow(Math.max(0, -Math.sin(a)), 2) * st.ridge;
      const cheekFlair = Math.pow(Math.abs(Math.cos(a)), 3) * st.ridge * 0.85;
      const x = Math.cos(a) * (st.wx + cheekFlair);
      const y = st.yOff + Math.sin(a) * st.hy + browFlair;
      pos.push(x, y, st.z);
      uvs.push(u, v);
    }
  }
  const row = radial + 1;
  for (let iz = 0; iz < stations.length - 1; iz++) {
    for (let ir = 0; ir < radial; ir++) {
      const a = iz * row + ir, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
