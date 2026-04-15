#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

// ─── Comando --install-sounds ─────────────────────────────────────────────────
if (process.argv[2] === "--install-sounds") {
  const { execSync } = require("child_process");
  const os = require("os");

  const SOUNDS_DIR = path.join(os.homedir(), ".poe", "sounds");
  const TMP_DIR = path.join(os.tmpdir(), "mechvibes-sounds-" + Date.now());

  const log = (msg) => process.stdout.write(msg + "\n");
  const ok = (msg) => log("✓ " + msg);
  const fail = (msg) => {
    log("✗ " + msg);
    process.exit(1);
  };

  log("\nInstalando samples de teclado mecánico (NK Cream)...\n");

  // Verificar git
  try {
    execSync("git --version", { stdio: "ignore" });
  } catch {
    fail("git no encontrado. Instala git primero.");
  }

  // Clonar solo lo necesario
  try {
    log("  Descargando desde github.com/hainguyents13/mechvibes...");
    execSync(
      `git clone --depth 1 --filter=blob:none --sparse https://github.com/hainguyents13/mechvibes.git ${TMP_DIR}`,
      { stdio: "ignore" },
    );
    execSync(
      `git -C ${TMP_DIR} sparse-checkout set src/audio/cream-travel/press`,
      { stdio: "ignore" },
    );
    ok("Descarga completa");
  } catch {
    fail("Error al clonar el repositorio. Verifica tu conexión a internet.");
  }

  const SRC = path.join(TMP_DIR, "src", "audio", "cream-travel", "press");

  // Verificar que los archivos existen
  if (!fs.existsSync(SRC)) {
    fail("No se encontraron los archivos de audio en el repositorio.");
  }

  // Crear directorio destino
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });

  // Copiar y renombrar
  const MAP = {
    "GENERIC_R0.mp3": "key0.mp3",
    "GENERIC_R1.mp3": "key1.mp3",
    "GENERIC_R2.mp3": "key2.mp3",
    "GENERIC_R3.mp3": "key3.mp3",
    "GENERIC_R4.mp3": "key4.mp3",
    "SPACE.mp3": "space.mp3",
    "ENTER.mp3": "enter.mp3",
    "BACKSPACE.mp3": "backspace.mp3",
  };

  let copied = 0;
  for (const [src, dst] of Object.entries(MAP)) {
    const srcPath = path.join(SRC, src);
    const dstPath = path.join(SOUNDS_DIR, dst);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, dstPath);
      copied++;
    }
  }

  // Limpiar tmp
  try {
    execSync(`rm -rf ${TMP_DIR}`, { stdio: "ignore" });
  } catch {}

  if (copied === 0) fail("No se pudo copiar ningún archivo.");

  ok(`${copied} samples copiados a ${SOUNDS_DIR}`);
  log("\nYa puedes escribir con sonido. Abre cualquier archivo con:\n");
  log("  poe archivo.md\n");
  process.exit(0);
}

const state = require("./state");
const cfg_mod = require("./settings");
const T = require("./terminal");
const { render, blinkTick } = require("./render");
const { buildWavPool } = require("./sound");
const editor = require("./editor");

// ─── Inicializar estado ───────────────────────────────────────────────────────
const filename = process.argv[2] || "untitled.md";
state.fullPath = path.resolve(filename);
state.lines = fs.existsSync(state.fullPath)
  ? fs.readFileSync(state.fullPath, "utf-8").split("\n")
  : [""];
state.cfg = cfg_mod.load(state.fullPath);

// ─── Resize ───────────────────────────────────────────────────────────────────
process.on("SIGWINCH", () => {
  T.updateDimensions();
  render();
});

// ─── Input ───────────────────────────────────────────────────────────────────
process.stdin.setRawMode(true);
process.stdin.resume();

// Buffer para bracketed paste — el texto puede llegar en múltiples chunks
let pasteBuffer = null; // null = no estamos en modo paste
let pasteTimeout = null;

