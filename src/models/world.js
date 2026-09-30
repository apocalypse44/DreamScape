export function createWorld({ scene, state, player, onChunk }) {
  const CHUNK_SIZE = 64;
  const SEGMENTS = 36;
  const VIEW_RADIUS = 2;
  const seed = Math.floor(Math.random() * 8999) + 1000;
  const chunks = new Map();
  let formed = 0;
  const BIOMES = {
    hub:   { name:"THE CROSSING", route:"CENTER", ground:0x53645a, fog:0x0b1716, sky:0xbdebd3, roughness:0.2, kind:"hub" },
    north: { name:"VERDANT REACH", route:"N · NORTH", ground:0x527d4f, fog:0x071b18, sky:0xbdebd3, roughness:0.1, kind:"trees" },
    east:  { name:"EMBER SPIRES", route:"E · EAST", ground:0x712b24, fog:0x290a09, sky:0xff765b, roughness:0.92, kind:"crystals" },
    south: { name:"GOLDEN DUNES", route:"S · SOUTH", ground:0x9b7a48, fog:0x291e13, sky:0xffd28a, roughness:0.32, kind:"pillars" },
    west:  { name:"VIOLET MIST", route:"W · WEST", ground:0x50466f, fog:0x161225, sky:0xc4b5ff, roughness:0.48, kind:"wisps" }
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
    if (Math.hypot(x, z) < 25) return BIOMES.hub;
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
    const transition = THREE.MathUtils.smoothstep(distance, 16, 58);
    return THREE.MathUtils.lerp(BIOMES.hub.roughness, directional, transition);
  }

  // Height depends on absolute world coordinates, so adjacent chunks share identical edges.
  function terrainHeight(x, z) {
    const score = terrainRoughnessAt(x, z);
    const low = noise(x * 0.018, z * 0.018) * 11 + noise(x * 0.043, z * 0.043) * 4;
    const rough = Math.pow(Math.max(0.01, noise(x * 0.105, z * 0.105)), 0.34) * 18 + noise(x * 0.25, z * 0.25) * 3;
    return -5 + THREE.MathUtils.lerp(low, rough, score);
  }


  function chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  function scoreAt(x, z) {
    const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE);
    return chunks.get(chunkKey(cx, cz))?.userData.score ?? state.chaos;
  }

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 3.2, 5);
  const crownGeo = new THREE.ConeGeometry(1.5, 4.5, 6);
  const crystalGeo = new THREE.ConeGeometry(0.65, 4.8, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x243526 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x7fb06a });
  const crystalMat = new THREE.MeshPhongMaterial({ color: 0xff5a42, emissive: 0x5d0b06, shininess: 85 });
  const mistLeafMat = new THREE.MeshPhongMaterial({ color:0x897ab5, emissive:0x21173f });
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

  function createDecor(group, cx, cz, score, biome) {
    const points = poissonPoints(cx, cz, biome.kind === "crystals" ? 7 : 8, biome.kind === "hub" ? 5 : 14);
    points.forEach(({x,z}, i) => {
      const wx = cx * CHUNK_SIZE + x;
      const wz = cz * CHUNK_SIZE + z;
      if (Math.hypot(wx, wz) < 10) return;
      const y = terrainHeight(wx, wz, score);
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
      } else if (biome.kind === "wisps") {
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.7;
        const crown = new THREE.Mesh(new THREE.SphereGeometry(1.25, 7, 5), mistLeafMat);
        crown.position.y = 3.7;
        object.add(trunk, crown);
        object.scale.setScalar(0.65 + hash(i, cx) * 0.75);
        addCollider(group, wx, wz, 0.8 * object.scale.x);
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
  function createWfcRuins(group, cx, cz, score, biome) {
    if (biome.kind === "hub") return;
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
      const y = terrainHeight(wx,wz,score);
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
    for (let i = 0; i < positions.count; i++) {
      const wx = cx * CHUNK_SIZE + positions.getX(i);
      const wz = cz * CHUNK_SIZE + positions.getZ(i);
      positions.setY(i, terrainHeight(wx, wz, score));
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    const color = new THREE.Color(biome.ground);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: score * 0.12,
      flatShading: score > 0.55
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    group.add(mesh);
    group.userData = { score, material, cx, cz, biome, colliders:[], animated:[] };
    createDecor(group, cx, cz, score, biome);
    createWfcRuins(group, cx, cz, score, biome);
    onChunk(group);
    scene.add(group);
    chunks.set(chunkKey(cx, cz), group);
    formed++;
  }

  function updateChunks() {
    const cx = Math.floor((player.position.x + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const cz = Math.floor((player.position.z + CHUNK_SIZE / 2) / CHUNK_SIZE);
    for (let x = cx - VIEW_RADIUS; x <= cx + VIEW_RADIUS; x++) {
      for (let z = cz - VIEW_RADIUS; z <= cz + VIEW_RADIUS; z++) {
        if (!chunks.has(chunkKey(x, z))) createChunk(x, z);
      }
    }
    for (const [key, chunk] of chunks) {
      if (Math.abs(chunk.userData.cx - cx) > VIEW_RADIUS + 1 || Math.abs(chunk.userData.cz - cz) > VIEW_RADIUS + 1) {
        scene.remove(chunk);
        chunk.children[0].geometry.dispose();
        chunk.children[0].material.dispose();
        chunks.delete(key);
      }
    }

  }

  return { seed, chunks, hash, biomeAt, terrainHeight, scoreAt, updateChunks,
    get formed() { return formed; },
    materialProfiles: [
      [trunkMat, { roughness: 0.95, metalness: 0 }],
      [leafMat, { roughness: 0.8, metalness: 0 }],
      [crystalMat, { roughness: 0.18, metalness: 0.35 }],
      [mistLeafMat, { roughness: 0.38, metalness: 0.12 }],
      [stoneMat, { roughness: 0.85, metalness: 0 }],
      [ruinMat, { roughness: 0.9, metalness: 0 }]
    ]
  };
}
