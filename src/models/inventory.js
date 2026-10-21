// The player's satchel: story items and tools they carry, by id. Item definitions live here so the
// grimoire, HUD and game logic agree on names. Session-only, like other story progress (R clears it).
export const ITEMS = {
  'lantern-sigil': { name: 'Lantern Sigil', kind: 'Sigil', icon: 'spade',
    text: 'Neris’s light, freely given when the border settlement was freed. The first of the Accord’s four sigils.' },
  // Planned: found in a chest after Clover's chapter; fires at glowing crystal anchors (story doc, "The Tide Hook").
  'tide-hook': { name: 'Tide Hook', kind: 'Tool', icon: 'hook',
    text: 'A grapple Heart’s guardians used to cross the crystal banks. It catches only on glowing crystal anchors.' },
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
