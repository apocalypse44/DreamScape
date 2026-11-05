import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source = readFileSync(new URL('../src/rendering/modelAssets.js', import.meta.url), 'utf8');
const { createModelAssetStore } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function harness(prepareTexture) {
  const pending = new Set(), loaders = [], frames = [];
  const store = createModelAssetStore({
    prepareTexture,
    manager: { itemStart: t => pending.add(t), itemEnd: t => pending.delete(t) },
    resolveURL: (uri, path) => new URL(uri, `https://game.test/${path}`).href,
    nextFrame: () => new Promise(resolve => frames.push(resolve)),
    createLoader: () => {
      const loader = { register(plugin) { this.plugin = plugin; }, load(url, resolve, progress, reject) { Object.assign(this, { url, resolve, reject }); } };
      loaders.push(loader); return loader;
    },
  });
  return { store, pending, loaders, frames };
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
function parser({ uri = 'sheet.png', path = 'kit/', sampler = {}, color = true, image = {}, extensions } = {}) {
  let loads = 0;
  return {
    json: { textures: [{ source: 0, sampler: 0, extensions }], images: [{ uri, ...image }], samplers: [sampler],
      materials: [color ? { pbrMetallicRoughness: { baseColorTexture: { index: 0 } } } : { normalTexture: { index: 0 } }] },
    options: { path }, associations: new Map(),
    loadTexture() { loads++; return Promise.resolve({ id: Symbol('texture') }); },
    get loads() { return loads; },
  };
}
async function getPlugin(h) {
  const promise = h.store.load('template.gltf');
  h.frames.shift()(); await flush();
  const loader = h.loaders[0]; loader.resolve({}); await promise; await flush();
  return loader.plugin;
}

test('queued model loads stay tracked, run two at a time, and reuse the same source', async () => {
  const h = harness();
  const a = h.store.load('a'), b = h.store.load('b'), c = h.store.load('c');
  assert.equal(h.store.load('a'), a);
  assert.equal(h.pending.size, 3); assert.equal(h.frames.length, 2);
  h.frames.splice(0).forEach(f => f()); await flush();
  assert.equal(h.loaders.length, 2);
  const asset = {}; h.loaders[0].resolve(asset); await a; await flush();
  assert.equal(h.pending.size, 2); assert.equal(h.frames.length, 1);
  h.frames.shift()(); await flush(); assert.equal(h.loaders.length, 3);
  h.loaders[1].resolve({}); h.loaders[2].resolve({}); await Promise.all([b, c]);
  assert.equal(h.pending.size, 0); assert.equal(await h.store.load('a'), asset);
});

test('failed model loads release their slot and may be retried', async () => {
  const h = harness(), promise = h.store.load('missing');
  const failure = assert.rejects(promise, /missing/);
  h.frames.shift()(); await flush(); h.loaders[0].reject(new Error('missing')); await failure;
  assert.equal(h.pending.size, 0);
  const retry = h.store.load('missing'); h.frames.shift()(); await flush();
  h.loaders[1].resolve({ ok: true }); assert.deepEqual(await retry, { ok: true });
});

test('separate model parses share one compatible texture decode and association', async () => {
  const plugin = await getPlugin(harness()), a = parser(), b = parser();
  const [first, second] = await Promise.all([plugin(a).loadTexture(0), plugin(b).loadTexture(0)]);
  assert.equal(first, second); assert.equal(a.loads + b.loads, 1);
  assert.equal(b.associations.get(second).index, 0);
});

test('texture sharing respects directory, sampler and color space', async () => {
  const plugin = await getPlugin(harness());
  const parses = [parser(), parser({ path: 'other/' }), parser({ sampler: { wrapS: 33071 } }), parser({ color: false })];
  const textures = await Promise.all(parses.map(p => plugin(p).loadTexture(0)));
  assert.equal(new Set(textures).size, 4);
});

test('embedded and extension textures stay with their original decoder', async () => {
  const plugin = await getPlugin(harness());
  for (const p of [parser({ uri: 'data:image/png;base64,a' }), parser({ image: { uri: undefined, bufferView: 0 } }), parser({ extensions: { KHR_texture_basisu: {} } })]) {
    assert.equal(plugin(p).loadTexture(0), null); assert.equal(p.loads, 0);
  }
});

test('mixed color spaces and unknown material extensions are not shared', async () => {
  const plugin = await getPlugin(harness()), mixed = parser(), extended = parser();
  mixed.json.materials[0].normalTexture = { index: 0 };
  extended.json.materials[0].extensions = { KHR_materials_transmission: {} };
  assert.equal(plugin(mixed).loadTexture(0), null);
  assert.equal(plugin(extended).loadTexture(0), null);
});

test('failed shared texture decodes are evicted for retry', async () => {
  const plugin = await getPlugin(harness()), a = parser(), b = parser();
  a.loadTexture = () => Promise.reject(new Error('decode failed'));
  await assert.rejects(plugin(a).loadTexture(0), /decode failed/);
  assert.ok(await plugin(b).loadTexture(0)); assert.equal(b.loads, 1);
});

test('shared textures are prepared only once before either model receives them', async () => {
  let prepared = 0;
  const plugin = await getPlugin(harness(async texture => { prepared++; texture.ready = true; return texture; }));
  const [a, b] = await Promise.all([plugin(parser()).loadTexture(0), plugin(parser()).loadTexture(0)]);
  assert.equal(prepared, 1); assert.equal(a, b); assert.equal(a.ready, true);
});
