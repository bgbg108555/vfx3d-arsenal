import * as THREE from 'three';
import { clamp, lerp } from './core3d.js';

function poseLerp(a, b, t) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    out[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
  }
  return out;
}

export const REST_POSE = {
  x: 0, y: 0, z: 0, yaw: 0,
  crouch: 0,
  torsoPitch: 0.06, torsoYaw: 0, torsoRoll: 0,
  headPitch: -0.04, headYaw: 0,
  // Sword along -Y of handR: shRPitch=-0.65, elRPitch=-0.55 points forearm+sword naturally forward-up!
  shRPitch: -0.55, shRYaw: -0.28, shRRoll: -0.18, elRPitch: -0.65, wrRPitch: -0.25, wrRYaw: 0, wrRRoll: 0,
  // Shield on left forearm facing forward (+Z)
  shLPitch: -0.68, shLYaw: 0.42, shLRoll: 0.15, elLPitch: -0.78, wrLPitch: 0, wrLYaw: 0, wrLRoll: 0,
  hipRPitch: 0.14, kneeRPitch: 0.24,
  hipLPitch: -0.18, kneeLPitch: 0.28,
  capePitch: 0.18,
};

export class Fighter3D {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    // Readable stylized PBR materials (clear silhouette against dark arena, never muddies under coloured lights)
    this.armorMat = new THREE.MeshStandardMaterial({ color: 0x465878, roughness: 0.34, metalness: 0.58 });
    this.darkMat = new THREE.MeshStandardMaterial({ color: 0x202838, roughness: 0.62, metalness: 0.25 });
    this.trimMat = new THREE.MeshStandardMaterial({ color: 0x8eaad6, roughness: 0.28, metalness: 0.72 });
    this.goldMat = new THREE.MeshStandardMaterial({ color: 0xe0b153, roughness: 0.28, metalness: 0.78 });
    this.capeMat = new THREE.MeshStandardMaterial({ color: 0x2a3d66, roughness: 0.75, metalness: 0.1, side: THREE.DoubleSide });
    this.woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3b26, roughness: 0.65, metalness: 0.15 });
    this.visorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#8ee8ff').multiplyScalar(1.8) });
    this.bladeMat = new THREE.MeshStandardMaterial({
      color: 0xe6f0ff,
      emissive: new THREE.Color('#5a87d6').multiplyScalar(0.32),
      roughness: 0.16,
      metalness: 0.85,
    });
    this.bladeCoreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#a8d4ff').multiplyScalar(1.6) });
    this.orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#7ce8ff').multiplyScalar(2.0) });

    this._ghostMeshes = [];
    this._buildBody();
    this._buildWeapons();
    this.statusBar = new UnitStatusBar3D(this.root, { y: 2.30, name: '施法者 (自身)', roleColor: '#38bdf8' });
    this.statusBar.setVisible(false);
    this._weaponEnchantTimer = 0;
    this._weaponEnchantMax = 1;
    this._weaponEnchantColor = new THREE.Color('#ff7b29');
    this._bodyAuraTimer = 0;
    this._bodyAuraMax = 1;
    this._bodyAuraColor = new THREE.Color('#fde047');
    this.loadout = 'sword_shield';
    this.setLoadout('sword_shield');
    this.pose = { ...REST_POSE };
    this.hitStop = 0;
    this.applyPose(this.pose);
  }

  _reg(mesh) {
    this._ghostMeshes.push(mesh);
    return mesh;
  }

  _buildBody() {
    this.pelvis = new THREE.Group();
    this.pelvis.position.set(0, 0.90, 0);
    this.root.add(this.pelvis);

    const belt = this._reg(new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.175, 0.15, 10), this.darkMat));
    belt.scale.set(1.08, 1, 0.78);
    this.pelvis.add(belt);

    const buckle = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 0), this.goldMat);
    buckle.position.set(0, 0, 0.14);
    this.pelvis.add(buckle);

    // Armored tassets (hip plates)
    for (const sgn of [-1, 1]) {
      const tasset = this._reg(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.19), this.armorMat));
      tasset.position.set(sgn * 0.155, -0.06, 0);
      tasset.rotation.z = sgn * 0.18;
      this.pelvis.add(tasset);
    }

    // Torso
    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.07, 0);
    this.pelvis.add(this.torso);

    const cuirass = this._reg(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.165, 0.45, 10), this.armorMat));
    cuirass.scale.set(1.12, 1, 0.78);
    cuirass.position.set(0, 0.23, 0);
    this.torso.add(cuirass);

    const chestTrim = this._reg(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.22), this.trimMat));
    chestTrim.position.set(0, 0.31, 0.02);
    this.torso.add(chestTrim);

    const coreGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.052, 0), this.visorMat);
    coreGem.position.set(0, 0.31, 0.155);
    this.torso.add(coreGem);

    // Flowing 3D Sculpted Battle Scarf / Half-Cape on back (-Z)
    this.capePivot = new THREE.Group();
    this.capePivot.position.set(0, 0.40, -0.14);
    this.torso.add(this.capePivot);
    const capeGeo = new THREE.ConeGeometry(0.26, 0.68, 5);
    capeGeo.scale(1.15, 1, 0.22);
    capeGeo.translate(0, -0.34, 0);
    const capeMesh = this._reg(new THREE.Mesh(capeGeo, this.capeMat));
    this.capePivot.add(capeMesh);

    // Head + Sculpted Knight Helm facing +Z
    this.head = new THREE.Group();
    this.head.position.set(0, 0.49, 0);
    this.torso.add(this.head);

    const helm = this._reg(new THREE.Mesh(new THREE.DodecahedronGeometry(0.155, 1), this.armorMat));
    helm.scale.set(0.90, 1.08, 1.04);
    helm.position.set(0, 0.12, 0);
    this.head.add(helm);

    const crest = this._reg(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 4), this.goldMat));
    crest.rotation.x = -Math.PI * 0.38;
    crest.position.set(0, 0.25, -0.05);
    this.head.add(crest);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.034, 0.06), this.visorMat);
    visor.position.set(0, 0.12, 0.125);
    this.head.add(visor);

    // Arms (Right = -X, Left = +X when facing +Z)
    const makeArm = (side) => {
      const sx = side === 'R' ? -0.28 : 0.28;
      const shoulder = new THREE.Group();
      shoulder.position.set(sx, 0.39, 0);
      shoulder.rotation.order = 'YXZ';
      this.torso.add(shoulder);

      const pauldron = this._reg(new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 1), this.trimMat));
      pauldron.scale.set(1.15, 0.88, 1.08);
      pauldron.position.set(side === 'R' ? -0.02 : 0.02, 0.02, 0);
      shoulder.add(pauldron);

      const upper = this._reg(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.054, 0.28, 8), this.darkMat));
      upper.position.set(0, -0.14, 0);
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.set(0, -0.28, 0);
      elbow.rotation.order = 'YXZ';
      shoulder.add(elbow);

      const vambrace = this._reg(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.050, 0.26, 8), this.armorMat));
      vambrace.position.set(0, -0.13, 0);
      elbow.add(vambrace);

      const hand = new THREE.Group();
      hand.position.set(0, -0.26, 0);
      hand.rotation.order = 'YXZ';
      elbow.add(hand);

      const gauntlet = this._reg(new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.095), this.trimMat));
      hand.add(gauntlet);

      return { shoulder, elbow, hand };
    };

    const armR = makeArm('R');
    this.shR = armR.shoulder; this.elR = armR.elbow; this.handR = armR.hand;
    const armL = makeArm('L');
    this.shL = armL.shoulder; this.elL = armL.elbow; this.handL = armL.hand;

    // Legs
    const makeLeg = (side) => {
      const lx = side === 'R' ? -0.125 : 0.125;
      const hip = new THREE.Group();
      hip.position.set(lx, -0.04, 0);
      this.pelvis.add(hip);

      const thigh = this._reg(new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.068, 0.42, 8), this.darkMat));
      thigh.position.set(0, -0.21, 0);
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.set(0, -0.42, 0);
      hip.add(knee);

      const kneeGuard = this._reg(new THREE.Mesh(new THREE.OctahedronGeometry(0.068, 0), this.trimMat));
      kneeGuard.position.set(0, 0, 0.045);
      knee.add(kneeGuard);

      const greave = this._reg(new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.056, 0.42, 8), this.armorMat));
      greave.position.set(0, -0.21, 0);
      knee.add(greave);

      const boot = this._reg(new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.095, 0.23), this.trimMat));
      boot.position.set(0, -0.41, 0.045);
      knee.add(boot);

      return { hip, knee };
    };
    const legR = makeLeg('R');
    this.hipR = legR.hip; this.kneeR = legR.knee;
    const legL = makeLeg('L');
    this.hipL = legL.hip; this.kneeL = legL.knee;
  }

  _buildWeapons() {
    // 1. Heroic 1H Broadsword — Blade extends along -Y of handR (coaxial with arm extension!)
    // When shRPitch = -PI/2, elRPitch = 0, wrRPitch = 0, arm+blade point straight forward (+Z) and sweep cleanly with shRYaw!
    this.swordGroup = new THREE.Group();

    const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0), this.goldMat);
    pommel.position.set(0, 0.12, 0);
    this.swordGroup.add(pommel);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.22, 8), this.woodMat);
    grip.position.set(0, 0.0, 0);
    this.swordGroup.add(grip);

    const guard = this._reg(new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.048, 0.065), this.goldMat));
    guard.position.set(0, -0.11, 0);
    this.swordGroup.add(guard);

    // Sculpted diamond-section broadsword blade pointing along -Y (length 1.18m)
    const bladeGeo = new THREE.ConeGeometry(0.082, 1.18, 4);
    bladeGeo.scale(1.05, 1.0, 0.28);
    bladeGeo.rotateZ(Math.PI); // tip points to -Y!
    const blade = this._reg(new THREE.Mesh(bladeGeo, this.bladeMat));
    blade.position.set(0, -0.70, 0);
    this.swordGroup.add(blade);

    const fullerGeo = new THREE.BoxGeometry(0.028, 0.82, 0.052);
    const fuller = new THREE.Mesh(fullerGeo, this.bladeCoreMat);
    fuller.position.set(0, -0.54, 0);
    this.swordGroup.add(fuller);

    this.swordTip = new THREE.Object3D();
    this.swordTip.position.set(0, -1.28, 0);
    this.swordGroup.add(this.swordTip);
    this.handR.add(this.swordGroup);

    // 2. Curved 3D Knight Heater Shield on Left Forearm (curved shell, NEVER a flat blue rectangle!)
    this.shieldGroup = new THREE.Group();
    const arcSpan = 1.08;
    const shieldShellGeo = new THREE.CylinderGeometry(0.38, 0.28, 0.64, 14, 1, true, -arcSpan / 2, arcSpan);
    const shieldBackGeo = new THREE.CylinderGeometry(0.365, 0.268, 0.60, 14, 1, true, -arcSpan / 2, arcSpan);
    const shieldMatFront = new THREE.MeshStandardMaterial({ color: 0x354b75, roughness: 0.32, metalness: 0.68, side: THREE.DoubleSide });
    const shieldShell = this._reg(new THREE.Mesh(shieldShellGeo, shieldMatFront));
    const shieldTrim = this._reg(new THREE.Mesh(shieldBackGeo, this.goldMat));
    // Place curved cylinder surface facing outward (+X/+Z) around forearm!
    const shieldHolder = new THREE.Group();
    shieldHolder.position.set(-0.22, -0.10, 0.04);
    shieldHolder.rotation.y = Math.PI * 0.42;
    shieldHolder.add(shieldShell, shieldTrim);

    const boss = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), this.goldMat);
    boss.position.set(0.09, -0.10, 0.14);
    this.shieldGroup.add(shieldHolder, boss);
    this.elL.add(this.shieldGroup); // Attached directly to left forearm!

    // 3. Twin Curved Assassin Daggers (along -Y of each hand)
    const makeDagger = () => {
      const g = new THREE.Group();
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.032, 0.042), this.goldMat);
      cross.position.set(0, -0.06, 0);
      g.add(cross);
      const dg = new THREE.ConeGeometry(0.056, 0.62, 4);
      dg.scale(0.95, 1, 0.30);
      dg.rotateZ(Math.PI);
      const m = this._reg(new THREE.Mesh(dg, this.bladeMat));
      m.position.set(0, -0.37, 0);
      g.add(m);
      return g;
    };
    this.daggerR = makeDagger();
    this.daggerL = makeDagger();
    this.handR.add(this.daggerR);
    this.handL.add(this.daggerL);

    // 4. Ornate Archmage Staff (held upright along +Z of handR when forearm is horizontal)
    this.staffGroup = new THREE.Group();
    const shaft = this._reg(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 1.86, 8), this.woodMat));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, 0, 0.36);
    this.staffGroup.add(shaft);

    const collar = this._reg(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.032, 0.18, 8), this.goldMat));
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0, 1.15);
    this.staffGroup.add(collar);

    const crownOuter = this._reg(new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.022, 8, 24, Math.PI * 1.55), this.goldMat));
    crownOuter.rotation.z = Math.PI * 0.72;
    crownOuter.position.set(0, 0, 1.32);
    this.staffGroup.add(crownOuter);

    const crownInner = this._reg(new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.014, 6, 20), this.trimMat));
    crownInner.rotation.y = Math.PI / 2;
    crownInner.position.set(0, 0, 1.32);
    this.staffGroup.add(crownInner);

    this.staffGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), this.orbMat);
    this.staffGem.scale.set(0.85, 0.85, 1.35);
    this.staffGem.position.set(0, 0, 1.32);
    this.staffGroup.add(this.staffGem);

    this.staffTip = new THREE.Object3D();
    this.staffTip.position.set(0, 0, 1.32);
    this.staffGroup.add(this.staffTip);
    this.handR.add(this.staffGroup);

    // 5. Reaper War-Scythe (long shaft along -Y + curved crescent blade)
    this.scytheGroup = new THREE.Group();
    const scShaft = this._reg(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 1.95, 8), this.darkMat));
    scShaft.position.set(0, -0.58, 0);
    this.scytheGroup.add(scShaft);
    const scHead = this._reg(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.96, 4), this.bladeMat));
    scHead.scale.set(1.1, 1.0, 0.25);
    scHead.rotation.z = -Math.PI * 0.44;
    scHead.position.set(0.42, -1.48, 0);
    this.scytheGroup.add(scHead);
    this.handR.add(this.scytheGroup);

    // 6. Dragon-Piercer Spear / Lance (along -Y of handR)
    this.spearGroup = new THREE.Group();
    const spShaft = this._reg(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.022, 1.85, 8), this.woodMat));
    spShaft.position.set(0, -0.52, 0);
    this.spearGroup.add(spShaft);
    const spRing = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.016, 6, 16), this.goldMat);
    spRing.rotation.x = Math.PI / 2;
    spRing.position.set(0, -1.28, 0);
    this.spearGroup.add(spRing);
    const spTip = this._reg(new THREE.Mesh(new THREE.ConeGeometry(0.078, 0.62, 4), this.bladeMat));
    spTip.scale.set(1.0, 1.0, 0.45);
    spTip.rotateZ(Math.PI);
    spTip.position.set(0, -1.60, 0);
    this.spearGroup.add(spTip);
    this.handR.add(this.spearGroup);

    // 7. Ornate Elven Recurve Greatbow in Left Hand + Dynamic Taut Bowstring + Nocked Spirit Arrow!
    // When shLPitch = -1.52, elLPitch = -0.05, left arm points forward (+Z); bow limbs span vertical world Y!
    this.bowGroup = new THREE.Group();
    const bowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.18,  0.68),
      new THREE.Vector3(0, -0.06,  0.46),
      new THREE.Vector3(0, -0.14,  0.18),
      new THREE.Vector3(0, -0.09,  0.00),
      new THREE.Vector3(0, -0.14, -0.18),
      new THREE.Vector3(0, -0.06, -0.46),
      new THREE.Vector3(0, -0.18, -0.68),
    ]);
    const bowLimbGeo = new THREE.TubeGeometry(bowCurve, 36, 0.024, 8, false);
    const bowLimbMesh = this._reg(new THREE.Mesh(bowLimbGeo, this.goldMat));
    this.bowGroup.add(bowLimbMesh);

    const bowRiser = new THREE.Mesh(new THREE.OctahedronGeometry(0.062, 0), this.orbMat);
    bowRiser.position.set(0, -0.14, 0);
    this.bowGroup.add(bowRiser);

    // Dynamic 2-segment glowing energy bowstring (pulls from y=0.05 back to y=+0.58 along arm as bowDraw goes 0..1!)
    this.bowStrMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#c8f4ff').multiplyScalar(1.8),
      transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const segCylinder = new THREE.CylinderGeometry(0.0055, 0.0055, 1.0, 6);
    segCylinder.translate(0, 0.5, 0);
    segCylinder.rotateX(Math.PI / 2); // oriented along +Z of segment helper so lookAt points cleanly!
    this.bowStrTop = new THREE.Mesh(segCylinder, this.bowStrMat);
    this.bowStrBot = new THREE.Mesh(segCylinder, this.bowStrMat);
    this.bowGroup.add(this.bowStrTop, this.bowStrBot);

    // Nocked glowing spirit arrow sitting on bow rest (points forward along -Y of handL = +Z world!)
    this.bowNockedArrow = new THREE.Group();
    const nShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.008, 0.92, 6), this.orbMat);
    nShaft.position.set(0, -0.32, 0);
    const nHead = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), this.orbMat);
    nHead.scale.set(0.048, 0.16, 0.022);
    nHead.position.set(0, -0.82, 0);
    this.bowNockedArrow.add(nShaft, nHead);
    this.bowGroup.add(this.bowNockedArrow);

    this.bowMuzzle = new THREE.Object3D();
    this.bowMuzzle.position.set(0, -0.45, 0);
    this.bowGroup.add(this.bowMuzzle);
    this.handL.add(this.bowGroup);
  }

  setLoadout(kind, accentHex = '#7ce8ff') {
    this.loadout = kind;
    this.swordGroup.visible = kind === 'sword_shield' || kind === 'greatsword';
    this.swordGroup.scale.setScalar(kind === 'greatsword' ? 1.24 : 1.0);
    this.shieldGroup.visible = kind === 'sword_shield';
    this.daggerR.visible = kind === 'dual_daggers';
    this.daggerL.visible = kind === 'dual_daggers';
    this.staffGroup.visible = kind === 'mage_staff';
    this.scytheGroup.visible = kind === 'scythe';
    this.spearGroup.visible = kind === 'spear';
    this.bowGroup.visible = kind === 'bow';
    // 'unarmed' hides all weapons cleanly for holy/aura/hand-cast spells!

    const ac = new THREE.Color(accentHex);
    this.visorMat.color.copy(ac).multiplyScalar(1.75);
    this.orbMat.color.copy(ac).multiplyScalar(2.0);
    this.bladeCoreMat.color.copy(ac).multiplyScalar(1.65);
    this.bladeMat.emissive.copy(ac).multiplyScalar(0.28);
    if (this.bowStrMat) this.bowStrMat.color.copy(ac).lerp(new THREE.Color('#ffffff'), 0.45).multiplyScalar(1.85);
  }

  applyPose(p) {
    const pose = { ...REST_POSE, ...p };
    this.pose = pose;
    this.root.position.set(pose.x, pose.y, pose.z);
    this.root.rotation.y = pose.yaw;

    this.pelvis.position.y = 0.90 - pose.crouch;
    this.torso.rotation.set(pose.torsoPitch, pose.torsoYaw, pose.torsoRoll, 'YXZ');
    this.head.rotation.set(pose.headPitch, pose.headYaw, 0, 'YXZ');
    this.capePivot.rotation.x = pose.capePitch ?? (0.18 + Math.max(0, pose.torsoPitch) * 0.7);

    this.shR.rotation.set(pose.shRPitch, pose.shRYaw, pose.shRRoll, 'YXZ');
    this.elR.rotation.set(pose.elRPitch, 0, 0, 'YXZ');
    this.handR.rotation.set(pose.wrRPitch, pose.wrRYaw, pose.wrRRoll, 'YXZ');

    this.shL.rotation.set(pose.shLPitch, pose.shLYaw, pose.shLRoll, 'YXZ');
    this.elL.rotation.set(pose.elLPitch, 0, 0, 'YXZ');
    this.handL.rotation.set(pose.wrLPitch, pose.wrLYaw, pose.wrLRoll, 'YXZ');

    this.hipR.rotation.set(pose.hipRPitch, 0, 0);
    this.kneeR.rotation.set(pose.kneeRPitch, 0, 0);
    this.hipL.rotation.set(pose.hipLPitch, 0, 0);
    this.kneeL.rotation.set(pose.kneeLPitch, 0, 0);

    if (this.bowGroup && this.bowGroup.visible) {
      const draw = clamp(pose.bowDraw ?? 0, 0, 1);
      const nockY = 0.16 + draw * 0.56; // pulls back toward archer's cheek along +Y of handL!
      const tipTop = new THREE.Vector3(0, -0.18, 0.68);
      const tipBot = new THREE.Vector3(0, -0.18, -0.68);
      const nockPt = new THREE.Vector3(0, nockY, 0);

      this.bowStrTop.position.copy(tipTop);
      const zAxis = new THREE.Vector3(0, 0, 1);
      const dTop = nockPt.clone().sub(tipTop);
      this.bowStrTop.quaternion.setFromUnitVectors(zAxis, dTop.clone().normalize());
      this.bowStrTop.scale.set(1, 1, dTop.length());

      const dBot = nockPt.clone().sub(tipBot);
      this.bowStrBot.position.copy(tipBot);
      this.bowStrBot.quaternion.setFromUnitVectors(zAxis, dBot.clone().normalize());
      this.bowStrBot.scale.set(1, 1, dBot.length());

      this.bowNockedArrow.visible = (pose.bowArrow ?? (draw > 0.04 ? 1 : 0)) > 0.3;
      this.bowNockedArrow.position.set(0, draw * 0.48, 0);
    }

    this.root.updateMatrixWorld(true);
  }

  sampleKeyframes(keyframes, t) {
    if (!keyframes.length) return REST_POSE;
    if (t <= keyframes[0].t) return keyframes[0].pose;
    for (let i = 0; i < keyframes.length - 1; i++) {
      const a = keyframes[i], b = keyframes[i + 1];
      if (t >= a.t && t <= b.t) {
        const u = clamp((t - a.t) / Math.max(1e-5, b.t - a.t));
        const fn = b.ease || ((x) => x * x * (3 - 2 * x));
        return poseLerp(a.pose, b.pose, fn(u));
      }
    }
    return keyframes[keyframes.length - 1].pose;
  }

  getSwordTipWorld() {
    this.root.updateMatrixWorld(true);
    const v = this.swordTip.getWorldPosition(new THREE.Vector3());
    v._isWorldScaled = true;
    return v;
  }

  getStaffTipWorld() {
    this.root.updateMatrixWorld(true);
    const v = this.staffTip.getWorldPosition(new THREE.Vector3());
    v._isWorldScaled = true;
    return v;
  }

  getLeftHandWorld() {
    this.root.updateMatrixWorld(true);
    const v = this.handL.getWorldPosition(new THREE.Vector3());
    v._isWorldScaled = true;
    return v;
  }

  getRightHandWorld() {
    this.root.updateMatrixWorld(true);
    const v = this.handR.getWorldPosition(new THREE.Vector3());
    v._isWorldScaled = true;
    return v;
  }

  getBowMuzzleWorld() {
    this.root.updateMatrixWorld(true);
    const v = this.bowMuzzle.getWorldPosition(new THREE.Vector3());
    v._isWorldScaled = true;
    return v;
  }

  headTopWorld() {
    this.root.updateMatrixWorld(true);
    const v = this.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.30, 0));
    v._isWorldScaled = true;
    return v;
  }

  chestWorld() {
    this.root.updateMatrixWorld(true);
    const v = this.torso.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.25, 0));
    v._isWorldScaled = true;
    return v;
  }

  spawnGhost(sim, { color = '#9b5cff', life = 0.28, opacity = 0.42 } = {}) {
    this.root.updateMatrixWorld(true);
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(1.65),
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (const src of this._ghostMeshes) {
      let vis = true, cur = src;
      while (cur && cur !== this.root) {
        if (!cur.visible) { vis = false; break; }
        cur = cur.parent;
      }
      if (!vis) continue;
      const clone = new THREE.Mesh(src.geometry, mat);
      clone.matrixAutoUpdate = false;
      clone.matrix.copy(src.matrixWorld);
      g.add(clone);
    }
    sim.addCustom({
      group: g, life, max: life,
      update(_dt, k) { mat.opacity = opacity * k * k; },
      dispose() { mat.dispose(); },
    });
  }

  resetSupportHUD() {
    this._weaponEnchantTimer = 0;
    this._bodyAuraTimer = 0;
    this.armorMat.emissive.setRGB(0, 0, 0);
    this.trimMat.emissive.setRGB(0, 0, 0);
    if (this.statusBar) {
      this.statusBar.reset({ visible: false, hpFrac: 1.0, shieldFrac: 0.0 });
    }
  }

  pulseBodyAura(hex = '#fde047', duration = 1.45) {
    this._bodyAuraColor.set(hex);
    this._bodyAuraTimer = duration;
    this._bodyAuraMax = Math.max(0.1, duration);
  }

  enableSupportHUD({ hpFrac = 0.34, shieldFrac = 0.0 } = {}) {
    if (this.statusBar) {
      this.statusBar.reset({ visible: true, hpFrac, shieldFrac });
    }
  }

  heal(amount = 0.55, label = '+HP 聖癒') {
    if (!this.statusBar) return;
    if (!this.statusBar.group.visible) this.statusBar.reset({ visible: true, hpFrac: 0.35, shieldFrac: 0 });
    this.statusBar.heal(amount, label);
  }

  addShield(amount = 0.65, label = '+護盾障壁') {
    if (!this.statusBar) return;
    if (!this.statusBar.group.visible) this.statusBar.reset({ visible: true, hpFrac: 0.88, shieldFrac: 0 });
    this.statusBar.addShield(amount, label);
  }

  addBuff(label = '▲戰意強化', hex = '#fbbf24') {
    if (!this.statusBar) return;
    if (!this.statusBar.group.visible) this.statusBar.reset({ visible: true, hpFrac: 1.0, shieldFrac: 0 });
    this.statusBar.triggerBadge('buff', label, hex);
  }

  empowerWeapon(hex = '#ff7b29', duration = 2.2, label = '▲武器附魔') {
    this._weaponEnchantColor.set(hex);
    this._weaponEnchantTimer = duration;
    this._weaponEnchantMax = Math.max(0.1, duration);
    this.bladeCoreMat.color.copy(this._weaponEnchantColor).multiplyScalar(2.6);
    this.bladeMat.emissive.copy(this._weaponEnchantColor).multiplyScalar(0.85);
    this.orbMat.color.copy(this._weaponEnchantColor).multiplyScalar(2.8);
    if (label && this.statusBar) {
      if (!this.statusBar.group.visible) this.statusBar.reset({ visible: true, hpFrac: 1.0, shieldFrac: 0 });
      this.statusBar.triggerBadge('buff', label, hex);
    }
  }

  updateSupport(dt, camera = null) {
    if (this._weaponEnchantTimer > 0) {
      this._weaponEnchantTimer = Math.max(0, this._weaponEnchantTimer - dt);
      const pulse = 0.78 + 0.22 * Math.sin(this._weaponEnchantTimer * 16.0);
      this.bladeMat.emissive.copy(this._weaponEnchantColor).multiplyScalar(0.75 * pulse);
      this.orbMat.color.copy(this._weaponEnchantColor).multiplyScalar(2.6 * pulse);
    }
    if (this._bodyAuraTimer > 0) {
      this._bodyAuraTimer = Math.max(0, this._bodyAuraTimer - dt);
      const k = clamp(this._bodyAuraTimer / this._bodyAuraMax, 0, 1);
      const shimmer = (0.76 + 0.24 * Math.sin(this._bodyAuraTimer * 14.0)) * Math.sin(k * Math.PI);
      this.armorMat.emissive.copy(this._bodyAuraColor).multiplyScalar(0.46 * shimmer);
      this.trimMat.emissive.copy(this._bodyAuraColor).multiplyScalar(0.68 * shimmer);
    } else {
      this.armorMat.emissive.setRGB(0, 0, 0);
      this.trimMat.emissive.setRGB(0, 0, 0);
    }
    if (this.statusBar && this.statusBar.group.visible) {
      this.statusBar.update(dt, camera);
    }
  }
}

