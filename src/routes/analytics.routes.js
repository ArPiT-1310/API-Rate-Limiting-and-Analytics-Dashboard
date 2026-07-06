import { Router } from 'express';
import verifyToken from '../middleware/verifyToken.js';
import verifyProjectOwnership from '../middleware/verifyProjectOwnership.js';
import {
  summary,
  timeseries,
  statusBreakdown,
  logs,
} from '../controllers/analytics.controller.js';

/**
 * Analytics & Logs Router
 *
 * All routes here are doubly protected:
 *   1. verifyToken    — ensures the caller is an authenticated user
 *   2. verifyProjectOwnership — ensures the project exists AND belongs to that user
 *
 * These are mounted in server.js under /projects, so the full paths are:
 *   GET /projects/:id/analytics/summary
 *   GET /projects/:id/analytics/timeseries
 *   GET /projects/:id/analytics/status-breakdown
 *   GET /projects/:id/logs
 *
 * mergeParams: true is required so that /:id from the parent router
 * (/projects/:id) is accessible inside this child router via req.params.id.
 */
const router = Router({ mergeParams: true });

// Apply auth + ownership guard to every route in this file
router.use(verifyToken, verifyProjectOwnership);

// ── Analytics endpoints (read-only aggregation) ───────────────────────────────
router.get('/analytics/summary', summary);
router.get('/analytics/timeseries', timeseries);
router.get('/analytics/status-breakdown', statusBreakdown);

// ── Raw paginated logs ────────────────────────────────────────────────────────
router.get('/logs', logs);

export default router;
