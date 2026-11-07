// DreamScape people: recipes built with tools/peopleKit.js into src/assets/people/.
//   people-clips.glb  one shared, stripped clip pack (skeleton only) for every NPC
//   <recipe>.glb      one character: skinned body + face shell + props, no clips
import { PACKS, load, stripClip, exportGLB, createBody, headGeometry } from './peopleKit.js';

// Clips NPCs use (original UAL names, so existing code that plays 'Idle_Loop' etc. keeps working).
export const PEOPLE_CLIPS = {
  // Add a clip here when an NPC that needs it moves onto the kit (each costs ~40-60 KB).
  M: ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Idle_Talking_Loop', 'Interact', 'PickUp_Table', 'Fixing_Kneeling',
    'Spell_Simple_Idle_Loop', 'Spell_Simple_Shoot', 'Crouch_Idle_Loop', 'Hit_Chest', 'Sprint_Loop', 'Death01'],
  UAL2: ['Idle_FoldArms_Loop', 'Idle_No_Loop', 'Yes', 'Idle_Lantern_Loop', 'Farm_Watering', 'Walk_Carry_Loop', 'Consume', 'Chest_Open'],
};

export async function buildPeopleClips() {
  const [m, extra] = await Promise.all([load(PACKS.M), load(PACKS.UAL2)]);
  const clips = [];
  for (const [pack, names] of Object.entries(PEOPLE_CLIPS)) for (const name of names) {
    const found = (pack === 'M' ? m : extra).animations.find(c => c.name === name);
    if (!found) throw new Error(`Missing clip ${name}`); clips.push(stripClip(found, name, { fingers: false }));
  }
  const root = m.scene; root.name = 'PeopleClips';
  const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); }); for (const o of meshes) o.parent.remove(o);
  root.userData = { author: 'DreamScape', rig: 'Quaternius Universal Animation Library 1+2 (CC0)', version: 1 };
  const buffer = await exportGLB(root, clips);
  return { buffer, stats: { bytes: buffer.byteLength, clips: clips.map(c => c.name) } };
}

// Shared pieces --------------------------------------------------------------------------
// Insert interpolated rings at the given heights, so a colour band painted by height has a crisp edge
// (vertex colours blend across a whole lathe segment otherwise).
function withRings(profile, heights) {
  const out = [...profile];
  for (const y of heights) for (let i = 0; i < out.length - 1; i++) {
    const [r0, y0] = out[i], [r1, y1] = out[i + 1];
    if ((y0 - y) * (y1 - y) < 0) { out.splice(i + 1, 0, [r0 + (r1 - r0) * (y - y0) / (y1 - y0), y]); break; }
  }
  return out;
}
// Robe weights: torso follows the spine; the lower robe splits and follows each thigh near the hem.
function robeWeights(k) {
  return p => {
    if (p.y > 1.0) { const w = k.smooth(1.02, 1.32, p.y); return [['pelvis', (1 - w) * .6], ['spine_01', (1 - w) * .4], ['spine_03', w]]; }
    const hem = k.smooth(.98, .35, p.y) * .5, left = k.smooth(-.06, .06, p.x);
    return [['pelvis', 1 - hem], ['thigh_l', hem * left], ['thigh_r', hem * (1 - left)]];
  };
}
const spineByHeight = k => p => { const w = k.smooth(1.0, 1.35, p.y); return [['pelvis', 1 - w], ['spine_03', w]]; };
// A flat strap through model-space points (stoles, cords), one box per span.
function strap(k, points, width, depth, colour, influence) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], d = b.clone().sub(a);
    k.put(new k.T.BoxGeometry(1, 1, 1), colour, influence, a.clone().add(b).multiplyScalar(.5), [width, d.length() + depth * .5, depth], k.toward(d.x, d.y, d.z));
  }
}
// Stylised head in the player's style (slightly smaller): skull, chin, nose, ears and the face shell.
function head(k, { skin = 'skin', scale = 1, ears = 'round' } = {}) {
  const s = scale, c = [0, 1.735, .012], skull = [.19 * s, .212 * s, .18 * s];
  k.tube([new k.T.Vector3(0, 1.45, -.01), new k.T.Vector3(0, 1.62, 0)], [.056, .052], ['neck_01'], skin);
  k.put(headGeometry(), skin, 'Head', c, skull);
  k.sphere(skin, 'Head', [0, 1.7, .19 * s], [.0105, .012, .013]);
  for (const side of [-1, 1]) {
    if (ears === 'pointed') k.cone(skin, 'Head', [side * .205 * s, 1.75, -.01], [.038, .14, .024], [-.35, 0, -side * 1.15]);
    else k.sphere(skin, 'Head', [side * .188 * s, 1.725, -.005], [.03, .048, .026]);
  }
  k.faceShell(new k.T.Vector3(0, 1.72, .012), [[c, skull]]);
}

