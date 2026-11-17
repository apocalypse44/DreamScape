// Morcant the Gatekeeper in his Gatehall. A pure state machine, no THREE, shaped like sileFight.js:
// intro, Gate (bone attacks with openings), Seal (four bone pillars feed his armour; burn them with a Chaos
// Flame Lance), then the ending where he steps back through his own gate.
//
// Morcant's magic is bone through space, after Zenon Zogratis: bone spears thrust out of small gates, a bone
// spider climbs out of one, a lane of bone spikes tears up the floor, a bone claw sweeps out of a gate behind
// you, and bone jaws close from below. The traveller answers with grimoire spells (models/grimoireSpells.js):
//   flame FLAME LANCE  LMB  bolt: the damage; chips his armour, burns pillars in Chaos
//   tide  TIDE WARD    RMB  bubble: catches spears, blocks bites and the claw (not the ground)
//   wind  GALE         E    cone: shatters spiders and spears in flight, staggers him mid-windup
//   earth STONE WALL   Q    wall: stops the bone lane, spears and spiders (your own fire passes)
// Mana is Sile's rule: a ward catch, a roll through an attack, a gale kill or a wall stop gives one charge;
// G spends one for Chaos (spells hit twice as hard) until you calm or are hit.
export const MORCANT_FIGHT = {
  hp: 120, sealAt: 60, playerHp: 100, maxCharge: 3, retryCharge: 1,
  speed: 2.4, keep: 6, rest: 1.1, restSealed: 1.6,
  spears: { windup: .6, count: 3, ring: 5.5, delay: .6, gap: .2, speed: 24, damage: 10, radius: .8, life: 2 },
  spider: { windup: .7, speed: 5, reach: 2.2, leap: .45, bite: 2.4, damage: 14, rest: 1, life: 15, radius: 1, max: [1, 2] },
  forest: { windup: .9, length: 18, every: 1.2, speed: 13, hold: .9, hit: 1.3, damage: 16, open: 1.8 },
  grove: { windup: 1.1, count: 3, spread: 2.6, radius: 2, damage: 14 },
  ambush: { windup: 1, track: .5, behind: 2.4, active: .35, reach: 3.4, damage: 20, open: 2.4 },
  maw: { windup: 1.1, track: .6, radius: 2.3, damage: 18, open: 2.2 },
  spells: {
    wind: { cooldown: 1.2, range: 7, arc: 1.7, damage: 4, stagger: 1.5 },
    flame: { cooldown: .8, speed: 26, life: 1.3, radius: .7, damage: 12, chip: 3 },
    tide: { cooldown: 4, last: 2.5, lastChaos: 4 },
    earth: { cooldown: 6, ahead: 3.4, width: 4.4, last: 6 },
  },
  chaosPower: 2, exposedDamage: 10,
  pillar: { hp: 2 },
  exposedFor: 9, rise: 1.4, intro: 13, ending: 20.5, exit: [6.5, 2.5], // he walks back through his portal over 2.5 s
};
const ORDER = ['forest', 'spears', 'spider', 'ambush', 'maw', 'spears', 'forest', 'ambush'];
const SEALED_ORDER = ['grove', 'spears', 'spider', 'grove', 'ambush'];
// Morcant thinks himself a god. Heart is his by right, and this fight is beneath him.
const LINES = {
  arrive: ['MORCANT', 'Heart bowed. Its queen bowed. And now a stray insect wanders into my hall.'],
  order: ['MORCANT', 'Kneel, insect. The Bone God is in a generous mood.'],
  seal: ['MORCANT', 'Enough. Behold the armour of a god!'],
  crack: ['MORCANT', 'You dare scorch the throne of bone?'],
  reseal: ['MORCANT', 'Burn all you like, insect. A god’s bones always grow back.'],
  strength: ['MORCANT', 'Impossible. I let you have that. Remember it.'],
  queen: ['MORCANT', 'Keep your little kingdom, for now. Elowen stays mine, beyond the Hollow Gate.'],
  retreat: ['MORCANT', 'Burn me, then. Sile will drink your little fires.'],
  forged: ['SERA', 'Magic feeds them. Steel that remembers the Accord does not.'],
};
// Mid-fight taunts: gloats when he lands a blow, sneers when he is hurt. One at a time, not too often.
const TAUNTS = {
  gloat: ['Is this all Heart could send me?', 'Why must a god swat every fly that buzzes at his throne?',
    'I ruled Heart before your grandmother drew breath.', 'Stay down. It suits you.', 'Gods do not sweat for insects.'],
  sneer: ['A scratch. Gods do not bleed.', 'You will pay for that, worm.', 'Lucky. Only lucky.', 'Do you know who I am?'],
};
const TAUNT_GAP = 7;
const ease = k => k * k * (3 - 2 * k);
const clamp01 = k => Math.min(1, Math.max(0, k));
const lerp = (a, b, k) => a + (b - a) * k;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// Does the segment a-b cross the wall's segment (both on the floor)?
export function crosses(a, b, w) {
  const hx = Math.cos(w.yaw) * w.half, hz = -Math.sin(w.yaw) * w.half, p = { x: w.x - hx, z: w.z - hz }, q = { x: w.x + hx, z: w.z + hz };
  const side = (o, s, e) => (e.x - s.x) * (o.z - s.z) - (e.z - s.z) * (o.x - s.x);
  return side(a, p, q) * side(b, p, q) < 0 && side(p, a, b) * side(q, a, b) < 0;
}

