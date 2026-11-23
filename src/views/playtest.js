// Remote, unmoderated playtest (PLAYTEST.md). Only with ?playtest in the URL:
//   welcome screen (premise, think-aloud, how to record; no controls) -> play -> "Finish playtest" -> the interview
//   in-game -> answers + play log POSTed to /api/playtest (worker.js stores them in KV).
// If the tab closes first, the log so far is still sent (sendBeacon). If the upload fails, the JSON downloads instead.
// ponytail: step and kingdom are read from the HUD text (#questGoal, #kingdomName), not game state, so nothing
// needs plumbing. If those elements are renamed the step log goes empty; FPS, falls and answers keep working.
import { createLog } from '../models/playtestLog.js';

const ENDPOINT = '/api/playtest';
const QUESTIONS = [ // [key, question, kind, required]; kind: text | scale | url | a|b|c choices
  ['confusing', 'What was the most confusing or frustrating part of the experience?', 'text', true],
  ['controls', 'On a scale of 1–10, how intuitive were the controls? (1 = I never figured them out, 10 = I never had to think about them)', 'scale', true],
  ['controlsWhy', 'Why that number?', 'text', true],
  ['glitches', 'Did you notice any visual glitches or lag? If so, when?', 'text', true],
  ['goal', 'In your own words, what was the goal of the game?', 'text', true],
  ['chaos', 'Did you notice that the way you moved changed the world? When did you first notice?', 'text', true],
  ['best', 'What was the best moment?', 'text', true],
  ['change', 'If you could change one thing, what would it be?', 'text', true],
  ['again', 'On a scale of 1–10, how likely are you to play again?', 'scale', true],
  ['experience', 'How often do you play 3D games?', 'Never|Sometimes|A lot', true],
  ['recording', 'Link to your screen + voice recording, if you made one (Google Drive, OneDrive, YouTube unlisted…)', 'url', false],
];

const field = ([key, question, kind, required]) => {
  const req = required ? ' required' : '', star = required ? ' <i>*</i>' : '';
  if (kind === 'scale') return `<fieldset><legend><span>${question}${star}</span></legend><div class="pt-scale">${
    Array.from({ length: 10 }, (_, i) => `<label><input type="radio" name="${key}" value="${i + 1}"${req}>${i + 1}</label>`).join('')}</div></fieldset>`;
  if (kind === 'text') return `<label><span>${question}${star}</span><textarea name="${key}" rows="2"${req}></textarea></label>`;
  if (kind === 'url') return `<label><span>${question}</span><input type="url" name="${key}" placeholder="https://"></label>`;
  return `<label><span>${question}${star}</span><select name="${key}"${req}><option value=""></option>${kind.split('|').map(o => `<option>${o}</option>`).join('')}</select></label>`;
};

function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch { return ''; }
}

function overlay(html) {
  const el = document.createElement('div');
  el.className = 'pt-overlay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="pt-card">${html}</div>`;
  document.body.append(el);
  return el;
}

