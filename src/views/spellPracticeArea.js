import { createSpellPractice, PRACTICE } from '../models/spellPractice.js';
import { MORCANT_FIGHT } from '../models/morcantFight.js';
import { createBursts } from './citadelArena.js';

// The spell practice ground in the movement lab: a rune circle on the grass, three crystal dummies on stakes, and a
// bone totem whose eyes glow before it throws. Draws models/spellPractice.js and turns its events into toasts and sparks.
const SPELL = MORCANT_FIGHT.spells;
export function createSpellPracticeArea({ scene, center, floor = 0, toast = () => {} }) {
  const T = THREE, lin = hex => new T.Color(hex).convertSRGBToLinear(), group = new T.Group(); scene.add(group);
  const model = createSpellPractice({ center, floor });
  const std = (hex, o = {}) => new T.MeshStandardMaterial({ color: lin(hex), roughness: .8, ...o });
  const glow = (hex, opacity = 1) => new T.MeshBasicMaterial({ color: lin(hex), transparent: true, opacity, depthWrite: false, side: T.DoubleSide });
  // The rune circle.
  const ring = new T.Mesh(new T.RingGeometry(PRACTICE.radius - .25, PRACTICE.radius, 96), glow(0xc9a24a, .7)); ring.rotation.x = -Math.PI / 2; ring.position.set(center.x, floor + .03, center.z); group.add(ring);
  const inner = new T.Mesh(new T.RingGeometry(3.6, 3.75, 64), glow(0x8e6cff, .5)); inner.rotation.x = -Math.PI / 2; inner.position.set(center.x, floor + .03, center.z); group.add(inner);
  // Dummies: an amber crystal on a stake; it dims as it burns.
  const dummies = model.snapshot().dummies.map(() => {
    const g = new T.Group(), stake = new T.Mesh(new T.CylinderGeometry(.07, .09, 1.2, 6), std(0x8c7050)); stake.position.y = .6; g.add(stake);
    const crystal = new T.Mesh(new T.OctahedronGeometry(.45, 0), std(0xffb347, { emissive: lin(0xff7a1a), emissiveIntensity: .6, roughness: .3, flatShading: true })); crystal.scale.y = 1.5; crystal.position.y = 1.55; g.add(crystal);
    group.add(g); return { g, crystal };
  });
  // The totem: stacked bone drums and a skull with two eyes.
  const totem = new T.Group(); const t0 = model.snapshot().totem; totem.position.set(t0.x, floor, t0.z); group.add(totem);
  for (let i = 0; i < 3; i++) { const drum = new T.Mesh(new T.CylinderGeometry(.42 - i * .06, .48 - i * .06, .6, 8), std(0xe8dcc0)); drum.position.y = .3 + i * .62; totem.add(drum); }
  const skull = new T.Mesh(new T.SphereGeometry(.38, 14, 10), std(0xf1e8d2)); skull.position.y = 2.2; totem.add(skull);
  const eyes = new T.MeshBasicMaterial({ color: lin(0x8e6cff) });
  for (const x of [-.13, .13]) { const e = new T.Mesh(new T.SphereGeometry(.06, 8, 6), eyes); e.position.set(x, 2.25, .32); totem.add(e); }
  const totemGlow = new T.PointLight(lin(0x8e6cff), 0, 6); totemGlow.position.y = 2.2; totem.add(totemGlow);
  // Pools for the moving pieces and the spells.
  const pool = (n, make) => Array.from({ length: n }, () => { const m = make(); m.visible = false; group.add(m); return m; });
  const spears = pool(4, () => { const g = new T.Group(), shaft = new T.Mesh(new T.CylinderGeometry(.04, .04, 1.3, 6), std(0xeee2c8)); shaft.rotation.x = Math.PI / 2; g.add(shaft); const tip = new T.Mesh(new T.ConeGeometry(.08, .3, 6), std(0xffffff)); tip.rotation.x = Math.PI / 2; tip.position.z = .78; g.add(tip); return g; });
  const lances = pool(6, () => { const l = new T.Mesh(new T.ConeGeometry(.18, 1.2, 8), new T.MeshBasicMaterial({ color: lin(0xff8a3a), toneMapped: false })); l.geometry.rotateX(Math.PI / 2); return l; });
  const ward = pool(1, () => new T.Mesh(new T.SphereGeometry(1.5, 20, 14), new T.MeshStandardMaterial({ color: lin(0x5ec8ff), emissive: lin(0x5ec8ff), emissiveIntensity: .4, transparent: true, opacity: .3, roughness: .1, depthWrite: false })))[0];
  const wall = pool(1, () => { const m = new T.Mesh(new T.BoxGeometry(1, 2.6, .7), std(0x8a7a63, { flatShading: true })); m.castShadow = true; return m; })[0];
  const gale = pool(1, () => { const m = new T.Mesh(new T.RingGeometry(.6, SPELL.wind.range, 32, 1, -Math.PI / 2 - SPELL.wind.arc / 2, SPELL.wind.arc), glow(0xdff6ff, 0)); m.geometry.rotateX(-Math.PI / 2); return m; })[0];
  const bursts = createBursts(group);
  const at = (e, y = 1.4) => ({ x: e.x, y: e.y ?? floor + y, z: e.z });
  function handle(events, io) {
    for (const e of events) {
      if (e.type === 'burn') bursts.at(at(e, 1.5), 0xff8a3a, 0, 12);
      else if (e.type === 'shatter') { toast('CRYSTAL SHATTERED'); bursts.at(at(e, 1.5), 0xffb347, 0, 30); }
      else if (e.type === 'regrow') bursts.at(at(e, 1.5), 0xfff0b8, 0, 12);
      else if (e.type === 'galeHit') { toast('BLOWN BACK'); bursts.at(at(e), 0xdff6ff, 0, 10); }
      else if (e.type === 'totemHit') { toast('THE TOTEM DOES NOT BURN · AIM AT THE CRYSTALS'); bursts.at(at(e, 2), 0xffffff, 0, 8); }
      else if (e.type === 'blocked') { toast('SPEAR CAUGHT'); bursts.at(io.player, 0x5ec8ff, -.6, 16); }
      else if (e.type === 'wallStop') { toast('THE WALL HOLDS'); bursts.at(at(e), 0xb7a98c, 0, 14); }
      else if (e.type === 'spearShattered') { toast('SPEAR SHATTERED'); bursts.at(at(e), 0xeee2c8, 0, 14); }
      else if (e.type === 'playerHit') toast('HIT · TRY THE WARD (RMB) OR A WALL (Q)');
      else if (e.type === 'dodged') toast('ROLLED THROUGH');
      else if (e.type === 'cooling') toast('THAT SPELL IS STILL COOLING');
    }
  }
  return {
    model, center,
    get targets() { return model.targets; }, get cinematic() { return false; },
    get runes() { const s = model.snapshot(); return { cooldown: s.cooldown, max: s.cooldownMax, chaos: false }; },
    contains(p) { return Math.hypot(p.x - center.x, p.z - center.z) < PRACTICE.radius; },
    step(dt, io) { model.update(dt, io); handle(model.takeEvents(), io); },
    render(dt, now, player) {
      const s = model.snapshot();
      s.dummies.forEach((d, i) => { const v = dummies[i]; v.g.visible = !d.down; v.g.position.set(d.x, floor, d.z); v.g.rotation.z = Math.sin(now * .03) * .25 * d.wobble; v.crystal.rotation.y += dt * .8; v.crystal.material.emissiveIntensity = .2 + .4 * d.hp / PRACTICE.dummyHp; });
      eyes.color.copy(lin(s.totem.windup ? 0xff4a6a : 0x8e6cff)); totemGlow.intensity = s.totem.windup * 3; skull.rotation.y = Math.atan2(player.position.x - s.totem.x, player.position.z - s.totem.z);
      spears.forEach((m, i) => { const sp = s.spears[i]; m.visible = Boolean(sp); if (sp) { m.position.set(sp.x, sp.y, sp.z); m.lookAt(sp.x + sp.vx, sp.y + sp.vy, sp.z + sp.vz); } });
      lances.forEach((l, i) => { const ln = s.lances[i]; l.visible = Boolean(ln); if (ln) { l.position.set(ln.x, ln.y, ln.z); l.lookAt(ln.x + ln.vx, ln.y + ln.vy, ln.z + ln.vz); } });
      ward.visible = s.ward > 0; if (ward.visible) { ward.position.set(player.position.x, player.position.y - .9, player.position.z); ward.material.opacity = .18 + .2 * Math.min(1, s.ward); }
      const wl = s.walls[0]; wall.visible = Boolean(wl); if (wl) { const rise = Math.min(1, (SPELL.earth.last - wl.t) / .2, wl.t / .4); wall.scale.set(wl.half * 2, rise, 1); wall.position.set(wl.x, floor + 1.3 * rise, wl.z); wall.rotation.y = wl.yaw; }
      gale.visible = Boolean(s.gale); if (s.gale) { gale.position.set(s.gale.x, floor + .3, s.gale.z); gale.rotation.y = s.gale.yaw; gale.material.opacity = .6 * (1 - s.gale.t / .45); gale.scale.setScalar(.6 + s.gale.t * 1.2); }
      ring.material.opacity = .5 + .2 * Math.sin(now * .002); bursts.update(dt);
    },
  };
}