// Recipes -----------------------------------------------------------------------------------
export const RECIPES = {
  // Shrine Keeper (Tower hub) and, in the Ember flashback, her younger self. Identity: Julius-like
  // warm curiosity (CHARACTER_PLAN.md 2b); look: teal and ivory priestess with an ember hairpin.
  shrineKeeper: {
    body: 'F',
    face: { iris: ['#3a1d08', '#b8691f', '#ffd58f'], restLid: .22 },
    palette: {
      skin: 0xe9c2a2, hair: 0xd9d6e2, hairShade: 0xa29cb8, teal: 0x2f6f7f, tealDark: 0x214f5b, ivory: 0xece2c9,
      gold: 0xd6a84f, crimson: 0x8f2f3b, shoe: 0x3a2b2c, bronze: 0xa8743a, glowEmber: 0xffb45a,
    },
    build(k) {
      const V = (x, y, z) => new k.T.Vector3(x, y, z), robe = robeWeights(k);
      head(k);
      // Hair: silver dome, back mass, centre-parted curtain fringe, cheek locks, a bun and the ember hairpin.
      k.put(new k.T.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * .53), 'hair', 'Head', [0, 1.765, -.002], [.204, .226, .194]);
      k.sphere('hair', 'Head', [0, 1.73, -.09], [.19, .19, .13]);
      for (const side of [-1, 1]) {
        k.sphere('hair', 'Head', [side * .085, 1.83, .14], [.115, .055, .06], [0, 0, -side * .42]);
        k.cone(side < 0 ? 'hairShade' : 'hair', 'Head', [side * .168, 1.66, .07], [.042, .2, .03], k.toward(side * .1, -1, .05), 5);
      }
      k.sphere('hair', 'Head', [0, 1.83, -.18], [.105, .095, .095]);
      k.put(new k.T.TorusGeometry(.075, .014, 6, 18), 'gold', 'Head', [0, 1.83, -.135], [1, 1, 1], [0, 0, 0]);
      for (const side of [-1, 1]) k.box('bronze', 'Head', [side * .02, 1.86, -.2], [.012, .26, .012], [0, 0, side * .75]);
      k.cone('glowEmber', 'Head', [.105, 1.96, -.2], [.022, .06, .022], k.toward(.75, 1, 0));
      // Robes: ivory under-robe, open teal over-robe with gold front edges and hem band.
      const profile = [[.06, 1.5], [.13, 1.46], [.165, 1.4], [.15, 1.3], [.132, 1.12], [.138, 1.0], [.17, .88], [.22, .5], [.27, .12], [.275, .04]];
      k.lathe(profile, 'ivory', robe, { scaleX: 1.15, scaleZ: .9 });
      const over = profile.filter(([, y]) => y <= 1.47 && y >= .1).map(([r, y]) => [r + .014, y]); over.push([.276, .1]);
      k.lathe(withRings(over, [.185, .175]), p => { const a = Math.abs(Math.atan2(p.x, p.z)); return a < .46 || p.y < .18 ? 'gold' : 'teal'; }, robe,
        { scaleX: 1.15, scaleZ: .9, gap: .72, segments: 40 });
      k.lathe([[.08, 1.53], [.14, 1.5], [.22, 1.44], [.248, 1.375], [.25, 1.355]], p => p.y < 1.367 ? 'gold' : 'teal', 'spine_03', { scaleX: 1.15, scaleZ: .92 });
      // Obi sash with a gold cord, a bow at the back, and the little shrine bell at the hip.
      k.lathe([[.158, .965], [.166, .985], [.166, 1.105], [.158, 1.125]], 'ivory', spineByHeight(k), { scaleX: 1.15, scaleZ: .92 });
      k.put(new k.T.TorusGeometry(.168, .009, 5, 28), 'gold', spineByHeight(k), [0, 1.045, 0], [1.15, 1, .92], [Math.PI / 2, 0, 0]);
      for (const side of [-1, 1]) k.sphere('ivory', 'pelvis', [side * .07, 1.06, -.17], [.075, .05, .03], [0, 0, side * .5]);
      k.box('ivory', 'pelvis', [0, .93, -.165], [.07, .2, .02]);
      k.box('gold', 'pelvis', [.13, 1.0, .11], [.006, .07, .006]);
      k.put(new k.T.CylinderGeometry(.012, .03, .045, 10), 'bronze', 'pelvis', [.13, .945, .11]);
      k.sphere('gold', 'pelvis', [.13, .918, .11], [.01, .01, .01]);
      // Crimson stole with gold edges, hanging to the knees, an ember charm at each end.
      for (const side of [-1, 1]) {
        const x = side * .072, path = [V(x, 1.47, .1), V(x, 1.31, .155), V(x * 1.05, 1.0, .175), V(x * 1.15, .62, .222)];
        strap(k, path, .06, .012, 'crimson', spineByHeight(k));
        strap(k, path.map(q => q.clone().add(V(side * .032, 0, .003))), .008, .014, 'gold', spineByHeight(k));
        k.put(new k.T.OctahedronGeometry(1, 0), 'glowEmber', 'pelvis', [x * 1.15, .6, .232], [.022, .03, .01]);
        k.box('gold', 'pelvis', [x * 1.15, .565, .225], [.05, .02, .012]);
      }
      // Bell sleeves (teal, gold cuffs) over the arms; mitten hands; soft shoes under the hem.
      for (const side of [-1, 1]) {
        const s = side > 0 ? 'l' : 'r', x = v => side * v;
        k.tube([V(x(.1), 1.44, -.065), V(x(.373), 1.44, -.07), V(x(.66), 1.44, -.065)], [.078, .076, .14], [`upperarm_${s}`, `lowerarm_${s}`], 'teal',
          { colourAt: t => t > .94 ? 'gold' : 'teal', blend: .06 });
        k.sphere('skin', `hand_${s}`, [x(.7), 1.435, -.07], [.05, .03, .055]);
        k.sphere('skin', `hand_${s}`, [x(.67), 1.415, -.035], [.02, .016, .03]);
        k.sphere('shoe', `foot_${s}`, [x(.089), .055, .01], [.055, .05, .1]);
        k.sphere('shoe', `ball_${s}`, [x(.089), .035, .11], [.05, .035, .065]);
      }
    },
  },
};

// One shared commoner for the Grimoire Tower villagers and the Crossing wanderers. The runtime
// recolours it per person (createPerson({ colors })), so all of them share a single download.
RECIPES.villager = {
  body: 'M',
  face: { iris: ['#2a1a10', '#7a4a26', '#c89a6a'], restLid: .1 },
  palette: { skin: 0xe6b48f, hair: 0x4a3428, tunic: 0x6b7a4a, trim: 0xd6b26a, pants: 0x4a4038, boots: 0x3b2a22, leather: 0x6f4a32 },
  build(k) {
    const V = (x, y, z) => new k.T.Vector3(x, y, z);
    head(k);
    // Short tousled hair: a cap, a back mass and a few fringe tufts.
    k.put(new k.T.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * .5), 'hair', 'Head', [0, 1.77, -.005], [.2, .21, .19]);
    k.sphere('hair', 'Head', [0, 1.74, -.08], [.185, .17, .12]);
    for (const x of [-.11, -.04, .04, .11]) k.cone('hair', 'Head', [x, 1.84, .14], [.05, .1, .035], k.toward(x * 1.5, -1, .35), 5);
    // Knee-length tunic with a trim band at the hem, a belt, and a small collar.
    const tunic = withRings([[.06, 1.5], [.14, 1.46], [.19, 1.4], [.18, 1.3], [.16, 1.12], [.17, .98], [.2, .85], [.215, .72]], [.765, .755]);
    k.lathe(tunic, p => p.y < .76 ? 'trim' : 'tunic', robeWeights(k), { scaleX: 1.1, scaleZ: .85 });
    k.lathe([[.08, 1.52], [.13, 1.5], [.155, 1.46]], 'trim', 'spine_03', { scaleX: 1.1, scaleZ: .9 });
    k.put(new k.T.TorusGeometry(.172, .016, 5, 24), 'leather', spineByHeight(k), [0, 1.0, 0], [1.1, 1, .86], [Math.PI / 2, 0, 0]);
    k.box('trim', 'pelvis', [0, 1.0, .148], [.045, .035, .015]);
    for (const side of [-1, 1]) {
      const s = side > 0 ? 'l' : 'r', x = v => side * v;
      // Sleeves to the wrist with a trim cuff; mitten hands.
      // The sleeve starts inside the shoulder so the lowered arm does not lift it out of the tunic.
      k.tube([V(x(.17), 1.43, -.065), V(x(.466), 1.44, -.07), V(x(.74), 1.44, -.065)], [.056, .056, .05], [`upperarm_${s}`, `lowerarm_${s}`], 'tunic',
        { colourAt: t => t > .9 ? 'trim' : 'tunic' });
      k.sphere('skin', `hand_${s}`, [x(.79), 1.435, -.068], [.052, .032, .058]);
      k.sphere('skin', `hand_${s}`, [x(.765), 1.415, -.033], [.02, .016, .03]);
      // Trousers (hip to ankle, bending at the knee) and boots.
      k.tube([V(x(.09), .96, 0), V(x(.089), .532, 0), V(x(.089), .14, -.02)], [.088, .066, .056], [`thigh_${s}`, `calf_${s}`], 'pants');
      k.tube([V(x(.089), .34, -.01), V(x(.089), .09, -.03)], [.066, .062], [`calf_${s}`], 'boots');
      k.sphere('boots', `foot_${s}`, [x(.089), .06, -.01], [.058, .056, .085]);
      k.sphere('boots', `ball_${s}`, [x(.089), .04, .11], [.054, .04, .07]);
    }
  },
};

