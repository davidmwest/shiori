// Example gameplay module: call a coin toss. Resolves with 'win' or 'lose'.
export default function play({ container }) {
  return new Promise((resolve) => {
    container.innerHTML = `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;
                  background:radial-gradient(#1c2350,#070914);color:#fff;font:48px system-ui">
        <div>Heads or tails?</div>
        <div style="display:flex;gap:30px">
          <button data-c="heads" style="font:inherit;padding:20px 50px;border-radius:20px">Heads</button>
          <button data-c="tails" style="font:inherit;padding:20px 50px;border-radius:20px">Tails</button>
        </div>
      </div>`;
    container.querySelectorAll('button').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const toss = Math.random() < 0.5 ? 'heads' : 'tails';
      resolve(b.dataset.c === toss ? 'win' : 'lose');
    }));
  });
}
