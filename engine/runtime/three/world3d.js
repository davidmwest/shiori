// Shiori — 3D layer.
//
// Renders a 3D world (a three.js world module or a .glb/.gltf file), a camera
// that flies between named marks, and 3D actors (glTF / VRM / model modules)
// into its own WebGL canvas. The 2D compositor draws `world.canvas` as one
// layer of the stage every frame, right after calling `world.render()`.
//
//   const world = await createWorld3D({ width, height, resolveUrl, loadModule, quality });
//   await world.setWorld({ id, path, opts: { marks: [...], camera: 'cliff' } });
//   world.setCamera({ from: 'pier', look: 'lamp' }, { time: 5, ease: 'inout' });
//   // each frame:
//   world.update(dt, t); world.render(); ctx.drawImage(world.canvas, 0, 0, w, h);
//
// See SHIORI-Spec.md §2.11 and §4.4.

import * as THREE from 'three';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

// Mark names, attribute values and ease names come from the script or a world
// file: look them up as own properties only, so `constructor` or `toString`
// never finds an Object.prototype member.
const own = (o, k) => (o != null && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);

// ---------------------------------------------------------------------------
// Easing

const EASE_FUNCS = {
  linear: u => u,
  in: u => u * u * u,
  out: u => 1 - Math.pow(1 - u, 3),
  // A gentle S-curve (close to CSS ease-in-out): camera flights start moving promptly.
  inout: u => 0.5 - 0.5 * Math.cos(Math.PI * u),
  back: u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
  bounce: u => {
    const n1 = 7.5625, d1 = 2.75;
    if (u < 1 / d1) return n1 * u * u;
    if (u < 2 / d1) return n1 * (u -= 1.5 / d1) * u + 0.75;
    if (u < 2.5 / d1) return n1 * (u -= 2.25 / d1) * u + 0.9375;
    return n1 * (u -= 2.625 / d1) * u + 0.984375;
  },
};
const EASE_ALIASES = { 'ease-in': 'in', easein: 'in', 'ease-out': 'out', easeout: 'out', 'ease-in-out': 'inout', easeinout: 'inout', in_out: 'inout', 'in-out': 'inout', ease: 'inout', smooth: 'inout' };

/** Returns an easing function for a Shiori ease name (unknown names → inout). */
export function easing(name) {
  const key = String(name || 'inout').toLowerCase();
  return own(EASE_FUNCS, key) || own(EASE_FUNCS, own(EASE_ALIASES, key)) || EASE_FUNCS.inout;
}

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

// ---------------------------------------------------------------------------
// Vectors and marks

function toVec3(v, out) {
  if (v == null) return null;
  if (v.isVector3) return out.copy(v);
  if (v.isObject3D) { v.updateWorldMatrix(true, false); return out.setFromMatrixPosition(v.matrixWorld); }
  if (Array.isArray(v) || ArrayBuffer.isView(v)) return v.length >= 3 ? out.set(+v[0] || 0, +v[1] || 0, +v[2] || 0) : null;
  if (typeof v === 'object' && 'x' in v) return out.set(+v.x || 0, +v.y || 0, +v.z || 0);
  return null;
}

// Disposes geometries, materials and textures under an object.
function disposeObject(root) {
  if (!root) return;
  const seen = new Set();
  root.traverse(o => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      for (const k in m) { const t = m[k]; if (t && t.isTexture && !seen.has(t)) { seen.add(t); t.dispose(); } }
      if (m.uniforms) for (const k in m.uniforms) { const t = m.uniforms[k] && m.uniforms[k].value; if (t && t.isTexture && !seen.has(t)) { seen.add(t); t.dispose(); } }
      m.dispose();
    }
    if (o.isSkinnedMesh && o.skeleton && o.skeleton.boneTexture) o.skeleton.dispose();
  });
}

function extOf(path) {
  const clean = String(path || '').split(/[?#]/)[0];
  const m = /\.([a-z0-9]+)$/i.exec(clean);
  return m ? m[1].toLowerCase() : '';
}

function errMsg(e) { return (e && (e.message || e.toString())) || String(e); }

// VRM expression mapping for character attributes.
const VRM_EXPRESSIONS = {
  smile: ['happy', 1], happy: ['happy', 1], joy: ['happy', 1], laugh: ['happy', 1], grin: ['happy', 0.8],
  smirk: ['happy', 0.35], blush: ['happy', 0.4],
  sad: ['sad', 1], cry: ['sad', 1], crying: ['sad', 1], tearful: ['sad', 0.7],
  angry: ['angry', 1], mad: ['angry', 1], annoyed: ['angry', 0.5],
  surprised: ['surprised', 1], surprise: ['surprised', 1], shocked: ['surprised', 1], shock: ['surprised', 1],
  relaxed: ['relaxed', 1], calm: ['relaxed', 0.6], content: ['relaxed', 0.8], sleepy: ['relaxed', 0.7],
  neutral: null,
};
const VRM_EXPR_NAMES = ['happy', 'sad', 'angry', 'surprised', 'relaxed'];

function attrValues(attrs) {
  const out = [];
  if (!attrs) return out;
  if (Array.isArray(attrs)) { for (const v of attrs) out.push(String(v).toLowerCase()); return out; }
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) out.push(String(k).toLowerCase());
    else if (v != null && v !== false) out.push(String(v).toLowerCase());
  }
  return out;
}

// ---------------------------------------------------------------------------

/**
 * Creates the 3D layer.
 * @param {{width:number,height:number,resolveUrl:(p:string)=>string,loadModule:(p:string)=>Promise<any>,quality?:'high'|'low'}} opts
 */
