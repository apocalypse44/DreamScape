export function createScene(worldEl) {
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

  return { scene, camera, renderer, hemi, sun };
}