// Legs shared by trousered characters: trousers that bend at the knee, boots and feet.
function legs(k, { pants = 'pants', boots = 'boots' } = {}) {
  const V = (x, y, z) => new k.T.Vector3(x, y, z);
  for (const side of [-1, 1]) {
    const s = side > 0 ? 'l' : 'r', x = v => side * v;
    k.tube([V(x(.09), .96, 0), V(x(.089), .532, 0), V(x(.089), .14, -.02)], [.088, .066, .056], [`thigh_${s}`, `calf_${s}`], pants);
    k.tube([V(x(.089), .34, -.01), V(x(.089), .09, -.03)], [.066, .062], [`calf_${s}`], boots);
    k.sphere(boots, `foot_${s}`, [x(.089), .06, -.01], [.058, .056, .085]);
    k.sphere(boots, `ball_${s}`, [x(.089), .04, .11], [.054, .04, .07]);
  }
}
function mittens(k, wrist, skin = 'skin') {
  for (const side of [-1, 1]) {
    const s = side > 0 ? 'l' : 'r';
    k.sphere(skin, `hand_${s}`, [side * (wrist + .05), 1.435, -.068], [.052, .032, .058]);
    k.sphere(skin, `hand_${s}`, [side * (wrist + .025), 1.415, -.033], [.02, .016, .03]);
  }
}

// Orin, Diamond artificer. Identity: Mars-like quiet precision and a former captive's weariness (plan 2b).
RECIPES.orin = {
  body: 'M',
  face: { iris: ['#14202a', '#3d6a80', '#9fd0e0'], restLid: .22 },
  palette: { skin: 0xd9a07a, hair: 0x2e2a2a, shirt: 0xd8cdb6, apron: 0x6f4a32, apronDark: 0x3e2b23, pants: 0x3a3f4a, boots: 0x2a2420,
    brass: 0xc9a25a, lens: 0x9cc8d6, glowPrism: 0xd8f4ff },
  build(k) {
    const V = (x, y, z) => new k.T.Vector3(x, y, z);
    head(k);
    // Dark hair swept back; goggles pushed up on the forehead with a leather strap.
    k.put(new k.T.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * .5), 'hair', 'Head', [0, 1.775, -.01], [.2, .2, .19]);
    k.sphere('hair', 'Head', [0, 1.75, -.085], [.185, .17, .12]);
    k.put(new k.T.TorusGeometry(.2, .013, 5, 26), 'apronDark', 'Head', [0, 1.83, -.01], [1, 1, .95], [Math.PI / 2 - .35, 0, 0]);
    for (const side of [-1, 1]) {
      k.put(new k.T.CylinderGeometry(.04, .04, .035, 12), 'brass', 'Head', [side * .062, 1.885, .14], [1, 1, 1], [.55, 0, 0]);
      k.put(new k.T.CylinderGeometry(.031, .031, .038, 12), 'lens', 'Head', [side * .062, 1.885, .142], [1, 1, 1], [.55, 0, 0]);
    }
    // Cream shirt, sleeves rolled to the elbow, bare forearms.
    k.lathe([[.06, 1.5], [.14, 1.46], [.19, 1.4], [.18, 1.3], [.16, 1.12], [.165, .95], [.17, .9]], 'shirt', robeWeights(k), { scaleX: 1.1, scaleZ: .85 });
    for (const side of [-1, 1]) {
      const s = side > 0 ? 'l' : 'r', x = v => side * v;
      k.tube([V(x(.17), 1.43, -.065), V(x(.44), 1.44, -.07)], [.058, .056], [`upperarm_${s}`], 'shirt');
      k.put(new k.T.TorusGeometry(.058, .016, 6, 14), 'shirt', `upperarm_${s}`, [x(.43), 1.44, -.07], [1, 1, 1], [0, Math.PI / 2, 0]);
      k.tube([V(x(.44), 1.44, -.07), V(x(.74), 1.44, -.065)], [.046, .04], [`lowerarm_${s}`], 'skin');
    }
    mittens(k, .74);
    // Leather apron from chest to knee (it follows the thighs below the belt), neck straps and tool belt.
    const apron = [V(0, 1.36, .155), V(0, 1.12, .16), V(0, .98, .175), V(0, .55, .215)];
    for (let i = 0; i < apron.length - 1; i++) {
      const a = apron[i], b = apron[i + 1], d = b.clone().sub(a);
      k.put(new k.T.BoxGeometry(1, 1, 1), 'apron', robeWeights(k), a.clone().add(b).multiplyScalar(.5), [.3, d.length() + .01, .014], k.toward(d.x, d.y, d.z));
    }
    for (const side of [-1, 1]) k.box('apronDark', 'spine_03', [side * .09, 1.44, .12], [.025, .14, .012], [0, 0, side * .5]);
    k.put(new k.T.TorusGeometry(.172, .02, 5, 24), 'apronDark', 'pelvis', [0, 1.0, 0], [1.1, 1, .86], [Math.PI / 2, 0, 0]);
    k.box('brass', 'pelvis', [-.17, .92, .06], [.025, .14, .025], [0, 0, .1]);
    k.box('apronDark', 'pelvis', [-.17, .99, .06], [.06, .04, .04]);
    k.box('apronDark', 'pelvis', [.17, .95, .05], [.06, .08, .05]);
    // The prism pendant: a cord and a small glowing crystal.
    k.put(new k.T.TorusGeometry(.1, .005, 4, 18), 'apronDark', 'spine_03', [0, 1.42, .06], [1, 1, 1], [Math.PI / 2 - .5, 0, 0]);
    k.put(new k.T.OctahedronGeometry(1, 0), 'glowPrism', 'spine_03', [0, 1.33, .175], [.022, .034, .016]);
    legs(k);
  },
};

