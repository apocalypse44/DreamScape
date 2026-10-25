# DreamScape

A browser-based 3D exploration game built with Three.js. How you move (walking, sprinting, jumping) changes
a calm-to-chaos score that reshapes the terrain and the world around you.

The first time chaos turns your companion into the Ember Hound, a short in-world story scene
shows the transformation and your character's reaction. Dialogue advances automatically;
The dog catches fire before growing into the hound. **Space / Enter** continues and **X** skips
while keeping mouse control. Gameplay resumes automatically. **R** resets the quest and allows
the scene to play again.

After all three embers finish flying into the shrine, a second scene extinguishes
the hound's fire and restores the dog. The shrine keeper explains the Triad's stolen
memories and sends you west to Neris at the Lantern Refuge in Spade. Completing or
skipping the dialogue marks the refuge route; the completed quest's journal card
also lets you mark it again. This scene uses the calm soundtrack.

Music fades between **Reverie** (calm), **Legionnaire** (chaos), and **Anabasis I**
(the hound scene). Press **N** to mute/unmute, or use the music button in the right panel.
Music pauses in the menu and background tabs. The three MP3s and their
[credits](assets/music/CREDITS.md) are included by `python tools/build_dist.py`.

**Play it live: https://dreamscape-v1.hro24.workers.dev/** (desktop browser with keyboard and mouse)

## World time

The atmosphere has a shared world clock starting at **09:00**, with a full day lasting **20 minutes
of simulation time**. During gameplay, the top-left clock replaces the Dreamscape branding.
R resets it to morning. Kingdom travel does not restart it.
The world always uses a procedural sky with moving sun and moon, sunrise/sunset, stars and drifting
clouds. Lighting, shadows, fog and sky reflections follow the clock; no HDRI download is needed.
Spade suppresses daylight at every hour. Its snowfall and the other kingdom climates are the next stage.

For demos, `dreamscape.clock.setHour(18)` sets the time and
`dreamscape.clock.setPaused(true)` holds it. Use `setPaused(false)` to resume.

## Clover: The Living Road

Clover now has a story chapter beside its existing terraces. After Neris's Lantern Sigil and the
Spade castle discoveries, find **Iven at the Rootkeeper Archive**, west of the third terrace.
**E in calm** turns growth guides; **E in chaos** grows roots across gaps. Restore the three
crossings, read the Stormleaf Scar for the **Root Sigil**, then climb Clover Terraces, take the summit teleporter to Sky Garden, and jump the Starlight Ledges to Iven’s chest for
the **Tide Hook**. The summit and Sky Garden remain available. Heart owns the hook's grapple mechanics.

For a direct development demo, use `?seed=1234&unlock=all`, then press **2** for Clover's gate.
**L** near the puzzle shows the optional L-system study. See [the chapter notes](CLOVER_LIVING_ROAD.md)
for the route, limits, integration and reset behavior. The grimoire has separate Atlas, Quests and Satchel pages.

## Requirements

- **Python 3.8 or newer**, for the local launcher. It uses the standard library only.
- A **desktop browser with WebGL** (Chrome, Edge or Firefox), plus a keyboard and mouse.
- **Internet access**: Three.js r128 and the fonts load from CDNs.

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

The hound's fire uses the MIT-licensed `fire.png` and `smoke.png` sprites from
[Bobby Roe's Simple-Particle-Effects](https://github.com/bobbyroe/Simple-Particle-Effects/tree/main/img).
Place them in `assets/particles/`. Assets stay outside Git; the build includes these sprites
and [the upstream license](vendor/simple-particle-effects-LICENSE.txt).

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
2. Browse the world stories on the title screen while the game loads. When the message says
   **Your dream is ready**, click **Enter the Dream** to
   capture the mouse and start playing. The starting terrain, trees, characters, audio and rendering
   warmup finish before entry becomes available. Press **Esc** to release the mouse.
3. Keep the terminal open while playing. Press **Ctrl+C** in it to stop the server.

The world seed is kept in the URL (`?seed=1234`), so reloading or sharing the address recreates the same world.

Press **M** to show the full world map as the grimoire's cover. Click **Open quests →**
to turn the cover and reveal quest hints and clover seals for completed discoveries.
The **← World map** arrow closes it back to the map. Press **M** again to leave the atlas
and resume; **Esc** closes it with a resume prompt.

## Troubleshooting

- **"CORS request not HTTP"** or a blank page: use the launcher, not a `file://` page.
- **Missing sky or models:** check the asset paths above (spelling and capitals). The browser's
  Network tab (F12) shows which files return 404.
- **Old version after updating:** hard-refresh with Ctrl+Shift+R (Cmd+Shift+R on macOS).
- **Movement does not respond:** click **Enter the Dream**; the game needs the mouse to be captured.
- **Slow first load:** the models and animations are about 100 MB in total; later loads are cached.
