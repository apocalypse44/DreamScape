// Chapter IV · The Unbroken Pattern (FOURFOLD_ACCORD_STORY.md, "Diamond - The Unbroken Pattern").
// Meet Artificer Orin beside the broken Shatterglass Relay, gather four conduit fragments in calm,
// fit them into the relay's sockets in calm (each fit narrows what its neighbours can still hold),
// then stir chaos at the relay: the buried sockets surface and fill in, the pulse runs, and the
// escape gate and inversion core open. Return to Orin for the Prism Sigil.
// Pure logic, no Three.js. The relay itself is the constraint solver in diamondWfc.js.
import { createRelay, popcount } from './diamondWfc.js';

// Diamond is the southern kingdom (demo key 4). The game passes the real gate from
// createKingdomGates; this default only serves tests and the villager entry for Orin.
export const DIAMOND_GATE = { x: 0, z: 344 };
export const BOARD = { size: 4, socket: 3.2 }; // 4x4 sockets, metres per socket
export const FRAGMENTS = 4;
const CALM = 0.4;
const TALK = 5;        // metres from Orin to talk
const PICKUP = 2.5;    // metres from a fragment to pick it up
const RELAY_RANGE = 22; // metres from the relay's centre for chaos to power it

// Every authored position, measured from the gate: `along` runs into the kingdom, `side` across it.
export function diamondLayout(gate = DIAMOND_GATE) {
  const d = Math.hypot(gate.x, gate.z) || 1, ox = gate.x / d, oz = gate.z / d;
  const at = (along, side) => ({ x: +(gate.x + ox * along - oz * side).toFixed(2), z: +(gate.z + oz * along + ox * side).toFixed(2) });
  return {
    gate: { x: gate.x, z: gate.z },
    center: at(40, 0),
    orin: at(30, -11),
    fragments: [at(28, 12), at(47, 16), at(58, -6), at(50, -19)].map((p, i) => ({ id: `fragment-${i + 1}`, ...p })),
  };
}

// World position of socket (x, y): board x runs east (+x), board y runs south (+z).
export function socketCenter(layout, x, y) {
  const half = (BOARD.size - 1) / 2;
  return { x: layout.center.x + (x - half) * BOARD.socket, z: layout.center.z + (y - half) * BOARD.socket };
}

// The socket under a position, or null when off the board.
export function socketAt(layout, p) {
  const x = Math.floor((p.x - layout.center.x) / BOARD.socket + BOARD.size / 2);
  const y = Math.floor((p.z - layout.center.z) / BOARD.socket + BOARD.size / 2);
  return x >= 0 && y >= 0 && x < BOARD.size && y < BOARD.size ? { x, y } : null;
}

const say = (kind, text, ms = 7000) => ({ kind, text, ms });
// A fragment is always a real conduit (never a blank). Straights and corners come first, then
// junctions, end caps and the cross, so the first fit usually looks like a pipe run.
const FIT_ORDER = [2, 3, 1, 4];
const conduits = options => options.filter(t => t !== 0).sort((a, b) => FIT_ORDER.indexOf(popcount(a)) - FIT_ORDER.indexOf(popcount(b)) || a - b);
const near = (p, q, r) => Math.hypot(p.x - q.x, p.z - q.z) < r;

