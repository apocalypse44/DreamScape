# Environment and Kingdom Changes

This document explains the completed environment changes and the graphics techniques behind them. It can be used for a technical demonstration of the project. Black Clover provides the artistic reference for kingdom identity; the implementation uses Three.js r128, JavaScript, and custom GLSL shaders.

## 1. Completed work and current scope

The previous photograph-based HDRI sky has been replaced with a procedural day/night sky in Theatre mode. A single world clock drives the visible celestial bodies, environmental lighting, and sky reflections.

| Feature | Current implementation |
| --- | --- |
| World clock | Shared 24-hour clock, starting at 09:00; one day takes 20 minutes of simulation time |
| Gameplay HUD | Clock replaces the top-left Dreamscape branding during gameplay; branding remains on the intro screen |
| Sun and moon | Procedural discs and halos following a shared mathematical orbit |
| Stars | Procedural star field with nighttime visibility and animated twinkling |
| Sky | Daytime blue, warm dawn/dusk, and a dark nighttime palette |
| Clouds | Animated procedural noise with chaos-controlled coverage and movement |
| Lighting | Sunlight, moonlight, hemisphere ambient lighting, and moving solar shadows |
| Fog | Time-dependent colors and horizon blending; landmark visibility adjustments are retained |
| Reflections | Filtered environment lighting generated from the procedural sky |
| Chaos integration | Stormier skies, faster clouds, fewer visible stars, reduced light, and integration with existing ember, ash, and lightning effects |
| Spade exception | Daylight is suppressed at every hour without changing the shared clock |

The global sky and time foundation is complete. Spade now also has its authored snowy settlement, permanent dark climate, local snowfall, snow-covered architecture, and smooth border blending, detailed in section 7. Rain, dust storms, and full climate systems for the other kingdoms remain pending. Shared chaos weather continues alongside Spade's local snow system.

## 2. Mechanism and learning concepts

The environment uses procedural computer graphics and mathematical animation. It does not train a machine-learning model or infer weather from data. The relevant concepts are trigonometric motion, smooth interpolation, procedural noise, shader programming, direct and ambient lighting, physically based materials, and environment-map filtering.

### Shared time and frame-based integration

Implementation: [worldClock.js](src/models/worldClock.js).

Each update advances the hour using the simulation delta time:

```text
nextHour = currentHour + (dt / 1200) * 24
hour = nextHour modulo 24
```

Crossing midnight increments the day counter. The clock supports pause, manual hour selection, and reset. Invalid or negative frame deltas are ignored. Changing kingdoms, toggling Theatre mode, and starting a chaos preview do not recreate the clock.

The game caps simulation `dt` at 0.04 seconds per frame. Therefore, the twenty-minute day is measured in simulation time: a slow frame or a suspended browser tab does not cause a large time jump. The clock model itself advances consistently for the same accumulated delta time.

**Learning concept:** integrating a rate over time separates animation speed from a fixed amount of movement per rendered frame. Keeping time independent of weather allows different kingdoms to share one world timeline.

### Solar orbit and smooth lighting transitions

Implementation: [daylight.js](src/models/daylight.js).

The solar angle is calculated from the hour:

```text
angle = ((hour - 6) / 24) * 2π
sunDirection = normalize(cos(angle), sin(angle), 0.35 * cos(angle))
moonDirection = -sunDirection
```

The sun reaches the horizon at approximately 06:00 and 18:00, reaches its highest point at noon, and moves below the horizon at night. The moon follows the opposite direction. This is an artistic orbit rather than an astronomical model of latitude, seasons, or lunar phases.

Daylight, twilight, solar intensity, lunar intensity, and star visibility are derived from the sun's elevation. Transitions use smoothstep interpolation:

```text
t = clamp((value - lowerBound) / (upperBound - lowerBound), 0, 1)
smoothstep = t² * (3 - 2t)
```

The zero slope at both ends of this curve prevents abrupt changes when crossing a lighting threshold.

**Learning concept:** one mathematical source can synchronize several visual systems. The sun's visible position and its lighting direction are calculated from the same vector.

### Sky dome and celestial rendering

Implementation: [sky.js](src/rendering/sky.js).

