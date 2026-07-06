import mongoose from 'mongoose';
import RequestLog from '../models/RequestLog.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts the ?range query param into a Date cutoff timestamp.
 * Falls back to "24h" for any unknown/missing value (AC #9).
 *
 * @param {string} range - "24h" | "7d" | "30d"
 * @returns {{ cutoff: Date, unit: "hour"|"day", bucketCount: number }}
 */
export function parseRange(range) {
  const now = new Date();

  switch (range) {
    case '7d':
      return {
        cutoff: new Date(now - 7 * 24 * 60 * 60 * 1000),
        unit: 'day',
        bucketCount: 7,
      };
    case '30d':
      return {
        cutoff: new Date(now - 30 * 24 * 60 * 60 * 1000),
        unit: 'day',
        bucketCount: 30,
      };
    case '24h':
    default:
      // Unknown/garbage value falls back to 24h (AC #9)
      return {
        cutoff: new Date(now - 24 * 60 * 60 * 1000),
        unit: 'hour',
        bucketCount: 24,
      };
  }
}

/**
 * Floors a Date to the nearest unit boundary (hour or day) in UTC.
 * Used to generate expected bucket keys that match $dateTrunc output.
 *
 * @param {Date} date
 * @param {"hour"|"day"} unit
 * @returns {string} ISO string of the floored date (e.g. "2026-07-05T14:00:00.000Z")
 */
function floorToBucket(date, unit) {
  const d = new Date(date);
  if (unit === 'hour') {
    d.setUTCMinutes(0, 0, 0);
  } else {
    // day
    d.setUTCHours(0, 0, 0, 0);
  }
  return d.toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /projects/:id/analytics/summary
 *
 * Returns aggregate stats for all RequestLogs within the time range:
 *   - totalRequests
 *   - avgResponseTimeMs (rounded to nearest integer)
 *   - errorRate (% of status >= 400, rounded 2dp; excludes wasRateLimited 429s from "error" count)
 *   - rateLimitedCount
 *
 * Returns all zeros when there is no traffic (AC #1), never divides by zero.
 *
 * @param {string} projectId
 * @param {string} range
 * @returns {Promise<object>}
 */
export async function getSummary(projectId, range) {
  const { cutoff } = parseRange(range);

  // $match MUST be the first stage to leverage the compound index { projectId, timestamp }
  const [result] = await RequestLog.aggregate([
    {
      $match: {
        projectId: new mongoose.Types.ObjectId(projectId),
        timestamp: { $gte: cutoff },
      },
    },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        totalResponseTime: { $sum: '$responseTimeMs' },
        // Count requests with statusCode >= 400 that were NOT rate-limited by our platform.
        // A natural 4xx from the upstream target (e.g. 404) is a genuine error.
        // A 429 triggered by our rate limiter should NOT count as an upstream error.
        errorCount: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$statusCode', 400] }, { $eq: ['$wasRateLimited', false] }] },
              1,
              0,
            ],
          },
        },
        rateLimitedCount: {
          $sum: { $cond: ['$wasRateLimited', 1, 0] },
        },
      },
    },
  ]);

  // No documents in range → return all zeros (AC #1)
  if (!result || result.totalRequests === 0) {
    return { totalRequests: 0, avgResponseTimeMs: 0, errorRate: 0, rateLimitedCount: 0 };
  }

  const { totalRequests, totalResponseTime, errorCount, rateLimitedCount } = result;

  return {
    totalRequests,
    avgResponseTimeMs: Math.round(totalResponseTime / totalRequests),
    errorRate: parseFloat(((errorCount / totalRequests) * 100).toFixed(2)),
    rateLimitedCount,
  };
}

/**
 * GET /projects/:id/analytics/timeseries
 *
 * Buckets request counts and avg response times by hour (24h) or by day (7d/30d).
 *
 * GAP-FILLING STRATEGY (AC #3, #4):
 * MongoDB's $group only returns buckets that actually have documents.
 * If an hour or day had zero traffic, it simply won't appear in the pipeline output.
 * To keep charts smooth, we:
 *   1. Generate the full list of expected bucket timestamps in JavaScript.
 *   2. Run the aggregation pipeline to get real data per bucket.
 *   3. Build a Map keyed by ISO timestamp from the aggregation results.
 *   4. Map over the expected list and look up each bucket, defaulting to
 *      { count: 0, avgResponseTimeMs: 0 } when the bucket is missing.
 *
 * @param {string} projectId
 * @param {string} range
 * @returns {Promise<Array>}
 */
