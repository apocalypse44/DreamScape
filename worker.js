// Cloudflare Worker in front of the static game (wrangler.jsonc). Its only job: store playtest results.
// POST /api/playtest  {id, ...}  -> KV key "playtest:<id>" (the same id again overwrites: partial log, then final answers).
// Everything else is the static build in dist/ (static files are matched first; only unmatched paths reach here).
// Read results with: python tools/fetch_playtests.py
// ponytail: no auth or rate limit on the POST, only a size cap; add a token if strangers start filling the KV.
const MAX_BYTES = 300_000;

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname !== '/api/playtest') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return new Response('POST only', { status: 405 });
    const body = await request.text();
    if (body.length > MAX_BYTES) return new Response('too large', { status: 413 });
    let data;
    try { data = JSON.parse(body); } catch { return new Response('not JSON', { status: 400 }); }
    const id = String(data?.id ?? '').replace(/[^\w-]/g, '').slice(0, 40);
    if (!id) return new Response('missing id', { status: 400 });
    // Never let a closing tab's partial log overwrite answers that were already submitted.
    if (!data.submitted && JSON.parse(await env.PLAYTESTS.get(`playtest:${id}`) ?? '{}').submitted)
      return new Response('kept', { status: 200 });
    await env.PLAYTESTS.put(`playtest:${id}`, body, { metadata: { at: new Date().toISOString(), submitted: !!data.submitted } });
    return new Response('ok');
  },
};