/** Returns null without ?playtest, so callers write `playtest?.x()`. */
export function startPlaytest(params = new URLSearchParams(location.search)) {
  if (!params.has('playtest')) return null;
  // Testers may share a computer: forget "already offered the lab before this boss" so each sees it.
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('dreamscape.practiced.')) localStorage.removeItem(k); } catch { /* private window */ }
  const log = createLog(() => performance.now() / 1000);
  let id = `t-${Math.random().toString(36).slice(2, 8)}`, tester = params.get('playtest') || '', answers = null, done = false;
  const text = sel => document.querySelector(sel)?.textContent?.trim() ?? '';
  const where = () => ({ kingdom: text('#kingdomName'), step: text('#questGoal .qg-title') });
  const payload = () => JSON.stringify({ id, tester, submitted: !!answers, answers, browser: navigator.userAgent,
    screen: `${innerWidth}x${innerHeight}@${devicePixelRatio}`, gpu: gpuName(), ...log.report() });
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([payload()], { type: 'application/json' }));
    a.download = `dreamscape-playtest-${id}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  // Closed the tab without finishing: still keep the play log. The final submit overwrites it (same id).
  addEventListener('pagehide', () => { if (!done) navigator.sendBeacon?.(ENDPOINT, new Blob([payload()], { type: 'application/json' })); });
  // What the observer would have written down: asked for help, opened the map, restarted. Only counted in play.
  addEventListener('keydown', e => {
    if (!document.pointerLockElement || e.repeat) return;
    const type = { KeyR: 'reset', KeyH: 'help', KeyM: 'map' }[e.code];
    if (type) log.event(type, where());
  });
  document.getElementById('homeLab')?.addEventListener('click', () => log.event('tutorial-lab'));

  const welcome = overlay(`
    <p class="pt-eyebrow">DREAMSCAPE · PLAYTEST</p>
    <h2>Thanks for playtesting!</h2>
    <p>DreamScape is a 3D exploration game where <b>the way you move changes the world</b>: moving calmly keeps it
      peaceful, moving fast makes it chaotic. We won't explain the controls. The game should teach you, and if it
      doesn't, that's exactly what we want to find out. There are no wrong answers; we're testing the game, not you.</p>
    <ol>
      <li><b>Think aloud.</b> Say what you're looking at, what you're trying to do and what you expect to happen,
        e.g. <q>I'm going toward this because it's glowing</q> or <q>I don't know where to go.</q></li>
      <li><b>Record your screen with your voice</b> (please, it's how we hear you think aloud):
        <br>Windows: <kbd>Win</kbd>+<kbd>Alt</kbd>+<kbd>R</kbd> starts and stops recording (turn the mic on with <kbd>Win</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd>).
        <br>Mac: <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>5</kbd>, Options → Microphone, then Record.
        <br>Afterwards upload it (Google Drive, OneDrive…) and paste the link at the end.</li>
      <li><b>Play for 15–20 minutes</b>, or until you want to stop. Then press <kbd>Esc</kbd> and click
        <b>Finish playtest</b> (bottom left) to answer a few short questions (about 5 minutes).</li>
    </ol>
    <p class="pt-small">Use a laptop or desktop with a keyboard and mouse, Chrome or Edge, sound on.
      We record your frame rate, falls, quest progress and timing, your browser and graphics card, and your answers. Nothing else.</p>
    <form class="pt-form"><label><span>Your name <i>*</i></span><input name="tester" maxlength="40" autocomplete="name" required></label>
      <button type="submit">Begin</button></form>`);
  welcome.querySelector('input').value = tester;
  welcome.querySelector('form').onsubmit = e => {
    e.preventDefault();
    tester = new FormData(e.target).get('tester').trim();
    if (!tester) { e.target.tester.value = ''; e.target.reportValidity(); return; } // spaces only
    id = `${tester.replace(/[^\w-]/g, '').slice(0, 20) || 'anon'}-${id.slice(2)}`;
    log.event('begin'); welcome.remove(); document.getElementById('homeStart')?.focus();
  };
  welcome.querySelector('input').focus();

  const finish = document.createElement('button');
  finish.type = 'button'; finish.className = 'pt-finish'; finish.textContent = 'Finish playtest';
  document.body.append(finish);
  finish.onclick = () => {
    document.exitPointerLock?.(); log.event('finish-opened', where());
    const form = overlay(`<p class="pt-eyebrow">DREAMSCAPE · PLAYTEST</p><h2>A few questions</h2>
      <p class="pt-small">Every question is required (<i>*</i>); the recording link is optional. Be honest. Criticism helps us most.</p>
      <form class="pt-form">${QUESTIONS.map(field).join('')}
        <div class="pt-actions"><button type="button" data-back>Back to the game</button><button type="submit">Send</button></div>
        <p class="pt-status" role="status"></p></form>`);
    form.querySelector('[data-back]').onclick = () => form.remove();
    form.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      const send = e.target.querySelector('[type=submit]'), status = e.target.querySelector('.pt-status');
      answers = Object.fromEntries(new FormData(e.target)); send.disabled = true; status.textContent = 'Sending…';
      try {
        const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload() });
        if (!res.ok) throw new Error(res.status);
        done = true;
        form.querySelector('.pt-card').innerHTML = '<h2>Thank you!</h2><p>Your answers were sent. You can close this tab.</p>' +
          '<p class="pt-small">If you recorded your screen, make sure the link you pasted can be opened by anyone with the link.</p>';
      } catch {
        done = true; download();
        status.innerHTML = 'Couldn\'t send automatically. A file named <b>dreamscape-playtest-….json</b> was just downloaded. ' +
          'Please send it to the person who shared this link with you. Thank you!';
      }
    };
    form.querySelector('textarea').focus();
  };

  return {
    /** From the frame loop's FPS readout, after startup. */
    sample(fps, chaos) {
      const at = where();
      log.sample(fps, { ...at, chaos: +chaos.toFixed(2) });
      log.step(at.step, { kingdom: at.kingdom });
    },
    fall() { log.event('fall', where()); },
    note(type, data) { log.event(type, { ...where(), ...data }); },
  };
}
