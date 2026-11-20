// The two boss fights in the game (GRIMOIRE_SPELLS_PLAN.md): Morcant in his Gatehall once Heart's Tide Sigil and
// page IV are earned (spells only), and Sile at the Prism Citadel once Diamond's Prism Sigil and page V are
// (sword, block, roll, spells). The arenas, the fights and the traveller's combat are the movement lab's own
// (views/gatehallArena.js, views/citadelArena.js, models/travelerCombat.js); this module wires them into the world.
//
// Both arenas are pocket places hung POCKET_Y above a corner of the map nobody walks to. The camera's far plane
// (650 m) is far below them, so the world is never in view: only each arena's own void and dusk. A Kamui warp
// carries the traveller in, and back to where they stood once the fight is won. Terrain keeps streaming around
// that spot meanwhile (focus), so nothing is generated up here.
import { createTravelerCombat } from '../models/travelerCombat.js';
import { createGrapple } from '../models/grapple.js';
import { createCitadelArena, createArenaHud } from '../views/citadelArena.js';
import { createGatehall } from '../views/gatehallArena.js';
import { createSpellBar } from '../views/spellBar.js';
import { spellForKey } from '../models/grimoireSpells.js';
import { createSigilBlade, createSigilSheath } from '../rendering/sigilBlade.js';
import { MANA } from '../models/mana.js';

const POCKET_Y = 1000;
export const GATEHALL_AT = { x: 4000, z: 0 };
export const CITADEL_AT = { x: 4000, z: 400, radius: 21, floor: POCKET_Y };
const WARP = .55;   // seconds into the Kamui vortex when the traveller is moved: the screen is swallowed by then
// The pace the fights were tuned for in the lab (the open world walks at 9 m/s and sprints at 18).
export const FIGHT_PACE = { walkSpeed: 4.2, sprintSpeed: 7.8, crouchSpeed: 2, smooth: true, variableJump: true };
const AIR = { dash: .14, total: .5 }; // Sile's air strike: a short lunge, the slash in mid-air, a bounce back

