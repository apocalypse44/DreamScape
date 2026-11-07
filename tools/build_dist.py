"""Build dist/ for static hosting: app files + only the assets the game loads."""
import json
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
MAX_FILE = 25 * 1024 * 1024  # Cloudflare Pages per-file limit
MAX_FILES = 1000  # Cloudflare dashboard upload / itch.io limit

APP = ['index.html', 'movement-lab.html', 'src', 'styles', 'vendor']
ASSETS = [
    # The dog and Ember Hound now ship as src/assets/dog.glb and hound.glb (tools/dogBuilder.js).
    'animals/License.txt',
    'crystals',
    'shrine',
    'spade',
    'music',
    'particles',
    'Stylized Nature MegaKit[Standard]/glTF',
    # NPC bodies and clips ship as src/assets/people (tools/peopleBuilder.js); the UAL packs are dev-only.
    # Diamond kingdom (DIAMOND_KINGDOM_TERRAIN.md): particle sprites and the shack roofs' corrugated steel.
    *[f'kenney_particle-pack/PNG (Transparent)/{n}.png' for n in ['smoke_04', 'circle_05', 'star_06', 'magic_02', 'spark_04']],
    'kenney_particle-pack/License.txt',
    'CorrugatedSteel005_1K-JPG/CorrugatedSteel005_1K-JPG_Color.jpg',
    'CorrugatedSteel005_1K-JPG/CorrugatedSteel005_1K-JPG_NormalGL.jpg',
    'KayKit_Medieval_Hexagon_Pack_1.0_FREE/License.txt',
    # Diamond Siege Yard (diamondSiege.js): Kenney Castle Kit engines share one colormap.
    *[f'kenney_castle-kit/Models/GLB format/siege-{n}.glb' for n in ['ballista', 'ballista-demolished', 'catapult', 'catapult-demolished',
                                                                      'trebuchet', 'trebuchet-demolished', 'ram', 'ram-demolished', 'tower', 'tower-demolished']],
    # Prism Citadel (diamondKingdom.js): hexagon towers, curtain walls, banners and the drawbridge.
    *[f'kenney_castle-kit/Models/GLB format/{n}.glb' for n in ['tower-hexagon-base', 'tower-hexagon-mid', 'tower-hexagon-top',
                                                                'tower-hexagon-roof', 'wall', 'flag-banner-long', 'bridge-draw']],
    'kenney_castle-kit/Models/GLB format/Textures/colormap.png',
    'kenney_castle-kit/License.txt',
]
# Kit packs where the game loads only a few models (cloverArchiveProps.js): copy each model's
# .gltf, its buffers and the textures it references, not the whole pack.
KIT_MODELS = {
    'Fantasy Props MegaKit[Standard]/Exports/glTF': ['Bookcase_2', 'Shelf_Arch', 'BookStand', 'Book_Stack_1', 'Book_Stack_2',
                                                     'Scroll_2', 'Chandelier', 'Lantern_Wall', 'Vase_2',
                                                     'Barrel', 'Crate_Wooden', 'Bucket_Wooden_1', 'Stall_Cart_Empty', 'Cauldron',
                                                     # Diamond: Artificers' Row workshops and Orin's Hall (diamondRow.js)
                                                     'Workbench', 'Workbench_Drawers', 'Anvil', 'Anvil_Log', 'Bucket_Metal', 'Whetstone',
                                                     'Crate_Metal', 'Shelf_Simple', 'WeaponStand', 'Shield_Wooden', 'Sword_Bronze',
                                                     'Peg_Rack', 'Table_Large', 'Scroll_1', 'Dummy'],
    'Medieval Village MegaKit[Standard]/glTF': ['Roof_RoundTiles_8x12', 'Prop_Vine5', 'Prop_Vine2'],
    # Diamond: Dustward clutter and the Workers' Stockade camp (diamondDustward.js, diamondStockade.js).
    'KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/decoration/props': ['tent', 'sack', 'barrel', 'crate_A_big', 'crate_long_A', 'wheelbarrow',
                                                                           'resource_stone', 'bucket_water', 'pallet',
                                                                           'target', 'weaponrack', 'bucket_arrows', 'resource_lumber', 'crate_B_big',
                                                                           'crate_open', 'flag_yellow', 'flag_red'],
    'KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/neutral': ['building_destroyed', 'building_scaffolding'],
    'KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/yellow': ['building_well_yellow', 'building_barracks_yellow', 'building_archeryrange_yellow'],
    'KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/red': ['building_tower_A_red'],
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
