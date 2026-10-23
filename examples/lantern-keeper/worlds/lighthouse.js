// The Lantern Keeper — the point at night.
//
// A white lighthouse (its lamp dark) on a grassy chalk headland above a
// moonlit sea. Across the bay the harbor town is still awake. Everything is
// procedural: no textures or models to download.
//
// Marks: cliff, lamp, door, sea, pier.
//
// World module contract (SHIORI-Spec §4.4):
//   export default function build({ THREE, scene, camera, renderer, marks, onUpdate, quality })
// Optionally returns { heightAt(x, z), dispose() } — the 3D layer uses heightAt to keep
// camera flights above the ground and to stand actors on it.

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Deterministic noise (CPU side, for the terrain and placement)

function hash(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
function vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fade(fx), v = fade(fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct, seed) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
// tileable gradient noise, period in lattice cells
function perlinT(x, y, period, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const g = (ix, iy, dx, dy) => {
    ix = ((ix % period) + period) % period; iy = ((iy % period) + period) % period;
    const a = hash(ix, iy, seed) * TAU;
    return Math.cos(a) * dx + Math.sin(a) * dy;
  };
  const u = fade(fx), v = fade(fy);
  const n00 = g(x0, y0, fx, fy), n10 = g(x0 + 1, y0, fx - 1, fy), n01 = g(x0, y0 + 1, fx, fy - 1), n11 = g(x0 + 1, y0 + 1, fx - 1, fy - 1);
  const nx0 = n00 + (n10 - n00) * u, nx1 = n01 + (n11 - n01) * u;
  return nx0 + (nx1 - nx0) * v;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---------------------------------------------------------------------------
// The land

const BASE_Y = 19.3;            // ground level at the lighthouse
const SPINE = [                 // headland centre line: x, z, half width
  [-2, -24, 11], [0, 0, 17], [3, 40, 25], [6, 90, 31], [10, 150, 48], [5, 240, 100],
];
const ARM = { ax: -430, az: 170, ar: 160, bx: -500, bz: -1500, br: 70 };   // the far shore (the town)

function segSD(px, pz, ax, az, ar, bx, bz, br) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return Math.sqrt(qx * qx + qz * qz) - (ar + (br - ar) * t);
}
function spineX(z) {
  for (let i = 0; i < SPINE.length - 1; i++) {
    const a = SPINE[i], b = SPINE[i + 1];
    if (z <= b[1] || i === SPINE.length - 2) return lerp(a[0], b[0], clamp((z - a[1]) / (b[1] - a[1]), 0, 1));
  }
  return 0;
}
// how much of the west flank is a gentle grassy combe (where the path climbs from the pier)
function combeW(x, z) {
  return smooth(6, 26, z) * (1 - smooth(60, 84, z)) * smooth(4, -10, x - spineX(z));
}
function headlandSD(x, z) {
  let d = 1e9;
  for (let i = 0; i < SPINE.length - 1; i++) {
    const a = SPINE[i], b = SPINE[i + 1];
    d = Math.min(d, segSD(x, z, a[0], a[1], a[2], b[0], b[1], b[2]));
  }
  d += (fbm(x * 0.03 + 11.3, z * 0.03 - 4.1, 3, 7) - 0.5) * 10 + (vnoise(x * 0.16, z * 0.16, 3) - 0.5) * 1.6;
  return d - combeW(x, z) * 26;
}
function plateau(x, z) {
  let h = BASE_Y + 5.4 * smooth(4, 60, z) + 0.07 * Math.max(z - 60, 0) - 0.07 * Math.max(-z - 8, 0);
  h += (fbm(x * 0.022 + 3.7, z * 0.022 + 1.1, 3, 11) - 0.5) * 3.2;
  const r = Math.hypot(x, z);
  return lerp(BASE_Y, h, smooth(10.5, 17, r));     // the lighthouse yard is level
}
function seabed(d) { return -2.4 - Math.min(d * 0.3, 26); }

function headlandH(x, z) {
  const sd = headlandSD(x, z), wc = combeW(x, z);
  const top = plateau(x, z);
  if (sd <= 0) {
    const s = -sd;
    const band = lerp(6.5, 44, wc);
    const t = clamp(s / band, 0, 1);
    const cliff = 1 - Math.pow(1 - t, 2.3);
    const combe = smooth(0.05, 1, t);
    const prof = lerp(cliff, combe, wc);
    const bottom = lerp(-0.7, 0.6, wc);
    // chalk gullies: small vertical grooves along the faces
    const groove = (1 - wc) * (fbm(x * 0.09 + z * 0.09, t * 2.0, 2, 21) - 0.5) * 2.2 * Math.sin(Math.PI * t);
    return bottom + (top - bottom) * prof + groove;
  }
  const d = sd;
  const cliffSea = d < 7 ? -0.7 - d * 0.18 : seabed(d - 7) - 1.3;
  const beachSea = 0.6 - d * 0.22;
  return Math.max(lerp(cliffSea, beachSea, wc), seabed(d));
}
function mainlandH(x, z) {
  const coast = 212 + (fbm(x * 0.005 + 2.0, 1.3, 3, 5) - 0.5) * 70;
  const s = z - coast;
  if (s < 0) return seabed(-s);
  const hills = 26 + 0.035 * s + 70 * fbm(x * 0.0035, z * 0.0035, 4, 9);
  return 0.6 + hills * smooth(0, 70, s);
}
function armH(x, z) {
  const sd = segSD(x, z, ARM.ax, ARM.az, ARM.ar, ARM.bx, ARM.bz, ARM.br) + (fbm(x * 0.008, z * 0.008, 3, 31) - 0.5) * 60;
  if (sd > 0) return seabed(sd);
  const s = -sd;
  const hills = 40 + 150 * fbm(x * 0.004 + 7, z * 0.004, 4, 41);
  return 1.0 + 2.4 * smooth(0, 10, s) + hills * smooth(26, 190, s);
}
export function terrainHeight(x, z) {
  return Math.max(headlandH(x, z), mainlandH(x, z), armH(x, z));
}

// ---------------------------------------------------------------------------
// Shared GLSL

const COMMON = /* glsl */`
uniform float uTime;
uniform vec3 uMoonDir;
uniform vec3 uMoonCol;
uniform vec3 uMoonGlow;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform vec3 uRimCol;
uniform vec3 uFillDir;
uniform vec3 uFillCol;
uniform vec3 uLampPos;
uniform vec3 uLampCol;
uniform vec3 uMistCol;
uniform vec3 uSkyZen;
uniform vec3 uSkyMid;
uniform vec3 uSkyHor;
uniform vec3 uSkyLow;
uniform vec3 uTownGlow;
uniform vec3 uTownDir;
uniform float uHaze;
uniform sampler2D uNoise;
uniform sampler2D uShore;
uniform vec4 uShoreBox;
uniform vec4 uTower;
uniform vec3 uShadow;

float n1(vec2 p) { return texture2D(uNoise, p).r; }
float fbm3(vec2 p) {
  return texture2D(uNoise, p).r * 0.55 + texture2D(uNoise, p * 2.07 + 0.31).g * 0.3 + texture2D(uNoise, p * 4.13 + 0.67).b * 0.15;
}
vec3 skyGrad(vec3 d) {
  float eh = max(d.y, 0.0);
  vec3 c = mix(uSkyHor, uSkyMid, smoothstep(0.0, 0.3, eh));
  c = mix(c, uSkyZen, smoothstep(0.22, 0.95, eh));
  c = mix(c, uSkyLow, (1.0 - smoothstep(0.0, 0.09, eh)) * 0.55);
  float md = max(dot(d, uMoonDir), 0.0);
  c += uMoonGlow * (pow(md, 1400.0) * 0.9 + pow(md, 120.0) * 0.16 + pow(md, 16.0) * 0.05);
  vec2 hz = normalize(d.xz + vec2(1e-5));
  float td = max(dot(hz, normalize(uTownDir.xz)), 0.0);
  c += uTownGlow * pow(td, 8.0) * exp(-eh * 14.0);
  return c;
}
float towerShadow(vec3 wp) {
  vec2 rel = wp.xz - uTower.xz;
  float along = dot(rel, uShadow.xy);
  vec2 perp = rel - along * uShadow.xy;
  float pr = length(perp);
  float hc = wp.y - uTower.y + along * uShadow.z;     // height on the tower that casts this point
  float rad = hc < 11.2 ? mix(2.75, 1.95, hc / 11.2) : hc < 11.8 ? 2.95 : hc < 14.1 ? 1.78 : mix(1.95, 0.25, (hc - 14.1) / 1.0);
  float inside = step(0.0, along) * step(0.0, hc) * (1.0 - smoothstep(15.0, 15.3, hc)) * smoothstep(uTower.y - 2.5, uTower.y - 0.5, wp.y);
  inside *= 1.0 - smoothstep(rad - 0.25, rad + 0.35, pr);
  return 1.0 - inside * 0.86;
}
vec3 litToon(vec3 alb, vec3 n, vec3 wp, float shadow, float rimK, float specK) {
  vec3 V = normalize(cameraPosition - wp);
  float ndl = dot(n, uMoonDir);
  float dif = smoothstep(-0.45, 0.95, ndl) * shadow;
  float hemi = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 amb = mix(uAmbGround, uAmbSky, hemi);
  vec3 c = alb * (amb + uMoonCol * dif + uFillCol * max(dot(n, uFillDir), 0.0));
  float fr = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.2);
  float back = clamp(dot(-V, uMoonDir) * 0.5 + 0.5, 0.0, 1.0);
  float side = smoothstep(-0.5, 0.3, ndl);                 // rim brightest on the moon side
  c += uRimCol * fr * rimK * (0.08 + back * back * side) * (0.35 + 0.65 * shadow) * (0.3 + 0.7 * alb.g / (alb.g + 0.15));
  if (specK > 0.0) { vec3 h = normalize(uMoonDir + V); c += uMoonCol * pow(max(dot(n, h), 0.0), 50.0) * specK * shadow; }
  vec3 lv = uLampPos - wp; float l2 = dot(lv, lv);
  c += alb * uLampCol * max(dot(n, lv * inversesqrt(l2 + 1e-4)) * 0.75 + 0.25, 0.0) / (1.0 + l2 * 0.2);
  return c;
}
vec3 atmos(vec3 c, vec3 wp) {
  vec3 v = wp - cameraPosition; float d = length(v); vec3 dir = v / max(d, 0.001);
  float haze = 1.0 - exp(-d * uHaze);
  vec3 hz = skyGrad(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.3 + 0.015, dir.z)));
  c = mix(c, hz, haze);
  vec2 suv = (wp.xz - uShoreBox.xy) / uShoreBox.zw;
  float coast = texture2D(uShore, suv).g;
  float n = fbm3(wp.xz * 0.0045 + vec2(uTime * 0.0035, uTime * 0.0012));
  float hm = exp(-max(wp.y - 0.2, 0.0) * 0.24);
  float mist = coast * smoothstep(0.3, 0.72, n) * hm * (1.0 - exp(-d * 0.022));
  return mix(c, uMistCol, clamp(mist, 0.0, 0.88));
}
vec3 tone(vec3 c) {
  vec3 x = max(c, 0.0);
  return mix(x, 1.0 - 0.4 * exp(-(x - 0.6) / 0.4), step(0.6, x));
}
`;

// fragment-only helpers (screen-space derivatives)
const FRAG = /* glsl */`
vec3 bumpN(vec3 n, vec3 p, float h, float k) {
  vec3 dpx = dFdx(p), dpy = dFdy(p);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - k * grad);
}
`;

const STD_VERT = /* glsl */`
attribute vec3 color;
attribute vec3 aK;
varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec3 vK;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = color; vK = aK;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// ---------------------------------------------------------------------------

export default function build({ THREE, scene, camera, renderer, marks, onUpdate, quality }) {
  const HI = quality !== 'low';
  const disposables = [];
  const keep = x => { disposables.push(x); return x; };
  const C = hex => new THREE.Color(hex);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.NoToneMapping;
  camera.fov = 45; camera.near = 0.2; camera.far = 14000;
  camera.updateProjectionMatrix();

  // ----- light and sky design -----
  const fromBearing = (bearing, elev) => {
    const b = bearing * Math.PI / 180, e = elev * Math.PI / 180;
    return V3(Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e)).normalize();
  };
  const MOON = fromBearing(3, 15.5);
  const FILL = fromBearing(-48, 8);
  const TOWN_DIR = fromBearing(-40, 0);
  const shadowXZ = new THREE.Vector2(-MOON.x, -MOON.z).normalize();
  const tanE = MOON.y / Math.hypot(MOON.x, MOON.z);

  const U = {
    uTime: { value: 0 },
    uMoonDir: { value: MOON },
    uMoonGlow: { value: C('#b9cdf2') },
    uMoonCol: { value: C('#b0c6ef') },
    uAmbSky: { value: C('#243f7c') },
    uAmbGround: { value: C('#0b1129') },
    uRimCol: { value: C('#8fb6ff') },
    uFillDir: { value: FILL },
    uFillCol: { value: C('#4a3036') },
    uLampPos: { value: V3(0, -100, 0) },
    uLampCol: { value: C('#ffb15c') },
    uMistCol: { value: C('#6a86c4') },
    uSkyZen: { value: C('#030720') },
    uSkyMid: { value: C('#0d2874') },
    uSkyHor: { value: C('#2364c4') },
    uSkyLow: { value: C('#62acea') },
    uTownGlow: { value: C('#6a3a66') },
    uTownDir: { value: TOWN_DIR },
    uHaze: { value: 1 / 2300 },
    uNoise: { value: null },
    uShore: { value: null },
    uShoreBox: { value: new THREE.Vector4(-170, -160, 340, 420) },
    uTower: { value: new THREE.Vector4(0, BASE_Y, 0, 15.2) },
    uShadow: { value: V3(shadowXZ.x, shadowXZ.y, tanE) },
  };

  const shader = (vertex, fragment, extra = {}, opts = {}) => keep(new THREE.ShaderMaterial({
    uniforms: { ...U, ...extra },
    vertexShader: COMMON + vertex,
    fragmentShader: COMMON + FRAG + fragment,
    ...opts,
  }));

  // ----- noise textures -----
  const NOISE_N = 256;
  {
    const data = new Uint8Array(NOISE_N * NOISE_N * 4);
    const periods = [8, 16, 16, 32];
    for (let c = 0; c < 4; c++) {
      const P = periods[c], vals = new Float32Array(NOISE_N * NOISE_N);
      let lo = 1e9, hi = -1e9;
      for (let y = 0; y < NOISE_N; y++) for (let x = 0; x < NOISE_N; x++) {
        const u = x / NOISE_N * P, v = y / NOISE_N * P;
        const n = perlinT(u, v, P, 13 + c * 31) + 0.5 * perlinT(u * 2, v * 2, P * 2, 77 + c * 31);
        vals[y * NOISE_N + x] = n; lo = Math.min(lo, n); hi = Math.max(hi, n);
      }
      for (let i = 0; i < vals.length; i++) data[i * 4 + c] = Math.round((vals[i] - lo) / (hi - lo) * 255);
    }
    const tex = keep(new THREE.DataTexture(data, NOISE_N, NOISE_N, THREE.RGBAFormat));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true; tex.needsUpdate = true;
    U.uNoise.value = tex;
  }
  const waterN = (() => {
    const N = 256, hgt = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      hgt[y * N + x] = perlinT(u * 6, v * 6, 6, 5) * 1.0 + perlinT(u * 12, v * 12, 12, 6) * 0.5 + perlinT(u * 24, v * 24, 24, 8) * 0.25 + perlinT(u * 48, v * 48, 48, 9) * 0.12;
    }
    const data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const hx = hgt[y * N + ((x + 1) % N)] - hgt[y * N + ((x + N - 1) % N)];
      const hy = hgt[((y + 1) % N) * N + x] - hgt[((y + N - 1) % N) * N + x];
      let nx = -hx * 9, ny = -hy * 9, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * N + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255); data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255); data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255); data[i + 3] = 255;
    }
    const tex = keep(new THREE.DataTexture(data, N, N, THREE.RGBAFormat));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); tex.needsUpdate = true;
    return tex;
  })();

  // ----- terrain mesh (tensor grid: fine near the point, coarse far away) -----
  const axis = (cmin, cmax, step, omin, omax, grow) => {
    const core = []; for (let v = cmin; v <= cmax + 1e-6; v += step) core.push(+v.toFixed(4));
    const left = []; let s = step, v = cmin; while (v > omin) { s *= grow; v -= s; left.push(Math.max(v, omin)); }
    const right = []; s = step; v = core[core.length - 1]; while (v < omax) { s *= grow; v += s; right.push(Math.min(v, omax)); }
    return Float64Array.from([...left.reverse(), ...core, ...right]);
  };
  const STEP = HI ? 1.25 : 2.0;
  const XS = axis(-125, 125, STEP, -4200, 4200, HI ? 1.075 : 1.14);
  const ZS = axis(-115, 255, STEP, -4200, 3200, HI ? 1.075 : 1.14);
  const NX = XS.length, NZ = ZS.length;
  const HGT = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) HGT[j * NX + i] = terrainHeight(XS[i], ZS[j]);

  const findCell = (arr, v) => {
    let lo = 0, hi = arr.length - 1;
    if (v <= arr[0]) return 0; if (v >= arr[hi]) return hi - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m; else hi = m; }
    return lo;
  };
  // exact height of the rendered terrain surface
  function heightAt(x, z) {
    const i = findCell(XS, x), j = findCell(ZS, z);
    const u = clamp((x - XS[i]) / (XS[i + 1] - XS[i]), 0, 1), v = clamp((z - ZS[j]) / (ZS[j + 1] - ZS[j]), 0, 1);
    const ha = HGT[j * NX + i], hd = HGT[j * NX + i + 1], hb = HGT[(j + 1) * NX + i], hc = HGT[(j + 1) * NX + i + 1];
    if (u + v <= 1) return ha + (hd - ha) * u + (hb - ha) * v;
    return hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v);
  }
  const groundNormalY = (x, z) => {
    const e = 0.6, hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e);
    return 2 * e / Math.hypot(hx, 2 * e, hz);
  };

  {
    const pos = new Float32Array(NX * NZ * 3);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const k = (j * NX + i) * 3; pos[k] = XS[i]; pos[k + 1] = HGT[j * NX + i]; pos[k + 2] = ZS[j]; }
    const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6);
    let p = 0;
    for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i, d = a + 1, b = a + NX, c = b + 1;
      // skip cells that are entirely deep under water
      if (HGT[a] < -3 && HGT[b] < -3 && HGT[c] < -3 && HGT[d] < -3) continue;
      idx[p++] = a; idx[p++] = b; idx[p++] = d;
      idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx.subarray(0, p), 1));
    // smooth, unbiased normals from central differences on the height grid
    const nor = new Float32Array(NX * NZ * 3);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const i0 = Math.max(0, i - 2), i1 = Math.min(NX - 1, i + 2), j0 = Math.max(0, j - 2), j1 = Math.min(NZ - 1, j + 2);
      const dx = (HGT[j * NX + i1] - HGT[j * NX + i0]) / (XS[i1] - XS[i0]);
      const dz = (HGT[j1 * NX + i] - HGT[j0 * NX + i]) / (ZS[j1] - ZS[j0]);
      const l = Math.hypot(dx, 1, dz), k = (j * NX + i) * 3;
      nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
    }
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.computeBoundingSphere();
    const mat = shader(/* glsl */`
      varying vec3 vW; varying vec3 vN;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }`, /* glsl */`
      uniform vec3 uGrassA; uniform vec3 uGrassB; uniform vec3 uHeather; uniform vec3 uChalk; uniform vec3 uChalkDark; uniform vec3 uShingle; uniform vec3 uFar;
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec3 n = normalize(vN);
        float slope = 1.0 - n.y;
        float nz = fbm3(vW.xz * 0.018);
        float nz2 = texture2D(uNoise, vW.xz * 0.09).g;
        vec3 grass = mix(uGrassA, uGrassB, smoothstep(0.3, 0.72, nz));
        grass = mix(grass, uHeather, smoothstep(0.6, 0.82, nz2) * 0.55);
        grass *= 0.7 + 0.55 * texture2D(uNoise, vW.xz * 0.6).b * texture2D(uNoise, vW.xz * 2.3).a;
        float chalkK = smoothstep(0.38, 0.62, slope + (nz2 - 0.5) * 0.25);
        float hu = vW.x * n.z - vW.z * n.x;                       // along the face
        float gully = fbm3(vec2(hu * 0.028, vW.y * 0.022 + hu * 0.004));
        float rough = texture2D(uNoise, vec2(hu * 0.16, vW.y * 0.2)).g * 0.6 + texture2D(uNoise, vec2(hu * 0.5, vW.y * 0.55)).b * 0.4;
        float fineK = 1.0 - smoothstep(25.0, 110.0, length(vW - cameraPosition));
        rough = mix(0.5, rough, fineK);
        float ly = vW.y * 0.42 + gully * 1.3;
        float ledge = smoothstep(0.0, 0.25, fract(ly)) * 0.35 + floor(ly) * 0.35;
        if (chalkK > 0.01) n = bumpN(n, vW, (gully * 3.2 + (rough * 0.4 + ledge * 0.6) * fineK) * chalkK, 1.0);
        float band = smoothstep(0.46, 0.5, abs(fract(ly) - 0.5)) * fineK;
        vec3 chalk = mix(uChalk, uChalkDark, smoothstep(0.38, 0.72, gully) * 0.55 + band * 0.2 + (1.0 - rough) * 0.12);
        chalk = mix(chalk, uChalk * vec3(0.84, 0.9, 0.86), smoothstep(0.62, 0.85, rough) * 0.35);
        chalk = mix(chalk * vec3(0.55, 0.62, 0.6), chalk, smoothstep(0.6, 3.0, vW.y));   // wet, weedy foot

        vec3 alb = mix(grass, chalk, chalkK);
        float lowK = 1.0 - smoothstep(0.5, 2.6, vW.y + (nz2 - 0.5) * 1.2);
        alb = mix(alb, uShingle * (0.8 + 0.4 * nz2), lowK);
        alb *= mix(0.45, 1.0, smoothstep(-0.4, 0.9, vW.y));
        float far = smoothstep(260.0, 700.0, length(vW.xz));
        alb = mix(alb, uFar, far);
        float tr = length(vW.xz - uTower.xz);
        alb *= mix(0.5, 1.0, smoothstep(2.9, 7.5, tr));
        float sh = towerShadow(vW);
        vec3 col = litToon(alb, n, vW, sh, mix(0.06, 0.45, chalkK) * (1.0 - far), 0.0);
        col = atmos(col, vW);
        gl_FragColor = vec4(tone(col), 1.0);
        #include <colorspace_fragment>
      }`, {
      uGrassA: { value: C('#0d2a2a') }, uGrassB: { value: C('#225238') }, uHeather: { value: C('#33325a') },
      uChalk: { value: C('#cfd3d4') }, uChalkDark: { value: C('#7d849a') }, uShingle: { value: C('#565a6a') }, uFar: { value: C('#0a1026') },
    });
    const terrain = new THREE.Mesh(g, mat);
    terrain.name = 'terrain';
    scene.add(terrain);
  }

  // ----- shore texture: water depth + coastal mist mask -----
  {
    const N = 256, box = U.uShoreBox.value, data = new Uint8Array(N * N * 4);
    const land = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const wx = box.x + (x + 0.5) / N * box.z, wz = box.y + (y + 0.5) / N * box.w;
      const h = terrainHeight(wx, wz);
      const i = y * N + x;
      land[i] = h > -0.8 ? 1 : 0;
      data[i * 4] = Math.round(clamp(-h / 7, 0, 1) * 255);
    }
    // blur the land mask a few times → coastal proximity
    let a = land, b = new Float32Array(N * N);
    const R = 7;
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < N; y++) { let s = 0; for (let x = -R; x <= R; x++) s += a[y * N + clamp(x, 0, N - 1)]; for (let x = 0; x < N; x++) { b[y * N + x] = s / (2 * R + 1); s += a[y * N + clamp(x + R + 1, 0, N - 1)] - a[y * N + clamp(x - R, 0, N - 1)]; } }
      for (let x = 0; x < N; x++) { let s = 0; for (let y = -R; y <= R; y++) s += b[clamp(y, 0, N - 1) * N + x]; for (let y = 0; y < N; y++) { a[y * N + x] = s / (2 * R + 1); s += b[clamp(y + R + 1, 0, N - 1) * N + x] - b[clamp(y - R, 0, N - 1) * N + x]; } }
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const edge = Math.min(x, y, N - 1 - x, N - 1 - y);
      const m = clamp(a[i] * 2.2, 0, 1) * smooth(0, 12, edge);
      data[i * 4 + 1] = Math.round(m * 255);
      if (edge < 2) data[i * 4] = 255;
      data[i * 4 + 3] = 255;
    }
    const tex = keep(new THREE.DataTexture(data, N, N, THREE.RGBAFormat));
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    U.uShore.value = tex;
  }

  // ----- geometry merging helper -----
  function merger() {
    const P = [], N = [], Cc = [], K = [];
    const v = new THREE.Vector3(), n = new THREE.Vector3(), m3 = new THREE.Matrix3(), c = new THREE.Color();
    const rnd = mulberry(99);
    return {
      add(geo, m, color, k = [0, 1, 0], jitter = 0) {
        const g = geo.index ? geo.toNonIndexed() : geo;
        const pos = g.attributes.position, nor = g.attributes.normal;
        m3.getNormalMatrix(m);
        c.set(color);
        if (jitter) c.multiplyScalar(1 - jitter + rnd() * jitter * 2);
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m); P.push(v.x, v.y, v.z);
          n.fromBufferAttribute(nor, i).applyMatrix3(m3).normalize(); N.push(n.x, n.y, n.z);
          Cc.push(c.r, c.g, c.b); K.push(k[0], k[1], k[2]);
        }
        if (g !== geo) g.dispose();
        geo.dispose();
      },
      build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
        g.setAttribute('aK', new THREE.Float32BufferAttribute(K, 3));
        g.computeBoundingSphere();
        return keep(g);
      },
    };
  }
  const Mx = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
    V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V3(sx, sy, sz));

  const toonMat = shader(STD_VERT, /* glsl */`
    varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec3 vK;
    void main() {
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) n = -n;
      float wear = texture2D(uNoise, vec2((vW.x + vW.z) * 0.11, vW.y * 0.03)).r;
      vec3 alb = vC * (0.9 + 0.14 * wear);
      float sh = towerShadow(vW + n * 0.4);
      vec3 col = litToon(alb, n, vW, sh, vK.y, vK.x) + vC * vK.z;
      col = atmos(col, vW);
      gl_FragColor = vec4(tone(col), 1.0);
      #include <colorspace_fragment>
    }`);

  // ----- the lighthouse -----
  const SEG = HI ? 56 : 28;
  const T = merger();
  const towerR = y => (y < 0.75 ? 3.05 : 2.75 - 0.8 * Math.pow(clamp((y - 0.75) / 10.45, 0, 1), 1.15));
  {
    const W = '#f2efe6', IRON = '#1f2833', ROOF = '#6e1f2b', STONE = '#c9c6bd';
    const prof = [new THREE.Vector2(3.3, -1.5), new THREE.Vector2(3.3, 0.5), new THREE.Vector2(3.12, 0.62), new THREE.Vector2(2.78, 0.72)];
    for (let i = 0; i <= 14; i++) { const y = 0.75 + 10.45 * i / 14; prof.push(new THREE.Vector2(towerR(y), y)); }
    prof.push(new THREE.Vector2(2.12, 11.3), new THREE.Vector2(2.55, 11.45), new THREE.Vector2(2.95, 11.6), new THREE.Vector2(3.0, 11.62));
    const lathe = new THREE.LatheGeometry(prof.slice(0, 4), SEG);
    T.add(lathe, Mx(0, BASE_Y, 0), STONE, [0, 0.6, 0]);
    T.add(new THREE.LatheGeometry(prof.slice(3, prof.length - 2), SEG), Mx(0, BASE_Y, 0), W, [0.05, 1.0, 0]);
    // corbel under the gallery (dark iron, like the lantern)
    T.add(new THREE.LatheGeometry(prof.slice(prof.length - 3), SEG), Mx(0, BASE_Y, 0), IRON, [0.6, 0.5, 0]);
    // gallery deck
    T.add(new THREE.CylinderGeometry(3.02, 3.02, 0.2, SEG), Mx(0, BASE_Y + 11.72, 0), IRON, [0.6, 0.6, 0]);
    // railing
    const posts = 22;
    for (let i = 0; i < posts; i++) {
      const a = i / posts * TAU;
      T.add(new THREE.CylinderGeometry(0.028, 0.028, 1.0, 5), Mx(Math.cos(a) * 2.9, BASE_Y + 12.32, Math.sin(a) * 2.9), IRON, [0.8, 0.4, 0]);
    }
    T.add(new THREE.TorusGeometry(2.9, 0.04, 6, SEG * 2), Mx(0, BASE_Y + 12.82, 0, Math.PI / 2), IRON, [0.9, 0.6, 0]);
    T.add(new THREE.TorusGeometry(2.9, 0.022, 5, SEG * 2), Mx(0, BASE_Y + 12.3, 0, Math.PI / 2), IRON, [0.8, 0.4, 0]);
    // lantern: parapet, mullions, top ring, roof, vent, finial
    T.add(new THREE.CylinderGeometry(1.78, 1.82, 0.5, SEG), Mx(0, BASE_Y + 12.07, 0), IRON, [0.5, 0.5, 0]);
    const mull = 10;
    for (let i = 0; i < mull; i++) {
      const a = i / mull * TAU;
      T.add(new THREE.BoxGeometry(0.07, 1.72, 0.09), Mx(Math.cos(a) * 1.7, BASE_Y + 13.18, Math.sin(a) * 1.7, 0, -a), IRON, [0.9, 0.7, 0]);
    }
    T.add(new THREE.CylinderGeometry(1.8, 1.8, 0.07, SEG), Mx(0, BASE_Y + 12.72, 0), IRON, [0.9, 0.5, 0]);
    T.add(new THREE.CylinderGeometry(1.84, 1.8, 0.16, SEG), Mx(0, BASE_Y + 14.1, 0), IRON, [0.9, 0.7, 0]);
    const roofProf = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; roofProf.push(new THREE.Vector2(lerp(2.02, 0.16, Math.pow(t, 0.8)), 14.18 + 0.95 * Math.sin(t * Math.PI / 2) * (0.35 + 0.65 * t))); }
    roofProf.unshift(new THREE.Vector2(1.84, 14.16));
    T.add(new THREE.LatheGeometry(roofProf, SEG), Mx(0, BASE_Y, 0), ROOF, [0.35, 0.8, 0]);
    T.add(new THREE.SphereGeometry(0.26, 16, 12), Mx(0, BASE_Y + 15.27, 0), IRON, [1.2, 0.8, 0]);
    T.add(new THREE.ConeGeometry(0.08, 0.55, 8), Mx(0, BASE_Y + 15.75, 0), IRON, [1.0, 0.6, 0]);
    T.add(new THREE.CylinderGeometry(0.014, 0.014, 1.1, 4), Mx(0, BASE_Y + 16.3, 0), IRON, [0.8, 0.5, 0]);
    // burner inside the lens (dark brass)
    T.add(new THREE.CylinderGeometry(0.14, 0.2, 0.5, 12), Mx(0, BASE_Y + 12.6, 0), '#5c4625', [1.2, 0.3, 0]);
    T.add(new THREE.CylinderGeometry(0.7, 0.75, 0.2, 20), Mx(0, BASE_Y + 12.42, 0), '#3a3020', [0.8, 0.3, 0]);
    // little windows spiralling up the tower
    for (const [y, az] of [[3.6, 0.3], [6.4, 2.6], [9.0, 4.4]]) {
      const r = towerR(y);
      T.add(new THREE.BoxGeometry(0.62, 0.95, 0.3), Mx(Math.sin(az) * (r - 0.06), BASE_Y + y, Math.cos(az) * (r - 0.06), 0, az), '#e3dfd3', [0, 0.8, 0]);
      T.add(new THREE.BoxGeometry(0.42, 0.72, 0.3), Mx(Math.sin(az) * (r + 0.0), BASE_Y + y + 0.02, Math.cos(az) * (r + 0.0), 0, az), '#0f1730', [2.0, 0.4, 0]);
      T.add(new THREE.BoxGeometry(0.7, 0.07, 0.42), Mx(Math.sin(az) * (r + 0.06), BASE_Y + y - 0.5, Math.cos(az) * (r + 0.06), 0, az), '#d9d5ca', [0, 0.8, 0]);
    }
    // the keeper's porch and door (facing south, towards the path)
    const PZ = 3.55;
    T.add(new THREE.BoxGeometry(2.6, 2.95, 2.5), Mx(0, BASE_Y + 1.47, PZ), W, [0.03, 0.9, 0]);
    const roofShape = new THREE.Shape(); roofShape.moveTo(-1.6, 0); roofShape.lineTo(1.6, 0); roofShape.lineTo(0, 0.95); roofShape.lineTo(-1.6, 0);
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 2.75, bevelEnabled: false });
    T.add(roofGeo, Mx(0, BASE_Y + 2.92, PZ - 1.15), '#33405a', [0.3, 0.8, 0]);
    T.add(new THREE.BoxGeometry(3.25, 0.08, 0.1), Mx(0, BASE_Y + 2.94, PZ + 1.6), '#26303f', [0.2, 0.5, 0]);
    const DZ = PZ + 1.26;
    T.add(new THREE.BoxGeometry(1.36, 2.32, 0.1), Mx(0, BASE_Y + 1.16, DZ), '#dcd8cc', [0, 0.6, 0]);     // stone surround
    T.add(new THREE.BoxGeometry(1.02, 2.02, 0.1), Mx(0, BASE_Y + 1.03, DZ + 0.04), '#2c5866', [0.15, 0.6, 0]);  // the door
    for (const x of [-0.25, 0, 0.25]) T.add(new THREE.BoxGeometry(0.025, 1.95, 0.02), Mx(x, BASE_Y + 1.03, DZ + 0.1), '#1d3a44', [0, 0.2, 0]);
    T.add(new THREE.BoxGeometry(0.9, 0.06, 0.03), Mx(0, BASE_Y + 1.6, DZ + 0.11), '#1a1f26', [0.9, 0.3, 0]);   // hinge straps
    T.add(new THREE.BoxGeometry(0.9, 0.06, 0.03), Mx(0, BASE_Y + 0.45, DZ + 0.11), '#1a1f26', [0.9, 0.3, 0]);
    T.add(new THREE.TorusGeometry(0.075, 0.014, 6, 16), Mx(0.33, BASE_Y + 1.0, DZ + 0.13), '#2b2a26', [1.4, 0.4, 0]);
    T.add(new THREE.BoxGeometry(1.7, 0.22, 0.8), Mx(0, BASE_Y + 0.08, DZ + 0.45), STONE, [0, 0.5, 0], 0.05);  // step
    T.add(new THREE.BoxGeometry(0.06, 0.06, 0.38), Mx(0.86, BASE_Y + 2.32, DZ + 0.2), IRON, [0.6, 0.3, 0]);  // lamp bracket
    T.add(new THREE.BoxGeometry(0.22, 0.3, 0.22), Mx(0.86, BASE_Y + 2.18, DZ + 0.4), '#152033', [1.6, 0.5, 0]);
    T.add(new THREE.ConeGeometry(0.18, 0.14, 4), Mx(0.86, BASE_Y + 2.4, DZ + 0.4, 0, Math.PI / 4), IRON, [0.6, 0.4, 0]);
    T.add(new THREE.CircleGeometry(0.28, 20), Mx(0, BASE_Y + 2.62, DZ + 0.02), '#122038', [2.0, 0.4, 0]); // fanlight
    // low white-washed yard wall with a gate gap toward the path
    const wallR = 9.2, segs = 64;
    for (let i = 0; i < segs; i++) {
      const a = (i + 0.5) / segs * TAU;              // angle from +Z
      const gate = Math.abs(Math.atan2(Math.sin(a - 0.12), Math.cos(a - 0.12)));
      if (gate < 0.13) continue;
      const x = Math.sin(a) * wallR, z = Math.cos(a) * wallR;
      const len = TAU * wallR / segs + 0.04;
      T.add(new THREE.BoxGeometry(len, 0.62, 0.42), Mx(x, BASE_Y + 0.27, z, 0, a + Math.PI / 2), '#d8d4ca', [0, 0.7, 0], 0.06);
      T.add(new THREE.BoxGeometry(len + 0.02, 0.09, 0.5), Mx(x, BASE_Y + 0.62, z, 0, a + Math.PI / 2), '#8f948f', [0, 0.5, 0], 0.08);
    }
    // gate posts
    for (const s of [-1, 1]) { const a = 0.12 + s * 0.15; T.add(new THREE.BoxGeometry(0.5, 1.05, 0.5), Mx(Math.sin(a) * wallR, BASE_Y + 0.45, Math.cos(a) * wallR, 0, a), '#e2ded4', [0, 0.7, 0]); }
    // a bench by the wall, looking out to sea
    T.add(new THREE.BoxGeometry(1.6, 0.06, 0.42), Mx(-5.6, BASE_Y + 0.46, -5.4, 0, 0.8), '#5b4a3c', [0.1, 0.6, 0]);
    for (const s of [-0.65, 0.65]) T.add(new THREE.BoxGeometry(0.07, 0.44, 0.38), Mx(-5.6 + Math.cos(0.8) * s, BASE_Y + 0.22, -5.4 - Math.sin(0.8) * s, 0, 0.8), '#3d3229', [0.1, 0.4, 0]);
  }
  const towerMesh = new THREE.Mesh(T.build(), toonMat);
  towerMesh.name = 'lighthouse';
  scene.add(towerMesh);

  // lantern glass and the dark lens (they catch the moonlight)
  {
    const glassGeo = new THREE.CylinderGeometry(1.7, 1.7, 1.66, 10, 1, true).toNonIndexed();
    glassGeo.computeVertexNormals();
    keep(glassGeo);
    const glassFrag = /* glsl */`
      varying vec3 vW; varying vec3 vN;
      uniform float uSide;
      void main() {
        vec3 n = normalize(vN) * uSide;
        vec3 V = normalize(cameraPosition - vW);
        float ndv = abs(dot(n, V));
        float F = 0.05 + 0.95 * pow(1.0 - ndv, 4.0);
        vec3 R = reflect(-V, n);
        vec3 refl = skyGrad(normalize(vec3(R.x, abs(R.y), R.z)));
        float md = max(dot(R, uMoonDir), 0.0);
        float spec = pow(md, 300.0) * 5.0 + pow(md, 18.0) * 0.5;
        float face = max(dot(n, uMoonDir), 0.0);
        float streak = smoothstep(0.5, 0.95, texture2D(uNoise, vec2(vW.y * 0.25 + (vW.x - vW.z) * 0.15, uTime * 0.01)).g);
        float through = pow(max(dot(-V, uMoonDir), 0.0), 3.0);      // moonlight seen through the panes
        vec3 col = refl * (0.45 + F * 1.6) + uMoonCol * (spec + face * 0.3 + streak * (face + through) * 0.35 + through * 0.35) + vec3(0.03, 0.05, 0.1);
        float a = clamp(0.22 + F * 0.7 + spec * 0.5 + face * 0.2 + through * 0.3, 0.0, 0.95);
        gl_FragColor = vec4(tone(atmos(col, vW)), a);
        #include <colorspace_fragment>
      }`;
    const glassVert = /* glsl */`varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
    const back = new THREE.Mesh(glassGeo, shader(glassVert, glassFrag, { uSide: { value: -1 } }, { transparent: true, depthWrite: false, side: THREE.BackSide }));
    const front = new THREE.Mesh(glassGeo, shader(glassVert, glassFrag, { uSide: { value: 1 } }, { transparent: true, depthWrite: false, side: THREE.FrontSide }));
    back.position.set(0, BASE_Y + 13.18, 0); front.position.copy(back.position);
    back.rotation.y = front.rotation.y = Math.PI / 10;
    back.renderOrder = 10; front.renderOrder = 12;
    // beehive Fresnel lens: stacked glass prisms
    const lp = [];
    const LN = 18;
    for (let i = 0; i <= LN; i++) {
      const y = -0.62 + 1.24 * i / LN;
      const belt = Math.abs(y) < 0.12 ? 0.05 : 0;
      const tooth = (i % 2 === 0) ? 0 : 0.07;
      lp.push(new THREE.Vector2(0.56 + tooth + belt - Math.abs(y) * 0.12, y));
    }
    lp.unshift(new THREE.Vector2(0.3, -0.64)); lp.push(new THREE.Vector2(0.28, 0.64));
    const lensGeo = keep(new THREE.LatheGeometry(lp, HI ? 40 : 20));
    const lens = new THREE.Mesh(lensGeo, shader(glassVert, /* glsl */`
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec3 n = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        vec3 R = reflect(-V, n);
        float md = max(dot(R, uMoonDir), 0.0);
        float ring = fract((vW.y - ${(BASE_Y + 13.18).toFixed(2)}) * 7.25 + 0.5);
        float through = pow(max(dot(-V, uMoonDir), 0.0), 2.0);
        float rings = smoothstep(0.35, 0.5, abs(ring - 0.5));
        float glint = pow(md, 40.0) * 3.0 + pow(max(dot(n, uMoonDir), 0.0), 3.0) * 0.4 + through * (0.35 + rings * 1.1);
        vec3 prism = 0.5 + 0.5 * cos(6.2831 * (ring + dot(n, V) * 0.6 + vec3(0.0, 0.33, 0.67)));
        float F = pow(1.0 - abs(dot(n, V)), 2.0);
        vec3 col = mix(vec3(0.05, 0.08, 0.12), skyGrad(normalize(vec3(R.x, abs(R.y), R.z))), 0.6) * (0.4 + F) + uMoonCol * glint * mix(vec3(1.0), prism, 0.55);
        gl_FragColor = vec4(tone(atmos(col, vW)), clamp(0.35 + F * 0.4 + glint * 0.3, 0.0, 0.92));
        #include <colorspace_fragment>
      }`, {}, { transparent: true, depthWrite: false }));
    lens.position.set(0, BASE_Y + 13.18, 0);
    lens.renderOrder = 11;
    scene.add(back, lens, front);
  }

  // ----- the path: a ribbon of chalk up the combe and across the point -----
  const PIER_Z = 38;
  let beachX = -20;
  for (let x = -20; x > -120; x -= 0.25) { if (heightAt(x, PIER_Z) < 0.35) { beachX = x; break; } }
  const PIER_X0 = beachX + 2.2, PIER_X1 = beachX - 28;
  const CLIFF = { x: 15.5, z: 47 };
  const pathPts = [
    [PIER_X0 + 0.5, PIER_Z - 3.0], [beachX + 8, PIER_Z - 11], [beachX + 14, PIER_Z + 7],
    [beachX + 23, PIER_Z - 9], [beachX + 31, PIER_Z + 9], [beachX + 40, PIER_Z + 1],
    [-4, 52], [CLIFF.x - 3.5, CLIFF.z + 2.5], [CLIFF.x - 2.5, CLIFF.z - 12], [7, 18], [1.6, 10.5], [0.3, 5.6],
  ];
  const inland = [[CLIFF.x - 3.5, CLIFF.z + 2.5], [CLIFF.x - 1, 80], [CLIFF.x + 4, 130], [CLIFF.x + 2, 190], [CLIFF.x - 10, 260]];
  const sampleCurve = (pts, step) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => V3(p[0], 0, p[1])), false, 'centripetal');
    const n = Math.ceil(curve.getLength() / step);
    return curve.getSpacedPoints(n).map(p => [p.x, p.z]);
  };
  const pathMain = sampleCurve(pathPts, 0.5), pathInland = sampleCurve(inland, 0.7);
  // distance-to-path grid for placement
  const PG = { x0: -140, z0: -60, n: 1, w: 300, h: 360 };
  const pathDist = new Float32Array(PG.w * PG.h).fill(99);
  for (const p of [...pathMain, ...pathInland]) {
    const cx = Math.round(p[0] - PG.x0), cz = Math.round(p[1] - PG.z0);
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const gx = cx + dx, gz = cz + dz; if (gx < 0 || gz < 0 || gx >= PG.w || gz >= PG.h) continue;
      const d = Math.hypot(gx + PG.x0 - p[0], gz + PG.z0 - p[1]);
      const k = gz * PG.w + gx; if (d < pathDist[k]) pathDist[k] = d;
    }
  }
  const distToPath = (x, z) => {
    const gx = Math.round(x - PG.x0), gz = Math.round(z - PG.z0);
    if (gx < 0 || gz < 0 || gx >= PG.w || gz >= PG.h) return 99;
    return pathDist[gz * PG.w + gx];
  };
  {
    const P = [], UV = [];
    const ribbon = (pts, width) => {
      const start = P.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        const w = width * (0.85 + 0.3 * vnoise(i * 0.15, 3.3, 5));
        for (const s of [-1, -0.33, 0.33, 1]) {
          const x = pts[i][0] - tz * w * s, z = pts[i][1] + tx * w * s;
          P.push(x, heightAt(x, z) + 0.04, z); UV.push(s, i * 0.5);
        }
      }
      return { start, count: pts.length };
    };
    const r1 = ribbon(pathMain, 0.8), r2 = ribbon(pathInland, 0.9);
    const idx = [];
    for (const r of [r1, r2]) for (let i = 0; i < r.count - 1; i++) for (let k = 0; k < 3; k++) {
      const a = r.start + i * 4 + k, b = a + 1, c = a + 4, d = a + 5;
      idx.push(a, b, c, b, d, c);
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = shader(/* glsl */`
      varying vec3 vW; varying vec2 vUv; varying vec3 vN;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vUv = uv; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }`, /* glsl */`
      varying vec3 vW; varying vec2 vUv; varying vec3 vN;
      void main() {
        float n = texture2D(uNoise, vW.xz * 0.35).r;
        float edge = 1.0 - smoothstep(0.45 + n * 0.35, 1.0, abs(vUv.x));
        float rut = 1.0 - 0.18 * smoothstep(0.1, 0.0, abs(abs(vUv.x) - 0.45));
        float pebble = texture2D(uNoise, vW.xz * 1.3).b * texture2D(uNoise, vW.xz * 3.1 + 0.4).a;
        float worn = smoothstep(0.35, 0.7, texture2D(uNoise, vW.xz * 0.11).g);
        vec3 alb = vec3(0.56, 0.57, 0.56) * (0.6 + 0.7 * pebble) * rut * mix(1.0, 0.72, worn);
        vec3 nn = normalize(vN + vec3(0.0, 2.0, 0.0));
        vec3 col = litToon(alb, nn, vW, towerShadow(vW), 0.2, 0.0);
        gl_FragColor = vec4(tone(atmos(col, vW)), edge * 0.92);
        #include <colorspace_fragment>
      }`, {}, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const path = new THREE.Mesh(g, mat);
    path.renderOrder = 2;
    path.name = 'path';
    scene.add(path);
  }

  // ----- the pier -----
  {
    const Pm = merger(), rnd = mulberry(7);
    const DECK = 1.55, len = PIER_X0 - PIER_X1;
    const WOOD = '#6b5c4f', DARK = '#3b332d';
    const planks = Math.floor(len / 0.3);
    for (let i = 0; i < planks; i++) {
      const x = PIER_X0 - i * 0.3 - 0.15;
      if (rnd() < 0.03) continue;  // a missing board
      Pm.add(new THREE.BoxGeometry(0.27, 0.07, 2.3 + rnd() * 0.15), Mx(x, DECK + (rnd() - 0.5) * 0.015, PIER_Z + (rnd() - 0.5) * 0.08, 0, (rnd() - 0.5) * 0.02), WOOD, [0.05, 0.5, 0], 0.18);
    }
    for (const s of [-0.85, 0.85]) Pm.add(new THREE.BoxGeometry(len, 0.2, 0.16), Mx((PIER_X0 + PIER_X1) / 2, DECK - 0.14, PIER_Z + s), DARK, [0, 0.4, 0]);
    let k = 0;
    for (let x = PIER_X0 - 0.4; x > PIER_X1 - 0.1; x -= 3.1, k++) {
      for (const s of [-1.12, 1.12]) {
        const tall = (k % 3 === 0 || x - 3.1 < PIER_X1 - 0.1) && s > 0;
        const top = DECK + (tall ? 0.95 : 0.05);
        Pm.add(new THREE.CylinderGeometry(0.13, 0.15, top + 5, 8), Mx(x, (top - 5) / 2, PIER_Z + s, (rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.04), DARK, [0.05, 0.6, 0], 0.15);
        if (tall) Pm.add(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 8), Mx(x, top + 0.02, PIER_Z + s), '#2c2622', [0.1, 0.5, 0]);
      }
      // cross bracing
      Pm.add(new THREE.BoxGeometry(0.08, 0.12, 2.6), Mx(x, DECK - 0.9, PIER_Z, 0.65, 0, 0), DARK, [0, 0.4, 0]);
    }
    // ladder at the end
    const lx = PIER_X1 + 0.15;
    for (const s of [-0.25, 0.25]) Pm.add(new THREE.BoxGeometry(0.06, 2.6, 0.06), Mx(lx - 0.1, DECK - 1.1, PIER_Z - 1.25 + s), DARK, [0.1, 0.4, 0]);
    for (let i = 0; i < 6; i++) Pm.add(new THREE.BoxGeometry(0.05, 0.04, 0.5), Mx(lx - 0.1, DECK - 0.1 - i * 0.38, PIER_Z - 1.25), DARK, [0.1, 0.4, 0]);
    // coil of rope and a bollard
    Pm.add(new THREE.TorusGeometry(0.28, 0.06, 6, 16), Mx(PIER_X1 + 2.2, DECK + 0.08, PIER_Z - 0.5, Math.PI / 2), '#8a7454', [0.05, 0.5, 0]);
    Pm.add(new THREE.TorusGeometry(0.2, 0.055, 6, 14), Mx(PIER_X1 + 2.2, DECK + 0.17, PIER_Z - 0.5, Math.PI / 2), '#8a7454', [0.05, 0.5, 0]);
    Pm.add(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 10), Mx(PIER_X1 + 1.0, DECK + 0.2, PIER_Z + 0.75), '#252a30', [0.8, 0.5, 0]);
    // lamp post at the shore end (lit: the one warm light on this side of the bay)
    const LX = PIER_X0 - 0.6, LZ = PIER_Z - 1.45;
    Pm.add(new THREE.CylinderGeometry(0.05, 0.07, 2.9, 8), Mx(LX, DECK + 1.45, LZ), '#1d232b', [0.8, 0.5, 0]);
    Pm.add(new THREE.BoxGeometry(0.42, 0.05, 0.42), Mx(LX, DECK + 2.95, LZ), '#1d232b', [0.8, 0.5, 0]);
    Pm.add(new THREE.ConeGeometry(0.34, 0.24, 4), Mx(LX, DECK + 3.38, LZ, 0, Math.PI / 4), '#1d232b', [0.8, 0.5, 0]);
    Pm.add(new THREE.BoxGeometry(0.3, 0.36, 0.3), Mx(LX, DECK + 3.1, LZ), '#ffcf8a', [0, 0, 3.2]);
    U.uLampPos.value.set(LX, DECK + 3.1, LZ);
    const pier = new THREE.Mesh(Pm.build(), toonMat);
    pier.name = 'pier';
    scene.add(pier);
    // a few rocks at the cliff foot
    const Rm = merger(), rr = mulberry(31);
    let placed = 0;
    for (let tries = 0; tries < 900 && placed < (HI ? 46 : 20); tries++) {
      const x = -40 + rr() * 85, z = -50 + rr() * 110;
      const h = heightAt(x, z);
      if (h > -0.2 || h < -2.2 || combeW(x, z) > 0.2) continue;
      const s = 0.6 + rr() * 1.6;
      Rm.add(new THREE.DodecahedronGeometry(1, 0), Mx(x, h + s * 0.3, z, rr() * 3, rr() * 3, rr() * 3, s * (1 + rr()), s * (0.6 + rr() * 0.5), s), rr() < 0.6 ? '#b9b8b2' : '#5c5e66', [0.05, 0.6, 0], 0.15);
      placed++;
    }
    const rocks = new THREE.Mesh(Rm.build(), toonMat);
    rocks.name = 'rocks';
    scene.add(rocks);
  }

  // fence posts along the cliff-side stretch of the path
  {
    const Fm = merger(), rnd = mulberry(3);
    const posts = [];
    for (let i = 0; i < pathMain.length; i += 5) {
      const p = pathMain[i];
      if (p[1] > 58 || p[1] < 14 || p[0] < CLIFF.x - 9) continue;
      const q = pathMain[Math.min(i + 1, pathMain.length - 1)];
      let tx = q[0] - p[0], tz = q[1] - p[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const x = p[0] + tz * 1.7, z = p[1] - tx * 1.7;   // on the seaward side
      const h = heightAt(x, z);
      Fm.add(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 6), Mx(x, h + 0.42, z, (rnd() - 0.5) * 0.12, 0, (rnd() - 0.5) * 0.12), '#4f4438', [0.05, 0.6, 0], 0.2);
      posts.push([x, h + 0.82, z]);
    }
    const seg = (a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
      const m = new THREE.Matrix4().lookAt(V3(a[0], a[1], a[2]), V3(b[0], b[1], b[2]), V3(0, 1, 0));
      m.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      Fm.add(new THREE.BoxGeometry(0.025, 0.025, L), m, '#8f7c62', [0.1, 0.7, 0]);
    };
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i], b = posts[i + 1];
      if (Math.hypot(a[0] - b[0], a[2] - b[2]) > 4.5) continue;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.12, (a[2] + b[2]) / 2];
      seg(a, mid); seg(mid, b);
    }
    const fence = new THREE.Mesh(Fm.build(), toonMat);
    fence.name = 'fence';
    scene.add(fence);
  }

  // ----- the sea -----
  let seaLights = null, townMat = null;
  {
    const RINGS = HI ? 200 : 110, SEGS = HI ? 288 : 160, R0 = 0.6, RMAX = 9000;
    const k = Math.pow(RMAX / R0, 1 / RINGS);
    const cx = -20, cz = 10;
    const pos = new Float32Array((RINGS + 1) * SEGS * 3 + 3);
    pos[0] = cx; pos[1] = 0; pos[2] = cz;
    for (let r = 0; r <= RINGS; r++) {
      const rad = R0 * Math.pow(k, r);
      for (let s = 0; s < SEGS; s++) {
        const a = (s + (r % 2) * 0.5) / SEGS * TAU, i = 1 + r * SEGS + s;
        pos[i * 3] = cx + Math.cos(a) * rad; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = cz + Math.sin(a) * rad;
      }
    }
    const idx = [];
    for (let s = 0; s < SEGS; s++) idx.push(0, 1 + (s + 1) % SEGS, 1 + s);
    for (let r = 0; r < RINGS; r++) for (let s = 0; s < SEGS; s++) {
      const a = 1 + r * SEGS + s, b = 1 + r * SEGS + (s + 1) % SEGS, c = 1 + (r + 1) * SEGS + s, d = 1 + (r + 1) * SEGS + (s + 1) % SEGS;
      if (r % 2 === 0) idx.push(a, b, c, b, d, c); else idx.push(a, d, c, a, b, d);
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    g.boundingSphere = new THREE.Sphere(V3(cx, 0, cz), RMAX);
    const NL = HI ? 24 : 8;
    const lightPos = Array.from({ length: NL }, () => new THREE.Vector4(0, -1000, 0, 0));
    const lightCol = Array.from({ length: NL }, () => new THREE.Vector3());
    const mat = shader(/* glsl */`
      varying vec3 vW; varying vec3 vN;
      vec3 wave(vec2 p, vec2 dir, float steep, float wl, float t, inout vec3 tg, inout vec3 bn, float att) {
        float kk = 6.2831853 / wl; float c = sqrt(9.8 / kk); vec2 d = normalize(dir);
        float f = kk * (dot(d, p) - c * t); float a = steep / kk * att; float s = steep * att;
        tg += vec3(-d.x * d.x * s * sin(f), d.x * s * cos(f), -d.x * d.y * s * sin(f));
        bn += vec3(-d.x * d.y * s * sin(f), d.y * s * cos(f), -d.y * d.y * s * sin(f));
        return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
      }
      void main() {
        vec3 p = position;
        float dist = length(p.xz - cameraPosition.xz);
        float att = 1.0 - smoothstep(${HI ? '120.0, 900.0' : '60.0, 380.0'}, dist);
        float att2 = 1.0 - smoothstep(${HI ? '60.0, 320.0' : '30.0, 160.0'}, dist);
        // calmer water in the shallows, so the swell doesn't climb the beach
        float shallow = smoothstep(0.0, 0.35, texture2D(uShore, (p.xz - uShoreBox.xy) / uShoreBox.zw).r);
        att *= 0.35 + 0.65 * shallow; att2 *= 0.35 + 0.65 * shallow;
        vec3 tg = vec3(1.0, 0.0, 0.0), bn = vec3(0.0, 0.0, 1.0);
        vec3 off = wave(p.xz, vec2(0.35, 1.0), 0.09, 31.0, uTime, tg, bn, att)
                 + wave(p.xz, vec2(-0.5, 0.85), 0.07, 17.0, uTime, tg, bn, att)
                 + wave(p.xz, vec2(0.9, 0.4), 0.06, 9.5, uTime, tg, bn, att2)
                 + wave(p.xz, vec2(0.1, 1.0), 0.05, 5.3, uTime, tg, bn, att2);
        p += off;
        vW = (modelMatrix * vec4(p, 1.0)).xyz;
        vN = normalize(cross(bn, tg));
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
      }`, /* glsl */`
      uniform sampler2D uWaterN;
      uniform vec4 uLights[${NL}];
      uniform vec3 uLightCols[${NL}];
      uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform vec3 uGlitter;
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec3 V = cameraPosition - vW; float dist = length(V); V /= dist;
        vec2 uv1 = vW.xz * 0.032 + vec2(uTime * 0.012, uTime * 0.007);
        vec2 uv2 = vW.xz * 0.083 + vec2(-uTime * 0.016, uTime * 0.011);
        vec3 d1 = texture2D(uWaterN, uv1).xyz * 2.0 - 1.0;
        vec3 d2 = texture2D(uWaterN, uv2).xyz * 2.0 - 1.0;
        float det = mix(1.0, 0.5, smoothstep(40.0, 1200.0, dist));
        vec3 dn = vec3(d1.x + d2.x * 0.7, 0.0, d1.y + d2.y * 0.7) * det;
        vec3 n = normalize(vN + dn * 0.3);
        vec3 nm = normalize(vN + dn * 0.17);
        vec3 ns = normalize(vN + dn * 0.12);
        float ndv = max(dot(ns, V), 0.0);
        float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 R = reflect(-V, n);
        vec3 Rs = reflect(-V, ns);
        Rs = normalize(vec3(Rs.x, abs(Rs.y) + 0.01, Rs.z));
        vec3 refl = skyGrad(Rs) * 0.7;
        vec2 suv = (vW.xz - uShoreBox.xy) / uShoreBox.zw;
        vec4 sh = texture2D(uShore, suv);
        float depth = sh.r;
        vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 0.55, depth));
        body *= 0.35 + 0.5 * max(dot(n, uMoonDir), 0.0);
        vec3 col = mix(body, refl, F);
        // moonlight glitter path
        float md = max(dot(R, uMoonDir), 0.0);
        float mdm = max(dot(reflect(-V, nm), uMoonDir), 0.0);
        float sharp = mix(2400.0, 500.0, smoothstep(30.0, 2500.0, dist));
        // a soft road of light under the moon (the average of many wave facets) plus sharp glints
        vec3 Vf = normalize(vec3(-V.x, -V.y, -V.z));
        vec3 Rflat = reflect(Vf, vec3(0.0, 1.0, 0.0));
        float az = dot(normalize(Rflat.xz), normalize(uMoonDir.xz));
        float roadA = pow(max(az, 0.0), 2200.0);
        float roadE = exp(-pow((Rflat.y - uMoonDir.y) / 0.3, 2.0));
        col += uGlitter * roadA * roadE * 0.3 * (0.4 + 0.9 * texture2D(uNoise, vW.xz * vec2(0.05, 0.4) + vec2(0.0, uTime * 0.03)).r);
        col += uGlitter * (pow(md, sharp) * 4.0 + pow(mdm, 420.0) * 0.7 + pow(mdm, 60.0) * 0.05);
        ${HI ? 'col += uGlitter * pow(md, sharp * 2.5) * 12.0 * smoothstep(0.55, 0.9, texture2D(uNoise, vW.xz * 0.2 + uTime * 0.05).g);' : ''}
        // reflections of the town lights and the pier lamp
        for (int i = 0; i < ${NL}; i++) {
          vec4 L = uLights[i];
          vec3 ld = L.xyz - vW; float l = length(ld);
          float rd = max(dot(R, ld / l), 0.0);
          col += uLightCols[i] * (pow(rd, 2200.0) * 1.3 + pow(rd, 300.0) * 0.035) * L.w;
        }
        // foam where the swell meets the chalk
        float fn = texture2D(uNoise, vW.xz * 0.12 + vec2(uTime * 0.02, 0.0)).b;
        float shoreLine = 1.0 - smoothstep(0.0, 0.07 + fn * 0.06, depth);
        float bands = smoothstep(0.55, 0.95, sin(depth * 90.0 - uTime * 1.4 + fn * 6.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.0, 0.18, depth));
        float foam = clamp(shoreLine * (0.5 + fn) + bands * 0.6 * fn, 0.0, 1.0) * step(0.001, depth + 0.002);
        col = mix(col, uFoam * (0.6 + 0.7 * max(dot(n, uMoonDir), 0.2)), foam * 0.75);
        col = atmos(col, vW);
        gl_FragColor = vec4(tone(col), 1.0);
        #include <colorspace_fragment>
      }`, {
      uWaterN: { value: waterN },
      uLights: { value: lightPos }, uLightCols: { value: lightCol },
      uDeep: { value: C('#020c26') }, uShallow: { value: C('#0f4560') }, uFoam: { value: C('#b8c8e8') }, uGlitter: { value: C('#fff3da') },
    });
    const sea = new THREE.Mesh(g, mat);
    sea.name = 'sea';
    sea.frustumCulled = false;
    scene.add(sea);
    seaLights = { lightPos, lightCol, NL };
  }

  // ----- sky (full-screen, drawn behind everything) -----
  // Milky Way: a great circle from the WNW horizon, rising high over the ENE
  const MW_A = fromBearing(-62, 0), MW_B = fromBearing(65, 48);
  const MW_N = new THREE.Vector3().crossVectors(MW_A, MW_B).normalize();
  const MW_X = new THREE.Vector3().crossVectors(MW_N, V3(0, 1, 0)).normalize();
  const MW_Y = new THREE.Vector3().crossVectors(MW_N, MW_X);
  const angOf = d => Math.atan2(d.dot(MW_Y), d.dot(MW_X));
  const MW_BULGE = (() => { const a = angOf(MW_A), b = angOf(MW_B); let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + Math.sign(d) * 0.45; })();
  {
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const su = { uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() } };
    const mat = shader(/* glsl */`
      uniform mat4 uInvProj; uniform mat4 uCamWorld;
      varying vec3 vDir;
      void main() {
        vec4 p = uInvProj * vec4(position.xy, 1.0, 1.0);
        vDir = mat3(uCamWorld) * (p.xyz / p.w);
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }`, /* glsl */`
      uniform vec3 uMWN; uniform vec3 uMWX; uniform float uMWBulge; uniform vec3 uMWA; uniform vec3 uMWB; uniform vec3 uMWC;
      uniform vec3 uCloudDark; uniform vec3 uCloudLit; uniform vec3 uMoonDisc;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = skyGrad(d);
        float eh = max(d.y, 0.0);
        float md = dot(d, uMoonDir);
        // Milky Way: a soft glow, dark dust and a dense field of faint stars
        float b = dot(d, uMWN);
        vec3 mwY = cross(uMWN, uMWX);
        float ang = atan(dot(d, mwY), dot(d, uMWX));
        vec2 mw = vec2(ang * (8.0 / 6.2831853), b * 2.6);
        float da = ang - uMWBulge; da = atan(sin(da), cos(da));
        float bulge = exp(-da * da * 1.5);
        float bb = b + (fbm3(vec2(mw.x * 0.45, 0.3)) - 0.45) * 0.08;
        float width = 34.0 - bulge * 12.0;
        float core = exp(-bb * bb * width);
        float inner = exp(-bb * bb * width * 4.0);
        vec2 iso = mw * vec2(2.05, 1.0);                  // equal angular scale along and across the band
        float cl = fbm3(iso * 1.3 + 0.13);
        float dust = smoothstep(0.46, 0.74, fbm3(iso * 2.1 + vec2(5.7, 1.3))) * inner;
        float glow = (core * (0.3 + 0.7 * cl) + inner * 0.35) * (1.0 - dust * 0.6);
        vec3 mwCol = mix(uMWA, uMWB, smoothstep(0.3, 0.7, n1(mw * 0.6 + 0.4)));
        mwCol = mix(mwCol, uMWC, bulge * inner * 0.7);
        float vis = smoothstep(0.02, 0.25, eh) * (1.0 - smoothstep(0.8, 0.99, md));
        c += mwCol * glow * (0.12 + bulge * 0.14) * vis;
        ${HI ? `{
          vec3 sp = d * 300.0; vec3 id = floor(sp); vec3 f = fract(sp) - 0.5;
          float h = fract(sin(dot(id, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          vec3 off = vec3(fract(h * 17.3), fract(h * 31.7), fract(h * 57.1)) - 0.5;
          float dens = core * (0.55 + cl * 0.4) * (1.0 - dust * 0.7) + 0.025;
          float st = step(h, dens) * smoothstep(0.17, 0.02, length(f - off * 0.6)) * (0.35 + 0.65 * fract(h * 97.0));
          c += vec3(0.78, 0.84, 1.0) * st * 0.7 * smoothstep(0.0, 0.18, eh) * (1.0 - smoothstep(0.9, 0.995, md));
        }` : ''}
        float cloudA = 0.0;
        ${HI ? `
        if (d.y > 0.0) {
          vec2 cp = d.xz / (d.y + 0.05) * 0.035 + vec2(uTime * 0.0012, uTime * 0.0004);
          float cn = fbm3(cp * vec2(0.45, 1.7));
          float band = smoothstep(0.012, 0.05, eh) * (1.0 - smoothstep(0.16, 0.34, eh));
          cloudA = smoothstep(0.5, 0.8, cn) * band;
          float lining = pow(max(md, 0.0), 14.0);
          vec3 cc = mix(uCloudDark, uCloudLit, clamp(lining * 1.6 + (cn - 0.5) * 0.6, 0.0, 1.0));
          c = mix(c, cc, cloudA * 0.82);
        }` : ''}
        // the moon
        float r = 0.043;
        float ma = acos(clamp(md, -1.0, 1.0));
        if (ma < r * 1.3) {
          vec3 tx = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
          vec3 ty = cross(tx, uMoonDir);
          vec2 q = vec2(dot(d, tx), dot(d, ty)) / r;
          float rr = dot(q, q);
          float disc = 1.0 - smoothstep(0.93, 1.0, sqrt(rr));
          float z = sqrt(max(1.0 - rr, 0.0));
          float maria = fbm3(q * 0.17 + vec2(0.37, 0.71));
          vec3 mc = uMoonDisc * (0.8 + 0.2 * z) * (1.0 - smoothstep(0.5, 0.72, maria) * 0.2);
          c = mix(c, mc, disc * (1.0 - cloudA * 0.6));
        }
        float starVis = smoothstep(0.0, 0.1, eh) * (1.0 - cloudA) * (1.0 - smoothstep(0.97, 0.9995, md));
        gl_FragColor = vec4(tone(c), 1.0 - starVis);
        #include <colorspace_fragment>
      }`, {
      ...su,
      uMWN: { value: MW_N }, uMWX: { value: MW_X }, uMWBulge: { value: MW_BULGE },
      uMWA: { value: C('#5a66b8') }, uMWB: { value: C('#3f8fc4') }, uMWC: { value: C('#c4aed4') },
      uCloudDark: { value: C('#1e2a52') }, uCloudLit: { value: C('#9fb4dd') }, uMoonDisc: { value: C('#fff6e0').multiplyScalar(2.2) },
    }, {
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    });
    const sky = new THREE.Mesh(g, mat);
    sky.frustumCulled = false;
    sky.renderOrder = 1;
    sky.name = 'sky';
    sky.onBeforeRender = (r, s, cam) => { su.uInvProj.value.copy(cam.projectionMatrixInverse); su.uCamWorld.value.copy(cam.matrixWorld); };
    scene.add(sky);
  }

  // ----- stars -----
  const stars = (() => {
    const N = HI ? 12000 : 4500, rnd = mulberry(1234);
    const pos = new Float32Array(N * 3), size = new Float32Array(N), colr = new Float32Array(N * 3), seed = new Float32Array(N);
    const tint = [C('#cfe0ff'), C('#ffffff'), C('#ffe6c4'), C('#b9cdff'), C('#ffd2b0')];
    const mwY = new THREE.Vector3().crossVectors(MW_N, MW_X);
    const d = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      if (rnd() < 0.4) {          // along the Milky Way
        const a = rnd() * TAU, b = (rnd() + rnd() + rnd() - 1.5) * 0.16;
        d.copy(MW_X).multiplyScalar(Math.cos(a)).addScaledVector(mwY, Math.sin(a)).multiplyScalar(Math.sqrt(1 - b * b)).addScaledVector(MW_N, b).normalize();
      } else {
        const u = rnd() * 2 - 1, a = rnd() * TAU;
        d.set(Math.sqrt(1 - u * u) * Math.cos(a), u, Math.sqrt(1 - u * u) * Math.sin(a));
      }
      if (d.y < -0.03) d.y = -d.y;
      d.normalize();
      pos[i * 3] = d.x * 7000; pos[i * 3 + 1] = d.y * 7000; pos[i * 3 + 2] = d.z * 7000;
      const m = Math.pow(rnd(), 7);
      const bright = rnd() < 0.005;
      size[i] = bright ? 8 + rnd() * 6 : 1.7 + m * 3.6;
      const c = tint[Math.floor(rnd() * tint.length)];
      const inten = bright ? 1.8 : 0.4 + m * 1.6 + rnd() * 0.35;
      colr[i * 3] = c.r * inten; colr[i * 3 + 1] = c.g * inten; colr[i * 3 + 2] = c.b * inten;
      seed[i] = rnd();
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(colr, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = shader(/* glsl */`
      attribute float aSize; attribute vec3 aCol; attribute float aSeed;
      uniform float uPx;
      varying vec3 vC; varying float vS;
      uniform float uTime; uniform vec3 uMoonDir;
      void main() {
        vec3 d = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        float tw = 0.62 + 0.38 * sin(uTime * (1.0 + aSeed * 3.4) + aSeed * 71.0) * sin(uTime * (0.37 + aSeed) + aSeed * 13.0);
        tw = mix(1.0, tw, 0.55 + 0.45 * (1.0 - smoothstep(0.0, 0.5, d.y)));
        float moon = 1.0 - 0.9 * smoothstep(0.9, 0.995, dot(d, uMoonDir));
        vC = aCol * tw * moon * smoothstep(-0.01, 0.12, d.y);
        vS = aSize;
        gl_PointSize = aSize * uPx;
      }`.replace('uniform float uTime; uniform vec3 uMoonDir;', ''), /* glsl */`
      varying vec3 vC; varying float vS;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p, p);
        float k = vS > 6.0 ? 14.0 : 5.0;
        float core = exp(-r2 * k);
        float halo = vS > 6.0 ? exp(-r2 * 3.0) * 0.22 : 0.0;
        float spikes = vS > 6.0 ? (exp(-abs(p.x) * 30.0) + exp(-abs(p.y) * 30.0)) * max(0.0, 1.0 - sqrt(r2)) * 0.55 : 0.0;
        gl_FragColor = vec4(vC * (core + halo + spikes) * (1.0 - smoothstep(0.75, 1.0, sqrt(r2))), 1.0);
        #include <colorspace_fragment>
      }`, { uPx: { value: 1 } }, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 0;
    pts.name = 'stars';
    scene.add(pts);
    return pts;
  })();

  // ----- the town across the bay -----
  const townPts = [];
  {
    const rnd = mulberry(77);
    const ax = ARM.ax, az = ARM.az, bx = ARM.bx, bz = ARM.bz;
    const dirx = bx - ax, dirz = bz - az, L = Math.hypot(dirx, dirz);
    const tx = dirx / L, tz = dirz / L;          // along the arm (northwards)
    const nx = -tz, nz = tx;                     // across it, toward the bay (east)
    const coastAt = t => {
      // walk east from the arm's centre line until we reach the water
      const cx = ax + dirx * t, cz = az + dirz * t;
      let s = 0; for (; s < 400; s += 2) { if (terrainHeight(cx + nx * s, cz + nz * s) < 0.2) break; }
      return [cx + nx * s, cz + nz * s];
    };
    const warm = ['#ffcf7a', '#ffb65e', '#ffe2a6', '#ffd38f', '#fff0cc', '#ff9f5a'];
    const add = (x, z, yOff, col, size, inten, blink = 0) => {
      const h = Math.max(heightAt(x, z), 0.4);
      townPts.push({ x, y: h + yOff, z, col: C(col), size, inten, blink });
    };
    const cluster = (t0, t1, count, inMin, inMax, yMin, yMax) => {
      for (let i = 0; i < count; i++) {
        const t = t0 + (t1 - t0) * Math.pow(rnd(), 0.9);
        const [cx, cz] = coastAt(t);
        const inl = inMin + (inMax - inMin) * Math.pow(rnd(), 1.6);
        const x = cx - nx * inl + tx * (rnd() - 0.5) * 30, z = cz - nz * inl + tz * (rnd() - 0.5) * 30;
        add(x, z, yMin + rnd() * (yMax - yMin), warm[Math.floor(rnd() * warm.length)], 2.2 + rnd() * 2.2, 0.5 + rnd() * 0.9);
      }
    };
    const n = HI ? 1 : 0.45;
    cluster(0.12, 0.36, 260 * n, 4, 40, 1.5, 9);      // the harbor town
    cluster(0.3, 0.6, 120 * n, 4, 30, 1.5, 6);       // further up the shore
    cluster(0.08, 0.5, 90 * n, 40, 200, 1.0, 4);      // houses on the hillside
    for (let t = 0.04; t < 0.62; t += 0.0085) {     // the shore road
      const [cx, cz] = coastAt(t);
      add(cx - nx * 7, cz - nz * 7, 4.5, '#ffbe6b', 2.6, 0.9);
    }
    // harbor entrance lights (red and green, slow flash) and a radio mast
    const [hx, hz] = coastAt(0.22);
    townPts.push({ x: hx + nx * 70, y: 6, z: hz + nz * 70 + 40, col: C('#ff4a3a'), size: 3.8, inten: 2.0, blink: 0.25 });
    townPts.push({ x: hx + nx * 75, y: 6, z: hz + nz * 75 - 45, col: C('#4dff8a'), size: 3.8, inten: 1.8, blink: 0.2 });
    const [mx, mz] = coastAt(0.3);
    add(mx - nx * 230, mz - nz * 230, 55, '#ff3a30', 3.4, 2.0, 0.5);
    // a few farms along the bay's south shore
    for (let i = 0; i < 26 * n; i++) {
      const x = -380 + rnd() * 330, z = 200 + rnd() * 140;
      if (heightAt(x, z) < 1) continue;
      add(x, z, 2.5, warm[Math.floor(rnd() * warm.length)], 2.2 + rnd() * 1.5, 0.5 + rnd() * 0.6);
    }
    const N = townPts.length;
    const pos = new Float32Array(N * 3), colr = new Float32Array(N * 3), size = new Float32Array(N), blink = new Float32Array(N), seed = new Float32Array(N);
    townPts.forEach((p, i) => {
      pos.set([p.x, p.y, p.z], i * 3);
      colr.set([p.col.r * p.inten, p.col.g * p.inten, p.col.b * p.inten], i * 3);
      size[i] = p.size; blink[i] = p.blink; seed[i] = rnd();
    });
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(colr, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aBlink', new THREE.BufferAttribute(blink, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = shader(/* glsl */`
      attribute vec3 aCol; attribute float aSize; attribute float aBlink; attribute float aSeed;
      uniform float uPx;
      varying vec3 vC;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        float shimmer = 0.85 + 0.15 * sin(uTime * (2.0 + aSeed * 5.0) + aSeed * 40.0);
        float bl = aBlink > 0.0 ? smoothstep(0.55, 0.8, sin(uTime * aBlink * 6.2831 + aSeed * 6.0) * 0.5 + 0.5) : 1.0;
        float haze = exp(-d * 0.0007);
        vC = aCol * shimmer * bl * (0.45 + 0.55 * haze);
        gl_PointSize = clamp(aSize * uPx * (0.7 + 260.0 / max(d, 60.0)), 1.0, 40.0);
      }`, /* glsl */`
      varying vec3 vC;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0; float r2 = dot(p, p);
        gl_FragColor = vec4(vC * (exp(-r2 * 9.0) * 1.3 + exp(-r2 * 2.5) * 0.25) * (1.0 - smoothstep(0.7, 1.0, sqrt(r2))), 1.0);
        #include <colorspace_fragment>
      }`, { uPx: { value: 1 } }, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const town = new THREE.Points(g, mat);
    town.frustumCulled = false;
    town.renderOrder = 6;
    town.name = 'town';
    scene.add(town);
    townMat = mat;
  }

  // ----- far mountains: layered silhouettes that fade into the haze -----
  {
    const P = [], idx = [];
    for (const [b0, b1, seed] of [[-132, -10, 3], [100, 232, 9]]) {
      const n = HI ? 220 : 110, start = P.length / 3;
      for (let i = 0; i <= n; i++) {
        const b = b0 + (b1 - b0) * i / n, br = b * Math.PI / 180;
        const R = 5600 + 900 * fbm(b * 0.03, seed, 2, 5);
        const edge = Math.min(1, (i / n) * 5, (1 - i / n) * 5);
        const h = (160 + 560 * Math.pow(fbm(b * 0.07, seed + 1.7, 4, 12), 1.6) + 70 * vnoise(b * 0.6, seed, 13)) * Math.pow(edge, 0.6) - 30 * (1 - edge);
        P.push(Math.sin(br) * R, h, -Math.cos(br) * R, Math.sin(br) * R, -40, -Math.cos(br) * R);
        if (i < n) { const a = start + i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
      }
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setIndex(idx);
    const mat = shader(/* glsl */`
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, /* glsl */`
      uniform vec3 uFarMtn;
      varying vec3 vW;
      void main() {
        vec3 dir = normalize(vW - cameraPosition);
        vec3 sky = skyGrad(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.3 + 0.012, dir.z)));
        float hf = clamp(vW.y / 650.0, 0.0, 1.0);
        vec3 col = mix(sky * 0.92, uFarMtn, 0.25 + 0.35 * hf);
        gl_FragColor = vec4(tone(col), 1.0);
        #include <colorspace_fragment>
      }`, { uFarMtn: { value: C('#14244f') } }, { side: THREE.DoubleSide });
    const mtn = new THREE.Mesh(g, mat);
    mtn.frustumCulled = false;
    mtn.name = 'far-mountains';
    scene.add(mtn);
  }

  // reflections in the sea: the pier lamp, harbor lights and the brightest shore lights
  {
    const { lightPos, lightCol, NL } = seaLights;
    const cand = townPts.filter(p => p.y < 9).sort((a, b) => (b.inten * b.size) - (a.inten * a.size));
    const picks = [];
    picks.push({ x: U.uLampPos.value.x, y: U.uLampPos.value.y, z: U.uLampPos.value.z, col: C('#ffb15c'), inten: 1.6 });
    for (const p of townPts) if (p.blink > 0 && p.y < 10) picks.push(p);
    for (const p of cand) { if (picks.length >= NL) break; if (picks.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 25)) continue; picks.push(p); }
    picks.slice(0, NL).forEach((p, i) => { lightPos[i].set(p.x, p.y, p.z, p.inten * (p.blink ? 0.6 : 1)); lightCol[i].set(p.col.r, p.col.g, p.col.b).multiplyScalar(0.9); });
  }

  // ----- grass -----
  {
    const N = HI ? 70000 : 16000, rnd = mulberry(4242);
    const off = new Float32Array(N * 3), prm = new Float32Array(N * 4);
    let n = 0;
    const centers = [[CLIFF.x, CLIFF.z, 34, 0.45], [0, 0, 26, 0.25], [-8, 30, 60, 0.3]];
    for (let tries = 0; tries < N * 6 && n < N; tries++) {
      const c = centers[rnd() < 0.45 ? 0 : rnd() < 0.45 ? 1 : 2];
      const a = rnd() * TAU, r = c[2] * Math.sqrt(rnd());
      const x = c[0] + Math.cos(a) * r, z = c[1] + Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h < 1.6) continue;
      if (headlandSD(x, z) > -0.8) continue;
      if (groundNormalY(x, z) < 0.72) continue;
      const pd = distToPath(x, z);
      if (pd < 0.95 + rnd() * 0.3) continue;
      const tr = Math.hypot(x, z);
      if (tr < 3.4) continue;
      if (Math.abs(x) < 1.5 && z > 2 && z < 5.6) continue;
      if (Math.abs(x) < 1.6 && z > 2 && z < 6.4) continue;
      if (Math.abs(tr - 9.2) < 0.3) continue;
      const nearPath = pd < 2.2 ? 0.75 : 1;
      const tuft = vnoise(x * 0.35, z * 0.35, 61);
      const tall = (0.22 + Math.pow(rnd(), 1.6) * 0.45) * (0.7 + tuft * 0.75) + (tr > 9.5 && tr < 10.4 ? 0.15 : 0);
      off[n * 3] = x; off[n * 3 + 1] = h - 0.04; off[n * 3 + 2] = z;
      prm[n * 4] = tall * nearPath; prm[n * 4 + 1] = 0.022 + rnd() * 0.028; prm[n * 4 + 2] = rnd() * TAU; prm[n * 4 + 3] = rnd();
      n++;
    }
    const blade = new THREE.InstancedBufferGeometry();
    const bp = [-1, 0, 0, 1, 0, 0, -0.85, 0.33, 0, 0.85, 0.33, 0, -0.55, 0.66, 0, 0.55, 0.66, 0, 0, 1, 0];
    blade.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
    blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
    blade.setAttribute('aOff', new THREE.InstancedBufferAttribute(off.subarray(0, n * 3), 3));
    blade.setAttribute('aP', new THREE.InstancedBufferAttribute(prm.subarray(0, n * 4), 4));
    blade.instanceCount = n;
    keep(blade);
    const mat = shader(/* glsl */`
      attribute vec3 aOff; attribute vec4 aP;
      varying vec3 vW; varying float vT; varying float vR; varying vec3 vN;
      void main() {
        float lod = 1.0 - smoothstep(${HI ? '50.0, 85.0' : '30.0, 55.0'}, distance(aOff, cameraPosition));   // far blades fade into the ground colour
        float h = aP.x * lod, w = aP.y * lod, yaw = aP.z;
        float t = position.y;
        vec2 gust = vec2(texture2D(uNoise, aOff.xz * 0.012 + vec2(uTime * 0.03, uTime * 0.011)).r - 0.45, 0.0);
        float sway = sin(uTime * 1.7 + aOff.x * 0.37 + aOff.z * 0.21 + aP.w * 3.0) * 0.18 + sin(uTime * 3.1 + aOff.x * 1.3 + aP.w * 7.0) * 0.06;
        float lean = 0.12 + aP.w * 0.3;
        float bend = (lean + sway + gust.x * 1.4) * t * t;
        vec2 cs = vec2(cos(yaw), sin(yaw));
        float wd = w * (1.0 - t * 0.9);
        vec3 p = vec3(position.x * wd * cs.x, t * h, position.x * wd * cs.y);
        vec2 wind = normalize(vec2(0.8, 0.45));
        p.xz += (wind * 0.75 + cs.yx * vec2(-1.0, 1.0) * 0.25) * bend * h;
        p.y -= bend * bend * h * 0.25;
        vec3 wp = aOff + p;
        vW = wp; vT = t; vR = aP.w;
        vN = normalize(vec3(-cs.y, 0.6, cs.x));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`, /* glsl */`
      uniform vec3 uBase; uniform vec3 uTip; uniform vec3 uTip2; uniform vec3 uFlower;
      varying vec3 vW; varying float vT; varying float vR; varying vec3 vN;
      void main() {
        vec3 n = normalize(gl_FrontFacing ? vN : -vN);
        n = normalize(n + vec3(0.0, 0.8, 0.0));
        float pat = texture2D(uNoise, vW.xz * 0.03).g;
        vec3 tip = mix(uTip, uTip2, smoothstep(0.35, 0.75, pat)) * (0.7 + 0.6 * vR);
        vec3 alb = mix(uBase, tip, smoothstep(0.0, 1.0, vT));
        if (vR > 0.975 && vT > 0.85) alb = uFlower * (0.8 + vR * 0.3);
        float sh = towerShadow(vW);
        vec3 col = litToon(alb, n, vW, sh, 0.0, 0.0);
        vec3 V = normalize(cameraPosition - vW);
        float back = pow(clamp(dot(-V, uMoonDir), 0.0, 1.0), 4.0);
        float near = 1.0 - smoothstep(18.0, 60.0, length(vW - cameraPosition));
        col += tip * uMoonCol * pow(vT, 2.0) * (0.12 + back * 1.1) * sh * (0.3 + 0.7 * near);
        col *= 0.45 + 0.55 * vT;
        gl_FragColor = vec4(tone(atmos(col, vW)), 1.0);
        #include <colorspace_fragment>
      }`, { uBase: { value: C('#061517') }, uTip: { value: C('#2f7a58') }, uTip2: { value: C('#4f8a5e') }, uFlower: { value: C('#e6c3e8') } }, { side: THREE.DoubleSide });
    const grass = new THREE.Mesh(blade, mat);
    grass.frustumCulled = false;
    grass.name = 'grass';
    scene.add(grass);
  }

  // ----- mist banks drifting at the foot of the cliffs -----
  {
    const rnd = mulberry(555), puffs = [];
    for (let tries = 0; tries < 3000 && puffs.length < (HI ? 34 : 16); tries++) {
      const x = -110 + rnd() * 190, z = -90 + rnd() * 190;
      const sd = headlandSD(x, z);
      if (sd < 6 || sd > 40) continue;
      if (Math.hypot(x - PIER_X1, z - PIER_Z) < 14) continue;
      puffs.push([x, 1.5 + rnd() * 3.5, z, 18 + rnd() * 22, rnd()]);
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('aPuff', new THREE.InstancedBufferAttribute(new Float32Array(puffs.flatMap(p => p.slice(0, 4))), 4));
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(puffs.map(p => p[4])), 1));
    g.instanceCount = puffs.length;
    keep(g);
    const mat = shader(/* glsl */`
      attribute vec4 aPuff; attribute float aSeed;
      varying vec2 vUv; varying float vA; varying vec3 vW; varying float vSeed;
      void main() {
        vec3 c = aPuff.xyz;
        c.x += sin(uTime * 0.021 + aSeed * 30.0) * 9.0 + uTime * 0.25 * (aSeed - 0.3);
        c.z += cos(uTime * 0.017 + aSeed * 20.0) * 7.0;
        vec4 mv = viewMatrix * vec4(c, 1.0);
        float s = aPuff.w;
        mv.xy += position.xy * vec2(s * 1.6, s * 0.42);
        vUv = position.xy * 0.5 + 0.5;
        vSeed = aSeed;
        float d = -mv.z;
        vA = smoothstep(6.0, 30.0, d) * (0.6 + 0.4 * sin(uTime * 0.05 + aSeed * 9.0));
        vW = (inverse(viewMatrix) * mv).xyz;
        gl_Position = projectionMatrix * mv;
      }`, /* glsl */`
      varying vec2 vUv; varying float vA; varying vec3 vW; varying float vSeed;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float shape = (1.0 - smoothstep(0.2, 1.0, length(p * vec2(1.0, 1.25))));
        float n = fbm3(vUv * vec2(0.9, 0.35) + vec2(vSeed * 7.0 + uTime * 0.004, vSeed * 3.0));
        float a = shape * smoothstep(0.32, 0.8, n) * vA * 0.42;
        a *= smoothstep(-0.6, 1.2, vW.y);
        vec3 col = uMistCol * (0.75 + 0.5 * n) + uMoonCol * 0.08 * smoothstep(0.0, 1.0, p.y + 0.5);
        gl_FragColor = vec4(tone(atmos(col, vW) * 0.5 + col * 0.5), a);
        #include <colorspace_fragment>
      }`, {}, { transparent: true, depthWrite: false });
    const mist = new THREE.Mesh(g, mat);
    mist.frustumCulled = false;
    mist.renderOrder = 8;
    mist.name = 'mist';
    scene.add(mist);
  }

  // ----- fireflies and the pier lamp's glow -----
  const flies = (() => {
    const N = HI ? 46 : 20, rnd = mulberry(888);
    const pos = [], seed = [], size = [], col = [];
    const spots = [[7, 27, 9], [-3, 13, 9], [PIER_X0 + 5, PIER_Z - 5, 8]];
    for (let i = 0; i < N; i++) {
      const s = spots[i % spots.length];
      const x = s[0] + (rnd() - 0.5) * s[2] * 2, z = s[1] + (rnd() - 0.5) * s[2] * 2;
      pos.push(x, heightAt(x, z) + 0.4 + rnd() * 1.6, z); seed.push(rnd()); size.push(5 + rnd() * 5); col.push(0.75, 1.0, 0.45);
    }
    // the pier lamp's halo is just a big soft "firefly"
    const L = U.uLampPos.value;
    pos.push(L.x, L.y, L.z); seed.push(-1); size.push(150); col.push(1.0, 0.62, 0.3);
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
    const mat = shader(/* glsl */`
      attribute float aSeed; attribute float aSize; attribute vec3 aCol;
      uniform float uPx;
      varying vec3 vC; varying float vLamp;
      void main() {
        vec3 p = position;
        float lamp = aSeed < 0.0 ? 1.0 : 0.0;
        if (lamp < 0.5) {
          p += vec3(sin(uTime * 0.31 + aSeed * 40.0) * 1.6, sin(uTime * 0.53 + aSeed * 17.0) * 0.45, cos(uTime * 0.27 + aSeed * 23.0) * 1.6);
        }
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float blink = lamp > 0.5 ? 0.92 + 0.08 * sin(uTime * 13.0) * sin(uTime * 7.3) : 0.15 + 0.85 * pow(max(sin(uTime * (0.6 + aSeed) + aSeed * 30.0), 0.0), 2.0);
        vC = aCol * blink;
        vLamp = lamp;
        gl_PointSize = lamp > 0.5 ? clamp(aSize * uPx * 24.0 / max(-mv.z, 1.0), 6.0, 420.0) : clamp(aSize * uPx * 18.0 / max(-mv.z, 1.0), 2.0, 48.0);
      }`, /* glsl */`
      varying vec3 vC; varying float vLamp;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0; float r2 = dot(p, p);
        float a = vLamp > 0.5 ? exp(-r2 * 4.0) * 0.32 + exp(-r2 * 22.0) * 0.6 + exp(-r2 * 140.0) * 1.2 : exp(-r2 * 30.0) * 2.2 + exp(-r2 * 5.0) * 0.35;
        gl_FragColor = vec4(vC * a * (1.0 - smoothstep(0.7, 1.0, sqrt(r2))), 1.0);
        #include <colorspace_fragment>
      }`, { uPx: { value: 1 } }, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 9;
    pts.name = 'fireflies';
    scene.add(pts);
    return pts;
  })();

  // ----- lights for 3D actors (standard materials) -----
  scene.add(new THREE.HemisphereLight(0x5a76c0, 0x141a2c, 1.1));
  const moonLight = new THREE.DirectionalLight(0xc8d4f0, 1.7);
  moonLight.position.copy(MOON).multiplyScalar(100);
  scene.add(moonLight, moonLight.target);
  const lampLight = new THREE.PointLight(0xffa850, 6, 14, 2);
  lampLight.position.copy(U.uLampPos.value);
  scene.add(lampLight);

  // ----- marks -----
  const lampY = BASE_Y + 13.18;
  const cliffGround = heightAt(CLIFF.x, CLIFF.z);
  marks.lamp = { position: [0, lampY, 0], look: [MOON.x * 300, lampY + 16, MOON.z * 300] };
  marks.cliff = { position: [CLIFF.x, cliffGround + 1.6, CLIFF.z], look: [0, lampY, 0], fov: 45 };
  marks.door = { position: [1.6, BASE_Y + 1.45, 15.5], look: [0, lampY, 0], fov: 60 };
  marks.pier = { position: [PIER_X1 + 1.2, 1.55 + 1.6, PIER_Z + 0.35], look: [0, lampY, 0], fov: 50 };
  marks.sea = { position: [-118, 3.2, -150], look: [0, BASE_Y + 6, 0] };

  // default view (used when the game does not name a start mark): the cliff
  camera.position.set(...marks.cliff.position);
  camera.lookAt(0, lampY, 0);

  // ----- animation -----
  const px = new THREE.Vector2();
  const pxMats = [stars.material, flies.material, townMat];
  onUpdate((dt, t) => {
    U.uTime.value = t;
    stars.position.copy(camera.position);
    renderer.getDrawingBufferSize(px);
    const s = px.y / 1080;
    for (const m of pxMats) m.uniforms.uPx.value = s;
    const flick = 0.93 + 0.05 * Math.sin(t * 11.3) * Math.sin(t * 4.1) + 0.02 * Math.sin(t * 23.0);
    U.uLampCol.value.setRGB(1.0 * flick, 0.42 * flick, 0.11 * flick);
    lampLight.intensity = 6 * flick;
  });

  // What you can stand on: the ground, the pier deck, or the sea surface.
  const standAt = (x, z) => {
    let h = Math.max(heightAt(x, z), 0);
    if (x <= PIER_X0 + 0.2 && x >= PIER_X1 - 0.2 && Math.abs(z - PIER_Z) < 1.25) h = Math.max(h, 1.59);
    return h;
  };

  return {
    heightAt: standAt,
    dispose() { for (const d of disposables) d.dispose && d.dispose(); },
  };
}
