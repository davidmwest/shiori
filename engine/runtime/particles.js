// Weather and ambient particle systems drawn on the stage canvas.

import { has } from '../core/registry.js';

const rand = (a, b) => a + Math.random() * (b - a);

function softDot(color, r) {
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const g = c.getContext('2d').createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  const ctx = c.getContext('2d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, r * 2, r * 2);
  return c;
}

function petalSprite(fill, edge) {
  const c = document.createElement('canvas');
  c.width = 28; c.height = 22;
  const ctx = c.getContext('2d');
  ctx.translate(14, 11);
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.bezierCurveTo(-8, -10, 6, -10, 12, -2);
  ctx.lineTo(9, 0); ctx.lineTo(12, 2);
  ctx.bezierCurveTo(6, 10, -8, 10, -12, 0);
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke();
  return c;
}

function leafSprite(fill) {
  const c = document.createElement('canvas');
  c.width = 34; c.height = 22;
  const ctx = c.getContext('2d');
  ctx.translate(17, 11);
  ctx.beginPath();
  ctx.moveTo(-15, 0); ctx.quadraticCurveTo(0, -12, 15, 0); ctx.quadraticCurveTo(0, 12, -15, 0);
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.stroke();
  return c;
}

let TEX = null;
function textures() {
  if (TEX) return TEX;
  TEX = {
    snow: softDot('rgba(255,255,255,0.95)', 8),
    firefly: softDot('rgba(220,255,140,1)', 14),
    ember: softDot('rgba(255,170,80,1)', 8),
    dust: softDot('rgba(255,245,220,0.8)', 5),
    star: softDot('rgba(255,255,255,1)', 6),
    fog: softDot('rgba(220,228,240,0.5)', 220),
    petals: [petalSprite('#ffc8dc', 'rgba(230,120,160,0.6)'), petalSprite('#ffe0ea', 'rgba(230,140,170,0.5)'), petalSprite('#ffb3cc', 'rgba(210,100,140,0.6)')],
    leaves: [leafSprite('#e8742a'), leafSprite('#c94a2a'), leafSprite('#e8b030'), leafSprite('#9a5a2a')],
  };
  return TEX;
}

const KINDS = {
  rain: { count: 280, spawn(p, W, H, s) { p.x = rand(-200, W + 200); p.y = rand(-H, H); p.len = rand(18, 38); p.v = rand(1300, 1900); p.a = rand(0.2, 0.45); } },
  storm: { count: 520, spawn(p, W, H, s) { p.x = rand(-400, W + 400); p.y = rand(-H, H); p.len = rand(26, 52); p.v = rand(1800, 2600); p.a = rand(0.25, 0.5); } },
  snow: { count: 170, spawn(p, W, H) { p.x = rand(0, W); p.y = rand(-H, H); p.r = rand(0.25, 0.9); p.v = rand(35, 110); p.ph = rand(0, 6.28); p.sw = rand(10, 40); } },
  petals: { count: 60, spawn(p, W, H) { p.x = rand(-100, W); p.y = rand(-H, H); p.v = rand(45, 100); p.ph = rand(0, 6.28); p.rot = rand(0, 6.28); p.vr = rand(-2, 2); p.s = rand(0.7, 1.3); p.i = Math.floor(rand(0, 3)); } },
  leaves: { count: 40, spawn(p, W, H) { p.x = rand(-100, W); p.y = rand(-H, H); p.v = rand(60, 130); p.ph = rand(0, 6.28); p.rot = rand(0, 6.28); p.vr = rand(-2.5, 2.5); p.s = rand(0.8, 1.4); p.i = Math.floor(rand(0, 4)); } },
  fireflies: { count: 46, spawn(p, W, H) { p.x = rand(0, W); p.y = rand(H * 0.25, H); p.ph = rand(0, 6.28); p.f = rand(0.3, 0.9); p.s = rand(0.5, 1.1); p.vx = rand(-15, 15); p.vy = rand(-10, 10); } },
  stars: { count: 240, spawn(p, W, H) { p.x = rand(0, W); p.y = Math.pow(Math.random(), 1.4) * H * 0.68; p.s = Math.pow(Math.random(), 3) * 1.6 + 0.25; p.ph = rand(0, 6.28); p.f = rand(0.6, 2.6); p.b = rand(0.35, 1); } },
  dust: { count: 80, spawn(p, W, H) { p.x = rand(0, W); p.y = rand(0, H); p.vx = rand(-8, 8); p.vy = rand(-6, 6); p.ph = rand(0, 6.28); p.s = rand(0.4, 1); } },
  embers: { count: 80, spawn(p, W, H, s, fresh) { p.x = rand(0, W); p.y = fresh ? rand(0, H) : H + 20; p.v = rand(60, 180); p.ph = rand(0, 6.28); p.s = rand(0.4, 1.1); p.life = rand(0.5, 1); } },
  fog: { count: 12, spawn(p, W, H) { p.x = rand(-400, W + 400); p.y = rand(H * 0.35, H * 1.05); p.s = rand(1.4, 3.2); p.v = rand(8, 30) * (Math.random() < 0.5 ? -1 : 1); p.a = rand(0.18, 0.4); } },
  bubbles: { count: 50, spawn(p, W, H, s, fresh) { p.x = rand(0, W); p.y = fresh ? rand(0, H) : H + 30; p.r = rand(3, 14); p.v = rand(40, 120); p.ph = rand(0, 6.28); } },
};

export class Weather {
  constructor(spec, W, H) {
    this.type = spec.type;
    this.kind = has(KINDS, spec.type) ? KINDS[spec.type] : null;
    this.W = W; this.H = H;
    this.alpha = 0; this.target = 1;
    this.setSpec(spec);
    this.t = 0;
    this.flash = 0; this.nextBolt = rand(3, 7);
    this.shooting = null; this.nextShoot = rand(6, 14);
  }
  setSpec(spec) {
    this.intensity = spec.intensity != null ? spec.intensity : 1;
    this.wind = spec.wind || 0;
    this.layer = spec.layer || 'front';
    const k = this.kind;
    if (!k) { this.parts = []; return; } // an unknown type (an old save) draws nothing
    const n = Math.round(k.count * Math.max(0.05, this.intensity));
    this.parts = this.parts || [];
    while (this.parts.length < n) { const p = {}; k.spawn(p, this.W, this.H, this, true); this.parts.push(p); }
    this.parts.length = n;
  }
  update(dt) {
    const { W, H } = this;
    this.t += dt;
    const k = this.kind;
    if (!k) return;
    const wind = this.wind;
    for (const p of this.parts) {
      switch (this.type) {
        case 'rain': case 'storm': {
          const slant = this.type === 'storm' ? 0.35 + wind * 0.4 : wind * 0.35;
          p.y += p.v * dt; p.x += p.v * dt * slant;
          if (p.y > H + 50 || p.x > W + 450 || p.x < -450) { k.spawn(p, W, H, this); p.y = rand(-200, -20); }
          break;
        }
        case 'snow':
          p.y += p.v * dt; p.x += (Math.sin(this.t * 0.8 + p.ph) * p.sw + wind * 80) * dt;
          if (p.y > H + 20) { k.spawn(p, W, H, this); p.y = -20; }
          if (p.x > W + 20) p.x -= W + 40; if (p.x < -20) p.x += W + 40;
          break;
        case 'petals': case 'leaves':
          p.y += p.v * dt; p.x += (Math.sin(this.t * 1.2 + p.ph) * 50 + 40 + wind * 120) * dt; p.rot += p.vr * dt;
          if (p.y > H + 30 || p.x > W + 60) { k.spawn(p, W, H, this); p.y = -30; p.x = rand(-200, W); }
          break;
        case 'fireflies':
          p.vx += rand(-20, 20) * dt; p.vy += rand(-20, 20) * dt;
          p.vx = Math.max(-25, Math.min(25, p.vx)); p.vy = Math.max(-18, Math.min(18, p.vy));
          p.x += (p.vx + wind * 30) * dt; p.y += p.vy * dt;
          if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20; if (p.y < H * 0.2) p.vy += 5; if (p.y > H + 10) p.vy -= 8;
          break;
        case 'dust':
          p.x += (p.vx + wind * 15) * dt; p.y += (p.vy + Math.sin(this.t + p.ph) * 4) * dt;
          if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10; if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
          break;
        case 'embers':
          p.y -= p.v * dt; p.x += (Math.sin(this.t * 2 + p.ph) * 30 + wind * 60) * dt; p.life -= dt * 0.25;
          if (p.y < -20 || p.life <= 0) k.spawn(p, W, H, this, false);
          break;
        case 'fog':
          p.x += (p.v + wind * 20) * dt;
          if (p.x > W + 700) p.x = -700; if (p.x < -700) p.x = W + 700;
          break;
        case 'bubbles':
          p.y -= p.v * dt; p.x += Math.sin(this.t * 2 + p.ph) * 20 * dt;
          if (p.y < -30) k.spawn(p, W, H, this, false);
          break;
      }
    }
    if (this.type === 'storm') {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.flash = 1; this.nextBolt = rand(4, 10); this.bolt = this.makeBolt(); }
      this.flash = Math.max(0, this.flash - dt * 2.6);
    }
    if (this.type === 'stars') {
      this.nextShoot -= dt;
      if (!this.shooting && this.nextShoot <= 0) { this.shooting = { x: rand(W * 0.2, W), y: rand(0, H * 0.3), t: 0 }; this.nextShoot = rand(8, 18); }
      if (this.shooting) { this.shooting.t += dt; if (this.shooting.t > 0.9) this.shooting = null; }
    }
  }
  makeBolt() {
    const pts = []; let x = rand(this.W * 0.15, this.W * 0.85), y = 0;
    while (y < this.H * 0.7) { pts.push([x, y]); x += rand(-60, 60); y += rand(30, 90); }
    return pts;
  }
  draw(ctx, reduceMotion) {
    const a = this.alpha;
    if (a <= 0.001) return;
    const tex = textures();
    ctx.save();
    switch (this.type) {
      case 'rain': case 'storm': {
        const slant = this.type === 'storm' ? 0.35 + this.wind * 0.4 : this.wind * 0.35;
        ctx.strokeStyle = this.type === 'storm' ? 'rgba(200,215,240,1)' : 'rgba(190,210,245,1)';
        ctx.lineWidth = this.type === 'storm' ? 1.6 : 1.3;
        ctx.globalAlpha = a * (this.type === 'storm' ? 0.42 : 0.35);
        ctx.beginPath();
        for (const p of this.parts) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len * slant, p.y - p.len); }
        ctx.stroke();
        if (this.flash > 0 && !reduceMotion) {
          ctx.globalAlpha = a * this.flash * 0.55;
          ctx.fillStyle = '#eef3ff'; ctx.fillRect(0, 0, this.W, this.H);
          if (this.bolt && this.flash > 0.6) {
            ctx.globalAlpha = a * this.flash; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
            ctx.beginPath(); this.bolt.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
          }
        }
        break;
      }
      case 'snow':
        for (const p of this.parts) { ctx.globalAlpha = a * (0.5 + p.r * 0.5); const s = 16 * p.r; ctx.drawImage(tex.snow, p.x - s / 2, p.y - s / 2, s, s); }
        break;
      case 'petals': case 'leaves': {
        const list = this.type === 'petals' ? tex.petals : tex.leaves;
        for (const p of this.parts) {
          ctx.globalAlpha = a * 0.92;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(p.s, p.s * (0.6 + 0.4 * Math.abs(Math.sin(this.t * 2 + p.ph))));
          const img = list[p.i % list.length];
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        break;
      }
      case 'fireflies':
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.parts) {
          const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(this.t * p.f * 2 + p.ph));
          ctx.globalAlpha = a * pulse; const s = 26 * p.s;
          ctx.drawImage(tex.firefly, p.x - s / 2, p.y - s / 2, s, s);
        }
        break;
      case 'stars':
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.parts) {
          const tw = reduceMotion ? 0.8 : 0.55 + 0.45 * Math.sin(this.t * p.f + p.ph);
          ctx.globalAlpha = a * p.b * tw; const s = 8 * p.s;
          ctx.drawImage(tex.star, p.x - s / 2, p.y - s / 2, s, s);
        }
        if (this.shooting && !reduceMotion) {
          const s = this.shooting, k = s.t / 0.9;
          const x = s.x - k * 420, y = s.y + k * 180;
          const g = ctx.createLinearGradient(x, y, x + 140, y - 60);
          g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = a * (1 - k); ctx.strokeStyle = g; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 140, y - 60); ctx.stroke();
        }
        break;
      case 'dust':
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.parts) { ctx.globalAlpha = a * (0.25 + 0.25 * Math.sin(this.t * 0.7 + p.ph)); const s = 9 * p.s; ctx.drawImage(tex.dust, p.x - s / 2, p.y - s / 2, s, s); }
        break;
      case 'embers':
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.parts) { ctx.globalAlpha = a * Math.max(0, p.life) * (0.6 + 0.4 * Math.sin(this.t * 9 + p.ph)); const s = 14 * p.s; ctx.drawImage(tex.ember, p.x - s / 2, p.y - s / 2, s, s); }
        break;
      case 'fog':
        for (const p of this.parts) { ctx.globalAlpha = a * p.a; const s = 440 * p.s; ctx.drawImage(tex.fog, p.x - s, p.y - s * 0.45, s * 2, s * 0.9); }
        break;
      case 'bubbles':
        ctx.strokeStyle = 'rgba(220,240,255,0.7)'; ctx.lineWidth = 1.5;
        for (const p of this.parts) {
          ctx.globalAlpha = a * 0.7;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.25, 0, Math.PI * 2); ctx.fill();
        }
        break;
    }
    ctx.restore();
  }
}

// One-off bursts (used by modules, e.g. confetti).
export class Burst {
  constructor({ x, y, count = 120, colors = ['#ff6b9a', '#ffd166', '#7bdff2', '#b8f2a1', '#c3a6ff'], W, H }) {
    this.parts = [];
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2), sp = rand(200, 900);
      this.parts.push({ x: x ?? W / 2, y: y ?? H / 2, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 400, rot: rand(0, 6), vr: rand(-8, 8), c: colors[i % colors.length], life: rand(1.6, 2.8), w: rand(8, 16), h: rand(4, 9) });
    }
    this.done = false;
  }
  update(dt) {
    let alive = 0;
    for (const p of this.parts) { if (p.life <= 0) continue; alive++; p.vy += 900 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt; }
    if (!alive) this.done = true;
  }
  draw(ctx) {
    ctx.save();
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      ctx.setTransform(1, 0, 0, 1, p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    ctx.restore();
  }
}
