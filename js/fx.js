// Efeitos visuais: fumaça/poeira/faíscas (partículas) e marcas de pneu
import * as THREE from 'three';

export class Particles {
  constructor(scene, max = 600) {
    this.max = max; this.n = 0; this.i = 0;
    this.pos = new Float32Array(max * 3), this.vel = new Float32Array(max * 3), this.life = new Float32Array(max), this.life0 = new Float32Array(max);
    this.size = new Float32Array(max), this.col = new Float32Array(max * 3), this.alpha = new Float32Array(max), this.grow = new Float32Array(max), this.grav = new Float32Array(max);
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { scale: { value: 600 } },
      vertexShader: `attribute float aSize; attribute vec3 aCol; attribute float aAlpha; varying vec3 vC; varying float vA; uniform float scale;
        void main(){ vC=aCol; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*scale/(-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 p=gl_PointCoord-0.5; float d=length(p)*2.0; float a=smoothstep(1.0,0.2,d)*vA; if(a<0.01) discard; gl_FragColor=vec4(vC,a); }`,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
    scene.add(this.points);
    for (let k = 0; k < max; k++) this.life[k] = 0;
  }
  emit(x, y, z, vx, vy, vz, size, life, r, g, b, a, grow = 1.2, grav = 0) {
    const k = this.i; this.i = (this.i + 1) % this.max;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.vel[k * 3] = vx; this.vel[k * 3 + 1] = vy; this.vel[k * 3 + 2] = vz;
    this.life[k] = this.life0[k] = life; this.size[k] = size; this.col[k * 3] = r; this.col[k * 3 + 1] = g; this.col[k * 3 + 2] = b; this.alpha[k] = a; this.grow[k] = grow; this.grav[k] = grav;
    this.base = this.base || new Float32Array(this.max); this.base[k] = a; this.s0 = this.s0 || new Float32Array(this.max); this.s0[k] = size;
  }
  update(dt, cam) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { this.alpha[k] = 0; continue; }
      this.life[k] -= dt;
      const t = 1 - this.life[k] / this.life0[k];
      this.vel[k * 3 + 1] += this.grav[k] * dt;
      const dr = 1 - Math.min(1, dt * 1.6);
      this.vel[k * 3] *= dr; this.vel[k * 3 + 2] *= dr;
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      this.size[k] = this.s0[k] * (1 + t * this.grow[k]);
      this.alpha[k] = this.base[k] * (1 - t) * Math.min(1, t * 8 + 0.3);
    }
    const a = this.geo.attributes; a.position.needsUpdate = a.aSize.needsUpdate = a.aCol.needsUpdate = a.aAlpha.needsUpdate = true;
    this.mat.uniforms.scale.value = innerHeight * 0.5 / Math.tan(cam.fov * Math.PI / 360);
  }
}

export class SkidMarks {
  constructor(scene, world, max = 2600) {
    this.world = world; this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 4 * 3);
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x070707, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    this.mesh.frustumCulled = false; scene.add(this.mesh);
    this.last = [null, null, null, null]; this.i = 0; this.count = 0;
  }
  add(wi, x, z, hx, hz, width, active) {
    const L = this.last[wi];
    if (!active) { this.last[wi] = null; return; }
    if (L) {
      const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
      if (d > 0.35 && d < 3) {
        const nx = -dz / d * width / 2, nz = dx / d * width / 2, w = this.world, y0 = w.heightAt(L.x, L.z) + 0.025, y1 = w.heightAt(x, z) + 0.025;
        const k = this.i * 12, P = this.pos;
        P[k] = L.x + nx; P[k + 1] = y0; P[k + 2] = L.z + nz; P[k + 3] = L.x - nx; P[k + 4] = y0; P[k + 5] = L.z - nz;
        P[k + 6] = x - nx; P[k + 7] = y1; P[k + 8] = z - nz; P[k + 9] = x + nx; P[k + 10] = y1; P[k + 11] = z + nz;
        this.i = (this.i + 1) % this.max; this.count = Math.min(this.max, this.count + 1);
        this.geo.setDrawRange(0, this.count * 6); this.geo.attributes.position.needsUpdate = true;
        this.last[wi] = { x, z };
      } else if (d >= 3) this.last[wi] = { x, z };
    } else this.last[wi] = { x, z };
  }
  clear() { this.count = 0; this.i = 0; this.geo.setDrawRange(0, 0); this.last = [null, null, null, null]; }
}
