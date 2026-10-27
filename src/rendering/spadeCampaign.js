// Chapter II visuals: three memory lanterns on the avenue posts and the border anchor's ward.
import { LANTERN_SITES, WARD, CASTLE_DOOR, createSpadeCampaign } from '../models/spadeCampaign.js';
import { spadeHeight, spadeOutline } from '../models/spade.js';
import { Burst, addShake, sfx } from './fx.js';
import { createBorderAnchor } from './borderAnchor.js';

const DARK = new THREE.Color(0x2c2540), LIT = new THREE.Color(0xd9c8ff);

const DOOR_SWING = 1.6;      // radians the leaves turn outward when open
const DOOR_SECONDS = 3;      // time to swing fully open
const DOOR_NOTICE = 9;       // metres: sealed-door message range
const DOOR_REPEAT = 12;      // seconds before the message can repeat

// Two iron-bound leaves hinged at the doorway's sides, each carrying the spade crest.
function buildDoors(root) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x2f2530, roughness: 0.85, flatShading: true });
  const iron = new THREE.MeshStandardMaterial({ color: 0x6b6f86, roughness: 0.5, metalness: 0.6 });
  const crest = new THREE.MeshBasicMaterial({ color: 0xc4acff });
  const leafW = CASTLE_DOOR.depth / 2, height = CASTLE_DOOR.top - CASTLE_DOOR.bottom;
  const crestGeometry = new THREE.ShapeGeometry(spadeOutline(), 12);
  return [-1, 1].map(side => {
    const hinge = new THREE.Group();
    hinge.position.set(CASTLE_DOOR.x, CASTLE_DOOR.bottom, side * leafW);
    const along = -side * leafW / 2; // leaf runs from its hinge toward the centre line
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.35, height, leafW - 0.05), wood);
    leaf.position.set(0, height / 2, along);
    hinge.add(leaf);
    for (const y of [1.6, height / 2, height - 1.6]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, leafW - 0.1), iron);
      band.position.set(0, y, along); hinge.add(band);
    }
    const emblem = new THREE.Mesh(crestGeometry, crest);
    emblem.scale.setScalar(0.32); emblem.rotation.y = Math.PI / 2;
    emblem.position.set(0.22, height * 0.58, along); hinge.add(emblem);
    root.add(hinge);
    return { hinge, side };
  });
}

// onChapterComplete: runs when Neris grants the Lantern Sigil (the game queues the doors' cutscene).
// ready(): the chapter may begin (the game passes "the Ember Hound is cured").
export function buildSpadeCampaign({ root, notify, crownKnown, ready, platforms, onChapterComplete }) {
  const lanternY = site => spadeHeight(site.x) + 5.2; // just above the avenue post's lamp
  const wardAt = new THREE.Vector3(WARD.x, spadeHeight(WARD.x) + 4, WARD.z);
  const model = createSpadeCampaign({ lanternY, wardY: wardAt.y, crownKnown, ready });
  platforms.push(model.doorVolume);
  const doors = buildDoors(root);
  const anchor = createBorderAnchor(root);
  let doorOpen = 0, noticeAt = -Infinity;
  const orb = new THREE.IcosahedronGeometry(0.42, 1), cage = new THREE.TorusGeometry(0.62, 0.035, 6, 24);
  const lanterns = LANTERN_SITES.map(site => {
    const material = new THREE.MeshBasicMaterial({ color: DARK.clone() });
    const group = new THREE.Group();
    group.position.set(site.x, lanternY(site), site.z);
    group.add(new THREE.Mesh(orb, material));
    for (const turn of [0, Math.PI / 2]) {
      const ring = new THREE.Mesh(cage, material); ring.rotation.y = turn; group.add(ring);
    }
    root.add(group);
    return { site, group, material };
  });
  const lanternBurst = new Burst(root, { color: 0xd9c8ff, count: 60, speed: [1, 3], up: [1, 4], life: 1.2 });
  const strikeBurst = new Burst(root, { color: 0xc4acff, count: 140, speed: [3, 9], up: [2, 8], life: 1.4 });
  let time = 0;

  return {
    model,
    update(dt, player, state, swarm) {
      time += dt;
      const event = state.locked ? model.update(dt, player.position, state.chaos, swarm) : null;
      for (const l of lanterns) {
        const glow = model.isLit(l.site.id) ? 1 : model.chargeOf(l.site.id) * 0.7;
        l.material.color.copy(DARK).lerp(LIT, glow);
        l.group.rotation.y += dt * (0.4 + glow * 2);
        l.group.scale.setScalar(1 + (glow > 0 && glow < 1 ? 0.12 * Math.sin(time * 8) : 0));
      }
      // The ward stands until the anchor falls; chaos opens it for strikes.
      if (Math.hypot(player.position.x - WARD.x, player.position.z - WARD.z) < 140)
        anchor.update(dt, { stage: model.stage, strikes: model.strikes, exposed: model.wardExposed(state.chaos), chaos: state.chaos }, player);
      lanternBurst.update(dt); strikeBurst.update(dt);
      // Doors swing outward (toward +x, onto the approach) once the cutscene opens the gate.
      doorOpen = Math.min(1, Math.max(0, doorOpen + (model.gateOpen ? dt : -dt) / DOOR_SECONDS));
      for (const d of doors) d.hinge.rotation.y = -d.side * DOOR_SWING * (doorOpen * doorOpen * (3 - 2 * doorOpen));
      const atDoor = Math.hypot(player.position.x - (CASTLE_DOOR.x + 3), player.position.z - CASTLE_DOOR.z) < DOOR_NOTICE &&
        player.position.y - 2.05 > CASTLE_DOOR.bottom - 1;
      if (atDoor && state.locked && model.gateMessage && time - noticeAt > DOOR_REPEAT) { noticeAt = time; notify?.(model.gateMessage, 6000); }
      if (!event) return;
      for (const l of lanterns) if (model.isLit(l.site.id) && !l.flared) { l.flared = true; lanternBurst.fire(l.group.position); sfx.pickup(); }
      if (event.kind === 'strike' || event.kind === 'broken') {
        strikeBurst.fire(wardAt); addShake(event.kind === 'broken' ? 0.7 : 0.4); sfx.whoosh();
      }
      if (event.kind === 'sigil' || event.kind === 'broken') sfx.cure();
      notify?.(event.text, event.ms);
      if (event.kind === 'sigil') onChapterComplete?.();
    },
    openGate() { model.openGate(); sfx.whoosh(); addShake(0.3); },
    reset() { model.reset(); doorOpen = 0; noticeAt = -Infinity; lanterns.forEach(l => { l.flared = false; }); anchor.reset(); },
  };
}
