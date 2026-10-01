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
| [ / ] | Stress test: lower / raise the chunk view radius (1–6) |
| E / Q / F | Attract (calms the world) / repel (adds chaos) / recall the swarm in Violet Mist |
| Left / right mouse button | Attract / repel the swarm |

### Quest: The Ember Hound

The shrine at The Crossing gives instructions, but only to a calm player.
Becoming chaotic (score above 0.65; calm again below 0.40) curses your dog into
the Ember Hound. It leads you to three embers that float on peaks that only rise
in chaos. Collect them while chaotic, then return to the shrine and stand
still nearby to cure the hound for good. R restarts the quest.

The world seed is kept in the URL (`?seed=1234`). Reloading or sharing that URL
recreates the same world. The behavior panel shows FPS, frame time and the
number of loaded chunks.

The atmosphere panel shows HDRI and grass loading status. The preview changes
visuals temporarily; it does not replace the gameplay behavior score.

## Troubleshooting

- **HDRI unavailable / Grass unavailable:** check the exact asset paths in the
  asset README and inspect the browser Console and Network tabs for errors.
- **CORS request not HTTP:** use the launcher, not a `file://` page.
- **Old code after an update:** refresh with Ctrl+Shift+R.
- **Movement does not respond:** click Enter the Dream; mouse capture is required.
- **Slow initial loading:** the current 4K EXR is about 29.5 MB. A smaller EXR
  requires changing its path in `src/rendering/hdri.js`.
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
