# Downloaded visual assets

These asset files are excluded from Git to keep the source repository small.
Download and extract them before running the full Theatre-mode demo. Paths below
are relative to the folder containing `index.html`.

## Day Sky HDRI 066 A ? ambientCG

- Source: https://ambientcg.com/a/DaySkyHDRI066A
- Download: https://ambientcg.com/get?file=DaySkyHDRI066A_1K.zip
- Choose the **1K** package and extract its EXR to:

```text
assets/DaySkyHDRI066A_1K/DaySkyHDRI066A_1K_HDR.exr
```

Only the EXR is loaded. The Blender, USD, Godot, PNG and tonemapped JPG files are
not needed by this demo. The EXR is about 29.5 MB.
License: CC0 ? https://docs.ambientcg.com/license/

## Grass Medium 01 ? Poly Haven

- Source: https://polyhaven.com/a/grass_medium_01
- Select **1K** resolution and **glTF** format, then extract the package.
- Preserve the following layout (the outer `.gltf` name is a directory):

```text
assets/grass_medium_01_1k.gltf/
  grass_medium_01_1k.gltf
  grass_medium_01.bin
  textures/
    grass_medium_01_arm_1k.jpg
    grass_medium_01_diff_1k.jpg
    grass_medium_01_nor_gl_1k.jpg
```

The code selects `grass_medium_01_tall_b_LOD0` (310 triangles), rather than
rendering all variants. Credit: Rico Cilliers (modeling), Rob Tuytel
(photography), Poly Haven. License: CC0 ? https://polyhaven.com/license

## Stylized Nature MegaKit — Quaternius

- Source: https://quaternius.itch.io/stylized-nature-megakit
- Download the **Standard** pack and extract it so this folder exists:

```text
assets/Stylized Nature MegaKit[Standard]/glTF/   (models + their PNG textures)
```

Used by `src/rendering/props.js` for the Grimoire Tower lands (trees, rocks,
bushes, flowers, forest floor, trail stones). Only the `glTF/` folder is loaded.
License: CC0.

## Universal Animation Library 1 + 2 — Quaternius

- Sources: https://quaternius.itch.io/universal-animation-library and
  https://quaternius.com/packs/universalanimationlibrary.html (Library 2 page linked there)
- Extract both **Standard** packs so these files exist:

```text
assets/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb
assets/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb
assets/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb
```

Used by `src/rendering/npc.js` for the Grimoire Tower villagers (mannequin bodies +
clips on the library's own skeleton). License: CC0.

## Verify

Run the launcher from the project folder, enable Theatre mode with T and wait
for the panel to show **Day Sky 066A HDRI** and **Grass: ground + nearby blades**.
Missing files can be diagnosed in the browser Network tab. Keep exact spelling
and capitalization for hosting on case-sensitive systems.
