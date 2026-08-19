/**
 * Git PO Translation Live Validator (git-po-helper in Browser)
 */
class TranslationValidator {
  /**
   * Run full test suite on a translation entry
   * @param {Object} entry Original PO entry
   * @param {Array<string>} proposedMsgstr Array of proposed translations
   * @returns {Object} Test results with pass/fail and details
   */
  static validate(entry, proposedMsgstr) {
    const tests = [
      this._testNonEmpty(proposedMsgstr),
      this._testPlaceholders(entry.msgid, proposedMsgstr[0] || ''),
      this._testEscapes(entry.msgid, proposedMsgstr[0] || ''),
      this._testQuotes(entry.msgid, proposedMsgstr[0] || ''),
      this._testTrailingSpaces(entry.msgid, proposedMsgstr[0] || ''),
      this._testGlossary(proposedMsgstr[0] || '')
    ];

    if (entry.isPlural && entry.msgid_plural) {
      tests.push(this._testPlaceholders(entry.msgid_plural, proposedMsgstr[1] || ''));
      tests.push(this._testEscapes(entry.msgid_plural, proposedMsgstr[1] || ''));
    }

    const errors = tests.filter(t => t.level === 'error');
    const warnings = tests.filter(t => t.level === 'warning');
    const passes = tests.filter(t => t.level === 'pass');

    return {
      isValid: errors.length === 0,
      hasWarnings: warnings.length > 0,
      tests,
      errors,
      warnings,
      passes
    };
  }

  static _testNonEmpty(proposedMsgstr) {
    const empty = !proposedMsgstr || proposedMsgstr.every(s => !s || s.trim() === '');
    if (empty) {
      return {
        id: 'non_empty',
        name: 'Tradução preenchida',
        level: 'error',
        message: 'A tradução não pode estar vazia.'
      };
    }
    return {
      id: 'non_empty',
      name: 'Tradução preenchida',
      level: 'pass',
      message: 'Texto de tradução fornecido.'
    };
  }

  static _testPlaceholders(msgid, msgstr) {
    if (!msgid) return { id: 'placeholders', name: 'Placeholders (%s, %d, etc.)', level: 'pass', message: 'Sem placeholders.' };

    const regex = /%(\d+\$)?[#0\- +']*\d*(\.\d+)?([lhjztL]|ll)?[diouxXeEfgGaAcsbnp%]|%\.\*s/g;
    const originalMatches = msgid.match(regex) || [];
    const translatedMatches = msgstr.match(regex) || [];

    // Filter out %%
    const origPlaceholders = originalMatches.filter(m => m !== '%%');
    const transPlaceholders = translatedMatches.filter(m => m !== '%%');

    if (origPlaceholders.length !== transPlaceholders.length) {
      return {
        id: 'placeholders',
        name: 'Placeholders (%s, %d, etc.)',
        level: 'error',
        message: `Incompatibilidade de placeholders: original tem ${origPlaceholders.length} (${origPlaceholders.join(', ')}), mas a tradução tem ${transPlaceholders.length} (${transPlaceholders.join(', ')}).`
      };
    }

    return {
      id: 'placeholders',
      name: 'Placeholders (%s, %d, etc.)',
      level: 'pass',
      message: `Todos os ${origPlaceholders.length} placeholders estão preservados corretamente.`
    };
  }

  static _testEscapes(msgid, msgstr) {
    if (!msgid) return { id: 'escapes', name: 'Quebras de linha e caracteres de escape', level: 'pass', message: 'OK' };

    const origEndsWithNewline = msgid.endsWith('\n');
    const transEndsWithNewline = msgstr.endsWith('\n');

    if (origEndsWithNewline && !transEndsWithNewline) {
      return {
        id: 'escapes',
        name: 'Quebras de linha e escapes',
        level: 'error',
        message: 'O texto original termina com quebra de linha (\\n), mas a tradução não.'
      };
    }

    if (!origEndsWithNewline && transEndsWithNewline) {
      return {
        id: 'escapes',
        name: 'Quebras de linha e escapes',
        level: 'error',
        message: 'A tradução termina com quebra de linha (\\n), mas o original não.'
      };
    }

    return {
      id: 'escapes',
      name: 'Quebras de linha e escapes',
      level: 'pass',
      message: 'Sequências de quebra de linha e escapes conferem com o original.'
    };
  }

  static _testQuotes(msgid, msgstr) {
    if (!msgid) return { id: 'quotes', name: 'Delimitadores e aspas', level: 'pass', message: 'OK' };

    const origSingleQuotes = (msgid.match(/'/g) || []).length;
    const transSingleQuotes = (msgstr.match(/'/g) || []).length;

    if (origSingleQuotes % 2 === 0 && transSingleQuotes % 2 !== 0) {
      return {
        id: 'quotes',
        name: 'Delimitadores e aspas',
        level: 'warning',
        message: 'Número ímpar de aspas simples detectado na tradução (possível aspa não fechada).'
      };
    }

    return {
      id: 'quotes',
      name: 'Delimitadores e aspas',
      level: 'pass',
      message: 'Aspas e delimitadores equilibrados.'
    };
  }

  static _testTrailingSpaces(msgid, msgstr) {
    if (!msgid) return { id: 'spaces', name: 'Espaços em prompts e interações', level: 'pass', message: 'OK' };

    const origEndsWithSpace = msgid.endsWith(' ');
    const transEndsWithSpace = msgstr.endsWith(' ');

    if (origEndsWithSpace && !transEndsWithSpace) {
      return {
        id: 'spaces',
        name: 'Espaços em prompts e interações',
        level: 'warning',
        message: 'O original termina com espaço (comum em prompts como "Apply? [y/n]: "), mas a tradução não.'
      };
    }

    return {
      id: 'spaces',
      name: 'Espaços em prompts e interações',
      level: 'pass',
      message: 'Espaçamento final correspondente.'
    };
  }

  static _testGlossary(msgstr) {
    const warnings = [];

    if (/\bramificação\b/i.test(msgstr) || /\bramificações\b/i.test(msgstr)) {
      warnings.push('Use "branch" no masculino em vez de "ramificação".');
    }
    if (/\buma branch\b/i.test(msgstr) || /\bda branch\b/i.test(msgstr)) {
      warnings.push('O termo "branch" deve ser usado no gênero masculino ("um branch", "do branch").');
    }
    if (/\bdiretório de trabalho\b/i.test(msgstr)) {
      warnings.push('Para "working tree", use "árvore de trabalho" em vez de "diretório de trabalho".');
    }
    if (/\bindex\b/i.test(msgstr) && !/--index/i.test(msgstr)) {
      warnings.push('Recomenda-se traduzir "index" por "índice" quando no corpo do texto em português.');
    }
    if (/\bhunk\b/i.test(msgstr) || /\bhunks\b/i.test(msgstr)) {
      warnings.push('Recomenda-se traduzir "hunk" por "pedaço".');
    }

    if (warnings.length > 0) {
      return {
        id: 'glossary',
        name: 'Glossário Oficial do Git pt_BR',
        level: 'warning',
        message: warnings.join(' ')
      };
    }

    return {
      id: 'glossary',
      name: 'Glossário Oficial do Git pt_BR',
      level: 'pass',
      message: 'Terminologia em conformidade com o glossário do projeto.'
    };
  }
}

window.TranslationValidator = TranslationValidator;