/** center: the hall's middle {x, z}; floor: its height; radius: inner wall; pylons: four bone pillar spots [{x, z}]. */
export function createMorcantFight({ center, floor = 0, radius = 16, pylons = [], random = Math.random }) {
  const F = MORCANT_FIGHT, S = F.spells, cx = center.x, cz = center.z;
  const gateAt = { x: cx, z: cz - radius - 1.1 }; // his gold gate in the far wall: a portal fills its arch
  const behind = { x: cx, z: gateAt.z - .5 };     // just through the portal: he walks out of here and back into it
  let phase = 'idle', time = 0, hp = F.hp, playerHp = F.playerHp, charge = 0, chaos = false;
  let attack = null, rest = F.rest, order = 0, attackId = 0, open = 0, flinch = 0;
  let spears = [], gates = [], spiders = [], forest = null, grove = [], ambush = null, maw = null;
  let lances = [], walls = [], ward = 0, gale = null, cooldown = { wind: 0, flame: 0, tide: 0, earth: 0 };
  let shield = false, exposed = false, exposeLeft = 0, cracked = false, subtitle = null, checkpoint = null, riseFrom = null, tauntIn = 0, tauntTurn = 0;
  const morcant = { x: behind.x, y: floor, z: behind.z, yaw: 0 };
  const pillars = pylons.map(p => ({ x: p.x, z: p.z, hp: F.pillar.hp }));
  let events = [];
  const emit = (type, data = {}) => events.push({ type, ...data });
  const speak = (who, text, key, seconds) => { subtitle = { who, text, until: time + seconds, phase }; emit('line', { who, text, key }); };
  const say = (key, seconds = 3) => { const [who, text] = LINES[key]; speak(who, text, key, seconds); };
  // A taunt, if he is free to talk: in a fight, nothing else on screen, not too soon after the last.
  function taunt(kind) {
    if ((phase !== 'gate' && phase !== 'seal') || subtitle || tauntIn > 0) return;
    const pool = TAUNTS[kind], text = pool[tauntTurn++ % pool.length];
    tauntIn = TAUNT_GAP; speak('MORCANT', text, kind, 2.6);
  }
  const gain = () => { charge = Math.min(F.maxCharge, charge + 1); emit('charge', { charge }); };
  const knockCalm = () => { if (chaos) { chaos = false; emit('calm', { knocked: true }); } };
  const power = () => chaos ? F.chaosPower : 1;
  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const blockedByWall = (a, b) => walls.some(w => crosses(a, b, w));

  function clearAttacks() { attack = null; spears = []; gates = []; forest = null; grove = []; ambush = null; maw = null; open = 0; rest = F.rest; }
  function enter(next) {
    phase = next; time = 0; clearAttacks(); spiders = []; checkpoint = { phase, hp };
    if (next === 'seal') { riseFrom = { ...morcant }; pillars.forEach(c => { c.hp = F.pillar.hp; }); shield = true; exposed = false; say('seal', 2.4); emit('sealStart'); }
    if (next === 'ending') { say('strength', 3); emit('defeated'); chaos = false; lances = []; }
  }
  // One blow at the player. A ward blocks what comes through the air; a roll dodges anything. Both give charge.
  function defend(io, from, { heavy = false, damage, kind, ground = false }) {
    let result = !ground && ward > 0 ? 'blocked' : io.hurt?.(from, { heavy }) ?? 'hit';
    if (io.invulnerable) result = 'dodged';
    if (result === 'hit') { playerHp -= damage; emit('playerHit', { kind, damage }); knockCalm(); taunt('gloat'); }
    else { gain(); emit(result, { kind }); if (result === 'blocked' && heavy) { ward = 0; emit('wardBreak'); } }
    return result;
  }
  function down() {
    emit('down'); playerHp = F.playerHp; chaos = false; charge = Math.max(charge, F.retryCharge);
    phase = checkpoint.phase; hp = checkpoint.hp; time = phase === 'seal' ? F.rise : 0; clearAttacks(); spiders = []; lances = []; walls = []; ward = 0;
    if (phase === 'gate') Object.assign(morcant, { x: cx, y: floor, z: cz - 4 });
  }

  // ---- his attacks ----
  function attackStep(dt, io, p, sealed) {
    if (open > 0) { open -= dt; return; }
    if (!attack) {
      if ((rest -= dt) > 0) return;
      const list = sealed ? SEALED_ORDER : ORDER;
      let kind = list[order++ % list.length];
      if (kind === 'spider' && spiders.length >= F.spider.max[sealed ? 1 : 0]) kind = 'spears';
      attack = { kind, stage: 'windup', t: 0, id: ++attackId, fired: 0, stopped: false, hit: false };
      if (kind === 'spears') {
        const base = random() * Math.PI * 2;
        gates = Array.from({ length: F.spears.count }, (_, i) => {
          const a = base + i * Math.PI * 2 / F.spears.count;
          return { x: p.x + Math.sin(a) * F.spears.ring, y: p.y - .4, z: p.z + Math.cos(a) * F.spears.ring, t: 0, fired: false };
        });
      }
      if (kind === 'forest') forest = { x: morcant.x, z: morcant.z, yaw: Math.atan2(p.x - morcant.x, p.z - morcant.z), k: 0, run: -1, spikes: [] };
      if (kind === 'grove') grove = Array.from({ length: F.grove.count }, (_, i) => {
        const a = random() * Math.PI * 2, r = i ? F.grove.spread : 0;
        return { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r, k: 0, erupted: false };
      });
      if (kind === 'ambush') ambush = { x: p.x, z: p.z, k: 0, sweep: 0 };
      if (kind === 'maw') maw = { x: p.x, z: p.z, k: 0 };
      emit('windup', { kind });
    }
    const a = attack; a.t += dt;
    if (a.kind === 'spears') {
      const B = F.spears;
      for (const g of gates) g.t += dt;
      if (a.t >= B.windup + B.delay) {
        while (a.fired < gates.length && a.t >= B.windup + B.delay + a.fired * B.gap) {
          const g = gates[a.fired], dx = p.x - g.x, dy = p.y - .7 - g.y, dz = p.z - g.z, d = Math.hypot(dx, dy, dz) || 1;
          spears.push({ x: g.x, y: g.y, z: g.z, vx: dx / d * B.speed, vy: dy / d * B.speed, vz: dz / d * B.speed, life: B.life, from: { x: g.x, z: g.z } });
          g.fired = true; a.fired++; emit('spear');
        }
        if (a.fired >= gates.length && a.t >= B.windup + B.delay + gates.length * B.gap + .3) { attack = null; gates = []; }
      }
    } else if (a.kind === 'spider') {
      if (a.t >= F.spider.windup) {
        const side = (spiders.length % 2 ? -1 : 1) * 2.2, yaw = morcant.yaw + Math.PI / 2;
        spiders.push({ x: morcant.x + Math.sin(yaw) * side, z: morcant.z + Math.cos(yaw) * side, yaw: morcant.yaw, state: 'run', t: 0, life: F.spider.life });
        emit('spider'); attack = null;
      }
    } else if (a.kind === 'forest') {
      const B = F.forest;
      if (a.stage === 'windup') { forest.k = a.t / B.windup; if (a.t >= B.windup) { a.stage = 'run'; a.t = 0; forest.run = 0; emit('forest'); } }
      else {
        forest.run = a.t * B.speed;
        // A spike every metre or so along the lane, until the lane ends or meets a wall.
        while (!a.stopped && (forest.spikes.length + 1) * B.every <= Math.min(forest.run, B.length)) {
          const d = (forest.spikes.length + 1) * B.every, s = { x: forest.x + Math.sin(forest.yaw) * d, z: forest.z + Math.cos(forest.yaw) * d, t: 0 };
          if (blockedByWall(forest, s)) { a.stopped = true; gain(); emit('wallStop', { kind: 'forest', x: s.x, z: s.z }); break; }
          if (Math.hypot(s.x - cx, s.z - cz) > radius - .5) { a.stopped = true; break; }
          forest.spikes.push(s); emit('spike', { x: s.x, z: s.z });
          if (!a.hit && flat(p, s) < B.hit && io.feet - floor < 2.4) { a.hit = true; defend(io, s, { heavy: true, damage: B.damage, kind: 'forest', ground: true }); }
        }
        for (const s of forest.spikes) s.t += dt;
        if ((a.stopped || forest.run >= B.length) && a.t >= B.length / B.speed + B.hold) { forest = null; attack = null; if (!sealed) { open = B.open; emit('open'); } }
      }
    } else if (a.kind === 'grove') {
      const G = F.grove;
      for (const g of grove) g.k = a.t / G.windup;
      if (a.t >= G.windup && !a.fired) {
        a.fired = 1; emit('grove');
        for (const g of grove) { g.erupted = true; if (!a.hit && flat(p, g) < G.radius) { a.hit = true; defend(io, g, { heavy: true, damage: G.damage, kind: 'grove', ground: true }); } }
      }
      if (a.t >= G.windup + .8) { grove = []; attack = null; }
    } else if (a.kind === 'ambush') {
      const A = F.ambush;
      if (a.stage === 'windup') {
        if (a.t < A.track) { // the gate opens behind the traveller, on the far side from him
          const dx = p.x - morcant.x, dz = p.z - morcant.z, d = Math.hypot(dx, dz) || 1;
          ambush.x = p.x + dx / d * A.behind; ambush.z = p.z + dz / d * A.behind;
        }
        ambush.k = a.t / A.windup;
        if (a.t >= A.windup) {
          a.stage = 'sweep'; a.t = 0; emit('claw');
          if (flat(p, ambush) < A.reach && io.feet - floor < 2) {
            const r = defend(io, ambush, { heavy: true, damage: A.damage, kind: 'claw' });
            if (r === 'blocked') emit('pushback', { from: { x: ambush.x, z: ambush.z } });
          }
        }
      } else {
        ambush.sweep = a.t / A.active;
        if (a.t >= A.active) { if (!sealed) { open = A.open; emit('open'); } attack = null; ambush = { ...ambush, sweep: 1, k: 1, lingering: true }; }
      }
    } else if (a.kind === 'maw') {
      const M = F.maw;
      if (a.t < M.track) { maw.x = lerp(maw.x, p.x, Math.min(1, dt * 6)); maw.z = lerp(maw.z, p.z, Math.min(1, dt * 6)); }
      maw.k = a.t / M.windup;
      if (a.t >= M.windup) {
        const inside = flat(p, maw) < M.radius && io.feet - floor < 1.2;
        emit('maw', { x: maw.x, z: maw.z });
        if (inside) defend(io, maw, { heavy: true, damage: M.damage, kind: 'maw', ground: true });
        if (!sealed) { open = M.open; emit('open'); }
        maw = null; attack = null;
      }
    }
    if (!attack) rest = sealed ? F.restSealed : F.rest;
  }
  // Spears and spiders keep coming whatever he is doing.
  function hazards(dt, io, p) {
    spears = spears.filter(b => {
      const from = { x: b.x, z: b.z };
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.life -= dt;
      if (blockedByWall(from, b)) { gain(); emit('wallStop', { kind: 'spear', x: b.x, z: b.z }); return false; }
      if (Math.hypot(b.x - p.x, b.y - (p.y - .7), b.z - p.z) < F.spears.radius) { defend(io, b.from, { damage: F.spears.damage, kind: 'spear' }); return false; }
      return b.life > 0 && b.y > floor - 1;
    });
    const P = F.spider;
    spiders = spiders.filter(s => {
      s.life -= dt; s.t += dt;
      if (s.life <= 0) { emit('spiderCrumble', { x: s.x, z: s.z }); return false; }
      const d = flat(p, s);
      s.yaw = Math.atan2(p.x - s.x, p.z - s.z);
      if (s.state === 'run') {
        if (d < P.reach) { s.state = 'leap'; s.t = 0; emit('spiderLeap'); }
        else { const nx = s.x + Math.sin(s.yaw) * P.speed * dt, nz = s.z + Math.cos(s.yaw) * P.speed * dt, next = { x: nx, z: nz };
          if (!blockedByWall(s, next)) { s.x = nx; s.z = nz; } }
      } else if (s.state === 'leap' && s.t >= P.leap) {
        if (d < P.bite) defend(io, s, { damage: P.damage, kind: 'bite' });
        s.state = 'rest'; s.t = 0;
      } else if (s.state === 'rest' && s.t >= P.rest) { s.state = 'run'; s.t = 0; }
      return true;
    });
  }

  // ---- the traveller's runes ----
  function cast(io, p) {
    const c = io.cast; if (!c) return;
    if (cooldown[c.rune] > 0) { emit('cooling', { rune: c.rune }); return; }
    const spell = S[c.rune]; cooldown[c.rune] = spell.cooldown; emit('cast', { rune: c.rune, chaos });
    if (c.rune === 'wind') {
      gale = { x: p.x, z: p.z, yaw: c.facing, t: 0, chaos };
      const inCone = o => { const d = flat(o, p); return d < spell.range && Math.abs(angleDiff(Math.atan2(o.x - p.x, o.z - p.z), c.facing)) < spell.arc / 2; };
      spiders = spiders.filter(s => { if (!inCone(s)) return true; gain(); emit('spiderShattered', { x: s.x, z: s.z, by: 'wind' }); return false; });
      spears = spears.filter(b => { if (!inCone(b)) return true; gain(); emit('spearShattered', { x: b.x, y: b.y, z: b.z }); return false; });
      if (inCone(morcant) && phase === 'gate') {
        if (attack?.stage === 'windup') { // caught mid-windup: the attack fails and he staggers
          attack = null; forest = null; grove = []; ambush = null; maw = null; gates = [];
          open = spell.stagger; emit('staggered'); emit('open');
        }
        if (open > 0) hurt(spell.damage * power(), 'wind');
      }
    } else if (c.rune === 'flame') {
      const d = Math.hypot(c.aim.x - c.from.x, c.aim.y - c.from.y, c.aim.z - c.from.z) || 1;
      lances.push({ x: c.from.x, y: c.from.y, z: c.from.z, vx: (c.aim.x - c.from.x) / d * spell.speed, vy: (c.aim.y - c.from.y) / d * spell.speed, vz: (c.aim.z - c.from.z) / d * spell.speed, life: spell.life, chaos });
    } else if (c.rune === 'tide') ward = chaos ? spell.lastChaos : spell.last;
    else if (c.rune === 'earth') {
      const w = { x: p.x + Math.sin(c.facing) * spell.ahead, z: p.z + Math.cos(c.facing) * spell.ahead, yaw: c.facing, half: spell.width / 2 * (chaos ? 1.5 : 1), t: spell.last };
      walls = [w]; emit('wall', { x: w.x, z: w.z });
    }
  }
  function hurt(dealt, by) { hp = Math.max(0, hp - dealt); flinch = .35; emit('strike', { damage: dealt, chaos, by }); if (dealt >= 10) taunt('sneer'); }
  function lanceStep(dt) {
    const L = S.flame;
    lances = lances.filter(l => {
      l.x += l.vx * dt; l.y += l.vy * dt; l.z += l.vz * dt; l.life -= dt;
      const at = { x: l.x, z: l.z }; // your own wall lets your fire through
      const spider = spiders.find(s => flat(s, at) < F.spider.radius + L.radius && l.y - floor < 2);
      if (spider) { spiders.splice(spiders.indexOf(spider), 1); gain(); emit('spiderShattered', { x: spider.x, z: spider.z, by: 'flame' }); return false; }
      if (phase === 'seal' && shield) {
        const pillar = pillars.find(c => c.hp > 0 && flat(c, at) < 1.2 && l.y - floor < 5);
        if (pillar) {
          const i = pillars.indexOf(pillar);
          if (!l.chaos) { emit('needChaos', { index: i }); return false; }
          pillar.hp--; emit(pillar.hp ? 'crack' : 'pillarBroken', { index: i });
          if (!pillar.hp && !cracked) { cracked = true; say('crack', 2.4); }
          if (pillars.every(x => x.hp <= 0)) { shield = false; exposed = true; exposeLeft = F.exposedFor; clearAttacks(); emit('shieldShatter'); }
          return false;
        }
      }
      if (flat(morcant, at) < 1.3 + L.radius && l.y > morcant.y - .2 && l.y < morcant.y + 3.6) {
        const pw = l.chaos ? F.chaosPower : 1;
        const dealt = phase === 'gate' ? (open > 0 ? L.damage * pw : L.chip * pw) : exposed ? F.exposedDamage * pw : 0;
        if (dealt) hurt(dealt, 'flame'); else emit('deflect', { x: l.x, y: l.y, z: l.z });
        return false;
      }
      return l.life > 0 && Math.hypot(l.x - cx, l.z - cz) < radius + 1;
    });
  }

  return {
    get phase() { return phase; }, get hp() { return hp; }, get charge() { return charge; }, get chaos() { return chaos; },
    get playerHp() { return playerHp; }, get morcant() { return morcant; }, get active() { return phase !== 'idle' && phase !== 'done'; },
    get cinematic() { return phase === 'intro' || phase === 'ending'; }, get time() { return time; }, gateAt,
    /** Fight targets for aiming: him, his live spiders and (sealed) his live pillars, with a chest height. */
    get targets() {
      if (phase !== 'gate' && phase !== 'seal') return [];
      return [{ x: morcant.x, y: morcant.y + 1.9, z: morcant.z, kind: 'morcant' }, ...spiders.map(s => ({ x: s.x, y: floor + .6, z: s.z, kind: 'spider' })),
        ...(phase === 'seal' && shield ? pillars.filter(c => c.hp > 0).map(c => ({ x: c.x, y: floor + 3, z: c.z, kind: 'pillar' })) : [])];
    },
    start() {
      phase = 'intro'; time = 0; hp = F.hp; playerHp = F.playerHp; charge = 0; chaos = false; order = 0;
      shield = false; exposed = false; exposeLeft = 0; cracked = false; subtitle = null; riseFrom = null; tauntIn = 0; tauntTurn = 0; clearAttacks();
      spiders = []; lances = []; walls = []; ward = 0; gale = null; cooldown = { wind: 0, flame: 0, tide: 0, earth: 0 };
      pillars.forEach(c => { c.hp = F.pillar.hp; });
      Object.assign(morcant, { x: behind.x, y: floor, z: behind.z, yaw: 0 }); events = []; emit('gateOpen');
    },
    skip() { if (phase === 'intro') time = F.intro; else if (phase === 'ending') time = F.ending; },
    /** Developer: jump straight to his defeat and the ending (to review the retreat and the forging). */
    finish() { if (phase !== 'idle' && phase !== 'done') { if (phase === 'intro') Object.assign(morcant, { x: cx, y: floor, z: cz - 4 }); hp = 0; enter('ending'); } }, // from the intro: where the fight starts him
    stop() { phase = 'idle'; chaos = false; subtitle = null; clearAttacks(); spiders = []; lances = []; walls = []; ward = 0; },
    takeEvents() { const out = events; events = []; return out; },
    /**
     * io: { player:{x,y,z} (eye), feet, grounded, chaosPress, invulnerable (rolling),
     *       cast: { rune, from:{x,y,z}, aim:{x,y,z}, facing } | null, hurt(from, {heavy}) -> 'dodged'|'hit' }
     */
    update(dt, io) {
      if (phase === 'idle' || phase === 'done') return this.snapshot();
      const before = time; time += dt;
      const cue = at => before < at && time >= at;
      const p = io.player;
      flinch = Math.max(0, flinch - dt);
      if (subtitle && time > subtitle.until && subtitle.phase === phase) subtitle = null;
      tauntIn = Math.max(0, tauntIn - dt);
      const face = () => Math.atan2(p.x - morcant.x, p.z - morcant.z);

      if (phase === 'intro') { // his gate opens in the far wall; he walks out, speaks, strikes his fists together
        const walk = ease(clamp01((time - 3) / 3.4));
        morcant.x = behind.x; morcant.z = lerp(behind.z, cz - 4, walk); morcant.y = floor; morcant.yaw = face();
        if (cue(.4)) emit('rumble'); if (cue(6.5)) say('arrive', 3.6); if (cue(10.1)) say('order', 2.2); if (cue(12.4)) emit('clang'); // room for the voice to finish each boast
        if (time >= F.intro) { enter('gate'); emit('fight'); }
        return this.snapshot();
      }
      if (phase === 'ending') { // he kneels, speaks, rises and backs into his gate, which closes behind him
        if (cue(3.2)) say('queen', 3.2); if (cue(5)) emit('gateOpen'); if (cue(6.6)) say('retreat', 2.6);
        // Once the portal shuts, the grimoire's four runes fold into the sigil-blade, and Sera says why.
        if (cue(10)) emit('forge'); if (cue(15.2)) say('forged', 3.6); // while the blade rises out of the void
        if (cue(F.exit[0] + F.exit[1] + .3)) emit('gateFlash');
        if (time < F.exit[0]) { morcant.yaw = face(); if (!riseFrom || riseFrom.phase !== 'ending') riseFrom = { ...morcant, phase: 'ending' }; }
        const back = ease(clamp01((time - F.exit[0]) / F.exit[1]));
        if (time >= F.exit[0]) morcant.yaw = Math.atan2(behind.x - riseFrom.x, behind.z - riseFrom.z); // turns and walks back through it
        morcant.x = lerp(riseFrom.x, behind.x, back); morcant.z = lerp(riseFrom.z, behind.z, back); morcant.y = floor;
        if (time >= F.ending) { phase = 'done'; subtitle = null; emit('done'); }
        return this.snapshot();
      }

      if (io.chaosPress) {
        if (chaos) { chaos = false; emit('calm'); }
        else if (charge >= 1) { charge--; chaos = true; emit('chaos'); }
        else emit('noCharge');
      }
      for (const k in cooldown) cooldown[k] = Math.max(0, cooldown[k] - dt);
      ward = Math.max(0, ward - dt); walls = walls.filter(w => (w.t -= dt) > 0);
      if (gale && (gale.t += dt) > .45) gale = null;
      if (ambush?.lingering && attack?.kind !== 'ambush' && open <= 0) ambush = null; // his arm leaves the gate when he recovers
      cast(io, p);
      hazards(dt, io, p);
      lanceStep(dt);

      if (phase === 'gate') {
        const want = face(), distance = flat(p, morcant);
        morcant.yaw += angleDiff(want, morcant.yaw) * Math.min(1, dt * 4);
        if (open <= 0 && !attack && Math.abs(distance - F.keep) > .4) { // he keeps a middle distance: close enough to loom, far enough to need bones
          const step = Math.min(Math.abs(distance - F.keep), F.speed * dt) * Math.sign(distance - F.keep);
          morcant.x += Math.sin(want) * step; morcant.z += Math.cos(want) * step;
          const r = Math.hypot(morcant.x - cx, morcant.z - cz);
          if (r > radius - 1.5) { morcant.x = cx + (morcant.x - cx) / r * (radius - 1.5); morcant.z = cz + (morcant.z - cz) / r * (radius - 1.5); }
        }
        attackStep(dt, io, p, false);
        if (hp <= F.sealAt) enter('seal');
      } else if (phase === 'seal') {
        if (time < F.rise) { // he leaps back to the hall's heart and the pillars wake
          const k = ease(time / F.rise);
          morcant.x = lerp(riseFrom.x, cx, k); morcant.z = lerp(riseFrom.z, cz, k); morcant.y = floor + Math.sin(k * Math.PI) * 4;
          if (cue(F.rise - .05)) emit('land');
          return this.snapshot();
        }
        morcant.y = floor;
        if (!exposed) morcant.yaw += angleDiff(face(), morcant.yaw) * Math.min(1, dt * 3);
        if (exposed && (exposeLeft -= dt) <= 0 && hp > 0) { // his armour knits: one pillar regrows
          const c = pillars.find(x => x.hp <= 0); c.hp = F.pillar.hp;
          shield = true; exposed = false; rest = 1.5; emit('reseal', { index: pillars.indexOf(c) }); say('reseal', 2.2);
        }
        if (shield) attackStep(dt, io, p, true);
        if (hp <= 0) enter('ending');
      }
      if (playerHp <= 0) down();
      return this.snapshot();
    },
    snapshot() {
      const fighting = phase === 'gate' || phase === 'seal';
      let pose = 'idle';
      if (phase === 'intro') pose = time < 2.6 ? 'hidden' : time < 6.4 ? 'walk' : subtitle ? 'talk' : time > 12.1 ? 'clang' : 'idle';
      else if (phase === 'ending') pose = time >= F.exit[0] ? 'exit' : subtitle ? 'talk' : 'kneel';
      else if (phase === 'seal' && time < F.rise) pose = 'leap';
      else if (exposed) pose = 'kneel';
      else if (open > 0) pose = ambush ? 'reach' : 'open';
      else if (attack?.kind === 'forest' || attack?.kind === 'grove') pose = attack.stage === 'windup' && attack.kind === 'forest' ? 'stomp' : 'cast';
      else if (attack?.kind === 'ambush') pose = 'reach';
      else if (attack) pose = 'cast';
      else if (phase === 'gate') pose = 'walk';
      if (flinch > 0 && pose !== 'kneel') pose = 'flinch';
      let hint = '';
      if (phase === 'gate') hint = open > 0 ? 'He is open: FLAME LANCE (LMB)! Chaos (G) doubles it.'
        : 'GALE (E) breaks his windup, TIDE WARD (RMB) catches spears, STONE WALL (Q) stops the bone lane. F rolls.';
      else if (phase === 'seal' && time >= F.rise) hint = exposed ? `His armour is down: burn him! ${Math.ceil(exposeLeft)} s before a pillar regrows.`
        : chaos ? 'Chaos: FLAME LANCE (LMB) the bone pillars.' : 'Bone pillars feed his armour. Defend to charge, enter Chaos (G), then FLAME LANCE (LMB) them.';
      const W = attack ? F[attack.kind].windup : 1;
      return {
        phase, time, hp, maxHp: F.hp, playerHp: Math.max(0, playerHp), charge, maxCharge: F.maxCharge, chaos, pose, fighting,
        morcant: { ...morcant }, attack: attack && { kind: attack.kind, stage: attack.stage, progress: attack.stage === 'windup' ? Math.min(1, attack.t / W) : 1 },
        open: open > 0, spears: spears.map(b => ({ x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz })),
        gates: gates.map(g => ({ x: g.x, y: g.y, z: g.z, fired: g.fired, k: Math.min(1, g.t / F.spears.windup) })),
        spiders: spiders.map(s => ({ x: s.x, z: s.z, yaw: s.yaw, state: s.state, t: s.t })),
        forest: forest && { x: forest.x, z: forest.z, yaw: forest.yaw, k: forest.k, run: forest.run, length: F.forest.length, spikes: forest.spikes.map(s => ({ x: s.x, z: s.z, t: s.t })) },
        grove: grove.map(g => ({ ...g })), ambush: ambush && { ...ambush }, maw: maw && { ...maw },
        pillars: pillars.map(c => ({ x: c.x, z: c.z, hp: c.hp, max: F.pillar.hp })),
        lances: lances.map(l => ({ x: l.x, y: l.y, z: l.z, vx: l.vx, vy: l.vy, vz: l.vz, chaos: l.chaos })),
        walls: walls.map(w => ({ ...w })), ward, gale: gale && { ...gale }, cooldown: { ...cooldown }, cooldownMax: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v.cooldown])),
        shield: phase === 'seal' && shield && time >= F.rise, exposed, exposeLeft: exposed ? exposeLeft : 0,
        subtitle: subtitle && { who: subtitle.who, text: subtitle.text }, hint, gateAt,
        gate: phase === 'intro' ? Math.min(clamp01((time - .4) / 2), 1 - clamp01((time - 7) / 1.5))
          : phase === 'ending' ? Math.min(clamp01((time - 5) / 1.4), 1 - clamp01((time - F.exit[0] - F.exit[1]) / .4)) : 0,
        gone: phase === 'ending' && time >= F.exit[0] + F.exit[1],
        exit: phase === 'ending' ? clamp01((time - F.exit[0]) / F.exit[1]) : 0,
        emerge: phase === 'intro' ? clamp01((time - 3) / 3.4) : 1, // his walk out of the portal, 0..1
      };
    },
  };
}
