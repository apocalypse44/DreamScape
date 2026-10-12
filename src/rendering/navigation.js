// Quest navigation, like a maps app: one route from the player to the nearest ember, then the next
// nearest, and so on, finishing at the shrine. Drawn as a ribbon on the ground with moving chevrons;
// the part already walked is trimmed away. A HUD arrow always points along the route.
//
// Stop order: greedy nearest-neighbour from the player (the usual heuristic for this small travelling
// salesman problem). Each leg between stops is an A* path (models/pathfinding.js). Legs are planned
// one per frame, so a full replan never costs more than one A* search in a single frame.
import { findPath } from '../models/pathfinding.js';

const SAMPLE = 1.5;      // ribbon resolution along the route (m)
const MAX_POINTS = 500;  // ribbon length cap: 750 m
const WIDTH = 0.9;
const LIFT = 0.22;       // above the analytic ground, to clear the terrain mesh
const OFF_ROUTE = 10;    // replan when the player is this far from the route
const LOOKAHEAD = 7;     // the arrow aims this far ahead along the route

const RIBBON_VERTEX = `
attribute float along;
varying float vAlong;
varying float vSide;
void main() {
  vAlong = along;
  vSide = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const RIBBON_FRAGMENT = `
uniform float uTime;
uniform vec3 uColor;
varying float vAlong;
varying float vSide;
void main() {
  float edge = abs(vSide - 0.5) * 2.0;                       // 0 centre, 1 border
  float border = smoothstep(0.72, 0.8, edge);
  float chevron = fract((vAlong - uTime * 4.0) / 3.0 - abs(vSide - 0.5) * 0.9);
  float arrows = smoothstep(0.0, 0.08, chevron) * (1.0 - smoothstep(0.32, 0.4, chevron));
  vec3 colour = mix(uColor, vec3(1.0), 0.55 * arrows * (1.0 - border));
  colour = mix(colour, vec3(1.0), border * 0.85);
  float alpha = mix(0.82, 0.95, border) * (1.0 - smoothstep(0.92, 1.0, edge));
  gl_FragColor = vec4(colour, alpha);
}`;

const CSS = `
#nav-arrow { position: fixed; left: 50%; bottom: 92px; transform: translateX(-50%); z-index: 21;
  display: none; flex-direction: column; align-items: center; gap: 4px; pointer-events: none;
  font: 600 12px/1 'DM Mono', monospace; letter-spacing: .12em; color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,.8); }
#nav-arrow svg { width: 54px; height: 54px; filter: drop-shadow(0 2px 4px rgba(0,0,0,.6)); }
body.playing #nav-arrow.on { display: flex; }`;

