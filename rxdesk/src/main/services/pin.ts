import crypto from 'crypto'

// PIN codes are stored as "salt:hash" using scrypt; the PIN itself is never saved.

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(pin, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = (stored || '').split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(pin, salt, 32)
  const expected = Buffer.from(hash, 'hex')
  return expected.length === test.length && crypto.timingSafeEqual(test, expected)
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin)
}

/** Slows down guessing: after 5 wrong attempts, wait 30 seconds. */
export class PinThrottle {
  private failures = 0
  private blockedUntil = 0

  check(now = Date.now()): number {
    return Math.max(0, this.blockedUntil - now)
  }

  fail(now = Date.now()): void {
    this.failures += 1
    if (this.failures >= 5) {
      this.blockedUntil = now + 30_000
      this.failures = 0
    }
  }

  success(): void {
    this.failures = 0
    this.blockedUntil = 0
  }
}
