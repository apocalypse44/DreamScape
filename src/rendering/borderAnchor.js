// The border anchor (Chapter II): a black spade obelisk holding a caged crystal heart, chained to the
// land, shielded by a ward dome and guarded by a projection of Veyr. Chaos opens the dome, each swarm
// strike cracks it and makes the projection glitch, and the third strike shatters both: the chains
// drop, the crystal goes dark and the sign reads that the settlement is free.
import { WARD } from '../models/spadeCampaign.js';
import { spadeHeight, spadeOutline } from '../models/spade.js';

const VIOLET = new THREE.Color(0xb48cff), IRON = new THREE.Color(0x4a4d63), DEAD = new THREE.Color(0x2a2833);
const FIRE = new THREE.Color(0x8a4dff), FIRE_CORE = new THREE.Color(0xe2ccff);   // the Triad's cold fire
const GOLD = new THREE.Color(0xffa63d), GOLD_CORE = new THREE.Color(0xffe9a8);   // Neris's lantern light
const DOME = 2.6;          // dome radius around the crystal (the strike sphere is WARD.radius)
const FALL = 1.6;          // seconds for chains to drop and the crystal to fall after the break
const LINKS = 9;           // links per chain span
const ease = k => k * k * (3 - 2 * k);

const domeShader = {
  vertexShader: `varying vec3 vP;varying vec3 vN;void main(){vP=normalize(position);vN=normalize(normalMatrix*normal);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  // Rim glow, a faint lattice, and two jagged cracks per strike (uCrack 0..3).
  fragmentShader: `uniform float uTime,uOpen,uCrack,uFade;varying vec3 vP;varying vec3 vN;
    float crack(vec3 p,vec3 n){return smoothstep(.04,.0,abs(dot(p,normalize(n))+.07*sin(p.x*21.+p.z*17.)+.04*sin(p.y*37.)));}
    void main(){
      float rim=pow(1.-abs(vN.z),2.4);
      float lattice=smoothstep(.1,.0,abs(sin(vP.x*11.+uTime*.4)*sin(vP.y*11.)*sin(vP.z*11.)));
      float c=0.;
      if(uCrack>.5)c+=crack(vP,vec3(1.,.3,.2))+crack(vP,vec3(-.2,1.,.6));
      if(uCrack>1.5)c+=crack(vP,vec3(.4,-.3,1.))+crack(vP,vec3(1.,1.,-.4));
      if(uCrack>2.5)c+=crack(vP,vec3(-1.,.2,.7))+crack(vP,vec3(.1,.8,-1.));
      float a=(.04+.16*uOpen)+rim*(.22+.5*uOpen)+lattice*(.05+.12*uOpen)+min(c,1.)*.85;
      vec3 col=mix(vec3(.28,.2,.55),vec3(.8,.66,1.),rim+uOpen*.3);col=mix(col,vec3(.97,.93,1.),min(c,1.));
      gl_FragColor=vec4(col,a*uFade);}`,
};
// Veyr's projection: a hollow violet glow with scanlines and a flicker; uGlitch tears it sideways.
const ghostShader = {
  vertexShader: `uniform float uTime,uGlitch;varying vec3 vN;varying float vY;
    void main(){vec3 p=position;vec4 w=modelMatrix*vec4(p,1.);
      float band=floor(w.y*5.);w.x+=uGlitch*(fract(sin(band*91.7+floor(uTime*24.))*43758.5)-.5)*1.2;
      vN=normalize(normalMatrix*normal);vY=w.y;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader: `uniform float uTime,uOpacity,uChaos;varying vec3 vN;varying float vY;
    void main(){float rim=pow(1.-abs(vN.z),1.8);float scan=.65+.35*sin(vY*38.-uTime*5.);
      float flicker=.85+.15*sin(uTime*23.)*sin(uTime*7.3);
      gl_FragColor=vec4(mix(vec3(.42,.28,.85),vec3(.85,.75,1.),rim),(.1+rim*.75)*scan*flicker*uOpacity*(1.+uChaos*.7));}`,
};

export function createBorderAnchor(root) {
  const base = spadeHeight(WARD.x), center = new THREE.Vector3(WARD.x, base, WARD.z);
  const group = new THREE.Group(); group.position.copy(center); root.add(group);
  const obsidian = new THREE.MeshStandardMaterial({ color: 0x1a1524, roughness: .55, metalness: .25, flatShading: true });
  const iron = new THREE.MeshStandardMaterial({ color: 0x5a5d73, roughness: .5, metalness: .6, flatShading: true });
  const mark = new THREE.MeshBasicMaterial({ color: VIOLET.clone(), side: THREE.DoubleSide });

  // Plinth, then two crossed spade pips so the obelisk reads as a spade from every side.
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 3.2), obsidian); plinth.position.y = .5; group.add(plinth);
  const band = new THREE.Mesh(new THREE.BoxGeometry(3.4, .16, 3.4), iron); band.position.y = 1; group.add(band);
  const pip = new THREE.ExtrudeGeometry(spadeOutline(), { depth: .9, bevelEnabled: true, bevelSize: .08, bevelThickness: .06, bevelSegments: 1, curveSegments: 8 })
    .translate(0, 0, -.45).scale(.27, .27, 1);
  const sigil = new THREE.ShapeGeometry(spadeOutline(), 8).scale(.085, .085, 1);
  for (const turn of [0, Math.PI / 2]) {
    const slab = new THREE.Mesh(pip, obsidian); slab.position.y = 2; slab.rotation.y = turn; group.add(slab);
    for (const face of [-1, 1]) { // the Triad's mark, carved and glowing on each face
      const m = new THREE.Mesh(sigil, mark);
      m.position.set(Math.sin(turn) * face * .58, 2.05, Math.cos(turn) * face * .58); m.rotation.y = turn; group.add(m);
    }
  }

  // The crystal heart floats at the ward's centre (the swarm's strike point) in a turning iron cage.
  const heartY = 4; // matches the campaign's strike point (ground + 4 m)
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x8f6bff, emissive: 0x5b2fd0, emissiveIntensity: 1.2, roughness: .2, metalness: .1, flatShading: true });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.7, 0), crystalMat); crystal.scale.set(1, 1.5, 1);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x9a74ff, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false }));
  const cage = new THREE.Group();
  for (const [x, z] of [[0, 0], [Math.PI / 2, 0], [Math.PI / 4, Math.PI / 2]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, .05, 6, 28), iron); ring.rotation.set(x, 0, z); cage.add(ring);
  }
  const heart = new THREE.Group(); heart.add(crystal, halo, cage); heart.position.y = heartY; group.add(heart);

  const domeUniforms = { uTime: { value: 0 }, uOpen: { value: 0 }, uCrack: { value: 0 }, uFade: { value: 1 } };
  const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(DOME, 3), new THREE.ShaderMaterial({ ...domeShader, uniforms: domeUniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  dome.position.y = heartY; group.add(dome);

  // Chains from the obelisk to each corner post (posts: spadeStory.js, ±5 m, tops at 2.4 m). They stay
  // inside the plaza: the houses stand just beyond the posts. One instanced batch; colour carries the pulse.
  const spans = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    spans.push({ from: new THREE.Vector3(sx * 1.25, 1.7, sz * 1.25), to: new THREE.Vector3(sx * 5, 2.2, sz * 5), sag: .35 });

  // An iron brazier on each post: the Triad's violet fire while the settlement is bound, warm lantern
  // gold once it is free. Two additive flame cones per brazier plus one shared set of rising embers.
  const flameMat = new THREE.MeshBasicMaterial({ color: FIRE.clone(), transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const coreMat = new THREE.MeshBasicMaterial({ color: FIRE_CORE.clone(), transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false });
  const bowl = new THREE.CylinderGeometry(.62, .34, .38, 10, 1, true), outer = new THREE.ConeGeometry(.42, 1.3, 10, 1, true), inner = new THREE.ConeGeometry(.22, .8, 8);
  const braziers = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const fire = new THREE.Group(); fire.position.set(sx * 5, 2.4, sz * 5); group.add(fire);
    const pan = new THREE.Mesh(bowl, iron); pan.position.y = .19; fire.add(pan);
    const flame = new THREE.Mesh(outer, flameMat), core = new THREE.Mesh(inner, coreMat);
    flame.position.y = core.position.y = .3; fire.add(flame, core);
    braziers.push({ fire, flame, core, seed: braziers.length * 1.7 });
  }
  const EMBERS = 14, emberData = new Float32Array(braziers.length * EMBERS * 3), emberLife = new Float32Array(braziers.length * EMBERS);
  emberLife.forEach((_, i) => { emberLife[i] = Math.random(); });
  const emberGeometry = new THREE.BufferGeometry(); emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberData, 3));
  const emberMat = new THREE.PointsMaterial({ color: FIRE.clone(), size: .12, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false });
  const embers = new THREE.Points(emberGeometry, emberMat); embers.frustumCulled = false; group.add(embers);
  // warmth 0..1: violet Triad fire to gold. Embers drift up about 2.5 m, then restart in the bowl.
  function drawFire(dt, time, warmth) {
    flameMat.color.copy(FIRE).lerp(GOLD, warmth); coreMat.color.copy(FIRE_CORE).lerp(GOLD_CORE, warmth); emberMat.color.copy(flameMat.color);
    for (const b of braziers) {
      const f = 1 + .18 * Math.sin(time * 9 + b.seed) * Math.sin(time * 5.3 + b.seed * 2);
      b.flame.scale.set(1, f, 1); b.core.scale.set(1, 2 - f, 1); b.flame.rotation.y += dt * 1.5;
    }
    braziers.forEach((b, j) => {
      for (let k = 0; k < EMBERS; k++) {
        const i = j * EMBERS + k;
        emberLife[i] += dt * (.45 + (k % 3) * .12);
        if (emberLife[i] > 1) emberLife[i] -= 1;
        const life = emberLife[i], a = k * 2.4 + b.seed;
        emberData[i * 3] = b.fire.position.x + Math.sin(a + time) * .25 * (1 - life);
        emberData[i * 3 + 1] = b.fire.position.y + .35 + life * 2.5;
        emberData[i * 3 + 2] = b.fire.position.z + Math.cos(a + time) * .25 * (1 - life);
      }
    });
    emberGeometry.attributes.position.needsUpdate = true;
  }
  const links = new THREE.InstancedMesh(new THREE.TorusGeometry(.17, .045, 4, 8).scale(1.6, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: .45, metalness: .6 }), spans.length * LINKS);
  links.frustumCulled = false; group.add(links);
  const linkMatrix = new THREE.Matrix4(), linkColor = new THREE.Color(), along = new THREE.Vector3(), side = new THREE.Vector3(),
    up = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
  // fall 0..1: the chain drops from its taut curve to the ground; glow 0..1: the violet pulse.
  function drawChains(fall, glow, time) {
    let n = 0;
    for (const s of spans) for (let i = 0; i < LINKS; i++) {
      const point = (t, out) => {
        out.lerpVectors(s.from, s.to, t); out.y -= s.sag * Math.sin(t * Math.PI);
        // Dropped: on the plaza, except the inner end, which rests on the plinth's iron band.
        const ground = t < .12 ? 1.1 : .1;
        out.y = THREE.MathUtils.lerp(out.y, ground, ease(Math.min(1, fall * (1.2 - t * .4))));
        return out;
      };
      const t = (i + .5) / LINKS;
      point(t, p); point(Math.min(1, t + .02), q);
      along.subVectors(q, p).normalize();
      // Right-handed basis along the chain; every other link turns a quarter about it, like a real chain.
      up.set(0, 1, 0).addScaledVector(along, -along.y);
      if (up.lengthSq() < 1e-4) up.set(1, 0, 0).addScaledVector(along, -along.x); // a vertical step (chain off the plinth)
      up.normalize();
      side.crossVectors(along, up);
      if (i % 2) linkMatrix.makeBasis(along, side, up.negate()); else linkMatrix.makeBasis(along, up, side);
      linkMatrix.setPosition(p); links.setMatrixAt(n, linkMatrix);
      // The pulse runs outward from the anchor along each chain, into the land.
      const wave = Math.max(0, Math.sin(t * 3 - time * 2.2)) ** 6;
      links.setColorAt(n, linkColor.copy(IRON).lerp(VIOLET, glow * (.25 + .75 * wave)));
      n++;
    }
    links.instanceMatrix.needsUpdate = true; links.instanceColor.needsUpdate = true;
  }

  // Veyr's projection: a tall hooded figure hovering above the dome, arms reaching down to the heart.
  const ghostUniforms = { uTime: { value: 0 }, uGlitch: { value: 0 }, uOpacity: { value: 1 }, uChaos: { value: 0 } };
  const ghostMat = new THREE.ShaderMaterial({ ...ghostShader, uniforms: ghostUniforms, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const ghost = new THREE.Group(); ghost.position.y = 9; group.add(ghost);
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(.55, 1.7, 4.6, 16, 1, true), ghostMat); ghost.add(robe);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(.8, 16, 12, 0, Math.PI * 2, 0, Math.PI * .72), ghostMat);
  hood.position.y = 2.75; ghost.add(hood);
  const peak = new THREE.Mesh(new THREE.ConeGeometry(.5, 1, 12, 1, true), ghostMat);
  peak.position.set(0, 3.55, -.25); peak.rotation.x = -.5; ghost.add(peak);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.55, 12, 10), new THREE.MeshBasicMaterial({ color: 0x05030a }));
  face.position.set(0, 2.62, .28); ghost.add(face);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf0e4ff });
  for (const x of [-.18, .18]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), eyeMat); eye.position.set(x, 2.7, .78); ghost.add(eye); }
  for (const s of [-1, 1]) { // arms angle forward and down toward the crystal
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.32, .12, 2.8, 10, 1, true), ghostMat);
    arm.position.set(s * 1.05, .6, .7); arm.rotation.set(.75, 0, s * .45); ghost.add(arm);
  }

  // The plaza sign, redrawn when the settlement is freed. It hangs above the projection.
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
  const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 10 / 6), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  group.add(sign);
  function writeSign(free) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = free ? '#1d2418' : '#11192b'; ctx.fillRect(0, 0, 768, 128);
    ctx.strokeStyle = free ? '#e6c98a' : '#aebbd4'; ctx.strokeRect(8, 8, 752, 112);
    ctx.font = '28px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = free ? '#f6e7c4' : '#e1e6f3';
    ctx.fillText(free ? 'BORDER ANCHOR · THE SETTLEMENT IS FREE' : 'BORDER ANCHOR · THE SETTLEMENT IS BOUND', 384, 76, 724);
    texture.needsUpdate = true;
    sign.position.y = free ? 6.2 : 14.2;
  }

  let free = false, broke = Infinity, strikes = 0, glitch = 0, shake = 0, time = 0;
  function set(isFree) {
    free = isFree; broke = isFree ? FALL : Infinity; writeSign(free);
  }
  set(false);

  return {
    center,
    // stage: the campaign stage; exposed: chaos has opened the ward; player: faces the projection at them.
    update(dt, { stage, strikes: hits, exposed, chaos }, player) {
      time += dt;
      const nowFree = stage === 'report' || stage === 'complete';
      if (nowFree && !free) { free = true; broke = 0; writeSign(true); }
      else if (!nowFree && free) set(false);
      if (hits > strikes) { glitch = 1; shake = .5; }
      strikes = hits;
      glitch = Math.max(0, glitch - dt * 1.6); shake = Math.max(0, shake - dt);
      if (broke < Infinity) broke += dt;
      const fallK = free ? Math.min(1, broke / FALL) : 0;

      domeUniforms.uTime.value = ghostUniforms.uTime.value = time;
      domeUniforms.uOpen.value += ((exposed ? 1 : 0) - domeUniforms.uOpen.value) * Math.min(1, dt * 4);
      domeUniforms.uCrack.value = strikes;
      // The dome bursts outward and fades in the first half second after the break.
      domeUniforms.uFade.value = free ? Math.max(0, 1 - broke / .5) : 1;
      dome.visible = domeUniforms.uFade.value > 0;
      dome.scale.setScalar(free ? 1 + broke * 1.4 : 1 + domeUniforms.uOpen.value * .12 + .02 * Math.sin(time * 3));

      // The projection turns to watch the player; it tears apart and fades as the anchor breaks.
      ghostUniforms.uGlitch.value = free ? 1 : glitch;
      ghostUniforms.uChaos.value = chaos;
      ghostUniforms.uOpacity.value = free ? Math.max(0, 1 - broke / .9) : 1;
      ghost.visible = ghostUniforms.uOpacity.value > 0;
      ghost.position.y = 9 + Math.sin(time * .9) * .25 + (free ? broke * 2 : 0);
      if (player) ghost.rotation.y = Math.atan2(player.position.x - center.x, player.position.z - center.z);

      // The heart spins while bound; once free it goes dark and drops onto the obelisk's tip.
      crystalMat.emissiveIntensity = free ? 1.2 * (1 - fallK) : 1 + .4 * Math.sin(time * 2.4) + glitch;
      crystalMat.color.copy(VIOLET).lerp(DEAD, fallK);
      halo.material.opacity = free ? .22 * (1 - fallK) : .18 + .08 * Math.sin(time * 2.4) + domeUniforms.uOpen.value * .1;
      heart.position.y = THREE.MathUtils.lerp(heartY + Math.sin(time * 1.3) * .12, 3.7, ease(fallK));
      heart.position.x = (Math.random() - .5) * shake * .3;
      crystal.rotation.y += dt * (free ? 0 : .8);
      crystal.rotation.z = ease(fallK) * .55;
      cage.rotation.y -= dt * (free ? 0 : .35);
      cage.rotation.x = ease(fallK) * .4;
      mark.color.copy(VIOLET).lerp(DEAD, fallK);

      drawChains(fallK, free ? 1 - fallK : .6 + domeUniforms.uOpen.value * .4, time);
      drawFire(dt, time, fallK);
    },
    reset() { set(false); strikes = 0; glitch = shake = 0; },
  };
}
