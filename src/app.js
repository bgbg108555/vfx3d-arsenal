import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { Sim3D, buildHitboxOverlay, getScaledHitbox, getEffectiveMoveHitbox, clamp, PAL3D, FX_CONFIG } from './core3d.js';
import { getTexLib, preloadTexLib, AI_TEXTURE_CATALOG } from './texgen3d.js';
import { BAKED_AI_TEXTURES } from './baked_textures.js';
import { AirDistortionPass } from './air_distort3d.js';
import { OverdrawHeatmapDebug3D } from './gamedev_algos3d.js';
import { CHARGE_VARIANTS_META, installChargeVariantHook } from './env_fx3d.js';
import { MESH_GALLERY_ITEMS, MeshGalleryTurntable } from './mesh_gallery3d.js';
import './magic_arrays3d.js';
import { Fighter3D, DummyTarget3D, AllyHero3D } from './actors3d.js';
import { CHANT_MODES_META, getEffectiveChantSpec, getMoveTimeOffset, createChantAwareSession } from './chant_system3d.js';
import { exportVfxPackage, triggerBrowserDownload } from './vfx_exporter3d.js';
import { MOVES_3D, CATEGORIES_3D } from './moves3d.js';
import {
  detectInitialLang, setActiveLang, CATEGORIES_I18N, CHANT_MODES_EN, CHARGE_VARIANTS_EN,
  UI_STRINGS, getMoveDisplayTitle, getMoveDisplayClass, getMoveDisplayNotes,
  getPropDisplay, getTexDisplay, formatHitboxMetricsI18n,
} from './i18n.js';

const params = new URLSearchParams(window.location.search);
let currentLang = setActiveLang(detectInitialLang(params));
const ui = () => UI_STRINGS[currentLang] || UI_STRINGS.en;
const contactParam = params.get('contact');
const montageParam = params.get('montage');
const isContactMode = contactParam !== null;
const isMontageMode = montageParam !== null;

const stageEl = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
stageEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f19);
scene.fog = new THREE.FogExp2(0x0b0f19, 0.011);

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.12, 165);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.maxPolarAngle = Math.PI * 0.498;
controls.minDistance = 0.8;
controls.maxDistance = 62;

// Lighting
const hemi = new THREE.HemisphereLight(0x8fb4ff, 0x181c2b, 1.18);
scene.add(hemi);
const dirKey = new THREE.DirectionalLight(0xfff2de, 1.65);
dirKey.position.set(-5, 9, -4);
scene.add(dirKey);
const dirRim = new THREE.DirectionalLight(0x5d8cff, 1.15);
dirRim.position.set(6, 5, 7);
scene.add(dirRim);

// Tactical 1m Arena Floor (44m x 44m 1m grid to comfortably host widened 6.5m~26m Cast Distance & 3.0x Range!)
const floorGeo = new THREE.CircleGeometry(48, 80);
floorGeo.rotateX(-Math.PI / 2);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x111726, roughness: 0.88, metalness: 0.12 });
const floorMesh = new THREE.Mesh(floorGeo, floorMat);
floorMesh.position.y = -0.005;
scene.add(floorMesh);

const grid = new THREE.GridHelper(44, 44, 0x2f4369, 0x1c2740);
grid.position.y = 0.002;
scene.add(grid);

const originRing = new THREE.Mesh(
  new THREE.RingGeometry(0.32, 0.36, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x4f75b8, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
);
originRing.position.y = 0.006;
scene.add(originRing);

const tickRings = [];
for (const r of [4.0, 8.0, 12.0, 16.0]) {
  const tickRing = new THREE.Mesh(
    new THREE.RingGeometry(r - 0.014, r + 0.014, 72).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x354d7a, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  );
  tickRing.position.y = 0.003;
  scene.add(tickRing);
  tickRings.push(tickRing);
}

// Core Actors (Caster + Enemy Dummies + 3 Friendly Party Heroes) & Sim3D
const fighter = new Fighter3D(scene);
const dummies = [
  new DummyTarget3D(scene, 0, 2.0),
  new DummyTarget3D(scene, -1.5, 3.5),
  new DummyTarget3D(scene, 1.5, 3.5),
];
const allies = [0, 1, 2].map((i) => new AllyHero3D(scene, i));
const sim = new Sim3D(scene, 7);
installChargeVariantHook(sim);

// Optional scene-depth pass for flipbook/volume particle intersections.
const depthResolution = renderer.getDrawingBufferSize(new THREE.Vector2());
const softDepthTarget = new THREE.WebGLRenderTarget(depthResolution.x, depthResolution.y, {
  depthBuffer: true,
  stencilBuffer: false,
});
softDepthTarget.depthTexture = new THREE.DepthTexture(depthResolution.x, depthResolution.y, THREE.UnsignedIntType);
const softDepthMaterial = new THREE.MeshDepthMaterial();
sim.setSoftDepthResources(softDepthTarget.depthTexture, depthResolution, camera.near, camera.far);

// Post-processing: HDR Bloom + Screen-Space Refractive Air Distortion Pass + ACES Output
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.22,
  0.24,
  0.95
);
const airDistortPass = new AirDistortionPass(sim.airDistort, camera, window.innerWidth, window.innerHeight);
const outputPass = new OutputPass();
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(airDistortPass);
composer.addPass(outputPass);

const overdrawDebug = new OverdrawHeatmapDebug3D(window.innerWidth, window.innerHeight);
let showOverdraw = false;
let smoothFrameMs = 2.4;
let lastDrawCalls = 0;

// State
let currentMoveIdx = 0;
let activeCat = 'all';
let searchQuery = '';
let seed = 7;
let paletteOverride = '';
let texStyleOverride = 'auto';
let showHitbox = true;
let showActors = true;
let playing = true;
let autoLoop = true;
let speed = 1.0;
let currentTime = 0;
let activeSession = null;
let hitboxMesh = null;
let currentCamPreset = 'iso';
let userFreeOrbit = false;
const activeDummyMask = [true, false, false];
const activeAllyMask = [false, false, false];

function renderSoftParticleDepth() {
  const previousTarget = renderer.getRenderTarget();
  const previousBackground = scene.background;
  const previousOverride = scene.overrideMaterial;
  const helpers = [sim.root, grid, originRing, ...tickRings, hitboxMesh].filter(Boolean);
  const previousVisibility = helpers.map((obj) => obj.visible);
  try {
    for (const obj of helpers) obj.visible = false;
    scene.background = null;
    scene.overrideMaterial = softDepthMaterial;
    renderer.setRenderTarget(softDepthTarget);
    renderer.clear();
    renderer.render(scene, camera);
  } finally {
    helpers.forEach((obj, i) => { obj.visible = previousVisibility[i]; });
    scene.background = previousBackground;
    scene.overrideMaterial = previousOverride;
    renderer.setRenderTarget(previousTarget);
  }
}

// Right-side Live 3D Geometry Turntable & Asset Dock state
let turntable = null;
let activeDockTab = 'mesh3d';
let activeTexCat = 'all';
let bakedMeshThumbs = {};
let bakedMeshStats = {};

const TIER_LABELS = {
  1: 'T1: SVG簡約向量',
  2: 'T2: 程序化Shader',
  3: 'T3: 高清風格貼圖',
  4: 'T4: 3A寫實+環境物理',
};

const DEF_FLIP_PAL = {
  fbFlame: 'fireInferno',
  fbExplosion: 'fireInferno',
  fbSmoke: 'earthMagma',
  fbLightning: 'mageVolt',
  fbSlash: 'windJade',
  fbHitBurst: 'warriorGold',
  fbMagicSwirl: 'mageArcane',
  fbLiquid: 'waterAqua',
  fbPoison: 'poison',
  fbBlessing: 'holyGold',
  fbStarburst: 'holyGold',
  fbIceShatter: 'mageFrost',
  fbRockBurst: 'earthMagma',
  fbWindTornado: 'windJade',
  fbDarkVortex: 'voidAbyss',
  fbFeatherBurst: 'holyGold',
  fbBloodSplash: 'rogueBlood',
};

function syncSliderProgress(el) {
  if (!el) return;
  el.style.setProperty('--attr-min', el.min || '0');
  el.style.setProperty('--attr-max', el.max || '100');
  el.style.setProperty('--control-value', el.value);
}

controls.addEventListener('start', () => {
  userFreeOrbit = true;
  document.querySelectorAll('[data-cam]').forEach((b) => b.classList.remove('active'));
});

function getMoveFraming(mv) {
  const hb = getEffectiveMoveHitbox(mv) || getScaledHitbox(mv.hitbox);
  if (!hb) return { centerZ: 3.4, distMul: 1.25, topH: 14.5, targetY: 1.08 };
  if (hb.kind === 'circle') {
    const cz = hb.cz ?? 0;
    const r = hb.radius ?? 3.0;
    if (cz < 0.5) {
      return {
        centerZ: 0.35,
        distMul: clamp(r / 3.2, 0.96, 2.35),
        topH: Math.max(10.8, r * 2.85),
        targetY: 1.05,
      };
    }
    return {
      centerZ: cz * 0.52,
      distMul: clamp((cz * 0.44 + r) / 4.2, 1.02, 3.15),
      topH: Math.max(13.5, (cz + r) * 1.65),
      targetY: 1.15,
    };
  }
  if (hb.kind === 'sector') {
    const r = hb.radius ?? 3.0;
    return {
      centerZ: r * 0.46,
      distMul: clamp(r / 3.2, 0.94, 2.45),
      topH: Math.max(10.6, r * 2.55),
      targetY: 1.02,
    };
  }
  if (hb.kind === 'rect') {
    const len = hb.length ?? 6.5;
    return {
      centerZ: len * 0.46,
      distMul: clamp(len / 5.4, 1.05, 3.15),
      topH: Math.max(13.5, len * 1.95),
      targetY: 1.10,
    };
  }
  if (hb.kind === 'chain' && hb.targets?.length) {
    const maxZ = Math.max(...hb.targets.map(([, tz]) => tz));
    return {
      centerZ: maxZ * 0.48,
      distMul: clamp(maxZ / 4.8, 1.05, 2.95),
      topH: Math.max(13.2, maxZ * 1.95),
      targetY: 1.10,
    };
  }
  return { centerZ: 3.4, distMul: 1.25, topH: 14.5, targetY: 1.08 };
}

