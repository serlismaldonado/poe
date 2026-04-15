// terminal.js — helpers ANSI, colores y dimensiones de pantalla

const out = (s) => process.stdout.write(s);
const clear = () => out("\x1b[2J\x1b[H");
const setCursor = (r, c) => out(`\x1b[${r + 1};${c + 1}H`);
const clearLine = () => out("\x1b[K");
const color = (code) => `\x1b[${code}m`;

const reset = color(0);
const cyan = color(36);
const bold = color(1);
const dim = color(2);
const green = color(32);
const blue = color(34);
const yellow = color(33);
const inverse = color(7);
const gray = (n) => `\x1b[38;5;${n}m`;

const h1Style = bold + gray(255);
const h2Style = bold + gray(248);
const h3Style = gray(242);
const boldStyle = bold + gray(255);
const italicStyle = gray(245);
const searchHL = "\x1b[48;5;58m" + gray(255);

// Versiones dinámicas que leen cfg en tiempo de render
const getH1Style = (cfg) => bold + gray(cfg.h1Gray ?? 255);
const getH2Style = (cfg) => bold + gray(cfg.h2Gray ?? 248);
const getH3Style = (cfg) => gray(cfg.h3Gray ?? 242);
const getBoldStyle = (cfg) => bold + gray(cfg.boldGray ?? 255);
const getItalicStyle = (cfg) => gray(cfg.italicGray ?? 245);
const getSearchHL = (cfg) => `\x1b[48;5;${cfg.searchBg ?? 58}m` + gray(255);

const MARGIN = 4;

let SCREEN_WIDTH = process.stdout.columns || 80;
let SCREEN_HEIGHT = (process.stdout.rows || 24) - 2;

const updateDimensions = () => {
  SCREEN_WIDTH = process.stdout.columns || 80;
  SCREEN_HEIGHT = (process.stdout.rows || 24) - 2;
};

const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

module.exports = {
  out,
  clear,
  setCursor,
  clearLine,
  reset,
  cyan,
  bold,
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
  get SCREEN_WIDTH() {
    return SCREEN_WIDTH;
  },
  get SCREEN_HEIGHT() {
    return SCREEN_HEIGHT;
  },
  updateDimensions,
};
