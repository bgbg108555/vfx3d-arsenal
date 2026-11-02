import * as THREE from 'three';
import {
  TAU, clamp, PAL3D, rampToColors,
  SlashArc3D, GroundWave3D, VortexFunnel3D,
  makeCraggyRockGeo, makeMagmaRockMaterial, makeTranslucentConstructMaterial,
} from './core3d.js';
import { getTexLib, resolveFlipbookTex } from './texgen3d.js';
import {
  buildTowerShieldAssembly,
  buildSpiritSwordAssembly,
  buildWarhammerAssembly,
  buildMagmaMeteorAssembly,
  buildArrowAssembly,
  buildReaperScytheAssembly,
  buildArmillaryAstrolabeAssembly,
  buildSeraphWingsAssembly,
  buildDragonSpiritHeadAssembly,
  buildHolyChaliceAssembly,
  buildTotemObeliskAssembly,
  buildChainStrandAssembly,
  buildQimenCompassAssembly,
  buildImmortalAzureGreatswordAssembly,
  buildSolomonSummonGateAssembly,
  buildGlacierPrismGolemAssembly,
  buildWorldTreeStaffAssembly,
  buildSeraphResurrectionAnkhAssembly,
} from './mesh_props3d.js';

// Helper builders for the 6 additional core VFX 3D Geometry Assets (12 props + 6 core VFX 3D meshes = 18 total!)
function buildGlacierClusterAssembly({ palette = PAL3D.mageFrost, scale = 1.0 } = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);

  const iceMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: 'glacier', useHexLattice: false,
    baseAlpha: 0.28, rimAlpha: 0.96, rimPower: 1.75, hdr: 2.25, additive: true,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.9),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(iceMat, coreMat);

  // Double-terminated hexagonal crystal prism
  const makePrism = (r, h) => {
    const g = new THREE.CylinderGeometry(r * 0.72, r, h * 0.68, 6);
    g.translate(0, h * 0.34, 0);
    const tip = new THREE.ConeGeometry(r * 0.72, h * 0.36, 6);
    tip.translate(0, h * 0.86, 0);
    return [g, tip];
  };

  const specs = [
    { h: 1.55, r: 0.20, rx: 0.04, rz: -0.03, x: 0, z: 0 },
    { h: 1.18, r: 0.15, rx: 0.36, rz: 0.28, x: -0.22, z: 0.14 },
    { h: 1.24, r: 0.16, rx: -0.32, rz: -0.34, x: 0.24, z: -0.12 },
    { h: 0.96, r: 0.13, rx: 0.48, rz: -0.26, x: 0.16, z: 0.22 },
    { h: 0.92, r: 0.12, rx: -0.44, rz: 0.38, x: -0.20, z: -0.20 },
    { h: 0.74, r: 0.11, rx: 0.62, rz: 0.12, x: 0.02, z: 0.28 },
    { h: 0.70, r: 0.10, rx: -0.58, rz: -0.15, x: -0.04, z: -0.28 },
  ];

  for (const sp of specs) {
    const holder = new THREE.Group();
    const [shaftG, tipG] = makePrism(sp.r, sp.h);
    geos.push(shaftG, tipG);
    holder.add(new THREE.Mesh(shaftG, iceMat), new THREE.Mesh(tipG, iceMat));
    holder.position.set(sp.x, -0.55, sp.z);
    holder.rotation.set(sp.rx, 0, sp.rz);
    group.add(holder);
  }

  const baseRingG = new THREE.TorusGeometry(0.56, 0.018, 8, 42);
  baseRingG.rotateX(Math.PI / 2);
  geos.push(baseRingG);
  const baseRing = new THREE.Mesh(baseRingG, coreMat);
  baseRing.position.y = -0.48;
  group.add(baseRing);

  group.scale.setScalar(scale);
  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      iceMat.uniforms.uTime.value = t * 2.0;
      baseRing.rotation.z += dt * 1.8;
    },
    setOpacity(a) {
      iceMat.uniforms.uOpacity.value = a;
      coreMat.opacity = a * 0.85;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

function buildManifoldSlashShowcase({ palette = PAL3D.mageArcane, scale = 1.0 } = {}) {
  const group = new THREE.Group();
  const slashA = new SlashArc3D({
    center: [0, 0.05, 0], radius: 0.96, width: 0.52, thickness: 0.16,
    a0: -1.35, a1: 1.35, tiltX: 0.26, tiltZ: -0.18,
    sweep: 0.08, hold: 999, trail: 0.25,
    palette, defaultTex: 'flame', hdrBoost: 2.35, seed: 7,
  });
  const slashB = new SlashArc3D({
    center: [0, -0.05, 0], radius: 0.78, width: 0.38, thickness: 0.12,
    a0: 1.35, a1: -1.15, tiltX: -0.36, tiltZ: 0.28,
    sweep: 0.08, hold: 999, trail: 0.25,
    palette, defaultTex: 'frost', hdrBoost: 2.1, seed: 19,
  });
  slashA.t = 0.14; slashA.update(0);
  slashB.t = 0.14; slashB.update(0);
  group.add(slashA.group, slashB.group);
  group.scale.setScalar(scale);

  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      const ageAnim = 0.22 + (Math.sin(t * 2.4) * 0.5 + 0.5) * 0.24;
      for (const s of [slashA, slashB]) {
        for (const m of [s.outerHorn, s.coreHorn]) {
          m.material.uniforms.uAge.value = ageAnim;
        }
      }
    },
    setOpacity() {},
    dispose() { slashA.dispose(); slashB.dispose(); },
  };
}

