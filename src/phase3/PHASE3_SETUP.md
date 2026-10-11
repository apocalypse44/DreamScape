# Phase 3 — implementation and validation

Phase 3 is integrated into the existing game. The active wiring is in
`src/controllers/game.js`, `src/models/quest.js`,
`src/rendering/companion.js`, and `src/rendering/shrine.js`; no copying or
manual hook-up is needed.

The live flow connects ember pickup effects, carried-ember orbit and shrine
offering, hound petting/reactions/fetch, NPC updates and speech bubbles, camera
shake, and R reset. If the optional Phase 3 character files are missing, simple
procedural NPC and dog models keep the interactions testable.
Five lore wanderers are seeded around the Crossing within 72 m of the start,
so they are easy to find; the shrine keeper remains beside the shrine.

The three ember challenges are currently: the raised slab climb, a seeded
terrain-peak placeholder for the future chasm route, and an ember carried by
the fleeing hound. The second challenge still needs an explicit far-side
position from a chasm/parkour course.

Run the focused quest regression test with:

```sh
node --test tests/phase3Quest.test.mjs
```

The original manual setup notes below are kept as historical reference; their
copy/import steps have been superseded by the integration above.

```
src/phase3/
  deps.js        <- edit: import paths for three + GLTFLoader
  config.js      <- edit: biome names, crystal model, clip names, tuning
  phase3.js      the entry point (init / update / reset / hooks)
  embers.js      shard look, pickup moment, carrying, offering flight
  dog.js         dog moods: sit, bark, wait, pet, howl, fetch
  people.js      shrine keeper + wanderers + scared + speech bubbles
  challenges.js  where each ember goes, hound drop rule
  fx.js          particles, camera shake, sounds (no sound files needed)
  hud.js         toast, "E · PET" prompt, speech bubbles
  anim.js        clip lookup, crossfade, rigged-model cloning, movement helpers
  rng.js         seeded random (so R rebuilds identically)
  events.js      tiny event bus
```

---

## Step 1 — Branch and copy the folder

```bash
git checkout main && git pull
git checkout -b phase3-embers-npcs
```

Copy the `src/phase3/` folder into your project's `src/` folder (next to
`src/rendering/`).

## Step 2 — Fix the imports (`deps.js`)

Open `src/rendering/npc.js` and look at its first lines. Copy its import of
three and of GLTFLoader into `src/phase3/deps.js`, replacing the two lines
there. Both folders are at the same depth, so the paths are identical.

## Step 3 — Fill in `config.js`

1. `BIOMES`: the exact strings your `world.js` biome function returns
   (look for where `'verdant'` or similar is defined). Do the same for
   `SWARM_BIOME` (Violet Mist) and the keys of `HINTS` and `NPC_TINTS`.
2. `ASSETS.crystal`: pick one GLB from `assets/crystals/` and put its path
   here, e.g. `'assets/crystals/crystal_1.glb'`. Leave `null` to start with a
   code-built crystal.
3. The three UAL paths are already copied from your `assets/README.md`.

## Step 4 — Connect to the game loop (`game.js`)

Add the import at the top:

```js
import { Phase3 } from '../phase3/phase3.js';   // adjust ../ to where game.js is
```

After the scene, camera, player, world, dog and quest are created, call
`init`. Each line maps something Phase 3 needs to your real code. **Change the
right-hand sides to your real names** (Step 0 of the guide — read your code):

