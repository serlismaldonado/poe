// state.js — estado compartido entre todos los módulos
// Todos los módulos importan y mutan este objeto directamente.

const state = {
  // Documento
  lines:      [''],
  fullPath:   '',

  // Cursor
  cursorLine: 0,
  cursorCol:  0,
  scrollTop:  0,

  // UI
  cursorBlink:   true,
  blinkInterval: null,
  saveTimeout:   null,
  isSaving:      false,
  spinnerIndex:  0,

  // Selección
  selectionStart: null,
  selectionEnd:   null,

  // Undo / Redo
  undoStack: [],
  redoStack: [],

  // Búsqueda
  searchMode:    false,
  searchQuery:   '',
  searchMatches: [],
  searchIdx:     0,

  // Modos UI
  helpMode: false,
  gotoMode: false,
  gotoInput: '',

  // Config
  cfg: {},
};

module.exports = state;
