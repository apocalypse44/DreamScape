// Chapter II · The Swarm Remembers (docs/FOURFOLD_ACCORD_STORY.md, "Spade - The Swarm Remembers").
// Meet Neris, guide the swarm in calm to light three memory lanterns, break the border anchor's ward
// in chaos with coordinated swarm strikes, then return to Neris for the Lantern Sigil.
export const LANTERN_SITES = [
  { id: 'gate', u: 30, v: -10 },
  { id: 'market', u: 50, v: 10 },
  { id: 'stair', u: 70, v: -10 },
].map(site => ({ ...site, x: -344 - site.u, z: site.v }));
export const WARD = { x: -447, z: -48, radius: 2.5, range: 35 };
// Spade castle's doorway (u 123): sealed until the chapter is done, then opened by its cutscene.
export const CASTLE_DOOR = { x: -467, z: 0, width: 1, depth: 12, bottom: 16, top: 27 };
export const LANTERN = { radius: 6, height: 6, wisps: 16, hold: 1.5 };
// A strike needs enough distinct wisps through the ward inside one short window; strays never add up.
export const STRIKE = { wisps: 14, window: 1.5, cooldown: 2.5, needed: 3 };
const CALM = 0.4;

export const insideRefuge = p => p.x < -361 && p.x > -371 && p.z < -18 && p.z > -28;

// Does the movement segment a→b pass within r of c? Testing only b could miss a fast crossing.
export function segmentHitsSphere(a, b, c, r) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len2 = dx * dx + dy * dy + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy + (c.z - a.z) * dz) / len2));
  return Math.hypot(a.x + dx * t - c.x, a.y + dy * t - c.y, a.z + dz * t - c.z) < r;
}

const say = (kind, text, ms = 7000) => ({ kind, text, ms });

