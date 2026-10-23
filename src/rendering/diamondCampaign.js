// Chapter IV visuals: the Shatterglass Relay (a 4x4 board of sockets on the ground), its conduit
// tiles, the number of shapes each empty socket can still hold, the four conduit fragments, and
// the source, escape gate, inversion core and side gate around the board.
// No new lights: everything glows through MeshBasicMaterial colours. Repeated parts are instanced.
import { createDiamondCampaign, diamondLayout, socketCenter, BOARD } from '../models/diamondCampaign.js';
import { DIRS, hasSide } from '../models/diamondWfc.js';
import { Burst, addShake, sfx } from './fx.js';

// Keys are kept here so they are easy to change if they clash with another control.
export const DIAMOND_KEYS = { fit: 'KeyV', lift: 'KeyX' };

const S = BOARD.socket, N = BOARD.size, CELLS = N * N;
const PLATE = new THREE.Color(0x3a4150), HOVER = new THREE.Color(0x8f7bd6), FLASH = new THREE.Color(0xfff0b8);
const FEW = new THREE.Color(0xd9a441);                   // socket glow when few shapes remain
const PLACED = new THREE.Color(0xe0b354);                // fragments the player fitted
const FILLED = new THREE.Color(0x5fc9dc);                // buried conduits the relay surfaced
const POWER = new THREE.Color(0xfff6dc);                 // conduits carrying the pulse
const PORT_OFF = new THREE.Color(0x3d4658), PORT_ON = new THREE.Color(0xbff3ff);
const PULSE_SPEED = 3;                                   // sockets per second along the pulse
const LABEL_RANGE = 26;                                  // metres: socket numbers visible within

function numberSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(1.1, 1.1, 1);
  let shown = null;
  return {
    sprite,
    set(value, color) {
      const key = `${value}|${color}`;
      if (key === shown) return;
      shown = key;
      const g = canvas.getContext('2d');
      g.clearRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(12, 14, 24, 0.72)';
      g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
      g.fillStyle = color; g.font = 'bold 34px "DM Mono", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(value), 32, 34);
      texture.needsUpdate = true;
    },
  };
}

