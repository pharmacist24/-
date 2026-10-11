import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Optimized for Vercel serverless + Supabase pooled connections. Pool size is
// controlled from DATABASE_URL (e.g. `?pgbouncer=true&connection_limit=1`).
export const db =
  globalForPrisma.prisma ??
  // The datasource URL is read from DATABASE_URL by Prisma on first query, so
  // importing this module never fails (e.g. during `next build`).
  new PrismaClient({
    log: ['warn', 'error'],
  })

// Reuse one client per warm serverless instance (and across dev hot reloads).
globalForPrisma.prisma = db
