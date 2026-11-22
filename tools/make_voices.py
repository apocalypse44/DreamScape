"""ElevenLabs voices (VOICE_PLAN.md). Line text comes from the game code, so it can't drift from the captions.

  python tools/make_voices.py design [NAME...]      # 3 Voice Design previews per character -> voice_takes/design/<name>/
  python tools/make_voices.py save NAME <id>        # keep a preview as that character's voice -> tools/voices.json
  python tools/make_voices.py manifest              # every line in the code -> tools/voice_lines.json (prints a summary)
  python tools/make_voices.py lines [NAME...]       # 3 takes per line -> voice_takes/<scene>/<id>_a|b|c.mp3
  python tools/make_voices.py pick SCENE ID TAKE    # copy a take to assets/voice/<scene>/<id>.mp3 (and rewrite the index)
  python tools/make_voices.py index                 # assets/voice/index.json: caption text -> file, for src/views/voice.js

NAME is a speaker as the script writes it, e.g. SILE, "SHRINE KEEPER" (case-insensitive). With no NAME, design does
every character that has neither a voice nor previews yet, and lines does every character with a voice.
Key: ELEVENLABS_API_KEY in .env (git-ignored), the environment, or `setx ELEVENLABS_API_KEY ...`.
Existing files are skipped, so a retake is: delete the file, run again.
"""
import base64, json, os, re, shutil, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICES = ROOT / 'tools' / 'voices.json'
MANIFEST = ROOT / 'tools' / 'voice_lines.json'
API = 'https://api.elevenlabs.io/v1'

# Voice Design descriptions (keep every one clearly adult; ElevenLabs' filter blocks "girlish", "child" and similar).
# The preview reads the character's own lines; `pad` tops up characters with too few words for a preview.
CAST = {
  'YOU': {'description': "A young man in his early twenties, the hero of a fantasy adventure. Warm, earnest and grounded, "
          "with a clear mid-range voice that stays steady under pressure and hardens into quiet resolve. Natural American accent."},
  'NARRATOR': {'description': "An elderly storyteller with a soft, slow, hushed voice, like an ancient place remembering what it saw. "
               "Warm and grave, unhurried, with gentle pauses. Neutral British accent, close and intimate."},
  'SHRINE KEEPER': {'description': "An elderly woman in her seventies, kind and a little eccentric, with a light, slightly wavering voice "
                    "and a warm smile in it. She speaks gently, with the odd playful pause, like a grandmother who keeps old secrets. "
                    "Neutral British accent, close and intimate."},
  'NERIS': {'description': "A woman in her forties who shelters refugees. Quiet, controlled and serious, a low, clear voice that "
            "never wastes a word, worn by hard years but steady. Neutral British accent."},
  'IVEN': {'description': "A man in his fifties, a patient archivist. Deep, gentle, measured voice with a weary grief under it, "
           "like a teacher mourning something he built. Soft-spoken. Neutral British accent."},
  # Nim wears the shared villager model, which is male.
  'NIM': {'stability': 1, 'description': "A young man in his early twenties, a nervous scout and seer. Quick, light, breathless voice that rushes "
          "and catches when he is frightened. Expressive and earnest. American accent.",
          'pad': "Wait, wait, look at the shell! Something is wrong, I can feel it shaking."},
  'SERA': {'stability': 1, 'description': "A woman in her thirties, a calm water priestess. Soothing, clear and flowing voice, reassuring and "
           "wise, that sharpens with urgency when danger comes. Neutral British accent."},
  'QUEEN ELOWEN': {'description': "A queen in her fifties. Regal, commanding and defiant, a rich, resonant voice trained to carry "
                   "across a court, proud and unafraid even when facing her enemies. Refined British accent.",
                   'pad': "I am Elowen, Queen of Heart, and I do not bow. Leave my springs, and leave my kingdom, now."},
  'ORIN': {'description': "A man in his sixties, a master artificer and foreman. Gruff, gravelly, tired voice, blunt and plain-spoken, "
           "fiercely protective of his workers. Weathered American accent."},
  'WORKER': {'description': "A man in his thirties, a frightened labourer. Hushed, trembling voice speaking in a low whisper, "
             "as if afraid of being overheard. American accent.",
             'pad': "Keep your voice down. If they hear us talking, they will take our families. Please, just go."},
  'VEYR': {'description': "A man in his fifties with a low, cold, smooth voice. He speaks slowly and precisely, never raising his voice, "
           "with quiet contempt in every word. Calm, controlled and menacing, like a king who has never been refused. "
           "Neutral British accent, dry and close."},
  'SILE': {'description': ("An adult woman in her late twenties, a theatrical fantasy villain. Bright, brassy, slightly nasal "
                           "voice with a snappy, mocking sing-song delivery, like a sore loser crowing over a game she is winning. "
                           "Bratty, greedy and smug: quick to gloat, quick to whine, and she throws loud tantrums when she loses. "
                           "Energetic, loud and cartoonish, a cackling giggle. American accent, bouncy and expressive."),
           'sample': ("[gleeful] Ha! Too slow, sprout! Up here! [cackles] Your spells are mine now, every last drop! "
                      "[tantrum] No, no, no, that's MY power! Stop that! Those are MINE! [sulking] Ugh... you broke my toy."),
           # Greedy and bratty, never breathy or sultry; these override the script's directions.
           'tags': {'arrive': 'delighted, mocking', 'fun': 'impatient, gleeful', 'sky': 'taunting, shouting down',
                    'crash': 'whiny, outraged', 'shield': 'panicked', 'waves': 'gleeful, mocking',
                    'desperate': 'tantrum, shouting', 'reclaim': 'smug giggle', 'feed': 'greedy, triumphant',
                    'broken': 'sulking, pouting', 'bored': 'sulking'}},
  'MORCANT': {'description': "A huge man with a very deep, booming, resonant voice that fills a stone hall. Arrogant and theatrical, "
              "he speaks like a god demanding worship, slow and heavy, with a growl underneath. Deep bass, powerful, slightly rough."},
}
# Non-dialogue sounds in a character's voice: (scene, id, speaker, text with v3 tags).
EXTRA = [('sile-fight', 'laugh-long', 'SILE', '[cackles loudly] Ahahahaha! Ahaha!'),
         ('sile-fight', 'laugh-short', 'SILE', '[giggles smugly] Hehe!'),
         ('sile-fight', 'laugh-sour', 'SILE', '[annoyed, forced laugh] Hmph. Ha... ha.')]
