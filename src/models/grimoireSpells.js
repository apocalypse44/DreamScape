// The traveller's grimoire spells: four elemental pages, each an item the game can grant later (one per
// chapter), matching the intro's four mana runes (index.html). icon: a 24-unit SVG path for the spell bar. Behaviour and numbers live with the
// fight that uses them (models/morcantFight.js, MORCANT_FIGHT.spells); this is just who they are and how to cast.
export const SPELLS = [
  { id: 'flame', glyph: 'ᛟ', icon: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z', fill: true, name: 'FLAME LANCE', input: 'LMB', keys: ['Digit1'], about: 'A spear of fire. Hold to keep casting.' },
  { id: 'tide', glyph: 'ᛜ', icon: 'M12 5.5c2.4 3.2 3.8 5.6 3.8 8a3.8 3.8 0 0 1-7.6 0c0-2.4 1.4-4.8 3.8-8z M12 2a10 10 0 1 1-.01 0', name: 'TIDE WARD', input: 'RMB', keys: ['Digit2'], about: 'A water bubble: catches spears, blocks bites and claws.' },
  { id: 'wind', glyph: 'ᛉ', icon: 'M3 8h11a3 3 0 1 0-3-3 M3 12h16a3 3 0 1 1-3 3 M3 16h8', name: 'GALE', input: 'E', keys: ['KeyE', 'Digit3'], about: 'A cone of wind: shatters bone and knocks an attack apart before it lands.' },
  { id: 'earth', glyph: 'ᚷ', icon: 'M3 7h18v12H3z M3 13h18 M9 7v6 M15 13v6', name: 'STONE WALL', input: 'Q', keys: ['KeyQ', 'Digit4'], about: 'A wall of stone rises where you look and stops what comes at you.' },
];
// Ink (on parchment) and glow per spell, for the grimoire's pages.
export const SPELL_INK = { flame: ['#b2401a', '#ff9a4a'], tide: ['#1d6f93', '#7fe0ff'], wind: ['#2f7d78', '#c9fff4'], earth: ['#6b4a22', '#e8c27a'] };
// The grimoire's pages in the order the story writes them (GRIMOIRE_SPELLS_PLAN.md). source: what writes the page:
// the Ember Hound's breath, or a sigil (rendering/sigil.js kinds). The Prism Sigil's page, Refraction, adds no fifth spell:
// it makes the four split into stronger forms in Chaos.
export const PAGES = [
  { id: 'wind', spell: 'wind', source: 'ember', numeral: 'I', from: 'THE EMBER HOUND', where: 'The Grimoire Tower',
    lore: 'The hound breathed warmth across the empty pages, and the first of them caught the wind.', speaker: 'SHRINE KEEPER', line: 'This book once held the Accord. Gather its torn pages, and it will remember how to fight.' },
  { id: 'flame', spell: 'flame', source: 'lantern', numeral: 'II', from: 'THE LANTERN SIGIL', where: 'The Spade Kingdom',
    lore: 'Spade gave its last light freely. Light given freely burns the hottest, and now it burns for you.', speaker: 'NERIS', line: 'Our people kept this light alive for you. Burn the dark with it.' },
  { id: 'earth', spell: 'earth', source: 'root', numeral: 'III', from: 'THE ROOT SIGIL', where: 'The Clover Kingdom',
    lore: 'The roots that raised the Living Road answer you now. Speak, and the ground stands up to guard you.', speaker: 'IVEN', line: 'A branch remembers where it came from. So does the ground.' },
  { id: 'tide', spell: 'tide', source: 'tide', numeral: 'IV', from: 'THE TIDE SIGIL', where: 'The Heart Kingdom',
    lore: 'Heart’s stolen current flows free again, and it wraps around you as a shield of living water.', speaker: 'SERA', line: 'The springs answer you now. Let the water guard you.' },
  { id: 'prism', spell: null, source: 'prism', numeral: 'V', from: 'THE PRISM SIGIL', where: 'The Diamond Kingdom',
    lore: 'Light that enters a prism leaves as many colours. This page teaches the four spells to do the same.', speaker: 'ORIN', line: 'Light through a prism is never only one colour. Neither is your magic now.',
    name: 'REFRACTION', about: 'In Chaos, every spell splits: Flame Lance fires three, Tide Ward hurls spears back, Stone Wall grows spikes, and Gale pulls instead of pushing.' },
];
/** The spell a key code casts, or null. */
export const spellForKey = code => SPELLS.find(s => s.keys.includes(code))?.id ?? null;
