// render.js — syntax highlight, wrap visual y dibujo de pantalla
"use strict";

const state = require("./state");
const T = require("./terminal");

// ─── Estado multilínea de bold/italic ────────────────────────────────────────
// Para cada línea calcula si empieza "dentro" de un bloque ** o * abierto
// en una línea anterior. Se recalcula en cada render sobre todas las líneas.
const computeSpanStates = (lines) => {
  const states = []; // states[i] = { boldOpen, italicOpen } al inicio de la línea i
  let boldOpen = false;
  let italicOpen = false;

  for (let i = 0; i < lines.length; i++) {
    states.push({ boldOpen, italicOpen });
    const ln = lines[i];

    // Contar ** en la línea para saber si el estado cambia
    let j = 0;
    while (j < ln.length) {
      if (ln[j] === "*" && ln[j + 1] === "*") {
        boldOpen = !boldOpen;
        j += 2;
      } else if (ln[j] === "*") {
        italicOpen = !italicOpen;
        j++;
      } else {
        j++;
      }
    }
  }
  return states;
};

// ─── Highlight ────────────────────────────────────────────────────────────────
const syntaxHighlightChunk = (
  lineText,
  chunk,
  charOffset,
  rowNum,
  isCurrentLine,
  spanState,
) => {
  const fullLen = lineText.length;
  const chunkLen = chunk.length;
  const cfg = state.cfg;
  const styles = new Array(fullLen).fill("");

  // Headings
  let headingPrefixLen = 0;
  if (/^# /.test(lineText)) {
    for (let i = 0; i < fullLen; i++) styles[i] = T.getH1Style(cfg);
    headingPrefixLen = 2;
  } else if (/^## /.test(lineText)) {
    for (let i = 0; i < fullLen; i++) styles[i] = T.getH2Style(cfg);
    headingPrefixLen = 3;
  } else if (/^### /.test(lineText)) {
    for (let i = 0; i < fullLen; i++) styles[i] = T.getH3Style(cfg);
    headingPrefixLen = 4;
  }

  // Bullet
  const listM = lineText.match(/^(\s*)([-*+])(\s)/);
  if (listM) styles[listM[1].length] = T.green;

  const markerChars = new Set();
  const bs = T.getBoldStyle(cfg);
  const is = T.getItalicStyle(cfg);

  // Si la línea empieza dentro de un bloque bold abierto, aplicar desde el inicio
  if (spanState && spanState.boldOpen) {
    const closeIdx = lineText.indexOf("**");
    if (closeIdx === -1) {
      // Toda la línea está en bold
      for (let i = 0; i < fullLen; i++) styles[i] = bs;
    } else {
      // Bold hasta el cierre
      for (let i = 0; i < closeIdx; i++) styles[i] = bs;
      styles[closeIdx] = bs;
      markerChars.add(closeIdx);
      styles[closeIdx + 1] = bs;
      markerChars.add(closeIdx + 1);
    }
  }

  // Bold inline normal **...**
  const boldRe = /\*\*(.*?)\*\*/g;
  let m;
  while ((m = boldRe.exec(lineText)) !== null) {
    for (let i = m.index; i < m.index + 2; i++) {
      styles[i] = bs;
      markerChars.add(i);
    }
    for (let i = m.index + 2; i < m.index + m[0].length - 2; i++)
      styles[i] = bs;
    for (let i = m.index + m[0].length - 2; i < m.index + m[0].length; i++) {
      styles[i] = bs;
      markerChars.add(i);
    }
  }

  // Si la línea termina con ** sin cerrar, marcar desde el último ** hasta el final
  const lastOpen = lineText.lastIndexOf("**");
  const countStars = (lineText.match(/\*\*/g) || []).length;
  if (countStars % 2 !== 0 && lastOpen !== -1) {
    markerChars.add(lastOpen);
    markerChars.add(lastOpen + 1);
    for (let i = lastOpen + 2; i < fullLen; i++) styles[i] = bs;
  }

  // Italic
  const italicRe = /(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g;
  while ((m = italicRe.exec(lineText)) !== null) {
    styles[m.index] = is;
    markerChars.add(m.index);
    for (let i = m.index + 1; i < m.index + m[0].length - 1; i++)
      styles[i] = is;
    styles[m.index + m[0].length - 1] = is;
    markerChars.add(m.index + m[0].length - 1);
  }

  // Code / Link
  const codeRe = /`([^`]+)`/g;
  const linkRe = /\[([^\]]+)\]\([^)]+\)/g;
  while ((m = codeRe.exec(lineText)) !== null)
    for (let i = m.index; i < m.index + m[0].length; i++) styles[i] = T.yellow;
  while ((m = linkRe.exec(lineText)) !== null)
    for (let i = m.index; i < m.index + m[0].length; i++) styles[i] = T.blue;

  // Search highlight
  if (state.searchQuery && !state.searchMode) {
    const hl = T.getSearchHL(cfg);
    const q = state.searchQuery.toLowerCase();
    const ln = lineText.toLowerCase();
    let idx = 0;
    while ((idx = ln.indexOf(q, idx)) !== -1) {
      for (let i = idx; i < idx + q.length; i++) styles[i] = hl;
      idx++;
    }
  }

  // Focus mode
  const faded = T.gray(cfg.fadeGray);
  if (!state.selectionStart || !state.selectionEnd) {
    if (!isCurrentLine) {
      for (let i = 0; i < fullLen; i++) styles[i] = faded + (styles[i] || "");
    } else {
      const word = getWordBoundaries(lineText, state.cursorCol);
      for (let i = 0; i < fullLen; i++) {
        if (!word || i < word.start || i >= word.end)
          styles[i] = faded + (styles[i] || "");
      }
    }
  }

  // Selección
  if (state.selectionStart && state.selectionEnd) {
    for (let i = 0; i < fullLen; i++) {
      if (isSelected(rowNum, i)) styles[i] = T.inverse;
    }
  }

  // Construir string del chunk
  let result = "",
    lastStyle = "";
  for (let i = charOffset; i < charOffset + chunkLen; i++) {
    // Ocultar prefijo # de headings fuera de línea activa
    if (!isCurrentLine && headingPrefixLen && i < headingPrefixLen) continue;
    // Ocultar marcadores ** y * fuera de línea activa
    if (!isCurrentLine && markerChars.has(i)) continue;
    const s = styles[i] || "";
    if (s !== lastStyle) {
      result += T.reset + s;
      lastStyle = s;
    }
    result += lineText[i];
  }
  return result + T.reset;
};

// ─── Selección helpers ────────────────────────────────────────────────────────
const normalizeSelection = () => {
  const { selectionStart: a, selectionEnd: b } = state;
  if (!a || !b) return null;
  const before = a.line < b.line || (a.line === b.line && a.col <= b.col);
  return before ? { start: a, end: b } : { start: b, end: a };
};

const isSelected = (row, col) => {
  const s = normalizeSelection();
  if (!s) return false;
  if (row < s.start.line || row > s.end.line) return false;
  if (s.start.line === s.end.line) return col >= s.start.col && col < s.end.col;
  if (row === s.start.line) return col >= s.start.col;
  if (row === s.end.line) return col < s.end.col;
  return true;
};

// ─── Palabras ────────────────────────────────────────────────────────────────
const getWordBoundaries = (lineText, col) => {
  let s = col,
    e = col;
  if (/\w/.test(lineText[col])) {
    while (s > 0 && /\w/.test(lineText[s - 1])) s--;
    while (e < lineText.length && /\w/.test(lineText[e])) e++;
  } else if (col > 0 && /\w/.test(lineText[col - 1])) {
    e = col;
    s = col - 1;
    while (s > 0 && /\w/.test(lineText[s - 1])) s--;
  }
  return s < e ? { start: s, end: e } : null;
};

// ─── Wrap visual ─────────────────────────────────────────────────────────────
const buildScreenRows = (contentWidth) => {
  const rows = [];
  for (let i = 0; i < state.lines.length; i++) {
    const ln = state.lines[i];
    if (ln.length === 0) {
      rows.push({ lineIdx: i, charOffset: 0 });
    } else {
      for (let off = 0; off < ln.length; off += contentWidth) {
        rows.push({ lineIdx: i, charOffset: off });
      }
    }
  }
  return rows;
};

const cursorScreenRow = (screenRows) => {
  for (let r = screenRows.length - 1; r >= 0; r--) {
    const sr = screenRows[r];
    if (sr.lineIdx === state.cursorLine && sr.charOffset <= state.cursorCol)
      return r;
  }
  return 0;
};

// ─── Help ────────────────────────────────────────────────────────────────────
const HELP_LINES = [
  "",
  "  Navegación",
  "  ──────────────────────────────────────────",
  "  ↑ ↓ ← →              Mover cursor",
  "  Ctrl+← / Ctrl+→      Saltar palabra",
  "  Home / End            Inicio / fin de línea",
  "  PgUp / PgDn          Saltar pantalla",
  "  Ctrl+G                Ir a línea",
  "",
  "  Selección",
  "  ──────────────────────────────────────────",
  "  Shift+← →            Seleccionar carácter",
  "  Shift+↑ ↓            Seleccionar línea",
  "  Shift+Home / End      Seleccionar a inicio/fin",
  "  Ctrl+A                Seleccionar todo",
  "",
  "  Edición",
  "  ──────────────────────────────────────────",
  "  Ctrl+Z                Deshacer",
  "  Ctrl+Y                Rehacer",
  "  Ctrl+B                Negrita  **texto**",
  "  Ctrl+O                Cursiva  *texto*",
  "  Ctrl+D                Duplicar línea",
  "  Ctrl+K                Borrar línea",
  "  Alt+↑ / Alt+↓        Mover línea",
  "  Tab / Shift+Tab       Indentar / desindentar",
  "",
  "  Archivo",
  "  ──────────────────────────────────────────",
  "  Ctrl+S                Guardar",
  "  Ctrl+F                Buscar",
  "  Ctrl+H                Cerrar ayuda",
  "  Ctrl+Q                Salir",
  "",
];

// ─── Render principal ─────────────────────────────────────────────────────────
const render = () => {
  T.clear();

  const cfg = state.cfg;
  const contentWidth = Math.min(
    cfg.wrapColumn > 0 ? cfg.wrapColumn : 80,
    T.SCREEN_WIDTH - T.MARGIN * 2,
  );
  const offsetX = Math.floor((T.SCREEN_WIDTH - contentWidth) / 2);
  const pad = " ".repeat(offsetX);

  if (state.helpMode) {
    for (let row = 0; row < T.SCREEN_HEIGHT; row++) {
      T.setCursor(row, 0);
      T.out(T.gray(244) + (HELP_LINES[row] || "") + T.reset);
      T.clearLine();
    }
    T.setCursor(T.SCREEN_HEIGHT, 0);
    T.out(
      T.bold +
        T.gray(255) +
        "ayuda" +
        T.reset +
        T.gray(244) +
        "  Ctrl+H cerrar" +
        T.reset,
    );
    T.clearLine();
    return;
  }

  const screenRows = buildScreenRows(contentWidth);
  const curSR = cursorScreenRow(screenRows);
  const spanStates = computeSpanStates(state.lines);

  // Ajustar scroll
  if (curSR < state.scrollTop) state.scrollTop = curSR;
  if (curSR >= state.scrollTop + T.SCREEN_HEIGHT)
    state.scrollTop = curSR - T.SCREEN_HEIGHT + 1;
  if (state.scrollTop < 0) state.scrollTop = 0;

  for (let row = 0; row < T.SCREEN_HEIGHT; row++) {
    T.setCursor(row, 0);
    const srIdx = row + state.scrollTop;
    if (srIdx >= screenRows.length) {
      T.clearLine();
      continue;
    }

    const { lineIdx, charOffset } = screenRows[srIdx];
    const lineText = state.lines[lineIdx];
    const chunk = lineText.slice(charOffset, charOffset + contentWidth);
    const isCurrentLine = lineIdx === state.cursorLine;

    T.out(
      pad +
        syntaxHighlightChunk(
          lineText,
          chunk,
          charOffset,
          lineIdx,
          isCurrentLine,
          spanStates[lineIdx],
        ),
    );
    T.clearLine();
  }

  // Status bar — con el mismo offsetX que el contenido
  T.setCursor(T.SCREEN_HEIGHT, 0);
  if (state.searchMode) {
    T.out(
      pad +
        T.bold +
        T.cyan +
        `/ ${state.searchQuery}` +
        T.reset +
        (state.searchMatches.length
          ? T.gray(244) +
            `  ${state.searchIdx + 1}/${state.searchMatches.length}  ↵ siguiente  ↑ anterior  Esc salir` +
            T.reset
          : T.gray(244) + "  sin resultados" + T.reset),
    );
  } else if (state.gotoMode) {
    T.out(
      pad +
        T.bold +
        T.cyan +
        `: ${state.gotoInput}` +
        T.reset +
        T.gray(244) +
        "  Ir a línea — Esc cancelar" +
        T.reset,
    );
  } else {
    const words = state.lines.join(" ").split(/\s+/).filter(Boolean).length;
    const left =
      T.bold +
      T.gray(255) +
      `${state.cursorLine + 1}:${state.cursorCol + 1}` +
      T.reset +
      T.gray(244) +
      `  ${state.lines.length}L  ${words}W` +
      T.reset;
    const leftLen =
      `${state.cursorLine + 1}:${state.cursorCol + 1}  ${state.lines.length}L  ${words}W`
        .length;

    if (state.isSaving) {
      const saving = `${T.spinnerFrames[state.spinnerIndex]} guardando...`;
      state.spinnerIndex = (state.spinnerIndex + 1) % T.spinnerFrames.length;
      const rightSpace = Math.max(
        1,
        T.SCREEN_WIDTH - offsetX - leftLen - saving.length,
      );
      T.out(
        pad + left + " ".repeat(rightSpace) + T.gray(244) + saving + T.reset,
      );
    } else {
      T.out(pad + left);
    }
  }
  T.clearLine();

  // Cursor
  const cursorChunkCol = state.cursorCol % contentWidth;
  T.setCursor(curSR - state.scrollTop, offsetX + cursorChunkCol);
  T.out(state.cursorBlink ? T.cyan + "│" + T.reset : " ");
};

// Blink tick — llamado desde el intervalo en index.js
const blinkTick = () => {
  if (state.isSaving || state.helpMode) {
    render();
    return;
  }
  state.cursorBlink = !state.cursorBlink;
  const cfg = state.cfg;
  const contentWidth = Math.min(
    cfg.wrapColumn > 0 ? cfg.wrapColumn : 80,
    T.SCREEN_WIDTH - T.MARGIN * 2,
  );
  const offsetX = Math.floor((T.SCREEN_WIDTH - contentWidth) / 2);
  const screenRows = buildScreenRows(contentWidth);
  const curSR = cursorScreenRow(screenRows);
  T.setCursor(
    curSR - state.scrollTop,
    offsetX + (state.cursorCol % contentWidth),
  );
  T.out(state.cursorBlink ? T.cyan + "│" + T.reset : " ");
};

module.exports = {
  render,
  blinkTick,
  buildScreenRows,
  cursorScreenRow,
  getWordBoundaries,
  normalizeSelection,
  isSelected,
  computeSpanStates,
};
