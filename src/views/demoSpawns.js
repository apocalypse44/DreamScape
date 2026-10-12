// Demo spawns (Theatre mode only): jump straight to the Grimoire Tower or to the entrance of each
// kingdom, for presentations. Buttons in the Atmosphere Study panel, or keys 1-5.
const CSS = `
.demo-spawns { display: none; margin: 10px 0 2px; padding-top: 10px; border-top: 1px solid var(--line); }
.demo-spawns.on { display: block; }
.demo-spawns span { display: block; margin-bottom: 6px; color: var(--acid); font-size: 8px; letter-spacing: .15em; }
.demo-spawns div { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.atmosphere-demo .demo-spawns button { margin: 0; padding: 7px 0; text-align: center; font-size: 13px; line-height: 1; }
.demo-spawns button small { display: block; margin-top: 4px !important; font-size: 7px !important; color: var(--muted); }`;

const SPOTS = [
  { label: 'TOWER', icon: '◎', colour: '#c6ff65' },
  { label: 'CLOVER', icon: '♣', colour: '#8fe36b' },
  { label: 'HEART', icon: '♥', colour: '#ff6b6b' },
  { label: 'DIAMOND', icon: '♦', colour: '#ffd36b' },
  { label: 'SPADE', icon: '♠', colour: '#b9a6ff' },
];

// spawn(index): 0 = tower, 1-4 = the kingdom gates in SPOTS order. isEnabled(): Theatre mode on.
export function createDemoSpawns({ isEnabled, spawn }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const panel = document.querySelector('.atmosphere-demo');
  const box = document.createElement('div');
  box.className = 'demo-spawns';
  box.innerHTML = `<span>DEMO SPAWNS · KEYS 1–5</span><div>${SPOTS.map((s, i) =>
    `<button type="button" data-spot="${i}" aria-label="Spawn at ${s.label.toLowerCase()} (key ${i + 1})" style="color:${s.colour}">${s.icon}<small>${s.label}</small></button>`).join('')}</div>`;
  panel?.insertBefore(box, panel.querySelector('small'));
  box.addEventListener('click', event => {
    const button = event.target.closest('button[data-spot]');
    if (button) spawn(Number(button.dataset.spot));
  });
  addEventListener('keydown', event => {
    if (event.repeat || !isEnabled()) return;
    const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(event.code);
    if (index >= 0) spawn(index);
  });
  return {
    update() { box.classList.toggle('on', isEnabled()); }
  };
}
