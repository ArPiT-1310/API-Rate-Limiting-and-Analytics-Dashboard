import axios from 'axios';
import Project from '../models/Project.js';

/**
 * Headers that should NEVER be forwarded to the target upstream API.
 *
 * - host:           We are sending to a different host (targetBaseUrl). Sending
 *                   the original host would confuse the upstream server and may
 *                   cause routing failures on virtual-host setups.
 *
 * - authorization:  This is the JWT / API-key credential for *our* platform.
 *                   Forwarding it would leak platform internals to the upstream.
 *
 * - content-length: axios recalculates this from the serialised body. Forwarding
 *                   the original value (which was for the raw client request)
 *                   causes mismatches and can result in truncated or rejected
 *                   bodies.
 *
 * - connection:     A hop-by-hop header defined per RFC 7230 §6.1. It must not
 *                   be forwarded by proxies.
 */
const STRIPPED_HEADERS = new Set([
  'host',
  'authorization',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
]);

/**
 * Builds the full target URL by joining targetBaseUrl + forwardedPath + queryString.
 *
 * Rules:
 *  1. Strip any trailing slash from targetBaseUrl.
 *  2. Ensure the forwarded path starts with exactly one leading slash.
 *  3. Append the raw query string if present (everything after "?" in req.url).
 *
 * Example:
 *   targetBaseUrl = "https://api.example.com/"
 *   req.params[0] = "users/45"          (Express wildcard — no leading slash)
 *   req.url       = "/users/45?foo=bar"  (relative URL, has query string)
 *   → "https://api.example.com/users/45?foo=bar"
 */
function buildTargetUrl(targetBaseUrl, rawPath, reqUrl) {
  // 1. Remove trailing slash from the base URL to avoid double-slashes.
  const base = targetBaseUrl.replace(/\/+$/, '');

  // 2. Normalise the wildcard path — Express may or may not include a leading
  //    slash depending on the version / route definition, so we strip and re-add.
  const normalizedPath = '/' + (rawPath || '').replace(/^\/+/, '');

  // 3. Extract the query string from the raw relative URL of this request.
  //    req.url is the URL relative to where this router is mounted, e.g.
  //    "/abc123/users/45?foo=bar". We only want "?foo=bar".
  const queryStart = reqUrl.indexOf('?');
  const queryString = queryStart !== -1 ? reqUrl.slice(queryStart) : '';

  return `${base}${normalizedPath}${queryString}`;
}

/**
 * Filters the incoming request headers, removing any that must not be
 * forwarded to the upstream API (see STRIPPED_HEADERS above).
 *
 * @param {object} incomingHeaders - req.headers from Express
 * @returns {object} A clean headers object safe to send upstream
 */
function buildForwardHeaders(incomingHeaders) {
  const headers = {};
  for (const [key, value] of Object.entries(incomingHeaders)) {
    // Header names are case-insensitive; normalise to lowercase for the check.
    if (!STRIPPED_HEADERS.has(key.toLowerCase())) {
      headers[key] = value;
    }
  }
  return headers;
}

/**
 * ALL /proxy/:apiKey/*
 *
 * Public-facing reverse proxy endpoint. Authentication is done exclusively
 * via the apiKey URL parameter — no JWT / verifyToken is used here.
 *
 * Flow:
 *  1. Validate the apiKey against the Projects collection.
 *  2. Build the target URL (base + path + query string).
 *  3. Strip hop-by-hop / platform-internal headers.
 *  4. Forward the request via axios with a 10 s timeout.
 *  5. Relay the upstream response (status + body) back to the caller.
 *  6. On network/DNS/timeout failure → 502.
 */
export const proxyRequest = async (req, res) => {
  const { apiKey } = req.params;

  // ── Step 1: API Key validation ──────────────────────────────────────────────
  const project = await Project.findOne({ apiKey }).lean();

  if (!project) {
    return res.status(404).json({ error: 'Invalid API key' });
  }

  // ── Step 2: Build the forwarded URL ─────────────────────────────────────────
  // req.params[0] is the wildcard segment captured after the apiKey in the route
  // pattern:  /proxy/:apiKey/*  → for /proxy/abc123/users/45, it is "users/45"
  const rawPath = req.params[0] || '';
  const targetUrl = buildTargetUrl(project.targetBaseUrl, rawPath, req.url);

  // ── Step 3: Prepare clean headers ───────────────────────────────────────────
  const forwardHeaders = buildForwardHeaders(req.headers);

  // ── Step 4: Forward the request upstream ────────────────────────────────────
  try {
    const axiosConfig = {
      method: req.method,
      url: targetUrl,
      headers: forwardHeaders,
      timeout: 10000, // 10 seconds — avoids holding connections open indefinitely

      // validateStatus: () => true means axios will NEVER throw on 4xx/5xx
      // responses from the upstream. We want to relay those status codes to the
      // caller unchanged, not treat them as errors on our side.
      validateStatus: () => true,

      // Receive the upstream response as a raw Buffer so we can forward it
      // unchanged regardless of content-type (JSON, HTML, plain-text, binary…).
      responseType: 'arraybuffer',
    };

    // Only attach a body for methods that semantically carry one.
    // Sending a body with GET/DELETE is technically allowed by HTTP but many
    // servers reject it, and Express may have already parsed req.body as {}.
    if (!['GET', 'DELETE', 'HEAD'].includes(req.method.toUpperCase())) {
      // req.body was already parsed by express.json() into a plain JS object.
      // When responseType is 'arraybuffer', axios does NOT auto-serialize objects
      // to JSON strings, so we must do it explicitly and set the content-type.
      if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        axiosConfig.data = JSON.stringify(req.body);
        // Ensure the upstream knows we're sending JSON, regardless of what
        // the filtered headers say (the original content-type may have been stripped).
        forwardHeaders['content-type'] = 'application/json';
      } else if (typeof req.body === 'string' && req.body.length > 0) {
        // Pass raw string bodies through unchanged (e.g. form-urlencoded or plain text).
        axiosConfig.data = req.body;
      }
      // If body is empty/undefined, omit data entirely.
    }

    const upstreamResponse = await axios(axiosConfig);

    // ── Step 5: Relay the upstream response ─────────────────────────────────
    // Forward the upstream content-type so the caller knows what they received.
    const contentType = upstreamResponse.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Send back the exact same status and body — the proxy is transparent.
    return res.status(upstreamResponse.status).send(upstreamResponse.data);

  } catch (error) {
    // ── Step 6: Network / DNS / timeout failure ──────────────────────────────
    // This branch only fires when axios could NOT reach the upstream at all
    // (ENOTFOUND, ECONNREFUSED, ETIMEDOUT, etc.) — it does NOT fire for
    // 4xx/5xx responses, which are handled by validateStatus above.
    console.error(`[Proxy] Upstream request failed for apiKey="${apiKey}" → ${targetUrl}:`, error.message);
    return res.status(502).json({ error: 'Upstream API unreachable' });
  }
};
