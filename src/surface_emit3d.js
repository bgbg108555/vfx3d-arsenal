import * as THREE from 'three';

// Sample posed triangles, including SkinnedMesh deformation, in world space.
export function sampleMeshSurface(mesh, rng, count) {
  const geometry = mesh?.geometry;
  const position = geometry?.getAttribute('position');
  if (!mesh?.isMesh || !position || count <= 0) return [];
  mesh.updateWorldMatrix(true, true);
  if (mesh.isSkinnedMesh) mesh.skeleton.update();
  const index = geometry.index;
  const total = index ? index.count : position.count;
  const triangles = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let areaSum = 0;
  const vertex = (i, target) => mesh.getVertexPosition(index ? index.getX(i) : i, target).applyMatrix4(mesh.matrixWorld);
  for (let i = 0; i + 2 < total; i += 3) {
    vertex(i, a); vertex(i + 1, b); vertex(i + 2, c);
    const area = new THREE.Triangle(a, b, c).getArea();
    if (!(area > 1e-12)) continue;
    areaSum += area;
    triangles.push({ end: areaSum, a: a.clone(), b: b.clone(), c: c.clone() });
  }
  if (!triangles.length) return [];
  const out = [];
  for (let i = 0; i < count; i++) {
    const pick = rng.next() * areaSum;
    let lo = 0, hi = triangles.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (triangles[mid].end < pick) lo = mid + 1; else hi = mid; }
    const tri = triangles[lo];
    const u = Math.sqrt(rng.next()), v = rng.next();
    out.push(tri.a.clone().multiplyScalar(1 - u).addScaledVector(tri.b, u * (1 - v)).addScaledVector(tri.c, u * v));
  }
  return out;
}
