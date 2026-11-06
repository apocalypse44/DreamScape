# DreamScape companion and Ember Hound

`dog.glb` and `hound.glb` are built by `tools/dogBuilder.js` (open `tools/dog-builder.html`
on the local server). Building is a development step; the game and Cloudflare Pages deploy
use only these two committed files.

**Source models, rigs and the twelve original clips:** Quaternius, *Animated Animals*
(Shiba Inu and Wolf), licensed CC0: https://quaternius.com/ (licence copy in
`assets/animals/License.txt`).

**Original DreamScape work:** the palettes; Shiba eyebrow dots and cheek fluff; the rune
bandana with its wisp-violet sigil tag; the ember scar; the hound's ember cracks and glowing
eyes; smoothed toon normals; and the seven clips authored in code (`sit`, `lie`, `pet`,
`howl`, `bark`, `playBow`, `shake`). Tail wag, ear springs and head look-at are procedural
at runtime (`src/rendering/dogCharacter.js`, `src/models/dogMood.js`).
