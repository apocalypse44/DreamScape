import { SPELLS } from '../models/grimoireSpells.js';

// The grimoire bar: the four spells with their icon, input and cooldown sweep; it flashes the one just cast.
export function createSpellBar(doc = document) {
  const bar = doc.createElement('div');
  bar.id = 'spellBar'; bar.hidden = true; bar.setAttribute('aria-label', 'Grimoire spells');
  bar.innerHTML = SPELLS.map(s => `<div class="spell" data-spell="${s.id}" title="${s.about}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${s.icon}"${s.fill ? ' class="fill"' : ''}/></svg><b>${s.input}</b><span>${s.name}</span><i></i></div>`).join('');
  doc.body.append(bar);
  const cells = Object.fromEntries([...bar.children].map(el => [el.dataset.spell, el]));
  return {
    /** inputs: optional key labels in SPELLS order (a fight that binds them differently); null restores the defaults. */
    show(on, inputs = null) { bar.hidden = !on; SPELLS.forEach((s, i) => { cells[s.id].querySelector('b').textContent = inputs?.[i] ?? s.input; }); },
    flash(id) { const el = cells[id]; if (!el) return; el.classList.remove('cast'); void el.offsetWidth; el.classList.add('cast'); },
    /** cooldown/max: seconds per spell id; chaos tints the bar crimson. */
    update({ cooldown = {}, max = {}, chaos = false } = {}) {
      bar.classList.toggle('chaos', chaos);
      for (const [id, el] of Object.entries(cells)) {
        const k = max[id] ? (cooldown[id] || 0) / max[id] : 0;
        el.style.setProperty('--cool', k.toFixed(3)); el.classList.toggle('ready', k <= 0);
      }
    },
  };
}
