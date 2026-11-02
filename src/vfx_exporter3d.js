import * as THREE from 'three';
import { BAKED_AI_TEXTURES } from './baked_textures.js';
import { FX_CONFIG, getTexLib } from './texgen3d.js';
import { Sim3D, PAL3D, getEffectiveMoveHitbox } from './core3d.js';
import { Fighter3D, DummyTarget3D, AllyHero3D } from './actors3d.js';
import { MESH_GALLERY_ITEMS } from './mesh_gallery3d.js';
import { createChantAwareSession, getEffectiveChantSpec } from './chant_system3d.js';

// ============================================================================
// VFX3D Arsenal — Universal 3D VFX Export & Packaging Pipeline (`vfx_exporter3d.js`)
// Works identically in Browser WebGL UI AND Headless Node CLI!
// Targets: Blender 3.6–4.x, Unreal Engine 5 (Niagara), Unity (VFX Graph),
//          Maya, 3ds Max, Houdini, Cinema 4D, Godot 4, Cascadeur.
// ============================================================================

const UTF8_ENC = new TextEncoder();

export function decodeDataUriBytes(dataUri) {
  if (!dataUri || typeof dataUri !== 'string') return new Uint8Array(0);
  const comma = dataUri.indexOf(',');
  const b64 = comma >= 0 ? dataUri.slice(comma + 1) : dataUri;
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- Precomputed IEEE 802.3 CRC32 for standard PKZIP archives ---
const CRC32_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    tbl[i] = c >>> 0;
  }
  return tbl;
})();

function crc32Bytes(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) {
    c = CRC32_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Builds a standards-compliant PKZIP (`Uint8Array`) from `[{ path, data }]`
 * (`data` can be `string` or `Uint8Array`). Zero external dependencies.
 */
export function buildZipArchive(entries) {
  const prepared = entries.map((e) => {
    const cleanPath = String(e.path).replace(/\\/g, '/').replace(/^\/+/, '');
    const nameBytes = UTF8_ENC.encode(cleanPath);
    const body = typeof e.data === 'string'
      ? UTF8_ENC.encode(e.data)
      : (e.data instanceof Uint8Array ? e.data : new Uint8Array(e.data));
    const crc = crc32Bytes(body);
    return { nameBytes, body, crc };
  });

  let localTotal = 0;
  let centralTotal = 0;
  for (const p of prepared) {
    localTotal += 30 + p.nameBytes.length + p.body.length;
    centralTotal += 46 + p.nameBytes.length;
  }

  const totalLen = localTotal + centralTotal + 22;
  const out = new Uint8Array(totalLen);
  const dv = new DataView(out.buffer);

  // DOS timestamp (2026-11-01 12:00:00)
  const dosTime = (12 << 11) | (0 << 5) | 0;
  const dosDate = ((2026 - 1980) << 9) | (11 << 5) | 1;

  let offset = 0;
  const localOffsets = [];
  for (const p of prepared) {
    localOffsets.push(offset);
    dv.setUint32(offset + 0, 0x04034b50, true); // Local file header signature
    dv.setUint16(offset + 4, 20, true);         // Version needed (2.0)
    dv.setUint16(offset + 6, 0x0800, true);     // UTF-8 filename flag
    dv.setUint16(offset + 8, 0, true);          // Compression: STORE (0)
    dv.setUint16(offset + 10, dosTime, true);
    dv.setUint16(offset + 12, dosDate, true);
    dv.setUint32(offset + 14, p.crc, true);
    dv.setUint32(offset + 18, p.body.length, true);
    dv.setUint32(offset + 22, p.body.length, true);
    dv.setUint16(offset + 26, p.nameBytes.length, true);
    dv.setUint16(offset + 28, 0, true);
    out.set(p.nameBytes, offset + 30);
    out.set(p.body, offset + 30 + p.nameBytes.length);
    offset += 30 + p.nameBytes.length + p.body.length;
  }

  const centralStart = offset;
  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i];
    dv.setUint32(offset + 0, 0x02014b50, true); // Central directory signature
    dv.setUint16(offset + 4, 20, true);         // Version made by
    dv.setUint16(offset + 6, 20, true);         // Version needed
    dv.setUint16(offset + 8, 0x0800, true);     // UTF-8 flag
    dv.setUint16(offset + 10, 0, true);         // STORE
    dv.setUint16(offset + 12, dosTime, true);
    dv.setUint16(offset + 14, dosDate, true);
    dv.setUint32(offset + 16, p.crc, true);
    dv.setUint32(offset + 20, p.body.length, true);
    dv.setUint32(offset + 24, p.body.length, true);
    dv.setUint16(offset + 28, p.nameBytes.length, true);
    dv.setUint16(offset + 30, 0, true);
    dv.setUint16(offset + 32, 0, true);
    dv.setUint16(offset + 34, 0, true);
    dv.setUint16(offset + 36, 0, true);
    dv.setUint32(offset + 38, 0, true);
    dv.setUint32(offset + 42, localOffsets[i], true);
    out.set(p.nameBytes, offset + 46);
    offset += 46 + p.nameBytes.length;
  }

  // End of Central Directory Record (EOCD)
  dv.setUint32(offset + 0, 0x06054b50, true);
  dv.setUint16(offset + 4, 0, true);
  dv.setUint16(offset + 6, 0, true);
  dv.setUint16(offset + 8, prepared.length, true);
  dv.setUint16(offset + 10, prepared.length, true);
  dv.setUint32(offset + 12, centralTotal, true);
  dv.setUint32(offset + 16, centralStart, true);
  dv.setUint16(offset + 20, 0, true);

  return out;
}

// ============================================================================
// Material & Texture Introspection (MeshStandardMaterial + ShaderMaterial)
// ============================================================================
function buildTexLookupMap() {
  const map = new Map();
  const lib = getTexLib();
  for (const [k, tex] of Object.entries(lib)) {
    if (tex && BAKED_AI_TEXTURES[k]) map.set(tex, k);
  }
  return map;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
}

function colorToRgb01(c, fallback = [0.85, 0.88, 0.96]) {
  if (!c || typeof c.r !== 'number') return fallback;
  const maxC = Math.max(1.0, c.r, c.g, c.b);
  return [clamp01(c.r / maxC), clamp01(c.g / maxC), clamp01(c.b / maxC)];
}