# Code file -> [(marker regex, folder)]: one folder per cutscene or flashback (VOICE_SCRIPT.md's scene titles).
# A line goes in the folder of the last marker above it; '' marks the top of the file.
SOURCES = {
  'src/models/houndScene.js': [(r'HOUND_LINES = ', 'ember-hound-wakes'), (r'HOUND_CURE_LINES = ', 'the-cure')],
  'src/controllers/cloverScenes.js': [(r'\n  ask: \{', 'meeting-iven'), (r'\n  meet: \{', 'iven-instructions'),
                                      (r'\n  severing: \{', 'the-severing'), (r'\n  sigil: \{', 'root-sigil'),
                                      (r'function hookShot', 'sky-chest'), (r'function markShot', 'mark-in-the-flame'),
                                      (r'function leadShot', 'keepers-lead')],
  'src/controllers/doorScene.js': [('', 'castle-doors')],
  'src/controllers/heartScenes.js': [(r"from === 'nim'\n", 'nims-vision'), (r'\n    : \[', 'quake-at-the-gate')],
  'src/models/heartStory.js': [(r'\n  past: \{', 'quiet-springs'), (r'\n  sera: \{\n', 'stolen-current')],
  'src/models/diamondStory.js': [(r'\n  arrival: \{', 'shatterglass-march'), (r'\n  power: \{', 'shatterglass-relay'),
                                 (r'\n  chainOrder: \{', 'chain-order'), (r'\n  lead: \{', 'unbroken-pattern')],
  'src/models/morcantFight.js': [('', 'morcant-fight')],
  'src/models/sileFight.js': [('', 'sile-fight')],
  'src/models/grimoireSpells.js': [('', 'grimoire-pages')],
}
S = r"'((?:[^'\\]|\\.)*)'"  # a JS single-quoted string
# Names the voices get wrong, respelled only in the text sent to ElevenLabs (captions keep the real spelling).
SAY = {r'\bSile\b': 'Syle'}  # rhymes with "isle", not "seal"


def unjs(s): return s.replace("\\'", "'")
def norm(s): return re.sub(r'[^a-z0-9]', '', s.lower())


def speaker(label):
  """Caption heading -> voice: 'SILE · THE DARK TRIAD' -> SILE; place/object headings are the narrator."""
  head = label.split(' · ')[0].strip()
  if head.startswith('QUEEN ELOWEN'): return 'QUEEN ELOWEN'
  return head if head in CAST else 'NARRATOR'


