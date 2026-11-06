// Feasibility yard for melee: straw dummies that react to the traveller's swings,
// and one sentinel that winds up and strikes so blocking, rolling and hit reactions
// can be tried. All geometry is primitive; no extra downloads.
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function createTrainingYard({ scene, ground, colliders, onImpact = () => {} }) {
  const T = THREE, dummies = [], sparks = [];
  const toon = hex => new T.MeshToonMaterial({ color: new T.Color(hex).convertSRGBToLinear() });
  const straw = toon(0xc9a560), wood = toon(0x6b4b30), cloth = toon(0x9a3434);
  function makeDummy(x, z, sentinel = false) {
    const base = new T.Group(), y = ground(x, z); base.position.set(x, y, z); scene.add(base);
    const body = new T.Group(); base.add(body);
    const part = (geometry, material, py, sx = 1, sy = 1, sz = 1) => { const m = new T.Mesh(geometry, material.clone()); m.position.y = py; m.scale.set(sx, sy, sz); m.castShadow = true; body.add(m); return m; };
    part(new T.CylinderGeometry(.07, .09, 1.1, 8), wood, .55);
    const torso = part(new T.CylinderGeometry(.28, .32, .85, 10), straw, 1.35);
    part(new T.CylinderGeometry(.05, .05, 1.2, 6), wood, 1.5, 1, 1, 1).rotation.z = Math.PI / 2;
    const head = part(new T.SphereGeometry(.22, 12, 10), sentinel ? cloth : straw, 2.0);
    part(new T.TorusGeometry(.3, .04, 6, 16), cloth, 1.15).rotation.x = Math.PI / 2;
    let arm = null;
    if (sentinel) { arm = new T.Group(); arm.position.y = 1.5; body.add(arm); const club = new T.Mesh(new T.BoxGeometry(.12, .12, 1.4), wood.clone()); club.position.z = .7; club.castShadow = true; arm.add(club); }
    const meshes = []; body.traverse(o => { if (o.isMesh) meshes.push(o); });
    colliders.push({ x, z, radius: .42 });
    const dummy = { x, z, base, body, torso, head, arm, meshes, sentinel, tiltX: 0, tiltZ: 0, velX: 0, velZ: 0, flash: 0, lastSwing: -1, timer: 2.5, windup: 0, facing: 0 };
    dummies.push(dummy); return dummy;
  }
  makeDummy(3.6, -3.4); makeDummy(6.2, -.6); makeDummy(-3.8, -3.2); makeDummy(-6.5, 2.5, true);
  // Pooled spark burst.
  const sparkGeometry = new T.BufferGeometry(), sparkCount = 48, sparkPositions = new Float32Array(sparkCount * 3);
  sparkGeometry.setAttribute('position', new T.BufferAttribute(sparkPositions, 3));
  const sparkMaterial = new T.PointsMaterial({ color: 0xb08cff, size: .07, transparent: true, opacity: .9, depthWrite: false });
  const points = new T.Points(sparkGeometry, sparkMaterial); points.frustumCulled = false; scene.add(points);
  for (let i = 0; i < sparkCount; i++) sparks.push({ p: new T.Vector3(0, -99, 0), v: new T.Vector3(), life: 0 });
  let nextSpark = 0;
  function burst(at, color, count = 12) {
    sparkMaterial.color.set(color);
    for (let i = 0; i < count; i++) {
      const s = sparks[nextSpark = (nextSpark + 1) % sparkCount];
      s.p.copy(at); s.v.set((Math.random() - .5) * 5, Math.random() * 4 + 1, (Math.random() - .5) * 5); s.life = .35 + Math.random() * .2;
    }
  }
  const at = new T.Vector3();
  const yard = {
    hits: 0,
    get targets() { return dummies; },
    step(dt, { player, combat, combatState, toast }) {
      const hit = combatState?.hit;
      for (const d of dummies) {
        // Swing test: inside reach and the swing's arc in front of the traveller.
        if (hit && d.lastSwing !== hit.id) {
          const dx = d.x - player.position.x, dz = d.z - player.position.z, distance = Math.hypot(dx, dz);
          if (distance < hit.reach + .35 && Math.abs(angleDiff(Math.atan2(dx, dz), hit.facing)) < hit.arc / 2) {
            d.lastSwing = hit.id; yard.hits++;
            const push = hit.heavy ? 9 : 5; d.velX += dx / distance * push; d.velZ += dz / distance * push; d.flash = 1;
            burst(at.set(d.x - dx / distance * .3, d.base.position.y + 1.4, d.z - dz / distance * .3), hit.heavy ? 0xf0a040 : 0x9a6cff, hit.heavy ? 18 : 10);
            onImpact(hit.heavy);
            if (d.sentinel) { d.windup = 0; d.timer = 1.6; }
          }
        }
        // Wobble on a damped spring around the base.
        d.velX += (-d.tiltX * 60 - d.velX * 5) * dt; d.velZ += (-d.tiltZ * 60 - d.velZ * 5) * dt;
        d.tiltX += d.velX * dt * .12; d.tiltZ += d.velZ * dt * .12; d.flash = Math.max(0, d.flash - dt * 5);
        if (!d.sentinel) continue;
        const dx = player.position.x - d.x, dz = player.position.z - d.z, distance = Math.hypot(dx, dz);
        d.facing += angleDiff(Math.atan2(dx, dz), d.facing) * (1 - Math.exp(-4 * dt));
        if (distance > 7) { d.windup = 0; d.timer = Math.max(d.timer, 1.2); continue; }
        if (d.windup > 0) {
          d.windup -= dt;
          if (d.windup <= 0) {
            d.timer = 2.6; d.strike = .35;
            if (distance < 3.1) {
              const result = combat.hurt({ x: d.x, z: d.z }, player.position, { heavy: true });
              burst(at.set(player.position.x, player.position.y - .7, player.position.z), result === 'blocked' ? 0xf2d27a : result === 'dodged' ? 0x5fb8e8 : 0xe0553a, 14);
              toast?.(result === 'blocked' ? 'Blocked' : result === 'dodged' ? 'Dodged' : 'Hit!');
              onImpact(result !== 'dodged');
            }
          }
        } else if ((d.timer -= dt) <= 0) d.windup = .75;
      }
    },
    render(dt) {
      for (const d of dummies) {
        d.body.rotation.set(d.tiltZ, 0, -d.tiltX);
        for (const m of d.meshes) m.material.emissive?.setRGB(d.flash * .8, d.flash * .7, d.flash);
        if (d.sentinel) {
          d.base.rotation.y = d.facing;
          const wind = d.windup > 0 ? 1 - d.windup / .75 : 0;
          d.strike = Math.max(0, (d.strike || 0) - dt);
          d.arm.rotation.x = d.windup > 0 ? -1.4 * wind : .9 * d.strike / .35;
          d.head.material.emissive.setRGB(Math.max(d.flash, wind) * .9, wind * .2, 0);
        }
      }
      let alive = false;
      sparks.forEach((s, i) => {
        if (s.life > 0) { s.life -= dt; s.v.y -= 12 * dt; s.p.addScaledVector(s.v, dt); alive = true; } else s.p.y = -99;
        sparkPositions.set([s.p.x, s.p.y, s.p.z], i * 3);
      });
      sparkGeometry.attributes.position.needsUpdate = true; points.visible = alive;
    },
  };
  return yard;
}