function inspectThreeMaterial(rawMat, texMap) {
  const mat = Array.isArray(rawMat) ? rawMat[0] : rawMat;
  if (!mat) {
    return {
      key: 'default',
      name: 'VFX_Default',
      baseColor: [0.85, 0.88, 0.95],
      emissive: [0.15, 0.2, 0.3],
      emissiveStrength: 1.4,
      opacity: 1.0,
      metallic: 0.15,
      roughness: 0.45,
      additive: false,
      transparent: false,
      doubleSided: true,
      texKey: null,
    };
  }

  let baseColor = [0.88, 0.90, 0.96];
  let emissive = [0.0, 0.0, 0.0];
  let emissiveStrength = 1.0;
  let opacity = typeof mat.opacity === 'number' ? clamp01(mat.opacity) : 1.0;
  let metallic = typeof mat.metalness === 'number' ? clamp01(mat.metalness) : 0.18;
  let roughness = typeof mat.roughness === 'number' ? clamp01(mat.roughness) : 0.42;
  const additive = mat.blending === THREE.AdditiveBlending;
  let texKey = null;

  if (mat.map && texMap.has(mat.map)) texKey = texMap.get(mat.map);
  else if (mat.emissiveMap && texMap.has(mat.emissiveMap)) texKey = texMap.get(mat.emissiveMap);

  if (mat.isShaderMaterial && mat.uniforms) {
    const u = mat.uniforms;
    for (const uEntry of Object.values(u)) {
      const val = uEntry?.value;
      if (val && texMap.has(val)) {
        texKey = texMap.get(val);
        break;
      }
    }
    const colCand =
      u.uRimColor?.value ||
      u.uGlowColor?.value ||
      u.uCoreColor?.value ||
      u.uColor?.value ||
      u.uTint?.value ||
      (Array.isArray(u.uRamp?.value) ? u.uRamp.value[4] || u.uRamp.value[3] : null);
    if (colCand && typeof colCand.r === 'number') {
      baseColor = colorToRgb01(colCand);
      emissive = [...baseColor];
      emissiveStrength = clamp01((u.uHdr?.value ?? 2.0) / 4.0) * 3.2 + 0.8;
    } else {
      emissive = [0.72, 0.82, 1.0];
      emissiveStrength = 2.0;
    }
    if (typeof u.uOpacity?.value === 'number') opacity = clamp01(u.uOpacity.value);
    else if (typeof u.uAlpha?.value === 'number') opacity = clamp01(u.uAlpha.value);
  } else if (mat.isMeshBasicMaterial) {
    baseColor = colorToRgb01(mat.color);
    emissive = [...baseColor];
    const hdrMag = mat.color ? Math.max(1.0, mat.color.r, mat.color.g, mat.color.b) : 1.5;
    emissiveStrength = Math.min(4.5, Math.max(1.2, hdrMag));
    metallic = 0.0;
    roughness = 0.35;
  } else {
    if (mat.color) baseColor = colorToRgb01(mat.color);
    if (mat.emissive) {
      emissive = colorToRgb01(mat.emissive, [0, 0, 0]);
      emissiveStrength = Math.min(4.5, Math.max(0.5, mat.emissiveIntensity ?? 1.0));
    }
  }

  if (additive) {
    opacity = Math.max(0.35, Math.min(0.88, opacity));
    emissive = emissive[0] + emissive[1] + emissive[2] > 0.02 ? emissive : [...baseColor];
    emissiveStrength = Math.max(2.2, emissiveStrength);
  }

  const transparent = Boolean(mat.transparent || additive || opacity < 0.995 || (texKey && (texKey.startsWith('sigil') || texKey.startsWith('fb') || texKey.startsWith('env') || texKey.startsWith('slash'))));
  const key = [
    texKey || 'notex',
    baseColor.map((n) => n.toFixed(2)).join(','),
    emissive.map((n) => n.toFixed(2)).join(','),
    emissiveStrength.toFixed(1),
    opacity.toFixed(2),
    metallic.toFixed(2),
    roughness.toFixed(2),
    transparent ? 'B' : 'O',
    additive ? 'A' : 'N',
  ].join('|');

  return {
    key,
    name: texKey ? `VFX_${texKey}` : (additive ? 'VFX_AdditiveGlow' : 'VFX_Surface'),
    baseColor,
    emissive,
    emissiveStrength,
    opacity: transparent ? Math.max(0.18, opacity) : 1.0,
    metallic,
    roughness,
    additive,
    transparent,
    doubleSided: true,
    texKey,
  };
}

function getLiveMeshAlpha(mesh) {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!mat) return 1.0;
  if (mat.visible === false) return 0.0;
  if (mat.isShaderMaterial && mat.uniforms) {
    const u = mat.uniforms;
    if (typeof u.uOpacity?.value === 'number' && u.uOpacity.value <= 0.01) return 0.0;
    if (typeof u.uAlpha?.value === 'number' && u.uAlpha.value <= 0.01) return 0.0;
    if (typeof u.uProgress?.value === 'number' && u.uProgress.value >= 0.999 && u.uTrail === undefined) {
      // still allow active progress shaders unless explicitly faded
    }
  }
  if (typeof mat.opacity === 'number' && mat.transparent && mat.opacity <= 0.01) return 0.0;
  return 1.0;
}

function isObjectChainVisible(obj) {
  let cur = obj;
  while (cur) {
    if (cur.visible === false) return false;
    cur = cur.parent;
  }
  return true;
}

function computeGeoSpan(geo) {
  const pos = geo?.attributes?.position;
  if (!pos || pos.count < 3) return 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const step = Math.max(1, Math.floor(pos.count / 64));
  for (let i = 0; i < pos.count; i += step) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  if (!Number.isFinite(minX)) return 0;
  return Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
}

// ============================================================================
// Binary glTF 2.0 (`.glb`) Chunk Builder
// ============================================================================
class GlbBinBuilder {
  constructor() {
    this.chunks = [];
    this.byteLength = 0;
    this.bufferViews = [];
    this.accessors = [];
  }

  _pad4() {
    const rem = this.byteLength % 4;
    if (rem !== 0) {
      const pad = new Uint8Array(4 - rem);
      this.chunks.push(pad);
      this.byteLength += pad.byteLength;
    }
  }

  appendBytes(u8, target) {
    this._pad4();
    const byteOffset = this.byteLength;
    const copy = new Uint8Array(u8.byteLength);
    copy.set(u8);
    this.chunks.push(copy);
    this.byteLength += copy.byteLength;
    const bv = { buffer: 0, byteOffset, byteLength: copy.byteLength };
    if (target) bv.target = target;
    const idx = this.bufferViews.length;
    this.bufferViews.push(bv);
    return idx;
  }

  appendFloat32(f32, type, count, target, withMinMax = false) {
    const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
    const bvIdx = this.appendBytes(u8, target);
    const acc = {
      bufferView: bvIdx,
      componentType: 5126, // FLOAT
      count,
      type,
    };
    if (withMinMax && count > 0) {
      const comps = type === 'SCALAR' ? 1 : type === 'VEC2' ? 2 : type === 'VEC3' ? 3 : 4;
      const min = new Array(comps).fill(Infinity);
      const max = new Array(comps).fill(-Infinity);
      for (let i = 0; i < count; i++) {
        for (let c = 0; c < comps; c++) {
          const v = f32[i * comps + c];
          if (v < min[c]) min[c] = v;
          if (v > max[c]) max[c] = v;
        }
      }
      acc.min = min;
      acc.max = max;
    }
    const idx = this.accessors.length;
    this.accessors.push(acc);
    return idx;
  }

  appendIndices(uintArr) {
    const is32 = uintArr instanceof Uint32Array;
    const u8 = new Uint8Array(uintArr.buffer, uintArr.byteOffset, uintArr.byteLength);
    const bvIdx = this.appendBytes(u8, 34963); // ELEMENT_ARRAY_BUFFER
    const idx = this.accessors.length;
    this.accessors.push({
      bufferView: bvIdx,
      componentType: is32 ? 5125 : 5123,
      count: uintArr.length,
      type: 'SCALAR',
    });
    return idx;
  }

