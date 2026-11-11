import { findPath } from './pathfinding.js';
import { islandSurface } from './skyIsland.js';
import { heartTown } from './heartTown.js';

const CALM = 0.4;
const NEAR = (p, q, radius) => Math.hypot(p.x - q.x, p.z - q.z) < radius;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const say = (kind, text, ms = 6500) => ({ kind, text, ms });
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// The Resonance Reef, torn from the ground into a ring of upside-down mountains around the crater.
// Positions are (along, side) metres from the Heart gate, along the road east. top = walkable feet height.
//
//   hop-a > hop-b > LISTENING ---A--- SPRING ONE
//                       |                 |
//                       D      SPIRE      B
//                       |        |        |
//                  SPRING THREE -E   --C-- SPRING TWO     (the switch rock floats just outside C)
//
// A, B, C are crystal bridges the switches raise; D (the old causeway) and E (to the spire) are always up.
// With C closed, the spirit can still reach Spring Three the long way round (B, A, D), so A* visibly
// re-routes when C opens.
// The reef sits 70 m in from the gate: Tidewell (heartTown.js) fills the land before it.
export const REEF_ALONG = 155; // the spire, the crater's centre
const ISLANDS = [
  { id: 'hop-a', along: 92, side: -7, top: 7, radius: 4 },
  { id: 'hop-b', along: 104, side: 7, top: 12, radius: 4 },
  { id: 'listening', along: 121, side: 0, top: 17, radius: 10 },
  { id: 'spring-one', along: 155, side: -34, top: 21, radius: 10 },
  { id: 'spring-two', along: 189, side: 0, top: 25, radius: 10 },
  { id: 'spring-three', along: 155, side: 34, top: 29, radius: 10 },
  { id: 'spire', along: 155, side: 0, top: 35, radius: 12 },
  { id: 'switch-rock', along: 180.5, side: 25.5, top: 32, radius: 4.5 },
];
const BRIDGES = [
  { id: 'bridge-a', from: 'listening', to: 'spring-one', gated: true },
  { id: 'bridge-b', from: 'spring-one', to: 'spring-two', gated: true },
  { id: 'bridge-c', from: 'spring-two', to: 'spring-three', gated: true },
  { id: 'causeway', from: 'spring-three', to: 'listening' },
  { id: 'spire-stair', from: 'spring-three', to: 'spire' },
];
const BRIDGE_WIDTH = 5;
// Grapple crossings [from, to]; 'shore' is the ground by Sera. A crystal floats over each gap.
const SWINGS = [['shore', 'hop-a'], ['hop-a', 'hop-b'], ['hop-b', 'listening'],
  ['spring-two', 'switch-rock'], ['switch-rock', 'spring-three'], ['switch-rock', 'spring-two']];
// The earthquake rise: each island tears free in turn, lowest first.
export const HEART_RISE = { seconds: 2.5, stagger: 0.4 };
// The spike's profile: [depth fraction below the top, ring scale]. Shared by rendering and collision.
export const SPIKE = [[0, 1], [0.08, 1.06], [0.22, 0.86], [0.42, 0.6], [0.66, 0.34], [0.86, 0.15], [1, 0.03]];
export const HEART_RISE_TOTAL = HEART_RISE.seconds + HEART_RISE.stagger * (ISLANDS.length - 1);
// The earthquake, in seconds from its start: rumble, then glowing fissures, then a dust burst that hides
// the ground dropping into the crater while the islands tear free.
export const HEART_QUAKE = { fissures: 1.5, burst: 3, end: 3 + HEART_RISE_TOTAL };
// The crater under the ring: an elliptical bowl centred on the spire, deepest (16 m) in the middle.
const CRATER = { along: REEF_ALONG, alongRadius: 64, sideRadius: 54, depth: 16 };

