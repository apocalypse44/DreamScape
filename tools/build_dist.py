"""Build dist/ for static hosting: app files + only the assets the game loads."""
import json
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
MAX_FILE = 25 * 1024 * 1024  # Cloudflare Pages per-file limit
MAX_FILES = 1000  # Cloudflare dashboard upload / itch.io limit

APP = ['index.html', 'src', 'styles', 'vendor']
ASSETS = [
    'animals/ShibaInu.gltf',
    'animals/Wolf.gltf',
    'animals/License.txt',
    'crystals',
    'shrine',
    'spade',
    'character',
    'music',
    'particles',
    'Stylized Nature MegaKit[Standard]/glTF',
    'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb',
    'universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb',
    'universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb',
]
# Kit packs where the game loads only a few models (cloverArchiveProps.js): copy each model's
# .gltf, its buffers and the textures it references, not the whole pack.
KIT_MODELS = {
    'Fantasy Props MegaKit[Standard]/Exports/glTF': ['Bookcase_2', 'Shelf_Arch', 'BookStand', 'Book_Stack_1', 'Book_Stack_2',
                                                     'Scroll_2', 'Chandelier', 'Lantern_Wall', 'Vase_2'],
    'Medieval Village MegaKit[Standard]/glTF': ['Roof_RoundTiles_8x12', 'Prop_Vine5', 'Prop_Vine2'],
}
OPTIONAL = ['sounds']  # copied when present; the game falls back to synthesized sounds
SKIP = shutil.ignore_patterns('desktop.ini', 'Desktop.ini', 'Thumbs.db', '.DS_Store', '__pycache__')


def copy(rel: str, base: pathlib.Path, out: pathlib.Path) -> None:
    src, dst = base / rel, out / rel
    if not src.exists():
        sys.exit(f'Missing: {src}  (see assets/README.md)')
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        shutil.copytree(src, dst, ignore=SKIP)
    else:
        shutil.copy2(src, dst)


if DIST.is_symlink() or DIST.resolve() != ROOT.resolve() / 'dist':
    sys.exit('Refusing to replace dist/ outside the project directory.')
for name in ['sb_reverie.mp3', 'Legionnaire2022.mp3', 'Anabasis_I.mp3', 'CREDITS.md']:
    if not (ROOT / 'assets' / 'music' / name).is_file():
        sys.exit(f'Missing required soundtrack file: assets/music/{name}')
for name in ['fire.png', 'smoke.png']:
    if not (ROOT / 'assets' / 'particles' / name).is_file():
        sys.exit(f'Missing required particle sprite: assets/particles/{name} (see README.md)')
if DIST.exists():
    shutil.rmtree(DIST)
for rel in APP:
    copy(rel, ROOT, DIST)
for rel in ASSETS:
    copy(rel, ROOT / 'assets', DIST / 'assets')
for folder, names in KIT_MODELS.items():
    for name in names:
        gltf = ROOT / 'assets' / folder / f'{name}.gltf'
        if not gltf.is_file():
            sys.exit(f'Missing: {gltf}  (see CLOVER_LIVING_ROAD.md, Clover look and assets)')
        refs = json.loads(gltf.read_text(encoding='utf-8'))
        for uri in [f'{name}.gltf'] + [x['uri'] for x in refs.get('buffers', []) + refs.get('images', []) if 'uri' in x]:
            copy(f'{folder}/{uri}', ROOT / 'assets', DIST / 'assets')
for rel in OPTIONAL:
    if (ROOT / 'assets' / rel).exists():
        copy(rel, ROOT / 'assets', DIST / 'assets')

files = [p for p in DIST.rglob('*') if p.is_file()]
too_big = [p for p in files if p.stat().st_size > MAX_FILE]
total = sum(p.stat().st_size for p in files)
print(f'dist/: {len(files)} files, {total / 1e6:.1f} MB')
if too_big:
    sys.exit('Over 25 MB (shrink or swap these): ' + ', '.join(str(p.relative_to(DIST)) for p in too_big))
if len(files) > MAX_FILES:
    sys.exit(f'More than {MAX_FILES} files: use `npx wrangler pages deploy dist` instead of the dashboard upload.')