export function createBossFights({ scene, camera, state, keys, pointerButtons, player, movement, character, kamui,
  viewCamera, platforms, colliders, obstacles, surfaceAt, toast, mana = null }) {
  const T = THREE;
  const say = text => toast(text, 1600);
  const hud = createArenaHud(); hud.toast = say;
  const sileAnchors = [], grapple = createGrapple({ anchors: sileAnchors }); // her spire tips; Heart's crystals keep their own rope
  const gatehall = createGatehall({ scene, center: GATEHALL_AT, floor: POCKET_Y, toast: say, obstacles });
  colliders.push(...gatehall.colliders); platforms.push(...gatehall.platforms);
  const citadel = createCitadelArena({ scene, obstacles, colliders, anchors: sileAnchors, hud, center: CITADEL_AT });
  platforms.push({ name: 'citadel-mesa', x: CITADEL_AT.x, z: CITADEL_AT.z, top: POCKET_Y, bottom: POCKET_Y - 1, solid: false,
    contains: (x, z, pad = 0) => current === 'sile' && Math.hypot(x - CITADEL_AT.x, z - CITADEL_AT.z) < CITADEL_AT.radius + pad });
  const spellBar = createSpellBar();

  let manaRest = 0; // the part of the bar under one charge, kept aside while a fight counts whole charges
  let combat = null, combatState = null, current = null, arena = null, phase = 'idle', warp = 0, back = null, savedFov = null;
  let hitstop = 0, airStrike = null, pendingRune = null, castPose = 0, barOn = null, dome = null;
  const queue = [], won = new Set(), pressed = { attack: false, dodge: false, sheathe: false, chaos: false };
  const castPoint = new T.Vector3(), aimDir = new T.Vector3(), fog = new T.Color(), sky = new T.Color();

  character.ready.then(() => {
    if (!character.loaded) return;
    character.setSwordModel(createSigilBlade()); character.setSheath(createSigilSheath());
    combat = createTravelerCombat({ rootMotion: character.rootMotion, scale: character.modelScale });
  });

  const fighting = () => phase === 'fight';
  const shown = () => phase === 'fight' || phase === 'out'; // the arena stays on screen until the vortex has swallowed it
  const runic = () => current === 'morcant';                       // the Gatehall: spells on the mouse, no sword
  const runeFight = () => fighting() && !arena.cinematic && state.locked;
  const spellKey = code => runic() || code !== 'KeyQ' ? spellForKey(code) : null; // Q stays Sile's grapple

  addEventListener('keydown', e => {
    if (!fighting() || !state.locked || e.repeat) return;
    if (e.code === 'KeyF') pressed.dodge = true;
    else if (e.code === 'KeyG') pressed.chaos = true;
    else if (e.code === 'KeyX') pressed.sheathe = true;
    else if (e.code === 'KeyJ') pressed.attack = true;
    else if (e.code === 'Enter') arena.skip();
    if (runeFight() && spellKey(e.code)) pendingRune = spellKey(e.code);
  });
  addEventListener('mousedown', e => {
    if (!fighting() || !state.locked) return;
    if (e.button === 0 && !runic()) pressed.attack = true;
    if (e.button === 2 && runic() && runeFight()) pendingRune = 'tide';
  });

  // The cast's aim: the target nearest the centre of view (him, a spider, a pillar), else straight ahead.
  function takeCast() {
    if (!pendingRune) return null;
    const rune = pendingRune; pendingRune = null;
    const eye = player.position; camera.getWorldDirection(aimDir);
    let best = null, bestOff = .55;
    for (const t of arena.targets || []) {
      const d = new T.Vector3(t.x - eye.x, t.y - eye.y + .6, t.z - eye.z), len = d.length();
      if (len < .5 || len > 30) continue;
      const off = d.divideScalar(len).angleTo(aimDir);
      if (off < bestOff) { bestOff = off; best = t; }
    }
    const chest = { x: eye.x, y: eye.y - .6, z: eye.z };
    const aim = best ? { x: best.x, y: best.y, z: best.z } : { x: chest.x + aimDir.x * 25, y: chest.y + aimDir.y * 25, z: chest.z + aimDir.z * 25 };
    const dx = aim.x - chest.x, dz = aim.z - chest.z, d = Math.hypot(dx, dz) || 1, from = { x: chest.x + dx / d * .7, y: chest.y + .15, z: chest.z + dz / d * .7 };
    const facing = best && rune !== 'earth' ? Math.atan2(aim.x - from.x, aim.z - from.z) : Math.atan2(aimDir.x, aimDir.z); // the wall rises where you look
    castPose = .45; castPoint.set(aim.x, aim.y, aim.z); spellBar.flash(rune);
    return { rune, from, aim, facing };
  }
  function startAirStrike(at) {
    const from = player.position.clone(), dir = new T.Vector3(at.x - from.x, 0, at.z - from.z);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    airStrike = { t: 0, from, to: new T.Vector3(at.x - dir.x * 1.4, at.y + .35, at.z - dir.z * 1.4), dir, facing: Math.atan2(dir.x, dir.z), bounced: false };
    grapple.reset();
  }
  function stepAirStrike(dt) { // true while the lunge owns the body
    if (!airStrike) return false;
    const a = airStrike; a.t += dt;
    if (a.t < AIR.dash) { const k = a.t / AIR.dash; player.position.lerpVectors(a.from, a.to, 1 - (1 - k) * (1 - k)); player.velocity.set(0, 0, 0); player.grounded = false; return true; }
    if (!a.bounced) { a.bounced = true; player.position.copy(a.to); player.velocity.set(-a.dir.x * 4.5, 7.5, -a.dir.z * 4.5); }
    if (a.t >= AIR.total || player.grounded) airStrike = null;
    return false;
  }
  function combatInput() {
    const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const sd = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const len = Math.hypot(f, sd) || 1, sin = Math.sin(state.yaw), cos = Math.cos(state.yaw), spells = runic();
    const input = { attack: pressed.attack && !spells, dodge: pressed.dodge, sheathe: pressed.sheathe, block: !spells && (pointerButtons.has(2) || keys.has('KeyK')),
      moveX: state.locked ? (-sin * f + cos * sd) / len : 0, moveZ: state.locked ? (-cos * f - sin * sd) / len : 0, sprinting: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    pressed.attack = pressed.dodge = pressed.sheathe = false;
    return input;
  }

  function start(kind) {
    current = kind; arena = kind === 'morcant' ? gatehall : citadel;
    back = { x: player.position.x, z: player.position.z, top: player.position.y - 2.05, yaw: state.yaw };
    kamui.pulse(null, 1.4, { full: true }); phase = 'in'; warp = WARP; keys.clear(); pointerButtons.clear();
  }
  function arrive() { // in the middle of the vortex: into the arena
    savedFov = camera.fov;
    movement.teleport({ ...arena.entry, yaw: 0 }); grapple.reset(); combat?.reset(); airStrike = null; combatState = null;
    // The mana bar comes in capped at one charge (MANA_PLAN.md: a full bar must not open with three Chaos strikes).
    let charge = 0;
    if (mana) { mana.cap(MANA.fightCap); charge = Math.floor(mana.value / MANA.surgeCost + 1e-6); manaRest = mana.value - charge * MANA.surgeCost; }
    if (current === 'morcant') gatehall.begin(charge); else citadel.enter(charge);
    fog.copy(scene.fog.color); phase = 'fight';
  }
  function leave() { // won: the arena closes, the vortex carries the traveller back
    arena.exit(); spellBar.show(false); barOn = null; hud.show(false);
    if (dome) dome.visible = true;
    if (savedFov !== null) { camera.fov = savedFov; camera.updateProjectionMatrix(); savedFov = null; }
    movement.teleport(back); grapple.reset(); combat?.reset(); combatState = null; airStrike = null;
    current = null; arena = null; phase = 'idle';
  }

  return {
    /** A fight is warping in, running, or warping out: the game's own movement, swarm and Tide Hook stand aside. */
    get busy() { return phase !== 'idle'; },
    get fighting() { return fighting(); },
    get won() { return won; },
    get arena() { return arena; }, // debugging: dreamscape.bosses.arena.fight.finish() skips to the ending
    /** Where terrain should keep streaming while the traveller is up in an arena. */
    get focus() { return shown() ? back : null; },
    /** Locomotion overrides for the player controller (the lab's pace) while in an arena, else undefined. */
    get pace() { return fighting() ? FIGHT_PACE : null; },
    get drive() { return fighting() ? combatState?.drive || (current === 'sile' ? grapple.drive : null) : null; },
    /** For the traveller's animation: where a spell is cast, the combat pose, and Sile's grapple rope. */
    get castAt() { return fighting() && castPose > 0 ? castPoint : null; },
    get shown() {
      if (!fighting()) return null;
      if (airStrike) return { clip: 'slash1', time: Math.min(.42, .08 + airStrike.t * .95), facing: airStrike.facing, drawn: true, trail: airStrike.t < .38 };
      return runic() && combatState ? { ...combatState, drawn: false } : combatState;
    },
    get rope() { return fighting() && current === 'sile' ? { anchor: grapple.anchor, reach: grapple.reach, phase: grapple.phase, flip: grapple.flip } : null; },
    /** kind: 'morcant' | 'sile'. Waits for observe(). */
    queue(kind) { if (!won.has(kind) && !queue.includes(kind) && current !== kind) queue.push(kind); },
    /** ready: no scene, page or other cinematic owns the camera and the traveller stands free. */
    observe(ready) { if (phase === 'idle' && queue.length && ready && combat) start(queue.shift()); },
    /** Falling off the mesa (or anywhere below an arena): back to its entry. */
    recovery(p) { if (!fighting() || p.position.y > POCKET_Y - 10) return null; grapple.reset(); airStrike = null; return { ...arena.entry }; },
    /** Replaces the game's movement step while busy. */
    update(dt) {
      if (phase === 'in' || phase === 'out') { if ((warp -= dt) <= 0) phase === 'in' ? arrive() : leave(); return; }
      if (!fighting()) return;
      const step = hitstop > 0 ? 0 : dt; hitstop = Math.max(0, hitstop - dt);
      const input = combatInput();
      const io = { player: player.position, feet: player.position.y - 2.05, grounded: player.grounded, chaosPress: pressed.chaos, attackPress: input.attack,
        invulnerable: Boolean(combatState?.invulnerable), swordHit: combatState?.hit || null, cast: arena.cinematic ? null : takeCast(),
        hurt: (from, o) => combat ? combat.hurt(from, player.position, o) : 'hit',
        push: from => { const dx = player.position.x - from.x, dz = player.position.z - from.z, d = Math.hypot(dx, dz) || 1; player.position.x += dx / d * 1.1; player.position.z += dz / d * 1.1; },
        onDown: () => { movement.teleport({ ...arena.entry, yaw: 0 }); grapple.reset(); combat?.reset(); },
        onImpact: heavy => { hitstop = heavy ? .09 : .05; }, onAirStrike: at => { startAirStrike(at); hitstop = .13; } };
      pressed.chaos = false;
      // The world's chaos rests up here (no red storm over the arena); each fight keeps its own Chaos.
      state.chaos = .06; state.mode = 'calm';
      if (arena.cinematic) { player.velocity.x = player.velocity.z = 0; combatState = null; arena.step(step, io); }
      else {
        const lunging = stepAirStrike(step);
        const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), sd = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
        const len = Math.hypot(f, sd) || 1, sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
        const hook = lunging ? { owns: true } : current === 'sile' ? grapple.update(step, { hold: state.locked && keys.has('KeyQ') && !airStrike, jump: player.jumpBuffer > 0,
          moveX: (-sin * f + cos * sd) / len, moveZ: (-cos * f - sin * sd) / len, look: { x: -sin, z: -cos } }, player, surfaceAt) : { owns: false };
        if (combat) combatState = combat.update(step, input, { grounded: player.grounded, speed: Math.hypot(player.velocity.x, player.velocity.z),
          yaw: state.yaw, heading: character.heading, position: player.position, targets: arena.targets });
        if (!hook.owns) movement.update(step);
        if (state.locked) { io.swordHit = combatState?.hit || null; io.invulnerable = Boolean(combatState?.invulnerable); arena.step(step, io); }
      }
      mana?.set(arena.fight.charge * MANA.surgeCost + manaRest); // one charge = one third of the bar, both ways
      if (!arena.active) { won.add(current); kamui.pulse(null, 1.4, { full: true }); phase = 'out'; warp = WARP; } // 'done': the ending has played
    },
    /** The camera while fighting: the arena's own shots, else the follow camera. Returns the camera distance, or null when not fighting. */
    camera(dt) {
      if (!shown()) return null;
      const shot = arena.shot(camera, dt, player);
      if (shot === null || shot === false) { const d = viewCamera.update(dt); arena.applyShake(camera, dt); return d; }
      return camera.position.distanceTo(player.position);
    },
    /** After the game's atmosphere: the arena's own void, fog and light, the spell bar, the sword. */
    render(dt, now) {
      if (character.loaded) { // no blade before Morcant forges it; in the Gatehall it appears as it is forged
        if (fighting() && current === 'morcant') { const f = gatehall.forgeShow; character.showSword(f.sword, f.sheath); }
        else character.showSword(won.has('morcant') || current === 'sile'); // Sile's fight is a sword fight
      }
      if (!shown()) return;
      dome ||= scene.getObjectByName('SkyDome'); if (dome) dome.visible = false;
      // The atmosphere repaints fog every frame: carry the arena's own colour across frames so its fades complete.
      scene.fog.color.copy(fog); scene.fog.density = .012; scene.background = sky.copy(fog);
      arena.render(dt, now, { camera, grapple, player });
      fog.copy(scene.fog.color);
      const bar = runeFight() ? (runic() ? 'morcant' : 'sile') : '';
      if (barOn !== bar) { barOn = bar; spellBar.show(Boolean(bar), bar === 'sile' ? ['1', '2', 'E', '4'] : null); }
      if (bar) { const r = arena.runes; spellBar.update(r); if (bar === 'morcant' && pointerButtons.has(0) && !r.cooldown.flame && !pendingRune) pendingRune = 'flame'; } // hold LMB: a lance whenever it is ready
      castPose = Math.max(0, castPose - dt);
      if (castPose > 0) state.swarmGesture = 'push';
    },
    reset() {
      if (arena) { arena.exit(); if (savedFov !== null) { camera.fov = savedFov; camera.updateProjectionMatrix(); savedFov = null; } }
      if (dome) dome.visible = true;
      spellBar.show(false); barOn = null; hud.show(false);
      grapple.reset(); combat?.reset(); combatState = null; airStrike = null; pendingRune = null;
      current = null; arena = null; phase = 'idle'; queue.length = 0; won.clear();
    },
  };
}
