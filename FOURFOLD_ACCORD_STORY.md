# The Fourfold Accord

Story and algorithm design for Dreamscape. This document includes both implemented chapters and future proposals; see each chapter's status. Clover's owner-approved implementation is documented in CLOVER_LIVING_ROAD.md.

**Motto: Explore in stillness. Discover in chaos.**

## Main route

**Ember Hound -> Spade (first encounter) -> Clover -> Heart -> Diamond -> Spade (Triad finale) -> Grimoire Tower.**

Spade is the first kingdom after curing the Ember Hound. The player uses its swarm to win an initial encounter, then discovers that the Triad's main defenses depend on magic stolen from the other kingdoms. Exploring those kingdoms provides the knowledge and tools needed to return and defeat the Triad.

Calm supports listening, gathering, inspecting, and preparing. Chaos supports revealing, reshaping, releasing, and attacking. Neither mode is evil. Every kingdom has one signature algorithm with a direct quest purpose; shared terrain and navigation systems can still operate everywhere.

The kingdoms and ruling Spade Triad retain the Black Clover inspiration, while the characters and events below form Dreamscape's own story.

## Kingdom algorithms

| Kingdom | Signature algorithm | Calm use | Chaos use | Quest result |
| --- | --- | --- | --- | --- |
| Spade | Boids flocking: separation, alignment, cohesion, player steering | Gather wisps, guide them toward refuges, prepare formations. | Direct coordinated swarm strikes through exposed wards. | Free a border settlement, then use the swarm to attack the Triad in the finale. |
| Clover | L-system branching growth | Read branch patterns and orient growth guides. | Energize growth nodes to extend roots across gaps. | Restore a living road and recover the Root Sigil, which identifies true bindings. |
| Heart | A* pathfinding on a terrain grid | Guide a water spirit through safe crystal passages and choose waypoints. | Reveal or open passages, then let the spirit replan around changed obstacles. | Escort the spirit to the siphon core and recover the Tide Sigil, which disables the Triad's shield supply. |
| Diamond | Wave Function Collapse (WFC) constraint solving | Inspect sockets and place compatible conduit fragments. | Expose buried sockets and activate the repaired relay. | Recover the Prism Sigil, which exposes the Triad's armor through an inversion circuit. |

Each algorithm must change a route, puzzle state, or encounter outcome. Decorative roots, particles, water, or ruins alone do not satisfy this design.

### Computer graphics and game simulation learning goals

The selection follows the topics recorded in `COURSE_TECHNIQUES.md`: boids and A* under AI in simulation, and L-systems and WFC under procedural content generation. A* is a game AI algorithm rather than a rendering algorithm; all four fit the project's broader graphics, procedural generation, and simulation scope.

| Kingdom | What the student implements and learns | Visible evidence for a course demo |
| --- | --- | --- |
| Spade | Local steering rules, vector integration, neighbor interactions, and emergent flock behavior. | Show separation, alignment, and cohesion contributing to a gathered flock, then a coordinated ward strike. |
| Clover | Symbol rewriting, recursion limits, turtle interpretation, and procedural branching geometry. | Show a rule string becoming branch segments over successive growth stages, with a generated branch opening a route. |
| Heart | A* search using `f(n) = g(n) + h(n)`, a priority queue, obstacle constraints, and replanning. | Show visited cells and the chosen path; change a passage and show the water spirit selecting a different valid route. |
| Diamond | Tile domains, adjacency constraints, constraint propagation, minimum-domain selection, and contradiction recovery. | Show possible tiles narrowing after a placement, then a valid conduit layout opening a gate. |

Optional developer overlays expose these intermediate steps for assessment. Normal play uses simple story language. Each algorithm must be implemented and observable; changing colors or unlocking a scripted door alone does not demonstrate it.

## Existing systems and proposed additions