function buildCrownShockwaveShowcase({ palette = PAL3D.earthMagma, scale = 1.0 } = {}) {
  const group = new THREE.Group();
  const wave = new GroundWave3D({
    x: 0, z: 0, y: -0.26, maxRadius: 1.02, thickness: 0.36, height: 0.62,
    duration: 1.0, palette, hdr: 2.15, seed: 14,
  });
  wave.t = 0.26;
  wave.update(0);
  group.add(wave.group);
  group.scale.setScalar(scale);

  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      wave.t = 0.24 + (Math.sin(t * 2.2) * 0.5 + 0.5) * 0.18;
      wave.update(0);
    },
    setOpacity() {},
    dispose() { wave.dispose(); },
  };
}

function buildVortexFunnelShowcase({ palette = PAL3D.windJade, scale = 1.0 } = {}) {
  const group = new THREE.Group();
  const funnel = new VortexFunnel3D({
    x: 0, y: -0.76, z: 0, rBottom: 0.28, rTop: 0.86, height: 1.56,
    duration: 2.0, spinSpeed: 7.5, palette, defaultTex: 'silk', hdr: 2.1,
  });
  funnel.t = 0.55;
  funnel.update(0);
  group.add(funnel.group);
  group.scale.setScalar(scale);

  let t = 0.55;
  return {
    group,
    update(dt = 0) {
      t += dt;
      for (const L of [funnel.outer, funnel.inner]) {
        L.mat.uniforms.uTime.value = t;
        L.mat.uniforms.uLifeFrac.value = 0.35;
      }
    },
    setOpacity() {},
    dispose() { funnel.dispose(); },
  };
}