// Iven, Clover scholar. Identity: William-like gentleness carrying an old guilt (plan 2b).
RECIPES.iven = {
  body: 'M',
  face: { iris: ['#1c2a1a', '#4a7a3a', '#a8d08a'], restLid: .15 },
  palette: { skin: 0xe6b48f, hair: 0x8fa58a, coat: 0x40603f, trim: 0xd9c88a, shirt: 0xece2c9, leaf: 0x9bc46b, frame: 0x6b5a3a, lens: 0xd5e6ea,
    pants: 0x4a4038, boots: 0x3b2a22, satchel: 0x7a3b2e, pages: 0xeee4c8 },
  build(k) {
    const V = (x, y, z) => new k.T.Vector3(x, y, z);
    head(k);
    // Soft, longer hair: cap, back mass, a parted fringe and locks to the jaw.
    k.put(new k.T.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * .52), 'hair', 'Head', [0, 1.77, -.005], [.205, .215, .195]);
    k.sphere('hair', 'Head', [0, 1.72, -.085], [.19, .2, .13]);
    for (const side of [-1, 1]) {
      k.sphere('hair', 'Head', [side * .08, 1.83, .14], [.11, .05, .055], [0, 0, -side * .35]);
      k.cone('hair', 'Head', [side * .17, 1.67, .05], [.045, .16, .035], k.toward(side * .05, -1, .05), 5);
    }
    if (!this.young) { // round spectacles at eye level, in front of the painted eyes
      for (const side of [-1, 1]) {
        k.put(new k.T.TorusGeometry(.038, .005, 5, 16), 'frame', 'Head', [side * .077, 1.728, .205]);
        k.put(new k.T.CircleGeometry(.036, 14), 'lens', 'Head', [side * .077, 1.728, .204]);
      }
      k.box('frame', 'Head', [0, 1.732, .208], [.04, .006, .006]);
    }
    // Ivory shirt under a long open moss coat with gold edges; leaf pins on the lapels.
    k.lathe([[.06, 1.5], [.14, 1.46], [.185, 1.4], [.175, 1.3], [.155, 1.12], [.165, .95], [.17, .88]], 'shirt', robeWeights(k), { scaleX: 1.1, scaleZ: .85 });
    const coat = withRings([[.08, 1.5], [.15, 1.46], [.2, 1.4], [.19, 1.3], [.17, 1.12], [.18, .98], [.21, .8], [.23, .42]], [.465, .455]);
    k.lathe(coat, p => Math.abs(Math.atan2(p.x, p.z)) < .5 || p.y < .46 ? 'trim' : 'coat', robeWeights(k), { scaleX: 1.12, scaleZ: .88, gap: .75, segments: 36 });
    for (const side of [-1, 1]) k.put(new k.T.ConeGeometry(1, 1, 4), 'leaf', 'spine_03', [side * .09, 1.38, .18], [.022, .045, .01], [0, 0, side * .5]);
    for (const side of [-1, 1]) {
      const s = side > 0 ? 'l' : 'r', x = v => side * v;
      k.tube([V(x(.17), 1.43, -.065), V(x(.466), 1.44, -.07), V(x(.74), 1.44, -.065)], [.062, .058, .055], [`upperarm_${s}`, `lowerarm_${s}`], 'coat',
        { colourAt: t => t > .9 ? 'trim' : 'coat' });
    }
    mittens(k, .74);
    // Book satchel at the left hip on a strap across the chest, a book peeking out.
    k.box('satchel', 'pelvis', [.2, .9, .03], [.07, .17, .2], [0, 0, -.06]);
    k.box('pages', 'pelvis', [.2, 1.0, .05], [.05, .06, .14], [0, 0, -.06]);
    for (const [a, b] of [[V(-.15, 1.44, .14), V(.2, 1.0, .19)], [V(-.15, 1.44, -.15), V(.2, 1.0, -.15)]]) {
      const d = b.clone().sub(a);
      k.put(new k.T.BoxGeometry(1, 1, 1), 'satchel', 'spine_03', a.clone().add(b).multiplyScalar(.5), [.035, d.length(), .012], k.toward(d.x, d.y, d.z));
    }
    legs(k);
  },
};
RECIPES.ivenYoung = { ...RECIPES.iven, young: true, palette: { ...RECIPES.iven.palette, hair: 0x3a3328 } };

// Neris, Spade resistance guide. Identity: Nacht-like stern secrecy (plan 2b). Her wisp lantern is
// added at runtime (npc.js), so it can glow and bob independently of her hand.
RECIPES.neris = {
  body: 'F',
  face: { iris: ['#1d1830', '#5b4a8a', '#a99ad6'], restLid: .32 },
  palette: { skin: 0xe0b49a, hair: 0x1f1a26, cloak: 0x2e2448, cloakDark: 0x1f1833, lining: 0x4a3a6e, scarf: 0x3a2f55, wrap: 0x5a4a6a,
    rope: 0x8a7a5a, shoe: 0x241c2a, glowWisp: 0xd9c8ff },
  build(k) {
    const V = (x, y, z) => new k.T.Vector3(x, y, z);
    head(k);
    // Dark straight hair falling behind the shoulders, side bangs, under a raised hood open at the face.
    k.put(new k.T.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * .5), 'hair', 'Head', [0, 1.77, -.005], [.205, .215, .195]);
    k.box('hair', 'Head', [0, 1.6, -.13], [.24, .3, .08]);
    for (const side of [-1, 1]) k.cone('hair', 'Head', [side * .14, 1.74, .13], [.05, .15, .035], k.toward(side * .25, -1, .2), 5);
    k.put(new k.T.SphereGeometry(1, 16, 10, Math.PI * .72, Math.PI * 1.56, 0, Math.PI * .7), p => p.y < 1.63 ? 'lining' : 'cloak', 'Head', [0, 1.75, -.01], [.245, .25, .235]);
    // The lowered scarf mask around her neck.
    k.put(new k.T.TorusGeometry(.085, .035, 8, 18), 'scarf', 'neck_01', [0, 1.5, .015], [1.1, .8, 1], [Math.PI / 2 - .3, 0, 0]);
    // Dark wrap dress under a floor-length cloak open at the front, a shoulder capelet over it.
    const profile = [[.06, 1.5], [.13, 1.46], [.16, 1.4], [.145, 1.3], [.125, 1.12], [.13, 1.0], [.16, .88], [.21, .5], [.25, .12], [.255, .04]];
    k.lathe(profile, 'wrap', robeWeights(k), { scaleX: 1.12, scaleZ: .9 });
    const cloak = profile.filter(([, y]) => y <= 1.47).map(([r, y]) => [r + .016, y]);
    k.lathe(cloak, p => Math.abs(Math.atan2(p.x, p.z)) < .5 ? 'lining' : 'cloak', robeWeights(k), { scaleX: 1.12, scaleZ: .9, gap: .8, segments: 32 });
    k.lathe([[.08, 1.53], [.14, 1.5], [.21, 1.44], [.235, 1.37], [.235, 1.355]], 'cloakDark', 'spine_03', { scaleX: 1.12, scaleZ: .92 });
    // Rope belt with three wisp charms (one per memory lantern, in the story).
    k.put(new k.T.TorusGeometry(.15, .012, 5, 24), 'rope', 'pelvis', [0, 1.0, 0], [1.12, 1, .9], [Math.PI / 2, 0, 0]);
    for (const [x, z] of [[-.08, .13], [0, .14], [.08, .13]]) {
      k.box('rope', 'pelvis', [x, .95, z], [.005, .08, .005]);
      k.put(new k.T.OctahedronGeometry(1, 0), 'glowWisp', 'pelvis', [x, .9, z + .005], [.016, .022, .012]);
    }
    for (const side of [-1, 1]) {
      const s = side > 0 ? 'l' : 'r', x = v => side * v;
      k.tube([V(x(.13), 1.43, -.065), V(x(.373), 1.44, -.07), V(x(.64), 1.44, -.065)], [.055, .05, .046], [`upperarm_${s}`, `lowerarm_${s}`], 'wrap',
        { colourAt: t => t > .88 ? 'cloakDark' : 'wrap' });
      k.sphere('shoe', `foot_${s}`, [x(.089), .055, .01], [.055, .05, .1]);
      k.sphere('shoe', `ball_${s}`, [x(.089), .035, .11], [.05, .035, .065]);
    }
    mittens(k, .64);
  },
};

