// editor.js — lógica de edición, movimiento, selección, búsqueda y archivo
"use strict";

const fs = require("fs");
const path = require("path");
const state = require("./state");
const T = require("./terminal");
const {
  render,
  normalizeSelection,
  isSelected,
  getWordBoundaries,
} = require("./render");
const { playClick } = require("./sound");

const MAX_UNDO = 200;

// ─── Archivo ──────────────────────────────────────────────────────────────────
const STATE_FILE = path.join(process.env.HOME || "/tmp", ".poe_positions.json");

const loadPositions = () => {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
};

const savePosition = () => {
  const pos = loadPositions();
  pos[state.fullPath] = { line: state.cursorLine, col: state.cursorCol };
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(pos));
  } catch {}
};

const restorePosition = () => {
  const pos = loadPositions()[state.fullPath];
  if (pos) {
    state.cursorLine = Math.min(pos.line, state.lines.length - 1);
    state.cursorCol = Math.min(pos.col, state.lines[state.cursorLine].length);
  }
};

const save = () => {
  state.isSaving = true;
  fs.writeFileSync(state.fullPath, state.lines.join("\n"));
  savePosition();
  setTimeout(() => {
    state.isSaving = false;
    render();
  }, 300);
};

const autoSave = () => {
  if (state.saveTimeout) clearTimeout(state.saveTimeout);
  state.saveTimeout = setTimeout(() => {
    save();
    state.saveTimeout = null;
  }, state.cfg.autosaveMs);
};

// ─── Undo / Redo ──────────────────────────────────────────────────────────────
const snapshot = () => ({
  lines: state.lines.slice(),
  cursorLine: state.cursorLine,
  cursorCol: state.cursorCol,
});

const pushUndo = (snap) => {
  state.undoStack.push(snap);
  if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
  state.redoStack.length = 0;
};

const undo = () => {
  if (!state.undoStack.length) return;
  state.redoStack.push(snapshot());
  const s = state.undoStack.pop();
  state.lines = s.lines;
  state.cursorLine = s.cursorLine;
  state.cursorCol = s.cursorCol;
  render();
};

const redo = () => {
  if (!state.redoStack.length) return;
  state.undoStack.push(snapshot());
  const s = state.redoStack.pop();
  state.lines = s.lines;
  state.cursorLine = s.cursorLine;
  state.cursorCol = s.cursorCol;
  render();
};

// ─── Selección ────────────────────────────────────────────────────────────────
const deselect = () => {
  state.selectionStart = null;
  state.selectionEnd = null;
};
const selectAll = () => {
  state.selectionStart = { line: 0, col: 0 };
  state.selectionEnd = {
    line: state.lines.length - 1,
    col: state.lines[state.lines.length - 1].length,
  };
  render();
};

const deleteSelection = () => {
  const s = normalizeSelection();
  if (!s) return false;
  pushUndo(snapshot());
  if (s.start.line === s.end.line) {
    const ln = state.lines[s.start.line];
    state.lines[s.start.line] = ln.slice(0, s.start.col) + ln.slice(s.end.col);
  } else {
    state.lines[s.start.line] =
      state.lines[s.start.line].slice(0, s.start.col) +
      state.lines[s.end.line].slice(s.end.col);
    state.lines.splice(s.start.line + 1, s.end.line - s.start.line);
  }
  state.cursorLine = s.start.line;
  state.cursorCol = s.start.col;
  deselect();
  autoSave();
  render();
  return true;
};

