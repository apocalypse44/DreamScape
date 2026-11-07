import { createPerson } from '../rendering/person.js';
import { createBeam } from '../controllers/flashback.js';
import { createSileFight } from '../models/sileFight.js';
import { RIFT_VORTEX_GLSL } from '../rendering/sky.js';

// The Prism Citadel forecourt for the Sile fight (combat.md). A floating mesa with the Great Prism at
// its centre, five crystal spires whose tips are Tide Hook anchors, three inversion anchors, and the
// citadel towers behind. Draws models/sileFight.js and turns its events into sound and camera work.
// Everything is primitive geometry plus the existing Sile character; nothing new downloads.
export const CITADEL = { x: 0, z: -110, radius: 21, floor: 0 };
// Material colours are converted to linear like the rest of the lab (it renders with sRGB output).
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
const ICE = lin(0xdff4ff), VIOLET = lin(0x6a12ff), CRIMSON = 0xff3355, CRIMSON_L = lin(CRIMSON), WHITE_L = lin(0xe8f6ff);
const SKY = new THREE.Color(0x4a3a63), SKY_CHAOS = new THREE.Color(0x6a1828), LAB_SKY = new THREE.Color(0xdce7de);

export const inCitadel = (x, z) => Math.hypot(x - CITADEL.x, z - CITADEL.z) < CITADEL.radius;
// The lab's ground beyond its own clearing: the mesa top, else a drop into cloud.
export const citadelGround = (x, z) => z < -52 ? (inCitadel(x, z) ? CITADEL.floor : -30) : null;

