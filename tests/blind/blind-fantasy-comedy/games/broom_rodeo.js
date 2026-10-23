// Broom Rodeo: click each runaway broom before it reaches the door on the right.
// Catch 10 of 14 brooms to win; let 5 escape and you lose. Resolves 'win' or 'lose'.
export default async function play({ container, params, width, height, signal }) {
  const TOTAL = 14, NEED = 10, MAX_ESCAPES = 5;
  const w = Math.min(width || 800, 800), h = Math.min(height || 400, 400);
  const root = document.createElement('div');
  root.style.cssText = `position:relative;width:${w}px;height:${h}px;margin:auto;overflow:hidden;` +
    'background:#2b3a55;border:3px solid #e6b94a;border-radius:12px;font-family:sans-serif;color:#fff;user-select:none';
  const hud = document.createElement('div');
  hud.style.cssText = 'position:absolute;left:12px;top:8px;font-size:18px;z-index:2';
  const door = document.createElement('div');
  door.style.cssText = `position:absolute;right:0;top:0;width:24px;height:${h}px;background:#6b4423`;
  root.append(hud, door);
  container.append(root);

  let caught = 0, escaped = 0, spawned = 0;
  const live = new Set();
  const render = () => { hud.textContent = `Caught ${caught}/${NEED}   Escaped ${escaped}/${MAX_ESCAPES}   Click the brooms!`; };
  render();

  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearInterval(spawner); cancelAnimationFrame(raf);
      root.remove();
      resolve(result);
    };
    if (signal) signal.addEventListener('abort', () => finish('lose'));

    const spawn = () => {
      if (spawned >= TOTAL) return;
      spawned++;
      const el = document.createElement('div');
      el.textContent = '\u{1F9F9}';
      el.style.cssText = 'position:absolute;font-size:44px;cursor:pointer';
      const b = { el, x: 0, y: 40 + Math.random() * (h - 100), vx: 90 + Math.random() * 80 };
      el.addEventListener('pointerdown', () => {
        if (!live.has(b)) return;
        live.delete(b); el.remove(); caught++; render(); check();
      });
      live.add(b); root.append(el);
    };
    const check = () => {
      if (caught >= NEED) finish('win');
      else if (escaped >= MAX_ESCAPES) finish('lose');
      else if (spawned >= TOTAL && live.size === 0) finish(caught >= NEED ? 'win' : 'lose');
    };
    const spawner = setInterval(spawn, 4000);
    spawn();
    let last = performance.now(), raf = 0;
    const tick = (now) => {
      const dt = (now - last) / 1000; last = now;
      for (const b of [...live]) {
        b.x += b.vx * dt;
        b.el.style.left = b.x + 'px';
        b.el.style.top = (b.y + Math.sin(b.x / 25) * 18) + 'px';
        if (b.x > w - 60) { live.delete(b); b.el.remove(); escaped++; render(); check(); }
      }
      if (!done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}