The sky is a sphere rendered from its inside using `THREE.BackSide`. Its position follows the camera, so the player cannot walk toward its surface. The vertex shader places its depth at the far plane using `gl_Position = p.xyww`; depth writing is disabled so the sky remains behind world geometry.

The fragment shader normalizes the viewing direction and blends horizon and zenith colors according to altitude. Daylight and twilight uniforms select the time-dependent palette. Warm glow is concentrated toward the sun using a directional dot product raised to a power.

For each pixel, `dot(viewDirection, sunDirection)` indicates how closely that pixel points toward the sun. A narrow smoothstep threshold draws the solar disc, while a broader falloff draws its halo. The moon uses the opposite direction, a blue halo, and a hashed surface pattern suggesting craters.

**Learning concept:** a fragment shader can generate sky features directly from directions and equations, avoiding large background image assets. This is a stylized atmosphere rather than a physical Rayleigh/Mie scattering simulation.

### Procedural clouds and stars

Clouds use two-dimensional value noise. Hash values at neighboring grid points are smoothly interpolated, then three noise layers are combined:

```text
cloudNoise = 0.57 * noise(p)
           + 0.28 * noise(2.03 * p)
           + 0.15 * noise(4.09 * p)
```

This is a small fractal-noise construction: large features establish cloud masses, while higher frequencies add detail. Viewing directions are projected onto a cloud plane. Offsetting the sample coordinates over time produces wind-driven movement; changing the thresholds changes coverage. These are projected procedural clouds, not volumetric clouds or a fluid simulation.

Stars use hashed cells of the normalized viewing direction. A high threshold selects a sparse set of visible points. Each selected point receives a color and a sinusoidal brightness variation. Daylight suppresses the stars, and chaos reduces their visibility further.

**Learning concept:** deterministic pseudo-random functions can create varied patterns without storing a texture or updating thousands of individual scene objects.

### Direct light, ambient light, shadows, and fog

Implementation: [atmosphereEffects.js](src/rendering/atmosphereEffects.js) and [scene.js](src/rendering/scene.js).

The existing directional sun light follows the solar vector. Its position and target move with the camera to keep the shadow region near the player. Its color becomes warmer near dawn/dusk, and its intensity falls to zero at night. Solar shadows use the existing 1024 × 1024 shadow map and PCF soft-shadow filtering.

A separate blue directional light supplies moonlight when the moon is above the horizon. It does not cast a separate shadow map. A hemisphere light blends sky and ground illumination, retaining enough ambient light for nighttime navigation. Existing local lights and emissive objects, such as the shrine, continue to illuminate or glow independently.

Fog colors follow daylight, twilight, and storm intensity. The sky blends toward the scene's fog color near the horizon so terrain and sky connect visually. The renderer uses ACES filmic tone mapping and sRGB output. Sky color calculations use linear-space palettes, and horizon fog is handled separately during display rendering and reflection capture to respect their different output encodings.

**Learning concept:** drawing a dark sky alone does not create night. Direct light, ambient light, fog, exposure, and reflections must agree with the time of day.

### Sky-based environment reflections

Implementation: [environmentLighting.js](src/rendering/environmentLighting.js).

A separate capture scene contains only a copy of the procedural sky, sharing its shader uniforms. A `THREE.CubeCamera` captures six 64-pixel faces into a half-float cubemap, then `THREE.PMREMGenerator.fromCubemap()` filters it into a roughness-dependent radiance map. This map becomes `scene.environment` for physically based materials. The smaller capture replaces r128's default 256-pixel `fromScene()` path to reduce climate-update spikes.

PMREM stands for **Prefiltered Mipmapped Radiance Environment Map**. Smooth surfaces sample sharper environment detail; rough surfaces receive a more blurred response. Theatre's material replacements retain surface properties such as roughness and metalness, while environment intensity changes with daylight.

Captures are scheduled when the quantized time or atmosphere signature changes and at least five simulation seconds have elapsed. Entering Theatre mode or manually jumping time by more than 0.25 hours forces a refresh. Temporary lightning flashes are excluded from captures so a brief flash cannot remain baked into reflections. Old render targets are disposed after replacement.

These are sky environment reflections. The capture excludes nearby buildings, characters, and terrain, so it is not a real-time mirror or screen-space reflection system.

**Learning concept:** environment lighting makes material appearance respond to the surrounding sky, while infrequent captures control the cost of rendering six additional views.