// lanternY(site) / wardY: heights of the lantern orbs and the ward centre.
// crownKnown(): whether the castle's Hollow Crown bindings are understood; until then Neris sends the
// player into the castle before the journey north to Clover.
export function createSpadeCampaign({ lanternY = () => 0, wardY = 0, crownKnown = () => false } = {}) {
  const ward = { x: WARD.x, y: wardY, z: WARD.z };
  let stage, lit, charge, hits, windowAt, cooldown, strikes, time, gateOpen;
  function reset() {
    stage = 'meet'; lit = new Set(); charge = new Map(); hits = new Set();
    windowAt = 0; cooldown = 0; strikes = 0; time = 0; gateOpen = false;
  }
  reset();

  function lightLanterns(dt, chaos, swarm) {
    for (const site of LANTERN_SITES) {
      if (lit.has(site.id)) continue;
      const y = lanternY(site);
      let near = 0;
      if (chaos < CALM && swarm?.enabled) for (const p of swarm.positions)
        if (Math.hypot(p.x - site.x, p.z - site.z) < LANTERN.radius && Math.abs(p.y - y) < LANTERN.height) near++;
      const value = near >= LANTERN.wisps ? (charge.get(site.id) ?? 0) + dt : Math.max(0, (charge.get(site.id) ?? 0) - dt * 0.5);
      charge.set(site.id, value);
      if (value < LANTERN.hold) continue;
      lit.add(site.id);
      if (lit.size < LANTERN_SITES.length) return say('lantern', `MEMORY LANTERN ${lit.size}/3 · The wisps remember a name the Triad erased.`, 5000);
      stage = 'anchor';
      return say('anchor', 'NERIS · The swarm trusts you now. The border anchor binds our settlement, north of the avenue before the castle wall. Its ward opens only in chaos. Gather the flock, stir the storm, then hold Q to send them through it together.', 10000);
    }
    return null;
  }

  function strikeWard(dt, position, chaos, swarm) {
    cooldown = Math.max(0, cooldown - dt);
    if (chaos < CALM || cooldown > 0 || !swarm?.enabled || Math.hypot(position.x - ward.x, position.z - ward.z) > WARD.range) {
      hits.clear(); return null;
    }
    if (hits.size && time - windowAt > STRIKE.window) hits.clear();
    swarm.positions.forEach((p, i) => {
      if (hits.has(i) || !segmentHitsSphere(swarm.previous[i] ?? p, p, ward, WARD.radius)) return;
      if (!hits.size) windowAt = time;
      hits.add(i);
    });
    if (hits.size < STRIKE.wisps) return null;
    hits.clear(); cooldown = STRIKE.cooldown; strikes++;
    if (strikes < STRIKE.needed) return say('strike', `STRIKE ${strikes}/${STRIKE.needed} · The ward cracks. Recall with F and regroup.`, 4000);
    stage = 'report';
    return say('broken', 'THE BORDER ANCHOR FALLS · Its chains go slack and the settlement is free. Return to Neris at the Lantern Refuge.', 8000);
  }

  return {
    get stage() { return stage; },
    get lit() { return lit.size; },
    get strikes() { return strikes; },
    get sigil() { return stage === 'complete'; },
    get hits() { return hits.size; },
    get gateOpen() { return gateOpen; },
    openGate() { if (stage === 'complete') gateOpen = true; },
    // Why the sealed doors won't open, by stage (null once open).
    get gateMessage() {
      if (gateOpen) return null;
      return stage === 'meet' ? 'THE CASTLE DOORS ARE SEALED · A ward of the Triad holds them. Find Neris at the Lantern Refuge first.'
        : stage === 'complete' ? 'THE CASTLE DOORS ARE STIRRING · Neris’s light has reached the ward.'
        : 'THE CASTLE DOORS ARE SEALED · The border anchor feeds their ward. Finish Neris’s quest and free the settlement first.';
    },
    // Solid while sealed; the player controller treats it like any other volume.
    doorVolume: { ...CASTLE_DOOR, name: 'castle-door', solid: true,
      contains: (x, z, pad = 0) => !gateOpen && Math.abs(x - CASTLE_DOOR.x) < CASTLE_DOOR.width / 2 + pad && Math.abs(z - CASTLE_DOOR.z) < CASTLE_DOOR.depth / 2 + pad },
    isLit: id => lit.has(id),
    chargeOf: id => Math.min(1, (charge.get(id) ?? 0) / LANTERN.hold),
    wardExposed: chaos => stage === 'anchor' && chaos >= CALM,
    // Where hold-Q sends the swarm: the exposed ward, when the player is close enough to aim at it.
    strikeTarget(position, chaos) {
      return this.wardExposed(chaos) && cooldown === 0 && Math.hypot(position.x - ward.x, position.z - ward.z) < WARD.range ? ward : null;
    },
    get goal() {
      return {
        meet: 'SPADE · FIND NERIS IN THE LANTERN REFUGE · ENTER IN CALM',
        lanterns: `LANTERNS ${lit.size}/3 · HOLD E TO LEAD THE SWARM TO A DARK LANTERN · STAY CALM`,
        anchor: `BORDER ANCHOR · STRIKES ${strikes}/${STRIKE.needed} · CHAOS OPENS THE WARD · HOLD Q TO STRIKE`,
        report: 'THE ANCHOR FELL · RETURN TO NERIS AT THE LANTERN REFUGE',
        complete: crownKnown() ? 'LANTERN SIGIL EARNED · NEXT · GO NORTH TO CLOVER · FIND IVEN'
          : 'LANTERN SIGIL EARNED · NEXT · SPADE CASTLE · LEARN WHAT SHIELDS THE CROWN',
      }[stage];
    },
    // swarm: { enabled, positions, previous } (any {x, y, z}). Returns a story event or null.
    update(dt, position, chaos, swarm) {
      time += dt;
      const calmInRefuge = chaos < CALM && insideRefuge(position);
      if (stage === 'meet' && calmInRefuge) {
        stage = 'lanterns';
        return say('neris', 'NERIS · They scatter because they are frightened. Gather them before you ask them to fight. Hold E to call the wisps and lead them to the three dark lanterns along the avenue while the world is calm.', 10000);
      }
      if (stage === 'lanterns') return lightLanterns(dt, chaos, swarm);
      if (stage === 'anchor') return strikeWard(dt, position, chaos, swarm);
      if (stage === 'report' && calmInRefuge) {
        stage = 'complete';
        return say('sigil', 'LANTERN SIGIL · NERIS · The projection fell, but three bindings still shield the Hollow Crown. Strike it now and the force only feeds the gate. ' +
          (crownKnown() ? 'You have seen the bindings. Go north to Clover. Iven can show you which are true.'
            : 'Go up to the castle. Its archive holds what the Triad stole, and the observatory shows what binds the Crown.'), 12000);
      }
      return null;
    },
    reset,
  };
}
