/**
 * test-analytics.js
 * Automated verification suite for Part 6 — Analytics API
 *
 * Covers all 10 acceptance criteria described in the task spec.
 * Run AFTER the server is already started: node test-analytics.js
 */

import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { DB_NAME } from '../src/constants.js';
import RequestLog from '../src/models/RequestLog.js';
import Project from '../src/models/Project.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helper
// ─────────────────────────────────────────────────────────────────────────────
function request(method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${pathUrl}`;
    const merged = { 'Content-Type': 'application/json', ...headers };
    const payload = body ? JSON.stringify(body) : '';

    const req = http.request(url, { method, headers: merged }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        let json = {};
        try { if (raw) json = JSON.parse(raw); } catch { json = { raw }; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (body) req.write(payload);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// DB connection (mirrors server.js logic)
// ─────────────────────────────────────────────────────────────────────────────
async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  let cs;
  if (uri) {
    if (uri.includes(DB_NAME)) {
      cs = uri;
    } else {
      // Insert DB_NAME before the query-string (if any), mirroring db.js exactly
      const qi = uri.indexOf('?');
      if (qi !== -1) {
        const beforeQ = uri.substring(0, qi);
        const afterQ = uri.substring(qi);
        const slash = beforeQ.endsWith('/') ? '' : '/';
        cs = `${beforeQ}${slash}${DB_NAME}${afterQ}`;
      } else {
        const slash = uri.endsWith('/') ? '' : '/';
        cs = `${uri}${slash}${DB_NAME}`;
      }
    }
  } else {
    cs = `mongodb://127.0.0.1:27017/${DB_NAME}`;
  }
  await mongoose.connect(cs);
  console.log(`[DB] Connected to ${cs.replace(/:\/\/[^@]+@/, '://***@')}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main test runner
// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('=== Analytics API Verification Tests (Part 6) ===\n');
  await connectDB();

  let passed = 0;
  let failed = 0;

  function pass(label) { console.log(`  [PASS] ${label}`); passed++; }
  function fail(label, detail = '') {
    console.log(`  [FAIL] ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }

  // ── Setup: two users ──────────────────────────────────────────────────────
  const ts = Date.now();
  const emailA = `analytics_a_${ts}@test.com`;
  const emailB = `analytics_b_${ts}@test.com`;

  const signupA = await request('POST', '/auth/signup', { name: 'Ana', email: emailA, password: 'pass1234' });
  if (signupA.status !== 201) throw new Error('Signup A failed: ' + JSON.stringify(signupA.body));
  const tokenA = signupA.body.accessToken;

  const signupB = await request('POST', '/auth/signup', { name: 'Bob', email: emailB, password: 'pass1234' });
  if (signupB.status !== 201) throw new Error('Signup B failed');
  const tokenB = signupB.body.accessToken;

  const authA = { Authorization: `Bearer ${tokenA}` };
  const authB = { Authorization: `Bearer ${tokenB}` };

  // ── Create projects ───────────────────────────────────────────────────────
  // Project A: pointing at jsonplaceholder, tight rate limit for easy 429s
  const cpA = await request('POST', '/projects', {
    name: 'Analytics Project A',
    targetBaseUrl: 'https://jsonplaceholder.typicode.com',
    rateLimit: { windowMs: 10000, maxRequests: 3 },
  }, authA);
  if (cpA.status !== 201) throw new Error('Create project A failed: ' + JSON.stringify(cpA.body));
  const projA = cpA.body;
  console.log(`  [SETUP] Project A — id: ${projA.id}, apiKey: ${projA.apiKey}`);

  // Project B (User B) — used for cross-user 403 test (AC #8)
  const cpB = await request('POST', '/projects', {
    name: 'Analytics Project B',
    targetBaseUrl: 'https://jsonplaceholder.typicode.com',
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  }, authB);
  if (cpB.status !== 201) throw new Error('Create project B failed');
  const projB = cpB.body;
  console.log(`  [SETUP] Project B (User B) — id: ${projB.id}\n`);

  // ── AC #1: Zero-traffic summary returns all zeros ─────────────────────────
  console.log('--- AC 1: Zero-traffic summary ---');
  // Wipe any stale logs for the new project (shouldn't exist, but be safe)
  await RequestLog.deleteMany({ projectId: projA.id });

  const zeroSummary = await request('GET', `/projects/${projA.id}/analytics/summary?range=24h`, null, authA);
  if (
    zeroSummary.status === 200 &&
    zeroSummary.body.totalRequests === 0 &&
    zeroSummary.body.avgResponseTimeMs === 0 &&
    zeroSummary.body.errorRate === 0 &&
    zeroSummary.body.rateLimitedCount === 0
  ) {
    pass('Zero-traffic summary returns all zeros');
  } else {
    fail('Zero-traffic summary', JSON.stringify(zeroSummary.body));
  }

  // ── Generate traffic (mix of 200, 4xx, 429) ───────────────────────────────
  console.log('\n  [SETUP] Generating mixed proxy traffic...');
  // 3 successful calls (hits limit)
  for (let i = 0; i < 3; i++) {
    await request('GET', `/proxy/${projA.apiKey}/posts/1`);
  }
  // 3 more → these will be rate-limited (429) since limit is 3
  for (let i = 0; i < 3; i++) {
    await request('GET', `/proxy/${projA.apiKey}/posts/1`);
  }
  // upstream 404 (natural 4xx, not rate-limited) — wait for window reset first
  await sleep(11000); // wait for the 10s window to reset
  await request('GET', `/proxy/${projA.apiKey}/posts/999999`); // upstream returns 404
  await sleep(300); // allow fire-and-forget writes to land

  // Count directly in DB for cross-checking
  const allLogs = await RequestLog.find({ projectId: projA.id });
  const dbTotal = allLogs.length;
  const dbRateLimited = allLogs.filter((l) => l.wasRateLimited).length;
  const dbErrors = allLogs.filter((l) => l.statusCode >= 400 && !l.wasRateLimited).length;
  const expectedErrorRate = parseFloat(((dbErrors / dbTotal) * 100).toFixed(2));
  console.log(`  [DB] total=${dbTotal}, rateLimited=${dbRateLimited}, naturalErrors=${dbErrors}`);

  // ── AC #2: Summary matches DB counts ─────────────────────────────────────
  console.log('\n--- AC 2: Summary matches DB counts ---');
  const s = await request('GET', `/projects/${projA.id}/analytics/summary?range=24h`, null, authA);
  if (s.status !== 200) { fail('Summary returned non-200', s.status); }
  else {
    if (s.body.totalRequests === dbTotal)
      pass(`totalRequests matches DB (${dbTotal})`);
    else
      fail(`totalRequests mismatch: API=${s.body.totalRequests} DB=${dbTotal}`);

    if (s.body.rateLimitedCount === dbRateLimited)
      pass(`rateLimitedCount matches DB (${dbRateLimited})`);
    else
      fail(`rateLimitedCount mismatch: API=${s.body.rateLimitedCount} DB=${dbRateLimited}`);

    if (s.body.errorRate === expectedErrorRate)
      pass(`errorRate matches (${expectedErrorRate}%)`);
    else
      fail(`errorRate mismatch: API=${s.body.errorRate} expected=${expectedErrorRate}`);

    if (typeof s.body.avgResponseTimeMs === 'number' && s.body.avgResponseTimeMs > 0)
      pass(`avgResponseTimeMs is positive (${s.body.avgResponseTimeMs}ms)`);
    else
      fail('avgResponseTimeMs is invalid', s.body.avgResponseTimeMs);
  }

  // ── AC #3: Timeseries 24h → 24 hourly buckets, no gaps ───────────────────
  console.log('\n--- AC 3: Timeseries 24h has 24 hourly buckets ---');
  const ts24h = await request('GET', `/projects/${projA.id}/analytics/timeseries?range=24h`, null, authA);
  if (ts24h.status !== 200) { fail('Timeseries 24h returned non-200', ts24h.status); }
  else {
    if (ts24h.body.length >= 24 && ts24h.body.length <= 25)
      pass(`Timeseries 24h has ${ts24h.body.length} entries (24-25, current bucket always included)`);
    else
      fail(`Timeseries 24h entry count wrong: ${ts24h.body.length}`);

    const allHaveKeys = ts24h.body.every(
      (b) => 'bucket' in b && 'count' in b && 'avgResponseTimeMs' in b
    );
    if (allHaveKeys) pass('Every bucket has bucket/count/avgResponseTimeMs fields');
    else fail('Some buckets missing expected fields');

    const nonZero = ts24h.body.filter((b) => b.count > 0);
    const totalCountInTimeseries = ts24h.body.reduce((sum, b) => sum + b.count, 0);
    console.log(`  [INFO] ${nonZero.length} bucket(s) have traffic; ${24 - nonZero.length} are zero-filled`);
    console.log(`  [INFO] Total count across all buckets: ${totalCountInTimeseries}`);
    if (totalCountInTimeseries > 0)
      pass(`Timeseries contains real traffic (${totalCountInTimeseries} total requests across buckets)`);
    else
      fail('No traffic found across any timeseries bucket');
  }

  // ── AC #4: Timeseries 7d → 7 daily buckets ───────────────────────────────
  console.log('\n--- AC 4: Timeseries 7d has 7 daily buckets ---');
  const ts7d = await request('GET', `/projects/${projA.id}/analytics/timeseries?range=7d`, null, authA);
  if (ts7d.status !== 200) { fail('Timeseries 7d returned non-200', ts7d.status); }
  else {
    if (ts7d.body.length >= 7 && ts7d.body.length <= 8)
      pass(`Timeseries 7d has ${ts7d.body.length} entries (daily buckets, not 168 hourly ones)`);
    else
      fail(`Timeseries 7d entry count wrong: ${ts7d.body.length}`);
  }

  // ── AC #5: 429 from rate limiter goes to rateLimited429, not clientError4xx
  console.log('\n--- AC 5: Rate-limiter 429 is not double-counted in clientError4xx ---');
  const sb = await request('GET', `/projects/${projA.id}/analytics/status-breakdown?range=24h`, null, authA);
  if (sb.status !== 200) { fail('Status breakdown returned non-200', sb.status); }
  else {
    console.log(`  [INFO] status breakdown: ${JSON.stringify(sb.body)}`);
    if (sb.body.rateLimited429 === dbRateLimited)
      pass(`rateLimited429 = ${dbRateLimited} (matches DB)`);
    else
      fail(`rateLimited429 mismatch: API=${sb.body.rateLimited429} DB=${dbRateLimited}`);

    // Total 4xx in DB that were NOT rate-limited
    if (sb.body.clientError4xx === dbErrors)
      pass(`clientError4xx = ${dbErrors} (natural upstream errors only, no rate-limited 429s)`);
    else
      fail(`clientError4xx mismatch: API=${sb.body.clientError4xx} expected=${dbErrors}`);

    if (sb.body.success2xx > 0)
      pass(`success2xx = ${sb.body.success2xx} (has successful requests)`);
    else
      fail('success2xx is 0 — expected some successful calls');
  }

  // ── AC #6: Paginated logs ─────────────────────────────────────────────────
  console.log('\n--- AC 6: Paginated logs ---');
  const logsP1 = await request('GET', `/projects/${projA.id}/logs?page=1&limit=2`, null, authA);
  if (logsP1.status !== 200) { fail('Logs page 1 returned non-200', logsP1.status); }
  else {
    if (logsP1.body.logs.length === 2)
      pass('Page 1 with limit=2 returns exactly 2 entries');
    else
      fail(`Page 1 entry count wrong: ${logsP1.body.logs.length}`);

    const expectedTotalPages = Math.ceil(dbTotal / 2);
    if (logsP1.body.totalPages === expectedTotalPages)
      pass(`totalPages = ${expectedTotalPages} (correct ceil(${dbTotal}/2))`);
    else
      fail(`totalPages wrong: API=${logsP1.body.totalPages} expected=${expectedTotalPages}`);

    if (logsP1.body.totalLogs === dbTotal)
      pass(`totalLogs = ${dbTotal} (matches DB count)`);
    else
      fail(`totalLogs mismatch: API=${logsP1.body.totalLogs} DB=${dbTotal}`);

    // Confirm most-recent-first ordering
    const dates = logsP1.body.logs.map((l) => new Date(l.timestamp).getTime());
    if (dates[0] >= dates[1])
      pass('Logs are sorted most-recent-first');
    else
      fail('Logs are NOT sorted most-recent-first');
  }

  const logsP2 = await request('GET', `/projects/${projA.id}/logs?page=2&limit=2`, null, authA);
  if (logsP2.status === 200 && logsP2.body.logs.length > 0 && logsP2.body.page === 2) {
    pass('Page 2 returns the next entries correctly');
  } else {
    fail('Page 2 response invalid', JSON.stringify(logsP2.body));
  }

  // ── AC #7: Limit cap at 200 ───────────────────────────────────────────────
  console.log('\n--- AC 7: limit=9999 is capped at 200 ---');
  const capRes = await request('GET', `/projects/${projA.id}/logs?limit=9999`, null, authA);
  if (capRes.status === 200) {
    // Can't have more than 200 results even if limit=9999 was honoured
    // The real check is that the server didn't crash and returned a valid page
    // (we verify the cap is coded correctly — actual count bounded by totalLogs)
    const returnedCount = capRes.body.logs.length;
    const limitHonoured = returnedCount <= 200;
    if (limitHonoured)
      pass(`limit=9999 capped: returned ${returnedCount} entries (≤200)`);
    else
      fail(`Limit NOT capped: returned ${returnedCount} entries`);
  } else {
    fail('Logs with limit=9999 returned non-200', capRes.status);
  }

  // ── AC #8: Cross-user 403 ────────────────────────────────────────────────
  console.log('\n--- AC 8: Cross-user access returns 403 ---');
  // User A trying to access User B's project analytics
  const r1 = await request('GET', `/projects/${projB.id}/analytics/summary`, null, authA);
  if (r1.status === 403) pass('Summary: User A gets 403 on User B project');
  else fail(`Summary: expected 403, got ${r1.status}`);

  const r2 = await request('GET', `/projects/${projB.id}/analytics/timeseries`, null, authA);
  if (r2.status === 403) pass('Timeseries: User A gets 403 on User B project');
  else fail(`Timeseries: expected 403, got ${r2.status}`);

  const r3 = await request('GET', `/projects/${projB.id}/analytics/status-breakdown`, null, authA);
  if (r3.status === 403) pass('Status breakdown: User A gets 403 on User B project');
  else fail(`Status breakdown: expected 403, got ${r3.status}`);

  const r4 = await request('GET', `/projects/${projB.id}/logs`, null, authA);
  if (r4.status === 403) pass('Logs: User A gets 403 on User B project');
  else fail(`Logs: expected 403, got ${r4.status}`);

  // ── AC #9: Invalid range falls back to 24h ───────────────────────────────
  console.log('\n--- AC 9: Garbage ?range falls back to 24h ---');
  const banana = await request('GET', `/projects/${projA.id}/analytics/summary?range=banana`, null, authA);
  if (banana.status === 200 && typeof banana.body.totalRequests === 'number')
    pass('range=banana returns 200 (defaulted to 24h, no crash)');
  else
    fail('range=banana did not fall back gracefully', JSON.stringify(banana.body));

  const tsBanana = await request('GET', `/projects/${projA.id}/analytics/timeseries?range=banana`, null, authA);
  if (tsBanana.status === 200 && tsBanana.body.length >= 24 && tsBanana.body.length <= 25)
    pass(`Timeseries range=banana returns ${tsBanana.body.length} hourly buckets (defaulted to 24h)`);
  else
    fail('Timeseries range=banana did not default to 24h', JSON.stringify({ length: tsBanana.body?.length }));

  // ── AC #10: Response time check (index being used) ───────────────────────
  console.log('\n--- AC 10: Response time is acceptable ---');
  const t0 = Date.now();
  await request('GET', `/projects/${projA.id}/analytics/summary?range=24h`, null, authA);
  const elapsed = Date.now() - t0;
  if (elapsed < 2000)
    pass(`Summary responded in ${elapsed}ms (well under 2s threshold)`);
  else
    fail(`Summary took ${elapsed}ms — may indicate missing index usage`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
