// Draws the mana motes (models/manaMotes.js): a small blue crystal with a faint beam, bobbing above the
// ground, fading in its last seconds. A pool of MOTES.max meshes is reused.
import { MOTES } from '../models/manaMotes.js';
import { Burst, sfx } from './fx.js';

export function createManaMoteView(scene) {
  const glow = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
  const coreGeometry = new THREE.OctahedronGeometry(0.22, 0); coreGeometry.scale(1, 1.5, 1);
  const beamGeometry = new THREE.CylinderGeometry(0.03, 0.12, 10, 8, 1, true);
  const burst = new Burst(scene, { color: 0x6fb6ff, count: 60, speed: [1, 4], up: [2, 6], life: 0.8 });
  const pool = Array.from({ length: MOTES.max }, () => {
    const core = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, ...glow });
    const beam = new THREE.MeshBasicMaterial({ color: 0x6fb6ff, opacity: 0.18, side: THREE.DoubleSide, ...glow });
    const group = new THREE.Group(), crystal = new THREE.Mesh(coreGeometry, core), shaft = new THREE.Mesh(beamGeometry, beam);
    shaft.position.y = 5;
    group.add(crystal, shaft); group.visible = false; scene.add(group);
    return { group, crystal, core, beam };
  });
  return {
    /** motes: the field's live list; collected: true when one was touched this frame (for the burst). */
    update(dt, t, motes, player, collected) {
      if (collected) { burst.fire(player.position); sfx.pickup(); }
      pool.forEach((slot, i) => {
        const m = motes[i];
        slot.group.visible = Boolean(m);
        if (!m) return;
        const fade = Math.min(1, m.age / 0.6, (MOTES.life - m.age) / 4); // in over 0.6 s, out over the last 4 s
        slot.group.position.set(m.x, m.y + 1.1 + Math.sin(t * 2 + i) * 0.15, m.z);
        slot.crystal.rotation.y = t * 1.6 + i;
        slot.crystal.scale.setScalar(m.value > MOTES.small ? 1.5 : 1);
        slot.core.opacity = fade; slot.beam.opacity = 0.18 * fade;
      });
      burst.update(dt);
    },
  };
}
