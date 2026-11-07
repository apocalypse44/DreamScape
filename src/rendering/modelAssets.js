// Static kit models often reference the same large texture sheets. GLTFLoader's
// cache belongs to one parse, so loading separate props otherwise decodes and
// uploads those sheets again. Share compatible textures across model files.
export function createModelAssetStore({ createLoader, manager, resolveURL, nextFrame, prepareTexture = texture => texture, concurrency = 2 }) {
  const models = new Map(), textures = new Map(), queue = [];
  let active = 0, ticket = 0;

  function texturePlugin(parser) {
    return {
      name: 'DreamscapeSharedTextures',
      loadTexture(index) {
        const def = parser.json.textures[index];
        const image = parser.json.images?.[def.source];
        // Extension decoders and embedded images keep their loader's own path.
        if (!image?.uri || /^(data:|blob:)/i.test(image.uri) || def.extensions) return null;
        let color = false, linear = false;
        for (const m of parser.json.materials || []) {
          const pbr = m.pbrMetallicRoughness || {};
          color ||= [pbr.baseColorTexture, m.emissiveTexture].some(t => t?.index === index);
          linear ||= [pbr.metallicRoughnessTexture, m.normalTexture, m.occlusionTexture].some(t => t?.index === index);
          // Unknown material extensions may use different color spaces.
          if (m.extensions) return null;
        }
        if (color && linear) return null;
        const sampler = parser.json.samplers?.[def.sampler] || {};
        const key = JSON.stringify([resolveURL(image.uri, parser.options.path), image.mimeType || '', color,
          sampler.magFilter ?? 9729, sampler.minFilter ?? 9987, sampler.wrapS ?? 10497, sampler.wrapT ?? 10497]);
        if (!textures.has(key)) {
          const promise = parser.loadTexture(index).then(prepareTexture).catch(error => { textures.delete(key); throw error; });
          textures.set(key, promise);
        }
        return textures.get(key).then(texture => {
          parser.associations.set(texture, { type: 'textures', index });
          return texture;
        });
      },
    };
  }

  async function run(job) {
    try {
      // Pace cached responses too: their parse/install callbacks must not all
      // arrive in the same frame as the player, NPCs and terrain startup.
      await nextFrame();
      const loader = createLoader();
      loader.register(texturePlugin);
      const asset = await new Promise((resolve, reject) => loader.load(job.url, resolve, undefined, reject));
      job.resolve(asset);
    } catch (error) {
      models.delete(job.url); // a later call may retry a missing/failed asset
      job.reject(error);
    } finally {
      manager.itemEnd(job.token);
      active--;
      pump();
    }
  }

  function pump() {
    while (active < concurrency && queue.length) { active++; void run(queue.shift()); }
  }

  return {
    load(url) {
      if (models.has(url)) return models.get(url);
      // Register queued work immediately so the intro cannot become ready
      // between batches before GLTFLoader starts the next request.
      const token = `dreamscape-model:${++ticket}`;
      manager.itemStart(token);
      const promise = new Promise((resolve, reject) => queue.push({ url, token, resolve, reject }));
      models.set(url, promise);
      pump();
      return promise;
    },
  };
}
