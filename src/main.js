import { mountView } from './views/hud.js';
import { startGame } from './controllers/game.js';

async function main() {
  try {
    const ui = await mountView();
    if (!window.THREE) throw new Error('Three.js could not load. Check your internet connection.');
    startGame(ui);
  } catch (error) {
    console.error('Dreamscape could not start.', error);
    const message = document.createElement('p');
    message.textContent = `Dreamscape could not start: ${error.message}. Run start-demo.bat and use the HTTP address.`;
    document.querySelector('#app').replaceChildren(message);
  }
}

main();
