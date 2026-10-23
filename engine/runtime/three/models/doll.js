// A small chibi doll built from primitives — an example Shiori model module.
//
//   @model doll models/doll.js           (or  @character x  model: models/doll.js)
//
// Model module contract (SHIORI-Spec §4.4):
//   export default function build({ THREE, group, attrs }) → { setAttrs(attrs), setSpeaking(bool), update(dt, t) }
// The figure faces +Z, stands on y = 0 and is about 1.2 units tall.
// Attributes it understands: neutral, smile/happy, sad, surprised, angry, blush.

export default function build({ THREE, group, attrs }) {
  const grad = new THREE.DataTexture(new Uint8Array([90, 175, 255]), 3, 1, THREE.RedFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter;
  grad.generateMipmaps = false;
  grad.needsUpdate = true;
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: grad, ...extra });

  const M = {
    skin: toon('#ffe1d2'), hair: toon('#2d3557'), dress: toon('#7fa6dd'),
    collar: toon('#fbf7f0'), sock: toon('#283048'), shoe: toon('#6a4433'), ribbon: toon('#f08aa6'),
    eye: new THREE.MeshBasicMaterial({ color: '#1d2240' }), white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    mouth: new THREE.MeshBasicMaterial({ color: '#7a2b3a' }), line: new THREE.MeshBasicMaterial({ color: '#3a2630' }),
    blush: new THREE.MeshBasicMaterial({ color: '#ff8fa8', transparent: true, opacity: 0, depthWrite: false }),
  };
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  const body = new THREE.Group(); group.add(body);
  // legs and shoes
  for (const s of [-1, 1]) {
    mesh(new THREE.CapsuleGeometry(0.055, 0.16, 4, 10), M.sock, s * 0.075, 0.15, 0, body);
    const shoe = mesh(new THREE.SphereGeometry(0.075, 14, 10), M.shoe, s * 0.075, 0.04, 0.025, body);
    shoe.scale.set(0.9, 0.55, 1.35);
  }
  // dress: a little bell
  const dressProf = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; dressProf.push(new THREE.Vector2(0.27 - 0.15 * Math.pow(t, 0.8) + 0.02 * Math.sin(t * Math.PI), 0.2 + t * 0.44)); }
  dressProf.unshift(new THREE.Vector2(0.0, 0.2));
  dressProf.push(new THREE.Vector2(0.0, 0.66));
  mesh(new THREE.LatheGeometry(dressProf, 28), M.dress, 0, 0, 0, body);
  const collar = mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 24), M.collar, 0, 0.64, 0, body);
  collar.rotation.x = Math.PI / 2;
  const bow = new THREE.Group(); bow.position.set(0, 0.6, 0.12); body.add(bow);
  for (const s of [-1, 1]) { const b = mesh(new THREE.ConeGeometry(0.04, 0.08, 10), M.ribbon, s * 0.04, 0, 0, bow); b.rotation.z = s * Math.PI / 2; }
  mesh(new THREE.SphereGeometry(0.02, 8, 6), M.ribbon, 0, 0, 0.005, bow);
  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(s * 0.14, 0.6, 0); body.add(shoulder);
    mesh(new THREE.CapsuleGeometry(0.04, 0.2, 4, 8), M.dress, 0, -0.12, 0, shoulder);
    mesh(new THREE.SphereGeometry(0.045, 10, 8), M.skin, 0, -0.26, 0.01, shoulder);
    shoulder.rotation.z = s * 0.28;
    arms.push(shoulder);
  }

  // head
  const head = new THREE.Group(); head.position.set(0, 0.9, 0); body.add(head);
  mesh(new THREE.SphereGeometry(0.27, 32, 24), M.skin, 0, 0, 0, head);
  const hair = mesh(new THREE.SphereGeometry(0.295, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.62), M.hair, 0, 0.015, -0.02, head);
  hair.rotation.x = -0.32;
  const back = mesh(new THREE.SphereGeometry(0.285, 24, 18), M.hair, 0, -0.03, -0.06, head);
  back.scale.set(1.0, 1.02, 0.92);
  for (let i = 0; i < 5; i++) {  // bangs
    const a = (i - 2) * 0.32;
    const b = mesh(new THREE.CapsuleGeometry(0.05, 0.1, 4, 8), M.hair, Math.sin(a) * 0.22, 0.13 - Math.abs(i - 2) * 0.02, Math.cos(a) * 0.2, head);
    b.rotation.set(0.5, 0, -a * 0.6);
  }
  const tails = [];
  for (const s of [-1, 1]) {  // short side tails with ribbons
    const piv = new THREE.Group(); piv.position.set(s * 0.25, 0.04, -0.05); head.add(piv);
    const t = mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 10), M.hair, s * 0.03, -0.14, 0, piv);
    t.rotation.z = s * 0.25;
    const r = mesh(new THREE.TorusGeometry(0.045, 0.018, 6, 14), M.ribbon, 0, -0.01, 0, piv);
    r.rotation.y = Math.PI / 2;
    tails.push(piv);
  }
  // face
  const face = new THREE.Group(); head.add(face);
  const eyes = [], happyEyes = [], brows = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * 0.095, -0.01, 0.247); face.add(e);
    const ball = mesh(new THREE.SphereGeometry(1, 16, 12), M.eye, 0, 0, 0, e); ball.scale.set(0.042, 0.062, 0.02);
    const hl = mesh(new THREE.SphereGeometry(0.014, 8, 6), M.white, s * -0.012, 0.022, 0.016, e); void hl;
    const hl2 = mesh(new THREE.SphereGeometry(0.007, 6, 5), M.white, s * 0.012, -0.02, 0.016, e); void hl2;
    eyes.push(e);
    const he = mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 16, Math.PI), M.line, s * 0.095, -0.015, 0.252, face);
    he.visible = false; happyEyes.push(he);
    const br = mesh(new THREE.CapsuleGeometry(0.008, 0.05, 3, 6), M.line, s * 0.095, 0.075, 0.245, face);
    br.rotation.z = Math.PI / 2; brows.push(br);
  }
  const mouths = {
    line: mesh(new THREE.CapsuleGeometry(0.007, 0.035, 3, 6), M.line, 0, -0.11, 0.245, face),
    smile: mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 16, Math.PI), M.line, 0, -0.095, 0.246, face),
    sad: mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 16, Math.PI), M.line, 0, -0.125, 0.244, face),
    o: mesh(new THREE.TorusGeometry(0.022, 0.009, 6, 16), M.mouth, 0, -0.115, 0.244, face),
    open: mesh(new THREE.SphereGeometry(1, 14, 10), M.mouth, 0, -0.11, 0.24, face),
  };
  mouths.line.rotation.z = Math.PI / 2;
  mouths.smile.rotation.z = Math.PI;
  mouths.open.scale.set(0.03, 0.02, 0.012);
  const cheeks = [];
  for (const s of [-1, 1]) {
    const c = mesh(new THREE.CircleGeometry(0.04, 18), M.blush, s * 0.15, -0.07, 0.218, face);
    c.rotation.y = s * 0.55; c.scale.y = 0.6;
    cheeks.push(c);
  }

  // ---- state ----
  let mood = 'neutral', blush = 0, blushTarget = 0, speaking = false, mouthOpen = 0;
  let blinkIn = 2 + Math.random() * 2, blinkT = -1, tilt = 0, tiltTarget = 0;

  function setAttrs(a) {
    const vals = [];
    for (const [k, v] of Object.entries(a || {})) { if (v === true) vals.push(k); else if (v) vals.push(String(v)); }
    const has = n => vals.some(v => v.toLowerCase() === n);
    mood = has('surprised') || has('surprise') || has('shocked') ? 'surprised'
      : has('sad') || has('cry') ? 'sad'
      : has('angry') || has('mad') ? 'angry'
      : has('smile') || has('happy') || has('laugh') || has('joy') ? 'smile' : 'neutral';
    blushTarget = has('blush') ? 1 : 0;
    tiltTarget = mood === 'sad' ? 0.12 : mood === 'smile' ? -0.05 : mood === 'surprised' ? -0.08 : 0;
    applyFace();
  }
  function applyFace() {
    const happy = mood === 'smile';
    eyes.forEach(e => { e.visible = !happy; });
    happyEyes.forEach(e => { e.visible = happy; });
    const big = mood === 'surprised' ? 1.25 : 1;
    eyes.forEach(e => e.scale.setScalar(big));
    brows.forEach((b, i) => {
      const s = i === 0 ? -1 : 1;
      b.position.y = mood === 'surprised' ? 0.095 : mood === 'sad' ? 0.072 : 0.075;
      b.rotation.z = Math.PI / 2 + (mood === 'sad' ? -s * 0.35 : mood === 'angry' ? s * 0.4 : 0);
    });
    updateMouth();
  }
  function updateMouth() {
    for (const m of Object.values(mouths)) m.visible = false;
    if (speaking) { mouths.open.visible = true; return; }
    (mood === 'smile' ? mouths.smile : mood === 'sad' || mood === 'angry' ? mouths.sad : mood === 'surprised' ? mouths.o : mouths.line).visible = true;
  }
  function setSpeaking(on) { speaking = !!on; updateMouth(); }

  function update(dt, t) {
    // breathing and a little sway
    body.scale.y = 1 + Math.sin(t * 2.1) * 0.012;
    body.rotation.z = Math.sin(t * 0.9) * 0.025;
    head.rotation.x = tilt + Math.sin(t * 1.3) * 0.02;
    head.rotation.y = Math.sin(t * 0.45) * 0.12;
    head.rotation.z = Math.sin(t * 0.7 + 1) * 0.04 + (mood === 'smile' ? 0.08 : 0);
    tilt += (tiltTarget - tilt) * Math.min(1, dt * 5);
    tails.forEach((p, i) => { p.rotation.z = Math.sin(t * 1.8 + i * 1.7) * 0.12; p.rotation.x = Math.sin(t * 1.2 + i) * 0.08; });
    arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.x = Math.sin(t * 1.1 + i * Math.PI) * 0.08 + (mood === 'surprised' ? -0.5 : 0); a.rotation.z = s * (0.28 + (mood === 'smile' ? 0.12 : 0)); });
    // blush
    blush += (blushTarget - blush) * Math.min(1, dt * 4);
    M.blush.opacity = blush * 0.65 * (group.userData.alpha ?? 1);
    cheeks.forEach(c => { c.visible = blush > 0.01; });
    // blink
    blinkIn -= dt;
    if (blinkIn <= 0 && blinkT < 0) blinkT = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const k = blinkT < 0.06 ? 1 - blinkT / 0.06 : blinkT < 0.14 ? (blinkT - 0.06) / 0.08 : 1;
      const big = mood === 'surprised' ? 1.25 : 1;
      eyes.forEach(e => { e.scale.set(big, big * Math.max(0.08, k), big); });
      if (blinkT >= 0.14) { blinkT = -1; blinkIn = 2 + Math.random() * 3.5; }
    }
    // talking
    if (speaking) {
      const target = 0.35 + 0.65 * Math.abs(Math.sin(t * 11) * 0.7 + Math.sin(t * 6.3 + 1) * 0.3);
      mouthOpen += (target - mouthOpen) * Math.min(1, dt * 18);
      mouths.open.scale.set(0.03, 0.006 + 0.03 * mouthOpen, 0.012);
      body.position.y = Math.abs(Math.sin(t * 5.5)) * 0.008;
    } else body.position.y = 0;
  }

  setAttrs(attrs);
  return { setAttrs, setSpeaking, update };
}