export async function getTimeseries(projectId, range) {
  const { cutoff, unit } = parseRange(range);
  const now = new Date();

  // ── Step 1: Generate the complete list of expected bucket ISO strings ────────
  // We walk from the floored cutoff to the floored 'now' (inclusive), stepping
  // by 1 hour or 1 day. This guarantees the CURRENT bucket is always the last
  // entry even when we're part-way through an hour/day.
  const stepMs = unit === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const expectedBuckets = [];

  // Floor both endpoints to their bucket boundary so they align with $dateTrunc
  const start = new Date(floorToBucket(cutoff, unit));
  const end   = new Date(floorToBucket(now, unit));

  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    expectedBuckets.push(new Date(t).toISOString());
  }

  // ── Step 2: Run the aggregation pipeline ─────────────────────────────────────
  // $dateTrunc truncates each document's timestamp to the bucket boundary,
  // which matches our expectedBuckets keys exactly.
  const rows = await RequestLog.aggregate([
    {
      $match: {
        projectId: new mongoose.Types.ObjectId(projectId),
        timestamp: { $gte: cutoff },
      },
    },
    {
      $group: {
        _id: {
          $dateTrunc: { date: '$timestamp', unit },
        },
        count: { $sum: 1 },
        totalResponseTime: { $sum: '$responseTimeMs' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // ── Step 3: Build a lookup Map from aggregation results ───────────────────────
  // Key = ISO string of the bucket boundary, Value = { count, avgResponseTimeMs }
  const bucketMap = new Map();
  for (const row of rows) {
    const key = new Date(row._id).toISOString();
    bucketMap.set(key, {
      count: row.count,
      avgResponseTimeMs: Math.round(row.totalResponseTime / row.count),
    });
  }

  // ── Step 4: Merge — fill gaps with zeros ─────────────────────────────────────
  return expectedBuckets.map((isoKey) => {
    const data = bucketMap.get(isoKey);
    return {
      bucket: isoKey,
      count: data?.count ?? 0,
      avgResponseTimeMs: data?.avgResponseTimeMs ?? 0,
    };
  });
}

/**
 * GET /projects/:id/analytics/status-breakdown
 *
 * Categorises each RequestLog by HTTP status group.
 *
 * IMPORTANT — 429 handling (AC #5):
 * A 429 returned by our rate limiter (wasRateLimited: true) is tracked separately
 * as rateLimited429. It is NOT counted in clientError4xx even though 429 is
 * technically in the 4xx range. A 4xx returned by the upstream target API with
 * wasRateLimited: false IS counted in clientError4xx.
 *
 * @param {string} projectId
 * @param {string} range
 * @returns {Promise<object>}
 */
export async function getStatusBreakdown(projectId, range) {
  const { cutoff } = parseRange(range);

  const [result] = await RequestLog.aggregate([
    {
      $match: {
        projectId: new mongoose.Types.ObjectId(projectId),
        timestamp: { $gte: cutoff },
      },
    },
    {
      $group: {
        _id: null,
        success2xx: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$statusCode', 200] }, { $lt: ['$statusCode', 300] }] },
              1,
              0,
            ],
          },
        },
        // clientError4xx: genuine 4xx from upstream, NOT our own rate-limiter 429
        clientError4xx: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$statusCode', 400] },
                  { $lt: ['$statusCode', 500] },
                  { $eq: ['$wasRateLimited', false] }, // exclude platform-generated 429s
                ],
              },
              1,
              0,
            ],
          },
        },
        serverError5xx: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$statusCode', 500] }, { $lt: ['$statusCode', 600] }] },
              1,
              0,
            ],
          },
        },
        rateLimited429: {
          $sum: { $cond: ['$wasRateLimited', 1, 0] },
        },
      },
    },
  ]);

  return result
    ? {
        success2xx: result.success2xx,
        clientError4xx: result.clientError4xx,
        serverError5xx: result.serverError5xx,
        rateLimited429: result.rateLimited429,
      }
    : { success2xx: 0, clientError4xx: 0, serverError5xx: 0, rateLimited429: 0 };
}

/**
 * GET /projects/:id/logs
 *
 * Returns raw RequestLog documents for the project, paginated, most recent first.
 * Limit is capped at 200 (AC #7) regardless of what the client requests.
 *
 * @param {string} projectId
 * @param {number} page  - 1-based page number (default 1)
 * @param {number} limit - items per page (default 50, capped at 200)
 * @returns {Promise<object>} { logs, page, totalPages, totalLogs }
 */
export async function getLogs(projectId, page, limit) {
  const skip = (page - 1) * limit;

  // Run count and page fetch in parallel for performance
  const [totalLogs, logs] = await Promise.all([
    RequestLog.countDocuments({ projectId: new mongoose.Types.ObjectId(projectId) }),
    RequestLog.find({ projectId: new mongoose.Types.ObjectId(projectId) })
      .sort({ timestamp: -1 })           // most recent first
      .skip(skip)
      .limit(limit)
      .select('endpoint method statusCode responseTimeMs wasRateLimited timestamp')
      .lean(),
  ]);

  const totalPages = Math.ceil(totalLogs / limit);

  return { logs, page, totalPages, totalLogs };
}
