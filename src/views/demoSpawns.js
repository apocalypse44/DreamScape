// Demo travel: jump to the tower or a kingdom entrance with the buttons or keys 1–5.
const CSS = `
.demo-spawns { display: none; margin: 10px 0 2px; padding-top: 10px; border-top: 1px solid var(--line); }
.demo-spawns.on { display: block; }
.demo-spawns span { display: block; margin-bottom: 6px; color: var(--acid); font-size: 8px; letter-spacing: .15em; }
.demo-spawns div { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.world-controls .demo-spawns button { margin: 0; padding: 7px 0; text-align: center; font-size: 13px; line-height: 1; }
.demo-spawns button small { display: block; margin-top: 4px !important; font-size: 7px !important; color: var(--muted); }`;

const SPOTS = [
  { label: 'TOWER', icon: '◎', colour: '#c6ff65' },
  { label: 'CLOVER', icon: '♣', colour: '#8fe36b' },
  { label: 'HEART', icon: '♥', colour: '#ff6b6b' },
  { label: 'DIAMOND', icon: '♦', colour: '#ffd36b' },
  { label: 'SPADE', icon: '♠', colour: '#b9a6ff' },
];

// spawn(index): 0 = tower, 1–4 = kingdom gates. Scenes temporarily block demo travel.
export function createDemoSpawns({ isAvailable, spawn }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const panel = document.querySelector('.world-controls');
  const box = document.createElement('div');
  box.className = 'demo-spawns';
  box.innerHTML = `<span>DEMO SPAWNS · KEYS 1–5</span><div>${SPOTS.map((s, i) =>
    `<button type="button" data-spot="${i}" aria-label="Spawn at ${s.label.toLowerCase()} (key ${i + 1})" style="color:${s.colour}">${s.icon}<small>${s.label}</small></button>`).join('')}</div>`;
  panel?.insertBefore(box, panel.querySelector('small'));
  box.addEventListener('click', event => {
    const button = event.target.closest('button[data-spot]');
    if (button && isAvailable()) spawn(Number(button.dataset.spot));
  });
  addEventListener('keydown', event => {
    if (event.repeat || !isAvailable() || event.ctrlKey || event.metaKey || event.altKey ||
      /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(event.code);
    if (index >= 0) spawn(index);
  });
  return {
    update() { box.classList.toggle('on', isAvailable()); }
  };
}
