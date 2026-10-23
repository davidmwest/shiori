// All the Terrible Things We Didn't Think — the Glasshouse (Chapter 2).
//
// A long Victorian glasshouse on the summit of Glass Hill on a sunny Sunday
// afternoon: a pitched glass roof on thin iron ribs, glass walls over a brick
// knee wall, a worn brick aisle, and from every rafter thousands of threads of
// glass beads, so the sunlight comes through in colours. The Heart hangs from
// the great central girder; the first Keeper stands at the far end in green
// light, holding her hands out to it. Everything is procedural.
//
// Marks: door, aisle, amber, heart, statue, roof.
//
// World module contract (SHIORI-Spec §4.4):
//   export default function build({ THREE, scene, camera, renderer, marks, onUpdate, quality })
// Returns { heightAt(x, z), dispose() }.

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Deterministic noise (CPU side, for placement)

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
// The building (metres, y up; the hall runs along z with the door at +z)

const HW = 4.0;              // half width, inside face of the glass
const ZN = 14.4;             // near gable, the double door
const ZF = -15.6;            // far gable
const KNEE = 0.6;            // brick knee wall
const EAVE = 4.3;
const RIDGE = 6.3;
const SLOPE = (RIDGE - EAVE) / HW;
const RIB = 1.2;             // rib spacing; a rib stands at z = 0 under the Heart
const NRIB = Math.round((ZN - ZF) / RIB);
const AISLE = 0.85;          // half width of the brick aisle
const CROSS = 1.25;          // half width of the cross aisle under the Heart
const BENCH_IN = 1.0, BENCH_OUT = 2.3, BENCH_Y = 0.85;
const GIRDER_Y = 4.0;        // underside of the great central girder
const roofY = x => RIDGE - SLOPE * Math.abs(x);        // the glass
const roofIn = x => roofY(x) - 0.13;                   // underside of the rafters, where threads hang
const HEART = [0, 3.6, 0];
const HEART_R = 0.2;
const STATUE_Z = -12.5;
const AMBER = { x: -3.0, y: 0.93, z: 11.05, n: 5, dx: 0.345 };

// The roof shot orbits +40° round the Heart (`@camera orbit=40`), so the roof mark
// stands 20° to the left of the hall's axis and the orbit ends 20° to the right:
// the whole move stays under the glass.
const ROOF_R = 4.2, ROOF_Y = 5.2, ROOF_A = -20 * DEG, ORBIT = 40 * DEG;
const MARKS = {
  door: { position: [0, 1.6, 13], look: [0, 2.6, 0] },
  aisle: { position: [0.6, 1.6, 4], look: [0, 2.8, 0] },
  amber: { position: [-3.0, 1.08, 11.05] },
  heart: { position: HEART.slice() },
  statue: { position: [0, 1.4, STATUE_Z] },
  roof: { position: [ROOF_R * Math.sin(ROOF_A), ROOF_Y, ROOF_R * Math.cos(ROOF_A)], look: [0, 3.2, 0], fov: 54 },
};

// Suzu's figure, D E F# A B … E: four quarter notes, a dotted half, then the fall (≈76 bpm).
const NOTE_AT = [0, 0.79, 1.58, 2.37, 3.16, 5.53];

// ---------------------------------------------------------------------------
// Shared GLSL

const glsl = (NB) => /* glsl */`
#define NB ${NB}
#define HW ${HW.toFixed(3)}
#define ZN ${ZN.toFixed(3)}
#define ZF ${ZF.toFixed(3)}
#define RIB ${RIB.toFixed(3)}
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uSkyAmb;
uniform vec3 uGndAmb;
uniform vec4 uBeam[NB];
uniform vec2 uBeamK[NB];
uniform vec3 uHeartPos;
uniform float uHeartPulse;
uniform vec3 uHeartCol;
uniform vec3 uGreenPos;
uniform vec3 uGreenCol;
uniform vec3 uPal[8];
uniform vec4 uWake;
uniform vec3 uWakeDir;
uniform float uNoteT[6];
uniform sampler2D uNoise;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float tn(vec2 p) { return texture2D(uNoise, p).r; }
vec3 pal(float h) { return uPal[int(clamp(h, 0.0, 0.999) * 8.0)]; }
bool inHall(vec3 p) { return abs(p.x) < HW + 0.05 && p.z < ZN + 0.05 && p.z > ZF - 0.05 && p.y < 6.4; }

// Sun shafts: Gaussian beams entering through the roof or the walls.
float beams(vec3 p) {
  vec3 D = -uSun;
  float s = 0.0;
  for (int i = 0; i < NB; i++) {
    vec3 v = p - uBeam[i].xyz;
    float a = dot(v, D);
    vec3 q = v - a * D;
    float w = uBeam[i].w;
    s += uBeamK[i].x * (1.0 - smoothstep(0.5, 1.0, length(q) / w)) * smoothstep(-0.3, 0.2, a) * (1.0 - smoothstep(uBeamK[i].y - 0.05, uBeamK[i].y + 0.3, a));
  }
  return s;
}

// How much direct sun reaches p: dappled by the bead curtains, striped by the ribs.
float sunVis(vec3 p) {
  if (!inHall(p)) return 1.0;
  vec2 q = p.xz + uSun.xz * ((5.6 - p.y) / uSun.y);
  float curtain = smoothstep(4.8, 3.0, p.y);
  float n = tn(q * 0.06 + vec2(uTime * 0.0012, 0.0)) * 0.6 + tn(q * 0.21 + vec2(0.0, uTime * 0.0017)) * 0.4;
  float side = smoothstep(0.7, 1.4, abs(q.x));
  float vis = mix(1.0, smoothstep(0.28, 0.72, n), curtain * mix(0.45, 0.82, side));
  float rz = abs(fract((q.y - ZF) / RIB + 0.5) - 0.5) * RIB;
  vis *= mix(0.45, 1.0, smoothstep(0.03, 0.075, rz));
  float px = abs(fract(abs(q.x) / 1.333 + 0.5) - 0.5) * 1.333;
  vis *= mix(0.65, 1.0, smoothstep(0.015, 0.04, px));
  return vis;
}

// Coloured caustics: the beads overhead focus the sun into little coloured spots.
vec3 caustics(vec3 p, float fw) {
  vec2 q = p.xz + uSun.xz * ((2.9 - p.y) / uSun.y);
  float dens = mix(0.42, 0.92, smoothstep(0.8, 1.4, abs(q.x))) * (1.0 - smoothstep(HW - 0.2, HW + 0.3, abs(q.x)));
  vec3 acc = vec3(0.0);
  for (int L = 0; L < 2; L++) {
    float sc = L == 0 ? 0.16 : 0.09;
    vec2 g = q / sc + float(L) * 7.31;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float ph = hash12(id + 3.7);
    vec2 o = (hash22(id) - 0.5) * 0.32 + 0.06 * vec2(sin(uTime * (0.5 + ph) + ph * 30.0), cos(uTime * (0.4 + ph) + ph * 20.0));
    float d = length(f - o);
    float on = step(1.0 - dens, hash12(id + 11.3));
    vec3 c = pal(hash12(id * 1.73 + 5.1));
    vec3 pat = on * (c * smoothstep(0.3, 0.08, d) * 0.9 + vec3(1.0, 0.95, 0.8) * smoothstep(0.08, 0.0, d) * 0.9);
    float lod = clamp(1.0 - fw / (sc * 0.4), 0.0, 1.0);
    acc += mix(vec3(0.16, 0.13, 0.15) * dens, pat, lod);
  }
  return acc;
}

vec3 shade(vec3 alb, vec3 n, vec3 p, float fw, float cK) {
  bool inside = inHall(p);
  float ndl = dot(n, uSun);
  float dif = smoothstep(-0.02, 0.38, ndl);
  float vis = sunVis(p);
  float bm = inside ? beams(p) : 0.0;
  float hemi = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 amb = mix(uGndAmb, uSkyAmb, hemi) * (inside ? 1.0 : 1.35);
  vec3 c = alb * (amb + uSunCol * dif * (vis + bm * 1.7));
  if (inside && cK > 0.0) c += (alb * 0.75 + 0.14) * caustics(p, fw) * (0.3 + 0.7 * dif) * (0.3 + vis * 0.6 + bm * 2.0) * cK;
  vec3 hv = uHeartPos - p; float hd2 = dot(hv, hv);
  c += alb * uHeartCol * (uHeartPulse * 0.9 + 0.1) * (0.3 + 0.7 * max(dot(n, hv * inversesqrt(hd2 + 1e-4)), 0.0)) / (1.0 + hd2 * 1.6);
  vec3 gv = uGreenPos - p; float gd2 = dot(gv, gv);
  c += alb * uGreenCol * (0.35 + 0.65 * max(dot(n, gv * inversesqrt(gd2 + 1e-4)), 0.0)) / (1.0 + gd2 * 0.08);
  return c;
}

vec3 tone(vec3 c) {
  vec3 x = max(c, 0.0);
  return mix(x, 1.0 - 0.38 * exp(-(x - 0.62) / 0.38), step(0.62, x));
}

// Threads swing like pendulums: a slow wave runs down the hall as if someone had
// just walked past, the camera stirs the air, and the threads Suzu plays ring.
vec2 swayAng(vec3 top, float ph, float L, float play) {
  float w = sqrt(9.81 / max(L, 0.3));
  float wave = 0.5 + 0.5 * sin(top.z * 0.37 - uTime * 0.42 + ph * 1.3);
  float amp = 0.004 + 0.011 * wave * wave;
  vec2 a = amp * vec2(sin(uTime * w + ph * 6.2832), 0.6 * sin(uTime * w * 0.93 + ph * 17.0 + 1.3));
  vec2 dxz = top.xz - uWake.xz;
  float wk = uWake.w * exp(-dot(dxz, dxz) * 0.45);
  a += wk * uWakeDir.xz * (0.5 + 0.5 * sin(uTime * w * 1.1 + ph * 9.0));
  if (play > -0.5) {
    float t = uNoteT[int(play + 0.5)];
    if (t >= 0.0) a.x += 0.06 * exp(-t * 0.8) * sin(t * w * 1.25);
  }
  return a;
}
vec3 hangPos(vec3 top, float depth, vec2 a) { return top + vec3(a.x * depth, -depth, a.y * depth); }
float noteFlash(float play, float depth) {
  if (play < -0.5) return 0.0;
  float t = uNoteT[int(play + 0.5)];
  if (t < 0.0) return 0.0;
  float front = t * 2.4;
  return exp(-t * 1.1) * (0.45 + 1.2 * exp(-(depth - front) * (depth - front) * 9.0));
}
`;