- **Spade:** `src/models/swarm.js` already has boids, attract, repel, and recall. `src/controllers/game.js` ties attraction to calming and repulsion to increasing chaos. Enemy targeting, coordinated attacks, ward damage, and boss encounters are proposed additions.
- **Clover:** Existing terraces and elevated routes provide the setting. L-system growth and its route puzzle are proposed additions.
- **Heart:** Existing red crystals provide the setting. Reuse `src/models/pathfinding.js`, already used by the hound and navigation, for a new water-spirit escort. Spirit steering, puzzle blockers, waypoint interactions, and siphon completion are proposed additions.
- **Diamond:** `src/models/world.js` has a small local tile-compatibility ruin pass, described as WFC-style in `COURSE_TECHNIQUES.md`. The quest proposes fuller constraint propagation and contradiction recovery; these should not be assumed to exist already.
- **Ember Hound:** Existing A* companion routing and navigation introduce exploration. Heart makes A* the visible central quest mechanic; its earlier use by the hound remains intact. A kingdom's signature algorithm need not be exclusive to that kingdom.

## Feasibility with the current stack

**Assessment:** achievable as a staged expansion using the existing Three.js r128, browser JavaScript ES modules, HTML/CSS HUD, and static hosting. No new engine, backend, runtime AI, physics library, or build step is required for the bounded version below. This is an architectural assessment from the current code, not a measured performance guarantee or a claim that these features already exist.

Theatre.js can continue controlling atmosphere. Quest correctness must use the gameplay state, not Theatre's visual preview. New characters and Triad projections can use existing model-loading fallbacks or simple meshes, so the first playable version does not depend on acquiring new character rigs or attack animations.

### Practical first-version limits

These are proposed starting limits to validate on the target desktop browser.

| System | Buildable initial scope | Existing foundation and integration needed |
| --- | --- | --- |
| Spade swarm | Retain the existing default of 84 wisps; one exposed stationary ward at a time; three sequential Triad phases. | Reuse `DreamSwarm`, instancing, and steering. Add target selection, hit tracking, and a small encounter state machine. Keep the Triad as projections above fixed anchors for the first version. |
| Clover growth | One bounded root puzzle, at most three rewriting rounds and 128 rendered segments; two or three junction choices. | Generate branch data in JS and render low-poly cylinders or boxes. Use existing terraces for traversal. Support only short, axis-aligned horizontal bridge sections with simple rectangular platforms. |
| Heart A* escort | One spirit, three checkpoints, two or three switchable crystal passages, and a bounded puzzle grid. | Reuse terrain-aware `findPath`; render the spirit as a small glowing mesh. Add crystal blockers and replan only on target or passage changes, with a cooldown for terrain changes. |
| Diamond WFC | One 4-by-4 board with roughly six connector tile types including rotations; no kingdom-wide solver. | Extend the local tile-rule idea into a separate small solver. Render flat conduit tiles with simple meshes. Run constraint propagation only after puzzle actions, with a fixed work limit and a known valid fallback. |
| Finale | Three short defense puzzles and swarm attack phases in one arena. | Reuse the kingdom puzzle logic with smaller inputs. Add explicit phase transitions and ward feedback; avoid starting with free-roaming enemy AI, melee combat, or a player health system. |

### Integration details that keep the design practical

**Quest progression:** keep Ember Hound's existing `companion`, `cursed`, `return`, and `cured` stages intact. Start a separate campaign state machine after `cured`, with fields for chapter, objective, sigils, and completed discoveries. This preserves the assumptions in companion rendering, encounters, and the cure effect. Extend the existing shrine panel, goal text, navigation stops, and map markers to display campaign objectives.

**Controls:** reuse movement and the existing Spade attract/repel/recall controls. Choose the nearest eligible interaction within a short range and show its action before accepting input. Add context priority for shrine, puzzle, gateway, companion, and swarm actions: `E` already participates in petting, gateway travel, and attraction, so a single press must not trigger several actions. Keyboard hints and simple in-world switches are sufficient; a new inventory or drag-and-drop editor is unnecessary.

