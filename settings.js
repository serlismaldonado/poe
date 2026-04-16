// settings.js — carga y acceso a la configuración desde settings.json
const fs = require("fs");
const path = require("path");

const DEFAULT_SETTINGS = {
  wrapColumn:    80,          // wrap visual y de escritura en N caracteres
  tabSize:       2,           // espacios por Tab
  autosaveMs:    500,         // delay de autoguardado en ms
  fadeGray:      244,         // gris de líneas inactivas (232–255)
  cursorBlinkMs: 600,         // velocidad de parpadeo del cursor en ms
  cursorStyle:   "underline", // "bar" │  |  "block" █  |  "underline" _
  mode:          "markdown",  // "markdown" | "screenplay"
  sound:         true,        // sonido de teclado mecánico
  soundVolume:   60,          // volumen 0–100
  h1Gray:        255,         // # Título
  h2Gray:        248,         // ## Título
  h3Gray:        242,         // ### Título
  boldGray:      255,         // **negrita**
  italicGray:    245,         // *cursiva*
  searchBg:      58,          // fondo del highlight de búsqueda
  characterColor: 51,         // color de nombres de personaje (0–255)
  accentColor:    36,         // color de acento general: cursor, búsqueda, switcher (0–255)
};

// Definiciones para el menú de configuración
const SETTINGS_DEFS = [
  { key: "mode",         label: "modo",           type: "options", options: ["markdown", "screenplay"] },
  { key: "cursorStyle",  label: "cursor",          type: "options", options: ["bar", "underline", "block"] },
  { key: "cursorBlinkMs",label: "parpadeo",        type: "number",  min: 100,  max: 2000, step: 100, unit: "ms" },
  { key: "wrapColumn",   label: "wrap columna",    type: "number",  min: 40,   max: 200,  step: 1 },
  { key: "tabSize",      label: "tab",             type: "number",  min: 1,    max: 8,    step: 1 },
  { key: "autosaveMs",   label: "autoguardado",    type: "number",  min: 100,  max: 5000, step: 100, unit: "ms" },
  { key: "fadeGray",     label: "fade",            type: "number",  min: 232,  max: 255,  step: 1 },
  { key: "sound",        label: "sonido",          type: "boolean" },
  { key: "soundVolume",  label: "volumen",         type: "number",  min: 0,    max: 100,  step: 5, unit: "%" },
  { key: "h1Gray",       label: "# gris",          type: "number",  min: 232,  max: 255,  step: 1 },
  { key: "h2Gray",       label: "## gris",         type: "number",  min: 232,  max: 255,  step: 1 },
  { key: "h3Gray",       label: "### gris",        type: "number",  min: 232,  max: 255,  step: 1 },
  { key: "boldGray",     label: "bold gris",       type: "number",  min: 232,  max: 255,  step: 1 },
  { key: "italicGray",   label: "italic gris",     type: "number",  min: 232,  max: 255,  step: 1 },
  { key: "searchBg",     label: "búsqueda fondo",  type: "number",  min: 0,    max: 255,  step: 1 },
  { key: "characterColor", label: "personaje color", type: "number",  min: 0,    max: 255,  step: 1 },
  { key: "accentColor",   label: "acento color",    type: "number",  min: 0,    max: 255,  step: 1 },
];

const load = (filePath) => {
  const settingsPath = path.join(path.dirname(filePath), "settings.json");
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

const save = (filePath, cfg) => {
  const settingsPath = path.join(path.dirname(filePath), "settings.json");
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(cfg, null, 2));
  } catch {}
};

module.exports = { load, save, DEFAULT_SETTINGS, SETTINGS_DEFS };