## 3. Architecture and chaos integration

The frame pipeline separates simulation state from rendering:

```text
World clock + current biome + movement chaos
                     ↓
Theatre atmosphere sequence and landmark adjustments
                     ↓
Chaos controller returns a smoothed visual score
                     ↓
Final atmosphere pass applies sky, lights, fog, weather and reflections
                     ↓
Render the game scene
```

[atmosphere.js](src/rendering/atmosphere.js) owns the clock, controls, and rendering lifecycle. [chaosLook.js](src/controllers/chaosLook.js) handles chaos pacing and returns a visual score instead of directly owning the sky. Its visual smoothing uses exponential interpolation, with a blend factor of `1 - exp(-3 * dt)`, to reduce abrupt appearance changes.

The final atmosphere pass derives storm strength from that visual score. Increasing chaos speeds cloud movement, increases cloud coverage, reduces solar and lunar intensity, and obscures stars. The existing [chaosWeather.js](src/rendering/chaosWeather.js) supplies ember/ash particles and lightning flashes. These effects influence the atmosphere without modifying the world hour.

Theatre mode's sky and lighting use the final pass after landmark adjustments. This lets the day/night lighting override the Sky Garden's previous minimum daylight intensities while retaining its reduced fog density. Original mode retains its movement-driven appearance and restores the original environment and material choices when switching out of Theatre mode.

The EXR/HDR sky-loading code and its runtime script references have been removed. The distribution asset list no longer requires the day or chaos HDRI files.

## 4. Kingdom-specific behavior

Spade uses a continuous spatial climate influence to suppress daylight, twilight, and direct sunlight, lower ambient illumination, increase cloud coverage, and introduce snowfall. Its interior remains dark at every world hour. Celestial directions still follow the shared clock, and the exact gameplay biome boundary remains unchanged. See section 7 for the transition and environment implementation.

The following table distinguishes remaining art directions from implemented Spade behavior:

| Kingdom | Planned calm climate | Planned chaos climate |
| --- | --- | --- |
| Clover | Temperate skies and soft clouds | Wind, rain, storm clouds, and occasional lightning |
| Heart | Humid air, mist, and green-blue light | Heavy rain, dense mist, and teal storm lighting |
| Diamond | Dry air and dusty horizons | Dust storms and reduced visibility |
| Spade | Implemented: permanent darkness, local snowfall, cold surfaces, and blended border climate | Implemented: faster snow drift/fall with chaos; dedicated full blizzard simulation remains a future extension |

The composition is **world time + kingdom climate + chaos intensity**. Spade now implements a blended climate transition; the same approach can be extended to the other kingdoms. Each layer controls a different part of the environment, allowing kingdom identity to remain recognizable during chaos.

## 5. Technical demonstration

1. Enter gameplay and show that the top-left branding becomes the world clock.
2. In the browser console, run `dreamscape.clock.setPaused(true)` to hold time for comparison.
3. Run `dreamscape.clock.setHour(12)`, then `setHour(18)`, then `setHour(0)` on the same clock object. Compare sky colors, cloud appearance, stars, terrain lighting, and reflective surfaces.
4. Look upward during noon and midnight to inspect the sun and moon. Explain that their visible positions and light directions use the same mathematical orbit.
5. Press **P** to preview calm → chaos → calm. Explain that weather changes while the paused clock remains fixed. Press **T** to compare Theatre and Original mode.
6. Run `dreamscape.clock.setPaused(false)` to resume. Press **R** during active gameplay to reset to 09:00 and clear the preview.

## 6. Validation and performance considerations

The initial atmosphere implementation was validated with **67 passing automated tests**, JavaScript syntax checks, and browser checks covering daytime, sunset, nighttime, the gameplay HUD, mode switching, and shader/runtime errors. Browser request monitoring confirmed that no `.hdr` or `.exr` sky assets were requested. The suite subsequently reached **92 passing tests** after the Spade and kingdom-landmark changes; section 7 records the later validation and its limits.

Tests cover clock rollover, pause/reset, frame-delta handling, independence from Theatre toggles and chaos preview, celestial alignment, continuity around sunrise/sunset/midnight, and Spade's daylight suppression. These checks do not establish that the pending kingdom weather systems are complete.

