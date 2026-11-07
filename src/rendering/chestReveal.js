import { loadModel } from './models.js';

// A treasure chest that opens with a reveal: the lid swings back, the item rises out glowing, the
// player reaches for it and it flies into their hands. Shared by every chest that holds a story item
// (Spade's Lantern Sigil, Clover's Tide Hook). Uses the KayKit chest (assets/spade/chest.glb), whose
// `chest_lid` node is hinged at the rear edge.
//   item: the Object3D that rises out (it may have userData.tick(dt) for its own idle motion).
//   at: {x, y, z} of the chest's base; facing: yaw toward where the player stands.
export const REVEAL = { lid: .7, rise: 1.6, hold: 2.6, take: 3.1 }; // seconds after open()
export function createChestReveal({ parent, at, facing = 0, height = 1.15, item, lift = 1.5, onReady }) {
  const group = new THREE.Group(); group.position.set(at.x, at.y, at.z); group.rotation.y = facing; parent.add(group);
  let lid = null, t = Infinity, taken = false;
  loadModel('assets/spade/chest.glb', height).then(({ object }) => {
    group.add(object); lid = object.getObjectByName('chest_lid'); if (taken) setLid(1); onReady?.(group);
  }).catch(error => console.warn('Chest model unavailable.', error));
  if (item) { item.visible = false; parent.add(item); }
  const base = new THREE.Vector3(at.x, at.y + height * .6, at.z), hand = new THREE.Vector3(), reach = new THREE.Vector3();
  const ease = k => k * k * (3 - 2 * k), clamp = k => Math.min(1, Math.max(0, k));
  function setLid(k) { if (lid) lid.rotation.x = -ease(k) * 1.9; }
  return {
    group,
    get opening() { return t < REVEAL.take; },
    get taken() { return taken; },
    // Where the player's hands should reach while the item hovers, or null.
    get reachAt() { return t > REVEAL.lid && t < REVEAL.take && item ? reach.copy(item.position) : null; },
    open() { if (t === Infinity && !taken) t = 0; },
    // hands: the player's position (the item flies toward it at the end). Returns 'taken' once.
    update(dt, hands) {
      item?.userData.tick?.(dt);
      if (t === Infinity) return null;
      t += dt; setLid(clamp(t / REVEAL.lid));
      if (item) {
        item.visible = t > REVEAL.lid * .6;
        const up = ease(clamp((t - REVEAL.lid * .6) / (REVEAL.rise - REVEAL.lid * .6)));
        item.position.copy(base).y += up * lift;
        if (t > REVEAL.hold && hands) { // into the player's hands
          const k = ease(clamp((t - REVEAL.hold) / (REVEAL.take - REVEAL.hold)));
          item.position.lerp(hand.copy(hands), k); item.scale.setScalar(1 - k * .8);
        }
      }
      if (t >= REVEAL.take) { t = Infinity; taken = true; if (item) item.visible = false; return 'taken'; }
      return null;
    },
    // Restore a state: already emptied (e.g. a test start that holds the item) or closed.
    reset(alreadyTaken = false) {
      t = Infinity; taken = alreadyTaken; setLid(alreadyTaken ? 1 : 0);
      if (item) { item.visible = false; item.scale.setScalar(1); }
    },
  };
}