**Swarm hits:** store each wisp's previous and current position and test its movement segment against the active ward's sphere. Testing only its current position could miss a fast crossing. Count each wisp at most once per attack window, then clear the count when regrouping. Formation and hit checks add a linear pass over the existing flock; do not increase flock size to make attacks feel stronger. Damage can be an integer number of successful group strikes rather than a full combat system.

**Clover collision:** an attractive cylinder mesh does not automatically become a walkable bridge. Existing movement uses explicit platform data, not arbitrary mesh collision. Map only designated horizontal branch runs onto rectangular platform entries, activate those entries when growth completes, and keep them stable afterward. Render other branches as decoration. Do not require arbitrary curved or rotating branch collision. Register support surfaces with the movement system and make any navigable bridge available to route planning or provide an authored route through it; current terrain A* does not automatically understand a new elevated bridge.

**Heart pathfinding:** call the existing terrain-grid `findPath` with the spirit's current position, selected checkpoint, terrain height, and obstacle data including the puzzle's closed crystal passages. Follow the returned waypoints with simple ground-relative steering. Restrict the first puzzle to stable ground and paths wide enough for the current navigation grid; this does not require swimming or free-flight pathfinding. If no path exists, wait and show which passage needs attention instead of moving through obstacles. Replan after a passage changes, a checkpoint is selected, or terrain changes invalidate the route, with a cooldown; do not run a search every frame. Keep a last safe checkpoint for recovery. This extends the game's actual A* implementation rather than substituting a scripted route.

**Diamond solver:** use tile domains, connector compatibility, a propagation queue, and minimum-domain selection for unresolved sockets. Keep a short history for undo or bounded backtracking. Impose an operation budget, yield between small batches when needed, and fall back to a prevalidated arrangement if solving fails. Reserve a compatible backbone before solving remaining cells and validate source-to-objective connectivity afterward. The small existing left/up ruin pass is a reference, not a complete WFC implementation.

**Terrain and chunks:** place each main puzzle in an authored footprint with stable footing, using the same terrain-mask approach as existing landmarks. Chaos can reveal or activate puzzle elements while surrounding terrain morphs. Keep quest data separate from chunk meshes so leaving and returning does not reset progress; create and dispose nearby visuals as needed. Reserve footprints from random props to prevent trees or ruins blocking essential sockets and routes.

**Persistence and reset:** session progress in memory is enough for the first version. Optional browser `localStorage` saves should include a format version and world seed. Extend `R` reset deliberately to clear campaign progress and restore all four puzzles, wards, and swarm encounter state; rebuilding terrain alone is insufficient.

### Build order and proof of feasibility

1. Build one Spade ward that can be broken by a coordinated swarm pass. Verify attract, attack, recall, and retry before adding the story chain.
2. Add campaign state and a single objective marker while checking that the cured companion remains normal in both modes.
3. Prototype one Clover root bridge with matching platform collision and recovery before generating additional branches.
4. Integrate Heart's escort with the existing A* module and implement Diamond's small solver as pure JS logic, then attach their visuals and interactions.
5. Join the four chapters and add the finale using the same completed mechanics.

For implementation validation, use the existing Node test style for meaningful logic checks: Heart's route changes and no-path behavior when crystal passages change, WFC compatibility and connectivity, campaign ordering, and preventing duplicate swarm hits. Reuse existing A* tests rather than duplicating them. Browser play checks must cover bridge collision, escort recovery, retries, input priority, leaving and returning to a puzzle, calm/chaos transitions, and full reset. Compare frame time with the current game on the same seed and machine; cap active visuals or solver work if the expansion causes a sustained regression.

Optional post-story puzzles should initially reuse these small validated layouts or a few authored variants. Unlimited procedural challenges, moving boss AI, fully physical roots, and fluid simulation are future extensions rather than requirements for this story.

