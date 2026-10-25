# Clover: The Living Road

Implemented on `vivek-development`, 23 October 2026. This chapter follows the Ember Hound cure, Neris's Lantern Sigil and the Spade castle discoveries. Heart remains the next chapter; the finale is outside this change.

## Owner decisions

- Preserve Clover's existing terraces, high-valley summit, sanctuary and Sky Garden.
- Add the Rootkeeper Archive and a new road to the Stormleaf Scar beside them.
- Earn the Root Sigil at the Scar. Following the later user-approved revision, the Tide Hook chest is at **the floating Sky Garden’s highest Starlight perch (68 m)**, reached through the summit gateway and ledge jumps. It remains in Clover, not Spade.
- Clover-specific weather is separate work. Heart owns the hook's grapple mechanics and Risen Reef.

The Sky Garden ledge chest is the latest user-approved extension: it supersedes the original handoff’s Archive placement and the intermediate summit placement, giving both the terrace climb and floating ledges a quest purpose. No beacon or additional quest card was added.

## Playing the chapter

1. Complete the hound cure, Neris's chapter, the castle archive, erased witness and Hollow Crown inspection. Carry the Lantern Sigil.
2. Travel north (demo key **2** reaches the kingdom gate). Climb the central terraces. On the third terrace, take the west stone walkway to the **Rootkeeper Archive**.
3. Approach Iven in calm and press **E**.
4. Each junction has a leaf mark and a directional guide. **E in calm** turns the guide clockwise. **E in chaos** energizes the next generation. The viable directions are **west, north, west**.
5. The outlined **gold leaf** is the fixed target direction; the **cyan arrow** on the pedestal is your current selection. Wrong headings stop at stone. Calm down and turn the guide to retry. Growth takes 2.4 simulation seconds. A crossing becomes solid only when growth finishes; the prompt says when it is safe.
6. Cross all three root bridges to the Stormleaf Scar. Read its pattern in calm with **E** to earn the **Root Sigil**.
7. Return along the permanent road, then climb the existing **Clover Terraces** ramps to the **high-valley summit**. Follow the new signs and press **E at the glowing teleporter** to enter the floating **Sky Garden**. Follow the **Starlight Ledges** signs and jump up all three ledges to the highest perch. Iven’s chest is at `(126.5, -578.5)`, on the existing 68 m perch. Open it in calm with **E** for the **Tide Hook**.
8. Return down the ledges and use the Sky Garden gateway to return to the summit. Descend the terraces and travel east to **Sera in Heart**. Before the chest, Iven repeats the full route; afterward, he confirms Clover is complete and explains the Heart lead.

**M** opens the grimoire’s three pages: **Atlas**, **Quests**, and the independent **Satchel** inventory page. The existing Living Road card tracks progress and marks the Scar or Sky Garden chest as appropriate; Archive, Scar and Sky Garden chest destinations appear in the Atlas. No new quest-list entry is added. These destination markers provide directions; they do not claim that terrain A* can navigate elevated bridges. **L** near the Archive toggles the optional growth study. **R** clears the chapter and its earned items. Progress is session-only, as with the other chapters.

## Development shortcut

Use `index.html?seed=1234&unlock=all` to test Clover without replaying the earlier chapters. This explicitly starts with a cured companion, grants the Lantern Sigil and bypasses the castle-discovery prerequisite. It does **not** grant the Root Sigil, Tide Hook, Tide Sigil or Prism Sigil. In this development mode, R resets Clover and reapplies only those earlier-story prerequisites. Normal URLs retain the actual story gates and full reset.

`dreamscape.clover.model` exposes the chapter for inspection alongside the existing debug handles. `?growth=1` enables the optional study on approach. Debug flags are development tools rather than saved story progress.

## Algorithm and graphics

Pure logic lives in `src/models/cloverGrowth.js` and `src/models/cloverCampaign.js`; Three.js rendering lives in `src/rendering/cloverCampaign.js`.

The axiom is `X`, with productions:

```text
X → F[+B][-B]X
B → d[+B][-B]
```

`F` advances along a designated horizontal road run; `d` draws a decorative branch. `[` and `]` save and restore the turtle's position and heading. `+` and `-` turn decorative branches by 60 degrees. Each guide selects a cardinal heading for its road run. Rewriting is limited to three rounds and the turtle is capped at 128 segments and the combined instanced root bodies, previews and surface strands are capped at 128 rendered parts. Seeded decorative lengths vary while the solvable backbone remains fixed.

The road uses a bounded, authored skeleton with an L-system interpretation, not unrestricted plant growth. Rewriting never replaces `F`, so later generations preserve earlier road coordinates. Swept segment/circle tests clip roots against the same rocks the renderer and player collision use. The model validates the generated endpoint before allowing growth to complete.

Horizontal `F` runs supply explicit rectangular support surfaces; decorative branches do not. Surface entries are registered once in the shared platform list, and their `contains()` functions remain false until the corresponding generation is complete. This avoids the spread-array trap of adding a platform to a source list after game composition has already copied it.

Roots and repeated books use instancing. The Archive, guide dials, inscriptions, chest and Scar use shared procedural geometry and existing materials. Grass caps reuse the existing Clover terrace texture, standard lighting material and world-space UV scale. Root render bodies are clipped to landing edges so they cannot compete with the grass top; this does not alter the turtle or collision coordinates. `src/rendering/cloverRoadLayout.js` holds the cardinal-symbol rotation and render clipping helpers. Iven reuses the existing villager mannequin and animation pipeline, with a procedural pale open cloak, dark trim, light hair, round dark glasses, animated sleeves and a carried book (`src/rendering/ivenStyle.js`). The chapter adds no model downloads and no lights.

## Integration and invariants

- `game.js`: chapter construction, static collision, platform registration, update, reset, gameplay gates, HUD goal selection, camera obstacles and debug handle. Existing Diamond integration is retained.
- `world.js`: stable ravine ground and exclusion from both random props and legacy ruins. Other Clover landmarks retain their terrain.
- `player.js`: existing movement is reused. The chapter's recovery takes priority inside its own footprint, preventing legacy summit recovery from treating its new platforms as a fall.
- `companion.js`: a bounded authored polyline carries the cured companion around the road's corners. It does not request ground A* across the ravine. Automatic fetch/mood motion does not override that authored following.
- `encounters` input callback: Clover interactions take priority over companion petting. Gameplay modes, not visual atmosphere colors, decide actions.
- `inventory.js`: `root-sigil` is defined; the existing `tide-hook` is earned on Sky Garden’s highest Starlight perch. Reward events occur once.
- `grimoireJournal.js`, `worldMap.js`, `landmarkHints.js`: real stage progress, unique completion stamp, Satchel icon and matching authored destinations.

Completed growth, the read pattern and rewards survive changing mode, retrying, falling, and leaving/re-entering the area. Only full reset clears them. Early exploration cannot grant either reward. The Scar must be reached at its elevated height, after all three crossings are restored, and read in calm.

## Validation

Automated checks cover bounded rewriting, deterministic seeds, backbone connectivity, obstacle clipping, unchanged earlier road segments, delayed collision activation, story gating, retry, ordered rewards, checkpoint recovery, companion corner routing and reset. The movement suite traverses the Archive approach and all crossings out and back, then follows the existing terrace ascent, gateway journey and actual ledge jumps to the Sky Garden chest, using the real movement controller, guide colliders and blocking rocks. Chest interaction requires the actual 68 m perch height; the old Archive and summit chest spots grant nothing.

Run test files in separate Node processes: several suites install different minimal `THREE` test doubles, so forcing all suites into one shared process is not a valid runner configuration. The existing plain `node tests/<name>.test.mjs` style works without npm or a build step.

Browser verification and any measured performance observations are recorded in `SESSION_LOG.md`; automated model tests alone do not prove a GPU frame-rate target.