function applyCameraPreset(preset) {
  currentCamPreset = preset;
  userFreeOrbit = false;
  const mv = MOVES_3D[currentMoveIdx];
  const { centerZ, distMul, topH, targetY } = getMoveFraming(mv);

  if (preset === 'iso') {
    camera.position.set(-5.2 * distMul, 5.2 * distMul, -2.8 * distMul + centerZ * 0.45);
    controls.target.set(0, targetY, centerZ);
  } else if (preset === 'top') {
    camera.position.set(0, topH, centerZ - 0.04);
    controls.target.set(0, 0.05, centerZ);
  } else if (preset === 'side') {
    camera.position.set(-6.6 * distMul, 1.32, centerZ);
    controls.target.set(0, targetY, centerZ);
  } else if (preset === 'front') {
    camera.position.set(2.9 * distMul, 2.15, centerZ + 4.9 * distMul);
    controls.target.set(0, targetY, centerZ * 0.65);
  }

  const prevDamp = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  camera.lookAt(controls.target);
  camera.updateMatrixWorld(true);
  controls.enableDamping = prevDamp;

  document.querySelectorAll('[data-cam]').forEach((b) => {
    b.classList.toggle('active', b.dataset.cam === preset);
  });
}

function syncActorVisibility() {
  const soloHide = Boolean(turntable?.soloActive);
  fighter.root.visible = !soloHide && showActors;
  dummies.forEach((d, idx) => {
    d.root.visible = !soloHide && showActors && activeDummyMask[idx];
  });
  allies.forEach((a, idx) => {
    a.root.visible = !soloHide && showActors && activeAllyMask[idx];
  });
  if (hitboxMesh) hitboxMesh.visible = !soloHide && showHitbox;
}

function getClipDuration(mv) {
  if (activeSession && activeSession.mv === mv) return activeSession.totalDuration;
  const chant = getEffectiveChantSpec(mv);
  const offset = getMoveTimeOffset(mv);
  const linger = FX_CONFIG.groundLingerScale ?? 1.65;
  const baseDur = chant.enabled ? Math.max(chant.duration + 0.45, mv.duration + offset) : mv.duration;
  return baseDur + Math.max(0, (linger - 1.0) * 1.35);
}

function updateChantMetricsUI(mv) {
  const el = document.getElementById('lbl-chant-metrics');
  if (!el || !mv) return;
  const spec = getEffectiveChantSpec(mv);
  const s = ui();
  if (!spec.enabled || spec.duration < 0.05) {
    el.textContent = s.chantInstant;
  } else {
    el.textContent = s.chantPreTpl(spec.duration.toFixed(2), spec.stages, spec.archetype === 'martial_qi');
  }
}

function formatHitboxMetrics(mv) {
  return formatHitboxMetricsI18n(mv, currentLang);
}

function rebuildHitbox() {
  if (hitboxMesh) {
    scene.remove(hitboxMesh);
    hitboxMesh = null;
  }
  const mv = MOVES_3D[currentMoveIdx];
  hitboxMesh = buildHitboxOverlay(mv.hitbox, mv);
  hitboxMesh.visible = !(turntable?.soloActive) && showHitbox;
  scene.add(hitboxMesh);
  const metricsEl = document.getElementById('lbl-scale-metrics');
  if (metricsEl) metricsEl.textContent = formatHitboxMetrics(mv);
  updateChantMetricsUI(mv);
}

function resetMoveState() {
  const mv = MOVES_3D[currentMoveIdx];
  const castHud = document.getElementById('cast-bar-hud');
  if (castHud) castHud.hidden = true;
  FX_CONFIG.paletteOverrideActive = Boolean(paletteOverride);

  activeSession = createChantAwareSession({
    mv,
    sim,
    fighter,
    dummies,
    allies,
    seed,
    paletteOverride: paletteOverride || null,
    texStyle: texStyleOverride || 'auto',
  });

  dummies.forEach((d, idx) => { activeDummyMask[idx] = d.root.visible; });
  allies.forEach((a, idx) => { activeAllyMask[idx] = a.root.visible; });
  syncActorVisibility();
  currentTime = 0;
  rebuildHitbox();
}

function stepTimeline(dt) {
  if (!activeSession) resetMoveState();
  activeSession.step(dt, camera);
  currentTime = activeSession.currentTime;
}

function seekToTime(targetT) {
  const mv = MOVES_3D[currentMoveIdx];
  const clamped = clamp(targetT, 0, getClipDuration(mv));
  resetMoveState();
  const step = 1 / 120;
  let t = 0;
  while (t + step <= clamped + 1e-7) {
    stepTimeline(step);
    t += step;
  }
  const rem = clamped - currentTime;
  if (rem > 1e-6) stepTimeline(rem);
}

// ============================================================================
// Right-Side Live 3D Geometry Showcase (18) & AI Texture Dock (54) + Full Dialog
// ============================================================================
let atlasBuilt = false;
const liveFlipPreviews = [];

function openAtlasDialogAndFocus(texKey = null) {
  const dlg = document.getElementById('atlas-dialog');
  if (!atlasBuilt) {
    buildAtlasCards();
    atlasBuilt = true;
  }
  if (!dlg.open) dlg.showModal();
  if (texKey) {
    const target = document.getElementById(`dlg-tex-${texKey}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('flash-focus');
      setTimeout(() => target.classList.remove('flash-focus'), 1500);
    }
  }
}

function switchDockTab(tab) {
  activeDockTab = (tab === 'tex54' || tab === 'tex66') ? 'tex54' : 'mesh3d';
  const paneMesh = document.getElementById('pane-mesh3d');
  const paneTex = document.getElementById('pane-tex54');
  paneMesh.hidden = activeDockTab !== 'mesh3d';
  paneTex.hidden = activeDockTab !== 'tex54';
  document.querySelectorAll('[data-dock-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.dockTab === activeDockTab);
  });
  if (activeDockTab === 'mesh3d' && turntable) {
    turntable.resize();
    turntable.updateAndRender(0.016);
  }
}

function renderRightTexGrid() {
  const gridEl = document.getElementById('right-tex-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';
  const items = activeTexCat === 'all'
    ? AI_TEXTURE_CATALOG
    : AI_TEXTURE_CATALOG.filter((it) => it.cat === activeTexCat);

  for (const it of items) {
    const disp = getTexDisplay(it, currentLang);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mini-asset-card';
    btn.title = `${disp.title} (${disp.badge})`;
    const src = BAKED_AI_TEXTURES[it.key] || '';
    btn.innerHTML = `
      <div class="mini-thumb-wrap"><img src="${src}" alt="${disp.title}" loading="lazy" /></div>
      <span class="mini-title">${disp.title}</span>
      <span class="mini-sub">${disp.badge}</span>
    `;
    btn.addEventListener('click', () => openAtlasDialogAndFocus(it.key));
    gridEl.appendChild(btn);
  }
}

function renderRightMeshCards() {
  const meshGrid = document.getElementById('right-mesh-grid');
  if (!meshGrid) return;
  meshGrid.innerHTML = '';
  MESH_GALLERY_ITEMS.forEach((item) => {
    const disp = getPropDisplay(item, currentLang);
    const st = bakedMeshStats[item.id] || { tris: 0 };
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mini-asset-card' + (turntable?.currentId === item.id ? ' active' : '');
    card.dataset.meshId = item.id;
    card.title = `${disp.title} — ${disp.sub} (${st.tris} Tris)`;
    card.innerHTML = `
      <div class="mini-thumb-wrap"><img src="${bakedMeshThumbs[item.id] || ''}" alt="${disp.title}" /></div>
      <span class="mini-title">${disp.title}</span>
      <span class="mini-sub">${st.tris.toLocaleString()} Tris</span>
    `;
    card.addEventListener('click', () => {
      turntable.select(item.id);
      if (turntable.soloActive) {
        document.getElementById('hud-title').textContent = `${ui().soloHudPrefix}${getPropDisplay(item, currentLang).title}`;
      }
    });
    meshGrid.appendChild(card);
  });
}

function initRightAssetDock() {
  const cv = document.getElementById('mesh-turntable-canvas');
  const ttTitle = document.getElementById('mesh-tt-title');
  const ttSub = document.getElementById('mesh-tt-sub');
  const ttStats = document.getElementById('mesh-tt-stats');
  const btnWire = document.getElementById('btn-mesh-wire');
  const btnSolo = document.getElementById('btn-mesh-solo');
  const meshGrid = document.getElementById('right-mesh-grid');

  turntable = new MeshGalleryTurntable(cv, {
    onSelect(item, stats) {
      const disp = getPropDisplay(item, currentLang);
      ttTitle.textContent = disp.title;
      ttSub.textContent = disp.sub;
      ttStats.textContent = `Verts ${stats.verts.toLocaleString()} · Tris ${stats.tris.toLocaleString()} · Meshes ${stats.meshes}`;
      meshGrid?.querySelectorAll('.mini-asset-card').forEach((c) => {
        c.classList.toggle('active', c.dataset.meshId === item.id);
      });
    },
    onSoloChange(soloActive, item) {
      const s = ui();
      btnSolo.classList.toggle('active', soloActive);
      btnSolo.textContent = soloActive ? s.soloBtnExit : s.soloBtnEnter;
      if (soloActive) {
        playing = false;
        document.getElementById('btn-play').textContent = s.btnPlay;
        sim.clear();
        syncActorVisibility();
        camera.position.set(-3.4, 2.55, -1.6);
        controls.target.set(0, 1.45, 2.2);
        controls.update();
        document.getElementById('hud-title').textContent = `${s.soloHudPrefix}${getPropDisplay(item, currentLang).title}`;
      } else {
        syncActorVisibility();
        resetMoveState();
        playing = true;
        document.getElementById('btn-play').textContent = s.btnPause;
        const mv = MOVES_3D[currentMoveIdx];
        document.getElementById('hud-title').textContent = `#${String(currentMoveIdx + 1).padStart(2, '0')} ${getMoveDisplayTitle(mv, currentLang)}`;
        applyCameraPreset(currentCamPreset);
      }
    },
  });
  turntable.attachMainScene(scene);

  const baked = turntable.bakeAllThumbnails(168, 112);
  bakedMeshThumbs = baked.thumbs;
  bakedMeshStats = baked.statsMap;

  renderRightMeshCards();

  btnWire.addEventListener('click', () => {
    const next = !turntable.wireframeMode;
    turntable.setWireframe(next);
    btnWire.classList.toggle('active', next);
  });

  btnSolo.addEventListener('click', () => {
    turntable.setSoloInMainScene(!turntable.soloActive);
  });

  document.querySelectorAll('[data-dock-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchDockTab(btn.dataset.dockTab));
  });

  document.querySelectorAll('[data-tex-cat]').forEach((pill) => {
    pill.addEventListener('click', () => {
      activeTexCat = pill.dataset.texCat;
      document.querySelectorAll('[data-tex-cat]').forEach((p) => p.classList.toggle('active', p === pill));
      renderRightTexGrid();
    });
  });

  renderRightTexGrid();
  turntable.select(MESH_GALLERY_ITEMS[0].id);
  turntable.updateAndRender(0.016);
}

