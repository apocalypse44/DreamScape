# Session log

## 23 October 2026 — Clover: The Living Road

Worked on the existing `vivek-development` branch after reviewing the latest merged Diamond chapter (`fc6c3b4`) and the supplied story, environment and handoff documents. No commits, pushes, merges or deployments were performed.

### Owner-approved scope

Preserve the original Clover terraces, summit and Sky Garden. Add Iven's Rootkeeper Archive, a Living Road growth puzzle and the Stormleaf Scar. Award the Root Sigil at the Scar, then the Tide Hook from a chest at **Clover's Archive**. Grapple mechanics belong to Heart. Clover-specific weather is separate.

### Implementation

- Pure seeded L-system rewriting and turtle interpretation, capped at three rounds and 128 algorithm segments.
- Three guide-controlled root crossings: read/turn in calm, energize in chaos, stop at shared stone obstacles, retry without losing completed bridges.
- Explicit horizontal support surfaces, activated after 2.4 simulation seconds. Later generations never move earlier support.
- Permanent chapter/reward state for the session, safe junction recovery, and full R reset.
- An authored companion route through the actual crossing corners, avoiding terrain A* over the ravine and avoiding automatic fetch overrides there.
- Procedural Archive, Iven through the existing villager pipeline, readable guide plaques, root preview/animation, Scar and opening chest. Bounded instancing; no new lights or downloaded assets.
- Journal oath, Satchel icon, Archive/Scar map markers and destination buttons, local landmark hints, HUD objective priority, context-specific E handling and optional L growth study.
- `?unlock=all` for Clover demos: earlier prerequisite preset only, no Clover rewards. Normal play still requires the Lantern Sigil and complete Spade castle discoveries.
- Owner-provided story/environment documents added to the repository and updated for Clover and the resolved hook placement. Detailed notes are in `CLOVER_LIVING_ROAD.md`.

### Techniques and problems addressed

The platform list in `game.js` is assembled with array spreads. Therefore all bridge support entries are registered once and use live activation predicates; appending entries to a chapter's old source array would not reach movement or foot placement. Completed F terminals are not rewritten, keeping support coordinates immutable.

The old summit recovery only recognizes legacy Clover surfaces and can mistake the new road for a fall. The new footprint takes recovery priority and uses clear, elevated checkpoint positions. The companion follows a projected polyline and visits every corner rather than choosing a nearest node that could cut diagonally across a gap.

Long story messages were moved from the large global toast to a compact chapter dialogue panel. Story materials use stable flat colors with normal distance fog so bright sky lighting cannot erase guide and root cues.

### Validation

Automated validation: 173 passing Node tests across the individual test files, plus the existing 357-case ledge step-off sweep. Added core growth/chapter tests and an actual movement-controller round trip with the blocking stones and guide pedestals. Other tests cover journal, demo cure preservation, terrain continuity, original Clover/Sky Garden traversal and the existing Diamond chapter. Browser-module syntax checks and `git diff --check` passed.

Full-game browser checks at seed 1234 used temporary UI test controls for chapter travel and calm/chaos presets; those controls are removed before delivery. E actions used the game's input path. Verified Iven dialogue, wrong-heading rejection, guide rotation, generation completion, all three crossings persisting across mode changes, calm-only Scar reading, both inventory rewards in order, journal oath/Satchel state, the Archive map destination, fall recovery, and R clearing the chapter/rewards. Physical route traversal out and back was separately exercised by the real movement-controller integration test.

The embedded test browser reported its existing Chromium mouse-capture error when closing the map; the temporary test UI resumed the check. These checks do not certify ordinary desktop mouse capture or establish a universal FPS target. No chapter shader/runtime failure was observed during the progression checks. No public build or deployment was performed.

### Clover floor rendering correction

Fixed gray/green striping while moving near the Rootkeeper Archive. The stone bodies previously ended at the exact grass-cap height, causing depth fighting. Stone now stops 0.12 m below the unchanged walking surface, underneath the 0.16 m grass layer. The approach render mesh is trimmed to the Archive edge and the third terrace's authored polygon, eliminating overlapping floor faces at both joins. Collision and story state are unchanged.

Validation: all 9 Clover chapter tests and 34 movement tests pass, along with module syntax and whitespace checks. Browser checks at seed 1234 inspected the approach and Archive from different positions and exercised sprint input; the floor stayed green and feet remained at 12 m, with no runtime errors reported. Temporary preview controls were removed.

### Clover ground, wayfinding and board placement

Archive, approach and landing caps now use the same textured Standard grass material and world-space texture scale as the original terraces. Fixed target leaves have a clear gold silhouette, dark outline, tip, stem and vein; cyan arrows show the current guide selection. Both use the same cardinal rotation convention as the turtle. Boards are on side posts, the Archive header hangs clear of its east beam, and the Living Road instructions are separated from Guide 1. Root bodies and surface strands render only across the gaps, preventing root/grass depth fighting at the junctions while retaining original support coordinates.

Validation: 58 relevant tests pass (4 new presentation-layout checks, 5 growth, 9 chapter, 6 Clover terrain and 34 movement checks), plus syntax and whitespace validation. The new checks verify all four arrow headings, landing-edge trimming, partially grown roots and clipping for wrong headings across multiple seeds.

Browser checks at seed 1234 confirmed textured ground at the entrance and all three junctions, roots stopping at landing edges, the mounted Archive header and separated boards, and all three fixed target leaves. E rotated Guide 2 from east to south and Guide 3 from south to west while the gold targets remained fixed. Guide 3's cyan arrow then aligned with its west leaf. No browser runtime errors were reported. Temporary camera/travel controls were removed after saving the verification image.

### Archive visibility and chest hinge

Removed the chapter root's 115 m visibility cutoff. The scenery now remains visible at distance under normal camera culling/fog; proximity still gates detailed root refreshes and the optional study UI. Moved the chest lid pivot to its south/rear edge, offset the closed lid back across the box and reversed the opening rotation. The lid now rises away from the north approach and settles at about 109 degrees, behind the rear hinge.

Validation: the 9 chapter and 4 render-layout tests pass, with syntax and whitespace checks. A temporary browser component scene using the actual Three.js chapter renderer verified root visibility at entrance positions (1, -339), (1, -340) and the distant spawn, and verified that the opened lid tip is above and behind the rear hinge. No runtime errors were reported. This focused renderer check was separate from the full game's terrain/lighting scene. Temporary preview files were removed.
