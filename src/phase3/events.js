// Tiny event bus so game logic (quest.js) can announce things without
// importing rendering code.
//   events.emit('ember:pickup', {...})   events.on('ember:pickup', fn)
const handlers = new Map();

export const events = {
  on(name, fn) {
    if (!handlers.has(name)) handlers.set(name, []);
    handlers.get(name).push(fn);
    return () => events.off(name, fn);
  },
  off(name, fn) {
    const list = handlers.get(name);
    if (list) handlers.set(name, list.filter((f) => f !== fn));
  },
  emit(name, data) {
    (handlers.get(name) || []).forEach((fn) => fn(data));
  },
  clear() {
    handlers.clear();
  },
};
