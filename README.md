# GestureTimer · 速写计时器

A minimal desktop timer for **gesture / figure‑drawing practice**: load a folder of reference images, set a duration per image, and draw. The app advances images on a timer (sequential or shuffled), tracks your total practice time, and stays out of your way so your eyes stay on the artwork.

> 导入一个图片文件夹，设定每张的练习时长，专注画画。计时结束自动翻页，支持随机抽取、累计练习时长与重复练习。

**Built with [Tauri 2](https://v2.tauri.app/) + [Vite](https://vitejs.dev/)** · **License: [MIT](LICENSE)** · **Version 1.2.0**

---

## Features

- **Folder‑based practice** — point it at any folder; it loads `JPG · PNG · GIF · WebP · BMP`. You can also drag a folder onto the window.
- **Per‑image timer** — quick presets (30s / 1m / 2m / 5m) with a one‑tap dropdown; auto‑advances when time is up.
- **Sequential or shuffle** — step through prev/next, or let it draw randomly. Optional *repeat* mode controls whether images can recur.
- **Session length** — set a total practice duration (by played time); the app reminds you when you’re done.
- **Distraction‑free dark UI** — a floating, iOS‑inspired control bar with muted, low‑contrast colors so the toolbar never competes with the reference image. During playback the bar collapses to just the countdown.
- **Always‑on‑top toggle** — `Ctrl+Shift+T` (`Cmd+Shift+T` on macOS) to keep the window above others while you draw.
- **Local‑only & private** — runs entirely on your machine; collects no data.

## Download & run

Grab the latest Windows build from the [Releases](https://github.com/X2SD/GestureTimer/releases) page:

- `GestureTimer_<version>_x64-setup.exe` — installer, or
- the portable `gesture-timer.exe`.

> Unsigned Windows binaries may trigger SmartScreen’s “unknown publisher” notice — that’s expected for self‑built apps. Choose *More info → Run anyway*, or sign the binary with a code‑signing certificate for fewer warnings.

## Build from source

Requires [Node.js](https://nodejs.org/) and [Rust (rustup)](https://rustup.rs/).

```bash
git clone https://github.com/X2SD/GestureTimer.git
cd GestureTimer/simple
npm install
npm run tauri:dev      # run in dev mode
```

Production build — executable lands in `simple/src-tauri/target/release/`, with an NSIS installer under `…/release/bundle/nsis/` on Windows:

```bash
cd simple
npm run tauri:build
```

**Icons** — regenerate `src-tauri/icons/` from a square PNG (see the [Tauri icon guide](https://v2.tauri.app/develop/icons/)):

```bash
cd simple
npx tauri icon ../icon.png
```

Make sure the `bundle.icon` paths in `tauri.conf.json` match the files under `icons/`.

## Project layout

```
simple/                  # the app
├─ index.html            # markup / entry
├─ src/                  # frontend: main.js → bridge.js + _app_tail.js, styles.css
└─ src-tauri/            # Rust side: pick_folder / list_images_in_folder / read_image_data_url
icon.png, icon.ico       # source icons
LICENSE                  # MIT
```

`main.py` at the repository root is an older experimental script, unrelated to the Tauri build — safe to ignore.

## Tech & third‑party

[Tauri](https://tauri.app/), [Vite](https://vitejs.dev/), and their dependencies; each crate / npm package carries its own license terms.

## License

[MIT](LICENSE) — use, modify, and redistribute freely. It’s a free, non‑commercial tool; please keep a copy of the license (or a link to this repo) when you share builds.
