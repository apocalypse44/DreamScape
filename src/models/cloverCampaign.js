import { ROOT_START, ROOT_HEADINGS, ROOT_LANDINGS, growRoots, rootConnects, rootBridge } from './cloverGrowth.js';

export const CLOVER_STORY = Object.freeze({
  archive: { id: 'clover-archive', name: 'ROOTKEEPER ARCHIVE', x: -34, z: -420, top: 12,
    destination: { x: -30, z: -430 }, note: 'IVEN · WEST OF THE UPPER TERRACE', directions: 'Climb the central terraces. At the third terrace, take the west stone walkway to Iven.' },
  iven: { x: -40, z: -414, top: 12 },
  chest: { x: -28, z: -415, top: 12 },
  scar: { id: 'clover-scar', name: 'STORMLEAF SCAR', x: -104, z: -455, top: 12,
    destination: { x: -104, z: -455 }, note: 'VIA THE RESTORED LIVING ROAD', directions: 'From the Archive, restore three root crossings: west, north, then west. The Scar holds the Root Sigil.' },
});
export const CLOVER_MAP_LOCATIONS = [CLOVER_STORY.archive, CLOVER_STORY.scar];
export const ROOT_APPROACH = Object.freeze({ x: -22, z: -430, width: 26, depth: 4, top: 12, bottom: 10.8, solid: true });
const near = (p, q, radius = 4) => Math.hypot(p.x - q.x, p.z - q.z) < radius && Math.abs(p.y - 2.05 - q.top) < 1.5;
const say = (kind, text, ms = 6500) => ({ kind, text, ms });
const cardinal = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

export function livingRoadArea(x, z, margin = 0) {
  return x > -120 - margin && x < -23 + margin && z > -472 - margin && z < -402 + margin;
}
export function livingRoadGround(x, z, original) {
  if (!livingRoadArea(x, z, 5)) return original;
  const edge = Math.min(x + 125, -18 - x, z + 477, -397 - z) / 5;
  const t = Math.max(0, Math.min(1, edge));
  return original + (-7 - original) * t * t * (3 - 2 * t);
}

