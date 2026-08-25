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
      const upstream = await fetch('https://salvagealert.com/api/v1/lots/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ source, page_size: pageSize })
      });

      const text = await upstream.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; }
      catch { data = { raw: text.slice(0, 800) }; }

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
    lots,
    sources: sourceStatus
  });
}
