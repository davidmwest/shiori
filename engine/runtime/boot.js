// Boots the player from URL parameters:
//   player.html?game=examples/lantern-keeper&scene=harbor&set=trust:2&choices=1,2&skip=1&dev=1
import { Player } from './player.js';

const q = new URLSearchParams(location.search);
const mount = document.getElementById('shiori') || document.body.appendChild(document.createElement('div'));
const game = q.get('game') || mount.dataset.game;
if (!game) {
  mount.innerHTML = '<div class="sh-boot-error"><h1>No game selected</h1><p>Open <code>player.html?game=path/to/game-folder</code> (the folder that contains game.story).</p></div>';
} else {
  const params = Object.fromEntries(q.entries());
  if (params.dev === '0') delete params.dev;
  const player = new Player({ mount, gamePath: game, engineBase: new URL('../', import.meta.url).href, params });
  player.boot().catch((err) => {
    console.error(err);
    mount.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'sh-boot-error';
    box.innerHTML = '<h1>Shiori could not start</h1><pre></pre>';
    box.querySelector('pre').textContent = String(err && err.stack || err);
    mount.appendChild(box);
  });
}
