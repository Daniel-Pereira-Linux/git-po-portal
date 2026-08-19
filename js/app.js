/**
 * Main Application Controller for Git PO Portal
 */
document.addEventListener('DOMContentLoaded', () => {
  const state = {
    poData: null,
    entries: [],
    filteredEntries: [],
    currentPage: 1,
    pageSize: 30,
    currentFilter: 'all', // all, untranslated, translated, fuzzy
    searchQuery: '',
    selectedEntryIndex: null,
    github: new GitHubClient('Daniel-Pereira-Linux', 'git-po'),
    translatorName: localStorage.getItem('git_po_author_name') || '',
    translatorEmail: localStorage.getItem('git_po_author_email') || '',
    githubToken: localStorage.getItem('git_po_token') || ''
  };

  // Helper: Detect if string is intentional CLI synopsis or technical token
  function isCliOrToken(str) {
    if (!str) return false;
    const s = str.trim();
    if (s.startsWith('git ') || s.startsWith('git-')) return true;
    if (/^<[^>]+>$/.test(s)) return true;
    if (/^[a-z0-9_\-|]+$/i.test(s) && s.length < 15) return true;
    if (/^%[a-z0-9%:.*_\-]+$/i.test(s)) return true;
    if (/^\([a-z0-9_\-|\s()]+\)$/i.test(s) && s.length < 25) return true;
    if (/^[a-z0-9_\-]+(\/[a-z0-9_\-]+)+$/i.test(s)) return true; // e.g. path/tree-ish
    return false;
  }

  // DOM Elements
  const els = {
    loadingState: document.getElementById('loading-state'),
    appContent: document.getElementById('app-content'),
    statsTotal: document.getElementById('stats-total'),
    statsTranslated: document.getElementById('stats-translated'),
    statsPending: document.getElementById('stats-pending'),
    statsPercent: document.getElementById('stats-percent'),
    progressBar: document.getElementById('progress-bar'),
    searchInput: document.getElementById('search-input'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    stringsList: document.getElementById('strings-list'),
    pagination: document.getElementById('pagination'),
    paginationInfo: document.getElementById('pagination-info'),
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
    inputAuthorName: document.getElementById('author-name'),
    inputAuthorEmail: document.getElementById('author-email'),
    inputGhToken: document.getElementById('github-token'),
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
    loadStoredCredentials();
    await loadPOData();
  }

  function loadStoredCredentials() {
    if (els.inputAuthorName) els.inputAuthorName.value = state.translatorName;
    if (els.inputAuthorEmail) els.inputAuthorEmail.value = state.translatorEmail;
    if (els.inputGhToken) els.inputGhToken.value = state.githubToken;
  }

  async function loadPOData() {
    try {
      showLoading(true);
      const rawContent = await state.github.fetchPOFile();
      state.poData = POParser.parse(rawContent);
      
      // Index entries with ID and status
      state.entries = state.poData.entries.map((entry, idx) => {
        const msgstr0 = entry.msgstr[0] || '';
        const isEmpty = !msgstr0 || msgstr0.trim() === '';
        const isIdentical = entry.msgid === msgstr0 && entry.msgid.length > 0;
        const isCliToken = isCliOrToken(entry.msgid);
        const isFuzzy = entry.flags && entry.flags.includes('fuzzy');

        let statusType = 'translated';
        if (isFuzzy) {
          statusType = 'fuzzy';
        } else if (isEmpty) {
          statusType = 'untranslated_empty';
        } else if (isIdentical && !isCliToken) {
          statusType = 'untranslated_english';
        } else if (isCliToken && isIdentical) {
          statusType = 'cli_syntax';
        }

        const isPending = statusType === 'untranslated_empty' || statusType === 'untranslated_english' || statusType === 'fuzzy';

        return {
          ...entry,
          _idx: idx,
          _statusType: statusType,
          _isPending: isPending,
          _isTranslated: !isPending
        };
      });

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
    const translated = state.entries.filter(e => e._isTranslated).length;
    const pending = state.entries.filter(e => e._isPending).length;
    const percent = total > 0 ? ((translated / total) * 100).toFixed(1) : 0;

    els.statsTotal.textContent = total.toLocaleString('pt-BR');
    els.statsTranslated.textContent = translated.toLocaleString('pt-BR');
    els.statsPending.textContent = pending.toLocaleString('pt-BR');
    els.statsPercent.textContent = `${percent}%`;
    els.progressBar.style.width = `${percent}%`;
  }

  function applyFilters() {
    const query = state.searchQuery.toLowerCase().trim();
    
    state.filteredEntries = state.entries.filter(entry => {
      // Filter status
      if (state.currentFilter === 'untranslated' && !entry._isPending) return false;
      if (state.currentFilter === 'fuzzy' && entry._statusType !== 'fuzzy') return false;
      if (state.currentFilter === 'translated' && !entry._isTranslated) return false;

      // Search query
      if (query) {
        const inMsgid = (entry.msgid || '').toLowerCase().includes(query);
        const inMsgstr = (entry.msgstr || []).join(' ').toLowerCase().includes(query);
        const inRef = (entry.references || []).join(' ').toLowerCase().includes(query);
        const inComments = (entry.extractedComments || []).join(' ').toLowerCase().includes(query);
        return inMsgid || inMsgstr || inRef || inComments;
      }

      return true;
    });

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
        <div class="bg-gray-800 rounded-xl p-12 text-center text-gray-400 border border-gray-700">
          <svg class="w-12 h-12 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-lg font-medium text-gray-300">Nenhuma mensagem encontrada</p>
          <p class="text-sm mt-1">Tente ajustar a busca ou os filtros aplicados.</p>
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
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.idx, 10);
        openEditModal(idx);
      });
    });
  }

  function renderEntryCard(entry) {
    let statusBadge = '';
    if (entry._statusType === 'fuzzy') {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-900/60 text-yellow-300 border border-yellow-700/50">🔄 Fuzzy (Incerteza)</span>';
    } else if (entry._statusType === 'untranslated_empty') {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-900/60 text-red-300 border border-red-700/50">⚠️ Não Traduzido (Vazio)</span>';
    } else if (entry._statusType === 'untranslated_english') {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-900/60 text-amber-300 border border-amber-700/50">⚠️ Texto em Inglês</span>';
    } else if (entry._statusType === 'cli_syntax') {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/50">⚙️ Sintaxe / Comando CLI</span>';
    } else {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">✅ Traduzido</span>';
    }

    const contextStr = entry.references.slice(0, 3).join(', ') || 'Código-fonte Git';
    const commentsStr = entry.extractedComments.join(' ') || '';

    return `
      <div class="bg-gray-800/90 rounded-xl p-5 border border-gray-700 hover:border-indigo-500/50 transition duration-200 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2 overflow-hidden">
              <span class="text-xs font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/40">#${entry._idx + 1}</span>
              <span class="text-xs font-mono text-gray-400 truncate max-w-xs md:max-w-md" title="${contextStr}">📁 ${escapeHtml(contextStr)}</span>
            </div>
            ${statusBadge}
          </div>

          ${commentsStr ? `<p class="text-xs text-amber-300/80 bg-amber-950/30 p-2 rounded mb-3 border border-amber-900/30 font-sans">💡 <strong>Nota:</strong> ${escapeHtml(commentsStr)}</p>` : ''}

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="bg-gray-900/80 p-3.5 rounded-lg border border-gray-700/60">
              <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Original (EN):</span>
              <p class="font-mono text-sm text-gray-200 whitespace-pre-wrap break-words">${escapeHtml(entry.msgid)}</p>
              ${entry.isPlural ? `<p class="font-mono text-xs text-gray-400 mt-2 border-t border-gray-800 pt-2"><span class="text-indigo-300 font-semibold">[Plural]:</span> ${escapeHtml(entry.msgid_plural)}</p>` : ''}
            </div>

            <div class="bg-gray-900/80 p-3.5 rounded-lg border border-gray-700/60">
              <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Tradução Atual (PT-BR):</span>
              <p class="font-mono text-sm ${entry.msgstr[0] ? 'text-emerald-300' : 'text-gray-500 italic'} whitespace-pre-wrap break-words">${entry.msgstr[0] ? escapeHtml(entry.msgstr[0]) : '(Sem tradução)'}</p>
              ${entry.isPlural && entry.msgstr[1] ? `<p class="font-mono text-xs text-emerald-400/80 mt-2 border-t border-gray-800 pt-2"><span class="text-indigo-300 font-semibold">[Plural]:</span> ${escapeHtml(entry.msgstr[1])}</p>` : ''}
            </div>
          </div>
        </div>

        <div class="flex justify-end pt-2 border-t border-gray-700/50">
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
      <button class="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm disabled:opacity-40" ${state.currentPage === 1 ? 'disabled' : ''} data-page="${state.currentPage - 1}">
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
      <button class="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm disabled:opacity-40" ${state.currentPage === totalPages ? 'disabled' : ''} data-page="${state.currentPage + 1}">
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
    els.btnSubmitPR.disabled = !result.isValid;
  }

  async function submitPullRequest() {
    if (state.selectedEntryIndex === null) return;
    const entry = state.entries[state.selectedEntryIndex];

    const name = els.inputAuthorName.value.trim();
    const email = els.inputAuthorEmail.value.trim();
    const token = els.inputGhToken.value.trim();

    if (!name || !email) {
      showToast('Por favor, informe seu Nome e E-mail para assinar a tradução.', 'error');
      return;
    }

    if (!token) {
      showToast('Por favor, informe seu GitHub Personal Access Token para abrir o Pull Request.', 'error');
      return;
    }

    // Save credentials to localStorage
    localStorage.setItem('git_po_author_name', name);
    localStorage.setItem('git_po_author_email', email);
    localStorage.setItem('git_po_token', token);

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
          flags: (e.flags || []).filter(f => f !== 'fuzzy') // clear fuzzy
        };
      }
      return e;
    });

    // Serialize new PO file with updated Last-Translator
    const serializedPO = POParser.serialize(state.poData.header, updatedEntries, name, email);

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
        translatorName: name,
        translatorEmail: email,
        stringContext: entry.msgid,
        token: token
      });

      closeEditModal();
      showToast(`Pull Request #${result.prNumber} aberto com sucesso!`, 'success');

      // Update state
      entry.msgstr = proposedMsgstr;
      entry._statusType = 'translated';
      entry._isPending = false;
      entry._isTranslated = true;
      updateStats();
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

    // Filter tabs
    els.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        els.filterTabs.forEach(t => t.classList.remove('active', 'bg-indigo-600', 'text-white'));
        tab.classList.add('active', 'bg-indigo-600', 'text-white');
        state.currentFilter = tab.dataset.filter;
        applyFilters();
      });
    });

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