// The Triad (flashbacks and the finale): villains readable at 30 m. Motifs inspired by Black
// Clover's Dark Triad (a crown, bones, horns and wings), built as our own designs; plan 2b/5.12.
// Dark sclera and glowing irises make them read as menacing; `mood` is each one's resting face.
function triadRobe(k, profile, colour, { scaleX = 1.15, scaleZ = .92, gap = 0, segments = 28 } = {}) {
  k.lathe(profile, colour, robeWeights(k), { scaleX, scaleZ, gap, segments });
}
// Ragged hem: hanging shards around a robe's bottom edge, each following its side's thigh.
function raggedHem(k, colour, radius, y, count = 14, scaleX = 1.15, scaleZ = .92) {
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2, x = Math.sin(a) * radius * scaleX, z = Math.cos(a) * radius * scaleZ, len = .12 + (i % 3) * .06;
    k.put(new k.T.ConeGeometry(1, 1, 3), colour, robeWeightsAt(k, x), [x, y - len / 2, z], [.05, len, .02], k.toward(0, -1, 0).multiply(new k.T.Quaternion().setFromAxisAngle(new k.T.Vector3(0, 1, 0), a)));
  }
}
const robeWeightsAt = (k, x) => () => { const left = k.smooth(-.06, .06, x); return [['pelvis', .5], ['thigh_l', .5 * left], ['thigh_r', .5 * (1 - left)]]; };
// Sharp shoulder spikes for a villain silhouette.
function shoulderSpikes(k, colour, x, y, bone, n = 3) {
  for (let i = 0; i < n; i++) k.cone(colour, bone, [x * (1 + i * .12), y + .02, -.06 + (i - 1) * .06], [.03, .14 - i * .02, .03], k.toward(Math.sign(x) * .6, 1, (i - 1) * .3), 5);
}

// Veyr the Binder: a jagged silver crown set with violet gems, spiked pauldrons, a tattered
// floor-length robe, binding chains circling him and a sigil on his palm. Dark violet hair.
RECIPES.veyr = {
  body: 'M',
  face: { iris: ['#2a0a4a', '#9b4dff', '#e6ccff'], restLid: .4, sclera: '#1b1222', mood: 'focus' },
  palette: { skin: 0xc9b8c8, hair: 0x241232, robe: 0x0e0a14, robeEdge: 0x4a1f7a, mantle: 0x1a1028, iron: 0x16121c, silver: 0xc3c7d2, silverDark: 0x7d8296,
    glowChain: 0xa77bff, glowSigil: 0xd9c2ff, glowGem: 0xb57bff, boots: 0x0a070e },
  build(k) {
    const V = (x, y, z) => new k.T.Vector3(x, y, z);
    head(k);
    // Dark violet hair swept back in sharp locks.
    k.put(new k.T.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * .52), 'hair', 'Head', [0, 1.775, -.01], [.205, .215, .2]);
    k.sphere('hair', 'Head', [0, 1.74, -.1], [.19, .18, .12]);
    for (const x of [-.14, -.07, 0, .07, .14]) k.cone('hair', 'Head', [x, 1.86, -.06], [.05, .18, .035], k.toward(x * .6, .2, -1), 5);
    for (const side of [-1, 1]) k.cone('hair', 'Head', [side * .16, 1.7, .04], [.04, .17, .03], k.toward(side * .15, -1, .05), 5);
    // The crown: a silver band with seven jagged points, violet gems glowing in the tallest.
    k.put(new k.T.CylinderGeometry(.205, .215, .05, 18, 1, true), 'silver', 'Head', [0, 1.885, -.01]);
    k.put(new k.T.TorusGeometry(.212, .008, 4, 24), 'silverDark', 'Head', [0, 1.862, -.01], [1, 1, 1], [Math.PI / 2, 0, 0]);
    [[0, .2], [.45, .14], [-.45, .14], [.9, .11], [-.9, .11], [1.35, .09], [-1.35, .09]].forEach(([a, h]) => {
      const x = Math.sin(a) * .2, z = Math.cos(a) * .19 - .01;
      k.cone('silver', 'Head', [x, 1.91 + h / 2, z], [.03, h, .02], [0, a, 0], 4);
      if (h > .12) k.put(new k.T.OctahedronGeometry(1, 0), 'glowGem', 'Head', [x * 1.04, 1.9, z * 1.04], [.014, .02, .01]);
    });
    // Floor-length robe with a violet seam, a tattered hem, and a long mantle over the left shoulder.
    const robe = withRings([[.06, 1.5], [.13, 1.46], [.16, 1.4], [.145, 1.25], [.125, 1.05], [.15, .8], [.19, .3], [.21, .1]], [.15, .14]);
    triadRobe(k, robe, p => Math.abs(Math.atan2(p.x, p.z)) < .1 ? 'robeEdge' : 'robe', { scaleX: 1.05, scaleZ: .9 });
    raggedHem(k, 'robe', .21, .11, 14, 1.05, .9);
    k.lathe([[.08, 1.53], [.15, 1.5], [.22, 1.44], [.25, 1.37]], 'mantle', 'spine_03', { scaleX: 1.12, scaleZ: .92 });
    const drape = [V(.17, 1.45, .05), V(.21, 1.15, .13), V(.22, .7, .17), V(.23, .12, .16)];
    for (let i = 0; i < drape.length - 1; i++) {
      const a = drape[i], b = drape[i + 1], d = b.clone().sub(a);
      k.put(new k.T.BoxGeometry(1, 1, 1), i ? 'mantle' : 'robeEdge', robeWeights(k), a.clone().add(b).multiplyScalar(.5), [.17, d.length() + .02, .02], k.toward(d.x, d.y, d.z));
    }
    // Binding chains: three tilted glowing loops (YXZ: tip flat, then turn the tilt around him).
    for (const [y, r, tilt, spin] of [[1.32, .27, .35, .3], [1.0, .26, -.3, 1.1], [.6, .3, .25, 2]]) {
      const q = new k.T.Quaternion().setFromEuler(new k.T.Euler(Math.PI / 2 + tilt, spin, 0, 'YXZ'));
      k.put(new k.T.TorusGeometry(r, .012, 4, 32), 'glowChain', y > 1.1 ? 'spine_03' : 'pelvis', [0, y, 0], [1, 1, 1], q);
    }
    for (const side of [-1, 1]) {
      const s = side > 0 ? 'l' : 'r', x = v => side * v;
      k.sphere('iron', `upperarm_${s}`, [x(.24), 1.47, -.065], [.1, .07, .1]);
      shoulderSpikes(k, 'iron', x(.25), 1.5, `upperarm_${s}`);
      k.tube([V(x(.17), 1.43, -.065), V(x(.466), 1.44, -.07), V(x(.74), 1.44, -.065)], [.058, .056, .07], [`upperarm_${s}`, `lowerarm_${s}`], 'robe',
        { colourAt: t => t > .9 ? 'robeEdge' : 'robe' });
      k.sphere('boots', `foot_${s}`, [x(.089), .055, .01], [.055, .05, .1]);
      k.sphere('boots', `ball_${s}`, [x(.089), .035, .11], [.05, .035, .065]);
    }
    mittens(k, .74, 'iron'); // black iron gauntlets
    k.put(new k.T.CircleGeometry(.05, 6), 'glowSigil', 'hand_r', [-.79, 1.405, -.068], [1, 1, 1], [Math.PI / 2, 0, 0]);
  },
};