  toUint8Array() {
    this._pad4();
    const out = new Uint8Array(this.byteLength);
    let off = 0;
    for (const c of this.chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    return out;
  }
}

function sanitizeGeometryForGltf(srcGeo) {
  const g = srcGeo.clone();
  const posAttr = g.attributes.position;
  if (!posAttr || posAttr.count < 3) return null;

  const vertCount = posAttr.count;
  const posArr = new Float32Array(vertCount * 3);
  for (let i = 0; i < vertCount; i++) {
    const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
    posArr[i * 3 + 0] = Number.isFinite(x) ? x : 0;
    posArr[i * 3 + 1] = Number.isFinite(y) ? y : 0;
    posArr[i * 3 + 2] = Number.isFinite(z) ? z : 0;
  }
  g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

  if (!g.attributes.normal || g.attributes.normal.count !== vertCount) {
    g.computeVertexNormals();
  }
  const normAttr = g.attributes.normal;
  const normArr = new Float32Array(vertCount * 3);
  for (let i = 0; i < vertCount; i++) {
    let nx = normAttr ? normAttr.getX(i) : 0;
    let ny = normAttr ? normAttr.getY(i) : 1;
    let nz = normAttr ? normAttr.getZ(i) : 0;
    const len = Math.hypot(nx, ny, nz);
    if (!Number.isFinite(len) || len < 1e-5) {
      nx = 0; ny = 1; nz = 0;
    } else {
      nx /= len; ny /= len; nz /= len;
    }
    normArr[i * 3 + 0] = nx;
    normArr[i * 3 + 1] = ny;
    normArr[i * 3 + 2] = nz;
  }

  let uvArr = null;
  if (g.attributes.uv && g.attributes.uv.count === vertCount) {
    uvArr = new Float32Array(vertCount * 2);
    for (let i = 0; i < vertCount; i++) {
      const u = g.attributes.uv.getX(i);
      const v = g.attributes.uv.getY(i);
      uvArr[i * 2 + 0] = Number.isFinite(u) ? u : 0;
      uvArr[i * 2 + 1] = Number.isFinite(v) ? 1.0 - v : 0; // glTF top-left UV origin
    }
  }

  let colArr = null;
  if (g.attributes.color && g.attributes.color.count === vertCount) {
    colArr = new Float32Array(vertCount * 3);
    for (let i = 0; i < vertCount; i++) {
      colArr[i * 3 + 0] = clamp01(g.attributes.color.getX(i));
      colArr[i * 3 + 1] = clamp01(g.attributes.color.getY(i));
      colArr[i * 3 + 2] = clamp01(g.attributes.color.getZ(i));
    }
  }

  let idxArr = null;
  if (g.index && g.index.count >= 3) {
    const cnt = g.index.count - (g.index.count % 3);
    idxArr = vertCount > 65535 ? new Uint32Array(cnt) : new Uint16Array(cnt);
    for (let i = 0; i < cnt; i++) idxArr[i] = g.index.getX(i);
  }

  const tris = idxArr ? Math.floor(idxArr.length / 3) : Math.floor(vertCount / 3);
  g.dispose();
  return { posArr, normArr, uvArr, colArr, idxArr, vertCount, tris };
}

function packGlbDocument(gltfJson, binBytes) {
  const jsonRaw = UTF8_ENC.encode(JSON.stringify(gltfJson));
  const jsonPad = (4 - (jsonRaw.byteLength % 4)) % 4;
  const jsonChunk = new Uint8Array(jsonRaw.byteLength + jsonPad);
  jsonChunk.set(jsonRaw, 0);
  for (let i = jsonRaw.byteLength; i < jsonChunk.byteLength; i++) jsonChunk[i] = 0x20; // space pad

  const binPad = (4 - (binBytes.byteLength % 4)) % 4;
  const binChunk = new Uint8Array(binBytes.byteLength + binPad);
  binChunk.set(binBytes, 0);

  const totalLength = 12 + 8 + jsonChunk.byteLength + 8 + binChunk.byteLength;
  const out = new Uint8Array(totalLength);
  const dv = new DataView(out.buffer);

  // 12-byte Header
  dv.setUint32(0, 0x46546C67, true); // 'glTF'
  dv.setUint32(4, 2, true);          // version 2
  dv.setUint32(8, totalLength, true);

  // JSON Chunk
  dv.setUint32(12, jsonChunk.byteLength, true);
  dv.setUint32(16, 0x4E4F534A, true); // 'JSON'
  out.set(jsonChunk, 20);

  // BIN Chunk
  const binHeaderOff = 20 + jsonChunk.byteLength;
  dv.setUint32(binHeaderOff, binChunk.byteLength, true);
  dv.setUint32(binHeaderOff + 4, 0x004E4942, true); // 'BIN\0'
  out.set(binChunk, binHeaderOff + 8);

  return out;
}

// ============================================================================
// Static 3D Model Exporters (`.glb` + `.obj`/`.mtl`)
// ============================================================================
export function exportStaticGroupToOBJ(rootGroup, assetName = 'vfx_prop') {
  rootGroup.updateMatrixWorld(true);
  const texMap = buildTexLookupMap();
  const objLines = [
    `# VFX3D Arsenal VFX 3D Geometry Export — ${assetName}`,
    `mtllib ${assetName}.mtl`,
  ];
  const mtlLines = [`# VFX3D Arsenal VFX Material Library — ${assetName}`];
  const seenMats = new Set();

  let vOffset = 1;
  let vtOffset = 1;
  let vnOffset = 1;
  let meshIdx = 0;
  const vTmp = new THREE.Vector3();
  const nTmp = new THREE.Vector3();
  const nMat = new THREE.Matrix3();

  rootGroup.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const clean = sanitizeGeometryForGltf(child.geometry);
    if (!clean) return;
    const mInfo = inspectThreeMaterial(child.material, texMap);
    const matName = `${mInfo.name}_${meshIdx}`;
    if (!seenMats.has(matName)) {
      seenMats.add(matName);
      mtlLines.push(
        `newmtl ${matName}`,
        `Kd ${mInfo.baseColor[0].toFixed(4)} ${mInfo.baseColor[1].toFixed(4)} ${mInfo.baseColor[2].toFixed(4)}`,
        `Ke ${(mInfo.emissive[0] * mInfo.emissiveStrength * 0.35).toFixed(4)} ${(mInfo.emissive[1] * mInfo.emissiveStrength * 0.35).toFixed(4)} ${(mInfo.emissive[2] * mInfo.emissiveStrength * 0.35).toFixed(4)}`,
        `d ${mInfo.opacity.toFixed(4)}`,
        `illum 2`
      );
      if (mInfo.texKey) mtlLines.push(`map_Kd ../textures/${mInfo.texKey}.webp`);
      mtlLines.push('');
    }

    objLines.push(`o ${child.name || `part_${meshIdx}`}`, `usemtl ${matName}`);
    nMat.getNormalMatrix(child.matrixWorld);

    for (let i = 0; i < clean.vertCount; i++) {
      vTmp.set(clean.posArr[i * 3], clean.posArr[i * 3 + 1], clean.posArr[i * 3 + 2]).applyMatrix4(child.matrixWorld);
      objLines.push(`v ${vTmp.x.toFixed(5)} ${vTmp.y.toFixed(5)} ${vTmp.z.toFixed(5)}`);
    }
    if (clean.uvArr) {
      for (let i = 0; i < clean.vertCount; i++) {
        objLines.push(`vt ${clean.uvArr[i * 2].toFixed(5)} ${(1 - clean.uvArr[i * 2 + 1]).toFixed(5)}`);
      }
    }
    for (let i = 0; i < clean.vertCount; i++) {
      nTmp.set(clean.normArr[i * 3], clean.normArr[i * 3 + 1], clean.normArr[i * 3 + 2]).applyNormalMatrix(nMat).normalize();
      objLines.push(`vn ${nTmp.x.toFixed(5)} ${nTmp.y.toFixed(5)} ${nTmp.z.toFixed(5)}`);
    }

    const triCount = clean.idxArr ? Math.floor(clean.idxArr.length / 3) : Math.floor(clean.vertCount / 3);
    for (let t = 0; t < triCount; t++) {
      const a = (clean.idxArr ? clean.idxArr[t * 3 + 0] : t * 3 + 0);
      const b = (clean.idxArr ? clean.idxArr[t * 3 + 1] : t * 3 + 1);
      const c = (clean.idxArr ? clean.idxArr[t * 3 + 2] : t * 3 + 2);
      if (clean.uvArr) {
        objLines.push(`f ${vOffset + a}/${vtOffset + a}/${vnOffset + a} ${vOffset + b}/${vtOffset + b}/${vnOffset + b} ${vOffset + c}/${vtOffset + c}/${vnOffset + c}`);
      } else {
        objLines.push(`f ${vOffset + a}//${vnOffset + a} ${vOffset + b}//${vnOffset + b} ${vOffset + c}//${vnOffset + c}`);
      }
    }

    vOffset += clean.vertCount;
    if (clean.uvArr) vtOffset += clean.vertCount;
    vnOffset += clean.vertCount;
    meshIdx++;
  });

  return {
    objText: objLines.join('\n') + '\n',
    mtlText: mtlLines.join('\n') + '\n',
  };
}

