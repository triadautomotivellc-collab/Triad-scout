import {
  ALLOWED_SOURCES,
  buildSearchBody,
  dedupeLots,
  extractLots,
  lotMatchesQuery,
  parseVehicleQuery
} from '../lib/scout-core.js';

const UPSTREAM_URL = 'https://salvagealert.com/api/v1/lots/search';

async function callSearch(key, body, timeoutMs=15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(UPSTREAM_URL, {
      method:'POST',
      headers:{
        'Authorization':`Bearer ${key}`,
        'Content-Type':'application/json',
        'Accept':'application/json'
      },
      body:JSON.stringify(body),
      signal:controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { raw:text.slice(0,800) }; }
}

function normalizeSourceName(source) {
  return source === 'copart_us' ? 'Copart US'
    : source === 'iaai_us' ? 'IAA US'
    : source === 'govdeals_us' ? 'GovDeals US'
    : source;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return res.status(405).json({ ok:false, error:'Use POST.' });
  }

  const key = process.env.SALVAGEALERT_KEY;
  if (!key) return res.status(500).json({ ok:false, error:'SALVAGEALERT_KEY is not configured on the backend.' });

  const requested = String(req.body?.source || 'smart');
  const pageSize = Math.max(1, Math.min(50, Number(req.body?.page_size || 20)));
  const query = String(req.body?.query || '').trim().slice(0,160);
  const maxPrice = Number(req.body?.max_price) > 0 ? Number(req.body.max_price) : null;
  const smartMin = Math.max(1, Math.min(25, Number(req.body?.smart_min || 10)));
  const smartOrder = ['iaai_us','copart_us','govdeals_us'];
  const sources = requested === 'all' ? [...ALLOWED_SOURCES]
    : requested === 'smart' ? smartOrder
    : [requested];

  if (!['all','smart',...ALLOWED_SOURCES].includes(requested) || sources.some(s => !ALLOWED_SOURCES.includes(s))) {
    return res.status(400).json({ ok:false, error:'Unsupported source.' });
  }

  const parsed = parseVehicleQuery(query);
  const allLots = [];
  const sourceStatus = [];

  for (const source of sources) {
    const started = Date.now();
    try {
      const { body } = buildSearchBody({ source, query, pageSize, maxPrice });
      let upstream = await callSearch(key, body);
      let data = await readJson(upstream);
      let fallbackUsed = false;

      // Some sources may reject a more specific model string. Retry once with
      // make/year/price only, then enforce the user's model/trim locally.
      if (!upstream.ok && query && [400,422].includes(upstream.status) && body.models) {
        const fallbackBody = { ...body };
        delete fallbackBody.models;
        fallbackUsed = true;
        upstream = await callSearch(key, fallbackBody);
        data = await readJson(upstream);
      }

      if (!upstream.ok) {
        sourceStatus.push({
          source, name:normalizeSourceName(source), ok:false,
          status:upstream.status,
          error:data?.detail || data?.error || 'Upstream request failed',
          latency_ms:Date.now()-started,
          fallback_used:fallbackUsed
        });
        continue;
      }

      const raw = extractLots(data);
      const verified = query ? raw.filter(lot => lotMatchesQuery(lot, parsed)) : raw;
      allLots.push(...verified.map(lot => ({ ...lot, source:lot?.source || source })));
      sourceStatus.push({
        source, name:normalizeSourceName(source), ok:true,
        status:upstream.status,
        raw_count:raw.length,
        verified_count:verified.length,
        rejected_count:raw.length-verified.length,
        latency_ms:Date.now()-started,
        fallback_used:fallbackUsed,
        pagination:data?.pagination || data?.meta || data?.page || null
      });
      if (requested === 'smart' && dedupeLots(allLots).length >= smartMin) break;
    } catch (error) {
      sourceStatus.push({
        source, name:normalizeSourceName(source), ok:false,
        error:error?.name === 'AbortError' ? 'Source request timed out.' : String(error?.message || error),
        latency_ms:Date.now()-started
      });
    }
  }

  const lots = dedupeLots(allLots);
  return res.status(200).json({
    ok:true,
    live:true,
    provider:'SalvageAlert',
    strategy:requested,
    query,
    parsed:{
      make:parsed.make, model:parsed.model, trims:parsed.trims,
      year_min:parsed.yearMin, year_max:parsed.yearMax,
      damage:parsed.damage
    },
    count:lots.length,
    lots,
    sources:sourceStatus
  });
}
