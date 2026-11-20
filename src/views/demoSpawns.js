// Demo travel: keys 1–5 jump to the tower or a kingdom entrance (listed in the "i" help panel's controls).
// spawn(index): 0 = tower, 1–4 = kingdom gates. Scenes temporarily block demo travel.
export function createDemoSpawns({ isAvailable, spawn }) {
  addEventListener('keydown', event => {
    if (event.repeat || !isAvailable() || event.ctrlKey || event.metaKey || event.altKey ||
      /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(event.code);
    if (index >= 0) spawn(index);
  });
}
