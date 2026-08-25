// Vercel Serverless Function: /api/health
export default async function handler(req, res) {
  const configured = Boolean(process.env.SALVAGEALERT_KEY);
  if (!configured) return res.status(500).json({ ok:false, configured:false, message:'SALVAGEALERT_KEY is missing.' });

  try {
    const upstream = await fetch('https://salvagealert.com/api/v1/me', {
      headers: { 'Authorization': `Bearer ${process.env.SALVAGEALERT_KEY}`, 'Accept':'application/json' }
    });
    const text = await upstream.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    return res.status(upstream.ok ? 200 : 502).json({
      ok: upstream.ok,
      configured: true,
      upstream_status: upstream.status,
      account: upstream.ok ? data : undefined,
      message: upstream.ok ? 'TRIAD backend is connected to SalvageAlert.' : 'SalvageAlert rejected the API request.'
    });
  } catch (err) {
    return res.status(502).json({ ok:false, configured:true, message:err.message });
  }
}