```js
Phase3.init({
  scene, camera, renderer,
  seed: state.seed,

  getPlayer: () => ({
    position: player.position,          // the player's THREE.Vector3 (feet)
    sprinting: state.sprinting,         // true while Shift-running
    crouching: state.crouching,         // true while C is held
  }),
  getChaos: () => state.chaos,
  addChaos: (d) => { state.chaosImpulse = (state.chaosImpulse || 0) + d; }, // agree with Phase 4

  terrainHeight: (x, z) => world.terrainHeight(x, z),
  biomeAt: (x, z) => world.biomeAt(x, z),

  // map your quest stages to the three names Phase 3 uses
  questStage: () => (quest.stage === 'cursed' ? 'cursed'
                   : quest.stage === 'cured' ? 'cured' : 'dog'),
  nextEmberPos: () => quest.nextEmber()?.position ?? null,

  shrinePos: shrine.position,                     // shrine group position
  shrineTarget: shrine.crystalWorldPosition,      // see Step 6
  shrineLine: () => SHRINE_TEXT[quest.stage] ?? 'The Crossing is quiet.',

  dog: { object: dog.root, mixer: dog.mixer, clips: dog.clips },
  character: {
    playCrouch: () => character.play('crouch'),
    lockMovement: (sec) => { state.interactionLock = sec; },
  },
});
```

Inside the frame loop, **after** the player and camera have been updated:

```js
Phase3.update(dt, t);                 // t = elapsed seconds
Phase3.applyCameraShake(camera, dt);  // must be after the camera is positioned
```

In the R (reset) handler, after the world/quest reset:

```js
Phase3.reset(state.seed);
```

**Test:** the game runs exactly as before. Open the browser console:
you should see `[phase3] npc clips available: [...]` and `clips chosen`.

## Step 5 — Embers (`quest.js` / `shrine.js`)

1. **Where embers are created**, after you know their positions:
   ```js
   Phase3.setEmbers(emberPositions);       // array of THREE.Vector3
   ```
   Then hide the old ember meshes in `shrine.js` (`oldEmber.visible = false`)
   — Phase 3 now draws them.
2. **Where an ember is picked up** (the line that marks it collected):
   ```js
   Phase3.pickupEmber(i, collectedCount, 3);
   ```
3. **Where the offering at the shrine happens**, wrap the existing cure call:
   ```js
   // before:  cureDog();
   Phase3.startOffering(() => cureDog());
   ```
4. If an ember moves (the hound's), call every frame:
   `Phase3.setEmberPosition(i, hound.position)`.

**Test:** embers glow, spin and bob. Picking one up gives sparks + shake +
"EMBER 1/3" + a chime, then it circles you. At the shrine they fly in one by
one and the dog is cured when the last lands.

## Step 6 — Shrine target

The embers fly to `shrineTarget`. Find the crystal inside the shrine model:

```js
const shrineCrystalPos = new THREE.Vector3();
let crystalMesh = null;
shrineModel.traverse((o) => { if (o.isMesh && /crystal|gem|orb/i.test(o.name)) crystalMesh = o; });
(crystalMesh ?? shrineModel).getWorldPosition(shrineCrystalPos);
// pass shrineCrystalPos as shrineTarget in Step 4
```

If nothing matches, print every mesh name once
(`shrineModel.traverse(o => o.isMesh && console.log(o.name))`) and pick one.

## Step 7 — Dog (`companion.js`)

In the dog's per-frame update, **right after `mixer.update(dt)`**, add:

```js
if (Phase3.updateDog(dt, t)) return;   // Phase 3 is controlling the dog now
```

Then fill in `DOG_CLIPS` in `config.js` with the dog's real clip names (the
console prints them). Clips that don't exist fall back to Idle; bark adds a
small hop in code.

If your companion.js uses its own "play clip" function, pass it instead of
mixer/clips so the two don't fight:

```js
dog: {
  object: dog.root,
  play: (mood) => playDogClip({ sit: 'Idle', bark: 'Eating', wait: 'Idle',
                                pet: 'Idle', howl: 'Attack', run: 'Run' }[mood] ?? 'Idle'),
  onRelease: () => playDogClip('Walk'),   // back to normal following
},
```

**Test:**
- crouch near the dog → it sits; stand → it follows again
- sprint past → it barks and hops (6 s cooldown)
- stand on a parkour slab → it waits below and barks every 3 s
- calm and close → "E · PET" appears; press E → hearts, chime, you crouch
- in Violet Mist, E still controls the swarm
- cursed stage → when the dog reaches an ember and you are far, it howls and a
  glowing ring marks the ember; it stops when you come within 4 m
- after the cure → every ~20 s it runs off, brings a glowing mote back

