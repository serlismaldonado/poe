# poe

Editor de markdown minimalista para terminal. Sin distracciones.

```
node index.js archivo.md
```

## Características

- Focus mode — atenúa todo excepto la línea activa
- Syntax highlight de markdown (headings, bold, italic, code, links)
- Headings con jerarquía visual en escala de grises
- Marcadores `**` y `#` ocultos fuera de la línea activa
- Zen mode — texto centrado con ancho configurable
- Word wrap visual sin modificar el archivo
- Autosave con indicador en la barra de estado
- Undo / Redo (hasta 200 pasos)
- Búsqueda en tiempo real con Ctrl+F
- Sonido de teclado mecánico (requiere ffmpeg)
- Posición del cursor restaurada al reabrir el archivo

## Requisitos

- Node.js 14+
- ffmpeg (opcional, para sonido): `brew install ffmpeg`

## Instalación

```bash
git clone https://github.com/serlismaldonado/poe.git
cd poe
npm install   # no hay dependencias, solo inicializa el proyecto
```

### Sonido

Para instalar los samples de teclado mecánico automáticamente:

```bash
poe --install-sounds
```

Descarga samples de NK Cream desde el repo de [Mechvibes](https://github.com/hainguyents13/mechvibes) y los instala en `~/.poe/sounds/`. Requiere `git` instalado.

Para desactivar el sonido, pon `"sound": false` en `settings.json`.

## Atajos

| Atajo | Acción |
|---|---|
| `Ctrl+S` | Guardar |
| `Ctrl+Z` | Deshacer |
| `Ctrl+Y` | Rehacer |
| `Ctrl+F` | Buscar |
| `Ctrl+G` | Ir a línea |
| `Ctrl+H` | Ayuda |
| `Ctrl+B` | Negrita |
| `Ctrl+O` | Cursiva |
| `Ctrl+D` | Duplicar línea |
| `Ctrl+K` | Borrar línea |
| `Ctrl+A` | Seleccionar todo |
| `Shift+↑↓←→` | Selección |
| `Alt+↑↓` | Mover línea |
| `Tab` / `Shift+Tab` | Indentar / desindentar |
| `Ctrl+Q` | Salir |

## Configuración

Crea un `settings.json` en la misma carpeta que tu archivo:

```json
{
  "wrapColumn":    80,
  "tabSize":        2,
  "autosaveMs":   500,
  "fadeGray":     244,
  "cursorBlinkMs": 600,
  "sound":        true,
  "soundVolume":   60,
  "h1Gray":       255,
  "h2Gray":       248,
  "h3Gray":       242,
  "boldGray":     255,
  "italicGray":   245,
  "searchBg":      58
}
```

## Estructura

```
poe/
├── index.js      — entrada y manejo de input
├── state.js      — estado compartido
├── settings.js   — carga de configuración
├── terminal.js   — helpers ANSI y colores
├── sound.js      — síntesis y reproducción de sonido
├── render.js     — syntax highlight y dibujo de pantalla
└── editor.js     — lógica de edición, movimiento y búsqueda
```

## Licencia

MIT
