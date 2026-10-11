import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Optimized for Vercel serverless + Supabase pooled connections.
// - connection_limit=1 per function instance (Supabase free tier allows ~20)
// - pool_timeout=10s to fail fast on pool exhaustion
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db