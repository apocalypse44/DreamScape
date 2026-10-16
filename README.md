# DreamScape

A browser-based 3D exploration game built with Three.js. How you move (walking, sprinting, jumping) changes
a calm-to-chaos score that reshapes the terrain and the world around you.

**Play it live: https://dreamscape-v1.hro24.workers.dev/** (desktop browser with keyboard and mouse)

## World time

The atmosphere has a shared world clock starting at **09:00**, with a full day lasting **20 minutes
of simulation time**. During gameplay, the top-left clock replaces the Dreamscape branding.
R resets it to morning. Theatre toggles, kingdom travel and the P chaos preview do not restart it.
Theatre mode uses a procedural sky with moving sun and moon, sunrise/sunset, stars and drifting
clouds. Lighting, shadows, fog and sky reflections follow the clock; no HDRI download is needed.
Spade suppresses daylight at every hour. Its snowfall and the other kingdom climates are the next stage.

For demos, `dreamscape.clock.setHour(18)` sets the time and
`dreamscape.clock.setPaused(true)` holds it. Use `setPaused(false)` to resume.

## Requirements

- **Python 3.8 or newer**, for the local launcher. It uses the standard library only.
- A **desktop browser with WebGL** (Chrome, Edge or Firefox), plus a keyboard and mouse.
- **Internet access**: Three.js r128, Theatre.js and the fonts load from CDNs.

No npm install, build step, account or API key is needed.

## 1. Get the project

Clone the repository, or download it as a ZIP and extract it:

```sh
git clone https://github.com/apocalypse44/DreamScape.git
cd DreamScape
```

## 2. Add the assets

The models and animations are **not stored in Git**. Download them and place them at the exact paths
below, relative to the folder that contains `index.html`. Paths are case-sensitive on macOS and Linux.
The game still starts if some are missing. Those objects are skipped (the dog and NPCs fall back to simple
shapes). The sky is generated in code.

| Path | Source |
| --- | --- |
| `assets/Stylized Nature MegaKit[Standard]/glTF/` | [Stylized Nature MegaKit](https://quaternius.itch.io/stylized-nature-megakit) (Quaternius, CC0), **Standard** pack |
| `assets/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb` | [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) (Quaternius, CC0), **Standard** pack |
| `assets/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb` | [Universal Animation Library 2](https://quaternius.com/packs/universalanimationlibrary.html) (Quaternius, CC0), **Standard** pack |
| `assets/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb` | Same pack as above |
| `assets/animals/ShibaInu.gltf`, `assets/animals/Wolf.gltf`, `assets/animals/License.txt` | *Ultimate Animated Animal Pack* (Quaternius, CC0), `glTF/` folder |
| `assets/shrine/WatchTower.glb` | [Watch Tower](https://poly.pizza/m/cMxuj2gt7D) |
| `assets/crystals/BigCrystal.glb`, `assets/crystals/GemPink.glb` | [Big Crystal](https://poly.pizza/m/pf5lzmgr2J), [Gem Pink](https://poly.pizza/m/PJnKvWluqs) |
| `assets/character/Erika Archer.fbx` and the clips `Breathing Idle.fbx`, `Walking.fbx`, `Running.fbx`, `Jump.fbx`, `Crouching Idle.fbx`, `Crouch Walk.fbx` | [Mixamo](https://www.mixamo.com) (free Adobe account). Download as FBX; download the clips **In Place** |

## 3. Run the game

The game must be served over HTTP. Opening `index.html` directly (`file://`) does not work, because the
browser blocks the model and sky downloads.

### Windows

Double-click **`start-demo.bat`**. It starts a local server and opens the game in your default browser.

You can also run this from a terminal in the project folder:

```bat
python serve.py
```

If `python` is not found, try `py -3 serve.py`. If that also fails, reinstall Python with the
**"Add Python to PATH"** option checked.

### macOS and Linux

Open a terminal in the project folder and run:

```sh
python3 serve.py
```

### Then

1. The launcher prints an address like `http://127.0.0.1:<port>/index.html` and opens it. If no browser opens,
   copy that address into one.
2. Click **Enter the Dream** to capture the mouse and start playing. Press **Esc** to release the mouse.
3. Keep the terminal open while playing. Press **Ctrl+C** in it to stop the server.

The world seed is kept in the URL (`?seed=1234`), so reloading or sharing the address recreates the same world.

## Troubleshooting

- **"CORS request not HTTP"** or a blank page: use the launcher, not a `file://` page.
- **Missing sky or models:** check the asset paths above (spelling and capitals). The browser's
  Network tab (F12) shows which files return 404.
- **Old version after updating:** hard-refresh with Ctrl+Shift+R (Cmd+Shift+R on macOS).
- **Movement does not respond:** click **Enter the Dream**; the game needs the mouse to be captured.
- **Slow first load:** the models and animations are about 100 MB in total; later loads are cached.
