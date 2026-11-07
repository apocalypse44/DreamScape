// Heart's water spirit (Undine-like identity: playful, loyal; CHARACTER_PLAN.md 5.6). Not a rigged
// character: a translucent droplet with a bright core, two big eyes and little fins, built from
// primitives and animated by squash and stretch. Faces +z. About 0.45 m tall.
export function createWaterSpirit() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.name = 'Water spirit';
  const water = new THREE.MeshToonMaterial({ color: 0x1f9ccf, transparent: true, opacity: .9 });
  const deep = new THREE.MeshToonMaterial({ color: 0x2aa8c8 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xd8fcff, toneMapped: false });
  const ink = new THREE.MeshBasicMaterial({ color: 0x0c2a34 }), shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const drop = new THREE.LatheGeometry([[0, 0], [.13, .03], [.19, .12], [.18, .22], [.12, .32], [.05, .41], [0, .46]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
  const shell = new THREE.Mesh(drop, water); shell.castShadow = true; body.add(shell);
  const core = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 10), glow); core.position.y = .16; body.add(core);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), ink); eye.position.set(side * .07, .2, .155); eye.scale.z = .5; body.add(eye);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(.011, 6, 5), shine); spark.position.set(side * .07 - .012, .215, .172); body.add(spark);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(.05, .14, 6), deep); fin.position.set(side * .19, .14, -.02); fin.rotation.z = -side * 1.2; fin.scale.z = .35; body.add(fin);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.05, .16, 6), deep); tail.position.set(0, .09, -.18); tail.rotation.x = -1.9; tail.scale.x = .4; body.add(tail);
  let time = 0, hopping = false;
  return {
    root,
    setHopping(on) { hopping = on; },
    update(dt) {
      time += dt;
      // Idle: a soft wobble. Hopping: a 1 s arc with stretch in the air and a squash on landing.
      const cycle = time % 1, air = hopping ? Math.sin(Math.min(1, cycle / .7) * Math.PI) : 0;
      const land = hopping && cycle > .7 ? Math.sin((cycle - .7) / .3 * Math.PI) : 0;
      const wobble = Math.sin(time * 3.2) * .05;
      const sy = 1 + wobble + air * .18 - land * .25, sxz = 1 / Math.sqrt(sy);
      body.scale.set(sxz, sy, sxz); body.position.y = air * .35;
      core.material.color.setScalar(.85 + .15 * Math.sin(time * 4));
    },
  };
}
