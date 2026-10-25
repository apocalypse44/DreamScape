// The player's satchel: story items and tools they carry, by id. Item definitions live here so the
// grimoire, HUD and game logic agree on names. Session-only, like other story progress (R clears it).
export const ITEMS = {
  'lantern-sigil': { name: 'Lantern Sigil', kind: 'Sigil', icon: 'spade',
    text: 'Neris’s light, freely given when the border settlement was freed. The first of the Accord’s four sigils.' },
  // Awarded by Iven's Sky Garden ledge chest after restoring the Living Road and reading the Scar.
  'tide-hook': { name: 'Tide Hook', kind: 'Tool', icon: 'hook',
    text: 'A grapple Heart’s guardians used to cross the crystal banks. It catches only on glowing crystal anchors.' },
  'root-sigil': { name: 'Root Sigil', kind: 'Sigil', icon: 'root',
    text: 'The original branching pattern recovered at Clover’s Stormleaf Scar. It separates the Triad’s true bindings from Veyr’s decoys.' },
  // --- Diamond chapter ---
  // Placeholder so Diamond can be tested before Heart merges. When Heart's branch adds its own
  // 'tide-sigil' entry, keep Heart's and delete this one.
  'tide-sigil': { name: 'Tide Sigil', kind: 'Sigil', icon: 'spade',
    text: 'The stolen current Sera’s water spirit released at the siphon core. It points south, to Diamond.' },
  'prism-sigil': { name: 'Prism Sigil', kind: 'Sigil', icon: 'spade',
    text: 'The Shatterglass Relay’s unbroken pattern, repaired with Orin’s freed workers. Its inversion circuit can expose the Triad’s armor.' },
  // --- end Diamond chapter ---
};

// onAdd(id, item): called once when a new item enters the satchel (e.g. to show a toast).
export function createInventory({ onAdd } = {}) {
  const held = new Set(); // insertion order = order acquired
  return {
    has: id => held.has(id),
    add(id) {
      if (!ITEMS[id]) throw new Error(`Unknown item: ${id}`);
      if (held.has(id)) return false;
      held.add(id);
      onAdd?.(id, ITEMS[id]);
      return true;
    },
    get items() { return [...held].map(id => ({ id, ...ITEMS[id] })); },
    reset() { held.clear(); },
  };
}