function attachLightDismissFallback(dlg) {
  // Modern Web Guidance (light-dismiss-a-dialog): feature-detected click-outside fallback when native closedby="any" is unsupported
  if (dlg && !('closedBy' in HTMLDialogElement.prototype)) {
    dlg.addEventListener('click', (event) => {
      const rect = dlg.getBoundingClientRect();
      const clickedOutside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;
      if (clickedOutside) dlg.close();
    });
  }
}

function populateExportPropSelect() {
  const propSel = document.getElementById('exp-prop-select');
  if (!propSel) return;
  const prev = propSel.value;
  propSel.innerHTML = MESH_GALLERY_ITEMS
    .map((m) => {
      const disp = getPropDisplay(m, currentLang);
      return `<option value="${m.id}">${disp.title} (${m.id})</option>`;
    })
    .join('');
  if (prev) propSel.value = prev;
}

function initExportDialog() {
  const dlg = document.getElementById('export-dialog');
  if (!dlg) return;
  const btnOpen1 = document.getElementById('btn-open-export');
  const btnOpen2 = document.getElementById('btn-export-bottom');
  const btnClose = document.getElementById('btn-close-export');
  const propSel = document.getElementById('exp-prop-select');
  const fpsSel = document.getElementById('exp-fps-select');
  const chkActors = document.getElementById('exp-chk-actors');
  const modeProp = document.getElementById('exp-mode-prop');
  const curLbl = document.getElementById('exp-cur-skill-lbl');
  const statusEl = document.getElementById('exp-status-msg');
  const cliEl = document.getElementById('exp-cli-snippet');

  populateExportPropSelect();

  const syncExportDialogInfo = () => {
    const mv = MOVES_3D[currentMoveIdx];
    if (curLbl && mv) curLbl.textContent = `#${String(currentMoveIdx + 1).padStart(2, '0')} ${getMoveDisplayTitle(mv, currentLang)}`;
    if (turntable?.currentId) propSel.value = turntable.currentId;
    if (cliEl && mv) {
      cliEl.textContent =
        `npm run export-vfx -- --id ${mv.id} --fps ${fpsSel.value} --out ./exports\n` +
        `blender --background --python blender/build_vfx_models_blender.py -- --out ./exports/blender_models --formats glb`;
    }
  };

  const openExport = () => {
    syncExportDialogInfo();
    if (turntable?.soloActive) modeProp.checked = true;
    if (!dlg.open) dlg.showModal();
  };
  btnOpen1?.addEventListener('click', openExport);
  btnOpen2?.addEventListener('click', openExport);
  btnClose?.addEventListener('click', () => dlg.close());
  fpsSel?.addEventListener('change', syncExportDialogInfo);
  attachLightDismissFallback(dlg);

  const runExport = (onlyGlb = false) => {
    try {
      const isProp = Boolean(modeProp?.checked);
      const fps = parseInt(fpsSel?.value || '24', 10) || 24;
      const includeActors = Boolean(chkActors?.checked);
      const mv = MOVES_3D[currentMoveIdx];
      const isZh = currentLang === 'zh';
      statusEl.textContent = isProp
        ? (isZh ? `⏳ 正在建構 BMesh 3D 模型 (${propSel.value})...` : `⏳ Building BMesh 3D Prop (${propSel.value})...`)
        : (isZh
          ? `⏳ 正在烘焙完整詠唱+釋放動畫 (${mv.id} @ ${fps} FPS)...`
          : `⏳ Baking full chant + release timeline (${mv.id} @ ${fps} FPS)...`);

      setTimeout(() => {
        const pkg = exportVfxPackage({
          move: isProp ? null : mv,
          propId: isProp ? propSel.value : null,
          fps,
          includeActors,
        });
        if (onlyGlb) {
          triggerBrowserDownload(pkg.glbBytes, pkg.glbFileName, 'model/gltf-binary');
          statusEl.textContent = isZh
            ? `✅ 已匯出 ${pkg.glbFileName} (${(pkg.glbBytes.byteLength / 1024).toFixed(1)} KB · ${pkg.stats.verts} Verts / ${pkg.stats.tris} Tris)`
            : `✅ Exported ${pkg.glbFileName} (${(pkg.glbBytes.byteLength / 1024).toFixed(1)} KB · ${pkg.stats.verts} Verts / ${pkg.stats.tris} Tris)`;
        } else {
          triggerBrowserDownload(pkg.zipBytes, pkg.fileName, 'application/zip');
          statusEl.textContent = isZh
            ? `✅ 已打包下載 ${pkg.fileName} (${(pkg.zipBytes.byteLength / 1024).toFixed(1)} KB · 內含 .glb + .obj + ${pkg.manifest.textures.length} 張 .webp + 引擎橋接腳本)`
            : `✅ Downloaded ${pkg.fileName} (${(pkg.zipBytes.byteLength / 1024).toFixed(1)} KB · .glb + .obj + ${pkg.manifest.textures.length} .webp + Blender/UE5/Unity scripts)`;
        }
      }, 20);
    } catch (err) {
      statusEl.textContent = currentLang === 'zh'
        ? `❌ 匯出錯誤: ${err?.message || err}`
        : `❌ Export failed: ${err?.message || err}`;
    }
  };

  document.getElementById('btn-do-export-zip')?.addEventListener('click', () => runExport(false));
  document.getElementById('btn-do-export-glb')?.addEventListener('click', () => runExport(true));
}

function initAtlasInspector() {
  const dlg = document.getElementById('atlas-dialog');
  const btnOpen = document.getElementById('btn-atlas');
  const btnClose = document.getElementById('btn-close-atlas');

  btnOpen.addEventListener('click', () => openAtlasDialogAndFocus(null));
  btnClose.addEventListener('click', () => dlg.close());
  attachLightDismissFallback(dlg);
}