export function exportStaticGroupToGLB(rootGroup, assetName = 'vfx_prop') {
  rootGroup.updateMatrixWorld(true);
  const texMap = buildTexLookupMap();
  const bin = new GlbBinBuilder();

  const images = [];
  const textures = [];
  const samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  const texKeyToIdx = new Map();
  const usedTexKeys = new Set();

  const ensureGltfTex = (texKey) => {
    if (!texKey || !BAKED_AI_TEXTURES[texKey]) return null;
    if (texKeyToIdx.has(texKey)) return texKeyToIdx.get(texKey);
    const webpBytes = decodeDataUriBytes(BAKED_AI_TEXTURES[texKey]);
    if (!webpBytes.byteLength) return null;
    usedTexKeys.add(texKey);
    const bvIdx = bin.appendBytes(webpBytes);
    const imgIdx = images.length;
    images.push({ name: texKey, bufferView: bvIdx, mimeType: 'image/webp' });
    const tIdx = textures.length;
    textures.push({ sampler: 0, source: imgIdx, extensions: { EXT_texture_webp: { source: imgIdx } } });
    texKeyToIdx.set(texKey, tIdx);
    return tIdx;
  };

  const materials = [];
  const matKeyToIdx = new Map();
  const ensureMaterial = (rawMat) => {
    const info = inspectThreeMaterial(rawMat, texMap);
    if (matKeyToIdx.has(info.key)) return matKeyToIdx.get(info.key);
    const tIdx = ensureGltfTex(info.texKey);
    const gMat = {
      name: info.name,
      doubleSided: info.doubleSided,
      alphaMode: info.transparent ? 'BLEND' : 'OPAQUE',
      pbrMetallicRoughness: {
        baseColorFactor: [info.baseColor[0], info.baseColor[1], info.baseColor[2], info.opacity],
        metallicFactor: info.metallic,
        roughnessFactor: info.roughness,
      },
      emissiveFactor: info.emissive,
      extensions: {
        KHR_materials_emissive_strength: { emissiveStrength: Number(info.emissiveStrength.toFixed(3)) },
      },
    };
    if (tIdx !== null) {
      gMat.pbrMetallicRoughness.baseColorTexture = { index: tIdx };
      if (info.emissive[0] + info.emissive[1] + info.emissive[2] > 0.05) {
        gMat.emissiveTexture = { index: tIdx };
      }
    }
    const idx = materials.length;
    materials.push(gMat);
    matKeyToIdx.set(info.key, idx);
    return idx;
  };

  const meshes = [];
  const nodes = [];
  const childNodeIndices = [];
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  let totalVerts = 0;
  let totalTris = 0;

  rootGroup.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const clean = sanitizeGeometryForGltf(child.geometry);
    if (!clean) return;
    const matIdx = ensureMaterial(child.material);
    const attributes = {
      POSITION: bin.appendFloat32(clean.posArr, 'VEC3', clean.vertCount, 34962, true),
      NORMAL: bin.appendFloat32(clean.normArr, 'VEC3', clean.vertCount, 34962, false),
    };
    if (clean.uvArr) attributes.TEXCOORD_0 = bin.appendFloat32(clean.uvArr, 'VEC2', clean.vertCount, 34962, false);
    if (clean.colArr) attributes.COLOR_0 = bin.appendFloat32(clean.colArr, 'VEC3', clean.vertCount, 34962, false);

    const prim = { attributes, material: matIdx };
    if (clean.idxArr) prim.indices = bin.appendIndices(clean.idxArr);
    const meshIdx = meshes.length;
    meshes.push({ name: child.name || `${assetName}_mesh_${meshIdx}`, primitives: [prim] });

    child.matrixWorld.decompose(pos, quat, scl);
    const nodeIdx = nodes.length;
    nodes.push({
      name: child.name || `${assetName}_part_${nodeIdx}`,
      mesh: meshIdx,
      translation: [pos.x, pos.y, pos.z],
      rotation: [quat.x, quat.y, quat.z, quat.w],
      scale: [scl.x, scl.y, scl.z],
    });
    childNodeIndices.push(nodeIdx);
    totalVerts += clean.vertCount;
    totalTris += clean.tris;
  });

  const rootNodeIdx = nodes.length;
  nodes.push({ name: assetName, children: childNodeIndices });

  const binBytes = bin.toUint8Array();
  const gltfJson = {
    asset: {
      version: '2.0',
      generator: 'VFX3D 3D VFX Universal Export Pipeline',
      extras: { assetName, totalVerts, totalTris },
    },
    extensionsUsed: [
      'KHR_materials_emissive_strength',
      ...(textures.length ? ['EXT_texture_webp'] : []),
    ],
    scene: 0,
    scenes: [{ name: assetName, nodes: [rootNodeIdx] }],
    nodes,
    meshes,
    materials,
    accessors: bin.accessors,
    bufferViews: bin.bufferViews,
    buffers: [{ byteLength: binBytes.byteLength }],
  };
  if (textures.length) {
    gltfJson.samplers = samplers;
    gltfJson.images = images;
    gltfJson.textures = textures;
  }

  return {
    glbBytes: packGlbDocument(gltfJson, binBytes),
    usedTexKeys: [...usedTexKeys],
    stats: { nodes: nodes.length, meshes: meshes.length, verts: totalVerts, tris: totalTris },
  };
}

