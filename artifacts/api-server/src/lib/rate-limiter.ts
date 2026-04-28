import { logger } from "./logger";

/**
 * rate-limiter.ts
 * Prevents customers from spamming orders or triggering bot loops.
 * 
 * Uses sliding window algorithm for accurate rate limiting
 */

interface RateLimitEntry {
  timestamps: number[];
  blockedUntil?: number;
}

/**
 * In-memory rate limiter (suitable for single server)
 * For multi-server deployments, use Redis-backed rate limiter
 */
export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private limits: {
    maxRequests: number;
    windowMs: number;
    blockDurationMs: number;
  };

  constructor(
    maxRequests: number = 10,      // Max 10 requests
    windowMs: number = 60000,      // Per 60 seconds
    blockDurationMs: number = 5000, // Block for 5 seconds if exceeded
  ) {
    this.limits = { maxRequests, windowMs, blockDurationMs };

    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if identifier is rate limited
   * Returns true if limited, false if allowed
   */
  isLimited(identifier: string): boolean {
    const entry = this.store.get(identifier);
    const now = Date.now();

    // Check if currently blocked
    if (entry?.blockedUntil && now < entry.blockedUntil) {
      logger.debug(
        { identifier, blockedUntil: new Date(entry.blockedUntil) },
        "Rate limit: blocked (temporary ban)",
      );
      return true;
    }

    if (!entry) {
      // First request from this identifier
      this.store.set(identifier, { timestamps: [now] });
      return false;
    }

    // Remove timestamps outside the window
    const windowStart = now - this.limits.windowMs;
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    // Check if we've exceeded the limit
    if (entry.timestamps.length >= this.limits.maxRequests) {
      // Exceeded! Block future requests
      entry.blockedUntil = now + this.limits.blockDurationMs;
      logger.warn(
        {
          identifier,
          count: entry.timestamps.length,
          limit: this.limits.maxRequests,
          blockDurationMs: this.limits.blockDurationMs,
        },
        "Rate limit: exceeded, blocking requests",
      );
      return true;
    }

    // Record this request
    entry.timestamps.push(now);
    return false;
  }

  /**
   * Get current request count for an identifier
   */
  getRequestCount(identifier: string): number {
    const entry = this.store.get(identifier);
    if (!entry) return 0;

    const now = Date.now();
    const windowStart = now - this.limits.windowMs;
    return entry.timestamps.filter((ts) => ts > windowStart).length;
  }

  /**
   * Reset limiter for a specific identifier
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
    logger.debug({ identifier }, "Rate limit reset");
  }

  /**
   * Clean up old entries to prevent memory leak
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [id, entry] of this.store.entries()) {
      // Remove if:
      // 1. No timestamps and not blocked, OR
      // 2. All timestamps are outside window and not currently blocked
      const windowStart = now - this.limits.windowMs;
      const recentTimestamps = entry.timestamps.filter((ts) => ts > windowStart);

      if (
        (recentTimestamps.length === 0 && !entry.blockedUntil) ||
        (recentTimestamps.length === 0 && entry.blockedUntil && now > entry.blockedUntil)
      ) {
        this.store.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug({ removed }, "Rate limiter: cleaned up old entries");
    }
  }

  /**
   * Get stats for monitoring
   */
  getStats(): {
    entriesCount: number;
    limits: typeof this.limits;
  } {
    return {
      entriesCount: this.store.size,
      limits: this.limits,
    };
  }
}

/**
 * Create per-customer rate limiter
 * Prevents spam: max 10 messages per minute per customer
 */
export const customerRateLimiter = new RateLimiter(
  10,      // 10 messages max
  60000,   // per 60 seconds
  5000,    // block for 5 seconds if exceeded
);

/**
 * Create per-vendor rate limiter for admin commands
 * Prevents abuse: max 20 admin commands per minute
 */
export const adminCommandLimiter = new RateLimiter(
  20,      // 20 commands max
  60000,   // per 60 seconds
  10000,   // block for 10 seconds if exceeded
);

/**
 * Check if customer should be rate limited
 * Returns true if they should be ignored
 */
export function shouldRateLimitCustomer(customerPhone: string): boolean {
  return customerRateLimiter.isLimited(customerPhone);
}

/**
 * Check if admin command should be rate limited
 */
export function shouldRateLimitAdminCommand(vendorId: string): boolean {
  return adminCommandLimiter.isLimited(vendorId);
}