export function createCloverCampaign({ seed = 1, ready = () => true } = {}) {
  let stage, generation, guides, pending, elapsed, version, checkpoint, trial;
  function reset() {
    stage = 'meet'; generation = 0; guides = [0, 1, 2]; pending = null; elapsed = 0; version = 0;
    checkpoint = { ...ROOT_START, z: ROOT_START.z + 3 }; trial = null;
  }
  reset();
  const completeRoad = growRoots({ seed });
  const platforms = [ROOT_APPROACH,
    ...ROOT_LANDINGS.map(p => ({ ...p, name: 'root-landing', bottom: -7, solid: true })),
    ...completeRoad.backbone.map((s, i) => rootBridge(s, () => generation > i))];
  const interaction = position => {
    if (near(position, CLOVER_STORY.iven)) return { kind: 'iven', at: CLOVER_STORY.iven };
    if (near(position, CLOVER_STORY.chest, 3)) return { kind: 'chest', at: CLOVER_STORY.chest };
    if (stage === 'road' && generation < 3 && near(position, ROOT_LANDINGS[generation], 4.8)) return { kind: 'guide', at: ROOT_LANDINGS[generation] };
    if (near(position, CLOVER_STORY.scar, 4)) return { kind: 'scar', at: CLOVER_STORY.scar };
    return null;
  };
  function settleCheckpoint(player) {
    if (!player.grounded) return;
    for (let i = 0; i <= generation; i++) if (near(player.position, ROOT_LANDINGS[i], 4)) checkpoint = { ...ROOT_LANDINGS[i], z: ROOT_LANDINGS[i].z + 3 };
  }
  const model = {
    platforms, ready,
    get available() { return ready(); },
    get stage() { return stage; }, get generation() { return generation; }, get version() { return version; },
    get guides() { return [...guides]; }, get pending() { return pending; }, get trial() { return trial; },
    get progress() { return pending ? Math.min(1, elapsed / 2.4) : 1; },
    get sigil() { return stage === 'chest' || stage === 'complete'; },
    get hook() { return stage === 'complete'; },
    get growth() { return growRoots({ rounds: generation, guides, seed }); },
    interaction,
    ownsArea(position) {
      return livingRoadArea(position.x, position.z, 4) ||
        (Math.abs(position.x - ROOT_APPROACH.x) < ROOT_APPROACH.width / 2 + 1 && Math.abs(position.z - ROOT_APPROACH.z) < ROOT_APPROACH.depth / 2 + 1);
    },
    get goal() {
      return stage === 'meet' ? 'CLOVER · FIND IVEN AT THE ROOTKEEPER ARCHIVE · WEST OF THE UPPER TERRACE'
        : stage === 'road' ? `LIVING ROAD ${generation}/3 · ${pending ? 'THE ROOTS ARE TAKING HOLD' : 'E IN CALM TURNS THE GUIDE · E IN CHAOS GROWS THE ROAD'}`
        : stage === 'scar' ? 'THE ROAD REMEMBERS · CROSS TO THE STORMLEAF SCAR · READ THE PATTERN IN CALM'
        : stage === 'chest' ? 'ROOT SIGIL EARNED · RETURN TO IVEN’S ARCHIVE · OPEN THE TIDE HOOK CHEST'
        : 'ROOT SIGIL AND TIDE HOOK EARNED · GO EAST TO HEART · FIND SERA';
    },
    hint(position, mode) {
      const target = interaction(position);
      if (!target) return null;
      if (!ready()) return 'THE ARCHIVE WAITS · E · IVEN CAN EXPLAIN THE MISSING SPADE TESTIMONY';
      if (pending) return 'THE ROOTS ARE TAKING HOLD · THE CROSSING BECOMES SAFE WHEN GROWTH FINISHES';
      if (target.kind === 'iven') return mode === 'chaos' ? 'BECOME CALM TO HEAR IVEN' : 'E · SPEAK WITH IVEN';
      if (target.kind === 'chest') return !model.sigil ? 'SEALED CHEST · RESTORE THE ROAD AND READ THE SCAR FIRST'
        : model.hook ? 'TIDE HOOK TAKEN · HEART LIES EAST' : mode === 'chaos' ? 'BECOME CALM TO OPEN THE CHEST' : 'E · OPEN THE TIDE HOOK CHEST';
      if (target.kind === 'scar') return !model.sigil && generation < 3 ? 'THE PATTERN IS INCOMPLETE · RESTORE ALL THREE CROSSINGS'
        : model.sigil ? 'THE TRUE BINDINGS ARE INSCRIBED IN YOUR GRIMOIRE'
        : mode === 'chaos' ? 'BECOME CALM TO READ THE ORIGINAL BINDING PATTERN' : 'E · READ THE SCAR · CLAIM THE ROOT SIGIL';
      return mode === 'chaos' ? `E · ENERGIZE GUIDE ${generation + 1} · FACING ${cardinal[guides[generation]]}`
        : `E · TURN GUIDE ${generation + 1} · FACING ${cardinal[guides[generation]]} · FOLLOW THE LEAF MARK TOWARD THE NEXT LANDING`;
    },
    interact(position, mode) {
      const target = interaction(position);
      if (!target || pending) return null;
      if (!ready()) return say('locked', 'IVEN · Bring Neris’s Lantern Sigil and learn what shields the Hollow Crown in Spade’s castle. Then these roots will recognize your testimony.');
      const calm = mode === 'calm';
      if (target.kind === 'iven') {
        if (!calm) return say('calm', 'IVEN · Let the storm settle. Listen before you ask the roots to grow.');
        if (stage === 'meet') { stage = 'road'; version++;
          return say('meet', 'IVEN · The Triad severed our living road. The Stormleaf Scar still remembers the true bindings. Read the leaf marks and turn each guide in calm with E. Stir chaos, then press E at that guide to wake its roots. Cross to the next landing; what you restore will remain.', 14000); }
        return say('iven', model.sigil ? 'IVEN · A branch remembers where it came from. The Sigil reveals the true anchors. Take the Tide Hook from my chest, then seek Sera east in Heart.'
          : 'IVEN · Follow the leaf marks: west, north, west. Turn a guide in calm; wake it in chaos. A root that strikes stone needs a different heading.');
      }
      if (target.kind === 'chest') {
        if (!model.sigil) return say('sealed', 'The Archive chest opens only after the original pattern at the Scar is restored.');
        if (!calm) return say('calm', 'Let the storm settle before opening the Archive chest.');
        if (model.hook) return say('taken', 'The Tide Hook is already in your Satchel. Seek Sera in Heart, to the east.');
        stage = 'complete'; version++; return say('hook', 'TIDE HOOK · IVEN · Heart’s guardians once crossed crystal banks with this hook. Its anchors will answer you. Follow the stolen current east and find Sera.', 10000);
      }
      if (target.kind === 'scar') {
        if (generation < 3 || model.sigil) return null;
        if (!calm) return say('calm', 'The pattern is hidden by the storm. Become calm to read the Scar.');
        stage = 'chest'; version++;
        return say('sigil', 'ROOT SIGIL · The Scar reveals the genuine anchors beneath Veyr’s decoys. A stolen current leads east to Heart. Return to Iven’s Archive: the Tide Hook chest is now open to you.', 11000);
      }
      if (calm) { guides[generation] = (guides[generation] + 1) % 4; trial = null; version++;
        return say('turn', `GUIDE ${generation + 1} · ${cardinal[guides[generation]]}. Read the leaf mark toward the next landing, then wake the root in chaos.`, 3500); }
      trial = growRoots({ rounds: generation + 1, guides, seed });
      const candidate = trial.backbone[generation];
      version++;
      if (!rootConnects(candidate, ROOT_LANDINGS[generation + 1])) return say('blocked',
        (candidate?.blocked ? 'THE ROOT MEETS STONE' : 'THE ROOT TURNS BACK') + ' · This direction cannot reach the next landing. Become calm, turn the guide toward its leaf mark, and try again. Completed crossings remain.', 7000);
      pending = trial; elapsed = 0;
      return say('growing', 'THE LIVING ROAD AWAKENS · Wait for the roots to take hold before crossing.', 3500);
    },
    update(dt, player) {
      if (Number.isFinite(dt) && dt > 0 && pending) {
        elapsed += Math.min(dt, .1);
        if (elapsed >= 2.4) {
          generation++; pending = trial = null; version++;
          if (generation === 3) stage = 'scar';
          return say('bridge', `CROSSING ${generation}/3 RESTORED · ${generation === 3 ? 'The Scar lies ahead. Cross and read its pattern in calm.' : 'Cross to the next landing. Read its leaf mark in calm.'}`, 6000);
        }
      }
      if (player) settleCheckpoint(player);
      return null;
    },
    recovery(player) {
      if (model.ownsArea(player.position) && player.velocity.y < 0 && player.position.y - 2.05 < 8) return { ...checkpoint };
      return null;
    },
    // Explicit route for the cured companion. Terrain A* must not invent a path
    // through the ravine below these elevated, newly generated bridges.
    companionTarget(position, playerPosition) {
      if (!model.ownsArea(playerPosition)) return null;
      const points = [{ x: -10, z: -430 }, { x: -28, z: -430 }, { x: -28, z: -420 }, ROOT_START,
        ...ROOT_LANDINGS.slice(1, generation + 1)];
      const project = p => {
        let best = null, distance = Infinity, offset = 0;
        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i], b = points[i + 1], dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (length * length)));
          const x = a.x + dx * t, z = a.z + dz * t, d = Math.hypot(p.x - x, p.z - z);
          if (d < distance) { distance = d; best = { x, z, along: offset + t * length, i }; }
          offset += length;
        }
        return { ...best, distance };
      };
      const from = project(position), to = project(playerPosition);
      // Approach the authored line first, then visit every corner in order.
      // Selecting the next *nearest node* would cut diagonally over the ravine.
      if (from.distance > .8) return from;
      if (Math.abs(to.along - from.along) < 2) return { x: position.x, z: position.z };
      const forward = to.along > from.along;
      let corner = points[forward ? from.i + 1 : from.i];
      if (Math.hypot(position.x - corner.x, position.z - corner.z) < .6) corner = points[forward ? Math.min(points.length - 1, from.i + 2) : Math.max(0, from.i - 1)];
      return corner;
    },
    reset,
  };
  return model;
}