## Prologue: The mark inside the flame

After the Ember Hound is cured, the offered embers merge into three interlocked spades. The shrine recognizes a resonance curse planted by the Triad ruling Spade.

> "Your movement awakened the curse. It did not create it. Follow the embers west; someone there has been teaching the land to burn."

The Triad drains currents connecting all four kingdoms to open the Hollow Gate. The companion was an early victim. Its cure remains permanent, and it accompanies the player into Spade.

## Chapter 1: Spade - The Swarm Remembers

**Status: implemented.** `src/models/spadeCampaign.js` (stages, lantern and strike rules), `src/rendering/spadeCampaign.js` (lanterns, ward), strike steering in `src/models/swarm.js`, tests in `tests/spadeCampaign.test.mjs`. Flow: meet Neris in calm → hold E to lead the swarm to three memory lanterns in calm → at the border anchor, chaos opens the ward and hold Q sends the flock through it (14 distinct wisps within 1.5 s per strike, swept segment test, 2.5 s regroup) → three strikes free the settlement → return to Neris for the Lantern Sigil → the castle (archive testimonies, erased witness, Hollow Crown bindings) explains why the Crown cannot be struck yet → north to Clover. If the castle was finished first, Neris sends the player straight north.

Following the ember trail west, the player finds violet wisps circling a sealed settlement. Resistance guide **Neris** explains that the swarm carries fragments of memories the Triad tried to erase.

> "They scatter because they are frightened. Gather them before you ask them to fight."

### Calm exploration: learn the flock

Attract and recall the wisps. Guide them between lantern sites to reveal the Lantern Refuge and recover testimony about the curse. Cohesion keeps the group together, alignment helps it travel coherently, and separation keeps individual wisps from collapsing into one point. Player steering guides the group.

### Chaos encounter: break the border anchor

A Triad projection guards the settlement's anchor. Explore its perimeter, find a safe approach, gather the swarm, then release a coordinated pass through an exposed ward. Several successful passes break the anchor and free the settlement.

**Proposed attack rule:** enough distinct wisps must cross the exposed target volume during a short interval to register a strike. A few stray particles do not count. Recall enables regrouping after a failed pass.

Existing repel pushes wisps away from a point ahead of the player; it does not aim at or damage an enemy. A future attack could position that repulsion point behind the flock relative to a ward, or add a directed attack target. Either needs new targeting and hit detection. Raising chaos alone must not damage the boss.

### Why the journey continues

The projection falls, but three distant bindings keep the Hollow Crown shielded. Swarm strikes against that shield are redirected into the gate. Neris explains the response so the player understands why repeated attacks cannot win yet.

The freed settlement grants the **Lantern Sigil**. Neris points north: Clover can reveal the true pattern of the bindings. This is a real first victory, followed by a clear reason to explore elsewhere.

## Chapter 2: Clover - The Living Road

**Status: implemented, 23 October 2026.** Three permanent root crossings connect Iven's Rootkeeper Archive to the Stormleaf Scar. The Scar grants the Root Sigil; the Archive chest then grants the Tide Hook. The existing summit and Sky Garden are preserved. See [implementation and controls](CLOVER_LIVING_ROAD.md).

At the Rootkeeper Archive, **Iven** preserves memories inside a root network. The Triad has severed the living road to the Stormleaf Scar, where the original binding pattern survives.

### Algorithm: L-system branching growth

Rewriting rules generate branching root segments from a seed. Growth guides determine which branches can connect across the terraces. The generated roots become traversable routes, with blocked endpoints clearly visible.

- **Calm:** Explore terrace junctions, read branch symbols, orient guides, and inspect the next growth stage.
- **Chaos:** Energize a node to advance a bounded generation of growth. Roots bridge gaps or uncover inscriptions. Poorly directed branches stop at obstacles; return to calm to adjust the guide.
- **Completion:** Connect archive to scar, traverse the restored road, and earn the **Root Sigil**.

