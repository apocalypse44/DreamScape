// Sile the Harvester at the Prism Citadel (combat.md, "Sile at the Prism Citadel"). The whole fight as a
// pure state machine, no THREE: intro cutscene, Harvest (sword, block, roll), Above the Prism (grapple and
// air strikes), Invert (calm at three anchors, then a Chaos finish) and the ending. The view
// (views/citadelArena.js) draws the snapshot and turns events into sound, toasts and camera work.
//
// Mana follows combat.md: a successful block or roll of a real attack gives one charge, once per attack;
// spending one charge enters Chaos, which lasts until the player returns to Calm or is hit.
export const SILE_FIGHT = {
  hp: 100, skyAt: 60, playerHp: 100, maxCharge: 3, retryCharge: 1,
  hover: .5, speed: 3.4, keep: 3.4, rest: 1, restShielded: 1.7,
  sweep: { windup: .9, active: .18, recover: .7, reach: 4.6, arc: 2.4, damage: 20, open: 2.6 },
  darts: { windup: .6, count: 3, gap: .22, speed: 15, damage: 8, radius: .9, life: 2.6 },
  tether: { windup: .8, range: 10, hold: 2.4, drain: 14, snap: 11.5 },
  strike: { open: 8, openChaos: 22, exposed: 6, exposedChaos: 14, reach: 2.9 },
  sky: { radius: 14, height: 8, speed: .4, hits: 3, damage: 7, reach: 8, buffer: .35, shardEvery: 2.4, shardFall: 1.1, shardRadius: 2.2, shardDamage: 12 },
  invert: { radius: 2.6, seconds: 3 },
  // Phase 3 pressure: siphon waves ripple out across the floor (jump them), faster and doubled as anchors
  // fall; once exposed she has a last stand, then reclaims an anchor if you have not finished her.
  wave: { windup: .8, speed: 7.5, every: [4.6, 3.4, 2.5], double: 2, damage: 10, clear: .7, setback: .35, reach: 22 },
  exposedFor: 9,
  crash: 1.2, intro: 11.5, ending: 10.4, flee: [5.4, 2], // she backs into the vortex over 2 s
  close: [7.5, .6], // then it collapses and shuts with a flash
};
const ORDER = ['sweep', 'darts', 'sweep', 'tether', 'darts', 'sweep'];
const LINES = {
  arrive: ['SILE', 'Ooh, the little relay-breaker climbed all the way up here.'],
  fun: ['SILE', 'Come... let\'s have some fun.'],
  sky: ['SILE', 'Can\'t reach me down there, can you?'],
  crash: ['SILE', 'Hey! That hurt!'],
  shield: ['SILE', 'No, no, no, that\'s MY power!'],
  broken: ['SILE', 'Ugh... you broke my toy.'],
  waves: ['SILE', 'Jump, little bug! Jump!'],
  desperate: ['SILE', 'Stop that! Those are MINE!'],
  reclaim: ['SILE', 'Hehe... mine again.'],
  bored: ['SILE', 'That wasn\'t fun anymore.'],
};
const ease = k => k * k * (3 - 2 * k);
const clamp01 = k => Math.min(1, Math.max(0, k));
const lerp = (a, b, k) => a + (b - a) * k;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** center: the forecourt {x, z}; floor: its height; anchors: three inversion anchors [{x, z}]. */
export function createSileFight({ center, floor = 0, anchors = [], random = Math.random }) {
  const F = SILE_FIGHT, cx = center.x, cz = center.z;
  const crashSpot = { x: cx, z: cz + 3.6 }, riftAt = { x: cx + 8, y: floor + 9, z: cz - 1 }; // beside the prism, never behind it
  let phase = 'idle', time = 0, hp = F.hp, playerHp = F.playerHp, charge = 0, chaos = false;
  let attack = null, rest = F.rest, order = 0, attackId = 0, open = 0, lastSwing = -1, flinch = 0;
  let darts = [], shards = [], tether = null, shardTimer = 1.5, airHits = 0, airCooldown = 0, orbit = 0, airBuffer = 0, inReach = false;
  let shield = true, exposed = false, subtitle = null, crashFrom = null, checkpoint = null;
  let waves = [], waveTimer = 3, waveWindup = 0, wavesQueued = 0, firstWave = true, exposeLeft = 0;
  const sile = { x: cx, y: floor - 14, z: cz - 20, yaw: 0 };
  const inversion = anchors.map(a => ({ x: a.x, z: a.z, progress: 0, inverted: false }));
  let events = [];
  const emit = (type, data = {}) => events.push({ type, ...data });
  const say = (key, seconds = 3) => { const [who, text] = LINES[key]; subtitle = { who, text, until: time + seconds, phase }; emit('line', { who, text, key }); };
  const gain = () => { charge = Math.min(F.maxCharge, charge + 1); emit('charge', { charge }); };

  function save() { checkpoint = { phase, hp, airHits }; }
  function clearAttacks() { attack = null; tether = null; darts = []; shards = []; open = 0; rest = F.rest; waves = []; waveWindup = 0; wavesQueued = 0; waveTimer = 3; }
  function enter(next) {
    phase = next; time = 0; clearAttacks(); save();
    if (next === 'sky') { say('sky'); emit('laugh'); emit('takeoff'); orbit = Math.atan2(sile.x - cx, sile.z - cz); shardTimer = 1.6; }
    if (next === 'invert') { crashFrom = { ...sile }; shield = true; exposed = false; }
    if (next === 'ending') { say('broken', 3.2); emit('defeated'); chaos = false; }
  }
  // One blow at the player. Defending gives charge; a hit costs health and knocks them back to Calm.
  function defend(io, from, { heavy = false, damage, kind }) {
    const result = io.hurt?.(from, { heavy }) ?? 'hit';
    if (result === 'hit') {
      playerHp -= damage; emit('playerHit', { kind, damage });
      if (chaos) { chaos = false; emit('calm', { knocked: true }); }
    } else { gain(); emit(result, { kind }); }
    return result;
  }
  function down() {
    emit('down'); playerHp = F.playerHp; chaos = false; charge = Math.max(charge, F.retryCharge);
    phase = checkpoint.phase; hp = checkpoint.hp; airHits = checkpoint.airHits; time = phase === 'invert' ? F.crash : 0; clearAttacks();
    if (phase === 'harvest') Object.assign(sile, { x: cx, y: floor + F.hover, z: cz + 6.5 });
  }

  // Sile's attacks in Harvest, and (slower, no openings) while shielded in Invert.
  function attackStep(dt, io, p, distance, shielded) {
    if (open > 0) { open -= dt; return; }
    if (!attack) {
      if ((rest -= dt) > 0) return;
      let kind = ORDER[order++ % ORDER.length];
      if (kind === 'sweep' && distance > (shielded ? 5.2 : 6.5)) kind = 'darts';
      attack = { kind, stage: 'windup', t: 0, id: ++attackId, yaw: sile.yaw, fired: 0 };
      emit('windup', { kind });
    }
    const a = attack; a.t += dt;
    if (a.kind === 'sweep') {
      const S = F.sweep;
      if (a.stage === 'windup') {
        a.yaw = sile.yaw;
        if (a.t >= S.windup) {
          a.stage = 'active'; a.t = 0; emit('sweep');
          const facing = Math.atan2(p.x - sile.x, p.z - sile.z);
          const inside = distance < S.reach && Math.abs(angleDiff(facing, a.yaw)) < S.arc / 2 && io.feet - floor < 1.4;
          const result = inside ? defend(io, sile, { heavy: true, damage: S.damage, kind: 'sweep' }) : 'missed';
          if (result === 'blocked') emit('pushback', { from: { x: sile.x, z: sile.z } });
          if ((result === 'dodged' || result === 'missed') && !shielded) { open = S.open; emit('open'); }
        }
      } else if (a.stage === 'active' && a.t >= S.active) { a.stage = 'recover'; a.t = 0; }
      else if (a.stage === 'recover' && a.t >= S.recover) attack = null;
    } else if (a.kind === 'darts') {
      const D = F.darts;
      if (a.stage === 'windup' && a.t >= D.windup) { a.stage = 'cast'; a.t = 0; }
      if (a.stage === 'cast') {
        while (a.fired < D.count && a.t >= a.fired * D.gap) {
          const from = { x: sile.x, y: sile.y + 1.3, z: sile.z }, dx = p.x - from.x, dy = p.y - .7 - from.y, dz = p.z - from.z, d = Math.hypot(dx, dy, dz) || 1;
          darts.push({ x: from.x, y: from.y, z: from.z, vx: dx / d * D.speed, vy: dy / d * D.speed, vz: dz / d * D.speed, life: D.life, from });
          a.fired++; emit('dart');
        }
        if (a.fired >= D.count && a.t >= D.count * D.gap + .4) attack = null;
      }
    } else if (a.kind === 'tether') {
      const X = F.tether;
      if (a.stage === 'windup' && a.t >= X.windup) {
        if (distance < X.range) { a.stage = 'hold'; a.t = 0; tether = { t: 0 }; emit('tether'); } else attack = null;
      } else if (a.stage === 'hold') {
        tether.t = a.t;
        if (io.invulnerable) { gain(); emit('tetherBroken'); tether = null; attack = null; }
        else if (distance > X.snap || a.t >= X.hold) { emit('tetherEnd'); tether = null; attack = null; }
        else playerHp -= X.drain * dt;
      }
    }
    if (!attack) rest = shielded ? F.restShielded : F.rest;
  }
  // Siphon waves (Invert phase, while shielded): she rears up, then crimson rings race out along the floor.
  function waveStep(dt, io, p, distance) {
    const W = F.wave, done = inversion.filter(a => a.inverted).length;
    if (shield && time > F.crash + 1.5) {
      if (waveWindup > 0) {
        if ((waveWindup -= dt) <= 0) { waves.push({ r: 1.2 }); emit('wave'); wavesQueued = done >= W.double ? 1 : 0; waveTimer = W.every[Math.min(done, 2)]; }
      } else if (wavesQueued > 0 && waves.length && waves[waves.length - 1].r > 4.5) { waves.push({ r: 1.2 }); wavesQueued--; emit('wave'); }
      else if ((waveTimer -= dt) <= 0 && wavesQueued === 0) { waveWindup = W.windup; emit('waveWindup'); if (firstWave) { firstWave = false; say('waves', 2.2); } }
    }
    waves = waves.filter(w => {
      const was = w.r; w.r += W.speed * dt;
      if (was < distance && w.r >= distance) { // the ring passes under the player
        if (io.feet - floor > W.clear || io.invulnerable) { gain(); emit('jumped', { kind: 'wave' }); }
        else {
          playerHp -= W.damage; emit('playerHit', { kind: 'wave', damage: W.damage }); if (chaos) { chaos = false; emit('calm', { knocked: true }); }
          for (const a of inversion) if (!a.inverted && Math.hypot(p.x - a.x, p.z - a.z) < F.invert.radius) a.progress = Math.max(0, a.progress - W.setback);
        }
      }
      return w.r < W.reach;
    });
  }
  function swordStep(io, damage) {
    const hit = io.swordHit; if (!hit || hit.id === lastSwing) return;
    const p = io.player, dx = sile.x - p.x, dz = sile.z - p.z, d = Math.hypot(dx, dz);
    if (d > F.strike.reach + (hit.reach - 2.1) || Math.abs(angleDiff(Math.atan2(dx, dz), hit.facing)) > hit.arc / 2 + .3) return;
    lastSwing = hit.id;
    const dealt = damage();
    if (!dealt) { emit('deflect'); return; }
    hp = Math.max(0, hp - dealt); flinch = .35; emit('strike', { damage: dealt, chaos });
  }

  return {
    get phase() { return phase; }, get hp() { return hp; }, get charge() { return charge; }, get chaos() { return chaos; },
    get playerHp() { return playerHp; }, get sile() { return sile; }, get active() { return phase !== 'idle' && phase !== 'done'; },
    get cinematic() { return phase === 'intro' || phase === 'ending'; }, get time() { return time; },
    start() {
      phase = 'intro'; time = 0; hp = F.hp; playerHp = F.playerHp; charge = 0; chaos = false; order = 0; airHits = 0; lastSwing = -1;
      shield = true; exposed = false; subtitle = null; firstWave = true; exposeLeft = 0; clearAttacks(); inversion.forEach(a => { a.progress = 0; a.inverted = false; });
      Object.assign(sile, { x: cx, y: floor - 14, z: cz - 20, yaw: 0 }); events = []; emit('prism');
    },
    skip() { if (phase === 'intro') { time = F.intro; } else if (phase === 'ending') time = F.ending; },
    stop() { phase = 'idle'; chaos = false; subtitle = null; clearAttacks(); },
    takeEvents() { const out = events; events = []; return out; },
    /**
     * io: { player:{x,y,z} (eye), feet, grounded, chaosPress, attackPress, invulnerable,
     *       swordHit: combat snapshot hit | null, hurt(from, {heavy}) -> 'blocked'|'dodged'|'hit' }
     */
    update(dt, io) {
      if (phase === 'idle' || phase === 'done') return this.snapshot();
      const before = time; time += dt;
      const cue = at => before < at && time >= at;
      const p = io.player;
      flinch = Math.max(0, flinch - dt);
      if (subtitle && time > subtitle.until && subtitle.phase === phase) subtitle = null;

      if (phase === 'intro') { // the prism turns, Sile rises laughing, lands and speaks
        const rise = ease(clamp01((time - 3) / 3)), glide = ease(clamp01((time - 6) / 2.5));
        sile.x = cx; sile.z = lerp(lerp(cz - 20, cz - 7, rise), cz + 6.5, glide);
        sile.y = lerp(lerp(floor - 14, floor + 7, rise), floor + 1.2, glide) + Math.sin(time * 1.6) * .15;
        sile.yaw = Math.atan2(p.x - sile.x, p.z - sile.z);
        if (cue(.6)) emit('rumble'); if (cue(3.4)) emit('laugh'); if (cue(6.3)) say('arrive', 2.6);
        if (cue(8.7)) say('fun', 2.4); if (cue(10.1)) emit('laugh', { long: true });
        if (time >= F.intro) { enter('harvest'); emit('fight'); }
        return this.snapshot();
      }
      if (phase === 'ending') { // she rises, a rift opens behind her, she flees, the prism clears
        if (cue(3.4)) { say('bored', 2.4); emit('laugh', { sour: true }); } if (cue(1.6)) emit('rift');
        if (cue(F.close[0] + F.close[1])) emit('riftFlash');
        const flee = ease(clamp01((time - F.flee[0]) / F.flee[1]));
        sile.yaw = time < F.flee[0] ? Math.atan2(p.x - sile.x, p.z - sile.z) : Math.atan2(sile.x - riftAt.x, sile.z - riftAt.z); // then backs into it, facing out
        sile.y = lerp(floor + F.hover + Math.min(1, time / 2) * 2, riftAt.y, flee);
        sile.x = lerp(crashSpot.x, riftAt.x, flee); sile.z = lerp(crashSpot.z, riftAt.z, flee);
        if (time >= F.ending) { phase = 'done'; subtitle = null; emit('done'); }
        return this.snapshot();
      }

      if (io.chaosPress) {
        if (chaos) { chaos = false; emit('calm'); }
        else if (charge >= 1) { charge--; chaos = true; emit('chaos'); }
        else emit('noCharge');
      }
      const distance = Math.hypot(p.x - sile.x, p.z - sile.z);
      // Darts fly in every fighting phase.
      darts = darts.filter(d => {
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.life -= dt;
        if (Math.hypot(d.x - p.x, d.y - (p.y - .7), d.z - p.z) < F.darts.radius) { defend(io, d.from, { damage: F.darts.damage, kind: 'dart' }); return false; }
        return d.life > 0 && d.y > floor - 2;
      });

      if (phase === 'harvest') {
        const want = Math.atan2(p.x - sile.x, p.z - sile.z);
        if (!(attack?.kind === 'sweep' && attack.stage !== 'windup')) sile.yaw += angleDiff(want, sile.yaw) * Math.min(1, dt * 6);
        const keep = attack?.kind === 'sweep' && attack.stage === 'windup' ? 2.9 : F.keep;
        if (open <= 0 && Math.abs(distance - keep) > .3) {
          const step = Math.min(Math.abs(distance - keep), F.speed * dt) * Math.sign(distance - keep);
          sile.x += Math.sin(want) * step; sile.z += Math.cos(want) * step;
        }
        sile.y = floor + F.hover + Math.sin(time * 2) * .12 - (open > 0 ? .35 : 0);
        attackStep(dt, io, p, distance, false);
        swordStep(io, () => open > 0 ? (chaos ? F.strike.openChaos : F.strike.open) : 0);
        if (hp <= F.skyAt) enter('sky');
      } else if (phase === 'sky') {
        const S = F.sky;
        orbit += S.speed * dt;
        // While you are in the air she swings round to meet you, taunting: air strikes stay reachable.
        if (!io.grounded) orbit += angleDiff(Math.atan2(p.x - cx, p.z - cz), orbit) * Math.min(1, dt * 1.2);
        const k = Math.min(1, time / 1.5), tx = cx + Math.sin(orbit) * S.radius, tz = cz + Math.cos(orbit) * S.radius, ty = floor + S.height + Math.sin(time * 1.3) * 1.5;
        sile.x = lerp(sile.x, tx, k); sile.z = lerp(sile.z, tz, k); sile.y = lerp(sile.y, ty, k); sile.yaw = orbit + Math.PI / 2;
        if ((shardTimer -= dt) <= 0) {
          shardTimer = S.shardEvery;
          shards.push({ x: p.x, z: p.z, t: 0 });
          for (let i = 0; i < 2; i++) { const a = random() * Math.PI * 2, r = 4 + random() * 11; shards.push({ x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r, t: 0 }); }
          emit('shards');
        }
        shards = shards.filter(s => {
          const was = s.t; s.t += dt;
          if (was < S.shardFall && s.t >= S.shardFall) {
            emit('shardImpact', { x: s.x, z: s.z });
            if (Math.hypot(p.x - s.x, p.z - s.z) < S.shardRadius && io.feet - floor < 1.2) {
              if (io.invulnerable) { gain(); emit('dodged', { kind: 'shard' }); }
              else { playerHp -= S.shardDamage; emit('playerHit', { kind: 'shard', damage: S.shardDamage }); if (chaos) { chaos = false; emit('calm', { knocked: true }); } }
            }
          }
          return s.t < S.shardFall + .35;
        });
        airCooldown -= dt; airBuffer = io.attackPress ? S.buffer : Math.max(0, airBuffer - dt); // a click just before you reach her still counts
        const wasInReach = inReach; inReach = !io.grounded && Math.hypot(p.x - sile.x, p.y - (sile.y + 1.1), p.z - sile.z) < S.reach;
        if (inReach && !wasInReach) emit('inReach');
        if (airBuffer > 0 && inReach && airCooldown <= 0) {
          airBuffer = 0;
          airHits++; airCooldown = .6; flinch = .45; orbit += .05; // a nudge: she must stay where the lunge lands
          const dealt = Math.round(S.damage * (chaos ? 1.4 : 1)); hp = Math.max(0, hp - dealt);
          emit('airHit', { damage: dealt, hits: airHits });
          if (airHits >= S.hits) { enter('invert'); say('crash', 2); emit('crashStart'); }
        }
      } else if (phase === 'invert') {
        if (time < F.crash) {
          const k = ease(time / F.crash);
          sile.x = lerp(crashFrom.x, crashSpot.x, k); sile.z = lerp(crashFrom.z, crashSpot.z, k); sile.y = lerp(crashFrom.y, floor + .2, k);
          if (cue(F.crash - .05)) emit('crash');
          return this.snapshot();
        }
        sile.y = floor + (exposed ? 0 : .35 + Math.sin(time * 2) * .08);
        if (!exposed) sile.yaw += angleDiff(Math.atan2(p.x - sile.x, p.z - sile.z), sile.yaw) * Math.min(1, dt * 4);
        waveStep(dt, io, p, distance);
        if (exposed && (exposeLeft -= dt) <= 0 && hp > 0) { // last stand over: she reclaims an anchor
          const a = inversion.find(x => x.inverted); a.inverted = false; a.progress = 0;
          shield = true; exposed = false; waveTimer = 2; emit('reshield', { index: inversion.indexOf(a) }); say('reclaim', 2.2); emit('laugh', { sour: true });
        }
        if (shield) {
          if (cue(F.crash + .4)) { say('shield', 2.6); emit('anchorsLit'); }
          attackStep(dt, io, p, distance, true);
          inversion.forEach((a, i) => {
            if (a.inverted) return;
            if (Math.hypot(p.x - a.x, p.z - a.z) < F.invert.radius) {
              if (chaos) { if (a.progress === 0 || Math.floor(time * 2) !== Math.floor((time - dt) * 2)) emit('needCalm'); return; }
              a.progress = Math.min(1, a.progress + dt / F.invert.seconds);
              if (a.progress >= 1) { a.inverted = true; emit('inverted', { index: i }); if (inversion.filter(x => x.inverted).length === 2) say('desperate', 2.2); }
            } else a.progress = Math.max(0, a.progress - dt * .15);
          });
          if (inversion.length && inversion.every(a => a.inverted)) { shield = false; exposed = true; exposeLeft = F.exposedFor; clearAttacks(); emit('shieldShatter'); }
        }
        swordStep(io, () => exposed ? (chaos ? F.strike.exposedChaos : F.strike.exposed) : 0);
        if (hp <= 0) enter('ending');
      }
      if (playerHp <= 0) down();
      return this.snapshot();
    },
    snapshot() {
      const fighting = phase === 'harvest' || phase === 'sky' || phase === 'invert';
      let pose = 'hover';
      if (phase === 'intro') pose = time < 3 ? 'hidden' : time < 6 ? 'rise' : (subtitle ? 'talk' : 'hover');
      else if (phase === 'ending') pose = time < F.flee[0] ? (subtitle ? 'talk' : 'hurt') : 'flee';
      else if (phase === 'sky') pose = 'fly';
      else if (phase === 'invert') pose = time < F.crash ? 'crash' : exposed ? 'kneel' : 'shielded';
      if (fighting && pose !== 'fly' && pose !== 'crash' && pose !== 'kneel') {
        if (open > 0) pose = 'open';
        else if (attack?.kind === 'sweep') pose = attack.stage === 'windup' ? 'sweepWindup' : 'sweep';
        else if (attack) pose = 'cast';
      }
      if (flinch > 0 && pose !== 'kneel') pose = 'flinch';
      let hint = '';
      if (phase === 'harvest') hint = open > 0 ? (chaos ? 'Her shield is down: strike! Chaos hits harder.' : 'Her shield is down: strike now! G spends charge for Chaos.')
        : 'Roll (F) through the sweep, block (RMB) the darts, roll out of the tether. Defending charges Chaos.';
      else if (phase === 'sky') hint = inReach ? 'In reach: strike (LMB)!' : 'Out of reach. Hold Q at a spire to swing up to her; she glows when you can strike.';
      else if (phase === 'invert' && time >= F.crash) hint = shield ? (chaos ? 'Return to Calm (G) to invert the anchors.' : 'Stand by each anchor in Calm to invert it. Jump (Space) her siphon waves.')
        : `Her shield is down: finish her! ${Math.ceil(exposeLeft)} s before she reclaims an anchor (G for Chaos hits harder).`;
      return {
        phase, time, hp, maxHp: F.hp, playerHp: Math.max(0, playerHp), charge, maxCharge: F.maxCharge, chaos, pose, fighting,
        sile: { ...sile }, attack: attack && { kind: attack.kind, stage: attack.stage, yaw: attack.yaw,
          progress: attack.stage === 'windup' ? attack.t / F[attack.kind].windup : 1 },
        open: open > 0, darts: darts.map(d => ({ x: d.x, y: d.y, z: d.z })), shards: shards.map(s => ({ x: s.x, z: s.z, k: s.t / F.sky.shardFall })),
        tether: tether && { t: tether.t }, anchors: inversion.map(a => ({ ...a })), shield: phase === 'invert' ? shield : phase === 'harvest' ? !(open > 0) : false,
        exposed, airHits, inReach: phase === 'sky' && inReach, subtitle: subtitle && { who: subtitle.who, text: subtitle.text }, hint,
        purple: phase === 'intro' ? clamp01((time - .6) / 2) : phase === 'ending' ? 1 - clamp01((time - F.close[0] - F.close[1]) / 1.5) : phase === 'done' || phase === 'idle' ? 0 : 1,
        // The portal: the vortex spins up (rift), then its black eye opens wider and wider (riftOpen); both close after she is gone.
        rift: phase === 'ending' ? Math.min(clamp01((time - 1.6) / 1.4), 1 - clamp01((time - F.close[0]) / F.close[1]) ** 2) : 0,
        riftOpen: phase === 'ending' ? Math.min(clamp01((time - 2.4) / 2.8) ** 1.5, 1 - clamp01((time - F.close[0]) / F.close[1])) : 0,
        closing: phase === 'ending' ? clamp01((time - F.close[0]) / F.close[1]) : 0, gone: phase === 'ending' && time >= F.flee[0] + F.flee[1],
        flee: phase === 'ending' ? clamp01((time - F.flee[0]) / F.flee[1]) : 0,
        waves: waves.map(w => ({ r: w.r })), waveWindup: waveWindup > 0 ? 1 - waveWindup / F.wave.windup : 0, exposeLeft: exposed ? exposeLeft : 0,
        riftAt, crashSpot,
      };
    },
  };
}
