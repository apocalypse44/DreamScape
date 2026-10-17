import { waterfallTerrain, waterfallArea } from './waterfall.js';
import { ridgeTerrain, ridgeArea } from './ridge.js';
import { plazaPathArea, plazaTerrain } from './plaza.js';
import { cloverGround, cloverArea, cloverApproach } from './cloverTerrain.js';
import { skyLakeTerrain, skyLakeArea } from './skyIsland.js';
import { spadeGround, spadeArea, spadeStableArea } from './spade.js';
import { nextChunkPrefetch } from './streaming.js';
const landmarkTerrain = (x, z, original) => spadeGround(x, z, cloverGround(x, z, skyLakeTerrain(x, z, plazaTerrain(x, z, ridgeTerrain(x, z, waterfallTerrain(x, z, original))))));

export function createWorld({ scene, state, player, onChunk }) {
  const CHUNK_SIZE = 64;
  const SEGMENTS = 36;
  let viewRadius = 2;
  let pendingChunks = 0;
  // ?seed= in the URL recreates the same world; a random seed is written back so reloads match.
  const params = new URLSearchParams(location.search);
  const seed = Number.parseInt(params.get('seed'), 10) || Math.floor(Math.random() * 8999) + 1000;
  params.set('seed', seed);
  history.replaceState(null, '', `?${params}`);
  const chunks = new Map();
  let formed = 0;
  let terrainVersion = 0;
  // Four kingdoms around a large neutral centre; each kingdom starts KINGDOM_START metres out.
  const KINGDOM_START = 350;
  const BIOMES = {
    hub:   { name:"GRIMOIRE TOWER", route:"CENTER", banner:"#c6ff65", ground:0x5b7633, fog:0x0b1716, sky:0xbdebd3, roughness:0.2, kind:"hub" },
    north: { name:"CLOVER KINGDOM", route:"N · NORTH", banner:"#8fe36b", ground:0x2e8656, fog:0x071b18, sky:0xbdebd3, roughness:0.1, kind:"trees" },
    east:  { name:"HEART KINGDOM", route:"E · EAST", banner:"#ff6b6b", ground:0x8a3328, fog:0x290a09, sky:0xff765b, roughness:0.92, kind:"crystals" },
    south: { name:"DIAMOND KINGDOM", route:"S · SOUTH", banner:"#ffd36b", ground:0xc29c5e, fog:0x291e13, sky:0xffd28a, roughness:0.32, kind:"pillars" },
    west:  { name:"SPADE KINGDOM", route:"W · WEST", banner:"#b9a6ff", ground:0xaab9d1, fog:0x161e35, sky:0xa9bce7, roughness:0.48, kind:"wisps" }
  };

  function hash(x, z) {
    const value = Math.sin(x * 127.1 + z * 311.7 + seed * 17.17) * 43758.5453123;
    return value - Math.floor(value);
  }

  // Compact seeded 2D Simplex noise implementation used by every terrain chunk.
  const gradients = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  const permutation = Array.from({length:256}, (_, i) => i);
  let shuffleState = seed;
  for (let i = 255; i > 0; i--) {
    shuffleState = (shuffleState * 1664525 + 1013904223) >>> 0;
    const j = shuffleState % (i + 1);
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  const perm = Array.from({length:512}, (_, i) => permutation[i & 255]);
  function noise(xin, yin) {
    const F2 = 0.3660254037844386, G2 = 0.21132486540518713;
    const skew = (xin + yin) * F2;
    const i = Math.floor(xin + skew), j = Math.floor(yin + skew);
    const unskew = (i + j) * G2, x0 = xin - (i - unskew), y0 = yin - (j - unskew);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const corner = (x, y, gi) => {
      const t = 0.5 - x*x - y*y;
      if (t <= 0) return 0;
      const gradient = gradients[gi & 7];
      return t*t*t*t * (gradient[0]*x + gradient[1]*y);
    };
    const gi0 = perm[i + perm[j & 255] & 255];
    const gi1 = perm[i + i1 + perm[(j + j1) & 255] & 255];
    const gi2 = perm[i + 1 + perm[(j + 1) & 255] & 255];
    return corner(x0,y0,gi0)*35 + corner(x1,y1,gi1)*35 + corner(x2,y2,gi2)*35 + 0.5;
  }

  function biomeAt(x, z) {
    if (Math.hypot(x, z) < KINGDOM_START) return BIOMES.hub;
    if (Math.abs(z) >= Math.abs(x)) return z < 0 ? BIOMES.north : BIOMES.south;
    return x > 0 ? BIOMES.east : BIOMES.west;
  }

  function terrainRoughnessAt(x, z) {
    const distance = Math.hypot(x, z);
    if (distance < 0.001) return BIOMES.hub.roughness;
    const north = Math.max(0, -z / distance);
    const south = Math.max(0, z / distance);
    const east = Math.max(0, x / distance);
    const west = Math.max(0, -x / distance);
    const total = north + south + east + west;
    const directional = (
      north * BIOMES.north.roughness + south * BIOMES.south.roughness +
      east * BIOMES.east.roughness + west * BIOMES.west.roughness
    ) / total;
    const transition = THREE.MathUtils.smoothstep(distance, KINGDOM_START - 60, KINGDOM_START + 40);
    return THREE.MathUtils.lerp(BIOMES.hub.roughness, directional, transition);
  }

  // Calm terrain is one fixed, smooth shape. Only chaos above CHAOS_START roughens it, so walking
  // calmly never moves the ground. Every chunk uses the same shift, so chunk edges stay joined.
  const CALM_SHIFT = -0.15;
  const CHAOS_START = 0.35;
  const shiftFor = chaos => Math.max(0, chaos - CHAOS_START) * 1.2;
  let targetShift = shiftFor(state.chaos);
  let terrainShift = targetShift;
  const lowHeight = (x, z) => noise(x * 0.018, z * 0.018) * 11 + noise(x * 0.043, z * 0.043) * 4;
  // Chaos face of the land: domain-warped fBm (Inigo Quilez, "Domain Warping"). The sample point is
  // pushed through two nested noise fields, h(p) = fbm(p + k·r), r = fbm(p + k·q), q = fbm(p), which
  // folds the ground into twisted ridges instead of needle spikes. Parameters were picked offline to
  // keep slopes gentler than the old layer (median gradient 0.79 vs 1.07) at similar curvature.
  // The field is fixed per world, so chunks still cache it per vertex; chaos only blends toward it.
  // ?warp=0 restores the old spike layer for before/after comparisons.
  const WARP = params.get('warp') !== '0';
  const WARP_SCALE = 0.016, WARP_STRENGTH = 1.2;
  const fbm = (x, z) => noise(x, z) * 0.62 + noise(x * 2.03 + 17.1, z * 2.03 - 9.4) * 0.38;
  function warpedHeight(x, z) {
    const px = x * WARP_SCALE, pz = z * WARP_SCALE;
    const qx = fbm(px, pz), qz = fbm(px + 5.2, pz + 1.3);
    const rx = fbm(px + WARP_STRENGTH * qx + 1.7, pz + WARP_STRENGTH * qz + 9.2);
    const rz = fbm(px + WARP_STRENGTH * qx + 8.3, pz + WARP_STRENGTH * qz + 2.8);
    return 2 + fbm(px + WARP_STRENGTH * rx, pz + WARP_STRENGTH * rz) * 22;
  }
  const spikeHeight = (x, z) => Math.pow(Math.max(0.01, noise(x * 0.105, z * 0.105)), 0.34) * 18 + noise(x * 0.25, z * 0.25) * 3;
  const roughHeight = WARP ? warpedHeight : spikeHeight;
  // The tower plaza (spawn + shrine) stays still; chaos fades in between 25 m and 45 m from the centre.
  const chaosWeight = (x, z) => THREE.MathUtils.smoothstep(Math.hypot(x, z), 25, 45);
  const calmBase = (x, z) => terrainRoughnessAt(x, z) + CALM_SHIFT;
  // About 60% of the map is a flat plain; hills and chaos peaks only rise where the broad mask is high.
  const FLAT_Y = 1.5;
  const hillMask = (x, z) => THREE.MathUtils.smoothstep(noise(x * 0.006 + 71, z * 0.006 - 33), 0.56, 0.64);
  const blendHeight = (low, rough, base, weight, hill, shift = terrainShift) =>
    THREE.MathUtils.lerp(FLAT_Y, -5 + THREE.MathUtils.lerp(low, rough, THREE.MathUtils.clamp(base + shift * weight, 0, 1)), hill);
  // Same result as blendHeight on all five layers, but skips noise the blend would weight by zero:
  // flat plains (hill = 0) need no layers, calm-blended hills need no warped layer.
  function heightFor(x, z, shift) {
    if(spadeStableArea(x,z))return spadeGround(x,z,0);
    const hill = hillMask(x, z);
    if (hill <= 0) return landmarkTerrain(x, z, FLAT_Y);
    const base = calmBase(x, z), weight = chaosWeight(x, z);
    const rough = base + shift * weight > 0 ? roughHeight(x, z) : 0;
    return landmarkTerrain(x, z, blendHeight(lowHeight(x, z), rough, base, weight, hill, shift));
  }
  const terrainHeight = (x, z) => heightFor(x, z, terrainShift);
  // Height the ground would settle at for a given score; used to put items on chaos-only peaks.
  const heightAt = (x, z, chaos) => heightFor(x, z, shiftFor(chaos));

  function chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 3.2, 5);
  const crownGeo = new THREE.ConeGeometry(1.5, 4.5, 6);
  const crystalGeo = new THREE.ConeGeometry(0.65, 4.8, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x243526 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x7fb06a });
  const crystalMat = new THREE.MeshPhongMaterial({ color: 0xff5a42, emissive: 0x5d0b06, shininess: 85 });
  const stoneMat = new THREE.MeshLambertMaterial({ color:0xb89a68 });
  const ruinMat = new THREE.MeshLambertMaterial({ color:0x67746a });

  // Basic Poisson-disk dart throwing: accepted points always keep a minimum distance.
  function poissonPoints(cx, cz, minimumDistance, target) {
    const points = [];
    for (let attempt = 0; attempt < target * 18 && points.length < target; attempt++) {
      const x = (hash(cx * 97 + attempt, cz * 41 - attempt) - 0.5) * (CHUNK_SIZE - 8);
      const z = (hash(cx * 23 - attempt, cz * 79 + attempt) - 0.5) * (CHUNK_SIZE - 8);
      if (points.every(point => Math.hypot(x - point.x, z - point.z) >= minimumDistance)) points.push({x,z});
    }
    return points;
  }

  function addCollider(group, wx, wz, radius) {
    group.userData.colliders.push({x:wx,z:wz,radius});
  }

  function createDecor(group, cx, cz, biome) {
    // Spade is dressed by its authored town and fortress, across the entire
    // kingdom rather than only inside the castle's reserved footprint.
    if (biome.kind === "wisps") return;
    const points = poissonPoints(cx, cz, biome.kind === "crystals" ? 7 : 8, biome.kind === "hub" ? 9 : 14);
    points.forEach(({x,z}, i) => {
      const wx = cx * CHUNK_SIZE + x;
      const wz = cz * CHUNK_SIZE + z;
      if (cloverArea(wx, wz, 5) || skyLakeArea(wx, wz) || spadeArea(wx, wz, 6)) return;
      const kind = biomeAt(wx, wz).kind;
      if (kind === "hub" || kind === "trees" || kind === "wisps") return; // these kingdoms have authored dressing
      const y = terrainHeight(wx, wz);
      const object = new THREE.Group();
      if (biome.kind === "trees" || biome.kind === "hub") {
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.6;
        const crown = new THREE.Mesh(crownGeo, leafMat);
        crown.position.y = 4.3;
        crown.castShadow = true;
        object.add(trunk, crown);
        object.scale.setScalar(0.55 + hash(i, cx + cz) * 0.8);
        addCollider(group, wx, wz, 0.75 * object.scale.x);
      } else if (biome.kind === "crystals") {
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.y = 2.1;
        crystal.rotation.z = hash(i, cx) * -0.5 + 0.25;
        crystal.castShadow = true;
        object.add(crystal);
        if (hash(i, cz) > 0.55) {
          const side = crystal.clone();
          side.scale.setScalar(0.55);
          side.position.set(1, 1, -0.3);
          object.add(side);
        }
        addCollider(group, wx, wz, 0.9);
      } else {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.75,3.5,6),stoneMat);
        pillar.position.y = 1.7;
        object.add(pillar);
        addCollider(group, wx, wz, 0.7);
      }
      object.position.set(x, y, z);
      object.rotation.y = hash(i + cx, cz) * Math.PI * 2;
      group.add(object);
      group.userData.animated.push({
        object,
        baseY:y,
        baseRotation:object.rotation.y,
        phase:hash(i * 7 + cx, cz * 5) * Math.PI * 2,
        type:biome.kind
      });
    });
  }

  // Tiny WFC-style pass: each cell collapses to a tile allowed by left/up neighbors.
  function createWfcRuins(group, cx, cz, biome) {
    if (biome.kind === "hub" || biome.kind === "wisps") return;
    const rules = { empty:["empty","pillar","arch"], pillar:["empty","pillar"], arch:["empty","pillar"] };
    const cells = [];
    for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) {
      const left = x ? cells[z*3+x-1] : "empty";
      const up = z ? cells[(z-1)*3+x] : "empty";
      const allowed = rules[left].filter(tile => rules[up].includes(tile));
      let tile = allowed[Math.floor(hash(cx*13+x,cz*17+z)*allowed.length)];
      if (hash(cx*29+x,cz*37+z) < (biome.kind === "pillars" ? 0.43 : 0.72)) tile = "empty";
      cells.push(tile);
      if (tile === "empty") continue;
      const lx = -18 + x*18, lz = -18 + z*18;
      const wx = cx*CHUNK_SIZE+lx, wz = cz*CHUNK_SIZE+lz;
      // Mixed border chunks must not place a neighbouring kingdom's ruin in Spade.
      if (biomeAt(wx, wz).kind === "wisps") continue;
      if (cloverArea(wx, wz, 5) || skyLakeArea(wx, wz) || spadeArea(wx, wz, 6)) continue;
      const y = terrainHeight(wx,wz);
      const ruin = new THREE.Group();
      const postGeo = new THREE.BoxGeometry(1.2,5,1.2);
      const post = new THREE.Mesh(postGeo,ruinMat); post.position.y=2.5; ruin.add(post);
      if(tile === "arch") {
        const other=post.clone();other.position.x=4;ruin.add(other);
        const lintel=new THREE.Mesh(new THREE.BoxGeometry(5.2,1,1.2),ruinMat);lintel.position.set(2,5,0);ruin.add(lintel);
      }
      const baseY = y;
      ruin.position.set(lx,baseY,lz);ruin.rotation.y=hash(cx+x,cz+z)*Math.PI;group.add(ruin);
      group.userData.animated.push({object:ruin,baseY,baseRotation:ruin.rotation.y,phase:hash(cx+x*3,cz+z*7)*6.28,type:"ruin"});
      addCollider(group,wx,wz,tile === "arch" ? 1.1 : 0.8);
    }
  }

  function createChunk(cx, cz) {
    const biome = biomeAt(cx * CHUNK_SIZE, cz * CHUNK_SIZE);
    const score = THREE.MathUtils.clamp(biome.roughness + state.chaos * 0.15, 0.03, 0.98);
    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, SEGMENTS, SEGMENTS);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    // Cache the noise per vertex so reshaping only re-blends instead of re-sampling noise.
    const parts = new Float32Array(positions.count * 5);
    for (let i = 0; i < positions.count; i++) {
      const wx = cx * CHUNK_SIZE + positions.getX(i);
      const wz = cz * CHUNK_SIZE + positions.getZ(i);
      if(spadeStableArea(wx,wz)){
        positions.setY(i,spadeGround(wx,wz,0));
        continue; // fixed city ground needs no noise layers or chaos reshaping
      }
      parts[i * 5] = lowHeight(wx, wz);
      parts[i * 5 + 1] = roughHeight(wx, wz);
      parts[i * 5 + 2] = calmBase(wx, wz);
      parts[i * 5 + 3] = chaosWeight(wx, wz);
      parts[i * 5 + 4] = hillMask(wx, wz);
      positions.setY(i, landmarkTerrain(wx, wz, blendHeight(...parts.subarray(i * 5, i * 5 + 5))));
    }
    // Only vertices on hills inside the chaos ring can move (landmarks just blend the base height),
    // so reshape() touches those alone and skips chunks that cannot change at all.
    const dynamic = [];
    for (let i = 0; i < positions.count; i++) if (parts[i * 5 + 4] > 0 && parts[i * 5 + 3] > 0) dynamic.push(i);
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    // Per-vertex ground colour so kingdom borders follow the real 350 m circle, not chunk squares.
    const colors = new Float32Array(positions.count * 3), tint = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      // Hex is the on-screen colour (sRGB); vertex colours are linear.
      tint.set(biomeAt(cx * CHUNK_SIZE + positions.getX(i), cz * CHUNK_SIZE + positions.getZ(i)).ground).convertSRGBToLinear().toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true,
      roughness: 0.92,
      metalness: score * 0.12,
      flatShading: score > 0.55
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    group.add(mesh);
    group.userData = { score, material, cx, cz, biome, parts, dynamic: Uint32Array.from(dynamic), colliders:[], animated:[] };
    createDecor(group, cx, cz, biome);
    createWfcRuins(group, cx, cz, biome);
    onChunk(group);
    scene.add(group);
    chunks.set(chunkKey(cx, cz), group);
    formed++;
  }

  function updateChunks() {
    const cx = Math.floor((player.position.x + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const cz = Math.floor((player.position.z + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const missing = [];
    for (let x = cx - viewRadius; x <= cx + viewRadius; x++) {
      for (let z = cz - viewRadius; z <= cz + viewRadius; z++) {
        if (!chunks.has(chunkKey(x, z))) missing.push({ x, z });
      }
    }
    // Spawn/teleport preparation is spread over frames, nearest ground first.
    // Normal walking still benefits from the existing speculative prefetch.
    missing.sort((a, b) => (a.x - cx) ** 2 + (a.z - cz) ** 2 - (b.x - cx) ** 2 - (b.z - cz) ** 2);
    if (missing.length) createChunk(missing[0].x, missing[0].z);
    pendingChunks = Math.max(0, missing.length - 1);
    for (const [key, chunk] of chunks) {
      if (Math.abs(chunk.userData.cx - cx) > viewRadius + 1 || Math.abs(chunk.userData.cz - cz) > viewRadius + 1) {
        removeChunk(key, chunk);
      }
    }
    const ahead=nextChunkPrefetch(cx,cz,player.position.x,player.position.z,viewRadius,(x,z)=>chunks.has(chunkKey(x,z)));
    if(!missing.length && ahead)createChunk(ahead.x,ahead.z); // one chunk total per frame
  }

  function removeChunk(key, chunk) {
    scene.remove(chunk);
    chunk.children[0].geometry.dispose();
    chunk.children[0].material.dispose();
    chunks.delete(key);
  }

  // Re-blend cached heights at the current shift; objects are re-seated on the new surface.
  function reshape(chunk) {
    const { parts, animated, dynamic } = chunk.userData;
    if (!dynamic.length) return; // flat plain / calm plaza: nothing moves
    const geometry = chunk.children[0].geometry;
    const positions = geometry.attributes.position;
    for (const i of dynamic) {
      const k = i * 5;
      const wx = chunk.position.x + positions.getX(i), wz = chunk.position.z + positions.getZ(i);
      positions.setY(i, landmarkTerrain(wx, wz, blendHeight(parts[k], parts[k + 1], parts[k + 2], parts[k + 3], parts[k + 4])));
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    for (const item of animated) {
      const { position } = item.object;
      position.y = item.baseY = terrainHeight(chunk.position.x + position.x, chunk.position.z + position.z);
    }
  }

  function updateTerrain(dt) {
    targetShift += (shiftFor(state.chaos) - targetShift) * (1 - Math.exp(-1.5 * dt));
    // ponytail: reshapes every loaded chunk in one frame; spread across frames if the stress test shows spikes.
    if (Math.abs(targetShift - terrainShift) < 0.004) return;
    terrainShift = targetShift;
    for (const chunk of chunks.values()) reshape(chunk);
    terrainVersion++;
  }

  function reset() {
    for (const [key, chunk] of chunks) removeChunk(key, chunk);
    formed = 0;
    targetShift = terrainShift = shiftFor(state.chaos);
    terrainVersion++;
  }

  return { seed, kingdomStart: KINGDOM_START, chunks, hash, noise, biomeAt, terrainHeight, heightAt, updateChunks, updateTerrain, reset,
    isPathArea: (x, z) => plazaPathArea(x, z) || cloverApproach(x, z),
    isLandmarkArea: (x, z) => waterfallArea(x, z, 8) || ridgeArea(x, z, 4) || cloverArea(x, z, 5) || skyLakeArea(x, z) || spadeArea(x, z, 6),
    get formed() { return formed; },
    get pendingChunks() { return pendingChunks; },
    get terrainVersion() { return terrainVersion; },
    get viewRadius() { return viewRadius; },
    set viewRadius(value) {
      const previous = viewRadius;
      viewRadius = THREE.MathUtils.clamp(value, 0, 6); // 0 = only the player's chunk (stress-test floor)
      // Chunks normally unload one ring late (no flicker at the edge); a deliberate shrink unloads now,
      // otherwise radius 2 -> 1 would keep all 25 chunks and the stress test would show no change.
      if (viewRadius < previous) {
        const cx = Math.floor((player.position.x + CHUNK_SIZE / 2) / CHUNK_SIZE);
        const cz = Math.floor((player.position.z + CHUNK_SIZE / 2) / CHUNK_SIZE);
        for (const [key, chunk] of chunks) {
          if (Math.abs(chunk.userData.cx - cx) > viewRadius || Math.abs(chunk.userData.cz - cz) > viewRadius) removeChunk(key, chunk);
        }
      }
    },
    materialProfiles: [
      [trunkMat, { roughness: 0.95, metalness: 0 }],
      [leafMat, { roughness: 0.8, metalness: 0 }],
      [crystalMat, { roughness: 0.18, metalness: 0.35 }],
      [stoneMat, { roughness: 0.85, metalness: 0 }],
      [ruinMat, { roughness: 0.9, metalness: 0 }]
    ]
  };
}
