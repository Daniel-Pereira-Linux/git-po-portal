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
  GITHUB_CLIENT_ID: 'Ov23limikcxrQ6KRXDVV',

  // OAuth Gatekeeper URL (Proxy serverless para troca do client_secret com segurança)
  OAUTH_GATEKEEPER_URL: 'https://git-po-auth.daniel-pereira.workers.dev'
};
