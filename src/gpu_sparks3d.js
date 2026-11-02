import * as THREE from 'three';

// Short, non-colliding impact sparks: the GPU evaluates each trajectory from
// its birth time. Colliding particles stay in the CPU simulation.
export class GpuSparkPool3D {
  constructor(root, capacity = 1024) {
    this.capacity = capacity;
    this.clock = 0;
    this.nextSlot = 0;
    this.activeSlots = new Set();
    this.expires = new Float64Array(capacity);
    this.serials = new Uint32Array(capacity);
    this.nextSerial = 1;
    this.origins = new Float32Array(capacity * 3);
    this.velocities = new Float32Array(capacity * 3);
    this.winds = new Float32Array(capacity * 2);
    this.colors = new Float32Array(capacity * 3);
    this.params = new Float32Array(capacity * 4); // birth, lifetime, size, gravity

    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(this.origins, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aVelocity', new THREE.InstancedBufferAttribute(this.velocities, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aWind', new THREE.InstancedBufferAttribute(this.winds, 2).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(this.params, 4).setUsage(THREE.DynamicDrawUsage));
    geo.instanceCount = 0;
    this.geometry = geo;
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute vec3 aOrigin, aVelocity, aColor;
        attribute vec2 aWind;
        attribute vec4 aParams;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vFade;
        void main() {
          vUv = uv;
          vColor = aColor;
          float age = uTime - aParams.x;
          float life = aParams.y;
          if (life <= 0.0 || age < 0.0 || age >= life) {
            vFade = 0.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }
          float u = age / life;
          float drag = 2.2;
          float attenuation = exp(-drag * age);
          float travel = (1.0 - attenuation) / drag;
          vec3 acceleration = vec3(aWind.x, -aParams.w, aWind.y);
          vec3 p = aOrigin + aVelocity * travel + acceleration * ((age - travel) / drag);
          vec3 velocity = aVelocity * attenuation + acceleration * travel;
          vec4 viewPos = modelViewMatrix * vec4(p, 1.0);
          vec2 viewVelocity = (viewMatrix * vec4(velocity, 0.0)).xy;
          float speed = length(viewVelocity);
          vec2 along = speed > 0.001 ? viewVelocity / speed : vec2(0.0, 1.0);
          vec2 across = vec2(-along.y, along.x);
          float size = aParams.z * mix(1.0, 0.28, u);
          float stretch = 1.0 + min(speed * 0.18, 1.8);
          viewPos.xy += (across * position.x + along * position.y * stretch) * size;
          vFade = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.55, 1.0, u));
          gl_Position = projectionMatrix * viewPos;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vFade;
        void main() {
          float d = length((vUv - 0.5) * 2.0);
          float glow = pow(max(0.0, 1.0 - d), 1.6);
          float alpha = glow * vFade;
          if (alpha < 0.01) discard;
          vec3 color = vColor * (1.0 + glow * 0.65);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.gpuSparkPool = this;
    root.add(this.mesh);
  }

  spawnBurst(R, { x = 0, y = 0, z = 0, count = 12, palette, life = 0.35, delay = 0, spread = 0.15, size = 0.10, gravity = 4.5, windX = 0, windZ = 0 } = {}) {
    const color = new THREE.Color(palette?.[4] ?? '#ffffff');
    const hot = new THREE.Color(palette?.[5] ?? '#ffffff');
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      let slot = -1;
      for (let attempt = 0; attempt < this.capacity; attempt++) {
        const candidate = this.nextSlot;
        this.nextSlot = (this.nextSlot + 1) % this.capacity;
        if (this.expires[candidate] <= this.clock) { slot = candidate; break; }
      }
      if (slot < 0) break;
      const angle = R.range(0, Math.PI * 2);
      const rise = R.range(-0.25, 1.0);
      const radial = Math.sqrt(Math.max(0, 1 - rise * rise));
      const speed = R.range(1.5, 4.8);
      const offset = R.range(0, spread);
      const dx = Math.cos(angle) * radial, dz = Math.sin(angle) * radial;
      const k = slot * 3, p = slot * 4;
      this.origins.set([x + dx * offset, y + rise * offset, z + dz * offset], k);
      this.velocities.set([dx * speed, rise * speed, dz * speed], k);
      this.winds.set([windX, windZ], slot * 2);
      const sparkColor = color.clone().lerp(hot, R.range(0.0, 0.75));
      this.colors.set([sparkColor.r * 1.5, sparkColor.g * 1.5, sparkColor.b * 1.5], k);
      const duration = life * R.range(0.65, 1.0);
      const birth = this.clock + delay;
      this.params.set([birth, duration, size * R.range(0.65, 1.3), gravity], p);
      this.expires[slot] = birth + duration;
      this.serials[slot] = this.nextSerial++;
      this.activeSlots.add(slot);
      this.geometry.instanceCount = Math.max(this.geometry.instanceCount, slot + 1);
      spawned++;
    }
    if (spawned) {
      for (const name of ['aOrigin', 'aVelocity', 'aWind', 'aColor', 'aParams']) this.geometry.attributes[name].needsUpdate = true;
    }
    return spawned;
  }

  step(dt) {
    this.clock += dt;
    this.material.uniforms.uTime.value = this.clock;
    for (const slot of this.activeSlots) if (this.expires[slot] <= this.clock) this.activeSlots.delete(slot);
    if (this.activeSlots.size === 0) this.geometry.instanceCount = 0;
  }

  get activeCount() { return this.activeSlots.size; }

  // CPU equivalent for the existing GLB baker; motion uses the same equation
  // as the vertex shader, while its exported shape is an octahedron.
  sampleSlot(slot) {
    if (!this.activeSlots.has(slot)) return null;
    const p = slot * 4, i = slot * 3;
    const age = this.clock - this.params[p], life = this.params[p + 1];
    if (age < 0 || age >= life) return null;
    const u = age / life;
    const drag = 2.2;
    const travel = (1 - Math.exp(-drag * age)) / drag;
    const accelerationTime = (age - travel) / drag;
    const drop = -this.params[p + 3] * accelerationTime;
    return {
      serial: this.serials[slot],
      position: [this.origins[i] + this.velocities[i] * travel + this.winds[slot * 2] * accelerationTime,
        this.origins[i + 1] + this.velocities[i + 1] * travel + drop,
        this.origins[i + 2] + this.velocities[i + 2] * travel + this.winds[slot * 2 + 1] * accelerationTime],
      size: this.params[p + 2] * (1 - 0.72 * u),
      color: [this.colors[i], this.colors[i + 1], this.colors[i + 2]],
    };
  }

  clear() {
    this.clock = 0;
    this.nextSlot = 0;
    this.nextSerial = 1;
    this.activeSlots.clear();
    this.expires.fill(0);
    this.geometry.instanceCount = 0;
    this.material.uniforms.uTime.value = 0;
  }
}
