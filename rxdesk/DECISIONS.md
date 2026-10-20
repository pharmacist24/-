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