// ─── Movimiento ───────────────────────────────────────────────────────────────
const moveUp = () => {
  if (state.cursorLine > 0) {
    state.cursorLine--;
    state.cursorCol = Math.min(
      state.cursorCol,
      state.lines[state.cursorLine].length,
    );
  }
};
const moveDown = () => {
  if (state.cursorLine < state.lines.length - 1) {
    state.cursorLine++;
    state.cursorCol = Math.min(
      state.cursorCol,
      state.lines[state.cursorLine].length,
    );
  }
};
const moveLeft = () => {
  if (state.cursorCol > 0) state.cursorCol--;
  else if (state.cursorLine > 0) {
    state.cursorLine--;
    state.cursorCol = state.lines[state.cursorLine].length;
  }
};
const moveRight = () => {
  if (state.cursorCol < state.lines[state.cursorLine].length) state.cursorCol++;
  else if (state.cursorLine < state.lines.length - 1) {
    state.cursorLine++;
    state.cursorCol = 0;
  }
};

const moveWithSelection = (shift, moveFn) => {
  if (shift) {
    if (!state.selectionStart)
      state.selectionStart = { line: state.cursorLine, col: state.cursorCol };
    moveFn();
    state.selectionEnd = { line: state.cursorLine, col: state.cursorCol };
  } else {
    deselect();
    moveFn();
  }
  playClick(state.cfg, "key");
  render();
};

const handleUp = (shift = false) => moveWithSelection(shift, moveUp);
const handleDown = (shift = false) => moveWithSelection(shift, moveDown);
const handleLeft = (shift = false) => moveWithSelection(shift, moveLeft);
const handleRight = (shift = false) => moveWithSelection(shift, moveRight);
const handleHome = (shift = false) =>
  moveWithSelection(shift, () => {
    state.cursorCol = 0;
  });
const handleEnd = (shift = false) =>
  moveWithSelection(shift, () => {
    state.cursorCol = state.lines[state.cursorLine].length;
  });

const handleCtrlHome = () => {
  deselect();
  state.cursorLine = 0;
  state.cursorCol = 0;
  state.scrollTop = 0;
  playClick(state.cfg, "key");
  render();
};
const handleCtrlEnd = () => {
  deselect();
  state.cursorLine = state.lines.length - 1;
  state.cursorCol = state.lines[state.cursorLine].length;
  playClick(state.cfg, "key");
  render();
};
const handlePageUp = () => {
  deselect();
  state.cursorLine = Math.max(0, state.cursorLine - T.SCREEN_HEIGHT);
  playClick(state.cfg, "key");
  render();
};
const handlePageDown = () => {
  deselect();
  state.cursorLine = Math.min(
    state.lines.length - 1,
    state.cursorLine + T.SCREEN_HEIGHT,
  );
  playClick(state.cfg, "key");
  render();
};

const wordLeft = () => {
  if (state.cursorCol > 0) {
    let c = state.cursorCol - 1;
    while (c > 0 && !/\w/.test(state.lines[state.cursorLine][c])) c--;
    while (c > 0 && /\w/.test(state.lines[state.cursorLine][c - 1])) c--;
    state.cursorCol = c;
  } else if (state.cursorLine > 0) {
    state.cursorLine--;
    state.cursorCol = state.lines[state.cursorLine].length;
  }
};
const wordRight = () => {
  const ln = state.lines[state.cursorLine];
  if (state.cursorCol < ln.length) {
    let c = state.cursorCol;
    while (c < ln.length && !/\w/.test(ln[c])) c++;
    while (c < ln.length && /\w/.test(ln[c])) c++;
    state.cursorCol = c;
  } else if (state.cursorLine < state.lines.length - 1) {
    state.cursorLine++;
    state.cursorCol = 0;
  }
};

// ─── Edición ──────────────────────────────────────────────────────────────────
const handleChar = (ch) => {
  if (state.selectionStart && state.selectionEnd) deleteSelection();
  pushUndo(snapshot());
  state.cursorCol = Math.min(
    state.cursorCol,
    state.lines[state.cursorLine].length,
  );
  const ln = state.lines[state.cursorLine];
  state.lines[state.cursorLine] =
    ln.slice(0, state.cursorCol) + ch + ln.slice(state.cursorCol);
  state.cursorCol++;

  // Word wrap
  const cfg = state.cfg;
  if (
    cfg.wrapColumn > 0 &&
    state.lines[state.cursorLine].length > cfg.wrapColumn
  ) {
    const current = state.lines[state.cursorLine];
    if (!/^#{1,3} /.test(current)) {
      let breakAt = -1;
      for (let i = cfg.wrapColumn; i >= 1; i--) {
        if (current[i] === " ") {
          breakAt = i;
          break;
        }
      }
      if (breakAt > 0) {
        state.lines[state.cursorLine] = current.slice(0, breakAt);
        state.lines.splice(state.cursorLine + 1, 0, current.slice(breakAt + 1));
        state.cursorLine++;
        state.cursorCol = state.cursorCol - breakAt - 1;
      }
    }
  }

  playClick(cfg, "key");
  autoSave();
  render();
};

