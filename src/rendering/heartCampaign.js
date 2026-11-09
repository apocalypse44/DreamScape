import { createHeartCampaign, HEART_REEF_TOP } from '../models/heartCampaign.js';
import { createWaterSpirit } from './waterSpirit.js';

export function buildHeartCampaign({ scene, world, keys, ready, notify, onSigil, onReady }) {
  const model = createHeartCampaign({
    layout: world.heart,
    ready,
    terrainHeight: world.terrainHeight,
  });
  const root = new THREE.Group();
  root.name = 'Heart · The Stolen Current';
  scene.add(root);
  const shore = new THREE.Group();
  shore.name = 'Heart · shore anchor';
  scene.add(shore);
  const routeRoot = new THREE.Group();
  routeRoot.name = 'Heart · A* route';
  scene.add(routeRoot);
  const colliders = [];
  const platforms = [];
  const layout = model.layout;
  const { reef } = layout;
  const axisLength = Math.hypot(layout.gate.x, layout.gate.z) || 1;
  const ux = layout.gate.x / axisLength, uz = layout.gate.z / axisLength;
  const yaw = Math.atan2(ux, uz);
  const local = p => {
    const dx = p.x - reef.x, dz = p.z - reef.z;
    return { x: uz * dx - ux * dz, z: ux * dx + uz * dz };
  };
  const basic = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const stone = new THREE.MeshStandardMaterial({ color: 0x442128, roughness: 0.82, flatShading: true });
  const crystal = new THREE.MeshStandardMaterial({ color: 0xff5264, roughness: 0.26, metalness: 0.12, emissive: 0x740b22, emissiveIntensity: 1.1, flatShading: true });
  const dormant = new THREE.MeshStandardMaterial({ color: 0x5b3941, roughness: 0.35, emissive: 0x260d18, emissiveIntensity: 0.4, flatShading: true });
  const pathMaterial = new THREE.LineBasicMaterial({ color: 0x85ffff, transparent: true, opacity: 0.92, depthWrite: false });
  const exploredMaterial = new THREE.PointsMaterial({ color: 0xffb0be, size: 0.42, transparent: true, opacity: 0.42, depthWrite: false, sizeAttenuation: true });

  const slab = new THREE.Mesh(new THREE.BoxGeometry(reef.width, 4, reef.length), stone);
  slab.position.set(0, -3, 0);
  slab.castShadow = slab.receiveShadow = true;
  root.add(slab);
  const topGeometry = new THREE.PlaneGeometry(reef.width, reef.length, 24, 24);
  topGeometry.rotateX(-Math.PI / 2);
  const topPositions = topGeometry.attributes.position;
  for (let i = 0; i < topPositions.count; i++) {
    const lx = topPositions.getX(i), lz = topPositions.getZ(i);
    const x = reef.x + uz * lx + ux * lz, z = reef.z - ux * lx + uz * lz;
    topPositions.setY(i, layout.height(x, z) - HEART_REEF_TOP + 0.025);
  }
  topPositions.needsUpdate = true;
  topGeometry.computeVertexNormals();
  const reefSurface = new THREE.Mesh(topGeometry,
    new THREE.MeshStandardMaterial({ color: 0x9b3b4e, roughness: 0.78, flatShading: true }));
  reefSurface.receiveShadow = true;
  root.add(reefSurface);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(reef.width + 2.2, 0.55, reef.length + 2.2),
    new THREE.MeshStandardMaterial({ color: 0x6a2a3a, roughness: 0.8, emissive: 0x2a0811, emissiveIntensity: 0.45 }));
  rim.position.y = -4.7;
  root.add(rim);

  function localMesh(parent, mesh, point, y = 0) {
    const p = local(point);
    mesh.position.set(p.x, y, p.z);
    parent.add(mesh);
    return mesh;
  }
  function marker(point, color, radius = 1.2) {
    const group = new THREE.Group();
    localMesh(root, group, point, layout.height(point.x, point.z) - HEART_REEF_TOP + 0.1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.11, 6, 24), basic(color));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.16;
    group.add(ring);
    const light = new THREE.Mesh(new THREE.OctahedronGeometry(radius * 0.28), basic(color));
    light.position.y = 0.55;
    group.add(light);
    return { group, light, ring };
  }

  const spring = marker(layout.spring, 0x75efff, 1.6);
  const checkpoints = layout.checkpoints.map((point, index) => {
    const item = marker(point, 0xffc7d0, 1.25);
    const name = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), basic(index === 0 ? 0xffa1b0 : 0x7f5260));
    localMesh(root, name, point, layout.height(point.x, point.z) - HEART_REEF_TOP + 0.6);
    return { ...item, name };
  });
  const core = marker(layout.core, 0xff4967, 2.1);
  const passageMeshes = layout.passages.map((passage, index) => {
    const p = local(passage);
    const group = new THREE.Group();
    group.position.set(p.x, layout.height(passage.x, passage.z) - HEART_REEF_TOP - 0.1, p.z);
    root.add(group);
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.ConeGeometry(1.7, 6 + index % 2, 5), dormant);
      pillar.position.set(side * 4.2, 2.3, 0);
      pillar.scale.z = 0.62;
      pillar.castShadow = true;
      group.add(pillar);
    }
    const crystalGate = new THREE.Mesh(new THREE.OctahedronGeometry(1.8), crystal);
    crystalGate.position.y = 2.2;
    group.add(crystalGate);
    const switchGroup = new THREE.Group();
    const sw = local(passage.switch);
    switchGroup.position.set(sw.x, layout.height(passage.switch.x, passage.switch.z) - HEART_REEF_TOP + 0.6, sw.z);
    const switchMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05), dormant);
    switchMesh.castShadow = true;
    switchGroup.add(switchMesh);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.08, 6, 20), basic(0xff9aa9));
    halo.rotation.x = Math.PI / 2;
    switchGroup.add(halo);
    root.add(switchGroup);
    const collider = { x: passage.x, z: passage.z, radius: 5.2, off: true };
    colliders.push(collider);
    return { group, crystalGate, switchGroup, switchMesh, collider, passage };
  });

  const anchors = layout.anchors.map(anchor => {
    const parent = anchor.id === 'shore' ? shore : root;
    const group = new THREE.Group();
    const point = anchor.id === 'shore' ? anchor.at : anchor.at;
    if (parent === root) localMesh(parent, group, point, layout.height(point.x, point.z) - HEART_REEF_TOP + 0.3);
    else {
      group.position.set(point.x, world.terrainHeight(point.x, point.z) + 0.1, point.z);
      parent.add(group);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 8, 24), basic(0x71eaff));
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), crystal);
    shard.position.y = 1.2;
    group.add(shard);
    return { anchor, group, shard };
  });
  const islandPlatform = {
    x: reef.x, z: reef.z, width: reef.width, depth: reef.length, solid: false,
    get top() { return model.reefHeight; },
    get bottom() { return model.reefHeight - 5; },
    topAt(x, z) { return model.reefHeight + layout.height(x, z) - HEART_REEF_TOP; },
    contains(x, z, pad = 0) {
      const { x: lx, z: lz } = local({ x, z });
      return Math.abs(lx) <= reef.width / 2 + pad && Math.abs(lz) <= reef.length / 2 + pad;
    },
  };
  platforms.push(islandPlatform);
  const spirit = createWaterSpirit();
  spirit.root.visible = false;
  scene.add(spirit.root);

  let pathLine = null, explored = null, seenRoute = -1, time = 0, eWasDown = false;
  function replaceRoute() {
    if (pathLine) { routeRoot.remove(pathLine); pathLine.geometry.dispose(); }
    if (explored) { routeRoot.remove(explored); explored.geometry.dispose(); }
    pathLine = explored = null;
    const result = model.route;
    if (!result) return;
    const points = result.path.map(p => new THREE.Vector3(p.x, model.reefHeight + layout.height(p.x, p.z) - HEART_REEF_TOP + 0.55, p.z));
    if (points.length > 1) {
      pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), pathMaterial);
      routeRoot.add(pathLine);
    }
    if (result.explored.length) {
      const step = Math.max(1, Math.ceil(result.explored.length / 180));
      const marks = result.explored.filter((_, i) => i % step === 0)
        .map(p => new THREE.Vector3(p.x, model.reefHeight + layout.height(p.x, p.z) - HEART_REEF_TOP + 0.18, p.z));
      explored = new THREE.Points(new THREE.BufferGeometry().setFromPoints(marks), exploredMaterial);
      routeRoot.add(explored);
    }
  }

  const prompt = document.createElement('div');
  prompt.className = 'heart-prompt';
  prompt.setAttribute('aria-live', 'polite');
  prompt.style.cssText = 'position:fixed;left:50%;bottom:18%;transform:translateX(-50%);z-index:5;padding:8px 14px;border:1px solid #e66c81;background:#190d12d9;color:#ffe1e7;font:11px "DM Mono",monospace;letter-spacing:.08em;text-align:center;pointer-events:none;display:none';
  document.body.appendChild(prompt);
  onReady?.(root);

  return {
    model, root, colliders, platforms, obstacles: root,
    update(dt, player, state, inHeart) {
      time += dt;
      const frame = model.update(dt, player, state, inHeart);
      if (frame.message) notify(frame.message.text, frame.message.ms);
      const down = keys.has('KeyE');
      if (down && !eWasDown && state.locked && !state.cinematic) {
        const event = model.interact(player.position, state.mode, state.chaos);
        if (event) {
          notify(event.text, event.ms);
          if (event.kind === 'sigil') onSigil?.();
        }
      }
      eWasDown = down;
      root.position.set(reef.x, model.reefHeight, reef.z);
      root.rotation.y = yaw;
      islandPlatform.solid = model.reefReady;
      for (const item of passageMeshes) {
        const stateOfGate = model.passages.find(p => p.id === item.passage.id);
        item.collider.off = Boolean(stateOfGate?.open);
        item.group.visible = model.awakened;
        item.crystalGate.visible = !stateOfGate?.open;
        item.switchGroup.visible = model.revealed.has(item.passage.id);
        item.switchMesh.material = stateOfGate?.open ? crystal : dormant;
        item.crystalGate.rotation.y += dt * 0.45;
      }
      for (const item of anchors) {
        item.group.visible = model.awakened || item.anchor.id === 'shore';
        item.shard.rotation.y += dt * 0.8;
        item.group.rotation.y = Math.sin(time * 1.8) * 0.12;
      }
      checkpoints.forEach((item, index) => {
        item.group.visible = model.stage !== 'meet';
        item.light.scale.setScalar(index < model.checkpoints ? 1.5 : index === model.checkpoints ? 1.15 : 0.7);
        item.ring.material.color.set(index < model.checkpoints ? 0x79f0db : index === model.checkpoints ? 0xffc7d0 : 0x80505e);
      });
      spring.group.visible = model.stage !== 'meet';
      core.group.visible = model.stage !== 'meet';
      if (model.routeVersion !== seenRoute) { seenRoute = model.routeVersion; replaceRoute(); }
      const water = model.spirit;
      spirit.root.visible = Boolean(water && model.awakened);
      if (water) {
        spirit.root.position.set(water.x, model.reefHeight + layout.height(water.x, water.z) - HEART_REEF_TOP + 0.2, water.z);
        spirit.update(dt);
      }
      const hint = inHeart ? model.hint(player.position, state.mode) : null;
      prompt.textContent = hint || '';
      prompt.style.display = hint && state.locked ? 'block' : 'none';
      return frame;
    },
    reset() {
      model.reset();
      eWasDown = false;
      seenRoute = -1;
      prompt.style.display = 'none';
      root.position.y = 1.5;
      root.visible = true;
      shore.visible = true;
      pathLine?.geometry.dispose();
      explored?.geometry.dispose();
      routeRoot.clear();
      pathLine = explored = null;
      for (const collider of colliders) collider.off = true;
    },
  };
}
