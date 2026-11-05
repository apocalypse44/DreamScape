import { TEST_STARTS } from '../models/testStarts.js';

// Ask before constructing the world, so the chosen destination participates
// in the existing asset/terrain warmup rather than loading after entry.
export function chooseTestStart(ui, params = new URLSearchParams(location.search)) {
  if (params.get('unlock') !== 'all') return Promise.resolve(null);
  const panel = document.createElement('div');
  panel.className = 'test-start';
  const style = document.createElement('style');
  style.textContent = `.test-start{margin:0 0 12px;width:100%;text-align:left}.test-start label{display:block;color:#d8edb1;font:600 12px/1.5 sans-serif;margin-bottom:6px}.test-start select{width:100%;max-width:100%;padding:10px;background:#17221b;color:#f1f4e9;border:1px solid #789557;border-radius:5px;font:13px sans-serif}.test-start p{margin:7px 0;color:#b7c5ab;font:11px/1.5 sans-serif}.test-start button{margin-top:6px;color:#d8edb1;background:transparent;border:1px solid #789557;padding:6px 10px;cursor:pointer}`;
  document.head.append(style);
  const label = document.createElement('label');
  label.htmlFor = 'testQuestStart'; label.textContent = 'Testing mode · Choose your starting quest';
  const select = document.createElement('select'); select.id = 'testQuestStart';
  select.append(new Option('Select a quest…', ''));
  for (const start of TEST_STARTS) select.append(new Option(start.name, start.id));
  const requested = params.get('start');
  if (TEST_STARTS.some(s => s.id === requested)) select.value = requested;
  const help = document.createElement('p');
  help.textContent = 'Earlier quests and rewards will be completed. Your chosen quest stays playable. R restarts this starting point.';
  const change = document.createElement('button');
  change.type = 'button'; change.textContent = 'Choose another quest'; change.hidden = true;
  change.addEventListener('click', () => location.reload());
  panel.append(label, select, help, change);
  ui.enterButton.before(panel);
  const caption = ui.enterButton.querySelector('span');
  const refresh = () => {
    ui.enterButton.disabled = !select.value;
    caption.textContent = select.value ? 'LOAD SELECTED QUEST' : 'CHOOSE A STARTING QUEST';
  };
  select.addEventListener('change', refresh); refresh();
  document.querySelector('#startupStatus').textContent = 'Choose a quest to prepare your world.';
  return new Promise(resolve => {
    const load = () => {
      if (!select.value) return;
      ui.enterButton.removeEventListener('click', load);
      select.removeEventListener('change', refresh);
      select.disabled = true; change.hidden = false;
      ui.enterButton.disabled = true;
      caption.textContent = 'PREPARING YOUR QUEST';
      const url = new URL(location.href); url.searchParams.set('start', select.value);
      history.replaceState(null, '', url);
      resolve(select.value);
    };
    ui.enterButton.addEventListener('click', load);
  });
}
