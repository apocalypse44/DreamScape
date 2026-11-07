import { cloneSkinned } from './anim.js';
import { createModelAssetStore } from './modelAssets.js';

let assets = null;
// These are environment kit props, often backed by 2K/4K trim sheets even
// for a small barrel. Keep their largest dimension at 1K before GPU upload.
// Player/NPC textures use their own loaders and are unaffected.
const KIT_TEXTURE_SIZE = 1024;
const resizedImages = new WeakMap();
function prepareKitTexture(texture) {
  const image = texture.image;
  if (!image) return texture;
  const cached = resizedImages.get(image);
  if (cached) { texture.image = cached; texture.needsUpdate = true; return texture; }
  const scale = KIT_TEXTURE_SIZE / Math.max(image.width, image.height);
  if (scale >= 1) return texture;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return texture;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  resizedImages.set(image, canvas);
  texture.image = canvas;
  texture.needsUpdate = true;
  // Release the full-size bitmap once replaced, unless Three's global image
  // cache owns it and another consumer might still need it.
  if (!THREE.Cache.enabled) image.close?.();
  return texture;
}
// Raw dimensions are needed by terrain prop instancing and Spade's modular
// buildings. Give those callers the same cache/queue without normalizing size.
export async function loadModelAsset(url) {
  assets ||= createModelAssetStore({
    createLoader: () => new THREE.GLTFLoader(),
    manager: THREE.DefaultLoadingManager,
    resolveURL: (uri, path) => new URL(uri, new URL(path || '', document.baseURI)).href,
    nextFrame: () => new Promise(resolve => requestAnimationFrame(resolve)),
    prepareTexture: prepareKitTexture,
  });
  const gltf = await assets.load(url);
  const model = cloneSkinned(gltf.scene);
  const materials = new Map();
  const ownMaterial = original => {
    if (!materials.has(original)) materials.set(original, original.clone());
    return materials.get(original);
  };
  model.traverse(object => {
    if (!object.isMesh) return;
    object.material = Array.isArray(object.material) ? object.material.map(ownMaterial) : ownMaterial(object.material);
  });
  return { scene: model, animations: gltf.animations };
}

// Load each kit once; instances own their transforms and materials, while
// geometry and compatible texture sheets are shared.
export async function loadModel(url, height) {
  const gltf = await loadModelAsset(url);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const scale = height / Math.max(box.max.y - box.min.y, 1e-6);
  model.scale.multiplyScalar(scale);
  model.position.set(
    -(box.min.x + box.max.x) / 2 * scale,
    -box.min.y * scale,
    -(box.min.z + box.max.z) / 2 * scale
  );
  model.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    // Skinned bounds use the bind pose; animated limbs would otherwise pop out of view.
    if (object.isSkinnedMesh) object.frustumCulled = false;
  });
  const object = new THREE.Group();
  object.add(model);
  const size = box.getSize(new THREE.Vector3()).multiplyScalar(scale);
  return { object, size, animations: gltf.animations };
}

// Clone a model's materials and make them glow, so tinting one copy leaves the others alone.
export function makeGlow(object, color, intensity) {
  const materials = [];
  object.traverse(child => {
    if (!child.isMesh) return;
    child.material = child.material.clone();
    child.material.emissive = new THREE.Color(color);
    child.material.emissiveIntensity = intensity;
    materials.push(child.material);
  });
  return materials;
}
