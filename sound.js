// sound.js — reproducción de samples reales de teclado mecánico
"use strict";

const fs = require("fs");
const path = require("path");
const { execFile, execSync } = require("child_process");
const os = require("os");

// En macOS usamos afplay (CoreAudio, arranca ~5x más rápido que ffplay)
const USE_AFPLAY = os.platform() === "darwin";

const hasFfplay = (() => {
  if (USE_AFPLAY) return false;
  try {
    execSync("ffplay -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

// Buscar sounds en ~/.poe/sounds primero, luego relativo al script
const HOME_SOUNDS = path.join(process.env.HOME || "", ".poe", "sounds");
const LOCAL_SOUNDS = path.join(__dirname, "sounds");
const SOUNDS_DIR = fs.existsSync(HOME_SOUNDS) ? HOME_SOUNDS : LOCAL_SOUNDS;

// Mapa de tipos de tecla a archivo
const SOUND_MAP = {
  space: "space.mp3",
  enter: "enter.mp3",
  backspace: "backspace.mp3",
  key: ["key0.mp3", "key1.mp3", "key2.mp3", "key3.mp3", "key4.mp3"],
};

// Verificar qué archivos existen al arrancar
const available = {};
const checkSounds = () => {
  available.space = fs.existsSync(path.join(SOUNDS_DIR, SOUND_MAP.space));
  available.enter = fs.existsSync(path.join(SOUNDS_DIR, SOUND_MAP.enter));
  available.backspace = fs.existsSync(
    path.join(SOUNDS_DIR, SOUND_MAP.backspace),
  );
  available.keys = SOUND_MAP.key.filter((f) =>
    fs.existsSync(path.join(SOUNDS_DIR, f)),
  );
};

let keyIdx = 0;

const resolveSound = (type) => {
  if (type === "space" && available.space)
    return path.join(SOUNDS_DIR, SOUND_MAP.space);
  if (type === "enter" && available.enter)
    return path.join(SOUNDS_DIR, SOUND_MAP.enter);
  if (type === "backspace" && available.backspace)
    return path.join(SOUNDS_DIR, SOUND_MAP.backspace);
  if (available.keys && available.keys.length) {
    const file = available.keys[keyIdx % available.keys.length];
    keyIdx++;
    return path.join(SOUNDS_DIR, file);
  }
  return null;
};

const playSound = (type, cfg) => {
  if (!cfg.sound) return;
  const file = resolveSound(type);
  if (!file) return;

  if (USE_AFPLAY) {
    const vol = String(Math.max(0, Math.min(1, (cfg.soundVolume ?? 60) / 100)));
    execFile("afplay", ["-v", vol, file], { stdio: "ignore" });
  } else if (hasFfplay) {
    execFile(
      "ffplay",
      ["-nodisp", "-autoexit", "-loglevel", "quiet", "-volume", String(cfg.soundVolume ?? 60), file],
      { stdio: "ignore" },
    );
  }
};

const buildWavPool = () => { checkSounds(); };
const playClick = (cfg, type = "key") => playSound(type, cfg);

module.exports = { buildWavPool, playClick, playSound };
