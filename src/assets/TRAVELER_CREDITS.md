# DreamScape traveller prototype

The outfit, cape, sword, face, hair, palette, and asset-building code are original
DreamScape work. The base body topology, humanoid rig, and selected animation clips
are derived from Quaternius's **Universal Animation Library** and **Universal
Animation Library 2** (sword, block, dash and knockback clips), both licensed CC0:
https://quaternius.com/packs/universalanimationlibrary.html

The source pack already used by this repository supplies the rig and motions.
`tools/traveler-builder.html` and `tools/travelerBuilder.js` reproducibly build
`src/assets/traveler.glb`. The generated GLB is included with the source so playing
the prototype does not require Blender, an asset-generation subscription, or the
full animation library download.

Three.js GLTFExporter is used only by the local asset-building tool:
https://github.com/mrdoob/three.js/tree/r128 (MIT license).

Messenger and Sumiro are references for presentation and responsiveness. Their
models, textures, animation files, and implementation code are not used here.
