// Clover's story shots: meeting Iven, reading the Stormleaf Scar and opening the Sky Garden chest.
// Each plays once per run (its story event only happens once), letterboxed like the castle door scene.
import { CLOVER_STORY } from '../models/cloverCampaign.js';
import { ROOT_LANDINGS } from '../models/cloverGrowth.js';
import { SKY, SKY_SECRET, SUMMIT_DOOR } from '../models/skyIsland.js';

const { iven, scar, chest } = CLOVER_STORY;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const [, first, second] = ROOT_LANDINGS;
// keys: [seconds, camera position, look target]. Catmull-Rom curves keep the flight smooth.
const SHOTS = {
  // The Archive is enclosed: the camera stays inside at eye height, leaves through the west door
  // (z -422.5..-417.5, lintel at 16.5 m) along the root road's line, and only climbs over the ravine.
  meet: {
    keys: [
      [0, v(-30.5, 14.6, -416.5), v(iven.x, 14, iven.z)],
      [3, v(-37, 14.6, -420), v(first.x, 13, first.z)],
      [5.5, v(-48, 14.8, -420), v(first.x, 12, -437)],
      [8.5, v(-58, 26, -424), v(second.x, 12, second.z)],
      [12, v(-80, 26, -440), v(scar.x, 13, scar.z)],
    ],
    lines: [
      [0.6, 'IVEN', 'The Triad cut our living road. Three crossings remain, each with a growth guide.'],
      [4, 'IVEN', 'Turn each guide in calm toward its gold leaf. Wake it in chaos, and the roots will grow.'],
      [8.5, 'IVEN', 'Beyond the last landing lies the Stormleaf Scar. It still remembers the true pattern.'],
    ],
  },
  sigil: {
    keys: [
      [0, v(scar.x + 5, 17, scar.z + 5), v(scar.x, 12.5, scar.z)], // between the shrine's pillars and arch
      [4, v(scar.x, 26, scar.z + 6), v(scar.x, 12, scar.z)],
      [7, v(scar.x + 14, 38, scar.z + 15), v(scar.x, 12, scar.z)],
      [10.5, v(-70, 52, -430), v(SUMMIT_DOOR.x, SUMMIT_DOOR.top, SUMMIT_DOOR.z)],
      [14.5, v(-20, 74, -470), v(SKY.x, SKY.top, SKY.z)],
      [18.5, v(chest.x - 4, chest.top + 6, chest.z + 9), v(chest.x, chest.top + 1, chest.z)],
    ],
    lines: [
      [0.6, 'THE STORMLEAF SCAR', 'The original binding pattern wakes beneath the scarred leaves.'],
      [4.8, 'ROOT SIGIL', 'Three marks fade: decoys. The Root Sigil shows which bindings are true.'],
      [9.5, 'IVEN', 'My chest waits above the clouds. Climb Clover Terraces to the summit gateway.'],
      [14, 'IVEN', 'In the Sky Garden, follow the Starlight Ledges to the highest perch.'],
    ],
    fx: (t, campaign) => campaign.scarReveal(Math.max(0, (t - .5) / 6)), // the renderer clamps; Infinity ends it
  },
};
// The chest shot: the chest opens and the Tide Hook rises, then the camera swoops to the Heart
// Kingdom gate, lingers there and swoops back. heart: the gate's {x, y (ground), z}. While the camera
// is away, terrain and props stream around the gate (focus), so its land is there when it arrives.
const HEART_AWAY = [5.5, 13.6]; // seconds during which streaming follows the camera to Heart
function hookShot(heart) {
  const h = heart ?? { x: chest.x + 500, y: 8, z: chest.z }, d = Math.hypot(h.x - chest.x, h.z - chest.z) || 1;
  const ux = (h.x - chest.x) / d, uz = (h.z - chest.z) / d, gate = v(h.x, h.y + 4, h.z);
  const nearGate = (back, side, up) => v(h.x - ux * back - uz * side, h.y + up, h.z - uz * back + ux * side);
  return {
    keys: [
      [0, v(chest.x, chest.top + 2.2, chest.z + 3.3), v(chest.x, chest.top + 1, chest.z)],
      [3, v(chest.x + 2, chest.top + 2.5, chest.z + 2.7), v(chest.x, chest.top + 1.8, chest.z)],
      // Rise over the perch's centre, clear of its diagonal pillars, turning toward Heart.
      [5.5, v(SKY_SECRET.x, chest.top + 6, SKY_SECRET.z), v(chest.x + ux * 60, chest.top - 4, chest.z + uz * 60)],
      [8.5, nearGate(34, 8, 16), gate],
      [11.5, nearGate(22, -10, 10), gate],
      [14.5, v(SKY_SECRET.x - ux * 3, chest.top + 8, SKY_SECRET.z - uz * 3), v(chest.x, chest.top + 1, chest.z)],
      [16, v(chest.x, chest.top + 3, chest.z + 4.2), v(chest.x, chest.top + 1, chest.z)],
    ],
    lines: [
      [0.6, 'IVEN’S SKY CHEST', 'The Root Sigil’s light lifts the seal.'],
      [3.2, 'TIDE HOOK', 'A grapple of Heart’s guardians. It catches only on glowing crystal anchors.'],
      [7.6, 'NEXT · THE STOLEN CURRENT', 'Beyond the clouds lies the Heart Kingdom, where Sera guards the stolen current.'],
      [12.4, 'IVEN', 'Carry the hook through Heart’s gate. Find Sera.'],
    ],
    fx: (t, campaign) => campaign.hookRise(t / 4),
    focus: t => t > HEART_AWAY[0] && t < HEART_AWAY[1] ? h : null,
  };
}
function prepare(shot) {
  shot.duration = shot.keys.at(-1)[0] + 1;
  shot.position = new THREE.CatmullRomCurve3(shot.keys.map(k => k[1]));
  shot.look = new THREE.CatmullRomCurve3(shot.keys.map(k => k[2]));
  return shot;
}
Object.values(SHOTS).forEach(prepare);
const ease = k => k * k * (3 - 2 * k);