export class DummyTarget3D {
  constructor(scene, x = 0, z = 2.0) {
    this.scene = scene;
    this.homeX = x;
    this.homeZ = z;
    this.worldAnchor = new THREE.Group();
    scene.add(this.worldAnchor);
    this.root = new THREE.Group();
    this.root.position.set(x, 0, z);
    this.worldAnchor.add(this.root);

    const ironMat = new THREE.MeshStandardMaterial({ color: 0x2d3648, roughness: 0.45, metalness: 0.65 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xb88b4a, roughness: 0.35, metalness: 0.72 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3e2b, roughness: 0.78 });

    // Beveled octagonal heavy pedestal
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.50, 0.10, 8), ironMat);
    base.position.y = 0.05;
    this.root.add(base);
    const baseRim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.022, 6, 24).rotateX(Math.PI / 2), brassMat);
    baseRim.position.y = 0.095;
    this.root.add(baseRim);

    this.pivot = new THREE.Group();
    this.pivot.position.y = 0.10;
    this.root.add(this.pivot);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 1.50, 8), woodMat);
    post.position.y = 0.75;
    this.pivot.add(post);

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x8a684c,
      emissive: new THREE.Color(0x000000),
      roughness: 0.62,
      metalness: 0.12,
    });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.72, 10), this.bodyMat);
    torso.scale.set(1.08, 1, 0.88);
    torso.position.set(0, 1.04, 0);
    this.pivot.add(torso);

    // Iron armor bands & pauldrons on dummy
    for (const yOff of [0.80, 1.26]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.06, 10), ironMat);
      band.scale.set(1.08, 1, 0.88);
      band.position.set(0, yOff, 0);
      this.pivot.add(band);
    }

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.92, 8), woodMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 1.26;
    this.pivot.add(bar);

    for (const sgn of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), ironMat);
      pad.position.set(sgn * 0.36, 1.28, 0);
      this.pivot.add(pad);
    }

    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), this.bodyMat);
    head.position.y = 1.58;
    this.pivot.add(head);

    const helmCap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.195, 0.14, 8), ironMat);
    helmCap.position.y = 1.66;
    this.pivot.add(helmCap);

    // Sculpted 3D target emblem on chest facing -Z
    const emblem = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 6, 20), new THREE.MeshBasicMaterial({ color: 0xff5964 }));
    emblem.position.set(0, 1.06, -0.255);
    this.pivot.add(emblem);

    this.reset(x, z);
  }

  get active() {
    return this.root.visible;
  }

  reset(x = this.homeX, z = this.homeZ, visible = true) {
    this.homeX = x;
    this.homeZ = z;
    this.worldAnchor.position.set(0, 0, 0);
    this.root.visible = visible;
    this.root.position.set(x, 0, z);
    this.tiltX = 0; this.tiltZ = 0;
    this.velX = 0; this.velZ = 0;
    this.pushX = 0; this.pushZ = 0;
    this.physAccum = 0;
    this.squashTimer = 0;
    this.iFrameTimer = 0;
    this.flash = 0;
    this.flashColor = new THREE.Color('#ffffff');
    this.shiver = 0; this.shiverTime = 0;
    this.pivot.visible = true;
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.scale.set(1, 1, 1);
    this.pivot.position.set(0, 0.10, 0);
    this.bodyMat.emissive.setRGB(0, 0, 0);
  }

  /** Visually places dummy at world (wx, wz) while keeping homeX/homeZ/root.position in 1.0x skill space */
  setWorldPosition(wx, wz) {
    this.worldAnchor.position.set(wx - this.homeX, 0, wz - this.homeZ);
  }

  worldPosition() {
    return new THREE.Vector3(
      this.worldAnchor.position.x + this.root.position.x,
      this.root.position.y,
      this.worldAnchor.position.z + this.root.position.z
    );
  }

  hit({ dirX = 0, dirZ = 1, power = 1.0, noPush = true, flashColor = '#ffffff', shiver = 0, iFrames = 0 } = {}) {
    if (this.iFrameTimer > 0) return false;
    const len = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / len, nz = dirZ / len;
    this.velX += nz * 5.2 * power;
    this.velZ += -nx * 5.2 * power;
    if (!noPush) {
      this.pushX += nx * 0.26 * power;
      this.pushZ += nz * 0.26 * power;
    }
    this.flash = 0.11;
    this.flashColor.set(flashColor);
    this.shiver = Math.max(this.shiver, shiver);
    this.squashTimer = 0.15;
    if (iFrames > 0) this.iFrameTimer = iFrames;
    return true;
  }

  update(dt) {
    if (!this.root.visible) return;
    // #24 Fixed 120Hz Timestep Accumulator for spring-damper stability across any frame rate
    this.physAccum = Math.min(0.25, (this.physAccum || 0) + dt);
    const fixedDt = 1 / 120;
    const k = 155, damp = 11.5;
    while (this.physAccum >= fixedDt) {
      this.velX += (-k * this.tiltX - damp * this.velX) * fixedDt;
      this.velZ += (-k * this.tiltZ - damp * this.velZ) * fixedDt;
      this.tiltX = clamp(this.tiltX + this.velX * fixedDt, -0.52, 0.52);
      this.tiltZ = clamp(this.tiltZ + this.velZ * fixedDt, -0.52, 0.52);
      this.physAccum -= fixedDt;
    }

    // #09 Frame-rate-independent exponential decay: exp(-k * dt)
    const expDecay = Math.exp(-6.0 * dt);
    this.pushX *= expDecay;
    this.pushZ *= expDecay;
    this.root.position.set(this.homeX + this.pushX, 0, this.homeZ + this.pushZ);

    // #13 Volume-preserving Squash & Stretch anchored at pedestal (y=0.10)
    if (this.squashTimer > 0) {
      this.squashTimer = Math.max(0, this.squashTimer - dt);
      const u = 1 - clamp(this.squashTimer / 0.15, 0, 1);
      const sy = 0.80 + 0.20 * (1 - Math.pow(1 - u, 3));
      const inv = 1 / Math.sqrt(sy);
      this.pivot.scale.set(inv, sy, inv);
    } else {
      this.pivot.scale.set(1, 1, 1);
    }

    // #18 Invincibility frames: 10 Hz blink while active
    if (this.iFrameTimer > 0) {
      this.iFrameTimer = Math.max(0, this.iFrameTimer - dt);
      this.pivot.visible = this.iFrameTimer <= 0 ? true : (Math.floor(this.iFrameTimer * 20) % 2 === 0);
    } else {
      this.pivot.visible = true;
    }

    let jx = 0, jz = 0;
    if (this.shiver > 0) {
      this.shiver = Math.max(0, this.shiver - dt);
      this.shiverTime += dt * 65;
      jx = Math.sin(this.shiverTime * 1.7) * 0.035;
      jz = Math.cos(this.shiverTime * 2.3) * 0.035;
    }
    this.pivot.position.set(jx, 0.10, jz);
    this.pivot.rotation.set(this.tiltX, 0, this.tiltZ);

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      const u = this.flash / 0.11;
      this.bodyMat.emissive.copy(this.flashColor).multiplyScalar(u * 0.35);
    } else {
      this.bodyMat.emissive.setRGB(0, 0, 0);
    }
  }

  chestWorld() {
    return new THREE.Vector3(this.root.position.x, 1.15, this.root.position.z);
  }
}