function buildAtlasCards() {
  const lib = getTexLib();
  const dlg = document.getElementById('atlas-dialog');
  const dlgMeshGrid = document.getElementById('dlg-mesh-grid');
  const fbGrid = document.getElementById('fb-atlas-grid');
  const sigilGrid = document.getElementById('sigil-atlas-grid');
  const envUvGrid = document.getElementById('env-uv-atlas-grid');
  dlgMeshGrid.innerHTML = '';
  fbGrid.innerHTML = '';
  sigilGrid.innerHTML = '';
  envUvGrid.innerHTML = '';
  liveFlipPreviews.length = 0;

  for (const item of MESH_GALLERY_ITEMS) {
    const disp = getPropDisplay(item, currentLang);
    const st = bakedMeshStats[item.id] || { verts: 0, tris: 0, meshes: 0 };
    const card = document.createElement('div');
    card.className = 'atlas-card mesh-dlg-card';
    card.innerHTML = `
      <img class="tex-thumb" src="${bakedMeshThumbs[item.id] || ''}" alt="${disp.title}" />
      <div class="atlas-info">
        <div class="atlas-title">🧊 ${disp.title}</div>
        <div class="atlas-desc">${disp.sub} · <b>${st.verts.toLocaleString()} Verts / ${st.tris.toLocaleString()} Tris</b></div>
      </div>
    `;
    card.addEventListener('click', () => {
      dlg.close();
      switchDockTab('mesh3d');
      turntable?.select(item.id);
    });
    dlgMeshGrid.appendChild(card);
  }

  for (const item of AI_TEXTURE_CATALOG.filter((x) => x.cat === 'flipbook')) {
    const srcCanvas = lib[item.key]?._sourceCanvas;
    if (!srcCanvas) continue;
    const disp = getTexDisplay(item, currentLang);

    const card = document.createElement('div');
    card.className = 'atlas-card';
    card.id = `dlg-tex-${item.key}`;

    const sheetCvs = document.createElement('canvas');
    sheetCvs.width = 148;
    sheetCvs.height = 148;
    sheetCvs.className = 'sheet-thumb';

    const animCvs = document.createElement('canvas');
    animCvs.width = 124;
    animCvs.height = 124;
    animCvs.className = 'anim-thumb';

    const info = document.createElement('div');
    info.className = 'atlas-info';
    const subNote = currentLang === 'zh' ? '768×768 WebP · SubUV 線性插值' : '768×768 WebP · Linear SubUV';
    info.innerHTML = `<div class="atlas-title">${disp.title} <small>(${item.key})</small></div><div class="atlas-desc">${disp.badge} · ${subNote}</div>`;

    const row = document.createElement('div');
    row.className = 'atlas-thumbs';
    row.append(sheetCvs, animCvs);
    card.append(row, info);
    fbGrid.appendChild(card);

    liveFlipPreviews.push({
      srcCanvas,
      sheetCtx: sheetCvs.getContext('2d'),
      animCtx: animCvs.getContext('2d'),
      defPal: DEF_FLIP_PAL[item.key] || 'fireInferno',
    });
  }

  for (const item of AI_TEXTURE_CATALOG.filter((x) => x.cat === 'sigil')) {
    const disp = getTexDisplay(item, currentLang);
    const card = document.createElement('div');
    card.className = 'atlas-card tex-only';
    card.id = `dlg-tex-${item.key}`;
    card.innerHTML = `
      <img class="tex-thumb square-thumb" src="${BAKED_AI_TEXTURES[item.key] || ''}" alt="${disp.title}" loading="lazy" />
      <div class="atlas-info">
        <div class="atlas-title">${disp.title}</div>
        <div class="atlas-desc">${disp.badge} · <code>${item.key}</code></div>
      </div>
    `;
    sigilGrid.appendChild(card);
  }

  for (const item of AI_TEXTURE_CATALOG.filter((x) => x.cat === 'env' || x.cat === 'uv')) {
    const disp = getTexDisplay(item, currentLang);
    const card = document.createElement('div');
    card.className = 'atlas-card tex-only';
    card.id = `dlg-tex-${item.key}`;
    card.innerHTML = `
      <img class="tex-thumb square-thumb" src="${BAKED_AI_TEXTURES[item.key] || ''}" alt="${disp.title}" loading="lazy" />
      <div class="atlas-info">
        <div class="atlas-title">${disp.title}</div>
        <div class="atlas-desc">${disp.badge} · <code>${item.key}</code></div>
      </div>
    `;
    envUvGrid.appendChild(card);
  }
}

function updateAtlasPreviews(nowSec) {
  const dlg = document.getElementById('atlas-dialog');
  if (!dlg || !dlg.open || !liveFlipPreviews.length) return;

  const frame = Math.floor(nowSec * 20) % 16;
  const col = frame % 4;
  const row = Math.floor(frame / 4);

  for (const p of liveFlipPreviews) {
    const pal = PAL3D[paletteOverride] || PAL3D[p.defPal] || PAL3D.fireInferno;
    const sCtx = p.sheetCtx;
    sCtx.fillStyle = '#060913';
    sCtx.fillRect(0, 0, 148, 148);
    sCtx.drawImage(p.srcCanvas, 0, 0, 148, 148);
    sCtx.strokeStyle = 'rgba(120, 165, 255, 0.22)';
    sCtx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      sCtx.beginPath(); sCtx.moveTo(i * 37, 0); sCtx.lineTo(i * 37, 148); sCtx.stroke();
      sCtx.beginPath(); sCtx.moveTo(0, i * 37); sCtx.lineTo(148, i * 37); sCtx.stroke();
    }
    sCtx.strokeStyle = '#ffd269';
    sCtx.lineWidth = 2;
    sCtx.strokeRect(col * 37 + 1, row * 37 + 1, 35, 35);

    const cellS = Math.max(1, Math.floor(p.srcCanvas.width / 4));
    const aCtx = p.animCtx;
    aCtx.globalCompositeOperation = 'source-over';
    aCtx.fillStyle = '#060913';
    aCtx.fillRect(0, 0, 124, 124);
    aCtx.drawImage(p.srcCanvas, col * cellS, row * cellS, cellS, cellS, 0, 0, 124, 124);
    aCtx.globalCompositeOperation = 'multiply';
    const grad = aCtx.createRadialGradient(62, 62, 6, 62, 62, 62);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, pal[4]);
    grad.addColorStop(1, pal[2]);
    aCtx.fillStyle = grad;
    aCtx.fillRect(0, 0, 124, 124);
    aCtx.globalCompositeOperation = 'lighter';
    aCtx.globalAlpha = 0.45;
    aCtx.drawImage(p.srcCanvas, col * cellS, row * cellS, cellS, cellS, 0, 0, 124, 124);
    aCtx.globalAlpha = 1.0;
    aCtx.globalCompositeOperation = 'source-over';
  }
}

// ============================================================================
// UI Rendering & Filtering
// ============================================================================
function renderCatTabs() {
  const catTabsEl = document.getElementById('cat-tabs');
  if (!catTabsEl) return;
  catTabsEl.innerHTML = '';
  CATEGORIES_3D.forEach((cat) => {
    const cnt = cat.id === 'all' ? MOVES_3D.length : MOVES_3D.filter((m) => m.cat === cat.id).length;
    const catLbl = CATEGORIES_I18N[cat.id]?.[currentLang] || cat.label;
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'cat-pill' + (cat.id === activeCat ? ' active' : '');
    pill.textContent = `${catLbl} (${cnt})`;
    pill.addEventListener('click', () => {
      activeCat = cat.id;
      if (cat.id === 'bow') {
        searchQuery = '';
        document.getElementById('search-input').value = '';
      }
      catTabsEl.querySelectorAll('.cat-pill').forEach((p) => p.classList.toggle('active', p === pill));
      renderMoveList();
      if (cat.id === 'bow') {
        if (turntable?.soloActive) turntable.setSoloInMainScene(false);
        const bowIdx = MOVES_3D[currentMoveIdx].cat === 'bow'
          ? currentMoveIdx : MOVES_3D.findIndex((mv) => mv.cat === 'bow');
        if (bowIdx >= 0) selectMove(bowIdx, userFreeOrbit);
      }
    });
    catTabsEl.appendChild(pill);
  });
}

function renderMoveList() {
  const moveListEl = document.getElementById('move-list');
  moveListEl.innerHTML = '';
  const q = searchQuery.trim().toLowerCase();

  MOVES_3D.forEach((mv, idx) => {
    if (activeCat !== 'all' && mv.cat !== activeCat) return;
    const catZh = CATEGORIES_I18N[mv.cat]?.zh || '';
    const catEn = CATEGORIES_I18N[mv.cat]?.en || '';
    const enTitle = getMoveDisplayTitle(mv, 'en');
    const haystack = `${enTitle} ${mv.id} ${mv.title} ${mv.cls} ${mv.codeId} ${catEn} ${catZh}`.toLowerCase();
    if (q && !haystack.includes(q)) return;

    const dispTitle = getMoveDisplayTitle(mv, currentLang);
    const dispCls = getMoveDisplayClass(mv, currentLang);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'move-btn' + (idx === currentMoveIdx ? ' active' : '');
    btn.dataset.idx = String(idx);
    btn.innerHTML = `<div class="m-top"><span class="m-idx">#${String(idx + 1).padStart(2, '0')}</span><span class="m-cls">${dispCls}</span></div><span class="m-name">${dispTitle}</span>`;
    btn.addEventListener('click', () => {
      if (turntable?.soloActive) turntable.setSoloInMainScene(false);
      selectMove(idx, userFreeOrbit);
    });
    moveListEl.appendChild(btn);
  });
}

function setQualityTier(tierNum, reseek = true) {
  FX_CONFIG.tier = clamp(parseInt(tierNum, 10) || 4, 1, 4);
  document.querySelectorAll('[data-tier]').forEach((b) => {
    b.classList.toggle('active', parseInt(b.dataset.tier, 10) === FX_CONFIG.tier);
  });
  const badge = document.getElementById('tier-badge');
  const s = ui();
  if (badge) badge.textContent = s.tierLabels[FX_CONFIG.tier] || s.tierLabels[4];
  if (reseek && !turntable?.soloActive) {
    seekToTime(currentTime);
    updateHUD();
  }
}

