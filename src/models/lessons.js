// The Tutorial Lab's guided lessons: one step at a time, each ticked off by what the lab sees the player do.
// Events: 'swing' (a sword hit on a dummy), 'block' / 'roll' (against the sentinel's strike), 'cast:<rune>',
// 'catch' (a spear stopped by a spell), 'hook' (swinging from a crystal), 'chaos' (G pressed). Only the current
// step listens; any step can be skipped; after the last one the lab is free practice.
export const LESSONS = Object.freeze([
  { id: 'swing', text: 'Swing at a straw dummy', keys: 'LMB', need: 3 },
  { id: 'block', text: 'Block the red sentinel’s strike', keys: 'hold RMB', need: 1 },
  { id: 'roll', text: 'Roll through the sentinel’s strike', keys: 'F', need: 1 },
  { id: 'spells', text: 'In the rune circle, cast all four spells', keys: 'LMB · RMB · E · Q', need: 4 },
  { id: 'catch', text: 'Stop a thrown spear with a spell', keys: 'RMB ward · Q wall · E gale', need: 1 },
  { id: 'hook', text: 'Swing from a floating crystal', keys: 'hold Q near one', need: 1 },
  { id: 'chaos', text: 'In boss fights, defending earns charge. G spends one for Chaos: harder hits until you are struck. Press G.', keys: 'G', need: 1 },
]);

export function createLessons(list = LESSONS) {
  let index = 0;
  const counts = new Map(), runes = new Set();
  return {
    get index() { return index; },
    get current() { return list[index] ?? null; },
    get done() { return index >= list.length; },
    count(id) { return counts.get(id) || 0; },
    /** Returns true when this event finished the current step. */
    record(event) {
      const step = list[index]; if (!step) return false;
      const id = event.startsWith('cast:') ? 'spells' : event;
      if (id !== step.id) return false;
      if (id === 'spells') { const rune = event.slice(5); if (runes.has(rune)) return false; runes.add(rune); }
      counts.set(id, (counts.get(id) || 0) + 1);
      if (counts.get(id) < step.need) return false;
      index++; return true;
    },
    skip() { if (list[index]) index++; },
  };
}
