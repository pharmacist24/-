# MediPrice — Hospital Pharmacy Drug Pricing System

A responsive hospital pharmacy drug pricing system with two interfaces:
a **Pharmacist Quick Lookup** (instant price search) and an **Admin Panel**
(full CRUD catalog management). Built with Next.js 16, TypeScript, Tailwind CSS,
shadcn/ui, Prisma (SQLite), and the z-ai-web-dev-sdk.

## Features

### Pharmacist Interface (10 research functions)
1. **Instant search** by brand or generic name
2. **Dosage form filter chips** (Tablet / Vial / Syrup …)
3. **Manufacturer filter** dropdown
4. **Sort** (Name A–Z, Price ↑, Price ↓)
5. **Price range filter** (min/max IQD)
6. **Favorites** — star drugs, filter to starred, persisted
7. **Recently viewed** — auto-tracked, persisted
8. **Dispensing calculator** — quantity × unit price
9. **Copy unit price** to clipboard
10. **Generic equivalents** lookup + **Reset all filters**

Expanding a row reveals pack price, units per pack, and a derived per-unit price.

### Admin Interface
- Password gate (demo password: `admin123`)
- Full 7-column data table with sticky header + sticky Actions column
- Add / Edit / Delete with form validation (zod)
- Search across all fields + dosage form & company filters
- Reset catalog to seed data

## Data Model

Each drug record has 7 fields (from the original Excel import):

| Field | Description |
|-------|-------------|
| `ITEM` | Drug brand name |
| `GENERIC NAME` | Generic name |
| `DOSAGE FORM` | Tablet, Syrup, Vial, Capsule, Injection … |
| `UNIT PRICE` | Price per unit (IQD) |
| `COMPANY` | Manufacturer |
| `PRICE OF PACK` | Price per pack (IQD) |
| `NO OF TAB PER BACK` | Units per pack |

See `prisma/schema.prisma` for the Prisma `Drug` model.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **Database**: Prisma ORM + SQLite
- **State**: Zustand (catalog via API; favorites/recently-viewed in localStorage)
- **Forms**: react-hook-form + zod
- **Icons**: lucide-react

## Getting Started

```bash
# Install dependencies
bun install

# Set up the database (creates tables + seeds 177 drug records)
bun run db:push
bun run db:seed

# Start the dev server
bun run dev
```

Open <http://localhost:3000>.

## Database

The catalog is backed by SQLite via Prisma. The database is the single source
of truth; the frontend reads and writes through `/api/drugs`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/drugs` | List all drugs (`?q=term` to search) |
| `POST` | `/api/drugs` | Create a new drug |
| `PUT` | `/api/drugs/[id]` | Update an existing drug |
| `DELETE` | `/api/drugs/[id]` | Delete a single drug |
| `DELETE` | `/api/drugs` | Reset catalog to seed data |

### Re-seeding the database

```bash
bun run db:push     # sync schema
bun run db:seed     # upsert 177 drugs from src/lib/drug-data.ts
```

The seed data was imported from `upload/اسعار_2026_reorganized.xlsx` (2 sheets,
177 records, prices in IQD).

## Admin Access

The demo admin password is `admin123`. It is a client-side check for the demo;
replace it with proper authentication (e.g. NextAuth.js) before production use.