function syncSelectOptions(selEl, mapObj) {
  if (!selEl || !mapObj) return;
  Array.from(selEl.options).forEach((opt) => {
    if (Object.prototype.hasOwnProperty.call(mapObj, opt.value)) {
      opt.textContent = mapObj[opt.value];
    }
  });
}

function applyLanguageToDOM() {
  const s = ui();
  document.querySelectorAll('.lang-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.lang === currentLang);
  });

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };
  setTxt('brand-title', s.brandTitle);
  setTxt('brand-badge', s.brandBadge);
  setTxt('shortcut-hint', s.shortcutHint);

  const searchEl = document.getElementById('search-input');
  if (searchEl) {
    searchEl.placeholder = s.searchPlaceholder;
    searchEl.setAttribute('aria-label', s.searchAria);
  }

  setTxt('dock-btn-mesh', s.dockMesh);
  setTxt('dock-btn-tex', s.dockTex);
  setTxt('btn-atlas', s.dockAtlas);
  const btnOpenExp = document.getElementById('btn-open-export');
  if (btnOpenExp) {
    btnOpenExp.textContent = s.dockExport;
    btnOpenExp.title = s.dockExportTitle;
  }

  setTxt('btn-mesh-wire', s.wireBtn);
  const btnSolo = document.getElementById('btn-mesh-solo');
  if (btnSolo) btnSolo.textContent = turntable?.soloActive ? s.soloBtnExit : s.soloBtnEnter;
  setTxt('mesh-tt-hint', s.ttBottomHint);

  setTxt('tex-pill-all', s.texCatAll);
  setTxt('tex-pill-sigil', s.texCatSigil);
  setTxt('tex-pill-flipbook', s.texCatFlipbook);
  setTxt('tex-pill-env', s.texCatEnv);
  setTxt('tex-pill-uv', s.texCatUv);

  setTxt('tier-badge', s.tierLabels[FX_CONFIG.tier] || s.tierLabels[4]);
  setTxt('hitstop-badge', s.hitstopBadge);
  setTxt('sec-tier-lbl', s.secTier);
  document.querySelectorAll('[data-tier]').forEach((b) => {
    const t = parseInt(b.dataset.tier, 10);
    if (s.tierBtns[t]) b.textContent = s.tierBtns[t];
    if (s.tierTips[t]) b.title = s.tierTips[t];
  });

  setTxt('sec-chant-lbl', s.secChant);
  setTxt('lbl-txt-chant-time', s.lblChantTime);
  const selChant = document.getElementById('sel-chant-mode');
  if (selChant) {
    const prev = selChant.value || FX_CONFIG.chantMode || 'auto';
    selChant.innerHTML = CHANT_MODES_META
      .map((m) => `<option value="${m.id}">${currentLang === 'zh' ? m.label : (CHANT_MODES_EN[m.id] || m.label)}</option>`)
      .join('');
    selChant.value = prev;
  }

  setTxt('sec-scale-lbl', s.secScale);
  setTxt('btn-reset-scale', s.btnReset);
  setTxt('lbl-txt-aoe', s.lblAoe);
  setTxt('lbl-txt-range', s.lblRange);
  setTxt('lbl-txt-linger', s.lblLinger);
  setTxt('lbl-txt-wind-x', s.lblWindX);
  setTxt('lbl-txt-wind-z', s.lblWindZ);

  setTxt('sec-trad-lbl', s.secTrad);
  syncSelectOptions(document.getElementById('sel-sigil-tradition'), s.tradOptions);
  setTxt('sec-comp-lbl', s.secComp);
  syncSelectOptions(document.getElementById('sel-sigil-complexity'), s.compOptions);

  setTxt('sec-charge-lbl', s.secCharge);
  const selCharge = document.getElementById('sel-charge-variant');
  if (selCharge) {
    const prevC = selCharge.value || FX_CONFIG.chargeVariant || 'auto';
    selCharge.innerHTML = CHARGE_VARIANTS_META
      .map((v) => `<option value="${v.id}">${currentLang === 'zh' ? v.label : (CHARGE_VARIANTS_EN[v.id] || v.label)}</option>`)
      .join('');
    selCharge.value = prevC;
  }

  setTxt('sec-slashuv-lbl', s.secSlashUv);
  syncSelectOptions(document.getElementById('sel-texstyle'), s.slashUvOptions);
  setTxt('sec-palette-lbl', s.secPalette);
  syncSelectOptions(document.getElementById('sel-palette'), s.paletteOptions);

  setTxt('btn-freeze-peak', s.btnPeak);
  document.querySelectorAll('[data-cam]').forEach((b) => {
    if (s.camBtns[b.dataset.cam]) b.textContent = s.camBtns[b.dataset.cam];
  });

  setTxt('lbl-chk-actors', s.chkActors);
  setTxt('lbl-chk-hitbox', s.chkHitbox);
  setTxt('lbl-chk-loop', s.chkLoop);
  setTxt('lbl-chk-shake', s.chkShake);
  setTxt('lbl-chk-soft', s.chkSoft);
  setTxt('lbl-chk-overdraw', s.chkOverdraw);
  const wShake = document.getElementById('wrap-chk-shake');
  const wSoft = document.getElementById('wrap-chk-soft');
  const wOd = document.getElementById('wrap-chk-overdraw');
  if (wShake) wShake.title = s.chkShakeTip;
  if (wSoft) wSoft.title = s.chkSoftTip;
  if (wOd) wOd.title = s.chkOverdrawTip;

  const btnPlay = document.getElementById('btn-play');
  if (btnPlay) btnPlay.textContent = playing ? s.btnPause : s.btnPlay;
  setTxt('btn-replay', s.btnReplay);
  const focusBtn = document.getElementById('btn-stage-focus');
  if (focusBtn) {
    const focused = document.getElementById('ui-root')?.classList.contains('stage-focus');
    focusBtn.textContent = focused ? s.btnFocusExit : s.btnFocusEnter;
  }
  setTxt('btn-prev-frame', s.btnPrevFrame);
  setTxt('btn-next-frame', s.btnNextFrame);
  document.querySelectorAll('[data-speed]').forEach((b) => {
    if (s.speedBtns[b.dataset.speed]) b.textContent = s.speedBtns[b.dataset.speed];
  });
  setTxt('btn-export-bottom', s.btnExportBottom);

  // Dialogs
  setTxt('export-dialog-title', s.expTitle);
  setTxt('btn-close-export', s.btnClose);
  setTxt('exp-step-1', s.expStep1);
  setTxt('exp-mode-skill-pre', s.expModeSkillPrefix);
  setTxt('exp-mode-skill-suf', s.expModeSkillSuffix);
  setTxt('exp-mode-prop-lbl', s.expModeProp);
  setTxt('exp-prop-lbl', s.expPropLbl);
  setTxt('exp-fps-lbl', s.expFpsLbl);
  syncSelectOptions(document.getElementById('exp-fps-select'), s.expFpsOptions);
  setTxt('exp-chk-actors-lbl', s.expChkActors);
  setTxt('exp-step-2', s.expStep2);
  const expBullets = document.getElementById('exp-bullets');
  if (expBullets) expBullets.innerHTML = s.expBulletsHtml;
  setTxt('btn-do-export-zip', s.btnDoZip);
  setTxt('btn-do-export-glb', s.btnDoGlb);
  setTxt('exp-status-msg', s.expReadyMsg);
  setTxt('exp-step-3', s.expStep3);
  populateExportPropSelect();

  setTxt('atlas-dialog-title', s.atlasTitle);
  setTxt('btn-close-atlas', s.btnClose);
  const atlasIntro = document.getElementById('atlas-intro');
  if (atlasIntro) atlasIntro.innerHTML = s.atlasIntroHtml;
  setTxt('atlas-sec-mesh', s.atlasSecMesh);
  setTxt('atlas-sec-fb', s.atlasSecFb);
  setTxt('atlas-sec-sigil', s.atlasSecSigil);
  setTxt('atlas-sec-env', s.atlasSecEnv);

  renderCatTabs();
  renderMoveList();
  if (turntable) {
    renderRightMeshCards();
    renderRightTexGrid();
    const curProp = turntable.getItem(turntable.currentId);
    const propDisp = getPropDisplay(curProp, currentLang);
    setTxt('mesh-tt-title', propDisp.title);
    setTxt('mesh-tt-sub', propDisp.sub);
  }

  atlasBuilt = false;
  const atlasDlg = document.getElementById('atlas-dialog');
  if (atlasDlg?.open) {
    buildAtlasCards();
    atlasBuilt = true;
  }

  const mv = MOVES_3D[currentMoveIdx];
  if (mv) {
    if (turntable?.soloActive) {
      const curProp = turntable.getItem(turntable.currentId);
      setTxt('hud-title', `${s.soloHudPrefix}${getPropDisplay(curProp, currentLang).title}`);
    } else {
      setTxt('hud-title', `#${String(currentMoveIdx + 1).padStart(2, '0')} ${getMoveDisplayTitle(mv, currentLang)}`);
    }
    const notesEl = document.getElementById('spec-notes');
    if (notesEl) notesEl.innerHTML = getMoveDisplayNotes(mv, currentLang).map((n) => `<li>${n}</li>`).join('');
    const curLbl = document.getElementById('exp-cur-skill-lbl');
    if (curLbl) curLbl.textContent = `#${String(currentMoveIdx + 1).padStart(2, '0')} ${getMoveDisplayTitle(mv, currentLang)}`;
    const metricsEl = document.getElementById('lbl-scale-metrics');
    if (metricsEl) metricsEl.textContent = formatHitboxMetrics(mv);
    updateChantMetricsUI(mv);
    updateHUD();
  }
}