Use a fixed seed, limited growth depth, and a guaranteed viable backbone. Keep completed bridges stable across mode changes so a calming player does not lose the floor beneath them.

The sigil distinguishes true anchors from the Triad's decoys. Its markings also reveal a stolen current flowing from Heart, leading the player east.

> "A branch remembers where it came from. Follow the wound back to its root."

## Chapter 3: Heart - The Stolen Current

Heart's red crystal banks conceal springs diverted into a buried siphon. River guardian **Sera** awakens a small water spirit that can release the stolen magic, but it must reach the siphon through a crystal maze. The player escorts it from the Listening Spring to the Resonance Reef.

### Algorithm: A* pathfinding and dynamic replanning

The spirit searches a terrain grid using the existing A* algorithm. Search cost accounts for distance and slopes; closed crystal passages and obstacles remove traversable cells. The player changes the environment and chooses the next checkpoint, while A* computes the route. The player learns by observing the route change, rather than manually controlling each spirit movement.

- **Calm:** Find safe passages, listen to Sera's hints, and guide the spirit between spring checkpoints. Use switches to open stable crystal gates and observe its chosen route.
- **Chaos:** Reveal hidden switches and energize crystal mechanisms that change which passages are open. A* replans around the changed obstacles. Some routes require chaos to discover, followed by calm to escort the spirit safely.
- **Completion:** Escort the spirit through all three checkpoints to the exposed siphon core. It releases the stolen current and grants the **Tide Sigil**.

Keep the initial maze on stable ground: chaos changes explicit passage states, not the floor beneath the spirit. Completed gate activations persist across mode changes. Make every required checkpoint reachable after the appropriate switches are activated. If the player closes the only route, the spirit waits safely until a route is reopened. Preserve checkpoints and gate settings across retries.

The broken device carries a Diamond maker's mark and a hidden plea: "We built the chains under orders. Find the unbroken record." The player travels south.

## The Tide Hook and the Risen Reef

**Owner decision resolved, 23 October 2026:** the Tide Hook belongs in **Clover's Rootkeeper Archive**, not Spade's archive chest. Clover grants it only after the Living Road is restored and the original pattern at the Stormleaf Scar has awarded the Root Sigil. The item, chest interaction and lead east to Sera are implemented. This preserves Spade -> Clover -> Heart.

**Heart traversal remains proposed and belongs to the Heart developer.** With both `root-sigil` and `tide-hook`, the first chaos awakening in Heart can lift the Resonance Reef into the sky. A once-per-run earthquake/rise scene reveals authored crystal anchors. Short scripted grapple arcs connect safe island landings; falls recover at the last landing. The raised islands persist through calm/chaos changes. Sera's water spirit then uses A* on the stable reef surface to reach the siphon, as described in Chapter 3.

The existing Sky Garden flight and movement-platform systems are reusable references, not an implemented Heart grapple. Clover does not add the earthquake, reef ascent or escort. Its Satchel reward is the shared prerequisite for that work.

## Chapter 4: Diamond - The Unbroken Pattern

Artificer **Orin** preserves testimony from workers whose families the Triad held captive. The workers sabotaged the Shatterglass Relay, but missing conduits also prevent them from opening an escape route.

> "Do not mistake a kingdom for its captors. Help us finish the part they never allowed us to build."

### Algorithm: WFC constraint solving

Each relay socket has possible conduit tiles with labeled connectors. Fixing a tile removes incompatible options from neighboring sockets. Propagate the constraints, choose an unresolved socket with few remaining options, and continue. If a contradiction appears, restore a previous valid choice and try another option.

- **Calm:** Explore workshops, learn connector rules, recover fragments, and inspect socket possibilities. Placing a fragment visibly narrows neighboring options.
- **Chaos:** Expose buried sockets in the quarry and activate the completed relay under load. The reconstructed arrangement determines which gates open and where the pulse exits.
- **Completion:** Connect the source to the escape gate and inversion core. Free the workers and earn the **Prism Sigil**.