export function createCitadelArena({ scene, obstacles, colliders, anchors, hud }) {
  const T = THREE, C = CITADEL, group = new T.Group(); group.visible = false; scene.add(group);
  const at = (a, r) => ({ x: C.x + Math.sin(a) * r, z: C.z + Math.cos(a) * r }); // angle 0 faces the entry (+z)
  const entry = { x: C.x, z: C.z + 14, top: C.floor };
  const inversionAt = [at(.95, 9.5), at(-.95, 9.5), at(Math.PI, 9.5)];
  const spireAngles = [1.05, 2.1, Math.PI, -2.1, -1.05];
  const fight = createSileFight({ center: C, floor: C.floor, anchors: inversionAt });
  let built = false, sile = null, scythe = null, prismMat = null, prismLight = null, crown = null;
  const spireAnchors = [], spireTips = [], inversion = [], darts = [], shardViews = [];
  const waveRings = []; let waveCharge = null, fleeCam = null, fleeCut = false, flash = null;
  let sweepMesh, slash, aura, shieldMesh, tetherBeam, rift, bursts, voice = null, lastPose = '', shake = 0, camPos = new T.Vector3(), camLook = new T.Vector3(), haveShot = false;

  function build() {
    if (built) return; built = true;
    const stone = new T.MeshStandardMaterial({ color: 0x6f6784, roughness: .9 }), dark = new T.MeshStandardMaterial({ color: 0x3e3850, roughness: 1 });
    const hidden = mesh => { const c = mesh.clone(); c.visible = false; return c; }; // camera collision only: raycasts ignore visibility
    const glass = (color, opacity = .8) => new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .25, roughness: .2, transparent: true, opacity, flatShading: true });
    // Mesa: a flat forecourt on a tapering rock, flagstone rings, a low parapet gap at the entry.
    const mesa = new T.Mesh(new T.CylinderGeometry(C.radius, 7, 26, 28, 3), dark); mesa.position.set(C.x, C.floor - 13, C.z); mesa.receiveShadow = true; group.add(mesa);
    const top = new T.Mesh(new T.CircleGeometry(C.radius, 48), stone); top.rotation.x = -Math.PI / 2; top.position.set(C.x, C.floor + .01, C.z); top.receiveShadow = true; group.add(top);
    for (const [r, w] of [[6, .25], [12.5, .3], [18.5, .35]]) {
      const ring = new T.Mesh(new T.RingGeometry(r - w, r, 64), new T.MeshBasicMaterial({ color: 0x9d86d8 })); ring.rotation.x = -Math.PI / 2; ring.position.set(C.x, C.floor + .02, C.z); group.add(ring);
    }
    // Great Prism: a six-sided crystal floating over a pedestal, with a crown ring and its own light.
    const pedestal = new T.Mesh(new T.CylinderGeometry(2.6, 3, 1.2, 6), stone); pedestal.position.set(C.x, C.floor + .6, C.z); pedestal.castShadow = true; group.add(pedestal); obstacles.add(hidden(pedestal));
    colliders.push({ x: C.x, z: C.z, radius: 2.9 });
    prismMat = glass(ICE.getHex(), .88); prismMat.emissiveIntensity = .8;
    const prism = new T.Group(); prism.position.set(C.x, C.floor + 6, C.z); group.add(prism);
    const body = new T.Mesh(new T.CylinderGeometry(1.4, 1.4, 5, 6), prismMat), capTop = new T.Mesh(new T.ConeGeometry(1.4, 2.4, 6), prismMat), capBottom = capTop.clone();
    capTop.position.y = 3.7; capBottom.position.y = -3.7; capBottom.rotation.x = Math.PI; prism.add(body, capTop, capBottom);
    crown = new T.Mesh(new T.TorusGeometry(2.3, .12, 6, 32), new T.MeshBasicMaterial({ color: ICE, toneMapped: false })); crown.rotation.x = Math.PI / 2; crown.position.y = 2.2; prism.add(crown);
    prismLight = new T.PointLight(ICE, 1.6, 34); prismLight.position.y = 0; prism.add(prismLight);
    group.userData.prism = prism;
    // Spires: crystal needles on the rim; each tip carries a Tide Hook anchor.
    for (const a of spireAngles) {
      const p = at(a, 17.2), h = 14 + Math.abs(a) % 1.3 * 2;
      const base = new T.Mesh(new T.CylinderGeometry(1.7, 2.1, 1.6, 6), stone); base.position.set(p.x, C.floor + .8, p.z); group.add(base);
      const needle = new T.Mesh(new T.ConeGeometry(1.25, h, 6), glass(0x5b3aa6, .92)); needle.position.set(p.x, C.floor + 1.5 + h / 2, p.z); needle.castShadow = true; group.add(needle);
      obstacles.add(hidden(needle)); colliders.push({ x: p.x, z: p.z, radius: 1.6 });
      const tip = { x: p.x, y: C.floor + h + 3.2, z: p.z }; spireAnchors.push(tip); anchors.push(tip);
      const crystal = new T.Mesh(new T.OctahedronGeometry(.5, 0), new T.MeshStandardMaterial({ color: 0x7fe3ee, emissive: 0x2bb8c9, emissiveIntensity: .6, flatShading: true }));
      crystal.scale.y = 1.6; crystal.position.set(tip.x, tip.y, tip.z); group.add(crystal); spireTips.push(crystal);
    }
    // Inversion anchors: obelisks Sile feeds from; beams run to her, crimson until inverted.
    for (const p of inversionAt) {
      const ob = new T.Mesh(new T.BoxGeometry(.8, 3.4, .8), glass(CRIMSON, .92)); ob.position.set(p.x, C.floor + 1.7, p.z); ob.rotation.y = .78; group.add(ob);
      colliders.push({ x: p.x, z: p.z, radius: .7 });
      const fill = new T.Mesh(new T.CircleGeometry(F_RADIUS, 32), new T.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: .35, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.set(p.x, C.floor + .03, p.z);
      const edge = new T.Mesh(new T.RingGeometry(F_RADIUS - .12, F_RADIUS, 40), new T.MeshBasicMaterial({ color: CRIMSON, transparent: true, opacity: .55 })); edge.rotation.x = -Math.PI / 2; edge.position.set(p.x, C.floor + .03, p.z);
      group.add(fill, edge);
      inversion.push({ ob, fill, edge, red: createBeam(group, CRIMSON, .07), white: createBeam(group, 0xe8f6ff, .1), at: new T.Vector3(p.x, C.floor + 3.2, p.z) });
    }
    // The citadel behind: three towers with spires on their own rock, beyond the mesa's far edge.
    for (const [dx, dz, h] of [[-15, -33, 22], [0, -38, 30], [15, -33, 22]]) {
      const rock = new T.Mesh(new T.CylinderGeometry(7, 3, 14, 7), dark); rock.position.set(C.x + dx, C.floor - 9, C.z + dz); group.add(rock);
      const tower = new T.Mesh(new T.BoxGeometry(6, h, 6), stone); tower.position.set(C.x + dx, C.floor + h / 2 - 2, C.z + dz); tower.castShadow = true; group.add(tower);
      const roof = new T.Mesh(new T.ConeGeometry(4.6, 8, 4), glass(0x4a2a8f, .95)); roof.position.set(C.x + dx, C.floor + h + 2, C.z + dz); roof.rotation.y = Math.PI / 4; group.add(roof);
    }
    // Sile: the people-kit character, a procedural scythe, an aura and her siphon shield.
    sile = createPerson({ name: 'sile' }); group.add(sile.root);
    scythe = new T.Group(); scythe.position.set(-.42, 1.2, .12); sile.root.add(scythe);
    const shaftMat = new T.MeshStandardMaterial({ color: 0x2a1418, roughness: .6 }), bladeMat = new T.MeshBasicMaterial({ color: CRIMSON, toneMapped: false });
    const shaft = new T.Mesh(new T.CylinderGeometry(.03, .035, 2, 6), shaftMat); shaft.position.y = .35; scythe.add(shaft);
    const blade = new T.Mesh(new T.TorusGeometry(.6, .05, 4, 20, 2.2), bladeMat); blade.position.set(-.05, .75, 0); blade.rotation.set(0, 0, .55); scythe.add(blade); // the arc faces the viewer
    aura = new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshBasicMaterial({ color: CRIMSON, transparent: true, opacity: .08, side: T.BackSide, depthWrite: false })); group.add(aura);
    shieldMesh = new T.Mesh(new T.IcosahedronGeometry(1.7, 1), new T.MeshBasicMaterial({ color: CRIMSON, wireframe: true, transparent: true, opacity: .3, depthWrite: false })); group.add(shieldMesh);
    // Attack effects.
    sweepMesh = new T.Mesh(new T.RingGeometry(.6, 4.6, 32, 1, -Math.PI / 2 - 1.2, 2.4), new T.MeshBasicMaterial({ color: CRIMSON, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
    sweepMesh.geometry.rotateX(-Math.PI / 2); group.add(sweepMesh);
    for (let i = 0; i < 9; i++) { const m = new T.Mesh(new T.OctahedronGeometry(.16, 0), bladeMat); m.scale.z = 2.4; m.visible = false; group.add(m); darts.push(m); }
    for (let i = 0; i < 9; i++) {
      const ring = new T.Mesh(new T.RingGeometry(1.95, 2.2, 32), new T.MeshBasicMaterial({ color: CRIMSON, transparent: true, opacity: .7, depthWrite: false })), disc = new T.Mesh(new T.CircleGeometry(2.2, 32), new T.MeshBasicMaterial({ color: CRIMSON, transparent: true, opacity: .25, depthWrite: false }));
      ring.rotation.x = disc.rotation.x = -Math.PI / 2; const shard = new T.Mesh(new T.ConeGeometry(.55, 2.6, 5), glass(0xff5a7a, .95)); shard.rotation.x = Math.PI;
      group.add(ring, disc, shard); shardViews.push({ ring, disc, shard });
    }
    tetherBeam = createBeam(group, CRIMSON, .09);
    rift = createPortal(group);
    // Siphon waves: crimson rings that race out along the floor; a pulse at her feet while she rears up.
    for (let i = 0; i < 4; i++) { const w = new T.Mesh(new T.TorusGeometry(1, .16, 6, 64), new T.MeshBasicMaterial({ color: CRIMSON, transparent: true, opacity: .85, depthWrite: false, toneMapped: false })); w.rotation.x = Math.PI / 2; w.visible = false; group.add(w); waveRings.push(w); }
    waveCharge = new T.Mesh(new T.RingGeometry(.4, 3, 48), new T.MeshBasicMaterial({ color: CRIMSON, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide })); waveCharge.rotation.x = -Math.PI / 2; group.add(waveCharge);
    bursts = createBursts(group); slash = createSlash(group); flash = createFlash(group);
    const seen = new Set();
    group.traverse(o => { const m = o.material; if (!m || seen.has(m) || sile.root === o || isInside(o, sile.root)) return; seen.add(m); m.color?.convertSRGBToLinear(); m.emissive?.convertSRGBToLinear(); });
    scene.traverse(o => { if (o.isHemisphereLight || o.isDirectionalLight) daylight.push([o, o.intensity]); });
  }
  const daylight = []; // the lab's sun and sky light, dimmed under the citadel's dusk
  const isInside = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };

  // ---- sound: a synthesized laugh (formant bursts through an echo), a rumble, and spoken lines ----
  function createVoice() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ctx = new AC(), out = ctx.createGain(); out.gain.value = .55; out.connect(ctx.destination);
    const echo = ctx.createDelay(); echo.delayTime.value = .24; const feedback = ctx.createGain(); feedback.gain.value = .34;
    out.connect(echo); echo.connect(feedback); feedback.connect(echo); echo.connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate * .2, ctx.sampleRate); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    function syllable(t, f, len, gain) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.2, t); o.frequency.exponentialRampToValueAtTime(f * .78, t + len);
      const vib = ctx.createOscillator(), depth = ctx.createGain(); vib.frequency.value = 7; depth.gain.value = f * .05; vib.connect(depth); depth.connect(o.frequency);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + len);
      for (const [hz, q] of [[760, 5], [1180, 7], [2600, 9]]) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hz; bp.Q.value = q; o.connect(bp); bp.connect(g); }
      const h = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), hg = ctx.createGain(); h.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 1500;
      hg.gain.setValueAtTime(gain * .5, t - .03); hg.gain.exponentialRampToValueAtTime(.001, t + .04); h.connect(hp); hp.connect(hg); hg.connect(out);
      g.connect(out); o.start(t); vib.start(t); h.start(t - .03); o.stop(t + len + .02); vib.stop(t + len + .02); h.stop(t + .06);
    }
    return {
      resume() { ctx.resume?.(); },
      // A rising giggle that drops into a low, slow "ha... ha... haaa".
      laugh({ long = false, sour = false } = {}) {
        let t = ctx.currentTime + .05;
        const giggles = sour ? 3 : long ? 6 : 4;
        for (let i = 0; i < giggles; i++) { syllable(t, 330 + i * 18, .1, .7); t += .13; }
        const lows = sour ? 1 : long ? 4 : 3;
        for (let i = 0; i < lows; i++) { t += .1 + i * .05; syllable(t, 210 - i * 22, .2 + i * .06, .9); t += .2; }
      },
      rumble() {
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(48, t); o.frequency.linearRampToValueAtTime(32, t + 2.6);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.8, t + .4); g.gain.exponentialRampToValueAtTime(.001, t + 2.8); o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 3);
      },
      hit(pitch = 1) {
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(520 * pitch, t); o.frequency.exponentialRampToValueAtTime(120 * pitch, t + .14);
        g.gain.setValueAtTime(.4, t); g.gain.exponentialRampToValueAtTime(.001, t + .16); o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .18);
      },
      say(text) { // ponytail: browser speech voice; swap for recorded lines when the cast is voiced
        if (!window.speechSynthesis) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text), voices = speechSynthesis.getVoices();
        u.voice = voices.find(v => /zira|aria|jenny|samantha|female|susan|hazel/i.test(v.name)) || null; u.pitch = 1.35; u.rate = .88; u.volume = .95;
        speechSynthesis.speak(u);
      },
    };
  }

  const toast = text => hud.toast?.(text);
  function handle(events, io) {
    for (const e of events) {
      if (e.type === 'laugh') voice?.laugh(e);
      else if (e.type === 'rumble') { voice?.rumble(); shake = Math.max(shake, .35); }
      else if (e.type === 'line') voice?.say(e.text);
      else if (e.type === 'fight') toast('SILE THE HARVESTER');
      else if (e.type === 'blocked' || e.type === 'dodged') { toast(e.type === 'blocked' ? 'Blocked +charge' : 'Dodged +charge'); bursts.at(io.player, e.type === 'blocked' ? 0xf2d27a : 0x5fb8e8); voice?.hit(1.4); }
      else if (e.type === 'playerHit') { toast(e.kind === 'shard' ? 'Crushed!' : 'Hit!'); shake = Math.max(shake, .14); bursts.at(io.player, 0xe0553a); voice?.hit(.6); }
      else if (e.type === 'tetherBroken') toast('Tether broken +charge');
      else if (e.type === 'inReach') toast('In reach: strike!');
      else if (e.type === 'jumped') { toast('Jumped +charge'); voice?.hit(1.5); }
      else if (e.type === 'wave') { shake = Math.max(shake, .06); }
      else if (e.type === 'reshield') { toast('She reclaims an anchor!'); bursts.at(inversion[e.index].at, CRIMSON, 0, 26); shake = .2; }
      else if (e.type === 'open') { toast('Shield down: strike!'); bursts.at(sile.root.position, CRIMSON, 1.1, 20); voice?.hit(1.6); }
      else if (e.type === 'deflect') { toast('Deflected'); bursts.at(sile.root.position, CRIMSON, 1.3); voice?.hit(2); }
      else if (e.type === 'airHit') {
        chest.set(sile.root.position.x, sile.root.position.y + 1.15, sile.root.position.z);
        io.onAirStrike?.(chest.clone()); slash.spawn(chest, io.player, fight.chaos); bursts.at(chest, 0xffffff, 0, 26);
        shake = Math.max(shake, .28); voice?.hit(.7); io.onImpact?.(true);
      }
      else if (e.type === 'strike') { bursts.at(sile.root.position, e.chaos ? 0xff3a3a : 0xb08cff, 1.3, 18); shake = Math.max(shake, .1); voice?.hit(e.chaos ? .8 : 1.1); io.onImpact?.(true); }
      else if (e.type === 'chaos') toast('CHAOS');
      else if (e.type === 'calm') toast(e.knocked ? 'Knocked back to Calm' : 'Calm');
      else if (e.type === 'noCharge') toast('No charge: block or roll a real attack');
      else if (e.type === 'needCalm') toast('Return to Calm to invert');
      else if (e.type === 'inverted') { toast('Anchor inverted'); bursts.at(inversion[e.index].at, 0xe8f6ff, 0, 24); }
      else if (e.type === 'shieldShatter') { toast('Her shield shatters!'); bursts.at(sile.root.position, CRIMSON, 1, 30); shake = .3; }
      else if (e.type === 'shardImpact') { bursts.at({ x: e.x, y: C.floor + .3, z: e.z }, 0xff5a7a, 0, 14); }
      else if (e.type === 'crash') { shake = .4; bursts.at(sile.root.position, CRIMSON, 0, 26); voice?.rumble(); }
      else if (e.type === 'pushback') io.push?.(e.from);
      else if (e.type === 'down') { toast('You fall... try again'); io.onDown?.(); }
      else if (e.type === 'riftFlash') { flash.fire(fight.snapshot().riftAt); hud.flash?.(); shake = Math.max(shake, .35); bursts.at(fight.snapshot().riftAt, 0xe9d8ff, 0, 40); voice?.rumble(); }
      else if (e.type === 'done') toast('Sile fled. The Great Prism is clear.');
    }
  }

  const tmp = new T.Vector3(), chest = new T.Vector3();
  function playSile(pose) {
    if (pose === lastPose) return; lastPose = pose;
    const clip = { talk: 'Idle_Talking_Loop', cast: 'Spell_Simple_Shoot', flinch: 'Hit_Chest', open: 'Hit_Chest', kneel: 'Crouch_Idle_Loop', hurt: 'Hit_Chest' }[pose] || 'Spell_Simple_Idle_Loop';
    sile.play(clip, .2, ['cast', 'flinch', 'open', 'hurt'].includes(pose));
    sile.setExpression({ talk: 'smile', rise: 'joy', open: 'surprised', flinch: 'hurt', kneel: 'hurt', hurt: 'sad', sweepWindup: 'determined', cast: 'focus', fly: 'joy' }[pose] || 'smile', 1.2);
  }

  return {
    fight, entry, get active() { return fight.active; }, get cinematic() { return fight.cinematic; }, get chaos() { return fight.chaos; },
    get targets() { return fight.active && fight.phase !== 'sky' ? [fight.sile] : []; },
    enter() {
      build(); group.visible = true; voice ||= createVoice(); voice?.resume(); fight.start(); lastPose = ''; haveShot = false;
      hud.show(true);
    },
    exit() { fight.stop(); group.visible = false; for (const [light, base] of daylight) light.intensity = base; hud.show(false); window.speechSynthesis?.cancel(); scene.background.copy(LAB_SKY); scene.fog.color.copy(LAB_SKY); },
    skip() { fight.skip(); window.speechSynthesis?.cancel(); },
    /** io: { player, feet, grounded, chaosPress, attackPress, invulnerable, swordHit, hurt, push, onDown, onImpact } */
    step(dt, io) { if (!fight.active) return; fight.update(dt, io); handle(fight.takeEvents(), io); },
    /** Visuals, once per rendered frame. grapple: highlight the spire anchor it would hook. */
    render(dt, now, { camera, grapple, player }) {
      if (!built || !group.visible) return;
      const s = fight.snapshot();
      // Sky and prism.
      scene.background.lerp(s.chaos ? SKY_CHAOS : SKY, Math.min(1, dt * 3)); scene.fog.color.copy(scene.background);
      const tint = ICE.clone().lerp(VIOLET, s.purple); prismMat.color.copy(tint); prismMat.emissive.copy(tint); prismLight.color.copy(tint); crown.material.color.copy(tint);
      prismMat.emissiveIntensity = .55 + s.purple * .7 + (s.chaos ? .3 * Math.sin(now * .01) : 0); prismLight.intensity = .7 + s.purple * .6;
      for (const [light, base] of daylight) light.intensity = base * .5;
      group.userData.prism.rotation.y += dt * (.2 + s.purple * .4); group.userData.prism.position.y = C.floor + 6 + Math.sin(now * .0012) * .25;
      spireTips.forEach((m, i) => { const a = spireAnchors[i], lit = grapple?.target === a, hooked = grapple?.anchor === a; m.rotation.y += dt * (lit ? 3 : .6); m.material.emissiveIntensity += ((hooked ? 2.2 : lit ? 1.4 : .5) - m.material.emissiveIntensity) * Math.min(1, dt * 10); });
      // Sile.
      const p = s.sile; sile.root.visible = s.pose !== 'hidden' && s.phase !== 'done' && !s.gone; // gone once the vortex has her
      const fleeing = s.pose === 'flee', shrink = fleeing ? Math.max(.04, 1 - Math.max(0, s.flee - .62) / .38) : 1; // full size until the black takes her
      sile.root.position.set(p.x, p.y, p.z); sile.root.rotation.y = p.yaw; sile.root.scale.setScalar(shrink);
      sile.root.rotation.x = s.pose === 'fly' || s.pose === 'rise' ? .35 : s.pose === 'crash' ? -.5 : 0;
      playSile(s.pose);
      if (s.phase === 'ending') sile.setExpression(s.pose === 'flee' ? 'surprised' : 'sad', .3); // sad at the last words, scared as it pulls her in
      sile.update(dt, { look: s.pose === 'fly' ? null : tmp.set(player.position.x, player.position.y, player.position.z), talking: s.pose === 'talk' });
      chest.set(p.x, p.y + 1.15 * shrink, p.z);
      aura.position.copy(chest); aura.visible = sile.root.visible; aura.scale.setScalar(shrink * (1 + .06 * Math.sin(now * .006))); aura.material.opacity = s.pose === 'talk' ? 0 : s.inReach ? .2 + .08 * Math.sin(now * .025) : s.chaos ? .16 : .08; if (s.inReach) aura.scale.multiplyScalar(1.15);
      shieldMesh.visible = sile.root.visible && s.shield && s.phase !== 'intro'; shieldMesh.position.copy(chest); shieldMesh.rotation.y += dt * .8;
      shieldMesh.material.opacity = s.phase === 'invert' ? .45 : .16; shieldMesh.scale.setScalar(s.phase === 'invert' ? 1.25 : 1);
      // Scythe: rests diagonal, rears back in the windup, then cuts a wide arc.
      const a = s.attack, sweepK = a?.kind === 'sweep' ? (a.stage === 'windup' ? a.progress : 1) : 0;
      scythe.rotation.set(a?.kind === 'sweep' && a.stage === 'windup' ? -1.1 * sweepK : .35, a?.kind === 'sweep' && a.stage !== 'windup' ? -1.6 : 1.2 * sweepK, a?.kind === 'sweep' && a.stage !== 'windup' ? -1.45 : -.25);
      scythe.visible = s.pose !== 'kneel';
      sweepMesh.visible = a?.kind === 'sweep'; sweepMesh.position.set(p.x, C.floor + .05, p.z); sweepMesh.rotation.y = a?.yaw ?? 0;
      sweepMesh.material.opacity = a?.stage === 'windup' ? .12 + .45 * a.progress * (.75 + .25 * Math.sin(now * .03)) : .85;
      darts.forEach((m, i) => { const d = s.darts[i]; m.visible = Boolean(d); if (d) { m.position.set(d.x, d.y, d.z); m.lookAt(player.position); } });
      shardViews.forEach((v, i) => {
        const sh = s.shards[i], show = Boolean(sh); v.ring.visible = v.disc.visible = v.shard.visible = show; if (!show) return;
        v.ring.position.set(sh.x, C.floor + .04, sh.z); v.disc.position.copy(v.ring.position); v.disc.scale.setScalar(Math.min(1, sh.k));
        const fall = Math.max(0, (sh.k - .65) / .35); v.shard.visible = sh.k > .65 && sh.k < 1.1; v.shard.position.set(sh.x, C.floor + 1.3 + (1 - fall) * 15, sh.z);
      });
      tetherBeam.set(chest, tmp.set(player.position.x, player.position.y - .6, player.position.z), s.tether ? .6 + .4 * Math.sin(now * .03) : 0);
      inversion.forEach((v, i) => {
        const an = s.anchors[i], lit = s.phase === 'invert' && s.time > 1.2 && s.shield;
        v.red.set(v.at, chest, lit && !an.inverted ? .7 : 0); v.white.set(v.at, chest, lit && an.inverted ? .9 : 0);
        v.ob.material.color.copy(an.inverted ? WHITE_L : CRIMSON_L); v.ob.material.emissive.copy(v.ob.material.color);
        v.fill.scale.setScalar(Math.max(.001, an.inverted ? 1 : an.progress)); v.edge.material.color.copy(an.inverted ? WHITE_L : CRIMSON_L);
      });
      rift.update(s, dt, camera);
      waveRings.forEach((w, i) => { const wave = s.waves[i]; w.visible = Boolean(wave); if (!wave) return; w.position.set(p.x, C.floor + .2, p.z); w.scale.set(wave.r, wave.r, 1); w.material.opacity = .9 * (1 - wave.r / 22); });
      waveCharge.visible = s.waveWindup > 0; if (waveCharge.visible) { waveCharge.position.set(p.x, C.floor + .06, p.z); waveCharge.scale.setScalar(.4 + s.waveWindup * .8); waveCharge.material.opacity = .25 + .5 * s.waveWindup * (.6 + .4 * Math.sin(now * .04)); }
      bursts.update(dt); slash.update(dt, camera); flash.update(dt); if (slash.flash > 0) aura.material.opacity = Math.max(aura.material.opacity, slash.flash * .45);
      hud.update(s);
    },
    /** Cutscene cameras for the intro and the ending. Returns true when it drove the camera. */
    shot(camera, dt, player) {
      if (!fight.cinematic) { haveShot = false; fleeCam = null; fleeCut = false; if (camera.fov !== 54) { camera.fov = 54; camera.updateProjectionMatrix(); } return false; }
      const s = fight.snapshot(), t = s.time, p = s.sile, pp = player.position;
      let pos, look;
      if (s.phase === 'intro') {
        if (t < 3) { pos = tmp.set(C.x + 7, C.floor + 2.6, C.z + 21); look = chest.set(C.x, C.floor + 6, C.z); }
        else if (t < 6) { pos = tmp.set(C.x - 4.5, C.floor + 1.4, C.z + 17); look = chest.set(p.x, p.y + 1.2, p.z); }
        else if (t < 8.6) { pos = tmp.set(pp.x + 1.3, pp.y + .5, pp.z + 2.8); look = chest.set(p.x, p.y + 1.3, p.z); }
        else { const yaw = p.yaw; pos = tmp.set(p.x + Math.sin(yaw) * 2.7 + Math.cos(yaw) * .6, p.y + 1.6, p.z + Math.cos(yaw) * 2.7 - Math.sin(yaw) * .6); look = chest.set(p.x, p.y + 1.45, p.z); }
      } else if (s.pose !== 'flee') { pos = tmp.set(C.x + 7, C.floor + 4.5, C.z + 15); look = chest.set(p.x, p.y + 1.2, p.z); }
      else { // close on her face with the vortex behind her; the camera holds and zooms as she is pulled away
        if (!fleeCam) { const r = s.riftAt, dx = p.x - r.x, dz = p.z - r.z, d = Math.hypot(dx, dz) || 1; fleeCam = new T.Vector3(p.x + dx / d * 1.9 - dz / d * .35, p.y + 1.5, p.z + dz / d * 1.9 + dx / d * .35); } // opposite the vortex: her face, the black behind her
        pos = tmp.copy(fleeCam); look = chest.set(p.x, p.y + 1.45 * Math.max(.3, 1 - Math.max(0, s.flee - .62) / .38), p.z).lerp(s.riftAt, .02 + .35 * s.flee * s.flee); // her face first, then the black she is falling into
      }
      const fov = s.pose === 'flee' ? 54 - 24 * Math.min(1, s.flee * 1.3) : 54;
      if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      const cut = !haveShot || (s.phase === 'intro' && [3, 6, 8.6].some(c => t - dt < c && t >= c)) || (s.pose === 'flee' && !fleeCut && (fleeCut = true));
      if (cut) { camPos.copy(pos); camLook.copy(look); haveShot = true; }
      else { const k = 1 - Math.exp(-3 * dt); camPos.lerp(pos, k); camLook.lerp(look, 1 - Math.exp(-6 * dt)); }
      camera.position.copy(camPos); camera.lookAt(camLook);
      this.applyShake(camera, dt);
      return true;
    },
    applyShake(camera, dt) { if (shake > 0) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake; shake = Math.max(0, shake - dt * .8); } },
  };
}
const F_RADIUS = 2.6; // matches SILE_FIGHT.invert.radius

