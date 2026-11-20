// Mana (MANA_PLAN.md): a 0..1 bar. G spends a third of it to surge into Chaos: the score jumps to surgeLevel
// and is held there for `hold` seconds, then the normal movement calculation lets it fall back to Calm by
// itself (about 14 s more standing or walking). One surge buys what ~15 s of sprinting buys, no more.
export const MANA = { surgeCost: 1 / 3, surgeLevel: 0.9, hold: 5, start: 1 / 3, floor: 1 / 3, fightCap: 1 / 3 };
const EPS = 1e-6; // three thirds must spend as three surges despite float rounding

export function createMana(config = MANA) {
  let value = config.start, hold = 0;
  return {
    get value() { return value; },
    get holding() { return hold > 0; },
    get holdLeft() { return hold; },
    /** Why a surge can't start now, or null. No stacking: only from Calm, never during a hold. */
    blocked(mode) {
      if (mode === 'chaos' || hold > 0) return 'ALREADY IN CHAOS';
      return value + EPS < config.surgeCost ? 'NOT ENOUGH MANA' : null;
    },
    surge(mode) {
      if (this.blocked(mode)) return false;
      value = Math.max(0, value - config.surgeCost);
      hold = config.hold;
      return true;
    },
    add(amount) { value = Math.min(1, value + amount); },
    set(amount) { value = Math.min(1, Math.max(0, amount)); },
    /** Entering a boss fight: a full bar must not open it with three Chaos strikes. */
    cap(amount) { value = Math.min(value, amount); },
    tick(dt) { hold = Math.max(0, hold - dt); },
    /** R reset: the hold ends and at least one surge is available again. */
    reset() { value = Math.max(value, config.floor); hold = 0; },
  };
}