export function heartLayout(gate) {
  const length = Math.hypot(gate.x, gate.z) || 1;
  const ux = gate.x / length, uz = gate.z / length;
  const at = (along, side = 0) => ({
    x: +(gate.x + ux * along - uz * side).toFixed(2),
    z: +(gate.z + uz * along + ux * side).toFixed(2),
  });
  const local = p => {
    const dx = p.x - gate.x, dz = p.z - gate.z;
    return { along: dx * ux + dz * uz, side: -dx * uz + dz * ux };
  };
  const islands = ISLANDS.map((spec, index) => {
    const c = at(spec.along, spec.side), n = spec.radius > 6 ? 11 : 7;
    const outline = Array.from({ length: n }, (_, i) => {
      const a = i / n * Math.PI * 2, r = spec.radius * (0.94 + hash(i, index) * 0.12);
      return [+(Math.cos(a) * r).toFixed(2), +(Math.sin(a) * r).toFixed(2)];
    });
    // Deep spikes: the underside tapers 1.6-2.2 radii below the top, an upside-down mountain.
    const depth = spec.radius * (1.6 + hash(index, 9) * 0.6);
    return { ...spec, ...c, index, depth, outline, surface: islandSurface(c.x, c.z, spec.top, outline, spec.top - depth) };
  });
  const island = id => islands.find(i => i.id === id);
  const toward = (a, b, inset) => { // the point on a's rim facing b, inset metres inside it
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1, r = Math.max(0, (a.radius ?? 0) - inset);
    return { x: +(a.x + dx / d * r).toFixed(2), z: +(a.z + dz / d * r).toFixed(2) };
  };
  const bridges = BRIDGES.map(spec => {
    const a = island(spec.from), b = island(spec.to);
    const start = toward(a, b, 1.5), end = toward(b, a, 1.5); // inside the jagged rim
    return { ...spec, start: { ...start, top: a.top }, end: { ...end, top: b.top },
      x: (start.x + end.x) / 2, z: (start.z + end.z) / 2, width: BRIDGE_WIDTH };
  });
  // The bridge's walkable top at (x, z), or null off its strip.
  const bridgeTop = (bridge, x, z, pad = 0) => {
    const { start: s, end: e } = bridge, dx = e.x - s.x, dz = e.z - s.z, len2 = dx * dx + dz * dz;
    const t = ((x - s.x) * dx + (z - s.z) * dz) / len2;
    if (t < 0 || t > 1) return null;
    if (Math.abs((x - s.x) * dz - (z - s.z) * dx) / Math.sqrt(len2) > bridge.width / 2 + pad) return null;
    return s.top + (e.top - s.top) * t;
  };
  const shore = at(83, -3); // just past the Listening Spring, at the crater's edge
  const swings = SWINGS.map(([from, to]) => {
    const a = from === 'shore' ? { ...shore, radius: 0 } : island(from), b = island(to);
    // The crystal floats 70% of the way across, 9 m above the higher of the two ends.
    return { id: `${from}>${to}`, from, to, x: +(a.x + (b.x - a.x) * 0.7).toFixed(2), y: Math.max(a.top ?? 1.5, b.top) + 9,
      z: +(a.z + (b.z - a.z) * 0.7).toFixed(2), at: toward(a, b, 1.5), land: toward(b, a, 2.5) };
  });
  const listening = island('listening');
  const offset = (p, along, side) => ({ x: +(p.x + ux * along - uz * side).toFixed(2), z: +(p.z + uz * along + ux * side).toFixed(2) });
  const checkpoints = [
    { id: 'spring-one', name: 'FIRST SPRING', x: island('spring-one').x, z: island('spring-one').z },
    { id: 'spring-two', name: 'RESONANCE POOL', x: island('spring-two').x, z: island('spring-two').z },
    { id: 'spring-three', name: 'REEF HEART', x: island('spring-three').x, z: island('spring-three').z },
  ];
  const switchOn = {
    'bridge-a': offset(listening, 2, -6),
    'bridge-b': offset(island('spring-one'), 6, 2),
    'bridge-c': { x: island('switch-rock').x, z: island('switch-rock').z },
  };
  const passages = bridges.filter(b => b.gated).map((b, i) => ({
    id: `passage-${i + 1}`, name: `CRYSTAL BRIDGE ${'ABC'[i]}`, bridge: b.id,
    x: +b.x.toFixed(2), z: +b.z.toFixed(2), switch: switchOn[b.id], radius: 3.5,
  }));
  const spire = island('spire');
  const islandAt = (x, z, pad = 0) => islands.find(i => i.surface.contains(x, z, pad)) || null;
  // Each island's body as stacked bands that narrow toward the spike's tip, matching the rendered rings
  // (rendering/heartCampaign.js). d0..d1: depth fractions below the top; radius: the band's widest ring.
  // The top band stops 0.6 m under the top, so standing on the island (or stepping off a bridge) is free.
  for (const island of islands) {
    island.bands = SPIKE.slice(0, -1).map(([d0, s0], k) => {
      const [d1, s1] = SPIKE[k + 1];
      return { d0, d1, radius: island.radius * (k === 0 ? 1 : Math.max(s0, s1)) * 0.95 };
    });
  }
  // Is a body spanning heights y0..y1 at (x, z) inside any island? topOf(island): its current top (it rises).
  const islandSolid = (x, y0, y1, z, topOf = island => island.top, pad = 0.45) => islands.some(island => {
    const top = topOf(island), dx = x - island.x, dz = z - island.z;
    if (dx * dx + dz * dz > (island.radius * 1.1 + pad) ** 2) return false;
    return island.bands.some(b => {
      const hi = top - Math.max(b.d0 * island.depth, 0.6), lo = top - b.d1 * island.depth;
      return y1 > lo && y0 < hi && Math.hypot(dx, dz) < b.radius + pad;
    });
  });
  const height = (x, z) => {
    const i = islandAt(x, z);
    if (i) return i.top;
    for (const b of bridges) { const top = bridgeTop(b, x, z); if (top !== null) return top; }
    return -100; // open sky: too steep for A*, so the drop is a wall
  };
  const town = heartTown(at, local);
  const craterDepth = (x, z) => {
    const { along, side } = local({ x, z });
    const r2 = ((along - CRATER.along) / CRATER.alongRadius) ** 2 + (side / CRATER.sideRadius) ** 2;
    return r2 >= 1 ? 0 : CRATER.depth * (1 - r2) ** 2;
  };
  // The ground once the crater is open: a smooth basin replaces Heart's spiky land inside the bowl,
  // blending back to the natural ground (h) at the rim. Base: the plains' flat height.
  const craterGround = (x, z, h, base = 1.5) => {
    const { along, side } = local({ x, z });
    const r2 = ((along - CRATER.along) / CRATER.alongRadius) ** 2 + (side / CRATER.sideRadius) ** 2;
    if (r2 >= 1) return h;
    const w = smooth((1 - r2) / 0.35); // full basin inside, natural ground at the rim
    return h + (base - CRATER.depth * (1 - r2) ** 2 - h) * w;
  };
  return {
    gate: { ...gate },
    at,
    craterDepth,
    craterGround,
    craterReach: CRATER.alongRadius, // the bowl's largest radius from the reef centre
    sera: at(77, -9),          // beside the Listening Spring, at the head of Tidewell's canal
    seraApproach: at(77, -13),
    reefAlong: REEF_ALONG,
    town,
    townGround: town.ground,
    shore,
    spring: offset(listening, 3, 0),
    checkpoints,
    passages,
    core: { id: 'siphon-core', name: 'SIPHON CORE', x: spire.x, z: spire.z },
    reef: { x: spire.x, z: spire.z }, // the crater's centre, for the world map
    islands,
    bridges,
    bridgeTop,
    swings,
    island,
    islandAt,
    islandSolid,
    local,
    height,
    ownsArea(position, margin = 0) {
      const { along, side } = local(position);
      return along >= -2 - margin && along <= 225 + margin && Math.abs(side) <= 112 + margin; // Tidewell, the palace and the crater
    },
  };
}


