// terminal.js — helpers ANSI, colores y dimensiones de pantalla

// ─── Output buffering ────────────────────────────────────────────────────────
// Durante render, toda la salida se acumula en _buf y se envía en un solo write.
// Fuera de render, out() escribe directo (para blinkTick, cursor, etc.)
let _buf = null;

const beginRender = () => { _buf = ""; };
const endRender   = () => { if (_buf !== null) { process.stdout.write(_buf); _buf = null; } };
const out         = (s) => { if (_buf !== null) _buf += s; else process.stdout.write(s); };

const setCursor = (r, c) => out(`\x1b[${r + 1};${c + 1}H`);
const clearLine = () => out("\x1b[K");
const color     = (code) => `\x1b[${code}m`;

const reset     = color(0);
const cyan      = color(36);
const bold      = color(1);
const italic    = color(3);
const underline = color(4);
const dim       = color(2);
const green     = color(32);
const blue      = color(34);
const yellow    = color(33);
const inverse   = color(7);
const gray      = (n) => `\x1b[38;5;${n}m`;

const h1Style     = bold + gray(255);
const h2Style     = bold + gray(248);
const h3Style     = gray(242);
const boldStyle   = bold + gray(255);
const italicStyle = gray(245);
const searchHL    = "\x1b[48;5;58m" + gray(255);

// Versiones dinámicas que leen cfg en tiempo de render
const getH1Style    = (cfg) => bold + gray(cfg.h1Gray ?? 255);
const getH2Style    = (cfg) => bold + gray(cfg.h2Gray ?? 248);
const getH3Style    = (cfg) => gray(cfg.h3Gray ?? 242);
const getBoldStyle  = (cfg) => bold + gray(cfg.boldGray ?? 255);
const getItalicStyle = (cfg) => italic + gray(cfg.italicGray ?? 245);
const getSearchHL   = (cfg) => `\x1b[48;5;${cfg.searchBg ?? 58}m` + gray(255);

const MARGIN = 4;

let SCREEN_WIDTH  = process.stdout.columns || 80;
let SCREEN_HEIGHT = (process.stdout.rows || 24) - 2;

const updateDimensions = () => {
  SCREEN_WIDTH  = process.stdout.columns || 80;
  SCREEN_HEIGHT = (process.stdout.rows || 24) - 2;
};

const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

module.exports = {
  out,
  beginRender,
  endRender,
  setCursor,
  clearLine,
  reset,
  cyan,
  bold,
  italic,
  underline,
  dim,
  green,
  blue,
  yellow,
  inverse,
  gray,
  h1Style,
  h2Style,
  h3Style,
  boldStyle,
  italicStyle,
  searchHL,
  getH1Style,
  getH2Style,
  getH3Style,
  getBoldStyle,
  getItalicStyle,
  getSearchHL,
  MARGIN,
  spinnerFrames,
  get SCREEN_WIDTH()  { return SCREEN_WIDTH; },
  get SCREEN_HEIGHT() { return SCREEN_HEIGHT; },
  updateDimensions,
};