// Sile the Harvester: curved horns, spread bat-like wings, a crimson-and-black harvest gown with
// a jagged collar, vials of stolen current at her belt. Wild dark crimson hair; a fierce glare.
RECIPES.sile = {
  body: 'F',
  face: { iris: ['#3a0008', '#ff2a4a', '#ffb0bd'], restLid: .12, sclera: '#200a10', mood: 'determined' },
  palette: { skin: 0xe8c2b8, hair: 0x4a0a1a, hairTip: 0x8a1530, horn: 0x1a0c10, hornTip: 0x5a1a22, gown: 0x6a0f24, gownDark: 0x1a050c,
    membrane: 0x4a0814, wingBone: 0x14080c, glass: 0x9fc6d2, glowCurrent: 0x6fe6ff, brass: 0x8a6a3a, shoe: 0x12060a },
  build(k) {
    const V = (x, y, z) => new k.T.Vector3(x, y, z);
    head(k);
    // Wild dark crimson hair: a cap and flicked spikes with brighter tips.
    k.put(new k.T.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * .56), 'hair', 'Head', [0, 1.77, -.005], [.215, .225, .205]);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (.35 + 1.3 * i / 8), sx = Math.sin(a), sz = Math.cos(a);
      k.cone(i % 2 ? 'hairTip' : 'hair', 'Head', [sx * .19, 1.7, sz * .17 - .02], [.055, .17, .04], k.toward(sx * .9, -.6, sz * .7), 5);
    }
    for (const x of [-.1, 0, .1]) k.cone('hair', 'Head', [x, 1.85, .15], [.05, .12, .035], k.toward(x * 2, -1, .4), 5);
    // Horns: three tapering segments curving up and back from each temple.
    for (const side of [-1, 1]) {
      [[.15, 1.88, .02, .04, .1, [.3, 1, -.2]], [.19, 1.96, -.01, .03, .09, [.15, 1, -.7]], [.2, 2.02, -.07, .018, .08, [-.1, .5, -1]]].forEach(([x, y, z, r, h, d], i) =>
        k.cone(i === 2 ? 'hornTip' : 'horn', 'Head', [side * x, y, z], [r, h, r], k.toward(side * d[0], d[1], d[2]), 6));
    }
    // Gown: fitted, flaring to the floor, black at the hem; a jagged collar of points.
    const gown = withRings([[.06, 1.5], [.13, 1.46], [.155, 1.4], [.13, 1.2], [.122, 1.05], [.16, .85], [.24, .4], [.3, .04]], [.2, .19]);
    triadRobe(k, gown, p => p.y < .195 ? 'gownDark' : 'gown', { scaleX: 1.12, scaleZ: .92 });
    raggedHem(k, 'gownDark', .3, .06, 16, 1.12, .92);
    for (let i = 0; i < 9; i++) {
      const a = (i / 8 - .5) * Math.PI * 1.4, x = Math.sin(a) * .2, z = Math.cos(a) * .16;
      k.cone('gownDark', 'spine_03', [x, 1.52, z - .02], [.03, .12, .015], k.toward(x * 2, 1, z * 1.5), 3);
    }
    // Wings: three bone fingers on each side, membranes between them, folded half open.
    for (const side of [-1, 1]) {
      const root = V(side * .08, 1.38, -.17), tips = [V(side * .75, 1.95, -.42), V(side * .85, 1.45, -.45), V(side * .6, .95, -.38)];
      for (const tip of tips) {
        const d = tip.clone().sub(root);
        k.put(new k.T.CylinderGeometry(.008, .016, d.length(), 5), 'wingBone', 'spine_03', root.clone().add(tip).multiplyScalar(.5), [1, 1, 1], k.toward(d.x, d.y, d.z));
      }
      for (let i = 0; i < tips.length - 1; i++) {
        const g = new k.T.BufferGeometry(), a = tips[i], b = tips[i + 1], mid = a.clone().lerp(b, .5).lerp(root, .3); // scalloped edge
        g.setAttribute('position', new k.T.Float32BufferAttribute([...root.toArray(), ...a.toArray(), ...mid.toArray(), ...root.toArray(), ...mid.toArray(), ...b.toArray()], 3));
        g.computeVertexNormals(); k.put(g, 'membrane', 'spine_03', [0, 0, 0]);
      }
      k.cone('wingBone', 'spine_03', [side * .76, 2.0, -.42], [.012, .08, .012], k.toward(side * .4, 1, 0), 4); // wing claw
    }
    // Belt with vials of stolen current.
    k.put(new k.T.TorusGeometry(.135, .01, 4, 22), 'brass', 'pelvis', [0, 1.0, 0], [1.12, 1, .92], [Math.PI / 2, 0, 0]);
    for (const x of [-.11, .11]) {
      k.put(new k.T.CylinderGeometry(.022, .022, .08, 8), 'glass', 'pelvis', [x, .94, .1]);
      k.put(new k.T.CylinderGeometry(.016, .016, .07, 8), 'glowCurrent', 'pelvis', [x, .94, .1]);
    }
    for (const side of [-1, 1]) {
      const s = side > 0 ? 'l' : 'r', x = v => side * v;
      k.tube([V(x(.13), 1.43, -.065), V(x(.373), 1.44, -.07), V(x(.64), 1.44, -.065)], [.05, .048, .07], [`upperarm_${s}`, `lowerarm_${s}`], 'gown',
        { colourAt: t => t > .86 ? 'gownDark' : 'gown' });
      k.sphere('shoe', `foot_${s}`, [x(.089), .055, .01], [.055, .05, .1]);
      k.sphere('shoe', `ball_${s}`, [x(.089), .035, .11], [.05, .035, .065]);
    }
    mittens(k, .64);
  },
};

