# RxDesk

Offline prescription-writing app for private clinics (Windows 10/11, 64-bit).
The doctor or secretary enters the patient and medicines, then prints on a paper layout the doctor designed
inside the app. Arabic and English UI, mixed Arabic/English printouts. It works fully offline.

**Optional online version:** a clinic can sign in once (Settings → Online sync) and its data then syncs to an online
database (Supabase) whenever there is internet. The administrator manages every clinic from the **RxDesk Admin web
app** (hosted on Vercel): look up patients and reports, add drugs to a clinic's library, change a clinic's settings
and print layouts. See [Online version](#online-version-sync--admin-web-app).

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
| `npm run typecheck` | TypeScript checks for main, renderer and the web app |
| `npm run dev:web` | Run the admin web app locally (http://localhost:5180) |
| `npm run build:web` | Build the admin web app into `web/dist/` |
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
    shared/sync/          online sync: engine (pull / settings merge / push), table list, Supabase adapter
    main/sync/service.ts  desktop sign-in, encrypted session, background sync timers
  web/                    admin web app (Vite + React): reuses the renderer screens; SQLite runs in the
                          browser (sql.js) so the same Repo code serves every screen
  supabase/               database migrations and the admin-clinics edge function
  vercel.json             web app hosting (Vercel)
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
to Excel), `@supabase/supabase-js` (online sync, used only after the doctor signs in). Everything else is bundled
into the app at build time. The web app also uses `sql.js` (SQLite compiled to WebAssembly).

## Privacy

Offline by default: until the doctor signs in to online sync, the app makes no network requests (no telemetry).
After sign-in it talks only to the clinic's Supabase project. Fonts are bundled; the window cannot navigate to
other sites; the printing window has no access to Node.js.

## Online version (sync + admin web app)

```
 Clinic PC (RxDesk, SQLite)  ──sync when online──►  Supabase (Postgres + Auth)  ◄──  RxDesk Admin (web, Vercel)
```

- **Supabase project:** `ticujgmhqkfdgrnkgnmp` (URL and publishable key in `src/shared/sync/config.ts`; the key is
  public by design, every table is protected by row level security).
- **Database** (`supabase/migrations/`): `clinics` (one per doctor login), `platform_admins`, `admin_emails`
  (e-mails that become admins when they sign up) and `sync_rows`: one row per synced record
  (`clinic_id, tbl, uid, data jsonb, deleted, updated_at, updated_by, seq`). A trigger gives every write an
  increasing `seq` (the pull cursor) and refuses to replace a newer edit with an older one.
  RLS: a doctor reads/writes only their clinic's rows; an admin reads/writes all; nobody signed out sees anything.
- **Edge function `admin-clinics`** (`supabase/functions/`): admin-only create clinic + doctor login,
  reset password, disable/enable, delete. The service role key exists only inside Supabase.
- **Sync engine** (`src/shared/sync/engine.ts`): local triggers mark changed rows and record deletions; each round
  pulls online changes (newest edit wins), merges the shared settings per group, then pushes local changes.
  The desktop syncs on sign-in, every 2 minutes, ~5 s after a change and when the internet comes back.
- **Admin web app** (`web/`): the same screens as the desktop (patients, reports, drug library + Excel, print
  designer, settings). When the admin opens a clinic, its data is downloaded into an in-browser SQLite database and
  every change is saved online within a second; the clinic PC receives it on its next sync.

### First-time setup

1. **Admin account:** open the web app, choose "First time? Create the administrator account" and sign up with
   `loaymis41@gmail.com` (only e-mails listed in `admin_emails` become admins). If Supabase sends a confirmation
   e-mail, open the link, then sign in. Afterwards you can turn off new sign-ups in Supabase
   (Authentication → Sign In / Providers → "Allow new users to sign up") — clinics are created by the admin anyway.
2. **Clinic:** in the web app → New clinic → name, doctor e-mail and password.
3. **Doctor:** in RxDesk → Settings → Online sync → enter that e-mail and password. An existing PC uploads its data;
   a new PC (from the setup wizard's "Already have an online clinic account?") downloads the clinic.

### Deploying the web app on Vercel

1. Push this repository to GitHub (already done for this branch).
2. In Vercel: **Add New → Project → Import** the repository.
3. **Root Directory:** `rxdesk`. The rest comes from `rxdesk/vercel.json`
   (install `npm ci --ignore-scripts`, build `npm run build:web`, output `web/dist`).
4. Optional environment variables (only to point at another Supabase project):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
5. Deploy, then in Supabase → Authentication → URL Configuration set the **Site URL** to the Vercel address.

### Tests of the online part

- `npm test` includes the sync engine (fake server) and the in-browser database.
- `scripts/live-rls-test.mjs`: live security test (two throw-away clinics; each sees only its own data).
- `node scripts/e2e.mjs online`: desktop ↔ Supabase ↔ web app end to end (needs a test admin; see the file header).

### Costs and limits

Supabase's free plan **pauses a project after about a week without activity** and has storage limits; for real
clinics a paid plan is advisable (your decision). Vercel's free plan is enough for one admin.