// ============================================================================
// Animated VFX Skill Timeline Baker -> Binary glTF 2.0 (`.glb` with Animations)
// ============================================================================
export function bakeAnimatedMoveToGLB(mv, {
  fps = 24,
  includeActors = true,
  maxInstancesPerPool = 40,
  seed = 2026,
} = {}) {
  const scene = new THREE.Scene();
  const fighter = new Fighter3D(scene);
  const dummies = [
    new DummyTarget3D(scene, 0, 2.0),
    new DummyTarget3D(scene, -1.5, 3.5),
    new DummyTarget3D(scene, 1.5, 3.5),
  ];
  const allies = [0, 1, 2].map((i) => new AllyHero3D(scene, i));
  const sim = new Sim3D(scene);

  const session = createChantAwareSession({
    mv,
    sim,
    fighter,
    dummies,
    allies,
    seed,
    paletteOverride: null,
    texStyle: 'auto',
  });

  const actorRoots = new Set([
    fighter.root,
    ...dummies.map((d) => d.root),
    ...allies.map((a) => a.root),
  ]);
  const isInsideActor = (obj) => {
    let cur = obj;
    while (cur) {
      if (actorRoots.has(cur)) return true;
      cur = cur.parent;
    }
    return false;
  };

  const dt = 1 / Math.max(10, Math.min(60, fps));
  const totalDur = Math.max(0.5, session.totalDuration);
  const frameCount = Math.max(2, Math.ceil(totalDur * fps) + 1);
  const timesF32 = new Float32Array(frameCount);
  const texMap = buildTexLookupMap();

  // Tracked records: key -> { name, rawMat, bestGeo, peakSpan, sharedGeoRef, posTrack, rotTrack, sclTrack, everVisible }
  const records = new Map();
  const ensureRecord = (key, name, geo, rawMat, sharedGeoRef = null) => {
    let rec = records.get(key);
    if (!rec) {
      rec = {
        key,
        name,
        rawMat,
        bestGeo: sharedGeoRef ? null : geo.clone(),
        sharedGeoRef,
        peakSpan: sharedGeoRef ? 1 : computeGeoSpan(geo),
        posTrack: new Float32Array(frameCount * 3),
        rotTrack: new Float32Array(frameCount * 4),
        sclTrack: new Float32Array(frameCount * 3), // defaults to [0,0,0] for unspawned frames!
        everVisible: false,
        firstFrame: -1,
      };
      for (let f = 0; f < frameCount; f++) rec.rotTrack[f * 4 + 3] = 1.0; // identity quat w=1
      records.set(key, rec);
    }
    return rec;
  };

  const wPos = new THREE.Vector3();
  const wQuat = new THREE.Quaternion();
  const wScl = new THREE.Vector3();
  const instMat = new THREE.Matrix4();
  const combMat = new THREE.Matrix4();
  const gpuSparkGeo = new THREE.OctahedronGeometry(0.5, 0);
  const gpuSparkMats = new Map();
  const gpuSparkChannels = new Map();
  const gpuLocalPos = new THREE.Vector3();
  const gpuLocalScale = new THREE.Vector3();
  const identityQuat = new THREE.Quaternion();

  for (let f = 0; f < frameCount; f++) {
    const tNow = Math.min(totalDur, f * dt);
    timesF32[f] = tNow;
    if (f > 0) session.step(dt);
    scene.updateMatrixWorld(true);

    scene.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry) return;
      if (!includeActors && isInsideActor(obj)) return;

      if (obj.gpuSparkPool) {
        if (!isObjectChainVisible(obj)) return;
        let channels = gpuSparkChannels.get(obj.uuid);
        if (!channels) { channels = new Map(); gpuSparkChannels.set(obj.uuid, channels); }
        const live = new Map();
        for (const slot of obj.gpuSparkPool.activeSlots) {
          const spark = obj.gpuSparkPool.sampleSlot(slot);
          if (spark) live.set(spark.serial, spark);
        }
        for (const serial of channels.keys()) if (!live.has(serial)) channels.delete(serial);
        const occupied = new Set(channels.values());
        for (const spark of live.values()) {
          let channel = channels.get(spark.serial);
          if (channel === undefined) {
            channel = 0;
            while (channel < maxInstancesPerPool && occupied.has(channel)) channel++;
            if (channel >= maxInstancesPerPool) continue;
            channels.set(spark.serial, channel);
            occupied.add(channel);
          }
          const rKey = `gpu_${obj.uuid}_${channel}`;
          let material = gpuSparkMats.get(rKey);
          if (!material) {
            material = new THREE.MeshBasicMaterial({
              color: new THREE.Color().setRGB(...spark.color),
              transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending,
            });
            gpuSparkMats.set(rKey, material);
          }
          gpuLocalPos.set(...spark.position);
          gpuLocalScale.setScalar(spark.size);
          instMat.compose(gpuLocalPos, identityQuat, gpuLocalScale);
          combMat.multiplyMatrices(obj.matrixWorld, instMat);
          combMat.decompose(wPos, wQuat, wScl);
          const rec = ensureRecord(rKey, `GpuImpactSpark_${channel}`, gpuSparkGeo, material, gpuSparkGeo);
          rec.everVisible = true;
          if (rec.firstFrame < 0) rec.firstFrame = f;
          rec.posTrack.set([wPos.x, wPos.y, wPos.z], f * 3);
          rec.rotTrack.set([wQuat.x, wQuat.y, wQuat.z, wQuat.w], f * 4);
          rec.sclTrack.set([wScl.x, wScl.y, wScl.z], f * 3);
        }
        return;
      }

      if (obj.isInstancedMesh) {
        const chainVis = isObjectChainVisible(obj) && getLiveMeshAlpha(obj) > 0.01;
        const activeN = chainVis ? Math.min(obj.count || 0, maxInstancesPerPool) : 0;
        for (let idx = 0; idx < activeN; idx++) {
          obj.getMatrixAt(idx, instMat);
          combMat.multiplyMatrices(obj.matrixWorld, instMat);
          combMat.decompose(wPos, wQuat, wScl);
          if (Math.abs(wScl.x) + Math.abs(wScl.y) + Math.abs(wScl.z) < 1e-4) continue;
          const rKey = `inst_${obj.uuid}_${idx}`;
          const rec = ensureRecord(rKey, `${obj.name || 'Particle'}_${idx}`, obj.geometry, obj.material, obj.geometry);
          rec.everVisible = true;
          if (rec.firstFrame < 0) rec.firstFrame = f;
          rec.posTrack[f * 3 + 0] = wPos.x;
          rec.posTrack[f * 3 + 1] = wPos.y;
          rec.posTrack[f * 3 + 2] = wPos.z;
          rec.rotTrack[f * 4 + 0] = wQuat.x;
          rec.rotTrack[f * 4 + 1] = wQuat.y;
          rec.rotTrack[f * 4 + 2] = wQuat.z;
          rec.rotTrack[f * 4 + 3] = wQuat.w;
          rec.sclTrack[f * 3 + 0] = wScl.x;
          rec.sclTrack[f * 3 + 1] = wScl.y;
          rec.sclTrack[f * 3 + 2] = wScl.z;
        }
        return;
      }

      if (!isObjectChainVisible(obj) || getLiveMeshAlpha(obj) <= 0.01) return;
      obj.matrixWorld.decompose(wPos, wQuat, wScl);
      if (Math.abs(wScl.x) + Math.abs(wScl.y) + Math.abs(wScl.z) < 1e-4) return;

      const rKey = `mesh_${obj.uuid}`;
      const rec = ensureRecord(rKey, obj.name || `VFXMesh_${records.size}`, obj.geometry, obj.material, null);
      const span = computeGeoSpan(obj.geometry);
      if (span > rec.peakSpan + 1e-3) {
        rec.bestGeo?.dispose();
        rec.bestGeo = obj.geometry.clone();
        rec.peakSpan = span;
      }
      if (span <= 1e-4 && rec.peakSpan <= 1e-4) return;

      rec.everVisible = true;
      if (rec.firstFrame < 0) rec.firstFrame = f;
      rec.posTrack[f * 3 + 0] = wPos.x;
      rec.posTrack[f * 3 + 1] = wPos.y;
      rec.posTrack[f * 3 + 2] = wPos.z;
      rec.rotTrack[f * 4 + 0] = wQuat.x;
      rec.rotTrack[f * 4 + 1] = wQuat.y;
      rec.rotTrack[f * 4 + 2] = wQuat.z;
      rec.rotTrack[f * 4 + 3] = wQuat.w;
      rec.sclTrack[f * 3 + 0] = wScl.x;
      rec.sclTrack[f * 3 + 1] = wScl.y;
      rec.sclTrack[f * 3 + 2] = wScl.z;
    });
  }

  // Backfill pre-spawn position/rotation & enforce quaternion hemisphere continuity (`dot >= 0`)
  const bin = new GlbBinBuilder();
  const timeAccIdx = bin.appendFloat32(timesF32, 'SCALAR', frameCount, undefined, true);

  const images = [];
  const textures = [];
  const samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  const texKeyToIdx = new Map();
  const usedTexKeys = new Set();

  const ensureGltfTex = (texKey) => {
    if (!texKey || !BAKED_AI_TEXTURES[texKey]) return null;
    if (texKeyToIdx.has(texKey)) return texKeyToIdx.get(texKey);
    const webpBytes = decodeDataUriBytes(BAKED_AI_TEXTURES[texKey]);
    if (!webpBytes.byteLength) return null;
    usedTexKeys.add(texKey);
    const bvIdx = bin.appendBytes(webpBytes);
    const imgIdx = images.length;
    images.push({ name: texKey, bufferView: bvIdx, mimeType: 'image/webp' });
    const tIdx = textures.length;
    textures.push({ sampler: 0, source: imgIdx, extensions: { EXT_texture_webp: { source: imgIdx } } });
    texKeyToIdx.set(texKey, tIdx);
    return tIdx;
  };

  const materials = [];
  const matKeyToIdx = new Map();
  const ensureMaterial = (rawMat) => {
    const info = inspectThreeMaterial(rawMat, texMap);
    if (matKeyToIdx.has(info.key)) return matKeyToIdx.get(info.key);
    const tIdx = ensureGltfTex(info.texKey);
    const gMat = {
      name: info.name,
      doubleSided: info.doubleSided,
      alphaMode: info.transparent ? 'BLEND' : 'OPAQUE',
      pbrMetallicRoughness: {
        baseColorFactor: [info.baseColor[0], info.baseColor[1], info.baseColor[2], info.opacity],
        metallicFactor: info.metallic,
        roughnessFactor: info.roughness,
      },
      emissiveFactor: info.emissive,
      extensions: {
        KHR_materials_emissive_strength: { emissiveStrength: Number(info.emissiveStrength.toFixed(3)) },
      },
    };
    if (tIdx !== null) {
      gMat.pbrMetallicRoughness.baseColorTexture = { index: tIdx };
      if (info.emissive[0] + info.emissive[1] + info.emissive[2] > 0.05) {
        gMat.emissiveTexture = { index: tIdx };
      }
    }
    const idx = materials.length;
    materials.push(gMat);
    matKeyToIdx.set(info.key, idx);
    return idx;
  };

  const meshes = [];
  const sharedGeoToMeshIdx = new Map();
  const nodes = [];
  const childNodeIndices = [];
  const animSamplers = [];
  const animChannels = [];
  let totalVerts = 0;
  let totalTris = 0;

  for (const rec of records.values()) {
    if (!rec.everVisible) {
      rec.bestGeo?.dispose();
      continue;
    }

    // Fill frames before `firstFrame` with first visible pose so there's zero jump from origin
    const f0 = Math.max(0, rec.firstFrame);
    for (let f = 0; f < f0; f++) {
      rec.posTrack[f * 3 + 0] = rec.posTrack[f0 * 3 + 0];
      rec.posTrack[f * 3 + 1] = rec.posTrack[f0 * 3 + 1];
      rec.posTrack[f * 3 + 2] = rec.posTrack[f0 * 3 + 2];
      rec.rotTrack[f * 4 + 0] = rec.rotTrack[f0 * 4 + 0];
      rec.rotTrack[f * 4 + 1] = rec.rotTrack[f0 * 4 + 1];
      rec.rotTrack[f * 4 + 2] = rec.rotTrack[f0 * 4 + 2];
      rec.rotTrack[f * 4 + 3] = rec.rotTrack[f0 * 4 + 3];
    }
    // Carry forward last visible pos/rot on hidden frames & enforce hemisphere continuity
    for (let f = 1; f < frameCount; f++) {
      const hidden = (Math.abs(rec.sclTrack[f * 3]) + Math.abs(rec.sclTrack[f * 3 + 1]) + Math.abs(rec.sclTrack[f * 3 + 2])) < 1e-4;
      if (hidden) {
        rec.posTrack[f * 3 + 0] = rec.posTrack[(f - 1) * 3 + 0];
        rec.posTrack[f * 3 + 1] = rec.posTrack[(f - 1) * 3 + 1];
        rec.posTrack[f * 3 + 2] = rec.posTrack[(f - 1) * 3 + 2];
        rec.rotTrack[f * 4 + 0] = rec.rotTrack[(f - 1) * 4 + 0];
        rec.rotTrack[f * 4 + 1] = rec.rotTrack[(f - 1) * 4 + 1];
        rec.rotTrack[f * 4 + 2] = rec.rotTrack[(f - 1) * 4 + 2];
        rec.rotTrack[f * 4 + 3] = rec.rotTrack[(f - 1) * 4 + 3];
      } else {
        const dot =
          rec.rotTrack[(f - 1) * 4 + 0] * rec.rotTrack[f * 4 + 0] +
          rec.rotTrack[(f - 1) * 4 + 1] * rec.rotTrack[f * 4 + 1] +
          rec.rotTrack[(f - 1) * 4 + 2] * rec.rotTrack[f * 4 + 2] +
          rec.rotTrack[(f - 1) * 4 + 3] * rec.rotTrack[f * 4 + 3];
        if (dot < 0) {
          rec.rotTrack[f * 4 + 0] = -rec.rotTrack[f * 4 + 0];
          rec.rotTrack[f * 4 + 1] = -rec.rotTrack[f * 4 + 1];
          rec.rotTrack[f * 4 + 2] = -rec.rotTrack[f * 4 + 2];
          rec.rotTrack[f * 4 + 3] = -rec.rotTrack[f * 4 + 3];
        }
      }
    }

    const matIdx = ensureMaterial(rec.rawMat);
    let meshIdx;
    const sharedKey = rec.sharedGeoRef ? `${rec.sharedGeoRef.uuid}|${matIdx}` : null;
    if (sharedKey && sharedGeoToMeshIdx.has(sharedKey)) {
      meshIdx = sharedGeoToMeshIdx.get(sharedKey);
    } else {
      const srcGeo = rec.sharedGeoRef || rec.bestGeo;
      const clean = sanitizeGeometryForGltf(srcGeo);
      rec.bestGeo?.dispose();
      if (!clean) continue;
      const attributes = {
        POSITION: bin.appendFloat32(clean.posArr, 'VEC3', clean.vertCount, 34962, true),
        NORMAL: bin.appendFloat32(clean.normArr, 'VEC3', clean.vertCount, 34962, false),
      };
      if (clean.uvArr) attributes.TEXCOORD_0 = bin.appendFloat32(clean.uvArr, 'VEC2', clean.vertCount, 34962, false);
      if (clean.colArr) attributes.COLOR_0 = bin.appendFloat32(clean.colArr, 'VEC3', clean.vertCount, 34962, false);
      const prim = { attributes, material: matIdx };
      if (clean.idxArr) prim.indices = bin.appendIndices(clean.idxArr);
      meshIdx = meshes.length;
      meshes.push({ name: `${rec.name}_Geo`, primitives: [prim] });
      if (sharedKey) sharedGeoToMeshIdx.set(sharedKey, meshIdx);
      totalVerts += clean.vertCount;
      totalTris += clean.tris;
    }

    const nodeIdx = nodes.length;
    nodes.push({
      name: rec.name,
      mesh: meshIdx,
      translation: [rec.posTrack[0], rec.posTrack[1], rec.posTrack[2]],
      rotation: [rec.rotTrack[0], rec.rotTrack[1], rec.rotTrack[2], rec.rotTrack[3]],
      scale: [rec.sclTrack[0], rec.sclTrack[1], rec.sclTrack[2]],
    });
    childNodeIndices.push(nodeIdx);

    const posOutAcc = bin.appendFloat32(rec.posTrack, 'VEC3', frameCount);
    const rotOutAcc = bin.appendFloat32(rec.rotTrack, 'VEC4', frameCount);
    const sclOutAcc = bin.appendFloat32(rec.sclTrack, 'VEC3', frameCount);

    const sPos = animSamplers.length;
    animSamplers.push({ input: timeAccIdx, interpolation: 'LINEAR', output: posOutAcc });
    animChannels.push({ sampler: sPos, target: { node: nodeIdx, path: 'translation' } });

    const sRot = animSamplers.length;
    animSamplers.push({ input: timeAccIdx, interpolation: 'LINEAR', output: rotOutAcc });
    animChannels.push({ sampler: sRot, target: { node: nodeIdx, path: 'rotation' } });

    const sScl = animSamplers.length;
    animSamplers.push({ input: timeAccIdx, interpolation: 'STEP', output: sclOutAcc });
    animChannels.push({ sampler: sScl, target: { node: nodeIdx, path: 'scale' } });
  }

  // Dispose offscreen simulation cleanly
  sim.clear();

  const rootNodeIdx = nodes.length;
  nodes.push({ name: `VFX3D_VFX_${mv.id}`, children: childNodeIndices });

  const binBytes = bin.toUint8Array();
  const gltfJson = {
    asset: {
      version: '2.0',
      generator: 'VFX3D 3D VFX Universal Export Pipeline',
      extras: {
        moveId: mv.id,
        title: mv.title,
        fps,
        frameCount,
        chantDuration: Number(session.chantDur.toFixed(3)),
        totalDuration: Number(totalDur.toFixed(3)),
      },
    },
    extensionsUsed: [
      'KHR_materials_emissive_strength',
      ...(textures.length ? ['EXT_texture_webp'] : []),
    ],
    scene: 0,
    scenes: [{ name: mv.id, nodes: [rootNodeIdx] }],
    nodes,
    meshes,
    materials,
    animations: animChannels.length ? [{
      name: `${mv.id}_ChantAndRelease`,
      samplers: animSamplers,
      channels: animChannels,
    }] : [],
    accessors: bin.accessors,
    bufferViews: bin.bufferViews,
    buffers: [{ byteLength: binBytes.byteLength }],
  };
  if (textures.length) {
    gltfJson.samplers = samplers;
    gltfJson.images = images;
    gltfJson.textures = textures;
  }

  return {
    glbBytes: packGlbDocument(gltfJson, binBytes),
    usedTexKeys: [...usedTexKeys],
    stats: {
      fps,
      frameCount,
      chantDuration: Number(session.chantDur.toFixed(3)),
      totalDuration: Number(totalDur.toFixed(3)),
      animatedNodes: childNodeIndices.length,
      uniqueMeshes: meshes.length,
      materials: materials.length,
      textures: usedTexKeys.size,
      verts: totalVerts,
      tris: totalTris,
    },
    chantSpec: session.chantSpec,
  };
}

