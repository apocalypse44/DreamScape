// Movement-score pacing only. Atmosphere rendering belongs to rendering/atmosphere.js.
import { CONFIG } from '../models/chaosLookConfig.js';
import { updateChaosReadout } from '../views/hud.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createChaosLook() {
  const gov = { last: null, pending: 0, slope: 0 };
  let trend = 0;
  let visual = 0;
  // Pacing: the game computes chaos its own way; this scales each frame's change.
  function govern(state, dt) {
    const raw = state.chaos;
    if (gov.last === null) { gov.last = raw; return; }
    const d = raw - gov.last;
    if (Math.abs(d) > CONFIG.passThroughJump) { gov.last = raw; gov.pending = 0; return; } // quest events
    const up = CONFIG.maxRisePerSec * dt;
    const down = CONFIG.maxFallPerSec * dt;
    const s = d > 0 ? d * CONFIG.riseScale : d * CONFIG.fallScale;
    let delta = 0;
    if (s >= 0) gov.pending += s; else delta = Math.max(s, -down);
    const take = Math.min(gov.pending, Math.max(0, up - delta));
    delta += take;
    gov.pending = Math.min(gov.pending - take, 0.05);
    const prev = gov.last;
    state.chaos = clamp(gov.last + delta, 0, 1);
    gov.last = state.chaos;
    gov.slope += ((state.chaos - prev) / dt - gov.slope) * (1 - Math.exp(-4 * dt));
    trend = gov.slope > 0.004 ? 1 : gov.slope < -0.004 ? -1 : 0;
  }

  return {
    update(dt, state) {
      if (dt > 0) govern(state, dt);
      const score = state.chaos;
      visual += (score - visual) * (1 - Math.exp(-3 * dt));
      if (CONFIG.showHud) updateChaosReadout(score >= 0.65 ? 'CHAOS' : 'CALM', score, trend);
      return visual;
    },
    reset() {
      gov.last = null;
      gov.pending = 0;
      gov.slope = 0;
      trend = 0;
      visual = 0;
    },
  };
}
