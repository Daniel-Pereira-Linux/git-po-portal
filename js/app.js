/**
 * Main Application Controller for Git PO Portal with GitHub OAuth
 */
document.addEventListener('DOMContentLoaded', () => {
  const state = {
    poData: null,
    entries: [],
    filteredEntries: [],
    currentPage: 1,
    pageSize: 30,
    searchQuery: '',
    totalLines: 0,
    selectedEntryIndex: null,
    github: new GitHubClient(),
    authToken: localStorage.getItem('git_po_oauth_token') || null,
    userProfile: null
  };

  // DOM Elements
  const els = {
    loadingState: document.getElementById('loading-state'),
    appContent: document.getElementById('app-content'),
    statsTotal: document.getElementById('stats-total'),
    statsLines: document.getElementById('stats-lines'),
    searchInput: document.getElementById('search-input'),
    stringsList: document.getElementById('strings-list'),
    pagination: document.getElementById('pagination'),
    paginationInfo: document.getElementById('pagination-info'),
    // Auth UI
    btnLoginGitHub: document.getElementById('btn-login-github'),
    userProfile: document.getElementById('user-profile'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    btnLogout: document.getElementById('btn-logout'),
    // Modal elements
    editModal: document.getElementById('edit-modal'),
    modalContext: document.getElementById('modal-context'),
    modalMsgid: document.getElementById('modal-msgid'),
    modalMsgstrSingle: document.getElementById('modal-msgstr-single'),
    modalMsgstrPlural0: document.getElementById('modal-msgstr-plural0'),
    modalMsgstrPlural1: document.getElementById('modal-msgstr-plural1'),
    pluralContainer: document.getElementById('plural-container'),
    singleContainer: document.getElementById('single-container'),
    validationBox: document.getElementById('validation-box'),
    modalAuthLoggedIn: document.getElementById('modal-auth-logged-in'),
    modalAuthLoggedOut: document.getElementById('modal-auth-logged-out'),
    modalUserAvatar: document.getElementById('modal-user-avatar'),
    modalUserDisplay: document.getElementById('modal-user-display'),
    modalUserEmail: document.getElementById('modal-user-email'),
    btnModalLogin: document.getElementById('btn-modal-login'),
    btnSubmitPR: document.getElementById('btn-submit-pr'),
    btnCancelModal: document.getElementById('btn-cancel-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    // Toast
    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toast-msg')
  };

  // Initialize
  init();

  async function init() {
    setupEventListeners();
    await handleAuthInit();
    await loadPOData();
  }

  async function handleAuthInit() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      try {
        showToast('Autenticando com o GitHub...', 'info');
        const token = await state.github.handleOAuthCallback(code);
        state.authToken = token;
        localStorage.setItem('git_po_oauth_token', token);

        // Remove ?code from URL cleanly
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        console.error(err);
        showToast(`Erro na autenticação: ${err.message}`, 'error');
      }
    }

    if (state.authToken) {
      try {
        state.userProfile = await state.github.fetchUserProfile(state.authToken);
        updateAuthUI(true);
      } catch (err) {
        console.warn('Invalid or expired token, logging out:', err);
        logout();
      }
    } else {
      updateAuthUI(false);
    }
  }

  function updateAuthUI(isLoggedIn) {
    if (isLoggedIn && state.userProfile) {
      els.btnLoginGitHub.classList.add('hidden');
      els.userProfile.classList.remove('hidden');
      els.userProfile.classList.add('flex');
      els.userAvatar.src = state.userProfile.avatarUrl;
      els.userName.textContent = state.userProfile.name || state.userProfile.login;

      // Update modal auth box
      els.modalAuthLoggedOut.classList.add('hidden');
      els.modalAuthLoggedIn.classList.remove('hidden');
      els.modalUserAvatar.src = state.userProfile.avatarUrl;
      els.modalUserDisplay.textContent = `${state.userProfile.name} (@${state.userProfile.login})`;
      els.modalUserEmail.textContent = state.userProfile.email;
    } else {
      els.btnLoginGitHub.classList.remove('hidden');
      els.userProfile.classList.add('hidden');
      els.userProfile.classList.remove('flex');

      // Update modal auth box
      els.modalAuthLoggedOut.classList.remove('hidden');
      els.modalAuthLoggedIn.classList.add('hidden');
    }
  }

  function logout() {
    state.authToken = null;
    state.userProfile = null;
    localStorage.removeItem('git_po_oauth_token');
    updateAuthUI(false);
    showToast('Você saiu da sua conta.', 'info');
  }

  async function loadPOData() {
    try {
      showLoading(true);
      const rawContent = await state.github.fetchPOFile();
      state.totalLines = rawContent.split('\n').length;
      state.poData = POParser.parse(rawContent);
      
      // Index entries
      state.entries = state.poData.entries.map((entry, idx) => ({
        ...entry,
        _idx: idx
      }));

      updateStats();
      applyFilters();
      showLoading(false);
      showToast('Arquivo po/pt_BR.po carregado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showLoading(false);
      showToast(`Erro ao carregar PO: ${err.message}`, 'error');
    }
  }

  function showLoading(show) {
    if (show) {
      els.loadingState.classList.remove('hidden');
      els.appContent.classList.add('hidden');
    } else {
      els.loadingState.classList.add('hidden');
      els.appContent.classList.remove('hidden');
    }
  }

  function updateStats() {
    const total = state.entries.length;
    els.statsTotal.textContent = total.toLocaleString('pt-BR');
    els.statsLines.textContent = state.totalLines.toLocaleString('pt-BR');
  }

  function applyFilters() {
    const query = state.searchQuery.toLowerCase().trim();
    
    if (!query) {
      state.filteredEntries = state.entries;
    } else {
      state.filteredEntries = state.entries.filter(entry => {
        const inMsgid = (entry.msgid || '').toLowerCase().includes(query);
        const inMsgstr = (entry.msgstr || []).join(' ').toLowerCase().includes(query);
        const inRef = (entry.references || []).join(' ').toLowerCase().includes(query);
        const inComments = (entry.extractedComments || []).join(' ').toLowerCase().includes(query);
        return inMsgid || inMsgstr || inRef || inComments;
      });
    }

    state.currentPage = 1;
    renderList();
  }

  function renderList() {
    const total = state.filteredEntries.length;
    const start = (state.currentPage - 1) * state.pageSize;
    const end = Math.min(start + state.pageSize, total);
    const pageEntries = state.filteredEntries.slice(start, end);

    if (pageEntries.length === 0) {
      els.stringsList.innerHTML = `
        <div class="bg-gray-900 rounded-xl p-12 text-center text-gray-400 border border-gray-800">
          <svg class="w-12 h-12 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-lg font-medium text-gray-300">Nenhuma mensagem encontrada</p>
          <p class="text-sm mt-1">Tente pesquisar por outro termo ou nome de arquivo.</p>
        </div>
      `;
      els.pagination.innerHTML = '';
      els.paginationInfo.textContent = 'Mostrando 0 de 0 mensagens';
      return;
    }

    els.stringsList.innerHTML = pageEntries.map(entry => renderEntryCard(entry)).join('');
    els.paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${total.toLocaleString('pt-BR')} mensagens`;
    renderPagination(total);

    // Attach click handlers to edit buttons
    document.querySelectorAll('.btn-edit-entry').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        openEditModal(idx);
      });
    });
  }

  function renderEntryCard(entry) {
    const contextStr = entry.references.slice(0, 3).join(', ') || 'Código-fonte Git';
    const commentsStr = entry.extractedComments.join(' ') || '';

    return `
      <div class="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition duration-200 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-2 mb-3 overflow-hidden">
            <span class="text-xs font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/40 font-semibold">#${entry._idx + 1}</span>
            <span class="text-xs font-mono text-gray-400 truncate max-w-xs md:max-w-2xl" title="${contextStr}">📁 ${escapeHtml(contextStr)}</span>
          </div>

          ${commentsStr ? `<p class="text-xs text-amber-300/80 bg-amber-950/30 p-2.5 rounded-lg mb-3 border border-amber-900/30 font-sans">💡 <strong>Nota para tradutores:</strong> ${escapeHtml(commentsStr)}</p>` : ''}

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="bg-gray-950 p-4 rounded-xl border border-gray-800">
              <span class="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Original em Inglês (EN):</span>
              <p class="font-mono text-sm text-gray-200 whitespace-pre-wrap break-words">${escapeHtml(entry.msgid)}</p>
              ${entry.isPlural ? `<p class="font-mono text-xs text-gray-400 mt-2.5 border-t border-gray-800/80 pt-2"><span class="text-indigo-300 font-semibold">[Plural]:</span> ${escapeHtml(entry.msgid_plural)}</p>` : ''}
            </div>

            <div class="bg-gray-950 p-4 rounded-xl border border-gray-800">
              <span class="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Tradução Atual (PT-BR):</span>
              <p class="font-mono text-sm ${entry.msgstr[0] ? 'text-emerald-300' : 'text-gray-500 italic'} whitespace-pre-wrap break-words">${entry.msgstr[0] ? escapeHtml(entry.msgstr[0]) : '(Vazio / Sem tradução)'}</p>
              ${entry.isPlural && entry.msgstr[1] ? `<p class="font-mono text-xs text-emerald-400/80 mt-2.5 border-t border-gray-800/80 pt-2"><span class="text-indigo-300 font-semibold">[Plural]:</span> ${escapeHtml(entry.msgstr[1])}</p>` : ''}
            </div>
          </div>
        </div>

        <div class="flex justify-end pt-3 border-t border-gray-800/70">
          <button data-idx="${entry._idx}" class="btn-edit-entry inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition shadow-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            Editar / Propor Tradução
          </button>
        </div>
      </div>
    `;
  }

  function renderPagination(total) {
    const totalPages = Math.ceil(total / state.pageSize);
    if (totalPages <= 1) {
      els.pagination.innerHTML = '';
      return;
    }

    let buttons = '';
    // Previous
    buttons += `
      <button class="px-3 py-1.5 rounded-lg border border-gray-800 bg-gray-900 text-gray-300 hover:bg-gray-800 text-sm disabled:opacity-40" ${state.currentPage === 1 ? 'disabled' : ''} data-page="${state.currentPage - 1}">
        Anterior
      </button>
    `;

    // Page indicator
    buttons += `
      <span class="px-4 py-1.5 text-sm text-gray-300 font-medium">
        Página ${state.currentPage} de ${totalPages}
      </span>
    `;

    // Next
    buttons += `
      <button class="px-3 py-1.5 rounded-lg border border-gray-800 bg-gray-900 text-gray-300 hover:bg-gray-800 text-sm disabled:opacity-40" ${state.currentPage === totalPages ? 'disabled' : ''} data-page="${state.currentPage + 1}">
        Próxima
      </button>
    `;

    els.pagination.innerHTML = buttons;

    els.pagination.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page, 10);
        if (p >= 1 && p <= totalPages) {
          state.currentPage = p;
          renderList();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  function openEditModal(entryIndex) {
    state.selectedEntryIndex = entryIndex;
    const entry = state.entries[entryIndex];

    els.modalContext.textContent = entry.references.join(', ') || `Item #${entryIndex + 1}`;
    els.modalMsgid.textContent = entry.msgid;

    if (entry.isPlural) {
      els.singleContainer.classList.add('hidden');
      els.pluralContainer.classList.remove('hidden');
      els.modalMsgstrPlural0.value = entry.msgstr[0] || '';
      els.modalMsgstrPlural1.value = entry.msgstr[1] || '';
    } else {
      els.singleContainer.classList.remove('hidden');
      els.pluralContainer.classList.add('hidden');
      els.modalMsgstrSingle.value = entry.msgstr[0] || '';
    }

    updateAuthUI(!!state.userProfile);
    runLiveValidation();
    els.editModal.classList.remove('hidden');
  }

  function closeEditModal() {
    els.editModal.classList.add('hidden');
    state.selectedEntryIndex = null;
  }

  function runLiveValidation() {
    if (state.selectedEntryIndex === null) return;
    const entry = state.entries[state.selectedEntryIndex];

    let proposedMsgstr = [];
    if (entry.isPlural) {
      proposedMsgstr = [els.modalMsgstrPlural0.value, els.modalMsgstrPlural1.value];
    } else {
      proposedMsgstr = [els.modalMsgstrSingle.value];
    }

    const result = TranslationValidator.validate(entry, proposedMsgstr);

    let html = '<div class="space-y-2">';
    for (const test of result.tests) {
      let icon = '';
      let colorClass = '';

      if (test.level === 'pass') {
        icon = '✅';
        colorClass = 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40';
      } else if (test.level === 'warning') {
        icon = '⚠️';
        colorClass = 'text-amber-300 bg-amber-950/40 border-amber-800/40';
      } else {
        icon = '❌';
        colorClass = 'text-red-400 bg-red-950/40 border-red-800/40';
      }

      html += `
        <div class="flex items-start gap-2.5 p-2.5 rounded-lg border text-xs ${colorClass}">
          <span class="text-sm leading-none">${icon}</span>
          <div>
            <strong class="font-semibold block">${escapeHtml(test.name)}</strong>
            <span>${escapeHtml(test.message)}</span>
          </div>
        </div>
      `;
    }
    html += '</div>';

    els.validationBox.innerHTML = html;
    
    // Enable submit only if valid AND user is logged in
    els.btnSubmitPR.disabled = !result.isValid || !state.userProfile;
  }

  async function submitPullRequest() {
    if (state.selectedEntryIndex === null) return;
    const entry = state.entries[state.selectedEntryIndex];

    if (!state.userProfile || !state.authToken) {
      showToast('Por favor, conecte-se com o GitHub para enviar a tradução.', 'error');
      state.github.startOAuthLogin();
      return;
    }

    let proposedMsgstr = [];
    if (entry.isPlural) {
      proposedMsgstr = [els.modalMsgstrPlural0.value, els.modalMsgstrPlural1.value];
    } else {
      proposedMsgstr = [els.modalMsgstrSingle.value];
    }

    // Update entry in local memory
    const updatedEntries = state.poData.entries.map((e, idx) => {
      if (idx === state.selectedEntryIndex) {
        return {
          ...e,
          msgstr: proposedMsgstr,
          flags: (e.flags || []).filter(f => f !== 'fuzzy')
        };
      }
      return e;
    });

    // Serialize new PO file with verified OAuth author name & email in Last-Translator
    const serializedPO = POParser.serialize(
      state.poData.header,
      updatedEntries,
      state.userProfile.name,
      state.userProfile.email
    );

    try {
      els.btnSubmitPR.disabled = true;
      els.btnSubmitPR.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Criando Pull Request...
      `;

      const result = await state.github.createPullRequest({
        newPOContent: serializedPO,
        translatorName: state.userProfile.name,
        translatorEmail: state.userProfile.email,
        stringContext: entry.msgid,
        token: state.authToken
      });

      closeEditModal();
      showToast(`Pull Request #${result.prNumber} aberto com sucesso!`, 'success');

      // Update state
      entry.msgstr = proposedMsgstr;
      renderList();

      // Open PR in new tab
      window.open(result.prUrl, '_blank');
    } catch (err) {
      console.error(err);
      showToast(`Erro ao criar Pull Request: ${err.message}`, 'error');
    } finally {
      els.btnSubmitPR.disabled = false;
      els.btnSubmitPR.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        Enviar Tradução & Abrir Pull Request
      `;
    }
  }

  function showToast(msg, type = 'info') {
    els.toastMsg.textContent = msg;
    els.toast.className = `fixed bottom-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium shadow-2xl transition duration-300 border ${
      type === 'success' ? 'bg-emerald-950 text-emerald-200 border-emerald-700' :
      type === 'error' ? 'bg-red-950 text-red-200 border-red-700' :
      'bg-gray-900 text-gray-200 border-gray-700'
    }`;
    els.toast.classList.remove('hidden');

    setTimeout(() => {
      els.toast.classList.add('hidden');
    }, 5000);
  }

  function setupEventListeners() {
    // Search
    els.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      applyFilters();
    });

    // Auth events
    els.btnLoginGitHub.addEventListener('click', () => state.github.startOAuthLogin());
    els.btnModalLogin.addEventListener('click', () => state.github.startOAuthLogin());
    els.btnLogout.addEventListener('click', logout);

    // Modal close
    els.btnCancelModal.addEventListener('click', closeEditModal);
    els.btnCloseModal.addEventListener('click', closeEditModal);

    // Live validation inputs
    els.modalMsgstrSingle.addEventListener('input', runLiveValidation);
    els.modalMsgstrPlural0.addEventListener('input', runLiveValidation);
    els.modalMsgstrPlural1.addEventListener('input', runLiveValidation);

    // Submit PR
    els.btnSubmitPR.addEventListener('click', submitPullRequest);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
});