// ============================================================================
// DCC / Game-Engine Importer Scripts (Blender, Maya, Unity, UE5 Niagara)
// ============================================================================
function generateBlenderImportScript(manifest) {
  const glbRel = manifest.kind === 'prop' ? `meshes/${manifest.id}.glb` : 'scene_animated.glb';
  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VFX3D Arsenal — One-Click Blender 3.6–4.x VFX Package Importer
Asset: ${manifest.id} (${manifest.title})
Usage:
  1. Blender GUI -> Scripting -> Open import_blender.py -> Run Script (Alt+P)
  2. Headless CLI: blender --background --python import_blender.py -- --save-blend out.blend
"""
import os
import sys
import bpy

PKG_DIR = os.path.dirname(os.path.abspath(__file__))
GLB_PATH = os.path.join(PKG_DIR, "${glbRel}")
TEX_DIR = os.path.join(PKG_DIR, "textures")
FPS = ${manifest.fps || 24}
FRAME_COUNT = ${manifest.frameCount || 60}

def setup_vfx_scene():
    scn = bpy.context.scene
    scn.render.fps = FPS
    scn.frame_start = 0
    scn.frame_end = max(1, FRAME_COUNT - 1)
    if scn.world is None:
        scn.world = bpy.data.worlds.new("VFX3D_World")
    scn.world.use_nodes = True
    bg = scn.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.025, 0.032, 0.058, 1.0)
        bg.inputs[1].default_value = 0.85

def enhance_vfx_materials():
    for mat in bpy.data.materials:
        if not mat.use_nodes or not mat.name.startswith("VFX_"):
            continue
        mat.blend_method = 'BLEND'
        nt = mat.node_tree
        for node in nt.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                if "Emission Strength" in node.inputs and node.inputs["Emission Strength"].default_value < 1.5:
                    node.inputs["Emission Strength"].default_value = 2.4

def main():
    setup_vfx_scene()
    if not os.path.exists(GLB_PATH):
        raise FileNotFoundError(f"Missing GLB file: {GLB_PATH}")
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)
    enhance_vfx_materials()

    # Add dramatic VFX key light
    light_data = bpy.data.lights.new(name="VFX3D_VFX_KeyLight", type='POINT')
    light_data.energy = 650.0
    light_data.color = (0.95, 0.88, 1.0)
    light_obj = bpy.data.objects.new(name="VFX3D_VFX_KeyLight", object_data=light_data)
    bpy.context.collection.objects.link(light_obj)
    light_obj.location = (0.0, -2.5, 3.8)

    if "--save-blend" in sys.argv:
        idx = sys.argv.index("--save-blend")
        if idx + 1 < len(sys.argv):
            out_blend = os.path.abspath(sys.argv[idx + 1])
            bpy.ops.wm.save_as_mainfile(filepath=out_blend)
            print(f"[VFX3D] Saved Blender scene -> {out_blend}")

    print(f"[VFX3D] Imported {GLB_PATH} ({FRAME_COUNT} frames @ {FPS} fps)")

if __name__ == "__main__":
    main()
`;
}

function generateMayaImportScript(manifest) {
  const glbRel = manifest.kind === 'prop' ? `meshes/${manifest.id}.obj` : 'scene_animated.glb';
  return `# -*- coding: utf-8 -*-
"""
VFX3D Arsenal — Autodesk Maya Python VFX Importer (${manifest.id})
Run in Maya Script Editor (Python Tab). Maya 2023+ supports glTF/USD via mayaUsd/glTF translator,
or imports static prop OBJ meshes directly.
"""
import os
import maya.cmds as cmds

PKG_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
ASSET_PATH = os.path.join(PKG_DIR, "${glbRel}")

cmds.playbackOptions(minTime=0, maxTime=${Math.max(1, (manifest.frameCount || 60) - 1)})
if ASSET_PATH.endswith(".obj") and os.path.exists(ASSET_PATH):
    cmds.file(ASSET_PATH, i=True, type="OBJ", ignoreVersion=True, namespace="VFX3D_VFX")
elif os.path.exists(ASSET_PATH):
    cmds.file(ASSET_PATH, i=True, ignoreVersion=True, namespace="VFX3D_VFX")
print("[VFX3D Maya] Imported:", ASSET_PATH)
`;
}

function generateUnityImporterCs(manifest) {
  return `// VFX3D Arsenal — Unity Editor VFX Asset Post-Setup Helper (${manifest.id})
// Drop this package folder into Assets/VFX3D_VFX/${manifest.id}/ (with com.unity.cloud.gltfast installed).
#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

public static class Vfx3dSetup_${manifest.id.replace(/[^a-zA-Z0-9_]/g, '_')}
{
    [MenuItem("Tools/VFX3D VFX/Select ${manifest.id} Manifest")]
    public static void PingManifest()
    {
        Debug.Log("[VFX3D VFX] Ready: ${manifest.id} (${manifest.title}) — Chant: ${manifest.chantDuration || 0}s, Total: ${manifest.totalDuration || 0}s");
    }
}
#endif
`;
}

function generateEngineDescriptors(manifest) {
  const flipbooks = (manifest.textures || []).filter((k) => k.startsWith('fb'));
  const sigils = (manifest.textures || []).filter((k) => k.startsWith('sigil'));
  const decals = (manifest.textures || []).filter((k) => k.startsWith('env'));

  const ue5Niagara = {
    schema: 'VFX3D_UE5_Niagara_Bridge_v1',
    emitterName: `NS_VFX3D_${manifest.id}`,
    animatedMeshPreviewGlb: manifest.kind === 'prop' ? `meshes/${manifest.id}.glb` : 'scene_animated.glb',
    timing: {
      fps: manifest.fps,
      chantLeadInSeconds: manifest.chantDuration || 0,
      releaseStartSeconds: manifest.chantDuration || 0,
      totalLoopDurationSeconds: manifest.totalDuration || 1.0,
    },
    subUVFlipbooks: flipbooks.map((k) => ({
      textureFile: `textures/${k}.webp`,
      subImagesHorizontal: 4,
      subImagesVertical: 4,
      totalFrames: 16,
      blendMode: 'Additive',
    })),
    magicCircleLayers: sigils.map((k, idx) => ({
      layerIndex: idx,
      textureFile: `textures/${k}.webp`,
      spawnOnCasterDuringChant: idx < (manifest.chantStages || 1),
    })),
    deferredGroundDecals: decals.map((k) => ({
      textureFile: `textures/${k}.webp`,
      nonCircularVoronoiMask: true,
    })),
    hitbox: manifest.hitbox || null,
  };

  const unityVfxGraph = {
    schema: 'VFX3D_Unity_VFXGraph_Bridge_v1',
    vfxAssetName: `VFX_VFX3D_${manifest.id}`,
    glbPrefabSource: manifest.kind === 'prop' ? `meshes/${manifest.id}.glb` : 'scene_animated.glb',
    chantPhaseDuration: manifest.chantDuration || 0,
    releasePhaseDuration: Math.max(0, (manifest.totalDuration || 1) - (manifest.chantDuration || 0)),
    flipbookSheets4x4: flipbooks.map((k) => `textures/${k}.webp`),
    sigilTextures: sigils.map((k) => `textures/${k}.webp`),
    groundTextures: decals.map((k) => `textures/${k}.webp`),
  };

  return { ue5Niagara, unityVfxGraph };
}

function generateReadmeMd(manifest) {
  return `# VFX3D Arsenal — Universal 3D VFX Export Package (\`${manifest.id}\`)

- **名稱**: ${manifest.title}
- **類型**: ${manifest.kind === 'prop' ? '3D 高精細幾何資產 (Prop Mesh)' : `完整 3D 動畫技能特效 (${manifest.cat})`}
- **施法前詠唱時間**: \`${manifest.chantDuration || 0}s\` (${manifest.chantLabel || '無'})
- **總動畫長度 / 幀率**: \`${manifest.totalDuration || 0}s\` @ \`${manifest.fps || 24} FPS\` (\`${manifest.frameCount || 1}\` frames)
- **拓撲統計**: \`${manifest.stats?.verts || 0}\` Verts / \`${manifest.stats?.tris || 0}\` Tris / \`${manifest.textures?.length || 0}\` Embedded WebP Textures

## 快速匯入指南 (Universal 3D Software Support)

1. **Blender 3.6 / 4.x**:
   - 直接拖入 \`${manifest.kind === 'prop' ? `meshes/${manifest.id}.glb` : 'scene_animated.glb'}\`（內含完整 TRS 關鍵幀動畫、自發光強度 \`KHR_materials_emissive_strength\` 與內嵌 \`.webp\` 貼圖），按下 \`Space\` 即可播放完整「施法者詠唱疊陣 ➔ 遠距釋放命中」動畫！
   - 或在 Scripting 執行 \`import_blender.py\` 自動配置暗色舞台、HDR 發光與點光源。
2. **Unreal Engine 5 (5.3+)**:
   - 直接將 \`.glb\` 拖入 Content Browser（UE5 內建 Interchange glTF Importer 原生支援動畫節點與材質），並對照 \`ue5_niagara_emitter.json\` 連接 \`textures/*.webp\` 4×4 SubUV 序列圖與法陣圖層。
3. **Unity (URP / HDRP)**:
   - 安裝官方套件 \`com.unity.cloud.gltfast\` 後直接放入 \`Assets/\`，對照 \`unity_vfx_graph.json\` 建立 VFX Graph。
4. **Maya / 3ds Max / Houdini / Cinema 4D / Godot 4 / Cascadeur**:
   - 所有支援 glTF 2.0 (\`.glb\`) 或 Wavefront (\`.obj\` + \`.mtl\`) 的 3D 軟體皆可直接讀取本特效包！
`;
}

// ============================================================================
// High-Level Package Builder (`.zip` containing `.glb` + `.obj` + `.webp` + JSON + Scripts)
// ============================================================================
export function exportVfxPackage({
  move = null,
  propId = null,
  fps = 24,
  includeActors = true,
  maxInstancesPerPool = 40,
} = {}) {
  const zipEntries = [];

  if (propId) {
    const item = MESH_GALLERY_ITEMS.find((m) => m.id === propId) || MESH_GALLERY_ITEMS[0];
    const pal = PAL3D[item.defaultPal] || PAL3D.holyGold;
    const asm = item.build(pal);
    asm.update?.(0.25);

    const glbRes = exportStaticGroupToGLB(asm.group, item.id);
    const objRes = exportStaticGroupToOBJ(asm.group, item.id);
    asm.dispose?.();

    const manifest = {
      schema: 'VFX3D_VFX_Package_v1',
      kind: 'prop',
      id: item.id,
      title: item.title || item.label,
      subtitle: item.sub,
      fps: 24,
      frameCount: 1,
      chantDuration: 0,
      totalDuration: 0,
      textures: glbRes.usedTexKeys,
      stats: glbRes.stats,
    };
    const { ue5Niagara, unityVfxGraph } = generateEngineDescriptors(manifest);

    zipEntries.push(
      { path: `meshes/${item.id}.glb`, data: glbRes.glbBytes },
      { path: `meshes/${item.id}.obj`, data: objRes.objText },
      { path: `meshes/${item.id}.mtl`, data: objRes.mtlText },
      { path: 'vfx_manifest.json', data: JSON.stringify(manifest, null, 2) },
      { path: 'ue5_niagara_emitter.json', data: JSON.stringify(ue5Niagara, null, 2) },
      { path: 'unity_vfx_graph.json', data: JSON.stringify(unityVfxGraph, null, 2) },
      { path: 'import_blender.py', data: generateBlenderImportScript(manifest) },
      { path: 'import_maya.py', data: generateMayaImportScript(manifest) },
      { path: 'UnityVfxImporter.cs', data: generateUnityImporterCs(manifest) },
      { path: 'README_EXPORT.md', data: generateReadmeMd(manifest) },
    );
    for (const tk of glbRes.usedTexKeys) {
      if (BAKED_AI_TEXTURES[tk]) {
        zipEntries.push({ path: `textures/${tk}.webp`, data: decodeDataUriBytes(BAKED_AI_TEXTURES[tk]) });
      }
    }

    return {
      fileName: `vfx3d_prop_${item.id}.zip`,
      glbFileName: `${item.id}.glb`,
      zipBytes: buildZipArchive(zipEntries),
      glbBytes: glbRes.glbBytes,
      manifest,
      stats: glbRes.stats,
    };
  }

  if (!move) throw new Error('exportVfxPackage requires either `move` or `propId`.');
  const baked = bakeAnimatedMoveToGLB(move, { fps, includeActors, maxInstancesPerPool });
  const effHb = getEffectiveMoveHitbox(move);
  const chantSpec = getEffectiveChantSpec(move);

  const manifest = {
    schema: 'VFX3D_VFX_Package_v1',
    kind: 'skill_vfx',
    id: move.id,
    cat: move.cat,
    cls: move.cls,
    title: move.title,
    codeId: move.codeId,
    targetTeam: move.targetTeam || effHb?.targetTeam || 'enemy',
    fps: baked.stats.fps,
    frameCount: baked.stats.frameCount,
    chantMode: FX_CONFIG.chantMode,
    chantLabel: chantSpec.label || '無詠唱 (瞬發)',
    chantStages: chantSpec.stages,
    chantDuration: baked.stats.chantDuration,
    releaseDuration: Number(move.duration.toFixed(3)),
    totalDuration: baked.stats.totalDuration,
    hitbox: effHb,
    fxConfigSnapshot: { ...FX_CONFIG },
    textures: baked.usedTexKeys,
    stats: baked.stats,
  };
  const { ue5Niagara, unityVfxGraph } = generateEngineDescriptors(manifest);

  // Also include a clean static caster weapon / prop reference OBJ if matching
  const dummyProp = MESH_GALLERY_ITEMS[0].build(PAL3D.holyGold);
  const sampleObj = exportStaticGroupToOBJ(dummyProp.group, 'reference_prop_shield');
  dummyProp.dispose?.();

  zipEntries.push(
    { path: 'scene_animated.glb', data: baked.glbBytes },
    { path: 'meshes/reference_prop_shield.obj', data: sampleObj.objText },
    { path: 'meshes/reference_prop_shield.mtl', data: sampleObj.mtlText },
    { path: 'vfx_manifest.json', data: JSON.stringify(manifest, null, 2) },
    { path: 'ue5_niagara_emitter.json', data: JSON.stringify(ue5Niagara, null, 2) },
    { path: 'unity_vfx_graph.json', data: JSON.stringify(unityVfxGraph, null, 2) },
    { path: 'import_blender.py', data: generateBlenderImportScript(manifest) },
    { path: 'import_maya.py', data: generateMayaImportScript(manifest) },
    { path: 'UnityVfxImporter.cs', data: generateUnityImporterCs(manifest) },
    { path: 'README_EXPORT.md', data: generateReadmeMd(manifest) },
  );

  for (const tk of baked.usedTexKeys) {
    if (BAKED_AI_TEXTURES[tk]) {
      zipEntries.push({ path: `textures/${tk}.webp`, data: decodeDataUriBytes(BAKED_AI_TEXTURES[tk]) });
    }
  }

  return {
    fileName: `vfx3d_vfx_${move.id}.zip`,
    glbFileName: `vfx3d_vfx_${move.id}.glb`,
    zipBytes: buildZipArchive(zipEntries),
    glbBytes: baked.glbBytes,
    manifest,
    stats: baked.stats,
  };
}

export function triggerBrowserDownload(bytes, fileName, mimeType = 'application/octet-stream') {
  if (typeof document === 'undefined') return;
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
