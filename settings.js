// settings.js — carga y acceso a la configuración desde settings.json
const fs = require("fs");
const path = require("path");

const DEFAULT_SETTINGS = {
  wrapColumn: 80, // wrap visual y de escritura en N caracteres
  tabSize: 2, // espacios por Tab
  autosaveMs: 500, // delay de autoguardado en ms
  fadeGray: 244, // gris de líneas inactivas (232–255)
  cursorBlinkMs: 600, // velocidad de parpadeo del cursor en ms
  sound: true, // sonido de teclado mecánico
  soundVolume: 60, // volumen 0–100
  // Estilos visuales — niveles de gris 232 (negro) a 255 (blanco)
  h1Gray: 255, // # Título — blanco puro bold
  h2Gray: 248, // ## Título — gris claro bold
  h3Gray: 242, // ### Título — gris medio
  boldGray: 255, // **negrita** — blanco puro bold
  italicGray: 245, // *cursiva* — gris suave
  searchBg: 58, // fondo del highlight de búsqueda (color 256)
};

const load = (filePath) => {
  const settingsPath = path.join(path.dirname(filePath), "settings.json");
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

module.exports = { load, DEFAULT_SETTINGS };