const handleBackspace = () => {
  if (state.selectionStart && state.selectionEnd) {
    deleteSelection();
    return;
  }
  pushUndo(snapshot());
  if (state.cursorCol === 0) {
    if (state.cursorLine > 0) {
      state.cursorCol = state.lines[state.cursorLine - 1].length;
      state.lines[state.cursorLine - 1] += state.lines[state.cursorLine];
      state.lines.splice(state.cursorLine, 1);
      state.cursorLine--;
    }
  } else {
    const ln = state.lines[state.cursorLine];
    state.lines[state.cursorLine] =
      ln.slice(0, state.cursorCol - 1) + ln.slice(state.cursorCol);
    state.cursorCol--;
  }
  playClick(state.cfg, "backspace");
  autoSave();
  render();
};

const handleDelete = () => {
  if (state.selectionStart && state.selectionEnd) {
    deleteSelection();
    return;
  }
  pushUndo(snapshot());
  const ln = state.lines[state.cursorLine];
  if (state.cursorCol < ln.length) {
    state.lines[state.cursorLine] =
      ln.slice(0, state.cursorCol) + ln.slice(state.cursorCol + 1);
  } else if (state.cursorLine < state.lines.length - 1) {
    state.lines[state.cursorLine] += state.lines[state.cursorLine + 1];
    state.lines.splice(state.cursorLine + 1, 1);
  }
  autoSave();
  render();
};

const handleEnter = () => {
  if (state.selectionStart && state.selectionEnd) deselect();
  pushUndo(snapshot());
  const ln = state.lines[state.cursorLine];
  const left = ln.slice(0, state.cursorCol);
  const right = ln.slice(state.cursorCol);

  // Auto-bullet
  const bm = ln.match(/^(\s*)([-*+] )(.*)/);
  if (bm) {
    const prefix = bm[1] + bm[2];
    if (bm[3].trim() === "" && state.cursorCol === ln.length) {
      state.lines[state.cursorLine] = "";
      state.cursorCol = 0;
    } else {
      state.lines[state.cursorLine] = left;
      state.lines.splice(state.cursorLine + 1, 0, prefix + right);
      state.cursorLine++;
      state.cursorCol = prefix.length;
    }
    playClick(state.cfg, "enter");
    autoSave();
    render();
    return;
  }

  state.lines[state.cursorLine] = left;
  state.lines.splice(state.cursorLine + 1, 0, right);
  state.cursorLine++;
  state.cursorCol = 0;
  playClick(state.cfg, "enter");
  autoSave();
  render();
};

const handleTab = () => {
  pushUndo(snapshot());
  const ln = state.lines[state.cursorLine];
  const tab = " ".repeat(state.cfg.tabSize);
  if (/^\s*[-*+] /.test(ln)) {
    state.lines[state.cursorLine] = tab + ln;
    state.cursorCol += state.cfg.tabSize;
  } else {
    state.lines[state.cursorLine] =
      ln.slice(0, state.cursorCol) + tab + ln.slice(state.cursorCol);
    state.cursorCol += state.cfg.tabSize;
  }
  autoSave();
  render();
};