## Step 8 — Things to ask teammates for

| Who | What | Why |
| --- | --- | --- |
| Phase 2 (player.js) | `if (state.interactionLock > 0) { state.interactionLock -= dt; return; }` at the top of the movement code | player stands still while petting |
| Phase 4 (score block) | add `state.chaosImpulse` to chaos, then set it back to 0 | petting and fetch lower chaos |
| Phase 2 | course-end and chasm-far-side positions | ember challenge placement (Step 10) |
| character.js owner | a `play('crouch')` function | pet pose |

Phase 3 works without these; the matching effect just doesn't happen yet.

## Step 9 — NPCs

Nothing extra to wire: once Phase 3 initializes, it spawns the shrine keeper
beside the shrine and five seeded lore wanderers around the Crossing.

1. Check the console line `[phase3] npc clips chosen`. If `talk` or `scared`
   is `(none)` or wrong, copy the exact names from `npc clips available`
   into `NPC_CLIPS` in `config.js`.
2. If a model walks backwards, set `NPC_YAW_OFFSET = Math.PI`.
3. Your existing `rendering/npc.js` (Grimoire Tower villagers) is untouched.
   Both load the same UAL files; the browser caches them, so it costs little.

**Test:**
- walk to the keeper calmly → it turns, plays talk, bubble shows the shrine line
- the line changes as the quest stage changes
- find a wanderer near the Crossing → it walks a small loop and shares its lore hint when you are close
- sprint past in chaos (> 0.65) → it runs away then cowers; below 0.40 it recovers

## Step 10 — Ember challenges (`quest.js`)

```js
import { emberPositions, houndEmberRule } from '../phase3/challenges.js';
import { makeRng } from '../phase3/rng.js';

// when the quest builds its embers (and again on reset):
const spots = {};   // later: { course: parkour.courseEnd(), chasm: parkour.chasmFar() } from Phase 2
const positions = emberPositions(makeRng(state.seed), terrainHeight, hound.position, spots);
Phase3.setEmbers(positions);

// every frame while the hound still carries ember 2:
const rule = houndEmberRule(player.position, hound.position, state.chaos);
if (rule === 'flee')  houndRunAwayFrom(player.position);   // your hound movement
if (rule === 'drop')  houndCarrying = false;                // ember stays where it fell
if (houndCarrying) Phase3.setEmberPosition(2, hound.position);
```

**Test:** ember 0 is at the end of a course, ember 1 across a chasm (or at
placeholder spots until Phase 2 delivers), ember 2 only drops if you approach
the hound calmly.

## Step 11 — Reset, FPS, final check

- Press R mid-quest: embers, dog and NPCs must be back where they started.
  Take a screenshot before and after a fresh start with the same seed.
- Compare FPS at view radius 2 before/after (there is only 1 extra light,
  particles are pooled, NPCs > 80 m away are skipped).
- Add **E — pet / talk** to the README controls.

Done when:
- [ ] Pickup is unmistakable (burst + toast + sound) and carried embers are visible
- [ ] You can pet the dog and it reacts to sprinting, crouching and parkour
- [ ] 2+ animated NPCs with lines and chaos reactions
- [ ] R resets quest, dog and NPCs exactly

## Tuning

Every distance, time and colour is in `config.js` (pet range, bark cooldown,
fetch interval, talk range, wander radius, NPC height, tints, hint lines).

## If something goes wrong

| Symptom | Fix |
| --- | --- |
| `Failed to resolve module` in console | Step 2: import paths in `deps.js` |
| `could not load assets/...` | path/capitals in `config.js` `ASSETS` vs. your `assets/` folder |
| NPCs in T-pose | clip names wrong → `NPC_CLIPS` in `config.js` |
| NPCs giant/tiny | `NPC_HEIGHT` in `config.js` |
| Dog animation flickers between two clips | use the `play`/`onRelease` adapter in Step 7 |
| No sound | press any key first (browsers block audio until then) |
| Shake does nothing | `applyCameraShake` must run after the camera is positioned |
