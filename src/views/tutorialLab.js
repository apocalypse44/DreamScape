// The Tutorial Lab: a light page that teaches sword, spells, the hook and Chaos with guided lessons, then lets the
// player practise freely. Opened in an <iframe> over the home screen (and before each boss), so the game keeps loading
// underneath. Built from the movement lab's modules; no boss arenas, gallery or showcase, so it loads fast.
import { createGameState } from '../models/state.js';
import { createFixedStepper } from '../models/fixedStep.js';
import { createPlayerController, createSurfaceAt } from '../controllers/player.js';
import { createCameraController } from '../controllers/camera.js';
import { createTravelerCharacter } from '../rendering/travelerCharacter.js';
import { createTravelerCombat } from '../models/travelerCombat.js';
import { createTrainingYard } from './trainingYard.js';
import { createGrapple } from '../models/grapple.js';
import { createSpellBar } from './spellBar.js';
import { createSpellPracticeArea } from './spellPracticeArea.js';
import { spellForKey } from '../models/grimoireSpells.js';
import { createSigilBlade, createSigilSheath } from '../rendering/sigilBlade.js';
import { createLessons, LESSONS } from '../models/lessons.js';

const $ = id => document.getElementById(id);
const canvas = $('labCanvas'), status = $('labStatus'), toastBox = $('labToast');
let toastTimer = 0;
function toast(text) { toastBox.textContent = text; toastBox.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastBox.classList.remove('show'), 900); }
// Leave: tell the home screen (it removes the overlay); opened on its own, go back to the game page.
function leave() { if (window.parent !== window) window.parent.postMessage({ type: 'tutorial-lab:close' }, location.origin); else location.href = 'index.html'; }

