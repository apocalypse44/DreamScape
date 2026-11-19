import { SPELLS, PAGES, SPELL_INK } from '../models/grimoireSpells.js';
import { createSigil, sigilShapes, SIGILS } from '../rendering/sigil.js';

// The grimoire receiving a page (GRIMOIRE_SPELLS_PLAN.md), as a short cinematic in front of the traveller:
// the book appears closed, the page's source (a sigil, or the Ember Hound's breath) flies into its socket on the
// cover, the cover swings open, pages flutter, and the spell's rune is inked onto the new page stroke by stroke,
// then glows. A caption names the spell and the giver speaks one line. The book stays open until X closes it.
// Turning pages show the pages already written (opening Tide turns past Gale, Flame Lance and Stone Wall).
// Everything is procedural: boxes, planes and canvas-drawn parchment.
export const REVEAL_T = { appear: .9, source: .3, fly: [1.2, 2.3], open: [2.6, 3.6], turn: 3.7, gap: .55, leaf: .75, ink: 2, close: .8, shrink: .7 };
// The seconds of one play: the leaves turned before the new page, then its ink. close stays far off until X.
function timeline(leaves) {
  const R = REVEAL_T, landed = R.turn + (leaves - 1) * R.gap + R.leaf, ink = [landed + .2, landed + .2 + R.ink];
  return { ...R, leaves, landed, ink, caption: ink[1] - .2, line: ink[1] + .4, close: [Infinity, Infinity], end: Infinity };
}
const OPEN_TILT = .14; // each open half leans this far toward the reader
const W = .5, H = .68, SOCKET = { lantern: [0, .14], root: [-.12, .02], tide: [.12, .02], prism: [0, -.1] }; // page size; socket spots on the cover
const ease = k => k * k * (3 - 2 * k), clamp = k => Math.min(1, Math.max(0, k)), span = (t, [a, b]) => a === Infinity ? 0 : clamp((t - a) / (b - a)); // Infinity: not yet (the close waits for X)
const backOut = k => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;

