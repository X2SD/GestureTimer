# GestureTimer

A desktop app for timed sketch practice: load a folder of reference images, set a duration per image, navigate prev/next or shuffle, optional session length and repeat mode. Built with **Tauri 2** and **Vite**; UI and app logic live under `simple/src`.

**License: [MIT](LICENSE)** — use, modify, and redistribute freely; keep a copy of the license text when you share builds.

## Run from source

Requires [Node.js](https://nodejs.org/) and [Rust (rustup)](https://rustup.rs/).

```bash
git clone https://github.com/yangyan1999710-gif/GestureTimer.git
cd GestureTimer/simple
npm install
npm run tauri:dev
```

Production build (executable under `simple/src-tauri/target/release/`; optional NSIS installer on Windows):

```bash
cd simple
npm run build
npm run tauri:build
```

**Icons:** from the `simple` directory, generate `src-tauri/icons/` from a square PNG (see [Tauri icon guide](https://v2.tauri.app/develop/icons/)):

```bash
cd simple
npx tauri icon ../icon.png
```

Ensure `bundle` / `icon` paths in `tauri.conf.json` match the files under `icons/`.

## Repository layout

- Main app: **`simple/`**
- `main.py` at the repo root is an older/experimental script, unrelated to the Tauri build (you can ignore or remove it).

## Third-party

This project uses [Tauri](https://tauri.app/), [Vite](https://vitejs.dev/), and their dependencies; see each crate or npm package for license terms.

## Distribution

Unsigned Windows binaries may show SmartScreen “unknown publisher” — that is normal. For fewer warnings, use a code signing certificate. When sharing builds, include this **MIT license** or a link to this repository.