const handleShiftTab = () => {
  pushUndo(snapshot());
  const ln = state.lines[state.cursorLine];
  const tab = " ".repeat(state.cfg.tabSize);
  if (ln.startsWith(tab)) {
    state.lines[state.cursorLine] = ln.slice(state.cfg.tabSize);
    state.cursorCol = Math.max(0, state.cursorCol - state.cfg.tabSize);
  }
  autoSave();
  render();
};

const duplicateLine = () => {
  pushUndo(snapshot());
  state.lines.splice(state.cursorLine + 1, 0, state.lines[state.cursorLine]);
  state.cursorLine++;
  autoSave();
  render();
};

const killLine = () => {
  pushUndo(snapshot());
  if (state.lines.length === 1) {
    state.lines[0] = "";
    state.cursorCol = 0;
  } else {
    state.lines.splice(state.cursorLine, 1);
    state.cursorLine = Math.min(state.cursorLine, state.lines.length - 1);
    state.cursorCol = Math.min(
      state.cursorCol,
      state.lines[state.cursorLine].length,
    );
  }
  autoSave();
  render();
};

const moveLineUp = () => {
  if (state.cursorLine === 0) return;
  pushUndo(snapshot());
  [state.lines[state.cursorLine - 1], state.lines[state.cursorLine]] = [
    state.lines[state.cursorLine],
    state.lines[state.cursorLine - 1],
  ];
  state.cursorLine--;
  autoSave();
  render();
};

const moveLineDown = () => {
  if (state.cursorLine >= state.lines.length - 1) return;
  pushUndo(snapshot());
  [state.lines[state.cursorLine], state.lines[state.cursorLine + 1]] = [
    state.lines[state.cursorLine + 1],
    state.lines[state.cursorLine],
  ];
  state.cursorLine++;
  autoSave();
  render();
};

const wrapInline = (marker) => {
  pushUndo(snapshot());
  const s = normalizeSelection();
  if (s && s.start.line === s.end.line) {
    const ln = state.lines[s.start.line];
    state.lines[s.start.line] =
      ln.slice(0, s.start.col) +
      marker +
      ln.slice(s.start.col, s.end.col) +
      marker +
      ln.slice(s.end.col);
    state.cursorCol = s.end.col + marker.length * 2;
    deselect();
  } else {
    const ln = state.lines[state.cursorLine];
    state.lines[state.cursorLine] =
      ln.slice(0, state.cursorCol) +
      marker +
      marker +
      ln.slice(state.cursorCol);
    state.cursorCol += marker.length;
  }
  autoSave();
  render();
};

// ─── Paste ────────────────────────────────────────────────────────────────────
const handlePaste = (text) => {
  if (state.selectionStart && state.selectionEnd) deleteSelection();
  pushUndo(snapshot());

  // Normalizar saltos de línea y eliminar caracteres de control residuales
  const clean = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "") // strips escape sequences
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ""); // strips control chars excepto \n y \t

  const parts = clean.split("\n");

  if (parts.length === 1) {
    const ln = state.lines[state.cursorLine];
    state.lines[state.cursorLine] =
      ln.slice(0, state.cursorCol) + parts[0] + ln.slice(state.cursorCol);
    state.cursorCol += parts[0].length;
  } else {
    const ln = state.lines[state.cursorLine];
    const before = ln.slice(0, state.cursorCol);
    const after = ln.slice(state.cursorCol);
    state.lines[state.cursorLine] = before + parts[0];
    for (let i = 1; i < parts.length - 1; i++)
      state.lines.splice(state.cursorLine + i, 0, parts[i]);
    const lastIdx = state.cursorLine + parts.length - 1;
    state.lines.splice(lastIdx, 0, parts[parts.length - 1] + after);
    state.cursorLine = lastIdx;
    state.cursorCol = parts[parts.length - 1].length;
  }
  autoSave();
  render();
};

// ─── Búsqueda ────────────────────────────────────────────────────────────────
const buildMatches = () => {
  state.searchMatches = [];
  if (!state.searchQuery) return;
  const q = state.searchQuery.toLowerCase();
  for (let r = 0; r < state.lines.length; r++) {
    const ln = state.lines[r].toLowerCase();
    let idx = 0;
    while ((idx = ln.indexOf(q, idx)) !== -1) {
      state.searchMatches.push({ line: r, col: idx });
      idx++;
    }
  }
};

