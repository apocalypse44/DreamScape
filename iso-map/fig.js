// Grimoire Atlas: isometric map of the actual game world, drawn from the coordinates in src/models/*.
// Standalone; does not touch src/views/worldMap.js. Rebuild: python iso-map/build.py
// ponytail: coordinates are copied from the game modules (no build step can import them here);
// if a landmark moves in-game, update its line below.
// Positions are true to the game (x east, z south). Heights are exaggerated (V) and small structures
// slightly enlarged so they read at map scale. Biome props (trees, crystals, pillars) are illustrative:
// in the game they are scattered procedurally.
FIGS.push({
  id: 'atlas', name: 'Grimoire Atlas',
  hint: 'Click a kingdom · 1–4 · T tower · C colours · L labels',
  aria: 'Isometric map of the game world: the Grimoire Tower at the centre, the 350 metre kingdom border, and the Clover, Heart, Diamond and Spade kingdoms. Click a kingdom or press 1 to 4 to light it, T to light all, C to switch colours, L to toggle labels.',
  css: `
#atlas-root.kc .k-clover { --accent:#8fe36b; --accent-hi:#c8f7ad; }
#atlas-root.kc .k-heart { --accent:#ff6b6b; --accent-hi:#ffb0b0; }
#atlas-root.kc .k-diamond { --accent:#ffd36b; --accent-hi:#ffe9b0; }
#atlas-root.kc .k-spade { --accent:#b9a6ff; --accent-hi:#ddd3ff; }
:root[data-theme="light"] #atlas-root.kc .k-clover { --accent:#3f9a2a; --accent-hi:#5fb845; }
:root[data-theme="light"] #atlas-root.kc .k-heart { --accent:#d93a3a; --accent-hi:#ef6060; }
:root[data-theme="light"] #atlas-root.kc .k-diamond { --accent:#c08a00; --accent-hi:#d9a520; }
:root[data-theme="light"] #atlas-root.kc .k-spade { --accent:#6e52d9; --accent-hi:#8d76ef; }
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) #atlas-root.kc .k-clover { --accent:#3f9a2a; --accent-hi:#5fb845; }
  :root:not([data-theme="dark"]) #atlas-root.kc .k-heart { --accent:#d93a3a; --accent-hi:#ef6060; }
  :root:not([data-theme="dark"]) #atlas-root.kc .k-diamond { --accent:#c08a00; --accent-hi:#d9a520; }
  :root:not([data-theme="dark"]) #atlas-root.kc .k-spade { --accent:#6e52d9; --accent-hi:#8d76ef; }
}
#atlas-root.kc [data-k] { --glass-on: color-mix(in srgb, var(--accent) 14%, var(--panel)); }
#atlas-root [data-k] { cursor: pointer; }
#atlas-root .zone { fill: var(--accent); opacity: .05; transition: opacity .4s; }
#atlas-root .zone.on { opacity: .2; }
#atlas-root .ring { fill: none; stroke: var(--line); stroke-dasharray: 6 5; vector-effect: non-scaling-stroke; }
#atlas-root .atl-lab { font-size: 8.5px; letter-spacing: .08em; paint-order: stroke; stroke: var(--panel); stroke-width: 3px; stroke-linejoin: round; }
#atlas-root .atl-lead { stroke: var(--detail); vector-effect: non-scaling-stroke; }
#atlas-root .k-lab { font-size: 13px; font-weight: 600; fill: var(--accent); opacity: .45; transition: opacity .4s; }
#atlas-root .k-lab.on { opacity: 1; }
#atlas-root.nolab .atl-lab, #atlas-root.nolab .atl-lead { display: none; }`,
  mount(stage, api) {
    const M = 0.5, V = 1.3, Z0 = 8;                  // iso units per metre (ground), per metre (height), plate top
    const XMIN = -590, ZMIN = -610, PW = 1160 * M, PD = 1180 * M;
    const ix = x => (x - XMIN) * M, iy = z => (z - ZMIN) * M;
    const K = api.iso.frame([[0,0,0],[PW,0,0],[0,PD,0],[PW,PD,0],
      [ix(0), iy(-11), Z0 + 76 * V], [ix(88), iy(-552), Z0 + 64 * V], [ix(-548), iy(-130), Z0 + 72 * V]]);
    const { P, TOP, FRONT, SIDE, box } = K;

    // A box centred on game (x, z), w × d metres, h metres tall, starting z0 metres up.
    function bx(x, z, w, d, h, z0 = 0, o = {}) {
      const X = ix(x) - w * M / 2, Y = iy(z) - d * M / 2, Z = Z0 + z0 * V, W = w * M, D = d * M, H = h * V;
      let s = box(X, Y, Z, W, D, H, o.r || 0);
      if (o.win) {
        const wh = Math.max(1.5, H * o.win);
        s += `<g transform="${FRONT(X, Y + D, Z + H)}"><rect class="glass kg" x="${W * .2}" y="${H * .25}" width="${W * .6}" height="${wh}"/></g>`;
        s += `<g transform="${SIDE(X + W, Y + D, Z + H)}"><rect class="glass kg" x="${D * .2}" y="${H * .25}" width="${D * .6}" height="${wh}"/></g>`;
      }
      return o.tip ? `<g class="press kt">${s}</g>` : s;
    }
    const items = [];                                 // painter's order: sorted by x + z (back to front)
    const add = (kd, x, z, svg) => items.push({ kd, key: x + z, svg });

    const KS = [
      { id: 'clover',  name: '♣ CLOVER KINGDOM',  a: -Math.PI / 2, lab: [-200, -450] },
      { id: 'heart',   name: '♥ HEART KINGDOM',   a: 0,            lab: [470, -300] },
      { id: 'diamond', name: '♦ DIAMOND KINGDOM', a: Math.PI / 2,  lab: [-250, 450] },
      { id: 'spade',   name: '♠ SPADE KINGDOM',   a: Math.PI,      lab: [-420, -260] },
    ];
    const TRAILS = {   // from the plaza edge along each road to its destination
      clover: [[0, -21], [0, -360]], heart: [[21, 0], [344, 0]], diamond: [[0, 21], [0, 344]], spade: [[-21, 0], [-462, 0]],
    };

    // ---------- Grimoire (centre) ----------
    {
      let s = bx(0, -11, 26, 26, 8, 0, { r: 2 });
      const X = ix(0) - 8 * M, Y = iy(-11) - 8 * M, W = 16 * M, H = 48 * V, Z = Z0 + 8 * V;
      s += box(X, Y, Z, W, W, H, 0);
      for (let i = 0; i < 4; i++) {                 // one lit floor per lit kingdom, bottom up
        const y = H - 14 - i * 13;
        s += `<g transform="${FRONT(X, Y + W, Z + H)}"><rect class="glass" id="atlas-tw-f${i}" x="1.5" y="${y}" width="${W - 3}" height="8"/></g>`;
        s += `<g transform="${SIDE(X + W, Y + W, Z + H)}"><rect class="glass" id="atlas-tw-s${i}" x="1.5" y="${y}" width="${W - 3}" height="8"/></g>`;
      }
      s += bx(0, -11, 11, 11, 10, 56);
      s += `<g class="press" id="atlas-tw-tip">${bx(0, -11, 6, 6, 10, 66, { r: 1 })}</g>`;
      add('tower', 0, -11, s);
      // Grimoire Falls: cliff with the falling water on its face
      const cx = ix(-18) - 9 * M, cy = iy(-38) - 4 * M;
      add(null, -18, -38, box(cx, cy, Z0, 18 * M, 8 * M, 13 * V, 0)
        + `<g transform="${FRONT(cx, cy + 8 * M, Z0 + 13 * V)}"><rect class="glass tg" x="${6 * M}" y="0" width="${6 * M}" height="${13 * V}"/></g>`);
      // Grimoire Ridge: a low rise, rounded
      add(null, 72, 48, bx(72, 48, 60, 60, 3, 0, { r: 8 }) + bx(72, 48, 40, 40, 3, 3, { r: 6 }) + bx(72, 48, 20, 20, 3.6, 6, { r: 4 }));
    }

    // ---------- Clover (north): gate arch, terraces, valley climb, summit, Sky Garden ----------
    add('clover', 0, -318, bx(-5.5, -318, 2.6, 2.6, 10) + bx(5.5, -318, 2.6, 2.6, 10) + bx(0, -318, 15, 2.6, 2.2, 10, { tip: 1 }));
    [[-370, 24, 20, 6], [-403, 26, 20, 9], [-437, 28, 22, 12]]
      .forEach(([z, w, d, h]) => add('clover', 0, z, bx(0, z, w, d, h, 0, { r: 1, win: .2 })));
    [[-473, 15], [-496, 18], [-519, 21]].forEach(([z, h]) => add('clover', -18, z, bx(-18, z, 12, 12, h)));
    add('clover', 2, -522, bx(2, -522, 30, 40, 24, 0, { r: 2 }) + bx(2, -499, 8, 5, 8, 24, { win: .45, tip: 1 }));
    {
      const top = Z0 + 64 * V, fx = ix(88), fy = iy(-552) + 38 * M;
      const [ax, ay] = P(fx, fy, Z0 + 58 * V), [bx2, by2] = P(fx, fy, Z0);
      add('clover', 88, -552, bx(88, -552, 76, 76, 6, 58, { r: 6, tip: 1 })
        + `<g transform="${TOP(0, 0, top)}"><circle class="glass kg" cx="${ix(90)}" cy="${iy(-554)}" r="${31 * M}"/></g>`
        + `<path class="wire kw" d="M${ax} ${ay} L${bx2} ${by2}"/>`);   // Heavenly Falls
    }
    for (const [x, z] of [[-120, -420], [-170, -380], [140, -400], [190, -460], [-210, -500], [-70, -575], [230, -380], [-260, -410], [40, -590]])
      add('clover', x, z, bx(x, z, 3, 3, 5) + bx(x, z, 11, 11, 9, 5, { r: 4 }));

    // ---------- Heart (east): obelisk gate, crystal fields ----------
    add('heart', 344, 0, bx(344, -7, 3, 3, 12, 0, { tip: 1 }) + bx(344, 7, 3, 3, 12, 0, { tip: 1 }));
    for (const [x, z, h] of [[420, -80, 18], [450, 30, 26], [400, 140, 14], [500, -20, 20], [480, 120, 16], [520, -150, 22], [420, -230, 12], [530, 220, 15]])
      add('heart', x, z, bx(x, z, 8, 8, h, 0, { win: .55 }) + bx(x, z, 4, 4, 7, h, { tip: 1 }));

    // ---------- Diamond (south): obelisk gate, pillar fields ----------
    add('diamond', 0, 344, bx(-7, 344, 3, 3, 12, 0, { tip: 1 }) + bx(7, 344, 3, 3, 12, 0, { tip: 1 }));
    for (const [x, z, h] of [[-90, 420, 14], [60, 450, 18], [150, 400, 12], [-170, 480, 16], [10, 520, 20], [200, 500, 14], [-230, 410, 10], [110, 540, 12]])
      add('diamond', x, z, bx(x, z, 6, 6, h, 0, { win: .5 }) + bx(x, z, 11, 11, 2, h, { tip: 1 }));

    // ---------- Spade (west): gate towers, avenue of houses, Border-Anchor Plaza, castle, mountains ----------
    const sp = (u, v) => [-344 - u, v];               // spadePosition(u, v) from src/models/spade.js
    for (const v of [-13, 13]) add('spade', -344, v, bx(-344, v, 9, 9, 17, 0, { tip: 1 }));
    for (let row = 0; row < 5; row++) for (const side of [-1, 1]) for (let col = 0; col < 3; col++) {
      const [x, z] = sp(22 + row * 16 + (col % 2) * 3, side * (23 + col * 19));
      add('spade', x, z, bx(x, z, 8, 8, 6, 0, { win: .3 }));
    }
    add('spade', -447, -48, bx(-447, -48, 5, 5, 14, 0, { tip: 1 }));
    add('spade', -494, 0,
      bx(-494, 0, 66, 96, 15, 0) +                                        // retaining terrace
      bx(-494, -32, 54, 30, 20, 15, { win: .2 }) +                        // north wing
      bx(-494, 0, 54, 34, 21, 15, { win: .2 }) +                          // hall (atrium, archive)
      bx(-500, 0, 24, 20, 14, 36, { win: .3, tip: 1 }) +                  // Hollow Crown observatory
      bx(-465, -27, 12, 12, 24, 15, { tip: 1 }) +                         // gate towers
      bx(-494, 32, 54, 30, 20, 15, { win: .2 }) +                         // south wing
      bx(-465, 27, 12, 12, 24, 15, { tip: 1 }));
    for (let i = 0; i < 12; i++) {                     // SPADE_MOUNTAINS
      const [x, z] = sp(105 + i * 9, (i % 2 ? -1 : 1) * (116 + i % 3 * 7)), h = 36 + i % 4 * 12;
      add('spade', x, z, bx(x, z, 52, 48, h * .4, 0, { r: 6 }) + bx(x, z, 34, 30, h * .35, h * .4, { r: 4 }) + bx(x, z, 14, 12, h * .25, h * .75, { r: 2 }));
    }

    // ---------- ground layer ----------
    const C = [ix(0), iy(0)], R = 350 * M;
    const at = (a, r) => `${C[0] + Math.cos(a) * r} ${C[1] + Math.sin(a) * r}`;
    const pts = p => p.map(([x, z], i) => `${i ? 'L' : 'M'}${ix(x)} ${iy(z)}`).join(' ');
    let ground = `<clipPath id="atlas-clip"><rect x="0" y="0" width="${PW}" height="${PD}" rx="9"/></clipPath><g clip-path="url(#atlas-clip)">`;
    for (const k of KS) {
      const a1 = k.a - Math.PI / 4, a2 = k.a + Math.PI / 4;
      ground += `<g class="k-${k.id}" data-k="${k.id}"><path class="zone" id="atlas-${k.id}-zone" d="M${at(a1, R)} L${at(a1, 2000)} L${at(a2, 2000)} L${at(a2, R)} A${R} ${R} 0 0 0 ${at(a1, R)}Z"/></g>`;
      ground += `<path class="detail" d="M${at(a1, R)} L${at(a1, 2000)}"/>`;  // frontier
    }
    ground += `</g><circle class="ring" cx="${C[0]}" cy="${C[1]}" r="${R}"/>`;
    ground += `<rect class="face recess" x="${ix(-462)}" y="${iy(-5)}" width="${118 * M}" height="${10 * M}"/>`;   // Spade avenue
    ground += `<circle class="face recess" cx="${ix(-447)}" cy="${iy(-48)}" r="${14 * M}"/>`;                       // Border-Anchor Plaza
    for (const k of KS) ground += `<g class="k-${k.id}"><path class="wire" id="atlas-${k.id}-road" d="${pts(TRAILS[k.id])}"/>
      <path class="pulse" id="atlas-${k.id}-pulse" pathLength="1000" d="${pts(TRAILS[k.id])}"/></g>`;
    ground += `<path class="detail" d="${pts([[-2, -2], [-7, -12], [-13.5, -26]])} ${pts([[2, 2], [11, 12], [19, 22], [25, 30], [50, 40]])}"/>`;
    ground += `<circle class="face top" cx="${C[0]}" cy="${C[1]}" r="${21 * M}"/>`;                                // plaza
    ground += `<circle class="glass tg" cx="${ix(-18)}" cy="${iy(-30)}" r="${6 * M}"/>`;                            // falls pool

    let svg = `<g id="atlas-root" class="kc">` + box(0, 0, 0, PW, PD, Z0, 14);
    svg += `<g transform="${TOP(0, 0, Z0)}">${ground}</g>`;
    items.sort((a, b) => a.key - b.key);
    for (const it of items) svg += it.kd ? `<g class="k-${it.kd}" data-k="${it.kd}">${it.svg}</g>` : it.svg;

    // labels, screen space, on top
    const lab = (text, x, z, h) => {
      const [sx, sy] = P(ix(x), iy(z), Z0 + h * V);
      return `<line class="atl-lead" x1="${sx}" y1="${sy}" x2="${sx}" y2="${sy - 12}"/><text class="label atl-lab" x="${sx}" y="${sy - 15}" text-anchor="middle">${text}</text>`;
    };
    svg += lab('GRIMOIRE TOWER', 0, -11, 76) + lab('GRIMOIRE FALLS', -18, -38, 13) + lab('GRIMOIRE RIDGE', 72, 48, 9.6)
      + lab('CLOVER TERRACES', 0, -403, 9) + lab('CLOVER SUMMIT', 2, -499, 32) + lab('SKY GARDEN', 88, -552, 64)
      + lab('LANTERN REFUGE', -366, -23, 6) + lab('BORDER-ANCHOR PLAZA', -447, -48, 14) + lab('HOLLOW GATE', -500, 0, 50);
    for (const k of KS) {
      const [sx, sy] = P(ix(k.lab[0]), iy(k.lab[1]), Z0);
      svg += `<g class="k-${k.id}" data-k="${k.id}"><text class="label k-lab" id="atlas-${k.id}-lab" x="${sx}" y="${sy}" text-anchor="middle">${k.name}</text></g>`;
    }
    svg += `</g>`;
    stage.setAttribute('viewBox', K.viewBox); stage.innerHTML = svg;

    const $ = id => stage.querySelector('#atlas-' + id);
    const root = $('root');
    const st = { lit: { clover: false, heart: false, diamond: false, spade: false }, mono: false, labels: true };

    function render() {
      const on = KS.filter(k => st.lit[k.id]);
      for (const k of KS) {
        const lit = st.lit[k.id], q = sel => stage.querySelectorAll(`[data-k="${k.id}"] ${sel}`);
        q('.kg').forEach(e => e.classList.toggle('hot', lit));
        q('.kw').forEach(e => e.classList.toggle('hot', lit));
        q('.kt').forEach(e => e.classList.toggle('latched', lit));
        ['zone', 'lab'].forEach(p => $(`${k.id}-${p}`).classList.toggle('on', lit));
        $(k.id + '-road').classList.toggle('hot', lit);
      }
      for (let i = 0; i < 4; i++) ['f', 's'].forEach(f => $(`tw-${f}${i}`).classList.toggle('hot', i < on.length));
      stage.querySelectorAll('.tg').forEach(e => e.classList.toggle('hot', on.length > 0));
      $('tw-tip').classList.toggle('latched', on.length === 4);
      root.classList.toggle('kc', !st.mono);
      root.classList.toggle('nolab', !st.labels);
      api.power(on.length > 0);
      api.readout(`${on.length}/4 lit${on.length ? ' · ' + on.map(k => k.id).join(' ') : ''} · ${st.mono ? 'one accent' : 'kingdom colours'}`);
    }
    function toggle(id) {
      st.lit[id] = !st.lit[id];
      if (st.lit[id]) api.replay($(id + '-pulse'), 'go');
      render();
    }
    function all() {
      const on = !KS.every(k => st.lit[k.id]);
      KS.forEach(k => { st.lit[k.id] = on; if (on) api.replay($(k.id + '-pulse'), 'go'); });
      api.flash($('tw-tip'));
      render();
    }
    stage.addEventListener('click', e => {
      const k = e.target.closest('[data-k]')?.dataset.k;
      if (k === 'tower') all(); else if (k) toggle(k);
    });
    render();

    return {
      key(e) {
        const i = '1234'.indexOf(e.key);
        if (i >= 0) return toggle(KS[i].id), true;
        const key = e.key.toLowerCase();
        if (key === 't') return all(), true;
        if (key === 'c') return st.mono = !st.mono, render(), true;
        if (key === 'l') return st.labels = !st.labels, render(), true;
        if (e.key === ' ' || e.key === 'Enter') { const k = KS.find(k => !st.lit[k.id]); k ? toggle(k.id) : all(); return true; }
        return false;
      },
      demo: () => KS.forEach((k, i) => api.after(250 + i * 400, () => { if (!st.lit[k.id]) toggle(k.id); })),
    };
  },
});