// Morcant the Gatekeeper: a heavy armoured warden. A rounded charcoal cuirass whose ribs are raised
// bone ridges around the glowing inversion core, a bone helm with a spiked crest, layered bone
// pauldrons, a long ragged cape with a collar of bone spikes, and the key staff on his back.
RECIPES.morcant = {
  body: 'M',
  face: { iris: ['#3a2a00', '#e0a020', '#fff0b0'], restLid: .45, sclera: '#15130f', mood: 'focus' },
  palette: { skin: 0xb89880, hair: 0x15151a, plate: 0x24242c, plateEdge: 0x3c3c48, under: 0x111115, bone: 0xcfc4a8, boneShade: 0x8a8068,
    cape: 0x16121a, capeEdge: 0x2c2430, brass: 0x8a6a38, glowCore: 0xf0c050, boots: 0x0e0e12 },
  build(k) {
    const V = (x, y, z) => new k.T.Vector3(x, y, z);
    head(k);
    // Helm: a dark dome to the brow, a bone a brow ridge, cheek guards and a crest of spikes front to back.
    k.put(new k.T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * .44), 'plate', 'Head', [0, 1.745, .005], [.222, .238, .212]); // dark helm, bone trim
    k.put(new k.T.TorusGeometry(.2, .018, 5, 20, Math.PI * .9), 'boneShade', 'Head', [0, 1.79, .02], [1, 1, .95], [Math.PI / 2 - .1, 0, Math.PI * .05]);
    for (const side of [-1, 1]) k.put(new k.T.BoxGeometry(1, 1, 1), 'plateEdge', 'Head', [side * .2, 1.7, .04], [.03, .12, .11], k.toward(side * .15, 1, .2));
    for (let i = 0; i < 5; i++) k.cone('bone', 'Head', [0, 1.98 - Math.abs(i - 1.5) * .025, .12 - i * .075], [.035, .2 - i * .022, .045], k.toward(0, 1, -.3 - i * .15), 4);
    // Rounded cuirass, its edge trimmed; the raised bone ribs follow its curve.
    const cuirass = [[.17, 1.0], [.2, 1.1], [.232, 1.26], [.24, 1.36], [.205, 1.45], [.12, 1.5]];
    const torso = p => { const w = k.smooth(1.02, 1.3, p.y); return [['spine_01', 1 - w], ['spine_03', w]]; };
    k.lathe(cuirass, p => p.y > 1.44 ? 'plateEdge' : 'plate', torso, { scaleX: 1.18, scaleZ: .95, segments: 28 });
    const radiusAt = y => { for (let i = 0; i < cuirass.length - 1; i++) { const [r0, y0] = cuirass[i], [r1, y1] = cuirass[i + 1]; if (y >= y0 && y <= y1) return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return .2; };
    for (const y of [1.4, 1.32, 1.24, 1.16]) for (const side of [-1, 1]) {
      const pts = [0, 1, 2, 3, 4].map(i => { const a = .1 + i * .26, yy = y - i * .025, r = radiusAt(yy) + .012; return V(side * Math.sin(a) * r * 1.18, yy, Math.cos(a) * r * .95); });
      k.tube(pts, [.016, .016, .015, .013, .01], Array(4).fill(y > 1.2 ? 'spine_03' : 'spine_02'), 'bone', { sides: 5, steps: 1 });
    }
    k.tube([V(0, 1.45, .2), V(0, 1.3, .232), V(0, 1.12, .2)], [.022, .024, .02], ['spine_03', 'spine_02'], 'bone', { sides: 6 }); // sternum
    k.put(new k.T.TorusGeometry(.055, .014, 6, 18), 'boneShade', 'spine_03', [0, 1.3, .232]);
    k.put(new k.T.SphereGeometry(1, 12, 8), 'glowCore', 'spine_03', [0, 1.3, .236], [.045, .045, .025]);
    // Belt and split armour plates over the hips and thighs, bone-edged.
    k.put(new k.T.TorusGeometry(.2, .025, 5, 22), 'boneShade', 'pelvis', [0, 1.0, 0], [1.15, 1, .95], [Math.PI / 2, 0, 0]);
    k.lathe(withRings([[.2, .99], [.235, .86], [.265, .7], [.268, .69]], [.715, .705]), p => p.y < .71 ? 'bone' : 'plate', robeWeights(k), { scaleX: 1.12, scaleZ: .95, gap: .55, segments: 24 });
    // Long ragged cape hanging from the shoulders at the back, a collar of bone spikes above it.
    k.lathe([[.2, 1.46], [.27, 1.38], [.3, 1.0], [.34, .5], [.37, .12]], p => p.y < .2 ? 'capeEdge' : 'cape', robeWeights(k), { scaleX: 1.1, scaleZ: 1, gap: 3.4, segments: 14, at: [0, 0, -.03] });
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + (i / 11 - .5) * 2.6, x = Math.sin(a) * .37 * 1.1, z = Math.cos(a) * .37 - .03, len = .1 + (i % 3) * .07;
      k.put(new k.T.ConeGeometry(1, 1, 3), 'cape', robeWeightsAt(k, x), [x, .12 - len / 2, z], [.06, len, .02], k.toward(0, -1, 0));
    }
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6 - .5) * 2.2; k.cone('bone', 'spine_03', [Math.sin(a) * .17, 1.5, Math.cos(a) * .15], [.025, .14, .025], k.toward(Math.sin(a) * .5, 1, Math.cos(a) * .6), 4); }
    for (const side of [-1, 1]) {
      const s = side > 0 ? 'l' : 'r', x = v => side * v;
      // Layered bone pauldrons with spikes.
      k.sphere('boneShade', `upperarm_${s}`, [x(.24), 1.47, -.065], [.13, .085, .14]);
      k.sphere('bone', `upperarm_${s}`, [x(.22), 1.52, -.065], [.1, .06, .11]);
      shoulderSpikes(k, 'bone', x(.26), 1.55, `upperarm_${s}`);
      // Dark sleeves, plated forearms ringed with bone at the wrist and elbow.
      k.tube([V(x(.17), 1.43, -.065), V(x(.466), 1.44, -.07)], [.066, .062], [`upperarm_${s}`], 'under');
      k.tube([V(x(.466), 1.44, -.07), V(x(.74), 1.44, -.065)], [.07, .076], [`lowerarm_${s}`], 'plate');
      for (const ax of [.48, .72]) k.put(new k.T.TorusGeometry(.074, .014, 5, 14), 'bone', `lowerarm_${s}`, [x(ax), 1.44, -.068], [1, 1, 1], [0, Math.PI / 2, 0]);
    }
    mittens(k, .74, 'plate');
    legs(k, { pants: 'under', boots: 'plate' });
    // The gate key staff across his back, over the cape.
    const shaft = [V(.32, .5, -.33), V(-.3, 1.8, -.33)], d = shaft[1].clone().sub(shaft[0]);
    k.put(new k.T.CylinderGeometry(.02, .02, d.length(), 8), 'brass', 'spine_03', shaft[0].clone().add(shaft[1]).multiplyScalar(.5), [1, 1, 1], k.toward(d.x, d.y, d.z));
    k.put(new k.T.TorusGeometry(.08, .018, 6, 16), 'brass', 'spine_03', [-.34, 1.88, -.33]);
    for (const [y, w] of [[.56, .12], [.64, .08]]) k.box('brass', 'spine_03', [.34 + w / 2, y, -.33], [w, .04, .03]);
  },
};

