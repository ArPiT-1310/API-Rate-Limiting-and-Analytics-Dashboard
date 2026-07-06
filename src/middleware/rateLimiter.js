import redis from '../config/redis.js';
import { logRequest } from '../utils/logRequest.js';

/**
 * Helper to wrap a promise in a timeout to prevent requests from hanging
 * if Redis becomes unresponsive (e.g. offline queueing commands).
 */
const withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Redis operation timed out')), ms)
    ),
  ]);
};

/**
 * Redis-backed Rate Limiter Middleware (Fixed Window Algorithm)
 * 
 * Flow:
 * 1. Build key: `ratelimit:${project.apiKey}`
 * 2. Increment atomically with INCR. This prevents race conditions under high concurrent load,
 *    since Redis is single-threaded and executes commands sequentially.
 * 3. On count === 1, set expiration (windowMs converted to seconds).
 * 4. Fetch key TTL to report window reset remaining time.
 * 5. Set standard headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
 * 6. If count exceeds limit: set Retry-After header and return 429 immediately.
 * 7. Else: call next() to proceed.
 * 
 * FAIL-OPEN DESIGN:
 * If Redis is unreachable or a command times out, this middleware logs the error and
 * immediately calls next() to allow the request to proceed without rate limiting.
 * - Why fail-open? In a proxy/API gateway setting, availability is usually prioritized over
 *   strict limit enforcement. Blocking all traffic because a cache/limiter is down (fail-closed)
 *   causes a complete system outage. Failing-open ensures the system remains functional,
 *   even if we temporarily lose rate limiting control.
 */
export const rateLimiter = async (req, res, next) => {
  const project = req.project;
  if (!project) {
    // Should not happen if lookupProject runs first, but if it does, fail open.
    return next();
  }

  const { apiKey, rateLimit } = project;
  const maxRequests = rateLimit?.maxRequests || 100;
  const windowMs = rateLimit?.windowMs || 60000;
  const windowSeconds = Math.ceil(windowMs / 1000);

  const key = `ratelimit:${apiKey}`;

  try {
    // If Redis is not ready, bypass to fail open fast (avoiding queue timeout wait)
    if (redis.status !== 'ready') {
      throw new Error(`Redis status is ${redis.status}`);
    }

    // 1. Atomically increment the request count.
    // INCR returns the new value after incrementing.
    const count = await withTimeout(redis.incr(key), 1000);

    // 2. If this is the first request in the window, set expiration.
    if (count === 1) {
      await withTimeout(redis.expire(key, windowSeconds), 1000);
    }

    // 3. Get the TTL to calculate remaining reset time.
    const ttl = await withTimeout(redis.ttl(key), 1000);
    const resetSeconds = ttl > 0 ? ttl : windowSeconds;

    // 4. Set rate limit headers on every response
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    // 5. Check if limit is exceeded
    if (count > maxRequests) {
      res.setHeader('Retry-After', resetSeconds);

      // Log the rate limited request (fire-and-forget)
      logRequest({
        projectId: project._id,
        endpoint: '/' + (req.params[0] || '').replace(/^\/+/, ''),
        method: req.method,
        statusCode: 429,
        responseTimeMs: Date.now() - (req.startTime || Date.now()),
        wasRateLimited: true,
        ipAddress: req.ip,
        testDelayLogging: req.headers['x-test-delay-logging'] === 'true',
        testFailLogging: req.headers['x-test-fail-logging'] === 'true',
      }).catch((err) => console.error('Failed to write request log:', err));

      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: resetSeconds,
      });
    }

    // 6. Request is within limit, proceed to proxy forwarding
    next();
  } catch (error) {
    console.error(`[RateLimiter] Redis error: "${error.message}". Failing open.`);
    // Proceed without rate limiting headers / blocking
    next();
  }
};