function buildBlackholeCoreAssembly({ palette = PAL3D.voidAbyss, scale = 1.0 } = {}) {
  const group = new THREE.Group();
  const geos = [], mats = [];
  const ramp = rampToColors(palette, 7);
  const lib = getTexLib();

  const horizonGeo = new THREE.IcosahedronGeometry(0.36, 3);
  const horizonMat = new THREE.MeshBasicMaterial({ color: 0x030108 });
  const rimGeo = new THREE.IcosahedronGeometry(0.40, 3);
  const rimMat = makeTranslucentConstructMaterial({
    palette, sigilStyle: 'demonGate', useHexLattice: false,
    baseAlpha: 0.10, rimAlpha: 0.98, rimPower: 1.65, hdr: 2.45, additive: true,
  });

  const diskGeo = new THREE.RingGeometry(0.44, 1.08, 64, 4);
  diskGeo.rotateX(-Math.PI / 2);
  const diskMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uNoise: { value: lib.flowNoise },
      uColA: { value: ramp[3] },
      uColB: { value: ramp[6] },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vPos; void main(){ vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; varying vec3 vPos;
      uniform float uTime; uniform sampler2D uNoise; uniform vec3 uColA, uColB;
      void main() {
        float r = length(vPos.xz);
        float u = clamp((r - 0.44) / 0.64, 0.0, 1.0);
        float ang = atan(vPos.z, vPos.x);
        vec2 suv = vec2(ang / 6.2831853 + uTime * 0.45 - u * 0.65, u * 1.6 - uTime * 0.25);
        float n = texture2D(uNoise, suv).r;
        float band = sin((u * 16.0 - uTime * 6.0 + n * 4.0)) * 0.5 + 0.5;
        float fade = sin(u * 3.14159265) * (1.0 - u * 0.35);
        vec3 col = mix(uColA, uColB, smoothstep(0.25, 0.92, (1.0 - u) * 0.7 + band * 0.45)) * (1.5 + n * 1.4);
        gl_FragColor = vec4(col, clamp(fade * (0.45 + n * 0.65), 0.0, 1.0));
      }
    `,
  });

  const jetGeo = new THREE.ConeGeometry(0.18, 1.45, 20, 1, true);
  const jetMat = new THREE.MeshBasicMaterial({
    color: ramp[5].clone().multiplyScalar(1.8),
    transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });

  geos.push(horizonGeo, rimGeo, diskGeo, jetGeo);
  mats.push(horizonMat, rimMat, diskMat, jetMat);

  const diskHolder = new THREE.Group();
  diskHolder.rotation.set(0.32, 0, -0.22);
  diskHolder.add(new THREE.Mesh(diskGeo, diskMat));

  const jetTop = new THREE.Mesh(jetGeo, jetMat);
  jetTop.position.y = 0.72;
  const jetBot = new THREE.Mesh(jetGeo, jetMat);
  jetBot.rotation.x = Math.PI;
  jetBot.position.y = -0.72;
  diskHolder.add(jetTop, jetBot);

  group.add(new THREE.Mesh(horizonGeo, horizonMat), new THREE.Mesh(rimGeo, rimMat), diskHolder);
  group.scale.setScalar(scale);

  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      rimMat.uniforms.uTime.value = t * 2.4;
      diskMat.uniforms.uTime.value = t;
      jetTop.rotation.y += dt * 5.0;
      jetBot.rotation.y -= dt * 5.0;
    },
    setOpacity(a) {
      rimMat.uniforms.uOpacity.value = a;
      jetMat.opacity = a * 0.42;
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

function buildGeodesicFlipbookShowcase({ palette = PAL3D.fireInferno, scale = 1.0 } = {}) {
  const group = new THREE.Group();
  const pos = [], norm = [], uvs = [], idx = [];
  const orientations = [
    new THREE.Euler(0, 0, 0),
    new THREE.Euler(0, Math.PI / 3, 0),
    new THREE.Euler(0, (2 * Math.PI) / 3, 0),
    new THREE.Euler(Math.PI * 0.46, 0.35, 0),
  ];
  const seg = 5;
  let vOffset = 0;
  const vTmp = new THREE.Vector3(), nTmp = new THREE.Vector3();
  for (const eu of orientations) {
    const q = new THREE.Quaternion().setFromEuler(eu);
    for (let iy = 0; iy <= seg; iy++) {
      const v = iy / seg, py = (v - 0.5) * 1.45;
      for (let ix = 0; ix <= seg; ix++) {
        const u = ix / seg, px = (u - 0.5) * 1.45;
        const bow = 0.18 * Math.cos((u - 0.5) * Math.PI) * Math.cos((v - 0.5) * Math.PI);
        vTmp.set(px, py, bow).applyQuaternion(q);
        nTmp.set(px * 0.28, py * 0.28, 1.0).normalize().applyQuaternion(q);
        pos.push(vTmp.x, vTmp.y, vTmp.z);
        norm.push(nTmp.x, nTmp.y, nTmp.z);
        uvs.push(u, v);
      }
    }
    const row = seg + 1;
    for (let iy = 0; iy < seg; iy++) {
      for (let ix = 0; ix < seg; ix++) {
        const a = vOffset + iy * row + ix, b = a + 1, c = a + row, d = c + 1;
        idx.push(a, b, d, a, d, c);
      }
    }
    vOffset += row * row;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);

  const ramp = rampToColors(palette, 7);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: {
      uAtlas: { value: resolveFlipbookTex('fbFlame') },
      uFrame: { value: 0 },
      uColMid: { value: ramp[3] },
      uColHot: { value: ramp[6] },
    },
    vertexShader: `
      varying vec2 vUv; varying vec3 vWPos; varying vec3 vWNorm;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        vWNorm = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec2 vUv; varying vec3 vWPos; varying vec3 vWNorm;
      uniform sampler2D uAtlas; uniform float uFrame; uniform vec3 uColMid, uColHot;
      void main() {
        float fi = mod(floor(uFrame), 16.0);
        float col = mod(fi, 4.0);
        float row = 3.0 - floor(fi / 4.0);
        vec2 cellUv = (vec2(col, row) + clamp(vUv, 0.02, 0.98)) * 0.25;
        vec4 tx = texture2D(uAtlas, cellUv);
        vec3 V = normalize(cameraPosition - vWPos);
        float facing = smoothstep(0.14, 0.62, abs(dot(normalize(vWNorm), V)));
        float a = tx.a * facing * 0.95;
        if (a < 0.01) discard;
        vec3 c = mix(tx.rgb * uColMid * 1.5, uColHot * 2.1, smoothstep(0.65, 0.98, max(tx.r, tx.g)));
        gl_FragColor = vec4(c, a);
      }
    `,
  });

  const cageGeo = new THREE.WireframeGeometry(geo);
  const cageMat = new THREE.LineBasicMaterial({ color: 0x62d8ff, transparent: true, opacity: 0.26 });
  group.add(new THREE.Mesh(geo, mat), new THREE.LineSegments(cageGeo, cageMat));
  group.scale.setScalar(scale);

  let t = 0;
  return {
    group,
    update(dt = 0) {
      t += dt;
      mat.uniforms.uAtlas.value = resolveFlipbookTex('fbFlame');
      mat.uniforms.uFrame.value = (t * 18.0) % 16;
    },
    setOpacity() {},
    dispose() { geo.dispose(); mat.dispose(); cageGeo.dispose(); cageMat.dispose(); },
  };
}

// ============================================================================
// Master Catalog of All 18 Sculpted 3D Geometry Assets
// ============================================================================
export const MESH_GALLERY_ITEMS = [
  {
    id: 'aegis_shield',
    title: '玫瑰聖光塔盾',
    sub: '弧面菲涅爾護盾 + 聖紋投影',
    defaultPal: 'holyGold',
    camDist: 2.85, camY: 0.95, lookY: 0.02,
    build: (pal) => buildTowerShieldAssembly({ palette: pal, scale: 0.92, sigilStyle: 'holy' }),
  },
  {
    id: 'spirit_greatsword',
    title: '星月聖裁巨劍',
    sub: '四稜鑽石劍刃 + 十字護手',
    defaultPal: 'holyGold',
    camDist: 3.15, camY: 1.05, lookY: 0.15,
    build: (pal) => {
      const a = buildSpiritSwordAssembly({ palette: pal, scale: 0.86 });
      a.group.position.y = -0.58;
      a.group.rotation.z = -0.28;
      return a;
    },
  },
  {
    id: 'storm_warhammer',
    title: '雷鳴破城戰鎚',
    sub: '雙錐鎚頭 + 旋轉電漿線圈',
    defaultPal: 'mageVolt',
    camDist: 3.05, camY: 1.05, lookY: 0.12,
    build: (pal) => {
      const a = buildWarhammerAssembly({ palette: pal, scale: 0.88 });
      a.group.position.y = -0.62;
      a.group.rotation.z = -0.26;
      return a;
    },
  },
  {
    id: 'reaper_scythe',
    title: '血月斷魂巨鐮',
    sub: '曲柄彎月四稜刃 + 背脊骨刺',
    defaultPal: 'rogueBlood',
    camDist: 3.10, camY: 1.02, lookY: 0.08,
    build: (pal) => {
      const a = buildReaperScytheAssembly({ palette: pal, scale: 0.92 });
      a.group.position.x = -0.18;
      return a;
    },
  },
  {
    id: 'dragon_head',
    title: '盤龍蒼炎龍首',
    sub: '雙角龍顱 + 開合顎 + 龍珠',
    defaultPal: 'fireInferno',
    camDist: 2.55, camY: 0.92, lookY: 0.12,
    build: (pal) => buildDragonSpiritHeadAssembly({ palette: pal, scale: 1.35 }),
  },
  {
    id: 'seraph_wings',
    title: '十二羽熾天聖翼',
    sub: '12 羽獨立律動光翼 + 光輪',
    defaultPal: 'holyGold',
    camDist: 2.95, camY: 0.88, lookY: 0.06,
    build: (pal) => buildSeraphWingsAssembly({ palette: pal, scale: 1.02 }),
  },
  {
    id: 'armillary_astrolabe',
    title: '三軸星盤陀螺儀',
    sub: '三環咬合齒輪 + 雙八面星核',
    defaultPal: 'warriorGold',
    camDist: 2.65, camY: 0.95, lookY: 0.0,
    build: (pal) => buildArmillaryAstrolabeAssembly({ palette: pal, scale: 1.08 }),
  },
  {
    id: 'magma_meteor',
    title: '黑曜熔核隕石',
    sub: '碎裂玄武岩殼 + 3D 熔岩裂縫',
    defaultPal: 'fireInferno',
    camDist: 2.55, camY: 0.90, lookY: 0.0,
    build: (pal) => buildMagmaMeteorAssembly({ radius: 0.68, palette: pal, seed: 19 }),
  },
  {
    id: 'dragon_arrow',
    title: '馬赫音爆巨箭',
    sub: '破甲箭簇 + 反向馬赫音爆錐',
    defaultPal: 'windJade',
    camDist: 2.45, camY: 0.85, lookY: 0.02,
    build: (pal) => {
      const a = buildArrowAssembly({ palette: pal, scale: 1.48, heavy: true });
      a.group.rotation.z = -0.48;
      return a;
    },
  },
  {
    id: 'holy_chalice',
    title: '車削祝聖聖杯',
    sub: 'Lathe 車削杯身 + 懸浮聖滴',
    defaultPal: 'holyGold',
    camDist: 2.50, camY: 0.92, lookY: 0.05,
    build: (pal) => buildHolyChaliceAssembly({ palette: pal, scale: 1.15 }),
  },
  {
    id: 'runic_obelisk',
    title: '浮空符文方尖碑',
    sub: '六方尖碑 + 懸浮頂石雙星環',
    defaultPal: 'warriorSilver',
    camDist: 3.05, camY: 1.15, lookY: 0.15,
    build: (pal) => {
      const a = buildTotemObeliskAssembly({ palette: pal, scale: 0.86 });
      a.group.position.y = -0.88;
      return a;
    },
  },
  {
    id: 'soul_chain',
    title: '鎖魂倒鉤魚叉鏈',
    sub: '90° 交錯 3D 鐵環 + 倒鉤尖頭',
    defaultPal: 'voidAbyss',
    camDist: 2.85, camY: 1.05, lookY: 0.0,
    build: (pal) => buildChainStrandAssembly(
      new THREE.Vector3(-0.92, -0.42, -0.25),
      new THREE.Vector3(0.88, 0.46, 0.28),
      { sag: 0.22, linkCount: 14, palette: pal }
    ),
  },
  {
    id: 'glacier_cluster',
    title: '六方雙尖冰晶簇',
    sub: '7 簇放射六角冰晶 + 菲涅爾',
    defaultPal: 'mageFrost',
    camDist: 2.65, camY: 0.98, lookY: 0.08,
    build: (pal) => buildGlacierClusterAssembly({ palette: pal, scale: 0.96 }),
  },
  {
    id: 'manifold_slash',
    title: '封閉四稜刀光體',
    sub: '雙層立體厚度彎月刀刃網格',
    defaultPal: 'mageArcane',
    camDist: 2.75, camY: 1.25, lookY: 0.0,
    build: (pal) => buildManifoldSlashShowcase({ palette: pal, scale: 0.95 }),
  },
  {
    id: 'crown_shockwave',
    title: '皇冠碎地激波環',
    sub: '雙環擴散面 + 14 尖刺裙擺',
    defaultPal: 'earthMagma',
    camDist: 2.75, camY: 1.35, lookY: -0.05,
    build: (pal) => buildCrownShockwaveShowcase({ palette: pal, scale: 1.02 }),
  },
  {
    id: 'vortex_funnel',
    title: '雙層龍捲風漏斗',
    sub: '內外反向旋轉氣旋流體圓台',
    defaultPal: 'windJade',
    camDist: 2.85, camY: 1.02, lookY: 0.0,
    build: (pal) => buildVortexFunnelShowcase({ palette: pal, scale: 0.95 }),
  },
  {
    id: 'blackhole_core',
    title: '黑洞視界吸積盤',
    sub: '事件視界球 + 相對論雙噴流',
    defaultPal: 'voidAbyss',
    camDist: 2.75, camY: 1.08, lookY: 0.0,
    build: (pal) => buildBlackholeCoreAssembly({ palette: pal, scale: 0.96 }),
  },
  {
    id: 'geodesic_flipvol',
    title: '四殼測地線體積網',
    sub: '三向 60° 弧殼 + 俯視頂殼',
    defaultPal: 'fireInferno',
    camDist: 2.65, camY: 1.02, lookY: 0.0,
    build: (pal) => buildGeodesicFlipbookShowcase({ palette: pal, scale: 0.95 }),
  },
  {
    id: 'qimen_compass',
    title: '奇門外圓內方羅盤樞',
    sub: '大馬士革鋼 + 帝王玉浮雕 Shader',
    defaultPal: 'holyGold',
    camDist: 2.55, camY: 1.18, lookY: 0.02,
    build: (pal) => buildQimenCompassAssembly({ palette: pal, scale: 1.02 }),
  },
  {
    id: 'immortal_azure_greatsword',
    title: '太虛鎮嶽青龍神劍',
    sub: '大馬士革鍛紋血槽 + 雙龍護手',
    defaultPal: 'windJade',
    camDist: 2.85, camY: 0.95, lookY: 0.16,
    build: (pal) => buildImmortalAzureGreatswordAssembly({ palette: pal, scale: 0.96 }),
  },
  {
    id: 'solomon_summon_gate',
    title: '所羅門黑曜召喚門',
    sub: '黑曜熔岩浮雕雙柱 + 裂隙漩渦',
    defaultPal: 'voidAbyss',
    camDist: 2.88, camY: 0.98, lookY: 0.08,
    build: (pal) => buildSolomonSummonGateAssembly({ palette: pal, scale: 0.94 }),
  },
  {
    id: 'glacier_prism_golem',
    title: '極淵六稜寒晶魔像核',
    sub: '深海藍寶石焦散微浮雕裝甲',
    defaultPal: 'mageFrost',
    camDist: 2.68, camY: 0.98, lookY: 0.12,
    build: (pal) => buildGlacierPrismGolemAssembly({ palette: pal, scale: 0.98 }),
  },
  {
    id: 'world_tree_staff',
    title: '世界樹翡翠生命法杖',
    sub: '三股盤根活木 + 懸浮翡翠心',
    defaultPal: 'mageEmerald',
    camDist: 2.75, camY: 0.95, lookY: 0.05,
    build: (pal) => buildWorldTreeStaffAssembly({ palette: pal, scale: 0.96 }),
  },
  {
    id: 'seraph_resurrection_ankh',
    title: '熾天甦生聖十字聖物',
    sub: '導角黃金安卡 + 6羽光翼核心',
    defaultPal: 'holyGold',
    camDist: 2.68, camY: 0.94, lookY: 0.04,
    build: (pal) => buildSeraphResurrectionAnkhAssembly({ palette: pal, scale: 0.98 }),
  },
];

function computeTopologyStats(root) {
  let verts = 0, tris = 0, meshes = 0;
  root.traverse((obj) => {
    if ((obj.isMesh || obj.isInstancedMesh) && obj.geometry) {
      meshes++;
      const countMul = obj.isInstancedMesh ? (obj.count || 1) : 1;
      const pos = obj.geometry.attributes?.position;
      const idx = obj.geometry.index;
      if (pos) verts += pos.count * countMul;
      if (idx) tris += Math.floor(idx.count / 3) * countMul;
      else if (pos) tris += Math.floor(pos.count / 3) * countMul;
    }
  });
  return { verts, tris, meshes };
}

function attachWireframeOverlay(root) {
  const disposables = [];
  const wireGroup = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x7ef0ff,
    transparent: true,
    opacity: 0.72,
    depthTest: true,
  });
  disposables.push(lineMat);

  root.updateMatrixWorld(true);
  const invRoot = root.matrixWorld.clone().invert();

  root.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      const wfGeo = new THREE.WireframeGeometry(obj.geometry);
      disposables.push(wfGeo);
      const seg = new THREE.LineSegments(wfGeo, lineMat);
      seg.matrixAutoUpdate = false;
      seg.matrix.copy(invRoot).multiply(obj.matrixWorld);
      wireGroup.add(seg);
    }
  });
  root.add(wireGroup);
  return {
    wireGroup,
    dispose() {
      root.remove(wireGroup);
      disposables.forEach((d) => d.dispose());
    },
  };
}

// ============================================================================
// Live Right-Side 3D Geometry Turntable + Thumbnail Baker + Main-Stage Solo Inspect
// ============================================================================
export class MeshGalleryTurntable {
  constructor(canvas, { onSelect = null, onSoloChange = null } = {}) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.onSoloChange = onSoloChange;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b14);

    this.camera = new THREE.PerspectiveCamera(40, 2.0, 0.1, 40);

    // Studio 3-point lighting + subtle holographic pedestal ring
    const amb = new THREE.HemisphereLight(0x8bb8ff, 0x121828, 1.35);
    const key = new THREE.DirectionalLight(0xfff4df, 1.85);
    key.position.set(2.8, 4.2, 3.2);
    const rim = new THREE.DirectionalLight(0x52c8ff, 1.35);
    rim.position.set(-3.0, 2.2, -2.6);
    this.scene.add(amb, key, rim);

    const pedGroup = new THREE.Group();
    pedGroup.position.y = -0.82;
    const ringOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 0.96, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.36, side: THREE.DoubleSide })
    );
    const ringInner = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.54, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.24, side: THREE.DoubleSide })
    );
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.92, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x0d1729, transparent: true, opacity: 0.72 })
    );
    disc.position.y = -0.005;
    pedGroup.add(disc, ringOuter, ringInner);
    this.scene.add(pedGroup);
    this.pedGroup = pedGroup;

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this.currentId = MESH_GALLERY_ITEMS[0].id;
    this.currentAssembly = null;
    this.wireOverlay = null;
    this.wireframeMode = false;
    this.paletteOverride = null;
    this.stats = { verts: 0, tris: 0, meshes: 0 };

    // Orbit state for dragging directly on the right-side 3D canvas
    this.yaw = 0.45;
    this.pitch = 0.24;
    this.zoom = 1.0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

    // Optional solo projection in main 3D arena
    this.mainScene = null;
    this.soloActive = false;
    this.soloHolder = null;
    this.soloAssembly = null;
    this.soloWire = null;

    this._bindEvents();
    this.resize();
    this.select(this.currentId);
  }

  _bindEvents() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      cv.setPointerCapture?.(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.yaw += dx * 0.014;
      this.pitch = clamp(this.pitch + dy * 0.010, -0.45, 0.95);
    });
    const endDrag = () => { this.dragging = false; };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = clamp(this.zoom + Math.sign(e.deltaY) * 0.10, 0.65, 1.55);
    }, { passive: false });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(240, Math.round(rect.width || 356));
    const h = Math.max(130, Math.round(rect.height || 168));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  getItem(id = this.currentId) {
    return MESH_GALLERY_ITEMS.find((x) => x.id === id) || MESH_GALLERY_ITEMS[0];
  }

  _resolvePalette(item) {
    if (this.paletteOverride && PAL3D[this.paletteOverride]) return PAL3D[this.paletteOverride];
    return PAL3D[item.defaultPal] || PAL3D.holyGold;
  }

  _disposeCurrent() {
    if (this.wireOverlay) {
      this.wireOverlay.dispose();
      this.wireOverlay = null;
    }
    if (this.currentAssembly) {
      this.pivot.remove(this.currentAssembly.group);
      this.currentAssembly.dispose?.();
      this.currentAssembly = null;
    }
  }

  select(id) {
    const item = this.getItem(id);
    this.currentId = item.id;
    this._disposeCurrent();

    const pal = this._resolvePalette(item);
    const asm = item.build(pal);
    this.currentAssembly = asm;
    this.pivot.add(asm.group);
    asm.update?.(0.016);

    this.stats = computeTopologyStats(asm.group);
    if (this.wireframeMode) {
      this.wireOverlay = attachWireframeOverlay(asm.group);
    }

    if (this.soloActive && this.mainScene) {
      this._rebuildSoloInMainScene();
    }

    this.onSelect?.(item, this.stats);
  }

  setPaletteOverride(palKey) {
    this.paletteOverride = palKey;
    this.select(this.currentId);
  }

  setWireframe(flag) {
    this.wireframeMode = !!flag;
    this.select(this.currentId);
  }

  attachMainScene(scene) {
    this.mainScene = scene;
  }

  _clearSoloFromMainScene() {
    if (this.soloWire) {
      this.soloWire.dispose();
      this.soloWire = null;
    }
    if (this.soloAssembly) {
      this.soloHolder?.remove(this.soloAssembly.group);
      this.soloAssembly.dispose?.();
      this.soloAssembly = null;
    }
    if (this.soloHolder && this.mainScene) {
      this.mainScene.remove(this.soloHolder);
      this.soloHolder = null;
    }
  }

  _rebuildSoloInMainScene() {
    this._clearSoloFromMainScene();
    if (!this.mainScene || !this.soloActive) return;
    const item = this.getItem(this.currentId);
    const pal = this._resolvePalette(item);
    this.soloHolder = new THREE.Group();
    this.soloHolder.position.set(0, 1.55, 2.2);
    this.soloHolder.scale.setScalar(1.85);
    this.soloAssembly = item.build(pal);
    this.soloHolder.add(this.soloAssembly.group);
    if (this.wireframeMode) {
      this.soloWire = attachWireframeOverlay(this.soloAssembly.group);
    }
    this.mainScene.add(this.soloHolder);
  }

  setSoloInMainScene(active) {
    this.soloActive = !!active;
    if (this.soloActive) this._rebuildSoloInMainScene();
    else this._clearSoloFromMainScene();
    this.onSoloChange?.(this.soloActive, this.getItem(this.currentId));
  }

  updateAndRender(dt) {
    const item = this.getItem(this.currentId);
    if (!this.dragging) {
      this.yaw += dt * 0.85;
    }
    this.pivot.rotation.set(0, this.yaw, 0);
    this.currentAssembly?.update?.(dt);

    const dist = (item.camDist || 2.8) * this.zoom;
    const cy = Math.sin(this.pitch) * dist + (item.lookY || 0) + 0.35;
    const cz = Math.cos(this.pitch) * dist;
    this.camera.position.set(0, cy, cz);
    this.camera.lookAt(0, item.lookY || 0, 0);

    this.renderer.render(this.scene, this.camera);

    if (this.soloActive && this.soloHolder && this.soloAssembly) {
      this.soloHolder.rotation.y += dt * 0.75;
      this.soloAssembly.update?.(dt);
    }
  }

  /**
   * Renders crisp 3D WebGL thumbnail DataURLs for all 18 3D Geometry Assets using THIS single WebGL context
   * (zero extra WebGL contexts needed!) and returns `{ thumbs, statsMap }`.
   */
  bakeAllThumbnails(thumbW = 144, thumbH = 98) {
    const prevId = this.currentId;
    const prevWire = this.wireframeMode;
    const prevYaw = this.yaw;
    const prevPitch = this.pitch;
    const prevZoom = this.zoom;

    this.wireframeMode = false;
    this.renderer.setSize(thumbW, thumbH, false);
    this.camera.aspect = thumbW / thumbH;
    this.camera.updateProjectionMatrix();

    const thumbs = {};
    const statsMap = {};
    for (const item of MESH_GALLERY_ITEMS) {
      this._disposeCurrent();
      const pal = PAL3D[item.defaultPal] || PAL3D.holyGold;
      const asm = item.build(pal);
      this.currentAssembly = asm;
      this.pivot.add(asm.group);
      this.pivot.rotation.set(0, 0.52, 0);
      asm.update?.(0.18);

      statsMap[item.id] = computeTopologyStats(asm.group);

      const dist = (item.camDist || 2.8) * 0.92;
      this.camera.position.set(0, (item.camY || 0.95) * 0.85, dist);
      this.camera.lookAt(0, item.lookY || 0, 0);
      this.renderer.render(this.scene, this.camera);
      thumbs[item.id] = this.canvas.toDataURL('image/webp', 0.86);
    }

    this.wireframeMode = prevWire;
    this.yaw = prevYaw;
    this.pitch = prevPitch;
    this.zoom = prevZoom;
    this.resize();
    this.select(prevId);
    return { thumbs, statsMap };
  }
}
