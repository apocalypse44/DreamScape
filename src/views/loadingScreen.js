// An engine-independent grimoire game. Mana is decorative; entry follows real loading.
(() => {
  const intro = document.querySelector('#intro'), sigil = intro.querySelector('.dream-sigil');
  const kingdoms = [
    { id: 'clover', symbol: '♣', realm: 'THE CLOVER KINGDOM', title: 'A little courage. Limitless possibility.',
      text: 'Green terraces rise toward gardens above the clouds. Let curiosity be your compass, and find the magic hidden in the climb.',
      hint: 'Walk gently to keep the world calm.', spell: 'Let your magic take root.', color: '#b8dc87' },
    { id: 'heart', symbol: '♥', realm: 'THE HEART KINGDOM', title: 'Listen to the world around you.',
      text: 'Every kingdom has a rhythm. Explore the paths beyond the Crossing, and let a calmer step reveal the world around you.',
      hint: 'Calm movement gives you time to notice new paths.', spell: 'Flow with the world.', color: '#81d7d0' },
    { id: 'diamond', symbol: '♦', realm: 'THE DIAMOND KINGDOM', title: 'A spark is only the beginning.',
      text: 'Beyond familiar ground, every new direction offers a reason to explore. Keep your companion close and watch the landscape change.',
      hint: 'Sprinting and jumping stir the world toward chaos.', spell: 'Shape your own strength.', color: '#edc374' },
    { id: 'spade', symbol: '♠', realm: 'THE SPADE KINGDOM', title: 'There is magic in the darkness.',
      text: 'Snow falls beneath an endless night. Beyond the gates, a castle keeps its secrets in quiet halls and hidden rooms.',
      hint: 'Look beyond the main hall. The castle has more to tell.', spell: 'Find a light in the dark.', color: '#b39add' },
  ];
  const get = id => document.getElementById(id);
  const book = get('grimoireBook'), card = intro.querySelector('.lore-card');
  const seals = [...sigil.querySelectorAll('button[data-kingdom]')];
  const runes = [...sigil.querySelectorAll('[data-rune]')], pips = [...sigil.querySelectorAll('.mana-pips i')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 0;
  const collected = new Set();
  function selectKingdom(index) {
    selected = (index + kingdoms.length) % kingdoms.length;
    const kingdom = kingdoms[selected];
    sigil.dataset.kingdom = kingdom.id;
    intro.style.setProperty('--magic', kingdom.color);
    get('loreRealm').textContent = kingdom.realm;
    get('loreTitle').textContent = kingdom.title;
    get('loreText').textContent = kingdom.text;
    get('loreHint').textContent = kingdom.hint;
    get('loreNumber').textContent = String(selected + 1).padStart(2, '0') + ' / 04';
    seals.forEach(seal => seal.setAttribute('aria-pressed', String(seal.dataset.kingdom === kingdom.id)));
    sigil.querySelector('.page-heading').textContent = kingdom.id.toUpperCase();
    sigil.querySelector('.page-symbol').textContent = kingdom.symbol;
    sigil.querySelector('.book-crest').textContent = kingdom.symbol;
    sigil.querySelector('.page-spell').textContent = kingdom.spell;
    if (!reducedMotion.matches) card.animate([{ opacity: .5, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 280 });
  }
  seals.forEach((seal, i) => seal.addEventListener('click', () => selectKingdom(i)));
  get('lorePrevious').addEventListener('click', () => selectKingdom(selected - 1));
  get('loreNext').addEventListener('click', () => selectKingdom(selected + 1));
  book.addEventListener('click', () => {
    const open = book.getAttribute('aria-expanded') !== 'true';
    book.setAttribute('aria-expanded', String(open));
    book.setAttribute('aria-label', open ? 'Close your grimoire' : 'Open your grimoire');
    get('grimoirePrompt').textContent = open ? 'YOUR MAGIC IS YOUR OWN' : 'CLICK THE GRIMOIRE TO OPEN';
  });
  function burst(rune) {
    if (reducedMotion.matches) return;
    for (let i = 0; i < 8; i++) {
      const spark = document.createElement('span'), angle = i * Math.PI / 4;
      spark.className = 'mana-spark';
      spark.style.left = (rune.offsetLeft + rune.offsetWidth / 2) + 'px';
      spark.style.top = (rune.offsetTop + rune.offsetHeight / 2) + 'px';
      spark.style.setProperty('--spark-x', (Math.cos(angle) * 40) + 'px');
      spark.style.setProperty('--spark-y', (Math.sin(angle) * 40) + 'px');
      sigil.querySelector('.mana-particles').appendChild(spark);
      spark.addEventListener('animationend', () => spark.remove(), { once: true });
      setTimeout(() => spark.remove(), 1000);
    }
  }
  runes.forEach(rune => rune.addEventListener('click', () => {
    if (collected.has(rune.dataset.rune)) return;
    collected.add(rune.dataset.rune);
    rune.disabled = true; rune.classList.add('collected');
    pips[collected.size - 1].classList.add('filled');
    get('manaCount').textContent = collected.size + ' / 4';
    burst(rune);
    if (collected.size === 4) {
      sigil.classList.add('awakened');
      get('manaStatus').textContent = 'Seal awakened. Your mana answers the call.';
      get('resetMana').hidden = false;
      if (!reducedMotion.matches) book.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 900 });
    } else get('manaStatus').textContent = (4 - collected.size) + ' runes remain. Keep gathering mana.';
  }));
  get('resetMana').addEventListener('click', () => {
    collected.clear(); sigil.classList.remove('awakened');
    runes.forEach(rune => { rune.disabled = false; rune.classList.remove('collected'); });
    pips.forEach(pip => pip.classList.remove('filled'));
    get('manaCount').textContent = '0 / 4';
    get('manaStatus').textContent = 'Catch the four glowing runes to awaken the seal.';
    get('resetMana').hidden = true;
  });
  // One pending pointer update, with no permanent JavaScript animation loop.
  let pointerFrame = 0, pointerX = 0, pointerY = 0;
  sigil.addEventListener('pointermove', event => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    const rect = sigil.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - .5) * 12;
    pointerY = ((event.clientY - rect.top) / rect.height - .5) * -10;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(() => {
      sigil.style.setProperty('--tilt-x', pointerY + 'deg');
      sigil.style.setProperty('--tilt-y', pointerX + 'deg');
      pointerFrame = 0;
    });
  });
  function resetTilt() {
    cancelAnimationFrame(pointerFrame); pointerFrame = 0;
    sigil.style.setProperty('--tilt-x', '0deg'); sigil.style.setProperty('--tilt-y', '0deg');
  }
  sigil.addEventListener('pointerleave', resetTilt);
  reducedMotion.addEventListener('change', resetTilt);
  const stages = intro.querySelectorAll('[data-stage]');
  function updateStages() {
    const phase = intro.dataset.loadPhase;
    const current = phase === 'ready' ? 4 : phase === 'preparing' ? 2 : phase === 'warmup' || phase === 'settling' ? 3 : 1;
    stages.forEach(stage => {
      stage.classList.toggle('complete', Number(stage.dataset.stage) < current);
      if (Number(stage.dataset.stage) === current) stage.setAttribute('aria-current', 'step');
      else stage.removeAttribute('aria-current');
    });
  }
  new MutationObserver(changes => {
    if (intro.classList.contains('hidden')) resetTilt();
    if (changes.some(change => change.attributeName === 'data-load-phase')) updateStages();
  }).observe(intro, { attributes: true, attributeFilter: ['class', 'data-load-phase'] });
  selectKingdom(0); updateStages();
})();
