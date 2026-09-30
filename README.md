# Dreamscape

A desktop browser exploration prototype built with HTML, CSS, JavaScript and
Three.js. Movement changes a calm-to-chaos score that controls atmosphere and
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
| E / Q / R | Attract / repel / recall the swarm in Violet Mist |
| Left / right mouse button | Attract / repel the swarm |

The atmosphere panel shows HDRI and grass loading status. The preview changes
visuals temporarily; it does not replace the gameplay behavior score.

## Project structure and startup flow

The app uses native JavaScript modules with MVC-style responsibilities. No
bundler is required, and our source files do not use IIFEs or global factories.

```text
index.html                 Small page shell, stylesheet and dependency scripts
src/
  main.js                  Application entry point
  models/
    state.js               Player and shared gameplay state
    world.js               Seeded terrain, biomes, scenery and chunk lifecycle
    swarm.js               Single implementation of the boid swarm
  views/
    game.html              Intro, HUD and atmosphere-control markup
    hud.js                 Mount the view and update displayed values
  controllers/
    game.js                Connect systems and run the animation loop
    input.js               Keyboard, pointer lock, focus and resize events
    player.js              Movement, collision and behavior-score updates
  rendering/
    scene.js               Camera, renderer and initial lights
    environment.js         Particles and environmental motion
    atmosphere.js          Theatre sequences and mode controls
    hdri.js                EXR loading, panorama and material switching
    grass.js               Ground texture and instanced grass
styles/main.css            All visual styling
vendor/                    Unmodified third-party scripts and licenses
assets/                    Downloaded visuals and setup instructions
docs/HDRI.md               HDRI implementation notes
serve.py                   Local HTTP launcher
start-demo.bat             Windows entry point
```

Startup: `index.html` loads dependencies and `src/main.js`. The entry point
mounts `src/views/game.html`, then calls the game controller. The controller
creates shared state, rendering, world generation and input, then starts the
frame loop. Each frame updates gameplay, UI and visual effects before rendering.
Native module imports keep dependencies explicit and variables scoped.

The launcher still opens `/index.html`. Asset URLs remain relative to that
page, so downloaded assets do not need to move.

## What is in vendor?

These are third-party browser scripts, not our gameplay code. They are loaded
by script tags in `index.html`, before the modules that use them.

| File | Use |
| --- | --- |
| `EXRLoader.js` | Adds `THREE.EXRLoader`; `src/rendering/hdri.js` uses it to decode the sky EXR |
| `fflate.min.js` | Decompression dependency used by EXRLoader; loaded first |
| `GLTFLoader.js` | Adds `THREE.GLTFLoader`; `src/rendering/grass.js` uses it to load the model, binary geometry and textures |
| `RGBELoader.js` | Earlier `.hdr` loader; retained but not loaded by the current page |
| `three-LICENSE.txt` | Three.js MIT license |
| `fflate-LICENSE.txt` | fflate MIT license |

The loaders match Three.js **0.128.0**. fflate is **0.6.9**. The main Three.js
library and Theatre.js are CDN dependencies, not files in `vendor/`.
Preserve these license files and the additional notices inside EXRLoader.

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
