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

// ─── Screenplay highlight ─────────────────────────────────────────────────────
const screenplayHighlight = (lineText, chunk, charOffset, rowNum, isCurrentLine) => {
  const cfg     = state.cfg;
  const fullLen = lineText.length;
  const chunkLen = chunk.length;
  const styles  = new Array(fullLen).fill("");
  const indent  = lineText.match(/^ */)[0].length;
  const trimmed = lineText.trimStart();

  let base = T.gray(248);   // action por defecto
  let baseIndent = base;    // estilo de los espacios iniciales (sin underline)

  if (/^(INT\.|EXT\.|INT\/EXT|I\/E)/i.test(trimmed)) {
    base        = T.bold + T.underline + T.gray(255);
    baseIndent  = T.bold + T.gray(255);
  } else if (/^(CUT TO:|FADE OUT|FADE IN|DISSOLVE TO|SMASH CUT|MATCH CUT)/i.test(trimmed)) {
    base = baseIndent = T.gray(241);
  } else if (indent >= 20 && trimmed === trimmed.toUpperCase() && trimmed.length > 0) {
    const cc    = T.gray(cfg.characterColor ?? 51);
    base        = T.bold + T.underline + cc;
    baseIndent  = T.bold + cc;
  } else if (indent >= 14 && trimmed.startsWith("(")) {
    base = baseIndent = T.italic + T.gray(244);
  } else if (indent >= 8) {
    base = baseIndent = T.gray(252);
  }

  // Underline solo sobre el texto, no sobre los espacios de indentación
  for (let i = 0; i < fullLen; i++) styles[i] = i < indent ? baseIndent : base;

  // Focus mode — escenas y personajes conservan su estilo siempre
  if (!state.selectionStart || !state.selectionEnd) {
    if (!isCurrentLine) {
      const isSceneHeading = /^(INT\.|EXT\.|INT\/EXT|I\/E)/i.test(trimmed);
      const isCharacter    = indent >= 20 && trimmed.length > 0 && trimmed === trimmed.toUpperCase();
      if (!isSceneHeading && !isCharacter) {
        const faded = T.gray(cfg.fadeGray);
        for (let i = 0; i < fullLen; i++) styles[i] = faded;
      }
    }
  }

  // Atenuar cuando hay overlay activo
  if (state.switcherMode || state.settingsMode) {
    for (let i = 0; i < fullLen; i++) styles[i] = T.gray(237);
  }

  // Selección
  if (state.selectionStart && state.selectionEnd) {
    for (let i = 0; i < fullLen; i++) {
      if (isSelected(rowNum, i)) styles[i] = T.inverse;
    }
  }

  let result = "", lastStyle = "";
  for (let i = charOffset; i < charOffset + chunkLen; i++) {
    const s = styles[i] || "";
    if (s !== lastStyle) { result += T.reset + s; lastStyle = s; }
    result += lineText[i];
  }
  return result + T.reset;
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
  if (state.cfg.mode === "screenplay")
    return screenplayHighlight(lineText, chunk, charOffset, rowNum, isCurrentLine);

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

  // Numbered list — colorear "N." / "N.N." / "N.N.N."
  const numListM = lineText.match(/^(\s*)(\d+(?:\.\d+)*\.)(\s)/);
  if (numListM) {
    const start = numListM[1].length;
    for (let i = start; i < start + numListM[2].length; i++) styles[i] = T.green;
  }

  const markerChars = new Set();
  const bs = T.getBoldStyle(cfg);
  const is = T.getItalicStyle(cfg);

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
  const plainUrlRe = /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.(?:com|org|net|io|dev|app|co|me|ai|xyz|edu|gov|uk|es|fr|de|jp|br|ar|cl|mx|ca|au|nz|in|tv|cc|ly|gg|sh|fm|pm|re|gl|id|us|eu|info|biz|tech|store|online|site|web|blog|news|media|live|studio|design|agency|works|team|club|space|world|zone|city|land|life|style|art|pro|plus|hub|base|box|lab|run|now|pub|one|social|email|link|click|page|host|cloud|digital|solutions|systems|services|tools|software|platform|network|group|media|ventures|capital|partners|fund|global|international)(?:[/?#][^\s]*)?/g;
  const linkStyle = T.green + T.underline;
  while ((m = codeRe.exec(lineText)) !== null)
    for (let i = m.index; i < m.index + m[0].length; i++) styles[i] = T.yellow;
  // URLs planas (https://... , www. , dominio.com)
  while ((m = plainUrlRe.exec(lineText)) !== null)
    for (let i = m.index; i < m.index + m[0].length; i++) styles[i] = linkStyle;
  // Links markdown [texto](url) — con ocultado de sintaxis en líneas inactivas
  while ((m = linkRe.exec(lineText)) !== null) {
    const textStart = m.index + 1;
    const textEnd = textStart + m[1].length;
    // '[' es marcador — ocultar en líneas inactivas
    markerChars.add(m.index);
    styles[m.index] = linkStyle;
    // Texto del enlace en verde+subrayado
    for (let i = textStart; i < textEnd; i++) styles[i] = linkStyle;
    // '](url)' son marcadores — ocultar en líneas inactivas
    for (let i = textEnd; i < m.index + m[0].length; i++) {
      markerChars.add(i);
      styles[i] = T.dim;
    }
  }

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

  // Atenuar todo cuando hay overlay activo
  if (state.switcherMode || state.settingsMode) {
    const switcherDim = T.gray(237);
    for (let i = 0; i < fullLen; i++) styles[i] = switcherDim;
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

// ─── Settings overlay ─────────────────────────────────────────────────────────
const renderSettings = () => {
  if (!state.settingsMode) return;

  const { SETTINGS_DEFS } = require("./settings");
  const cfg = state.cfg;
  const LABEL_W = 16;
  const VAL_W   = 13;
  const PANEL_W = 1 + LABEL_W + 1 + VAL_W + 1; // 32
  const maxVisible = Math.min(SETTINGS_DEFS.length, T.SCREEN_HEIGHT - 3);
  const selected = state.settingsIdx;
  const scrollOffset = Math.max(0, selected - maxVisible + 1);

  const startCol = Math.floor((T.SCREEN_WIDTH - PANEL_W) / 2);
  const startRow = Math.floor((T.SCREEN_HEIGHT - (maxVisible + 2)) / 2);

  const bgPanel  = "\x1b[48;5;234m";
  const bgSel    = "\x1b[48;5;238m";
  const bgHeader = "\x1b[48;5;236m";

  // Cabecera
  T.setCursor(startRow, startCol);
  T.out(bgHeader + T.bold + T.gray(255) + " configuración".padEnd(PANEL_W) + T.reset);

  // Filas de ajustes
  for (let r = 0; r < maxVisible; r++) {
    const di = r + scrollOffset;
    if (di >= SETTINGS_DEFS.length) break;
    const def = SETTINGS_DEFS[di];
    const isSel = di === selected;
    const raw = cfg[def.key];

    let valStr;
    if (def.type === "boolean") valStr = raw ? "on" : "off";
    else if (def.unit)          valStr = `${raw}${def.unit}`;
    else                        valStr = String(raw);

    const bg        = isSel ? bgSel : bgPanel;
    const labelClr  = isSel ? T.gray(255) : T.gray(244);
    const valClr    = isSel ? T.gray(cfg.accentColor ?? 36) : T.gray(248);
    const valDisplay = isSel
      ? `◀ ${valStr} ▶`.padEnd(VAL_W)
      : valStr.padEnd(VAL_W);

    T.setCursor(startRow + 1 + r, startCol);
    T.out(bg + " " + labelClr + def.label.padEnd(LABEL_W) + valClr + valDisplay + T.reset);
  }

  // Pie
  T.setCursor(startRow + 1 + maxVisible, startCol);
  T.out(T.gray(240) + " ↑↓ navegar  ←→ cambiar  Enter cerrar".padEnd(PANEL_W) + T.reset);
};

// ─── Switcher overlay ────────────────────────────────────────────────────────
const renderSwitcher = () => {
  if (!state.switcherMode || !state.switcherFiles.length) return;

  const files = state.switcherFiles;
  const maxVisible = Math.min(files.length, 10);
  const selected = state.switcherIdx;

  // Scroll para mantener el ítem seleccionado visible
  const scrollOffset = Math.max(0, selected - maxVisible + 1);

  const maxLen = files.reduce((m, f) => Math.max(m, f.length), 0);
  const panelW = maxLen + 6; // indicador (3) + padding (3)
  const panelH = maxVisible;

  const startCol = Math.floor((T.SCREEN_WIDTH - panelW) / 2);
  const startRow = Math.floor((T.SCREEN_HEIGHT - panelH) / 2);

  const panelBg = "\x1b[48;5;234m";
  const selBg   = "\x1b[48;5;238m";

  for (let r = 0; r < maxVisible; r++) {
    const fi = r + scrollOffset;
    if (fi >= files.length) break;
    const fname = files[fi];
    const isSel = fi === selected;

    T.setCursor(startRow + r, startCol);
    const bg        = isSel ? selBg : panelBg;
    const indicator = isSel ? T.gray(state.cfg.accentColor ?? 36) + "▶ " + T.reset + bg : "  ";
    const nameColor = isSel ? T.bold + T.gray(255) : T.gray(244);
    T.out(bg + " " + indicator + nameColor + fname.padEnd(maxLen + 2) + T.reset);
  }
};

// ─── Cursor ───────────────────────────────────────────────────────────────────
const drawCursor = (cfg, blink, ch) => {
  const style = cfg.cursorStyle ?? "bar";
  const c = ch || " ";
  if (style === "block") {
    return blink ? T.inverse + c + T.reset : c;
  }
  if (style === "underline") {
    return blink ? T.underline + T.gray(cfg.accentColor ?? 36) + c + T.reset : c;
  }
  // bar (default)
  return blink ? T.gray(cfg.accentColor ?? 36) + "│" + T.reset : " ";
};

// ─── Render principal ─────────────────────────────────────────────────────────
const render = () => {
  T.beginRender();

  const cfg = state.cfg;
  const baseWrap = cfg.mode === "screenplay"
    ? Math.min(cfg.wrapColumn > 0 ? cfg.wrapColumn : 80, 60)
    : (cfg.wrapColumn > 0 ? cfg.wrapColumn : 80);
  const contentWidth = Math.min(baseWrap, T.SCREEN_WIDTH - T.MARGIN * 2);
  const offsetX = Math.floor((T.SCREEN_WIDTH - contentWidth) / 2);
  const pad = " ".repeat(offsetX);

  const screenRows = buildScreenRows(contentWidth);
  const curSR = cursorScreenRow(screenRows);
  const spanStates = computeSpanStates(state.lines);

  // Ajustar scroll (área de contenido = SCREEN_HEIGHT - 1, la última fila es padding)
  if (curSR < state.scrollTop) state.scrollTop = curSR;
  if (curSR >= state.scrollTop + T.SCREEN_HEIGHT - 1)
    state.scrollTop = curSR - T.SCREEN_HEIGHT + 2;
  if (state.scrollTop < 0) state.scrollTop = 0;

  for (let row = 0; row < T.SCREEN_HEIGHT - 1; row++) {
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
        T.gray(cfg.accentColor ?? 36) +
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
        T.gray(cfg.accentColor ?? 36) +
        `: ${state.gotoInput}` +
        T.reset +
        T.gray(244) +
        "  Ir a línea — Esc cancelar" +
        T.reset,
    );
  } else {
    const words = state.lines.join(" ").split(/\s+/).filter(Boolean).length;

    const modeLabel = cfg.mode === "screenplay" ? "screenplay" : "markdown";
    const left =
      T.bold + T.gray(255) +
      `${state.cursorLine + 1}:${state.cursorCol + 1}` +
      T.reset + T.gray(244) +
      `  ${state.lines.length}L  ${words}W` +
      `  ${modeLabel}` +
      T.reset;
    const leftLen =
      `${state.cursorLine + 1}:${state.cursorCol + 1}  ${state.lines.length}L  ${words}W  ${modeLabel}`
        .length;

    // Elemento screenplay (derecha)
    let rightLabel = "";
    let rightLabelLen = 0;
    if (cfg.mode === "screenplay") {
      const ln      = state.lines[state.cursorLine];
      const ind     = ln.match(/^ */)[0].length;
      const trimmed = ln.trimStart();
      let element;
      if      (ind === 0 && /^(INT\.|EXT\.|INT\/EXT|I\/E)/i.test(trimmed))                      element = "escena";
      else if (ind === 0 && /^(CUT TO:|FADE OUT|FADE IN|DISSOLVE TO|SMASH CUT)/i.test(trimmed)) element = "transición";
      else if (ind >= 20) element = "personaje";
      else if (ind >= 14) element = "paréntesis";
      else if (ind >= 8)  element = "diálogo";
      else                element = "acción";
      rightLabel    = T.gray(cfg.characterColor ?? 51) + element + T.reset;
      rightLabelLen = element.length;
    }

    if (rightLabelLen) {
      const rightSpace = Math.max(1, contentWidth - leftLen - rightLabelLen);
      T.out(pad + left + " ".repeat(rightSpace) + rightLabel);
    } else {
      T.out(pad + left);
    }
  }
  T.clearLine();

  // Cursor
  const cursorChunkCol = state.cursorCol % contentWidth;
  T.setCursor(curSR - state.scrollTop, offsetX + cursorChunkCol);
  T.out(drawCursor(cfg, state.cursorBlink, state.lines[state.cursorLine][state.cursorCol]));

  // Fila de padding entre contenido y barra de estado
  T.setCursor(T.SCREEN_HEIGHT - 1, 0);
  T.clearLine();

  // Overlays (encima de todo)
  renderSwitcher();
  renderSettings();

  // Autocomplete popup — aparece debajo del cursor si cabe, arriba si no
  if (state.acMode && state.acSuggestions.length && !state.switcherMode && !state.settingsMode) {
    const suggestions  = state.acSuggestions;
    const maxVisible   = Math.min(suggestions.length, 6);
    const scrollOffset = Math.max(0, state.acIdx - maxVisible + 1);
    const maxW         = suggestions.reduce((m, s) => Math.max(m, s.length), 0);
    const cursorSR     = curSR - state.scrollTop;
    const popupCol     = offsetX + (state.cursorCol % contentWidth);
    const bgPanel      = "\x1b[48;5;234m";
    const bgSel        = "\x1b[48;5;238m";

    // Preferir abajo; si no cabe, mostrar arriba del cursor
    const spaceBelow = (T.SCREEN_HEIGHT - 1) - (cursorSR + 1);
    const popupRow   = spaceBelow >= maxVisible
      ? cursorSR + 1
      : Math.max(0, cursorSR - maxVisible);

    for (let r = 0; r < maxVisible; r++) {
      const idx = r + scrollOffset;
      if (idx >= suggestions.length) break;
      const row = popupRow + r;
      if (row < 0 || row >= T.SCREEN_HEIGHT - 1) break;
      const isSel = idx === state.acIdx;
      T.setCursor(row, popupCol);
      const bg  = isSel ? bgSel : bgPanel;
      const clr = isSel ? T.bold + T.gray(cfg.characterColor ?? 51) : T.gray(244);
      T.out(bg + " " + clr + suggestions[idx].padEnd(maxW + 1) + " " + T.reset);
    }
  }

  T.endRender();
};

// Blink tick — llamado desde el intervalo en index.js
const blinkTick = () => {
  if (state.settingsMode) {
    render();
    return;
  }
  state.cursorBlink = !state.cursorBlink;
  const cfg = state.cfg;
  const blinkBaseWrap = cfg.mode === "screenplay"
    ? Math.min(cfg.wrapColumn > 0 ? cfg.wrapColumn : 80, 60)
    : (cfg.wrapColumn > 0 ? cfg.wrapColumn : 80);
  const contentWidth = Math.min(blinkBaseWrap, T.SCREEN_WIDTH - T.MARGIN * 2);
  const offsetX = Math.floor((T.SCREEN_WIDTH - contentWidth) / 2);
  const screenRows = buildScreenRows(contentWidth);
  const curSR = cursorScreenRow(screenRows);
  T.setCursor(
    curSR - state.scrollTop,
    offsetX + (state.cursorCol % contentWidth),
  );
  T.out(drawCursor(cfg, state.cursorBlink, state.lines[state.cursorLine][state.cursorCol]));
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