// The vortex shutting: a white-violet sphere of light and a light burst that swell and fade in under half a second.
function createFlash(group) {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf2e8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const light = new THREE.PointLight(0xd9c2ff, 0, 60); ball.visible = false; group.add(ball, light);
  let t = 1;
  return {
    fire(at) { t = 0; ball.position.set(at.x, at.y, at.z); light.position.copy(ball.position); },
    update(dt) {
      t += dt; const k = Math.min(1, t / .45); ball.visible = k < 1;
      ball.scale.setScalar(.5 + 7 * Math.sqrt(k)); ball.material.opacity = (1 - k) ** 2; light.intensity = k < 1 ? 9 * (1 - k) : 0;
    },
  };
}

// Sile's escape: the Hollow Gate vortex from Spade's sky (rendering/sky.js), hung in the air as a disc that
// always faces the camera. It spins up first; then, as it turns, its black eye opens wider and wider
// until a pitch-black hole hangs over the forecourt.
function createPortal(group) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uPhase: { value: 0 }, uOpen: { value: 0 }, uShow: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uPhase, uOpen, uShow; varying vec2 vUv;
      ${RIFT_VORTEX_GLSL}
      void main() {
        vec2 p = (vUv - 0.5) * 2.0 * 0.3;                       // the vortex rim (0.26) sits just inside the disc
        float r = length(p) / 0.26;
        vec4 v = riftVortex(p, uPhase, uOpen);
        float eye = v.a;
        // The deeper it opens, the more the spiral itself drains to black from the centre outward.
        float drain = min(0.92, uOpen * 0.42 * (1.0 - smoothstep(0.25, 1.0, r)));
        vec3 col = v.rgb * (1.0 - drain);
        float glow = clamp(max(v.r, max(v.g, v.b)), 0.0, 1.0);
        float edge = 1.0 - smoothstep(0.82, 1.12, r);
        float alpha = clamp(max(eye, max(glow, drain)) * edge, 0.0, 1.0) * uShow;
        gl_FragColor = vec4(mix(col, vec3(0.0), eye), alpha);   // the eye is pitch black
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), material); mesh.visible = false; mesh.renderOrder = 4; group.add(mesh);
  let phase = 0;
  return {
    update(s, dt, camera) {
      mesh.visible = s.rift > 0; if (!mesh.visible) return;
      phase += dt * (1.2 + s.rift * 2.5 + s.riftOpen * 2 + s.closing * 14);  // spins up as it opens, whirls as it collapses
      material.uniforms.uPhase.value = phase; material.uniforms.uOpen.value = s.riftOpen * 2.6; material.uniforms.uShow.value = s.rift; // open past the sky's eye (1): the hole keeps widening
      mesh.position.set(s.riftAt.x, s.riftAt.y, s.riftAt.z); mesh.scale.setScalar(s.closing > 0 ? Math.max(.02, s.rift) : .35 + .65 * s.rift); mesh.lookAt(camera.position);
    },
  };
}

