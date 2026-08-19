/**
 * GitHub API & OAuth Client for Git PO Portal
 */
class GitHubClient {
  constructor() {
    const config = window.APP_CONFIG || {};
    this.owner = config.REPO_OWNER || 'Daniel-Pereira-Linux';
    this.repo = config.REPO_NAME || 'git-po';
    this.branch = config.TARGET_BRANCH || 'master';
    this.filePath = config.PO_FILE_PATH || 'po/pt_BR.po';
    this.clientId = config.GITHUB_CLIENT_ID || '';
    this.gatekeeperUrl = config.OAUTH_GATEKEEPER_URL || '';
  }

  /**
   * Start GitHub OAuth Authorization Flow
   */
  startOAuthLogin() {
    const redirectUri = window.location.origin + window.location.pathname;
    const scope = 'public_repo,user:email';
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
  }

  /**
   * Handle OAuth redirect with authorization code
   */
  async handleOAuthCallback(code) {
    if (!this.gatekeeperUrl) {
      throw new Error('URL do Gatekeeper OAuth não configurada.');
    }

    const response = await fetch(`${this.gatekeeperUrl}?code=${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Falha na autenticação OAuth: ${err.error || response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Erro retornado pelo GitHub: ${data.error_description || data.error}`);
    }

    return data.access_token;
  }

  /**
   * Fetch authenticated user's profile and primary email
   */
  async fetchUserProfile(token) {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    };

    const userRes = await fetch('https://api.github.com/user', { headers });
    if (!userRes.ok) {
      throw new Error('Não foi possível obter os dados do perfil do usuário.');
    }
    const userData = await userRes.json();

    // Fetch email if not public in profile
    let email = userData.email;
    if (!email) {
      try {
        const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
        if (emailsRes.ok) {
          const emails = await emailsRes.json();
          const primary = emails.find(e => e.primary) || emails[0];
          if (primary) email = primary.email;
        }
      } catch (e) {
        console.warn('Could not fetch emails:', e);
      }
    }

    return {
      login: userData.login,
      name: userData.name || userData.login,
      email: email || `${userData.login}@users.noreply.github.com`,
      avatarUrl: userData.avatar_url,
      htmlUrl: userData.html_url
    };
  }

  /**
   * Fetch the latest po/pt_BR.po file content
   */
  async fetchPOFile() {
    const rawUrl = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${this.filePath}?t=${Date.now()}`;
    try {
      const response = await fetch(rawUrl);
      if (response.ok) {
        return await response.text();
      }
    } catch (e) {
      console.warn('Could not fetch from raw URL, falling back to API:', e);
    }

    // Fallback to GitHub API
    const apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.filePath}?ref=${this.branch}`;
    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) {
      throw new Error(`Erro ao buscar arquivo do GitHub (${apiRes.status}): ${apiRes.statusText}`);
    }
    const data = await apiRes.json();
    return decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
  }

  /**
   * Submit translation proposal by creating a branch and opening a Pull Request
   */
  async createPullRequest({ newPOContent, translatorName, translatorEmail, stringContext, token }) {
    if (!token) {
      throw new Error('Usuário precisa estar autenticado com o GitHub para criar o Pull Request.');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    // 1. Get latest commit SHA on target branch (master)
    const refRes = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/git/ref/heads/${this.branch}`, { headers });
    if (!refRes.ok) {
      const err = await refRes.json();
      throw new Error(`Erro ao consultar branch ${this.branch}: ${err.message || refRes.statusText}`);
    }
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Create a new branch
    const cleanName = translatorName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const newBranchName = `l10n-update-${cleanName}-${Date.now().toString().slice(-6)}`;

    const createBranchRes = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ref: `refs/heads/${newBranchName}`,
        sha: latestCommitSha
      })
    });
    if (!createBranchRes.ok) {
      const err = await createBranchRes.json();
      throw new Error(`Erro ao criar branch: ${err.message || createBranchRes.statusText}`);
    }

    // 3. Get existing file SHA on the new branch
    const fileRes = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.filePath}?ref=${newBranchName}`, { headers });
    if (!fileRes.ok) {
      throw new Error(`Erro ao obter informações do arquivo para commit`);
    }
    const fileData = await fileRes.json();
    const fileSha = fileData.sha;

    // 4. Commit updated file
    const utf8Bytes = new TextEncoder().encode(newPOContent);
    let binary = '';
    for (let i = 0; i < utf8Bytes.byteLength; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Content = btoa(binary);

    const commitMessage = `l10n: pt_BR: update translation for '${stringContext.slice(0, 40)}'\n\nUpdated by: ${translatorName} <${translatorEmail}>\nSigned-off-by: ${translatorName} <${translatorEmail}>`;

    const updateFileRes = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.filePath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: commitMessage,
        content: base64Content,
        sha: fileSha,
        branch: newBranchName,
        committer: {
          name: translatorName,
          email: translatorEmail
        },
        author: {
          name: translatorName,
          email: translatorEmail
        }
      })
    });

    if (!updateFileRes.ok) {
      const err = await updateFileRes.json();
      throw new Error(`Erro ao fazer commit: ${err.message || updateFileRes.statusText}`);
    }

    // 5. Open Pull Request on Daniel-Pereira-Linux/git-po:master
    const prBody = `### 🌐 Proposta de Tradução - Git pt_BR Portal

**Colaborador:** ${translatorName} (\`${translatorEmail}\`)
**Contexto:** \`${stringContext}\`

---

### 🧪 Status de Conformidade
- [x] Placeholders preservados
- [x] Cabeçalho \`Last-Translator\` atualizado
- [x] Formatação Gettext aplicada
- [x] Termos do glossário verificados

*Pull Request autenticado e gerado via **GitHub OAuth** pelo portal de tradução.*`;

    const prRes = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/pulls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `l10n: pt_BR: update translation by ${translatorName}`,
        body: prBody,
        head: newBranchName,
        base: this.branch
      })
    });

    if (!prRes.ok) {
      const err = await prRes.json();
      throw new Error(`Erro ao abrir Pull Request: ${err.message || prRes.statusText}`);
    }

    const prData = await prRes.json();
    return {
      success: true,
      prUrl: prData.html_url,
      prNumber: prData.number,
      branchName: newBranchName
    };
  }
}

window.GitHubClient = GitHubClient;
