import { Router } from 'express';
import { proxyRequest, lookupProject } from '../controllers/proxy.controller.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

// mergeParams: true ensures params from parent router (if any) are also
// available. Not strictly required here, but a good habit for nested routers.
const router = Router({ mergeParams: true });

/**
 * ALL /proxy/:apiKey/*
 *
 * The wildcard `*` captures everything after the apiKey segment as req.params[0].
 * For example:
 *   /proxy/abc123/users/45?foo=bar
 *     → req.params.apiKey = "abc123"
 *     → req.params[0]     = "users/45"
 *     → req.url           = "/users/45?foo=bar"  (relative to this router mount)
 *
 * No verifyToken middleware is used here — this endpoint is intentionally
 * public, authenticated only by the apiKey embedded in the URL.
 * 
 * First, the lookupProject middleware verifies the apiKey is valid and attaches the Project to req.project.
 * Second, the rateLimiter middleware checks the rate limits using Redis.
 * Finally, proxyRequest forwards the request upstream.
 */
router.all('/:apiKey/*', lookupProject, rateLimiter, proxyRequest);

export default router;