Local compatibility alone does not guarantee a useful path. Reserve a viable source-to-objective backbone and validate connectivity before accepting a generated relay. Provide undo or a fresh valid arrangement after contradictions; never destroy collected fragments.

The inversion core can expose the Triad's armor after its supply is cut. With all four sigils earned, return to Spade.

## Chapter 5: Spade - Break the Hollow Crown

The finale combines the knowledge gained across all kingdoms with Spade's swarm as the main attack tool.

| Triad ruler | Defense | How another kingdom enables the attack | Swarm action |
| --- | --- | --- | --- |
| Veyr, the Binder | False anchors conceal genuine wards. | Clover's Root Sigil reveals the true branching pattern. | Guide the flock through the real ward instead of decoys. |
| Sile, the Harvester | Stolen current replenishes a shield. | Heart's Tide Sigil summons the water spirit; open a crystal passage so A* can guide it to the shield valve. | Strike the siphon core after the spirit disables its supply. |
| Morcant, the Gatekeeper | Shifting conduits power his armor. | Diamond's Prism Sigil identifies a compatible inversion route. | Send a coordinated flock through the powered opening to break the armor. |

Use short callbacks to the earlier puzzles rather than repeating entire kingdom quests. All three discoveries are necessary to create the swarm's openings.

### Encounter loop

1. **Explore:** Move between cover, lantern shelters, and anchor viewpoints to understand the current defense.
2. **Prepare in calm:** Gather or recall wisps, inspect the relevant sigil pattern, and create an opening. Shelters provide enough time to prepare.
3. **Act in chaos:** Move into position and direct the swarm through the exposed target.
4. **Regroup:** Recall scattered wisps and reposition. Failed passes cost time or local encounter progress, not completed kingdom discoveries.
5. **Defeat the Triad:** Break all three defenses and end their control over Spade. Capture versus escape can remain a later narrative choice.

Show ward charge and flock formation clearly so players understand why attacks succeed. Avoid requiring calm preparation while unavoidable attacks constantly force frantic movement.

### Final act: stillness after victory

Breaking the gate tether exposes an unstable rift. More attacks feed it. Neris calls for the player to stop striking and gather the swarm around the four sigils.

The wisps settle into a shared formation. The companion sits beside the player. Clover's memory, Heart's restored current, Diamond's repaired pattern, and Spade's freely given light unite into the **Fourfold Accord**, closing the gate.

Chaos wins the opening. Calm makes the victory last.

## Epilogue: Every road carries a story

Return to the Grimoire Tower and share the Accord. The shrine broadcasts the collected testimony.

> "Clover remembers. Heart renews. Diamond rebuilds. Spade keeps its own light. Walk their roads gently. Meet their storms bravely."

Free exploration continues: branch routes in Clover, alternate spirit escort routes in Heart, new relay arrangements in Diamond, and swarm trials in Spade. Each kingdom retains calm and chaos activities after the main story.

## Design checks for future implementation

- Start with Ember Hound, then Spade; resolve the Triad threat on the return visit.
- Make each kingdom algorithm necessary to its quest and useful in the finale.
- Give each chapter distinct calm and chaos destinations, with evidence leading to the next kingdom.
- Keep roads open for early exploration where practical; gate major story milestones through knowledge and puzzle completion.
- Preserve testimony, sigils, and completed routes across mode changes and retries. Keep the companion permanently cured.
- Record current leads, mode hints, and discoveries in a journal.
- Guarantee solvable generation with bounded growth, fixed seeds, connectivity validation, and undo support.
- Keep algorithm terminology in documentation and optional course-demo overlays. Players guide wisps, grow roots, escort a water spirit, and repair conduits.

**Emotional arc:** save a companion, confront the source, discover why force alone fails, learn from three kingdoms, return with allies, and defeat the Triad through both calm and chaos.
