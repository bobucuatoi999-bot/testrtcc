/**
 * Simple rate limiter for WebSocket messages
 */
class RateLimiter {
  constructor(maxRequests = 600, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map(); // clientId -> { count, resetAt }
  }

  allow(clientId) {
    const now = Date.now();
    const client = this.requests.get(clientId);

    if (!client || now > client.resetAt) {
      // Reset or initialize
      this.requests.set(clientId, {
        count: 1,
        resetAt: now + this.windowMs
      });
      return true;
    }

    if (client.count >= this.maxRequests) {
      return false;
    }

    client.count++;
    return true;
  }

  reset(clientId) {
    this.requests.delete(clientId);
  }
}

function setupRateLimiting() {
  const maxRequests = parseInt(process.env.RATE_LIMIT_WS_PER_MINUTE || '600');
  return new RateLimiter(maxRequests, 60000);
}

module.exports = { setupRateLimiting, RateLimiter };