The sky uses one mesh, three cloud-noise octaves, and shader-generated stars rather than separate star objects. Lighting shader settings remain stable across day/night transitions to avoid unnecessary shader variants. Reflection captures are throttled and replaced targets are disposed. Browser validation confirms functional rendering; it does not establish a universal frame-rate target across different GPUs.

## 7. Spade Kingdom: environment, story spaces, and techniques

### Design and completed layout

The western settlement uses Black Clover's snowy fortress city as an artistic reference and follows [the Fourfold Accord story](FOURFOLD_ACCORD_STORY.md). The entrance carries an ornate spade emblem, twin snowy bastions, and kingdom signage. Thirty small houses line an ascending avenue leading to a connected fortress with towers, wings, retaining walls, and three accessible interior levels. Purple procedural trees and unrelated random structures were removed from the Spade biome, including the area behind the castle, to keep the settlement's silhouette readable.

The authored coordinate system starts at the gate `(x=-344, z=0)`. Local `u` increases westward into Spade and `v` maps to world `z`: `x=-344-u`, `z=v`. This lets terrain, buildings, story props, and collision use the same layout rules. The avenue rises smoothly from about 1.5 m to 16 m. Houses sit on level pads with foundations; terrain blends back into the surrounding slope outside each pad. The border-anchor plaza also has a locally flattened surface and a side approach.

**Techniques:** hierarchical scene construction, repeated modular geometry, rule-based placement, smoothstep terrain blending, and shared model/render layout data. This is an authored procedural layout; no new WFC, L-system, or machine-learning system was introduced.

Implementation: [spade.js model](src/models/spade.js), [spade.js renderer](src/rendering/spade.js), and [world.js](src/models/world.js).

### Connected castle and rigid collision

Castle wings overlap the hall walls and towers, and common foundations and continuous roof slabs close the earlier disconnected joins. The main kingdom entrance and castle doorway remain traversable. Elevated lintels use vertical collision bounds so their overhead geometry does not block the open passage below.

The mountain-like structures now have blocking footprints and seven-sided support geometry, preventing players from walking into their hollow visual interiors while supporting landings from above. Ordinary houses remain solid; the Lantern Refuge has an explicit doorway and interior instead of a single solid house collider.

Walls, retaining structures, tower bases, pillars, chests, shelves, beds, supply props, pedestals, and rails have explicit static collision. Curtain-wall rendering and collision now share the same post-rotation dimensions, fixing the ability to walk through the visible wall modules. Collision is available before detailed asset downloads complete.

**Techniques:** kinematic player collision, bounded obstacle volumes, walkable support surfaces, and separation of collision geometry from detailed visual triangles. Rigid props are immovable obstacles; this does not add a dynamic rigid-body physics simulation or physics library.

### Three enterable castle levels

| Level | Feet height | Environment and story role |
| --- | --- | --- |
| Ground: Lantern Atrium | 16.12 m | Tall central hall, pillars, erased portraits, stolen-current conduits, and the Hollow Gate; space for the swarm encounter direction |
| Floor 1: Testimony Archive | 23.12 m | Bookshelves, rigid chest, balconies, cross-bridge, and three calm proximity testimonies associated with Clover, Heart, and Diamond |
| Floor 2: Hollow Crown Observatory | 30.12 m | Protected binding plinths and named Veyr, Sile, and Morcant throne alcoves |

Two flights of 28 visible steps connect the floors. Their collision is a continuous ramp, so movement follows a smooth incline rather than catching on every rendered step. Thin gallery slabs, real stair openings, railing gaps, and repositioned pillars provide headroom and a connected route around the atrium. Stairs are on the south side, **left when entering the castle westward**. Falls from stairs, galleries and chaos landings now fall naturally onto lower floors without automatic checkpoint or long-fall teleports.

Approaching each archive testimony in calm records it once and updates the local discovery journal. After all three, inspecting the observatory explains the protected bindings and directs the player back to Neris. Discovery persists for the current session and clears with **R**. Both calm and chaos allow physical access to all floors.

**Techniques:** hierarchical modular architecture, GPU instancing for steps/books/rails, continuous collision ramps, natural floor landings, and a small deterministic exploration state machine. The interior reuses existing geometry batches without adding downloaded models.