export function createNavigation({ scene, camera, player, quest, companion, terrainHeight, obstacles, version, shrine }) {
  // ---------------------------------------------------------------- HUD arrow
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const hud = document.createElement('div');
  hud.id = 'nav-arrow';
  hud.setAttribute('aria-live', 'polite');
  hud.innerHTML = `<svg viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="25" fill="rgba(10,18,24,.55)" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/><path id="nav-arrow-head" d="M27 9 L40 37 L27 30 L14 37 Z" fill="#46c7ff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><span id="nav-arrow-label"></span>`;
  document.body.appendChild(hud);
  const head = hud.querySelector('#nav-arrow-head');
  const label = hud.querySelector('#nav-arrow-label');

  // ---------------------------------------------------------------- ribbon
  const positions = new Float32Array(MAX_POINTS * 2 * 3);
  const uvs = new Float32Array(MAX_POINTS * 2 * 2);
  const along = new Float32Array(MAX_POINTS * 2);
  const index = [];
  for (let i = 0; i < MAX_POINTS - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('along', new THREE.BufferAttribute(along, 1));
  geometry.setIndex(index);
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x2f9bff) } },
    vertexShader: RIBBON_VERTEX, fragmentShader: RIBBON_FRAGMENT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.frustumCulled = false;
  ribbon.renderOrder = 1;
  scene.add(ribbon);

  // ---------------------------------------------------------------- route state
  let route = null;   // { points: [{x, z, stop?}], stops, signature }
  let job = null;     // planning in progress, one leg per frame
  let lastPlan = -Infinity, plannedVersion = -1, ribbonKey = '', ribbonAt = -Infinity, time = 0, shown = true;

  // Where to go (unordered). The hound's ember travels with the hound, so it is a moving stop.
  function stops() {
    if (quest.stage === 'return') return [{ id: 'shrine', x: shrine.x, z: shrine.z, name: 'SHRINE' }];
    if (quest.stage !== 'cursed') return [];
    const list = quest.embers.flatMap((e, i) => {
      if (e.taken) return [];
      const carried = e.challenge === 'hound' && quest.houndCarrying;
      return [{ id: `ember${i}${carried ? 'h' : ''}`, x: carried ? companion.position.x : e.x,
        z: carried ? companion.position.z : e.z, name: carried ? 'HOUND' : 'EMBER' }];
    });
    return [...list, { id: 'shrine', x: shrine.x, z: shrine.z, name: 'SHRINE' }];
  }
  // Which stops remain, independent of their order: a change means a new route.
  const signatureOf = list => `${quest.stage}|${list.map(s => s.id).sort().join(',')}`;

  // Order is fixed when planning (greedy nearest neighbour from the player), so it never flickers.
  function startPlan(list) {
    const left = list.filter(s => s.id !== 'shrine'), ordered = [];
    let from = player.position;
    while (left.length) {
      let best = 0;
      left.forEach((s, i) => { if (Math.hypot(s.x - from.x, s.z - from.z) < Math.hypot(left[best].x - from.x, left[best].z - from.z)) best = i; });
      from = left.splice(best, 1)[0];
      ordered.push(from);
    }
    ordered.push(list[list.length - 1]);
    job = { stops: ordered, legs: [], signature: signatureOf(list), from: { x: player.position.x, z: player.position.z } };
    lastPlan = time;
    plannedVersion = version();
  }
  function stepPlan() {
    const k = job.legs.length;
    const start = k === 0 ? job.from : job.stops[k - 1], goal = job.stops[k];
    const result = findPath(start, goal, { height: terrainHeight, obstacles: obstacles(), maxGrade: 1.6 });
    // No path (or start and goal share a grid cell): a straight line keeps the route whole.
    job.legs.push(result && result.path.length > 1 ? result.path : [{ x: start.x, z: start.z }, { x: goal.x, z: goal.z }]);
    if (job.legs.length < job.stops.length) return;
    const points = [];
    job.legs.forEach((leg, i) => {
      leg.forEach((p, j) => { if (i === 0 || j > 0) points.push({ x: p.x, z: p.z }); });
      points[points.length - 1].stop = job.stops[i];
    });
    // The player is always on the first leg (reaching its stop changes the quest and replans), so
    // locate() searches only that leg; a later leg doubling back past the player can't steal the cursor.
    route = { points, stops: job.stops, signature: job.signature, firstStop: points.findIndex(p => p.stop) };
    job = null;
    ribbonKey = '';
  }

  // Closest point on the route to the player: segment index, fraction and distance.
  function locate() {
    const pts = route.points;
    let best = { seg: 0, t: 0, dist: Infinity };
    for (let i = 0; i < Math.min(pts.length - 1, route.firstStop); i++) {
      const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((player.position.x - a.x) * dx + (player.position.z - a.z) * dz) / len2));
      const dist = Math.hypot(player.position.x - a.x - dx * t, player.position.z - a.z - dz * t);
      if (dist < best.dist) best = { seg: i, t, dist };
    }
    return best;
  }

  // Walk the route from the player's closest point, sampling every SAMPLE metres.
  function walk(from, onPoint) {
    const pts = route.points;
    let travelled = 0;
    let x = pts[from.seg].x + (pts[from.seg + 1].x - pts[from.seg].x) * from.t;
    let z = pts[from.seg].z + (pts[from.seg + 1].z - pts[from.seg].z) * from.t;
    if (onPoint(x, z, 0) === false) return;
    for (let i = from.seg + 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - x, pts[i].z - z);
      const steps = Math.max(1, Math.ceil(seg / SAMPLE));
      for (let s = 1; s <= steps; s++) {
        const px = x + (pts[i].x - x) * s / steps, pz = z + (pts[i].z - z) * s / steps;
        if (onPoint(px, pz, travelled + seg * s / steps, pts[i].stop && s === steps ? pts[i].stop : null) === false) return;
      }
      travelled += seg;
      x = pts[i].x; z = pts[i].z;
    }
  }

  function buildRibbon(from) {
    const centre = [];
    walk(from, (x, z, d) => { centre.push([x, z, d]); return centre.length < MAX_POINTS; });
    for (let i = 0; i < centre.length; i++) {
      const [x, z, d] = centre[i];
      const [nx, nz] = centre[Math.min(centre.length - 1, i + 1)], [px, pz] = centre[Math.max(0, i - 1)];
      let dx = nx - px, dz = nz - pz;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const sx = -dz * WIDTH / 2, sz = dx * WIDTH / 2; // side vector
      for (const [side, ox, oz] of [[0, -sx, -sz], [1, sx, sz]]) {
        const v = i * 2 + side;
        positions.set([x + ox, terrainHeight(x + ox, z + oz) + LIFT, z + oz], v * 3);
        uvs.set([d / WIDTH, side], v * 2);
        along[v] = d;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.uv.needsUpdate = true;
    geometry.attributes.along.needsUpdate = true;
    geometry.setDrawRange(0, Math.max(0, centre.length - 1) * 6);
  }

  const forward = new THREE.Vector3();
  function pointArrow(from) {
    let target = null, stop = null, distance = 0;
    walk(from, (x, z, d, reached) => {
      if (!target && d >= LOOKAHEAD) target = { x, z };
      if (reached) { stop = reached; distance = d; return false; }
      return true;
    });
    if (!stop) return;
    target ||= stop;
    camera.getWorldDirection(forward);
    const heading = Math.atan2(forward.x, -forward.z);
    const bearing = Math.atan2(target.x - player.position.x, -(target.z - player.position.z));
    head.setAttribute('transform', `rotate(${((bearing - heading) * 180) / Math.PI} 27 27)`);
    const text = `${stop.name} · ${Math.round(distance)} M`;
    if (label.textContent !== text) label.textContent = text;
  }

  return {
    get visible() { return shown; },
    get points() { return route?.points ?? null; }, // for the world map
    toggle() { shown = !shown; return shown; },
    update(dt) {
      time += dt;
      material.uniforms.uTime.value = time;
      const list = stops();
      if (!list.length) {
        route = job = null;
        ribbon.visible = false;
        hud.classList.remove('on');
        return;
      }
      if (job) stepPlan();
      else if (!route || route.signature !== signatureOf(list)) startPlan(list); // stops changed: replan now
      else if (time - lastPlan > 1.5) { // otherwise at most every 1.5 s
        const moved = route.stops.some(s => { const now = list.find(n => n.id === s.id); return now && Math.hypot(s.x - now.x, s.z - now.z) > 8; });
        if (moved || locate().dist > OFF_ROUTE || (version() !== plannedVersion && time - lastPlan > 4)) startPlan(list);
      }
      if (!route) return;
      const from = locate();
      // Rebuild when the player advances; terrain reshapes (chaos) refresh it at most 4 times a second.
      const key = `${from.seg}:${Math.round(from.t * 8)}`;
      const reshaped = version() !== route.ribbonVersion && time - ribbonAt > 0.25;
      if (key !== ribbonKey || reshaped) {
        ribbonKey = key;
        ribbonAt = time;
        route.ribbonVersion = version();
        buildRibbon(from);
      }
      ribbon.visible = shown;
      hud.classList.add('on');
      pointArrow(from);
    },
    reset() { route = job = null; ribbonKey = ''; geometry.setDrawRange(0, 0); }
  };
}
