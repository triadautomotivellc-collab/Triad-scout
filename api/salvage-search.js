// Vercel Serverless Function: /api/salvage-search
// Secret stays in Vercel Environment Variables as SALVAGEALERT_KEY.
const ALLOWED_SOURCES = new Set(['copart_us','iaai_us','govdeals_us']);

function extractLots(payload) {
  if (Array.isArray(payload)) return payload;
  for (const k of ['lots','results','items','records']) {
    if (Array.isArray(payload?.[k])) return payload[k];
  }
  if (Array.isArray(payload?.data)) return payload.data;
  for (const k of ['lots','results','items','records']) {
    if (Array.isArray(payload?.data?.[k])) return payload.data[k];
  }
  return [];
}

const MAKE_ALIASES = {
  ford:'FORD', chevy:'CHEVROLET', chevrolet:'CHEVROLET', gmc:'GMC',
  cadillac:'CADILLAC', buick:'BUICK', pontiac:'PONTIAC', dodge:'DODGE',
  ram:'RAM', chrysler:'CHRYSLER', jeep:'JEEP', lincoln:'LINCOLN',
  mercury:'MERCURY', toyota:'TOYOTA', lexus:'LEXUS', honda:'HONDA',
  acura:'ACURA', nissan:'NISSAN', infiniti:'INFINITI', mazda:'MAZDA',
  subaru:'SUBARU', mitsubishi:'MITSUBISHI', hyundai:'HYUNDAI', kia:'KIA',
  bmw:'BMW', mercedes:'MERCEDES-BENZ', 'mercedes-benz':'MERCEDES-BENZ',
  audi:'AUDI', volkswagen:'VOLKSWAGEN', vw:'VOLKSWAGEN', volvo:'VOLVO',
  tesla:'TESLA', porsche:'PORSCHE', jaguar:'JAGUAR', landrover:'LAND ROVER',
  'land rover':'LAND ROVER', mini:'MINI'
};

function queryFilters(text) {
  if (!text) return {};
  const lower = text.toLowerCase();
  let make = null;
  for (const [alias, canonical] of Object.entries(MAKE_ALIASES)) {
    if (new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(\\s|$)`,'i').test(lower)) {
      make = canonical; break;
    }
  }
  const years = [...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m=>Number(m[1]));
  const out = { text };
  if (make) out.makes = [make];
  if (years.length === 1) { out.year_min = years[0]; out.year_max = years[0]; }
  else if (years.length >= 2) { out.year_min = Math.min(...years); out.year_max = Math.max(...years); }
  return out;
}

async function callSearch(key, body) {
  return fetch('https://salvagealert.com/api/v1/lots/search', {
    method:'POST',
    headers:{
      'Authorization':`Bearer ${key}`,
      'Content-Type':'application/json',
      'Accept':'application/json'
    },
    body:JSON.stringify(body)
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }

  const key = process.env.SALVAGEALERT_KEY;
  if (!key) {
    return res.status(500).json({ error: 'SALVAGEALERT_KEY is not configured on the backend.' });
  }

  const requested = String(req.body?.source || 'copart_us');
  const pageSize = Math.max(1, Math.min(30, Number(req.body?.page_size || 20)));
  const query = String(req.body?.query || '').trim().slice(0, 120);
  const maxPriceRaw = Number(req.body?.max_price);
  const maxPrice = Number.isFinite(maxPriceRaw) && maxPriceRaw > 0 ? maxPriceRaw : null;
  const sources = requested === 'all'
    ? ['copart_us','iaai_us','govdeals_us']
    : [requested];

  if (sources.some(s => !ALLOWED_SOURCES.has(s))) {
    return res.status(400).json({ error: 'Unsupported source.' });
  }

  const lots = [];
  const sourceStatus = [];

  for (const source of sources) {
    try {
      const searchBody = { source, page_size: pageSize, ...queryFilters(query) };
      if (maxPrice) searchBody.price_max = maxPrice;

      let upstream = await callSearch(key, searchBody);
      let text = await upstream.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; }
      catch { data = { raw: text.slice(0, 800) }; }

      // If the provider rejects the generic text field, retry once with structured filters only.
      // This keeps make/year searches working while remaining compatible with stricter API schemas.
      if (!upstream.ok && query && [400, 422].includes(upstream.status)) {
        const fallbackBody = { source, page_size: pageSize, ...queryFilters(query) };
        delete fallbackBody.text;
        if (maxPrice) fallbackBody.price_max = maxPrice;
        upstream = await callSearch(key, fallbackBody);
        text = await upstream.text();
        data = {};
        try { data = text ? JSON.parse(text) : {}; }
        catch { data = { raw: text.slice(0, 800) }; }
      }

      if (!upstream.ok) {
        sourceStatus.push({ source, ok: false, status: upstream.status, error: data?.detail || data?.error || 'Upstream request failed' });
        continue;
      }

      const found = extractLots(data);
      lots.push(...found.map(x => ({ ...x, source: x?.source || source })));
      sourceStatus.push({
        source,
        ok: true,
        count: found.length,
        status: upstream.status,
        pagination: data?.pagination || data?.meta || data?.page || null
      });
    } catch (err) {
      sourceStatus.push({ source, ok: false, error: err.message });
    }
  }

  if (!lots.length) {
    return res.status(502).json({
      error: 'No lot records returned.',
      sources: sourceStatus
    });
  }

  return res.status(200).json({
    ok: true,
    live: true,
    provider: 'SalvageAlert',
    query,
    lots,
    sources: sourceStatus
  });
}