// The air strike's hit: a crescent slash cut across Sile (diagonal, facing the camera) and a
// shockwave ring, both growing and fading in about a third of a second.
function createSlash(group) {
  const T = THREE, add = color => new T.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
  const arc = new T.Mesh(new T.RingGeometry(1.5, 2.3, 40, 1, -.4, Math.PI * .95), add(0xc9a8ff));
  const core = new T.Mesh(new T.RingGeometry(1.75, 2.0, 40, 1, -.4, Math.PI * .95), add(0xffffff));
  const ring = new T.Mesh(new T.TorusGeometry(1, .07, 6, 40), add(0xffffff));
  arc.add(core); group.add(arc, ring); arc.visible = ring.visible = false;
  let t = 1, tilt = 0; const where = new T.Vector3(), from = new T.Vector3();
  return {
    flash: 0,
    spawn(at, player, chaos) {
      where.copy(at); from.set(player.x, player.y, player.z); t = 0; tilt = (Math.random() - .5) * .8 + .7;
      arc.material.color.set(chaos ? 0xff4a5e : 0xc9a8ff).convertSRGBToLinear();
    },
    update(dt, camera) {
      t += dt; const k = Math.min(1, t / .45); this.flash = Math.max(0, 1 - t / .2);
      arc.visible = ring.visible = k < 1; if (k >= 1) return;
      arc.position.copy(where); arc.lookAt(camera.position); arc.rotateZ(tilt + k * .9); arc.scale.setScalar(.7 + k * .8);
      arc.material.opacity = (1 - k) * .95; core.material.opacity = (1 - k * 1.2);
      ring.position.copy(where); ring.lookAt(from); ring.scale.setScalar(.4 + k * 3.2); ring.material.opacity = (1 - k) * .7;
    },
  };
}

