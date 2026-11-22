import { mountView } from './views/hud.js';
import { startGame } from './controllers/game.js';
import { chooseTestStart } from './views/testStart.js';
import { mountHome } from './views/homeScreen.js';

async function main() {
  try {
    mountHome(); // the home screen in front of the loading screen (skipped for ?scene / ?unlock / ?start)
    const ui = await mountView();
    if (!window.THREE) throw new Error('Three.js could not load. Check your internet connection.');
    const testStartId = await chooseTestStart(ui);
    startGame(ui, { testStartId });
  } catch (error) {
    console.error('Dreamscape could not start.', error);
    const message = document.createElement('p');
    message.textContent = `Dreamscape could not start: ${error.message}. Run start-demo.bat and use the HTTP address.`;
    document.querySelector('#app').replaceChildren(message);
  }
}

main();