export async function createWorld3D({ width = 1280, height = 720, resolveUrl, loadModule, quality = 'high' } = {}) {
  quality = quality === 'low' ? 'low' : 'high';
  resolveUrl = typeof resolveUrl === 'function' ? resolveUrl : (p => new URL(p, document.baseURI).href);
  loadModule = typeof loadModule === 'function' ? loadModule : (p => import(resolveUrl(p)));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width | 0); canvas.height = Math.max(1, height | 0);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: quality === 'high', premultipliedAlpha: true,
      preserveDrawingBuffer: false, powerPreference: 'high-performance', stencil: false,
    });
  } catch (e) {
    throw new Error(`3D worlds need WebGL, which is not available here (${errMsg(e)}).`);
  }
  renderer.setPixelRatio(1);

  // Shader errors are collected so that a broken world rejects setWorld().
  const shaderErrors = [];
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (gl, program, vs, fs) => {
    const log = [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs)]
      .filter(s => s && s.trim()).join('\n').trim();
    shaderErrors.push(log || 'shader failed to compile');
    console.error('[world3d] shader error:\n' + log);
  };

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (!disposed) console.warn('[world3d] WebGL context lost'); }, false);

  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = canvas.width, H = canvas.height;
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 5000);
  camera.name = 'shiori_camera';

  // Scene used when no world is loaded (3D actors over a 2D background).
  const baseScene = new THREE.Scene();
  baseScene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3440, 1.6));
  const baseSun = new THREE.DirectionalLight(0xffffff, 1.6); baseSun.position.set(2, 4, 5); baseScene.add(baseSun);

  const actorRoot = new THREE.Group(); actorRoot.name = 'shiori_actors';
  baseScene.add(actorRoot);

  let current = null;          // the loaded world
  let loading = null;          // { token, decl }
  let worldToken = 0;
  let clock = 0;               // seconds, advanced by update(dt)
  let lastT = 0;
  let disposed = false;
  let renderErrorShown = false;

  // ---- sizing ----
  function applySize() {
    let s = quality === 'low' ? 0.75 : 1;
    const maxPx = quality === 'low' ? 1.1e6 : 2.6e6;
    if (W * H * s * s > maxPx) s = Math.sqrt(maxPx / (W * H));
    renderer.setSize(Math.max(1, Math.round(W * s)), Math.max(1, Math.round(H * s)), false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  applySize();

  function resetRendererState() {
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    renderer.autoClear = true;
    renderer.sortObjects = true;
  }
  resetRendererState();

  function resetCameraObject() {
    if (camera.parent) camera.parent.remove(camera);
    for (const c of [...camera.children]) { camera.remove(c); disposeObject(c); }
    camera.fov = 50; camera.near = 0.1; camera.far = 5000; camera.zoom = 1;
    camera.position.set(0, 1.6, 6); camera.up.set(0, 1, 0); camera.lookAt(0, 1.4, 0);
    camera.clearViewOffset();
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }

  // =========================================================================
  // Marks

  // A normalized mark: { src, pos(out) → Vector3|null, look(out) → Vector3|null, fov }
  function normalizeMarks(raw) {
    const out = Object.create(null);
    for (const [name, m] of Object.entries(raw || {})) {
      if (m == null) continue;
      out[name] = makeMark(name, m, raw);
    }
    return out;
  }
  function makeMark(name, m, raw) {
    const mark = { name, src: m, fov: null };
    if (m.isObject3D) {
      mark.pos = out => toVec3(m, out);
      const look = m.userData && m.userData.look;
      mark.look = look != null ? (out => resolveLookSpec(look, out, raw)) : null;
      mark.object = m;
      if (m.userData && typeof m.userData.fov === 'number') mark.fov = m.userData.fov;
    } else if (m.isVector3 || Array.isArray(m) || ArrayBuffer.isView(m)) {
      mark.pos = out => toVec3(m, out);
      mark.look = null;
    } else if (typeof m === 'object') {
      mark.pos = out => toVec3(m.position, out);
      mark.look = m.look != null ? (out => resolveLookSpec(m.look, out, raw)) : null;
      if (typeof m.fov === 'number') mark.fov = m.fov;
      if (m.object && m.object.isObject3D) mark.object = m.object;
    } else {
      mark.pos = () => null; mark.look = null;
    }
    return mark;
  }
  function resolveLookSpec(look, out, raw) {
    if (typeof look === 'function') { const r = look(out); return r && r.isVector3 ? (r === out ? out : out.copy(r)) : null; }
    if (typeof look === 'string') {
      const other = own(raw, look);
      if (!other) return null;
      if (other.isObject3D || other.isVector3 || Array.isArray(other)) return toVec3(other, out);
      return toVec3(other.position, out);
    }
    return toVec3(look, out);
  }

  const warned = new Set();
  function warnOnce(key, msg) { if (warned.has(key)) return; warned.add(key); console.warn('[world3d] ' + msg); }

  function getMark(name) { return (name && current && own(current.marks, name)) || null; }
  function markPos(name, out) { const m = getMark(name); return m ? m.pos(out) : null; }

  // =========================================================================
  // Camera

  // Live camera state.
  const cam = {
    pos: new THREE.Vector3(0, 1.6, 6), target: new THREE.Vector3(0, 1.4, 0),
    fov: 50, zoom: 1, roll: 0, panX: 0, panY: 0,
    desired: null,     // last requested camera { from, look, zoom, fov, roll, panX, panY }
    orbit: 0,          // radians, applied around the look target once settled
    tween: null,
    fovCache: -1,
  };
  let startPose = { pos: new THREE.Vector3(0, 1.6, 6), target: new THREE.Vector3(0, 1.4, 0), fov: 50 };
  let baseFov = 50;
  let pendingCamera = null;

  const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _a = new THREE.Vector3();
  const _dir = new THREE.Vector3();

  function describe(c) {
    c = c || {};
    return {
      from: c.from || null, look: c.look || null,
      zoom: num(c.zoom, 1) > 0.01 ? num(c.zoom, 1) : 1,
      fov: num(c.fov, null),
      roll: num(c.rotate, 0), panX: num(c.x, 0), panY: num(c.y, 0),
    };
  }

  // Where the camera should be for a description (live: follows animated marks / actors).
  function resolvePos(d, out) {
    if (d.from) {
      if (markPos(d.from, out)) return out;
      if (current) warnOnce('from:' + d.from, `camera from=${d.from}: no such mark in this world`);
    }
    if (!d.from || !current) return out.copy(startPose.pos);
    return out.copy(cam.pos); // unknown mark: stay
  }
  function resolveTarget(d, posNow, out) {
    if (d.look) {
      if (markPos(d.look, out)) return out;
      if (actorHead(d.look, out)) return out;
      if (current) warnOnce('look:' + d.look, `camera look=${d.look}: not a mark or a 3D actor here`);
    }
    if (d.from) {
      const m = getMark(d.from);
      if (m && m.look && m.look(out)) return out;
      if (m && m.object) {  // glTF empty: look along its -Z axis
        m.object.updateWorldMatrix(true, false);
        _dir.set(0, 0, -1).transformDirection(m.object.matrixWorld);
        return out.copy(posNow).addScaledVector(_dir, 10);
      }
      if (!m) return out.copy(cam.target);
      // mark without look: keep the viewing direction the camera had when asked
      if (!d.keepDir) { d.keepDir = new THREE.Vector3().subVectors(cam.target, cam.pos); if (d.keepDir.lengthSq() < 1e-8) d.keepDir.set(0, 0, -1); d.keepDir.normalize(); }
      return out.copy(posNow).addScaledVector(d.keepDir, 10);
    }
    return out.copy(startPose.target);
  }
  function resolveFov(d) {
    if (d.fov != null && d.fov > 1 && d.fov < 179) return d.fov;
    if (!d.from) return startPose.fov || baseFov;
    const m = getMark(d.from);
    if (m && m.fov) return m.fov;
    return baseFov;
  }

  function orbitAround(pos, target, angle) {
    if (!angle) return pos;
    _a.subVectors(pos, target).applyAxisAngle(UP, angle);
    return pos.copy(target).add(_a);
  }

  function setCameraNow(d, orbitDeg) {
    captureKeepDir(d);
    cam.desired = d;
    cam.orbit = (orbitDeg || 0) * DEG;
    cam.tween = null;
    resolvePos(d, cam.pos);
    resolveTarget(d, cam.pos, cam.target);
    orbitAround(cam.pos, cam.target, cam.orbit);
    cam.fov = resolveFov(d); cam.zoom = d.zoom; cam.roll = d.roll; cam.panX = d.panX; cam.panY = d.panY;
  }

  function captureKeepDir(d) {
    if (d.keepDir) return;
    d.keepDir = new THREE.Vector3().subVectors(cam.target, cam.pos);
    if (d.keepDir.lengthSq() < 1e-8) d.keepDir.set(0, 0, -1);
    d.keepDir.normalize();
  }

  function startCameraTween(d, time, easeName, orbitDeg) {
    captureKeepDir(d);
    const p0 = cam.pos.clone(), t0 = cam.target.clone();
    const pEnd = resolvePos(d, new THREE.Vector3());
    // Arc control point: rise above the higher end so flights clear the ground.
    const dist = p0.distanceTo(pEnd);
    const ctrl = p0.clone().add(pEnd).multiplyScalar(0.5);
    if (dist > 1.5) ctrl.y = Math.max(p0.y, pEnd.y) + Math.min(dist * 0.09, 25);
    cam.tween = {
      start: clock, dur: time, ease: easing(easeName), d,
      p0, t0, ctrl, orbit: (orbitDeg || 0) * DEG,
      fov0: cam.fov, zoom0: cam.zoom, roll0: cam.roll, panX0: cam.panX, panY0: cam.panY,
      dist,
    };
    cam.desired = d;
  }

  function stepCamera() {
    const tw = cam.tween;
    if (!tw) {
      if (!cam.desired) return;
      resolvePos(cam.desired, cam.pos);
      resolveTarget(cam.desired, cam.pos, cam.target);
      orbitAround(cam.pos, cam.target, cam.orbit);
      return;
    }
    const u = tw.dur > 0 ? clamp01((clock - tw.start) / tw.dur) : 1;
    const e = tw.ease(u);
    const pEnd = resolvePos(tw.d, _p);
    const tEnd = resolveTarget(tw.d, pEnd, _t);
    // quadratic Bézier through the arc control point
    const ie = 1 - e;
    cam.pos.set(
      ie * ie * tw.p0.x + 2 * ie * e * tw.ctrl.x + e * e * pEnd.x,
      ie * ie * tw.p0.y + 2 * ie * e * tw.ctrl.y + e * e * pEnd.y,
      ie * ie * tw.p0.z + 2 * ie * e * tw.ctrl.z + e * e * pEnd.z,
    );
    // the gaze leads the body slightly
    const eL = tw.ease(clamp01(u * 1.12));
    cam.target.lerpVectors(tw.t0, tEnd, eL);
    orbitAround(cam.pos, cam.target, tw.orbit * e);
    // keep flights above the ground when the world can tell us where it is
    if (current && current.heightAt && u > 0 && u < 1 && tw.dist > 1.5) {
      let h = NaN;
      try { h = current.heightAt(cam.pos.x, cam.pos.z); } catch (_) { /* ignore */ }
      if (isFinite(h)) {
        const floor = h + 1.1, w = Math.min(1, u * 10, (1 - u) * 10);
        if (cam.pos.y < floor) cam.pos.y += (floor - cam.pos.y) * w;
      }
    }
    const fovEnd = resolveFov(tw.d);
    cam.fov = tw.fov0 + (fovEnd - tw.fov0) * e;
    cam.zoom = Math.exp(Math.log(tw.zoom0) + (Math.log(tw.d.zoom) - Math.log(tw.zoom0)) * e);
    cam.roll = tw.roll0 + (tw.d.roll - tw.roll0) * e;
    cam.panX = tw.panX0 + (tw.d.panX - tw.panX0) * e;
    cam.panY = tw.panY0 + (tw.d.panY - tw.panY0) * e;
    if (u >= 1) finishCameraTween();
  }
  function finishCameraTween() {
    const tw = cam.tween; if (!tw) return;
    cam.tween = null;
    cam.orbit = tw.orbit;
    cam.fov = resolveFov(tw.d); cam.zoom = tw.d.zoom; cam.roll = tw.d.roll; cam.panX = tw.d.panX; cam.panY = tw.d.panY;
    stepCamera();
  }

  function applyCamera(t) {
    camera.position.copy(cam.pos);
    camera.up.copy(UP);
    if (cam.pos.distanceToSquared(cam.target) > 1e-8) camera.lookAt(cam.target);
    const fov = 2 * Math.atan(Math.tan((cam.fov * DEG) / 2) / cam.zoom) / DEG;
    if (Math.abs(fov - cam.fovCache) > 1e-4 || camera.aspect !== W / H) {
      camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix(); cam.fovCache = fov;
    }
    const vfov = fov * DEG, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    if (cam.panX) camera.rotateY(-cam.panX * hfov);
    if (cam.panY) camera.rotateX(-cam.panY * vfov);
    if (cam.roll) camera.rotateZ(cam.roll * DEG);      // positive rotate turns the picture clockwise
    if (!reducedMotion && current) {
      // a breath of handheld drift so still shots feel alive
      camera.rotateY(0.0016 * Math.sin(t * 0.37) + 0.0008 * Math.sin(t * 0.91 + 1.3));
      camera.rotateX(0.0012 * Math.sin(t * 0.29 + 0.7) + 0.0006 * Math.sin(t * 0.77 + 2.1));
    }
    camera.updateMatrixWorld();
  }

  // =========================================================================
  // Worlds

  async function compileAndCheck(scene, label) {
    shaderErrors.length = 0;
    try {
      if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
      else renderer.compile(scene, camera);
      // A first (invisible) render links every program and surfaces errors.
      renderer.render(scene, camera);
    } catch (e) {
      throw new Error(`${label}: rendering failed: ${errMsg(e)}`);
    }
    if (shaderErrors.length) {
      const first = shaderErrors[0].split('\n').filter(Boolean).slice(0, 6).join('\n');
      throw new Error(`${label}: a shader failed to compile:\n${first}`);
    }
  }

  async function buildModuleWorld(decl, label) {
    let mod;
    try { mod = await loadModule(decl.path); }
    catch (e) { throw new Error(`${label}: could not load ${decl.path}: ${errMsg(e)}`); }
    const build = mod && (typeof mod.default === 'function' ? mod.default : typeof mod.build === 'function' ? mod.build : null);
    if (!build) throw new Error(`${label}: ${decl.path} must \`export default function build({ THREE, scene, camera, marks, onUpdate })\`.`);
    const scene = new THREE.Scene();
    const rawMarks = {};
    const updaters = [];
    const onUpdate = fn => { if (typeof fn === 'function') updaters.push({ fn, errors: 0 }); };
    let ret;
    try {
      ret = await build({ THREE, scene, camera, renderer, marks: rawMarks, onUpdate, quality });
    } catch (e) {
      disposeObject(scene);
      const err = new Error(`${label}: ${decl.path} failed while building: ${errMsg(e)}`);
      err.cause = e;
      throw err;
    }
    ret = ret && typeof ret === 'object' ? ret : {};
    return {
      scene, rawMarks, updaters, mixers: [],
      heightAt: typeof ret.heightAt === 'function' ? ret.heightAt : null,
      disposeHook: typeof ret.dispose === 'function' ? ret.dispose : null,
    };
  }

  async function loadGLTF(url, vrmLib) {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    try {
      const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
      loader.setMeshoptDecoder(MeshoptDecoder);
    } catch (_) { /* optional */ }
    try {
      const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
      const draco = new DRACOLoader();
      draco.setDecoderPath(import.meta.resolve ? import.meta.resolve('three/addons/libs/draco/gltf/') : 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
      loader.setDRACOLoader(draco);
    } catch (_) { /* optional */ }
    if (vrmLib) loader.register(parser => new vrmLib.VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(url);
    return { gltf, vrmLib };
  }

  async function buildGLTFWorld(decl, label) {
    let gltf;
    try { ({ gltf } = await loadGLTF(resolveUrl(decl.path), null)); }
    catch (e) { throw new Error(`${label}: could not load ${decl.path}: ${errMsg(e)}`); }
    const scene = new THREE.Scene();
    const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
    if (!root) throw new Error(`${label}: ${decl.path} contains no scene.`);
    scene.add(root);
    root.updateMatrixWorld(true);
    const rawMarks = Object.create(null);  // node names from the file
    const byName = Object.create(null);
    root.traverse(o => { if (o.name) byName[o.name.toLowerCase()] = o; });
    root.traverse(o => {
      const m = /^mark_(.+)$/i.exec(o.name || '');
      if (!m || /_look$/i.test(m[1])) return;
      const name = m[1];
      const lookObj = byName[('mark_' + name + '_look').toLowerCase()];
      if (lookObj) o.userData.look = lookObj;
      else if (Array.isArray(o.userData.look)) { /* extras.look = [x,y,z] */ }
      rawMarks[name] = o;
    });
    let hasLight = false;
    root.traverse(o => { if (o.isLight) hasLight = true; });
    if (!hasLight) {
      scene.add(new THREE.HemisphereLight(0xe8eeff, 0x40404a, 1.3));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(30, 50, 20); scene.add(sun);
    }
    try {
      const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.6;
      pmrem.dispose();
    } catch (_) { /* optional */ }
    const mixers = [];
    if (gltf.animations && gltf.animations.length) {
      const mixer = new THREE.AnimationMixer(root);
      for (const clip of gltf.animations) mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
      mixers.push(mixer);
    }
    // A camera inside the file gives the default view.
    let fileCam = null;
    if (gltf.cameras && gltf.cameras.length) fileCam = gltf.cameras[0];
    if (fileCam) {
      fileCam.updateWorldMatrix(true, false);
      camera.position.setFromMatrixPosition(fileCam.matrixWorld);
      camera.quaternion.setFromRotationMatrix(fileCam.matrixWorld);
      if (fileCam.isPerspectiveCamera) camera.fov = fileCam.fov;
    } else {
      const box = new THREE.Box3().setFromObject(root);
      if (!box.isEmpty()) {
        const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
        const r = Math.max(s.x, s.y, s.z) * 0.6 || 5;
        camera.position.set(c.x, c.y + r * 0.35, c.z + r * 1.6);
        camera.lookAt(c);
        camera.far = Math.max(5000, r * 20);
      }
    }
    camera.updateProjectionMatrix();
    return { scene, rawMarks, updaters: [], mixers, heightAt: null, disposeHook: null };
  }

  function disposeWorld(w) {
    if (!w) return;
    try { if (w.disposeHook) w.disposeHook(); } catch (e) { console.warn('[world3d] world dispose hook failed:', e); }
    if (actorRoot.parent === w.scene) w.scene.remove(actorRoot);
    if (camera.parent) camera.parent.remove(camera);
    for (const c of [...camera.children]) { camera.remove(c); disposeObject(c); }
    for (const m of w.mixers) m.stopAllAction();
    if (w.scene.environment && w.scene.environment.dispose) w.scene.environment.dispose();
    if (w.scene.background && w.scene.background.isTexture) w.scene.background.dispose();
    disposeObject(w.scene);
    renderer.renderLists.dispose();
  }

  // setWorld calls run one at a time; a call superseded before it starts is skipped.
  let worldChain = Promise.resolve();
  function setWorld(decl) {
    if (disposed) return Promise.reject(new Error('world3d: setWorld() after dispose()'));
    if (!decl || !decl.path) return Promise.reject(new Error('world3d: setWorld() needs { id, path }'));
    const token = ++worldToken;
    loading = { token, decl };
    const run = worldChain.then(() => (token === worldToken && !disposed ? doSetWorld(decl, token) : undefined));
    worldChain = run.catch(() => {});
    return run;
  }

  function abandon(w) {
    if (current === w) current = null;
    if (actorRoot.parent === w.scene) w.scene.remove(actorRoot);
    baseScene.add(actorRoot);
    disposeWorld(w);
    resetRendererState();
    resetCameraObject();
  }

  async function doSetWorld(decl, token) {
    const opts = decl.opts || {};
    const label = `World "${decl.id || decl.path}"`;
    const finishLoading = () => { if (loading && loading.token === token) loading = null; };

    // Same world already showing: just go back to its start camera.
    if (current && current.path === decl.path) {
      current.decl = decl;
      finishLoading();
      applyStartCamera(opts.camera);
      applyPendingCamera();
      return;
    }

    const ext = extOf(decl.path);
    // Build into a clean renderer / camera state.
    if (current) { const prev = current; current = null; if (actorRoot.parent === prev.scene) prev.scene.remove(actorRoot); baseScene.add(actorRoot); disposeWorld(prev); }
    resetRendererState();
    resetCameraObject();
    let built;
    try {
      if (ext === 'js' || ext === 'mjs') built = await buildModuleWorld(decl, label);
      else if (ext === 'glb' || ext === 'gltf') built = await buildGLTFWorld(decl, label);
      else throw new Error(`${label}: unsupported world file ${decl.path} (use .js, .glb or .gltf).`);
    } catch (e) {
      finishLoading();
      resetRendererState(); resetCameraObject();
      throw e;
    }
    if (token !== worldToken || disposed) {
      try { if (built.disposeHook) built.disposeHook(); } catch (_) { /* ignore */ }
      disposeObject(built.scene);
      return;
    }

    const w = {
      id: decl.id, path: decl.path, decl, scene: built.scene,
      marks: normalizeMarks(built.rawMarks), rawMarks: built.rawMarks,
      updaters: built.updaters, mixers: built.mixers, heightAt: built.heightAt, disposeHook: built.disposeHook,
    };
    baseFov = camera.fov > 1 && camera.fov < 179 ? camera.fov : 50;
    // Default pose = wherever the module left the camera.
    camera.updateMatrixWorld();
    const defPos = camera.position.clone();
    const defTarget = defPos.clone().add(new THREE.Vector3(0, 0, -10).applyQuaternion(camera.quaternion));
    startPose = { pos: defPos, target: defTarget, fov: baseFov };

    // Check declared marks.
    const declared = Array.isArray(opts.marks) ? opts.marks : typeof opts.marks === 'string' ? opts.marks.split(/[\s,]+/).filter(Boolean) : [];
    const missing = declared.filter(n => !own(w.marks, n));
    if (missing.length) console.warn(`[world3d] ${label} does not define mark(s): ${missing.join(', ')}`);

    // Make sure actors can be lit even in worlds that use only custom shaders.
    let hasLight = false;
    w.scene.traverse(o => { if (o.isLight) hasLight = true; });
    if (!hasLight) w.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x303040, 1.2));

    current = w;
    baseScene.remove(actorRoot);
    w.scene.add(actorRoot);
    applyStartCamera(opts.camera);
    applyCamera(lastT);

    // Run the world's updaters once: a world that throws here is broken.
    for (const u of w.updaters) {
      try { u.fn(0, lastT); }
      catch (e) { abandon(w); finishLoading(); throw new Error(`${label}: its onUpdate callback failed: ${errMsg(e)}`); }
    }
    try { await compileAndCheck(w.scene, label); }
    catch (e) { if (current === w) abandon(w); finishLoading(); throw e; }
    finishLoading();
    if (current !== w) return;
    // Actors that stand on marks move to this world's marks.
    for (const a of actors.values()) placeActor(a, a.state, 0);
    applyPendingCamera();
  }

  function applyPendingCamera() {
    if (!pendingCamera || loading) return;
    const pc = pendingCamera; pendingCamera = null;
    setCameraNow(pc.d, pc.orbit);
  }

  // The start camera is also where `@camera reset` (from/look = null) returns to.
  function applyStartCamera(markName) {
    const m = markName ? getMark(markName) : null;
    const p = new THREE.Vector3();
    if (m && m.pos(p)) {
      const d = describe({ from: markName });
      const t = resolveTarget(d, p, new THREE.Vector3());
      startPose = { pos: p.clone(), target: t.clone(), fov: m.fov || baseFov };
      setCameraNow(d, 0);
    } else {
      if (markName) warnOnce('start:' + markName, `camera=${markName}: no such mark; using the world's default view`);
      setCameraNow(describe({}), 0);
    }
  }

  function clear() {
    worldToken++;
    loading = null;
    pendingCamera = null;
    if (current) { disposeWorld(current); current = null; }
    baseScene.add(actorRoot);
    resetRendererState();
    resetCameraObject();
    baseFov = 35;
    startPose = { pos: new THREE.Vector3(0, 1.35, 4.2), target: new THREE.Vector3(0, 1.0, 0), fov: 35 };
    setCameraNow(describe({}), 0);
  }

  function setCamera(c, { time = 0, ease = 'inout', orbit = 0 } = {}) {
    const d = describe(c);
    time = Math.max(0, num(time, 0));
    orbit = num(orbit, 0);
    if (loading || !current) { pendingCamera = { d, orbit }; return; }
    if (reducedMotion && orbit) time = 0;           // no sweeping orbits for reduced-motion users
    if (time <= 0) { setCameraNow(d, orbit); return; }
    startCameraTween(d, time, ease, orbit);
  }

  // =========================================================================
  // Actors

  const actors = new Map();   // id → entry
  let speakingId = null;

  function actorHead(id, out) {
    const a = actors.get(id);
    if (!a || !a.obj || a.hiding) return null;
    if (a.headBone) { a.headBone.updateWorldMatrix(true, false); return out.setFromMatrixPosition(a.headBone.matrixWorld); }
    a.root.updateWorldMatrix(true, false);
    return a.root.localToWorld(out.set(0, a.height * 0.88, 0));
  }

  // Where an actor stands: at its mark, or in front of the current view.
  // In front of the view: about 4 units ahead, x across the screen, standing on the
  // ground when the world says where it is. If the camera looks up so far that the
  // actor's head would leave the frame, it steps back (up to 8 units) and, failing
  // that, is framed in the air like a sprite.
  function placementFor(state, height) {
    const pos = new THREE.Vector3();
    let yaw = null;
    const m = state.mark ? getMark(state.mark) : null;
    if (m && m.pos(pos)) {
      if (m.object) {
        const q = new THREE.Quaternion(); m.object.getWorldQuaternion(q);
        const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        yaw = Math.atan2(f.x, f.z);
      }
      return { pos, yaw };
    }
    if (state.mark) warnOnce('actor-mark:' + state.mark, `actor at=${state.mark}: no such mark; placing it in front of the camera`);
    // use the logical camera (setCamera may have been called this frame)
    const view = new THREE.Vector3().subVectors(cam.target, cam.pos);
    if (view.lengthSq() < 1e-8) view.set(0, 0, -1);
    view.normalize();
    const pitch = Math.asin(Math.max(-1, Math.min(1, view.y)));
    const fwd = view.clone(); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const vfov = 2 * Math.atan(Math.tan(cam.fov * DEG / 2) / cam.zoom), half = vfov / 2;
    const x = num(state.x, 0.5), yOff = num(state.y, 0);
    const h = Math.max(0.2, height || 1.6);
    const groundAt = p => {
      let g = NaN;
      if (current && current.heightAt) { try { g = current.heightAt(p.x, p.z); } catch (_) { /* ignore */ } }
      return isFinite(g) && g > cam.pos.y - 8 && g < cam.pos.y + 1 ? g : cam.pos.y - 1.6;
    };
    let ok = false;
    for (let d = 4; d <= 8.01; d += 0.5) {
      const hw = d * Math.tan(half) * (W / H);
      pos.copy(cam.pos).addScaledVector(fwd, d).addScaledVector(right, (x - 0.5) * 2 * hw * 0.9);
      pos.y = groundAt(pos);
      const head = Math.atan2(pos.y + h - cam.pos.y, d) - pitch;
      if (head > -0.55 * half) { ok = true; if (yOff) pos.y -= yOff * 2 * d * Math.tan(half); break; }
    }
    if (!ok) {
      const d = 4, hw = d * Math.tan(half) * (W / H);
      pos.copy(cam.pos).addScaledVector(view, d).addScaledVector(right, (x - 0.5) * 2 * hw * 0.9);
      pos.y += -0.1 * 2 * d * Math.tan(half) - h * 0.75 - yOff * 2 * d * Math.tan(half);
    }
    return { pos, yaw };
  }

  function placeActor(a, state, time, easeName) {
    a.state = state;
    const s = Math.max(0.0001, num(state.scale, 1) * a.declScale);
    const pl = placementFor(state, a.obj ? a.height * s : 1.6 * s);
    const sx = state.flip ? -s : s;
    if (pl.yaw == null) a.faceCamera = true; else { a.faceCamera = false; a.fixedYaw = pl.yaw; }
    if (!time || time <= 0 || !a.placed) {
      a.root.position.copy(pl.pos);
      a.root.scale.set(sx, s, s);
      a.move = null;
      if (!a.faceCamera) a.root.rotation.set(0, pl.yaw, 0);
      else a.root.rotation.set(0, yawToCamera(a.root.position), 0);
      a.placed = true;
      return;
    }
    a.move = {
      start: clock, dur: time, ease: easing(easeName),
      p0: a.root.position.clone(), p1: pl.pos,
      s0: a.root.scale.clone(), s1: new THREE.Vector3(sx, s, s),
    };
  }

  function yawToCamera(p) { return Math.atan2(cam.pos.x - p.x, cam.pos.z - p.z); }

  function collectMaterials(a) {
    a.mats = [];
    a.obj.traverse(o => {
      if (!o.material) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (a.mats.some(r => r.m === m)) continue;
        a.mats.push({ m, opacity: m.opacity != null ? m.opacity : 1, transparent: !!m.transparent, uniformOpacity: m.uniforms && m.uniforms.opacity ? m.uniforms.opacity.value : null });
      }
    });
  }
  function applyAlpha(a, alpha) {
    if (!a.obj) return;
    const s = 0.9 + 0.1 * EASE_FUNCS.out(alpha);
    a.holder.scale.setScalar(s);
    a.holder.visible = alpha > 0.002;
    const faded = alpha < 0.999;
    if (a.fadedState !== faded) {
      for (const r of a.mats) { r.m.transparent = faded ? true : r.transparent; r.m.needsUpdate = true; }
      a.fadedState = faded;
    }
    for (const r of a.mats) {
      if ('opacity' in r.m) r.m.opacity = r.opacity * alpha;
      if (r.uniformOpacity != null && r.m.uniforms.opacity) r.m.uniforms.opacity.value = r.uniformOpacity * alpha;
    }
  }

  async function loadActorObject(path, attrs) {
    const ext = extOf(path);
    if (ext === 'js' || ext === 'mjs') {
      const mod = await loadModule(path);
      const build = mod && (typeof mod.default === 'function' ? mod.default : typeof mod.build === 'function' ? mod.build : null);
      if (!build) throw new Error(`${path} must \`export default function build({ THREE, group, attrs })\``);
      const group = new THREE.Group();
      const api = (await build({ THREE, group, attrs: { ...(attrs || {}) }, quality })) || {};
      return { obj: group, api };
    }
    if (ext === 'vrm') {
      let vrmLib;
      try { vrmLib = await import('@pixiv/three-vrm'); }
      catch (e) { console.warn(`[world3d] VRM support (@pixiv/three-vrm) is not available (${errMsg(e)}); ${path} is not shown.`); return null; }
      const res = await loadGLTF(resolveUrl(path), vrmLib);
      const vrm = res.gltf.userData.vrm;
      if (!vrm) { console.warn(`[world3d] ${path} is not a VRM file; showing it as glTF.`); return gltfActor(res.gltf); }
      const U = res.vrmLib.VRMUtils;
      try { U.removeUnnecessaryVertices(res.gltf.scene); } catch (_) { /* optional */ }
      try { (U.combineSkeletons || U.removeUnnecessaryJoints).call(U, res.gltf.scene); } catch (_) { /* optional */ }
      try { U.rotateVRM0(vrm); } catch (_) { /* optional */ }
      vrm.scene.traverse(o => { o.frustumCulled = false; });
      const hum = vrm.humanoid;
      const bone = n => (hum && (hum.getNormalizedBoneNode ? hum.getNormalizedBoneNode(n) : hum.getBoneNode(n))) || null;
      const la = bone('leftUpperArm'), ra = bone('rightUpperArm');
      if (la) la.rotation.z = -1.2;
      if (ra) ra.rotation.z = 1.2;
      const head = hum && (hum.getRawBoneNode ? hum.getRawBoneNode('head') : bone('head'));
      if (vrm.lookAt) vrm.lookAt.target = camera;
      return { obj: vrm.scene, vrm, headBone: head || null };
    }
    if (ext === 'glb' || ext === 'gltf') {
      const { gltf } = await loadGLTF(resolveUrl(path), null);
      return gltfActor(gltf);
    }
    throw new Error(`unsupported model file ${path} (use .glb, .gltf, .vrm or .js)`);
  }
  function gltfActor(gltf) {
    const obj = gltf.scene || gltf.scenes[0];
    let mixer = null;
    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(obj);
      const clip = gltf.animations.find(c => /idle/i.test(c.name)) || gltf.animations[0];
      mixer.clipAction(clip).play();
    }
    return { obj, mixer };
  }

  function modelPathFor(actor, decl) {
    if (!decl) return null;
    if (actor.kind === 'character') return decl.model || (decl.opts && decl.opts.model) || null;
    return decl.path || decl.model || null;
  }

  async function showActor(actor, decl, { time = 0.4 } = {}) {
    if (!actor || !actor.id) return;
    const path = modelPathFor(actor, decl);
    if (!path) return; // a 2D-only character: the compositor draws it
    const state = { ...actor, attrs: { ...(actor.attrs || {}) } };
    time = Math.max(0, num(time, 0.4));
    const existing = actors.get(actor.id);
    if (existing && existing.path === path) {
      existing.hiding = false;
      if (existing.obj) existing.fade = { start: clock, dur: time, from: existing.alpha, to: 1 };
      else existing.showTime = time;
      updateActor(state, { time: existing.obj ? time : 0 });
      return existing.ready;
    }
    if (existing) removeActor(existing);

    const declScale = actor.kind === 'model' ? num(decl.opts && decl.opts.scale, num(decl.scale, 1)) : num(decl.modelScale, 1);
    const a = {
      id: actor.id, kind: actor.kind, path, state, declScale,
      root: new THREE.Group(), holder: new THREE.Group(), obj: null, api: null, vrm: null, mixer: null,
      alpha: 0, fade: null, showTime: time, hiding: false, removed: false,
      height: 1.6, mats: [], fadedState: null, placed: false, speaking: false,
      expr: Object.create(null), exprTarget: Object.create(null), blink: { next: 2 + Math.random() * 3, t: -1 }, mouth: 0,
    };
    a.root.name = 'actor_' + actor.id;
    a.root.add(a.holder);
    actors.set(actor.id, a);
    actorRoot.add(a.root);
    placeActor(a, state, 0);

    a.ready = (async () => {
      let res;
      try { res = await loadActorObject(path, state.attrs); }
      catch (e) {
        if (actors.get(a.id) === a) removeActor(a);
        throw new Error(`3D ${actor.kind || 'model'} "${actor.id}": could not load ${path}: ${errMsg(e)}`);
      }
      if (!res) { if (actors.get(a.id) === a) removeActor(a); return; }
      if (a.removed) { disposeObject(res.obj); return; }
      a.obj = res.obj; a.api = res.api || null; a.vrm = res.vrm || null; a.mixer = res.mixer || null; a.headBone = res.headBone || null;
      if (a.obj.parent) a.obj.parent.remove(a.obj);
      a.obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(a.obj);   // model space: the model is not parented yet
      if (!box.isEmpty()) a.height = Math.max(0.1, box.max.y);
      a.holder.add(a.obj);
      collectMaterials(a);
      applyAlpha(a, a.alpha);
      applyAttrs(a, a.state.attrs);
      if (a.speaking && a.api && a.api.setSpeaking) safeCall(a, () => a.api.setSpeaking(true));
      placeActor(a, a.state, 0);
      a.alpha = 0;
      a.fade = { start: clock, dur: a.showTime, from: 0, to: 1 };
      applyAlpha(a, 0);
    })();
    // Keep the speaking state consistent for actors shown while someone is talking.
    a.speaking = speakingId === actor.id;
    return a.ready;
  }

  function safeCall(a, fn) {
    try { fn(); }
    catch (e) { a.errors = (a.errors || 0) + 1; if (a.errors <= 3) console.warn(`[world3d] actor "${a.id}" model error:`, e); }
  }

  function applyAttrs(a, attrs) {
    if (a.api && typeof a.api.setAttrs === 'function') safeCall(a, () => a.api.setAttrs({ ...(attrs || {}) }));
    if (a.vrm && a.vrm.expressionManager) {
      const target = Object.create(null);
      for (const n of VRM_EXPR_NAMES) target[n] = 0;
      for (const v of attrValues(attrs)) {
        const m = own(VRM_EXPRESSIONS, v);
        if (m) target[m[0]] = Math.max(target[m[0]], m[1]);
        else if (m === undefined && a.vrm.expressionManager.getExpression && a.vrm.expressionManager.getExpression(v)) target[v] = 1;
      }
      a.exprTarget = target;
    }
  }

  function updateActor(actor, { time = 0, ease = 'inout' } = {}) {
    if (!actor || !actor.id) return;
    const a = actors.get(actor.id);
    if (!a) return;
    const prev = a.state || {};
    const state = { ...prev, ...actor, attrs: { ...(actor.attrs || prev.attrs || {}) } };
    if (a.obj && JSON.stringify(prev.attrs || {}) !== JSON.stringify(state.attrs)) applyAttrs(a, state.attrs);
    else if (!a.obj) a.state = state;
    const moved = prev.mark !== state.mark || prev.x !== state.x || prev.y !== state.y || prev.scale !== state.scale || !!prev.flip !== !!state.flip;
    if (moved || !a.placed) placeActor(a, state, Math.max(0, num(time, 0)), ease);
    else a.state = state;
  }

  function removeActor(a) {
    a.removed = true;
    if (actors.get(a.id) === a) actors.delete(a.id);
    if (a.root.parent) a.root.parent.remove(a.root);
    if (a.obj) disposeObject(a.obj);
    a.obj = null;
  }

  function hideActor(id, { time = 0.4 } = {}) {
    const a = actors.get(id);
    if (!a) return;
    time = Math.max(0, num(time, 0.4));
    a.hiding = true;
    if (!a.obj || time <= 0) { removeActor(a); return; }
    a.fade = { start: clock, dur: time, from: a.alpha, to: 0 };
  }

  function setSpeaking(id) {
    speakingId = id || null;
    for (const a of actors.values()) {
      const s = a.id === speakingId;
      if (s === a.speaking) continue;
      a.speaking = s;
      if (a.api && typeof a.api.setSpeaking === 'function') safeCall(a, () => a.api.setSpeaking(s));
    }
  }

  function stepActors(dt, t) {
    for (const a of [...actors.values()]) {
      try {
        // fades
        if (a.fade && a.obj) {
          const u = a.fade.dur > 0 ? clamp01((clock - a.fade.start) / a.fade.dur) : 1;
          a.alpha = a.fade.from + (a.fade.to - a.fade.from) * EASE_FUNCS.inout(u);
          if (u >= 1) { a.alpha = a.fade.to; a.fade = null; if (a.hiding) { removeActor(a); continue; } }
          applyAlpha(a, a.alpha);
        }
        // moves
        if (a.move) {
          const m = a.move, u = m.dur > 0 ? clamp01((clock - m.start) / m.dur) : 1, e = m.ease(u);
          a.root.position.lerpVectors(m.p0, m.p1, e);
          a.root.scale.lerpVectors(m.s0, m.s1, e);
          if (u >= 1) a.move = null;
        }
        // facing
        if (a.faceCamera) {
          const want = yawToCamera(a.root.position);
          let d = want - a.root.rotation.y;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          a.root.rotation.y += d * Math.min(1, dt * 3);
        } else if (a.fixedYaw != null && !a.move) a.root.rotation.y = a.fixedYaw;
        if (!a.obj) continue;
        if (a.mixer) a.mixer.update(dt);
        if (a.api && typeof a.api.update === 'function') safeCall(a, () => a.api.update(dt, t));
        if (a.vrm) stepVRM(a, dt, t);
      } catch (e) {
        a.errors = (a.errors || 0) + 1;
        if (a.errors <= 3) console.warn(`[world3d] actor "${a.id}" update failed:`, e);
      }
    }
  }

  function stepVRM(a, dt, t) {
    const em = a.vrm.expressionManager;
    if (em) {
      const k = Math.min(1, dt * 8);
      for (const [n, v] of Object.entries(a.exprTarget)) {
        const cur = a.expr[n] || 0, nv = cur + (v - cur) * k;
        a.expr[n] = nv;
        try { em.setValue(n, nv); } catch (_) { /* expression missing */ }
      }
      // blink
      const b = a.blink;
      b.next -= dt;
      if (b.next <= 0 && b.t < 0) { b.t = 0; }
      if (b.t >= 0) {
        b.t += dt;
        const bv = b.t < 0.07 ? b.t / 0.07 : b.t < 0.16 ? 1 - (b.t - 0.07) / 0.09 : 0;
        try { em.setValue('blink', (a.expr.happy || 0) > 0.6 ? 0 : bv); } catch (_) { /* none */ }
        if (b.t >= 0.16) { b.t = -1; b.next = 2 + Math.random() * 4; }
      }
      // mouth
      const target = a.speaking ? 0.25 + 0.5 * Math.max(0, Math.sin(t * 17) * 0.6 + Math.sin(t * 9.3 + 1) * 0.4) : 0;
      a.mouth += (target - a.mouth) * Math.min(1, dt * 20);
      try { em.setValue('aa', a.mouth); } catch (_) { /* none */ }
    }
    a.vrm.update(dt);
  }

  // =========================================================================
  // Frame

  function update(dt, t) {
    if (disposed) return;
    dt = num(dt, 0); if (dt < 0) dt = 0;
    clock += dt;
    lastT = num(t, clock);
    const wdt = Math.min(dt, 0.25);
    try { stepCamera(); applyCamera(lastT); }
    catch (e) { warnOnce('camera-step', 'camera update failed: ' + errMsg(e)); }
    stepActors(wdt, lastT);
    const w = current;
    if (!w) return;
    for (const m of w.mixers) { try { m.update(wdt); } catch (_) { /* ignore */ } }
    for (const u of w.updaters) {
      if (u.errors > 50) continue;
      try { u.fn(wdt, lastT); }
      catch (e) {
        u.errors++;
        if (u.errors === 1) console.error(`[world3d] world "${w.id}" onUpdate failed:`, e);
        if (u.errors === 51) console.error(`[world3d] world "${w.id}" onUpdate disabled after repeated errors.`);
      }
    }
  }

  function render() {
    if (disposed) return;
    try {
      if (!current && actors.size === 0) {
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        return;
      }
      renderer.render(current ? current.scene : baseScene, camera);
    } catch (e) {
      if (!renderErrorShown) { renderErrorShown = true; console.error('[world3d] render failed:', e); }
    }
  }

  function resize(width2, height2) {
    W = Math.max(1, width2 | 0); H = Math.max(1, height2 | 0);
    applySize();
    cam.fovCache = -1;
  }

  function skipTweens() {
    if (cam.tween) finishCameraTween();
    for (const a of [...actors.values()]) {
      if (a.move) { a.root.position.copy(a.move.p1); a.root.scale.copy(a.move.s1); a.move = null; }
      if (a.fade) {
        a.alpha = a.fade.to; a.fade = null;
        if (a.hiding) { removeActor(a); continue; }
        applyAlpha(a, a.alpha);
      }
    }
    try { applyCamera(lastT); } catch (_) { /* ignore */ }
  }

  function dispose() {
    if (disposed) return;
    clear();
    for (const a of [...actors.values()]) removeActor(a);
    disposed = true;
    disposeObject(baseScene);
    renderer.renderLists.dispose();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (_) { /* ignore */ }
  }

  clear();

  const world = {
    canvas,
    get quality() { return quality; },
    get camera() { return camera; },
    get worldId() { return current ? current.id : null; },
    setWorld,
    clear,
    setCamera,
    skipTweens,
    showActor,
    updateActor,
    hideActor,
    setSpeaking,
    markNames: () => (current ? Object.keys(current.marks) : []),
    hasMark: name => !!(current && name && own(current.marks, name)),
    update,
    render,
    resize,
    dispose,
    /** True while a camera flight is running. */
    get busy() { return !!cam.tween; },
  };
  return world;
}

export default createWorld3D;