// Sera, Heart's river guardian. Identity: Loropechika-like serenity and formality with sudden steel
// (plan 2b). Coral and deep red with water-blue sashes, a pearl circlet set with a red Heart crystal,
// and two wavy ribbons of glowing water circling her.
RECIPES.sera = {
  body: 'F',
  face: { iris: ['#06303a', '#1fa8b8', '#a8f0f0'], restLid: .22, mood: 'smile' },
  palette: { skin: 0xf2d3c0, hair: 0x1d5a6e, hairLight: 0x3a8fa0, coral: 0xe0705e, deep: 0x8a1c2c, sash: 0x5fc6d8, sashDark: 0x2f8ea0,
    pearl: 0xf4ece0, shoe: 0x5a1a22, glowWater: 0x8ff4ff, glowCrystal: 0xff6f8f },
  build(k) {
    const V = (x, y, z) => new k.T.Vector3(x, y, z);
    head(k);
    // Long deep-teal hair: a cap, a centre-parted fringe, locks to the chest and a fall to the waist.
    k.put(new k.T.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * .54), 'hair', 'Head', [0, 1.77, -.005], [.212, .222, .202]);
    for (const side of [-1, 1]) {
      k.sphere('hair', 'Head', [side * .085, 1.83, .14], [.11, .05, .055], [0, 0, -side * .4]);
      k.cone(side < 0 ? 'hairLight' : 'hair', 'Head', [side * .16, 1.58, .07], [.045, .32, .03], k.toward(side * .05, -1, .06), 5);
    }
    k.tube([V(0, 1.72, -.12), V(0, 1.45, -.2), V(0, 1.1, -.21), V(0, .92, -.2)], [.15, .14, .11, .03], ['Head', 'spine_03', 'spine_02'], 'hair', { sides: 10, squash: .45 });
    // Pearl circlet with a red Heart crystal on the brow and small shells at the temples.
    k.put(new k.T.TorusGeometry(.205, .011, 5, 26), 'pearl', 'Head', [0, 1.82, .0], [1, 1, .97], [Math.PI / 2 - .25, 0, 0]);
    k.put(new k.T.OctahedronGeometry(1, 0), 'glowCrystal', 'Head', [0, 1.875, .2], [.02, .034, .014]);
    for (const side of [-1, 1]) {
      k.sphere('pearl', 'Head', [side * .19, 1.79, .05], [.03, .035, .015], [0, side * .9, 0]);
      k.sphere('pearl', 'Head', [side * .19, 1.69, .0], [.012, .012, .012]); // earrings
    }
    // Deep-red gown under an open coral over-robe edged in water blue; a wide sash with long tails.
    const robe = robeWeights(k), profile = [[.06, 1.5], [.13, 1.46], [.16, 1.4], [.14, 1.28], [.122, 1.1], [.135, 1.0], [.17, .86], [.23, .45], [.29, .1], [.3, .03]];
    k.lathe(profile, 'deep', robe, { scaleX: 1.12, scaleZ: .9 });
    const over = profile.filter(([, y]) => y <= 1.47 && y >= .1).map(([r, y]) => [r + .015, y]);
    k.lathe(withRings(over, [.185, .175]), p => Math.abs(Math.atan2(p.x, p.z)) < .5 || p.y < .18 ? 'sash' : 'coral', robe, { scaleX: 1.12, scaleZ: .9, gap: .75, segments: 36 });
    k.lathe([[.158, .96], [.166, .98], [.166, 1.1], [.158, 1.12]], 'sash', spineByHeight(k), { scaleX: 1.14, scaleZ: .92 });
    for (const side of [-1, 1]) k.box('sashDark', 'pelvis', [side * .05, .78, -.17], [.07, .42, .012], [.08, 0, side * .1]);
    // Two wavy ribbons of glowing water circling her (chest and hips), like a slow current.
    for (const [y, r, waves, bone] of [[1.25, .32, 3, 'spine_03'], [.82, .4, 4, 'pelvis']]) {
      const pts = Array.from({ length: 33 }, (_, i) => { const a = i / 32 * Math.PI * 2; return V(Math.sin(a) * r * 1.1, y + Math.sin(a * waves) * .06, Math.cos(a) * r); });
      k.tube(pts, pts.map(() => .011), Array(32).fill(bone), 'glowWater', { sides: 5, steps: 1 });
    }
    // Flowing coral sleeves with blue cuffs, mitten hands, soft shoes.
    for (const side of [-1, 1]) {
      const s = side > 0 ? 'l' : 'r', x = v => side * v;
      k.tube([V(x(.1), 1.44, -.065), V(x(.373), 1.44, -.07), V(x(.66), 1.44, -.065)], [.072, .074, .13], [`upperarm_${s}`, `lowerarm_${s}`], 'coral',
        { colourAt: t => t > .93 ? 'sash' : 'coral', blend: .06 });
      k.sphere('shoe', `foot_${s}`, [x(.089), .055, .01], [.055, .05, .1]);
      k.sphere('shoe', `ball_${s}`, [x(.089), .035, .11], [.05, .035, .065]);
    }
    mittens(k, .64);
  },
};

// Her younger self for the Ember flashback: the same priestess, with dark hair not yet silver.
RECIPES.shrineKeeperYoung = { ...RECIPES.shrineKeeper, palette: { ...RECIPES.shrineKeeper.palette, hair: 0x3d3047, hairShade: 0x5c4a6b } };

export async function buildPerson(name) {
  const recipe = RECIPES[name]; if (!recipe) throw new Error(`Unknown recipe ${name}`);
  const asset = await load(PACKS[recipe.body]);
  const k = createBody(asset, recipe.palette);
  recipe.build(k);
  const { root, stats } = k.finish(name);
  root.userData = { author: 'DreamScape', recipe: name, face: recipe.face, palette: recipe.palette, rig: 'Quaternius Universal Animation Library (CC0)', version: 1 };
  const buffer = await exportGLB(root);
  return { buffer, stats: { name, bytes: buffer.byteLength, ...stats } };
}
