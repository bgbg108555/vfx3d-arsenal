// Analytic sphere SDFs. These are primitives, not Unreal mesh distance fields.
export function collideSphereFields(p, old, fields, restitution) {
  for (const field of fields) {
    if (field.type !== 'sphere' || !(field.radius > 0)) continue;
    const cx = field.x || 0, cy = field.y || 0, cz = field.z || 0;
    const radius = field.radius + Math.max(0, p.size * 0.5);
    const dx = p.x - old.x, dy = p.y - old.y, dz = p.z - old.z;
    const ox = old.x - cx, oy = old.y - cy, oz = old.z - cz;
    const a = dx * dx + dy * dy + dz * dz;
    const b = 2 * (ox * dx + oy * dy + oz * dz);
    const c = ox * ox + oy * oy + oz * oz - radius * radius;
    const disc = b * b - 4 * a * c;
    let t = -1;
    if (c <= 0) t = 0;
    else if (a > 1e-12 && disc >= 0) {
      const entry = (-b - Math.sqrt(disc)) / (2 * a);
      if (entry >= 0 && entry <= 1) t = entry;
    }
    if (t < 0) continue;
    let nx = ox + dx * t, ny = oy + dy * t, nz = oz + dz * t;
    let length = Math.hypot(nx, ny, nz);
    if (length < 1e-9) {
      nx = -p.vx; ny = -p.vy; nz = -p.vz;
      length = Math.hypot(nx, ny, nz);
      if (length < 1e-9) { nx = 0; ny = 1; nz = 0; length = 1; }
    }
    nx /= length; ny /= length; nz /= length;
    const normalSpeed = p.vx * nx + p.vy * ny + p.vz * nz;
    if (normalSpeed < 0) {
      const impulse = (1 + Math.max(0, restitution)) * normalSpeed;
      p.vx -= impulse * nx; p.vy -= impulse * ny; p.vz -= impulse * nz;
    }
    p.x = cx + nx * (radius + 1e-4);
    p.y = cy + ny * (radius + 1e-4);
    p.z = cz + nz * (radius + 1e-4);
  }
}
