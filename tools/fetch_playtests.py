"""Download every remote playtest result from Cloudflare KV into playtest/ and write playtest/RESULTS.md.

Run from the repo root:  python tools/fetch_playtests.py      (needs `npx wrangler login` once)
(`--local` reads the `wrangler dev` store instead, for testing.)
Each tester becomes playtest/<id>.json; RESULTS.md has the summary table, every answer, and the FPS dips,
ready to copy into PLAYTEST.md section 5.
"""
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'playtest'


def wrangler(*args):
    # shell=True so Windows finds npx.cmd
    cmd = ' '.join(['npx', 'wrangler', 'kv', 'key', *args, '--binding=PLAYTESTS', '--local' if '--local' in sys.argv else '--remote'])
    run = subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True, encoding='utf8')
    if run.returncode:
        sys.exit(f'wrangler failed: {run.stderr.strip() or run.stdout.strip()}')
    return run.stdout


def cell(text):
    return str(text if text not in (None, '') else '–').replace('|', '/').replace('\n', ' ')


def results_md(tests):
    done = [t for t in tests if t.get('submitted')]
    lines = [f'# Playtest results\n\n{len(tests)} sessions, {len(done)} with answers submitted.\n',
             '| Tester | Minutes | Controls /10 | Play again /10 | Avg FPS | % time <30 FPS | Dips | Falls | Resets | Help (H) | Furthest step | GPU |',
             '|---|---|---|---|---|---|---|---|---|---|---|---|']
    for t in tests:
        a, fps = t.get('answers') or {}, t.get('fps') or {}
        steps = [e['title'] for e in t.get('events', []) if e['type'] == 'step']
        lines.append('| ' + ' | '.join(cell(v) for v in [
            t.get('tester') or t['id'], t.get('minutes'), a.get('controls'), a.get('again'), fps.get('average'),
            fps.get('percentUnder30'), t.get('dips'), t.get('falls'), t.get('resets'), t.get('helpOpened'),
            steps[-1] if steps else None, t.get('gpu')]) + ' |')
    scores = [int(t['answers']['controls']) for t in done if (t.get('answers') or {}).get('controls')]
    if scores:
        lines.append(f'\n**Average controls score:** {sum(scores) / len(scores):.1f} / 10 ({len(scores)} testers)\n')
    for t in tests:
        lines.append(f"\n## {t.get('tester') or t['id']} (`{t['id']}`)\n")
        for key, value in (t.get('answers') or {}).items():
            lines.append(f'- **{key}:** {cell(value)}')
        if not t.get('submitted'):
            lines.append('- *Closed the game without submitting answers (play log only).*')
        slow = sorted((e for e in t.get('events', []) if e['type'] == 'step' and e.get('took')), key=lambda e: -e['took'])[:3]
        if slow:
            lines.append('- **Longest steps:** ' + '; '.join(f"{e['title']} ({e['took'] / 60:.1f} min)" for e in slow))
        dips = [e for e in t.get('events', []) if e['type'] == 'fps-dip' and e['seconds'] >= 1]
        if dips:
            lines.append('- **FPS dips ≥ 1 s:** ' + '; '.join(
                f"{e['t'] / 60:.1f} min, {e['minFps']} FPS for {e['seconds']} s ({e.get('kingdom')}, {e.get('step')}, chaos {e.get('chaos')})"
                for e in dips[:8]))
    return '\n'.join(lines) + '\n'


def main():
    OUT.mkdir(exist_ok=True)
    keys = [k['name'] for k in json.loads(wrangler('list', '--prefix=playtest:'))]
    tests = []
    for key in keys:
        data = json.loads(wrangler('get', f'"{key}"', '--text'))
        (OUT / f"{data['id']}.json").write_text(json.dumps(data, indent=2), encoding='utf8')
        tests.append(data)
    (OUT / 'RESULTS.md').write_text(results_md(tests), encoding='utf8')
    print(f'{len(tests)} playtests saved in playtest/, summary in playtest/RESULTS.md')


if __name__ == '__main__':
    main()