const flushPaste = () => {
  if (pasteBuffer !== null) {
    editor.handlePaste(pasteBuffer);
    pasteBuffer = null;
    pasteTimeout = null;
  }
};

process.stdin.on("data", (buffer) => {
  const code = buffer.toString();

  // Acumulador de bracketed paste
  if (pasteBuffer !== null) {
    // Buscar el cierre \x1b[201~ en el chunk actual
    const closeIdx = code.indexOf("\x1b[201~");
    if (closeIdx !== -1) {
      pasteBuffer += code.slice(0, closeIdx);
      clearTimeout(pasteTimeout);
      flushPaste();
    } else {
      pasteBuffer += code;
      // Timeout de seguridad por si el cierre nunca llega
      clearTimeout(pasteTimeout);
      pasteTimeout = setTimeout(flushPaste, 100);
    }
    return;
  }

  // Inicio de bracketed paste
  if (code.startsWith("\x1b[200~")) {
    const rest = code.slice(6);
    const closeIdx = rest.indexOf("\x1b[201~");
    if (closeIdx !== -1) {
      // Abrió y cerró en el mismo chunk
      editor.handlePaste(rest.slice(0, closeIdx));
    } else {
      // El cierre vendrá en chunks posteriores
      pasteBuffer = rest;
      pasteTimeout = setTimeout(flushPaste, 100);
    }
    return;
  }

  if (state.searchMode) {
    editor.handleSearchInput(code);
    return;
  }
  if (state.gotoMode) {
    editor.handleGotoInput(code);
    return;
  }

  // Ctrl+V — leer clipboard del sistema
  if (code === "\x16") {
    try {
      const { execSync } = require("child_process");
      let clip = "";
      if (process.platform === "darwin") {
        clip = execSync("pbpaste", { encoding: "utf-8" });
      } else if (process.platform === "win32") {
        clip = execSync("powershell -command Get-Clipboard", {
          encoding: "utf-8",
        });
      } else {
        try {
          clip = execSync("xclip -selection clipboard -o", {
            encoding: "utf-8",
          });
        } catch {
          clip = execSync("xsel --clipboard --output", { encoding: "utf-8" });
        }
      }
      if (clip) {
        editor.handlePaste(clip);
        return;
      }
    } catch {}
    return;
  }

  // Paste como buffer largo sin escape (Windows Terminal)
  if (code.length > 1 && !code.startsWith("\x1b")) {
    editor.handlePaste(code);
    return;
  }

  // ── Ctrl ──────────────────────────────────────────────────────────────────
  if (code === "\x01") {
    editor.selectAll();
    return;
  } // Ctrl+A
  if (code === "\x02") {
    editor.wrapInline("**");
    return;
  } // Ctrl+B negrita
  if (code === "\x04") {
    editor.duplicateLine();
    return;
  } // Ctrl+D
  if (code === "\x06") {
    editor.enterSearch();
    return;
  } // Ctrl+F
  if (code === "\x07") {
    editor.enterGoto();
    return;
  } // Ctrl+G
  if (code === "\x08") {
    state.helpMode = !state.helpMode;
    render();
    return;
  } // Ctrl+H ayuda
  if (code === "\x09") {
    editor.handleTab();
    return;
  } // Tab
  if (code === "\x0b") {
    editor.killLine();
    return;
  } // Ctrl+K
  if (code === "\x0f") {
    editor.wrapInline("*");
    return;
  } // Ctrl+O cursiva
  if (code === "\x12") {
    editor.redo();
    return;
  } // Ctrl+R
  if (code === "\x13") {
    editor.save();
    return;
  } // Ctrl+S
  if (code === "\x19") {
    editor.redo();
    return;
  } // Ctrl+Y rehacer
  if (code === "\x1a") {
    editor.undo();
    return;
  } // Ctrl+Z

  // Salir
  if (code === "\x11" || code === "\x03") {
    editor.savePosition();
    process.stdout.write("\x1b[?2004l");
    process.stdout.write("\x1b[?25h");
    process.exit(0);
  }

  if (code === "\r") {
    editor.handleEnter();
    return;
  }
  if (code === "\x7f" || code === "\b") {
    editor.handleBackspace();
    return;
  }

  // ── Flechas ───────────────────────────────────────────────────────────────
  if (code === "\x1b[A") {
    editor.handleUp();
    return;
  }
  if (code === "\x1b[B") {
    editor.handleDown();
    return;
  }
  if (code === "\x1b[C") {
    editor.handleRight();
    return;
  }
  if (code === "\x1b[D") {
    editor.handleLeft();
    return;
  }

  // Shift+flechas — selección
  if (code === "\x1b[1;2A") {
    editor.handleUp(true);
    return;
  }
  if (code === "\x1b[1;2B") {
    editor.handleDown(true);
    return;
  }
  if (code === "\x1b[1;2C") {
    editor.handleRight(true);
    return;
  }
  if (code === "\x1b[1;2D") {
    editor.handleLeft(true);
    return;
  }
  if (code === "\x1b[1;2H") {
    editor.handleHome(true);
    return;
  }
  if (code === "\x1b[1;2F") {
    editor.handleEnd(true);
    return;
  }

  // Home / End / PgUp / PgDn / Del
  if (code === "\x1b[H" || code === "\x1b[1~") {
    editor.handleHome();
    return;
  }
  if (code === "\x1b[F" || code === "\x1b[4~") {
    editor.handleEnd();
    return;
  }
  if (code === "\x1b[5~") {
    editor.handlePageUp();
    return;
  }
  if (code === "\x1b[6~") {
    editor.handlePageDown();
    return;
  }
  if (code === "\x1b[3~") {
    editor.handleDelete();
    return;
  }

  // Ctrl+← / Ctrl+→
  if (code === "\x1b[1;5D" || code === "\x1b[5D" || code === "\x1bb") {
    editor.deselect();
    editor.wordLeft();
    editor.playNav();
    render();
    return;
  }
  if (code === "\x1b[1;5C" || code === "\x1b[5C" || code === "\x1bf") {
    editor.deselect();
    editor.wordRight();
    editor.playNav();
    render();
    return;
  }

  // Ctrl+Home / Ctrl+End
  if (code === "\x1b[1;5H") {
    editor.handleCtrlHome();
    return;
  }
  if (code === "\x1b[1;5F") {
    editor.handleCtrlEnd();
    return;
  }

  // Alt+↑ / Alt+↓
  if (code === "\x1b[1;3A" || code === "\x1b\x1b[A") {
    editor.moveLineUp();
    return;
  }
  if (code === "\x1b[1;3B" || code === "\x1b\x1b[B") {
    editor.moveLineDown();
    return;
  }

  // Shift+Tab
  if (code === "\x1b[Z") {
    editor.handleShiftTab();
    return;
  }

  // Caracteres normales
  if (code.length === 1 && code.charCodeAt(0) >= 32) {
    editor.handleChar(code);
  }
});

// ─── Blink ───────────────────────────────────────────────────────────────────
state.blinkInterval = setInterval(blinkTick, state.cfg.cursorBlinkMs);

// ─── Init ────────────────────────────────────────────────────────────────────
setTimeout(() => {
  T.out("\x1b[?25h");
  T.out("\x1b[?2004h");
  buildWavPool();
  editor.restorePosition();
  render();
}, 0);

process.on("exit", () => {
  if (state.blinkInterval) clearInterval(state.blinkInterval);
  if (state.saveTimeout) clearTimeout(state.saveTimeout);
  process.stdin.setRawMode(false);
  T.out("\x1b[?2004l");
  T.out("\x1b[?25h");
});
