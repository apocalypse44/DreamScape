# Dreamscape

A desktop browser exploration prototype built with HTML, CSS, JavaScript and
Three.js. Movement changes a calm-to-chaos score that reshapes nearby terrain
(smoother when calm, rougher when chaotic) and controls atmosphere and
environmental motion. Theatre mode adds an HDRI sky, environment lighting and
instanced grass. Terrain is generated in chunks using seeded noise.

## Requirements

- Python 3.8 or newer for the local launcher (standard library only).
- A desktop browser with WebGL enabled, plus a keyboard and mouse.
- Internet access: Three.js r128, Theatre.js 0.7.2 and fonts load from CDNs.
- The optional visual assets below for the complete Theatre-mode appearance.

No npm installation, build step, API key or account is required to run locally.

## Get the project and assets

Clone this repository or download its ZIP and extract it. Open the folder that
contains `index.html`, `serve.py` and `start-demo.bat`. 

**Large downloaded assets are not included in Git.** Follow
[assets/README.md](assets/README.md) to download the day-sky EXR and grass glTF
and put them in the expected locations. Without them, the prototype still runs,
but the HDRI and model-based grass will be unavailable.

Quest assets (all CC0, by Quaternius). Download the glTF versions and use these exact paths:

| Path | Source |
| --- | --- |
| `assets/animals/ShibaInu.gltf`, `assets/animals/Wolf.gltf`, `assets/animals/License.txt` | *Ultimate Animated Animal Pack*, `glTF/` folder |
| `assets/shrine/WatchTower.glb` | [Watch Tower](https://poly.pizza/m/cMxuj2gt7D) |
| `assets/crystals/BigCrystal.glb` | [Big Crystal](https://poly.pizza/m/pf5lzmgr2J) |
| `assets/crystals/GemPink.glb` | [Gem Pink](https://poly.pizza/m/PJnKvWluqs) |

## Run on Windows

Double-click **start-demo.bat**. It runs `serve.py`, starts a local HTTP server
on an available port, and opens `http://127.0.0.1:<port>/index.html` in your
browser. Click **Enter the Dream** to capture the mouse and start playing.

Keep the terminal window open. Press **Ctrl+C** in it to stop the server.
If Python is not found, install Python 3 and enable its PATH option, then retry.

## Run on macOS or Linux

Open a terminal in the folder containing `serve.py` and run:

```sh
python3 serve.py
```

On Windows you can also run `python serve.py` or `py -3 serve.py`.
If the browser does not open, copy the HTTP address printed in the terminal.

Do not open `index.html` by double-clicking it: browsers block the EXR/glTF asset
requests from `file://` pages. The server binds to this computer only.

## Controls

| Control | Action |
| --- | --- |
| WASD or arrow keys | Move |
| Mouse | Look around after entering the dream |
| Shift | Sprint |
| Space | Jump |
| Esc | Release mouse / return to intro |
| T | Toggle Theatre atmosphere, sky and grass |
| P | Start/stop the eight-second atmosphere preview |
| V | Switch third / first person |
| R | Reset to the starting position, score and terrain (same seed) |
| [ / ] | Stress test: lower / raise the chunk view radius (0–6: 1, 9, 25 … 169 chunks) |
| E / Q / F | Attract (calms the world) / repel (adds chaos) / recall the swarm in the Spade Kingdom |
| E near companion | Pet while calm outside Violet Mist; E attracts the swarm inside Violet Mist |
| G | Show / hide the quest route on the ground (the direction arrow always stays) |
| K | Preview the Kamui vortex (it also fills the screen on entering chaos, and plays on the Sky Garden gateway and the cure) |
| 1–5 (Theatre mode) | Demo spawns: 1 Grimoire Tower, 2 Clover, 3 Heart, 4 Diamond, 5 Spade gate (also buttons in the Atmosphere Study panel) |
| M (or the map button, top right) | Open the Grimoire Atlas: kingdoms, landmarks, embers, the hound, your route and position |
| Left / right mouse button | Attract / repel the swarm |

### Quest: The Ember Hound

The shrine at the Grimoire Tower gives instructions, but only to a calm player.
Becoming chaotic (score above 0.65; calm again below 0.40) curses your dog into
the Ember Hound. It leads you to three embers that float on peaks that only rise
in chaos. Their shards orbit you after pickup. One is reached by the floating
slab climb; another travels with the hound and drops when you approach calmly.
Return to the shrine while calm to offer the embers and cure the hound. You can
pet your companion with E while calm. R restarts the quest and companion state.

The world seed is kept in the URL (`?seed=1234`). Reloading or sharing that URL
recreates the same world. The behavior panel shows FPS, frame time and the
number of loaded chunks.

The atmosphere panel shows HDRI and grass loading status. The preview changes
visuals temporarily; it does not replace the gameplay behavior score.

### Phase 2: movement and recovery foundation

Walking can climb terrain steps up to 0.6 m; higher ledges require a jump.
Airborne landings only occur when you reach the terrain or a platform, rather
than snapping down early. Existing quest slabs still use one-way landing.

After one second on locally level, unobstructed terrain, the game records a safe
checkpoint. Falling more than 12 m from your airborne high point, or descending
after four seconds airborne, returns you to that checkpoint. Its height is
recalculated for the current terrain; an unsafe checkpoint falls back to spawn.
Floating slabs do not overwrite safe-ground checkpoints. R clears movement,
buffered jumps and checkpoints, and rebuilds chunks around spawn.

This is the foundation for future chasms and parkour courses; those features
are not included yet. No additional assets are required for this increment.

Optional developer regression checks (Node.js; no npm install needed):

```sh
node --test tests/movement.test.mjs
```

### Grimoire Falls

Spawn now has a level paved plaza with edge benches and flower planters. Muted,
smaller stones form a staggered plaza surface with broken grassy edges. Narrow
stepping-stone paths connect it to the shrine approach, waterfall bank and ridge entrance.
Both the original hills and chaos terrain are levelled beneath spawn and the shrine,
with a smooth transition into the surrounding land.
The centre stays open; furniture blocks movement and the camera avoids it.
Paving follows terrain changes, and scattered nature props avoid the paths.

A wooden direction sign stands ahead-left of spawn at **X -3.5 / Z -5**.
It points northwest to the falls and southeast to the ridge trail entrance, with
approximate straight-line distances. Two matching markers follow each route.
Signs face the approaching player and remain seated as terrain changes.

A waterfall now stands northwest of spawn, at **X -18 / Z -32**, beside a shallow
pool. From the initial view, look ahead and to the left and follow the short
stone approach. The compass shows the distance to **Grimoire Falls**.
The approach curves toward the open southeast shore, with irregular partly buried
bank stones, darker wet-looking shoreline rocks, and clusters of plants, clover,
and bushes from the existing nature kit. Ground decorations follow terrain changes.
On the east bank (right when facing the falls), four stone ledges lead to a wider
lookout. Use ordinary forward jumps with Space; each rise is 1.7 m. Solid sides
and flat landing caps match the movement collision boxes. A fall more than 2.7 m
below the last supported ledge returns you to the entrance at X -6.2 / Z -23.
The course footing stays level as chaos changes; R clears its recovery state.
Nature-kit rocks dress the columns beneath their flat landing caps. A Falls
Lookout sign marks the climb entrance beside the single plaza-to-falls path; small plants frame the
back corners of the lookout. The compass briefly confirms reaching the lookout
or returning to the entrance after a fall. R clears these messages and allows
the lookout arrival message to appear again.

The cliff reuses the local nature rock model; turbulent water ribbons, uneven
curtain edges, falling droplets, splash particles, ripples, foam and mist are
procedural. Pool highlights and a sky approximation change with the viewing
angle; these are lightweight shader effects, not real scene reflections.
No extra downloads are needed. The pool is walkable (no
swimming mechanic), the cliff blocks movement, and the camera avoids its rocks.
The basin stays stable in calm and chaos; the inner Crossing stays untouched.
Quest pickups and scattered props are kept clear of the landmark. R restarts
its water effects without moving it. Missing rock assets use a faceted fallback.

Terrain regression checks: `node --test tests/waterfall.test.mjs`.

### Grimoire Ridge

A terraced hill stands southeast of spawn, centred at **X 72 / Z 48**. Its trail
starts at **X 41 / Z 48**, beside a large entrance sign. Follow the stone spiral
on foot to a summit 9.6 m above its base, or jump across the six exposed terrace banks
for shortcuts. A summit arch, glowing crystal and light column identify the hill.
Approach the three golden exploration crystals along the trail to discover them;
the compass tracks progress and announces completion. R resets exploration.
The route and summit stay fixed as chaos changes. Terrain queries and chunk meshes
use the same shaping function; quest pickups and scattered props avoid the ridge.
Small nature-kit rocks and plants sit outside the marked route.

Checks: `node tests/ridge.test.mjs` and `node tests/movement.test.mjs`.

## Troubleshooting

### Clover cliff terraces

Follow the **Clover Terraces** board on the spawn sign straight north. Stone
markers and signs lead to **X 0 / Z -336** (about 19 seconds of straight sprinting
from spawn). The section extends into Clover Kingdom from Z -360 to Z -448.
Three grass-topped plateaus rise to 6, 9 and 12 m over a ravine. A broad entrance
ramp and two sloping bridges provide a continuous walking route; six east-side
stepping rocks provide optional jump shortcuts. Missing a jump returns you to
the entrance. The summit stone arch marks the destination. R resets recovery.
Required surfaces stay fixed in calm and chaos; terrain and decorations outside
the reserved section continue to use the existing world generation. Trees reuse
the local nature kit, and no additional assets are required.
Plateau surfaces have a seeded, tileable grass-and-soil texture. Grouped medium
rocks, pebbles, bushes, flowers and clover dress the sides of each walking route;
the middle terrace has a larger outcrop. Larger rocks have collision, while
bridge mouths and jump landing platforms stay clear. Dressing reuses local assets.
Rock bodies stop below the grass caps to avoid overlapping surface stripes.
Cliff faces have irregular facets and angular rock ribs. Bridges have individual
deck boards, beams, posts and side rails; rails block sideways walking while the
central walking route stays open.
The high valley continues north to Z -542. Irregular polygon outlines are shared
by visible cliffs and movement collision. From the third plateau, head west for
a winding climb over three broad ledges, north for an eight-rock jumping ascent,
or east for an overlook loop that reconnects to the plateau. Both summit routes
reach the central formation at X 2 / Z -510, top height 24 m (31 m over the ravine).
Falls more than 5 m below the last supported height recover to the entrance.
After reaching the upper summit, falls recover to **X 2 / Z -534**, at the summit
entrance and height 24 m. Recovery stays armed beyond the cliff footprint and
does not replace the checkpoint with the terrain underneath the summit.
The upper formation now contains a ruined sanctuary: broken courtyard walls,
an arched gateway, fallen masonry, a glowing animated crystal, and grouped trees,
rocks and flowering plants. The gateway now has an inset stone courtyard,
illuminated arch glyphs and garden borders; the unnecessary summit stepping
stones have been removed. An east overlook loop returns to the courtyard.
Entering the grove displays its discovery
message; R resets it. Joined summit surfaces share world-space texture coordinates
to reduce visible texture seams. Sanctuary dressing reuses existing local assets.

Checks: `node tests/clover.test.mjs` and `node tests/movement.test.mjs`.

### Clover floating sky garden

Reach the sanctuary arch at **X 2 / Z -499** on the 24 m summit. Stand near its
glowing doorway and press **E** to travel. A 3.8-second sequence charges the
gateway, carries the visible character along a curved flight with orbiting light
and a starlight trail, then lands with a light pulse. A following camera widens
its view during flight and restores the player's perspective afterward. Movement,
jumps, collision and gravity pause during the sequence; R safely resets it.
The separate island is at **X 72 / Z -552**, world height 64 m. Its floating cliffs and west-facing
waterfall are visible from the summit; there is no walking connection from the
ground. The matching island doorway returns you to the summit. Hold-to-repeat
travel is disabled, and travel clears momentum and buffered jumps.

Both gateway instruction boards have separate readable front and rear faces,
offset in front of the portal. The High Valley Summit board sits to its left.
The garden includes an irregular grass-covered island, tapered rocky underside,
hanging vegetation, ruined walls, tree and flower clusters, a spring and flowing
waterfall, broken archways, flowering borders, drifting lights and stone seating
beside the spring. Follow the stone path and ramp to the raised crystal shrine
to awaken its lighting, orbiting rings and garden runes. A railed bridge leads to the eastern lookout; optional jumping ledges
lead northeast to the hidden Starlight Perch. The ledges can also be jumped back.
Falls return you to the island entrance, rather than the terrain far below.
**R** resets the whole game, portal state and island discoveries. All decoration
uses existing local nature assets and procedural geometry.

Checks: `node tests/skyIsland.test.mjs` and `node tests/movement.test.mjs` cover
portal proximity and height, two-way travel, flight continuity and cliff clearance,
input blocking, walking and
jumping routes, explicit-height recovery, discovery and reset.

- **HDRI unavailable / Grass unavailable:** check the exact asset paths in the
  asset README and inspect the browser Console and Network tabs for errors.
- **CORS request not HTTP:** use the launcher, not a `file://` page.
- **Old code after an update:** refresh with Ctrl+Shift+R.
- **Movement does not respond:** click Enter the Dream; mouse capture is required.
- **Slow initial loading:** most of the first load is models and animations; the
  1K sky EXR is only about 1.9 MB (path in `src/rendering/hdri.js`).
- **Low frame rate:** grass density/range is configured in `src/rendering/grass.js`; actual
  performance depends on the device. This prototype has no verified FPS guarantee.

## Sharing on GitHub

Commit the source files, launchers, documentation, `.gitignore` and `vendor/`.
The ignore rules exclude downloaded assets, local environments, caches, logs,
archives and local editor settings. Asset instructions remain tracked.

A GitHub source repository does not itself run the game. A static host can serve
this project without Python, but must also receive the required assets at the
same relative paths. The launcher is only for local use. An asset-free checkout
will not reproduce the full screenshot until the assets are downloaded.

Ignore rules do not remove files already tracked by Git. Review staged files
before committing. No project-wide license has been selected here; the
third-party licenses apply to their respective files.