async function start() {
  const T = THREE, scene = new T.Scene(); scene.background = new T.Color(0xdce7de); scene.fog = new T.Fog(0xdce7de, 30, 105);
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true;
  const camera = new T.PerspectiveCamera(54, innerWidth / innerHeight, .1, 130);
  scene.add(new T.HemisphereLight(0xe9f0df, 0x7f907b, .95));
  const sun = new T.DirectionalLight(0xffebc8, 1.4); sun.position.set(-14, 25, 12); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -40; sun.shadow.camera.right = sun.shadow.camera.top = 40; scene.add(sun);
  const { state, keys, pointerButtons, player } = createGameState(); state.pitch = -.12;
  const surfaces = [], colliders = [], obstacles = new T.Group(); scene.add(obstacles);
  const inChasm = (x, z) => x < -9 && x > -48 && z > 22 && z < 42; // the sky crossing: only the hook gets you over
  const ground = (x, z) => inChasm(x, z) ? -12 : 0;
  const groundGeometry = new T.PlaneGeometry(100, 100, 100, 100); groundGeometry.rotateX(-Math.PI / 2);
  const gp = groundGeometry.attributes.position; for (let i = 0; i < gp.count; i++) gp.setY(i, ground(gp.getX(i), gp.getZ(i))); groundGeometry.computeVertexNormals();
  const floorMesh = new T.Mesh(groundGeometry, new T.MeshStandardMaterial({ color: 0x91ae83, roughness: 1 })); floorMesh.receiveShadow = true; scene.add(floorMesh);
  const stone = new T.MeshStandardMaterial({ color: 0xc8c8b1, roughness: .95 });
  function block(x, z, w, d, top, bottom = 0) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, top - bottom, d), stone); mesh.position.set(x, (top + bottom) / 2, z); mesh.castShadow = mesh.receiveShadow = true; obstacles.add(mesh);
    const platform = { x, z, width: w, depth: d, top, bottom, solid: true }; surfaces.push(platform); return platform;
  }
  function sign(text, x, z, yaw = 0) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#f5efda'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#3f6454'; g.font = '24px Georgia'; g.textAlign = 'center'; g.fillText(text, 256, 57);
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding;
    const mesh = new T.Mesh(new T.PlaneGeometry(3.8, .7), new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide })); mesh.position.set(x, 1.7, z); mesh.rotation.y = yaw; scene.add(mesh);
  }
  // The sky crossing: islands over a chasm, crystals overhead. Hold Q near one to swing.
  const crossing = [block(-27, 30, 6, 6, 4, 1), block(-43, 34, 7, 7, 6, 2.5)];
  const anchorPoints = [{ x: -16, y: 12, z: 32 }, { x: -24, y: 14, z: 27 }, { x: -33, y: 16, z: 36 }, { x: -40, y: 19, z: 30 }];
  const crystalMat = new T.MeshStandardMaterial({ color: 0x7fe3ee, emissive: 0x2bb8c9, emissiveIntensity: .6, roughness: .3, flatShading: true });
  const anchorMeshes = anchorPoints.map(a => { const m = new T.Mesh(new T.OctahedronGeometry(.45, 0), crystalMat.clone()); m.scale.y = 1.6; m.position.set(a.x, a.y, a.z); scene.add(m); return m; });
  let crossingCheckpoint = { x: -7, z: 32, top: 0 };
  sign('THE SKY CROSSING · HOLD Q', -6, 28, Math.PI / 2); sign('TRAINING YARD · LMB RMB F', 0, -8); sign('RUNE CIRCLE · LMB RMB E Q', -30, -16.5);
  const lessons = createLessons();
  const surfaceAt = createSurfaceAt(surfaces, ground), stepper = createFixedStepper();
  let combat = null, combatState = null, hitstop = 0, shake = 0; const pressed = { attack: false, dodge: false };
  const yard = createTrainingYard({ scene, ground, colliders, onImpact: heavy => { hitstop = heavy ? .11 : .065; shake = Math.max(shake, heavy ? .16 : .08); },
    onDefend: result => note(result === 'blocked' ? 'block' : result === 'dodged' ? 'roll' : '') });
  const grapple = createGrapple({ anchors: anchorPoints });
  const movement = createPlayerController({ state, keys, player, chunks: new Map(), terrainHeight: ground, staticColliders: colliders, platforms: surfaces,
    locomotion: { walkSpeed: 4.2, sprintSpeed: 7.8, crouchSpeed: 2, smooth: true, variableJump: true, drive: () => combatState?.drive || grapple.drive },
    courseRecovery: p => inChasm(p.position.x, p.position.z) && p.position.y < -2 ? (grapple.reset(), crossingCheckpoint) : null });
  const practice = createSpellPracticeArea({ scene, center: { x: -30, z: -30 }, floor: 0, toast,
    onEvent: e => { if (e.type === 'cast') note('cast:' + e.rune); else if (['blocked', 'wallStop', 'spearShattered'].includes(e.type)) note('catch'); } });
  let practiceOn = false, pendingRune = null, castPose = 0, barOn = false; const castPoint = new T.Vector3(), aimDir = new T.Vector3();
  const spellBar = createSpellBar();
  // The cast's aim: the practice target nearest the centre of view, else straight ahead.
  function takeCast() {
    if (!pendingRune) return null; const rune = pendingRune; pendingRune = null;
    const eye = player.position; camera.getWorldDirection(aimDir);
    let best = null, bestOff = .55;
    for (const t of practice.targets || []) { const d = new T.Vector3(t.x - eye.x, t.y - eye.y + .6, t.z - eye.z), len = d.length(); if (len < .5 || len > 30) continue; const off = d.divideScalar(len).angleTo(aimDir); if (off < bestOff) { bestOff = off; best = t; } }
    const chest = { x: eye.x, y: eye.y - .6, z: eye.z }, aim = best ? { x: best.x, y: best.y, z: best.z } : { x: chest.x + aimDir.x * 25, y: chest.y + aimDir.y * 25, z: chest.z + aimDir.z * 25 };
    const dx = aim.x - chest.x, dz = aim.z - chest.z, d = Math.hypot(dx, dz) || 1, from = { x: chest.x + dx / d * .7, y: chest.y + .15, z: chest.z + dz / d * .7 };
    const facing = best && rune !== 'earth' ? Math.atan2(aim.x - from.x, aim.z - from.z) : Math.atan2(aimDir.x, aimDir.z);
    castPose = .45; castPoint.set(aim.x, aim.y, aim.z); spellBar.flash(rune); return { rune, from, aim, facing };
  }
  // Lessons: the list, its progress, and the event hook every part of the lab reports to.
  const list = $('lessonList');
  list.innerHTML = LESSONS.map(s => `<li data-id="${s.id}">${s.text} <kbd>${s.keys}</kbd></li>`).join('');
  function paint() {
    [...list.children].forEach((li, i) => { li.classList.toggle('done', i < lessons.index); li.classList.toggle('now', i === lessons.index); });
    const step = lessons.current;
    status.textContent = step ? (step.need > 1 ? `${lessons.count(step.id)} / ${step.need}` : 'Your next step is in bold.') : 'All done. Practise as long as you like, then leave.';
    $('skip').disabled = lessons.done;
  }
  function note(event) { if (event && lessons.record(event)) toast(lessons.done ? 'TUTORIAL COMPLETE' : 'STEP COMPLETE'); paint(); }
  $('skip').onclick = () => { lessons.skip(); paint(); };
  const previous = new T.Vector3(), renderPosition = new T.Vector3(), renderPlayer = Object.create(player); renderPlayer.position = renderPosition;
  const view = createCameraController({ camera, state, player: renderPlayer, chunks: new Map(), terrainHeight: ground, staticObstacles: [obstacles] });
  const avatar = createTravelerCharacter({ scene, state, player: renderPlayer, surfaceAt, status: { textContent: '' }, walkSpeed: 4.2 });
  function release() { keys.clear(); pointerButtons.clear(); player.velocity.x = player.velocity.z = 0; player.jumpBuffer = 0; }
  movement.teleport({ x: 0, z: 4, top: 0, yaw: 0 }); previous.copy(player.position); renderPosition.copy(player.position);
  document.addEventListener('pointerlockchange', () => { state.locked = document.pointerLockElement === canvas; document.body.classList.toggle('playing', state.locked); release(); });
  addEventListener('blur', release);
  const lock = () => { if (avatar.loaded && !state.locked) canvas.requestPointerLock(); };
  $('begin').onclick = lock; canvas.onclick = lock; $('closeLab').onclick = leave;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', e => { if (!state.locked) return; pointerButtons.add(e.button); if (e.button === 0 && !practiceOn) pressed.attack = true; if (practiceOn && e.button === 0) pendingRune = 'flame'; if (practiceOn && e.button === 2) pendingRune = 'tide'; }); // a quick tap casts too (holding LMB repeats)
  addEventListener('mouseup', e => pointerButtons.delete(e.button));
  document.addEventListener('mousemove', e => { if (state.locked) { state.yaw -= e.movementX * .0022; state.pitch = T.MathUtils.clamp(state.pitch - e.movementY * .002, -.85, .6); } });
  addEventListener('keydown', e => {
    if (e.code === 'Escape' && !state.locked) { leave(); return; }
    if (!state.locked) return; keys.add(e.code);
    if (e.code === 'Space' && !e.repeat) player.jumpBuffer = .15;
    if (e.code === 'KeyF' && !e.repeat) pressed.dodge = true;
    if (e.code === 'KeyG' && !e.repeat) note('chaos');
    if (practiceOn && !e.repeat && spellForKey(e.code)) pendingRune = spellForKey(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }; addEventListener('resize', resize); resize();
  function combatInput() {
    const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), sd = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const len = Math.hypot(f, sd) || 1, sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
    const input = { attack: pressed.attack && !practiceOn, dodge: pressed.dodge, sheathe: false, block: !practiceOn && pointerButtons.has(2),
      moveX: state.locked ? (-sin * f + cos * sd) / len : 0, moveZ: state.locked ? (-cos * f - sin * sd) / len : 0, sprinting: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    pressed.attack = pressed.dodge = false; return input;
  }
  window.tutorialLab = { lessons, state, player, yard, practice, grapple, note, get loaded() { return Boolean(combat); }, get combatState() { return combatState; } }; // for tests
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame); const dt = Math.min((now - last) / 1000, .1); last = now;
    const simDt = hitstop > 0 ? 0 : dt; hitstop = Math.max(0, hitstop - dt);
    const alpha = stepper.advance(simDt, step => {
      previous.copy(player.position);
      const input = combatInput();
      const hook = grapple.update(step, { hold: state.locked && keys.has('KeyQ') && !practiceOn, jump: player.jumpBuffer > 0, moveX: input.moveX, moveZ: input.moveZ, look: { x: -Math.sin(state.yaw), z: -Math.cos(state.yaw) } }, player, surfaceAt);
      if (grapple.phase === 'swing') note('hook');
      if (combat) combatState = combat.update(step, input, { grounded: player.grounded, speed: Math.hypot(player.velocity.x, player.velocity.z), yaw: state.yaw, heading: avatar.heading, position: player.position, targets: yard.targets });
      if (!hook.owns) movement.update(step);
      const here = crossing.find(c => player.grounded && Math.abs(player.position.x - c.x) < c.width / 2 && Math.abs(player.position.z - c.z) < c.depth / 2); if (here) crossingCheckpoint = here;
      if (combat) { const before = yard.hits; yard.step(step, { player, combat, combatState, toast }); if (yard.hits > before) note('swing'); }
      practiceOn = practice.contains(player.position);
      if (practiceOn && state.locked) practice.step(step, { player: player.position, feet: player.position.y - 2.05, grounded: player.grounded, invulnerable: Boolean(combatState?.invulnerable),
        cast: takeCast(), hurt: (from, o) => combat ? combat.hurt(from, player.position, o) : 'hit' });
    });
    renderPosition.lerpVectors(previous, player.position, alpha);
    view.update(dt);
    if (shake > 0) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake; shake = Math.max(0, shake - dt * .9); }
    yard.render(dt); practice.render(dt, now, renderPlayer); castPose = Math.max(0, castPose - dt);
    if (barOn !== practiceOn) { barOn = practiceOn; spellBar.show(practiceOn); }
    if (practiceOn) { const r = practice.runes; spellBar.update(r); if (pointerButtons.has(0) && !r.cooldown.flame && !pendingRune) pendingRune = 'flame'; }
    avatar.update(simDt, camera.position.distanceTo(renderPosition), castPose > 0 ? castPoint : null, practiceOn && combatState ? { ...combatState, drawn: false } : combatState,
      { anchor: grapple.anchor, reach: grapple.reach, phase: grapple.phase, flip: grapple.flip });
    anchorMeshes.forEach((m, i) => { const lit = anchorPoints[i] === grapple.target; m.rotation.y += dt * (lit ? 3 : .6); m.material.emissiveIntensity = lit ? 1.6 : .5; });
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame); await avatar.ready;
  if (!avatar.loaded) throw new Error('The traveller asset did not load.');
  avatar.setSwordModel(createSigilBlade()); avatar.setSheath(createSigilSheath());
  combat = createTravelerCombat({ rootMotion: avatar.rootMotion, scale: avatar.modelScale });
  $('begin').disabled = false; paint();
}
start().catch(error => { status.textContent = `The lab could not start: ${error.message}`; console.error(error); });
