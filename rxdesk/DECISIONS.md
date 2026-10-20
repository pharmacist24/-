# Design decisions

Choices made where the brief was open, picking the simplest option for a non-technical doctor.

## Project
- **Location**: the repository already contained an unrelated web project (MediPrice), so RxDesk lives in its own
  `rxdesk/` folder and does not touch the existing files.
- **Versions**: pinned to mature, widely used major versions (Electron 38, React 18, Mantine 7, Vite 6,
  TypeScript 5, better-sqlite3 12) rather than the newest majors, to reduce risk. All versions are exact.
- **Build tool**: `electron-vite` drives Vite for the main, preload and renderer bundles.

## Data
- Database: `%APPDATA%\RxDesk\rxdesk.db` (SQLite, WAL mode). Logs: `%APPDATA%\RxDesk\logs\rxdesk.log`.
  Automatic backups default to `%APPDATA%\RxDesk\backups`.
- Migrations are numbered and tracked with SQLite's `PRAGMA user_version`. Before any upgrade of an existing
  database a copy is saved to the backups folder (`pre-upgrade-vN-*.db`). A database from a *newer* app version
  is refused with a clear message instead of being damaged.
- **Age vs date of birth**: when only an age is typed, an estimated birth date is stored (flagged as estimated)
  so the age stays correct on later visits.
- Each prescription stores a snapshot of the patient's name/age/weight at the time it was written, so reprinting an
  old prescription shows the same values.
- Arabic search is normalised (أ/إ/آ → ا, ة → ه, ى → ي, diacritics removed, Arabic digits → Latin) so
  "احمد" finds "أحمد". Words can be typed in any order.

## Printing
- **One engine for designer, preview, print and PDF** (`src/shared/layout/engine.ts`). The renderer builds the final
  HTML (fonts embedded as data URLs, no scripts); the main process loads exactly that HTML into a hidden window and
  calls `webContents.print()` or `printToPDF()`. The preview shows the same HTML in an iframe.
- **Multi-page medicines**: each medicine is measured with the real fonts in a hidden frame, then medicines are
  split so the block never overflows its box. Continuation pages repeat the whole layout (letterhead, patient
  name…). Elements default to "all pages", except advice, lab tests, next visit, signature and QR code which print
  on the last page only (each element can be changed in the designer).
- **Empty fields**: diagnosis, advice, lab tests, next visit and clinic details are hidden when empty (no lonely
  labels). Patient fields (name, age, sex, weight) keep their label so the doctor can hand-write a value.
- **Long text** is never cut off: text may run past its box so nothing is silently lost; the preview shows it.
- **Printer calibration** (X/Y offset) only affects real printing. Preview and PDF show the page as designed.
- **Preview = print**: the preview never shows the letterhead background unless the layout is set to print it.
- **Printing always uses the saved prescription**, so a reprint is identical to the original. Print and PDF save
  the prescription first if needed.
- The "Rx" symbol is drawn with bundled fonts (R + subscript x) instead of the ℞ character, which most fonts lack.
- Mixed text: drug lines are always left-to-right; instructions, notes and patient fields use automatic direction
  per paragraph and `<bdi>` isolation, so Arabic and English never scramble each other.
- Date inputs use day/month/year regardless of the Windows locale; printed dates are dd/mm/yyyy.

## Print Format Designer
- The canvas shows each element using the exact HTML the printer gets (`renderElement`), with a transparent
  "hit box" on top for dragging, so designer and print cannot drift apart (an e2e test compares positions).
- Snapping: alignment guides (page edges/centre, margins, other elements' edges and centres) win over the grid.
  Hold **Alt** while dragging to place freely.
- Changing the paper size scales element positions and sizes proportionally; font sizes stay the same.
- Only one medicines block per layout (it is the block that flows onto extra pages). Clicking "Medicines" in the
  palette when one exists just selects it.
- Margins are guides for alignment/snapping only; they never clip content.
- Background images are compressed to JPEG (max 2400 px) and stored inside the layout, so an exported layout file
  carries its letterhead with it. Exported layouts use the `.rxlayout` extension (JSON).
- Undo/redo keeps the last 100 steps; a whole drag, or typing in one box, is one step.

## Backup, export, security
- A backup is a `.zip` with a consistent copy of the database (SQLite online backup) plus `manifest.json`.
  Restore accepts that `.zip` or a raw `.db`, validates it (integrity check, schema version) and always saves a
  `before-restore-…zip` safety copy of the current data first.
- Automatic backup runs once per day (checked at start-up and every hour) into the chosen folder, keeping the last
  14 (`RxDesk-auto-*.zip`; other files in the folder are never touched). If the chosen folder (e.g. a USB stick) is
  missing, the backup goes to the default folder and the user is told.
- "Export to Excel" writes UTF-8 CSV with a BOM so Arabic opens correctly in Excel; cells that look like formulas
  are neutralised.
- PIN: 4–8 digits, stored as a salted scrypt hash. While locked, the main process refuses every data request (not
  just the UI). After 5 wrong attempts the app waits 30 seconds. A forgotten PIN can only be cleared by restoring a
  backup made before the PIN was set (documented in the user guide) — there is no back door.
