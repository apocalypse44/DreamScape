/* Violet Mist boid swarm: separation + alignment + cohesion + player steering. */
(() => {
  class DreamSwarm {
    constructor(scene, terrainHeight, count = 84) {
      this.scene = scene;
      this.terrainHeight = terrainHeight;
      this.count = count;
      this.enabled = false;
      this.positions = [];
      this.velocities = [];
      this.accelerations = Array.from({ length: count }, () => new THREE.Vector3());
      this.forward = new THREE.Vector3();
      this.target = new THREE.Vector3();
      this.dummy = new THREE.Object3D();

      const geometry = new THREE.ConeGeometry(0.13, 0.7, 3);
      geometry.rotateX(Math.PI / 2);
      const material = new THREE.MeshPhongMaterial({
        color: 0xc4a7ff,
        emissive: 0x6242a8,
        emissiveIntensity: 1.6,
        transparent: true,
        opacity: 0.9
      });
      this.mesh = new THREE.InstancedMesh(geometry, material, count);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.frustumCulled = false;
      this.mesh.visible = false;
      scene.add(this.mesh);

      this.marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 10, 8),
        new THREE.MeshBasicMaterial({ color:0xdacaff, wireframe:true, transparent:true, opacity:0.75 })
      );
      this.marker.visible = false;
      scene.add(this.marker);
    }

    seedAround(center) {
      this.positions.length = 0;
      this.velocities.length = 0;
      for (let i = 0; i < this.count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 4 + Math.random() * 15;
        const x = center.x + Math.cos(angle) * radius;
        const z = center.z + Math.sin(angle) * radius;
        const floor = this.terrainHeight(x, z);
        this.positions.push(new THREE.Vector3(x, floor + 2 + Math.random() * 9, z));
        this.velocities.push(new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 3
        ));
      }
    }

    setEnabled(enabled, playerPosition) {
      if (enabled && !this.enabled) this.seedAround(playerPosition);
      this.enabled = enabled;
      this.mesh.visible = enabled;
      if (!enabled) this.marker.visible = false;
    }

    update(dt, playerPosition, camera, mode, chaos) {
      if (!this.enabled) return;
      camera.getWorldDirection(this.forward);
      this.target.copy(playerPosition).addScaledVector(this.forward, mode === "recall" ? 2 : 13);
      this.target.y += mode === "recall" ? 4 : 1.5;
      this.marker.position.copy(this.target);
      this.marker.visible = mode === "attract" || mode === "repel";
      this.marker.material.color.set(mode === "repel" ? 0xff6f9f : 0xdacaff);
      this.marker.rotation.y += dt * 2;
      const neighborRadiusSq = 7.5 * 7.5;
      const separationRadiusSq = 2.1 * 2.1;

      for (let i = 0; i < this.count; i++) {
        const position = this.positions[i];
        const velocity = this.velocities[i];
        const acceleration = this.accelerations[i].set(0, 0, 0);
        const alignment = new THREE.Vector3();
        const cohesion = new THREE.Vector3();
        const separation = new THREE.Vector3();
        let neighbors = 0;

        for (let j = 0; j < this.count; j++) {
          if (i === j) continue;
          const other = this.positions[j];
          const dx = other.x - position.x;
          const dy = other.y - position.y;
          const dz = other.z - position.z;
          const distanceSq = dx*dx + dy*dy + dz*dz;
          if (distanceSq < neighborRadiusSq) {
            alignment.add(this.velocities[j]);
            cohesion.add(other);
            neighbors++;
            if (distanceSq < separationRadiusSq && distanceSq > 0.001) {
              separation.add(new THREE.Vector3(-dx, -dy, -dz).multiplyScalar(1 / distanceSq));
            }
          }
        }

        if (neighbors) {
          alignment.multiplyScalar(1 / neighbors).sub(velocity).multiplyScalar(0.55);
          cohesion.multiplyScalar(1 / neighbors).sub(position).multiplyScalar(0.09);
          acceleration.add(alignment).add(cohesion).addScaledVector(separation, 1.8);
        }

        const toTarget = this.target.clone().sub(position);
        if (mode === "attract") acceleration.addScaledVector(toTarget.normalize(), 4.8);
        if (mode === "repel" && toTarget.lengthSq() < 28 * 28) acceleration.addScaledVector(toTarget.normalize(), -8.5);
        if (mode === "recall") acceleration.addScaledVector(toTarget.normalize(), 7.5);

        const fromPlayer = position.clone().sub(playerPosition);
        if (fromPlayer.lengthSq() > 42 * 42) acceleration.addScaledVector(fromPlayer.normalize(), -4.5);
        const floor = this.terrainHeight(position.x, position.z) + 1.2;
        if (position.y < floor + 2.2) acceleration.y += 5.5;
        if (position.y > floor + 16) acceleration.y -= 2.5;
        acceleration.y += Math.sin(i * 1.7 + performance.now() * 0.0015) * 0.09;
      }

      const minSpeed = 2.2 + chaos * 1.4;
      const maxSpeed = 5.2 + chaos * 4.8;
      for (let i = 0; i < this.count; i++) {
        const velocity = this.velocities[i];
        velocity.addScaledVector(this.accelerations[i], dt);
        let speed = velocity.length();
        if (speed > maxSpeed) velocity.multiplyScalar(maxSpeed / speed);
        else if (speed < minSpeed) velocity.multiplyScalar(minSpeed / Math.max(speed, 0.01));
        this.positions[i].addScaledVector(velocity, dt);
        const ground = this.terrainHeight(this.positions[i].x, this.positions[i].z) + 0.8;
        if (this.positions[i].y < ground) {
          this.positions[i].y = ground;
          velocity.y = Math.abs(velocity.y) + 0.5;
        }
        this.dummy.position.copy(this.positions[i]);
        this.dummy.lookAt(this.positions[i].clone().add(velocity));
        this.dummy.scale.setScalar(0.8 + Math.min(0.45, velocity.length() * 0.035));
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.material.emissiveIntensity = 1.2 + chaos * 2.5;
    }
  }

  window.DreamSwarm = DreamSwarm;
})();
(() => {
  const worldEl = document.querySelector("#world");
  const introEl = document.querySelector("#intro");
  const enterButton = document.querySelector("#enterWorld");
  const meterEl = document.querySelector("#meterFill");
  const notchEl = document.querySelector("#meterNotch");
  const signalEl = document.querySelector("#signalLabel");
  const velocityEl = document.querySelector("#velocity");
  const chunksEl = document.querySelector("#chunks");
  const seedEl = document.querySelector("#seed");
  const realmEl = document.querySelector("#realm");
  const facingEl = document.querySelector("#facingDirection");
  const experienceStateEl = document.querySelector("#experienceState");
  const compassDirectionEl = document.querySelector("#compassDirection");
  const compassWorldEl = document.querySelector("#compassWorld");
  const compassCoordinatesEl = document.querySelector("#compassCoordinates");
  const swarmPanelEl = document.querySelector("#swarmPanel");
  const swarmStatusEl = document.querySelector("#swarmStatus");

  if (!window.THREE) {
    enterButton.textContent = "3D ENGINE FAILED TO LOAD — CHECK CONNECTION";
    enterButton.disabled = true;
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071311);
  scene.fog = new THREE.FogExp2(0x071311, 0.012);
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 650);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  worldEl.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xbce8d1, 0x10200f, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xdfffc0, 1.7);
  sun.position.set(-35, 65, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -90;
  sun.shadow.camera.right = sun.shadow.camera.top = 90;
  scene.add(sun);

  const CHUNK_SIZE = 64;
  const SEGMENTS = 36;
  const VIEW_RADIUS = 2;
  const seed = Math.floor(Math.random() * 8999) + 1000;
  seedEl.textContent = `DS-${seed}`;
  const chunks = new Map();
  let formed = 0;
  let chaos = 0.06;
  let yaw = 0;
  let pitch = -0.08;
  let locked = false;
  let elapsed = 0;
  let lastMoveAngle = 0;
  let hintTimer = 0;
  const keys = new Set();
  const pointerButtons = new Set();
  const player = {
    position: new THREE.Vector3(0, 20, 0),
    velocity: new THREE.Vector3(),
    grounded: false
  };
  const chaosFog = new THREE.Color(0x2a0809);
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

  const swarm = new DreamSwarm(scene, terrainHeight);

  function chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  function scoreAt(x, z) {
    const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE);
    return chunks.get(chunkKey(cx, cz))?.userData.score ?? chaos;
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
    const score = THREE.MathUtils.clamp(biome.roughness + chaos * 0.15, 0.03, 0.98);
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
    chunksEl.textContent = String(formed).padStart(2, "0");
  }

  // The motes have velocity, ambient force, drag, and bounded respawning.
  const moteCount = 240;
  const motePositions = new Float32Array(moteCount * 3);
  const moteVelocity = [];
  for (let i = 0; i < moteCount; i++) {
    motePositions[i * 3] = (Math.random() - 0.5) * 120;
    motePositions[i * 3 + 1] = Math.random() * 28;
    motePositions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    moteVelocity.push(new THREE.Vector3());
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xc6ff70,
    size: 0.28,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  scene.add(motes);

  function updateMotes(dt) {
    const positions = moteGeo.attributes.position;
    for (let i = 0; i < moteCount; i++) {
      let x = positions.getX(i);
      let y = positions.getY(i);
      let z = positions.getZ(i);
      const velocity = moteVelocity[i];
      velocity.x += Math.sin(elapsed * 0.7 + i) * chaos * 0.04 * dt;
      velocity.z += Math.cos(elapsed * 0.6 + i * 2) * chaos * 0.04 * dt;
      velocity.y += Math.sin(elapsed + i) * 0.006 * dt;
      velocity.multiplyScalar(Math.pow(0.94, dt));
      x += velocity.x * dt;
      y += velocity.y * dt;
      z += velocity.z * dt;
      if (Math.abs(x - player.position.x) > 70 || Math.abs(z - player.position.z) > 70 || y < 0 || y > 35) {
        x = player.position.x + (Math.random() - 0.5) * 120;
        z = player.position.z + (Math.random() - 0.5) * 120;
        y = 3 + Math.random() * 25;
        velocity.set(0, 0, 0);
      }
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
  }

  function animateEnvironment() {
    const wind = 0.018 + chaos * 0.15;
    const speed = 0.65 + chaos * 3.2;
    for (const chunk of chunks.values()) {
      for (const item of chunk.userData.animated) {
        const wave = Math.sin(elapsed * speed + item.phase);
        if (item.type === "trees" || item.type === "hub" || item.type === "wisps") {
          item.object.rotation.z = wave * wind;
          item.object.rotation.x = Math.cos(elapsed * speed * 0.7 + item.phase) * wind * 0.45;
        } else if (item.type === "crystals") {
          item.object.rotation.y = item.baseRotation + wave * chaos * 0.08;
        }
      }
    }
    moteMat.opacity = 0.3 + chaos * 0.65;
    moteMat.size = 0.2 + chaos * 0.42;
  }

  function updateSwarm(dt) {
    const insideSwarmWorld = biomeAt(player.position.x, player.position.z).kind === "wisps";
    let mode = "roaming";
    if (keys.has("r")) mode = "recall";
    else if (keys.has("q") || pointerButtons.has(2)) mode = "repel";
    else if (keys.has("e") || pointerButtons.has(0)) mode = "attract";
    swarm.setEnabled(insideSwarmWorld, player.position);
    swarm.update(dt, player.position, camera, mode, chaos);
    swarmPanelEl.classList.toggle("active", insideSwarmWorld);
    swarmStatusEl.textContent = mode.toUpperCase();
  }

  function collidesAt(x, z) {
    const playerRadius = 0.55;
    for (const chunk of chunks.values()) {
      for (const collider of chunk.userData.colliders) {
        const radius = playerRadius + collider.radius;
        const dx = x - collider.x;
        const dz = z - collider.z;
        if (dx*dx + dz*dz < radius*radius) return true;
      }
    }
    return false;
  }

  function updatePlayer(dt) {
    const forward = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    const side = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    const moving = Boolean(forward || side);
    const sprint = keys.has("shift");
    if (moving) {
      const length = Math.hypot(forward, side);
      const f = forward / length;
      const s = side / length;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const dx = -sin * f + cos * s;
      const dz = -cos * f - sin * s;
      const acceleration = sprint ? 28 : 16;
      player.velocity.x += dx * acceleration * dt;
      player.velocity.z += dz * acceleration * dt;
      const angle = Math.atan2(dz, dx);
      const turn = Math.abs(Math.atan2(Math.sin(angle - lastMoveAngle), Math.cos(angle - lastMoveAngle)));
      chaos += turn * 0.014;
      lastMoveAngle = angle;
      hintTimer += dt;
    }
    const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    const targetChaos = moving ? (sprint ? 0.88 : 0.28) : 0.03;
    chaos += (targetChaos - chaos) * dt * (moving ? 0.32 : 0.16);
    chaos = THREE.MathUtils.clamp(chaos, 0.025, 0.98);
    if (!moving) {
      player.velocity.x = 0;
      player.velocity.z = 0;
    } else {
      const drag = Math.pow(player.grounded ? 0.83 : 0.96, dt);
      player.velocity.x *= drag;
      player.velocity.z *= drag;
    }
    const maxSpeed = sprint ? 18 : 9;
    if (horizontalSpeed > maxSpeed) {
      const scale = maxSpeed / horizontalSpeed;
      player.velocity.x *= scale;
      player.velocity.z *= scale;
    }
    player.velocity.y -= 25 * dt;
    const nextX = player.position.x + player.velocity.x * dt;
    if (!collidesAt(nextX, player.position.z)) player.position.x = nextX;
    else player.velocity.x = 0;
    const nextZ = player.position.z + player.velocity.z * dt;
    if (!collidesAt(player.position.x, nextZ)) player.position.z = nextZ;
    else player.velocity.z = 0;
    player.position.y += player.velocity.y * dt;
    const ground = terrainHeight(player.position.x, player.position.z, scoreAt(player.position.x, player.position.z)) + 2.05;
    if (player.position.y <= ground) {
      player.position.y = ground;
      player.velocity.y = Math.max(0, player.velocity.y);
      player.grounded = true;
    } else {
      player.grounded = false;
    }
    camera.position.copy(player.position);
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    velocityEl.textContent = Math.hypot(player.velocity.x, player.velocity.z).toFixed(1);
    const percent = Math.round(chaos * 100);
    meterEl.style.width = `${percent}%`;
    notchEl.style.left = `${percent}%`;
    const atCrossing = Math.hypot(player.position.x, player.position.z) < 25;
    const experienceState = atCrossing ? "NEUTRAL" : chaos < 0.4 ? "SERENE" : chaos < 0.65 ? "TRANSFORMING" : "CHAOTIC";
    signalEl.textContent = experienceState;
    experienceStateEl.textContent = `${experienceState} DREAMSCAPE`;
    const currentWorld = biomeAt(player.position.x, player.position.z);
    realmEl.textContent = currentWorld.name;
    compassDirectionEl.textContent = currentWorld.route;
    compassWorldEl.textContent = currentWorld.name;
    compassCoordinatesEl.textContent = `X ${Math.round(player.position.x)} · Z ${Math.round(player.position.z)}`;
    const bearing = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    const directions = ["N · NORTH","NE · NORTH-EAST","E · EAST","SE · SOUTH-EAST","S · SOUTH","SW · SOUTH-WEST","W · WEST","NW · NORTH-WEST"];
    facingEl.textContent = directions[Math.round(bearing / 45) % 8];
    document.documentElement.style.setProperty("--acid", chaos > 0.62 ? "#ff705d" : "#c6ff65");
    if (hintTimer > 5) document.querySelector("#movementHint").classList.add("fade");
  }

  enterButton.addEventListener("click", () => renderer.domElement.requestPointerLock());
  document.addEventListener("pointerlockchange", () => {
    locked = document.pointerLockElement === renderer.domElement;
    if (!locked) pointerButtons.clear();
    document.body.classList.toggle("playing", locked);
    introEl.classList.toggle("hidden", locked);
  });
  document.addEventListener("mousemove", event => {
    if (!locked) return;
    yaw -= event.movementX * 0.0022;
    pitch -= event.movementY * 0.002;
    pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.35);
  });
  document.addEventListener("keydown", event => {
    keys.add(event.key.toLowerCase());
    if (event.code === "Space" && player.grounded) {
      player.velocity.y = 10.5;
      player.grounded = false;
      chaos += 0.08;
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  });
  document.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
  document.addEventListener("mousedown", event => {
    if (locked) pointerButtons.add(event.button);
  });
  document.addEventListener("mouseup", event => pointerButtons.delete(event.button));
  document.addEventListener("contextmenu", event => {
    if (locked) event.preventDefault();
  });
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.04);
    elapsed += dt;
    updateChunks();
    updatePlayer(dt);
    updateSwarm(dt);
    updateMotes(dt);
    animateEnvironment();
    const currentBiome = biomeAt(player.position.x, player.position.z);
    scene.fog.color.set(currentBiome.fog).lerp(chaosFog, chaos * 0.25);
    scene.background.copy(scene.fog.color);
    scene.fog.density = 0.009 + chaos * 0.012;
    hemi.color.set(currentBiome.sky).lerp(new THREE.Color(0xff705d), chaos * 0.35);
    sun.color.set(0xdfffc0).lerp(new THREE.Color(0xff4d35), chaos);
    moteMat.color.set(0xc6ff70).lerp(new THREE.Color(0xff3c28), chaos);
    renderer.render(scene, camera);
  }

  updateChunks();
  player.position.y = terrainHeight(0, 0, scoreAt(0, 0)) + 2.05;
  frame();
})();
