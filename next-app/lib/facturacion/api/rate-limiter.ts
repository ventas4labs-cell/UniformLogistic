// ─── Facturacion Electronica CR v4.4 — Token Bucket Rate Limiter ─────────
//
// Hacienda enforces a rate limit; exceeding ~20 req/s risks an IP block.
// This module implements a token-bucket algorithm shared across all callers
// via a singleton instance.

const MAX_TOKENS = 20;
const REFILL_RATE = 20; // tokens per second
const REFILL_INTERVAL_MS = 1000 / REFILL_RATE; // ms per token (50 ms)

class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private waitQueue: Array<() => void> = [];
  private refillTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.tokens = MAX_TOKENS;
    this.lastRefill = Date.now();
    this.startRefillLoop();
  }

  /**
   * Refill tokens based on elapsed time since last refill.
   * Called periodically and also on each acquire.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = Math.floor(elapsed / REFILL_INTERVAL_MS);

    if (newTokens > 0) {
      this.tokens = Math.min(MAX_TOKENS, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }

  /**
   * Start a background interval that refills tokens and drains the wait queue.
   */
  private startRefillLoop(): void {
    if (this.refillTimer) return;

    this.refillTimer = setInterval(() => {
      this.refill();
      this.drainQueue();
    }, REFILL_INTERVAL_MS);

    // Allow the Node.js process to exit even if the timer is still running.
    if (typeof this.refillTimer === "object" && "unref" in this.refillTimer) {
      this.refillTimer.unref();
    }
  }

  /**
   * Release waiting callers while tokens are available.
   */
  private drainQueue(): void {
    while (this.waitQueue.length > 0 && this.tokens > 0) {
      this.tokens -= 1;
      const resolve = this.waitQueue.shift()!;
      resolve();
    }
  }

  /**
   * Acquire a single token. Resolves immediately when a token is available,
   * otherwise queues the caller until a token is refilled.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }

    // No tokens available — enqueue and wait.
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /** Current number of available tokens (useful for diagnostics). */
  get available(): number {
    this.refill();
    return this.tokens;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────

let instance: TokenBucketRateLimiter | null = null;

export function getRateLimiter(): TokenBucketRateLimiter {
  if (!instance) {
    instance = new TokenBucketRateLimiter();
  }
  return instance;
}

export type { TokenBucketRateLimiter };
