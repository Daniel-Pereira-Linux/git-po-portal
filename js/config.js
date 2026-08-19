/**
 * Configuration for Git PO Portal
 */
window.APP_CONFIG = {
  // Target repository where Pull Requests will be opened
  REPO_OWNER: 'Daniel-Pereira-Linux',
  REPO_NAME: 'git-po',
  TARGET_BRANCH: 'master',
  PO_FILE_PATH: 'po/pt_BR.po',

  // GitHub OAuth App Client ID
  // Substitua pelo seu Client ID gerado em: https://github.com/settings/developers
  GITHUB_CLIENT_ID: 'Ov23liXXXXXXXXXXXXXX',

  // OAuth Gatekeeper URL (Proxy serverless para troca do client_secret com segurança)
  // Pode ser uma função no Cloudflare Workers, Vercel ou Coolify
  OAUTH_GATEKEEPER_URL: 'https://git-po-auth.daniel-pereira.workers.dev'
};
