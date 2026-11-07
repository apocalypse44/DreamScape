import { createPerson, villagerColors, loadPeopleClips } from '../rendering/person.js';
import { createDogBody, playDog } from '../rendering/dogCharacter.js';
import { createWaterSpirit } from '../rendering/waterSpirit.js';
import { createWisps } from '../models/swarm.js';

// Every character in one row in the movement lab, so looks, clips and faces can be checked
// without playing the game. Nothing downloads until the gallery is first opened.
export const GALLERY = [
  ['player', 'Sigil-blade wanderer (you)'],
  ['shrineKeeper', 'Shrine Keeper'], ['shrineKeeperYoung', 'Shrine Keeper (young, flashback)'],
  ['iven', 'Iven'], ['ivenYoung', 'Iven (young, flashback)'], ['neris', 'Neris'], ['orin', 'Orin'],
  ['villager', 'Villager (recoloured per person)'],
  ['veyr', 'Veyr the Binder'], ['sile', 'Sile the Harvester'], ['morcant', 'Morcant the Gatekeeper'],
  ['sera', 'Sera (Heart river guardian)'], ['waterSpirit', 'Water spirit (Heart)'], ['wisps', 'Wisps (the people of Spade)'],
  ['dog', 'Companion dog'], ['hound', 'Ember Hound'],
];

export function createCharacterGallery({ scene, ground, origin = { x: -14, z: 24 }, spacing = 2.6 }) {
  let peopleClips = [];
  const items = GALLERY.map(([id, label], i) => ({ id, label, x: origin.x + i * spacing, z: origin.z, update: null, play: null, setExpression: null, clips: () => [] }));
  let built = false;
  function build() {
    if (built) return; built = true;
    loadPeopleClips().then(map => { peopleClips = [...map.keys()]; });
    for (const item of items) {
      if (item.id === 'player') continue; // the lab's own avatar
      const y = ground(item.x, item.z);
      if (item.id === 'waterSpirit') {
        const spirit = createWaterSpirit(); spirit.root.position.set(item.x, y, item.z); scene.add(spirit.root);
        item.distance = 2.2; item.update = dt => spirit.update(dt);
        item.play = name => spirit.setHopping(name === 'Hop'); item.clips = () => ['Idle', 'Hop'];
        continue;
      }
      if (item.id === 'wisps') {
        // Six wisps circling: violet ones, gold ones whose names are remembered, or crimson in chaos.
        const wisps = createWisps(6), m = new THREE.Object3D(), colors = { Calm: 0xc9a8ff, Remembered: 0xffcf6a, Chaos: 0xff6fae };
        scene.add(wisps.group); let time = 0;
        const paint = name => { for (let i = 0; i < 6; i++) wisps.paint(i, new THREE.Color(name === 'Remembered' && i % 2 ? colors.Calm : colors[name])); };
        paint('Calm');
        item.distance = 2.6;
        item.update = dt => {
          time += dt;
          for (let i = 0; i < 6; i++) {
            const a = time * .6 + i * Math.PI / 3, p = new THREE.Vector3(item.x + Math.sin(a) * 1.1, y + 1.6 + Math.sin(time * 2 + i) * .2, item.z + Math.cos(a) * 1.1);
            m.position.copy(p); m.lookAt(p.x + Math.cos(a), p.y, p.z - Math.sin(a)); m.scale.setScalar(1.5); m.updateMatrix(); wisps.place(i, m.matrix);
          }
          wisps.commit();
        };
        item.play = paint; item.clips = () => Object.keys(colors);
        continue;
      }
      if (item.id === 'dog' || item.id === 'hound') {
        const body = createDogBody({ scene, kind: item.id, height: item.id === 'dog' ? .9 : 1.5 });
        body.root.position.set(item.x, y, item.z); body.root.visible = true;
        body.ready.then(() => playDog(body, 'Idle', 0));
        item.distance = item.id === 'dog' ? 2.6 : 3.4;
        item.update = dt => body.tick(dt, { happy: .8, scar: item.id === 'hound' ? 1 : 0 });
        item.play = name => playDog(body, name);
        item.clips = () => Object.keys(body.actions);
        continue;
      }
      const person = createPerson({ name: item.id, colors: item.id === 'villager' ? villagerColors(0x6b7a4a, 1) : null });
      person.root.position.set(item.x, y, item.z); scene.add(person.root);
      person.play('Idle_Loop', 0, false);
      item.update = dt => person.update(dt);
      item.play = name => person.play(name, .2, false);
      item.setExpression = name => person.setExpression(name, 1e9);
      item.clips = () => peopleClips;
    }
  }
  return {
    items, build,
    update(dt) { if (built) for (const item of items) item.update?.(dt); },
    // Where the camera orbits: roughly eye height for people, lower for the animals.
    focus(item) { return new THREE.Vector3(item.x, ground(item.x, item.z) + ({ dog: 1.0, hound: 1.45, waterSpirit: .85, wisps: 2.4 }[item.id] ?? 2.05), item.z); },
  };
}
