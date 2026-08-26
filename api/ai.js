const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}
function getBearer(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}
function extractText(data) {
  return (data?.candidates || []).flatMap(c => c?.content?.parts || []).map(p => p?.text || '').join('').trim();
}
function safePrompt(input) {
  const task = String(input?.task || '').trim().slice(0, 160);
  const context = String(input?.context || '').trim().slice(0, 18000);
  if (!task || !context) throw new Error('task and context are required');
  return { task, context };
}

async function verifyUser(token) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error('Supabase server configuration is missing.');
  const response = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!process.env.GEMINI_API_KEY) return json(res, 503, { error: 'Gemini is not configured on this deployment.' });
  const token = getBearer(req);
  if (!token) return json(res, 401, { error: 'Authentication required.' });

  try {
    const user = await verifyUser(token);
    if (!user?.id) return json(res, 401, { error: 'Invalid session.' });
    const { task, context } = safePrompt(req.body || {});
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const system = [
      'You are FlowLab, a songwriting development assistant.',
      'Develop the artist’s own material rather than replacing their authorship.',
      'Preserve the provided voice and intent.',
      'Return concrete creative work. Do not expose hidden reasoning.',
      'When asked for alternatives, label them clearly and keep them distinct.'
    ].join(' ');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: `Task: ${task}\n\nMaterial:\n${context}` }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 1400 }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json(res, response.status >= 500 ? 502 : response.status, { error: data?.error?.message || 'Gemini request failed.' });
    const text = extractText(data);
    if (!text) return json(res, 502, { error: 'Gemini returned no text.' });
    return json(res, 200, { text, model });
  } catch (error) {
    return json(res, 400, { error: error?.message || 'AI request failed.' });
  }
}
