const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23limikcxrQ6KRXDVV';
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '79d1884c7aadbc1634322f26fc0aa42ccf46de0f';

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Parâmetro code é obrigatório' }));
    return;
  }

  const postData = JSON.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: code
  });

  const ghReq = https.request({
    hostname: 'github.com',
    path: '/login/oauth/access_token',
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (ghRes) => {
    let body = '';
    ghRes.on('data', chunk => body += chunk);
    ghRes.on('end', () => {
      res.writeHead(ghRes.statusCode || 200, { 'Content-Type': 'application/json' });
      res.end(body);
    });
  });

  ghReq.on('error', (err) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });

  ghReq.write(postData);
  ghReq.end();
});

server.listen(PORT, () => {
  console.log(`OAuth Gatekeeper rodando na porta ${PORT}`);
});
