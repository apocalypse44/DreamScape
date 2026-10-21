// Entry is allowed only after downloads, scene preparation, and actual rendered
// frames have settled. A completed download alone does not mean a playable scene.
export function createStartupReadiness({ quietMs = 500, settleFrames = 12, maxFrameMs = 100 } = {}) {
  let pending = 0, revision = 0, warmedRevision = -1;
  let lastWork = 0, stable = 0, ready = false;
  return {
    begin(now) { pending++; revision++; lastWork = now; stable = 0; },
    end(now) { pending = Math.max(0, pending - 1); lastWork = now; stable = 0; },
    update({ now, frameMs, prepared }) {
      if (ready) return 'ready';
      if (pending || !prepared || now - lastWork < quietMs) {
        stable = 0;
        return pending ? 'loading' : 'preparing';
      }
      if (warmedRevision !== revision) {
        warmedRevision = revision;
        stable = 0;
        return 'warmup';
      }
      stable = frameMs > 0 && frameMs <= maxFrameMs ? stable + 1 : 0;
      if (stable >= settleFrames) ready = true;
      return ready ? 'ready' : 'settling';
    },
    get pending() { return pending; },
    get ready() { return ready; },
  };
}

// Observe individual items, including cached files and nested texture requests.
// Preserve the manager's existing callbacks and restore its methods on entry.
export function observeStartupLoading(manager, startup, now = () => performance.now()) {
  const start = manager.itemStart, end = manager.itemEnd;
  manager.itemStart = function (...args) {
    startup.begin(now());
    return start.apply(this, args);
  };
  manager.itemEnd = function (...args) {
    try { return end.apply(this, args); }
    finally { startup.end(now()); }
  };
  return () => { manager.itemStart = start; manager.itemEnd = end; };
}
