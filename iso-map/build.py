# Builds both atlas pages from the iso-glow templates.
#   grimoire-atlas.html     2D plate (fig.js)
#   grimoire-atlas-3d.html  3D terrain diorama (fig3d.js + atlas-data.json; run `node iso-map/bake.mjs [seed]` first)
# Usage: python iso-map/build.py
import pathlib
here = pathlib.Path(__file__).parent
skill = pathlib.Path.home() / '.claude/skills/iso-glow/assets'
read = lambda p: p.read_text(encoding='utf-8')

def build(template, out, swaps):
    s = read(skill / template)
    for a, b in swaps:
        assert a in s, a
        s = s.replace(a, b, 1)
    (here / out).write_text(s, encoding='utf-8')
    print('wrote', here / out)

# picker swatches: [name, darkAccent, darkHi, lightAccent, lightHi], taken from the game's world map
palette = """[['Grimoire gold','#d8b25a','#f3d98f','#a8801f','#c99a2e'],
  ['Clover','#8fe36b','#c8f7ad','#3f9a2a','#5fb845'], ['Heart','#ff6b6b','#ffb0b0','#d93a3a','#ef6060'],
  ['Diamond','#ffd36b','#ffe9b0','#c08a00','#d9a520'], ['Spade','#b9a6ff','#ddd3ff','#6e52d9','#8d76ef'],
  ['Ember','#ff9a2e','#ffc77a','#ff9a2e','#ffc77a']]"""
build('gallery.html', 'grimoire-atlas.html', [
    ('<title>Iso Figures</title>', '<title>Grimoire Atlas</title>'), ('Iso figures</span>', 'Grimoire Atlas</span>'),
    ("palette: 'ember', autoDemo: false, storageKey: 'iso-glow-accent'",
     f"palette: {palette}, autoDemo: true, storageKey: 'grimoire-atlas-accent'"),
    ('/* paste figure scripts here (see examples/) */', read(here / 'fig.js'))])

fig3d = read(here / 'fig3d.js').replace('/*ATLAS_DATA*/null', read(here / 'atlas-data.json'), 1)
build('gallery-3d.html', 'grimoire-atlas-3d.html', [
    ('<title>Iso 3D</title>', '<title>Grimoire Atlas 3D</title>'), ('<i></i>Iso 3D</div>', '<i></i>Grimoire Atlas</div>'),
    ('/* paste 3D figure modules here */', fig3d)])