// Pooled spark bursts.
function createBursts(group, count = 96) {
  const positions = new Float32Array(count * 3), geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xffffff, size: .12, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geometry, material); points.frustumCulled = false; group.add(points);
  const sparks = Array.from({ length: count }, () => ({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), life: 0 })); let next = 0;
  return {
    at(where, color, lift = 0, n = 12) {
      material.color.set(color).convertSRGBToLinear();
      for (let i = 0; i < n; i++) { const s = sparks[next = (next + 1) % count]; s.p.set(where.x, where.y + lift, where.z); s.v.set((Math.random() - .5) * 6, Math.random() * 5 + 1, (Math.random() - .5) * 6); s.life = .4 + Math.random() * .25; }
    },
    update(dt) {
      sparks.forEach((s, i) => { if (s.life > 0) { s.life -= dt; s.v.y -= 12 * dt; s.p.addScaledVector(s.v, dt); } else s.p.y = -99; positions.set([s.p.x, s.p.y, s.p.z], i * 3); });
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

// The fight HUD in the lab page: Sile's health, yours, charge pips, Calm/Chaos, hint and subtitles.
export function createArenaHud(doc = document) {
  const $ = id => doc.getElementById(id);
  const root = $('arenaHud'), boss = $('bossHp'), you = $('youHp'), pips = [...doc.querySelectorAll('#chargePips b')], mode = $('chaosState'), hint = $('fightHint'), sub = $('subtitle');
  const veil = $('chaosVeil');
  return {
    toast: null,
    flash() { const f = $('arenaFlash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); },
    show(on) { root.hidden = !on; doc.body.classList.toggle('arena', on); veil.classList.remove('on'); if (!on) sub.hidden = true; },
    update(s) {
      root.classList.toggle('cinematic', !s.fighting);
      boss.style.width = `${100 * s.hp / s.maxHp}%`; you.style.width = `${s.playerHp}%`;
      pips.forEach((b, i) => b.classList.toggle('on', i < s.charge));
      mode.textContent = s.chaos ? 'CHAOS · G to calm' : s.charge ? 'CALM · G for Chaos' : 'CALM · defend to charge';
      mode.classList.toggle('chaos', s.chaos); veil.classList.toggle('on', s.chaos);
      hint.textContent = s.hint;
      sub.hidden = !s.subtitle; if (s.subtitle) { sub.firstElementChild.textContent = s.subtitle.who; sub.lastElementChild.textContent = s.subtitle.text; }
    },
  };
}
