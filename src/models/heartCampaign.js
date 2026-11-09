import { findPath } from './pathfinding.js';

export const HEART_REEF_TOP = 18;
const CALM = 0.4;
const NEAR = (p, q, radius) => Math.hypot(p.x - q.x, p.z - q.z) < radius;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const say = (kind, text, ms = 6500) => ({ kind, text, ms });

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
  const checkpoints = [
    { id: 'spring-one', name: 'FIRST SPRING', ...at(59) },
    { id: 'spring-two', name: 'RESONANCE POOL', ...at(78) },
    { id: 'spring-three', name: 'REEF HEART', ...at(97) },
  ];
  const passages = [50, 70, 90].map((along, i) => ({
    id: `passage-${i + 1}`, name: `CRYSTAL PASSAGE ${i + 1}`,
    ...at(along), switch: at(along - 5, 9), radius: 5.2,
  }));
  const reef = { ...at(69), along: 69, side: 0, length: 104, width: 66, top: HEART_REEF_TOP };
  const anchors = [
    { id: 'shore', at: at(13), top: 1.5 },
    { id: 'west', at: at(39, -22), top: HEART_REEF_TOP },
    { id: 'east', at: at(99, 22), top: HEART_REEF_TOP },
    { id: 'exit', at: at(32, -25), top: HEART_REEF_TOP },
  ];
  return {
    gate: { ...gate },
    sera: at(7, -9),
    seraApproach: at(7, -13),
    shoreAnchor: anchors[0].at,
    spring: at(38),
    checkpoints,
    passages,
    core: { id: 'siphon-core', name: 'SIPHON CORE', ...at(108) },
    reef,
    anchors,
    westLanding: anchors[1].at,
    eastLanding: anchors[2].at,
    local,
    height(x, z) {
      const { along, side } = local({ x, z });
      return HEART_REEF_TOP + 0.85 * Math.sin((along - 35) / 18) * Math.cos(side / 24);
    },
    ownsArea(position, margin = 0) {
      const { along, side } = local(position);
      return along >= 8 - margin && along <= 120 + margin && Math.abs(side) <= 43 + margin;
    },
  };
}

export function heartGrapplePose(from, to, elapsed) {
  const duration = 2.2;
  const progress = Math.max(0, Math.min(1, elapsed / duration));
  const eased = smooth(progress);
  return {
    x: from.x + (to.x - from.x) * eased,
    z: from.z + (to.z - from.z) * eased,
    top: from.top + (to.top - from.top) * eased + Math.sin(progress * Math.PI) * 7,
    progress,
    duration,
  };
}