const STD_VERT = /* glsl */`
attribute vec3 aCol;
attribute vec3 aK;
varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec3 vK;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = aCol; vK = aK;
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
  camera.fov = 50; camera.near = 0.04; camera.far = 2000;
  camera.updateProjectionMatrix();

  const SUN = V3(-0.52, 0.74, 0.42).normalize();
  const PAL = ['#ff4d6d', '#3f6dff', '#2fc59a', '#ffc23e', '#a66bff', '#ff7fc4', '#46d9ff', '#c4b2e8'].map(C);

  // ----- sun shafts: where they land, how wide, how bright -----
  const BEAM_DEF = [
    [[-3.0, 1.0, 11.05], 0.6, 1.25],    // the amber shelf
    [[-1.75, 0.86, -6.4], 0.34, 1.0],
    [[2.6, 0.0, -3.4], 0.3, 0.9],       // passes just behind the Heart, seen from the door
    [[0.15, 0.0, 9.2], 0.3, 0.85],
    [[1.75, 0.86, 2.6], 0.34, 0.9],
    [[1.2, 0.86, 4.75], 0.2, 0.75],     // beside the aisle mark
    [[2.0, 0.86, -9.1], 0.3, 0.85],
    [[-0.35, 0.0, 5.6], 0.26, 0.75],
    [[-1.65, 0.86, -3.0], 0.3, 0.75],
    [[2.1, 0.86, 7.6], 0.3, 0.8],
    [[-0.2, 0.0, -4.6], 0.26, 0.7],
    [[0.3, 0.0, 1.7], 0.24, 0.7],
  ];
  const NB = HI ? BEAM_DEF.length : 6;
  const entryPoint = F => {
    const p = F.clone();
    for (let i = 0; i < 600; i++) {
      p.addScaledVector(SUN, 0.02);
      if (Math.abs(p.x) > HW || p.y > roofY(p.x) || p.z > ZN || p.z < ZF) break;
    }
    return p;
  };
  const beams = BEAM_DEF.slice(0, NB).map(([f, w, k], i) => {
    const F = V3(...f), O = entryPoint(F);
    return { F, O, w, k, len: O.distanceTo(F), seed: i * 1.731 };
  });

  const U = {
    uTime: { value: 0 },
    uSun: { value: SUN },
    uSunCol: { value: C('#ffe0b0').multiplyScalar(1.2) },
    uSkyAmb: { value: C('#a9bdf0').multiplyScalar(0.5) },
    uGndAmb: { value: C('#d9a37c').multiplyScalar(0.34) },
    uBeam: { value: beams.map(b => new THREE.Vector4(b.O.x, b.O.y, b.O.z, b.w)) },
    uBeamK: { value: beams.map(b => new THREE.Vector2(b.k, b.len)) },
    uHeartPos: { value: V3(...HEART) },
    uHeartPulse: { value: 0 },
    uHeartCol: { value: C('#ff2f4f') },
    uGreenPos: { value: V3(0, 2.0, ZF + 0.6) },
    uGreenCol: { value: C('#5fe8b8').multiplyScalar(0.85) },
    uPal: { value: PAL },
    uWake: { value: new THREE.Vector4(0, 0, 0, 0) },
    uWakeDir: { value: V3(0, 0, 0) },
    uNoteT: { value: new Float32Array([-1, -1, -1, -1, -1, -1]) },
    uNoise: { value: null },
    uPx: { value: 1000 },
    uSunV: { value: V3(0, 1, 0) },
    uFocus: { value: 9 },
    uAper: { value: 0.011 },
    uMinR: { value: 0.75 },
  };
  const COMMON = glsl(NB);
  const shader = (vertex, fragment, extra = {}, opts = {}) => keep(new THREE.ShaderMaterial({
    uniforms: { ...U, ...extra },
    vertexShader: COMMON + vertex,
    fragmentShader: COMMON + fragment,
    ...opts,
  }));

  // ----- tileable noise texture (4 channels) -----
  {
    const N = 256, data = new Uint8Array(N * N * 4);
    const periods = [8, 16, 16, 32];
    for (let c = 0; c < 4; c++) {
      const P = periods[c], vals = new Float32Array(N * N);
      let lo = 1e9, hi = -1e9;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const u = x / N * P, v = y / N * P;
        const n = perlinT(u, v, P, 13 + c * 31) + 0.5 * perlinT(u * 2, v * 2, P * 2, 77 + c * 31);
        vals[y * N + x] = n; lo = Math.min(lo, n); hi = Math.max(hi, n);
      }
      for (let i = 0; i < vals.length; i++) data[i * 4 + c] = Math.round((vals[i] - lo) / (hi - lo) * 255);
    }
    const tex = keep(new THREE.DataTexture(data, N, N, THREE.RGBAFormat));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true; tex.needsUpdate = true;
    U.uNoise.value = tex;
  }

  // ----- geometry merging -----
  function merger() {
    const P = [], N = [], Cc = [], K = [];
    const v = new THREE.Vector3(), n = new THREE.Vector3(), m3 = new THREE.Matrix3(), c = new THREE.Color();
    return {
      add(geo, m, color, k = [0, 0, 0]) {
        const g = geo.index ? geo.toNonIndexed() : geo;
        const pos = g.attributes.position, nor = g.attributes.normal;
        m3.getNormalMatrix(m);
        c.set(color);
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m); P.push(v.x, v.y, v.z);
          n.fromBufferAttribute(nor, i).applyMatrix3(m3).normalize(); N.push(n.x, n.y, n.z);
          Cc.push(c.r, c.g, c.b); K.push(k[0], k[1], k[2]);
        }
        if (g !== geo) g.dispose();
        geo.dispose();
      },
      get count() { return P.length / 3; },
      build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('aCol', new THREE.Float32BufferAttribute(Cc, 3));
        g.setAttribute('aK', new THREE.Float32BufferAttribute(K, 3));
        g.computeBoundingSphere();
        return keep(g);
      },
    };
  }
  const Mx = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
    V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V3(sx, sy, sz));
  // a box from A to B; a = size across (local x), b = size across (local y, toward `up`)
  const strutM = (A, B, a, b, up = [0, 0, 1]) => {
    const pa = V3(...A), pb = V3(...B);
    const m = new THREE.Matrix4().lookAt(pa, pb, V3(...up));
    m.scale(V3(a, b, pa.distanceTo(pb)));
    m.setPosition(pa.add(pb).multiplyScalar(0.5));
    return m;
  };
  const box = () => new THREE.BoxGeometry(1, 1, 1);

  // material kinds for the solid shader (aK.x)
  const K_PLAIN = 0, K_BRICK = 1, K_WOOD = 2, K_IRON = 3, K_GLAZE = 4, K_BRASS = 5, K_PLASTER = 6, K_TILE = 7, K_STONE = 8, K_POT = 9, K_TIN = 10;

  // =========================================================================
  // Sky: a painted panorama of anime cumulus over a cobalt sky and a bright sea

  const skyTex = (() => {
    const W = HI ? 4096 : 2048, H = HI ? 640 : 320;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const pxd = W / 360;
    const elToY = el => (50 - el) / 56 * H;
    const sunU = Math.atan2(SUN.x, -SUN.z) / TAU + 0.5;
    const rnd = mulberry(4113);
    // distant islands on the horizon
    for (const [u, w, h] of [[0.23, 14, 1.1], [0.27, 6, 0.6], [0.69, 22, 1.4], [0.74, 9, 0.8], [0.9, 12, 0.7]]) {
      const x = u * W, y0 = elToY(-0.15);
      for (const dx of [0, -W, W]) {
        g.fillStyle = '#86a6e4';
        g.beginPath(); g.moveTo(x + dx - w * pxd, y0);
        const n = 14;
        for (let i = 0; i <= n; i++) { const t = i / n, s = Math.sin(t * Math.PI); g.lineTo(x + dx + (t * 2 - 1) * w * pxd, y0 - (h * pxd) * Math.pow(s, 0.7) * (0.75 + 0.25 * Math.sin(t * 9 + u * 30))); }
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(200,226,255,0.55)';
        g.fillRect(x + dx - w * pxd, y0 - 0.25 * pxd, w * 2 * pxd, 0.25 * pxd);
      }
    }
    const paint = (u, baseEl, wDeg, hDeg, seed) => {
      const r = mulberry(seed);
      const w = wDeg * pxd, h = hDeg * pxd;
      const lobes = [];
      const n = Math.max(5, Math.round(wDeg / 2.0));
      for (let i = 0; i < n; i++) {
        const t = -1 + 2 * (i + 0.5) / n + (r() - 0.5) * 0.12;
        const prof = Math.pow(Math.max(0, 1 - t * t), 0.6) * (0.8 + 0.2 * r());
        const rad = h * (0.14 + 0.3 * prof) * (0.75 + 0.5 * r());
        lobes.push({ x: t * w * 0.5, y: -prof * h + rad, r: rad, p: prof });
      }
      const top = lobes.slice();
      for (let i = 0; i < n * 0.7; i++) {
        const L = top[Math.floor(r() * top.length)];
        if (L.p < 0.45) continue;
        const rad = L.r * (0.45 + 0.3 * r());
        lobes.push({ x: L.x + (r() - 0.5) * L.r * 1.2, y: L.y - L.r * (0.55 + 0.3 * r()) + rad * 0.3, r: rad, p: L.p });
      }
      const pad = 8;
      const minY = Math.min(...lobes.map(l => l.y - l.r)) - pad;
      const ow = Math.ceil(w * 1.2 + h + pad * 2), oh = Math.ceil(-minY + pad * 2);
      const oc = document.createElement('canvas'); oc.width = ow; oc.height = oh;
      const o = oc.getContext('2d');
      const ox = ow / 2, oy = oh - pad;            // local origin: base centre
      let du = sunU - u; du -= Math.round(du);
      const toward = Math.abs(du) < 0.25;          // cloud near the sun: backlit
      const sx = du > 0 ? 1 : -1;
      const sideK = clamp(1 - Math.abs(du) * 4, 0, 1);
      o.save();
      o.beginPath(); o.rect(0, 0, ow, oy); o.clip();     // flat base
      o.fillStyle = toward ? '#c5cbf0' : '#b9c5f1';
      for (const l of lobes) { o.beginPath(); o.arc(ox + l.x, oy + l.y, l.r, 0, TAU); o.fill(); }
      o.fillRect(ox - w * 0.42, oy - h * 0.3, w * 0.84, h * 0.3);
      o.globalCompositeOperation = 'source-atop';
      o.fillStyle = toward ? '#fff8ee' : '#ffffff';
      for (const l of lobes) {
        o.beginPath();
        o.arc(ox + l.x + sx * l.r * (0.1 + 0.18 * sideK), oy + l.y - l.r * 0.2, l.r * 0.86, 0, TAU);
        o.fill();
      }
      // second, deeper shade along the base
      const gr = o.createLinearGradient(0, oy - h * 0.38, 0, oy);
      gr.addColorStop(0, 'rgba(150,165,228,0)');
      gr.addColorStop(1, 'rgba(150,165,228,0.75)');
      o.fillStyle = gr; o.fillRect(0, oy - h * 0.38, ow, h * 0.38);
      // warm rim on the sun side of backlit clouds
      if (toward) {
        o.globalAlpha = 0.55;
        o.fillStyle = '#ffe7c4';
        for (const l of lobes) { if (l.p < 0.3) continue; o.beginPath(); o.arc(ox + l.x + sx * l.r * 0.35, oy + l.y - l.r * 0.32, l.r * 0.6, 0, TAU); o.fill(); }
        o.globalAlpha = 1;
      }
      o.restore();
      const X = u * W - ox, Y = elToY(baseEl) - oy;
      g.save();
      g.filter = 'blur(0.8px)';
      for (const dx of [0, -W, W]) g.drawImage(oc, X + dx, Y);
      g.restore();
    };
    const list = [
      [0.62, 1.2, 50, 22], [0.79, 2.4, 30, 13], [0.955, 0.8, 36, 17], [0.36, 1.6, 44, 20], [0.2, 2.8, 26, 10],
      [0.49, 4.0, 22, 8], [0.7, 9.5, 15, 4.5], [0.05, 7.0, 17, 5.5], [0.29, 12.0, 12, 3.6], [0.55, 17.0, 10, 3.0],
      [0.875, 14.5, 14, 4.0], [0.43, 22.0, 9, 2.6], [0.12, 19.0, 8, 2.4], [0.66, 27.0, 8, 2.2], [0.97, 24.0, 10, 2.6],
      [0.82, 31.0, 6, 1.8], [0.33, 30.0, 7, 2.0],
    ];
    list.forEach(([u, el, wd, hd], i) => paint(u, el, wd, hd, 900 + i * 37));
    // thin high wisps
    g.save(); g.filter = 'blur(2px)';
    for (let i = 0; i < 9; i++) {
      const x = rnd() * W, y = elToY(26 + rnd() * 18), len = (18 + rnd() * 30) * pxd;
      g.strokeStyle = 'rgba(255,255,255,0.32)'; g.lineWidth = 2 + rnd() * 3; g.lineCap = 'round';
      for (const dx of [0, -W, W]) { g.beginPath(); g.moveTo(x + dx, y); g.quadraticCurveTo(x + dx + len * 0.5, y - 6 - rnd() * 10, x + dx + len, y + 2); g.stroke(); }
    }
    g.restore();
    const tex = keep(new THREE.CanvasTexture(cv));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    tex.generateMipmaps = true;
    return tex;
  })();

  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(400, 48, 24)), shader(/* glsl */`
    varying vec3 vDir;
    void main() { vDir = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`, /* glsl */`
    uniform sampler2D uClouds;
    varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      float el = asin(clamp(d.y, -1.0, 1.0));
      vec3 zen = vec3(0.02, 0.09, 0.55), mid = vec3(0.05, 0.24, 0.85), hor = vec3(0.3, 0.62, 1.0);
      float eh = max(d.y, 0.0);
      vec3 col = mix(hor, mid, smoothstep(0.0, 0.32, eh));
      col = mix(col, zen, smoothstep(0.3, 0.95, eh));
      float sd = max(dot(d, uSun), 0.0);
      vec2 hz = normalize(d.xz + 1e-5), sz = normalize(uSun.xz);
      col = mix(col, vec3(1.0, 0.86, 0.66), pow(max(dot(hz, sz), 0.0), 3.0) * exp(-eh * 7.0) * 0.45);
      if (d.y < 0.0) {
        float e = -d.y;
        vec3 sea = mix(vec3(0.25, 0.58, 0.98), vec3(0.03, 0.2, 0.62), smoothstep(0.0, 0.07, e));
        vec3 rd = vec3(d.x, -d.y, d.z);
        float gl = max(dot(rd, uSun), 0.0);
        vec2 sp = d.xz / max(e, 0.012);
        float spark = smoothstep(0.78, 0.86, texture2D(uNoise, sp * 0.15 + vec2(uTime * 0.004, 0.0)).g * 0.6 + texture2D(uNoise, sp * 0.41 - vec2(0.0, uTime * 0.006)).b * 0.4);
        sea += uSunCol * (pow(gl, 12.0) * 0.25 + spark * pow(gl, 4.0) * 1.4);
        sea = mix(sea, vec3(0.6, 0.82, 1.0), exp(-e * 70.0) * 0.6);
        col = sea;
      }
      float v = (degrees(el) + 6.0) / 56.0;
      if (v > 0.0 && v < 1.0) {
        vec2 uv = vec2(atan(d.x, -d.z) / 6.2831853 + 0.5 + uTime * 0.00035, v);
        vec2 dx = dFdx(uv), dy = dFdy(uv);
        if (abs(dx.x) > 0.5) dx.x -= sign(dx.x);
        if (abs(dy.x) > 0.5) dy.x -= sign(dy.x);
        vec4 cl = textureGrad(uClouds, uv, dx, dy);
        col = mix(col, cl.rgb * 1.05, cl.a);
      }
      col += vec3(1.0, 0.93, 0.8) * (pow(sd, 1800.0) * 8.0 + pow(sd, 220.0) * 0.8 + pow(sd, 12.0) * 0.18);
      gl_FragColor = vec4(tone(col), 1.0);
      #include <colorspace_fragment>
    }`, { uClouds: { value: skyTex } }, { side: THREE.BackSide, depthWrite: false, depthTest: false }));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  sky.name = 'sky';
  scene.add(sky);

  // =========================================================================
  // The hilltop outside: grass, hydrangeas, the kiln-house roof beyond the door

  const sdHall = (x, z) => {
    const dx = Math.max(Math.abs(x) - HW, 0), dz = Math.max(z - ZN, ZF - z, 0);
    return Math.hypot(dx, dz);
  };
  const groundH = (x, z) => {
    const d = sdHall(x, z);
    const flat = z > 0 ? 15 : 10;
    return d < flat ? -0.02 : -0.02 - (d - flat) * (d - flat) * 0.1;
  };
  {
    const g = keep(new THREE.PlaneGeometry(150, 150, HI ? 150 : 75, HI ? 150 : 75));
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundH(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    const mat = shader(/* glsl */`
      varying vec3 vW; varying vec3 vN;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }`, /* glsl */`
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec3 n = normalize(vN);
        float n1 = tn(vW.xz * 0.045), n2 = tn(vW.xz * 0.31 + 0.5);
        vec3 alb = mix(vec3(0.07, 0.25, 0.04), vec3(0.2, 0.46, 0.06), smoothstep(0.3, 0.7, n1));
        alb *= 0.8 + 0.35 * n2;
        float fl = step(0.86, texture2D(uNoise, vW.xz * 1.7).g) * step(0.5, n2);
        alb = mix(alb, vec3(0.95, 0.9, 0.6), fl * 0.6);
        float path = (1.0 - smoothstep(0.75, 0.95, abs(vW.x))) * step(ZN, vW.z) * step(vW.z, 19.0);
        float st = smoothstep(0.42, 0.5, tn(vW.xz * 1.1));
        alb = mix(alb, mix(vec3(0.35, 0.33, 0.3), vec3(0.55, 0.5, 0.42), st), path);
        float fw = length(fwidth(vW));
        vec3 col = shade(alb, n, vW, fw, 0.0);
        gl_FragColor = vec4(tone(col), 1.0);
        #include <colorspace_fragment>
      }`);
    const ground = new THREE.Mesh(g, mat);
    ground.name = 'ground';
    scene.add(ground);
  }

  // =========================================================================
  // Solids: iron frame, brick, benches, shelves, props, outbuildings

  const S = merger();
  const IRON = '#1d4a54', IRON_HI = [K_IRON, 0.7, 0.4];
  const ironSegs = [];      // for the glints that run along the ribs
  const iron = (A, B, a, b, up, glint = true) => {
    S.add(box(), strutM(A, B, a, b, up), IRON, IRON_HI);
    if (glint) ironSegs.push([A, B]);
  };
  const ribZ = k => ZF + k * RIB;
  const slopeN = [SLOPE / Math.hypot(1, SLOPE), -1 / Math.hypot(1, SLOPE)];   // inward-down normal of the left slope (x, y)
  {
    for (let k = 0; k <= NRIB; k++) {
      const z = ribZ(k);
      const end = k === 0 || k === NRIB;
      for (const s of [-1, 1]) {
        // wall post
        iron([s * (HW + 0.01), KNEE, z], [s * (HW + 0.01), EAVE, z], 0.07, 0.09, [1, 0, 0]);
        // rafter, just under the glass
        const o = 0.065, nx = -s * slopeN[0] * o, ny = slopeN[1] * o;
        iron([s * HW + nx, EAVE + ny, z], [nx, RIDGE + ny, z], 0.11, 0.055, [0, 0, 1]);
        // the curved iron bracket at the eave
        if (!end) {
          const p0 = V3(s * (HW - 0.03), EAVE - 0.72, z);
          const p1 = V3(s * (HW - 0.06), EAVE - 0.08, z);
          const p2 = V3(s * (HW - 0.78), EAVE + 0.39 - 0.1, z);
          const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
          S.add(new THREE.TubeGeometry(curve, HI ? 12 : 6, 0.018, 5, false), new THREE.Matrix4(), IRON, IRON_HI);
          const c2 = new THREE.QuadraticBezierCurve3(V3(s * (HW - 0.03), EAVE - 0.42, z), V3(s * (HW - 0.12), EAVE - 0.12, z), V3(s * (HW - 0.45), EAVE + 0.2 - 0.09, z));
          S.add(new THREE.TubeGeometry(c2, HI ? 8 : 4, 0.011, 4, false), new THREE.Matrix4(), IRON, IRON_HI);
          S.add(new THREE.TorusGeometry(0.06, 0.009, 4, 12), Mx(s * (HW - 0.2), EAVE - 0.2, z), IRON, IRON_HI);
        }
      }
      // tie rods every fourth rib (the great girder stands at z = 0 instead)
      if (k % 4 === 1 && Math.abs(z) > 0.5) {
        S.add(new THREE.CylinderGeometry(0.011, 0.011, 2 * HW, 5), Mx(0, EAVE - 0.05, z, 0, 0, Math.PI / 2), IRON, IRON_HI);
        S.add(new THREE.TorusGeometry(0.09, 0.012, 5, 16), Mx(0, EAVE - 0.05, z), IRON, IRON_HI);
      }
    }
    // purlins, eave plates, ridge, mid rails, sills
    const LZ = [ZF, ZN];
    for (const s of [-1, 1]) {
      for (const f of [1 / 3, 2 / 3]) {
        const x = s * HW * (1 - f);
        iron([x - s * slopeN[0] * 0.05, roofY(x) + slopeN[1] * 0.05, LZ[0]], [x - s * slopeN[0] * 0.05, roofY(x) + slopeN[1] * 0.05, LZ[1]], 0.05, 0.05, [0, 1, 0]);
      }
      iron([s * HW, EAVE, LZ[0]], [s * HW, EAVE, LZ[1]], 0.1, 0.09, [0, 1, 0]);
      iron([s * HW, 2.45, LZ[0]], [s * HW, 2.45, LZ[1]], 0.05, 0.04, [0, 1, 0]);
      iron([s * HW, KNEE + 0.03, LZ[0]], [s * HW, KNEE + 0.03, LZ[1]], 0.06, 0.06, [0, 1, 0], false);
      // glazing bars: up the slope and down the walls, mid-bay
      for (let k = 0; k < NRIB; k++) {
        const z = ribZ(k) + RIB / 2;
        S.add(box(), strutM([s * (HW - 0.01), KNEE, z], [s * (HW - 0.01), EAVE, z], 0.03, 0.025, [1, 0, 0]), IRON, IRON_HI);
        S.add(box(), strutM([s * HW, EAVE, z], [0, RIDGE, z], 0.035, 0.025, [0, 0, 1]), IRON, IRON_HI);
      }
    }
    iron([0, RIDGE - 0.07, LZ[0]], [0, RIDGE - 0.07, LZ[1]], 0.08, 0.1, [0, 1, 0]);
    // thread rods: thin bars under the roof between the ribs, from which the threads hang
    for (let k = 0; k < NRIB; k++) {
      for (const o of [0.4, 0.8]) {
        const z = ribZ(k) + o;
        for (const s of [-1, 1]) S.add(box(), strutM([s * HW, roofIn(HW), z], [0, roofIn(0), z], 0.014, 0.014, [0, 0, 1]), '#2a3b40', [K_IRON, 0.3, 0.2]);
      }
    }
    // gable frames: corner posts, the door frame, the fanlight
    for (const z of [ZF, ZN]) {
      for (const x of [-2.67, -1.33, 0, 1.33, 2.67]) {
        if (z === ZN && Math.abs(x) < 0.9) continue;
        iron([x, KNEE, z], [x, roofY(x) - 0.02, z], 0.06, 0.06, [1, 0, 0]);
      }
      iron([-HW, 2.45, z], [HW, 2.45, z], 0.05, 0.04, [0, 1, 0]);
    }
    for (const s of [-1, 1]) iron([s * 0.85, 0, ZN], [s * 0.85, 2.5, ZN], 0.08, 0.1, [1, 0, 0]);
    iron([-0.9, 2.5, ZN], [0.9, 2.5, ZN], 0.1, 0.08, [0, 1, 0]);
    S.add(new THREE.TorusGeometry(0.85, 0.035, 6, 32, Math.PI), Mx(0, 2.5, ZN), IRON, IRON_HI);
    for (let i = 1; i < 8; i++) {
      const a = i / 8 * Math.PI;
      S.add(box(), strutM([0, 2.5, ZN], [Math.cos(a) * 0.84, 2.5 + Math.sin(a) * 0.84, ZN], 0.022, 0.03, [0, 0, 1]), IRON, IRON_HI);
    }
    S.add(new THREE.TorusGeometry(0.3, 0.02, 5, 20, Math.PI), Mx(0, 2.5, ZN), IRON, IRON_HI);
    // the double doors, standing open outward
    for (const s of [-1, 1]) {
      // each leaf swung out a little past square, away from the doorway
      const hx = s * 0.85, d2 = V3(s * 0.17, 0, 0.985);
      const tip = [hx + d2.x * 0.82, 0, ZN + d2.z * 0.82];
      for (const y of [0.05, 0.9, 2.42]) iron([hx, y, ZN + 0.02], [tip[0], y, tip[2]], 0.05, 0.05, [0, 1, 0], false);
      iron([hx + d2.x * 0.02, 0.05, ZN + d2.z * 0.02], [hx + d2.x * 0.02, 2.42, ZN + d2.z * 0.02], 0.05, 0.05, [1, 0, 0], false);
      iron([tip[0], 0.05, tip[2]], [tip[0], 2.42, tip[2]], 0.05, 0.05, [1, 0, 0], false);
    }

    // ----- the great central girder (z = 0): flanges and a row of iron roundels -----
    iron([-HW, GIRDER_Y, 0], [HW, GIRDER_Y, 0], 0.045, 0.12, [0, 0, 1]);
    iron([-HW, EAVE - 0.03, 0], [HW, EAVE - 0.03, 0], 0.045, 0.12, [0, 0, 1]);
    const RR = (EAVE - 0.03 - GIRDER_Y) / 2 - 0.012;
    for (let x = -HW + 0.22; x < HW - 0.1; x += 2 * RR + 0.06) {
      S.add(new THREE.TorusGeometry(RR, 0.014, 5, 18), Mx(x, (GIRDER_Y + EAVE - 0.03) / 2, 0), IRON, IRON_HI);
    }
    iron([0, EAVE, 0], [0, RIDGE - 0.1, 0], 0.07, 0.07, [1, 0, 0]);
    for (const s of [-1, 1]) iron([s * 1.7, EAVE, 0], [0, RIDGE - 0.5, 0], 0.045, 0.05, [0, 0, 1]);
    // the boss and the chain the Heart hangs from
    S.add(new THREE.CylinderGeometry(0.06, 0.045, 0.06, 10), Mx(0, GIRDER_Y - 0.03, 0), IRON, [K_IRON, 0.9, 0.6]);
    const chainTop = GIRDER_Y - 0.06, chainBot = HEART[1] + HEART_R - 0.02;
    for (let i = 0, y = chainTop; y > chainBot; i++, y -= 0.03) {
      S.add(new THREE.TorusGeometry(0.016, 0.0045, 4, 10), Mx(0, y - 0.015, 0, 0, i % 2 ? Math.PI / 2 : 0, Math.PI / 2), '#2b2f33', [K_IRON, 1.0, 0.8]);
    }
    S.add(new THREE.SphereGeometry(0.035, 10, 6, 0, TAU, 0, Math.PI / 2), Mx(0, HEART[1] + HEART_R - 0.035, 0), '#3a2f2a', [K_BRASS, 0.8, 0.6]);
  }

  // ----- brick knee walls with stone coping -----
  {
    const BR = '#7a3322', ST = '#cbbfa8';
    for (const s of [-1, 1]) {
      S.add(box(), Mx(s * (HW + 0.02), KNEE / 2, (ZN + ZF) / 2, 0, 0, 0, 0.3, KNEE, ZN - ZF + 0.3), BR, [K_BRICK, 0, 0]);
      S.add(box(), Mx(s * (HW + 0.02), KNEE + 0.03, (ZN + ZF) / 2, 0, 0, 0, 0.36, 0.06, ZN - ZF + 0.36), ST, [K_STONE, 0.1, 0]);
    }
    S.add(box(), Mx(0, KNEE / 2, ZF - 0.02, 0, 0, 0, 2 * HW + 0.3, KNEE, 0.3), BR, [K_BRICK, 0, 0]);
    S.add(box(), Mx(0, KNEE + 0.03, ZF - 0.02, 0, 0, 0, 2 * HW + 0.36, 0.06, 0.36), ST, [K_STONE, 0.1, 0]);
    for (const s of [-1, 1]) {
      const w = HW - 0.85;
      S.add(box(), Mx(s * (0.85 + w / 2), KNEE / 2, ZN + 0.02, 0, 0, 0, w + 0.15, KNEE, 0.3), BR, [K_BRICK, 0, 0]);
      S.add(box(), Mx(s * (0.85 + w / 2), KNEE + 0.03, ZN + 0.02, 0, 0, 0, w + 0.2, 0.06, 0.36), ST, [K_STONE, 0.1, 0]);
    }
    // threshold stone
    S.add(box(), Mx(0, 0.02, ZN + 0.1, 0, 0, 0, 1.7, 0.05, 0.5), ST, [K_STONE, 0.1, 0]);
  }

  // ----- benches (staging) down both sides -----
  const benchRanges = { '-1': [[-10.4, -1.5], [1.5, 9.0]], '1': [[-10.4, -1.5], [1.5, 12.4]] };
  const WOOD = ['#9a7652', '#8f6c4a', '#a5815a', '#86664a'];
  {
    const rnd = mulberry(77);
    for (const s of [-1, 1]) {
      for (const [z0, z1] of benchRanges[s]) {
        const mods = Math.max(1, Math.round((z1 - z0) / 2.4));
        const ml = (z1 - z0) / mods;
        for (let m = 0; m < mods; m++) {
          const a = z0 + m * ml + 0.02, b = a + ml - 0.04, zc = (a + b) / 2;
          const wood = WOOD[Math.floor(rnd() * WOOD.length)];
          const nSl = 5, sw = (BENCH_OUT - BENCH_IN) / nSl;
          for (let i = 0; i < nSl; i++) {
            const x = s * (BENCH_IN + sw * (i + 0.5));
            S.add(box(), Mx(x, BENCH_Y - 0.017, zc, 0, 0, 0, sw - 0.02, 0.034, b - a), wood, [K_WOOD, 0.05, 2]);
          }
          S.add(box(), Mx(s * BENCH_IN, BENCH_Y - 0.06, zc, 0, 0, 0, 0.03, 0.09, b - a), '#24525a', [K_IRON, 0.3, 0.2]);
          S.add(box(), Mx(s * BENCH_OUT, BENCH_Y - 0.06, zc, 0, 0, 0, 0.03, 0.09, b - a), '#24525a', [K_IRON, 0.3, 0.2]);
          for (const zz of [a + 0.06, b - 0.06]) for (const xx of [BENCH_IN + 0.05, BENCH_OUT - 0.05]) {
            S.add(box(), Mx(s * xx, (BENCH_Y - 0.05) / 2, zz, 0, 0, 0, 0.06, BENCH_Y - 0.05, 0.06), '#24525a', [K_IRON, 0.3, 0.2]);
          }
          // lower shelf
          for (let i = 0; i < 3; i++) S.add(box(), Mx(s * (BENCH_IN + 0.12 + i * 0.42), 0.26, zc, 0, 0, 0, 0.36, 0.025, b - a - 0.1), '#7a5c40', [K_WOOD, 0.03, 2]);
        }
      }
      // narrow shelf on brackets along the glass wall, for bottles in the sun
      for (let k = 0; k < NRIB; k++) {
        const z0 = ribZ(k) + 0.04, z1 = ribZ(k + 1) - 0.04;
        if (s < 0 && z1 > 9.2) continue;
        if (z1 > ZN - 1.2 || z0 < ZF + 0.2) continue;
        S.add(box(), Mx(s * (HW - 0.2), 1.3, (z0 + z1) / 2, 0, 0, 0, 0.28, 0.025, z1 - z0), '#9a6638', [K_WOOD, 0.05, 2]);
        S.add(box(), strutM([s * (HW - 0.03), 1.05, z0 + 0.1], [s * (HW - 0.3), 1.29, z0 + 0.1], 0.02, 0.02, [0, 0, 1]), IRON, IRON_HI);
      }
    }
  }

  // ----- the amber shelf: a low dark cabinet by the door with a row of bowls -----
  const bowls = [];
  {
    // the cabinet runs out from the wall, so from the aisle the bowls stand in a row
    const x0 = -3.86, x1 = -2.1, zc = AMBER.z, d = 0.62, top = AMBER.y - 0.01;
    S.add(box(), Mx((x0 + x1) / 2, top / 2, zc, 0, 0, 0, x1 - x0, top, d), '#5b2a1e', [K_WOOD, 0.25, 0]);
    S.add(box(), Mx((x0 + x1) / 2, top + 0.015, zc, 0, 0, 0, x1 - x0 + 0.05, 0.03, d + 0.06), '#c08a52', [K_WOOD, 0.35, 0]);
    S.add(box(), Mx((x0 + x1) / 2, 0.04, zc, 0, 0, 0, x1 - x0 - 0.04, 0.08, d - 0.04), '#3c1c14', [K_WOOD, 0.1, 0]);
    for (let i = 0; i < 4; i++) {
      const x = x0 + (i + 0.5) * (x1 - x0) / 4;
      S.add(box(), Mx(x, top * 0.55, zc - d / 2 - 0.004, 0, 0, 0, (x1 - x0) / 4 - 0.05, top * 0.7, 0.012), '#6e3424', [K_WOOD, 0.3, 1]);
      S.add(new THREE.SphereGeometry(0.02, 8, 6), Mx(x, top * 0.66, zc - d / 2 - 0.02), '#d8b060', [K_BRASS, 1.0, 0.8]);
    }
    // bowls: shallow, cream glaze with an indigo rim
    const prof = [[0, 0.0], [0.06, 0.0], [0.065, 0.008], [0.12, 0.036], [0.16, 0.064], [0.172, 0.074], [0.162, 0.076], [0.12, 0.047], [0.055, 0.024], [0, 0.022]].map(p => new THREE.Vector2(p[0], p[1]));
    for (let i = 0; i < AMBER.n; i++) {
      const x = AMBER.x + (i - (AMBER.n - 1) / 2) * AMBER.dx;
      S.add(new THREE.LatheGeometry(prof, HI ? 28 : 16), Mx(x, AMBER.y, zc), '#f3ead6', [K_GLAZE, 0.8, 0.7]);
      S.add(new THREE.TorusGeometry(0.168, 0.0065, 4, HI ? 28 : 16), Mx(x, AMBER.y + 0.075, zc, Math.PI / 2), '#2c3a8a', [K_GLAZE, 0.8, 0.7]);
      bowls.push(V3(x, AMBER.y + 0.022, zc));
    }
  }

  // ----- the first Keeper's plinth and plaque -----
  {
    S.add(box(), Mx(0, 0.17, STATUE_Z, 0, 0, 0, 0.82, 0.34, 0.82), '#d4cab8', [K_STONE, 0.15, 0]);
    S.add(box(), Mx(0, 0.36, STATUE_Z, 0, 0, 0, 0.9, 0.05, 0.9), '#e2d9c8', [K_STONE, 0.15, 0]);
    S.add(box(), Mx(0, 0.02, STATUE_Z, 0, 0, 0, 1.0, 0.04, 1.0), '#b9ad98', [K_STONE, 0.1, 0]);
    S.add(box(), Mx(0, 0.19, STATUE_Z + 0.415, 0, 0, 0, 0.36, 0.13, 0.012), '#c9a24e', [K_BRASS, 1.2, 0.9]);
  }

  // ----- the cold bead-kiln in the far right corner -----
  {
    const kx = 2.75, kz = ZF + 1.15;
    S.add(box(), Mx(kx, 0.3, kz, 0, 0, 0, 1.1, 0.6, 1.0), '#7a3322', [K_BRICK, 0, 0]);
    S.add(new THREE.SphereGeometry(0.5, HI ? 24 : 12, HI ? 12 : 6, 0, TAU, 0, Math.PI / 2), Mx(kx, 0.6, kz, 0, 0, 0, 1, 0.85, 0.95), '#86402a', [K_BRICK, 0, 0]);
    S.add(box(), Mx(kx - 0.52, 0.72, kz, 0, 0, 0, 0.03, 0.22, 0.26), '#22282c', [K_IRON, 0.6, 0.4]);
    S.add(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 10), Mx(kx + 0.15, 2.65, kz - 0.1), '#2a2f33', [K_IRON, 0.4, 0.3]);
    S.add(box(), Mx(kx - 0.55, 0.42, kz, 0, 0, 0, 0.08, 0.04, 0.5), '#3a3f44', [K_IRON, 0.4, 0.3]);
  }

  // ----- props: an upturned bucket by the door, a stepladder, terracotta pots -----
  const pots = [];
  {
    S.add(new THREE.CylinderGeometry(0.13, 0.155, 0.3, 16, 1, false), Mx(1.4, 0.15, 12.95), '#9aa3a8', [K_TIN, 0.9, 0.5]);
    S.add(new THREE.CylinderGeometry(0.135, 0.135, 0.02, 16), Mx(1.4, 0.3, 12.95), '#80898e', [K_TIN, 0.9, 0.5]);
    S.add(new THREE.TorusGeometry(0.15, 0.006, 4, 16, Math.PI), Mx(1.4, 0.08, 12.95, 0, 0.4, Math.PI), '#5d6468', [K_TIN, 0.9, 0.5]);
    // stepladder (far left)
    const lx = -2.85, lz = -9.6;
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
      S.add(box(), strutM([lx + sx * 0.22, 0, lz + sz * 0.45], [lx + sx * 0.18, 2.1, lz + sz * 0.06], 0.045, 0.06, [1, 0, 0]), '#a77442', [K_WOOD, 0.05, 1]);
    }
    for (let i = 1; i <= 5; i++) {
      const f = i / 6;
      S.add(box(), Mx(lx, f * 2.1, lz + 0.45 - f * 0.39, 0, 0, 0, 0.42, 0.03, 0.1), '#b88450', [K_WOOD, 0.05, 0]);
    }
    S.add(box(), Mx(lx, 2.12, lz, 0, 0, 0, 0.44, 0.04, 0.22), '#b88450', [K_WOOD, 0.05, 0]);
    // pots in the gravel between benches and walls, and a few on the benches
    const rnd = mulberry(5150);
    const potProf = [[0, 0], [0.09, 0], [0.12, 0.2], [0.135, 0.21], [0.135, 0.245], [0.118, 0.245], [0.106, 0.04], [0, 0.04]].map(p => new THREE.Vector2(p[0], p[1]));
    const spots = [[-2.95, -6.0], [2.95, -7.5], [-2.95, 2.6], [2.95, 5.4], [2.95, -0.2], [-2.95, -0.4], [-1.9, 13.2], [2.95, 10.6], [-2.95, 7.0], [2.95, 1.4], [-3.0, -12.0], [2.2, -12.8]];
    for (const [x, z] of spots) {
      const sc = 1.2 + rnd() * 0.9;
      S.add(new THREE.LatheGeometry(potProf, HI ? 16 : 10), Mx(x, 0, z, 0, 0, 0, sc, sc, sc), '#c8643a', [K_POT, 0.05, 0]);
      pots.push([x, 0.235 * sc, z, sc]);
    }
    for (let i = 0; i < 6; i++) {
      const s = i % 2 ? 1 : -1, z = -9 + i * 3.4 + rnd();
      if (Math.abs(z) < 1.6) continue;
      const sc = 0.75 + rnd() * 0.3;
      const x = s * (BENCH_OUT - 0.25);
      S.add(new THREE.LatheGeometry(potProf, HI ? 14 : 8), Mx(x, BENCH_Y, z, 0, 0, 0, sc, sc, sc), '#c66a40', [K_POT, 0.05, 0]);
      pots.push([x, BENCH_Y + 0.235 * sc, z, sc * 0.75]);
    }
  }

  // ----- the kiln-house beyond the door: white plaster, dark timber, blue kawara -----
  {
    const kz = 22, w = 13, d = 6.5, hgt = 2.9;
    S.add(box(), Mx(0, hgt / 2 - 0.2, kz, 0, 0, 0, w, hgt + 0.4, d), '#f4ead8', [K_PLASTER, 0, 0]);
    S.add(box(), Mx(0, 0.15, kz, 0, 0, 0, w + 0.3, 0.5, d + 0.3), '#8e8a80', [K_STONE, 0.05, 0]);
    // gable roof running along x, with deep eaves
    const sh = new THREE.Shape();
    sh.moveTo(-d / 2 - 0.9, 0); sh.lineTo(d / 2 + 0.9, 0); sh.lineTo(0, 2.6); sh.lineTo(-d / 2 - 0.9, 0);
    const roofG = new THREE.ExtrudeGeometry(sh, { depth: w + 1.4, bevelEnabled: false });
    S.add(roofG, Mx(-w / 2 - 0.7, hgt, kz, 0, Math.PI / 2, 0), '#3d63b8', [K_TILE, 0.8, 0.6]);
    S.add(box(), Mx(0, hgt + 2.6, kz, 0, 0, 0, w + 1.5, 0.22, 0.32), '#26457e', [K_TILE, 0.8, 0.6]);
    // the kiln chimney
    S.add(box(), Mx(-3.6, hgt + 2.3, kz + 0.9, 0, 0, 0, 0.7, 2.6, 0.7), '#7a3322', [K_BRICK, 0, 0]);
    // timber posts and a sliding door facing the glasshouse
    for (let i = 0; i <= 6; i++) S.add(box(), Mx(-w / 2 + i * w / 6, hgt / 2, kz - d / 2 - 0.03, 0, 0, 0, 0.16, hgt, 0.08), '#4a2e22', [K_WOOD, 0.05, 1]);
    S.add(box(), Mx(0, hgt - 0.12, kz - d / 2 - 0.04, 0, 0, 0, w, 0.16, 0.08), '#4a2e22', [K_WOOD, 0.05, 0]);
    S.add(box(), Mx(0.4, 1.0, kz - d / 2 - 0.05, 0, 0, 0, 1.7, 1.95, 0.05), '#d9cdb4', [K_PLASTER, 0, 1]);
    // trees
    for (const [x, z, h] of [[-9.5, 17, 4.5], [10.5, 19, 5.5], [-10.5, -5, 4.2], [9.0, -12, 3.8]]) {
      S.add(new THREE.CylinderGeometry(0.12, 0.2, h, 8), Mx(x, groundH(x, z) + h / 2, z, 0, 0, 0.08), '#5b3a2a', [K_WOOD, 0, 1]);
    }
  }

  const solidMat = shader(STD_VERT, /* glsl */`
    varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec3 vK;
    vec3 runBond(vec2 p, vec2 sz) {
      float row = floor(p.y / sz.y);
      float x = p.x / sz.x + 0.5 * mod(row, 2.0);
      vec2 id = vec2(floor(x), row);
      vec2 f = vec2(fract(x), fract(p.y / sz.y));
      float m = min(min(f.x, 1.0 - f.x) * sz.x, min(f.y, 1.0 - f.y) * sz.y);
      return vec3(hash12(id), m, 0.0);
    }
    vec3 brickCol(float h) {
      vec3 a = vec3(0.46, 0.12, 0.055), b = vec3(0.62, 0.2, 0.075), c = vec3(0.3, 0.085, 0.06), d = vec3(0.64, 0.3, 0.16);
      return h < 0.4 ? mix(a, b, h / 0.4) : (h < 0.7 ? mix(b, d, (h - 0.4) / 0.3) : mix(c, a, (h - 0.7) / 0.3));
    }
    void main() {
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) n = -n;
      vec3 V = normalize(cameraPosition - vW);
      float fw = length(fwidth(vW));
      float T = vK.x;
      vec3 alb = vC;
      float cK = 1.0;
      float shin = 30.0 + vK.z * 160.0;
      float spec = vK.y;
      if (T > 0.5 && T < 1.5) {                       // brick
        vec2 p = abs(n.x) > 0.6 ? vW.zy : (abs(n.z) > 0.6 ? vW.xy : vW.xz);
        vec3 b = runBond(p, vec2(0.24, 0.085));
        float aa = clamp(1.0 - fw / 0.035, 0.0, 1.0);
        vec3 bc = brickCol(b.x) * (0.9 + 0.2 * tn(p * 0.9));
        float mortar = 1.0 - smoothstep(0.004, 0.009, b.y);
        alb = mix(mix(alb, bc, aa), vec3(0.42, 0.38, 0.3), mortar * aa);
        alb = mix(alb, vec3(0.1, 0.2, 0.06), smoothstep(0.25, 0.0, vW.y) * 0.5 * tn(p * 0.6));
      } else if (T > 1.5 && T < 2.5) {                // wood
        float along = vK.z < 0.5 ? vW.x : (vK.z < 1.5 ? vW.y : vW.z);
        vec2 ac = vK.z < 0.5 ? vW.yz : (vK.z < 1.5 ? vW.xz : vW.xy);
        float gr = tn(vec2(along * 0.18, (ac.x + ac.y) * 6.0));
        float rings = sin((ac.x * 37.0 + ac.y * 29.0) + gr * 7.0);
        alb *= 0.84 + 0.16 * smoothstep(-0.7, 0.9, rings) + 0.18 * (gr - 0.5);
        shin = 20.0;
      } else if (T > 2.5 && T < 3.5) {                // painted iron
        cK = 0.6;
      } else if (T > 3.5 && T < 4.5) {                // glazed ceramic
        cK = 0.7;
      } else if (T > 4.5 && T < 5.5) {                // brass
        float lines = step(0.5, fract(vW.y * 90.0)) * step(abs(vW.x), 0.14) * step(abs(vW.y - 0.19), 0.04) * step(0.3, fract(vW.x * 30.0 + floor(vW.y * 90.0) * 0.37));
        alb *= 1.0 - lines * 0.45;
        cK = 0.4;
      } else if (T > 5.5 && T < 6.5) {                // plaster with timber
        alb *= 0.93 + 0.07 * tn(vW.xy * 0.7);
      } else if (T > 6.5 && T < 7.5) {                // blue kawara roof tiles
        float ch = sin(fract(vW.x / 0.28) * 3.14159);
        float row = fract(vW.y / 0.16);
        alb *= 0.62 + 0.42 * ch * ch;
        alb *= 0.82 + 0.18 * smoothstep(0.0, 0.2, row);
        spec *= ch;
      } else if (T > 7.5 && T < 8.5) {                // stone
        alb *= 0.88 + 0.2 * tn(vW.xz * 1.3 + vW.y);
      } else if (T > 8.5 && T < 9.5) {                // terracotta
        alb *= 0.85 + 0.25 * tn(vW.xy * 3.0 + vW.z);
        alb = mix(alb, vec3(0.5, 0.5, 0.42), smoothstep(0.6, 0.85, tn(vW.xz * 4.0 + vW.y * 2.0)) * 0.35);
      }
      vec3 col = shade(alb, n, vW, fw, cK);
      if (spec > 0.0) {
        vec3 h = normalize(uSun + V);
        float vis = sunVis(vW) + beams(vW) * 1.5;
        col += uSunCol * pow(max(dot(n, h), 0.0), shin) * spec * vis;
      }
      // painted iron: a thin warm rim where it catches the light
      if (T > 2.5 && T < 3.5) {
        float fr = pow(1.0 - abs(dot(n, V)), 3.0);
        col += vec3(1.0, 0.8, 0.55) * fr * 0.25 * sunVis(vW);
      }
      gl_FragColor = vec4(tone(col), 1.0);
      #include <colorspace_fragment>
    }`);
  const solids = new THREE.Mesh(S.build(), solidMat);
  solids.name = 'solids';
  scene.add(solids);

  // =========================================================================
  // The floor: a worn brick aisle in basket weave, a brick medallion under the
  // Heart, gravel and moss under the benches.

  {
    const g = keep(new THREE.PlaneGeometry(2 * HW + 0.3, ZN - ZF + 0.3, 1, 1));
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.001, (ZN + ZF) / 2);
    const mat = shader(/* glsl */`
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, /* glsl */`
      varying vec3 vW;
      vec3 brickCol(float h) {
        vec3 a = vec3(0.42, 0.12, 0.06), b = vec3(0.56, 0.2, 0.09), c = vec3(0.3, 0.09, 0.07), d = vec3(0.62, 0.32, 0.19);
        return h < 0.4 ? mix(a, b, h / 0.4) : (h < 0.7 ? mix(b, d, (h - 0.4) / 0.3) : mix(c, a, (h - 0.7) / 0.3));
      }
      // basket weave: x = brick hash, y = distance to the brick edge (m), z = wear
      vec3 basket(vec2 p) {
        float Wd = 0.105;
        vec2 g = p / (2.0 * Wd);
        vec2 cell = floor(g);
        vec2 f = fract(g);
        float par = mod(cell.x + cell.y, 2.0);
        vec2 q = par < 0.5 ? f : f.yx;
        float hv = step(0.5, q.y);
        vec2 lc = vec2(q.x, fract(q.y * 2.0));
        float m = min(min(lc.x, 1.0 - lc.x) * 2.0 * Wd, min(lc.y, 1.0 - lc.y) * Wd);
        return vec3(hash12(cell * 2.0 + vec2(hv, par * 7.0)), m, 0.0);
      }
      vec3 rings(vec2 p) {
        float r = length(p);
        float ring = floor(r / 0.115);
        float cnt = max(1.0, floor(6.2832 * (ring + 0.5) * 0.115 / 0.2));
        float a = atan(p.y, p.x) / 6.2832 + 0.5 + ring * 0.13;
        float seg = a * cnt;
        float m = min(min(fract(r / 0.115), 1.0 - fract(r / 0.115)) * 0.115, min(fract(seg), 1.0 - fract(seg)) * 6.2832 * r / cnt);
        return vec3(hash12(vec2(ring, floor(seg)) + 3.0), m, ring);
      }
      void main() {
        vec2 p = vW.xz;
        float ax = abs(p.x);
        float fw = fwidth(p.x) + fwidth(p.y);
        float aa = clamp(1.0 - fw / 0.04, 0.0, 1.0);
        vec3 alb;
        float rC = length(p);
        float paved = max(step(ax, AISLE_W), step(abs(p.y), CROSS_W));
        if (rC < 1.2) {
          vec3 b = rings(p);
          alb = brickCol(fract(b.x * 3.1 + b.z * 0.21));
          if (b.z > 8.5) alb = vec3(0.52, 0.45, 0.36);
          float mortar = 1.0 - smoothstep(0.003, 0.008, b.y);
          alb = mix(alb, vec3(0.36, 0.33, 0.27), mortar * aa);
          if (rC < 0.115) alb = vec3(0.62, 0.48, 0.22);
        } else if (paved > 0.5) {
          bool edge = ax > AISLE_W - 0.12 && abs(p.y) > CROSS_W;
          vec3 b = edge ? vec3(hash12(floor(vec2(p.y / 0.11, p.x * 3.0))), min(fract(p.y / 0.11), 1.0 - fract(p.y / 0.11)) * 0.11, 0.0) : basket(p);
          alb = brickCol(b.x) * (0.85 + 0.25 * tn(p * 1.3));
          float wearK = 1.0 - smoothstep(0.0, 0.5, ax) * 0.5;
          alb = mix(alb, alb * 1.25 + vec3(0.04, 0.02, 0.0), smoothstep(0.012, 0.03, b.y) * 0.25 * wearK);
          float mortar = 1.0 - smoothstep(0.003, 0.008, b.y);
          vec3 mc = mix(vec3(0.35, 0.33, 0.27), vec3(0.12, 0.24, 0.07), smoothstep(0.35, 0.7, tn(p * 0.8)) * smoothstep(0.2, 0.8, ax));
          alb = mix(alb, mc, mortar * aa);
          if (edge) alb *= 0.85;
        } else {
          float g1 = texture2D(uNoise, p * 2.2).g, g2 = texture2D(uNoise, p * 5.3).b;
          alb = mix(vec3(0.3, 0.26, 0.2), vec3(0.5, 0.45, 0.36), g1) * (0.75 + 0.4 * g2);
          alb = mix(alb, vec3(0.1, 0.22, 0.06), smoothstep(0.55, 0.75, tn(p * 0.5)) * 0.6);
        }
        // shade under the benches and along the walls
        float under = smoothstep(BENCH_IN - 0.05, BENCH_IN + 0.12, ax) * (1.0 - smoothstep(BENCH_OUT - 0.1, BENCH_OUT + 0.15, ax));
        float benchZ = step(-10.4, p.y) * (1.0 - step(-1.5, p.y) + step(1.5, p.y)) * (1.0 - step(p.x < 0.0 ? 9.0 : 12.4, p.y));
        float occ = 1.0 - under * benchZ * 0.55;
        occ *= mix(0.7, 1.0, smoothstep(0.0, 0.5, HW - ax));
        vec3 col = shade(alb, vec3(0.0, 1.0, 0.0), vW, fw, 1.0) * occ;
        gl_FragColor = vec4(tone(col), 1.0);
        #include <colorspace_fragment>
      }`.replace(/AISLE_W/g, AISLE.toFixed(3)).replace(/CROSS_W/g, CROSS.toFixed(3)).replace(/BENCH_IN/g, BENCH_IN.toFixed(3)).replace(/BENCH_OUT/g, BENCH_OUT.toFixed(3)));
    const floor = new THREE.Mesh(g, mat);
    floor.name = 'floor';
    scene.add(floor);
  }

  // =========================================================================
  // Glass: walls, roof, gables (the far gable is overgrown with ivy outside,
  // which is why the light is greenest at that end), and the door leaves.

  {
    const P = [], N = [], G = [];
    const quad = (a, b, c, d, n, kind) => {
      for (const v of [a, b, c, a, c, d]) { P.push(v[0], v[1], v[2]); N.push(n[0], n[1], n[2]); G.push(kind); }
    };
    for (const s of [-1, 1]) {
      quad([s * HW, KNEE + 0.05, ZF], [s * HW, KNEE + 0.05, ZN], [s * HW, EAVE, ZN], [s * HW, EAVE, ZF], [-s, 0, 0], 0);
      const nn = [-s * SLOPE, -1, 0].map(v => v / Math.hypot(SLOPE, 1));
      quad([s * HW, EAVE, ZF], [s * HW, EAVE, ZN], [0, RIDGE, ZN], [0, RIDGE, ZF], nn, 0);
    }
    const gable = (z, kind, door) => {
      const sh = new THREE.Shape();
      if (door) {
        sh.moveTo(-HW, KNEE + 0.05); sh.lineTo(-0.85, KNEE + 0.05);
        for (let i = 0; i <= 16; i++) { const a = Math.PI - i / 16 * Math.PI; sh.lineTo(Math.cos(a) * 0.85, 2.5 + Math.sin(a) * 0.85); }
        sh.lineTo(0.85, KNEE + 0.05);
      } else {
        sh.moveTo(-HW, KNEE + 0.05);
      }
      sh.lineTo(HW, KNEE + 0.05); sh.lineTo(HW, EAVE); sh.lineTo(0, RIDGE); sh.lineTo(-HW, EAVE); sh.lineTo(-HW, KNEE + 0.05);
      const gg = new THREE.ShapeGeometry(sh);
      const pos = gg.attributes.position, idx = gg.index;
      const tri = idx ? idx.array : null;
      const cnt = tri ? tri.length : pos.count;
      for (let i = 0; i < cnt; i++) {
        const j = tri ? tri[i] : i;
        P.push(pos.getX(j), pos.getY(j), z); N.push(0, 0, door ? -1 : 1); G.push(kind);
      }
      gg.dispose();
    };
    gable(ZF, 1, false);
    gable(ZN, 0, true);
    // fanlight over the door
    for (let i = 0; i < 16; i++) {
      const a0 = i / 16 * Math.PI, a1 = (i + 1) / 16 * Math.PI;
      P.push(0, 2.5, ZN, Math.cos(a0) * 0.85, 2.5 + Math.sin(a0) * 0.85, ZN, Math.cos(a1) * 0.85, 2.5 + Math.sin(a1) * 0.85, ZN);
      N.push(0, 0, -1, 0, 0, -1, 0, 0, -1); G.push(2, 2, 2);
    }
    // the open door leaves
    for (const s of [-1, 1]) {
      const hx = s * 0.85, d = [s * 0.17, 0, 0.985];
      const tip = [hx + d[0] * 0.82, ZN + d[2] * 0.82];
      const nrm = [d[2] * s, 0, -d[0] * s];
      quad([hx, 0.08, ZN + 0.02], [tip[0], 0.08, tip[1]], [tip[0], 2.4, tip[1]], [hx, 2.4, ZN + 0.02], nrm, 2);
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('aG', new THREE.Float32BufferAttribute(G, 1));
    g.computeBoundingSphere();
    const mat = shader(/* glsl */`
      attribute float aG;
      varying vec3 vW; varying vec3 vN; varying float vG;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normal; vG = aG; gl_Position = projectionMatrix * viewMatrix * w; }`, /* glsl */`
      varying vec3 vW; varying vec3 vN; varying float vG;
      void main() {
        vec3 n = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        if (dot(n, V) < 0.0) n = -n;
        float ndv = clamp(dot(n, V), 0.0, 1.0);
        float F = pow(1.0 - ndv, 4.0);
        vec3 R = reflect(-V, n);
        float sr = max(dot(R, uSun), 0.0);
        float spec = pow(sr, 900.0) * 6.0 + pow(sr, 60.0) * 0.3;
        vec3 refl = mix(vec3(0.2, 0.12, 0.08), vec3(0.22, 0.4, 0.75), clamp(R.y * 0.8 + 0.5, 0.0, 1.0));
        vec2 pc = abs(n.x) > 0.5 ? vec2(vW.z / 0.6, vW.y / 0.62) : (abs(n.z) > 0.5 ? vec2(vW.x / 0.67, vW.y / 0.62) : vec2(vW.z / 0.6, abs(vW.x) / 0.56));
        vec2 pid = floor(pc);
        float h = hash12(pid);
        vec2 pf = fract(pc);
        float edge = 1.0 - smoothstep(0.0, 0.06, min(min(pf.x, 1.0 - pf.x), min(pf.y, 1.0 - pf.y)));
        float streak = smoothstep(0.92, 1.0, sin((vW.y * 1.7 + (vW.x + vW.z) * 0.9) * 2.6 + h * 6.0)) * 0.06;
        float grime = (1.0 - smoothstep(KNEE_Y + 0.05, KNEE_Y + 0.9, vW.y)) * 0.1 * (0.5 + h);
        float a = 0.02 + 0.025 * h + F * 0.32 + edge * 0.04 + grime;
        vec3 add = refl * (F * 0.32 + 0.01) + uSunCol * spec + vec3(0.85, 1.0, 0.95) * (streak * 0.6 + edge * 0.02);
        vec3 tint = mix(vec3(0.75, 0.95, 0.85), vec3(0.95, 0.92, 0.8), h);
        vec3 col = add + tint * 0.08 * a + vec3(0.32, 0.3, 0.2) * grime;
        if (vG > 0.5 && vG < 1.5) {
          // ivy pressed against the far gable, backlit by the sun
          vec2 q = vW.xy;
          float leaf = 0.0; vec3 lc = vec3(0.0);
          for (int L = 0; L < 3; L++) {
            float sc = L == 0 ? 0.34 : (L == 1 ? 0.21 : 0.13);
            vec2 g2 = q / sc + float(L) * 3.7;
            vec2 id = floor(g2), f = fract(g2) - 0.5;
            vec2 o = (hash22(id) - 0.5) * 0.3;
            float an = hash12(id + 1.3) * 6.2832;
            vec2 r2 = mat2(cos(an), -sin(an), sin(an), cos(an)) * (f - o);
            float e = length(r2 * vec2(1.0, 1.6)) - 0.36 + 0.05 * sin(atan(r2.y, r2.x) * 5.0);
            float fe = fwidth(e) * 0.8 + 0.004;
            float m = (1.0 - smoothstep(-fe, fe, e)) * step(0.25 + float(L) * 0.12, hash12(id + 7.7));
            float hh = hash12(id + 2.9);
            vec3 c = mix(vec3(0.03, 0.32, 0.17), vec3(0.3, 0.72, 0.2), hh) * (0.7 + 0.5 * (1.0 - length(r2) * 2.0));
            lc = mix(lc, c, m);
            leaf = max(leaf, m);
          }
          float cover = smoothstep(0.25, 0.65, tn(q * 0.12 + 0.3)) * 0.35 + 0.65;
          leaf *= cover;
          float gap = 1.0 - leaf;
          col = lc * leaf * 1.1 + vec3(0.25, 0.7, 0.55) * gap * 0.5 + uSunCol * spec * 0.4;
          a = leaf * 0.92 + gap * 0.42;
        }
        gl_FragColor = vec4(tone(col), clamp(a, 0.0, 0.97));
        #include <colorspace_fragment>
      }`.replace(/KNEE_Y/g, KNEE.toFixed(3)), {}, { transparent: true, depthWrite: false, side: THREE.DoubleSide, premultipliedAlpha: true });
    const glass = new THREE.Mesh(g, mat);
    glass.renderOrder = 10;
    glass.name = 'glass';
    scene.add(glass);
  }

  // =========================================================================
  // Hydrangeas outside the walls (and two pots inside the door), tree crowns

  {
    const rnd = mulberry(321);
    const items = [];   // x, y, z, r, R, G, B, kind (0 flower, 1 leaf, 2 tree)
    const FLOW = ['#5b7cf0', '#7a68e8', '#8f7cf2', '#4f8de8', '#b48ae0', '#e48cc8', '#6aa0ff'].map(C);
    const bush = (x, z, sc, inside) => {
      const gy = inside ? 0 : groundH(x, z);
      for (let i = 0; i < 3; i++) {
        const a = rnd() * TAU, r = 0.2 * sc;
        const c = C('#2e7a3e').multiplyScalar(0.7 + rnd() * 0.4);
        items.push([x + Math.cos(a) * r, gy + 0.32 * sc, z + Math.sin(a) * r, (0.3 + rnd() * 0.12) * sc, c.r, c.g, c.b, 1]);
      }
      const nf = 3 + Math.floor(rnd() * 3);
      const base = FLOW[Math.floor(rnd() * FLOW.length)];
      for (let i = 0; i < nf; i++) {
        const a = rnd() * TAU, r = (0.15 + rnd() * 0.2) * sc;
        const c = base.clone().lerp(FLOW[Math.floor(rnd() * FLOW.length)], rnd() * 0.4).multiplyScalar(0.85 + rnd() * 0.3);
        items.push([x + Math.cos(a) * r, gy + (0.48 + rnd() * 0.32) * sc, z + Math.sin(a) * r, (0.16 + rnd() * 0.06) * sc, c.r, c.g, c.b, 0]);
      }
    };
    const step = HI ? 0.95 : 1.6;
    for (const s of [-1, 1]) for (let z = ZF - 0.5; z < ZN + 0.5; z += step * (0.8 + rnd() * 0.4)) bush(s * (4.75 + rnd() * 0.6), z, 0.95 + rnd() * 0.5, false);
    for (let x = -HW; x <= HW; x += step * 1.1) bush(x + rnd() * 0.3, ZF - 0.9 - rnd() * 0.4, 1.0 + rnd() * 0.4, false);
    for (const s of [-1, 1]) for (let x = 1.4; x < 5.5; x += step) bush(s * x, ZN + 0.9 + rnd() * 0.4, 1.0 + rnd() * 0.3, false);
    bush(-1.55, 13.9, 0.8, true); bush(1.6, 13.85, 0.75, true);
    for (const [x, z, h] of [[-9.5, 17, 4.5], [10.5, 19, 5.5], [-10.5, -5, 4.2], [9.0, -12, 3.8]]) {
      const gy = groundH(x, z);
      for (let i = 0; i < (HI ? 46 : 24); i++) {
        // clumps on the surface of a squashed ball: a cumulus of leaves
        const a = rnd() * TAU, u = rnd() * 2 - 1, rr = Math.sqrt(1 - u * u);
        const shell = 0.75 + rnd() * 0.3;
        const c = C(rnd() < 0.5 ? '#2f8a48' : '#3fa152').multiplyScalar(0.85 + rnd() * 0.25);
        items.push([x + Math.cos(a) * rr * 1.75 * shell, gy + h + 0.5 + u * 1.25 * shell, z + Math.sin(a) * rr * 1.75 * shell, 0.42 + rnd() * 0.32, c.r, c.g, c.b, 2]);
      }
    }
    const base = keep(new THREE.IcosahedronGeometry(1, HI ? 2 : 1));
    const g = keep(new THREE.InstancedBufferGeometry());
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('normal', base.attributes.normal);
    g.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(items.flatMap(i => i.slice(0, 4))), 4));
    g.setAttribute('aH', new THREE.InstancedBufferAttribute(new Float32Array(items.flatMap(i => i.slice(4, 8))), 4));
    g.instanceCount = items.length;
    const mat = shader(/* glsl */`
      attribute vec4 aS; attribute vec4 aH;
      varying vec3 vW; varying vec3 vN; varying vec3 vO; varying vec4 vH;
      void main() {
        vec3 p = position;
        float bump = texture2D(uNoise, p.xy * 0.4 + p.z * 0.3 + aS.x).r - 0.5;
        if (aH.w < 0.5) p.y *= 0.82;
        vec3 w = aS.xyz + p * aS.w * (1.0 + bump * (aH.w > 1.5 ? 0.35 : 0.18));
        vW = w; vN = normal; vO = position; vH = aH;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`, /* glsl */`
      varying vec3 vW; varying vec3 vN; varying vec3 vO; varying vec4 vH;
      void main() {
        vec3 n = normalize(vN);
        vec3 alb = vH.rgb;
        float fw = length(fwidth(vW));
        if (vH.w < 0.5) {
          vec3 q = vO * 9.0;
          float cells = sin(q.x) * sin(q.y) * sin(q.z);
          float fl = smoothstep(-0.2, 0.6, cells);
          alb *= 0.6 + 0.5 * fl + 0.25 * n.y;
          alb = mix(alb, vec3(0.95, 0.95, 1.0), smoothstep(0.85, 1.0, cells) * 0.4);
        } else {
          float lv = texture2D(uNoise, vO.xz * 1.3 + vO.y).g;
          alb *= 0.7 + 0.5 * lv;
          if (vH.w > 1.5) {
            float lit = smoothstep(-0.08, 0.12, dot(n, uSun) + (lv - 0.5) * 0.5 + n.y * 0.25);
            alb = mix(alb * vec3(0.4, 0.55, 0.8), alb * vec3(1.2, 1.18, 0.72), lit);
          }
        }
        vec3 col = shade(alb, n, vW, fw, 0.5);
        gl_FragColor = vec4(tone(col), 1.0);
        #include <colorspace_fragment>
      }`);
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    m.name = 'hydrangeas';
    scene.add(m);
  }

  // =========================================================================
  // Ferns in the pots

  {
    const P = [], N = [], UV = [];
    const rnd = mulberry(909);
    const SEG = HI ? 8 : 5;
    for (const [px, py, pz, sc] of pots) {
      const fronds = HI ? 13 : 8;
      for (let f = 0; f < fronds; f++) {
        const az = f / fronds * TAU + rnd() * 0.4;
        const len = (0.42 + rnd() * 0.3) * sc;
        const lift = 0.9 + rnd() * 0.5;
        const dir = V3(Math.cos(az), 0, Math.sin(az));
        const side = V3(-dir.z, 0, dir.x);
        let prev = null;
        for (let i = 0; i <= SEG; i++) {
          const t = i / SEG;
          const ang = lift - t * 1.9;
          const pt = V3(px, py, pz).addScaledVector(dir, len * (Math.sin(t * 1.2) * 0.9)).add(V3(0, len * (Math.sin(ang) * 0.5 * t + t * 0.35), 0));
          pt.y = py + len * (t * 0.9 - t * t * 1.0) * lift;
          pt.x = px + dir.x * len * t * 0.95; pt.z = pz + dir.z * len * t * 0.95;
          const w = 0.07 * sc * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08));
          const a = pt.clone().addScaledVector(side, -w), b = pt.clone().addScaledVector(side, w);
          if (prev) {
            for (const [v, u, vv] of [[prev[0], 0, prev[2]], [prev[1], 1, prev[2]], [b, 1, t], [prev[0], 0, prev[2]], [b, 1, t], [a, 0, t]]) {
              P.push(v.x, v.y, v.z); N.push(0, 1, 0); UV.push(u, vv);
            }
          }
          prev = [a, b, t];
        }
      }
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mat = shader(/* glsl */`
      varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      void main() {
        vec3 p = position;
        float sw = sin(uTime * 1.3 + p.x * 3.0 + p.z * 2.0) * 0.006 * vUv.y;
        p.x += sw; p.z += sw * 0.6;
        vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; vN = normal; vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`, /* glsl */`
      varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      void main() {
        float x = abs(vUv.x - 0.5) * 2.0;
        float pin = fract(vUv.y * 22.0);
        float leaflet = smoothstep(0.0, 0.25, pin) * smoothstep(1.0, 0.55, pin);
        float edge = mix(0.15, 1.0, leaflet) * (1.0 - vUv.y * 0.35);
        if (x > edge) discard;
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 alb = mix(vec3(0.06, 0.3, 0.05), vec3(0.32, 0.6, 0.08), vUv.y * 0.6 + x * 0.3);
        if (x < 0.06) alb *= 0.7;
        vec3 col = shade(alb, n, vW, length(fwidth(vW)), 0.6);
        col += vec3(0.3, 0.5, 0.05) * max(dot(-n, uSun), 0.0) * 0.5 * sunVis(vW);
        gl_FragColor = vec4(tone(col), 1.0);
        #include <colorspace_fragment>
      }`, {}, { side: THREE.DoubleSide });
    const ferns = new THREE.Mesh(g, mat);
    ferns.name = 'ferns';
    scene.add(ferns);
  }

  // =========================================================================
  // Jars of beads on the benches and bottles on the wall shelves

  {
    const P = [], N = [], J = [];
    const rnd = mulberry(1414);
    const SEGJ = HI ? 14 : 8;
    const addJar = (x, y, z, r, h, fill, hue, bottle) => {
      const prof = bottle
        ? [[0, 0], [r, 0], [r, h * 0.62], [r * 0.45, h * 0.8], [r * 0.35, h * 0.86], [r * 0.38, h]]
        : [[0, 0], [r, 0], [r, h * 0.9], [r * 0.88, h * 0.96], [r * 0.9, h]];
      const lg = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), SEGJ).toNonIndexed();
      const pos = lg.attributes.position, nor = lg.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        P.push(pos.getX(i) + x, pos.getY(i) + y, pos.getZ(i) + z);
        N.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        J.push(pos.getY(i) / h, fill, hue, bottle ? 1 : 0);
      }
      lg.dispose();
    };
    for (const s of [-1, 1]) {
      for (const [z0, z1] of benchRanges[s]) {
        for (let z = z0 + 0.25; z < z1 - 0.15; z += 0.45 + rnd() * 0.55) {
          if (rnd() < 0.3) continue;
          const x = s * (BENCH_IN + 0.2 + rnd() * 0.85);
          addJar(x, BENCH_Y, z, 0.05 + rnd() * 0.04, 0.12 + rnd() * 0.16, 0.25 + rnd() * 0.65, rnd(), false);
        }
      }
      for (let z = ZF + 0.5; z < ZN - 1.3; z += 0.22 + rnd() * 0.35) {
        if (s < 0 && z > 9.1) continue;
        if (rnd() < 0.25) continue;
        addJar(s * (HW - 0.18 + (rnd() - 0.5) * 0.08), 1.31, z, 0.035 + rnd() * 0.025, 0.14 + rnd() * 0.16, rnd() < 0.6 ? 0.0 : 0.3 + rnd() * 0.5, rnd(), rnd() < 0.7);
      }
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('aJ', new THREE.Float32BufferAttribute(J, 4));
    g.computeBoundingSphere();
    // two passes over the same jars: the beads inside (opaque), then the glass (blended)
    const jarVert = /* glsl */`
      attribute vec4 aJ;
      varying vec3 vW; varying vec3 vN; varying vec4 vJ;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normal; vJ = aJ; gl_Position = projectionMatrix * viewMatrix * w; }`;
    const jarFrag = /* glsl */`
      varying vec3 vW; varying vec3 vN; varying vec4 vJ;
      void main() {
        #ifdef GLASS
        if (vJ.x < vJ.y) discard;
        #else
        if (vJ.x >= vJ.y) discard;
        #endif
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 V = normalize(cameraPosition - vW);
        float ndv = abs(dot(n, V));
        float F = pow(1.0 - ndv, 3.0);
        float fw = length(fwidth(vW));
        float vis = sunVis(vW) + beams(vW) * 1.6;
        vec3 col; float a;
        vec3 tint = pal(vJ.z);
        if (vJ.x < vJ.y) {
          // beads behind the glass
          vec2 q = vec2(atan(n.z, n.x) * 9.0, vW.y * 62.0);
          vec2 id = floor(q), f = fract(q) - 0.5;
          vec3 bc = pal(hash12(id + floor(vJ.z * 50.0)));
          bc = mix(bc, tint, 0.35);
          float d = length(f);
          float lod = clamp(1.0 - fw * 40.0, 0.0, 1.0);
          float dot1 = mix(0.7, smoothstep(0.5, 0.2, d), lod);
          col = bc * (0.35 + 0.65 * dot1) * (0.45 + 0.6 * vis) + vec3(1.0) * smoothstep(0.18, 0.0, length(f - vec2(-0.15, 0.15))) * 0.4 * lod * vis;
          a = 1.0;
        } else {
          vec3 gt = vJ.w > 0.5 ? mix(tint, vec3(0.5, 0.85, 0.7), 0.55) : vec3(0.8, 0.95, 0.9);
          col = gt * (0.3 + 0.6 * vis) * 0.6;
          a = 0.12 + F * 0.45 + (vJ.w > 0.5 ? 0.22 : 0.0);
        }
        vec3 h = normalize(uSun + V);
        float sp = pow(max(dot(n, h), 0.0), 120.0);
        col += uSunCol * sp * 2.0 * vis + vec3(0.9, 0.95, 1.0) * F * 0.3;
        a = clamp(a + sp, 0.0, 1.0);
        gl_FragColor = vec4(tone(col), a);
        #include <colorspace_fragment>
      }`;
    const beadsIn = new THREE.Mesh(g, shader(jarVert, jarFrag));
    const glassOut = new THREE.Mesh(g, shader(jarVert, jarFrag, {}, { defines: { GLASS: 1 }, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    beadsIn.name = glassOut.name = 'jars';
    glassOut.renderOrder = 9;
    scene.add(beadsIn, glassOut);
  }

  // =========================================================================
  // Camera paths of the scripted tour, so no thread hangs where the lens goes.
  // (These replicate the 3D layer's flights: a quadratic arc that rises above the
  // higher end, plus the 40° orbit round the Heart.)

  const pathPts = [];
  {
    const rot = (p, a) => { const c = Math.cos(a), s = Math.sin(a); const dx = p[0] - HEART[0], dz = p[2] - HEART[2]; return [HEART[0] + dx * c + dz * s, p[1], HEART[2] - dx * s + dz * c]; };
    const flight = (a, b, n, r) => {
      const p0 = V3(...a), p1 = V3(...b), d = p0.distanceTo(p1);
      const c = p0.clone().add(p1).multiplyScalar(0.5);
      if (d > 1.5) c.y = Math.max(p0.y, p1.y) + Math.min(d * 0.09, 25);
      for (let i = 0; i <= n; i++) {
        const t = i / n, it = 1 - t;
        pathPts.push({ x: it * it * p0.x + 2 * it * t * c.x + t * t * p1.x, y: it * it * p0.y + 2 * it * t * c.y + t * t * p1.y, z: it * it * p0.z + 2 * it * t * c.z + t * t * p1.z, r });
      }
    };
    const door = MARKS.door.position, aisle = MARKS.aisle.position, roof = MARKS.roof.position;
    const roofEnd = rot(roof, ORBIT);
    flight(door, aisle, 40, 0.42);
    flight(aisle, roof, 40, 0.45);
    for (let i = 0; i <= 40; i++) { const p = rot(roof, ORBIT * i / 40); pathPts.push({ x: p[0], y: p[1], z: p[2], r: 0.5 }); }
    flight(roofEnd, door, 60, 0.45);
    flight(door, roof, 40, 0.4);
    for (const m of [door, aisle]) pathPts.push({ x: m[0], y: m[1], z: m[2], r: 0.36 });
    // and keep the lines of sight to what each shot looks at clear of beads
    const sight = (a, b, r0, r1, t0 = 0) => {
      for (let i = 1; i <= 40; i++) {
        const t = t0 + (1 - t0) * i / 40;
        pathPts.push({ x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t), z: lerp(a[2], b[2], t), r: lerp(r0, r1, t) });
      }
    };
    sight(door, HEART, 0.2, 0.45);
    sight(aisle, HEART, 0.3, 0.45);
    sight(aisle, MARKS.amber.position, 0.3, 0.4);
    for (let i = 0; i <= 8; i++) sight(rot(roof, ORBIT * i / 8), HEART, 0.12, 0.36, 0.45);
  }

  // =========================================================================
  // The threads and their beads

  const rndT = mulberry(11413);
  const threads = [];
  const clearFor = (x, z, bot) => {
    for (const P of pathPts) {
      const hd = Math.hypot(x - P.x, z - P.z);
      if (hd < P.r) bot = Math.max(bot, P.y + Math.sqrt(P.r * P.r - hd * hd) + 0.03);
    }
    return bot;
  };
  {
    const rows = [];
    for (let k = 0; k < NRIB; k++) for (const o of [0.0, 0.4, 0.8]) {
      const z = ribZ(k) + o;
      if (z < ZF + 0.35 || z > ZN - 1.7) continue;
      if (Math.abs(z) < 0.05) continue;          // the girder row is strung by hand below
      rows.push(z);
    }
    for (const z of rows) {
      let x = -HW + 0.12 + rndT() * 0.08;
      while (x < HW - 0.12) {
        const ax = Math.abs(x);
        const aisle = ax < BENCH_IN - 0.03;
        const stepX = aisle ? (HI ? 0.17 : 0.26) : (HI ? 0.088 : 0.12);
        const next = x + stepX * (0.75 + rndT() * 0.5);
        const skip = (x < -1.85 && z > 9.05) ||                 // the amber shelf has no threads
          (z < -10.55 && ax < 2.25) ||                          // the first Keeper stands clear
          Math.hypot(x, z) < 1.35;                              // the clearing round the Heart
        if (!skip) {
          const top = roofIn(x) + 0.02;
          const nb = fbm(x * 0.5 + 3.1, z * 0.28, 3, 5);
          let bot;
          if (aisle) bot = 2.3 + 0.95 * nb + 0.2 * rndT();
          else { bot = 1.15 + 1.45 * nb + 0.3 * rndT(); if (rndT() < 0.06) bot = 0.98 + rndT() * 0.25; }
          if (Math.abs(z) < CROSS + 0.2 && ax < 2.6) bot = Math.max(bot, 2.55 + 0.45 * rndT());
          bot = clearFor(x, z, bot);
          if (bot < top - 0.3) {
            // beads hang in a band below about four metres; above it, bare silk runs up
            // to the rafters like rain, and from the roof you look down on the colour
            const frac = clamp(0.5 + 0.6 * fbm(x * 0.9, z * 0.7 + 9, 2, 8) + (rndT() - 0.5) * 0.2, 0.35, 1.0);
            const band = 3.7 + 0.7 * fbm(x * 0.35 + 11, z * 0.2, 2, 23) + (rndT() - 0.5) * 0.25;
            let bt = Math.min(bot + Math.max(0.3, frac * (top - bot)), band);
            const bare = bt < bot + 0.12;
            if (bare) bt = bot;
            if (!bare || rndT() < 0.45) threads.push({ x: x + (rndT() - 0.5) * 0.03, z: z + (rndT() - 0.5) * 0.04, top, bot, bt, ph: rndT(), play: -1 });
          }
        }
        x = next;
      }
    }
    // the girder row beside the Heart: six threads on the right are the ones Suzu plays
    const PLAY_BOT = [2.56, 2.71, 2.86, 3.02, 3.13, 2.71];
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) {
        const x = s * (0.55 + i * 0.24);
        const bot = s > 0 ? PLAY_BOT[i] : 2.5 + rndT() * 0.65;
        threads.push({ x, z: 0, top: GIRDER_Y - 0.02, bot, bt: GIRDER_Y - 0.12, ph: rndT(), play: s > 0 ? i : -1 });
      }
    }
  }
  // bead budget
  let beadLen = 0;
  for (const t of threads) beadLen += Math.min(t.bt, t.top - 0.05) - t.bot;
  const MAX_BEADS = HI ? 260000 : 95000;
  const SP = Math.max(HI ? 0.031 : 0.04, beadLen / MAX_BEADS);
  const BEAD_R = HI ? 1 : 1.4;     // fewer, bigger beads when the GPU is small
  const beadsData = { top: [], b: [], c: [], play: [] };
  const glintSel = { top: [], b: [], c: [], play: [] };
  const thr = { top: [], b: [] };
  {
    const col = new THREE.Color();
    for (const t of threads) {
      const L = t.top - t.bot;
      // the thread itself, in four segments (lit per vertex)
      for (let s = 0; s < 4; s++) {
        for (const f of [s / 4, (s + 1) / 4]) { thr.top.push(t.x, t.top, t.z); thr.b.push(f * L, t.ph, L, t.play); }
      }
      const sp = t.play >= 0 ? 0.03 : SP * (0.92 + rndT() * 0.16);
      const grouped = rndT() < 0.25;
      let y = t.bot + 0.01, i = 0;
      const end = Math.min(t.bt, t.top - 0.05);
      while (y < end) {
        const regional = rndT() < 0.5;
        const reg = fbm(t.x * 0.23 + 2.0, t.z * 0.085 + y * 0.32, 2, 13);
        const idx = regional ? Math.floor(((reg * 2.2 + 0.1) % 1) * 8) % 8 : Math.floor(rndT() * 8);
        col.copy(PAL[idx]).multiplyScalar(0.82 + rndT() * 0.3);
        if (t.play >= 0) col.lerp(PAL[3], 0.15);
        const r = (t.play >= 0 ? 0.0135 : 0.0105 + rndT() * 0.003) * BEAD_R;
        const arr = beadsData;
        arr.top.push(t.x, t.top, t.z); arr.b.push(t.top - y, t.ph, L, r); arr.c.push(col.r, col.g, col.b, rndT()); arr.play.push(t.play);
        if (HI && (t.play >= 0 || rndT() < 0.055)) {
          glintSel.top.push(t.x, t.top, t.z); glintSel.b.push(t.top - y, t.ph, L, r); glintSel.c.push(col.r, col.g, col.b, arr.c[arr.c.length - 1]); glintSel.play.push(t.play);
        }
        i++;
        y += sp * (grouped && i % 6 === 0 ? 2.6 : 1);
      }
    }
  }

  const quadGeo = () => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return keep(g);
  };
  const beadGeo = (d) => {
    const g = quadGeo();
    g.setAttribute('aTop', new THREE.InstancedBufferAttribute(new Float32Array(d.top), 3));
    g.setAttribute('aB', new THREE.InstancedBufferAttribute(new Float32Array(d.b), 4));
    g.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(d.c), 4));
    g.setAttribute('aPlay', new THREE.InstancedBufferAttribute(new Float32Array(d.play), 1));
    g.instanceCount = d.play.length;
    return g;
  };

  const BEAD_VERT = /* glsl */`
    attribute vec3 aTop; attribute vec4 aB; attribute vec4 aC; attribute float aPlay;
    uniform float uPx; uniform float uFocus; uniform float uAper; uniform float uMinR;
    varying vec2 vUv; varying vec3 vCol; varying float vSun; varying float vTw; varying float vA; varying float vEdge; varying float vHeart; varying float vFlash;
    void main() {
    #ifdef STATIC
      vec3 c = aTop;
      float fl = 0.0;
      float sunK = 0.32;
    #else
      float sunK = 1.0;
      vec2 a = swayAng(aTop, aB.y, aB.z, aPlay);
      vec3 c = hangPos(aTop, aB.x, a);
      float fl = noteFlash(aPlay, aB.x);
    #endif
      vec4 mv = viewMatrix * vec4(c, 1.0);
      float d = -mv.z;
      vUv = position.xy;
      vCol = aC.rgb;
      float bm = beams(c);
      vSun = (sunVis(c) * 0.45 + bm * 1.4) * sunK;
      vec3 hv = uHeartPos - c;
      vHeart = (uHeartPulse + 0.12) / (1.0 + dot(hv, hv) * 2.5);
      vTw = pow(max(sin(uTime * (1.1 + aC.a * 2.3) + aC.a * 97.0), 0.0), 40.0) * min(bm * 1.5, 1.5);
      vFlash = fl;
      float dd = max(d, 1e-3);
      float rpx = aB.w * uPx / dd;
      float coc = uAper * max(1.0 / dd - 1.0 / uFocus, 0.0) * uPx;
      float bok = smoothstep(2.0, 4.5, coc);
    #ifdef BOKEH
      if (bok < 0.002 || d < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      float R = max(rpx, coc);
      vA = bok * clamp(rpx * rpx / (R * R), 0.05, 1.0);
    #else
      if (bok > 0.998 || d < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    #ifdef LOWQ
      float R = max(rpx, uMinR * 1.3);    // no multisampling: keep far beads a solid pixel or two
      vA = 1.0;
    #else
      float R = max(rpx, uMinR);
      vA = (1.0 - bok) * min(1.0, rpx * rpx / (R * R) * 1.7);
    #endif
    #endif
      vEdge = 1.0 / max(R, 0.5);
      mv.xy += position.xy * R * dd / uPx;
      gl_Position = projectionMatrix * mv;
    }`;
  const BEAD_FRAG = /* glsl */`
    uniform vec3 uSunV;
    varying vec2 vUv; varying vec3 vCol; varying float vSun; varying float vTw; varying float vA; varying float vEdge; varying float vHeart; varying float vFlash;
    void main() {
      float r2 = dot(vUv, vUv);
      if (r2 > 1.0) discard;
      float r = sqrt(r2);
      vec3 n = vec3(vUv, sqrt(1.0 - r2));
      vec3 base = vCol;
      float body = 1.0 - r2;
      vec3 deep = base * base * 0.9 + base * 0.04;
      vec2 sd = uSunV.xy; float sl = length(sd); sd = sl > 1e-3 ? sd / sl : vec2(0.0, 1.0);
      float caus = smoothstep(-0.1, 0.9, dot(vUv, -sd)) * body;
      float big = smoothstep(1.3, 4.0, 1.0 / vEdge);
      vec3 c = mix(deep * 0.6, base * 0.78, smoothstep(0.0, 0.8, body));
      c += base * vSun * (0.2 + 0.95 * caus);
      c += uHeartCol * vHeart * (0.3 + 0.7 * body) * 0.6;
      vec3 h = normalize(uSunV + vec3(0.0, 0.0, 1.0));
      float sp = pow(max(dot(n, h), 0.0), 60.0);
      c += vec3(1.0, 0.96, 0.88) * sp * (0.1 + vSun * 1.0 + vTw * 5.0) * big;
      float gl = smoothstep(0.3, 0.1, length(vUv - vec2(-0.36, 0.4)));
      c += vec3(0.85, 0.92, 1.0) * gl * 0.14 * big;
      c += mix(base, vec3(1.0, 0.9, 0.7), 0.55) * vFlash * (0.35 + 0.5 * body);
      float a = vA * (1.0 - smoothstep(1.0 - vEdge * 1.5, 1.0, r));
    #ifdef LOWQ
      if (a < 0.5) discard;
      a = 1.0;
    #endif
      gl_FragColor = vec4(tone(c), a);
      #include <colorspace_fragment>
    }`;
  const BOKEH_FRAG = /* glsl */`
    varying vec2 vUv; varying vec3 vCol; varying float vSun; varying float vTw; varying float vA; varying float vEdge; varying float vHeart; varying float vFlash;
    void main() {
      float r = length(vUv);
      if (r > 1.0) discard;
      float a = (1.0 - smoothstep(0.84, 1.0, r)) * (0.72 + 0.28 * smoothstep(0.3, 0.92, r));
      vec3 c = vCol * vCol * (0.6 + vSun * 0.9) + uHeartCol * vHeart * 0.4 + vec3(1.0, 0.88, 0.6) * vFlash;
      c = tone(c) * a * vA * 0.8;
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`;
  const lowDefs = HI ? {} : { LOWQ: 1 };
  const beadGeom = beadGeo(beadsData);
  const beadMat = shader(BEAD_VERT, BEAD_FRAG, {}, { alphaToCoverage: HI, defines: { ...lowDefs } });
  const beadMesh = new THREE.Mesh(beadGeom, beadMat);
  beadMesh.frustumCulled = false;
  beadMesh.name = 'beads';
  scene.add(beadMesh);
  if (HI) {
    const bokMat = shader(BEAD_VERT, BOKEH_FRAG, {}, {
      defines: { BOKEH: 1 }, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcColorFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    });
    const bok = new THREE.Mesh(beadGeom, bokMat);
    bok.frustumCulled = false;
    bok.renderOrder = 30;
    bok.name = 'bokeh';
    scene.add(bok);
  }

  // amber beads heaped in the bowls (they don't sway)
  {
    const rnd = mulberry(2208);
    const d = { top: [], b: [], c: [], play: [] };
    const amber = C('#ff8c10');
    const per = HI ? 320 : 150;
    for (const bw of bowls) {
      for (let i = 0; i < per; i++) {
        const rr = Math.sqrt(rnd()) * 0.148, a = rnd() * TAU;
        const hgt = 0.014 + 0.085 * Math.pow(Math.max(0, 1 - (rr / 0.152) ** 2), 0.75) + rnd() * 0.008;
        d.top.push(bw.x + Math.cos(a) * rr, bw.y + hgt, bw.z + Math.sin(a) * rr);
        d.b.push(0, rnd(), 1, (0.011 + rnd() * 0.0018) * BEAD_R);
        const c = amber.clone().multiplyScalar(0.85 + rnd() * 0.25);
        d.c.push(c.r, c.g, c.b, rnd()); d.play.push(-1);
      }
    }
    const m = new THREE.Mesh(beadGeo(d), shader(BEAD_VERT, BEAD_FRAG, {}, { alphaToCoverage: HI, defines: { STATIC: 1, ...lowDefs } }));
    m.frustumCulled = false;
    m.name = 'amber';
    scene.add(m);
  }

  // twinkles: four-point stars on beads the sun catches
  if (HI && glintSel.play.length) {
    const g = beadGeo(glintSel);
    const mat = shader(/* glsl */`
      attribute vec3 aTop; attribute vec4 aB; attribute vec4 aC; attribute float aPlay;
      uniform float uPx;
      varying vec2 vUv; varying vec3 vCol; varying float vI;
      void main() {
        vec2 a = swayAng(aTop, aB.y, aB.z, aPlay);
        vec3 c = hangPos(aTop, aB.x, a);
        float bm = beams(c);
        float tw = pow(max(sin(uTime * (1.1 + aC.a * 2.3) + aC.a * 97.0), 0.0), 40.0);
        float I = tw * min(bm * 1.4, 1.4) + noteFlash(aPlay, aB.x) * 0.55;
        if (I < 0.02) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        vec4 mv = viewMatrix * vec4(c, 1.0);
        float d = max(-mv.z, 0.05);
        float px = (7.0 + 18.0 * I) * (uPx / 1158.0);
        mv.xy += position.xy * px * d / uPx;
        vUv = position.xy; vCol = aC.rgb; vI = I;
        gl_Position = projectionMatrix * mv;
      }`, /* glsl */`
      varying vec2 vUv; varying vec3 vCol; varying float vI;
      void main() {
        vec2 p = vUv;
        float star = exp(-abs(p.x) * 16.0) * exp(-abs(p.y) * 2.4) + exp(-abs(p.y) * 16.0) * exp(-abs(p.x) * 2.4);
        float core = exp(-dot(p, p) * 26.0);
        float halo = exp(-dot(p, p) * 5.0) * 0.3;
        vec3 c = (vec3(1.0, 0.97, 0.9) * (star * 0.8 + core) + vCol * halo) * vI;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`, {}, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    m.renderOrder = 16;
    m.name = 'twinkles';
    scene.add(m);
  }

  // the threads themselves: silk, catching the sun where the shafts cross them
  {
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(thr.top.length), 3));
    g.setAttribute('aTop', new THREE.Float32BufferAttribute(thr.top, 3));
    g.setAttribute('aB', new THREE.Float32BufferAttribute(thr.b, 4));
    const mat = shader(/* glsl */`
      attribute vec3 aTop; attribute vec4 aB;
      varying float vI; varying float vFl;
      void main() {
        vec2 a = swayAng(aTop, aB.y, aB.z, aB.w);
        vec3 p = hangPos(aTop, aB.x, a);
        float bm = beams(p);
        vI = 0.12 + bm * 0.6 + 0.06 * sunVis(p);
        vFl = noteFlash(aB.w, aB.x);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`, /* glsl */`
      varying float vI; varying float vFl;
      void main() {
        vec3 c = vec3(0.92, 0.88, 0.84) * (0.5 + vI * 1.6) + vec3(1.0, 0.85, 0.5) * vFl;
        gl_FragColor = vec4(tone(c), clamp(vI + vFl, 0.0, 0.8));
        #include <colorspace_fragment>
      }`, {}, { transparent: true, depthWrite: false });
    const lines = new THREE.LineSegments(g, mat);
    lines.frustumCulled = false;
    lines.renderOrder = 13;
    lines.name = 'threads';
    scene.add(lines);
  }

  // =========================================================================
  // The Heart: a fist of old beads fused into one dark plum lump, pulsing red

  const heart = new THREE.Group();
  heart.position.set(...HEART);
  {
    const P = [], N = [], B = [];
    const rnd = mulberry(4040);
    const pushGeo = (geo, ctr, scl, tag) => {
      const pp = geo.attributes.position, nn = geo.attributes.normal;
      for (let j = 0; j < pp.count; j++) {
        P.push(ctr.x + pp.getX(j) * scl.x, ctr.y + pp.getY(j) * scl.y, ctr.z + pp.getZ(j) * scl.z);
        N.push(nn.getX(j), nn.getY(j), nn.getZ(j));
        B.push(...tag);
      }
    };
    // a lumpy core
    const core = new THREE.IcosahedronGeometry(HEART_R * 0.78, HI ? 4 : 3);
    const cp = core.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const v = V3(cp.getX(i), cp.getY(i), cp.getZ(i));
      const n = v.clone().normalize();
      const k = 1 + (vnoise(n.x * 2.2 + 5, n.y * 2.2 + n.z * 1.7, 7) - 0.5) * 0.3 + (vnoise(n.x * 5 + 1, n.z * 5 + n.y * 3, 9) - 0.5) * 0.08;
      v.multiplyScalar(k); v.y *= 1.06;
      cp.setXYZ(i, v.x, v.y, v.z);
    }
    core.computeVertexNormals();
    pushGeo(core, V3(0, 0, 0), V3(1, 1, 1), [0, 0, 0, 0]);
    core.dispose();
    // big fused lobes, then small beads still half-round on the surface
    const lobe = new THREE.IcosahedronGeometry(1, HI ? 3 : 2);
    const nl = HI ? 30 : 20, ns = HI ? 80 : 45;
    for (let i = 0; i < nl + ns; i++) {
      const big = i < nl, m = big ? nl : ns, k = big ? i : i - nl;
      const yy = 1 - 2 * (k + 0.5) / m, rr = Math.sqrt(1 - yy * yy), th = k * 2.39996 + (big ? 0 : 1.1);
      const dir = V3(Math.cos(th) * rr + (rnd() - 0.5) * 0.25, yy * 1.06, Math.sin(th) * rr + (rnd() - 0.5) * 0.25).normalize();
      const rad = big ? 0.05 + rnd() * 0.035 : 0.018 + rnd() * 0.014;
      const ctr = dir.clone().multiplyScalar(big ? HEART_R * (0.62 + rnd() * 0.08) : HEART_R * (0.86 + rnd() * 0.05));
      pushGeo(lobe, ctr, V3(rad, rad, rad), [big ? 1 : 2, rnd(), rad, 0]);
    }
    lobe.dispose();
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('aHB', new THREE.Float32BufferAttribute(B, 4));
    g.computeBoundingSphere();
    const mat = shader(/* glsl */`
      attribute vec4 aHB;
      varying vec3 vW; varying vec3 vN; varying vec4 vB; varying vec3 vO;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vB = aHB; vO = position; gl_Position = projectionMatrix * viewMatrix * w; }`, /* glsl */`
      varying vec3 vW; varying vec3 vN; varying vec4 vB; varying vec3 vO;
      void main() {
        vec3 n = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float ndv = clamp(dot(n, V), 0.0, 1.0);
        float F = pow(1.0 - ndv, 2.5);
        // plum skin: deep red-violet, each fused bead a little different
        vec3 plum = mix(vec3(0.05, 0.006, 0.045), vec3(0.035, 0.007, 0.07), vB.y);
        plum = mix(plum, vec3(0.075, 0.008, 0.035), step(0.85, vB.y));
        float r = length(vO);
        float crev = 1.0 - smoothstep(HEART_RI * 0.78, HEART_RI * 0.95, r);   // deep between the lobes
        float swirl = texture2D(uNoise, vO.xy * 2.0 + vO.z * 1.5 + vec2(uTime * 0.01, 0.0)).r;
        // the slow red pulse, seen deep inside through the glass
        float inner = crev * 1.2 + (vB.x > 0.5 ? pow(1.0 - ndv, 1.5) * 0.35 : 0.2);
        vec3 em = uHeartCol * (0.006 + 0.24 * uHeartPulse) * inner * (0.55 + 0.6 * swirl);
        float ndl = dot(n, uSun);
        vec3 col = plum * (mix(uGndAmb, uSkyAmb, n.y * 0.5 + 0.5) + uSunCol * smoothstep(-0.02, 0.38, ndl) * (sunVis(vW) + beams(vW) * 1.5)) + em;
        // a plum's dusty bloom, and a few hard glints
        col += vec3(0.32, 0.26, 0.5) * F * 0.22 * (0.5 + 0.5 * sunVis(vW));
        vec3 h = normalize(uSun + V);
        col += uSunCol * pow(max(dot(n, h), 0.0), 140.0) * (0.25 + beams(vW) * 1.0) * (vB.x > 1.5 ? 1.0 : 0.45);
        gl_FragColor = vec4(tone(col), 1.0);
        #include <colorspace_fragment>
      }`.replace(/HEART_RI/g, HEART_R.toFixed(3)));
    const hm = new THREE.Mesh(g, mat);
    hm.name = 'heart';
    heart.add(hm);
  }
  scene.add(heart);

  // =========================================================================
  // The first Keeper: cloudy green old glass, hands out, palms up, toward the Heart.
  // Drawn like the rest of the cast: a dark coloured outline (an inverted hull,
  // masked by a depth pre-pass), a deep cloudy core and bright glass rims.

  {
    const P = [], N = [];
    const addG = (geo, m) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      const pos = g.attributes.position, nor = g.attributes.normal;
      const m3 = new THREE.Matrix3().getNormalMatrix(m);
      const v = V3(0, 0, 0), n = V3(0, 0, 0);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m); P.push(v.x, v.y, v.z);
        n.fromBufferAttribute(nor, i).applyMatrix3(m3).normalize(); N.push(n.x, n.y, n.z);
      }
      if (g !== geo) g.dispose();
      geo.dispose();
    };
    const SEGS = HI ? 36 : 20;
    const tube = (pts, r0, r1, sx = 1, sz = 1) => {
      const curve = new THREE.CatmullRomCurve3(pts.map(p => V3(...p)));
      const tg = new THREE.TubeGeometry(curve, HI ? 16 : 8, 1, HI ? 12 : 8, false);
      const pos = tg.attributes.position, nor = tg.attributes.normal;
      const steps = (HI ? 16 : 8) + 1, rs = (HI ? 12 : 8) + 1;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1), c = curve.getPointAt(t), r = lerp(r0, r1, t);
        for (let j = 0; j < rs; j++) {
          const k = i * rs + j;
          const nx = nor.getX(k), ny = nor.getY(k), nz = nor.getZ(k);
          pos.setXYZ(k, c.x + nx * r * sx, c.y + ny * r, c.z + nz * r * sz);
        }
      }
      tg.computeVertexNormals();
      addG(tg, new THREE.Matrix4());
      // round caps
      addG(new THREE.SphereGeometry(r0, 12, 8), Mx(...pts[0], 0, 0, 0, sx, 1, sz));
      addG(new THREE.SphereGeometry(r1, 12, 8), Mx(...pts[pts.length - 1], 0, 0, 0, sx, 1, sz));
    };
    // kimono body
    const body = [[0.0, 0.0], [0.205, 0.0], [0.212, 0.03], [0.2, 0.2], [0.182, 0.45], [0.165, 0.68], [0.152, 0.79], [0.165, 0.8], [0.168, 0.96], [0.155, 0.975], [0.162, 1.05], [0.175, 1.13], [0.172, 1.18], [0.13, 1.215], [0.06, 1.245], [0.046, 1.33], [0.0, 1.345]];
    addG(new THREE.LatheGeometry(body.map(p => new THREE.Vector2(p[0], p[1])), SEGS), Mx(0, 0, 0, 0, 0, 0, 1.1, 1, 0.82));
    // obi bow at the back
    for (const s of [-1, 1]) addG(new THREE.SphereGeometry(0.075, 14, 10), Mx(s * 0.075, 0.9, -0.135, 0, s * 0.5, 0, 1, 0.72, 0.36));
    addG(new THREE.SphereGeometry(0.036, 10, 8), Mx(0, 0.9, -0.14, 0, 0, 0, 1, 1, 0.6));
    // head tilted a little up, toward the Heart
    const HY = 1.43;
    addG(new THREE.SphereGeometry(0.108, 24, 16), Mx(0, HY, 0.012, -0.14, 0, 0, 0.93, 1.04, 0.97));
    addG(new THREE.SphereGeometry(0.12, 24, 16, 0, TAU, 0, Math.PI * 0.6), Mx(0, HY + 0.012, -0.012, -0.32, 0, 0, 1.0, 1.0, 1.02));
    addG(new THREE.SphereGeometry(0.062, 14, 10), Mx(0, HY + 0.075, 0.07, -0.55, 0, 0, 1.65, 0.55, 0.75));
    addG(new THREE.SphereGeometry(0.06, 14, 10), Mx(0, HY + 0.09, -0.095, 0, 0, 0, 1.1, 0.95, 1.0));
    // hair pinned up, like every Keeper's since
    addG(new THREE.SphereGeometry(0.045, 12, 8), Mx(0, HY + 0.15, -0.045, 0, 0, 0, 1.2, 0.85, 1.0));
    // arms held out and a little apart, palms up; long sleeves hanging beneath
    for (const s of [-1, 1]) {
      const sh = [s * 0.17, 1.165, 0.0], el = [s * 0.27, 0.975, 0.06], wr = [s * 0.335, 1.02, 0.29];
      tube([sh, [s * 0.225, 1.075, 0.03], el], 0.047, 0.04);
      tube([el, [s * 0.305, 0.995, 0.17], wr], 0.036, 0.03);
      addG(new THREE.SphereGeometry(0.052, 16, 10), Mx(s * 0.355, 1.03, 0.37, -0.12, -s * 0.42, s * 0.1, 0.95, 0.3, 1.5));
      addG(new THREE.SphereGeometry(0.02, 10, 8), Mx(s * 0.315, 1.045, 0.36, 0, -s * 0.42, 0, 1, 0.8, 1.8));
      addG(new THREE.CapsuleGeometry(0.11, 0.22, 6, 14), Mx(s * 0.3, 0.8, 0.15, 0.08, -s * 0.25, s * 0.05, 0.24, 1, 1));
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.computeBoundingSphere();
    const frag = /* glsl */`
      uniform float uSide;
      varying vec3 vW; varying vec3 vN; varying vec3 vO;
      void main() {
        vec3 n = normalize(vN) * uSide;
        vec3 V = normalize(cameraPosition - vW);
        float ndv = clamp(abs(dot(n, V)), 0.0, 1.0);
        float F = pow(1.0 - ndv, 2.2);
        float cl = texture2D(uNoise, vO.xy * 0.9 + vO.z * 0.6).r * 0.6 + texture2D(uNoise, vO.zy * 2.3 + 0.4).g * 0.4;
        cl = smoothstep(0.3, 0.78, cl);
        float rim = smoothstep(0.3, 0.9, F);
        vec3 gl = normalize(uGreenPos - vW);
        float back = pow(max(dot(-V, gl), 0.0), 2.0);
        float lit = max(dot(n, uSun), 0.0) * sunVis(vW);
        float front = clamp(dot(n, normalize(vec3(0.25, 0.55, 1.0))) * 0.5 + 0.5, 0.0, 1.0);
        vec3 R = reflect(-V, n);
        float spec = pow(max(dot(R, uSun), 0.0), 50.0) * sunVis(vW) + pow(max(dot(R, normalize(vec3(0.3, 0.6, 1.0))), 0.0), 24.0) * 0.4;
        float seeds = step(0.93, texture2D(uNoise, vO.xy * 7.0 + vO.z * 5.0).b) * 0.5;
        vec3 core = mix(vec3(0.06, 0.2, 0.1), vec3(0.3, 0.52, 0.3), cl) * (0.5 + 0.75 * front + 0.4 * lit);
        vec3 frost = vec3(0.72, 0.9, 0.7) * (0.55 + 0.55 * front);
        vec3 col = mix(core, frost, smoothstep(0.5, 0.85, cl) * 0.55);
        col = mix(col, vec3(0.88, 1.0, 0.86), rim * 0.75);
        col += uGreenCol * (back * 0.3 + rim * 0.35) + uSunCol * spec * 0.6 + vec3(0.8, 1.0, 0.9) * seeds * 0.25;
        float a = 0.66 + 0.16 * cl + 0.18 * rim;
        if (uSide < 0.0) { col *= 0.5; a *= 0.6; }
        gl_FragColor = vec4(tone(col), clamp(a, 0.0, 0.92));
        #include <colorspace_fragment>
      }`;
    const vert = /* glsl */`
      varying vec3 vW; varying vec3 vN; varying vec3 vO;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vO = position * 3.0; gl_Position = projectionMatrix * viewMatrix * w; }`;
    const backM = new THREE.Mesh(g, shader(vert, frag, { uSide: { value: -1 } }, { transparent: true, depthWrite: false, side: THREE.BackSide }));
    const depthM = new THREE.Mesh(g, keep(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true })));
    const outlineM = new THREE.Mesh(g, shader(/* glsl */`
      uniform float uOutline;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec3 nw = normalize(mat3(modelMatrix) * normal);
        w.xyz += nw * uOutline * max(length(cameraPosition - w.xyz), 1.0);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`, /* glsl */`
      void main() {
        gl_FragColor = vec4(tone(vec3(0.03, 0.15, 0.08) + uGreenCol * 0.06), 0.85);
        #include <colorspace_fragment>
      }`, { uOutline: { value: 0.0016 } }, { transparent: true, depthWrite: false, side: THREE.BackSide }));
    const frontM = new THREE.Mesh(g, shader(vert, frag, { uSide: { value: 1 } }, { transparent: true, depthWrite: false, side: THREE.FrontSide }));
    const parts = [[backM, 11], [depthM, 11.2], [outlineM, 11.4], [frontM, 12]];
    for (const [m, ro] of parts) { m.position.set(0, 0.385, STATUE_Z); m.renderOrder = ro; m.name = 'first_keeper'; scene.add(m); }
  }

  // =========================================================================
  // Sun shafts (analytic in-scattering through a Gaussian beam)

  const shaftMeshes = [];
  {
    const bg = keep(new THREE.BoxGeometry(1, 1, 1));
    bg.translate(0, 0, 0.5);
    const frag = /* glsl */`
      uniform vec4 uB; uniform vec2 uK;
      varying vec3 vW;
      void main() {
        vec3 ro = cameraPosition;
        vec3 rd = normalize(vW - ro);
        vec3 D = -uSun;
        vec3 w0 = ro - uB.xyz;
        float b = dot(rd, D), dd = dot(rd, w0), e = dot(D, w0);
        float den = max(1.0 - b * b, 1e-4);
        float s = (b * e - dd) / den;
        float u = (e - b * dd) / den;
        vec3 diff = w0 + s * rd - u * D;
        float sig = uB.w;
        float r2 = dot(diff, diff) / (sig * sig);
        float chord = 2.0 * sig * sqrt(max(1.0 - r2, 0.0));
        float I = uK.x * (chord * 0.75 + exp(-r2 * 1.5) * sig * 0.6) / max(sqrt(den), 0.2);
        float uf = u / uK.y;
        I *= smoothstep(-0.02, 0.18, uf) * (1.0 - smoothstep(0.82, 1.04, uf));
        I *= smoothstep(0.1, 1.0, s);
        float n = texture2D(uNoise, vec2(u * 0.09 - uTime * 0.005, (diff.x - diff.z) * 0.3 + diff.y * 0.25)).r;
        I *= 0.55 + 0.9 * n;
        float edge = smoothstep(0.3, 1.4, sqrt(r2));
        vec3 tint = mix(vec3(1.0, 0.82, 0.52), 0.6 + 0.4 * cos(6.2832 * (sqrt(r2) * 0.35 + uf * 0.6 + vec3(0.0, 0.33, 0.67))), edge * 0.35);
        gl_FragColor = vec4(tint * I * 0.11, 1.0);
        #include <colorspace_fragment>
      }`;
    for (const b of beams) {
      const m = new THREE.Mesh(bg, shader(/* glsl */`
        varying vec3 vW;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, frag,
      { uB: { value: new THREE.Vector4(b.O.x, b.O.y, b.O.z, b.w) }, uK: { value: new THREE.Vector2(b.k, b.len) } },
      { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide }));
      m.matrixAutoUpdate = false;
      m.frustumCulled = false;
      m.renderOrder = 14;
      m.name = 'shaft';
      scene.add(m);
      shaftMeshes.push(m);
    }
  }

  // =========================================================================
  // Dust motes adrift in the light

  {
    const N = HI ? 3200 : 900, rnd = mulberry(77);
    const d = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      d[i * 4] = (rnd() * 2 - 1) * (HW - 0.2);
      d[i * 4 + 1] = rnd() * 5;
      d[i * 4 + 2] = ZF + 0.5 + rnd() * (ZN - ZF - 1.5);
      d[i * 4 + 3] = rnd();
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aD', new THREE.Float32BufferAttribute(d, 4));
    const mat = shader(/* glsl */`
      attribute vec4 aD;
      uniform float uPx;
      varying float vI;
      void main() {
        vec3 p = aD.xyz;
        float sd = aD.w;
        p.x += sin(uTime * 0.13 + sd * 40.0) * 0.35 + sin(uTime * 0.31 + sd * 17.0) * 0.12;
        p.z += cos(uTime * 0.11 + sd * 23.0) * 0.35;
        p.y = mod(p.y + uTime * (0.01 + sd * 0.02) * (sd > 0.5 ? 1.0 : -1.0), 5.0) + 0.15;
        float bm = beams(p);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = max(-mv.z, 0.1);
        gl_PointSize = clamp((0.005 + sd * 0.006) * uPx / d, 1.0, 10.0);
        vI = (0.03 + bm * 1.2) * (0.6 + 0.4 * sin(uTime * 2.0 + sd * 60.0)) * smoothstep(0.2, 0.9, d);
      }`, /* glsl */`
      varying float vI;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float a = exp(-dot(p, p) * 3.5);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * a * vI, 1.0);
        #include <colorspace_fragment>
      }`, {}, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 15;
    pts.name = 'dust';
    scene.add(pts);
  }

  // =========================================================================
  // Glints that run along the iron ribs

  if (HI) {
    const rnd = mulberry(606);
    const A = [], B = [], K = [];
    const pick = ironSegs.filter(s => s[0][1] > 2.0 || s[1][1] > 2.0);
    for (let i = 0; i < 150 && pick.length; i++) {
      const s = pick[Math.floor(rnd() * pick.length)];
      A.push(...s[0]); B.push(...s[1]);
      K.push(0.04 + rnd() * 0.08, rnd(), 0.6 + rnd() * 0.8, rnd());
    }
    const g = quadGeo();
    g.setAttribute('aA', new THREE.InstancedBufferAttribute(new Float32Array(A), 3));
    g.setAttribute('aBv', new THREE.InstancedBufferAttribute(new Float32Array(B), 3));
    g.setAttribute('aP', new THREE.InstancedBufferAttribute(new Float32Array(K), 4));
    g.instanceCount = K.length / 4;
    const mat = shader(/* glsl */`
      attribute vec3 aA; attribute vec3 aBv; attribute vec4 aP;
      uniform float uPx;
      varying vec2 vUv; varying float vI;
      void main() {
        float f = fract(uTime * aP.x + aP.y);
        vec3 p = mix(aA, aBv, f);
        float env = sin(f * 3.14159);
        float tw = pow(max(sin(uTime * 2.7 + aP.w * 50.0), 0.0), 4.0);
        float I = env * env * (0.25 + 0.75 * tw) * (0.4 + 0.6 * sunVis(p));
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float d = max(-mv.z, 0.05);
        if (I < 0.03 || d < 0.3) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float px = (6.0 + 10.0 * tw) * aP.z * (uPx / 1158.0);
        mv.xy += position.xy * px * d / uPx;
        vUv = position.xy; vI = I;
        gl_Position = projectionMatrix * mv;
      }`, /* glsl */`
      varying vec2 vUv; varying float vI;
      void main() {
        vec2 p = vUv;
        float star = exp(-abs(p.x) * 14.0) * exp(-abs(p.y) * 2.2) + exp(-abs(p.y) * 14.0) * exp(-abs(p.x) * 2.2);
        float core = exp(-dot(p, p) * 22.0);
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.75) * (star * 0.8 + core) * vI, 1.0);
        #include <colorspace_fragment>
      }`, {}, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    m.renderOrder = 17;
    m.name = 'rib_glints';
    scene.add(m);
  }

  // =========================================================================
  // Soft glows: the Heart's halo, green light behind the statue, the amber bowls

  {
    const items = [];   // x y z size  r g b mode
    const push = (p, size, hex, k, mode) => { const c = C(hex).multiplyScalar(k); items.push([p[0], p[1], p[2], size, c.r, c.g, c.b, mode]); };
    push(HEART, 0.9, '#b00c40', 0.12, 1);
    push([0, 1.55, ZF + 1.0], 3.4, '#4fffb8', 0.1, 0);
    push([0, 1.15, STATUE_Z - 0.6], 2.2, '#7dffd0', 0.06, 0);
    push([AMBER.x, AMBER.y + 0.1, AMBER.z], 2.2, '#ffa030', 0.45, 2);
    for (let i = 0; i < 6; i++) push([0.55 + i * 0.24, ([2.56, 2.71, 2.86, 3.02, 3.13, 2.71][i] + GIRDER_Y) / 2, 0], 0.6, '#ffb860', 0.28, 10 + i);
    const g = quadGeo();
    g.setAttribute('aG', new THREE.InstancedBufferAttribute(new Float32Array(items.flatMap(i => i.slice(0, 4))), 4));
    g.setAttribute('aGC', new THREE.InstancedBufferAttribute(new Float32Array(items.flatMap(i => i.slice(4, 8))), 4));
    g.instanceCount = items.length;
    const mat = shader(/* glsl */`
      attribute vec4 aG; attribute vec4 aGC;
      varying vec2 vUv; varying vec3 vC;
      void main() {
        float k = 1.0;
        if (aGC.w > 0.5 && aGC.w < 1.5) k = 0.2 + 0.8 * uHeartPulse;
        else if (aGC.w > 1.5 && aGC.w < 2.5) k = 0.25 + beams(aG.xyz) * 0.8;
        else if (aGC.w > 9.5) { float t = uNoteT[int(aGC.w - 9.5)]; k = t >= 0.0 ? exp(-t * 1.6) * smoothstep(0.0, 0.06, t) : 0.0; }
        vec4 mv = viewMatrix * vec4(aG.xyz, 1.0);
        if (k < 0.004) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        mv.xy += position.xy * aG.w * 0.5;
        vUv = position.xy; vC = aGC.rgb * k * smoothstep(0.3, 1.2, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`, /* glsl */`
      varying vec2 vUv; varying vec3 vC;
      void main() {
        float r2 = dot(vUv, vUv);
        float a = exp(-r2 * 4.0) * (1.0 - smoothstep(0.7, 1.0, r2)) + exp(-r2 * 18.0) * 0.4;
        gl_FragColor = vec4(vC * a, 1.0);
        #include <colorspace_fragment>
      }`, {}, { transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    m.renderOrder = 18;
    m.name = 'glows';
    scene.add(m);
  }

  // ----- lights for anything with a standard material (3D actors) -----
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x8a5a44, 1.3));
  const sunLight = new THREE.DirectionalLight(0xffe2b4, 2.0);
  sunLight.position.copy(SUN).multiplyScalar(50);
  scene.add(sunLight, sunLight.target);

  // ----- marks -----
  for (const [k, v] of Object.entries(MARKS)) marks[k] = { ...v };
  camera.position.set(...MARKS.door.position);
  camera.lookAt(...MARKS.door.look);

  // =========================================================================
  // Animation

  const px = new THREE.Vector2();
  const fwd = V3(0, 0, -1), prevCam = V3(...MARKS.door.position), vel = V3(0, 0, 0), tmp = V3(0, 0, 0);
  const focusTargets = [V3(...HEART), V3(...MARKS.amber.position), V3(...MARKS.statue.position), V3(...MARKS.aisle.position), V3(0, 1.4, -6)];
  let focus = 9, wake = 0, first = true;
  const orbit = { armed: true, min: null, start: -1 };
  const shaftM = new THREE.Matrix4(), basis = new THREE.Matrix4();
  const D = SUN.clone().negate();
  const bx = new THREE.Vector3().crossVectors(V3(0, 1, 0), D).normalize(), by = new THREE.Vector3().crossVectors(D, bx).normalize();
  basis.makeBasis(bx, by, D);

  onUpdate((dt, t) => {
    U.uTime.value = t;
    sky.position.copy(camera.position);

    // pixels per metre at 1 m, for the bead impostors
    renderer.getDrawingBufferSize(px);
    U.uPx.value = px.y / (2 * Math.tan(camera.fov * DEG / 2));
    U.uMinR.value = 0.95 * px.y / 1080;
    U.uSunV.value.copy(SUN).transformDirection(camera.matrixWorldInverse);

    // focus on whatever the camera is looking at
    camera.getWorldDirection(fwd);
    let best = -1, bestD = 7;
    for (const p of focusTargets) {
      tmp.subVectors(p, camera.position);
      const dist = tmp.length();
      const c = tmp.dot(fwd) / Math.max(dist, 1e-3);
      if (c > best) { best = c; bestD = dist; }
    }
    const want = best > Math.cos(14 * DEG) ? Math.max(bestD, 1.2) : 7;
    focus = first ? want : focus + (want - focus) * (1 - Math.exp(-dt * 2.5));
    U.uFocus.value = focus;

    // the air stirs where the camera moves
    if (dt > 0) {
      vel.subVectors(camera.position, prevCam).divideScalar(Math.max(dt, 1e-3));
      const sp = Math.min(vel.length(), 12);
      wake = Math.max(wake * Math.exp(-dt / 2.2), Math.min(sp * 0.011, 0.05));
      if (sp > 0.05) U.uWakeDir.value.lerp(vel.clone().normalize(), 1 - Math.exp(-dt * 4));
    }
    prevCam.copy(camera.position);
    U.uWake.value.set(camera.position.x, camera.position.y, camera.position.z, wake);

    // the Heart beats about 40 times a minute: a soft double pulse
    const ph = (t * 40 / 60) % 1;
    const beat = Math.exp(-((ph - 0.08) ** 2) / 0.004) + 0.45 * Math.exp(-((ph - 0.3) ** 2) / 0.006);
    U.uHeartPulse.value = 0.06 + 0.94 * Math.min(1, beat);
    heart.rotation.y = 0.22 * Math.sin(t * 0.17);
    heart.position.x = HEART[0] + 0.008 * Math.sin(t * 0.9);

    // the shafts drift as the afternoon goes on, and dim as small clouds pass
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      const ox = Math.sin(t * 0.045 + b.seed * 3.1) * 0.22, oz = Math.cos(t * 0.037 + b.seed * 1.7) * 0.22;
      U.uBeam.value[i].set(b.O.x + ox, b.O.y, b.O.z + oz, b.w);
      U.uBeamK.value[i].set(b.k * (0.78 + 0.22 * Math.sin(t * 0.06 + b.seed * 2.3)), b.len);
      const m = shaftMeshes[i];
      m.material.uniforms.uB.value.copy(U.uBeam.value[i]);
      m.material.uniforms.uK.value.copy(U.uBeamK.value[i]);
      shaftM.copy(basis).scale(V3(b.w * 2.6, b.w * 2.6, b.len + 0.3));
      shaftM.setPosition(b.O.x + ox - D.x * 0.15, b.O.y - D.y * 0.15, b.O.z + oz - D.z * 0.15);
      m.matrix.copy(shaftM);
      m.matrixWorld.copy(shaftM);
    }

    // Suzu runs a fingertip along the threads during the orbit round the Heart
    const cp = camera.position;
    const onRing = Math.abs(cp.y - ROOF_Y) < 0.15 && Math.abs(Math.hypot(cp.x - HEART[0], cp.z - HEART[2]) - ROOF_R) < 0.2;
    if (!onRing) { orbit.armed = true; orbit.min = null; }
    else {
      const ang = Math.atan2(cp.x - HEART[0], cp.z - HEART[2]);
      orbit.min = orbit.min == null ? ang : Math.min(orbit.min, ang);
      if (orbit.armed && ang - orbit.min > 0.012) { orbit.armed = false; orbit.start = t; }
    }
    for (let i = 0; i < 6; i++) U.uNoteT.value[i] = orbit.start >= 0 && t - orbit.start >= NOTE_AT[i] && t - orbit.start < NOTE_AT[i] + 12 ? t - orbit.start - NOTE_AT[i] : -1;
    first = false;
  });

  return {
    heightAt: (x, z) => (Math.abs(x) <= HW + 0.2 && z <= ZN + 0.2 && z >= ZF - 0.2 ? 0 : groundH(x, z)),
    dispose() { for (const d of disposables) d.dispose && d.dispose(); },
  };
}