const searchNext = () => {
  if (!state.searchMatches.length) return;
  state.searchIdx = (state.searchIdx + 1) % state.searchMatches.length;
  const m = state.searchMatches[state.searchIdx];
  state.cursorLine = m.line;
  state.cursorCol = m.col;
};
const searchPrev = () => {
  if (!state.searchMatches.length) return;
  state.searchIdx =
    (state.searchIdx - 1 + state.searchMatches.length) %
    state.searchMatches.length;
  const m = state.searchMatches[state.searchIdx];
  state.cursorLine = m.line;
  state.cursorCol = m.col;
};

const enterSearch = () => {
  state.searchMode = true;
  state.searchQuery = "";
  state.searchMatches = [];
  state.searchIdx = 0;
  render();
};
const exitSearch = () => {
  state.searchMode = false;
  if (state.searchMatches.length) {
    const m = state.searchMatches[state.searchIdx];
    state.cursorLine = m.line;
    state.cursorCol = m.col;
  }
  render();
};
const handleSearchInput = (code) => {
  if (code === "\x1b") {
    state.searchQuery = "";
    state.searchMatches = [];
    state.searchMode = false;
    render();
    return;
  }
  if (code === "\r") {
    exitSearch();
    return;
  }
  if (code === "\x1b[A") {
    searchPrev();
    render();
    return;
  }
  if (code === "\x1b[B") {
    searchNext();
    render();
    return;
  }
  if (code === "\x7f" || code === "\b") {
    state.searchQuery = state.searchQuery.slice(0, -1);
  } else if (code.length === 1 && code.charCodeAt(0) >= 32) {
    state.searchQuery += code;
  }
  buildMatches();
  if (state.searchMatches.length) {
    state.searchIdx = 0;
    const m = state.searchMatches[0];
    state.cursorLine = m.line;
    state.cursorCol = m.col;
  }
  render();
};

// ─── Ir a línea ───────────────────────────────────────────────────────────────
const enterGoto = () => {
  state.gotoMode = true;
  state.gotoInput = "";
  render();
};
const handleGotoInput = (code) => {
  if (code === "\x1b") {
    state.gotoMode = false;
    render();
    return;
  }
  if (code === "\r") {
    const n = parseInt(state.gotoInput, 10);
    if (!isNaN(n)) {
      state.cursorLine = Math.max(0, Math.min(n - 1, state.lines.length - 1));
      state.cursorCol = Math.min(
        state.cursorCol,
        state.lines[state.cursorLine].length,
      );
    }
    state.gotoMode = false;
    render();
    return;
  }
  if ((code === "\x7f" || code === "\b") && state.gotoInput.length)
    state.gotoInput = state.gotoInput.slice(0, -1);
  else if (/\d/.test(code)) state.gotoInput += code;
  render();
};

const ensureCursorVisible = () => {};
const playNav = () => playClick(state.cfg, "key"); // scroll manejado en render

module.exports = {
  save,
  autoSave,
  savePosition,
  restorePosition,
  undo,
  redo,
  deselect,
  selectAll,
  deleteSelection,
  handleUp,
  handleDown,
  handleLeft,
  handleRight,
  handleHome,
  handleEnd,
  handleCtrlHome,
  handleCtrlEnd,
  handlePageUp,
  handlePageDown,
  wordLeft,
  wordRight,
  handleChar,
  handleBackspace,
  handleDelete,
  handleEnter,
  handleTab,
  handleShiftTab,
  duplicateLine,
  killLine,
  moveLineUp,
  moveLineDown,
  wrapInline,
  handlePaste,
  enterSearch,
  handleSearchInput,
  enterGoto,
  handleGotoInput,
  ensureCursorVisible,
  playNav,
};
