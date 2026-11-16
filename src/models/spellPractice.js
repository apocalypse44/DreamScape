// The movement lab's spell practice ground: free casting of the four grimoire spells with something to cast at.
// Crystal dummies take Flame Lances (and shatter, then regrow); Gale knocks them back; a bone totem throws a spear
// at the traveller every few seconds, to catch with Tide Ward, stop with Stone Wall, shatter with Gale or roll through.
// Pure state, no THREE; numbers come from the Morcant fight so practice feels like the real thing.
import { MORCANT_FIGHT, crosses } from './morcantFight.js';

const S = MORCANT_FIGHT.spells;
export const PRACTICE = { radius: 12, dummyHp: 3, regrow: 2.5, throwEvery: 3.4, windup: .8, spearSpeed: 13, spearRadius: .8, galeKnock: 1.6 };
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** center: {x, z}; floor: ground height. */
export function createSpellPractice({ center, floor = 0 }) {
  const P = PRACTICE, cx = center.x, cz = center.z;
  const home = [[-4.5, -5], [0, -6.5], [4.5, -5]].map(([x, z]) => ({ x: cx + x, z: cz + z }));
  const totem = { x: cx + 8, z: cz - 2 }; // off to the side of the dummies, so you turn to face what is coming
  let dummies, lances, walls, ward, gale, spears, cooldown, throwIn, windup, events = [], stats;
  const emit = (type, data = {}) => events.push({ type, ...data });
  function reset() {
    dummies = home.map(h => ({ x: h.x, z: h.z, hp: P.dummyHp, down: 0, wobble: 0 }));
    lances = []; walls = []; ward = 0; gale = null; spears = []; cooldown = { wind: 0, flame: 0, tide: 0, earth: 0 };
    throwIn = P.throwEvery; windup = 0; stats = { burned: 0, caught: 0 };
  }
  reset();
  function cast(c, p) {
    if (cooldown[c.rune] > 0) { emit('cooling', { rune: c.rune }); return; }
    const spell = S[c.rune]; cooldown[c.rune] = spell.cooldown; emit('cast', { rune: c.rune });
    if (c.rune === 'wind') {
      gale = { x: p.x, z: p.z, yaw: c.facing, t: 0 };
      const inCone = o => flat(o, p) < spell.range && Math.abs(angleDiff(Math.atan2(o.x - p.x, o.z - p.z), c.facing)) < spell.arc / 2;
      for (const d of dummies) if (!d.down && inCone(d)) { const k = P.galeKnock / (flat(d, p) || 1); d.x += (d.x - p.x) * k; d.z += (d.z - p.z) * k; d.wobble = 1; emit('galeHit', { x: d.x, z: d.z }); }
      spears = spears.filter(s => { if (!inCone(s)) return true; stats.caught++; emit('spearShattered', { x: s.x, y: s.y, z: s.z }); return false; });
    } else if (c.rune === 'flame') {
      const d = Math.hypot(c.aim.x - c.from.x, c.aim.y - c.from.y, c.aim.z - c.from.z) || 1;
      lances.push({ x: c.from.x, y: c.from.y, z: c.from.z, vx: (c.aim.x - c.from.x) / d * spell.speed, vy: (c.aim.y - c.from.y) / d * spell.speed, vz: (c.aim.z - c.from.z) / d * spell.speed, life: spell.life });
    } else if (c.rune === 'tide') ward = spell.last;
    else if (c.rune === 'earth') walls = [{ x: p.x + Math.sin(c.facing) * spell.ahead, z: p.z + Math.cos(c.facing) * spell.ahead, yaw: c.facing, half: spell.width / 2, t: spell.last }];
  }
  return {
    reset,
    get stats() { return { ...stats }; },
    /** Things to aim at: standing dummies, then the totem. */
    get targets() { return [...dummies.filter(d => !d.down).map(d => ({ x: d.x, y: floor + 1.2, z: d.z })), { x: totem.x, y: floor + 1.8, z: totem.z }]; },
    takeEvents() { const out = events; events = []; return out; },
    /** io: { player (eye position), feet, cast, invulnerable, hurt(from) -> 'dodged'|'hit'|... } */
    update(dt, io) {
      const p = io.player;
      for (const k in cooldown) cooldown[k] = Math.max(0, cooldown[k] - dt);
      ward = Math.max(0, ward - dt); walls = walls.filter(w => (w.t -= dt) > 0);
      if (gale && (gale.t += dt) > .45) gale = null;
      if (io.cast) cast(io.cast, p);
      lances = lances.filter(l => {
        l.x += l.vx * dt; l.y += l.vy * dt; l.z += l.vz * dt; l.life -= dt;
        const hit = dummies.find(d => !d.down && flat(d, l) < .9 && l.y - floor < 2.4);
        if (hit) {
          hit.hp--; hit.wobble = .6; emit('burn', { x: hit.x, z: hit.z });
          if (hit.hp <= 0) { hit.down = P.regrow; stats.burned++; emit('shatter', { x: hit.x, z: hit.z }); }
          return false;
        }
        if (flat(totem, l) < .8 && l.y - floor < 3.4) { emit('totemHit', { x: totem.x, z: totem.z }); return false; }
        return l.life > 0 && l.y > floor - 1;
      });
      for (const d of dummies) {
        d.wobble = Math.max(0, d.wobble - dt * 2);
        if (d.down > 0 && (d.down -= dt) <= 0) { const h = home[dummies.indexOf(d)]; Object.assign(d, { x: h.x, z: h.z, hp: P.dummyHp, down: 0 }); emit('regrow', { x: d.x, z: d.z }); }
      }
      // The totem: a short glow (windup), then a bone spear straight at where you are.
      if (windup > 0) {
        if ((windup -= dt) <= 0) {
          const from = { x: totem.x, y: floor + 2, z: totem.z }, dx = p.x - from.x, dy = p.y - .7 - from.y, dz = p.z - from.z, d = Math.hypot(dx, dy, dz) || 1;
          spears.push({ ...from, vx: dx / d * P.spearSpeed, vy: dy / d * P.spearSpeed, vz: dz / d * P.spearSpeed, life: 3 }); emit('throw');
        }
      } else if ((throwIn -= dt) <= 0) { throwIn = P.throwEvery; windup = P.windup; emit('windup'); }
      spears = spears.filter(s => {
        const was = { x: s.x, z: s.z }; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.life -= dt;
        if (walls.some(w => crosses(was, s, w)) && s.y - floor < 3) { stats.caught++; emit('wallStop', { x: s.x, z: s.z }); return false; }
        if (Math.hypot(s.x - p.x, s.y - (p.y - .7), s.z - p.z) < P.spearRadius) {
          if (ward > 0) { stats.caught++; emit('blocked', { x: s.x, y: s.y, z: s.z }); }
          else { const r = io.invulnerable ? 'dodged' : io.hurt?.(s) ?? 'hit'; emit(r === 'hit' ? 'playerHit' : 'dodged'); }
          return false;
        }
        return s.life > 0 && s.y > floor - 1;
      });
      return this.snapshot();
    },
    snapshot() {
      return {
        dummies: dummies.map(d => ({ ...d })), totem: { ...totem, windup: windup > 0 ? 1 - windup / P.windup : 0 },
        lances: lances.map(l => ({ ...l })), spears: spears.map(s => ({ ...s })), walls: walls.map(w => ({ ...w })), ward, gale: gale && { ...gale },
        cooldown: { ...cooldown }, cooldownMax: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v.cooldown])), stats: { ...stats },
      };
    },
  };
}