export function createHeartCampaign({ layout, ready = () => true, terrainHeight = () => 1.5 } = {}) {
  if (!layout) throw new Error('Heart campaign requires its kingdom layout.');
  let stage, checkpoints, passages, spirit, route, routeVersion, pathDirty;
  let revealed, awakened, riseTime, transition, landing, lastSafe, version, goalReached;

  function reset() {
    stage = 'meet';
    checkpoints = 0;
    passages = layout.passages.map(p => ({ ...p, open: false }));
    spirit = null;
    route = null;
    routeVersion = 0;
    pathDirty = true;
    revealed = new Set();
    awakened = false;
    riseTime = 0;
    transition = null;
    landing = 'shore';
    lastSafe = { ...layout.sera, top: terrainHeight(layout.sera.x, layout.sera.z) };
    version = 0;
    goalReached = false;
  }
  reset();

  const reefReady = () => awakened && riseTime >= 4;
  const reefHeight = () => 1.5 + (HEART_REEF_TOP - 1.5) * smooth(riseTime / 4);
  const goal = () => checkpoints < layout.checkpoints.length ? layout.checkpoints[checkpoints] : layout.core;

  function plan() {
    if (stage !== 'escort' || !reefReady() || !spirit) { route = null; pathDirty = false; routeVersion++; return; }
    route = findPath(spirit, goal(), {
      height: layout.height,
      obstacles: passages.filter(p => !p.open).map(p => ({ x: p.x, z: p.z, radius: p.radius })),
      cell: 2,
      margin: 20,
      maxSide: 90,
      maxGrade: 1.6,
      clearance: 0.4,
    });
    pathDirty = false;
    routeVersion++;
    goalReached = Boolean(route && Math.hypot(spirit.x - goal().x, spirit.z - goal().z) < 1.8);
  }

  function beginGrapple(position, anchor) {
    if (!reefReady()) return say('reef', 'THE REEF IS STILL RISING · Stir chaos here, then wait for the crystal landings to settle.');
    const to = anchor.id === 'shore' ? layout.westLanding
      : anchor.id === 'exit' ? layout.shoreAnchor
      : anchor.id === 'west' ? layout.eastLanding : layout.westLanding;
    const destination = anchor.id === 'shore' ? 'west' : anchor.id === 'exit' ? 'shore'
      : anchor.id === 'west' ? 'east' : 'west';
    const from = { x: position.x, z: position.z, top: position.y - 2.05 };
    const top = destination === 'shore' ? terrainHeight(to.x, to.z)
      : reefHeight() + layout.height(to.x, to.z) - HEART_REEF_TOP;
    transition = { from, to: { ...to, top }, destination, elapsed: 0 };
    return say('grapple', 'TIDE HOOK · Hold on. The crystal anchor is carrying you to safe ground.', 3000);
  }

  const model = {
    layout,
    get available() { return ready(); },
    get stage() { return stage; },
    get version() { return version; },
    get routeVersion() { return routeVersion; },
    get route() { return route; },
    get spirit() { return spirit && { ...spirit }; },
    get passages() { return passages.map(p => ({ ...p })); },
    get revealed() { return new Set(revealed); },
    get checkpoints() { return checkpoints; },
    get awakened() { return awakened; },
    get reefReady() { return reefReady(); },
    get reefHeight() { return reefHeight(); },
    get traversing() { return transition !== null; },
    get sigil() { return stage === 'report' || stage === 'complete'; },
    get complete() { return stage === 'complete'; },
    get goal() {
      return {
        meet: 'HEART · FIND SERA AT THE LISTENING SPRING · APPROACH IN CALM',
        escort: !awakened ? 'HEART · STIR CHAOS TO RAISE THE RESONANCE REEF'
          : !reefReady() ? 'THE REEF IS RISING · WAIT FOR THE CRYSTAL LANDINGS'
          : checkpoints < 3 ? `WATER SPIRIT · CHECKPOINT ${checkpoints + 1}/3 · REVEAL SWITCHES IN CHAOS, THEN GUIDE THE SPIRIT IN CALM`
          : 'WATER SPIRIT · REACH THE SIPHON CORE · PRESS E THERE WHILE CALM',
        report: 'TIDE SIGIL EARNED · RETURN TO SERA IN CALM',
        complete: 'THE STOLEN CURRENT IS RESTORED · GO SOUTH TO DIAMOND',
      }[stage];
    },
    hint(position, mode) {
      if (!ready()) return layout.ownsArea(position) ? 'THE HEART GATE IS QUIET · FIRST FIND IVEN IN CLOVER AND TAKE THE TIDE HOOK' : null;
      const anchor = layout.anchors.find(a => NEAR(position, a.at, 4));
      if (anchor) return !reefReady() ? 'THE REEF IS STILL RISING' : 'E · GRAPPLE TO A SAFE CRYSTAL LANDING';
      if (NEAR(position, layout.sera, 5)) {
        if (stage === 'meet') return mode === 'calm' ? 'E · SPEAK TO SERA' : 'CALM DOWN TO SPEAK TO SERA';
        return stage === 'report' ? (mode === 'calm' ? 'E · RETURN TO SERA' : 'CALM DOWN TO SPEAK TO SERA')
          : stage === 'complete' ? 'SERA · THE CURRENT IS FREE' : 'SERA · GUIDE THE WATER SPIRIT TO THE SIPHON CORE';
      }
      const passage = passages.find(p => NEAR(position, p.switch, 4));
      if (passage) return passage.open ? `${passage.name} · OPEN`
        : !revealed.has(passage.id) ? 'A CRYSTAL SWITCH IS HIDDEN · COME CLOSER IN CHAOS'
        : mode === 'chaos' ? `E · ENERGIZE ${passage.name}` : `SWITCH REVEALED · STIR CHAOS AND PRESS E`;
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
      if (!ready()) return say('locked', 'SERA · I can feel the Tide Hook and the Root Sigil calling, but you need both before the reef will rise. Find Iven in Clover first.');
      const anchor = layout.anchors.find(a => NEAR(position, a.at, 4));
      if (anchor) return beginGrapple(position, anchor);
      if (NEAR(position, layout.sera, 5)) {
        if (mode !== 'calm' || chaos >= CALM) return say('calm', 'SERA · Become still, traveller. The current is listening.');
        if (stage === 'meet') {
          stage = 'escort';
          spirit = { ...layout.spring };
          pathDirty = true;
          version++;
          return say('meet', 'SERA · The Triad stole Heart’s current and sealed it beneath the reef. My water spirit can reach the siphon, but the reef must rise first. Stir chaos here, then use the Tide Hook at the shore anchor. Follow the spirit’s route; switches reveal in chaos, and each spring checkpoint is guided in calm.', 15000);
        }
        if (stage === 'report') {
          stage = 'complete';
          version++;
          return say('complete', 'SERA · The current flows free again. The Diamond maker’s mark on the broken siphon points south. Take the Tide Sigil to the Shatterglass Relay.', 11000);
        }
        if (stage === 'complete') return say('sera', 'SERA · The Heart current is yours to carry. Diamond lies south, beyond the quarry road.');
        return say('escort', 'SERA · Guide the water spirit through the three springs, then release the current at the siphon core.');
      }
      const passage = passages.find(p => NEAR(position, p.switch, 4));
      if (passage) {
        if (passage.open) return say('open', `${passage.name} is already open. Its passage stays clear.`);
        if (mode !== 'chaos' || chaos < 0.45) return say('chaos', 'THE CRYSTAL SWITCH IS DARK · Stir chaos to reveal and energize it.');
        if (!revealed.has(passage.id)) return say('hidden', 'A hidden crystal switch appears. Press E again to energize the passage.');
        passage.open = true;
        pathDirty = true;
        version++;
        return say('passage', `${passage.name} OPENS · The water spirit replans its route.`, 5000);
      }
      const checkpoint = layout.checkpoints[checkpoints];
      if (stage === 'escort' && checkpoint && NEAR(position, checkpoint, 4.5)) {
        if (!goalReached) return say('waiting', 'The spirit has not reached this spring yet. Follow the glowing A* route and keep the way clear.', 4000);
        if (mode !== 'calm' || chaos >= CALM) return say('calm', 'The spring is churning. Calm down to guide the spirit onward.');
        checkpoints++;
        goalReached = false;
        pathDirty = true;
        version++;
        return say('checkpoint', checkpoints < 3
          ? `${checkpoint.name} RESTORED · The spirit is replanning for spring ${checkpoints + 1}.`
          : 'THREE SPRINGS RESTORED · Guide the spirit to the siphon core.', 5500);
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
      let message = null, flight = null, target = null;
      if (ready() && stage !== 'complete' && inHeart && state.mode === 'chaos' && state.chaos >= 0.55 && !awakened) {
        awakened = true;
        riseTime = 0;
        version++;
        message = say('rise', 'THE RESONANCE REEF RISES · The Tide Hook’s crystal anchors are awake. Find the shore anchor and press E.', 9000);
      }
      if (awakened && riseTime < 4) {
        riseTime = Math.min(4, riseTime + Math.min(dt, 0.1));
        if (riseTime === 4) pathDirty = true;
      }

      if (transition) {
        transition.elapsed += Math.min(dt, 0.05);
        flight = heartGrapplePose(transition.from, transition.to, transition.elapsed);
        if (transition.elapsed >= 2.2) {
          target = { ...transition.to, yaw: Math.atan2(layout.gate.x - transition.to.x, layout.gate.z - transition.to.z) };
          landing = transition.destination;
          lastSafe = { ...target };
          transition = null;
          flight = null;
          message = say('landed', 'CRYSTAL LANDING REACHED · The reef holds steady underfoot.', 3000);
        }
      }

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
      if (player.grounded && layout.ownsArea(player.position) && player.position.y - 2.05 >= HEART_REEF_TOP - 2) {
        lastSafe = { x: player.position.x, z: player.position.z, top: layout.height(player.position.x, player.position.z) };
      }
      return { message, flight, target };
    },
    recovery(player) {
      if (player.grounded || !layout.ownsArea(player.position, 8) || player.velocity.y >= 0 || player.position.y - 2.05 > 7) return null;
      return { ...lastSafe };
    },
    get currentGoal() { return stage === 'escort' ? { ...goal() } : null; },
    setTestStage(next) {
      if (!['meet', 'escort', 'core', 'report', 'complete'].includes(next)) throw new Error(`Invalid Heart test stage: ${next}`);
      reset();
      if (next !== 'meet') {
        awakened = true;
        riseTime = 4;
        spirit = { ...layout.spring };
        lastSafe = { ...layout.spring, top: layout.height(layout.spring.x, layout.spring.z) };
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