def directions():
  """VOICE_SCRIPT.md delivery notes, by line text: 'IVEN (bitter): The Dark Triad…' -> 'bitter'."""
  out = {}
  for d, text in re.findall(r"[A-Z][A-Z ]+? \(([^)]*)\):\s+(.+)", (ROOT / 'VOICE_SCRIPT.md').read_text(encoding='utf-8')):
    d = ', '.join(w for w in (x.strip() for x in d.split(',')) if w and not w.startswith(('instruction', 'note')))
    if d: out[norm(text)] = d
  return out


def collect():
  """Every voiced line in the code, in order: dicts of id, scene, speaker, text, direction, file."""
  dirs, out = directions(), []
  for path, scenes in SOURCES.items():
    src, found = (ROOT / path).read_text(encoding='utf-8'), []
    marks = sorted((re.search(rx, src).start() if rx else 0, name) for rx, name in scenes)  # fails loudly if a marker moved
    for m in re.finditer(rf"\[[^\[\]',]+?,\s*'([^']+)',\s*{S}\s*\]", src):  # [time, 'SPEAKER', 'text']
      found.append((m.start(), None, speaker(m[1]), m[2]))
    for m in re.finditer(rf"\{{[^{{}}]*?(?:speaker: '([^']+)', )?text: {S}", src):  # { speaker, text } (no speaker = YOU)
      found.append((m.start(), None, speaker(m[1]) if m[1] else 'YOU', m[2]))
    table = re.search(r'const LINES = \{(.*?)\n\};', src, re.S)  # key: ['SPEAKER', 'text']
    for m in re.finditer(rf"(\w+): \['([A-Z ]+)', {S}\]", table[1] if table else ''):
      found.append((table.start(1) + m.start(), m[1], speaker(m[2]), m[3]))
    taunts = re.search(r'const TAUNTS = \{(.*?)\n\};', src, re.S)  # kind: ['text', ...] (Morcant's)
    for m in re.finditer(r"(\w+): \[(.*?)\]", taunts[1] if taunts else '', re.S):
      for i, t in enumerate(re.findall(S, m[2])): found.append((taunts.start(1) + m.start() + i, f'{m[1]}-{i + 1}', 'MORCANT', t))
    for i, m in enumerate(re.finditer(rf"lore: {S}, speaker: '([^']+)', line: {S}", src)):  # grimoire pages
      found.append((m.start(), f'page{i + 1}-lore', 'NARRATOR', m[1]))
      found.append((m.start() + 1, f'page{i + 1}-line', speaker(m[2]), m[3]))
    count = {}
    for pos, id_, who, text in sorted(found):
      text, scene = unjs(text), [name for at, name in marks if at <= pos][-1]
      count[scene] = count.get(scene, 0) + 1
      id_ = id_ or f'{count[scene]:02d}-{who.lower().replace(" ", "-")}'
      tag = CAST[who].get('tags', {}).get(id_) or dirs.get(norm(text), '')
      out.append({'id': id_, 'scene': scene, 'speaker': who, 'text': text, 'direction': tag,
                  'file': f'assets/voice/{scene}/{id_}.mp3'})
  for scene, id_, who, text in EXTRA:
    out.append({'id': id_, 'scene': scene, 'speaker': who, 'text': text, 'direction': '', 'file': f'assets/voice/{scene}/{id_}.mp3'})
  return out


def key():
  k = os.environ.get('ELEVENLABS_API_KEY')
  env = ROOT / '.env'  # git-ignored
  if not k and env.exists():
    k = next((v.strip().strip('"\'') for n, _, v in (l.partition('=') for l in env.read_text().splitlines())
              if n.strip() == 'ELEVENLABS_API_KEY'), None)
  if not k and os.name == 'nt':  # setx writes the user registry; this shell may predate it
    import winreg
    try:
      with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment') as h: k = winreg.QueryValueEx(h, 'ELEVENLABS_API_KEY')[0]
    except OSError: pass
  if not k: sys.exit('Set ELEVENLABS_API_KEY first (see the top of this file).')
  return k


def call(path, body=None, query=''):
  req = urllib.request.Request(f'{API}{path}{query}', data=json.dumps(body).encode() if body else None,
                               headers={'xi-api-key': key(), 'Content-Type': 'application/json'})
  try:
    with urllib.request.urlopen(req, timeout=180) as r: return r.read()
  except urllib.error.HTTPError as e: sys.exit(f'{e.code} {path}: {e.read().decode(errors="replace")}')


def voices(): return json.loads(VOICES.read_text()) if VOICES.exists() else {}
def slug(who): return who.lower().replace(' ', '-')
def names(args): return [a.upper() for a in args]