// The grimoire itself, shared by the page reveal and the sigil-blade's forging (views/gatehallArena.js). Two halves
// hinged at the spine; local +z faces the reader. setOpen(k, tilt) swings the front cover from closed (0) to open (1),
// each half leaning `tilt` toward the reader (0 = lying flat). paint(i) shows page i's spread fully written.
// setVoid(k, dt) turns both pages into the Hollow Gate's black void (0 = parchment, 1 = a swirling black hole): the
// grimoire's dark side, which the story will grow into the traveller's dark power (FOURFOLD_ACCORD_STORY.md).
export function createGrimoireBook() {
  const T = THREE, book = new T.Group();
  const lin = hex => new T.Color(hex).convertSRGBToLinear(); // the lab renders with sRGB output
  const leather = new T.MeshStandardMaterial({ color: lin(0x3d1622), roughness: .7, metalness: .1 }), block = new T.MeshStandardMaterial({ color: lin(0xe9dcbc), roughness: .95 });
  const gold = new T.MeshStandardMaterial({ color: lin(0xc9a24a), roughness: .35, metalness: .8 });
  const right = new T.Group(), left = new T.Group(); book.add(right, left);
  const voidMat = createVoidMaterial(), voids = [];
  const half = (g, sign) => {
    const cover = new T.Mesh(new T.BoxGeometry(W + .03, H + .04, .025), leather); cover.position.set(sign * W / 2, 0, -.04); g.add(cover);
    const pages = new T.Mesh(new T.BoxGeometry(W, H, .04), block); pages.position.set(sign * W / 2, 0, -.012); g.add(pages);
    const face = makePage(); face.mesh.position.set(sign * W / 2, 0, .0085); g.add(face.mesh);
    const v = new T.Mesh(new T.PlaneGeometry(W, H), voidMat); v.position.set(sign * W / 2, 0, .0095); v.visible = false; g.add(v); voids.push(v);
    return face;
  };
  const rightPage = half(right, 1), leftPage = half(left, -1);
  const spine = new T.Mesh(new T.CylinderGeometry(.03, .03, H + .04, 10, 1, false, Math.PI / 2, Math.PI), leather); spine.position.z = -.04; book.add(spine);
  // The front cover's tooled face, and its four sigil sockets around a ring (the cover is the left half's outside).
  const coverArt = new T.Group(); coverArt.position.set(-W / 2, 0, -.0535); coverArt.rotation.y = Math.PI; left.add(coverArt);
  coverArt.add(new T.Mesh(new T.PlaneGeometry(W + .03, H + .04), new T.MeshStandardMaterial({ map: coverTexture(), roughness: .6, metalness: .2 })));
  const ring = new T.Mesh(new T.TorusGeometry(.17, .008, 8, 64), gold); ring.position.z = .004; coverArt.add(ring);
  const sockets = {};
  for (const kind of Object.keys(SOCKET)) {
    const geo = new T.ExtrudeGeometry(sigilShapes(kind), { depth: .2, bevelEnabled: false, curveSegments: 10 }); geo.computeBoundingBox(); geo.center();
    const k = .085 / (geo.boundingBox.max.y - geo.boundingBox.min.y); geo.scale(k, k, .04);
    const mat = new T.MeshStandardMaterial({ color: lin(0x2a1a12), emissive: lin(SIGILS[kind].glow), emissiveIntensity: 0, roughness: .5, metalness: .6 });
    const m = new T.Mesh(geo, mat); m.position.set(SOCKET[kind][0], SOCKET[kind][1], .008); coverArt.add(m); sockets[kind] = m;
    const rim = new T.Mesh(new T.TorusGeometry(.062, .006, 6, 40), gold); rim.position.copy(m.position); coverArt.add(rim);
  }
  return {
    group: book, left, right, leftPage, rightPage, sockets, coverArt,
    setOpen(k, tilt = OPEN_TILT) { left.rotation.y = Math.PI - (Math.PI - tilt) * k; right.rotation.y = -tilt * k; },
    paint(i) { leftPage.draw(g => drawLeft(g, PAGES[i], 1)); rightPage.draw(g => drawRight(g, PAGES[i], 1, 0)); },
    setVoid(k, dt = 0) { voidMat.uniforms.uShow.value = k; voidMat.uniforms.uTime.value += dt; voids.forEach(v => { v.visible = k > 0; }); },
  };
}
// The void on a page: solid black that spreads out from the middle of each page until the whole page is black,
// with a faint violet glow only on the spreading edge.
function createVoidMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uShow: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uTime, uShow; varying vec2 vUv;
      void main() {
        float r = length((vUv - 0.5) * vec2(1.0, 1.36));
        float reach = uShow * 0.9;                                   // 0.9 covers the corners
        float inside = 1.0 - smoothstep(reach - 0.04, reach, r);
        float edge = smoothstep(reach - 0.1, reach - 0.02, r) * inside * (1.0 - step(0.999, uShow));
        gl_FragColor = vec4(vec3(0.35, 0.1, 0.7) * edge, inside);
        #include <encodings_fragment>
      }`,
  });
}

export function createGrimoireReveal({ scene, doc = document }) {
  const T = THREE, root = new T.Group(); root.visible = false; scene.add(root);
  const fx = new T.Group(); scene.add(fx); // world-space effects: motes, the seating pulse, the flying source
  const bookApi = createGrimoireBook(), { group: book, right, leftPage, rightPage, sockets, coverArt } = bookApi; root.add(book);
  // Turning leaves: each has a front (a right-hand page) and a back (the next spread's left-hand page).
  // One bendable sheet per leaf (hinged at the spine): its front face and its back face share the geometry, so the
  // two printed sides stay glued together as the page curls over.
  const leaves = [0, 1, 2, 3].map(() => {
    const geo = new T.PlaneGeometry(W, H, 24, 1); geo.translate(W / 2, 0, 0);
    const g = new T.Group(), front = makePage(geo, T.FrontSide), back = makePage(geo, T.BackSide, true);
    g.add(front.mesh, back.mesh); g.visible = false; book.add(g);
    return { g, front, back, geo, baseX: Float32Array.from({ length: geo.attributes.position.count }, (_, i) => geo.attributes.position.getX(i)) };
  });
  // Curl: the free edge lags behind the turn, bending the sheet into an arc that straightens as it lands.
  function bend(leaf, f) {
    const pos = leaf.geo.attributes.position, c = Math.sin(f * Math.PI) * .16;
    for (let i = 0; i < pos.count; i++) { const u = leaf.baseX[i] / W; pos.setZ(i, -c * u * u); }
    pos.needsUpdate = true;
  }
  // The finished rune's bloom: an additive glow floating just above the right page.
  const bloom = new T.Mesh(new T.PlaneGeometry(W * .95, W * .95), new T.MeshBasicMaterial({ map: glowDot(), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })); bloom.position.set(W / 2, .1, .02); right.add(bloom);
  const light = new T.PointLight(0xffd9a0, 0, 4); light.position.set(0, 0, .5); book.add(light);
  // Motes: light streaming behind the flying source, and sparkles when it seats or the rune finishes.
  const moteCount = 90, motePos = new Float32Array(moteCount * 3), motes = Array.from({ length: moteCount }, () => ({ p: new T.Vector3(0, -99, 0), v: new T.Vector3(), life: 0 }));
  const moteGeo = new T.BufferGeometry(); moteGeo.setAttribute('position', new T.BufferAttribute(motePos, 3));
  const moteMat = new T.PointsMaterial({ size: .035, map: glowDot(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xffffff });
  const moteCloud = new T.Points(moteGeo, moteMat); moteCloud.frustumCulled = false; fx.add(moteCloud); let nextMote = 0;
  const spray = (at, n, speed, life = .8) => { for (let i = 0; i < n; i++) { const s = motes[nextMote = (nextMote + 1) % moteCount]; s.p.copy(at); s.v.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize().multiplyScalar(speed * (.4 + Math.random())); s.life = life * (.6 + Math.random() * .6); } };
  const pulse = new T.Sprite(new T.SpriteMaterial({ map: glowDot(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 })); fx.add(pulse);
  // The source: an ornate sigil, or an ember orb for the first page.
  const sources = Object.fromEntries(Object.keys(SOCKET).map(k => [k, createSigil(k, .34, { ornate: true })]));
  const ember = new T.Sprite(new T.SpriteMaterial({ map: glowDot(), color: 0xff8a3a, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); ember.scale.setScalar(.35);
  sources.ember = new T.Group(); sources.ember.add(ember); sources.ember.userData.tick = () => ember.scale.setScalar(.3 + .06 * Math.sin(performance.now() * .02));
  for (const s of Object.values(sources)) { s.visible = false; fx.add(s); }
  // Caption and the giver's line, over the canvas.
  // The veil darkens the screen's edges; the banner names the spell at the top; the giver speaks at the bottom.
  const caption = doc.createElement('div'); caption.id = 'grimoireCaption'; caption.hidden = true;
  caption.innerHTML = '<div class="banner"><span class="eyebrow"></span><strong></strong><em></em></div><p class="speech"><b></b><span></span></p><p class="closeHint"><kbd>X</kbd> CLOSE THE GRIMOIRE</p>'; doc.body.append(caption);
  const veil = doc.createElement('div'); veil.id = 'grimoireVeil'; doc.body.append(veil);

  let page = null, index = 0, tl = timeline(2), spreads = [], drawn = { left: null, right: null }, owned = new Set(), t = -1, from = new T.Vector3(), seatAt = new T.Vector3(), cam = { pos: new T.Vector3(), look: new T.Vector3(), have: false };
  const tmp = new T.Vector3(), forward = new T.Vector3(), side = new T.Vector3();

  function setCaption(show, speech) {
    caption.hidden = !show; if (!show) return;
    const spell = SPELLS.find(s => s.id === page.spell);
    caption.querySelector('.eyebrow').textContent = `PAGE ${page.numeral} · WRITTEN BY ${page.from}`;
    caption.querySelector('strong').textContent = spell ? spell.name : page.name;
    caption.querySelector('em').textContent = spell ? `${spell.input} · ${spell.about}` : page.about;
    caption.style.setProperty('--glow', spell ? SPELL_INK[spell.id][1] : '#fff0b8');
    caption.classList.toggle('speaking', speech);
    caption.querySelector('.speech b').textContent = page.speaker; caption.querySelector('.speech span').textContent = page.line;
  }

  // What a spread shows: an earlier page fully written, a blank, or the new page (drawn live while it inks).
  const isNew = s => s === index;
  const paintRight = (face, s) => face.draw(g => { if (s !== 'blank' && !isNew(s)) drawRight(g, PAGES[s], 1, 0); });
  const paintLeft = (face, s) => face.draw(g => { if (s !== 'blank' && !isNew(s)) drawLeft(g, PAGES[s], 1); });

  return {
    get active() { return t >= 0; },
    get time() { return t; },
    /** True once the page is written and the book waits for X. */
    get waiting() { return t >= tl.line && tl.close[0] === Infinity; },
    /** Where the traveller's hands reach while the book hovers, or null. */
    get handsAt() { return t >= 0 && t < tl.close[0] ? book.getWorldPosition(tmp) : null; },
    /** i: PAGES index. at: the traveller's eye position; yaw: the way they face (camera yaw, 0 = -z). */
    play(i, at, yaw) {
      index = i; page = PAGES[i]; owned = new Set(PAGES.slice(0, i).map(p => p.source)); t = 0; cam.have = false;
      // Opening Tide turns past the three pages before it; the first page turns past two blank leaves.
      spreads = i > 0 ? PAGES.slice(0, i + 1).map((_, j) => j) : ['blank', 'blank', 0];
      tl = timeline(spreads.length - 1); drawn = { left: null, right: null };
      leaves.forEach((leaf, j) => { if (j < tl.leaves) { paintRight(leaf.front, spreads[j]); paintLeft(leaf.back, spreads[j + 1]); } leaf.g.visible = false; });
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)); side.set(Math.cos(yaw), 0, -Math.sin(yaw));
      root.position.set(at.x + forward.x * 1.05, at.y - .45, at.z + forward.z * 1.05); root.rotation.set(0, yaw, 0); // the book faces the traveller
      book.rotation.set(-.22, 0, 0); root.visible = true;
      for (const [kind, m] of Object.entries(sockets)) m.material.emissiveIntensity = owned.has(kind) ? 1.4 : 0;
      for (const s of Object.values(sources)) s.visible = false;
      setCaption(false);
    },
    /** Developer: jump to a moment (seconds) to inspect it. */
    seek(at) { if (t >= 0) t = at; },
    /** Enter: jump to the written page (the book then waits for X). */
    skip() { if (t >= 0 && t < tl.line) t = tl.line - 1e-3; },
    /** X: close the book (any time it is open). */
    close() { if (t >= 0 && tl.close[0] === Infinity) { tl.close = [t, t + REVEAL_T.close]; tl.end = t + REVEAL_T.close + REVEAL_T.shrink; setCaption(false); } },
    stop() { t = -1; root.visible = false; veil.style.opacity = '0'; doc.body.classList.remove('grimoire-playing'); setCaption(false); for (const x of Object.values(sources)) x.visible = false; },
    update(dt) {
      for (let i = 0; i < moteCount; i++) { const s = motes[i]; if (s.life > 0) { s.life -= dt; s.p.addScaledVector(s.v, dt); s.v.multiplyScalar(1 - dt * 1.5); } else s.p.y = -99; motePos.set([s.p.x, s.p.y, s.p.z], i * 3); }
      moteGeo.attributes.position.needsUpdate = true;
      if (t < 0) return;
      const was = t; t += dt; const R = tl, cue = at => was < at && t >= at;
      const glowHex = page.spell ? SPELL_INK[page.spell][1] : '#fff0b8';
      // Appear: the closed book springs up out of a swirl of motes, turning to face you.
      const k = clamp(t / R.appear), show = t < R.close[1] ? backOut(k) : 1 - ease(span(t, [R.close[1], R.end]));
      book.scale.setScalar(Math.max(.001, show)); book.rotation.y = (1 - ease(k)) * 2.4; book.position.y = Math.sin(t * 1.6) * .015 - (1 - show) * .3;
      if (cue(.05)) spray(root.position, 30, .8);
      // The source rises beside the book, then flies in an arc to its socket and seats with a flash.
      const src = sources[page.source], socket = sockets[page.source];
      src.userData.tick?.(dt);
      if (t >= R.source && t < R.fly[1]) {
        src.visible = true; from.copy(root.position).addScaledVector(side, .75).y += .35;
        if (socket) socket.getWorldPosition(seatAt); else coverArt.getWorldPosition(seatAt);
        const f = ease(span(t, R.fly)), lift = Math.sin(f * Math.PI) * .35;
        src.position.lerpVectors(from, seatAt, f).y += lift; src.scale.setScalar(Math.min(1, (t - R.source) / .4) * (1 - f * .72));
        if (f > 0 && Math.random() < .8) spray(src.position, 2, .25, .5);
      } else src.visible = false;
      if (cue(R.fly[1])) {
        spray(seatAt, 40, 1.4); pulse.position.copy(seatAt); pulse.material.color.set(glowHex); if (socket) owned.add(page.source);
      }
      const p = span(t, [R.fly[1], R.fly[1] + .6]); pulse.material.opacity = p > 0 && p < 1 ? (1 - p) : 0; pulse.scale.setScalar(.2 + p * .9);
      for (const [kind, m] of Object.entries(sockets)) { const lit = owned.has(kind); m.material.emissiveIntensity += ((lit ? 1.4 + (kind === page.source ? .8 * Math.sin(t * 5) : 0) : 0) - m.material.emissiveIntensity) * Math.min(1, dt * 6); }
      // The cover swings open toward you (left half from folded over to open), and closes at the end.
      const open = ease(span(t, R.open)) * (1 - ease(span(t, R.close)));
      bookApi.setOpen(open);
      // Leaves turn right to left. The static pages show the spread each leaf uncovers.
      let started = 0, landed = 0;
      leaves.forEach((leaf, j) => {
        if (j >= R.leaves) return;
        const a = R.turn + j * R.gap, f = ease(clamp((t - a) / R.leaf)); if (t >= a) started++; if (f >= 1) landed++;
        // Visible from the frame it starts (covering the same page it lifts off) to the frame before it lands (when
        // the left page already shows its back), so nothing pops. It turns from the right page's angle to the left's.
        leaf.g.visible = t >= a && f < 1; if (!leaf.g.visible) return;
        leaf.g.rotation.y = -OPEN_TILT - (Math.PI - 2 * OPEN_TILT) * f; leaf.g.position.z = .012 + Math.sin(f * Math.PI) * .03; bend(leaf, f);
      });
      const rightShows = spreads[started], leftShows = spreads[landed];
      if (drawn.right !== rightShows) { drawn.right = rightShows; paintRight(rightPage, rightShows); }
      if (drawn.left !== leftShows) { drawn.left = leftShows; paintLeft(leftPage, leftShows); }
      // Ink the new page: the left page fades in its lore, the rune draws itself on the right, then glows.
      if (landed === R.leaves && t >= R.ink[0] - .1 && t < R.close[0] + .1) {
        const inked = span(t, R.ink), glow = clamp((t - R.ink[1]) / .6);
        leftPage.draw(lp => drawLeft(lp, page, clamp((t - R.ink[0]) / 1.2)));
        rightPage.draw(rp => drawRight(rp, page, inked, glow * (.75 + .25 * Math.sin(t * 4))));
        bloom.material.color.set(glowHex); bloom.material.opacity = glow * .55 * (1 - span(t, R.close)); bloom.scale.setScalar(.9 + .1 * Math.sin(t * 3));
        light.color.set(glowHex); light.intensity = (inked * .6 + glow * 1.4) * (1 - span(t, R.close));
        if (Math.random() < inked * (1 - glow) * .7) { rightPage.mesh.getWorldPosition(tmp); tmp.y += (Math.random() - .5) * .3; tmp.addScaledVector(side, (Math.random() - .5) * .3); spray(tmp, 1, .2, .6); }
      } else { light.intensity = 0; bloom.material.opacity = 0; }
      if (cue(R.ink[1])) { rightPage.mesh.getWorldPosition(tmp); spray(tmp, 45, 1.1); }
      if (cue(R.caption)) setCaption(true, false); if (cue(R.line)) setCaption(true, true); caption.classList.toggle('waiting', t >= R.line);
      moteMat.color.set(glowHex);
      veil.style.opacity = String(Math.min(clamp(t / .8), 1 - span(t, R.close))); doc.body.classList.toggle('grimoire-playing', t < R.close[1]);
      if (t >= R.end) { t = -1; root.visible = false; veil.style.opacity = '0'; doc.body.classList.remove('grimoire-playing'); }
    },
    /** The camera while it plays: over the traveller's shoulder, easing in on the open pages. Returns true when it drove it. */
    shot(camera, dt) {
      if (t < 0) return false;
      const near = ease(span(t, [REVEAL_T.open[0], REVEAL_T.open[0] + 1.6])) * (1 - ease(span(t, tl.close)));
      book.getWorldPosition(tmp);
      const back = 2.1 - .95 * near, up = .75 - .4 * near, off = .65 - .45 * near; // over the shoulder, easing in past it
      const pos = new T.Vector3(tmp.x - forward.x * back + side.x * off, tmp.y + up, tmp.z - forward.z * back + side.z * off);
      if (!cam.have) { cam.pos.copy(pos); cam.look.copy(tmp); cam.have = true; }
      cam.pos.lerp(pos, 1 - Math.exp(-3 * dt)); cam.look.lerp(tmp, 1 - Math.exp(-5 * dt));
      camera.position.copy(cam.pos); camera.lookAt(cam.look); return true;
    },
  };
}

// ---- parchment and drawing ----
const PW = 512, PH = 696;
// A printed page face. geometry/side let two faces share one sheet; mirror flips the texture for the back side.
function makePage(geometry = new THREE.PlaneGeometry(W, H), side = THREE.FrontSide, mirror = false) {
  const c = document.createElement('canvas'); c.width = PW; c.height = PH; const g = c.getContext('2d');
  const map = new THREE.CanvasTexture(c); map.encoding = THREE.sRGBEncoding; map.anisotropy = 4;
  if (mirror) { map.repeat.set(-1, 1); map.offset.set(1, 0); }
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map, side }));
  return { mesh, draw(fn) { g.save(); g.drawImage(paper(), 0, 0); fn(g); g.restore(); map.needsUpdate = true; } };
}
let paperCanvas = null;
function paper() {
  if (paperCanvas) return paperCanvas;
  const c = paperCanvas = document.createElement('canvas'); c.width = PW; c.height = PH; const g = c.getContext('2d');
  g.fillStyle = '#efe0bd'; g.fillRect(0, 0, PW, PH);
  const v = g.createRadialGradient(PW / 2, PH / 2, PH * .25, PW / 2, PH / 2, PH * .75); v.addColorStop(0, 'rgba(255,248,225,0)'); v.addColorStop(1, 'rgba(120,80,30,.35)'); g.fillStyle = v; g.fillRect(0, 0, PW, PH);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(110,75,35,${rnd() * .08})`; g.fillRect(rnd() * PW, rnd() * PH, 1 + rnd() * 2, 1 + rnd() * 2); }
  g.strokeStyle = 'rgba(120,80,35,.45)'; g.lineWidth = 2; g.strokeRect(26, 26, PW - 52, PH - 52); g.lineWidth = 1; g.strokeRect(34, 34, PW - 68, PH - 68);
  return c;
}
function paperTexture() { const t = new THREE.CanvasTexture(paper()); t.encoding = THREE.sRGBEncoding; return t; }
function wrap(g, text, x, y, width, lead) {
  let line = ''; for (const word of text.split(' ')) { const test = line ? `${line} ${word}` : word; if (g.measureText(test).width > width && line) { g.fillText(line, x, y); line = word; y += lead; } else line = test; }
  if (line) g.fillText(line, x, y); return y;
}
const inkOf = page => page.spell ? SPELL_INK[page.spell] : ['#7a5a12', '#fff0b8'];
// Left page: numeral, the giver's emblem, its name and the lore line, fading in.
function drawLeft(g, page, alpha) {
  const [ink] = inkOf(page); g.globalAlpha = alpha; g.fillStyle = ink; g.strokeStyle = ink; g.textAlign = 'center';
  g.font = '600 18px Georgia'; g.fillText(`PAGE ${page.numeral}`, PW / 2, 86);
  g.save(); g.translate(PW / 2, 210);
  if (page.source === 'ember') { g.scale(5, 5); g.translate(-12, -12); g.lineWidth = .9; g.stroke(new Path2D(SPELLS[0].icon)); }
  else { for (const shape of sigilShapes(page.source)) { const pts = shape.getPoints(40), ys = pts.map(p => p.y), k = 140 / (Math.max(...ys) - Math.min(...ys) || 1); g.beginPath(); pts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p.x * k, -(p.y - (Math.max(...ys) + Math.min(...ys)) / 2) * k)); g.closePath(); g.lineWidth = 3; g.stroke(); g.globalAlpha = alpha * .18; g.fill(); g.globalAlpha = alpha; } }
  g.restore();
  g.font = '600 26px Georgia'; g.fillText(page.from, PW / 2, 360);
  g.font = 'italic 15px Georgia'; g.fillText(page.where, PW / 2, 388);
  g.font = 'italic 20px Georgia'; wrap(g, page.lore, PW / 2, 450, PW - 120, 30);
  g.font = '18px Georgia'; g.fillText('❦', PW / 2, PH - 70);
}
// Right page: the rune drawn stroke by stroke (k 0..1), its name and use fading in, then a glow (0..1).
function drawRight(g, page, k, glow = 0) {
  const [ink, light] = inkOf(page), spell = SPELLS.find(s => s.id === page.spell);
  g.textAlign = 'center'; g.lineCap = g.lineJoin = 'round';
  const rune = (icon, x, y, scale) => {
    g.save(); g.translate(x, y); g.scale(scale, scale); g.translate(-12, -12);
    const path = new Path2D(icon); g.setLineDash([90 * k, 90]); g.lineWidth = 1.5;
    if (glow > 0) { g.shadowColor = light; g.shadowBlur = 40 * glow; g.strokeStyle = light; g.lineWidth = 2.6; g.globalAlpha = glow; g.stroke(path); g.stroke(path); g.globalAlpha = 1; g.lineWidth = 1.5; }
    g.shadowBlur = 0; g.strokeStyle = ink; g.stroke(path); g.restore();
  };
  if (k <= 0) return; // nothing yet (a zero-length dash would leave round dots where each stroke starts)
  if (spell) rune(spell.icon, PW / 2, 250, 11);
  else SPELLS.forEach((s, i) => { const a = i / 4 * Math.PI * 2 - Math.PI / 2; rune(s.icon, PW / 2 + Math.cos(a) * 110, 250 + Math.sin(a) * 110, 4.2); });
  const text = clamp((k - .55) / .45); g.globalAlpha = text; g.fillStyle = ink;
  g.font = '34px serif'; g.fillText(spell ? spell.glyph : '✦', PW / 2, 86);
  g.font = '600 38px Georgia'; g.fillText(spell ? spell.name : page.name, PW / 2, 470);
  g.font = 'italic 19px Georgia'; wrap(g, spell ? spell.about : page.about, PW / 2, 515, PW - 120, 28);
  if (spell) { g.font = '600 15px Georgia'; g.fillText(`CAST · ${spell.input}`, PW / 2, PH - 72); }
  g.globalAlpha = 1;
}
function coverCanvas() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 712; const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 712); grad.addColorStop(0, '#5a2232'); grad.addColorStop(1, '#2e0f18'); g.fillStyle = grad; g.fillRect(0, 0, 512, 712);
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * .18})`; g.fillRect(rnd() * 512, rnd() * 712, 2, 2); }
  g.strokeStyle = '#c9a24a'; g.lineWidth = 5; g.strokeRect(22, 22, 468, 668); g.lineWidth = 2; g.strokeRect(36, 36, 440, 640);
  g.fillStyle = '#c9a24a'; for (const [x, y] of [[36, 36], [476, 36], [36, 676], [476, 676]]) { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-9, -9, 18, 18); g.restore(); }
  g.textAlign = 'center'; g.font = '600 30px Georgia'; g.fillText('THE FOURFOLD', 256, 600); g.fillText('ACCORD', 256, 638);
  g.font = '22px Georgia'; g.fillText('ᛉ   ᛟ   ᚷ   ᛜ', 256, 100);
  return c;
}
function coverTexture() { const t = new THREE.CanvasTexture(coverCanvas()); t.encoding = THREE.sRGBEncoding; return t; }

// ---- the same book in 2D, for the Grimoire Atlas (views/worldMap.js) ----
export const PAGE_SIZE = { w: PW, h: PH };
/** The closed book's front: the tooled cover, its gold ring and the four sigil sockets; lit: sigil kinds set in place. */
export function drawCover(c, lit = []) {
  c.width = 512; c.height = 712; const g = c.getContext('2d'), px = 512 / (W + .03), hex = n => `#${n.toString(16).padStart(6, '0')}`;
  g.drawImage(coverCanvas(), 0, 0);
  const at = ([x, y]) => [256 + x * px, 356 - y * px];
  g.strokeStyle = '#c9a24a'; g.lineWidth = 12; g.beginPath(); g.arc(256, 356, .17 * px, 0, Math.PI * 2); g.stroke();
  for (const kind of Object.keys(SOCKET)) {
    const [x, y] = at(SOCKET[kind]), on = lit.includes(kind);
    g.lineWidth = 9; g.beginPath(); g.arc(x, y, .062 * px, 0, Math.PI * 2); g.fillStyle = '#1c0a10'; g.fill(); g.stroke();
    const shapes = sigilShapes(kind).map(sh => sh.getPoints(40)), ys = shapes.flat().map(p => p.y), xs = shapes.flat().map(p => p.x);
    const k = .085 * px / (Math.max(...ys) - Math.min(...ys)), mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
    g.save(); g.fillStyle = on ? hex(SIGILS[kind].glow) : '#2a1a12'; g.strokeStyle = on ? '#fff8e0' : '#7a5a2a'; g.lineWidth = 2;
    if (on) { g.shadowColor = hex(SIGILS[kind].glow); g.shadowBlur = 28; }
    for (const pts of shapes) { g.beginPath(); pts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](x + (p.x - mx) * k, y - (p.y - my) * k)); g.closePath(); g.fill(); g.stroke(); }
    g.restore();
  }
}
/** Page i of PAGES fully written, as in the reveal: the giver on the left canvas, the spell on the right. */
export function drawPageSpread(left, right, i) {
  for (const [c, draw] of [[left, g => drawLeft(g, PAGES[i], 1)], [right, g => drawRight(g, PAGES[i], 1, 0)]]) {
    c.width = PW; c.height = PH; const g = c.getContext('2d'); g.drawImage(paper(), 0, 0); draw(g);
  }
}
let dot = null;
function glowDot() {
  if (dot) return dot;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.3, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return dot = new THREE.CanvasTexture(c);
}