// gate: the Diamond kingdom gate { x, z } from createKingdomGates.
// surfaceHeight(x, z): the drawn ground height. keys: the game's held-key set.
// notify(text, ms): toast. ready(): chapter may begin. onChapterComplete(): Orin granted the sigil.
export function buildDiamondCampaign({ scene, gate, surfaceHeight, keys, notify, ready, onChapterComplete, onReady }) {
  const layout = diamondLayout(gate);
  const model = createDiamondCampaign({ layout, ready });
  const relay = model.relay;
  const root = new THREE.Group();
  root.name = 'diamond-relay';
  scene.add(root);
  const dummy = new THREE.Object3D();
  const centers = Array.from({ length: CELLS }, (_, i) => socketCenter(layout, i % N, Math.floor(i / N)));
  const heights = new Float32Array(CELLS);

  // Socket plates (stone), conduit hubs and arms (glowing), one instanced mesh each.
  const plates = new THREE.InstancedMesh(new THREE.BoxGeometry(S * 0.92, 0.3, S * 0.92),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.15, flatShading: true }), CELLS);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const hubs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 8), glow, CELLS);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.22, S / 2), glow, CELLS * 4);
  for (const mesh of [plates, hubs, arms]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, PLATE);
    mesh.frustumCulled = false;
    root.add(mesh);
  }
  plates.receiveShadow = true;

  const labels = centers.map(() => { const l = numberSprite(); root.add(l.sprite); return l; });

  // Ports: a crystal beside the board edge for each gate; the escape gate also gets posts and a bar.
  const crystal = new THREE.OctahedronGeometry(0.7, 0);
  const stone = new THREE.MeshStandardMaterial({ color: 0x59606f, roughness: 0.8, flatShading: true });
  const ports = relay.ports.map(port => {
    const c = socketCenter(layout, port.x, port.y);
    const x = c.x + DIRS[port.dir][0] * S * 0.95, z = c.z + DIRS[port.dir][1] * S * 0.95;
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: port.role === 'source' ? PORT_ON.clone() : PORT_OFF.clone() });
    const gem = new THREE.Mesh(crystal, material);
    gem.position.y = 1.6;
    if (port.role === 'core') gem.scale.setScalar(1.6);
    group.add(gem);
    let bar = null;
    if (port.role === 'gate') {
      const across = port.dir % 2 === 0; // north/south gates span east-west
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.4, 0.5), stone);
        post.position.set(across ? s * 1.4 : 0, 1.7, across ? 0 : s * 1.4);
        group.add(post);
      }
      bar = new THREE.Mesh(new THREE.BoxGeometry(across ? 2.4 : 0.35, 2.6, across ? 0.35 : 2.4), stone);
      bar.position.y = 1.4;
      group.add(bar);
      gem.position.y = 3.8;
    }
    group.position.set(x, 0, z);
    root.add(group);
    return { port, group, gem, material, bar, open: 0 };
  });

  // Conduit fragments: floating prisms around the relay until picked up.
  const fragmentMaterial = new THREE.MeshBasicMaterial({ color: PLACED });
  const fragments = layout.fragments.map(f => {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), fragmentMaterial);
    mesh.scale.set(0.7, 1.4, 0.7);
    root.add(mesh);
    return { f, mesh };
  });

  const fitBurst = new Burst(root, { color: 0xe0b354, count: 40, speed: [1, 3], up: [1, 3], life: 0.9 });
  const powerBurst = new Burst(root, { color: 0xbff3ff, count: 140, speed: [3, 8], up: [2, 7], life: 1.4 });
  onReady?.(root);

  const held = new Set();
  const tapped = code => { const down = keys.has(code), fresh = down && !held.has(code); if (down) held.add(code); else held.delete(code); return fresh; };
  let time = 0, pulse = 0, seen = -1, flash = new Float32Array(CELLS);
  const tileColor = new THREE.Color(), plateColor = new THREE.Color();

  function show(event, at) {
    if (!event) return;
    notify?.(event.text, event.ms);
    if (event.kind === 'fit' || event.kind === 'turn') {
      for (const [x, y] of model.narrowed) flash[y * N + x] = 1;
      if (at) fitBurst.fire(new THREE.Vector3(at.x, surfaceHeight(at.x, at.z) + 0.6, at.z));
      sfx.pickup();
    }
    if (event.kind === 'fragment' || event.kind === 'fragments') sfx.pickup();
    if (event.kind === 'jam') { addShake(0.25); sfx.whoosh(); }
    if (event.kind === 'powered') {
      pulse = 0; addShake(0.6); sfx.whoosh();
      powerBurst.fire(new THREE.Vector3(layout.center.x, surfaceHeight(layout.center.x, layout.center.z) + 1, layout.center.z));
    }
    if (event.kind === 'sigil') { sfx.cure(); onChapterComplete?.(); }
  }

  function drawBoard(dt, player, state) {
    const under = model.socketAt(player.position);
    const hover = under ? under.y * N + under.x : -1;
    const close = Math.hypot(player.position.x - layout.center.x, player.position.z - layout.center.z) < LABEL_RANGE;
    const fitting = model.stage === 'collect' || model.stage === 'repair';
    const flow = model.flow;
    const depth = new Map();
    if (flow) for (const c of flow.cells) depth.set(c.y * N + c.x, c.depth);
    for (let i = 0; i < CELLS; i++) {
      const { x, z } = centers[i];
      const bx = i % N, by = Math.floor(i / N);
      const y = heights[i] = surfaceHeight(x, z);
      flash[i] = Math.max(0, flash[i] - dt * 1.6);
      const options = relay.optionCount(bx, by), tile = options === 1 ? relay.tileAt(bx, by) : null;

      // Plate: brighter as a socket narrows; flashes when a nearby fit narrowed it; violet underfoot.
      plateColor.copy(PLATE);
      if (tile === null && fitting) plateColor.lerp(FEW, Math.max(0, 1 - (options - 1) / 8) * 0.5);
      if (i === hover && fitting) plateColor.lerp(HOVER, 0.6);
      plateColor.lerp(FLASH, flash[i] * 0.7);
      plates.setColorAt(i, plateColor);
      dummy.position.set(x, y + 0.12, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      plates.setMatrixAt(i, dummy.matrix);

      // Conduit: shown once the socket holds one shape (fitted, forced, or surfaced by the relay).
      const visible = tile !== null && (relay.isPlaced(bx, by) || model.stage === 'report' || model.stage === 'complete');
      tileColor.copy(relay.isPlaced(bx, by) ? PLACED : FILLED);
      if (flow && depth.has(i)) tileColor.lerp(POWER, 0.6 * Math.min(1, Math.max(0, pulse * PULSE_SPEED - depth.get(i)))); // keeps a hint of who laid it
      dummy.position.set(x, y + 0.42, z);
      dummy.scale.setScalar(visible && tile !== 0 ? 1 : 0); dummy.updateMatrix();
      hubs.setMatrixAt(i, dummy.matrix); hubs.setColorAt(i, tileColor);
      for (let d = 0; d < 4; d++) {
        const on = visible && hasSide(tile, d);
        dummy.position.set(x + DIRS[d][0] * S / 4, y + 0.4, z + DIRS[d][1] * S / 4);
        dummy.rotation.set(0, d % 2 ? Math.PI / 2 : 0, 0);
        dummy.scale.setScalar(on ? 1 : 0); dummy.updateMatrix();
        arms.setMatrixAt(i * 4 + d, dummy.matrix); arms.setColorAt(i * 4 + d, tileColor);
      }

      // Number of shapes the empty socket can still take (a calm-mode reading aid).
      const label = labels[i];
      label.sprite.visible = close && fitting && tile === null && state.chaos < 0.4;
      if (label.sprite.visible) {
        label.sprite.position.set(x, y + 1.5, z);
        label.set(options, options <= 2 ? '#ffd27a' : options <= 5 ? '#e8e2ff' : '#9aa6c8');
      }
    }
    for (const mesh of [plates, hubs, arms]) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
  }

  function drawPorts(dt) {
    const flow = model.flow;
    const reach = flow ? Math.max(0, ...flow.cells.map(c => c.depth)) + 1 : Infinity;
    for (const p of ports) {
      const { x, z } = p.group.position;
      p.group.position.y = surfaceHeight(x, z);
      const lit = p.port.role === 'source' || (flow && flow.reached.has(p.port.id) && pulse * PULSE_SPEED >= reach);
      p.open = Math.min(1, Math.max(0, p.open + (lit ? dt : -dt) / 1.5));
      p.material.color.copy(p.port.role === 'source' ? PORT_ON : PORT_OFF).lerp(PORT_ON, p.open);
      p.gem.rotation.y += dt * (0.5 + p.open * 2);
      if (p.bar) p.bar.position.y = 1.4 - p.open * 2.7; // the bar sinks into the ground as the gate opens
    }
  }

  function drawFragments() {
    for (const { f, mesh } of fragments) {
      mesh.visible = !model.isCollected(f.id) && model.stage !== 'complete';
      if (!mesh.visible) continue;
      mesh.position.set(f.x, surfaceHeight(f.x, f.z) + 1.3 + 0.2 * Math.sin(time * 2 + f.x), f.z);
      mesh.rotation.y = time * 1.4;
    }
  }

  return {
    model,
    root,
    // Points kept clear of random props (the board, Orin and the fragments).
    blockers: [...centers, layout.center, layout.orin, ...layout.fragments].map(({ x, z }) => ({ x, z })),
    update(dt, player, state) {
      time += dt;
      if (model.flow) pulse += dt;
      if (state.locked) {
        show(model.update(dt, player.position, state.chaos));
        if (tapped(DIAMOND_KEYS.fit)) show(model.fit(player.position, state.chaos), player.position);
        if (tapped(DIAMOND_KEYS.lift)) show(model.lift());
      }
      // Skip the per-socket work when far away and nothing changed.
      const far = Math.hypot(player.position.x - layout.center.x, player.position.z - layout.center.z) > 160;
      if (!far || seen !== model.version) { drawBoard(dt, player, state); seen = model.version; }
      drawPorts(dt);
      drawFragments();
      fitBurst.update(dt); powerBurst.update(dt);
    },
    reset() {
      model.reset();
      pulse = 0; seen = -1; flash.fill(0); held.clear();
      for (const p of ports) p.open = 0;
    },
  };
}
