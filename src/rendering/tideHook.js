// The Tide Hook: a three-pronged grappling hook from Heart. A steel shaft with brass collars, a rope coiled
// round it from the eye, and a glowing tide crystal in the hub that lets it bite only into glowing crystals.
// Procedural (no model file); about 0.8 m tall, origin at the shaft's middle. tick(dt) pulses the glow.
const STEEL = { color: 0xa9bcc4, metalness: .85, roughness: .28 };
const BRASS = { color: 0xc9a24a, metalness: .9, roughness: .35 };
const TIDE = 0x6fe3da; // Heart's teal (the loading screen's Heart seal)

let glowTexture = null;
function glow() { // a soft radial dot, shared by every hook
  if (glowTexture) return glowTexture;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(.35, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return glowTexture = new THREE.CanvasTexture(canvas);
}

export function createTideHook() {
  const hook = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial(STEEL), brass = new THREE.MeshStandardMaterial(BRASS);
  const crystal = new THREE.MeshStandardMaterial({ color: TIDE, emissive: TIDE, emissiveIntensity: 1.4, roughness: .12, metalness: .1, transparent: true, opacity: .92 });
  const rope = new THREE.MeshStandardMaterial({ color: 0xb59468, roughness: .9 });
  const add = (geometry, material, y = 0) => { const m = new THREE.Mesh(geometry, material); m.position.y = y; hook.add(m); return m; };

  add(new THREE.CylinderGeometry(.032, .042, .56, 10), steel);                        // shaft
  add(new THREE.TorusGeometry(.068, .018, 8, 20), brass, .36);                         // the eye the rope ties to
  for (const y of [.25, -.2]) add(new THREE.CylinderGeometry(.056, .056, .055, 12), brass, y); // collars
  add(new THREE.CylinderGeometry(.07, .05, .1, 12), brass, -.29);                      // the hub the prongs leave
  const core = add(new THREE.OctahedronGeometry(.075), crystal, -.29); core.scale.set(1, 1.5, 1); // tide crystal

  // Three prongs: out and down from the hub, then curling up into a barbed point.
  const curve = new THREE.CatmullRomCurve3([[.04, -.3], [.15, -.39], [.26, -.33], [.31, -.18], [.27, -.03]].map(([r, y]) => new THREE.Vector3(r, y, 0)));
  const prong = new THREE.TubeGeometry(curve, 24, .022, 8, false);
  const tip = new THREE.ConeGeometry(.032, .1, 8); tip.translate(0, .05, 0);
  const end = curve.getPoint(1), dir = curve.getTangent(1);
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group(); arm.rotation.y = i * Math.PI * 2 / 3;
    arm.add(new THREE.Mesh(prong, steel));
    const point = new THREE.Mesh(tip, steel); point.position.copy(end);
    point.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); arm.add(point);
    const vein = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .008, 5, false), crystal); // a glowing inlay along the prong
    vein.position.z = .018; arm.add(vein);
    hook.add(arm);
  }

  // Rope: coiled four times round the upper shaft, then a short tail hanging from the eye.
  const coil = [];
  for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 8; coil.push(new THREE.Vector3(Math.cos(a) * .058, .02 + i / 96 * .2, Math.sin(a) * .058)); }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 160, .014, 6, false), rope);
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, .3], [.07, .36], [.12, .3], [.15, .16], [.13, .06]].map(([x, y]) => new THREE.Vector3(x, y, .02))), 24, .014, 6, false), rope);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: TIDE, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  halo.position.y = -.29; halo.scale.setScalar(.7); hook.add(halo);

  let time = 0;
  hook.userData.tick = dt => {
    time += dt;
    const pulse = .5 + .5 * Math.sin(time * 2.4);
    crystal.emissiveIntensity = 1.1 + pulse * .9;
    halo.material.opacity = .55 + pulse * .35; halo.scale.setScalar(.62 + pulse * .16);
  };
  return hook;
}