// ============================================================================
// Overhead 3D Unit HP / Overshield / Buff Status Bar (WebGL + Headless + .GLB Ready!)
// ============================================================================
let _sharedBarLeftGeo = null;
function getSharedLeftBarGeo() {
  if (!_sharedBarLeftGeo) {
    _sharedBarLeftGeo = new THREE.BoxGeometry(1, 1, 1);
    _sharedBarLeftGeo.translate(0.5, 0, 0);
  }
  return _sharedBarLeftGeo;
}

export class UnitStatusBar3D {
  constructor(parentGroup, { y = 2.24, width = 0.94, roleColor = '#34d399', name = '隊友' } = {}) {
    this.width = width;
    this.baseY = y;
    this.name = name;
    this.group = new THREE.Group();
    this.group.position.set(0, y, 0);
    this.group.rotation.y = -0.68; // Default readable isometric yaw when no camera passed
    parentGroup.add(this.group);

    const frameMat = new THREE.MeshBasicMaterial({ color: 0x09101d, transparent: true, opacity: 0.90 });
    const borderMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(roleColor).multiplyScalar(1.15) });
    this.frameMesh = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.145, 0.020), frameMat);
    this.borderMesh = new THREE.Mesh(new THREE.BoxGeometry(width + 0.085, 0.165, 0.012), borderMat);
    this.borderMesh.position.z = -0.005;
    this.group.add(this.borderMesh, this.frameMesh);

    const leftGeo = getSharedLeftBarGeo();

    // Delayed white-gold healing preview / catchup bar
    this.hpGhostMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fef08a').multiplyScalar(1.45) });
    this.hpGhostMesh = new THREE.Mesh(leftGeo, this.hpGhostMat);
    this.hpGhostMesh.position.set(-width * 0.5, -0.022, 0.011);
    this.hpGhostMesh.scale.set(width, 0.068, 0.012);
    this.group.add(this.hpGhostMesh);

    // Primary dynamic HP fill bar (Crimson -> Amber -> Vibrant Emerald)
    this.hpFillMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#22c55e').multiplyScalar(1.45) });
    this.hpFillMesh = new THREE.Mesh(leftGeo, this.hpFillMat);
    this.hpFillMesh.position.set(-width * 0.5, -0.022, 0.015);
    this.hpFillMesh.scale.set(width, 0.068, 0.014);
    this.group.add(this.hpFillMesh);

    // Secondary Platinum-Cyan Overshield bar stacked cleanly above HP bar
    this.shieldFillMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#67e8f9').multiplyScalar(1.75) });
    this.shieldFillMesh = new THREE.Mesh(leftGeo, this.shieldFillMat);
    this.shieldFillMesh.position.set(-width * 0.5, 0.036, 0.015);
    this.shieldFillMesh.scale.set(0.001, 0.042, 0.014);
    this.shieldFillMesh.visible = false;
    this.group.add(this.shieldFillMesh);

    // Sculpted 3D Floating Emblem Group (+HP Emerald Cross / Golden Revive Star / Buff Chevrons)
    this.badge3D = new THREE.Group();
    this.badge3D.position.set(0, 0.20, 0.02);
    this.badge3D.visible = false;
    this.badgeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#4ade80').multiplyScalar(1.9),
      transparent: true,
      opacity: 1,
    });
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.052, 0.028), this.badgeMat);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.18, 0.028), this.badgeMat);
    const starGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), this.badgeMat);
    starGem.position.set(0.22, 0, 0);
    this.badge3D.add(crossH, crossV, starGem);
    this.group.add(this.badge3D);

    // Optional crisp CanvasTexture popup text in browser mode
    this.popupMesh = null;
    this.popupTex = null;
    this.popupCanvas = null;
    if (typeof document !== 'undefined') {
      const cv = document.createElement('canvas');
      cv.width = 256;
      cv.height = 64;
      this.popupCanvas = cv;
      this.popupTex = new THREE.CanvasTexture(cv);
      this.popupTex.colorSpace = THREE.SRGBColorSpace;
      const pMat = new THREE.MeshBasicMaterial({
        map: this.popupTex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.popupMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.24), pMat);
      this.popupMesh.position.set(0, 0.28, 0.03);
      this.popupMesh.visible = false;
      this.group.add(this.popupMesh);
    }

    this.hpFrac = 1.0;
    this.displayHp = 1.0;
    this.shieldFrac = 0.0;
    this.displayShield = 0.0;
    this.badgeTimer = 0;
    this.badgeMax = 1.0;
    this._syncBars();
  }

  setVisible(v) {
    this.group.visible = Boolean(v);
  }

  reset({ visible = true, hpFrac = 1.0, shieldFrac = 0.0 } = {}) {
    this.group.visible = visible;
    this.hpFrac = clamp(hpFrac, 0, 1);
    this.displayHp = this.hpFrac;
    this.shieldFrac = clamp(shieldFrac, 0, 1);
    this.displayShield = this.shieldFrac;
    this.badgeTimer = 0;
    this.badge3D.visible = false;
    if (this.popupMesh) this.popupMesh.visible = false;
    this._syncBars();
  }

  _drawPopupText(label, hex) {
    if (!this.popupCanvas || !this.popupTex) return;
    const ctx = this.popupCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(7, 12, 24, 0.82)';
    ctx.beginPath();
    ctx.roundRect(14, 8, 228, 48, 12);
    ctx.fill();
    ctx.strokeStyle = hex;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = 'bold 26px system-ui, "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = hex;
    ctx.shadowBlur = 10;
    ctx.fillText(label, 128, 33);
    this.popupTex.needsUpdate = true;
  }

  triggerBadge(_kind = 'heal', label = '+HP', hex = '#4ade80') {
    this.badgeMat.color.set(hex).multiplyScalar(1.85);
    this.badgeTimer = 1.15;
    this.badgeMax = 1.15;
    this.badge3D.visible = true;
    this.badge3D.position.y = 0.19;
    if (this.popupMesh) {
      this._drawPopupText(label, hex);
      this.popupMesh.visible = true;
      this.popupMesh.position.y = 0.36;
      this.popupMesh.material.opacity = 1.0;
    }
  }

  heal(amount = 0.5, label = '+HP 治癒') {
    this.hpFrac = clamp(this.hpFrac + amount, 0, 1);
    this.triggerBadge('heal', label, '#34d399');
  }

  addShield(amount = 0.6, label = '+聖盾障壁') {
    this.shieldFrac = clamp(this.shieldFrac + amount, 0, 1);
    this.triggerBadge('shield', label, '#67e8f9');
  }

  _syncBars() {
    const hp = clamp(this.displayHp, 0.002, 1.0);
    const targetHp = clamp(Math.max(this.hpFrac, this.displayHp), 0.002, 1.0);
    this.hpFillMesh.scale.x = this.width * hp;
    this.hpGhostMesh.scale.x = this.width * targetHp;

    if (hp < 0.35) {
      this.hpFillMat.color.set('#ef4444').multiplyScalar(1.45);
    } else if (hp < 0.68) {
      this.hpFillMat.color.set('#f59e0b').multiplyScalar(1.42);
    } else {
      this.hpFillMat.color.set('#10b981').multiplyScalar(1.52);
    }

    const sh = clamp(this.displayShield, 0, 1.0);
    this.shieldFillMesh.visible = sh > 0.006;
    this.shieldFillMesh.scale.x = Math.max(0.002, this.width * sh);
  }

  update(dt, camera = null) {
    if (!this.group.visible) return;
    const rate = 1 - Math.exp(-7.5 * dt);
    this.displayHp = lerp(this.displayHp, this.hpFrac, rate);
    this.displayShield = lerp(this.displayShield, this.shieldFrac, rate);
    this._syncBars();

    if (camera) {
      const wp = this.group.getWorldPosition(new THREE.Vector3());
      const dx = camera.position.x - wp.x;
      const dz = camera.position.z - wp.z;
      if (dx * dx + dz * dz > 1e-4) {
        const worldQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dx, dz));
        if (this.group.parent) {
          const parentQuat = this.group.parent.getWorldQuaternion(new THREE.Quaternion());
          this.group.quaternion.copy(parentQuat.invert().multiply(worldQuat));
        } else {
          this.group.quaternion.copy(worldQuat);
        }
      }
    }

    if (this.badgeTimer > 0) {
      this.badgeTimer = Math.max(0, this.badgeTimer - dt);
      const u = 1 - this.badgeTimer / this.badgeMax;
      const fade = clamp(this.badgeTimer / 0.32, 0, 1);
      this.badge3D.position.y = 0.18 + u * 0.14;
      this.badge3D.rotation.y = u * 2.4;
      this.badgeMat.opacity = fade;
      if (this.popupMesh) {
        this.popupMesh.position.y = 0.36 + u * 0.18;
        this.popupMesh.material.opacity = fade;
      }
      if (this.badgeTimer <= 0) {
        this.badge3D.visible = false;
        if (this.popupMesh) this.popupMesh.visible = false;
      }
    }
  }
}