export function createCloverScenes({ camera, state, keys, campaign, canvas, heart = null }) {
  const shots = { ...SHOTS, hook: prepare(hookShot(heart)) };
  const overlay = document.createElement('section');
  overlay.id = 'cloverScene';
  overlay.hidden = true;
  overlay.setAttribute('aria-label', 'Clover story scene');
  overlay.innerHTML = `<div class="scene-veil"></div><div class="scene-top"><span>THE LIVING ROAD</span><span>SKIP · X</span></div>
    <div class="scene-dialogue"><p class="scene-chapter">III · THE CLOVER KINGDOM</p><p class="scene-speaker"></p><p class="scene-line" aria-live="polite" aria-atomic="true"></p></div>`;
  document.body.appendChild(overlay);
  const veil = overlay.querySelector('.scene-veil'), speaker = overlay.querySelector('.scene-speaker'), line = overlay.querySelector('.scene-line');
  const savedPosition = new THREE.Vector3(), savedRotation = new THREE.Quaternion(), look = new THREE.Vector3();
  let shot = null, time = -1, shown = -1;
  const queue = [];

  // Map key times onto the curve's own parameter so each key is reached at its second.
  function sample(curve, t) {
    const { keys: k } = shot, n = k.length - 1;
    let i = k.findIndex((key, j) => j === n || t < k[j + 1][0]);
    i = Math.min(i, n - 1);
    const local = ease(Math.min(1, Math.max(0, (t - k[i][0]) / (k[i + 1][0] - k[i][0]))));
    return curve.getPoint((i + local) / n);
  }
  // As in the hound scene: a lost mouse lock (Esc, focus change) resumes play rather than the intro screen.
  function keepPointerLock() {
    if (!canvas || document.pointerLockElement === canvas) return;
    const paused = () => { if (!state.cinematic && document.pointerLockElement !== canvas) document.querySelector('#resumeHint')?.classList.add('on'); };
    try { canvas.requestPointerLock()?.catch?.(paused); } catch { paused(); }
  }
  function finish() {
    camera.position.copy(savedPosition); camera.quaternion.copy(savedRotation);
    shot.fx?.(Infinity, campaign);
    shot = null; time = -1; state.cinematic = false; overlay.hidden = true; document.body.classList.remove('story-playing');
    keys.clear();
    if (canvas) {
      state.locked = document.pointerLockElement === canvas;
      state.awaitResume = !state.locked;
      if (!state.locked) keepPointerLock();
    }
  }
  // input.js ignores keys during cinematics, so the scene listens for its own skip keys.
  // Capture first, so Space cannot buffer a jump or M open the atlas mid-scene.
  window.addEventListener?.('keydown', event => {
    if (time < 0 || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === 'KeyX') { keepPointerLock(); finish(); }
    else if (event.code === 'Escape') finish();
  }, true);

  return {
    get active() { return time >= 0; },
    // Where terrain should stream while a shot is away from the player, or null (stream around the player).
    get focus() { return time >= 0 ? shot.focus?.(time) ?? null : null; },
    // kind: 'meet' | 'sigil' | 'hook', the Clover story event that earns the shot.
    queue(kind) { if (shots[kind]) queue.push(kind); },
    observe(ready) {
      if (!queue.length || !ready || time >= 0) return;
      shot = shots[queue.shift()]; time = 0; shown = -1;
      savedPosition.copy(camera.position); savedRotation.copy(camera.quaternion);
      state.cinematic = true; keys.clear();
      overlay.hidden = false; document.body.classList.add('story-playing');
    },
    update(dt) {
      time += dt;
      const t = Math.min(time, shot.duration - 1);
      camera.position.copy(sample(shot.position, t));
      camera.lookAt(look.copy(sample(shot.look, t)));
      shot.fx?.(time, campaign);
      veil.style.opacity = String(Math.max(0, 1 - time / 0.8, (time - (shot.duration - 0.6)) / 0.6));
      const index = shot.lines.findLastIndex(l => time >= l[0]);
      if (index !== shown && index >= 0) {
        shown = index; speaker.textContent = shot.lines[index][1]; line.textContent = shot.lines[index][2];
        line.classList.remove('in'); void line.offsetWidth; line.classList.add('in');
      }
      if (time >= shot.duration) finish();
      return 10;
    },
    reset() { if (time >= 0) finish(); queue.length = 0; },
  };
}
