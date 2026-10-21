# RxDesk

Offline prescription-writing app for private clinics (Windows 10/11, 64-bit).
The doctor or secretary enters the patient and medicines, then prints on a paper layout the doctor designed
inside the app. Arabic and English UI, mixed Arabic/English printouts, no internet, no account.

- Doctor/secretary guide (Arabic + English): [USER_GUIDE.md](USER_GUIDE.md)
- Design decisions: [DECISIONS.md](DECISIONS.md)

## Quick start (developers)

Requirements: Node.js 22+ and npm. Windows, macOS or Linux for development.

```bash
cd rxdesk
npm install          # also builds the SQLite native module for Electron
npm run dev          # start the app with hot reload
```

(On Linux as root, e.g. in a container, Chromium needs `npx electron-vite dev -- --no-sandbox`.)

| Command | What it does |
|---|---|
| `npm run dev` | Run the app in development mode |
| `npm run build` | Build main, preload and renderer into `out/` |
| `npm start` | Run the built app |
| `npm test` | Unit tests (database layer, layout/print engine, pagination, snapping, backup, PIN, CSV) |
| `npm run typecheck` | TypeScript checks for main and renderer |
| `npm run e2e` | End-to-end walkthrough of the real app with Playwright (screenshots in `test-output/`). On Linux without a display: `xvfb-run -a npm run e2e` |
| **`npm run dist`** | **Build the Windows installer `dist/RxDesk-Setup-1.0.0.exe`** |

## Building the installer

```bash
cd rxdesk
npm install
npm run dist
```

Output: **`dist/RxDesk-Setup-<version>.exe`** – one file. The doctor double-clicks it and is done:

- installs for the current user only, **no administrator rights** (`%LOCALAPPDATA%\Programs\rxdesk`)
- one click, no questions; creates **Desktop** and **Start Menu** shortcuts; starts RxDesk when finished
- adds "RxDesk" to *Settings → Apps* with an uninstaller; uninstalling never deletes patient data

The installer can be built on Windows, macOS or Linux. When built on Linux/macOS, an `afterPack` hook
(`scripts/after-pack.cjs`) swaps in the official Windows build of the SQLite module for the bundled Electron version
and refuses to produce an installer containing a non-Windows binary. Building on Linux needs Wine for editing the
exe's icon/version info (`apt install wine`).

The installer is not code-signed (a certificate is a paid service). The first time, Windows SmartScreen may show
"Windows protected your PC": click **More info → Run anyway**.

To change the version, edit `"version"` in `package.json`.

## Where data is stored

| What | Where |
|---|---|
| Database (patients, prescriptions, drugs, layouts, settings) | `%APPDATA%\RxDesk\rxdesk.db` (SQLite) |
| Automatic daily backups (default folder) | `%APPDATA%\RxDesk\backups\` |
| Log file | `%APPDATA%\RxDesk\logs\rxdesk.log` |
| Program files | `%LOCALAPPDATA%\Programs\rxdesk\` |

Data lives outside the install folder, so it survives updates, uninstall and reinstall. The data folder can be
opened from *Settings → About → Open data folder*.
For testing, the environment variable `RXDESK_DATA_DIR` points the app at another data folder.

## Backups

- **Backup now**: *Settings → Backup & data → Backup now…* writes `RxDesk-backup-<date>.zip` anywhere
  (e.g. a USB stick). The zip contains a consistent copy of the database and a manifest.
- **Automatic**: once a day into the chosen folder, keeping the last 14 (configurable).
- **Restore**: *Restore from backup…*, pick a `.zip` (or `.db`), confirm. A safety copy of the current data is
  always saved to the backups folder first (`before-restore-…zip`).
- Copying `rxdesk.db` while the app is closed is also a valid backup.

## Updates and database migrations

Schema changes are numbered migrations in `src/main/db/migrations.ts` (tracked with SQLite `PRAGMA user_version`).
To change the schema, **append** a migration with the next version number; never edit a shipped one. Before
upgrading an existing database, the app copies it to `backups/pre-upgrade-v<N>-….db`. A database made by a newer app
version is refused with a clear message. Installing a newer `RxDesk-Setup-x.y.z.exe` over the old one keeps all data.

## Project structure

```
rxdesk/
  src/
    main/                 Electron main process
      index.ts            app start, window, IPC dispatcher, PIN gate
      handlers.ts         every API call the UI can make
      state.ts            open/replace database, automatic backup
      logger.ts           log file
      db/                 SQLite: migrations, repository (all queries), seed data
      services/           print & PDF, backup/restore, PIN hashing, CSV
    preload/              narrow, typed bridge (one IPC channel)
    shared/               code used by both sides
      types.ts, api.ts    data types and the API contract
      text.ts             Arabic search normalisation, ages, dates, allergy matching
      layout/             THE layout engine (designer + print use the same code)
        types.ts          layout model (mm / pt)
        engine.ts         renders layout + data to HTML, pagination
        defaults.ts       element factory, built-in A4/A5 layouts, layout normaliser
        snap.ts           designer snapping / alignment guides
        qr.ts             QR code as SVG
    renderer/src/         React + Mantine UI (RTL aware)
      screens/            prescription, patients, library, designer, reports, settings, wizard, lock
      designer/           canvas, palette, property panels, undo/redo
      print/              measuring/pagination in a hidden frame, preview modal, print/PDF hook
      i18n/               Arabic and English strings
      assets/fonts/       bundled fonts (Cairo, Noto Naskh Arabic, Amiri, Roboto)
  tests/                  vitest unit tests
  scripts/                e2e walkthrough, after-pack hook
  build/                  installer icon
  resources/              window icon
  electron-builder.yml    installer configuration
```

## How printing works

1. The renderer takes the layout (JSON) and the prescription and asks the shared engine for HTML at the exact paper
   size (`@page` in mm, fonts embedded as data URLs, no scripts).
2. Medicines are measured with the real fonts in a hidden frame and split across pages so the medicines box never
   overflows; continuation pages repeat the letterhead.
3. Preview shows that HTML; **Print** sends the same HTML to the main process, which loads it in a hidden window
   and calls `webContents.print()` (silent to the default printer, or with the Windows dialog) or `printToPDF()`.
   The printer calibration offset is applied only for real printing.

The designer canvas renders every element with the same engine function, so the designer, the preview and the paper
match (an e2e test compares element positions between the designer and the preview).

## Dependencies

Runtime: `better-sqlite3` (database), `jszip` (backups), `qrcode` (QR codes), `exceljs` (drug import/export
to Excel). Everything else is bundled into the app at build time. No dependency makes network requests.

## Privacy

100% offline: no network requests, no telemetry, no accounts. Fonts are bundled; the window cannot navigate to
other sites; the printing window has no access to Node.js.