// ============================================================================
// 3D Friendly Party Companion Hero (Paladin Vanguard / Emerald Ranger / Astral Mystic)
// ============================================================================
const ALLY_ROLES = [
  {
    name: '聖殿護衛・艾爾',
    armorHex: 0x3b6e6c,
    trimHex: 0xfacc15,
    capeHex: 0x134e4a,
    glowHex: '#34d399',
    weapon: 'paladin',
  },
  {
    name: '翠風遊俠・琳',
    armorHex: 0x2d5a43,
    trimHex: 0xa7f3d0,
    capeHex: 0x14532d,
    glowHex: '#4ade80',
    weapon: 'ranger',
  },
  {
    name: '星辰秘術・諾亞',
    armorHex: 0x364f7d,
    trimHex: 0xfde047,
    capeHex: 0x1e3a8a,
    glowHex: '#67e8f9',
    weapon: 'mystic',
  },
];

export class AllyHero3D {
  constructor(scene, roleIdx = 0) {
    this.scene = scene;
    this.roleIdx = roleIdx % ALLY_ROLES.length;
    this.role = ALLY_ROLES[this.roleIdx];
    this.homeX = 0;
    this.homeZ = 5.0;

    this.worldAnchor = new THREE.Group();
    scene.add(this.worldAnchor);

    this.root = new THREE.Group();
    this.root.visible = false;
    this.worldAnchor.add(this.root);

    // Friendly Emerald-Gold Party Sanctuary Ring underfoot (immediately distinguishes allies from enemy dummies!)
    this.partyRingGroup = new THREE.Group();
    this.partyRingGroup.position.y = 0.016;
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.role.glowHex).multiplyScalar(1.45),
      transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false,
    });
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fde047').multiplyScalar(1.35),
      transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false,
    });
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.63, 40).rotateX(-Math.PI / 2), outerRingMat);
    const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.45, 6).rotateX(-Math.PI / 2), innerRingMat);
    this.partyRingGroup.add(outerRing, innerRing);
    this.root.add(this.partyRingGroup);

    // Body pivot (allows fallen-down 90° collapse and heroic resurrection rise!)
    this.bodyPivot = new THREE.Group();
    this.root.add(this.bodyPivot);

    this.armorMat = new THREE.MeshStandardMaterial({
      color: this.role.armorHex,
      emissive: new THREE.Color(0x000000),
      roughness: 0.34,
      metalness: 0.56,
    });
    this.trimMat = new THREE.MeshStandardMaterial({ color: this.role.trimHex, roughness: 0.26, metalness: 0.78 });
    this.darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.62, metalness: 0.25 });
    this.capeMat = new THREE.MeshStandardMaterial({ color: this.role.capeHex, roughness: 0.72, side: THREE.DoubleSide });
    this.weaponGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.role.glowHex).multiplyScalar(1.85) });
    this.weaponBladeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: new THREE.Color(this.role.glowHex).multiplyScalar(0.32),
      roughness: 0.18,
      metalness: 0.85,
    });

    this._buildHeroSilhouette();
    this._buildCurseChains();

    this.statusBar = new UnitStatusBar3D(this.root, {
      y: 2.28,
      width: 0.94,
      roleColor: this.role.glowHex,
      name: this.role.name,
    });

    this.fallen = false;
    this.fallAngle = 0;
    this.cursed = false;
    this.flashTimer = 0;
    this.flashColor = new THREE.Color('#34d399');
    this.enchantTimer = 0;
    this.enchantColor = new THREE.Color('#ff7b29');
    this.cheerTimer = 0;
    this._animTime = 0;
  }

  _buildHeroSilhouette() {
    // Boots & Greaves
    for (const sgn of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.060, 0.82, 8), this.darkMat);
      leg.position.set(sgn * 0.125, 0.44, 0);
      const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.068, 0.44, 8), this.armorMat);
      greave.position.set(sgn * 0.125, 0.26, 0);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.095, 0.22), this.trimMat);
      boot.position.set(sgn * 0.125, 0.05, 0.04);
      this.bodyPivot.add(leg, greave, boot);
    }

    // Torso & Cuirass
    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.92, 0);
    this.bodyPivot.add(this.torso);

    const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.50, 10), this.armorMat);
    cuirass.scale.set(1.10, 1, 0.80);
    cuirass.position.set(0, 0.24, 0);
    const chestGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.058, 0), this.weaponGlowMat);
    chestGem.position.set(0, 0.30, 0.155);
    const capeGeo = new THREE.ConeGeometry(0.27, 0.72, 5);
    capeGeo.scale(1.15, 1, 0.22);
    capeGeo.translate(0, -0.36, 0);
    const cape = new THREE.Mesh(capeGeo, this.capeMat);
    cape.position.set(0, 0.42, -0.14);
    cape.rotation.x = 0.18;
    this.torso.add(cuirass, chestGem, cape);

    // Head & Distinct Class Crown / Helm
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.155, 1), this.armorMat);
    head.position.set(0, 0.62, 0);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.036, 0.06), this.weaponGlowMat);
    visor.position.set(0, 0.62, 0.125);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.016, 6, 24).rotateX(Math.PI / 2), this.trimMat);
    halo.position.set(0, 0.84, -0.02);
    this.torso.add(head, visor, halo);

    // Right & Left Arms + Signature Role Weapons
    this.armR = new THREE.Group();
    this.armR.position.set(-0.28, 0.40, 0);
    this.armL = new THREE.Group();
    this.armL.position.set(0.28, 0.40, 0);
    this.torso.add(this.armR, this.armL);

    for (const [arm, sgn] of [[this.armR, -1], [this.armL, 1]]) {
      const pauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.115, 1), this.trimMat);
      pauldron.position.set(sgn * 0.02, 0.02, 0);
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.050, 0.50, 8), this.armorMat);
      limb.position.set(0, -0.24, 0.08);
      limb.rotation.x = -0.45;
      arm.add(pauldron, limb);
    }

    this.weaponGroup = new THREE.Group();
    if (this.role.weapon === 'paladin') {
      const sword = new THREE.Mesh(new THREE.ConeGeometry(0.072, 1.05, 4), this.weaponBladeMat);
      sword.scale.set(1.0, 1.0, 0.30);
      sword.position.set(0, 0.18, 0.38);
      sword.rotation.x = Math.PI * 0.36;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.06), this.trimMat);
      guard.position.set(0, -0.22, 0.22);
      this.weaponGroup.add(sword, guard);
      this.armR.add(this.weaponGroup);

      const shield = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.24, 0.58, 12, 1, true, -0.52, 1.04),
        this.armorMat
      );
      shield.position.set(0.14, -0.22, 0.24);
      shield.rotation.y = Math.PI * 0.15;
      this.armL.add(shield);
    } else if (this.role.weapon === 'ranger') {
      const bowArc = new THREE.Mesh(
        new THREE.TorusGeometry(0.48, 0.024, 8, 24, Math.PI * 1.12),
        this.trimMat
      );
      bowArc.position.set(0, -0.22, 0.34);
      bowArc.rotation.y = Math.PI / 2;
      const bowCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), this.weaponGlowMat);
      bowCore.position.set(0, -0.22, 0.34);
      this.weaponGroup.add(bowArc, bowCore);
      this.armL.add(this.weaponGroup);
    } else {
      const staffShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.020, 1.72, 8), this.trimMat);
      staffShaft.position.set(0, 0.10, 0.26);
      const staffCrown = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.020, 8, 22), this.trimMat);
      staffCrown.position.set(0, 1.02, 0.26);
      const staffOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.082, 0), this.weaponGlowMat);
      staffOrb.position.set(0, 1.02, 0.26);
      this.weaponGroup.add(staffShaft, staffCrown, staffOrb);
      this.armR.add(this.weaponGroup);
    }
  }

  _buildCurseChains() {
    this.curseChainsGroup = new THREE.Group();
    this.curseChainsGroup.position.set(0, 0.95, 0);
    this.curseChainsGroup.visible = false;
    this.curseMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#a855f7').multiplyScalar(1.65),
      transparent: true,
      opacity: 0.88,
    });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44 + (i % 2) * 0.06, 0.022, 6, 24), this.curseMat);
      ring.position.y = (i - 1) * 0.28;
      ring.rotation.x = Math.PI * 0.5 + (i - 1) * 0.38;
      ring.rotation.y = i * 0.65;
      this.curseChainsGroup.add(ring);
    }
    this.root.add(this.curseChainsGroup);
  }

  get active() {
    return this.root.visible;
  }

  reset(x = this.homeX, z = this.homeZ, visible = false, {
    hpFrac = 0.35,
    shieldFrac = 0.0,
    fallen = false,
    cursed = false,
    yaw = Math.PI, // Face back toward the caster or outward heroically
  } = {}) {
    this.homeX = x;
    this.homeZ = z;
    this.worldAnchor.position.set(0, 0, 0);
    this.root.visible = visible;
    this.root.position.set(x, 0, z);
    this.root.rotation.set(0, yaw, 0);

    this.fallen = fallen;
    this.fallAngle = fallen ? -Math.PI * 0.46 : 0;
    this.bodyPivot.rotation.set(this.fallAngle, 0, 0);
    this.bodyPivot.position.set(0, fallen ? 0.14 : 0, 0);

    this.cursed = cursed;
    this.curseChainsGroup.visible = cursed;
    this.flashTimer = 0;
    this.enchantTimer = 0;
    this.cheerTimer = 0;
    this._animTime = 0;

    this.armorMat.emissive.setRGB(0, 0, 0);
    this.weaponGlowMat.color.set(this.role.glowHex).multiplyScalar(1.85);
    this.weaponBladeMat.emissive.set(this.role.glowHex).multiplyScalar(0.32);

    this.statusBar.reset({
      visible,
      hpFrac: fallen ? 0.01 : hpFrac,
      shieldFrac,
    });
  }

  setWorldPosition(wx, wz) {
    this.worldAnchor.position.set(wx - this.homeX, 0, wz - this.homeZ);
  }

  worldPosition() {
    return new THREE.Vector3(
      this.worldAnchor.position.x + this.root.position.x,
      this.root.position.y,
      this.worldAnchor.position.z + this.root.position.z
    );
  }

  chestWorld() {
    const wp = this.worldPosition();
    return new THREE.Vector3(wp.x, this.fallen ? 0.42 : 1.18, wp.z);
  }

  heal(amount = 0.55, label = '+HP 聖療') {
    this.flashTimer = 0.38;
    this.flashColor.set('#34d399');
    this.cheerTimer = Math.max(this.cheerTimer, 0.65);
    this.statusBar.heal(amount, label);
  }

  addShield(amount = 0.65, label = '+守護聖盾') {
    this.flashTimer = 0.36;
    this.flashColor.set('#67e8f9');
    this.statusBar.addShield(amount, label);
  }

  revive(label = '✦奇蹟甦生 100%') {
    this.fallen = false;
    this.flashTimer = 0.65;
    this.flashColor.set('#fde047');
    this.cheerTimer = 1.1;
    this.statusBar.hpFrac = 1.0;
    this.statusBar.triggerBadge('revive', label, '#fde047');
  }

  cleanse(label = '✧破咒淨化') {
    this.cursed = false;
    this.curseChainsGroup.visible = false;
    this.flashTimer = 0.45;
    this.flashColor.set('#5eead4');
    this.cheerTimer = 0.7;
    this.statusBar.heal(0.28, label);
    this.statusBar.triggerBadge('cleanse', label, '#5eead4');
  }

  addBuff(label = '▲神行加速', hex = '#fbbf24') {
    this.flashTimer = 0.32;
    this.flashColor.set(hex);
    this.cheerTimer = 0.75;
    this.statusBar.triggerBadge('buff', label, hex);
  }

  empowerWeapon(hex = '#ff7b29', duration = 2.2, label = '▲烈焰附魔') {
    this.enchantColor.set(hex);
    this.enchantTimer = duration;
    this.cheerTimer = 0.85;
    this.weaponGlowMat.color.copy(this.enchantColor).multiplyScalar(2.8);
    this.weaponBladeMat.emissive.copy(this.enchantColor).multiplyScalar(0.95);
    this.statusBar.triggerBadge('buff', label, hex);
  }

  update(dt, camera = null) {
    if (!this.root.visible) return;
    this._animTime += dt;
    this.partyRingGroup.rotation.y += dt * 0.75;

    // Smoothly stand up when resurrected from fallen state!
    const targetFall = this.fallen ? -Math.PI * 0.46 : 0;
    const rate = 1 - Math.exp(-6.5 * dt);
    this.fallAngle = lerp(this.fallAngle, targetFall, rate);
    this.bodyPivot.rotation.x = this.fallAngle;
    this.bodyPivot.position.y = this.fallen ? 0.14 : Math.max(0, Math.sin(this._animTime * 2.6) * 0.025);

    if (this.cheerTimer > 0) {
      this.cheerTimer = Math.max(0, this.cheerTimer - dt);
      const lift = Math.sin(clamp(this.cheerTimer / 0.75, 0, 1) * Math.PI);
      this.armR.rotation.x = -lift * 0.85;
      this.armL.rotation.x = -lift * 0.55;
    } else {
      this.armR.rotation.x = 0;
      this.armL.rotation.x = 0;
    }

    if (this.cursed && this.curseChainsGroup.visible) {
      this.curseChainsGroup.rotation.y -= dt * 2.2;
      this.curseMat.opacity = 0.65 + 0.25 * Math.sin(this._animTime * 9.0);
    }

    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
      this.armorMat.emissive.copy(this.flashColor).multiplyScalar((this.flashTimer / 0.45) * 0.48);
    } else {
      this.armorMat.emissive.setRGB(0, 0, 0);
    }

    if (this.enchantTimer > 0) {
      this.enchantTimer = Math.max(0, this.enchantTimer - dt);
      const p = 0.80 + 0.20 * Math.sin(this._animTime * 15.0);
      this.weaponGlowMat.color.copy(this.enchantColor).multiplyScalar(2.6 * p);
      this.weaponBladeMat.emissive.copy(this.enchantColor).multiplyScalar(0.88 * p);
    }

    this.statusBar.update(dt, camera);
  }
}