def sample(who, lines):
  """The character's own lines, about 150-500 characters, for the design preview to read."""
  if 'sample' in CAST[who]: return CAST[who]['sample']
  text = ''
  for l in lines:
    if l['speaker'] == who and len(text) < 300: text += ' ' + l['text']
  if len(text) < 120: text += ' ' + CAST[who].get('pad', '')
  return text.strip()[:900]


def design(*args):
  lines, have = collect(), voices()
  todo = names(args) or [w for w in CAST if w not in have and not (ROOT / 'voice_takes' / 'design' / slug(w)).exists()]
  for who in todo:
    out = ROOT / 'voice_takes' / 'design' / slug(who)
    out.mkdir(parents=True, exist_ok=True)
    text = sample(who, lines)
    res = json.loads(call('/text-to-voice/design', {'voice_description': CAST[who]['description'], 'text': text,
                                                    'model_id': 'eleven_ttv_v3'}))
    for i, p in enumerate(res['previews']):
      (out / f'{i + 1}_{p["generated_voice_id"]}.mp3').write_bytes(base64.b64decode(p['audio_base_64']))
    print(f'{who}: {", ".join(p["generated_voice_id"] for p in res["previews"])}  | {text[:70]}...')


def save(who, generated_id):
  who = who.upper()
  res = json.loads(call('/text-to-voice', {'voice_name': who.title(), 'voice_description': CAST[who]['description'],
                                           'generated_voice_id': generated_id}))
  ids = voices() | {who: res['voice_id']}
  VOICES.write_text(json.dumps(ids, indent=2) + '\n')
  print(f'{who} -> {res["voice_id"]}')


def manifest():
  lines = collect()
  MANIFEST.write_text(json.dumps(lines, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
  for who in CAST:
    mine = [l for l in lines if l['speaker'] == who]
    print(f'{who:14} {len(mine):3} lines {sum(len(l["text"]) for l in mine):5} chars')
  print(f'{len(lines)} lines -> {MANIFEST.relative_to(ROOT)}')


def takes(*args):
  have = voices()
  todo = names(args) or list(have)
  for l in collect():
    if l['speaker'] not in todo: continue
    if l['speaker'] not in have: sys.exit(f'No voice saved for {l["speaker"]}: run design, then save.')
    out = ROOT / 'voice_takes' / l['scene']
    out.mkdir(parents=True, exist_ok=True)
    text = f'[{l["direction"]}] {l["text"]}' if l['direction'] else l['text']
    for rx, spoken in SAY.items(): text = re.sub(rx, spoken, text)
    for take in 'abc':
      f = out / f'{l["id"]}_{take}.mp3'
      if f.exists(): continue
      # v3 stability is 0 / .5 / 1; .5 keeps a voice consistent while tags steer each read. 1 for voices that drift off their design.
      f.write_bytes(call(f'/text-to-speech/{have[l["speaker"]]}', {'text': text, 'model_id': 'eleven_v3',
                                                                    'voice_settings': {'stability': CAST[l['speaker']].get('stability', .5)}}, '?output_format=mp3_44100_64'))
      print(f.relative_to(ROOT), '|', text)


def pick(scene, id_, take):
  dst = ROOT / 'assets' / 'voice' / scene / f'{id_}.mp3'
  dst.parent.mkdir(parents=True, exist_ok=True)
  shutil.copyfile(ROOT / 'voice_takes' / scene / f'{id_}_{take}.mp3', dst)
  print(dst.relative_to(ROOT))
  index()


def index():
  """The game finds a recording by its caption text (or 'scene/id' for sounds with no caption, like Sile's laughs)."""
  have = [l for l in collect() if (ROOT / l['file']).exists()]
  extra = {f'{s}/{i}' for s, i, *_ in EXTRA}
  out = {(f'{l["scene"]}/{l["id"]}' if f'{l["scene"]}/{l["id"]}' in extra else l['text']): l['file'].removeprefix('assets/voice/') for l in have}
  (ROOT / 'assets' / 'voice' / 'index.json').write_text(json.dumps(out, ensure_ascii=False, indent=0) + '\n', encoding='utf-8')


if __name__ == '__main__':
  cmd, *args = sys.argv[1:] or ['help']
  {'design': design, 'save': save, 'manifest': manifest, 'lines': takes, 'pick': pick, 'index': lambda: (index(), print('assets/voice/index.json'))}.get(cmd, lambda *_: print(__doc__))(*args)
