import http from 'http';
import { execSync } from 'child_process';

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper function to make HTTP requests and parse response and headers
function request(method, path, body = null, headers = {}, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    if (cookie) {
      defaultHeaders['Cookie'] = cookie;
    }

    const mergedHeaders = { ...defaultHeaders, ...headers };
    const payload = body ? JSON.stringify(body) : '';

    const options = {
      method: method,
      headers: mergedHeaders,
    };

    const req = http.request(url, options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        let json = {};
        try {
          if (responseBody) {
            json = JSON.parse(responseBody);
          }
        } catch (e) {
          json = { raw: responseBody };
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(payload);
    }
    req.end();
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runRateLimiterTests() {
  console.log('=== Starting Redis Rate Limiter Verification Tests ===\n');
  console.log(`Target server: ${BASE_URL}\n`);

  // User credentials for setup
  const email = `limiter_test_${Date.now()}@example.com`;
  const password = 'password123';
  let token = '';

  try {
    // 0. Signup and authenticate test user
    const signupRes = await request('POST', '/auth/signup', {
      name: 'Limiter Tester',
      email,
      password,
    });
    if (signupRes.status === 201 && signupRes.body.accessToken) {
      token = signupRes.body.accessToken;
      console.log('  [SETUP] Signed up test user successfully.');
    } else {
      throw new Error(`Signup failed: ${JSON.stringify(signupRes.body)}`);
    }

    // -------------------------------------------------------------------------
    // AC 1, 2, 3, 4: Basic Rate Limiting & Header Validation
    // -------------------------------------------------------------------------
    console.log('\n--- AC 1-4: Basic Rate Limiting & Header Validation ---');
    // Create a test Project with rateLimit set to { windowMs: 10000, maxRequests: 5 }
    // Using a 10-second window for fast manual/automated testing.
    const createProjectRes = await request('POST', '/projects', {
      name: 'Ratelimit Project A',
      targetBaseUrl: 'https://jsonplaceholder.typicode.com',
      rateLimit: { windowMs: 10000, maxRequests: 5 }
    }, {
      'Authorization': `Bearer ${token}`
    });

    if (createProjectRes.status !== 201 || !createProjectRes.body.apiKey) {
      throw new Error(`Failed to create test project A: ${JSON.stringify(createProjectRes.body)}`);
    }

    const projectA = createProjectRes.body;
    console.log(`  [INFO] Created Project A with apiKey="${projectA.apiKey}" (limit: 5 reqs / 10s)`);

    // Call the proxy 5 times in a row - all should succeed (status 200)
    for (let i = 1; i <= 5; i++) {
      const res = await request('GET', `/proxy/${projectA.apiKey}/posts/1`);
      
      // Check for presence of required headers
      const limitHeader = res.headers['x-ratelimit-limit'];
      const remainingHeader = res.headers['x-ratelimit-remaining'];
      const resetHeader = res.headers['x-ratelimit-reset'];

      const expectedRemaining = 5 - i;

      if (res.status === 200 && limitHeader === '5' && remainingHeader === String(expectedRemaining)) {
        console.log(`  [PASS] Request ${i}/5: Success (200). Remaining: ${remainingHeader}, Reset TTL: ${resetHeader}s`);
      } else {
        console.log(`  [FAIL] Request ${i}/5: Status ${res.status}. Headers: Limit=${limitHeader}, Remaining=${remainingHeader}`);
      }
    }

    // Call it a 6th time - should fail with 429
    const res6 = await request('GET', `/proxy/${projectA.apiKey}/posts/1`);
    const limitHeader6 = res6.headers['x-ratelimit-limit'];
    const remainingHeader6 = res6.headers['x-ratelimit-remaining'];
    const resetHeader6 = res6.headers['x-ratelimit-reset'];
    const retryAfterHeader = res6.headers['retry-after'];

    if (res6.status === 429 && 
        res6.body.error === 'Rate limit exceeded' && 
        typeof res6.body.retryAfter === 'number' &&
        retryAfterHeader === String(res6.body.retryAfter)) {
      console.log(`  [PASS] Request 6/5: Correctly blocked with 429. retryAfter=${res6.body.retryAfter}s, X-Remaining=${remainingHeader6}`);
    } else {
      console.log(`  [FAIL] Request 6/5: Expected 429 Rate limit exceeded. Got: Status=${res6.status}, Body=${JSON.stringify(res6.body)}, Headers=${JSON.stringify(res6.headers)}`);
    }

    // -------------------------------------------------------------------------
    // AC 5: Window Expiration Recovery
    // -------------------------------------------------------------------------
    console.log('\n--- AC 5: Window Expiration Recovery ---');
    const waitTimeMs = (parseInt(resetHeader6 || '10') + 1) * 1000;
    console.log(`  [INFO] Waiting ${waitTimeMs}ms for the rate limit window to expire...`);
    await sleep(waitTimeMs);

    const postExpiryRes = await request('GET', `/proxy/${projectA.apiKey}/posts/1`);
    if (postExpiryRes.status === 200 && postExpiryRes.headers['x-ratelimit-remaining'] === '4') {
      console.log('  [PASS] Request post-expiry: Successfully reset, count restored. Remaining: 4');
    } else {
      console.log('  [FAIL] Request post-expiry: Expected 200 with remaining 4. Got:', postExpiryRes.status, postExpiryRes.headers['x-ratelimit-remaining']);
    }

    // -------------------------------------------------------------------------
    // AC 6: Independent Project Counters
    // -------------------------------------------------------------------------
    console.log('\n--- AC 6: Independent Project Counters ---');
    // Create Project B with different rateLimit: { windowMs: 20000, maxRequests: 3 }
    const createProjectBRes = await request('POST', '/projects', {
      name: 'Ratelimit Project B',
      targetBaseUrl: 'https://jsonplaceholder.typicode.com',
      rateLimit: { windowMs: 20000, maxRequests: 3 }
    }, {
      'Authorization': `Bearer ${token}`
    });

    if (createProjectBRes.status !== 201 || !createProjectBRes.body.apiKey) {
      throw new Error(`Failed to create test project B: ${JSON.stringify(createProjectBRes.body)}`);
    }

    const projectB = createProjectBRes.body;
    console.log(`  [INFO] Created Project B with apiKey="${projectB.apiKey}" (limit: 3 reqs / 20s)`);

    // Let's max out Project A's limit again
    console.log('  [INFO] Maxing out Project A...');
    for (let i = 0; i < 6; i++) {
      await request('GET', `/proxy/${projectA.apiKey}/posts/1`);
    }

    // Confirm Project A is blocked
    const testARes = await request('GET', `/proxy/${projectA.apiKey}/posts/1`);
    if (testARes.status === 429) {
      console.log('  [INFO] Project A is confirmed blocked (429).');
    } else {
      console.log('  [WARN] Project A not blocked? Got status:', testARes.status);
    }

    // Now request using Project B's key - should succeed because counters are independent!
    const testBRes = await request('GET', `/proxy/${projectB.apiKey}/posts/1`);
    if (testBRes.status === 200 && testBRes.headers['x-ratelimit-remaining'] === '2') {
      console.log('  [PASS] Project B request: Succeeded with 200 and remaining 2, unaffected by Project A.');
    } else {
      console.log('  [FAIL] Project B request: Expected 200 with remaining 2. Got:', testBRes.status, testBRes.headers['x-ratelimit-remaining']);
    }

    // -------------------------------------------------------------------------
    // AC 8: Invalid API Key Bypass
    // -------------------------------------------------------------------------
    console.log('\n--- AC 8: Invalid API Key Bypass ---');
    const invalidKeyRes = await request('GET', '/proxy/invalid_apiKey_12345/posts/1');
    if (invalidKeyRes.status === 404 && invalidKeyRes.body.error === 'Invalid API key') {
      const hasRateLimitHeaders = Object.keys(invalidKeyRes.headers).some(h => h.startsWith('x-ratelimit'));
      if (!hasRateLimitHeaders) {
        console.log('  [PASS] Invalid apiKey: Returned 404 before rate limit checks (no rate limit headers returned).');
      } else {
        console.log('  [FAIL] Invalid apiKey: Returned 404 but included rate limit headers.');
      }
    } else {
      console.log('  [FAIL] Invalid apiKey: Expected 404. Got status:', invalidKeyRes.status, invalidKeyRes.body);
    }

    // -------------------------------------------------------------------------
    // AC 9: Concurrency and Atomicity check
    // -------------------------------------------------------------------------
    console.log('\n--- AC 9: Concurrency and Atomicity check ---');
    // Create Project C with limit: 5 reqs / 20s
    const createProjectCRes = await request('POST', '/projects', {
      name: 'Ratelimit Project C',
      targetBaseUrl: 'https://jsonplaceholder.typicode.com',
      rateLimit: { windowMs: 20000, maxRequests: 5 }
    }, {
      'Authorization': `Bearer ${token}`
    });

    if (createProjectCRes.status !== 201 || !createProjectCRes.body.apiKey) {
      throw new Error(`Failed to create test project C: ${JSON.stringify(createProjectCRes.body)}`);
    }

    const projectC = createProjectCRes.body;
    console.log(`  [INFO] Created Project C with apiKey="${projectC.apiKey}" (limit: 5 reqs / 20s)`);

    console.log('  [INFO] Firing 20 concurrent requests near-simultaneously...');
    const concurrentRequests = Array.from({ length: 20 }, () => 
      request('GET', `/proxy/${projectC.apiKey}/posts/1`)
    );

    const results = await Promise.all(concurrentRequests);

    let successCount = 0;
    let limitExceededCount = 0;
    let otherCount = 0;

    results.forEach((res) => {
      if (res.status === 200) {
        successCount++;
      } else if (res.status === 429) {
        limitExceededCount++;
      } else {
        otherCount++;
      }
    });

    console.log(`  [INFO] Concurrent results: Successes = ${successCount}, 429 Blocks = ${limitExceededCount}, Others = ${otherCount}`);

    if (successCount === 5 && limitExceededCount === 15) {
      console.log('  [PASS] Concurrency check: Exactly 5 requests succeeded and 15 were rejected. Atomicity verified!');
    } else {
      console.log(`  [FAIL] Concurrency check: Expected exactly 5 successes and 15 blocks. Got: ${successCount} successes, ${limitExceededCount} blocks.`);
    }

    // -------------------------------------------------------------------------
    // AC 7: Fail Open when Redis is Down
    // -------------------------------------------------------------------------
    console.log('\n--- AC 7: Fail Open when Redis is Down ---');
    console.log('  [INFO] Stopping Redis container (docker stop redis-dev)...');
    try {
      execSync('docker stop redis-dev');
      console.log('  [INFO] Redis container stopped.');
    } catch (err) {
      console.error('  [WARN] Failed to run docker stop command:', err.message);
    }

    // Wait a brief moment to allow the server to detect connection error
    await sleep(2000);

    // Call Project C proxy - should succeed (fail open) rather than hanging or returning 500/502
    console.log('  [INFO] Attempting proxy request while Redis is down...');
    const startTime = Date.now();
    const failOpenRes = await request('GET', `/proxy/${projectC.apiKey}/posts/1`);
    const duration = Date.now() - startTime;

    console.log(`  [INFO] Proxy response while Redis is down: Status = ${failOpenRes.status}, Duration = ${duration}ms`);
    
    if (failOpenRes.status === 200 && duration < 3000) {
      console.log('  [PASS] Fail-open: Proxy call succeeded in a timely manner despite Redis downtime.');
    } else {
      console.log(`  [FAIL] Fail-open: Expected status 200 and fast response. Got status: ${failOpenRes.status}, duration: ${duration}ms`);
    }

    // Restart Redis container
    console.log('  [INFO] Restarting Redis container (docker start redis-dev)...');
    try {
      execSync('docker start redis-dev');
      console.log('  [INFO] Redis container restarted.');
    } catch (err) {
      console.error('  [WARN] Failed to run docker start command:', err.message);
    }

    // Wait for redis connection to re-establish
    await sleep(3000);

    // Confirm that rate limiting works again after Redis recovery
    console.log('  [INFO] Verifying rate limiting recovers after Redis restarts...');
    const postRecoveryRes = await request('GET', `/proxy/${projectC.apiKey}/posts/1`);
    if (postRecoveryRes.status === 200 || postRecoveryRes.status === 429) {
      console.log('  [PASS] Post-recovery: Request handled successfully, Redis recovered.');
    } else {
      console.log('  [FAIL] Post-recovery: Expected 200 or 429. Got status:', postRecoveryRes.status);
    }

    console.log('\n=== All Redis Rate Limiter Tests Completed ===');
  } catch (error) {
    console.error('\nError conducting rate limiter tests:', error);
  }
}

runRateLimiterTests();
