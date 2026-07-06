import {
  parseRange,
  getSummary,
  getTimeseries,
  getStatusBreakdown,
  getLogs,
} from '../services/analytics.service.js';

/**
 * GET /projects/:id/analytics/summary?range=24h|7d|30d
 *
 * Returns aggregated stats for the project within the given time range.
 * req.project is already attached by verifyProjectOwnership middleware.
 */
export const summary = async (req, res) => {
  try {
    const projectId = req.project._id.toString();
    const range = req.query.range || '24h';    // default to 24h; parseRange handles garbage

    const data = await getSummary(projectId, range);
    return res.status(200).json(data);
  } catch (error) {
    console.error('[Analytics] summary error:', error);
    return res.status(500).json({ error: 'Failed to retrieve analytics summary' });
  }
};

/**
 * GET /projects/:id/analytics/timeseries?range=24h|7d|30d
 *
 * Returns per-bucket (hourly or daily) request counts and avg response times.
 * Always returns a full contiguous array — no gaps for zero-traffic periods.
 */
export const timeseries = async (req, res) => {
  try {
    const projectId = req.project._id.toString();
    const range = req.query.range || '24h';

    const data = await getTimeseries(projectId, range);
    return res.status(200).json(data);
  } catch (error) {
    console.error('[Analytics] timeseries error:', error);
    return res.status(500).json({ error: 'Failed to retrieve timeseries data' });
  }
};

/**
 * GET /projects/:id/analytics/status-breakdown?range=24h|7d|30d
 *
 * Returns counts grouped by HTTP status category.
 * Rate-limiter 429s are tracked separately from upstream 4xx errors.
 */
export const statusBreakdown = async (req, res) => {
  try {
    const projectId = req.project._id.toString();
    const range = req.query.range || '24h';

    const data = await getStatusBreakdown(projectId, range);
    return res.status(200).json(data);
  } catch (error) {
    console.error('[Analytics] statusBreakdown error:', error);
    return res.status(500).json({ error: 'Failed to retrieve status breakdown' });
  }
};

/**
 * GET /projects/:id/logs?page=1&limit=50
 *
 * Returns raw paginated RequestLog entries for the project, most recent first.
 * Clamps limit to [1, 200] (AC #7).
 */
export const logs = async (req, res) => {
  try {
    const projectId = req.project._id.toString();

    // Parse and validate pagination params
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    // Cap limit at 200 — never honour arbitrarily large values (AC #7)
    const rawLimit = parseInt(req.query.limit, 10) || 50;
    const limit = Math.min(Math.max(1, rawLimit), 200);

    const data = await getLogs(projectId, page, limit);
    return res.status(200).json(data);
  } catch (error) {
    console.error('[Analytics] logs error:', error);
    return res.status(500).json({ error: 'Failed to retrieve logs' });
  }
};
