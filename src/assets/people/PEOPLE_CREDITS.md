# DreamScape people kit

Built by `tools/peopleBuilder.js` with `tools/peopleKit.js` (open `tools/people-builder.html` on the
local server). Building is a development step; the game and the Cloudflare Pages deploy use only
the committed files in this folder.

- `people-clips.glb`: one shared, stripped clip pack (skeleton only) for every people-kit NPC.
  The clips are Quaternius *Universal Animation Library* 1 and 2, CC0:
  https://quaternius.com/packs/universalanimationlibrary.html
- `<character>.glb`: one character each (body, face shell, props; no clips, no textures).
  The skeleton is the same CC0 rig. Bodies, clothing, hair, palettes and the runtime anime face
  (`src/rendering/travelerFace.js`) are original DreamScape work.

Characters take personality and role inspiration from Black Clover (see `CHARACTER_PLAN.md` 2b);
no names, likenesses, outfits or artwork from that series are used.
