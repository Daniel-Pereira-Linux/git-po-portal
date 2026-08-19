/**
 * PO File Parser and Serializer for Git Localization Portal
 */
class POParser {
  /**
   * Parse a raw .po file content into structured JS objects
   */
  static parse(poContent) {
    const lines = poContent.replace(/\r\n/g, '\n').split('\n');
    const entries = [];
    let header = {};
    let headerRaw = '';
    
    let current = this._createEmptyEntry();
    let currentField = null;
    let isHeader = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line -> finalize current entry
      if (trimmed === '') {
        if (current.msgid !== null || current.comments.length > 0) {
          if (isHeader && current.msgid === '') {
            headerRaw = current.msgstr[0] || '';
            header = this._parseHeader(headerRaw);
            isHeader = false;
          } else {
            entries.push(current);
          }
          current = this._createEmptyEntry();
          currentField = null;
        }
        continue;
      }

      // Comments
      if (line.startsWith('#')) {
        if (line.startsWith('#.')) {
          current.extractedComments.push(line.substring(2).trim());
        } else if (line.startsWith('#:')) {
          current.references.push(line.substring(2).trim());
        } else if (line.startsWith('#,')) {
          current.flags = current.flags.concat(line.substring(2).trim().split(/,\s*/));
        } else if (line.startsWith('#|')) {
          current.previous.push(line.substring(2).trim());
        } else {
          current.comments.push(line.substring(1).trim());
        }
        continue;
      }

      // msgctxt
      if (line.startsWith('msgctxt ')) {
        currentField = 'msgctxt';
        current.msgctxt = this._unescape(this._extractQuoted(line.substring(8)));
        continue;
      }

      // msgid
      if (line.startsWith('msgid ')) {
        currentField = 'msgid';
        current.msgid = this._unescape(this._extractQuoted(line.substring(6)));
        continue;
      }

      // msgid_plural
      if (line.startsWith('msgid_plural ')) {
        currentField = 'msgid_plural';
        current.msgid_plural = this._unescape(this._extractQuoted(line.substring(13)));
        current.isPlural = true;
        continue;
      }

      // msgstr or msgstr[N]
      const msgstrPluralMatch = line.match(/^msgstr\[(\d+)\]\s+(.*)$/);
      if (msgstrPluralMatch) {
        const index = parseInt(msgstrPluralMatch[1], 10);
        currentField = `msgstr_${index}`;
        current.msgstr[index] = this._unescape(this._extractQuoted(msgstrPluralMatch[2]));
        current.isPlural = true;
        continue;
      }

      if (line.startsWith('msgstr ')) {
        currentField = 'msgstr_0';
        current.msgstr[0] = this._unescape(this._extractQuoted(line.substring(7)));
        continue;
      }

      // Continuation string
      if (line.startsWith('"') && line.endsWith('"')) {
        const strVal = this._unescape(this._extractQuoted(line));
        if (currentField === 'msgid') {
          current.msgid += strVal;
        } else if (currentField === 'msgid_plural') {
          current.msgid_plural += strVal;
        } else if (currentField === 'msgctxt') {
          current.msgctxt += strVal;
        } else if (currentField && currentField.startsWith('msgstr_')) {
          const idx = parseInt(currentField.replace('msgstr_', ''), 10);
          current.msgstr[idx] = (current.msgstr[idx] || '') + strVal;
        }
      }
    }

    // Flush last entry
    if (current.msgid !== null || current.comments.length > 0) {
      if (isHeader && current.msgid === '') {
        headerRaw = current.msgstr[0] || '';
        header = this._parseHeader(headerRaw);
      } else {
        entries.push(current);
      }
    }

    return { header, headerRaw, entries };
  }

  static _createEmptyEntry() {
    return {
      comments: [],
      extractedComments: [],
      references: [],
      flags: [],
      previous: [],
      msgctxt: null,
      msgid: null,
      msgid_plural: null,
      msgstr: [],
      isPlural: false
    };
  }

  static _extractQuoted(str) {
    str = str.trim();
    if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
      return str.slice(1, -1);
    }
    return str;
  }

  static _unescape(str) {
    return str
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }

  static _escape(str) {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\t/g, '\\t');
  }

  static _parseHeader(headerStr) {
    const headers = {};
    const lines = headerStr.split('\n');
    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const key = line.substring(0, idx).trim();
        const value = line.substring(idx + 1).trim();
        headers[key] = value;
      }
    }
    return headers;
  }

  /**
   * Serialize updated entries and header back to clean PO file string
   */
  static serialize(header, entries, translatorName = null, translatorEmail = null) {
    const output = [];

    // Format current date: YYYY-MM-DD HH:MMZZZZ
    const now = new Date();
    const tzOffset = -now.getTimezoneOffset();
    const sign = tzOffset >= 0 ? '+' : '-';
    const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');
    const tzHours = pad(tzOffset / 60);
    const tzMins = pad(tzOffset % 60);
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}${sign}${tzHours}${tzMins}`;

    // Update Header
    const updatedHeader = { ...header };
    if (translatorName && translatorEmail) {
      updatedHeader['Last-Translator'] = `${translatorName} <${translatorEmail}>`;
    }
    updatedHeader['PO-Revision-Date'] = dateStr;

    // Header block
    output.push('msgid ""');
    output.push('msgstr ""');
    for (const [key, value] of Object.entries(updatedHeader)) {
      output.push(`"${this._escape(key)}: ${this._escape(value)}\\n"`);
    }
    output.push('');

    // Entries
    for (const entry of entries) {
      // Comments
      for (const c of entry.comments) output.push(`# ${c}`);
      for (const ec of entry.extractedComments) output.push(`#. ${ec}`);
      for (const ref of entry.references) output.push(`#: ${ref}`);
      if (entry.flags && entry.flags.length > 0) {
        output.push(`#, ${entry.flags.filter(Boolean).join(', ')}`);
      }
      for (const prev of entry.previous) output.push(`#| ${prev}`);

      if (entry.msgctxt) {
        output.push(`msgctxt ${this._formatString(entry.msgctxt)}`);
      }

      output.push(`msgid ${this._formatString(entry.msgid)}`);

      if (entry.isPlural && entry.msgid_plural) {
        output.push(`msgid_plural ${this._formatString(entry.msgid_plural)}`);
        for (let i = 0; i < (entry.msgstr.length || 2); i++) {
          const val = entry.msgstr[i] || '';
          output.push(`msgstr[${i}] ${this._formatString(val)}`);
        }
      } else {
        const val = entry.msgstr[0] || '';
        output.push(`msgstr ${this._formatString(val)}`);
      }

      output.push('');
    }

    return output.join('\n');
  }

  static _formatString(str) {
    if (!str) return '""';
    if (str.includes('\n')) {
      const parts = str.split('\n');
      const lines = ['""'];
      for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        const part = parts[i];
        if (!isLast) {
          lines.push(`"${this._escape(part)}\\n"`);
        } else if (part.length > 0) {
          lines.push(`"${this._escape(part)}"`);
        }
      }
      return lines.join('\n');
    }
    return `"${this._escape(str)}"`;
  }
}

window.POParser = POParser;
