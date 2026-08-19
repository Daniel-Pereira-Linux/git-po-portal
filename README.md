# 🌐 Git PO Translation Portal (pt_BR)

> Plataforma web moderna e colaborativa para a localização do Git em Português do Brasil (`po/pt_BR.po`), integrada diretamente ao fluxo de tradução e revisão.

---

## 🚀 Funcionalidades

- 📊 **Dashboard em Tempo Real:** Estatísticas completas com percentual de tradução, mensagens pendentes, traduzidas e fuzzy.
- 🔍 **Busca Instantânea & Filtros:** Localização rápida por texto em inglês (`msgid`), texto em português (`msgstr`), referências de código (`builtin/am.c`) ou notas de tradução.
- ✏️ **Editor Lado a Lado:** Interface intuitiva para tradução de mensagens simples e plurais (`msgid_plural`).
- 🧪 **Validador de Conformidade em Tempo Real:**
  - Checagem de integridade de placeholders (`%s`, `%d`, `%.*s`).
  - Validação de quebras de linha (`\n`), escapes e aspas.
  - Conformidade com o Glossário Oficial do Git pt_BR (`branch`, `commit`, `árvore`, `índice`, `pedaço`).
- 🤖 **Abertura Automática de Pull Requests:**
  - Atualização do cabeçalho `Last-Translator` e data no formato Gettext oficial.
  - Criação automática de branch e abertura de Pull Request no repositório de trabalho.

---

## 🛠️ Como Funciona o Fluxo

1. O colaborador acessa o portal e busca por uma mensagem não traduzida ou que precise de melhoria.
2. Edita a tradução e observa a validação em tempo real na tela.
3. Preenche Nome, E-mail e submete a tradução.
4. O portal atualiza o `po/pt_BR.po`, formata conforme as regras Gettext e abre um Pull Request no repositório `Daniel-Pereira-Linux/git-po`.
5. O mantenedor revisa e aceita a contribuição com 1 clique!

---

## 📄 Licença

Distribuído sob a licença MIT / GPLv2 compatível com o projeto Git.
