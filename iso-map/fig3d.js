// Grimoire Atlas 3D: the game world as a terrain diorama. Terrain heights, trails and structures come from
// iso-map/atlas-data.json, baked from src/models/* by iso-map/bake.mjs. Rebuild: python iso-map/build.py
// Scale: 1 game metre = 2 units across, 7 units up (heights exaggerated 3.5x so hills read at map scale).
// Trees, crystals, pillars and wisps are illustrative: in the game they are scattered procedurally.
FIGS3D.push({ id: 'atlas', name: 'Grimoire Atlas', mod: (() => {
  const D = /*ATLAS_DATA*/null;
  const g0 = new THREE.Group(); g0.visible = false; scene.add(g0);
  const first = twMeshes.length;
  const GX = 2, GH = 7, U = GX * TS;                 // game metre -> figure units; scene units per ground metre
  const P3 = (x, z, h) => W(x * GX, z * GX, h * GH);
  const KS = ['clover', 'heart', 'diamond', 'spade'];
  const COL = { clover: ['#8fe36b', '#3f9a2a'], heart: ['#ff6b6b', '#d93a3a'], diamond: ['#ffd36b', '#c08a00'], spade: ['#b9a6ff', '#6e52d9'] };
  const st = { lit: { clover: false, heart: false, diamond: false, spade: false }, mono: false, labels: true };
  const nLit = () => KS.filter(k => st.lit[k]).length;
  const isOn = k => k === 'hub' ? nLit() === 4 : st.lit[k];
  const colOf = k => (k === 'hub' || st.mono) ? accent.clone() : new THREE.Color(COL[k][theme === 'light' ? 1 : 0]);
  const kOf = (x, z) => Math.hypot(x, z) < D.kingdomStart ? 'hub' : Math.abs(z) >= Math.abs(x) ? (z < 0 ? 'clover' : 'diamond') : (x > 0 ? 'heart' : 'spade');
  let seed = 7;                                       // deterministic scatter
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // ── terrain heights (bilinear on the baked grid) ──
  const { x0, z0, cell, n, h } = D, N1 = n + 1;
  const ci = v => Math.max(0, Math.min(n, v));
  const H = (i, j) => h[ci(j) * N1 + ci(i)];
  function hAt(x, z) {
    const fx = (x - x0) / cell, fz = (z - z0) / cell, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    return (H(i, j) * (1 - tx) + H(i + 1, j) * tx) * (1 - tz) + (H(i, j + 1) * (1 - tx) + H(i + 1, j + 1) * tx) * tz;
  }
  const X1 = x0 + n * cell, Z1 = z0 + n * cell, BASE = -18;

  // ── terrain surface, tinted per kingdom ──
  const pos = new Float32Array(N1 * N1 * 3), kid = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = x0 + i * cell, z = z0 + j * cell, v = P3(x, z, H(i, j)), o = (j * N1 + i) * 3;
    pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z; kid.push(kOf(x, z));
  }
  const idx = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * N1 + i, b = a + 1, c = a + N1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const tgeo = new THREE.BufferGeometry();
  tgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N1 * N1 * 3), 3));
  tgeo.setIndex(idx); tgeo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const terrain = new THREE.Mesh(tgeo, terrainMat); g0.add(terrain);
  function paint() {
    const light = theme === 'light', base = new THREE.Color(THEMES[theme].body), c = new THREE.Color(), col = tgeo.attributes.color;
    const tint = {}; for (const k of [...KS, 'hub']) tint[k] = [colOf(k), k === 'hub' ? (isOn('hub') ? .1 : .03) : isOn(k) ? (light ? .38 : .3) : (light ? .16 : .1)];
    kid.forEach((k, i) => { c.copy(base).lerp(tint[k][0], tint[k][1]); col.setXYZ(i, c.r, c.g, c.b); });
    col.needsUpdate = true;
  }

  // ── slab sides and edges ──
  {
    const ring = [];                                   // terrain border, clockwise
    for (let i = 0; i <= n; i++) ring.push([x0 + i * cell, z0]);
    for (let j = 1; j <= n; j++) ring.push([X1, z0 + j * cell]);
    for (let i = n - 1; i >= 0; i--) ring.push([x0 + i * cell, Z1]);
    for (let j = n - 1; j > 0; j--) ring.push([x0, z0 + j * cell]);
    const tri = [], top = [];
    ring.forEach(([x, z], k) => {
      const [x2, z2] = ring[(k + 1) % ring.length];
      const a = P3(x, z, hAt(x, z)), b = P3(x2, z2, hAt(x2, z2)), a0 = P3(x, z, BASE), b0 = P3(x2, z2, BASE);
      tri.push(a, a0, b, b, a0, b0); top.push(...a.toArray(), ...b.toArray());
    });
    const sg = new THREE.BufferGeometry().setFromPoints(tri); sg.computeVertexNormals();
    g0.add(new THREE.Mesh(sg, bodyMat));
    const bot = [[x0, z0], [X1, z0], [X1, Z1], [x0, Z1]], e = [];
    bot.forEach(([x, z], k) => { const [x2, z2] = bot[(k + 1) % 4];
      e.push(...P3(x, z, BASE).toArray(), ...P3(x2, z2, BASE).toArray(), ...P3(x, z, BASE).toArray(), ...P3(x, z, hAt(x, z)).toArray()); });
    g0.add(fat(top, majorMat), fat(e, majorMat));
  }

  // ── line materials per kingdom (contours, trails), sharing the shell's resolution uniform ──
  const lmat = () => { const m = new LineMaterial({ color: MAJOR_COL.clone(), linewidth: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }); m.uniforms.resolution = lineMat.uniforms.resolution; return m; };
  const contourMat = {}, trailMat = {};
  for (const k of [...KS, 'hub']) { contourMat[k] = lmat(); trailMat[k] = lmat(); }

  // contours every 2 m (marching squares), grouped by kingdom so each kingdom's lines can light up
  {
    const segs = { hub: [], clover: [], heart: [], diamond: [], spade: [] };
    for (let L = -6; L <= 16; L += 2) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = x0 + i * cell, z = z0 + j * cell, p = [];
      const edge = (ha, hb, xa, za, xb, zb) => { if ((ha < L) !== (hb < L)) { const t = (L - ha) / (hb - ha); p.push([xa + (xb - xa) * t, za + (zb - za) * t]); } };
      edge(H(i, j), H(i + 1, j), x, z, x + cell, z); edge(H(i + 1, j), H(i + 1, j + 1), x + cell, z, x + cell, z + cell);
      edge(H(i + 1, j + 1), H(i, j + 1), x + cell, z + cell, x, z + cell); edge(H(i, j + 1), H(i, j), x, z + cell, x, z);
      for (let k = 0; k + 1 < p.length; k += 2) {
        const [a, b] = [p[k], p[k + 1]];
        segs[kOf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)].push(...P3(a[0], a[1], L + .1).toArray(), ...P3(b[0], b[1], L + .1).toArray());
      }
    }
    for (const k in segs) if (segs[k].length) g0.add(fat(segs[k], contourMat[k]));
  }

  // kingdom border ring and frontiers, draped on the ground
  const drape = (pts, lift = .4) => { const a = []; for (let i = 1; i < pts.length; i++) { const [p, q] = [pts[i - 1], pts[i]]; a.push(...P3(p[0], p[1], hAt(p[0], p[1]) + lift).toArray(), ...P3(q[0], q[1], hAt(q[0], q[1]) + lift).toArray()); } return a; };
  {
    const R = D.kingdomStart, ring = [];
    for (let a = 0; a <= 360; a += 2) ring.push([Math.cos(a * Math.PI / 180) * R, Math.sin(a * Math.PI / 180) * R]);
    g0.add(fat(drape(ring), majorMat));
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const f = []; for (let r = R; ; r += 6) { const x = sx * r / Math.SQRT2, z = sz * r / Math.SQRT2; if (x < x0 || x > X1 || z < z0 || z > Z1) break; f.push([x, z]); }
      g0.add(fat(drape(f), lineMat));
    }
    const plaza = []; for (let a = 0; a <= 360; a += 10) plaza.push([Math.cos(a * Math.PI / 180) * 21, Math.sin(a * Math.PI / 180) * 21]);
    g0.add(fat(drape(plaza, .2), majorMat));
  }

  // ── trails (the game's own winding roads), lamps, travelling pulses ──
  const glow = {}, pulses = {}, trailPts = {};
  const lamps = { hub: [], clover: [], heart: [], diamond: [], spade: [] };
  const posts = [];
  KS.forEach((k, i) => {
    const pts = [[0, 0], ...D.trails[i]];
    if (k === 'spade') for (let x = -356; x >= -462; x -= 6) pts.push([x, 0]);           // the avenue to the castle
    if (k === 'clover') for (let z = -356; z >= -437; z -= 6) pts.push([0, z]);          // up the terraces
    trailPts[k] = pts.map(([x, z]) => P3(x, z, Math.max(hAt(x, z), 0) + .8));
    g0.add(fat(drape(pts, .6), trailMat[k]));
    pts.forEach(([x, z], j) => { if (j && j % 6 === 0) { const g = hAt(x, z); lamps[k].push(P3(x + 5, z + 5, g + 6)); posts.push(...P3(x + 5, z + 5, g).toArray(), ...P3(x + 5, z + 5, g + 6).toArray()); } });
    pulses[k] = glowPoints([0, 1, 2].map(() => trailPts[k][0].clone()), .3); g0.add(pulses[k]);
  });
  g0.add(fat(posts, lineMat));

  // ── structures ──
  const kMat = {}; for (const k of [...KS, 'hub']) kMat[k] = capMat();
  const box = (x, z, w, d, bottom, top, mat = bodyMat, r = 0) => rbox((x - w / 2) * GX, (z - d / 2) * GX, bottom * GH, w * GX, d * GX, Math.max(.3, top - bottom) * GH, r, mat, g0);
  const solid = (geo, mat, at) => { const m = new THREE.Mesh(geo, mat); m.position.copy(at); addOutline(m); twMeshes.push(m); g0.add(m); return m; };
  function extrude(outline, cx, cz, bottom, top, mat = bodyMat) {
    const sh = new THREE.Shape(outline.map(([px, pz]) => new THREE.Vector2((cx + px) * GX, -(cz + pz) * GX)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: (top - bottom) * GH, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, bottom * GH, 0); g.scale(TS, TS, TS);
    return solid(g, mat, new THREE.Vector3());
  }
  const disc = (x, z, r, y, mat) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r * U, 40), mat); m.rotation.x = -Math.PI / 2; m.position.copy(P3(x, z, y)); g0.add(m); return m; };

  // Grimoire Tower at the shrine: one floor lights per lit kingdom
  const S = D.marks.shrine, hb = hAt(S.x, S.z), floorMats = [0, 1, 2, 3].map(capMat);
  box(S.x, S.z, 30, 30, hb - 1, hb + 4, bodyMat, 4);
  box(S.x, S.z, 16, 16, hb + 4, hb + 44);
  floorMats.forEach((m, i) => box(S.x, S.z, 17.5, 17.5, hb + 10 + i * 8, hb + 12 + i * 8, m));
  box(S.x, S.z, 11, 11, hb + 44, hb + 52);
  box(S.x, S.z, 6, 6, hb + 52, hb + 60, kMat.hub, 1);
  lamps.hub.push(P3(S.x, S.z, hb + 63));
  // Grimoire Falls: water down the cliff into the pool
  { const Wf = D.marks.waterfall; disc(Wf.x, Wf.z + 4, Wf.poolRadius, Wf.base + .2, kMat.hub);
    for (let t = 0; t <= 1; t += .25) lamps.hub.push(P3(Wf.x, Wf.z - 2, Wf.base + Wf.height * t)); }

  // Clover: gate arch, terraces, valley climb and summit (true outlines), Sky Garden, forest
  { const [gx, gz] = [D.marks.cloverEntrance.x, D.marks.cloverEntrance.z + 18], g = hAt(gx, gz);
    box(gx - 5.5, gz, 2.4, 2.4, g, g + 10); box(gx + 5.5, gz, 2.4, 2.4, g, g + 10); box(gx, gz, 14, 2.4, g + 10, g + 12, kMat.clover); }
  for (const [x, z, w, d, bottom, top, outline] of D.cloverBoxes)
    outline ? extrude(outline, x, z, bottom, top) : box(x, z, w, d, bottom, top);
  { const sky = D.marks.sky, lake = D.marks.skyLake;
    solid(new THREE.CylinderGeometry(40 * U, 10 * U, 26 * GH * TS, 9), bodyMat, P3(sky.x, sky.z, sky.top - 13));
    disc(lake.x, lake.z, lake.radius, sky.top + .2, kMat.clover);
    const fz = sky.z + 38, g = hAt(sky.x, fz);
    g0.add(fat([...P3(sky.x, fz, sky.top - 2).toArray(), ...P3(sky.x, fz, g).toArray()], trailMat.clover));   // Heavenly Falls
    for (let t = 0; t <= 1; t += .2) lamps.clover.push(P3(sky.x, fz, g + (sky.top - 2 - g) * t));
    lamps.clover.push(P3(lake.x, lake.z, sky.top + 3)); }
  const scatter = (k, count, ok, make) => { for (let tries = 0, made = 0; made < count && tries < count * 40; tries++) {
    const x = x0 + 20 + rnd() * (X1 - x0 - 40), z = z0 + 20 + rnd() * (Z1 - z0 - 40);
    if (kOf(x, z) !== k || Math.hypot(x, z) < D.kingdomStart + 15 || !ok(x, z)) continue;
    const lane = k === 'clover' || k === 'diamond' ? Math.abs(x) : Math.abs(z); if (lane < 18) continue;   // keep the trail clear
    make(x, z, hAt(x, z)); made++; } };
  const treeGeo = new THREE.ConeGeometry(6 * U, 16 * GH * TS, 6);
  scatter('clover', 90, (x, z) => !(x > -50 && x < 70 && z < -330), (x, z, g) => solid(treeGeo, bodyMat, P3(x, z, g + 8)));
  // Heart: obelisk gate and glowing crystal fields
  const gate = (k, i, lat) => { const [x, z] = D.trails[i].at(-1), g = hAt(x, z), [ox, oz] = lat ? [0, 7] : [7, 0];
    for (const s of [-1, 1]) { box(x + s * ox, z + s * oz, 3, 3, g, g + 12); box(x + s * ox, z + s * oz, 2, 2, g + 12, g + 14, kMat[k]); lamps[k].push(P3(x + s * ox, z + s * oz, g + 15)); } };
  gate('heart', 1, true); gate('diamond', 2, false);
  const crystalGeo = new THREE.OctahedronGeometry(4 * U, 0); crystalGeo.scale(1, 3.2, 1);
  scatter('heart', 45, () => true, (x, z, g) => { solid(crystalGeo, kMat.heart, P3(x, z, g + 4)).rotation.y = rnd() * 3; if (rnd() < .35) lamps.heart.push(P3(x, z, g + 9)); });
  // Diamond: obelisk gate and pillar fields with lit caps
  scatter('diamond', 45, () => true, (x, z, g) => { const t = g + 8 + rnd() * 14; box(x, z, 4, 4, g - 1, t); box(x, z, 7, 7, t, t + 1.4, kMat.diamond); if (rnd() < .3) lamps.diamond.push(P3(x, z, t + 2)); });
  // Spade: every volume from spadeVolumes() (castle, walls, towers, refuge…), houses with lit windows, mountains, wisps
  const INTERIOR = /pedestal|archive|bed|throne|balustrade|gallery|floor/;
  for (const [x, z, w, d, bottom, top, name] of D.spadeBoxes) if (!INTERIOR.test(name)) box(x, z, w, d, bottom, top);
  for (const q of D.houses) {
    box(q.x, q.z, q.w, q.d, q.bottom - 2, q.bottom + q.h);
    box(q.x, q.z, q.w * .7, q.d * .7, q.bottom + q.h, q.bottom + q.h + 2.5);                              // roof cap
    lamps.spade.push(P3(q.x + q.w / 2 + 1, q.z, q.bottom + q.h * .5));
  }
  for (const q of D.mountains) {
    const m = solid(new THREE.CylinderGeometry(q.rx * .3 * U, q.rx * U, q.h * .7 * GH * TS, 7), bodyMat, P3(q.x, q.z, q.bottom + q.h * .35));
    const cap = solid(new THREE.CylinderGeometry(.6 * U, q.rx * .3 * U, q.h * .3 * GH * TS, 7), kMat.spade, P3(q.x, q.z, q.bottom + q.h * .85));
    m.rotation.y = cap.rotation.y = q.rot;
  }
  { const a = D.marks.spade.find(p => p.id === 'spade-anchor'); if (a) lamps.spade.push(P3(a.x, a.z, hAt(a.x, a.z) + 10)); }
  scatter('spade', 40, (x, z) => x > -330 || Math.abs(z) > 100, (x, z, g) => lamps.spade.push(P3(x, z, g + 6 + rnd() * 10)));

  for (const k in lamps) { glow[k] = glowPoints(lamps[k], k === 'hub' ? .35 : .22); g0.add(glow[k]); }
  creases(first);

  // ── labels: camera-facing sprites ──
  const tags = [], labelGroup = new THREE.Group(); g0.add(labelGroup);
  function tag(text, x, z, y, k, big) {
    const c = document.createElement('canvas'), fs = big ? 46 : 28, x2 = c.getContext('2d');
    x2.font = `600 ${fs}px ${MONO3}`; c.width = Math.ceil(x2.measureText(text).width + fs); c.height = Math.ceil(fs * 1.6);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
    const hgt = big ? .5 : .3; s.center.set(.5, 0); s.scale.set(hgt * c.width / c.height, hgt, 1); s.position.copy(P3(x, z, y)); s.renderOrder = 10;
    labelGroup.add(s);
    tags.push(() => { const g = c.getContext('2d'), light = theme === 'light'; g.clearRect(0, 0, c.width, c.height);
      g.font = `600 ${fs}px ${MONO3}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = fs * .22; g.strokeStyle = light ? '#e9eaea' : '#121314'; g.strokeText(text, c.width / 2, c.height / 2);
      const col = k ? colOf(k) : null;
      g.fillStyle = col ? '#' + col.getHexString() : light ? '#3a3e42' : '#c3c7cb';
      g.globalAlpha = !k || isOn(k) || k === 'hub' ? 1 : .55; g.fillText(text, c.width / 2, c.height / 2); g.globalAlpha = 1; tex.needsUpdate = true; });
  }
  const M = D.marks, gy = (x, z, up) => hAt(x, z) + up;
  tag('GRIMOIRE TOWER', S.x, S.z, hb + 66, null);
  tag('GRIMOIRE FALLS', M.waterfall.x, M.waterfall.z, M.waterfall.base + M.waterfall.height + 4, null);
  tag('GRIMOIRE RIDGE', M.ridge.x, M.ridge.z, gy(M.ridge.x, M.ridge.z, 6), null);
  tag('CLOVER TERRACES', 0, -403, 14, null);
  tag('CLOVER SUMMIT', M.summitDoor.x, M.summitDoor.z, M.summitDoor.top + 6, null);
  tag('SKY GARDEN', M.sky.x, M.sky.z, M.sky.top + 8, null);
  for (const p of M.spade) tag(p.name, p.x, p.z, gy(p.x, p.z, p.id === 'spade-castle' ? 46 : 14), null);
  tag('♣ CLOVER KINGDOM', -230, -470, 30, 'clover', true);
  tag('♥ HEART KINGDOM', 470, -170, 30, 'heart', true);
  tag('♦ DIAMOND KINGDOM', -190, 470, 30, 'diamond', true);
  tag('♠ SPADE KINGDOM', -440, -250, 30, 'spade', true);

  // ── state → materials ──
  function render() {
    const n4 = nLit();
    for (const k of [...KS, 'hub']) { kMat[k].emissive.copy(colOf(k)); kMat[k].emissiveIntensity = isOn(k) ? 1.3 : 0; }
    kMat.hub.emissiveIntensity = n4 ? 1.3 : 0;                                           // tower tip and falls pool light with any kingdom
    floorMats.forEach((m, i) => { m.emissive.copy(accent); m.emissiveIntensity = i < n4 ? 1.4 : 0; });
    labelGroup.visible = st.labels;
    paint(); tags.forEach(f => f());
    readout();
  }
  function readout() {
    if (active !== 'atlas') return;
    const on = KS.filter(k => st.lit[k]);
    document.getElementById('read').textContent = `${on.length}/4 lit${on.length ? ' · ' + on.join(' ') : ''} · ${st.mono ? 'one accent' : 'kingdom colours'} · seed ${D.seed}`;
  }
  const toggle = k => { st.lit[k] = !st.lit[k]; SFX.switch(); render(); return true; };
  const all = () => { const on = !KS.every(k => st.lit[k]); KS.forEach(k => st.lit[k] = on); SFX.button(); render(); return true; };
  const next = () => { const k = KS.find(k => !st.lit[k]); return k ? toggle(k) : all(); };
  const mono = () => { st.mono = !st.mono; render(); return true; };
  const labels = () => { st.labels = !st.labels; render(); return true; };
  themeHooks.push(render); render();

  return { group: g0, readout, stop: () => {},
    demo: () => KS.forEach((k, i) => setTimeout(() => { if (!st.lit[k]) toggle(k); }, 300 + i * 450)),
    key: e => { const i = '1234'.indexOf(e.key); if (i >= 0) return toggle(KS[i]);
      const c = e.key.toLowerCase(); return c === 'a' ? all() : c === 'c' ? mono() : c === 'l' ? labels() : e.key === ' ' ? next() : false; },
    click: hit => { if (!hit) return; const k = kOf(hit.point.x / U, hit.point.z / U); k === 'hub' ? all() : toggle(k); },
    tick: now => {
      const dpr = renderer.getPixelRatio();
      for (const k of [...KS, 'hub']) {
        const on = isOn(k), c = on ? colOf(k) : null;
        contourMat[k].color.copy(on ? c : majorMat.color); contourMat[k].linewidth = dpr;
        trailMat[k].color.copy(on ? c : MAJOR_COL); trailMat[k].linewidth = (on ? 2 : 1.2) * dpr;
        const lit = k === 'hub' ? nLit() > 0 : on;
        glow[k].material.uniforms.color.value.copy(colOf(k)); glow[k].material.uniforms.intensity.value = lit ? .85 : 0;
        if (k === 'hub') continue;
        const pts = trailPts[k], p = pulses[k], a = p.geometry.attributes.position;
        p.material.uniforms.color.value.copy(colOf(k)); p.material.uniforms.intensity.value = on ? 1 : 0;
        for (let j = 0; j < 3; j++) { const t = ((now / 1000) * .08 + j / 3) % 1, f = t * (pts.length - 1), i = Math.floor(f);
          const v = pts[i].clone().lerp(pts[Math.min(i + 1, pts.length - 1)], f - i); a.setXYZ(j, v.x, v.y, v.z); }
        a.needsUpdate = true;
      }
    },
    panel: [['Clover', '1', () => toggle('clover')], ['Heart', '2', () => toggle('heart')], ['Diamond', '3', () => toggle('diamond')], ['Spade', '4', () => toggle('spade')],
      ['All kingdoms', 'A', all], ['Colours', 'C', mono], ['Labels', 'L', labels]],
    view: { target: P3((x0 + X1) / 2, (z0 + Z1) / 2, 0), dist: 50 },
    info: `<h2>Grimoire Atlas</h2><p>The game world as a terrain model: real heights (seed ${D.seed}), the 350 m kingdom border, the game's trails, the Clover terraces and Sky Garden, and every Spade building. Click a kingdom (or 1–4) to light its contours, trails and lamps; the tower gains a floor per lit kingdom. Heights are exaggerated 3.5×.</p>`,
    hint: 'click a kingdom · 1–4 · A all · C colours · L labels · T theme' };
})() });