Implementation: [spadeCastle.js model](src/models/spadeCastle.js) and [spadeCastle.js renderer](src/rendering/spadeCastle.js).

### Fourfold story spaces and environmental storytelling

| Location | Where to find it | Added details |
| --- | --- | --- |
| Lantern Refuge | First north-side house, right when entering westward; center `(-366,-23)`, route target at the door `(-366,-15)` | Enterable room, beds and blankets, supplies, repaired banner, candlelight accents, and Neris (a robed, hooded villager mannequin with a wisp lantern; see section 8) |
| Border-anchor Plaza | North/right side path near the top of town, before the castle retaining wall; center `(-447,-48)`, approach target `(-447,-40)` | Level plaza, sealed pedestal, four posts, segmented chains, and an animated ward |
| Hollow Gate / Triad | Gate at the back of the castle hall near `(-519.75,0)`; route ends at the castle entrance `(-462,0)` | Tall animated seal, erased portraits, three stolen-current conduits, named thrones, and upper-floor protected bindings |

The conduits use branching root, stepped water, and angular prism motifs to distinguish the stolen currents. Erased portraits, repaired cloth, supplies, and throne names communicate occupation, refuge, and the Triad without requiring a combat encounter to explain every space. Neris is now an animated villager character (section 8).

The Hollow Gate and border ward share a custom GLSL material. UV coordinates generate radial rims and angular veins; a time uniform drives their pulse. Transparent alpha blending with depth writing disabled layers the seals against the architecture. Chain segments and posts reuse basic geometry. Warm emissive accents contrast with cool stone and glass-like panels. These story additions add no new downloaded assets or extra lights; emissive surfaces are visual accents rather than simulated light transmission.

**Story scope:** the environment supports the first Spade visit and foreshadows the return finale. The intended campaign goes from the Ember Hound cure to Spade, then Clover, Heart, Diamond, and back to Spade before the Tower. The Lantern Sigil chapter (lanterns, border-anchor strikes, sealed castle doors) is now implemented; see section 8. Stolen-current combat and the Triad boss finale are not. Archive discoveries do not grant sigils or skip later chapters. The existing **84-wisp boids swarm** remains, using separation, alignment, and cohesion with attract, repel, and recall controls.

Implementation: [spadeStory.js model](src/models/spadeStory.js) and [spadeStory.js renderer](src/rendering/spadeStory.js).

### Dark-climate transition and snowfall

Entering Spade during morning now blends the climate instead of snapping immediately from sunlight to darkness. [climate.js](src/models/climate.js) computes a spatial influence from the circular kingdom boundary and western sector boundary. The blend extends roughly **90 m before the border to 20 m inside**, for a 110 m approach, and uses `t*t*(3-2*t)` after clamping. Walking out reverses the same blend. It is distance-based rather than a one-time trigger, so the appearance also works when changing direction.

Sky, cloud cover, direct and ambient light, fog, and snowfall follow the continuous influence. The shared clock still reports the actual world hour; Spade's climate suppresses daylight without changing time. The exact gameplay kingdom boundary is retained.

Snow uses one `THREE.Points` object with a typed position buffer. The particle field follows the player inside a **100 x 38 x 100 m** volume, wraps positions as flakes fall and drift, and uploads the changed buffer rather than creating new meshes each frame. Chaos increases drift and fall speed. Opacity scales with climate influence, and snow is hidden inside the castle hall and refuge. Snow caps on architecture are lightweight geometry rather than simulated accumulation.

The latest adjustment increases the particle count from **420 to 560**, about **33% more**, while retaining a single snowfall draw call. This change adds no textures, model downloads, or lights.

**Techniques:** spatial smoothstep interpolation, synchronized atmosphere parameters, particle-buffer reuse, bounded local simulation, and geometric snow caps. The snowfall is a stylized particle effect, not a fluid simulation or volumetric blizzard.

### Free assets, instancing, and distribution size

The three source packs are:

- [Kenney Castle Kit](https://kenney.nl/assets/castle-kit).
- [Quaternius Medieval Village MegaKit](https://quaternius.itch.io/medieval-village-megakit).
- [KayKit Dungeon Pack](https://kaylousberg.itch.io/kaykit-dungeon-pack).

[prepare_spade.py](tools/prepare_spade.py) selects ten GLBs, downsizes the color textures to 256 px, and writes the prepared assets and original CC0 notices into `assets/spade/`. The prepared geometry and textures total about **703 KiB**. The original downloaded packs remain available locally; [build_dist.py](tools/build_dist.py) distributes the small prepared folder instead of copying all three packs.

Repeated architecture uses shared geometry and materials with GPU instancing. Procedural fallback architecture appears immediately, then prepared modules provide detail. This combines a readable large city silhouette with limited downloads and repeated draw batches rather than a unique high-resolution model for every house.

### Entry hitch reduction

The reported pause on entering Spade was addressed at several stages:

1. **Chunk prefetch:** prepare at most one missing chunk of the next view square per frame before crossing a terrain-cell boundary. Required chunks can still be generated immediately for teleportation.
2. **Stable city terrain:** bypass expensive noise layers and chaos terrain reshaping inside the fully stable Spade area.
3. **Progressive detail loading:** one loading worker starts during idle/early approach; a frame queue installs at most one source mesh per frame. Prepared modules remain cached, avoiding a large detail reveal at the border.
4. **Shader warmup:** compile scene materials, including the hidden swarm, while the intro is open. A CPU profile identified first-use shader program linking as a major entry cost.
5. **Stable light configuration:** keep the castle fill light present and change its intensity with distance, avoiding new shader variants caused by adding/removing a light. It adds no shadow map.
6. **Smaller reflection capture:** capture the sky through a 64 px-per-face half-float cubemap before PMREM filtering, replacing r128's default 256 px `fromScene()` path. Captures remain throttled and old targets are disposed.

Implementation: [streaming.js](src/models/streaming.js), [world.js](src/models/world.js), [game.js](src/controllers/game.js), [spade.js](src/rendering/spade.js), and [environmentLighting.js](src/rendering/environmentLighting.js).

### Map, local landmarks, and panel visibility

Press **M** to open the Atlas. Purple markers and leader-line callouts identify Lantern Refuge, Border-anchor Plaza, and Hollow Gate / Triad. Buttons below the map select a destination and show coordinates and approach/floor directions. The in-world ground route is now drawn only for the Ember Hound quest; Spade destinations are found by exploring (section 8). The castle route stops at the door; ground A* does not navigate between interior floors. The map explains the archive on floor 1 and thrones on floor 2.

The bottom-left route panel now changes its landmarks with the current kingdom instead of showing Grimoire Falls, Grimoire Ridge, and Clover directions everywhere. Spade displays its refuge, anchor plaza, and castle entrance with live horizontal distances to their approach points. Clover retains its contextual terrace messages and adds summit/Sky Garden directions; Grimoire retains its falls/ridge discovery messages. Unrelated kingdom hints are hidden. Heart and Diamond currently receive no invented destination entries.

Press **I** during gameplay to hide or restore the right-side Behavior Signal, Atmosphere Study, and Swarm panels. The route display and map remain available. Repeated keydown events are ignored so holding the key does not flicker the panels. A control hint was added beside the mouse-release hint.

**Techniques:** shared destination data between story and map, leader-line labeling, collision-aware ground A*, kingdom-scoped DOM visibility, live distance calculation, and text updates only when values change.

Implementation: [worldMap.js](src/views/worldMap.js), [navigation.js](src/rendering/navigation.js), [landmarkHints.js](src/models/landmarkHints.js), [hud.js](src/views/hud.js), [input.js](src/controllers/input.js), and [main.css](styles/main.css).

### Fixes, validation, and demonstration

The session also fixed the startup error `mistLeafMat is not defined`: the removed purple-tree material had a stale lighting-profile reference. Gate passage, mountain blocking, level house pads, connected castle walls, rigid fixtures, and curtain-wall alignment received regression checks.

The automated suite reached **92 passing tests** after the kingdom landmark changes. Coverage includes terrain continuity, entrance and return paths, wall/mountain/prop collision, castle stair traversal and recovery, discovery progression, climate blending, streaming behavior, and reachable map destinations. Browser checks verified the story spaces and map selections without shader/runtime errors, and verified restoring the quest route. A focused input check verified the **I** toggle, repeat-key handling, and inactivity outside active play. The subsequent 560-particle snow adjustment passed a JavaScript syntax check; the full suite was not rerun for that count-only change.

In a local headless Chrome entry check at seed 1234, after startup downloads settled, the measured worst frame fell from about **132 ms to 35 ms** after hidden-shader warmup, with a median around **21 ms** and a 95th percentile around **28 ms**. A standalone Spade preview reported about **49 draws and 150k triangles** at that stage. These are recorded local measurements, not current full-game draw budgets, universal frame-rate promises, or guarantees of zero hitches on every machine. Full-game request checks found existing missing optional audio files, which use fallbacks.

Suggested graphics-project demonstration:

1. In Theatre mode, press **5** to reach the Spade gate approach; walk west and observe the gradual dark-climate and snow blend while the world clock stays unchanged.
2. Press **M**, select Lantern Refuge, and enter its open door; show the rigid beds/supplies and indoor snow suppression.
3. Visit the border-anchor plaza and explain the instanced chain geometry and animated UV-based ward shader.
4. Enter the castle, inspect portraits/conduits, and take the left-side stairs through all three floors. Show ramp-based movement, railings, atrium headroom, and the archive discoveries.
5. Use the local route panel to identify Spade landmarks; press **I** to clear the right-side panels for an unobstructed view.
6. Explain the curated asset footprint, instancing, progressive mesh installation, shader warmup, and reduced cubemap capture as the main ways the scene achieves more visible detail with less loading work.

## 8. Spade Kingdom: Chapter II "The Swarm Remembers" and castle rework

This section records the later session that turned the Spade environment into a playable chapter and reworked the castle interior. It supersedes the older notes above where they differ (Neris silhouette, quest navigation to Spade, castle lighting).

### Chapter flow

| Step | Mode | What the player does | Result |
| --- | --- | --- | --- |
| Meet Neris | Calm | Enter the Lantern Refuge | Neris explains the frightened wisps |
| Memory lanterns | Calm | Hold **E** to lead the swarm to three dark lanterns above avenue posts; 16 wisps must stay around a lantern for 1.5 s | Each lantern lights with a burst |
| Border anchor | Chaos | Chaos opens and enlarges the ward; near it, hold **Q** to send the flock through it; **F** recalls | 3 strikes break the anchor; the ward disappears |
| Lantern Sigil | Calm | Return to Neris | Sigil earned; ~9 s later a cutscene opens the castle doors |
| Castle | Both | Archive testimonies, the erased-witness crossing, the Hollow Crown bindings | Story points north to Clover |

The castle doors stay sealed (solid, with a stage-specific message on approach) until the chapter is complete. The grimoire journal lists "The Swarm Remembers" and marks the three castle quests as sealed until then. The HUD objective follows the chapter, then the castle's next step. **R** resets the chapter, doors and cutscene. Ground navigation to Neris was removed; the route is now drawn only for the Ember Hound quest.

Known gap: the chapter does not yet require the Ember Hound cure, so Spade can be played before the hound quest is finished.

### Techniques

- **Swept hit test for swarm strikes.** Each wisp keeps its previous position; a strike counts distinct wisps whose movement segment passes within 2.5 m of the ward centre (point-to-segment distance), so fast crossings are not missed between frames. A strike needs 14 distinct wisps inside a 1.5 s window, then a 2.5 s regroup cooldown, so stray wisps never add up and one pass cannot double count.
- **Directed boids steering.** A new `strike` mode replaces the scatter force with a strong pull toward the ward, layered on the existing separation, alignment and cohesion.
- **Pure, testable chapter model.** Stages, lantern charging, strike windows and door state live in `models/spadeCampaign.js` with no Three.js dependency; `tests/spadeCampaign.test.mjs` covers calm/chaos gating, stray passes, cooldown and reset.
- **Scripted cutscene camera.** `controllers/doorScene.js` eases the camera along a path with smoothstep, swings the doors on hinge pivots, fades a veil and shows dialogue cards, reusing the hound cutscene's letterbox styles.
- **Procedural assets instead of downloads.** Swarm wisps are extruded spade-crest darts (shared outline with the castle emblem) with dark faces and a glowing rim, fluttering about their flight line so they are rarely seen edge-on. Neris is a villager mannequin with a lathe-built robe, hood and lantern that follow her bones. Thrones, bookcases, grimoires and binding crystals are built from batched primitives.
- **Procedural arm aiming.** While directing the swarm, the player's shoulder, forearm and hand bones are rotated toward the swarm target after the animation pass, eased in and out, and clamped to a 55° cone in front of the body.

### Castle interior

- **Darkness.** Inside the castle, daylight, ambient light, exposure and sky reflections (environment-map intensity) are scaled down and a dark violet fog is blended in, eased at the doorway. The hall fill light is dimmer and flickers like torchlight.
- **Doors** swing outward; each leaf carries a glowing spade crest.
- **Archive (floor 1).** The record blocks became bookcases with varied book spines and title plaques; a lectern before each holds a floating open grimoire in its kingdom's colour that brightens once read.
- **Observatory (floor 2).** The thrones were rebuilt with spired obsidian backs, crimson panels and gold spade crests. The white pyramid bindings were replaced by floating crystals (violet, blood red, bone gold) over rotating magic circles, chained to their thrones.
- **Ground floor.** A gold-edged crimson carpet and spade banners were added. The erased-witness vision was restyled as a phantom figure, and the witness and portrait busts now read as people.
- **Witness crossing.** It explains when fragments are landed out of order.
- **Signs.** The mirrored stair signs were turned to face the hall.

### Fixes

- **Gallery poke-through.** Gold conduit orbs poked through the archive gallery floor; the conduit rows were lowered.
- **Border-anchor path.** The path was a flat slab across a slope; it is now a strip draped over the drawn terrain.
- **Sinking into morphing terrain.** Movement used the smooth height function, while the drawn mesh is flat triangles (up to ~0.3 m apart on sharp chaos ridges). A new `world.surfaceHeight` interpolates the same triangles the GPU draws and is used for standing and foot placement.
- **Fetch ball indoors.** The dog no longer plays fetch inside the castle, where the ball appeared on the hall floor.

### Validation

The suite grew to **128 passing tests**, with new coverage for the chapter model, door sealing, journal sealing and drawn-surface height. In-browser checks confirmed:

- The archive bookcases, grimoire glow and readable stair signs.
- The observatory thrones and bindings.
- The darker interior lighting.
- The draped anchor path.
- Removal of the floor poke-through.

Implementation: [spadeCampaign.js model](src/models/spadeCampaign.js), [spadeCampaign.js renderer](src/rendering/spadeCampaign.js), [doorScene.js](src/controllers/doorScene.js), [swarm.js](src/models/swarm.js), [character.js](src/rendering/character.js), [npc.js](src/rendering/npc.js), [spadeCastle.js renderer](src/rendering/spadeCastle.js), [spadeStory.js renderer](src/rendering/spadeStory.js), [castleEcho.js](src/rendering/castleEcho.js), [world.js](src/models/world.js), [game.js](src/controllers/game.js).


## 9. Clover Kingdom: The Living Road

Implemented 23 October 2026 on `vivek-development`, preserving the latest Diamond integration. Iven's Rootkeeper Archive sits west of the third Clover terrace. A bounded L-system grows a west/north/west route across three gaps to the Stormleaf Scar. Calm turns guides; chaos grows one generation. Swept obstacle checks stop misdirected roots. Completed horizontal runs become stable walkable platforms and remain through mode changes, retries and area travel.

Reading the Scar in calm grants the Root Sigil. Returning to the Archive and opening its chest grants the Tide Hook. This is the owner-approved location and supersedes the older Spade chest proposal. The player is directed east to Sera in Heart; grapple mechanics and Clover-specific weather remain separate work.

Pure rewriting/turtle logic is separate from the chapter state and rendering. Three rewriting rounds and a 128-segment ceiling bound work. Shared support data drives rendering, collision, safe recovery and the companion's authored route. The optional L study exposes productions and generations without placing algorithm language in normal quest dialogue. No models or lights were added; Iven uses the existing villager pipeline.

The chapter adds a journal oath, Root Sigil Satchel icon, Archive/Scar map destinations, local hints, context-specific E actions and R reset. `?unlock=all` is a development-only Clover preset; it does not award Clover's rewards. The current atmosphere is always active; older Theatre-toggle instructions above describe a previous version.

See [Clover implementation notes](CLOVER_LIVING_ROAD.md) for controls, integration and scope, and [session validation](SESSION_LOG.md) for checks.
