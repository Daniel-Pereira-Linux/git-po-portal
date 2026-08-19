/**
 * Cloudflare Worker / Vercel Serverless OAuth Gatekeeper
 * Realiza a troca segura do authorization code pelo token OAuth do GitHub
 * sem expor o CLIENT_SECRET no navegador.
 */

export default {
  async fetch(request, env) {
    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const code = url.searchParams.get('code') || (await request.json().catch(() => ({}))).code;

    if (!code) {
      return new Response(JSON.stringify({ error: 'Parâmetro code é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const clientId = env.GITHUB_CLIENT_ID || 'SEU_CLIENT_ID';
    const clientSecret = env.GITHUB_CLIENT_SECRET || 'SEU_CLIENT_SECRET';

    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code
        })
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
