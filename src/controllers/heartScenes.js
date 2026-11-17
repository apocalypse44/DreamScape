// Heart's earthquake vision: the Resonance Reef tears out of the ground and rises into the sky.
// Registered with cloverScenes.define(); played through Nim's scrying shell in Clover ('nim'), or on
// arrival at the Heart gate if the player skipped Nim ('gate'). The shot's clock drives the quake
// (model.quakeTo), so pausing on a line pauses the quake too, and skipping (X) snaps it to the end.
import { HEART_QUAKE } from '../models/heartCampaign.js';

const QUAKE_START = 1.2; // seconds into the shot: after the ripple-in, before the first line ends

export function heartVisionShot({ model, terrainHeight, from = 'nim' }) {
  const layout = model.layout, c = layout.reef, g = terrainHeight(c.x, c.z);
  // Camera spots are given relative to an older layout whose reef sat 85 m from the gate; shift them with it.
  const shift = layout.reefAlong - 85;
  const v = (along, side, up) => { const p = layout.at(along + shift, side); return new THREE.Vector3(p.x, g + up, p.z); };
  const centre = up => new THREE.Vector3(c.x, g + up, c.z);
  const rise = QUAKE_START + HEART_QUAKE.burst; // the islands start to lift
  const lines = from === 'nim'
    ? [
      [0.6, 'NIM · THE SCRYING SHELL', 'This shell shows me Heart. That’s happening right now.'],
      [QUAKE_START + 1.6, 'NIM', 'An earthquake! The ground near Sera’s springs is tearing open.'],
      [rise + 1.5, 'NIM', 'The land… it’s lifting into the sky!'],
      [rise + 5.2, 'SERA · THROUGH THE SHELL', 'Traveller, if you have the Tide Hook, come quickly. It’s the only way up there.'],
    ]
    : [
      [0.6, 'HEART KINGDOM', 'The ground shudders under the gate.'],
      [QUAKE_START + 1.6, 'SERA · FROM THE SPRING', 'Earthquake! Hold on, traveller. The springs are tearing open!'],
      [rise + 5.2, 'SERA', 'I’m Sera, keeper of Heart’s springs. The land has lifted into the sky, and your Tide Hook is the only way up. Find me by the gate.'],
    ];
  return {
    title: from === 'nim' ? 'A VISION · THE RESONANCE REEF' : 'THE RESONANCE REEF',
    chapter: 'IV · THE HEART KINGDOM',
    flashback: from === 'nim' ? 'vision' : undefined, // memory styling for the shell's vision (no flashback staging)
    // Every spot sits east of Tidewell's wall (along 92) so the town never blocks the view, and 20 m+
    // clear of the islands as they rise.
    keys: [
      [0, v(32, -30, 14), centre(2)],
      [QUAKE_START + 1.8, v(40, -40, 9), centre(1)],              // the fissures spread toward the camera
      [rise + 0.6, v(48, -50, 6), centre(6)],                     // low as the dust bursts
      [rise + 3.5, v(52, -62, 10), centre(24)],                   // looking up at the rising spikes
      [rise + 6.5, v(58, -72, 26), centre(30)],
      [rise + 9, v(50, -64, 34), centre(30)],
    ],
    lines,
    fx: t => model.quakeTo(t - QUAKE_START),
    focus: () => c, // stream Heart's land around the reef while the camera is there
  };
}