// ready(): whether the chapter may begin (the game passes "the Tide Sigil is in the satchel").
// relay: optional solver configuration (tests use it; the game uses the default relay).
export function createDiamondCampaign({ layout = diamondLayout(), ready = () => true, relay: relayConfig = {} } = {}) {
  const relay = createRelay(relayConfig);
  let version = 0;
  let stage, collected, order, jammed, attempts, flow, turnedAway, narrowed, braced;
  function reset() {
    relay.reset();
    stage = 'meet'; collected = new Set(); order = []; jammed = false; attempts = 0;
    flow = null; turnedAway = false; narrowed = []; braced = false; version++;
  }
  reset();

  const fitting = () => stage === 'collect' || stage === 'repair';
  function changed(result, kind, text) {
    narrowed = result.narrowed; jammed = false; version++;
    return say(kind, text, 4000);
  }

  // Chaos at a fully fitted relay: the buried sockets surface and the solver fills them around the
  // player's fragments. If it cannot, the first attempt jams (nothing is lost; the player lifts and
  // refits in calm). After that, Orin's workers brace it with their known-good pattern.
  function power() {
    const result = relay.solve();
    if (!result.ok || (result.fallback && result.reason !== 'budget' && attempts === 0)) {
      attempts++;
      if (result.ok) relay.undo(); // back to the player's fragments
      jammed = true; version++;
      return say('jam', 'THE RELAY JAMS · The buried conduits cannot reach your fragments. Let the world calm, lift a fragment with X and fit it another way.', 9000);
    }
    braced = result.fallback;
    flow = relay.trace();
    stage = 'report'; narrowed = []; version++;
    const side = flow.reached.has('side-gate');
    return say('powered', `${braced ? 'ORIN’S WORKERS BRACE THE RELAY · ' : ''}THE RELAY HOLDS · The pulse reaches the escape gate and the inversion core.` +
      `${side ? ' A side gate opens too: a sealed workshop is free.' : ''} Return to Orin in calm.`, 10000);
  }

  return {
    relay,
    layout,
    get stage() { return stage; },
    get available() { return ready(); },
    get collected() { return collected.size; },
    get fitted() { return order.length; },
    get flow() { return flow; },          // pulse result once powered: { cells, reached, leaks, complete }
    get braced() { return braced; },      // true if the fallback pattern was used
    get jammed() { return jammed; },
    get narrowed() { return narrowed; },  // sockets that narrowed on the last fit, as [x, y]
    get version() { return version; },    // changes whenever the board or progress changes
    get sigil() { return stage === 'complete'; },
    isCollected: id => collected.has(id),
    socketAt: p => socketAt(layout, p),
    get goal() {
      return {
        meet: 'DIAMOND · FIND ARTIFICER ORIN BESIDE THE SHATTERGLASS RELAY · APPROACH IN CALM',
        collect: `CONDUIT FRAGMENTS ${collected.size}/${FRAGMENTS} · GATHER THEM AROUND THE RELAY IN CALM`,
        repair: order.length < FRAGMENTS ? `RELAY ${order.length}/${FRAGMENTS} FITTED · STAND ON A SOCKET · V FITS OR TURNS · X LIFTS`
          : jammed ? 'THE RELAY JAMMED · CALM DOWN · X LIFTS A FRAGMENT TO REFIT IT' : 'RELAY SET · STIR CHAOS AT THE RELAY TO POWER IT',
        report: 'THE RELAY HOLDS · RETURN TO ORIN IN CALM',
        complete: 'PRISM SIGIL EARNED · RETURN TO SPADE WITH THE FOUR SIGILS',
      }[stage];
    },

    // V: fit a loose fragment into the socket underfoot, or turn the one fitted there last.
    fit(position, chaos) {
      if (!fitting()) return null;
      const cell = socketAt(layout, position);
      if (!cell) return say('hint', 'Stand on one of the relay’s sockets to fit a fragment.', 3000);
      if (chaos >= CALM) return say('unstable', 'The conduits shake loose in the storm. Become calm to fit a fragment.', 3500);
      const { x, y } = cell, i = relay.index(x, y);
      if (relay.isPlaced(x, y)) {
        if (order[order.length - 1] !== i) return say('buried', 'Fragments fitted after this one rest on it. Press X to lift them first.', 3500);
        const current = relay.tileAt(x, y);
        relay.undo(); order.pop();
        const options = conduits(relay.options(x, y)), start = options.indexOf(current);
        for (let k = 1; k < options.length; k++) {
          const result = relay.place(x, y, options[(start + k) % options.length]);
          if (result.ok) { order.push(i); return changed(result, 'turn', 'The fragment turns. The sockets beside it shift with it.'); }
        }
        relay.place(x, y, current); order.push(i);
        return say('fixed', 'This socket accepts only one shape.', 3000);
      }
      if (collected.size - order.length <= 0) {
        return say('empty', stage === 'collect' ? 'You carry no loose fragment. Find the rest around the relay.'
          : 'Every fragment is fitted. Press X to lift one and try another.', 3500);
      }
      for (const tile of conduits(relay.options(x, y))) {
        const result = relay.place(x, y, tile);
        if (result.ok) {
          order.push(i);
          return changed(result, 'fit', `FRAGMENT FITTED ${order.length}/${FRAGMENTS} · The sockets beside it narrow to what can still meet it.`);
        }
      }
      return say('jam', 'No fragment fits here without breaking the relay. Try another socket, or press X to lift the last one.', 4000);
    },

    // X: lift the most recently fitted fragment back into the player's hands.
    lift() {
      if (!fitting()) return null;
      if (!order.length) return say('none', 'No fitted fragment to lift.', 2500);
      relay.undo(); order.pop();
      narrowed = []; jammed = false; version++;
      return say('lift', `FRAGMENT LIFTED · ${order.length}/${FRAGMENTS} fitted.`, 3000);
    },

    // position: the player's {x, z}; chaos: 0–1. Returns a story event or null.
    update(dt, position, chaos) {
      const calm = chaos < CALM;
      if (calm) jammed = false;
      if (stage === 'meet') {
        if (!near(position, layout.orin, TALK)) { turnedAway = false; return null; }
        if (!calm) return null;
        if (!ready()) {
          if (turnedAway) return null;
          turnedAway = true;
          return say('waiting', 'ORIN · Not yet. Heart’s stolen current still feeds the Triad’s chains. Bring me the Tide Sigil from Sera’s spring, then we can finish what my workers started.', 8000);
        }
        stage = 'collect'; version++;
        return say('orin', 'ORIN · Do not mistake a kingdom for its captors. My workers broke the Shatterglass Relay so the Triad could not use it, and the pieces scattered. Gather the four conduit fragments around it while the world is calm, then fit them into its sockets.', 11000);
      }
      if (stage === 'collect') {
        if (!calm) return null;
        for (const f of layout.fragments) {
          if (collected.has(f.id) || !near(position, f, PICKUP)) continue;
          collected.add(f.id); version++;
          if (collected.size < FRAGMENTS) return say('fragment', `CONDUIT FRAGMENT ${collected.size}/${FRAGMENTS} · Stand on a relay socket and press V to fit it.`, 4500);
          stage = 'repair';
          return say('fragments', 'ALL FRAGMENTS RECOVERED · Fit all four into the relay. V fits or turns the fragment under you; X lifts the last one.', 7000);
        }
        return null;
      }
      if (stage === 'repair') {
        if (calm || jammed || order.length < FRAGMENTS || !near(position, layout.center, RELAY_RANGE)) return null;
        return power();
      }
      if (stage === 'report' && calm && near(position, layout.orin, TALK)) {
        stage = 'complete'; version++;
        return say('sigil', 'PRISM SIGIL · ORIN · The workers are free, and the relay remembers the pattern the Triad forbade. Its inversion circuit can strip Morcant’s armor once his supply is cut. Return to Spade with all four sigils.', 12000);
      }
      return null;
    },
    reset,
  };
}