function initUI() {
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.lang === 'zh' ? 'zh' : 'en';
      if (next === currentLang) return;
      currentLang = setActiveLang(next);
      applyLanguageToDOM();
    });
  });

  renderCatTabs();

  const searchEl = document.getElementById('search-input');
  searchEl.addEventListener('input', () => {
    searchQuery = searchEl.value;
    renderMoveList();
  });

  const selChantMode = document.getElementById('sel-chant-mode');
  const rngChantTime = document.getElementById('rng-chant-time');
  const valChantTime = document.getElementById('val-chant-time');
  if (selChantMode) {
    selChantMode.innerHTML = CHANT_MODES_META
      .map((m) => `<option value="${m.id}">${currentLang === 'zh' ? m.label : (CHANT_MODES_EN[m.id] || m.label)}</option>`)
      .join('');
    selChantMode.value = FX_CONFIG.chantMode || 'auto';
  }
  syncSliderProgress(rngChantTime);

  const applyChantLive = () => {
    if (selChantMode) FX_CONFIG.chantMode = selChantMode.value || 'auto';
    if (rngChantTime) {
      FX_CONFIG.chantTimeScale = parseFloat(rngChantTime.value);
      if (!Number.isFinite(FX_CONFIG.chantTimeScale)) FX_CONFIG.chantTimeScale = 1.0;
      if (valChantTime) valChantTime.textContent = `${FX_CONFIG.chantTimeScale.toFixed(2)}x`;
      syncSliderProgress(rngChantTime);
    }
    if (!turntable?.soloActive) {
      resetMoveState();
      playing = true;
      document.getElementById('btn-play').textContent = ui().btnPause;
      updateHUD();
    }
  };
  selChantMode?.addEventListener('change', applyChantLive);
  rngChantTime?.addEventListener('input', applyChantLive);

  const selCharge = document.getElementById('sel-charge-variant');
  selCharge.innerHTML = CHARGE_VARIANTS_META
    .map((v) => `<option value="${v.id}">${currentLang === 'zh' ? v.label : (CHARGE_VARIANTS_EN[v.id] || v.label)}</option>`)
    .join('');

  renderMoveList();
  initRightAssetDock();
  initAtlasInspector();
  initExportDialog();
  applyLanguageToDOM();

  document.querySelectorAll('[data-tier]').forEach((btn) => {
    btn.addEventListener('click', () => setQualityTier(btn.dataset.tier, true));
  });

  const rngAoe = document.getElementById('rng-aoe');
  const rngRange = document.getElementById('rng-range');
  const rngLinger = document.getElementById('rng-linger');
  const valAoe = document.getElementById('val-aoe');
  const valRange = document.getElementById('val-range');
  const valLinger = document.getElementById('val-linger');
  syncSliderProgress(rngAoe);
  syncSliderProgress(rngRange);
  syncSliderProgress(rngLinger);

  const applyScaleLive = () => {
    FX_CONFIG.aoeScale = parseFloat(rngAoe.value) || 1.0;
    FX_CONFIG.rangeScale = parseFloat(rngRange.value) || 1.0;
    if (rngLinger) {
      FX_CONFIG.groundLingerScale = parseFloat(rngLinger.value) || 1.65;
      if (valLinger) valLinger.textContent = `${FX_CONFIG.groundLingerScale.toFixed(2)}x`;
      syncSliderProgress(rngLinger);
    }
    valAoe.textContent = `${FX_CONFIG.aoeScale.toFixed(2)}x`;
    valRange.textContent = `${FX_CONFIG.rangeScale.toFixed(2)}x`;
    syncSliderProgress(rngAoe);
    syncSliderProgress(rngRange);
    if (!turntable?.soloActive) {
      seekToTime(currentTime);
      updateHUD();
    }
  };
  rngAoe.addEventListener('input', applyScaleLive);
  rngRange.addEventListener('input', applyScaleLive);
  rngLinger?.addEventListener('input', applyScaleLive);

  const rngWindX = document.getElementById('rng-wind-x');
  const rngWindZ = document.getElementById('rng-wind-z');
  const applyWindLive = () => {
    FX_CONFIG.windX = Number(rngWindX.value);
    FX_CONFIG.windZ = Number(rngWindZ.value);
    document.getElementById('val-wind-x').textContent = FX_CONFIG.windX.toFixed(1);
    document.getElementById('val-wind-z').textContent = FX_CONFIG.windZ.toFixed(1);
    syncSliderProgress(rngWindX);
    syncSliderProgress(rngWindZ);
    if (!turntable?.soloActive) { seekToTime(currentTime); updateHUD(); }
  };
  syncSliderProgress(rngWindX);
  syncSliderProgress(rngWindZ);
  rngWindX.addEventListener('input', applyWindLive);
  rngWindZ.addEventListener('input', applyWindLive);

  document.getElementById('btn-reset-scale').addEventListener('click', () => {
    rngAoe.value = '1.00';
    rngRange.value = '1.00';
    if (rngLinger) rngLinger.value = '1.65';
    applyScaleLive();
  });

  const selTrad = document.getElementById('sel-sigil-tradition');
  const selComp = document.getElementById('sel-sigil-complexity');
  selTrad?.addEventListener('change', () => {
    FX_CONFIG.sigilTradition = selTrad.value || 'auto';
    if (!turntable?.soloActive) {
      seekToTime(currentTime);
      updateHUD();
    }
  });
  selComp?.addEventListener('change', () => {
    FX_CONFIG.sigilComplexity = selComp.value || 'auto';
    if (!turntable?.soloActive) {
      seekToTime(currentTime);
      updateHUD();
    }
  });

  selCharge.addEventListener('change', () => {
    FX_CONFIG.chargeVariant = selCharge.value || 'auto';
    if (!turntable?.soloActive) {
      if (currentTime > 0.85) {
        resetMoveState();
        playing = true;
        document.getElementById('btn-play').textContent = ui().btnPause;
      } else {
        seekToTime(currentTime);
      }
      updateHUD();
    }
  });

  document.querySelectorAll('[data-cam]').forEach((btn) => {
    btn.addEventListener('click', () => applyCameraPreset(btn.dataset.cam));
  });

  document.querySelectorAll('[data-speed]').forEach((btn) => {
    btn.addEventListener('click', () => {
      speed = parseFloat(btn.dataset.speed);
      document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  const btnPlay = document.getElementById('btn-play');
  btnPlay.addEventListener('click', () => {
    if (turntable?.soloActive) turntable.setSoloInMainScene(false);
    playing = !playing;
    btnPlay.textContent = playing ? ui().btnPause : ui().btnPlay;
  });

  document.getElementById('btn-freeze-peak').addEventListener('click', () => {
    if (turntable?.soloActive) turntable.setSoloInMainScene(false);
    const mv = MOVES_3D[currentMoveIdx];
    const timeOffset = activeSession ? activeSession.timeOffset : getMoveTimeOffset(mv);
    const pt = Math.max(0, timeOffset + (mv.peakTime ?? mv.contactTimes?.[1] ?? mv.duration * 0.4));
    playing = false;
    btnPlay.textContent = ui().btnPlay;
    seekToTime(pt);
    updateHUD();
  });

  document.getElementById('btn-replay').addEventListener('click', () => {
    if (turntable?.soloActive) turntable.setSoloInMainScene(false);
    resetMoveState();
    playing = true;
    btnPlay.textContent = ui().btnPause;
  });

  const focusButton = document.getElementById('btn-stage-focus');
  focusButton.addEventListener('click', () => {
    const focused = document.getElementById('ui-root').classList.toggle('stage-focus');
    focusButton.setAttribute('aria-pressed', String(focused));
    focusButton.textContent = focused ? ui().btnFocusExit : ui().btnFocusEnter;
  });

  document.getElementById('btn-prev-frame').addEventListener('click', () => {
    playing = false;
    btnPlay.textContent = ui().btnPlay;
    seekToTime(Math.max(0, currentTime - 1 / 30));
  });

  document.getElementById('btn-next-frame').addEventListener('click', () => {
    playing = false;
    btnPlay.textContent = ui().btnPlay;
    seekToTime(Math.min(getClipDuration(MOVES_3D[currentMoveIdx]), currentTime + 1 / 30));
  });

  const chkActors = document.getElementById('chk-actors');
  chkActors.addEventListener('change', () => {
    showActors = chkActors.checked;
    syncActorVisibility();
  });

  const chkHitbox = document.getElementById('chk-hitbox');
  chkHitbox.addEventListener('change', () => {
    showHitbox = chkHitbox.checked;
    syncActorVisibility();
  });

  const chkLoop = document.getElementById('chk-loop');
  chkLoop.addEventListener('change', () => {
    autoLoop = chkLoop.checked;
  });

  const chkShake = document.getElementById('chk-shake');
  if (chkShake) {
    chkShake.addEventListener('change', () => {
      sim.traumaShake.enabled = chkShake.checked;
    });
  }

  const chkSoftParticles = document.getElementById('chk-soft-particles');
  if (chkSoftParticles) {
    chkSoftParticles.addEventListener('change', () => {
      sim.setSoftDepthEnabled(chkSoftParticles.checked);
    });
  }

  const chkOverdraw = document.getElementById('chk-overdraw');
  if (chkOverdraw) {
    chkOverdraw.addEventListener('change', () => {
      showOverdraw = chkOverdraw.checked;
    });
  }

  const selTex = document.getElementById('sel-texstyle');
  selTex.addEventListener('change', () => {
    texStyleOverride = selTex.value;
    if (!turntable?.soloActive) seekToTime(currentTime);
  });

  const selPal = document.getElementById('sel-palette');
  selPal.addEventListener('change', () => {
    paletteOverride = selPal.value;
    turntable?.setPaletteOverride(paletteOverride || null);
    if (!turntable?.soloActive) seekToTime(currentTime);
  });

  const scrubber = document.getElementById('scrubber');
  syncSliderProgress(scrubber);
  scrubber.addEventListener('input', () => {
    if (turntable?.soloActive) turntable.setSoloInMainScene(false);
    playing = false;
    btnPlay.textContent = ui().btnPlay;
    const mv = MOVES_3D[currentMoveIdx];
    syncSliderProgress(scrubber);
    seekToTime((parseFloat(scrubber.value) / 1000) * getClipDuration(mv));
  });

  window.addEventListener('keydown', (e) => {
    if (document.activeElement === searchEl) return;
    if (e.code === 'Space') {
      e.preventDefault();
      btnPlay.click();
    } else if (e.key === 'r' || e.key === 'R') {
      document.getElementById('btn-replay').click();
    } else if (e.key === 'f' || e.key === 'F') {
      document.getElementById('btn-freeze-peak').click();
    } else if (e.key === '[' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (turntable?.soloActive) turntable.setSoloInMainScene(false);
      selectMove((currentMoveIdx - 1 + MOVES_3D.length) % MOVES_3D.length, userFreeOrbit);
    } else if (e.key === ']' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (turntable?.soloActive) turntable.setSoloInMainScene(false);
      selectMove((currentMoveIdx + 1) % MOVES_3D.length, userFreeOrbit);
    }
  });
}

function selectMove(idx, keepFreeCam = false) {
  currentMoveIdx = clamp(idx, 0, MOVES_3D.length - 1);
  document.querySelectorAll('.move-btn').forEach((b) => {
    b.classList.toggle('active', parseInt(b.dataset.idx, 10) === currentMoveIdx);
  });
  const mv = MOVES_3D[currentMoveIdx];
  document.getElementById('hud-title').textContent = `#${String(currentMoveIdx + 1).padStart(2, '0')} ${getMoveDisplayTitle(mv, currentLang)}`;
  document.getElementById('hud-code').textContent = mv.codeId;
  const notesEl = document.getElementById('spec-notes');
  notesEl.innerHTML = getMoveDisplayNotes(mv, currentLang).map((n) => `<li>${n}</li>`).join('');
  resetMoveState();
  if (!keepFreeCam) applyCameraPreset(currentCamPreset);
  playing = true;
  document.getElementById('btn-play').textContent = ui().btnPause;
}

function updateHUD() {
  const mv = MOVES_3D[currentMoveIdx];
  const clipDur = getClipDuration(mv);
  document.getElementById('time-readout').textContent =
    `${currentTime.toFixed(2)}s / ${clipDur.toFixed(2)}s`;
  const scrubber = document.getElementById('scrubber');
  scrubber.value = String(Math.round((currentTime / Math.max(0.01, clipDur)) * 1000));
  syncSliderProgress(scrubber);
  document.getElementById('fx-count').textContent =
    ui().fxCountTpl(sim.activeFxCount, lastDrawCalls, smoothFrameMs.toFixed(1));
  const hsBadge = document.getElementById('hitstop-badge');
  hsBadge.style.opacity = fighter.hitStop > 0 ? '1' : '0.22';
}

// ============================================================================
// Headless 9-Panel Contact Sheet Renderer (?contact=0..397)
// ============================================================================
function renderMultiViewportGrid(titleText, cells, readyFlag) {
  document.getElementById('ui-root').style.display = 'none';
  const W = window.innerWidth || 1600;
  const H = window.innerHeight || 1080;
  const cols = 3, rows = 3;
  const headerH = 54;
  const cellW = Math.floor(W / cols);
  const cellH = Math.floor((H - headerH) / rows);

  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.autoClear = false;
  renderer.toneMappingExposure = 1.18;
  camera.aspect = cellW / cellH;
  camera.updateProjectionMatrix();

  renderer.setScissorTest(false);
  renderer.setClearColor(0x070a12, 1);
  renderer.clear();
  renderer.setScissorTest(true);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;font-family:Inter,"Segoe UI","Microsoft JhengHei",system-ui,sans-serif;';
  const hdr = document.createElement('div');
  hdr.style.cssText = `height:${headerH}px;background:#070a12;color:#e8f0ff;font-weight:700;font-size:20px;line-height:${headerH}px;padding:0 20px;border-bottom:2px solid #253554;`;
  hdr.textContent = titleText;
  overlay.appendChild(hdr);

  for (let slot = 0; slot < cells.length; slot++) {
    const cell = cells[slot];
    const r = Math.floor(slot / cols), c = slot % cols;
    currentMoveIdx = cell.mIdx;
    showHitbox = Boolean(cell.hitbox);
    applyCameraPreset(cell.cam || 'iso');
    seekToTime(cell.t);
    applyCameraPreset(cell.cam || 'iso');
    sim._syncVisuals();

    const dx = c * cellW;
    const dyTop = headerH + r * cellH;
    const glY = H - dyTop - cellH;
    renderer.setViewport(dx, glY, cellW, cellH);
    renderer.setScissor(dx, glY, cellW, cellH);
    renderer.setClearColor(0x0b0f19, 1);
    renderer.clear();
    renderer.render(scene, camera);

    const box = document.createElement('div');
    box.style.cssText = `position:absolute;left:${dx}px;top:${dyTop}px;width:${cellW}px;height:${cellH}px;border:1px solid #253554;box-sizing:border-box;`;
    const tag = document.createElement('div');
    tag.style.cssText = `margin:8px;display:inline-block;padding:4px 10px;background:rgba(8,12,22,0.84);border-radius:4px;color:${cell.accent || '#9ec5ff'};font-weight:700;font-size:13px;`;
    tag.textContent = cell.label;
    box.appendChild(tag);
    overlay.appendChild(box);
  }

  document.body.appendChild(overlay);
  window[readyFlag] = true;
  document.title = readyFlag.replace(/^__/, '');
}

function runContactSheetMode(idx) {
  const mIdx = clamp(parseInt(idx, 10) || 0, 0, MOVES_3D.length - 1);
  const mv = MOVES_3D[mIdx];
  const chantDur = getEffectiveChantSpec(mv).duration;
  const offset = getMoveTimeOffset(mv);
  const isZh = currentLang === 'zh';
  const presets = isZh
    ? [
        { key: 'iso',  label: '45° 實機視角' },
        { key: 'side', label: '側面低角度 (3D 厚度)' },
        { key: 'top',  label: '正上方俯視 (戰術判定框)' },
      ]
    : [
        { key: 'iso',  label: '45° Isometric' },
        { key: 'side', label: 'Side Low-Angle (3D Volume)' },
        { key: 'top',  label: 'Top-Down Tactical' },
      ];
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const t = chantDur > 0.1 && c === 0
        ? chantDur * 0.68
        : Math.max(0.05, offset + mv.contactTimes[c % mv.contactTimes.length]);
      cells.push({
        mIdx, t, cam: presets[r].key, hitbox: true,
        label: `${presets[r].label}  t=${t.toFixed(2)}s`,
      });
    }
  }
  const titleStr = isZh
    ? `VFX3D Arsenal — 真 3D 立體特效三視角驗收 ｜ #${mIdx + 1} ${mv.cls} — ${mv.title}`
    : `VFX3D Arsenal — 3-Angle True-3D Inspection ｜ #${mIdx + 1} ${getMoveDisplayClass(mv, 'en')} — ${getMoveDisplayTitle(mv, 'en')}`;
  renderMultiViewportGrid(titleStr, cells, '__CONTACT_READY');
}

function runMontageMode(pageStr) {
  const page = Math.max(0, parseInt(pageStr, 10) || 0);
  const cells = [];
  for (let slot = 0; slot < 9; slot++) {
    const mIdx = (page * 9 + slot) % MOVES_3D.length;
    const mv = MOVES_3D[mIdx];
    const offset = getMoveTimeOffset(mv);
    const t = Math.max(0.05, offset + (mv.peakTime ?? mv.contactTimes[0]));
    cells.push({
      mIdx, t, cam: 'iso', hitbox: false,
      accent: '#9ec5ff',
      label: `#${String(mIdx + 1).padStart(2, '0')} ${getMoveDisplayTitle(mv, currentLang)} (t=${t.toFixed(2)}s)`,
    });
  }
  const hdr = currentLang === 'zh'
    ? `VFX3D Arsenal — ${MOVES_3D.length} 組真 3D 貼圖・環境物理・施法詠唱・治癒輔助總覽 (第 ${page + 1} 頁)`
    : `VFX3D Arsenal — ${MOVES_3D.length} True-3D WebGL Game VFX Presets · Page ${page + 1}`;
  renderMultiViewportGrid(hdr, cells, '__MONTAGE_READY');
}

function runShowcaseIdsMode(idList, titleText) {
  const cells = [];
  for (let slot = 0; slot < 9; slot++) {
    const spec = idList[slot % idList.length];
    const mIdx = Math.max(0, MOVES_3D.findIndex((m) => m.id === spec.id));
    const mv = MOVES_3D[mIdx];
    const offset = getMoveTimeOffset(mv);
    const t = spec.absTime !== undefined
      ? spec.absTime
      : Math.max(0.05, offset + (spec.t ?? mv.peakTime ?? mv.contactTimes[0]));
    cells.push({
      mIdx, t, cam: spec.cam || 'iso', hitbox: Boolean(spec.hitbox),
      label: spec.label || `#${String(mIdx + 1).padStart(2, '0')} ${getMoveDisplayTitle(mv, currentLang)} (t=${t.toFixed(2)}s)`,
    });
  }
  renderMultiViewportGrid(titleText, cells, '__SHOWCASE_READY');
}

(async () => {
  await preloadTexLib(renderer);

  const showcaseParam = params.get('showcase');
  if (isContactMode) {
    runContactSheetMode(contactParam);
    return;
  }
  if (isMontageMode) {
    runMontageMode(montageParam);
    return;
  }
  if (showcaseParam === 'new') {
    const hdr = currentLang === 'zh'
      ? `VFX3D Arsenal — 持續區域暴風雪 + 詠唱疊陣 + 召喚與領域 + 複合地裂 + 遊戲演算法 (共 ${MOVES_3D.length} 招)`
      : `VFX3D Arsenal — ${MOVES_3D.length} True-3D WebGL Game VFX Presets · Chanting · Summons · Shaders · GLB Export`;
    runShowcaseIdsMode([
      { id: 'env_sustained_blizzard', t: 2.15 },
      { id: 'chant_eastern_qimen_thunder', t: 1.68 },
      { id: 'chant_vertical_rail_starbreaker', t: 1.72 },
      { id: 'sum_inferno_dragon_king', t: 1.48 },
      { id: 'sum_glacial_colossus_prism', t: 1.52 },
      { id: 'zone_venom_miasma_swamp', t: 2.25 },
      { id: 'env_cataclysm_trio', t: 1.48 },
      { id: 'algo_voronoi_cellular_shatter', t: 0.96 },
      { id: 'algo_boids_flocking_swords', t: 0.62 },
    ], hdr);
    return;
  }

  initUI();

  // Optional URL query hooks for direct inspection & automated verification
  if (params.get('tier')) setQualityTier(params.get('tier'), false);
  if (params.get('aoe') || params.get('range') || params.get('linger')) {
    const rngAoe = document.getElementById('rng-aoe');
    const rngRange = document.getElementById('rng-range');
    const rngLinger = document.getElementById('rng-linger');
    if (params.get('aoe')) rngAoe.value = String(clamp(parseFloat(params.get('aoe')) || 1.0, 0.5, 2.2));
    if (params.get('range')) rngRange.value = String(clamp(parseFloat(params.get('range')) || 1.0, 0.5, 3.0));
    if (params.get('linger') && rngLinger) rngLinger.value = String(clamp(parseFloat(params.get('linger')) || 1.65, 1.0, 2.5));
    FX_CONFIG.aoeScale = parseFloat(rngAoe.value);
    FX_CONFIG.rangeScale = parseFloat(rngRange.value);
    if (rngLinger) {
      FX_CONFIG.groundLingerScale = parseFloat(rngLinger.value);
      const valLinger = document.getElementById('val-linger');
      if (valLinger) valLinger.textContent = `${FX_CONFIG.groundLingerScale.toFixed(2)}x`;
      syncSliderProgress(rngLinger);
    }
    document.getElementById('val-aoe').textContent = `${FX_CONFIG.aoeScale.toFixed(2)}x`;
    document.getElementById('val-range').textContent = `${FX_CONFIG.rangeScale.toFixed(2)}x`;
    syncSliderProgress(rngAoe);
    syncSliderProgress(rngRange);
  }
  if (params.get('chant')) {
    FX_CONFIG.chantMode = params.get('chant');
    const selCh = document.getElementById('sel-chant-mode');
    if (selCh) selCh.value = FX_CONFIG.chantMode;
  }
  if (params.get('chantTime')) {
    FX_CONFIG.chantTimeScale = clamp(parseFloat(params.get('chantTime')) || 1.0, 0.0, 2.5);
    const rngCh = document.getElementById('rng-chant-time');
    const valCh = document.getElementById('val-chant-time');
    if (rngCh) {
      rngCh.value = FX_CONFIG.chantTimeScale.toFixed(2);
      syncSliderProgress(rngCh);
    }
    if (valCh) valCh.textContent = `${FX_CONFIG.chantTimeScale.toFixed(2)}x`;
  }
  if (params.get('trad')) {
    const tv = params.get('trad');
    FX_CONFIG.sigilTradition = tv;
    const selT = document.getElementById('sel-sigil-tradition');
    if (selT) selT.value = tv;
  }
  if (params.get('comp')) {
    const cp = params.get('comp');
    FX_CONFIG.sigilComplexity = cp;
    const selC = document.getElementById('sel-sigil-complexity');
    if (selC) selC.value = cp;
  }
  if (params.get('charge')) {
    const cv = params.get('charge');
    FX_CONFIG.chargeVariant = cv;
    document.getElementById('sel-charge-variant').value = cv;
  }

  selectMove(0, false);

  const selectId = params.get('select');
  if (selectId) {
    const idx = MOVES_3D.findIndex((m) => m.id === selectId);
    if (idx >= 0) {
      selectMove(idx, false);
      const btn = document.querySelector(`.move-btn[data-idx="${idx}"]`);
      btn?.scrollIntoView({ block: 'center' });
      if (params.get('cam')) applyCameraPreset(params.get('cam'));
      playing = false;
      const defaultPeak = Math.max(0, (activeSession?.timeOffset || 0) + (MOVES_3D[idx].peakTime ?? 0.5));
      const customT = params.get('time') ? parseFloat(params.get('time')) : defaultPeak;
      seekToTime(customT);
      updateHUD();
    }
  } else if (params.get('overview') === '1') {
    selectMove(0, false);
    playing = false;
    seekToTime(Math.max(0, (activeSession?.timeOffset || 0) + 2.25));
    updateHUD();
  }
  if (params.get('exportDialog') === '1') {
    document.getElementById('btn-open-export')?.click();
  }

  if (params.get('dock')) {
    switchDockTab(params.get('dock'));
  }
  if (params.get('mesh') && turntable) {
    turntable.select(params.get('mesh'));
    if (params.get('wire') === '1') {
      turntable.setWireframe(true);
      document.getElementById('btn-mesh-wire').classList.add('active');
    }
    if (params.get('solo') === '1') {
      turntable.setSoloInMainScene(true);
    }
    turntable.updateAndRender(0.25);
  }

  if (params.get('atlas') === '1') {
    openAtlasDialogAndFocus(null);
    updateAtlasPreviews(0.35);
    document.title = 'ATLAS_READY';
  }

  if (params.get('overdraw') === '1') {
    showOverdraw = true;
    const chkOd = document.getElementById('chk-overdraw');
    if (chkOd) chkOd.checked = true;
  }

  renderer.info.autoReset = false;
  sim._syncVisuals();
  turntable?.updateAndRender(0.016);
  controls.update();
  renderer.info.reset();
  if (showOverdraw) overdrawDebug.render(renderer, scene, camera, floorMesh, grid);
  else {
    if (sim.softDepth.enabled) renderSoftParticleDepth();
    composer.render();
  }
  lastDrawCalls = renderer.info.render.calls;
  updateHUD();
  if (selectId || params.get('overview') === '1' || params.get('mesh') || params.get('dock')) {
    document.title = 'OVERVIEW_READY';
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.getDrawingBufferSize(depthResolution);
    softDepthTarget.setSize(depthResolution.x, depthResolution.y);
    composer.setSize(window.innerWidth, window.innerHeight);
    overdrawDebug.setSize(window.innerWidth, window.innerHeight);
    turntable?.resize();
  });

  let last = null;
  function animate(now) {
    requestAnimationFrame(animate);
    const frameT0 = performance.now();
    if (last === null) last = now;
    const rawDt = clamp((now - last) / 1000, 0.0005, 0.05);
    last = now;

    if (playing && !turntable?.soloActive) {
      const mv = MOVES_3D[currentMoveIdx];
      stepTimeline(rawDt * speed);
      if (currentTime >= getClipDuration(mv)) {
        if (autoLoop) {
          resetMoveState();
        } else {
          playing = false;
          document.getElementById('btn-play').textContent = ui().btnPlay;
        }
      }
      updateHUD();
    } else if (!turntable?.soloActive) {
      sim._syncVisuals();
      updateHUD();
    }

    if (turntable && (activeDockTab === 'mesh3d' || turntable.soloActive)) {
      turntable.updateAndRender(rawDt);
    }
    updateAtlasPreviews(now / 1000);
    controls.update();

    renderer.info.reset();
    sim.traumaShake.apply(camera);
    if (showOverdraw) {
      overdrawDebug.render(renderer, scene, camera, floorMesh, grid);
    } else {
      if (sim.softDepth.enabled) renderSoftParticleDepth();
      composer.render();
    }
    sim.traumaShake.restore(camera);

    lastDrawCalls = renderer.info.render.calls;
    const elapsedMs = clamp(performance.now() - frameT0, 0.1, 200.0);
    smoothFrameMs += (elapsedMs - smoothFrameMs) * (1 - Math.exp(-8.0 * rawDt));
  }
  requestAnimationFrame(animate);
})();
