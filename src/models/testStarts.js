// Explicit test checkpoints. Apply after a normal reset; advance earlier
// chapters silently so their reward callbacks do not queue old cutscenes.
import { SUMMIT_ARRIVAL } from './skyIsland.js';

export const TEST_STARTS = Object.freeze([
  { id: 'ember-hound', name: 'Ember Hound — start the adventure', chapter: 0 },
  { id: 'spade', name: 'Spade — The Swarm Remembers', chapter: 1, spade: 'meet' },
  { id: 'spade-lanterns', name: 'Spade — light the memory lanterns', chapter: 1, spade: 'lanterns' },
  { id: 'spade-anchor', name: 'Spade — break the border anchor', chapter: 1, spade: 'anchor' },
  { id: 'spade-castle', name: 'Spade Castle — records and erased witness', chapter: 2 },
  { id: 'clover', name: 'Clover — meet Iven at the Rootkeeper Archive', chapter: 3, clover: 'meet' },
  { id: 'clover-road', name: 'Clover — restore the Living Road', chapter: 3, clover: 'road' },
  { id: 'clover-scar', name: 'Clover — recover the Root Sigil at the Scar', chapter: 3, clover: 'scar' },
  { id: 'sky-hook', name: 'Sky Garden — find the Tide Hook chest', chapter: 3, clover: 'chest' },
  { id: 'heart', name: 'Heart — find Sera at the Listening Spring', chapter: 4, heart: 'meet' },
  { id: 'heart-escort', name: 'Heart — escort the water spirit', chapter: 4, heart: 'escort' },
  { id: 'heart-core', name: 'Heart — release the current at the siphon', chapter: 4, heart: 'core' },
  { id: 'diamond', name: 'Diamond — meet Orin / Shatterglass Relay', chapter: 5, diamond: 'meet' },
  { id: 'diamond-fragments', name: 'Diamond — collect the workshop fragments', chapter: 5, diamond: 'collect' },
  { id: 'diamond-repair', name: 'Diamond — repair and power the relay', chapter: 5, diamond: 'repair' },
]);

export function getTestStart(id) {
  const start = TEST_STARTS.find(s => s.id === id);
  if (!start) throw new Error(`Unknown quest starting point: ${id}`);
  return start;
}

export function applyTestStart(id, { spade, clover, heart, diamond, inventory }) {
  const start = getTestStart(id);
  const give = item => inventory.add(item, { silent: true });
  if (start.chapter >= 2) {
    spade.campaign.setTestStage('complete');
    give('lantern-sigil');
  } else if (start.chapter === 1) spade.campaign.setTestStage(start.spade);
  if (start.chapter >= 3) {
    spade.echo.completeForTesting();
    spade.castle.discovery.completeForTesting();
    clover.setTestStage(start.clover || 'complete');
    if (clover.sigil) give('root-sigil');
    if (clover.hook) give('tide-hook');
  }
  if (start.chapter >= 4) {
    heart.setTestStage(start.heart || 'complete');
  }
  if (start.chapter >= 5) {
    give('tide-sigil');
    diamond.setTestStage(start.diamond);
  }
  switch (id) {
    case 'ember-hound': return { x: 0, z: 0 };
    case 'spade': return { x: -365, z: -14, yaw: Math.PI / 2 };
    case 'spade-lanterns': return { x: -375, z: 0, yaw: Math.PI / 2 };
    // Outside the anchor plaza's solid block (-433, -42, 12 m square), facing the ward (WARD -447, -48).
    case 'spade-anchor': return { x: -435, z: -33, yaw: Math.atan2(12, 15) };
    case 'spade-castle': return { x: -472, z: 0, top: 16.12, yaw: Math.PI / 2 };
    case 'clover': case 'clover-road': return { x: -34, z: -420, top: 12 };
    case 'clover-scar': return { x: -104, z: -452, top: 12 };
    case 'sky-hook': return { ...SUMMIT_ARRIVAL };
    case 'heart': return { ...heart.layout.seraApproach };
    case 'heart-escort': return { ...heart.layout.spring, top: heart.layout.height(heart.layout.spring.x, heart.layout.spring.z) };
    case 'heart-core': return { ...heart.layout.core, top: heart.layout.height(heart.layout.core.x, heart.layout.core.z) };
    case 'diamond': return { x: diamond.layout.orin.x, z: diamond.layout.orin.z - 6, yaw: Math.PI };
    // West of the first fragment, clear of the workshop's clutter, facing it.
    case 'diamond-fragments': return { x: diamond.layout.fragments[0].x - 5, z: diamond.layout.fragments[0].z, yaw: -Math.PI / 2 };
    case 'diamond-repair': return { ...diamond.layout.center };
  }
}
