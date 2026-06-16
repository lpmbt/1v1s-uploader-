const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });

  const apiKey = req.headers['x-api-key'] || req.headers['X-API-KEY'];
  const UPLOAD_API_KEY = process.env.UPLOAD_API_KEY || 'REPLACE_WITH_UPLOAD_API_KEY';
  if (!apiKey || apiKey !== UPLOAD_API_KEY) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = process.env.GITHUB_OWNER;
  const REPO = process.env.GITHUB_REPO;
  if (!GITHUB_TOKEN || !OWNER || !REPO) return res.status(500).json({ ok: false, error: 'server-missing-config' });

  const body = req.body || {};
  const filename = body.filename;
  const content = body.content;
  if (!filename || typeof filename !== 'string' || !content) return res.status(400).json({ ok: false, error: 'missing filename or content' });

  try {
    const path = `saves/${encodeURIComponent(filename)}`;
    const message = `auto save ${filename}`;
    const fileStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const b64 = Buffer.from(fileStr, 'utf8').toString('base64');
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;

    const getResp = await fetch(url, { method: 'GET', headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': '1v1s-uploader' } });

    let payload = { message, content: b64 };
    if (getResp.status === 200) {
      const info = await getResp.json();
      if (info && info.sha) payload.sha = info.sha;
    }

    const putResp = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': '1v1s-uploader', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const jr = await putResp.json();
    if (putResp.ok) return res.json({ ok: true, result: jr });
    console.error('github put failed', putResp.status, jr);
    return res.status(500).json({ ok: false, error: 'github_put_failed', detail: jr });
  } catch (e) {
    console.error('upload error', e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
};