// scout: where Nim, Sera's scout, waits in Clover ({x, z}), or null.
export function createHeartCampaign({ layout, ready = () => true, terrainHeight = () => 1.5, scout = null } = {}) {
  if (!layout) throw new Error('Heart campaign requires its kingdom layout.');
  let stage, checkpoints, passages, spirit, route, routeVersion, pathDirty;
  let revealed, quakeTime, visionAsked, version, goalReached;

  function reset() {
    stage = 'meet';
    checkpoints = 0;
    passages = layout.passages.map(p => ({ ...p, open: false }));
    spirit = null;
    route = null;
    routeVersion = 0;
    pathDirty = true;
    revealed = new Set();
    quakeTime = -1; // the earthquake has not started
    visionAsked = false;
    version = 0;
    goalReached = false;
  }
  reset();

  const awakened = () => quakeTime >= 0;
  const riseTime = () => Math.max(0, quakeTime - HEART_QUAKE.burst);
  const reefReady = () => quakeTime >= HEART_QUAKE.end;
  // Driven by the vision cutscene's clock (so pausing to read a line pauses the quake too). Never runs back.
  function quakeTo(seconds) {
    const next = Math.min(HEART_QUAKE.end, Math.max(quakeTime, seconds, 0));
    if (next === quakeTime) return;
    if (next >= HEART_QUAKE.end && quakeTime < HEART_QUAKE.end) pathDirty = true;
    quakeTime = next;
    version++;
  }
  // 0 = buried in the ground, 1 = fully risen. Islands tear free one after another.
  const liftOf = island => awakened() ? smooth((riseTime() - island.index * HEART_RISE.stagger) / HEART_RISE.seconds) : 0;
  const islandTop = island => {
    const ground = terrainHeight(island.x, island.z);
    return ground + (island.top - ground) * liftOf(island);
  };
  const goal = () => checkpoints < layout.checkpoints.length ? layout.checkpoints[checkpoints] : layout.core;
  const openBridge = id => !passages.some(p => p.bridge === id && !p.open);
  // Crossings between islands are real pendulum swings (rendering/heartCampaign.js); the way down is a swing or a jump.
  // Tidewell's townsfolk talk at any time; their lines change once the current is restored.
  const townsfolkAt = position => layout.town.folk.find(f => NEAR(position, f, 2.6));

  function plan() {
    if (stage !== 'escort' || !reefReady() || !spirit) { route = null; pathDirty = false; routeVersion++; return; }
    route = findPath(spirit, goal(), {
      height: layout.height,
      obstacles: passages.filter(p => !p.open).map(p => ({ x: p.x, z: p.z, radius: p.radius })),
      cell: 2,
      margin: 70, // the long way round the ring leaves the start-goal box
      maxSide: 100,
      maxGrade: 1.6,
      clearance: 0.4,
    });
    pathDirty = false;
    routeVersion++;
    goalReached = Boolean(route && Math.hypot(spirit.x - goal().x, spirit.z - goal().z) < 1.8);
  }

  const model = {
    layout,
    scout, // where Nim waits in Clover ({x, z}), or null
    get available() { return ready(); },
    get stage() { return stage; },
    get version() { return version; },
    get routeVersion() { return routeVersion; },
    get route() { return route; },
    get spirit() { return spirit && { ...spirit }; },
    get passages() { return passages.map(p => ({ ...p })); },
    get revealed() { return new Set(revealed); },
    get checkpoints() { return checkpoints; },
    get awakened() { return awakened(); },
    /** Seconds into the earthquake (-1 before it). */
    get quakeTime() { return quakeTime; },
    /** The crater exists once the dust burst hides the ground dropping. */
    get craterOpen() { return quakeTime >= HEART_QUAKE.burst; },
    quakeTo,
    get reefReady() { return reefReady(); },
    get sigil() { return stage === 'report' || stage === 'complete'; },
    get complete() { return stage === 'complete'; },
    /** Current walkable top of an island (it rises during the earthquake). */
    islandTop,
    liftOf,
    bridgeOpen: openBridge,
    get goal() {
      return {
        meet: scout && !awakened() ? 'TIDE HOOK EARNED · TALK TO NIM, SERA’S SCOUT, BY THE CLOVER GATE · IN CALM'
          : 'HEART · FIND SERA AT THE LISTENING SPRING · APPROACH IN CALM',
        escort: !awakened() ? 'HEART · THE REEF SLEEPS UNDER THE GROUND'
          : !reefReady() ? 'THE REEF IS RISING · WAIT FOR THE ISLANDS TO SETTLE'
          : checkpoints < 3 ? `WATER SPIRIT · SPRING ${checkpoints + 1}/3 · RAISE CRYSTAL BRIDGES IN CHAOS, GUIDE THE SPIRIT IN CALM · HOLD B: CURRENT SIGHT`
          : 'WATER SPIRIT · REACH THE SIPHON CORE ON THE SPIRE · PRESS E THERE WHILE CALM',
        report: 'TIDE SIGIL EARNED · RETURN TO SERA IN CALM',
        complete: 'THE STOLEN CURRENT IS RESTORED · GO SOUTH TO DIAMOND',
      }[stage];
    },
    hint(position, mode) {
      const folk = townsfolkAt(position);
      if (folk) return `E · TALK TO ${folk.name.toUpperCase()}`;
      if (!ready()) return NEAR(position, layout.sera, 5) ? 'SERA WAITS · FIRST FIND IVEN IN CLOVER AND TAKE THE TIDE HOOK' : null;
      if (scout && NEAR(position, scout, 4)) return mode === 'calm' ? 'E · SPEAK TO NIM' : 'CALM DOWN TO SPEAK TO NIM';
      if (NEAR(position, layout.sera, 5)) {
        if (stage === 'meet') return mode === 'calm' ? 'E · SPEAK TO SERA' : 'CALM DOWN TO SPEAK TO SERA';
        return stage === 'report' ? (mode === 'calm' ? 'E · RETURN TO SERA' : 'CALM DOWN TO SPEAK TO SERA')
          : stage === 'complete' ? 'SERA · THE CURRENT IS FREE' : 'SERA · GUIDE THE WATER SPIRIT TO THE SIPHON CORE';
      }
      const passage = passages.find(p => NEAR(position, p.switch, 4));
      if (passage) return passage.open ? `${passage.name} · RAISED`
        : !revealed.has(passage.id) ? 'A CRYSTAL SWITCH IS HIDDEN · COME CLOSER IN CHAOS'
        : mode === 'chaos' ? `E · RAISE ${passage.name}` : 'SWITCH REVEALED · STIR CHAOS AND PRESS E';
      const checkpoint = layout.checkpoints[checkpoints];
      if (stage === 'escort' && checkpoint && NEAR(position, checkpoint, 4.5)) {
        return goalReached ? mode === 'calm' ? 'E · GUIDE THE SPIRIT TO THE NEXT SPRING' : 'CALM DOWN TO GUIDE THE SPIRIT'
          : `WATER SPIRIT · ${checkpoint.name} · FOLLOW ITS A* ROUTE`;
      }
      if (stage === 'escort' && checkpoints === 3 && NEAR(position, layout.core, 5)) {
        return goalReached ? mode === 'calm' ? 'E · RELEASE THE STOLEN CURRENT' : 'CALM DOWN TO REACH THE SIPHON CORE'
          : 'FOLLOW THE WATER SPIRIT TO THE SIPHON CORE';
      }
      return null;
    },
    interact(position, mode, chaos = 0) {
      const folk = townsfolkAt(position);
      if (folk) return say('folk', model.sigil ? folk.restored : folk.dry, 7000);
      if (!ready()) return NEAR(position, layout.sera, 5)
        ? say('locked', 'SERA · I can feel the Tide Hook and the Root Sigil calling, but you need both before the reef will rise. Find Iven in Clover first.')
        : null;
      if (scout && NEAR(position, scout, 4)) {
        if (mode !== 'calm' || chaos >= CALM) return say('nim-calm', 'NIM · Easy, easy. Calm down and I will show you something.');
        if (!awakened() && !visionAsked) {
          visionAsked = true;
          return say('vision', 'NIM · You carry the Tide Hook? Then you should see what my scrying shell just showed me. Heart is breaking.', 5000);
        }
        return say('nim', 'NIM · Go east. Sera is waiting at the Listening Spring, and your hook is the only way up.');
      }
      if (NEAR(position, layout.sera, 5)) {
        if (mode !== 'calm' || chaos >= CALM) return say('calm', 'SERA · Become still, traveller. The current is listening.');
        if (stage === 'meet') {
          stage = 'escort';
          spirit = { ...layout.spring };
          pathDirty = true;
          version++;
          return say('meet', 'SERA · You came. Listen, then: the spring remembers what the Triad did here.', 5000);
        }
        if (stage === 'report') {
          stage = 'complete';
          version++;
          return say('complete', 'SERA · The current flows free again. The Diamond maker’s mark on the broken siphon points south. Take the Tide Sigil to the Shatterglass Relay.', 11000);
        }
        if (stage === 'complete') return say('sera', 'SERA · The Heart current is yours to carry. Diamond lies south, beyond the quarry road.');
        return say('escort', 'SERA · Guide the water spirit through the three springs, then release the current at the siphon core on the spire.');
      }
      const passage = passages.find(p => NEAR(position, p.switch, 4));
      if (passage) {
        if (passage.open) return say('open', `${passage.name} is already raised. It stays up.`);
        if (mode !== 'chaos' || chaos < 0.45) return say('chaos', 'THE CRYSTAL SWITCH IS DARK · Stir chaos to reveal and energize it.');
        if (!revealed.has(passage.id)) return say('hidden', 'A hidden crystal switch appears. Press E again to energize it.');
        passage.open = true;
        pathDirty = true;
        version++;
        return say('passage', `${passage.name} RISES · The water spirit replans its route.`, 5000);
      }
      const checkpoint = layout.checkpoints[checkpoints];
      if (stage === 'escort' && checkpoint && NEAR(position, checkpoint, 4.5)) {
        if (!goalReached) return say('waiting', 'The spirit has not reached this spring yet. Follow the glowing A* route and raise the bridge it needs.', 4000);
        if (mode !== 'calm' || chaos >= CALM) return say('calm', 'The spring is churning. Calm down to guide the spirit onward.');
        checkpoints++;
        goalReached = false;
        pathDirty = true;
        version++;
        return say('checkpoint', checkpoints < 3
          ? `${checkpoint.name} RESTORED · The spirit is replanning for spring ${checkpoints + 1}.`
          : 'THREE SPRINGS RESTORED · Guide the spirit up to the siphon core on the spire.', 5500);
      }
      if (stage === 'escort' && checkpoints === 3 && NEAR(position, layout.core, 5)) {
        if (!goalReached) return say('waiting', 'Wait for the water spirit to reach the siphon core.', 3500);
        if (mode !== 'calm' || chaos >= CALM) return say('calm', 'The siphon is unstable. Calm down to release the current.');
        stage = 'report';
        version++;
        return say('sigil', 'TIDE SIGIL · The siphon releases Heart’s stolen current. Its broken maker’s mark points south to Diamond. Return to Sera in calm.', 11000);
      }
      return null;
    },
    update(dt, player, state, inHeart) {
      let message = null;
      // Skipped Nim? The vision plays once on arrival in Heart instead, so the quake is never missed.
      let vision = null;
      if (ready() && inHeart && !awakened() && !visionAsked) { visionAsked = true; vision = 'gate'; }

      if (inHeart && state.mode === 'chaos' && state.chaos >= 0.5) {
        for (const passage of passages) {
          if (!revealed.has(passage.id) && NEAR(player.position, passage.switch, 12)) {
            revealed.add(passage.id);
            version++;
            message = say('switch', 'HIDDEN CRYSTAL SWITCH REVEALED · Reach it and press E while chaos is high.', 5500);
          }
        }
      }
      if (pathDirty) plan();
      if (stage === 'escort' && reefReady() && spirit && route?.path?.length) {
        let remaining = 2.6 * Math.min(dt, 0.1);
        while (remaining > 0 && route.path.length > 1) {
          const next = route.path[1];
          const dx = next.x - spirit.x, dz = next.z - spirit.z, distance = Math.hypot(dx, dz);
          if (distance <= remaining) {
            spirit.x = next.x; spirit.z = next.z; route.path.shift(); routeVersion++; remaining -= distance;
          } else {
            spirit.x += dx / distance * remaining;
            spirit.z += dz / distance * remaining;
            remaining = 0;
          }
        }
        if (Math.hypot(spirit.x - goal().x, spirit.z - goal().z) < 1.8) {
          goalReached = true;
          spirit.x = goal().x; spirit.z = goal().z;
        }
        if (pathDirty) plan();
      }
      return { message, vision };
    },
    // No fall recovery over the reef: dropping or swinging off an island is a way down, not a failure.
    // You land in the crater (or on the lake) and walk out; the game's long-fall respawn is off here too.
    get currentGoal() { return stage === 'escort' ? { ...goal() } : null; },
    setTestStage(next) {
      if (!['meet', 'escort', 'core', 'report', 'complete'].includes(next)) throw new Error(`Invalid Heart test stage: ${next}`);
      reset();
      if (next !== 'meet') {
        quakeTime = HEART_QUAKE.end;
        visionAsked = true;
        spirit = { ...layout.spring };
      }
      if (next === 'escort' || next === 'core') stage = 'escort';
      if (next === 'core') {
        passages.forEach(p => { p.open = true; });
        checkpoints = 3;
        spirit = { ...layout.core };
        goalReached = true;
      }
      if (next === 'report' || next === 'complete') stage = next;
      pathDirty = true;
      version++;
    },
    reset,
  };
  return model;
}
